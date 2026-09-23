import {
  TodoItem,
  HabitItem,
  ExpenseItem,
  Priority,
  TaskStatus,
} from '../types';
import { Storage } from '../utils/storage';
import {
  getRegisteredHandlers,
  broadcastDataChanged,
  inferExpenseCategory,
} from './commandMappingService';

// ============================================================================
// 1. STRICT INTENT TAXONOMY
// ============================================================================

export type CommandIntent =
  // Task Intents
  | 'TASK_CREATE'
  | 'TASK_UPDATE'
  | 'TASK_COMPLETE'
  | 'TASK_DELETE'
  | 'TASK_VIEW'
  | 'TASK_CLEAR_ALL'
  // Habit Intents
  | 'HABIT_CREATE'
  | 'HABIT_COMPLETE'
  | 'HABIT_UNCOMPLETE'
  | 'HABIT_TOGGLE'
  | 'HABIT_VIEW'
  | 'HABIT_DELETE'
  // Expense Intents
  | 'EXPENSE_CREATE'
  | 'EXPENSE_UPDATE'
  | 'EXPENSE_DELETE'
  | 'EXPENSE_DELETE_BATCH'
  | 'EXPENSE_VIEW'
  | 'EXPENSE_ANALYZE'
  | 'EXPENSE_CLEAR_ALL'
  // Navigation Intents
  | 'NAVIGATE_VIEW'
  // Dashboard Intents
  | 'DASHBOARD_QUERY'
  // Confirmation & Clarification
  | 'CONFIRM_PENDING'
  | 'CANCEL_PENDING'
  | 'BLOCKED_BY_PENDING'
  | 'AMBIGUOUS_INTENT'
  | 'NEEDS_CLARIFICATION'
  | 'UNKNOWN_INTENT';

export type TargetEntity =
  | 'task'
  | 'habit'
  | 'expense'
  | 'view'
  | 'dashboard'
  | 'journal'
  | 'pending'
  | 'unknown';

export type TargetScope =
  | 'single'
  | 'multiple'
  | 'all'
  | 'today'
  | 'yesterday'
  | 'date_range'
  | 'latest'
  | 'unknown';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ============================================================================
// 2. EXECUTABLE ACTION & OPTION TYPES
// ============================================================================

export interface ExecutableAction {
  type: string; // 'delete_expense' | 'toggle_habit' | 'add_task' | 'update_task' | 'delete_task' | 'add_expense' | 'update_expense' | 'navigate_view' | 'clear_all_expenses' | 'clear_all_tasks'
  targetId?: string;
  targetTitle?: string;
  params: Record<string, any>;
  description: string;
  isDestructive?: boolean;
}

export interface InteractiveOption {
  id: string;
  label: string;
  description?: string;
  variant?: 'default' | 'danger' | 'primary' | 'cancel';
  isDestructive?: boolean;
  actions: ExecutableAction[];
  confirmationPrompt?: string;
}

export interface CommandDecision {
  intent: CommandIntent;
  entity: TargetEntity;
  confidence: ConfidenceLevel;
  scope: TargetScope;
  actions: ExecutableAction[];
  requiresConfirmation: boolean;
  confirmationPrompt?: string;
  clarificationPrompt?: string;
  options?: InteractiveOption[];
  matchedEntities?: any[];
  explanation?: string;
  isDestructive?: boolean;
  isAtomicLocked?: boolean;
  transactionId?: string;
}

export interface ExecutionResult {
  success: boolean;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'NO_MATCH' | 'ERROR' | 'AWAITING_CONFIRMATION' | 'CANCELLED';
  message: string;
  actionChips?: string[];
  executedActions: ExecutableAction[];
  options?: InteractiveOption[];
}

export interface CommandContext {
  activeView?: string;
  selectedCategory?: string;
  activeDate?: string;
  filter?: string;
}

// ============================================================================
// 3. PENDING ACTION SESSION MANAGER (For interactive confirmations)
// ============================================================================

let currentPendingDecision: CommandDecision | null = null;
let pendingTimestamp = 0;
const PENDING_TIMEOUT_MS = 90000; // 90 seconds timeout for pending confirmations

export function setPendingCommandDecision(decision: CommandDecision): void {
  currentPendingDecision = decision;
  pendingTimestamp = Date.now();
}

export function getPendingCommandDecision(): CommandDecision | null {
  if (!currentPendingDecision) return null;
  if (Date.now() - pendingTimestamp > PENDING_TIMEOUT_MS) {
    currentPendingDecision = null;
    return null;
  }
  return currentPendingDecision;
}

export function clearPendingCommandDecision(): void {
  currentPendingDecision = null;
  pendingTimestamp = 0;
}

export function isAtomicPendingLocked(): boolean {
  const pending = getPendingCommandDecision();
  if (!pending) return false;
  return pending.isAtomicLocked === true;
}

export function setAtomicPendingLock(locked: boolean): void {
  const pending = getPendingCommandDecision();
  if (pending) {
    pending.isAtomicLocked = locked;
  }
}

export function lockPendingExpenseDeletion(
  transactionId: string,
  items: any[],
  scope: TargetScope = 'multiple'
): CommandDecision {
  const actions: ExecutableAction[] = items.map((item) => ({
    type: 'delete_expense',
    targetId: item.id,
    params: { id: item.id, name: item.name, amount: item.amount },
    description: `Delete expense "${item.name}" (₹${item.amount})`,
    isDestructive: true,
  }));

  const decision: CommandDecision = {
    intent: 'EXPENSE_DELETE',
    entity: 'expense',
    confidence: 'high',
    scope,
    actions,
    requiresConfirmation: true,
    isDestructive: true,
    isAtomicLocked: true,
    transactionId,
    matchedEntities: items,
    confirmationPrompt: `Are you sure you want to delete ${items.length} expense record(s)? This transaction is locked in an atomic pending state.`,
    options: [
      {
        id: `confirm-del-${transactionId}`,
        label: `✓ Approve Deletion (${items.length})`,
        variant: 'danger',
        isDestructive: true,
        actions,
      },
      {
        id: `cancel-del-${transactionId}`,
        label: '✕ Cancel',
        variant: 'cancel',
        actions: [],
      },
    ],
  };
  setPendingCommandDecision(decision);
  return decision;
}

export function unlockPendingExpenseDeletion(): void {
  clearPendingCommandDecision();
}

// ============================================================================
// 4. DATE AND HELPERS
// ============================================================================

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDayIndex(): number {
  const day = new Date().getDay(); // 0 is Sunday
  return day === 0 ? 6 : day - 1; // 0=Mon, 6=Sun
}

export function matchesDate(itemDate?: string, target?: string): boolean {
  if (!itemDate || !target) return false;
  const cleanItem = itemDate.trim().slice(0, 10);
  const cleanTarget = target.trim().toLowerCase();

  if (cleanTarget === 'today') {
    return cleanItem === getTodayDateString();
  }
  if (cleanTarget === 'yesterday') {
    return cleanItem === getYesterdayDateString();
  }
  return cleanItem === target || cleanItem.startsWith(target);
}

// ============================================================================
// 5. NATURAL LANGUAGE COMMAND INTENT ANALYZER
// ============================================================================

export function analyzeCommandIntent(
  rawInput: string,
  context?: CommandContext
): CommandDecision {
  const decision = internalAnalyzeCommandIntent(rawInput, context);
  return {
    ...decision,
    isDestructive: Boolean(decision.isDestructive),
  };
}

function internalAnalyzeCommandIntent(
  rawInput: string,
  context?: CommandContext
): CommandDecision {
  const text = (rawInput || '').trim();
  const lower = text.toLowerCase();

  // Strip conversational wrappers
  let cleaned = lower
    .replace(/[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D]/gu, ' ')
    .replace(/^[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+/, '')
    .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
    .replace(/^(?:hey\s+)?(?:zikenn|gemini|assistant|there)\b[\s,;:]*/i, '')
    .replace(/^(?:please\s+|can\s+you\s+|could\s+you\s+|kindly\s+|let's\s+|just\s+)+[\s,;:]*/i, '')
    .replace(/^[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+/, '')
    .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
    .trim();

  // Strip residual outer quotes only (preserving apostrophes inside words like today's)
  cleaned = cleaned.replace(/^["'`«»„]+|["'`«»„]+$/g, '').trim();

  if (!cleaned) {
    return {
      intent: 'UNKNOWN_INTENT',
      entity: 'unknown',
      confidence: 'low',
      scope: 'unknown',
      actions: [],
      requiresConfirmation: false,
    };
  }

  // --------------------------------------------------------------------------
  // A. Check for Confirmation of Pending Action (e.g. "yes", "confirm", "delete them")
  // --------------------------------------------------------------------------
  const pending = getPendingCommandDecision();
  if (pending) {
    const isAffirmative =
      /^(?:yes|yep|yeah|sure|confirm|do\s+it|proceed|go\s+ahead|delete\s+(?:them|all|it)|ok|okay|continue|approve)\b/i.test(cleaned);
    const isNegative =
      /^(?:no|nope|cancel|stop|don't|dont|abort|nevermind|never\s+mind|reject)\b/i.test(cleaned);

    if (isAffirmative) {
      clearPendingCommandDecision();
      return {
        intent: 'CONFIRM_PENDING',
        entity: 'pending',
        confidence: 'high',
        scope: pending.scope,
        actions: pending.actions,
        requiresConfirmation: false,
        explanation: 'Executing confirmed pending action.',
        isDestructive: pending.isDestructive,
      };
    }

    if (isNegative) {
      clearPendingCommandDecision();
      return {
        intent: 'CANCEL_PENDING',
        entity: 'pending',
        confidence: 'high',
        scope: pending.scope,
        actions: [],
        requiresConfirmation: false,
        explanation: 'Pending action cancelled by user.',
      };
    }

    // ATOMIC PENDING STATE LOCK:
    // If an atomic pending transaction (e.g. multi-record or destructive deletion) is awaiting confirmation,
    // lock the state and BLOCK any other incoming intent until the specific transaction is resolved!
    if (isAtomicPendingLocked()) {
      return {
        intent: 'BLOCKED_BY_PENDING',
        entity: 'pending',
        confidence: 'high',
        scope: pending.scope,
        actions: [],
        requiresConfirmation: false,
        isDestructive: false,
        explanation: `A pending transaction (${pending.actions.length} action(s)) is locked in an atomic pending state. Please approve ("Yes") or cancel ("No") this specific transaction before running other commands.`,
        options: pending.options || [
          { id: 'confirm-pending', label: '✓ Approve Pending Action', variant: 'danger', actions: pending.actions },
          { id: 'cancel-pending', label: '✕ Cancel', variant: 'cancel', actions: [] },
        ],
      };
    }
  }

  // --------------------------------------------------------------------------
  // B0. AMBIGUOUS / VAGUE COMMANDS WITHOUT SPECIFIC ENTITY
  // e.g. "show me that", "delete that", "do that", "finish it", "get rid of it",
  // "handle this", "check it", "remove it", "delete the one from yesterday" (no entity)
  // These must never guess randomly, perform unintended actions, or create rogue tasks!
  // --------------------------------------------------------------------------
  const isVagueCommand =
    /^(?:show\s+me\s+that|delete\s+that|do\s+that|finish\s+it|get\s+rid\s+of\s+it|handle\s+this|check\s+it|remove\s+it)\b/i.test(cleaned) ||
    /^(?:delete|remove)\s+(?:the\s+)?(?:one|item)\s+from\s+(?:yesterday|today)$/i.test(cleaned) ||
    /^(?:do\s+something\s+with\s+(?:my\s+)?expenses)$/i.test(cleaned);

  if (isVagueCommand) {
    return {
      intent: 'UNKNOWN_INTENT',
      entity: 'unknown',
      confidence: 'low',
      scope: 'unknown',
      actions: [],
      requiresConfirmation: false,
      clarificationPrompt: 'Which one do you mean?',
      explanation: 'Which one do you mean?',
    };
  }

  // --------------------------------------------------------------------------
  // B1. EXPLICIT TASK CREATION OVERRIDE
  // e.g. "Create a task called Delete my old expenses", "Create a task called Review my expenses"
  // Explicit user command ALWAYS takes precedence over page context or keywords inside the title!
  // --------------------------------------------------------------------------
  const explicitTaskMatch = cleaned.match(
    /^(?:create|add|make|schedule)\s+(?:a\s+)?(?:new\s+)?task\s+(?:called|named|titled|to|for|:\s*)?\s*(.+)$/i
  );
  if (explicitTaskMatch && explicitTaskMatch[1]) {
    let taskTitle = explicitTaskMatch[1].trim();
    // Strip leading "to ", "for ", quotes or punctuation
    taskTitle = taskTitle.replace(/^(?:to|for)\s+/i, '').replace(/^["'`:]+|["'`:]+$/g, '').trim();
    if (taskTitle) {
      taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);
      const actions: ExecutableAction[] = [
        {
          type: 'add_task',
          targetTitle: taskTitle,
          params: { title: taskTitle, priority: 'medium', category: 'Personal' },
          description: `Add task "${taskTitle}"`,
        },
      ];
      return {
        intent: 'TASK_CREATE',
        entity: 'task',
        confidence: 'high',
        scope: 'single',
        actions,
        requiresConfirmation: false,
        explanation: `Added task "${taskTitle}" to your dashboard.`,
      };
    }
  }

  // --------------------------------------------------------------------------
  // B2. OPERATION-FIRST: READ / VIEW / QUERY INTENTS
  // e.g. "Show me what I spent today", "What did I spend today?", "How much did I spend today?",
  // "Show today's expenses", "What did I spend this month?", "How much have I spent on food?",
  // "Show my recent transactions", "Show my pending tasks", "What tasks do I have left?",
  // "Which tasks are due today?", "Show my habits", "Which habits did I complete today?"
  // Context-aware queries: e.g. "What's left?" (on tasks page) or "Which ones did I finish today?" (on habits page)
  // --------------------------------------------------------------------------
  const hasDeleteVerb = /\b(delete|remove|clear|erase|cancel|wipe|drop|discard|purge|trash)\b/i.test(cleaned);
  const isQuestionOrInquiry =
    /^(?:which|what|how|did\s+i|have\s+i)\b/i.test(cleaned) ||
    /\?$/.test(cleaned.trim()) ||
    /^(?:show|tell|display|view|list|find|inspect|analyze|can\s+you\s+(?:show|tell|check))\b/i.test(cleaned) ||
    /\b(?:what\s+did\s+i\s+spend|how\s+much\s+did\s+i\s+spend|what\s+have\s+i\s+spent|how\s+much\s+have\s+i\s+spent|what\s+i\s+spent|how\s+much\s+spent|what's\s+left|what\s+do\s+i\s+have\s+left|what\s+do\s+i\s+need\s+to\s+do|how\s+are\s+my\s+habits|which\s+ones?\s+did\s+i\s+finish|spending\s+summary|summary\s+of\s+expenses)\b/i.test(cleaned);

  const hasHabitCompletionVerb =
    !isQuestionOrInquiry &&
    /\b(check|mark|done|complete|completed|toggle|finish|finished|uncheck)\b/i.test(cleaned);

  const isQueryPattern = isQuestionOrInquiry || /^(?:check)\b/i.test(cleaned);

  if (!hasDeleteVerb && !hasHabitCompletionVerb && isQueryPattern) {
    // 1. EXPENSE READ / QUERY
    const hasExplicitExpenseDomain =
      /\b(spending|spendings|expense|expenses|transaction|transactions|cost|costs|money|spent|spend|paid|purchase|purchases|bill|bills)\b/i.test(cleaned) ||
      /\b(food|grocery|groceries)\b/i.test(cleaned);

    const isExpenseRead =
      hasExplicitExpenseDomain ||
      /^(?:what\s+did\s+i\s+spend|how\s+much\s+did\s+i\s+spend|what\s+have\s+i\s+spent|how\s+much\s+have\s+i\s+spent|what\s+i\s+spent|how\s+much\s+spent)\b/i.test(cleaned) ||
      /^(?:show|tell|check|display|view|give\s+me)\s+(?:me\s+)?(?:what\s+i\s+spent|my\s+spending|my\s+expenses|today's\s+expenses|recent\s+expenses|recent\s+transactions)/i.test(cleaned) ||
      ((context?.activeView === 'expenses' || context?.activeView === 'subscriptions' || context?.activeView === 'budgets') &&
        !/\b(tasks?|todos?|to-dos?|habits?)\b/i.test(cleaned));

    if (isExpenseRead) {
      const isToday = /\b(today|today's|so\s+far\s+today|tonight)\b/i.test(cleaned);
      const isYesterday = /\b(yesterday|yesterday's)\b/i.test(cleaned);
      const isMonth = /\b(this\s+month|month|monthly)\b/i.test(cleaned);
      const isRecent = /\b(recent|latest|last|transactions)\b/i.test(cleaned);
      const allExpenses = Storage.getExpenses();
      const todayStr = getTodayDateString();

      let targetExpenses = allExpenses;
      let scopeVal: TargetScope = 'all';
      let periodLabel = 'total';

      if (isToday) {
        targetExpenses = allExpenses.filter((e) => !e.date || e.date === todayStr);
        periodLabel = 'today';
        scopeVal = 'today';
      } else if (isYesterday) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yestStr = yesterday.toISOString().split('T')[0];
        targetExpenses = allExpenses.filter((e) => e.date === yestStr);
        periodLabel = 'yesterday';
        scopeVal = 'yesterday';
      } else if (isMonth) {
        const monthPrefix = todayStr.slice(0, 7);
        targetExpenses = allExpenses.filter((e) => (e.date || todayStr).startsWith(monthPrefix));
        periodLabel = 'this month';
        scopeVal = 'date_range';
      } else if (isRecent) {
        targetExpenses = allExpenses.slice(0, 5);
        periodLabel = 'recent';
        scopeVal = 'latest';
      }

      // Check for category filter: "on food", "on groceries", "on dining"
      const catMatch = cleaned.match(/\b(?:on|for)\s+(food|grocery|groceries|dining|travel|bills|coffee)\b/i);
      if (catMatch && catMatch[1]) {
        const catWord = catMatch[1].toLowerCase();
        targetExpenses = targetExpenses.filter((e) =>
          (e.name || '').toLowerCase().includes(catWord) ||
          (e.category || '').toLowerCase().includes(catWord)
        );
        periodLabel = catWord;
      }

      const totalSpent = targetExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const explanation =
        targetExpenses.length === 0
          ? `You have no recorded expenses for ${periodLabel}.`
          : `Here's what you spent ${periodLabel}: ₹${totalSpent.toLocaleString()} across ${targetExpenses.length} expense(s).`;

      return {
        intent: 'EXPENSE_VIEW',
        entity: 'expense',
        confidence: 'high',
        scope: scopeVal,
        actions: [
          {
            type: 'navigate_view',
            params: { view: 'expenses' },
            description: 'Open expenses workspace',
          },
        ],
        requiresConfirmation: false,
        matchedEntities: targetExpenses,
        explanation,
      };
    }

    // 2. TASK READ / QUERY
    const hasExplicitTaskDomain =
      /\b(tasks?|todos?|to-dos?|task\s+list|items?\s+on\s+my\s+list)\b/i.test(cleaned);

    const isTaskRead =
      hasExplicitTaskDomain ||
      (context?.activeView === 'tasks' &&
        /^(?:what's\s+left|what\s+do\s+i\s+have\s+left|what\s+do\s+i\s+need\s+to\s+do|show\s+my\s+tasks|show\s+pending)\b/i.test(cleaned)) ||
      /^(?:show|display|view|list)\s+(?:my\s+)?(?:pending\s+)?(?:tasks|todos|to-dos|unfinished\s+tasks)/i.test(cleaned) ||
      /^(?:what\s+tasks?\s+are\s+pending|which\s+tasks?\s+are\s+due|what\s+tasks?\s+do\s+i\s+have\s+left|what's\s+left\s+on\s+my\s+task\s+list)/i.test(cleaned);

    if (isTaskRead) {
      const allTodos = Storage.getTodos();
      const isDueToday = /\b(due\s+today|today)\b/i.test(cleaned);
      const isPendingOnly = /\b(pending|left|unfinished|to\s+do)\b/i.test(cleaned);
      const pendingTodos = allTodos.filter((t) => !t.completed);
      const dueTodayTodos = allTodos.filter((t) => !t.completed && matchesDate(t.dueDate, 'today'));

      const matchedEntities = isDueToday ? dueTodayTodos : isPendingOnly ? pendingTodos : allTodos;
      const explanation = isDueToday
        ? dueTodayTodos.length === 0
          ? 'You have no tasks due today.'
          : `You have ${dueTodayTodos.length} task(s) due today.`
        : pendingTodos.length === 0
        ? 'You have no pending tasks.'
        : `You have ${pendingTodos.length} pending task(s).`;

      return {
        intent: 'TASK_VIEW',
        entity: 'task',
        confidence: 'high',
        scope: isDueToday ? 'today' : isPendingOnly ? 'single' : 'all',
        actions: [
          {
            type: 'navigate_view',
            params: { view: 'tasks' },
            description: 'Open tasks workspace',
          },
        ],
        requiresConfirmation: false,
        matchedEntities,
        explanation,
      };
    }

    // 3. HABIT READ / QUERY
    const hasExplicitHabitDomain =
      /\b(habits?|routines?|streaks?)\b/i.test(cleaned);

    const isHabitRead =
      hasExplicitHabitDomain ||
      (context?.activeView === 'habits' &&
        /^(?:which\s+ones?\s+did\s+i\s+finish|how\s+are\s+(?:they|my\s+habits)\s+going|show\s+my\s+habits)\b/i.test(cleaned)) ||
      /^(?:show|view|display|list|check)\s+(?:my\s+)?habits\b/i.test(cleaned) ||
      /^(?:which\s+habits\s+did\s+i\s+complete|how\s+are\s+my\s+habits\s+going|check\s+today's\s+habits)/i.test(cleaned);

    if (isHabitRead) {
      const allHabits = Storage.getHabits();
      const dayIdx = getTodayDayIndex();
      const completedToday = allHabits.filter((h) => h.completedDays?.[dayIdx]);
      const explanation =
        allHabits.length === 0
          ? 'You have no habits tracked on your dashboard.'
          : `You've completed ${completedToday.length} of ${allHabits.length} habits today.`;

      return {
        intent: 'HABIT_VIEW',
        entity: 'habit',
        confidence: 'high',
        scope: 'today',
        actions: [
          {
            type: 'navigate_view',
            params: { view: 'habits' },
            description: 'Open habits workspace',
          },
        ],
        requiresConfirmation: false,
        matchedEntities: allHabits,
        explanation,
      };
    }
  }

  // --------------------------------------------------------------------------
  // B. EXPENSES / SPENDINGS: DELETION INTENT
  // Keywords: delete, remove, clear, erase, cancel, wipe, drop, discard
  // Combined with: spending, spendings, expense, expenses, money, transaction, cost, paid
  // --------------------------------------------------------------------------
  const allExpenses = Storage.getExpenses();
  const cleanedWithoutDeleteVerb = cleaned
    .replace(/\b(delete|remove|clear|erase|cancel|wipe|drop|discard|purge|trash)\b/i, '')
    .trim();
  const matchesExistingExpense =
    hasDeleteVerb &&
    cleanedWithoutDeleteVerb.length >= 3 &&
    allExpenses.some((e) => {
      const n = (e.name || '').trim().toLowerCase();
      return n.length >= 3 && (cleaned.includes(n) || n.includes(cleanedWithoutDeleteVerb));
    });
  const hasExpenseNoun =
    matchesExistingExpense ||
    /\b(spending|spendings|expense|expenses|transaction|transactions|cost|costs|money|spent|spend|paid|purchase|purchases|bill|bills|food|grocery|groceries)\b/i.test(cleaned);

  if (hasDeleteVerb && hasExpenseNoun && !/\b(task|tasks|todo|todos|to-do|to-dos)\b/i.test(cleaned)) {
    const isToday = /\b(today|today's|tonight)\b/i.test(cleaned);
    const isYesterday = /\b(yesterday|yesterday's)\b/i.test(cleaned);
    const isAll = /\b(all|everything|entire|every)\b/i.test(cleaned) || isToday || isYesterday;
    const isLatest = /\b(last|latest|recent|newest)\b/i.test(cleaned);

    // 1. "Delete all the spendings I did today" / "Delete today's expenses"
    if (isToday) {
      const todayStr = getTodayDateString();
      const todayExpenses = allExpenses.filter((e) => matchesDate(e.date, 'today'));

      if (todayExpenses.length === 0) {
        return {
          intent: 'EXPENSE_DELETE_BATCH',
          entity: 'expense',
          confidence: 'high',
          scope: 'today',
          actions: [],
          requiresConfirmation: false,
          matchedEntities: [],
          explanation: `You don't have any spendings or expenses recorded for today (${todayStr}). No records were deleted.`,
        };
      }

      const totalAmount = todayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const actions: ExecutableAction[] = [
        {
          type: 'delete_expense',
          params: { ids: todayExpenses.map((e) => e.id), date: 'today', all: true },
          description: `Delete ${todayExpenses.length} expense(s) from today totaling ₹${totalAmount.toLocaleString()}`,
          isDestructive: true,
        },
      ];

      // If multiple records, require explicit safety confirmation
      const options: InteractiveOption[] = [
        {
          id: 'confirm-del-today-expenses',
          label: `Delete all ${todayExpenses.length} today's expenses (₹${totalAmount.toLocaleString()})`,
          variant: 'danger',
          actions,
        },
        {
          id: 'cancel-del-today-expenses',
          label: 'Cancel',
          variant: 'cancel',
          actions: [],
        },
      ];

      return {
        intent: 'EXPENSE_DELETE_BATCH',
        entity: 'expense',
        confidence: 'high',
        scope: 'today',
        actions,
        requiresConfirmation: todayExpenses.length > 1,
        confirmationPrompt: `You have requested to delete all ${todayExpenses.length} expense record(s) logged today (Total: ₹${totalAmount.toLocaleString()}). Would you like to proceed with deleting them?`,
        options,
        matchedEntities: todayExpenses,
        isDestructive: true,
      };
    }

    // 2. "Delete yesterday's expenses"
    if (isYesterday) {
      const yestExpenses = allExpenses.filter((e) => matchesDate(e.date, 'yesterday'));
      if (yestExpenses.length === 0) {
        return {
          intent: 'EXPENSE_DELETE_BATCH',
          entity: 'expense',
          confidence: 'high',
          scope: 'yesterday',
          actions: [],
          requiresConfirmation: false,
          matchedEntities: [],
          explanation: `No expenses found for yesterday. No changes were made.`,
        };
      }
      const totalAmount = yestExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const actions: ExecutableAction[] = [
        {
          type: 'delete_expense',
          params: { ids: yestExpenses.map((e) => e.id), date: 'yesterday', all: true },
          description: `Delete ${yestExpenses.length} expense(s) from yesterday totaling ₹${totalAmount.toLocaleString()}`,
          isDestructive: true,
        },
      ];
      return {
        intent: 'EXPENSE_DELETE_BATCH',
        entity: 'expense',
        confidence: 'high',
        scope: 'yesterday',
        actions,
        requiresConfirmation: true,
        confirmationPrompt: `You have ${yestExpenses.length} expense(s) from yesterday (Total: ₹${totalAmount.toLocaleString()}). Delete all of them?`,
        options: [
          {
            id: 'confirm-del-yest-expenses',
            label: `Delete ${yestExpenses.length} expenses (₹${totalAmount.toLocaleString()})`,
            variant: 'danger',
            actions,
          },
          { id: 'cancel-del-yest', label: 'Cancel', variant: 'cancel', actions: [] },
        ],
        matchedEntities: yestExpenses,
        isDestructive: true,
      };
    }

    // 3. "Delete latest expense" / "Delete last spending"
    if (isLatest && allExpenses.length > 0) {
      const latest = allExpenses[0];
      const actions: ExecutableAction[] = [
        {
          type: 'delete_expense',
          targetId: latest.id,
          targetTitle: latest.name,
          params: { id: latest.id, latest: true },
          description: `Delete recent expense "${latest.name}" (₹${Number(latest.amount).toLocaleString()})`,
          isDestructive: true,
        },
      ];
      return {
        intent: 'EXPENSE_DELETE',
        entity: 'expense',
        confidence: 'high',
        scope: 'latest',
        actions,
        requiresConfirmation: false,
        matchedEntities: [latest],
        isDestructive: true,
      };
    }

    // 4. "Clear all expenses" / "Delete all expenses"
    if (isAll && !isToday && !isYesterday && allExpenses.length > 0) {
      const total = allExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const actions: ExecutableAction[] = [
        {
          type: 'clear_all_expenses',
          params: {},
          description: `Clear all ${allExpenses.length} expenses from dashboard (Total: ₹${total.toLocaleString()})`,
          isDestructive: true,
        },
      ];
      return {
        intent: 'EXPENSE_CLEAR_ALL',
        entity: 'expense',
        confidence: 'high',
        scope: 'all',
        actions,
        requiresConfirmation: true,
        confirmationPrompt: `⚠️ Are you sure you want to permanently clear ALL ${allExpenses.length} expenses from your dashboard (Total: ₹${total.toLocaleString()})?`,
        options: [
          {
            id: 'confirm-clear-all-expenses',
            label: `Permanently Clear All ${allExpenses.length} Expenses`,
            variant: 'danger',
            actions,
          },
          { id: 'cancel-clear-all', label: 'Cancel', variant: 'cancel', actions: [] },
        ],
        matchedEntities: allExpenses,
        isDestructive: true,
      };
    }

    // 5. Specific merchant / keyword matching (e.g. "Delete my Amazon expense", "Remove lunch expense")
    const rawKeyword = cleaned
      .replace(/\b(delete|remove|clear|erase|cancel|wipe|drop|discard)\s+/i, '')
      .replace(/\b(the|my|an|a|all|recent|last|latest)\s+/i, '')
      .replace(/\b(spending|spendings|expense|expenses|transaction|cost|bill|payment|money|paid)\s+(?:for|of|called|titled|on)?\s*/gi, '')
      .replace(/\s+\b(spending|spendings|expense|expenses|transaction|cost|bill|payment|money|paid)\b/gi, '')
      .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
      .trim();
    const keyword = rawKeyword.replace(/["“”'‘’`«»„]/g, '').trim();

    // Multi-record matching: e.g. "Delete Coffee, Swiggy Dinner, and Uber Ride", "Delete Coffee and Swiggy Dinner", "Delete expenses of 150 and 450"
    if (cleaned.includes(',') || /\b(and|&|both)\b/i.test(cleaned)) {
      const mentionedExpenses = allExpenses.filter((e) => {
        const n = (e.name || '').trim().toLowerCase();
        if (n.length >= 3 && cleaned.includes(n)) return true;
        const amtStr = String(e.amount);
        if (amtStr && new RegExp(`\\b${amtStr}\\b`).test(cleaned)) return true;
        return false;
      });

      if (mentionedExpenses.length > 1) {
        const totalAmount = mentionedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const actions: ExecutableAction[] = mentionedExpenses.map((item) => ({
          type: 'delete_expense',
          targetId: item.id,
          targetTitle: item.name,
          params: { id: item.id },
          description: `Delete expense "${item.name}" (₹${Number(item.amount).toLocaleString()})`,
          isDestructive: true,
        }));

        return {
          intent: 'EXPENSE_DELETE',
          entity: 'expense',
          confidence: 'high',
          scope: 'multiple',
          actions,
          requiresConfirmation: true,
          confirmationPrompt: `Are you sure you want to delete ${mentionedExpenses.length} expenses totaling ₹${totalAmount.toLocaleString()}?`,
          options: [
            {
              id: 'confirm-del-multi-expenses',
              label: `Delete ${mentionedExpenses.length} Expenses`,
              variant: 'danger',
              actions,
            },
            { id: 'cancel-del-multi', label: 'Cancel', variant: 'cancel', actions: [] },
          ],
          matchedEntities: mentionedExpenses,
          isDestructive: true,
        };
      }
    }

    if (keyword) {
      const numericAmountMatch = keyword.match(/(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)/i);
      const targetAmount = numericAmountMatch ? parseFloat(numericAmountMatch[1].replace(/,/g, '')) : null;

      const matched = allExpenses.filter(
        (e) =>
          e.name.toLowerCase().includes(keyword) ||
          (e.category && e.category.toLowerCase().includes(keyword)) ||
          (targetAmount !== null && !isNaN(targetAmount) && Number(e.amount) === targetAmount)
      );

      if (matched.length === 0) {
        return {
          intent: 'EXPENSE_DELETE',
          entity: 'expense',
          confidence: 'high',
          scope: 'single',
          actions: [],
          requiresConfirmation: false,
          explanation: `No expense record matching "${keyword}" was found on your dashboard.`,
          isDestructive: true,
        };
      }

      if (matched.length === 1) {
        const item = matched[0];
        const actions: ExecutableAction[] = [
          {
            type: 'delete_expense',
            targetId: item.id,
            targetTitle: item.name,
            params: { id: item.id },
            description: `Delete expense "${item.name}" (₹${Number(item.amount).toLocaleString()})`,
            isDestructive: true,
          },
        ];
        return {
          intent: 'EXPENSE_DELETE',
          entity: 'expense',
          confidence: 'high',
          scope: 'single',
          actions,
          requiresConfirmation: false,
          matchedEntities: matched,
          isDestructive: true,
        };
      }

      if (matched.length > 1) {
        // Disambiguation UI: multiple matches found! Present selectable options!
        const defaultActions: ExecutableAction[] = matched.map((m) => ({
          type: 'delete_expense',
          targetId: m.id,
          targetTitle: m.name,
          params: { id: m.id },
          description: `Delete expense "${m.name}" (₹${Number(m.amount).toLocaleString()})`,
          isDestructive: true,
        }));

        const options: InteractiveOption[] = matched.slice(0, 4).map((m) => ({
          id: `del-exp-${m.id}`,
          label: `₹${Number(m.amount).toLocaleString()} · ${m.name} (${m.date || 'Recent'})`,
          actions: [
            {
              type: 'delete_expense',
              targetId: m.id,
              targetTitle: m.name,
              params: { id: m.id },
              description: `Delete expense "${m.name}" (₹${Number(m.amount).toLocaleString()})`,
              isDestructive: true,
            },
          ],
        }));

        options.push({
          id: `del-exp-all-matched`,
          label: `Delete all ${matched.length} matching expenses`,
          variant: 'danger',
          actions: [
            {
              type: 'delete_expense',
              params: { ids: matched.map((m) => m.id), all: true },
              description: `Delete all ${matched.length} matching "${keyword}" expenses`,
              isDestructive: true,
            },
          ],
        });

        options.push({
          id: 'cancel-del-exp-options',
          label: 'Cancel',
          variant: 'cancel',
          actions: [],
        });

        return {
          intent: 'EXPENSE_DELETE',
          entity: 'expense',
          confidence: 'medium',
          scope: 'multiple',
          actions: defaultActions,
          requiresConfirmation: true,
          clarificationPrompt: `I found ${matched.length} expenses matching "${keyword}". Which one would you like to delete?`,
          options,
          matchedEntities: matched,
          isDestructive: true,
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // C. HABITS: ROUTING, DELETION, VIEW, TOGGLE, COMPLETION
  // --------------------------------------------------------------------------
  const hasHabitNoun = /\b(habit|habits|routine|routines|daily|momentum)\b/i.test(cleaned);

  // 1. Habit Deletion: "Delete habit Gym Workout", "Remove habit Reading"
  if (hasDeleteVerb && hasHabitNoun) {
    const allHabits = Storage.getHabits();
    const habitName = cleaned
      .replace(/\b(delete|remove|clear|erase|drop|discard)\s+/i, '')
      .replace(/\b(the|my|a|an)\s+/i, '')
      .replace(/\b(habit|routine)\s+(?:called|titled|:\s*)?/i, '')
      .replace(/\s+\b(habit|routine)\b/i, '')
      .trim();

    const matched = allHabits.filter((h) => h.title.toLowerCase().includes(habitName));
    if (matched.length > 0) {
      const target = matched[0];
      return {
        intent: 'HABIT_DELETE',
        entity: 'habit',
        confidence: 'high',
        scope: 'single',
        actions: [
          {
            type: 'delete_habit',
            targetId: target.id,
            targetTitle: target.title,
            params: { id: target.id },
            description: `Delete habit "${target.title}"`,
            isDestructive: true,
          },
        ],
        requiresConfirmation: false,
        matchedEntities: [target],
        isDestructive: true,
      };
    }
  }

  // 2. Habit View: "Show my habits", "Go to habit tracker", "Did I do my habits today?"
  if (
    hasHabitNoun &&
    (/\b(show|view|display|list|status|tracker|did\s+i|how\s+are)\b/i.test(cleaned) ||
      /^(?:go\s+to|open)\s+(?:the\s+)?habits?/i.test(cleaned))
  ) {
    return {
      intent: 'HABIT_VIEW',
      entity: 'habit',
      confidence: 'high',
      scope: 'all',
      actions: [
        {
          type: 'navigate_view',
          params: { view: 'habits' },
          description: 'Open habits view',
        },
      ],
      requiresConfirmation: false,
      isDestructive: false,
    };
  }

  // 3. Habit Creation: "Create habit Meditate daily", "Add habit Drink water"
  if (/^(?:create|add|new)\s+(?:a\s+)?habit\b/i.test(cleaned)) {
    const hTitle = cleaned
      .replace(/^(?:create|add|new)\s+(?:a\s+)?habit\s+(?:called|titled|:\s*)?/i, '')
      .trim();
    return {
      intent: 'HABIT_CREATE',
      entity: 'habit',
      confidence: 'high',
      scope: 'single',
      actions: [
        {
          type: 'add_habit',
          params: { name: hTitle, title: hTitle },
          description: `Create habit "${hTitle}"`,
        },
      ],
      requiresConfirmation: false,
      isDestructive: false,
    };
  }

  // 4. Habit Completion / Toggle / Uncomplete
  const isUncomplete = /\b(uncomplete|uncheck|not\s+done)\b/i.test(cleaned);
  const isToggle = /\btoggle\b/i.test(cleaned);
  const isHabitCompletionOrToggle =
    isUncomplete || isToggle || hasHabitCompletionVerb || /\b(check|mark|complete|finish|done)\b/i.test(cleaned);

  if (isHabitCompletionOrToggle && hasHabitNoun) {
    const allHabits = Storage.getHabits();
    const todayIdx = getTodayDayIndex();
    const isBoth = /\bboth\b/i.test(cleaned) || /\b(?:2|two)\s+habits?\b/i.test(cleaned);
    const isAll =
      /\b(all|every|each)\b/i.test(cleaned) ||
      /\b(my\s+habits|today's\s+habits|the\s+habits)\b/i.test(cleaned) ||
      (/\bhabits\b/i.test(cleaned) && !isBoth);

    if (allHabits.length === 0) {
      return {
        intent: isUncomplete ? 'HABIT_UNCOMPLETE' : 'HABIT_COMPLETE',
        entity: 'habit',
        confidence: 'high',
        scope: 'all',
        actions: [],
        requiresConfirmation: false,
        explanation: 'You currently have no habits configured on your dashboard.',
      };
    }

    if (isBoth) {
      const targets =
        allHabits.length === 2
          ? allHabits
          : allHabits.filter((h) => !h.completedDays?.[todayIdx]).slice(0, 2);

      const resolvedTargets = targets.length > 0 ? targets : allHabits.slice(0, 2);
      const actions: ExecutableAction[] = resolvedTargets.map((h) => ({
        type: 'toggle_habit',
        targetId: h.id,
        targetTitle: h.title,
        params: { id: h.id, dayIndex: todayIdx, forceComplete: !isUncomplete, both: true },
        description: `${isUncomplete ? 'Uncheck' : 'Check off'} habit "${h.title}" for today`,
      }));

      return {
        intent: isUncomplete ? 'HABIT_UNCOMPLETE' : 'HABIT_COMPLETE',
        entity: 'habit',
        confidence: 'high',
        scope: 'multiple',
        actions,
        requiresConfirmation: false,
        matchedEntities: resolvedTargets,
        explanation: `Checking off ${resolvedTargets.map((h) => `"${h.title}"`).join(' and ')} as done for today.`,
      };
    }

    if (isAll) {
      const actions: ExecutableAction[] = allHabits.map((h) => ({
        type: 'toggle_habit',
        targetId: h.id,
        targetTitle: h.title,
        params: { id: h.id, dayIndex: todayIdx, forceComplete: !isUncomplete },
        description: `${isUncomplete ? 'Uncheck' : 'Check off'} habit "${h.title}" for today`,
      }));

      return {
        intent: isUncomplete ? 'HABIT_UNCOMPLETE' : 'HABIT_COMPLETE',
        entity: 'habit',
        confidence: 'high',
        scope: 'all',
        actions,
        requiresConfirmation: false,
        matchedEntities: allHabits,
        explanation: `Checking off all ${allHabits.length} habits for today.`,
      };
    }

    const habitName = cleaned
      .replace(/\b(check\s+off|mark\s+as\s+done|mark\s+as\s+not\s+done|check|mark|complete|finish|done|toggle|uncomplete|uncheck)\s+/i, '')
      .replace(/\b(the|my|a|an)\s+/i, '')
      .replace(/\b(habit|routine)\s+(?:called|titled|:\s*)?/i, '')
      .replace(/\s+\b(habit|routine)\b/i, '')
      .replace(/\b(?:as\s+)?(?:done|complete|completed|finished|not\s+done)\b/i, '')
      .trim();

    if (habitName) {
      const matched = allHabits.filter((h) => h.title.toLowerCase().includes(habitName));
      if (matched.length > 0) {
        const target = matched[0];
        const actions: ExecutableAction[] = [
          {
            type: 'toggle_habit',
            targetId: target.id,
            targetTitle: target.title,
            params: { id: target.id, dayIndex: todayIdx, forceComplete: !isUncomplete },
            description: `${isUncomplete ? 'Uncheck' : 'Check off'} habit "${target.title}" for today`,
          },
        ];
        return {
          intent: isUncomplete ? 'HABIT_UNCOMPLETE' : 'HABIT_COMPLETE',
          entity: 'habit',
          confidence: 'high',
          scope: 'single',
          actions,
          requiresConfirmation: false,
          matchedEntities: [target],
          explanation: `${isUncomplete ? 'Unchecking' : 'Marking'} habit "${target.title}" for today.`,
        };
      } else {
        return {
          intent: isUncomplete ? 'HABIT_UNCOMPLETE' : 'HABIT_COMPLETE',
          entity: 'habit',
          confidence: 'low',
          scope: 'single',
          actions: [],
          requiresConfirmation: false,
          explanation: `Could not find habit "${habitName}".`,
        };
      }
    }

    const uncompleted = allHabits.filter((h) => !h.completedDays?.[todayIdx]);
    const targetHabits = uncompleted.length > 0 ? uncompleted : allHabits;
    const actions: ExecutableAction[] = targetHabits.map((h) => ({
      type: 'toggle_habit',
      targetId: h.id,
      targetTitle: h.title,
      params: { id: h.id, dayIndex: todayIdx, forceComplete: !isUncomplete },
      description: `${isUncomplete ? 'Uncheck' : 'Check off'} habit "${h.title}" for today`,
    }));

    return {
      intent: isUncomplete ? 'HABIT_UNCOMPLETE' : isToggle ? 'HABIT_TOGGLE' : 'HABIT_COMPLETE',
      entity: 'habit',
      confidence: 'high',
      scope: 'all',
      actions,
      requiresConfirmation: false,
      matchedEntities: targetHabits,
      explanation: `Checking off ${targetHabits.length} habit(s) for today.`,
    };
  }

  // --------------------------------------------------------------------------
  // D. TASKS / TODOS: INTENT RESOLUTION
  // --------------------------------------------------------------------------
  // 1. Task Deletion: "Delete task buy milk", "Clear all tasks", "Remove completed tasks", "Clear completed tasks"
  const hasTaskNoun = /\b(task|tasks|todo|todos|to-do|to-dos|errand|errands)\b/i.test(cleaned);
  if (hasDeleteVerb && hasTaskNoun) {
    const allTodos = Storage.getTodos();
    const isCompletedOnly = /\b(completed|done|finished)\b/i.test(cleaned);
    const isAll = /\b(all|everything|every)\b/i.test(cleaned) || (/\b(clear|purge)\b/i.test(cleaned) && isCompletedOnly);

    if (allTodos.length === 0) {
      return {
        intent: 'TASK_DELETE',
        entity: 'task',
        confidence: 'high',
        scope: 'all',
        actions: [],
        requiresConfirmation: false,
        explanation: 'You currently have no tasks on your dashboard.',
      };
    }

    if (isAll) {
      const count = isCompletedOnly ? allTodos.filter((t) => t.completed).length : allTodos.length;
      const actions: ExecutableAction[] = [
        {
          type: 'clear_all_tasks',
          params: { completedOnly: isCompletedOnly },
          description: isCompletedOnly ? `Clear ${count} completed tasks` : `Clear all ${count} tasks`,
          isDestructive: true,
        },
      ];
      return {
        intent: 'TASK_CLEAR_ALL',
        entity: 'task',
        confidence: 'high',
        scope: 'all',
        actions,
        requiresConfirmation: count > 1,
        confirmationPrompt: isCompletedOnly
          ? `Delete all ${count} completed tasks?`
          : `Permanently delete all ${count} tasks from your dashboard?`,
        options: [
          {
            id: 'confirm-clear-tasks',
            label: isCompletedOnly ? `Clear ${count} Completed Tasks` : `Delete All ${count} Tasks`,
            variant: 'danger',
            actions,
          },
          { id: 'cancel-clear-tasks', label: 'Cancel', variant: 'cancel', actions: [] },
        ],
        isDestructive: true,
      };
    }

    // Specific task deletion by keyword
    const taskKeyword = cleaned
      .replace(/\b(delete|remove|clear|erase|drop|discard)\s+/i, '')
      .replace(/\b(the|my|a|an)\s+/i, '')
      .replace(/\b(task|todo|to-do|item)\s+(?:called|titled|:\s*)?/i, '')
      .trim();

    if (taskKeyword) {
      const matched = allTodos.filter((t) => t.title.toLowerCase().includes(taskKeyword));
      if (matched.length === 1) {
        const t = matched[0];
        const actions: ExecutableAction[] = [
          {
            type: 'delete_task',
            targetId: t.id,
            targetTitle: t.title,
            params: { id: t.id },
            description: `Delete task "${t.title}"`,
            isDestructive: true,
          },
        ];
        return {
          intent: 'TASK_DELETE',
          entity: 'task',
          confidence: 'high',
          scope: 'single',
          actions,
          requiresConfirmation: false,
          matchedEntities: [t],
          isDestructive: true,
        };
      }
      if (matched.length > 1) {
        return {
          intent: 'TASK_DELETE',
          entity: 'task',
          confidence: 'medium',
          scope: 'multiple',
          actions: [],
          requiresConfirmation: true,
          clarificationPrompt: `I found ${matched.length} tasks matching "${taskKeyword}". Which one would you like to delete?`,
          options: [
            ...matched.slice(0, 4).map((m) => ({
              id: `del-task-${m.id}`,
              label: m.title,
              actions: [
                {
                  type: 'delete_task',
                  targetId: m.id,
                  targetTitle: m.title,
                  params: { id: m.id },
                  description: `Delete task "${m.title}"`,
                  isDestructive: true,
                },
              ],
            })),
            { id: 'cancel-task-del', label: 'Cancel', variant: 'cancel' as const, actions: [] },
          ],
          matchedEntities: matched,
          isDestructive: true,
        };
      }
    }
  }

  // 2. Task Completion: "Complete task report", "Mark task gym as done", "Finish study polity task", "Finish groceries"
  const hasTaskCompletionVerb = /\b(complete|finish|done|check\s+off|mark\s+(?:as\s+)?done)\b/i.test(cleaned);
  if (hasTaskCompletionVerb && (hasTaskNoun || !hasHabitNoun)) {
    const allTodos = Storage.getTodos();
    let query = cleaned
      .replace(/\b(complete|finish|done|check\s+off|mark\s+(?:as\s+)?done)\s+/i, '')
      .replace(/\b(the|my|a|an)\s+/i, '')
      .replace(/\b(task|todo|to-do)\s+(?:called|titled|:\s*)?/i, '')
      .replace(/\s+(?:as\s+)?(?:done|complete|completed|finished)\b/i, '')
      .replace(/\s+\b(task|todo|to-do)\b/i, '')
      .trim();

    // Guard against ambiguous pronouns like "it", "that", "this" matching tasks
    if (query && !/^(it|that|this|them|all|something)$/i.test(query)) {
      const pendingTasks = allTodos.filter((t) => !t.completed);
      const queryLower = query.toLowerCase();
      // Match by word boundary or exact inclusion of non-trivial token
      const matched = pendingTasks.filter((t) => {
        const titleLower = t.title.toLowerCase();
        if (titleLower.includes(queryLower)) return true;
        const words = queryLower.split(/\s+/).filter((w) => w.length > 2);
        return words.length > 0 && words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(titleLower));
      });
      if (matched.length > 0) {
        const t = matched[0];
        const actions: ExecutableAction[] = [
          {
            type: 'update_task',
            targetId: t.id,
            targetTitle: t.title,
            params: { id: t.id, completed: true, status: 'complete' },
            description: `Mark task "${t.title}" as completed`,
          },
        ];
        return {
          intent: 'TASK_COMPLETE',
          entity: 'task',
          confidence: 'high',
          scope: 'single',
          actions,
          requiresConfirmation: false,
          matchedEntities: [t],
          explanation: `Marking task "${t.title}" as completed.`,
        };
      }
    }
  }

  // 3. Task Creation: "Add task buy milk", "Remind me to call mom", "New task: study", "Put studying polity on my task list", "Need to pay electricity bill"
  const isTaskCreation =
    /^(?:add|create|make|schedule|put|insert)\s+(?:a\s+)?(?:new\s+)?(?:(?:urgent|critical|high\s+priority|important|low\s+priority|minor|someday)\s+)?(?:task|todo|to-do|item)\b/i.test(cleaned) ||
    /^(?:put|add|insert)\s+.+?\s+(?:on|in|into|to)\s+(?:my\s+)?(?:task\s+list|tasks?|todos?|to-dos?)$/i.test(cleaned) ||
    /^(?:i\s+)?(?:remind me to|remember to|don't forget to|dont forget to|need to|have to|got to|must)\s+/i.test(cleaned) ||
    /^(?:new\s+task|task\s*:)\s*/i.test(cleaned) ||
    /^(?:add|create)\s+.+?\s+(?:to\s+|in\s+|into\s+)(?:my\s+)?(?:tasks?|todos?|task\s+list)$/i.test(cleaned);

  // CRITICAL SAFEGUARD: Never treat deletion, habit completion, or expense logging as task creation!
  const containsDestructivePhrase = hasDeleteVerb;
  const containsHabitAction = hasHabitNoun && hasHabitCompletionVerb;
  const containsExpenseCreation =
    /\b(spent|spend|paid|bought)\b/i.test(cleaned) &&
    /(?:rs\.?|inr|₹|\$|€|£)?\s*[\d,]+(?:\.\d+)?/i.test(cleaned);

  if (isTaskCreation && !containsDestructivePhrase && !containsHabitAction && !containsExpenseCreation) {
    let title = cleaned
      .replace(/^(?:add|create|make|schedule|put|insert)\s+(?:a\s+)?(?:new\s+)?(?:(?:urgent|critical|high\s+priority|important|low\s+priority|minor|someday)\s+)?(?:task|todo|to-do|item)\s*(?:called|titled|to|for|:\s*)?/i, '')
      .replace(/^(?:put|add|insert)\s+/i, '')
      .replace(/^(?:i\s+)?(?:remind me to|remember to|don't forget to|dont forget to|need to|have to|got to|must)\s*/i, '')
      .replace(/^(?:new\s+task|task\s*:)\s*/i, '')
      .replace(/\s+(?:on|in|into|to)\s+(?:my\s+)?(?:task\s+list|tasks?|todos?|to-dos?)$/i, '')
      .trim();

    // Strip leading colon or punctuation if present (e.g. from "New task: Buy groceries")
    title = title.replace(/^[:\s-]+/, '').trim();

    if (!title) title = 'New Task';
    title = title.charAt(0).toUpperCase() + title.slice(1);

    let priority: Priority = 'medium';
    if (/\b(urgent|critical|high priority|important|asap)\b/i.test(cleaned)) priority = 'high';
    else if (/\b(low priority|someday|minor)\b/i.test(cleaned)) priority = 'low';

    const actions: ExecutableAction[] = [
      {
        type: 'add_task',
        targetTitle: title,
        params: { title, priority, category: 'Personal' },
        description: `Add task "${title}" with ${priority} priority`,
      },
    ];

    return {
      intent: 'TASK_CREATE',
      entity: 'task',
      confidence: 'high',
      scope: 'single',
      actions,
      requiresConfirmation: false,
      explanation: `Added new task "${title}" to your dashboard.`,
    };
  }

  // --------------------------------------------------------------------------
  // E. EXPENSES: CREATION / LOGGING INTENT
  // Keywords: spent, spend, paid, log expense, add expense, record expense
  // --------------------------------------------------------------------------
  const isExpenseCreation =
    /^(?:i\s+)?(?:spent|spend|paid)\s+/i.test(cleaned) ||
    /^(?:add|log|record|enter|track)\s+(?:an?\s+)?(?:new\s+)?(?:expense|spending|cost|bill)\b/i.test(cleaned) ||
    /^(?:add|log|record)\s+(?:rs\.?|inr|₹)?\s*[\d,]+/i.test(cleaned);

  if (isExpenseCreation && !hasDeleteVerb) {
    const amountMatch = cleaned.match(/(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:rs|rupees|inr|bucks)?/i);
    const amount = amountMatch && amountMatch[1] ? parseFloat(amountMatch[1].replace(/,/g, '')) : 100;

    let expName = cleaned
      .replace(/^(?:i\s+)?(?:spent|spend|paid)\s+(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d+)?\s*(?:rs|rupees|inr|bucks)?\s*(?:for|on|towards|called)?\s*/i, '')
      .replace(/^(?:add|log|record|enter|track)\s+(?:an?\s+)?(?:new\s+)?(?:expense|spending|cost)?\s*(?:of\s+)?(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d+)?\s*(?:rs|rupees|inr|bucks)?\s*(?:for|on|towards|called)?\s*/i, '')
      .trim();

    if (!expName) expName = 'Expense';
    expName = expName.charAt(0).toUpperCase() + expName.slice(1);
    const category = inferExpenseCategory(expName);

    const actions: ExecutableAction[] = [
      {
        type: 'add_expense',
        targetTitle: expName,
        params: {
          name: expName,
          amount,
          category,
          date: getTodayDateString(),
        },
        description: `Log expense of ₹${amount.toLocaleString()} for "${expName}" (${category})`,
      },
    ];

    return {
      intent: 'EXPENSE_CREATE',
      entity: 'expense',
      confidence: 'high',
      scope: 'single',
      actions,
      requiresConfirmation: false,
      explanation: `Logged expense of ₹${amount.toLocaleString()} for "${expName}".`,
    };
  }

  // --------------------------------------------------------------------------
  // F. NAVIGATION & VIEW / READ INTENTS
  // "Show me what I spent today", "Show today's expenses", "Go to expenses", "Open tasks"
  // --------------------------------------------------------------------------
  if (
    /^(?:show|tell|display|view|list|what\s+did\s+i\s+spend|how\s+much\s+did\s+i\s+spend)\b/i.test(cleaned) &&
    hasExpenseNoun
  ) {
    const isToday = /\b(today|today's)\b/i.test(cleaned);
    const isYesterday = /\b(yesterday|yesterday's)\b/i.test(cleaned);
    const allExpenses = Storage.getExpenses();
    const todayStr = getTodayDateString();

    let targetExpenses = allExpenses;
    let periodLabel = 'total';
    if (isToday) {
      targetExpenses = allExpenses.filter((e) => !e.date || e.date === todayStr);
      periodLabel = 'today';
    } else if (isYesterday) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yestStr = yesterday.toISOString().split('T')[0];
      targetExpenses = allExpenses.filter((e) => e.date === yestStr);
      periodLabel = 'yesterday';
    }

    const totalSpent = targetExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const explanation =
      targetExpenses.length === 0
        ? `You have no recorded expenses for ${periodLabel}.`
        : `You recorded ${targetExpenses.length} expense(s) for ${periodLabel}, totaling ₹${totalSpent.toLocaleString()}.`;

    return {
      intent: 'EXPENSE_VIEW',
      entity: 'expense',
      confidence: 'high',
      scope: isToday ? 'today' : isYesterday ? 'yesterday' : 'all',
      actions: [
        {
          type: 'navigate_view',
          params: { view: 'expenses' },
          description: 'Open expenses workspace',
        },
      ],
      requiresConfirmation: false,
      matchedEntities: targetExpenses,
      explanation,
    };
  }

  // Task View Routing: "Show my tasks", "Show tasks"
  if (/^(?:show|tell|display|view|list)\b/i.test(cleaned) && hasTaskNoun) {
    return {
      intent: 'TASK_VIEW',
      entity: 'task',
      confidence: 'high',
      scope: 'all',
      actions: [
        {
          type: 'navigate_view',
          params: { view: 'tasks' },
          description: 'Open tasks view',
        },
      ],
      requiresConfirmation: false,
      explanation: 'Opening your tasks workspace.',
    };
  }

  const navMatch = cleaned.match(
    /^(?:go\s+to|open|show|switch\s+to|navigate\s+to)\s+(?:the\s+|my\s+)?(todos?|tasks?|expenses?|budget|spendings?|habits?|journal|diary|notes?|analytics|stats|schedule|timeline|vault|settings|home|dashboard|quotes?|doodle|exams?)$/i
  );
  if (navMatch && navMatch[1]) {
    const rawTarget = navMatch[1].toLowerCase();
    let view = 'home';
    if (/^(?:todo|todos|task|tasks)$/.test(rawTarget)) view = 'tasks';
    else if (/^(?:expense|expenses|budget|spending|spendings)$/.test(rawTarget)) view = 'expenses';
    else if (/^(?:habit|habits)$/.test(rawTarget)) view = 'habits';
    else if (/^(?:journal|diary|note|notes)$/.test(rawTarget)) view = 'diary';
    else if (/^(?:schedule|timeline)$/.test(rawTarget)) view = 'timeline';
    else if (/^(?:vault)$/.test(rawTarget)) view = 'vault';
    else if (/^(?:quotes?)$/.test(rawTarget)) view = 'quotes';
    else if (/^(?:exams?)$/.test(rawTarget)) view = 'exams';
    else if (/^(?:settings)$/.test(rawTarget)) view = 'settings';
    else if (/^(?:analytics|stats)$/.test(rawTarget)) view = 'analytics';
    else if (/^(?:dashboard)$/.test(rawTarget)) view = 'dashboard';
    else if (/^(?:home)$/.test(rawTarget)) view = 'home';

    const actions: ExecutableAction[] = [
      {
        type: 'navigate_view',
        params: { view },
        description: `Navigate to ${view} view`,
      },
    ];
    return {
      intent: 'NAVIGATE_VIEW',
      entity: 'view',
      confidence: 'high',
      scope: 'single',
      actions,
      requiresConfirmation: false,
      explanation: `Switching to ${view} workspace.`,
    };
  }

  // --------------------------------------------------------------------------
  // G. FALLBACK & AMBIGUOUS INTENT
  // Never default blindly to CREATE_TASK!
  // --------------------------------------------------------------------------
  return {
    intent: 'UNKNOWN_INTENT',
    entity: 'unknown',
    confidence: 'low',
    scope: 'unknown',
    actions: [],
    requiresConfirmation: false,
    clarificationPrompt: 'I want to make sure I take the right action. Could you please specify whether you want to manage tasks, habits, expenses, or navigation?',
  };
}

// ============================================================================
// 6. ROGUE ACTION SAFEGUARD & ANTI-HALLUCINATION INTERCEPTOR
// ============================================================================

/**
 * Checks whether an incoming model tool call is a "rogue" task creation:
 * e.g., the model calls `createTask` with a title like "Delete all the spendings I did today"
 * or "Check both my habits as done", or creates tasks from conversational AI chatter.
 */
export function isRogueTaskCreation(
  toolNameOrText: string,
  args?: any,
  rawUserPrompt?: string
): boolean {
  // If called directly with a title or text (e.g. in test assertions or guards)
  if (args === undefined && rawUserPrompt === undefined) {
    const text = String(toolNameOrText || '').trim().toLowerCase();
    if (/^(?:sure|here is|i have updated|as an ai|certainly|hello|you're welcome|good morning|thank you)\b/i.test(text)) {
      return true;
    }
    // Read / query commands must never be treated as task creations
    if (/^(?:show|tell|what|which|how\s+much|how\s+many|check|view|display|list|give\s+me)\b/i.test(text)) {
      if (!/^(?:create\s+(?:a\s+)?(?:new\s+)?task|add\s+task|new\s+task|remind\s+me)\b/i.test(text)) {
        return true;
      }
    }
    if (/^(?:delete|remove|clear|erase|cancel|wipe|drop|discard|purge)\s+/i.test(text)) {
      if (!/^(?:create\s+(?:a\s+)?(?:new\s+)?task|add\s+task|new\s+task|remind\s+me)\b/i.test(text)) {
        return true;
      }
    }
    if (/\b(?:habit|habits|streak|routine)\b/i.test(text) && /\b(?:check|mark|done|complete|toggle|finish)\b/i.test(text)) {
      if (!/^(?:create\s+(?:a\s+)?(?:new\s+)?task|add\s+task|new\s+task|remind\s+me)\b/i.test(text)) {
        return true;
      }
    }
    if (/\b(?:spending|spendings|expense|expenses|transaction|transactions|spent|spend)\b/i.test(text)) {
      if (!/^(?:create\s+(?:a\s+)?(?:new\s+)?task|add\s+task|new\s+task|remind\s+me)\b/i.test(text)) {
        return true;
      }
    }
    return false;
  }

  const toolName = toolNameOrText;
  if (toolName !== 'createTask' && toolName !== 'add_task') {
    return false;
  }

  const title = String(args?.title || '').trim().toLowerCase();
  const prompt = String(rawUserPrompt || '').trim().toLowerCase();

  // If prompt explicitly ordered task creation: e.g. "Create a task called Delete my old expenses"
  if (prompt && /^(?:create|add|make|schedule)\s+(?:a\s+)?(?:new\s+)?task\s+(?:called|named|titled)?/i.test(prompt)) {
    return false;
  }

  // Conversational AI explanations or greetings passed as task title
  if (/^(?:sure|here is|i have updated|as an ai|certainly|hello|you're welcome|good morning|thank you)\b/i.test(title)) {
    return true;
  }

  // 1. Read / Query commands passed as task title or prompt
  if (/^(?:show|tell|what|which|how\s+much|how\s+many|view|display|list|give\s+me)\b/i.test(title)) {
    return true;
  }
  if (prompt && /^(?:show|tell|what|which|how\s+much|how\s+many|view|display|list|give\s+me)\b/i.test(prompt)) {
    return true;
  }

  // 2. Title contains deletion words
  if (/^(?:delete|remove|clear|erase|cancel|wipe|drop|discard|purge)\s+/i.test(title)) {
    return true;
  }

  // 3. Title mentions habit completion
  if (/\b(?:habit|habits|streak|routine)\b/i.test(title) && /\b(?:check|mark|done|complete|toggle|finish)\b/i.test(title)) {
    return true;
  }

  // 4. Title mentions spending / expenses
  if (/\b(?:spending|spendings|expense|expenses|transaction|transactions|spent|spend)\b/i.test(title)) {
    return true;
  }

  // 5. Original prompt was clearly a deletion or habit command
  if (prompt) {
    if (/\b(delete|remove|clear)\s+(?:all\s+)?(?:the\s+)?(?:spending|spendings|expense|expenses)/i.test(prompt)) {
      return true;
    }
    if (/\b(check|mark|complete)\s+(?:both|all|my)\s+habits?/i.test(prompt)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// 7. MULTI-ACTION EXECUTOR & VERIFICATION ENGINE
// ============================================================================

export async function executeCommandDecision(
  decision: CommandDecision
): Promise<ExecutionResult> {
  // If action is blocked by a locked atomic pending state
  if (decision.intent === 'BLOCKED_BY_PENDING') {
    return {
      success: false,
      status: 'AWAITING_CONFIRMATION',
      message:
        decision.explanation ||
        'Action blocked: A pending transaction is locked awaiting your approval or cancellation.',
      executedActions: [],
      options: decision.options,
    };
  }

  // If the decision requires confirmation and wasn't yet confirmed, save it in session
  if (decision.requiresConfirmation) {
    setPendingCommandDecision(decision);
    return {
      success: true,
      status: 'AWAITING_CONFIRMATION',
      message:
        decision.confirmationPrompt ||
        decision.clarificationPrompt ||
        'Please confirm to proceed.',
      executedActions: [],
      options: decision.options,
    };
  }

  // If there are no actions to run
  if (!decision.actions || decision.actions.length === 0) {
    clearPendingCommandDecision();
    return {
      success: true,
      status: decision.intent === 'UNKNOWN_INTENT' || decision.explanation?.includes('No') ? 'NO_MATCH' : 'SUCCESS',
      message: decision.explanation || 'No actions required.',
      executedActions: [],
      options: decision.options,
    };
  }

  const handlers = getRegisteredHandlers();
  const executedActions: ExecutableAction[] = [];
  const actionChips: string[] = [];
  const messages: string[] = [];

  for (const action of decision.actions) {
    try {
      switch (action.type) {
        // --------------------------------------------------------------------
        // EXPENSE ACTIONS
        // --------------------------------------------------------------------
        case 'delete_expense': {
          const current = Storage.getExpenses();
          const targetIds: string[] = Array.isArray(action.params.ids)
            ? action.params.ids
            : action.params.id
            ? [action.params.id]
            : action.targetId
            ? [action.targetId]
            : [];

          let toRemove: ExpenseItem[] = [];

          if (targetIds.length > 0) {
            const idSet = new Set(targetIds);
            toRemove = current.filter((e) => idSet.has(e.id));
          } else if (action.params.date === 'today') {
            toRemove = current.filter((e) => matchesDate(e.date, 'today'));
          } else if (action.params.latest) {
            toRemove = current.length > 0 ? [current[0]] : [];
          }

          if (toRemove.length > 0) {
            const removeIds = new Set(toRemove.map((e) => e.id));
            const updated = current.filter((e) => !removeIds.has(e.id));
            Storage.setExpenses(updated);
            broadcastDataChanged('expenses');

            // VERIFICATION: Check that items were actually removed from storage
            const verified = Storage.getExpenses();
            const allGone = toRemove.every((r) => !verified.some((v) => v.id === r.id));

            if (allGone) {
              executedActions.push(action);
              const chip =
                toRemove.length === 1
                  ? `✓ Removed: "${toRemove[0].name}" (₹${toRemove[0].amount})`
                  : `✓ Deleted ${toRemove.length} Expenses`;
              actionChips.push(chip);
              messages.push(
                toRemove.length === 1
                  ? `Deleted expense "${toRemove[0].name}" (₹${toRemove[0].amount}).`
                  : `Deleted ${toRemove.length} expenses totaling ₹${toRemove
                      .reduce((s, e) => s + (Number(e.amount) || 0), 0)
                      .toLocaleString()}.`
              );
            }
          }
          break;
        }

        case 'clear_all_expenses': {
          const current = Storage.getExpenses();
          const count = current.length;
          Storage.setExpenses([]);
          broadcastDataChanged('expenses');
          executedActions.push(action);
          actionChips.push(`✓ Cleared ${count} Expenses`);
          messages.push(`All ${count} expenses have been removed from your dashboard.`);
          break;
        }

        case 'add_expense': {
          const newExp: ExpenseItem = {
            id: 'exp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            name: action.params.name,
            amount: Number(action.params.amount) || 0,
            category: action.params.category || 'General',
            date: action.params.date || getTodayDateString(),
          };
          const current = Storage.getExpenses();
          Storage.setExpenses([newExp, ...current]);
          broadcastDataChanged('expenses');
          executedActions.push(action);
          actionChips.push(`✓ Expense: ₹${newExp.amount} for "${newExp.name}"`);
          messages.push(`Logged expense of ₹${newExp.amount} for "${newExp.name}".`);
          break;
        }

        // --------------------------------------------------------------------
        // HABIT ACTIONS
        // --------------------------------------------------------------------
        case 'toggle_habit': {
          const current = Storage.getHabits();
          const index = current.findIndex(
            (h) => h.id === action.params.id || h.id === action.targetId
          );
          if (index !== -1) {
            const habit = { ...current[index] };
            const dayIdx =
              typeof action.params.dayIndex === 'number'
                ? action.params.dayIndex
                : getTodayDayIndex();
            const updatedDays = [...(habit.completedDays || [false, false, false, false, false, false, false])];

            if (action.params.forceComplete) {
              if (!updatedDays[dayIdx]) {
                updatedDays[dayIdx] = true;
                habit.streak = (habit.streak || 0) + 1;
              }
            } else {
              updatedDays[dayIdx] = !updatedDays[dayIdx];
              habit.streak = updatedDays[dayIdx]
                ? (habit.streak || 0) + 1
                : Math.max(0, (habit.streak || 0) - 1);
            }

            habit.completedDays = updatedDays;
            current[index] = habit;
            Storage.setHabits([...current]);
            broadcastDataChanged('habits');
            handlers.onToggleHabit?.(habit.id, dayIdx);

            executedActions.push(action);
            actionChips.push(`✓ Habit Done: "${habit.title}"`);
            messages.push(`Completed habit "${habit.title}" for today.`);
          }
          break;
        }

        case 'delete_habit': {
          const current = Storage.getHabits();
          const targetId = action.params?.id || action.targetId;
          const updated = current.filter((h) => h.id !== targetId);
          Storage.setHabits(updated);
          broadcastDataChanged('habits');
          executedActions.push(action);
          actionChips.push(`✓ Removed Habit: "${action.targetTitle || 'Habit'}"`);
          messages.push(`Removed habit "${action.targetTitle || 'Habit'}".`);
          break;
        }

        case 'add_habit': {
          const current = Storage.getHabits();
          const title = action.params?.name || action.params?.title || 'New Habit';
          const newHabit: HabitItem = {
            id: 'habit-' + Date.now(),
            title,
            category: action.params?.category || 'General',
            icon: 'Target',
            color: '#10B981',
            streak: 0,
            completedDays: [false, false, false, false, false, false, false],
          };
          Storage.setHabits([...current, newHabit]);
          broadcastDataChanged('habits');
          executedActions.push(action);
          actionChips.push(`✓ Added Habit: "${title}"`);
          messages.push(`Added habit "${title}".`);
          break;
        }

        // --------------------------------------------------------------------
        // TASK ACTIONS
        // --------------------------------------------------------------------
        case 'add_task': {
          const title = action.params.title || action.targetTitle || 'New Task';
          const priority: Priority = action.params.priority || 'medium';
          const category = action.params.category || 'Personal';
          const dueDate = action.params.dueDate || '';

          if (handlers.onAddTodo) {
            handlers.onAddTodo(title, priority, category, dueDate, 'todo');
          } else {
            const newTask: TodoItem = {
              id: 'todo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              title,
              completed: false,
              status: 'todo',
              priority,
              category,
              dueDate,
              createdAt: Date.now(),
            };
            const current = Storage.getTodos();
            Storage.setTodos([newTask, ...current]);
            broadcastDataChanged('tasks');
          }
          executedActions.push(action);
          actionChips.push(`✓ Task Added: "${title}"`);
          messages.push(`Added task "${title}" to your tasks.`);
          break;
        }

        case 'update_task': {
          const current = Storage.getTodos();
          const targetId = action.params.id || action.targetId;
          const index = current.findIndex((t) => t.id === targetId);
          if (index !== -1) {
            const task = { ...current[index] };
            if (typeof action.params.completed === 'boolean') {
              task.completed = action.params.completed;
              task.status = action.params.completed ? 'complete' : 'todo';
            }
            current[index] = task;
            Storage.setTodos([...current]);
            broadcastDataChanged('tasks');
            handlers.onToggleTodo?.(task.id);
            executedActions.push(action);
            actionChips.push(`✓ Completed: "${task.title}"`);
            messages.push(`Completed task "${task.title}".`);
          }
          break;
        }

        case 'delete_task': {
          const current = Storage.getTodos();
          const targetId = action.params.id || action.targetId;
          const toRemove = current.filter((t) => t.id === targetId);
          if (toRemove.length > 0) {
            const updated = current.filter((t) => t.id !== targetId);
            Storage.setTodos(updated);
            broadcastDataChanged('tasks');
            executedActions.push(action);
            actionChips.push(`✓ Removed Task: "${toRemove[0].title}"`);
            messages.push(`Removed task "${toRemove[0].title}".`);
          }
          break;
        }

        case 'clear_all_tasks': {
          const current = Storage.getTodos();
          let remaining: TodoItem[] = [];
          if (action.params.completedOnly) {
            remaining = current.filter((t) => !t.completed);
          }
          Storage.setTodos(remaining);
          broadcastDataChanged('tasks');
          executedActions.push(action);
          actionChips.push(
            action.params.completedOnly
              ? `✓ Cleared Completed Tasks`
              : `✓ Cleared All Tasks`
          );
          messages.push(
            action.params.completedOnly
              ? 'Cleared all completed tasks.'
              : 'Cleared all tasks from your dashboard.'
          );
          break;
        }

        // --------------------------------------------------------------------
        // NAVIGATION ACTIONS
        // --------------------------------------------------------------------
        case 'navigate_view': {
          const view = action.params.view || 'home';
          if (handlers.onNavigate) {
            handlers.onNavigate(view);
          }
          executedActions.push(action);
          actionChips.push(`⚡ View: ${view}`);
          messages.push(`Switched to ${view} workspace.`);
          break;
        }

        default:
          console.warn('Unknown executable action type:', action.type);
          break;
      }
    } catch (err: any) {
      console.error('Error executing action:', action, err);
    }
  }

  clearPendingCommandDecision();

  const success = executedActions.length > 0;
  const finalMessage =
    messages.length > 0
      ? messages.join('\n')
      : success
      ? 'Action completed successfully.'
      : 'No changes were made.';

  return {
    success,
    status: success ? 'SUCCESS' : 'ERROR',
    message: finalMessage,
    actionChips,
    executedActions,
  };
}

export async function executeInteractiveOption(
  option: InteractiveOption
): Promise<ExecutionResult> {
  if (!option.actions || option.actions.length === 0) {
    clearPendingCommandDecision();
    return {
      success: true,
      status: 'CANCELLED',
      message: 'Action cancelled. No changes were made.',
      executedActions: [],
    };
  }

  const decision: CommandDecision = {
    intent: 'CONFIRM_PENDING',
    entity: 'pending',
    confidence: 'high',
    scope: 'multiple',
    actions: option.actions,
    requiresConfirmation: false,
  };

  return await executeCommandDecision(decision);
}
