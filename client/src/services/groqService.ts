import { Storage } from '../utils/storage';
import { flushAutoSyncImmediately, isSupabaseConfigured } from '../utils/supabase';
import {
  TodoItem,
  HabitItem,
  ExpenseItem,
  GoalItem,
  JournalEntry,
  MediaItem,
  Priority,
  TaskStatus,
} from '../types';

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  actionChips?: string[];
  timestamp: number;
}

export interface GroqSecretaryResponse {
  reply: string;
  actionChips: string[];
  updatedHistory: ChatMessage[];
  error?: string;
}

const GROQ_DIRECT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_PROXY_URL = '/api/groq/chat/completions';
export const GROQ_MODEL = 'llama-3.3-70b-versatile';
export const CANDIDATE_GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
];

async function postGroqChat(apiKey: string, payload: any): Promise<Response> {
  // First try the local proxy to prevent any browser iframe/CORS/extension blocking
  try {
    const proxyRes = await fetch(GROQ_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {
    // Local proxy not reachable, fallback to direct
  }

  return fetch(GROQ_DIRECT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}

// Normalizes user-specified dates or natural language phrases (e.g. "9 sept 2026", "yesterday", "2026-09-09")
export function parseFlexibleDate(input?: string | null): string | null {
  if (!input) return null;
  const str = String(input).trim().toLowerCase();
  if (!str) return null;

  const now = new Date();
  if (str === 'today') {
    return now.toISOString().split('T')[0];
  }
  if (str === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return y.toISOString().split('T')[0];
  }
  if (str === 'tomorrow') {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return t.toISOString().split('T')[0];
  }

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const d = ddmmyyyy[1].padStart(2, '0');
    const m = ddmmyyyy[2].padStart(2, '0');
    const y = ddmmyyyy[3];
    return `${y}-${m}-${d}`;
  }

  // Month names dictionary
  const months: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };

  // e.g. "9 sept 2026", "9th september 2026", "09 sept 2026"
  const dmyMatch = str.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)[,\s]+(\d{4})$/i);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const mStr = dmyMatch[2].toLowerCase();
    const y = dmyMatch[3];
    const m = months[mStr] || months[mStr.slice(0, 3)];
    if (m) return `${y}-${m}-${d}`;
  }

  // e.g. "sept 9 2026", "september 9, 2026", "sept 9th 2026"
  const mdyMatch = str.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})$/i);
  if (mdyMatch) {
    const mStr = mdyMatch[1].toLowerCase();
    const d = mdyMatch[2].padStart(2, '0');
    const y = mdyMatch[3];
    const m = months[mStr] || months[mStr.slice(0, 3)];
    if (m) return `${y}-${m}-${d}`;
  }

  // Native Date fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

export function matchesDateFilter(itemDateStr: string | undefined, targetDateStr: string): boolean {
  if (!itemDateStr) return false;
  if (itemDateStr === targetDateStr) return true;

  const normalizedItem = parseFlexibleDate(itemDateStr) || itemDateStr.slice(0, 10);
  const normalizedTarget = parseFlexibleDate(targetDateStr) || targetDateStr;

  if (normalizedItem === normalizedTarget) return true;

  // Month matching: e.g. target is "2026-09"
  if (normalizedTarget.length === 7 && normalizedItem.startsWith(normalizedTarget)) {
    return true;
  }

  return false;
}

// Get today's day index (0=Mon, 6=Sun)
const getTodayDayIndex = (): number => {
  const day = new Date().getDay(); // 0 is Sun
  return day === 0 ? 6 : day - 1;
};

// Extract user intent for deleting or clearing expenses
export function extractExpenseDeletionIntent(prompt: string): {
  isDeletion: boolean;
  isAll: boolean;
  isLatest: boolean;
  amount?: number;
  date?: string;
  query?: string;
} {
  const norm = prompt.trim();
  const lower = norm.toLowerCase();

  const deleteWords = /\b(delete|remove|clear|erase|drop|cancel|destroy|cut)\b/i;
  const expenseWords = /\b(spendings?|expenses?|transactions?|payments?|costs?|bills?|charges?)\b/i;

  const hasDeleteWord = deleteWords.test(lower);
  const hasExpenseWord = expenseWords.test(lower);

  // Check currency expressions e.g. "delete 500 rs", "remove ₹50", "delete 50"
  const amountWithCurrency = /(?:₹|rs\.?|inr|\$)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|\$|rupees?|bucks)/i;
  const hasAmountWithCurrency = amountWithCurrency.test(lower);

  if (!hasDeleteWord && !lower.includes('clear')) {
    return { isDeletion: false, isAll: false, isLatest: false };
  }

  // Must mention expense, spending, or have an amount with delete verb, or "clear all"
  if (!hasExpenseWord && !hasAmountWithCurrency && !lower.includes('clear all') && !lower.includes('clear expenses')) {
    return { isDeletion: false, isAll: false, isLatest: false };
  }

  const isAll = /\b(all|everything|every)\b/i.test(lower) || lower.includes('clear all');
  const isLatest = /\b(last|latest|recent|newest)\b/i.test(lower);

  // Extract numeric amount
  let amount: number | undefined;
  const amtMatch = lower.match(/(?:(?:₹|rs\.?|inr|\$)\s*(\d+(?:\.\d+)?))|(?:(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|\$|rupees?|bucks)?)/);
  if (amtMatch) {
    const rawVal = amtMatch[1] || amtMatch[2];
    if (rawVal) {
      const parsed = parseFloat(rawVal);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
      }
    }
  }

  // Extract date if present
  let date: string | undefined;
  const dateMatch = lower.match(
    /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*\d{0,4}|\d{4}-\d{2}-\d{2}|yesterday|today)\b/i
  );
  if (dateMatch) {
    date = dateMatch[1];
  }

  // Extract clean keyword/merchant
  let query = lower
    .replace(deleteWords, '')
    .replace(expenseWords, '')
    .replace(/\b(all|everything|every|last|latest|recent|newest|my|the|a|an|of|for|on|in|rs\.?|inr|rupees?|\$)\b/gi, '')
    .replace(/\b\d+(\.\d+)?\b/g, '')
    .trim();

  return {
    isDeletion: true,
    isAll,
    isLatest: isLatest || (!query && amount === undefined && !date && !isAll),
    amount,
    date,
    query: query.length > 0 ? query : undefined,
  };
}

// Dispatch a custom event so all open React views update immediately, and flush to cloud storage
const notifyDataChanged = (module: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('dashboard-data-updated', { detail: { module } })
    );
    try {
      window.dispatchEvent(new Event('storage'));
    } catch {
      // ignore
    }
  }
  if (isSupabaseConfigured()) {
    void flushAutoSyncImmediately(Storage.getAllDataPayload());
  }
};

// Schema-based Tool Definitions for Groq (OpenAI-compatible function calling)
export const SECRETARY_TOOLS = [
  // 1. Tasks
  {
    type: 'function',
    function: {
      name: 'fetch_tasks',
      description:
        'Fetch current live tasks/todos with live counts. Supports filtering by completion status (all, pending, completed), category, keyword query, or due date.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: ['string', 'null'],
            enum: ['all', 'pending', 'completed', null],
            description: 'Filter by completion status (default: all)',
          },
          category: {
            type: ['string', 'null'],
            description: 'Optional category name to filter tasks by',
          },
          query: {
            type: ['string', 'null'],
            description: 'Search keyword in task title',
          },
          dueDate: {
            type: ['string', 'null'],
            description: 'Filter by due date (e.g. today, tomorrow, YYYY-MM-DD)',
          },
          limit: {
            type: ['number', 'null'],
            description: 'Maximum sample tasks to return (default: 20)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Add a new task/todo item to the dashboard.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title or description of the task' },
          priority: {
            type: ['string', 'null'],
            enum: ['urgent', 'high', 'medium', 'low', null],
            description: 'Priority level (default: medium)',
          },
          category: { type: ['string', 'null'], description: 'Category tag (default: General)' },
          dueDate: {
            type: ['string', 'null'],
            description: 'Due date in YYYY-MM-DD format (optional)',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update or mark a task as completed or pending, or change its priority.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID of the task to update' },
          completed: {
            type: ['boolean', 'null'],
            description: 'Whether the task is completed (true/false)',
          },
          title: { type: ['string', 'null'], description: 'Updated title' },
          priority: {
            type: ['string', 'null'],
            enum: ['urgent', 'high', 'medium', 'low', null],
            description: 'Updated priority',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description:
        'Delete one or more tasks from the dashboard by ID, title/keyword query, completed status, or latest.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: ['string', 'null'], description: 'Optional specific ID of the task to remove' },
          query: {
            type: ['string', 'null'],
            description: 'Task title, keyword, or text to search and delete (e.g. "buy milk", "workout")',
          },
          completedOnly: {
            type: ['boolean', 'null'],
            description: 'If true, deletes completed tasks matching query or all completed tasks',
          },
          latest: {
            type: ['boolean', 'null'],
            description: 'If true, deletes the most recently added task',
          },
          all: {
            type: ['boolean', 'null'],
            description: 'If true, deletes all matching tasks',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_all_tasks',
      description: 'Clear all tasks, or all completed tasks, from the dashboard.',
      parameters: {
        type: 'object',
        properties: {
          completedOnly: {
            type: ['boolean', 'null'],
            description: 'If true, clears only completed tasks. If false or omitted, clears all tasks.',
          },
        },
      },
    },
  },

  // 2. Habits
  {
    type: 'function',
    function: {
      name: 'fetch_habits',
      description:
        "Fetch live habits with current streaks and this week's daily completion status (Mon to Sun).",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_habit',
      description: 'Create a new daily habit to track in the Habit Tracker.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Name of the habit' },
          category: { type: ['string', 'null'], description: 'Category (Health, Mind, Study, Routine)' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_habit',
      description:
        "Toggle completion of a habit for today or a specific day index (0=Mon, 6=Sun).",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID of the habit' },
          dayIndex: {
            type: ['number', 'null'],
            description: 'Day of week index 0=Mon, 1=Tue... 6=Sun. If omitted, defaults to today.',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_habit',
      description: 'Delete a habit by ID, name/title query, or latest.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: ['string', 'null'], description: 'Optional ID of the habit to delete' },
          query: {
            type: ['string', 'null'],
            description: 'Habit name or keyword (e.g. "meditation", "drinking water", "gym")',
          },
          latest: {
            type: ['boolean', 'null'],
            description: 'If true, deletes the most recently added habit',
          },
          all: {
            type: ['boolean', 'null'],
            description: 'If true, deletes all matching habits',
          },
        },
      },
    },
  },

  // 3. Spending & Expenses
  {
    type: 'function',
    function: {
      name: 'fetch_expenses',
      description:
        'Fetch spending records and compute total expenditures. Supports filtering by date (e.g. "2026-09-09", "yesterday", "today", "9 sept 2026"), date ranges (startDate/endDate), category, or search keyword. Automatically pre-computes total spent, count, and category breakdown.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: ['string', 'null'],
            description:
              'Specific date to filter by (e.g. "2026-09-09", "yesterday", "today", "9 sept 2026"). When provided, only expenses on that date are calculated.',
          },
          startDate: {
            type: ['string', 'null'],
            description: 'Start date in YYYY-MM-DD or natural format',
          },
          endDate: {
            type: ['string', 'null'],
            description: 'End date in YYYY-MM-DD or natural format',
          },
          category: {
            type: ['string', 'null'],
            description: 'Category filter (e.g. Food, Dining Out, Tech, Transport, Bills, Health)',
          },
          query: {
            type: ['string', 'null'],
            description: 'Search keyword in expense description or notes',
          },
          limit: {
            type: ['number', 'null'],
            description:
              'Maximum sample items to return (default: 15). The total expenditure is ALWAYS calculated accurately across all matching items.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_expense',
      description: 'Log an expenditure in the spending tracker.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Description or item name' },
          amount: { type: 'number', description: 'Amount spent (numeric value)' },
          category: {
            type: 'string',
            description: 'Category (e.g. Food, Tech, Transport, Bills, Health, Entertainment)',
          },
          date: { type: ['string', 'null'], description: 'Date in YYYY-MM-DD format (defaults to today)' },
        },
        required: ['title', 'amount', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_expense',
      description:
        'Delete an expense transaction by name/description/merchant, amount, date, category, ID, or latest. Also supports deleting all matching expenses or clearing all expenses.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: ['string', 'null'],
            description: 'Optional specific ID of the expense to delete',
          },
          query: {
            type: ['string', 'null'],
            description:
              'Name, merchant, description, or keyword of the expense (e.g. "coffee", "Starbucks", "groceries", "dinner", "petrol"). Do NOT include generic words like "spending" or "expense".',
          },
          amount: {
            type: ['number', 'string', 'null'],
            description: 'Optional amount of the expense to delete (e.g. 50, 200, 500)',
          },
          date: {
            type: ['string', 'null'],
            description: 'Transaction date (e.g. "2026-09-09", "9 sept 2026", "today", "yesterday")',
          },
          category: {
            type: ['string', 'null'],
            description: 'Category of expense to match (e.g. "Food", "Shopping", "Transport")',
          },
          latest: {
            type: ['boolean', 'null'],
            description: 'If true, deletes the most recently logged expense transaction',
          },
          all: {
            type: ['boolean', 'null'],
            description: 'If true, deletes all matching expenses, or all expenses if no other filter is given',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_all_expenses',
      description: 'Permanently remove and clear all expense records from the dashboard.',
      parameters: {
        type: 'object',
        properties: {
          confirmed: {
            type: 'boolean',
            description: 'Confirmation flag, must be true to clear all expenses',
          },
        },
        required: ['confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_spending',
      description:
        'Compute aggregate financial analysis, including total spending, category breakdowns, highest expenses, and daily averages across all or filtered spending.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: ['string', 'null'], description: 'Optional category focus' },
          date: { type: ['string', 'null'], description: 'Optional specific date' },
          startDate: { type: ['string', 'null'], description: 'Optional start date' },
          endDate: { type: ['string', 'null'], description: 'Optional end date' },
        },
      },
    },
  },

  // 4. Journal
  {
    type: 'function',
    function: {
      name: 'fetch_journal',
      description: 'Fetch recent journal and diary entries.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: ['number', 'null'], description: 'Limit number of entries (default: 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_journal_entry',
      description: 'Write a new journal or diary reflection entry.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The text content or reflection' },
          title: { type: ['string', 'null'], description: 'Optional title of the entry' },
          mood: { type: ['string', 'null'], description: 'Mood indicator (e.g. Happy, Focused, Reflective, Tired)' },
          tags: {
            type: ['array', 'null'],
            items: { type: 'string' },
            description: 'Tags for the entry',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_journal_entry',
      description: 'Delete a journal entry by ID, title/keyword query, date, or latest.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: ['string', 'null'], description: 'Optional ID of the journal entry to delete' },
          query: {
            type: ['string', 'null'],
            description: 'Title, reflection content, or keyword to match in journal',
          },
          date: {
            type: ['string', 'null'],
            description: 'Optional date of the entry (e.g. "today", "2026-09-12")',
          },
          latest: {
            type: ['boolean', 'null'],
            description: 'If true, deletes the most recent journal entry',
          },
          all: {
            type: ['boolean', 'null'],
            description: 'If true, deletes all matching entries',
          },
        },
      },
    },
  },

  // 5. Goals
  {
    type: 'function',
    function: {
      name: 'fetch_goals',
      description: 'Fetch goals with progress percentages, target dates, and milestones.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: ['string', 'null'],
            enum: ['all', 'active', 'completed', 'upcoming', null],
            description: 'Filter goals by status',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_goal',
      description: 'Add a new personal or professional goal with milestones.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Goal title' },
          category: { type: ['string', 'null'], description: 'Category (Career, Health, Learning, Finance)' },
          targetDate: { type: ['string', 'null'], description: 'Target date in YYYY-MM-DD' },
          milestones: {
            type: ['array', 'null'],
            items: { type: 'string' },
            description: 'List of milestone titles to accomplish',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_goal',
      description: 'Update goal progress percentage or change its status.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID of the goal' },
          progress: { type: ['number', 'null'], description: 'Progress percentage (0 to 100)' },
          status: {
            type: ['string', 'null'],
            enum: ['active', 'completed', 'upcoming', 'archived', null],
            description: 'Updated goal status',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_goal',
      description: 'Delete a goal by ID, title/name query, or latest.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: ['string', 'null'], description: 'Optional ID of the goal to delete' },
          query: { type: ['string', 'null'], description: 'Goal title or keyword to match' },
          latest: { type: ['boolean', 'null'], description: 'If true, deletes the most recent goal' },
          all: { type: ['boolean', 'null'], description: 'If true, deletes all matching goals' },
        },
      },
    },
  },

  // 6. Media Library
  {
    type: 'function',
    function: {
      name: 'fetch_media',
      description: 'Fetch media items (books, movies, anime, games, series).',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: ['string', 'null'],
            enum: ['all', 'movie', 'book', 'anime', 'game', 'series', null],
            description: 'Filter by media type',
          },
          status: {
            type: ['string', 'null'],
            enum: ['all', 'planned', 'in_progress', 'completed', null],
            description: 'Filter by progress status',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_media_item',
      description: 'Add an item to the media watchlist or library.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title of the book, movie, series, etc.' },
          type: {
            type: 'string',
            enum: ['movie', 'book', 'anime', 'game', 'series'],
            description: 'Type of media',
          },
          status: {
            type: ['string', 'null'],
            enum: ['planned', 'in_progress', 'completed', null],
            description: 'Consumption status',
          },
          rating: { type: ['number', 'null'], description: 'Rating from 1 to 5 (optional)' },
        },
        required: ['title', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_media_item',
      description: 'Update status or rating of a media item.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID of the media item' },
          status: {
            type: ['string', 'null'],
            enum: ['planned', 'in_progress', 'completed', null],
            description: 'Updated status',
          },
          rating: { type: ['number', 'null'], description: 'Updated rating (1 to 5)' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_media_item',
      description: 'Remove a media item by ID, title/name query, or latest.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: ['string', 'null'], description: 'Optional ID of the item to delete' },
          query: { type: ['string', 'null'], description: 'Media title or keyword to match' },
          latest: { type: ['boolean', 'null'], description: 'If true, deletes the most recent media item' },
          all: { type: ['boolean', 'null'], description: 'If true, deletes all matching media items' },
        },
      },
    },
  },

  // 7. Vault Metadata (GUARDRAIL: PASSWORDS ARE NEVER EXPOSED)
  {
    type: 'function',
    function: {
      name: 'fetch_vault_metadata',
      description:
        'Fetch password vault entries metadata ONLY (service name, username/email, category, security strength). STRICT GUARDRAIL: Passwords remain encrypted and are never revealed.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // 8. Schedule
  {
    type: 'function',
    function: {
      name: 'fetch_schedule',
      description: 'Fetch the routine schedule activities for today or a given day.',
      parameters: {
        type: 'object',
        properties: {
          day: {
            type: ['string', 'null'],
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', null],
            description: 'Day of week. Defaults to today.',
          },
        },
      },
    },
  },
];

// Tool Execution Dispatcher
export async function executeSecretaryTool(
  name: string,
  args: any
): Promise<{ data: any; actionChip?: string }> {
  try {
    switch (name) {
      // ----------------------------------------------------
      // TASKS
      // ----------------------------------------------------
      case 'fetch_tasks': {
        let items = Storage.getTodos();
        if (args.status === 'pending') {
          items = items.filter((t) => !t.completed);
        } else if (args.status === 'completed') {
          items = items.filter((t) => t.completed);
        }
        if (args.category) {
          items = items.filter(
            (t) => t.category.toLowerCase().includes(args.category.toLowerCase())
          );
        }
        if (args.query) {
          const q = args.query.toLowerCase().trim();
          items = items.filter((t) => t.title.toLowerCase().includes(q));
        }
        if (args.dueDate) {
          items = items.filter((t) => matchesDateFilter(t.dueDate, args.dueDate));
        }
        const pendingCount = items.filter((t) => !t.completed).length;
        const completedCount = items.filter((t) => t.completed).length;
        const limit = Math.min(Math.max(1, args.limit || 20), 30);

        return {
          data: {
            totalMatching: items.length,
            pendingCount,
            completedCount,
            sampleTasks: items.slice(0, limit).map((t) => ({
              id: t.id,
              title: t.title,
              completed: t.completed,
              priority: t.priority,
              category: t.category,
              dueDate: t.dueDate || 'none',
            })),
          },
          actionChip: `⚡ Context Fetched: ${items.length} Tasks (${pendingCount} Pending)`,
        };
      }

      case 'add_task': {
        const title = (args.title || '').trim();
        if (!title) return { data: { error: 'Task title is required' } };
        const priority: Priority = (args.priority as Priority) || 'medium';
        const category = args.category || 'General';
        const newTask: TodoItem = {
          id: 'todo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          title,
          completed: false,
          status: 'todo',
          priority,
          category,
          dueDate: args.dueDate || '',
          createdAt: Date.now(),
        };
        const current = Storage.getTodos();
        const updated = [newTask, ...current];
        Storage.setTodos(updated);
        notifyDataChanged('tasks');
        return {
          data: { success: true, task: newTask },
          actionChip: `✓ Task Added: "${newTask.title}"`,
        };
      }

      case 'update_task': {
        const current = Storage.getTodos();
        const index = current.findIndex((t) => t.id === args.id);
        if (index === -1) {
          return { data: { error: `Task with id ${args.id} not found` } };
        }
        const updatedTask = { ...current[index] };
        if (typeof args.completed === 'boolean') {
          updatedTask.completed = args.completed;
          updatedTask.status = args.completed ? 'complete' : 'todo';
        }
        if (args.title) updatedTask.title = args.title;
        if (args.priority) updatedTask.priority = args.priority as Priority;

        current[index] = updatedTask;
        Storage.setTodos([...current]);
        notifyDataChanged('tasks');
        const statusLabel = updatedTask.completed ? 'Completed' : 'Updated';
        return {
          data: { success: true, task: updatedTask },
          actionChip: `✓ Task ${statusLabel}: "${updatedTask.title}"`,
        };
      }

      case 'delete_task': {
        const current = Storage.getTodos();
        if (current.length === 0) {
          return {
            data: { success: false, message: 'No tasks found on your dashboard.' },
            actionChip: '⚠️ No Tasks Found',
          };
        }

        let toDelete: TodoItem[] = [];

        if (args.all === true && !args.id && !args.query && !args.completedOnly) {
          toDelete = [...current];
        }

        if (toDelete.length === 0 && args.completedOnly === true && !args.id && !args.query) {
          toDelete = current.filter((t) => t.completed);
        }

        if (toDelete.length === 0 && args.id) {
          const rawId = String(args.id).trim();
          const matchById = current.find((t) => t.id === rawId);
          if (matchById) {
            toDelete = [matchById];
          } else {
            const lower = rawId.toLowerCase();
            if (lower === 'last' || lower === 'latest') {
              toDelete = [current[0]];
            } else if (lower === 'all') {
              toDelete = [...current];
            } else if (lower === 'completed') {
              toDelete = current.filter((t) => t.completed);
            } else {
              const matched = current.filter((t) => t.title.toLowerCase().includes(lower));
              if (matched.length > 0) toDelete = args.all ? matched : [matched[0]];
            }
          }
        }

        if (
          toDelete.length === 0 &&
          (args.latest === true ||
            String(args.query).toLowerCase() === 'last' ||
            String(args.query).toLowerCase() === 'latest')
        ) {
          toDelete = [current[0]];
        }

        if (toDelete.length === 0 && args.query) {
          const q = String(args.query).trim().toLowerCase();
          let matched = current.filter((t) => t.title.toLowerCase().includes(q));
          if (args.completedOnly) matched = matched.filter((t) => t.completed);
          if (matched.length > 0) toDelete = args.all ? matched : [matched[0]];
        }

        if (toDelete.length === 0) {
          return {
            data: {
              success: false,
              message: `No task found matching query. Available tasks: ${current
                .slice(0, 5)
                .map((t) => `"${t.title}"`)
                .join(', ')}`,
            },
            actionChip: '⚠️ Task Not Found',
          };
        }

        const deleteIds = new Set(toDelete.map((t) => t.id));
        const updated = current.filter((t) => !deleteIds.has(t.id));
        Storage.setTodos(updated);
        notifyDataChanged('tasks');
        const chipText =
          toDelete.length === 1
            ? `✓ Task Removed: "${toDelete[0].title}"`
            : `✓ Removed ${toDelete.length} Tasks`;
        return {
          data: { success: true, count: toDelete.length, removed: toDelete.map((t) => t.title) },
          actionChip: chipText,
        };
      }

      case 'clear_all_tasks': {
        const current = Storage.getTodos();
        let remaining: TodoItem[] = [];
        let clearedCount = current.length;
        if (args.completedOnly) {
          remaining = current.filter((t) => !t.completed);
          clearedCount = current.length - remaining.length;
        }
        Storage.setTodos(remaining);
        notifyDataChanged('tasks');
        return {
          data: { success: true, clearedCount },
          actionChip: args.completedOnly
            ? `✓ Cleared ${clearedCount} Completed Tasks`
            : `✓ Cleared All Tasks`,
        };
      }

      // ----------------------------------------------------
      // HABITS
      // ----------------------------------------------------
      case 'fetch_habits': {
        const habits = Storage.getHabits();
        const todayIdx = getTodayDayIndex();
        return {
          data: habits.map((h) => ({
            id: h.id,
            title: h.title,
            category: h.category,
            streak: h.streak,
            completedToday: !!h.completedDays?.[todayIdx],
            weeklyStatus: h.completedDays,
          })),
          actionChip: `⚡ Context Fetched: ${habits.length} Habits`,
        };
      }

      case 'add_habit': {
        const title = (args.title || '').trim();
        if (!title) return { data: { error: 'Habit title is required' } };
        const newHabit: HabitItem = {
          id: 'habit-' + Date.now(),
          title,
          category: args.category || 'Daily',
          icon: 'Flame',
          completedDays: [false, false, false, false, false, false, false],
          streak: 0,
          color: '#6366F1',
        };
        const current = Storage.getHabits();
        Storage.setHabits([newHabit, ...current]);
        notifyDataChanged('habits');
        return {
          data: { success: true, habit: newHabit },
          actionChip: `✓ Habit Created: "${newHabit.title}"`,
        };
      }

      case 'toggle_habit': {
        const current = Storage.getHabits();
        const index = current.findIndex((h) => h.id === args.id);
        if (index === -1) {
          return { data: { error: `Habit ${args.id} not found` } };
        }
        const habit = { ...current[index] };
        const targetDay =
          typeof args.dayIndex === 'number' ? args.dayIndex : getTodayDayIndex();
        const updatedDays = [...habit.completedDays];
        updatedDays[targetDay] = !updatedDays[targetDay];
        habit.completedDays = updatedDays;
        if (updatedDays[targetDay]) {
          habit.streak = (habit.streak || 0) + 1;
        } else {
          habit.streak = Math.max(0, (habit.streak || 0) - 1);
        }
        current[index] = habit;
        Storage.setHabits([...current]);
        notifyDataChanged('habits');
        const stateStr = updatedDays[targetDay] ? 'Checked' : 'Unchecked';
        return {
          data: { success: true, habit },
          actionChip: `✓ Habit ${stateStr}: "${habit.title}"`,
        };
      }

      case 'delete_habit': {
        const current = Storage.getHabits();
        if (current.length === 0) {
          return {
            data: { success: false, message: 'No habits found.' },
            actionChip: '⚠️ No Habits Found',
          };
        }

        let toDelete: HabitItem[] = [];
        if (args.all === true && !args.id && !args.query) {
          toDelete = [...current];
        }

        if (toDelete.length === 0 && args.id) {
          const rawId = String(args.id).trim();
          const matchById = current.find((h) => h.id === rawId);
          if (matchById) {
            toDelete = [matchById];
          } else {
            const lower = rawId.toLowerCase();
            if (lower === 'last' || lower === 'latest') {
              toDelete = [current[0]];
            } else if (lower === 'all') {
              toDelete = [...current];
            } else {
              const matched = current.filter((h) => h.title.toLowerCase().includes(lower));
              if (matched.length > 0) toDelete = args.all ? matched : [matched[0]];
            }
          }
        }

        if (
          toDelete.length === 0 &&
          (args.latest === true ||
            String(args.query).toLowerCase() === 'last' ||
            String(args.query).toLowerCase() === 'latest')
        ) {
          toDelete = [current[0]];
        }

        if (toDelete.length === 0 && args.query) {
          const q = String(args.query).trim().toLowerCase();
          const matched = current.filter((h) => h.title.toLowerCase().includes(q));
          if (matched.length > 0) toDelete = args.all ? matched : [matched[0]];
        }

        if (toDelete.length === 0) {
          return {
            data: {
              success: false,
              message: `No habit found matching criteria. Existing habits: ${current
                .map((h) => `"${h.title}"`)
                .join(', ')}`,
            },
            actionChip: '⚠️ Habit Not Found',
          };
        }

        const deleteIds = new Set(toDelete.map((h) => h.id));
        const updated = current.filter((h) => !deleteIds.has(h.id));
        Storage.setHabits(updated);
        notifyDataChanged('habits');
        return {
          data: {
            success: true,
            count: toDelete.length,
            removedHabits: toDelete.map((h) => h.title),
          },
          actionChip:
            toDelete.length === 1
              ? `✓ Habit Removed: "${toDelete[0].title}"`
              : `✓ Removed ${toDelete.length} Habits`,
        };
      }

      // ----------------------------------------------------
      // EXPENSES
      // ----------------------------------------------------
      case 'fetch_expenses': {
        let expenses = Storage.getExpenses();

        // 1. Filter by specific date (supports "2026-09-09", "yesterday", "today", "9 sept 2026", etc.)
        if (args.date) {
          expenses = expenses.filter((e) => matchesDateFilter(e.date, args.date));
        }

        // 2. Filter by date range (startDate / endDate)
        if (args.startDate) {
          const normStart = parseFlexibleDate(args.startDate) || args.startDate;
          expenses = expenses.filter((e) => {
            const d = parseFlexibleDate(e.date) || e.date;
            return d >= normStart;
          });
        }
        if (args.endDate) {
          const normEnd = parseFlexibleDate(args.endDate) || args.endDate;
          expenses = expenses.filter((e) => {
            const d = parseFlexibleDate(e.date) || e.date;
            return d <= normEnd;
          });
        }

        // 3. Filter by category
        if (args.category) {
          const targetCat = args.category.toLowerCase().trim();
          expenses = expenses.filter(
            (e) =>
              e.category.toLowerCase().includes(targetCat) ||
              targetCat.includes(e.category.toLowerCase())
          );
        }

        // 4. Filter by text query
        if (args.query) {
          const q = args.query.toLowerCase().trim();
          expenses = expenses.filter(
            (e) =>
              e.name.toLowerCase().includes(q) ||
              (e.notes && e.notes.toLowerCase().includes(q))
          );
        }

        const totalSpent = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const roundedTotal = Math.round(totalSpent * 100) / 100;
        const limit = Math.min(Math.max(1, args.limit || 15), 25);

        // Group by category for quick breakdown
        const categoryBreakdown: Record<string, number> = {};
        expenses.forEach((e) => {
          categoryBreakdown[e.category] =
            Math.round(((categoryBreakdown[e.category] || 0) + (Number(e.amount) || 0)) * 100) / 100;
        });

        const sampleItems = expenses.slice(0, limit).map((e) => ({
          name: e.name,
          amount: e.amount,
          category: e.category,
          date: e.date,
        }));

        let chipDesc = `${expenses.length} Expense(s)`;
        if (args.date) {
          chipDesc += ` for ${args.date}`;
        }
        chipDesc += ` (Total: ₹${roundedTotal.toLocaleString()})`;

        return {
          data: {
            filterApplied: {
              date: args.date || null,
              startDate: args.startDate || null,
              endDate: args.endDate || null,
              category: args.category || null,
              query: args.query || null,
            },
            totalMatchingRecords: expenses.length,
            totalSpent: roundedTotal,
            currency: '₹',
            categoryBreakdown,
            sampleExpenses: sampleItems,
            hasMore: expenses.length > limit,
          },
          actionChip: `⚡ Context Fetched: ${chipDesc}`,
        };
      }

      case 'add_expense': {
        const amount = Number(args.amount);
        if (isNaN(amount) || amount <= 0) {
          return { data: { error: 'Invalid expense amount' } };
        }
        const name = args.name || args.title || 'Untitled Expense';
        const newExpense: ExpenseItem = {
          id: 'exp-' + Date.now(),
          name,
          amount,
          category: args.category || 'General',
          date: args.date || new Date().toISOString().split('T')[0],
        };
        const current = Storage.getExpenses();
        Storage.setExpenses([newExpense, ...current]);
        notifyDataChanged('expenses');
        return {
          data: { success: true, expense: newExpense },
          actionChip: `✓ Expense Logged: ₹${amount.toLocaleString()} for "${newExpense.name}"`,
        };
      }

      case 'delete_expense': {
        const current = Storage.getExpenses();
        if (current.length === 0) {
          return {
            data: { success: false, message: 'No expenses found in your dashboard.' },
            actionChip: '⚠️ No Expenses to Delete',
          };
        }

        let toDelete: ExpenseItem[] = [];

        // 1. Normalize input arguments
        const rawQuery = args.query !== undefined && args.query !== null ? String(args.query).trim() : '';
        const rawId = args.id !== undefined && args.id !== null ? String(args.id).trim() : '';
        const rawCategory = args.category !== undefined && args.category !== null ? String(args.category).trim() : '';
        const rawDate = args.date !== undefined && args.date !== null ? String(args.date).trim() : '';

        // Extract amount from args.amount (handles number or string with currency symbols)
        let targetAmount: number | null = null;
        if (args.amount !== undefined && args.amount !== null) {
          const parsed =
            typeof args.amount === 'number'
              ? args.amount
              : parseFloat(String(args.amount).replace(/[^0-9.]/g, ''));
          if (!isNaN(parsed) && parsed > 0) {
            targetAmount = parsed;
          }
        }

        // If targetAmount was not set, check if rawQuery or rawId contains a number or currency
        if (targetAmount === null && (rawQuery || rawId)) {
          const textToScan = `${rawQuery} ${rawId}`;
          const amtMatch = textToScan.match(/(?:(?:₹|rs\.?|inr|\$)\s*(\d+(?:\.\d+)?))|(?:(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|\$|rupees?|bucks)?)/i);
          if (amtMatch) {
            const rawVal = amtMatch[1] || amtMatch[2];
            if (rawVal) {
              const parsed = parseFloat(rawVal);
              if (!isNaN(parsed) && parsed > 0) {
                targetAmount = parsed;
              }
            }
          }
        }

        // Clean query to isolate merchant/item name by stripping common filler words
        const cleanQuery = rawQuery
          .replace(/\b(spendings?|expenses?|transactions?|payments?|costs?|bills?|charges?|items?|records?)\b/gi, '')
          .replace(/\b(delete|remove|clear|drop|erase|cancel)\b/gi, '')
          .replace(/\b(all|everything|every)\b/gi, '')
          .replace(/\b(last|latest|recent|newest)\b/gi, '')
          .replace(/\b(my|the|a|an|of|for|on|in|rs\.?|inr|rupees?|\$)\b/gi, '')
          .replace(/\b\d+(\.\d+)?\b/g, '')
          .trim();

        const isAllRequested =
          args.all === true ||
          /\b(all|everything|every|clear)\b/i.test(rawQuery) ||
          /\b(all|everything|every|clear)\b/i.test(rawId);

        const isLatestRequested =
          args.latest === true ||
          /\b(last|latest|recent|newest)\b/i.test(rawQuery) ||
          /\b(last|latest|recent|newest)\b/i.test(rawId);

        // Case A: User specifically requested clearing all expenses and provided no specific item filter
        if (isAllRequested && !cleanQuery && targetAmount === null && !rawDate && !rawCategory) {
          toDelete = [...current];
        }

        // Case B: Direct match by internal ID
        if (toDelete.length === 0 && rawId) {
          const matchById = current.find((e) => e.id === rawId);
          if (matchById) {
            toDelete = [matchById];
          }
        }

        // Case C: Explicit "latest" or "last" without query/amount filters
        if (toDelete.length === 0 && isLatestRequested && !cleanQuery && targetAmount === null && !rawDate) {
          toDelete = [current[0]];
        }

        // Case D: Filter candidates using combined constraints
        if (toDelete.length === 0) {
          let candidates = [...current];

          // 1. Date filter
          if (rawDate) {
            const dateFiltered = candidates.filter((e) => matchesDateFilter(e.date, rawDate));
            if (dateFiltered.length > 0) {
              candidates = dateFiltered;
            }
          }

          // 2. Category filter
          if (rawCategory) {
            const cat = rawCategory.toLowerCase();
            const catFiltered = candidates.filter(
              (e) => e.category && e.category.toLowerCase().includes(cat)
            );
            if (catFiltered.length > 0) {
              candidates = catFiltered;
            }
          }

          // 3. Amount filter
          if (targetAmount !== null) {
            const amtFiltered = candidates.filter(
              (e) => Math.abs(Number(e.amount) - targetAmount!) < 0.01
            );
            if (amtFiltered.length > 0) {
              candidates = amtFiltered;
            } else {
              const nearMatch = candidates.filter(
                (e) =>
                  e.name.includes(String(targetAmount)) ||
                  (e.notes && e.notes.includes(String(targetAmount)))
              );
              if (nearMatch.length > 0) {
                candidates = nearMatch;
              }
            }
          }

          // 4. Name / merchant / keyword filter
          if (cleanQuery && cleanQuery.length > 0) {
            const q = cleanQuery.toLowerCase();
            const textFiltered = candidates.filter(
              (e) =>
                e.name.toLowerCase().includes(q) ||
                (e.category && e.category.toLowerCase().includes(q)) ||
                (e.notes && e.notes.toLowerCase().includes(q)) ||
                (e.paymentMethod && e.paymentMethod.toLowerCase().includes(q))
            );
            if (textFiltered.length > 0) {
              candidates = textFiltered;
            }
          }

          // Decision on candidates
          const hasAnyFilter =
            cleanQuery.length > 0 || targetAmount !== null || !!rawDate || !!rawCategory;

          if (hasAnyFilter) {
            if (candidates.length < current.length || candidates.length > 0) {
              toDelete = isAllRequested ? candidates : [candidates[0]];
            }
          } else {
            if (isAllRequested) {
              toDelete = [...current];
            } else {
              // Delete latest transaction by default
              toDelete = [current[0]];
            }
          }
        }

        if (toDelete.length === 0) {
          const filterSummary = [
            cleanQuery ? `name: "${cleanQuery}"` : '',
            targetAmount !== null ? `amount: ₹${targetAmount}` : '',
            rawDate ? `date: "${rawDate}"` : '',
            rawCategory ? `category: "${rawCategory}"` : '',
          ]
            .filter(Boolean)
            .join(', ');

          return {
            data: {
              success: false,
              message: `No expense found matching criteria (${filterSummary || 'provided search'}). Available recent expenses: ${current
                .slice(0, 5)
                .map((e) => `"${e.name}" (₹${Number(e.amount).toLocaleString()} on ${e.date})`)
                .join(', ')}`,
            },
            actionChip: '⚠️ Expense Not Found',
          };
        }

        const deleteIds = new Set(toDelete.map((e) => e.id));
        const updated = current.filter((e) => !deleteIds.has(e.id));
        Storage.setExpenses(updated);

        // Also clean up any orphaned spreadsheet import logs if all records were cleared
        if (updated.length === 0) {
          Storage.setExcelImportLogs([]);
        } else {
          const currentLogs = Storage.getExcelImportLogs();
          if (currentLogs.length > 0) {
            const activeBatchIds = new Set(updated.map((e) => e.importBatchId).filter(Boolean));
            const activeSourceFiles = new Set(updated.map((e) => e.sourceFile).filter(Boolean));
            const retainedLogs = currentLogs.filter(
              (l) => activeBatchIds.has(l.id) || activeSourceFiles.has(l.fileName)
            );
            Storage.setExcelImportLogs(retainedLogs);
          }
        }

        notifyDataChanged('expenses');

        const chipText =
          toDelete.length === 1
            ? `✓ Expense Deleted: "${toDelete[0].name}" (₹${Number(toDelete[0].amount).toLocaleString()})`
            : `✓ Deleted ${toDelete.length} Expenses`;

        return {
          data: {
            success: true,
            deletedCount: toDelete.length,
            deletedExpenses: toDelete.map((e) => ({
              id: e.id,
              name: e.name,
              amount: e.amount,
              date: e.date,
            })),
          },
          actionChip: chipText,
        };
      }

      case 'clear_all_expenses': {
        const count = Storage.getExpenses().length;
        Storage.setExpenses([]);
        Storage.setExcelImportLogs([]);
        notifyDataChanged('expenses');
        return {
          data: {
            success: true,
            clearedCount: count,
            message: `All ${count} expenses were permanently removed from your dashboard.`,
          },
          actionChip: `✓ Cleared All ${count} Expenses`,
        };
      }

      case 'analyze_spending': {
        let expenses = Storage.getExpenses();

        if (args.date) {
          expenses = expenses.filter((e) => matchesDateFilter(e.date, args.date));
        }
        if (args.startDate) {
          const normStart = parseFlexibleDate(args.startDate) || args.startDate;
          expenses = expenses.filter((e) => (parseFlexibleDate(e.date) || e.date) >= normStart);
        }
        if (args.endDate) {
          const normEnd = parseFlexibleDate(args.endDate) || args.endDate;
          expenses = expenses.filter((e) => (parseFlexibleDate(e.date) || e.date) <= normEnd);
        }
        if (args.category) {
          const cat = args.category.toLowerCase();
          expenses = expenses.filter((e) => e.category.toLowerCase().includes(cat));
        }

        const totalAmount = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const roundedTotal = Math.round(totalAmount * 100) / 100;
        const categoryMap: Record<string, number> = {};
        expenses.forEach((e) => {
          categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
        });
        const sortedCategories = Object.entries(categoryMap)
          .map(([cat, total]) => ({ category: cat, total: Math.round(total * 100) / 100 }))
          .sort((a, b) => b.total - a.total);

        const topExpenses = [...expenses]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
          .map((e) => ({ name: e.name, amount: e.amount, category: e.category, date: e.date }));

        return {
          data: {
            totalEntries: expenses.length,
            totalExpenditure: roundedTotal,
            currency: '₹',
            topCategories: sortedCategories,
            highestExpenses: topExpenses,
          },
          actionChip: `⚡ Context Analyzed: ₹${roundedTotal.toLocaleString()} Total Spending`,
        };
      }

      // ----------------------------------------------------
      // JOURNAL
      // ----------------------------------------------------
      case 'fetch_journal': {
        const entries = Storage.getJournal();
        const limit = args.limit || 10;
        return {
          data: entries.slice(0, limit).map((j) => ({
            id: j.id,
            title: j.title || 'Untitled',
            date: j.date,
            mood: j.mood,
            contentPreview: j.content.slice(0, 160) + (j.content.length > 160 ? '...' : ''),
            tags: j.tags,
          })),
          actionChip: `⚡ Context Fetched: ${entries.length} Journal Entries`,
        };
      }

      case 'add_journal_entry': {
        const content = (args.content || '').trim();
        if (!content) return { data: { error: 'Journal content is required' } };
        const newEntry: JournalEntry = {
          id: 'journal-' + Date.now(),
          title: args.title || 'Reflection ' + new Date().toLocaleDateString(),
          content,
          date: new Date().toISOString().split('T')[0],
          timestamp: Date.now(),
          mood: '✨',
          moodLabel: args.mood || 'Reflective',
          tags: args.tags || ['Secretary Log'],
        };
        const current = Storage.getJournal();
        Storage.setJournal([newEntry, ...current]);
        notifyDataChanged('journal');
        return {
          data: { success: true, entry: newEntry },
          actionChip: `✓ Journal Entry Saved: "${newEntry.title}"`,
        };
      }

      case 'delete_journal_entry': {
        const current = Storage.getJournal();
        if (current.length === 0) {
          return {
            data: { success: false, message: 'No journal entries found.' },
            actionChip: '⚠️ No Journal Entries',
          };
        }

        let toDelete: JournalEntry[] = [];
        if (args.all === true && !args.id && !args.query && !args.date) {
          toDelete = [...current];
        }

        if (toDelete.length === 0 && args.id) {
          const rawId = String(args.id).trim();
          const matchById = current.find((j) => j.id === rawId);
          if (matchById) {
            toDelete = [matchById];
          } else {
            const lower = rawId.toLowerCase();
            if (lower === 'last' || lower === 'latest') {
              toDelete = [current[0]];
            } else if (lower === 'all') {
              toDelete = [...current];
            } else {
              const matched = current.filter(
                (j) =>
                  j.title.toLowerCase().includes(lower) ||
                  (j.content && j.content.toLowerCase().includes(lower))
              );
              if (matched.length > 0) toDelete = args.all ? matched : [matched[0]];
            }
          }
        }

        if (
          toDelete.length === 0 &&
          (args.latest === true ||
            String(args.query).toLowerCase() === 'last' ||
            String(args.query).toLowerCase() === 'latest')
        ) {
          toDelete = [current[0]];
        }

        if (toDelete.length === 0) {
          let candidates = [...current];
          if (args.query) {
            const q = String(args.query).trim().toLowerCase();
            candidates = candidates.filter(
              (j) =>
                j.title.toLowerCase().includes(q) ||
                (j.content && j.content.toLowerCase().includes(q))
            );
          }
          if (args.date) {
            candidates = candidates.filter((j) => matchesDateFilter(j.date, args.date));
          }
          if (candidates.length > 0) {
            toDelete = args.all ? candidates : [candidates[0]];
          }
        }

        if (toDelete.length === 0) {
          return {
            data: { success: false, message: 'No journal entry found matching criteria.' },
            actionChip: '⚠️ Journal Entry Not Found',
          };
        }

        const deleteIds = new Set(toDelete.map((j) => j.id));
        const updated = current.filter((j) => !deleteIds.has(j.id));
        Storage.setJournal(updated);
        notifyDataChanged('journal');
        return {
          data: { success: true, count: toDelete.length, removed: toDelete.map((j) => j.title) },
          actionChip:
            toDelete.length === 1
              ? `✓ Journal Deleted: "${toDelete[0].title}"`
              : `✓ Deleted ${toDelete.length} Journal Entries`,
        };
      }

      // ----------------------------------------------------
      // GOALS
      // ----------------------------------------------------
      case 'fetch_goals': {
        let goals = Storage.getGoals();
        if (args.status && args.status !== 'all') {
          goals = goals.filter((g) => g.status === args.status);
        }
        return {
          data: goals.map((g) => ({
            id: g.id,
            title: g.title,
            category: g.category,
            status: g.status,
            progress: g.progress,
            targetDate: g.targetDate,
            milestonesCount: g.milestones?.length || 0,
          })),
          actionChip: `⚡ Context Fetched: ${goals.length} Goals`,
        };
      }

      case 'add_goal': {
        const title = (args.title || '').trim();
        if (!title) return { data: { error: 'Goal title is required' } };
        const milestonesList = Array.isArray(args.milestones)
          ? args.milestones.map((m: string, idx: number) => ({
              id: 'm-' + idx + '-' + Date.now(),
              title: m,
              completed: false,
            }))
          : [];
        const newGoal: GoalItem = {
          id: 'goal-' + Date.now(),
          title,
          category: args.category || 'Career',
          status: 'active',
          progress: 0,
          targetDate: args.targetDate || '',
          milestones: milestonesList,
          createdAt: Date.now(),
          icon: 'Target',
        };
        const current = Storage.getGoals();
        Storage.setGoals([newGoal, ...current]);
        notifyDataChanged('goals');
        return {
          data: { success: true, goal: newGoal },
          actionChip: `✓ Goal Created: "${newGoal.title}"`,
        };
      }

      case 'update_goal': {
        const current = Storage.getGoals();
        const index = current.findIndex((g) => g.id === args.id);
        if (index === -1) {
          return { data: { error: `Goal ${args.id} not found` } };
        }
        const goal = { ...current[index] };
        if (typeof args.progress === 'number') {
          goal.progress = Math.min(100, Math.max(0, args.progress));
          if (goal.progress === 100) goal.status = 'completed';
        }
        if (args.status) {
          goal.status = args.status;
        }
        current[index] = goal;
        Storage.setGoals([...current]);
        notifyDataChanged('goals');
        return {
          data: { success: true, goal },
          actionChip: `✓ Goal Progress: "${goal.title}" (${goal.progress}%)`,
        };
      }

      case 'delete_goal': {
        const current = Storage.getGoals();
        if (current.length === 0) {
          return {
            data: { success: false, message: 'No goals found.' },
            actionChip: '⚠️ No Goals Found',
          };
        }

        let toDelete: GoalItem[] = [];
        if (args.all === true && !args.id && !args.query) {
          toDelete = [...current];
        }

        if (toDelete.length === 0 && args.id) {
          const rawId = String(args.id).trim();
          const matchById = current.find((g) => g.id === rawId);
          if (matchById) {
            toDelete = [matchById];
          } else {
            const lower = rawId.toLowerCase();
            if (lower === 'last' || lower === 'latest') {
              toDelete = [current[0]];
            } else if (lower === 'all') {
              toDelete = [...current];
            } else {
              const matched = current.filter((g) => g.title.toLowerCase().includes(lower));
              if (matched.length > 0) toDelete = args.all ? matched : [matched[0]];
            }
          }
        }

        if (
          toDelete.length === 0 &&
          (args.latest === true ||
            String(args.query).toLowerCase() === 'last' ||
            String(args.query).toLowerCase() === 'latest')
        ) {
          toDelete = [current[0]];
        }

        if (toDelete.length === 0 && args.query) {
          const q = String(args.query).trim().toLowerCase();
          const matched = current.filter((g) => g.title.toLowerCase().includes(q));
          if (matched.length > 0) toDelete = args.all ? matched : [matched[0]];
        }

        if (toDelete.length === 0) {
          return {
            data: {
              success: false,
              message: `No goal found matching criteria. Available goals: ${current
                .map((g) => `"${g.title}"`)
                .join(', ')}`,
            },
            actionChip: '⚠️ Goal Not Found',
          };
        }

        const deleteIds = new Set(toDelete.map((g) => g.id));
        const updated = current.filter((g) => !deleteIds.has(g.id));
        Storage.setGoals(updated);
        notifyDataChanged('goals');
        return {
          data: { success: true, count: toDelete.length, removed: toDelete.map((g) => g.title) },
          actionChip:
            toDelete.length === 1
              ? `✓ Goal Deleted: "${toDelete[0].title}"`
              : `✓ Deleted ${toDelete.length} Goals`,
        };
      }

      // ----------------------------------------------------
      // MEDIA
      // ----------------------------------------------------
      case 'fetch_media': {
        let media = Storage.getMedia();
        if (args.type && args.type !== 'all') {
          media = media.filter((m) => m.type === args.type);
        }
        if (args.status && args.status !== 'all') {
          media = media.filter((m) => m.status === args.status);
        }
        const sampleMedia = media.slice(0, 20).map((m) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          status: m.status,
          rating: m.rating,
        }));
        return {
          data: {
            totalCount: media.length,
            sampleMedia,
          },
          actionChip: `⚡ Context Fetched: ${media.length} Media Items`,
        };
      }

      case 'add_media_item': {
        const title = (args.title || '').trim();
        if (!title) return { data: { error: 'Media title is required' } };
        const mediaType = (args.type === 'book' || args.type === 'game' || args.type === 'series') ? args.type : 'movie';
        const mediaStatus = args.status === 'completed' ? 'completed' : args.status === 'in-progress' || args.status === 'in_progress' ? 'in-progress' : 'wishlist';
        const newMedia: MediaItem = {
          id: 'media-' + Date.now(),
          title,
          creator: args.creator || 'Curated',
          type: mediaType,
          status: mediaStatus,
          rating: typeof args.rating === 'number' ? args.rating : 4,
          coverUrl: '',
          genres: args.genres || ['General'],
        };
        const current = Storage.getMedia();
        Storage.setMedia([newMedia, ...current]);
        notifyDataChanged('media');
        return {
          data: { success: true, media: newMedia },
          actionChip: `✓ Media Added: "${newMedia.title}" (${newMedia.type})`,
        };
      }

      case 'update_media_item': {
        const current = Storage.getMedia();
        const index = current.findIndex((m) => m.id === args.id);
        if (index === -1) {
          return { data: { error: `Media item ${args.id} not found` } };
        }
        const media = { ...current[index] };
        if (args.status) media.status = args.status;
        if (typeof args.rating === 'number') media.rating = args.rating;
        current[index] = media;
        Storage.setMedia([...current]);
        notifyDataChanged('media');
        return {
          data: { success: true, media },
          actionChip: `✓ Media Updated: "${media.title}" (${media.status})`,
        };
      }

      case 'delete_media_item': {
        const current = Storage.getMedia();
        if (current.length === 0) {
          return {
            data: { success: false, message: 'No media items found.' },
            actionChip: '⚠️ No Media Items Found',
          };
        }

        let toDelete: MediaItem[] = [];
        if (args.all === true && !args.id && !args.query) {
          toDelete = [...current];
        }

        if (toDelete.length === 0 && args.id) {
          const rawId = String(args.id).trim();
          const matchById = current.find((m) => m.id === rawId);
          if (matchById) {
            toDelete = [matchById];
          } else {
            const lower = rawId.toLowerCase();
            if (lower === 'last' || lower === 'latest') {
              toDelete = [current[0]];
            } else if (lower === 'all') {
              toDelete = [...current];
            } else {
              const matched = current.filter(
                (m) =>
                  m.title.toLowerCase().includes(lower) ||
                  (m.creator && m.creator.toLowerCase().includes(lower))
              );
              if (matched.length > 0) toDelete = args.all ? matched : [matched[0]];
            }
          }
        }

        if (
          toDelete.length === 0 &&
          (args.latest === true ||
            String(args.query).toLowerCase() === 'last' ||
            String(args.query).toLowerCase() === 'latest')
        ) {
          toDelete = [current[0]];
        }

        if (toDelete.length === 0 && args.query) {
          const q = String(args.query).trim().toLowerCase();
          const matched = current.filter(
            (m) =>
              m.title.toLowerCase().includes(q) ||
              (m.creator && m.creator.toLowerCase().includes(q))
          );
          if (matched.length > 0) toDelete = args.all ? matched : [matched[0]];
        }

        if (toDelete.length === 0) {
          return {
            data: { success: false, message: 'No media item found matching criteria.' },
            actionChip: '⚠️ Media Item Not Found',
          };
        }

        const deleteIds = new Set(toDelete.map((m) => m.id));
        const updated = current.filter((m) => !deleteIds.has(m.id));
        Storage.setMedia(updated);
        notifyDataChanged('media');
        return {
          data: { success: true, count: toDelete.length, removed: toDelete.map((m) => m.title) },
          actionChip:
            toDelete.length === 1
              ? `✓ Media Removed: "${toDelete[0].title}"`
              : `✓ Removed ${toDelete.length} Media Items`,
        };
      }

      // ----------------------------------------------------
      // VAULT (STRICT GUARDRAIL: PASSWORDS ARE ENCRYPTED/EXCLUDED)
      // ----------------------------------------------------
      case 'fetch_vault_metadata': {
        const vault = Storage.getVault();
        // Return strictly metadata, zero secret exposure!
        return {
          data: {
            totalEntries: vault.length,
            sampleEntries: vault.slice(0, 20).map((v) => ({
              id: v.id,
              service: v.service,
              username: v.username,
              category: v.category,
              strength: v.strength,
              updatedAt: v.updatedAt,
            })),
          },
          actionChip: `⚡ Context Fetched: ${vault.length} Vault Entries (Zero-Knowledge Metadata)`,
        };
      }

      // ----------------------------------------------------
      // SCHEDULE
      // ----------------------------------------------------
      case 'fetch_schedule': {
        const schedule = Storage.getSchedule();
        const targetDay = (args.day || 'monday').toLowerCase();
        const dayConfig = schedule.days?.[targetDay as keyof typeof schedule.days];
        const activities =
          dayConfig?.isCustomized && dayConfig.activities.length > 0
            ? dayConfig.activities
            : targetDay === 'saturday' || targetDay === 'sunday'
            ? schedule.weekendTemplate
            : schedule.weekdayTemplate;
        return {
          data: {
            day: targetDay,
            activities: activities.map((a) => ({ time: a.time, title: a.title })),
          },
          actionChip: `⚡ Context Fetched: ${targetDay.toUpperCase()} Schedule (${activities.length} Slots)`,
        };
      }

      default:
        return { data: { error: `Tool ${name} not recognized` } };
    }
  } catch (err: any) {
    return { data: { error: err.message || 'Error executing tool' } };
  }
}

const SYSTEM_PROMPT = `You are the Executive AI Secretary embedded directly in the user's Personal Dashboard & Life OS.
You are professional, concise, proactive, and accurate.

CRITICAL RULES & GUARDRAILS:
1. LAZY CONTEXT FETCHING: You do NOT possess pre-loaded user data in memory. You MUST autonomously call the schema-based 'fetch_*' tools (e.g. fetch_tasks, fetch_habits, fetch_expenses, fetch_goals, fetch_journal, fetch_media, fetch_schedule) to retrieve live state whenever the user asks about their day, asks for an analysis, or inquires about any aspect of their life or tasks.
2. DIRECT CRUD ACTIONS: When the user asks you to add, complete, modify, or delete a task, habit, expense, journal entry, goal, or media item, immediately invoke the corresponding tool function.
3. PARAMETER FORMAT: When invoking tools, omit optional arguments that are not specified or pass null if allowed by the schema.
4. SECURITY & VAULT: Vault passwords are confidential and encrypted. You only receive metadata (service name, username, strength). Never ask the user for their vault master PIN or raw passwords.
5. TEXT-ONLY INTERFACE: Keep responses readable, succinct, and beautifully formatted with markdown (bullet points, bold highlights).
6. CLARITY: After executing tool actions, briefly summarize what was completed in a friendly, professional executive tone.
7. DATE-SPECIFIC EXPENSE QUERIES: When the user asks about spending on a specific date (e.g. "How much did I spend on 9 sept 2026", "spending on 2026-09-09", "what did I buy yesterday"), invoke fetch_expenses with the date argument (e.g. date: "9 sept 2026"). The tool automatically pre-calculates the exact totalSpent across all matching transactions. State the exact total amount in ₹ and list the individual matching items.
8. DELETION & DATA REMOVAL:
   - When the user asks to delete, remove, or clear spendings/expenses (e.g. "delete spending 500", "remove coffee expense", "delete last spending", "clear all spendings", "delete 50 rs"):
     * Immediately execute the tool call 'delete_expense' or 'clear_all_expenses'.
     * If user specified an amount (e.g. 500, 50), pass amount: 500. DO NOT pass the word "spending" or "expense" in query.
     * If user specified a merchant/item (e.g. "coffee", "Starbucks"), pass query: "coffee".
     * If user asked to delete the last or latest expense, pass latest: true.
     * If user asked to clear all expenses, invoke clear_all_expenses with confirmed: true, or delete_expense with all: true.
   - ZERO FALSE CONFIRMATIONS: NEVER claim that an expense or item was deleted or removed unless the tool returned { success: true }. If the tool returned { success: false }, you must inform the user that no matching expense was found and show recent available expenses.`;

// Groq API Key loaded securely from Storage, environment variable, or fallback
const DEFAULT_GROQ_KEY = '';

export function getActiveGroqKey(): string {
  return (
    Storage.getGroqApiKey() ||
    (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim() ||
    DEFAULT_GROQ_KEY
  );
}

export async function testGroqApiKey(testKey?: string): Promise<{ success: boolean; message: string }> {
  const keyToTest = (testKey || getActiveGroqKey()).trim();
  if (!keyToTest) {
    return { success: false, message: 'No Groq API key provided. Please enter a valid key.' };
  }

  try {
    const res = await fetch('/api/groq/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${keyToTest}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      return { success: true, message: 'Groq API key verified successfully! Connected to Groq cloud.' };
    }

    // Try direct endpoint if proxy returns error
    const directRes = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${keyToTest}`,
        'Content-Type': 'application/json',
      },
    });

    if (directRes.ok) {
      return { success: true, message: 'Groq API key verified successfully! Connected to Groq cloud.' };
    }

    const errData = await directRes.json().catch(() => null);
    const errMessage = errData?.error?.message || `Status ${directRes.status}`;
    return { success: false, message: `Groq Authentication Failed: ${errMessage}` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error while validating key with Groq.' };
  }
}

export async function sendSecretaryMessage(
  userPrompt: string,
  existingHistory: ChatMessage[],
  apiKeyOverride?: string
): Promise<GroqSecretaryResponse> {
  const apiKey =
    apiKeyOverride ||
    Storage.getGroqApiKey() ||
    (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim() ||
    DEFAULT_GROQ_KEY;

  const userMessage: ChatMessage = {
    id: 'msg-' + Date.now(),
    role: 'user',
    content: userPrompt,
    timestamp: Date.now(),
  };

  const updatedHistory = [...existingHistory, userMessage];

  if (!apiKey) {
    const errorMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'assistant',
      content:
        '⚠️ **Groq API Key Required**\n\nPlease set your Groq API key in project settings or environment variables (`VITE_GROQ_API_KEY`).',
      timestamp: Date.now(),
    };
    return {
      reply: errorMsg.content,
      actionChips: [],
      updatedHistory: [...updatedHistory, errorMsg],
      error: 'Missing Groq API key',
    };
  }

  // Convert ChatMessage history to OpenAI format for Groq
  // Keep last 10 turns to maintain fast latency and context limit
  const recentTurns = updatedHistory.slice(-10).map((m) => {
    const obj: any = {
      role: m.role,
      content: m.content || '',
    };
    if (m.name) obj.name = m.name;
    if (m.tool_call_id) obj.tool_call_id = m.tool_call_id;
    if (m.tool_calls) obj.tool_calls = m.tool_calls;
    return obj;
  });

  const maxRecursion = 6;
  const collectedActionChips: string[] = [];
  const executedToolEvents: Array<{
    name: string;
    args: any;
    success: boolean;
    data: any;
  }> = [];
  let lastGroqError = '';

  // Try candidate Groq models in order
  for (const currentModel of CANDIDATE_GROQ_MODELS) {
    try {
      const groqMessages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...recentTurns,
      ];
      let depth = 0;

      while (depth < maxRecursion) {
        depth++;

        const res = await postGroqChat(apiKey, {
          model: currentModel,
          messages: groqMessages,
          tools: SECRETARY_TOOLS,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 1024,
        });

        if (!res.ok) {
          const errorText = await res.text();
          let parsedError: any = {};
          try {
            parsedError = JSON.parse(errorText);
          } catch {
            // ignore
          }

          const errorCode = parsedError.error?.code;
          const errorMsg = parsedError.error?.message || `HTTP ${res.status}`;
          lastGroqError = errorMsg;

          // If model was not found or rate limited or token limit exceeded, try next candidate model
          if (
            res.status === 404 ||
            res.status === 429 ||
            res.status === 413 ||
            errorCode === 'model_not_found' ||
            errorCode === 'rate_limit_exceeded' ||
            errorMsg.includes('does not exist') ||
            errorMsg.includes('decommissioned') ||
            errorMsg.includes('tokens per minute') ||
            errorMsg.includes('Request too large')
          ) {
            console.warn(`Groq model ${currentModel} returned error: ${errorMsg}. Trying next candidate...`);
            break;
          }

          console.warn(`Groq error with ${currentModel}: ${errorMsg}`);
          break;
        }

        const json = await res.json();
        const choice = json.choices?.[0];
        if (!choice || !choice.message) {
          break;
        }

        const assistantMsg = choice.message;

        // Check if model called tools
        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
          // Append assistant tool_calls message
          groqMessages.push({
            role: 'assistant',
            content: assistantMsg.content || '',
            tool_calls: assistantMsg.tool_calls,
          });

          // Execute each tool call sequentially
          for (const call of assistantMsg.tool_calls) {
            let callArgs: any = {};
            try {
              callArgs = JSON.parse(call.function.arguments || '{}');
            } catch {
              callArgs = {};
            }

            const toolResult = await executeSecretaryTool(call.function.name, callArgs);
            const isToolSuccess = toolResult.data?.success !== false && !toolResult.data?.error;
            executedToolEvents.push({
              name: call.function.name,
              args: callArgs,
              success: isToolSuccess,
              data: toolResult.data,
            });

            if (toolResult.actionChip) {
              collectedActionChips.push(toolResult.actionChip);
            }

            // Guarantee payload size remains well under Groq token/minute limits
            const rawContent = JSON.stringify(toolResult.data);
            const safeContent =
              rawContent.length > 2500
                ? rawContent.slice(0, 2500) + '... [truncated for token limit]'
                : rawContent;

            groqMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.function.name,
              content: safeContent,
            });
          }

          // Continue recursion loop to let model formulate final answer with tool outputs
          continue;
        }

        // No tool calls: final text response reached
        let finalReply =
          assistantMsg.content?.trim() ||
          assistantMsg.reasoning?.trim() ||
          'I have completed your request.';

        // Safety check for user expense deletion intent
        const deletionIntent = extractExpenseDeletionIntent(userPrompt);
        const expenseDeletionSucceeded = executedToolEvents.some(
          (t) => (t.name === 'delete_expense' || t.name === 'clear_all_expenses') && t.success
        );

        // Fallback: If user asked to delete spending but the LLM did not execute or failed to pass arguments properly
        if (deletionIntent.isDeletion && !expenseDeletionSucceeded) {
          const fallbackTool = deletionIntent.isAll ? 'clear_all_expenses' : 'delete_expense';
          const fallbackResult = await executeSecretaryTool(fallbackTool, {
            query: deletionIntent.query,
            amount: deletionIntent.amount,
            date: deletionIntent.date,
            latest: deletionIntent.isLatest,
            all: deletionIntent.isAll,
            confirmed: true,
          });

          if (fallbackResult.data?.success === true) {
            if (fallbackResult.actionChip) {
              collectedActionChips.push(fallbackResult.actionChip);
            }
            executedToolEvents.push({
              name: fallbackTool,
              args: deletionIntent,
              success: true,
              data: fallbackResult.data,
            });
            const deletedList = fallbackResult.data.deletedExpenses
              ?.map((e: any) => `• **${e.name}** (₹${Number(e.amount).toLocaleString()} on ${e.date})`)
              .join('\n');
            finalReply = `✓ I have removed the spending from your dashboard:\n${
              deletedList ||
              `Cleared ${fallbackResult.data.deletedCount || fallbackResult.data.clearedCount || 'all'} records.`
            }\n\nYour dashboard totals and expense charts have been updated.`;
          } else {
            finalReply = `⚠️ ${
              fallbackResult.data?.message || 'Could not find any spending matching your request.'
            }\n\nNo expenses were deleted.`;
          }
        } else if (!expenseDeletionSucceeded) {
          // If no deletion actually occurred, guard against LLM hallucinations claiming it deleted something
          const falselyClaimsDeletion =
            /(has been|have been|i have|successfully|now)\s+(deleted|removed|cleared|erased)/i.test(finalReply) &&
            /(spending|spendings|expense|expenses|transaction|cost)/i.test(finalReply);

          if (falselyClaimsDeletion) {
            const recent = Storage.getExpenses().slice(0, 5);
            finalReply = `⚠️ No matching spending was found to delete. Available recent expenses:\n${
              recent.length > 0
                ? recent.map((e) => `• **${e.name}** (₹${Number(e.amount).toLocaleString()} on ${e.date})`).join('\n')
                : 'No expenses currently recorded.'
            }`;
          }
        }

        const finalAssistantMessage: ChatMessage = {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content: finalReply,
          actionChips: collectedActionChips.length > 0 ? collectedActionChips : undefined,
          timestamp: Date.now(),
        };

        return {
          reply: finalReply,
          actionChips: collectedActionChips,
          updatedHistory: [...updatedHistory, finalAssistantMessage],
        };
      }

      // If reached maxRecursion but we performed actions, provide clear response
      if (collectedActionChips.length > 0) {
        const autoSummary = `I processed your request: ${collectedActionChips.join('; ')}.`;
        const autoAssistantMsg: ChatMessage = {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content: autoSummary,
          actionChips: collectedActionChips,
          timestamp: Date.now(),
        };
        return {
          reply: autoSummary,
          actionChips: collectedActionChips,
          updatedHistory: [...updatedHistory, autoAssistantMsg],
        };
      }
    } catch (modelErr: any) {
      console.warn(`Exception calling Groq with ${currentModel}:`, modelErr);
      lastGroqError = modelErr.message || String(modelErr);
    }
  }

  // If all candidate models failed, report the Groq error clearly
  const friendlyError = lastGroqError
    ? `⚠️ **Groq AI Error**: ${lastGroqError}`
    : '⚠️ Unable to connect to Groq AI. Please check your network connection or try again in a moment.';

  const finalErrorMsg: ChatMessage = {
    id: 'msg-' + Date.now(),
    role: 'assistant',
    content: friendlyError,
    actionChips: collectedActionChips.length > 0 ? collectedActionChips : undefined,
    timestamp: Date.now(),
  };

  return {
    reply: friendlyError,
    actionChips: collectedActionChips,
    updatedHistory: [...updatedHistory, finalErrorMsg],
    error: lastGroqError || 'Groq AI service error',
  };
}
