import {
  CommandMapping,
  CommandActionType,
  Priority,
  TaskStatus,
  ExpenseItem,
  TodoItem,
  ExpenseCategory,
  JournalEntry,
} from '../types';
import { Storage, DEFAULT_COMMAND_MAPPINGS } from '../utils/storage';
import { Sound } from '../utils/audio';
import { executeSecretaryTool } from './groqService';

export interface DirectAppHandlers {
  onAddExpense?: (item: Omit<ExpenseItem, 'id'>) => void;
  onAddTodo?: (
    title: string,
    priority: Priority,
    category: string,
    dueDate?: string,
    status?: TaskStatus
  ) => void;
  onAddHabit?: (title: string, category?: string, icon?: string, color?: string) => void;
  onToggleHabit?: (id: string, dayIndex?: number) => void;
  onNavigate?: (view: string, tabOrFilter?: string) => void;
  onAddJournal?: (title: string, content: string, mood?: string, tags?: string[]) => void;
  onAddQuote?: (quote: { text: string; author: string; category?: string }) => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

// Global in-memory registry of app handlers so voice events can call existing functions directly
let globalHandlers: DirectAppHandlers = {};

export function registerAppHandlers(handlers: DirectAppHandlers) {
  globalHandlers = { ...globalHandlers, ...handlers };
}

export function getRegisteredHandlers(): DirectAppHandlers {
  return globalHandlers;
}

/**
 * Dispatches dashboard data update and storage events so all active views update in real time
 */
export function broadcastDataChanged(module: string, extraDetail?: any) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('dashboard-data-updated', { detail: { module, ...extraDetail } })
      );
      window.dispatchEvent(new Event('storage'));
    } catch {}
  }
}

/**
 * Normalizes speech or text input for robust voice command matching:
 * - strips punctuation
 * - collapses spaces
 * - lowercases
 * - strips optional conversational prefixes ("hey zikenn", "please", "can you", etc.)
 */
export function normalizeVoiceInput(input: string): { rawClean: string; stripped: string } {
  if (!input) return { rawClean: '', stripped: '' };

  const rawClean = input
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’“”…«»„]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip common conversational voice prefixes
  const conversationalPrefixes = [
    /^hey (?:zikenn|gemini|assistant|there)\s+/i,
    /^(?:please|can you|could you please|could you|kindly|i want to|i need to|i would like to|let's|just)\s+/i,
    /^(?:hey|hi|hello)\s+/i,
  ];

  let stripped = rawClean;
  for (const prefix of conversationalPrefixes) {
    stripped = stripped.replace(prefix, '').trim();
  }

  return { rawClean, stripped };
}

/**
 * Intelligent expense category inference from keywords
 */
export function inferExpenseCategory(name: string): ExpenseCategory {
  const lower = name.toLowerCase();
  if (/\b(?:breakfast|lunch|dinner|burger|pizza|restaurant|cafe|swiggy|zomato|dining|meal)\b/.test(lower)) {
    return 'Dining Out';
  }
  if (/\b(?:coffee|tea|snack|snacks|cookie|chai|latte)\b/.test(lower)) {
    return 'Snacks & Coffee';
  }
  if (/\b(?:grocery|groceries|milk|vegetable|vegetables|fruit|fruits|supermarket|mart|bread|eggs|curd)\b/.test(lower)) {
    return 'Groceries & Food';
  }
  if (/\b(?:cab|uber|ola|auto|bus|train|flight|metro|petrol|fuel|gas|diesel|parking|toll|ride)\b/.test(lower)) {
    return 'Taxi & Transit';
  }
  if (/\b(?:bill|electricity|water|wifi|broadband|internet|recharge|mobile|phone|rent|maintenance)\b/.test(lower)) {
    return 'Bills & Utilities';
  }
  if (/\b(?:amazon|flipkart|clothes|shirt|shoes|shopping|mall|electronics|gadget|order)\b/.test(lower)) {
    return 'Shopping & Retail';
  }
  if (/\b(?:movie|cinema|netflix|spotify|game|concert|subscription|ott)\b/.test(lower)) {
    return 'Entertainment';
  }
  if (/\b(?:gym|medicine|doctor|hospital|pharmacy|fitness|health|clinic|tablets|workout)\b/.test(lower)) {
    return 'Health & Fitness';
  }
  return 'Other';
}

/**
 * Natural Language Intent Parser
 * Converts arbitrary speech transcripts into structured CommandMappings
 * with zero network calls, 100% offline reliability, and sub-millisecond execution.
 */
export function parseNaturalLanguageIntent(rawTranscript: string): MatchResult | null {
  if (!rawTranscript || typeof rawTranscript !== 'string') return null;

  const rawClean = rawTranscript.trim();
  if (!rawClean) return null;

  // Clean common speech quotes, brackets, and leading/trailing punctuation
  let clean = rawClean
    .replace(/^[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+/, '')
    .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
    .trim();

  // Strip conversational wake/filler phrases
  const leadingFillers = [
    /^(?:hey|hi|hello|ok|okay)\s+(?:zikenn|gemini|assistant|there)?\s*/i,
    /^(?:please|can you|could you|could you please|would you|kindly|i want to|i need to|i would like to|let's|just)\s+/i,
  ];
  for (const filler of leadingFillers) {
    clean = clean.replace(filler, '').trim();
  }

  // 1. ================== TASKS / TODOS ==================
  // Pattern: "Add a new task to visit Bangalore", "Add task visit Bangalore", "Add visit Bangalore to tasks", "Remind me to visit Bangalore", "New task: visit Bangalore"
  const addTaskPatterns = [
    /^(?:add|create|make|schedule|insert|put|record)\s+(?:a\s+)?(?:new\s+)?(?:task|todo|to-do|item)\s+(?:to\s+|called\s+|titled\s+|for\s+|:\s*|\-\s*)?(.+)$/i,
    /^(?:add|create|make|insert|put)\s+(.+?)\s+(?:to\s+|in\s+|into\s+)(?:my\s+)?(?:tasks?|todos?|to-dos?|task\s+list|todo\s+list)$/i,
    /^(?:remind me to|remember to|don't forget to|dont forget to)\s+(.+)$/i,
    /^(?:task|todo|to-do)\s*(?::\s*|\-\s*|\s+to\s+|\s+called\s+|\s+titled\s+|\s+)(.+)$/i,
    /^(?:new\s+task|new\s+todo)\s+(?:to\s+|called\s+|titled\s+|:\s*|\-\s*)?(.+)$/i,
  ];

  for (const pattern of addTaskPatterns) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      let taskBody = match[1].trim();

      // Extract Priority
      let priority: Priority = 'medium';
      if (/\b(?:with\s+)?(?:high|urgent|critical|important|top)\s+priority\b/i.test(taskBody) || /\b(?:urgently|asap)\b/i.test(taskBody)) {
        priority = 'high';
        taskBody = taskBody.replace(/\b(?:with\s+)?(?:high|urgent|critical|important|top)\s+priority\b/i, '').replace(/\b(?:urgently|asap)\b/i, '').trim();
      } else if (/\b(?:with\s+)?(?:low|minor)\s+priority\b/i.test(taskBody)) {
        priority = 'low';
        taskBody = taskBody.replace(/\b(?:with\s+)?(?:low|minor)\s+priority\b/i, '').trim();
      } else if (/\b(?:with\s+)?medium\s+priority\b/i.test(taskBody)) {
        priority = 'medium';
        taskBody = taskBody.replace(/\b(?:with\s+)?medium\s+priority\b/i, '').trim();
      }

      // Extract Due Date
      let dueDate = '';
      if (/\b(?:due\s+|by\s+|for\s+)?tomorrow\b/i.test(taskBody)) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        dueDate = d.toISOString().split('T')[0];
        taskBody = taskBody.replace(/\b(?:due\s+|by\s+|for\s+)?tomorrow\b/i, '').trim();
      } else if (/\b(?:due\s+|by\s+|for\s+)?(?:today|tonight)\b/i.test(taskBody)) {
        dueDate = new Date().toISOString().split('T')[0];
        taskBody = taskBody.replace(/\b(?:due\s+|by\s+|for\s+)?(?:today|tonight)\b/i, '').trim();
      }

      // Extract / Infer Category
      let category = 'Personal';
      const catMatch = taskBody.match(/\b(?:under|in|category)\s+(work|personal|study|errands|health|fitness|finance|sports)\b/i);
      if (catMatch) {
        category = catMatch[1].charAt(0).toUpperCase() + catMatch[1].slice(1).toLowerCase();
        taskBody = taskBody.replace(catMatch[0], '').trim();
      } else {
        const lower = taskBody.toLowerCase();
        if (/\b(?:kabaddi|cricket|football|soccer|gym|workout|exercise|running|run|swim|jog|fitness|training|yoga|sports|play)\b/.test(lower)) {
          category = 'Health';
        } else if (/\b(?:study|exam|upsc|gate|test|syllabus|revision|homework|read|chapter|paper|lecture)\b/.test(lower)) {
          category = 'Study';
        } else if (/\b(?:buy|groceries|grocery|market|store|milk|vegetables|shopping|purchase)\b/.test(lower)) {
          category = 'Errands';
        } else if (/\b(?:meeting|client|report|presentation|project|code|bug|deploy|email|office|work)\b/.test(lower)) {
          category = 'Work';
        }
      }

      // Final title cleanup (strip prefixes and trailing punctuation/quotes)
      taskBody = taskBody
        .replace(/^(?:to\s+|called\s+|titled\s+|for\s+|:\s*|\-\s*)+/i, '')
        .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
        .trim();
      const title = taskBody ? taskBody.charAt(0).toUpperCase() + taskBody.slice(1) : 'New Task';

      return {
        mapping: {
          id: `nl-todo-${Date.now()}`,
          triggerPhrase: rawClean,
          actionType: 'add_todo',
          parameters: {
            todoTitle: title,
            todoPriority: priority,
            todoCategory: category,
            todoDueDate: dueDate,
          },
          matchType: 'contains',
          enabled: true,
          description: `Natural voice command: "${rawClean}"`,
          createdAt: Date.now(),
        },
        matchedText: rawClean,
        extractedParams: {
          dynamicText: title,
        },
      };
    }
  }

  // 1b. Complete / Finish Task
  const completeTaskMatch = clean.match(
    /^(?:complete|finish|done|check\s+off|mark\s+(?:as\s+)?done)\s+(?:the\s+)?(?:task|todo|to-do)\s+(?:to\s+|called\s+|titled\s+|:\s*)?(.+)$/i
  );
  if (completeTaskMatch && completeTaskMatch[1]) {
    const title = completeTaskMatch[1].trim();
    return {
      mapping: {
        id: `nl-toggle-todo-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'toggle_todo',
        parameters: { todoTitle: title },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { dynamicText: title },
    };
  }

  // 1c. Delete / Remove Task
  const deleteTaskMatch = clean.match(
    /^(?:delete|remove|clear)\s+(?:the\s+)?(?:task|todo|to-do)\s+(?:to\s+|called\s+|titled\s+|:\s*)?(.+)$/i
  );
  if (deleteTaskMatch && deleteTaskMatch[1]) {
    const title = deleteTaskMatch[1].trim();
    return {
      mapping: {
        id: `nl-delete-todo-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'delete_todo',
        parameters: { todoTitle: title },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { dynamicText: title },
    };
  }

  // 1d. Clear All Tasks
  if (/^(?:clear|delete|remove)\s+all\s+(?:tasks|todos|to-dos)$/i.test(clean)) {
    return {
      mapping: {
        id: `nl-clear-tasks-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'clear_all_tasks',
        parameters: {},
        matchType: 'exact',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: {},
    };
  }

  // 2. ================== EXPENSES ==================
  // Pattern 2a: "Add expense 150 for lunch", "Log expense 250 for food", "Record expense ₹500 for groceries"
  const addExpenseRegex =
    /^(?:add|log|record|enter|track)\s+(?:a\s+)?(?:new\s+)?expense\s+(?:of\s+)?(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:rs|rupees|inr|bucks)?\s*(?:for|on|towards|called)?\s*(.+)$/i;
  const matchExpA = clean.match(addExpenseRegex);
  if (matchExpA && matchExpA[1] && matchExpA[2]) {
    const amount = parseFloat(matchExpA[1]);
    const expName = matchExpA[2].trim();
    const category = inferExpenseCategory(expName);
    return {
      mapping: {
        id: `nl-expense-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'add_expense',
        parameters: {
          expenseName: expName.charAt(0).toUpperCase() + expName.slice(1),
          expenseAmount: amount,
          expenseCategory: category,
        },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { amount, dynamicText: expName },
    };
  }

  // Pattern 2b: "Spent 150 on coffee", "Spend 200 on fuel", "Paid 500 for internet"
  const spentRegex =
    /^(?:spent|spend|paid)\s+(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:rs|rupees|inr|bucks)?\s*(?:for|on|towards|called)\s*(.+)$/i;
  const matchSpent = clean.match(spentRegex);
  if (matchSpent && matchSpent[1] && matchSpent[2]) {
    const amount = parseFloat(matchSpent[1]);
    const expName = matchSpent[2].trim();
    const category = inferExpenseCategory(expName);
    return {
      mapping: {
        id: `nl-spent-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'add_expense',
        parameters: {
          expenseName: expName.charAt(0).toUpperCase() + expName.slice(1),
          expenseAmount: amount,
          expenseCategory: category,
        },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { amount, dynamicText: expName },
    };
  }

  // Pattern 2c: "Log 250 for lunch", "Add 150 for breakfast"
  const shortExpRegex =
    /^(?:add|log|record)\s+(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:rs|rupees|inr|bucks)?\s*(?:for|on|towards|called)\s*(.+)$/i;
  const matchShortExp = clean.match(shortExpRegex);
  if (matchShortExp && matchShortExp[1] && matchShortExp[2]) {
    const amount = parseFloat(matchShortExp[1]);
    const expName = matchShortExp[2].trim();
    const category = inferExpenseCategory(expName);
    return {
      mapping: {
        id: `nl-short-exp-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'add_expense',
        parameters: {
          expenseName: expName.charAt(0).toUpperCase() + expName.slice(1),
          expenseAmount: amount,
          expenseCategory: category,
        },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { amount, dynamicText: expName },
    };
  }

  // 2d. Delete Expense: "Delete latest expense", "Delete expense coffee"
  if (/^(?:delete|remove|cancel)\s+(?:my\s+)?(?:latest|last)\s+expense$/i.test(clean)) {
    return {
      mapping: {
        id: `nl-del-last-exp-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'delete_expense',
        parameters: {},
        matchType: 'exact',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: {},
    };
  }
  const delExpMatch = clean.match(
    /^(?:delete|remove|cancel)\s+(?:the\s+)?(?:expense|payment|bill)\s+(?:for\s+|of\s+|called\s+)?(.+)$/i
  );
  if (delExpMatch && delExpMatch[1]) {
    const query = delExpMatch[1].trim();
    return {
      mapping: {
        id: `nl-del-exp-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'delete_expense',
        parameters: { expenseName: query },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { dynamicText: query },
    };
  }

  // 2e. Clear all expenses
  if (/^(?:clear|delete|remove)\s+all\s+expenses$/i.test(clean)) {
    return {
      mapping: {
        id: `nl-clear-exp-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'clear_all_expenses',
        parameters: {},
        matchType: 'exact',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: {},
    };
  }

  // 3. ================== HABITS ==================
  // "Add habit drink water", "New habit reading", "Create habit yoga"
  const addHabitMatch = clean.match(
    /^(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?habit\s+(?:to\s+|called\s+|titled\s+|:\s*)?(.+)$/i
  );
  if (addHabitMatch && addHabitMatch[1]) {
    const title = addHabitMatch[1].trim();
    return {
      mapping: {
        id: `nl-habit-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'add_habit',
        parameters: {
          habitTitle: title.charAt(0).toUpperCase() + title.slice(1),
          habitCategory: 'Daily',
        },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { dynamicText: title },
    };
  }

  // Toggle habit: "Toggle habit meditation", "Check habit water"
  const toggleHabitMatch = clean.match(
    /^(?:toggle|check|complete|mark|finish)\s+(?:the\s+)?habit\s+(?:called\s+|titled\s+|:\s*)?(.+)$/i
  );
  if (toggleHabitMatch && toggleHabitMatch[1]) {
    const title = toggleHabitMatch[1].trim();
    return {
      mapping: {
        id: `nl-toggle-habit-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'toggle_habit',
        parameters: { habitTitle: title },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { dynamicText: title },
    };
  }

  // 4. ================== NAVIGATION ==================
  // "Go to tasks", "Open expenses", "Show habits", "Go home"
  const navMatch = clean.match(
    /^(?:go\s+to|open|show|switch\s+to|navigate\s+to)\s+(?:the\s+)?(todos?|tasks?|expenses?|budget|habits?|journal|notes?|analytics|stats|schedule|timeline|vault|settings|home|dashboard|quotes?|doodle|exams?)$/i
  );
  if (navMatch && navMatch[1]) {
    const rawTarget = navMatch[1].toLowerCase();
    let view = 'home';
    if (/^(?:todo|todos|task|tasks)$/.test(rawTarget)) view = 'tasks';
    else if (/^(?:expense|expenses|budget)$/.test(rawTarget)) view = 'expenses';
    else if (/^(?:habit|habits)$/.test(rawTarget)) view = 'habits';
    else if (/^(?:journal|note|notes)$/.test(rawTarget)) view = 'journal';
    else if (/^(?:analytics|stats)$/.test(rawTarget)) view = 'analytics';
    else if (/^(?:schedule|timeline)$/.test(rawTarget)) view = 'schedule';
    else if (/^(?:vault)$/.test(rawTarget)) view = 'vault';
    else if (/^(?:settings)$/.test(rawTarget)) view = 'settings';
    else if (/^(?:quote|quotes)$/.test(rawTarget)) view = 'quotes';
    else if (/^(?:doodle)$/.test(rawTarget)) view = 'doodle';
    else if (/^(?:exam|exams)$/.test(rawTarget)) view = 'exams';
    else if (/^(?:home|dashboard)$/.test(rawTarget)) view = 'home';

    return {
      mapping: {
        id: `nl-nav-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'navigate_view',
        parameters: { view },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { dynamicText: view },
    };
  }

  // 5. ================== ALARMS ==================
  const alarmMatch = clean.match(
    /^(?:set|create)\s+(?:an\s+)?alarm\s+(?:for|at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (alarmMatch && alarmMatch[1]) {
    return {
      mapping: {
        id: `nl-alarm-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'set_alarm',
        parameters: { alarmTime: alarmMatch[1].trim() },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { dynamicText: alarmMatch[1].trim() },
    };
  }

  if (/^(?:cancel|stop|clear|turn\s+off)\s+(?:the\s+)?alarm$/i.test(clean)) {
    return {
      mapping: {
        id: `nl-cancel-alarm-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'cancel_alarm',
        parameters: {},
        matchType: 'exact',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: {},
    };
  }

  // 6. ================== JOURNAL / NOTES ==================
  const journalMatch = clean.match(
    /^(?:add|write|log|create)\s+(?:a\s+)?(?:new\s+)?(?:journal|note|diary)\s+(?:entry\s+)?(?:called\s+|titled\s+|about\s+|:\s*)?(.+)$/i
  );
  if (journalMatch && journalMatch[1]) {
    const text = journalMatch[1].trim();
    return {
      mapping: {
        id: `nl-journal-${Date.now()}`,
        triggerPhrase: rawClean,
        actionType: 'add_journal',
        parameters: {
          journalTitle: 'Voice Note',
          journalContent: text,
        },
        matchType: 'contains',
        enabled: true,
        createdAt: Date.now(),
      },
      matchedText: rawClean,
      extractedParams: { dynamicText: text },
    };
  }

  return null;
}

/**
 * Extract an expense amount if the user uttered a number along with the trigger
 * e.g., "log breakfast 220" or "log breakfast for ₹350" or "morning coffee 85 rupees"
 */
function extractDynamicAmount(text: string, triggerPhrase: string): number | null {
  // Remove the trigger phrase part from text
  const cleanTrigger = triggerPhrase.toLowerCase();
  const remainder = text.toLowerCase().replace(cleanTrigger, '').trim();

  // Look for numeric amounts with currency prefixes/suffixes
  const regex = /(?:(?:for|of|rs\.?|inr|₹|approx|around)\s*)?(\d+(?:\.\d+)?)(?:\s*(?:rupees|rs|inr|bucks))?/i;
  const match = remainder.match(regex);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0 && val < 1000000) {
      return val;
    }
  }
  return null;
}

/**
 * Extract dynamic detail text if user said extra words
 * e.g., "buy groceries milk, bread and eggs" -> detail: "milk, bread and eggs"
 */
function extractDynamicText(text: string, triggerPhrase: string): string | null {
  const cleanTrigger = triggerPhrase.toLowerCase();
  const index = text.toLowerCase().indexOf(cleanTrigger);
  if (index !== -1) {
    const after = text.substring(index + cleanTrigger.length).trim();
    // remove leading prepositions like "for", "with", "of", "and"
    const cleanedAfter = after.replace(/^(?:for|with|of|and|about|titled|called)\s+/i, '').trim();
    if (cleanedAfter.length > 0) {
      return cleanedAfter;
    }
  }
  return null;
}

export interface MatchResult {
  mapping: CommandMapping;
  matchedText: string;
  extractedParams: {
    amount?: number;
    dynamicText?: string;
  };
}

/**
 * Searches user-defined and default command mappings for a matching voice trigger phrase.
 */
export function matchCommandTrigger(rawTranscript: string): MatchResult | null {
  if (!rawTranscript || typeof rawTranscript !== 'string') return null;

  const { rawClean, stripped } = normalizeVoiceInput(rawTranscript);
  if (!rawClean && !stripped) return null;

  const allMappings = Storage.getCommandMappings();
  const activeMappings = allMappings.filter((m) => m.enabled);

  // Sort mappings by triggerPhrase length descending so more specific triggers match first
  const sortedMappings = [...activeMappings].sort(
    (a, b) => b.triggerPhrase.length - a.triggerPhrase.length
  );

  for (const mapping of sortedMappings) {
    const trigger = normalizeVoiceInput(mapping.triggerPhrase).rawClean;
    if (!trigger) continue;

    const matchType = mapping.matchType || 'contains';
    let isMatch = false;

    if (matchType === 'exact') {
      isMatch = stripped === trigger || rawClean === trigger;
    } else if (matchType === 'starts_with') {
      isMatch = stripped.startsWith(trigger) || rawClean.startsWith(trigger);
    } else {
      // 'contains': match full words or phrase substring
      const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`(?:^|\\s)${escapedTrigger}(?:\\s|$)`, 'i');
      isMatch =
        wordBoundaryRegex.test(stripped) ||
        wordBoundaryRegex.test(rawClean) ||
        stripped.includes(trigger) ||
        rawClean.includes(trigger);
    }

    if (isMatch) {
      const extractedParams: { amount?: number; dynamicText?: string } = {};

      if (mapping.actionType === 'add_expense' || mapping.actionType === 'delete_expense') {
        const dynAmount = extractDynamicAmount(rawClean, trigger);
        if (dynAmount !== null) {
          extractedParams.amount = dynAmount;
        }
      }

      const dynText = extractDynamicText(rawClean, trigger);
      if (dynText) {
        extractedParams.dynamicText = dynText;
      }

      return {
        mapping,
        matchedText: rawTranscript,
        extractedParams,
      };
    }
  }

  // If no explicit user-defined or default mapping matched, fall back to natural language intent recognition!
  const cleanedText = rawTranscript
    .replace(/^[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+/, '')
    .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
    .trim();

  const nlMatch =
    parseNaturalLanguageIntent(rawTranscript) ||
    parseNaturalLanguageIntent(cleanedText) ||
    (stripped ? parseNaturalLanguageIntent(stripped) : null);
  if (nlMatch) {
    return nlMatch;
  }

  return null;
}

export interface ExecutionResult {
  success: boolean;
  message: string;
  actionChip?: string;
  actionType: CommandActionType;
  details?: any;
}

/**
 * Executes the mapped action directly calling existing functions like
 * handleAddExpense or handleAddTodo, updating state and Storage immediately.
 */
export async function executeCommandMapping(
  mapping: CommandMapping,
  extractedParams?: { amount?: number; dynamicText?: string },
  overrideHandlers?: DirectAppHandlers
): Promise<ExecutionResult> {
  const handlers = overrideHandlers || globalHandlers;
  const p = mapping.parameters || {};

  // Update mapping usage stats in Storage
  try {
    const currentMappings = Storage.getCommandMappings();
    const updated = currentMappings.map((m) => {
      if (m.id === mapping.id) {
        return {
          ...m,
          executionCount: (m.executionCount || 0) + 1,
          lastExecutedAt: Date.now(),
        };
      }
      return m;
    });
    Storage.setCommandMappings(updated);
  } catch (err) {
    console.warn('Failed to update mapping execution stats:', err);
  }

  // Play auditory feedback
  Sound.voiceRegistered(true);

  switch (mapping.actionType) {
    // ----------------------------------------------------
    // EXPENSES: Directly calls handleAddExpense
    // ----------------------------------------------------
    case 'add_expense': {
      const amount = extractedParams?.amount ?? p.expenseAmount ?? 100;
      let name = 'Expense';
      if (extractedParams?.dynamicText) {
        name = p.expenseName ? `${p.expenseName} (${extractedParams.dynamicText})` : extractedParams.dynamicText;
      } else if (p.expenseName) {
        name = p.expenseName;
      }
      name = name.charAt(0).toUpperCase() + name.slice(1);
      const category: ExpenseCategory = (p.expenseCategory as ExpenseCategory) || 'Dining Out';

      const expenseData: Omit<ExpenseItem, 'id'> = {
        name,
        amount,
        category,
        date: new Date().toISOString().split('T')[0],
        billingCycle: 'monthly',
        icon: getExpenseIcon(category),
        active: true,
      };

      if (handlers.onAddExpense) {
        handlers.onAddExpense(expenseData);
      } else {
        // Direct storage fallback
        const newExpense: ExpenseItem = {
          id: `exp-${Date.now()}`,
          ...expenseData,
        };
        const current = Storage.getExpenses();
        Storage.setExpenses([newExpense, ...current]);
      }
      broadcastDataChanged('expenses');

      Sound.success(true);
      const msg = `Logged ₹${amount.toLocaleString()} for "${name}" under ${category}.`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'success');

      return {
        success: true,
        actionType: 'add_expense',
        message: msg,
        actionChip: `✓ Expense Logged: ₹${amount} (${name})`,
        details: expenseData,
      };
    }

    // ----------------------------------------------------
    // DELETE EXPENSE
    // ----------------------------------------------------
    case 'delete_expense': {
      const res = await executeSecretaryTool('delete_expense', {
        query: extractedParams?.dynamicText || p.expenseName,
        amount: extractedParams?.amount ?? p.expenseAmount,
        isLatest: !extractedParams?.dynamicText && !extractedParams?.amount,
      });

      broadcastDataChanged('expenses');
      Sound.success(true);
      const msg = res.data?.message || res.actionChip || 'Expense deleted.';
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'success');

      return {
        success: res.data?.success !== false,
        actionType: 'delete_expense',
        message: msg,
        actionChip: res.actionChip,
        details: res.data,
      };
    }

    // ----------------------------------------------------
    // CLEAR ALL EXPENSES
    // ----------------------------------------------------
    case 'clear_all_expenses': {
      const count = Storage.getExpenses().length;
      Storage.setExpenses([]);
      broadcastDataChanged('expenses');
      Sound.success(true);
      const msg = `Cleared all ${count} expenses.`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'info');

      return {
        success: true,
        actionType: 'clear_all_expenses',
        message: msg,
        actionChip: `✓ Cleared All Expenses (${count})`,
      };
    }

    // ----------------------------------------------------
    // TASKS / TODOS: Directly calls handleAddTodo
    // ----------------------------------------------------
    case 'add_todo': {
      let title = 'New Task';
      if (extractedParams?.dynamicText) {
        title = p.todoTitle ? `${p.todoTitle}: ${extractedParams.dynamicText}` : extractedParams.dynamicText;
      } else if (p.todoTitle) {
        title = p.todoTitle;
      }
      title = title.charAt(0).toUpperCase() + title.slice(1);
      const priority: Priority = p.todoPriority || 'medium';
      const category = p.todoCategory || 'General';
      const dueDate =
        p.todoDueDate === 'today'
          ? new Date().toISOString().split('T')[0]
          : p.todoDueDate || '';

      if (handlers.onAddTodo) {
        handlers.onAddTodo(title, priority, category, dueDate, 'todo');
      } else {
        // Direct storage fallback
        const newTodo: TodoItem = {
          id: `todo-${Date.now()}`,
          title,
          completed: false,
          status: 'todo',
          priority,
          category,
          dueDate,
          createdAt: Date.now(),
        };
        const current = Storage.getTodos();
        Storage.setTodos([newTodo, ...current]);
      }
      broadcastDataChanged('tasks');

      Sound.success(true);
      const msg = `Added task "${title}" [${priority.toUpperCase()} priority].`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'success');

      return {
        success: true,
        actionType: 'add_todo',
        message: msg,
        actionChip: `✓ Task Added: "${title}"`,
        details: { title, priority, category, dueDate },
      };
    }

    // ----------------------------------------------------
    // DELETE TODO
    // ----------------------------------------------------
    case 'delete_todo': {
      const query = (extractedParams?.dynamicText || p.todoTitle || '').toLowerCase().trim();
      const current = Storage.getTodos();
      const match = query
        ? current.find((t) => t.title.toLowerCase().includes(query))
        : current[0];

      if (!match) {
        return {
          success: false,
          actionType: 'delete_todo',
          message: `No task found matching "${query || 'recent'}".`,
        };
      }

      const updated = current.filter((t) => t.id !== match.id);
      Storage.setTodos(updated);
      broadcastDataChanged('tasks');
      Sound.success(true);
      const msg = `Deleted task "${match.title}".`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'success');

      return {
        success: true,
        actionType: 'delete_todo',
        message: msg,
        actionChip: `✓ Task Deleted: "${match.title}"`,
        details: match,
      };
    }

    // ----------------------------------------------------
    // TOGGLE TODO
    // ----------------------------------------------------
    case 'toggle_todo': {
      const query = (extractedParams?.dynamicText || p.todoTitle || '').toLowerCase().trim();
      const current = Storage.getTodos();
      const targetIndex = query
        ? current.findIndex((t) => t.title.toLowerCase().includes(query))
        : 0;

      if (targetIndex === -1 || !current[targetIndex]) {
        return {
          success: false,
          actionType: 'toggle_todo',
          message: `No task found matching "${query || 'recent'}".`,
        };
      }

      const task = { ...current[targetIndex] };
      task.completed = !task.completed;
      task.status = task.completed ? 'complete' : 'todo';
      const updated = [...current];
      updated[targetIndex] = task;
      Storage.setTodos(updated);
      broadcastDataChanged('tasks');
      Sound.success(true);
      const stateStr = task.completed ? 'Completed' : 'Reopened';
      const msg = `${stateStr} task "${task.title}".`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'success');

      return {
        success: true,
        actionType: 'toggle_todo',
        message: msg,
        actionChip: `✓ Task ${stateStr}: "${task.title}"`,
        details: task,
      };
    }

    // ----------------------------------------------------
    // CLEAR ALL TASKS
    // ----------------------------------------------------
    case 'clear_all_tasks': {
      const count = Storage.getTodos().length;
      Storage.setTodos([]);
      broadcastDataChanged('tasks');
      Sound.success(true);
      const msg = `Cleared all ${count} tasks.`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'info');

      return {
        success: true,
        actionType: 'clear_all_tasks',
        message: msg,
        actionChip: `✓ Cleared All Tasks (${count})`,
      };
    }

    // ----------------------------------------------------
    // HABITS: Directly calls handleAddHabit
    // ----------------------------------------------------
    case 'add_habit': {
      const title = extractedParams?.dynamicText
        ? `${p.habitTitle || 'Habit'}: ${extractedParams.dynamicText}`
        : p.habitTitle || 'Daily Habit';
      const category = p.habitCategory || 'Daily';

      if (handlers.onAddHabit) {
        handlers.onAddHabit(title, category, '⚡', '#6366F1');
      } else {
        const current = Storage.getHabits();
        const newHabit = {
          id: `habit-${Date.now()}`,
          title,
          category,
          icon: '⚡',
          completedDays: [false, false, false, false, false, false, false],
          streak: 0,
          color: '#6366F1',
        };
        Storage.setHabits([newHabit, ...current]);
      }
      broadcastDataChanged('habits');

      Sound.success(true);
      const msg = `Created habit "${title}".`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'success');

      return {
        success: true,
        actionType: 'add_habit',
        message: msg,
        actionChip: `✓ Habit Created: "${title}"`,
        details: { title, category },
      };
    }

    // ----------------------------------------------------
    // HABIT TOGGLE: Directly calls handleToggleHabit
    // ----------------------------------------------------
    case 'toggle_habit': {
      const habits = Storage.getHabits();
      let targetHabit = habits.find((h) => h.id === p.habitId);
      if (!targetHabit && p.habitTitle) {
        targetHabit = habits.find((h) =>
          h.title.toLowerCase().includes(p.habitTitle!.toLowerCase())
        );
      }
      if (!targetHabit && habits.length > 0) {
        targetHabit = habits[0];
      }

      if (!targetHabit) {
        return {
          success: false,
          actionType: 'toggle_habit',
          message: 'No habit found to toggle.',
        };
      }

      if (handlers.onToggleHabit) {
        handlers.onToggleHabit(targetHabit.id);
      }
      broadcastDataChanged('habits');

      Sound.success(true);
      const msg = `Toggled habit "${targetHabit.title}".`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'success');

      return {
        success: true,
        actionType: 'toggle_habit',
        message: msg,
        actionChip: `✓ Habit Toggled: "${targetHabit.title}"`,
        details: targetHabit,
      };
    }

    // ----------------------------------------------------
    // NAVIGATION: Directly calls handleNavigate
    // ----------------------------------------------------
    case 'navigate_view': {
      const view = p.view || 'home';
      if (handlers.onNavigate) {
        handlers.onNavigate(view);
      }
      Sound.click(true);
      const msg = `Navigated to ${view}.`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'info');

      return {
        success: true,
        actionType: 'navigate_view',
        message: msg,
        actionChip: `⚡ Navigated to ${view.toUpperCase()}`,
        details: { view },
      };
    }

    // ----------------------------------------------------
    // ALARMS
    // ----------------------------------------------------
    case 'set_alarm': {
      const timeStr = extractedParams?.dynamicText || p.alarmTime || '07:00';
      let hours = 7;
      let minutes = 0;
      const match12 = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
      if (match12) {
        hours = parseInt(match12[1], 10);
        minutes = match12[2] ? parseInt(match12[2], 10) : 0;
        const ampm = (match12[3] || '').toLowerCase();
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
      }
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      if (target.getTime() <= Date.now()) {
        target.setDate(target.getDate() + 1);
      }
      const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const alarm = {
        id: `alarm-${Date.now()}`,
        targetTimestamp: target.getTime(),
        targetTimeStr: formattedTime,
        label: p.alarmLabel || 'Voice Alarm',
        createdTimestamp: Date.now(),
        lastAction: 'set' as const,
      };
      Storage.setActiveAlarm(alarm);
      Sound.success(true);
      const msg = `Alarm scheduled for ${formattedTime}.`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'success');

      return {
        success: true,
        actionType: 'set_alarm',
        message: msg,
        actionChip: `⏰ Alarm Set: ${formattedTime}`,
        details: alarm,
      };
    }

    case 'cancel_alarm': {
      Storage.setActiveAlarm(null);
      Sound.success(true);
      const msg = 'Active alarm cancelled.';
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'info');

      return {
        success: true,
        actionType: 'cancel_alarm',
        message: msg,
        actionChip: '⏰ Alarm Cancelled',
      };
    }

    // ----------------------------------------------------
    // JOURNAL ENTRY: Directly calls handleAddJournal
    // ----------------------------------------------------
    case 'add_journal': {
      const title = p.journalTitle || 'Voice Note';
      const content = extractedParams?.dynamicText || p.journalContent || 'Voice captured note';

      if (handlers.onAddJournal) {
        handlers.onAddJournal(title, content, '⚡', ['VoiceTrigger']);
      } else {
        const current = Storage.getJournal();
        const entry: JournalEntry = {
          id: `entry-${Date.now()}`,
          title,
          content,
          date: new Date().toISOString().split('T')[0],
          timestamp: Date.now(),
          mood: '⚡',
          moodLabel: 'Focus',
          tags: ['VoiceTrigger'],
        };
        Storage.setJournal([entry, ...current]);
      }
      broadcastDataChanged('journal');

      Sound.success(true);
      const msg = `Added journal entry "${title}".`;
      handlers.onShowToast?.(`Voice Trigger: ${msg}`, 'success');

      return {
        success: true,
        actionType: 'add_journal',
        message: msg,
        actionChip: `✓ Journal Added: "${title}"`,
        details: { title, content },
      };
    }

    default:
      return {
        success: false,
        actionType: mapping.actionType,
        message: `Unknown action type: ${mapping.actionType}`,
      };
  }
}

/**
 * Helper to pick a sensible icon for an expense category
 */
function getExpenseIcon(category: string): string {
  switch (category.toLowerCase()) {
    case 'food & dining':
    case 'food':
      return '🍳';
    case 'shopping':
      return '🛍️';
    case 'transportation':
    case 'transport':
      return '🚗';
    case 'entertainment':
      return '🎬';
    case 'health':
    case 'fitness':
      return '💊';
    case 'utilities':
    case 'bills':
      return '⚡';
    case 'education':
      return '📚';
    default:
      return '💳';
  }
}

// ----------------------------------------------------
// CRUD helpers for Command Mappings
// ----------------------------------------------------
export function createCommandMapping(
  mapping: Omit<CommandMapping, 'id' | 'createdAt' | 'executionCount'>
): CommandMapping {
  const newMapping: CommandMapping = {
    ...mapping,
    id: 'cmd-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    createdAt: Date.now(),
    executionCount: 0,
  };

  const current = Storage.getCommandMappings();
  Storage.setCommandMappings([newMapping, ...current]);
  return newMapping;
}

export function updateCommandMapping(
  id: string,
  updates: Partial<CommandMapping>
): CommandMapping | null {
  const current = Storage.getCommandMappings();
  const index = current.findIndex((m) => m.id === id);
  if (index === -1) return null;

  const updatedMapping = { ...current[index], ...updates };
  const updatedList = [...current];
  updatedList[index] = updatedMapping;

  Storage.setCommandMappings(updatedList);
  return updatedMapping;
}

export function deleteCommandMapping(id: string): boolean {
  const current = Storage.getCommandMappings();
  const filtered = current.filter((m) => m.id !== id);
  if (filtered.length === current.length) return false;

  Storage.setCommandMappings(filtered);
  return true;
}

export function toggleCommandMapping(id: string): boolean {
  const current = Storage.getCommandMappings();
  const item = current.find((m) => m.id === id);
  if (!item) return false;

  return !!updateCommandMapping(id, { enabled: !item.enabled });
}

export function resetDefaultCommandMappings(): CommandMapping[] {
  Storage.setCommandMappings(DEFAULT_COMMAND_MAPPINGS);
  return DEFAULT_COMMAND_MAPPINGS;
}
