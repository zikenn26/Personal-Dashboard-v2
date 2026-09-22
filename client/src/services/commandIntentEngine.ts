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
}

export interface ExecutionResult {
  success: boolean;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'NO_MATCH' | 'ERROR' | 'AWAITING_CONFIRMATION' | 'CANCELLED';
  message: string;
  actionChips?: string[];
  executedActions: ExecutableAction[];
  options?: InteractiveOption[];
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

export function analyzeCommandIntent(rawInput: string): CommandDecision {
  const text = (rawInput || '').trim();
  const lower = text.toLowerCase();

  // Strip conversational wrappers
  const cleaned = lower
    .replace(/^[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+/, '')
    .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
    .replace(/^(?:hey\s+)?(?:zikenn|gemini|assistant|there)?\s*/i, '')
    .replace(/^(?:please\s+|can\s+you\s+|could\s+you\s+|kindly\s+|i\s+want\s+to\s+|i\s+need\s+to\s+|let's\s+|just\s+)+/i, '')
    .trim();

  // --------------------------------------------------------------------------
  // A. Check for Confirmation of Pending Action (e.g. "yes", "confirm", "delete them")
  // --------------------------------------------------------------------------
  const pending = getPendingCommandDecision();
  if (pending) {
    const isAffirmative =
      /^(?:yes|yep|yeah|sure|confirm|do\s+it|proceed|go\s+ahead|delete\s+(?:them|all|it)|ok|okay|continue)\b/i.test(cleaned);
    const isNegative =
      /^(?:no|nope|cancel|stop|don't|dont|abort|nevermind|never\s+mind)\b/i.test(cleaned);

    if (isAffirmative) {
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
  }

  // --------------------------------------------------------------------------
  // B. EXPENSES / SPENDINGS: DELETION INTENT
  // Keywords: delete, remove, clear, erase, cancel, wipe, drop, discard
  // Combined with: spending, spendings, expense, expenses, money, transaction, cost, paid
  // --------------------------------------------------------------------------
  const hasDeleteVerb = /\b(delete|remove|clear|erase|cancel|wipe|drop|discard|purge|trash)\b/i.test(cleaned);
  const hasExpenseNoun = /\b(spending|spendings|expense|expenses|transaction|transactions|cost|costs|money|spent|paid|purchase|purchases|bill|bills)\b/i.test(cleaned);

  if (hasDeleteVerb && hasExpenseNoun) {
    const allExpenses = Storage.getExpenses();
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
    const keyword = cleaned
      .replace(/\b(delete|remove|clear|erase|cancel|wipe|drop|discard)\s+/i, '')
      .replace(/\b(the|my|an|a|all|recent|last|latest)\s+/i, '')
      .replace(/\b(spending|spendings|expense|expenses|transaction|cost|bill|payment|money|paid)\s+(?:for|of|called|titled|on)?\s*/i, '')
      .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
      .trim();

    if (keyword) {
      const matched = allExpenses.filter(
        (e) =>
          e.name.toLowerCase().includes(keyword) ||
          (e.category && e.category.toLowerCase().includes(keyword))
      );

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
          actions: [],
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
  // C. HABITS: COMPLETION / TOGGLE / MULTI-HABIT INTENT
  // Keywords: check, mark, complete, finish, done, toggle
  // Combined with: habit, habits, routine, routines, streak
  // --------------------------------------------------------------------------
  const hasHabitCompletionVerb = /\b(check|mark|complete|finish|done|toggle)\b/i.test(cleaned);
  const hasHabitNoun = /\b(habit|habits|routine|routines|daily|momentum)\b/i.test(cleaned);

  if (hasHabitCompletionVerb && hasHabitNoun) {
    const allHabits = Storage.getHabits();
    const todayIdx = getTodayDayIndex();
    const isBoth = /\b(both|2)\b/i.test(cleaned);
    const isAll = /\b(all|every|each)\b/i.test(cleaned);

    if (allHabits.length === 0) {
      return {
        intent: 'HABIT_COMPLETE',
        entity: 'habit',
        confidence: 'high',
        scope: 'all',
        actions: [],
        requiresConfirmation: false,
        explanation: 'You currently have no habits configured on your dashboard.',
      };
    }

    // 1. "Check both my habits as done" / "Mark both habits done"
    if (isBoth) {
      // If there are exactly 2 habits, target both cleanly!
      // If there are >2 habits, target the first 2 uncompleted ones or the first 2 habits
      const targets =
        allHabits.length === 2
          ? allHabits
          : allHabits.filter((h) => !h.completedDays?.[todayIdx]).slice(0, 2);

      const resolvedTargets = targets.length > 0 ? targets : allHabits.slice(0, 2);
      const actions: ExecutableAction[] = resolvedTargets.map((h) => ({
        type: 'toggle_habit',
        targetId: h.id,
        targetTitle: h.title,
        params: { id: h.id, dayIndex: todayIdx, forceComplete: true, both: true },
        description: `Check off habit "${h.title}" for today`,
      }));

      return {
        intent: 'HABIT_COMPLETE',
        entity: 'habit',
        confidence: 'high',
        scope: 'multiple',
        actions,
        requiresConfirmation: false,
        matchedEntities: resolvedTargets,
        explanation: `Checking off ${resolvedTargets.map((h) => `"${h.title}"`).join(' and ')} as done for today.`,
      };
    }

    // 2. "Check all my habits as done" / "Complete all habits"
    if (isAll) {
      const actions: ExecutableAction[] = allHabits.map((h) => ({
        type: 'toggle_habit',
        targetId: h.id,
        targetTitle: h.title,
        params: { id: h.id, dayIndex: todayIdx, forceComplete: true },
        description: `Check off habit "${h.title}" for today`,
      }));

      return {
        intent: 'HABIT_COMPLETE',
        entity: 'habit',
        confidence: 'high',
        scope: 'all',
        actions,
        requiresConfirmation: false,
        matchedEntities: allHabits,
        explanation: `Checking off all ${allHabits.length} habits for today.`,
      };
    }

    // 3. Specific habit by name: "Check habit meditation as done", "Mark reading as done"
    const habitName = cleaned
      .replace(/\b(check|mark|complete|finish|done|toggle)\s+/i, '')
      .replace(/\b(the|my|a|an)\s+/i, '')
      .replace(/\b(habit|routine)\s+(?:called|titled|:\s*)?/i, '')
      .replace(/\b(?:as\s+)?(?:done|complete|completed|finished)\b/i, '')
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
            params: { id: target.id, dayIndex: todayIdx, forceComplete: true },
            description: `Check off habit "${target.title}" for today`,
          },
        ];
        return {
          intent: 'HABIT_COMPLETE',
          entity: 'habit',
          confidence: 'high',
          scope: 'single',
          actions,
          requiresConfirmation: false,
          matchedEntities: [target],
          explanation: `Marking habit "${target.title}" as completed for today.`,
        };
      }
    }

    // Fallback: If user just said "Check my habits done" without specific names
    const uncompleted = allHabits.filter((h) => !h.completedDays?.[todayIdx]);
    const targetHabits = uncompleted.length > 0 ? uncompleted : allHabits;
    const actions: ExecutableAction[] = targetHabits.map((h) => ({
      type: 'toggle_habit',
      targetId: h.id,
      targetTitle: h.title,
      params: { id: h.id, dayIndex: todayIdx, forceComplete: true },
      description: `Check off habit "${h.title}" for today`,
    }));

    return {
      intent: 'HABIT_COMPLETE',
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
  // 1. Task Deletion: "Delete task buy milk", "Clear all tasks", "Remove completed tasks"
  const hasTaskNoun = /\b(task|tasks|todo|todos|to-do|to-dos|errand|errands)\b/i.test(cleaned);
  if (hasDeleteVerb && hasTaskNoun) {
    const allTodos = Storage.getTodos();
    const isAll = /\b(all|everything|every)\b/i.test(cleaned);
    const isCompletedOnly = /\b(completed|done|finished)\b/i.test(cleaned);

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

  // 2. Task Completion: "Complete task report", "Mark task gym as done", "Finish groceries"
  const hasTaskCompletionVerb = /\b(complete|finish|done|check\s+off|mark\s+(?:as\s+)?done)\b/i.test(cleaned);
  if (hasTaskCompletionVerb && (hasTaskNoun || !hasHabitNoun)) {
    const allTodos = Storage.getTodos();
    const query = cleaned
      .replace(/\b(complete|finish|done|check\s+off|mark\s+(?:as\s+)?done)\s+/i, '')
      .replace(/\b(the|my|a|an)\s+/i, '')
      .replace(/\b(task|todo|to-do)\s+(?:called|titled|:\s*)?/i, '')
      .trim();

    if (query) {
      const pendingTasks = allTodos.filter((t) => !t.completed);
      const matched = pendingTasks.filter((t) => t.title.toLowerCase().includes(query));
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

  // 3. Task Creation: "Add task buy milk", "Remind me to call mom", "New task: study"
  const isTaskCreation =
    /^(?:add|create|make|schedule|put|insert)\s+(?:a\s+)?(?:new\s+)?(?:task|todo|to-do|item)\b/i.test(cleaned) ||
    /^(?:remind me to|remember to|don't forget to|dont forget to)\s+/i.test(cleaned) ||
    /^(?:new\s+task|task\s*:)\s*/i.test(cleaned) ||
    /^(?:add|create)\s+.+?\s+(?:to\s+|in\s+|into\s+)(?:my\s+)?(?:tasks?|todos?|task\s+list)$/i.test(cleaned);

  // CRITICAL SAFEGUARD: Never treat deletion, habit completion, or expense logging as task creation!
  const containsDestructivePhrase = hasDeleteVerb;
  const containsHabitAction = hasHabitNoun && hasHabitCompletionVerb;
  const containsExpenseAction = hasExpenseNoun;

  if (isTaskCreation && !containsDestructivePhrase && !containsHabitAction && !containsExpenseAction) {
    let title = cleaned
      .replace(/^(?:add|create|make|schedule|put|insert)\s+(?:a\s+)?(?:new\s+)?(?:task|todo|to-do|item)\s*(?:called|titled|to|for|:\s*)?/i, '')
      .replace(/^(?:remind me to|remember to|don't forget to|dont forget to)\s*/i, '')
      .replace(/^(?:new\s+task|task\s*:)\s*/i, '')
      .replace(/\s+(?:to\s+|in\s+|into\s+)(?:my\s+)?(?:tasks?|todos?|task\s+list)$/i, '')
      .trim();

    if (!title) title = 'New Task';
    title = title.charAt(0).toUpperCase() + title.slice(1);

    let priority: Priority = 'medium';
    if (/\b(urgent|critical|high priority|asap)\b/i.test(cleaned)) priority = 'high';
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
    /^(?:spent|spend|paid)\s+/i.test(cleaned) ||
    /^(?:add|log|record|enter|track)\s+(?:an?\s+)?(?:new\s+)?(?:expense|spending|cost|bill)\b/i.test(cleaned) ||
    /^(?:add|log|record)\s+(?:rs\.?|inr|₹)?\s*\d+/i.test(cleaned);

  if (isExpenseCreation && !hasDeleteVerb) {
    const amountMatch = cleaned.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:rs|rupees|inr|bucks)?/i);
    const amount = amountMatch && amountMatch[1] ? parseFloat(amountMatch[1]) : 100;

    let expName = cleaned
      .replace(/^(?:spent|spend|paid)\s+(?:rs\.?|inr|₹)?\s*\d+(?:\.\d+)?\s*(?:rs|rupees|inr|bucks)?\s*(?:for|on|towards|called)?\s*/i, '')
      .replace(/^(?:add|log|record|enter|track)\s+(?:an?\s+)?(?:new\s+)?(?:expense|spending|cost)?\s*(?:of\s+)?(?:rs\.?|inr|₹)?\s*\d+(?:\.\d+)?\s*(?:rs|rupees|inr|bucks)?\s*(?:for|on|towards|called)?\s*/i, '')
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
  // F. NAVIGATION INTENTS: "Go to expenses", "Open tasks", "Show habits"
  // --------------------------------------------------------------------------
  const navMatch = cleaned.match(
    /^(?:go\s+to|open|show|switch\s+to|navigate\s+to)\s+(?:the\s+)?(todos?|tasks?|expenses?|budget|spendings?|habits?|journal|diary|notes?|analytics|stats|schedule|timeline|vault|settings|home|dashboard|quotes?|doodle|exams?)$/i
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
    else if (/^(?:home|dashboard)$/.test(rawTarget)) view = 'home';

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
 * or "Check both my habits as done".
 */
export function isRogueTaskCreation(
  toolName: string,
  args: any,
  rawUserPrompt?: string
): boolean {
  if (toolName !== 'createTask' && toolName !== 'add_task') {
    return false;
  }

  const title = String(args?.title || '').trim().toLowerCase();
  const prompt = String(rawUserPrompt || '').trim().toLowerCase();

  // 1. Title contains deletion words
  if (/^(?:delete|remove|clear|erase|cancel|wipe|drop|discard|purge)\s+/i.test(title)) {
    return true;
  }

  // 2. Title mentions habit completion
  if (/\b(?:habit|habits|streak|routine)\b/i.test(title) && /\b(?:check|mark|done|complete|toggle|finish)\b/i.test(title)) {
    return true;
  }

  // 3. Title mentions spending / expenses
  if (/\b(?:spending|spendings|expense|expenses|transaction|transactions)\b/i.test(title)) {
    return true;
  }

  // 4. Original prompt was clearly a deletion or habit command
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
      status: decision.explanation?.includes('No') ? 'NO_MATCH' : 'SUCCESS',
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
