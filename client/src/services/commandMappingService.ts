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
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip common conversational voice prefixes
  const conversationalPrefixes = [
    /^hey (?:zikenn|gemini|assistant|there)\s+/i,
    /^(?:please|can you|could you please|could you|kindly|i want to|let's|just)\s+/i,
    /^(?:hey|hi|hello)\s+/i,
  ];

  let stripped = rawClean;
  for (const prefix of conversationalPrefixes) {
    stripped = stripped.replace(prefix, '').trim();
  }

  return { rawClean, stripped };
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
