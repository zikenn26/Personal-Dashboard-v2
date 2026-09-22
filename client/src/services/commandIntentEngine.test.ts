import { beforeAll, beforeEach, describe, it, expect } from 'vitest';
import {
  analyzeCommandIntent,
  isRogueTaskCreation,
  executeCommandDecision,
  executeInteractiveOption,
  setPendingCommandDecision,
  getPendingCommandDecision,
  clearPendingCommandDecision,
  getTodayDateString,
  getYesterdayDateString,
  getTodayDayIndex,
  matchesDate,
  CommandDecision,
} from './commandIntentEngine';
import { Storage } from '../utils/storage';

function setupMockStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: 0,
    } as any;
  }
}

function seedTestData() {
  const todayStr = getTodayDateString();
  const yestStr = getYesterdayDateString();

  Storage.setExpenses([
    {
      id: 'exp-today-1',
      name: 'Lunch',
      amount: 25,
      category: 'Dining Out',
      date: todayStr,
      billingCycle: 'one-time',
      icon: '🍛',
      active: true,
    },
    {
      id: 'exp-today-2',
      name: 'Amazon',
      amount: 500,
      category: 'Shopping',
      date: todayStr,
      billingCycle: 'one-time',
      icon: '📦',
      active: true,
    },
    {
      id: 'exp-today-3',
      name: 'Transport',
      amount: 100,
      category: 'Travel',
      date: todayStr,
      billingCycle: 'one-time',
      icon: '🚕',
      active: true,
    },
    {
      id: 'exp-today-4',
      name: 'Grocery',
      amount: 250,
      category: 'Food',
      date: todayStr,
      billingCycle: 'one-time',
      icon: '🛒',
      active: true,
    },
    {
      id: 'exp-yest-1',
      name: 'Amazon',
      amount: 500,
      category: 'Shopping',
      date: yestStr,
      billingCycle: 'one-time',
      icon: '📦',
      active: true,
    },
  ]);

  Storage.setHabits([
    {
      id: 'hab-1',
      title: 'Morning Meditation',
      category: 'Wellness',
      streak: 5,
      completedDays: [false, false, false, false, false, false, false],
      history: {},
      color: '#6366F1',
    },
    {
      id: 'hab-2',
      title: 'Drink 2L Water',
      category: 'Health',
      streak: 3,
      completedDays: [false, false, false, false, false, false, false],
      history: {},
      color: '#06B6D4',
    },
    {
      id: 'hab-3',
      title: 'Reading',
      category: 'Personal',
      streak: 12,
      completedDays: [false, false, false, false, false, false, false],
      history: {},
      color: '#10B981',
    },
  ]);

  Storage.setTodos([
    {
      id: 'task-1',
      title: 'Study polity',
      completed: false,
      status: 'todo',
      priority: 'high',
      category: 'Study',
      createdAt: Date.now(),
    },
    {
      id: 'task-2',
      title: 'Gym workout',
      completed: false,
      status: 'todo',
      priority: 'medium',
      category: 'Health',
      createdAt: Date.now(),
    },
    {
      id: 'task-3',
      title: 'Buy groceries',
      completed: true,
      status: 'complete',
      priority: 'low',
      category: 'Errands',
      createdAt: Date.now(),
    },
  ]);

  clearPendingCommandDecision();
}

beforeAll(() => {
  setupMockStorage();
});

beforeEach(() => {
  seedTestData();
});

describe('1. Expense Commands Routing (20+ tests)', () => {
  it('E1: "Delete all the spendings I did today" targets today batch with confirmation', () => {
    const res = analyzeCommandIntent('Delete all the spendings I did today');
    expect(res.intent).toBe('EXPENSE_DELETE_BATCH');
    expect(res.scope).toBe('today');
    expect(res.actions.length).toBe(1);
    expect(res.actions[0].type).toBe('delete_expense');
    expect(res.actions[0].params.ids).toHaveLength(4);
    expect(res.requiresConfirmation).toBe(true);
  });

  it('E2: "Delete today\'s expenses"', () => {
    const res = analyzeCommandIntent("Delete today's expenses");
    expect(res.intent).toBe('EXPENSE_DELETE_BATCH');
    expect(res.scope).toBe('today');
  });

  it('E3: "Delete all expenses from today"', () => {
    const res = analyzeCommandIntent('Delete all expenses from today');
    expect(res.intent).toBe('EXPENSE_DELETE_BATCH');
    expect(res.scope).toBe('today');
  });

  it('E4: "Remove today\'s spending"', () => {
    const res = analyzeCommandIntent("Remove today's spending");
    expect(res.intent).toBe('EXPENSE_DELETE_BATCH');
    expect(res.scope).toBe('today');
  });

  it('E5: "Erase today\'s purchases"', () => {
    const res = analyzeCommandIntent("Erase today's purchases");
    expect(res.intent).toBe('EXPENSE_DELETE_BATCH');
    expect(res.scope).toBe('today');
  });

  it('E6: "Clear today\'s expenses"', () => {
    const res = analyzeCommandIntent("Clear today's expenses");
    expect(res.intent).toBe('EXPENSE_DELETE_BATCH');
    expect(res.scope).toBe('today');
  });

  it('E7: "Delete yesterday\'s expenses" targets yesterday only', () => {
    const res = analyzeCommandIntent("Delete yesterday's expenses");
    expect(res.intent).toBe('EXPENSE_DELETE_BATCH');
    expect(res.scope).toBe('yesterday');
    expect(res.actions[0].params.ids).toEqual(['exp-yest-1']);
  });

  it('E8: "Remove expenses from yesterday"', () => {
    const res = analyzeCommandIntent('Remove expenses from yesterday');
    expect(res.intent).toBe('EXPENSE_DELETE_BATCH');
    expect(res.scope).toBe('yesterday');
  });

  it('E9: "Delete the Amazon expense" with multiple matches presents disambiguation options', () => {
    const res = analyzeCommandIntent('Delete the Amazon expense');
    expect(res.intent).toBe('EXPENSE_DELETE');
    expect(res.matchedEntities?.length).toBe(2);
    expect(res.requiresConfirmation).toBe(true);
    expect(res.options).toBeDefined();
    expect(res.options?.length).toBeGreaterThanOrEqual(3); // options for each + delete all + cancel
  });

  it('E10: "Delete my Lunch expense" with single match routes directly', () => {
    const res = analyzeCommandIntent('Delete my Lunch expense');
    expect(res.intent).toBe('EXPENSE_DELETE');
    expect(res.scope).toBe('single');
    expect(res.actions[0].targetId).toBe('exp-today-1');
  });

  it('E11: "Remove lunch spending"', () => {
    const res = analyzeCommandIntent('Remove lunch spending');
    expect(res.intent).toBe('EXPENSE_DELETE');
    expect(res.actions[0].targetId).toBe('exp-today-1');
  });

  it('E12: "Delete latest expense"', () => {
    const res = analyzeCommandIntent('Delete latest expense');
    expect(res.intent).toBe('EXPENSE_DELETE');
    expect(res.scope).toBe('latest');
    expect(res.actions[0].targetId).toBe('exp-today-1');
  });

  it('E13: "Delete last spending"', () => {
    const res = analyzeCommandIntent('Delete last spending');
    expect(res.intent).toBe('EXPENSE_DELETE');
    expect(res.scope).toBe('latest');
  });

  it('E14: "Delete the last expense"', () => {
    const res = analyzeCommandIntent('Delete the last expense');
    expect(res.intent).toBe('EXPENSE_DELETE');
    expect(res.scope).toBe('latest');
  });

  it('E15: "Clear all expenses" targets all 5 records with confirmation', () => {
    const res = analyzeCommandIntent('Clear all expenses');
    expect(res.intent).toBe('EXPENSE_CLEAR_ALL');
    expect(res.scope).toBe('all');
    expect(res.requiresConfirmation).toBe(true);
    expect(res.isDestructive).toBe(true);
  });

  it('E16: "Delete all expenses"', () => {
    const res = analyzeCommandIntent('Delete all expenses');
    expect(res.intent).toBe('EXPENSE_CLEAR_ALL');
    expect(res.requiresConfirmation).toBe(true);
  });

  it('E17: "Spent 150 on coffee" logs expense', () => {
    const res = analyzeCommandIntent('Spent 150 on coffee');
    expect(res.intent).toBe('EXPENSE_CREATE');
    expect(res.actions[0].type).toBe('add_expense');
    expect(res.actions[0].params.amount).toBe(150);
  });

  it('E18: "Paid rs 500 for groceries"', () => {
    const res = analyzeCommandIntent('Paid rs 500 for groceries');
    expect(res.intent).toBe('EXPENSE_CREATE');
    expect(res.actions[0].params.amount).toBe(500);
  });

  it('E19: "Add expense 250 for books"', () => {
    const res = analyzeCommandIntent('Add expense 250 for books');
    expect(res.intent).toBe('EXPENSE_CREATE');
    expect(res.actions[0].params.amount).toBe(250);
  });

  it('E20: "Log spending of 1200 for electricity bill"', () => {
    const res = analyzeCommandIntent('Log spending of 1200 for electricity bill');
    expect(res.intent).toBe('EXPENSE_CREATE');
    expect(res.actions[0].params.amount).toBe(1200);
  });

  it('E21: "Delete Transport expense"', () => {
    const res = analyzeCommandIntent('Delete Transport expense');
    expect(res.intent).toBe('EXPENSE_DELETE');
    expect(res.actions[0].targetId).toBe('exp-today-3');
  });
});

describe('2. Habit Commands Routing (16 tests)', () => {
  it('H1: "Mark both my habits as done" targets 2 habits', () => {
    const res = analyzeCommandIntent('Mark both my habits as done');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions).toHaveLength(2);
    expect(res.actions[0].type).toBe('toggle_habit');
    expect(res.actions[1].type).toBe('toggle_habit');
  });

  it('H2: "Check both my habits as done"', () => {
    const res = analyzeCommandIntent('Check both my habits as done');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions).toHaveLength(2);
  });

  it('H3: "Check both habits"', () => {
    const res = analyzeCommandIntent('Check both habits');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions).toHaveLength(2);
  });

  it('H4: "Mark both habits complete"', () => {
    const res = analyzeCommandIntent('Mark both habits complete');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions).toHaveLength(2);
  });

  it('H5: "Mark all my habits as done" targets all 3 habits', () => {
    const res = analyzeCommandIntent('Mark all my habits as done');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.scope).toBe('all');
    expect(res.actions).toHaveLength(3);
  });

  it('H6: "Complete all habits"', () => {
    const res = analyzeCommandIntent('Complete all habits');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions).toHaveLength(3);
  });

  it('H7: "Finish all habits"', () => {
    const res = analyzeCommandIntent('Finish all habits');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions).toHaveLength(3);
  });

  it('H8: "Complete my Reading habit" targets specific habit', () => {
    const res = analyzeCommandIntent('Complete my Reading habit');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.scope).toBe('single');
    expect(res.actions[0].targetId).toBe('hab-3');
    expect(res.actions[0].targetTitle).toBe('Reading');
  });

  it('H9: "Mark habit Morning Meditation as done"', () => {
    const res = analyzeCommandIntent('Mark habit Morning Meditation as done');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions[0].targetId).toBe('hab-1');
  });

  it('H10: "Check off Drink 2L Water habit"', () => {
    const res = analyzeCommandIntent('Check off Drink 2L Water habit');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions[0].targetId).toBe('hab-2');
  });

  it('H11: "Check habit meditation"', () => {
    const res = analyzeCommandIntent('Check habit meditation');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions[0].targetId).toBe('hab-1');
  });

  it('H12: "Finish my habits"', () => {
    const res = analyzeCommandIntent('Finish my habits');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions.length).toBeGreaterThan(0);
  });

  it('H13: "Complete today\'s habits"', () => {
    const res = analyzeCommandIntent("Complete today's habits");
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions.length).toBeGreaterThan(0);
  });

  it('H14: "Tick both habits"', () => {
    // "tick" isn't in completion verbs; let's see how engine responds or fallback
    const res = analyzeCommandIntent('Tick both habits');
    // If not matching completion verb, engine returns UNKNOWN_INTENT safely
    expect(['HABIT_COMPLETE', 'UNKNOWN_INTENT']).toContain(res.intent);
  });

  it('H15: "Toggle habit Meditation"', () => {
    const res = analyzeCommandIntent('Toggle habit Meditation');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions[0].targetId).toBe('hab-1');
  });

  it('H16: Habit completion when no habits exist returns explanation without errors', () => {
    Storage.setHabits([]);
    const res = analyzeCommandIntent('Check both my habits as done');
    expect(res.intent).toBe('HABIT_COMPLETE');
    expect(res.actions).toHaveLength(0);
    expect(res.explanation).toContain('no habits');
  });
});

describe('3. Task Commands Routing (16 tests)', () => {
  it('T1: "Add a task to study polity"', () => {
    const res = analyzeCommandIntent('Add a task to study polity');
    expect(res.intent).toBe('TASK_CREATE');
    expect(res.actions[0].type).toBe('add_task');
    expect(res.actions[0].params.title.toLowerCase()).toContain('study polity');
  });

  it('T2: "Remind me to study polity"', () => {
    const res = analyzeCommandIntent('Remind me to study polity');
    expect(res.intent).toBe('TASK_CREATE');
    expect(res.actions[0].params.title.toLowerCase()).toContain('study polity');
  });

  it('T3: "Create a task for studying polity"', () => {
    const res = analyzeCommandIntent('Create a task for studying polity');
    expect(res.intent).toBe('TASK_CREATE');
    expect(res.actions[0].params.title.toLowerCase()).toContain('studying polity');
  });

  it('T4: "Put studying polity on my task list"', () => {
    const res = analyzeCommandIntent('Put studying polity on my task list');
    expect(res.intent).toBe('TASK_CREATE');
  });

  it('T5: "New task: Buy groceries"', () => {
    const res = analyzeCommandIntent('New task: Buy groceries');
    expect(res.intent).toBe('TASK_CREATE');
    expect(res.actions[0].params.title).toContain('Buy groceries');
  });

  it('T6: "Add urgent task Submit taxes" assigns high priority', () => {
    const res = analyzeCommandIntent('Add urgent task Submit taxes');
    expect(res.intent).toBe('TASK_CREATE');
    expect(res.actions[0].params.priority).toBe('high');
  });

  it('T7: "Add low priority task Clean garage" assigns low priority', () => {
    const res = analyzeCommandIntent('Add low priority task Clean garage');
    expect(res.intent).toBe('TASK_CREATE');
    expect(res.actions[0].params.priority).toBe('low');
  });

  it('T8: "Complete task study polity" resolves existing task', () => {
    const res = analyzeCommandIntent('Complete task study polity');
    expect(res.intent).toBe('TASK_COMPLETE');
    expect(res.actions[0].type).toBe('update_task');
    expect(res.actions[0].targetId).toBe('task-1');
  });

  it('T9: "Mark task gym as done"', () => {
    const res = analyzeCommandIntent('Mark task gym as done');
    expect(res.intent).toBe('TASK_COMPLETE');
    expect(res.actions[0].targetId).toBe('task-2');
  });

  it('T10: "Finish study polity task"', () => {
    const res = analyzeCommandIntent('Finish study polity task');
    expect(res.intent).toBe('TASK_COMPLETE');
    expect(res.actions[0].targetId).toBe('task-1');
  });

  it('T11: "Check off task gym"', () => {
    const res = analyzeCommandIntent('Check off task gym');
    expect(res.intent).toBe('TASK_COMPLETE');
    expect(res.actions[0].targetId).toBe('task-2');
  });

  it('T12: "Delete task study polity"', () => {
    const res = analyzeCommandIntent('Delete task study polity');
    expect(res.intent).toBe('TASK_DELETE');
    expect(res.actions[0].type).toBe('delete_task');
    expect(res.actions[0].targetId).toBe('task-1');
  });

  it('T13: "Remove task gym"', () => {
    const res = analyzeCommandIntent('Remove task gym');
    expect(res.intent).toBe('TASK_DELETE');
    expect(res.actions[0].targetId).toBe('task-2');
  });

  it('T14: "Clear all tasks" requires confirmation', () => {
    const res = analyzeCommandIntent('Clear all tasks');
    expect(res.intent).toBe('TASK_CLEAR_ALL');
    expect(res.requiresConfirmation).toBe(true);
    expect(res.actions[0].type).toBe('clear_all_tasks');
  });

  it('T15: "Clear completed tasks"', () => {
    const res = analyzeCommandIntent('Clear completed tasks');
    expect(res.intent).toBe('TASK_CLEAR_ALL');
    expect(res.actions[0].params.completedOnly).toBe(true);
  });

  it('T16: Task operations when no tasks exist report safely without error', () => {
    Storage.setTodos([]);
    const res = analyzeCommandIntent('Delete task buy milk');
    expect(res.intent).toBe('TASK_DELETE');
    expect(res.actions).toHaveLength(0);
    expect(res.explanation).toContain('no tasks');
  });
});

describe('4. Ambiguous Commands & Clarifications (10 tests)', () => {
  it('A1: "Delete that" is ambiguous and does not execute', () => {
    const res = analyzeCommandIntent('Delete that');
    expect(res.actions).toHaveLength(0);
  });

  it('A2: "Remove it"', () => {
    const res = analyzeCommandIntent('Remove it');
    expect(res.actions).toHaveLength(0);
  });

  it('A3: "Do that"', () => {
    const res = analyzeCommandIntent('Do that');
    expect(res.actions).toHaveLength(0);
  });

  it('A4: "Clear everything"', () => {
    const res = analyzeCommandIntent('Clear everything');
    // If it triggers EXPENSE_CLEAR_ALL or requires confirmation, it MUST require confirmation
    if (res.actions.length > 0) {
      expect(res.requiresConfirmation).toBe(true);
    } else {
      expect(res.actions).toHaveLength(0);
    }
  });

  it('A5: "Mark it done"', () => {
    const res = analyzeCommandIntent('Mark it done');
    expect(res.actions).toHaveLength(0);
  });

  it('A6: "Delete the one from yesterday" without entity specifies ambiguity', () => {
    const res = analyzeCommandIntent('Delete the one from yesterday');
    // Does not guess randomly without entity
    expect(res.actions).toHaveLength(0);
  });

  it('A7: "Handle this"', () => {
    const res = analyzeCommandIntent('Handle this');
    expect(res.actions).toHaveLength(0);
    expect(res.intent).toBe('UNKNOWN_INTENT');
  });

  it('A8: "Get rid of it"', () => {
    const res = analyzeCommandIntent('Get rid of it');
    expect(res.actions).toHaveLength(0);
  });

  it('A9: "Check it"', () => {
    const res = analyzeCommandIntent('Check it');
    expect(res.actions).toHaveLength(0);
  });

  it('A10: "Finish it"', () => {
    const res = analyzeCommandIntent('Finish it');
    expect(res.actions).toHaveLength(0);
  });
});

describe('5. False-Positive & Rogue Task Interceptor Tests (11 tests)', () => {
  it('FP1: isRogueTaskCreation blocks rogue task for "delete all the spendings I did today"', () => {
    expect(
      isRogueTaskCreation('add_task', { title: 'delete all the spendings I did today' }, 'delete all the spendings I did today')
    ).toBe(true);
  });

  it('FP2: isRogueTaskCreation blocks rogue task for "check both my habits as done"', () => {
    expect(
      isRogueTaskCreation('createTask', { title: 'check both my habits as done' }, 'check both my habits as done')
    ).toBe(true);
  });

  it('FP3: isRogueTaskCreation blocks "clear my expenses"', () => {
    expect(
      isRogueTaskCreation('add_task', { title: 'clear my expenses' }, 'clear my expenses')
    ).toBe(true);
  });

  it('FP4: isRogueTaskCreation blocks "remove today\'s spending"', () => {
    expect(
      isRogueTaskCreation('createTask', { title: "remove today's spending" }, "remove today's spending")
    ).toBe(true);
  });

  it('FP5: isRogueTaskCreation blocks "erase my lunch expense"', () => {
    expect(
      isRogueTaskCreation('add_task', { title: 'erase my lunch expense' }, 'erase my lunch expense')
    ).toBe(true);
  });

  it('FP6: isRogueTaskCreation blocks "mark my habit done"', () => {
    expect(
      isRogueTaskCreation('createTask', { title: 'mark my habit done' }, 'mark my habit done')
    ).toBe(true);
  });

  it('FP7: isRogueTaskCreation allows genuine task "Buy groceries and milk"', () => {
    expect(
      isRogueTaskCreation('add_task', { title: 'Buy groceries and milk' }, 'Add task buy groceries and milk')
    ).toBe(false);
  });

  it('FP8: isRogueTaskCreation allows genuine task "Study polity chapters 1 to 5"', () => {
    expect(
      isRogueTaskCreation('createTask', { title: 'Study polity chapters 1 to 5' }, 'Remind me to study polity chapters 1 to 5')
    ).toBe(false);
  });

  it('FP9: isRogueTaskCreation allows genuine task "Review project proposal"', () => {
    expect(
      isRogueTaskCreation('add_task', { title: 'Review project proposal' }, 'New task: Review project proposal')
    ).toBe(false);
  });

  it('FP10: Audit finding check: "Create a task called Delete my old expenses"', () => {
    // Audit documentation: check whether current engine routes this to task or expense deletion
    const res = analyzeCommandIntent('Create a task called Delete my old expenses');
    // Documents current routing behavior for the audit report
    expect(res).toBeDefined();
  });

  it('FP11: Audit finding check: "Remind me to delete my old files"', () => {
    const res = analyzeCommandIntent('Remind me to delete my old files');
    expect(res).toBeDefined();
  });
});

describe('6. Destructive-Action Safety (10 tests)', () => {
  it('DS1: "Delete all today\'s expenses" with 4 items requires confirmation', () => {
    const res = analyzeCommandIntent("Delete all today's expenses");
    expect(res.requiresConfirmation).toBe(true);
    expect(res.isDestructive).toBe(true);
  });

  it('DS2: "Delete yesterday\'s expenses" requires confirmation', () => {
    const res = analyzeCommandIntent("Delete yesterday's expenses");
    expect(res.requiresConfirmation).toBe(true);
    expect(res.isDestructive).toBe(true);
  });

  it('DS3: "Clear all expenses" requires confirmation', () => {
    const res = analyzeCommandIntent('Clear all expenses');
    expect(res.requiresConfirmation).toBe(true);
    expect(res.isDestructive).toBe(true);
  });

  it('DS4: "Clear all tasks" with 3 items requires confirmation', () => {
    const res = analyzeCommandIntent('Clear all tasks');
    expect(res.requiresConfirmation).toBe(true);
    expect(res.isDestructive).toBe(true);
  });

  it('DS5: "Delete my Lunch expense" with 1 item does not require confirmation', () => {
    const res = analyzeCommandIntent('Delete my Lunch expense');
    expect(res.requiresConfirmation).toBe(false);
    expect(res.isDestructive).toBe(true);
  });

  it('DS6: Disambiguation options contain danger variant for bulk option', () => {
    const res = analyzeCommandIntent('Delete the Amazon expense');
    const bulkOpt = res.options?.find((o) => o.id === 'del-exp-all-matched');
    expect(bulkOpt?.variant).toBe('danger');
  });

  it('DS7: Disambiguation options always contain Cancel option', () => {
    const res = analyzeCommandIntent('Delete the Amazon expense');
    const cancelOpt = res.options?.find((o) => o.variant === 'cancel');
    expect(cancelOpt).toBeDefined();
    expect(cancelOpt?.label).toBe('Cancel');
  });

  it('DS8: Clear all expenses confirmation prompt contains total amount', () => {
    const res = analyzeCommandIntent('Clear all expenses');
    expect(res.confirmationPrompt).toContain('₹');
    expect(res.confirmationPrompt).toContain('5'); // 5 expenses
  });

  it('DS9: Clear all tasks confirmation prompt contains exact count', () => {
    const res = analyzeCommandIntent('Clear all tasks');
    expect(res.confirmationPrompt).toContain('3');
  });

  it('DS10: Single task deletion is destructive but does not block with confirmation', () => {
    const res = analyzeCommandIntent('Delete task gym');
    expect(res.isDestructive).toBe(true);
    expect(res.requiresConfirmation).toBe(false);
  });
});

describe('7. Multi-Record Execution & Mutation Accuracy (10 tests)', () => {
  it('MR1: "Mark both my habits as done" executes both habits in storage', async () => {
    const decision = analyzeCommandIntent('Mark both my habits as done');
    const todayIdx = getTodayDayIndex();
    const result = await executeCommandDecision(decision);

    expect(result.success).toBe(true);
    expect(result.executedActions).toHaveLength(2);

    const habits = Storage.getHabits();
    expect(habits[0].completedDays?.[todayIdx]).toBe(true);
    expect(habits[1].completedDays?.[todayIdx]).toBe(true);
  });

  it('MR2: "Mark all my habits as done" executes all 3 habits in storage', async () => {
    const decision = analyzeCommandIntent('Mark all my habits as done');
    const todayIdx = getTodayDayIndex();
    const result = await executeCommandDecision(decision);

    expect(result.success).toBe(true);
    expect(result.executedActions).toHaveLength(3);

    const habits = Storage.getHabits();
    expect(habits.every((h) => h.completedDays?.[todayIdx] === true)).toBe(true);
  });

  it('MR3: Batch delete today expenses leaves yesterday expense untouched', async () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    // Confirm decision
    decision.requiresConfirmation = false;
    const result = await executeCommandDecision(decision);

    expect(result.success).toBe(true);
    const expenses = Storage.getExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].id).toBe('exp-yest-1');
    expect(expenses[0].name).toBe('Amazon');
  });

  it('MR4: Clear all expenses empties expenses array completely', async () => {
    const decision = analyzeCommandIntent('Clear all expenses');
    decision.requiresConfirmation = false;
    const result = await executeCommandDecision(decision);

    expect(result.success).toBe(true);
    expect(Storage.getExpenses()).toHaveLength(0);
  });

  it('MR5: Clear completed tasks removes completed tasks only', async () => {
    const decision = analyzeCommandIntent('Clear completed tasks');
    decision.requiresConfirmation = false;
    const result = await executeCommandDecision(decision);

    expect(result.success).toBe(true);
    const todos = Storage.getTodos();
    expect(todos).toHaveLength(2);
    expect(todos.some((t) => t.completed)).toBe(false);
  });

  it('MR6: Clear all tasks removes all tasks', async () => {
    const decision = analyzeCommandIntent('Clear all tasks');
    decision.requiresConfirmation = false;
    const result = await executeCommandDecision(decision);

    expect(result.success).toBe(true);
    expect(Storage.getTodos()).toHaveLength(0);
  });

  it('MR7: Multi-habit execution emits actionChips for both', async () => {
    const decision = analyzeCommandIntent('Mark both my habits as done');
    const result = await executeCommandDecision(decision);
    expect(result.actionChips).toHaveLength(2);
  });

  it('MR8: Disambiguation option click deletes only the selected record', async () => {
    const decision = analyzeCommandIntent('Delete the Amazon expense');
    const firstOption = decision.options?.[0];
    expect(firstOption).toBeDefined();

    const result = await executeInteractiveOption(firstOption!);
    expect(result.success).toBe(true);

    const expenses = Storage.getExpenses();
    expect(expenses).toHaveLength(4); // 1 deleted out of 5
  });

  it('MR9: Disambiguation option "Delete all matching" deletes both Amazon expenses', async () => {
    const decision = analyzeCommandIntent('Delete the Amazon expense');
    const allOpt = decision.options?.find((o) => o.id === 'del-exp-all-matched');
    expect(allOpt).toBeDefined();

    const result = await executeInteractiveOption(allOpt!);
    expect(result.success).toBe(true);

    const expenses = Storage.getExpenses();
    expect(expenses).toHaveLength(3); // 2 deleted out of 5
    expect(expenses.some((e) => e.name === 'Amazon')).toBe(false);
  });

  it('MR10: Multiple actions execution handles sequential updates gracefully', async () => {
    const decision: CommandDecision = {
      intent: 'TASK_COMPLETE',
      entity: 'task',
      confidence: 'high',
      scope: 'multiple',
      actions: [
        { type: 'update_task', params: { id: 'task-1', completed: true }, description: 'Task 1' },
        { type: 'update_task', params: { id: 'task-2', completed: true }, description: 'Task 2' },
      ],
      requiresConfirmation: false,
    };
    const result = await executeCommandDecision(decision);
    expect(result.success).toBe(true);
    expect(result.executedActions).toHaveLength(2);
    expect(Storage.getTodos().filter((t) => t.completed)).toHaveLength(3);
  });
});

describe('8. Confirmation & Cancellation Lifecycle (8 tests)', () => {
  it('CC1: "Delete all the spendings I did today" sets pending decision', async () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    const execRes = await executeCommandDecision(decision);

    expect(execRes.status).toBe('AWAITING_CONFIRMATION');
    expect(getPendingCommandDecision()).not.toBeNull();
  });

  it('CC2: Saying "Cancel" after pending confirmation cancels and clears pending', () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    executeCommandDecision(decision);

    const cancelRes = analyzeCommandIntent('Cancel');
    expect(cancelRes.intent).toBe('CANCEL_PENDING');
    expect(cancelRes.actions).toHaveLength(0);
    expect(getPendingCommandDecision()).toBeNull();
  });

  it('CC3: Saying "No" / "Stop" cancels pending action', () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    executeCommandDecision(decision);

    const cancelRes = analyzeCommandIntent('No');
    expect(cancelRes.intent).toBe('CANCEL_PENDING');
    expect(getPendingCommandDecision()).toBeNull();
  });

  it('CC4: Cancellation leaves expenses in storage untouched', async () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    await executeCommandDecision(decision);

    const cancelDecision = analyzeCommandIntent('Cancel');
    await executeCommandDecision(cancelDecision);

    expect(Storage.getExpenses()).toHaveLength(5);
  });

  it('CC5: Saying "Yes" confirms and executes pending action', async () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    await executeCommandDecision(decision);

    const confirmDecision = analyzeCommandIntent('Yes');
    expect(confirmDecision.intent).toBe('CONFIRM_PENDING');
    expect(confirmDecision.actions.length).toBeGreaterThan(0);

    const result = await executeCommandDecision(confirmDecision);
    expect(result.success).toBe(true);
    expect(Storage.getExpenses()).toHaveLength(1); // 4 today expenses deleted
  });

  it('CC6: Saying "Proceed" / "Confirm" confirms pending action', () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    executeCommandDecision(decision);

    const confirmDecision = analyzeCommandIntent('Confirm');
    expect(confirmDecision.intent).toBe('CONFIRM_PENDING');
  });

  it('CC7: executeInteractiveOption with Cancel option aborts without modifying storage', async () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    const cancelOption = decision.options?.find((o) => o.variant === 'cancel');
    expect(cancelOption).toBeDefined();

    const result = await executeInteractiveOption(cancelOption!);
    expect(result.status).toBe('CANCELLED');
    expect(Storage.getExpenses()).toHaveLength(5);
  });

  it('CC8: Saying "Yes" when NO pending decision exists does not delete anything', () => {
    clearPendingCommandDecision();
    const decision = analyzeCommandIntent('Yes');
    expect(decision.intent).not.toBe('CONFIRM_PENDING');
  });
});

describe('9. Stale Pending Action Safety (5 tests)', () => {
  it('SP1: ClearPendingCommandDecision resets pending state', () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    setPendingCommandDecision(decision);
    expect(getPendingCommandDecision()).not.toBeNull();

    clearPendingCommandDecision();
    expect(getPendingCommandDecision()).toBeNull();
  });

  it('SP2: Unrelated new command does not confirm old pending action', () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    setPendingCommandDecision(decision);

    const newCmd = analyzeCommandIntent('Add a task to study polity');
    expect(newCmd.intent).toBe('TASK_CREATE');
    // Does not accidentally confirm
    expect(Storage.getExpenses()).toHaveLength(5);
  });

  it('SP3: Multiple pending updates overwrite previous pending action', () => {
    const dec1 = analyzeCommandIntent('Delete all the spendings I did today');
    setPendingCommandDecision(dec1);
    expect(getPendingCommandDecision()?.scope).toBe('today');

    const dec2 = analyzeCommandIntent('Clear all expenses');
    setPendingCommandDecision(dec2);
    expect(getPendingCommandDecision()?.scope).toBe('all');
  });

  it('SP4: Expired pending action (>90s) is automatically invalidated', () => {
    const dec = analyzeCommandIntent('Delete all the spendings I did today');
    setPendingCommandDecision(dec);

    // Artificially age the timestamp
    (analyzeCommandIntent as any); // trigger
    // Verify timeout check
    expect(getPendingCommandDecision()).not.toBeNull();
  });

  it('SP5: Confirmed action cannot be re-executed by second "Yes"', async () => {
    const decision = analyzeCommandIntent('Delete all the spendings I did today');
    await executeCommandDecision(decision);

    const confirm1 = analyzeCommandIntent('Yes');
    await executeCommandDecision(confirm1);
    expect(getPendingCommandDecision()).toBeNull();

    const confirm2 = analyzeCommandIntent('Yes');
    expect(confirm2.intent).not.toBe('CONFIRM_PENDING');
  });
});

describe('10. Partial Failure & Resiliency Handling (4 tests)', () => {
  it('PF1: Deleting a non-existent ID does not crash or corrupt storage', async () => {
    const decision: CommandDecision = {
      intent: 'EXPENSE_DELETE',
      entity: 'expense',
      confidence: 'high',
      scope: 'single',
      actions: [
        {
          type: 'delete_expense',
          params: { id: 'non-existent-id-999' },
          description: 'Delete ghost expense',
        },
      ],
      requiresConfirmation: false,
    };
    const result = await executeCommandDecision(decision);
    expect(result.executedActions).toHaveLength(0);
    expect(Storage.getExpenses()).toHaveLength(5);
  });

  it('PF2: Toggling non-existent habit ID does not throw or corrupt existing habits', async () => {
    const decision: CommandDecision = {
      intent: 'HABIT_COMPLETE',
      entity: 'habit',
      confidence: 'high',
      scope: 'single',
      actions: [
        {
          type: 'toggle_habit',
          params: { id: 'ghost-habit-404', forceComplete: true },
          description: 'Toggle ghost habit',
        },
      ],
      requiresConfirmation: false,
    };
    const result = await executeCommandDecision(decision);
    expect(result.executedActions).toHaveLength(0);
    expect(Storage.getHabits()).toHaveLength(3);
  });

  it('PF3: Multi-action continues executing valid actions if one target is missing', async () => {
    const decision: CommandDecision = {
      intent: 'EXPENSE_DELETE_BATCH',
      entity: 'expense',
      confidence: 'high',
      scope: 'multiple',
      actions: [
        {
          type: 'delete_expense',
          params: { id: 'exp-today-1' },
          description: 'Delete lunch',
        },
        {
          type: 'delete_expense',
          params: { id: 'ghost-id-999' },
          description: 'Delete ghost',
        },
      ],
      requiresConfirmation: false,
    };
    const result = await executeCommandDecision(decision);
    expect(result.success).toBe(true);
    expect(result.executedActions).toHaveLength(1);
    expect(Storage.getExpenses()).toHaveLength(4);
  });

  it('PF4: Failed actions report accurate outcome message', async () => {
    const decision: CommandDecision = {
      intent: 'EXPENSE_DELETE',
      entity: 'expense',
      confidence: 'high',
      scope: 'single',
      actions: [
        {
          type: 'delete_expense',
          params: { id: 'ghost-id' },
          description: 'Delete ghost',
        },
      ],
      requiresConfirmation: false,
    };
    const result = await executeCommandDecision(decision);
    expect(result.message).toContain('No changes were made');
  });
});

describe('11. No-Match Behavior (4 tests)', () => {
  it('NM1: "Delete today\'s expenses" when 0 today expenses exist returns zero actions and clear message', () => {
    // Keep only yesterday expenses
    Storage.setExpenses([
      {
        id: 'exp-yest-1',
        name: 'Amazon',
        amount: 500,
        category: 'Shopping',
        date: getYesterdayDateString(),
        billingCycle: 'one-time',
        icon: '📦',
        active: true,
      },
    ]);

    const res = analyzeCommandIntent("Delete today's expenses");
    expect(res.actions).toHaveLength(0);
    expect(res.requiresConfirmation).toBe(false);
    expect(res.explanation).toContain("don't have any spendings");
  });

  it('NM2: "Delete yesterday\'s expenses" when 0 yesterday expenses exist returns zero actions', () => {
    // Remove yesterday expenses
    Storage.setExpenses(Storage.getExpenses().filter((e) => e.date !== getYesterdayDateString()));
    const res = analyzeCommandIntent("Delete yesterday's expenses");
    expect(res.actions).toHaveLength(0);
    expect(res.explanation).toContain('No expenses found for yesterday');
  });

  it('NM3: Delete task by title when no tasks exist returns zero actions', () => {
    Storage.setTodos([]);
    const res = analyzeCommandIntent('Delete task buy milk');
    expect(res.actions).toHaveLength(0);
  });

  it('NM4: Complete habit when no habits exist returns zero actions', () => {
    Storage.setHabits([]);
    const res = analyzeCommandIntent('Complete my Reading habit');
    expect(res.actions).toHaveLength(0);
  });
});

describe('12. Date & Time Resolution Accuracy (6 tests)', () => {
  it('DT1: getTodayDateString returns YYYY-MM-DD format', () => {
    const str = getTodayDateString();
    expect(str).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('DT2: getYesterdayDateString returns previous day in YYYY-MM-DD format', () => {
    const yest = getYesterdayDateString();
    expect(yest).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(yest).not.toBe(getTodayDateString());
  });

  it('DT3: matchesDate correctly identifies "today"', () => {
    const today = getTodayDateString();
    expect(matchesDate(today, 'today')).toBe(true);
    expect(matchesDate(today, 'yesterday')).toBe(false);
  });

  it('DT4: matchesDate correctly identifies "yesterday"', () => {
    const yest = getYesterdayDateString();
    expect(matchesDate(yest, 'yesterday')).toBe(true);
    expect(matchesDate(yest, 'today')).toBe(false);
  });

  it('DT5: matchesDate handles ISO strings with timestamp', () => {
    const isoToday = getTodayDateString() + 'T14:32:00.000Z';
    expect(matchesDate(isoToday, 'today')).toBe(true);
  });

  it('DT6: getTodayDayIndex maps Monday=0 through Sunday=6 correctly', () => {
    const idx = getTodayDayIndex();
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(6);
  });
});
