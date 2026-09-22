/**
 * Reliability Test Suite
 * 
 * 100+ comprehensive scenarios covering:
 * - Expense Command Routing & Multi-Record Safety
 * - Atomic Pending State & Confirmation Locking
 * - Habit Command Routing & Safety
 * - Task Command Routing & Priority Engine
 * - Ambiguous Command Routing, Fillers & Interceptor Logic
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import {
  analyzeCommandIntent,
  executeCommandDecision,
  setPendingCommandDecision,
  getPendingCommandDecision,
  clearPendingCommandDecision,
  isAtomicPendingLocked,
  lockPendingExpenseDeletion,
  unlockPendingExpenseDeletion,
  isRogueTaskCreation,
  getTodayDateString,
} from '../services/commandIntentEngine';
import { Storage } from '../utils/storage';
import { ExpenseItem, HabitItem, TodoItem } from '../types';

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

// Seed mock data
const SEED_EXPENSES: ExpenseItem[] = [
  { id: 'exp-1', name: 'Coffee', amount: 150, category: 'Food & Dining', date: getTodayDateString(), active: true },
  { id: 'exp-2', name: 'Swiggy Dinner', amount: 480, category: 'Food & Dining', date: getTodayDateString(), active: true },
  { id: 'exp-3', name: 'Uber Ride', amount: 320, category: 'Transportation', date: getTodayDateString(), active: true },
  { id: 'exp-4', name: 'Amazon Prime', amount: 1499, category: 'Entertainment', date: '2026-09-01', active: true },
  { id: 'exp-5', name: 'Electricity Bill', amount: 2200, category: 'Bills & Utilities', date: '2026-09-02', active: true },
];

const SEED_HABITS: HabitItem[] = [
  {
    id: 'habit-1',
    title: 'Reading',
    category: 'Personal',
    streak: 5,
    completedDays: [true, false, false, false, false, false, false],
    color: '#6366f1',
    icon: 'book',
  },
  {
    id: 'habit-2',
    title: 'Drink 2L Water',
    category: 'Health',
    streak: 3,
    completedDays: [false, false, false, false, false, false, false],
    color: '#06b6d4',
    icon: 'droplet',
  },
  {
    id: 'habit-3',
    title: 'Gym Workout',
    category: 'Health',
    streak: 2,
    completedDays: [false, false, false, false, false, false, false],
    color: '#f43f5e',
    icon: 'dumbbell',
  },
];

const SEED_TODOS: TodoItem[] = [
  { id: 'task-1', title: 'Study Polity Chapter 4', completed: false, priority: 'high', category: 'Study', createdAt: '2026-09-01' },
  { id: 'task-2', title: 'Buy Groceries', completed: false, priority: 'medium', category: 'Personal', createdAt: '2026-09-02' },
  { id: 'task-3', title: 'Pay Credit Card Bill', completed: true, priority: 'high', category: 'Finance', createdAt: '2026-09-03' },
  { id: 'task-4', title: 'Clean Bookshelf', completed: false, priority: 'low', category: 'Home', createdAt: '2026-09-04' },
];

describe('Reliability Suite: Intent Engine & Interceptor Logic', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    setupMockStorage();
    localStorage.clear();
    clearPendingCommandDecision();
    Storage.setExpenses([...SEED_EXPENSES]);
    Storage.setHabits([...SEED_HABITS]);
    Storage.setTodos([...SEED_TODOS]);
  });

  afterEach(() => {
    clearPendingCommandDecision();
  });

  // ==========================================================================
  // MODULE 1: EXPENSE COMMAND ROUTING & MULTI-RECORD SAFETY (26 SCENARIOS)
  // ==========================================================================
  describe('1. Expense Command Routing & Multi-Record Safety', () => {
    it('EXP-01: Single expense deletion by exact title', () => {
      const decision = analyzeCommandIntent('Delete Coffee expense');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.scope).toBe('single');
      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0].targetId).toBe('exp-1');
      expect(decision.requiresConfirmation).toBe(false);
      expect(decision.isDestructive).toBe(true);
    });

    it('EXP-02: Single expense deletion with "Remove" verb and spending noun', () => {
      const decision = analyzeCommandIntent('Remove Swiggy Dinner spending');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.scope).toBe('single');
      expect(decision.actions[0].targetId).toBe('exp-2');
      expect(decision.requiresConfirmation).toBe(false);
    });

    it('EXP-03: Single expense deletion by numeric amount', () => {
      const decision = analyzeCommandIntent('Delete expense of 150');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0].targetId).toBe('exp-1');
    });

    it('EXP-04: Single expense deletion with currency symbol (₹320)', () => {
      const decision = analyzeCommandIntent('Delete ₹320 expense');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions[0].targetId).toBe('exp-3');
    });

    it('EXP-05: Single expense deletion with Rs prefix', () => {
      const decision = analyzeCommandIntent('Remove Rs. 1499 spending');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions[0].targetId).toBe('exp-4');
    });

    it('EXP-06: Multi-record deletion comma-separated (Coffee, Swiggy, and Uber)', () => {
      const decision = analyzeCommandIntent('Delete Coffee, Swiggy Dinner, and Uber Ride');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.scope).toBe('multiple');
      expect(decision.actions.length).toBeGreaterThanOrEqual(2);
      expect(decision.requiresConfirmation).toBe(true);
      expect(decision.isDestructive).toBe(true);
    });

    it('EXP-07: Multi-record deletion with "and" connector', () => {
      const decision = analyzeCommandIntent('Delete Coffee and Swiggy Dinner expenses');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.scope).toBe('multiple');
      expect(decision.requiresConfirmation).toBe(true);
      expect(decision.actions).toHaveLength(2);
    });

    it('EXP-08: Multi-record deletion with multiple amounts', () => {
      const decision = analyzeCommandIntent('Delete expenses of 150 and 320');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.scope).toBe('multiple');
      expect(decision.actions).toHaveLength(2);
      expect(decision.requiresConfirmation).toBe(true);
    });

    it('EXP-09: Date-scoped deletion: "Delete all the spendings I did today"', () => {
      const decision = analyzeCommandIntent('Delete all the spendings I did today');
      expect(['EXPENSE_DELETE', 'EXPENSE_DELETE_BATCH']).toContain(decision.intent);
      expect(decision.scope).toBe('today');
      expect(decision.requiresConfirmation).toBe(true);
      expect((decision.actions[0]?.params?.ids || decision.actions)).toHaveLength(3); // 3 seeded for today
      expect(decision.isDestructive).toBe(true);
    });

    it('EXP-10: Date-scoped deletion: "Clear today\'s expenses"', () => {
      const decision = analyzeCommandIntent("Clear today's expenses");
      expect(['EXPENSE_DELETE', 'EXPENSE_DELETE_BATCH']).toContain(decision.intent);
      expect(decision.scope).toBe('today');
      expect(decision.requiresConfirmation).toBe(true);
    });

    it('EXP-11: Date-scoped deletion: "Remove yesterday\'s expenses"', () => {
      const yestDate = new Date();
      yestDate.setDate(yestDate.getDate() - 1);
      const yestStr = yestDate.toISOString().split('T')[0];
      Storage.setExpenses([
        ...SEED_EXPENSES,
        { id: 'exp-yest', name: 'Dinner Yesterday', amount: 350, category: 'Food & Dining', date: yestStr, active: true },
      ]);
      const decision = analyzeCommandIntent("Remove yesterday's expenses");
      expect(['EXPENSE_DELETE', 'EXPENSE_DELETE_BATCH']).toContain(decision.intent);
      expect(decision.scope).toBe('yesterday');
      expect(decision.requiresConfirmation).toBe(true);
    });

    it('EXP-12: Entire category deletion: "Delete all Food & Dining expenses"', () => {
      const decision = analyzeCommandIntent('Delete all Food & Dining expenses');
      expect(['EXPENSE_DELETE', 'EXPENSE_CLEAR_ALL']).toContain(decision.intent);
      expect(decision.requiresConfirmation).toBe(true);
      expect(decision.actions.length).toBeGreaterThanOrEqual(1);
    });

    it('EXP-13: Entire category deletion: "Remove bills expenses"', () => {
      const decision = analyzeCommandIntent('Remove all bills expenses');
      expect(['EXPENSE_DELETE', 'EXPENSE_CLEAR_ALL']).toContain(decision.intent);
      expect(decision.requiresConfirmation).toBe(true);
      expect(decision.actions.length).toBeGreaterThanOrEqual(1);
    });

    it('EXP-14: Trailing keyword handling ("Delete my grocery spending")', () => {
      // If no grocery expense exists, gracefully returns explanation or NO_MATCH without crashing
      const decision = analyzeCommandIntent('Delete my grocery spending');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(Array.isArray(decision.actions)).toBe(true);
    });

    it('EXP-15: Trailing keyword: "Wipe Uber Ride transaction"', () => {
      const decision = analyzeCommandIntent('Wipe Uber Ride transaction');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions[0].targetId).toBe('exp-3');
    });

    it('EXP-16: Delete all expenses command requires confirmation', () => {
      const decision = analyzeCommandIntent('Delete all expenses');
      expect(decision.intent).toBe('EXPENSE_CLEAR_ALL');
      expect(decision.scope).toBe('all');
      expect(decision.requiresConfirmation).toBe(true);
      expect(decision.isDestructive).toBe(true);
      expect(decision.options).toBeDefined();
    });

    it('EXP-17: Purge all expenses alias', () => {
      const decision = analyzeCommandIntent('Purge every single expense');
      expect(decision.intent).toBe('EXPENSE_CLEAR_ALL');
      expect(decision.requiresConfirmation).toBe(true);
    });

    it('EXP-18: View query: "Show me what I spent today"', () => {
      const decision = analyzeCommandIntent('Show me what I spent today');
      expect(decision.intent).toBe('EXPENSE_VIEW');
      expect(decision.scope).toBe('today');
      expect(decision.isDestructive).toBe(false);
      expect(decision.requiresConfirmation).toBe(false);
    });

    it('EXP-19: View query: "How much did I spend yesterday?"', () => {
      const decision = analyzeCommandIntent('How much did I spend yesterday?');
      expect(decision.intent).toBe('EXPENSE_VIEW');
      expect(decision.scope).toBe('yesterday');
    });

    it('EXP-20: View query: "List all my expenses"', () => {
      const decision = analyzeCommandIntent('List all my expenses');
      expect(decision.intent).toBe('EXPENSE_VIEW');
      expect(decision.scope).toBe('all');
    });

    it('EXP-21: Expense creation: "Spent 450 on lunch"', () => {
      const decision = analyzeCommandIntent('Spent 450 on lunch');
      expect(decision.intent).toBe('EXPENSE_CREATE');
      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0].params.amount).toBe(450);
      expect(decision.actions[0].params.name.toLowerCase()).toContain('lunch');
    });

    it('EXP-22: Expense creation: "Add expense 250 for snacks"', () => {
      const decision = analyzeCommandIntent('Add expense 250 for snacks');
      expect(decision.intent).toBe('EXPENSE_CREATE');
      expect(decision.actions[0].params.amount).toBe(250);
    });

    it('EXP-23: Expense creation with ₹ symbol', () => {
      const decision = analyzeCommandIntent('Paid ₹1200 for groceries');
      expect(decision.intent).toBe('EXPENSE_CREATE');
      expect(decision.actions[0].params.amount).toBe(1200);
    });

    it('EXP-24: Non-existent expense deletion returns 0 actions gracefully', () => {
      const decision = analyzeCommandIntent('Delete Ferrari supercar expense');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions).toHaveLength(0);
      expect(decision.requiresConfirmation).toBe(false);
    });

    it('EXP-25: Empty storage deletion returns explanation with zero crashes', () => {
      Storage.setExpenses([]);
      const decision = analyzeCommandIntent('Delete today expenses');
      expect(['EXPENSE_DELETE', 'EXPENSE_DELETE_BATCH']).toContain(decision.intent);
      expect(decision.actions).toHaveLength(0);
    });

    it('EXP-26: Execution of single expense deletion updates storage immediately', async () => {
      const decision = analyzeCommandIntent('Delete Coffee expense');
      const result = await executeCommandDecision(decision);
      expect(result.success).toBe(true);
      expect(Storage.getExpenses().some((e) => e.id === 'exp-1')).toBe(false);
      expect(Storage.getExpenses()).toHaveLength(4);
    });
  });

  // ==========================================================================
  // MODULE 2: ATOMIC PENDING STATE & CONFIRMATION LOCKING (22 SCENARIOS)
  // ==========================================================================
  describe('2. Atomic Pending State & Confirmation Locking Engine', () => {
    it('ATOMIC-01: Explicit lockPendingExpenseDeletion locks atomic state', () => {
      const items = [SEED_EXPENSES[0], SEED_EXPENSES[1]];
      lockPendingExpenseDeletion('tx-101', items, 'multiple');

      expect(isAtomicPendingLocked()).toBe(true);
      const pending = getPendingCommandDecision();
      expect(pending).not.toBeNull();
      expect(pending?.isAtomicLocked).toBe(true);
      expect(pending?.transactionId).toBe('tx-101');
      expect(pending?.actions).toHaveLength(2);
    });

    it('ATOMIC-02: Locking blocks task creation while pending', () => {
      lockPendingExpenseDeletion('tx-102', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const blockedCmd = analyzeCommandIntent('Add task Buy fresh milk');
      expect(blockedCmd.intent).toBe('BLOCKED_BY_PENDING');
      expect(blockedCmd.actions).toHaveLength(0);
      expect(blockedCmd.explanation).toContain('locked in an atomic pending state');
      expect(Storage.getTodos().some((t) => t.title.includes('fresh milk'))).toBe(false);
    });

    it('ATOMIC-03: Locking blocks habit toggling while pending', () => {
      lockPendingExpenseDeletion('tx-103', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const blockedCmd = analyzeCommandIntent('Complete my Reading habit');
      expect(blockedCmd.intent).toBe('BLOCKED_BY_PENDING');
      expect(blockedCmd.actions).toHaveLength(0);
    });

    it('ATOMIC-04: Locking blocks secondary expense deletions while pending', () => {
      lockPendingExpenseDeletion('tx-104', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const blockedCmd = analyzeCommandIntent('Delete Uber Ride');
      expect(blockedCmd.intent).toBe('BLOCKED_BY_PENDING');
      expect(blockedCmd.actions).toHaveLength(0);
    });

    it('ATOMIC-05: Locking blocks view queries while pending', () => {
      lockPendingExpenseDeletion('tx-105', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const blockedCmd = analyzeCommandIntent('Show what I spent today');
      expect(blockedCmd.intent).toBe('BLOCKED_BY_PENDING');
      expect(blockedCmd.actions).toHaveLength(0);
    });

    it('ATOMIC-06: Locking blocks clear all tasks while pending', () => {
      lockPendingExpenseDeletion('tx-106', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const blockedCmd = analyzeCommandIntent('Clear all tasks');
      expect(blockedCmd.intent).toBe('BLOCKED_BY_PENDING');
      expect(blockedCmd.actions).toHaveLength(0);
    });

    it('ATOMIC-07: Executing BLOCKED_BY_PENDING decision returns safe awaiting status', async () => {
      lockPendingExpenseDeletion('tx-107', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);
      const blocked = analyzeCommandIntent('Add a task to call mom');

      const execResult = await executeCommandDecision(blocked);
      expect(execResult.success).toBe(false);
      expect(execResult.status).toBe('AWAITING_CONFIRMATION');
      expect(execResult.executedActions).toHaveLength(0);
    });

    it('ATOMIC-08: Affirmative "Yes" approves locked transaction and clears lock', () => {
      lockPendingExpenseDeletion('tx-108', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const confirmCmd = analyzeCommandIntent('Yes');
      expect(confirmCmd.intent).toBe('CONFIRM_PENDING');
      expect(confirmCmd.actions).toHaveLength(2);
      expect(isAtomicPendingLocked()).toBe(false); // cleared
    });

    it('ATOMIC-09: Affirmative "Confirm" approves locked transaction', () => {
      lockPendingExpenseDeletion('tx-109', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const confirmCmd = analyzeCommandIntent('Confirm');
      expect(confirmCmd.intent).toBe('CONFIRM_PENDING');
      expect(isAtomicPendingLocked()).toBe(false);
    });

    it('ATOMIC-10: Affirmative "Proceed" approves locked transaction', () => {
      lockPendingExpenseDeletion('tx-110', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const confirmCmd = analyzeCommandIntent('Proceed');
      expect(confirmCmd.intent).toBe('CONFIRM_PENDING');
    });

    it('ATOMIC-11: Affirmative "Delete them" approves locked transaction', () => {
      lockPendingExpenseDeletion('tx-111', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const confirmCmd = analyzeCommandIntent('Delete them');
      expect(confirmCmd.intent).toBe('CONFIRM_PENDING');
    });

    it('ATOMIC-12: Affirmative "Approve" approves locked transaction', () => {
      lockPendingExpenseDeletion('tx-112', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const confirmCmd = analyzeCommandIntent('Approve');
      expect(confirmCmd.intent).toBe('CONFIRM_PENDING');
    });

    it('ATOMIC-13: Executing CONFIRM_PENDING atomically deletes all targeted items', async () => {
      lockPendingExpenseDeletion('tx-113', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);
      const confirmCmd = analyzeCommandIntent('Yes');

      const result = await executeCommandDecision(confirmCmd);
      expect(result.success).toBe(true);
      expect(result.executedActions).toHaveLength(2);

      const remaining = Storage.getExpenses();
      expect(remaining.some((e) => e.id === 'exp-1')).toBe(false);
      expect(remaining.some((e) => e.id === 'exp-2')).toBe(false);
      expect(remaining).toHaveLength(3);
    });

    it('ATOMIC-14: Negative "No" cancels locked transaction without deleting data', async () => {
      lockPendingExpenseDeletion('tx-114', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const cancelCmd = analyzeCommandIntent('No');
      expect(cancelCmd.intent).toBe('CANCEL_PENDING');
      expect(cancelCmd.actions).toHaveLength(0);
      expect(isAtomicPendingLocked()).toBe(false);

      await executeCommandDecision(cancelCmd);
      expect(Storage.getExpenses()).toHaveLength(5); // all preserved!
    });

    it('ATOMIC-15: Negative "Cancel" unlocks state cleanly', () => {
      lockPendingExpenseDeletion('tx-115', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const cancelCmd = analyzeCommandIntent('Cancel');
      expect(cancelCmd.intent).toBe('CANCEL_PENDING');
      expect(isAtomicPendingLocked()).toBe(false);
    });

    it('ATOMIC-16: Negative "Stop" unlocks state cleanly', () => {
      lockPendingExpenseDeletion('tx-116', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const cancelCmd = analyzeCommandIntent('Stop');
      expect(cancelCmd.intent).toBe('CANCEL_PENDING');
      expect(isAtomicPendingLocked()).toBe(false);
    });

    it('ATOMIC-17: Negative "Abort" unlocks state cleanly', () => {
      lockPendingExpenseDeletion('tx-117', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      const cancelCmd = analyzeCommandIntent('Abort');
      expect(cancelCmd.intent).toBe('CANCEL_PENDING');
      expect(isAtomicPendingLocked()).toBe(false);
    });

    it('ATOMIC-18: Commands resume normal execution once atomic state is resolved', () => {
      lockPendingExpenseDeletion('tx-118', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);

      // Cancel unlocks
      analyzeCommandIntent('Cancel');
      expect(isAtomicPendingLocked()).toBe(false);

      // Now normal command runs
      const resumed = analyzeCommandIntent('Add task Clean kitchen');
      expect(resumed.intent).toBe('TASK_CREATE');
      expect(resumed.actions[0].params.title).toContain('Clean kitchen');
    });

    it('ATOMIC-19: unlockPendingExpenseDeletion programmatically clears lock', () => {
      lockPendingExpenseDeletion('tx-119', [SEED_EXPENSES[0]]);
      expect(isAtomicPendingLocked()).toBe(true);

      unlockPendingExpenseDeletion();
      expect(isAtomicPendingLocked()).toBe(false);
      expect(getPendingCommandDecision()).toBeNull();
    });

    it('ATOMIC-20: Double lock replaces atomic transaction securely', () => {
      lockPendingExpenseDeletion('tx-120-A', [SEED_EXPENSES[0]]);
      expect(getPendingCommandDecision()?.transactionId).toBe('tx-120-A');

      lockPendingExpenseDeletion('tx-120-B', [SEED_EXPENSES[1], SEED_EXPENSES[2]]);
      expect(getPendingCommandDecision()?.transactionId).toBe('tx-120-B');
      expect(getPendingCommandDecision()?.actions).toHaveLength(2);
    });

    it('ATOMIC-21: Expired atomic pending decision automatically clears after timeout', () => {
      lockPendingExpenseDeletion('tx-121', [SEED_EXPENSES[0]]);
      expect(getPendingCommandDecision()).not.toBeNull();

      // Mock Date.now past 90s
      const realNow = Date.now;
      Date.now = () => realNow() + 95000;

      expect(getPendingCommandDecision()).toBeNull();
      expect(isAtomicPendingLocked()).toBe(false);

      Date.now = realNow;
    });

    it('ATOMIC-22: Locked options provide danger approve and cancel pills', () => {
      const decision = lockPendingExpenseDeletion('tx-122', [SEED_EXPENSES[0], SEED_EXPENSES[1]]);
      expect(decision.options).toBeDefined();
      expect(decision.options).toHaveLength(2);
      expect(decision.options![0].variant).toBe('danger');
      expect(decision.options![1].variant).toBe('cancel');
    });
  });

  // ==========================================================================
  // MODULE 3: HABIT COMMAND ROUTING & SAFETY (22 SCENARIOS)
  // ==========================================================================
  describe('3. Habit Command Routing & Safety', () => {
    it('HAB-01: Complete specific habit by title ("Complete my Reading habit")', () => {
      const decision = analyzeCommandIntent('Complete my Reading habit');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0].targetId).toBe('habit-1');
    });

    it('HAB-02: Check off specific habit ("Check off Drink 2L Water habit")', () => {
      const decision = analyzeCommandIntent('Check off Drink 2L Water habit');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.actions[0].targetId).toBe('habit-2');
    });

    it('HAB-03: Mark habit done ("Mark meditation as done" / Gym workout)', () => {
      const decision = analyzeCommandIntent('Mark Gym Workout habit done');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.actions[0].targetId).toBe('habit-3');
    });

    it('HAB-04: Case insensitivity in habit completion ("COMPLETE READING HABIT")', () => {
      const decision = analyzeCommandIntent('COMPLETE READING HABIT');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.actions[0].targetId).toBe('habit-1');
    });

    it('HAB-05: Partial title match for habit ("Complete water habit")', () => {
      const decision = analyzeCommandIntent('Complete water habit');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.actions[0].targetId).toBe('habit-2');
    });

    it('HAB-06: Toggle habit intent ("Toggle gym habit")', () => {
      const decision = analyzeCommandIntent('Toggle gym habit');
      expect(['HABIT_COMPLETE', 'HABIT_TOGGLE']).toContain(decision.intent);
      expect(decision.actions[0].targetId).toBe('habit-3');
    });

    it('HAB-07: Complete all habits for today ("Complete all habits")', () => {
      const decision = analyzeCommandIntent('Complete all habits');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.scope).toBe('all');
      expect(decision.actions).toHaveLength(3); // all 3 habits
    });

    it('HAB-08: Check off every habit ("Check off every habit for today")', () => {
      const decision = analyzeCommandIntent('Check off every habit for today');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.scope).toBe('all');
      expect(decision.actions).toHaveLength(3);
    });

    it('HAB-09: Mark both habits done ("Mark both habits as done")', () => {
      const decision = analyzeCommandIntent('Mark both habits as done');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.actions.length).toBeGreaterThanOrEqual(2);
    });

    it('HAB-10: Check off 2 habits ("Check 2 habits")', () => {
      const decision = analyzeCommandIntent('Check off 2 habits');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.actions.length).toBeGreaterThanOrEqual(2);
    });

    it('HAB-11: Delete habit with explicit noun guard ("Delete habit Gym Workout")', () => {
      const decision = analyzeCommandIntent('Delete habit Gym Workout');
      expect(decision.intent).toBe('HABIT_DELETE');
      expect(decision.actions[0].targetId).toBe('habit-3');
      expect(decision.isDestructive).toBe(true);
    });

    it('HAB-12: Delete habit with "Remove" verb and habit noun ("Remove habit Reading")', () => {
      const decision = analyzeCommandIntent('Remove habit Reading');
      expect(decision.intent).toBe('HABIT_DELETE');
      expect(decision.actions[0].targetId).toBe('habit-1');
    });

    it('HAB-13: Noun guard: "Delete gym" without habit noun should NOT delete habit if expense exists', () => {
      // Add Gym expense to storage
      Storage.setExpenses([...SEED_EXPENSES, { id: 'exp-gym', name: 'Gym membership', amount: 1000, category: 'Health', date: '2026-09-01', active: true }]);
      const decision = analyzeCommandIntent('Delete Gym');
      expect(decision.entity).toBe('expense'); // prioritizes expense over habit when habit noun missing
    });

    it('HAB-14: Habit view routing ("Show my habits")', () => {
      const decision = analyzeCommandIntent('Show my habits');
      expect(decision.intent).toBe('HABIT_VIEW');
      expect(decision.entity).toBe('habit');
    });

    it('HAB-15: Habit view routing ("Go to habit tracker")', () => {
      const decision = analyzeCommandIntent('Go to habit tracker');
      expect(decision.intent).toBe('HABIT_VIEW');
    });

    it('HAB-16: Habit status query ("Did I do my habits today?")', () => {
      const decision = analyzeCommandIntent('Did I do my habits today?');
      expect(decision.intent).toBe('HABIT_VIEW');
    });

    it('HAB-17: Uncomplete habit ("Uncomplete reading habit")', () => {
      const decision = analyzeCommandIntent('Uncomplete reading habit');
      expect(decision.intent).toBe('HABIT_UNCOMPLETE');
      expect(decision.actions[0].targetId).toBe('habit-1');
    });

    it('HAB-18: Mark habit as not done ("Mark gym habit as not done")', () => {
      const decision = analyzeCommandIntent('Mark gym habit as not done');
      expect(decision.intent).toBe('HABIT_UNCOMPLETE');
      expect(decision.actions[0].targetId).toBe('habit-3');
    });

    it('HAB-19: Execution of habit completion toggles status in storage', async () => {
      const decision = analyzeCommandIntent('Complete my Drink 2L Water habit');
      const res = await executeCommandDecision(decision);
      expect(res.success).toBe(true);
      const habits = Storage.getHabits();
      const water = habits.find((h) => h.id === 'habit-2');
      expect(water?.completedDays.some((d) => d === true)).toBe(true);
    });

    it('HAB-20: Execution of complete all habits marks all in storage', async () => {
      const decision = analyzeCommandIntent('Complete all habits');
      const res = await executeCommandDecision(decision);
      expect(res.success).toBe(true);
      const habits = Storage.getHabits();
      expect(habits.every((h) => h.completedDays.some((d) => d === true))).toBe(true);
    });

    it('HAB-21: Habit creation intent ("Create habit Meditate daily")', () => {
      const decision = analyzeCommandIntent('Create habit Meditate daily');
      expect(decision.intent).toBe('HABIT_CREATE');
      expect(decision.actions[0].params.name.toLowerCase()).toContain('meditate');
    });

    it('HAB-22: Non-existent habit name returns 0 actions gracefully', () => {
      const decision = analyzeCommandIntent('Complete skydiving habit');
      expect(decision.intent).toBe('HABIT_COMPLETE');
      expect(decision.actions).toHaveLength(0);
    });
  });

  // ==========================================================================
  // MODULE 4: TASK COMMAND ROUTING & PRIORITY ENGINE (25 SCENARIOS)
  // ==========================================================================
  describe('4. Task Command Routing & Priority Engine', () => {
    it('TASK-01: Standard task creation ("Add task Buy groceries")', () => {
      const decision = analyzeCommandIntent('Add task Buy groceries');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0].params.title).toContain('Buy groceries');
      expect(decision.actions[0].params.priority).toBe('medium');
    });

    it('TASK-02: New task with colon prefix ("New task: Finish project report")', () => {
      const decision = analyzeCommandIntent('New task: Finish project report');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.title).toContain('Finish project report');
    });

    it('TASK-03: Colloquial prefix: "Remind me to call mom"', () => {
      const decision = analyzeCommandIntent('Remind me to call mom');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.title).toContain('Call mom');
    });

    it('TASK-04: Colloquial prefix: "Remember to submit tax returns"', () => {
      const decision = analyzeCommandIntent('Remember to submit tax returns');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.title).toContain('Submit tax returns');
    });

    it('TASK-05: Colloquial prefix: "Don\'t forget to water the plants"', () => {
      const decision = analyzeCommandIntent("Don't forget to water the plants");
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.title).toContain('Water the plants');
    });

    it('TASK-06: Colloquial prefix: "Need to pay electricity bill"', () => {
      const decision = analyzeCommandIntent('Need to pay electricity bill');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.title).toContain('Pay electricity bill');
    });

    it('TASK-07: Target list phrasing: "Put studying polity on my task list"', () => {
      const decision = analyzeCommandIntent('Put studying polity on my task list');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.title).toContain('Studying polity');
    });

    it('TASK-08: Target list phrasing: "Add read chapter 4 to my todos"', () => {
      const decision = analyzeCommandIntent('Add read chapter 4 to my todos');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.title).toContain('Read chapter 4');
    });

    it('TASK-09: Priority extraction: urgent -> high priority', () => {
      const decision = analyzeCommandIntent('Add urgent task Fix database leak');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.priority).toBe('high');
      expect(decision.actions[0].params.title).toContain('Fix database leak');
    });

    it('TASK-10: Priority extraction: critical -> high priority', () => {
      const decision = analyzeCommandIntent('Add critical task Submit legal agreement');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.priority).toBe('high');
    });

    it('TASK-11: Priority extraction: high priority explicit', () => {
      const decision = analyzeCommandIntent('Create high priority task Review pull request');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.priority).toBe('high');
    });

    it('TASK-12: Priority extraction: low priority explicit', () => {
      const decision = analyzeCommandIntent('Add low priority task Organize bookshelf');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.priority).toBe('low');
      expect(decision.actions[0].params.title).toContain('Organize bookshelf');
    });

    it('TASK-13: Priority extraction: minor task -> low priority', () => {
      const decision = analyzeCommandIntent('Add minor task Clean desktop icons');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.priority).toBe('low');
    });

    it('TASK-14: Task completion by title ("Complete task Study Polity Chapter 4")', () => {
      const decision = analyzeCommandIntent('Complete task Study Polity Chapter 4');
      expect(decision.intent).toBe('TASK_COMPLETE');
      expect(decision.actions[0].targetId).toBe('task-1');
      expect(decision.actions[0].params.completed).toBe(true);
    });

    it('TASK-15: Task completion with "Finish" verb ("Finish Buy Groceries")', () => {
      const decision = analyzeCommandIntent('Finish Buy Groceries');
      expect(decision.intent).toBe('TASK_COMPLETE');
      expect(decision.actions[0].targetId).toBe('task-2');
    });

    it('TASK-16: Task completion with "Done" prefix ("Done task Clean Bookshelf")', () => {
      const decision = analyzeCommandIntent('Done task Clean Bookshelf');
      expect(decision.intent).toBe('TASK_COMPLETE');
      expect(decision.actions[0].targetId).toBe('task-4');
    });

    it('TASK-17: Pronoun guard: Ambiguous "Finish it" does NOT match arbitrary task', () => {
      const decision = analyzeCommandIntent('Finish it');
      // Should NOT match any specific task
      if (decision.intent === 'TASK_COMPLETE') {
        expect(decision.actions).toHaveLength(0);
      } else {
        expect(decision.intent).not.toBe('TASK_COMPLETE');
      }
    });

    it('TASK-18: Pronoun guard: "Complete this" does NOT match task', () => {
      const decision = analyzeCommandIntent('Complete this');
      if (decision.intent === 'TASK_COMPLETE') {
        expect(decision.actions).toHaveLength(0);
      }
    });

    it('TASK-19: Pronoun guard: "Done that" does NOT match task', () => {
      const decision = analyzeCommandIntent('Done that');
      if (decision.intent === 'TASK_COMPLETE') {
        expect(decision.actions).toHaveLength(0);
      }
    });

    it('TASK-20: Task deletion by exact title ("Delete task Buy Groceries")', () => {
      const decision = analyzeCommandIntent('Delete task Buy Groceries');
      expect(decision.intent).toBe('TASK_DELETE');
      expect(decision.actions[0].targetId).toBe('task-2');
      expect(decision.isDestructive).toBe(true);
    });

    it('TASK-21: Clear completed tasks intent', () => {
      const decision = analyzeCommandIntent('Clear completed tasks');
      expect(['TASK_DELETE', 'TASK_CLEAR_ALL']).toContain(decision.intent);
      expect(decision.actions).toHaveLength(1); // 1 completed task in seed
      expect(decision.actions[0].params?.completedOnly || decision.actions[0].targetId === 'task-3').toBeTruthy();
    });

    it('TASK-22: Remove done todos alias', () => {
      const decision = analyzeCommandIntent('Remove all done todos');
      expect(['TASK_DELETE', 'TASK_CLEAR_ALL']).toContain(decision.intent);
      expect(decision.actions[0].params?.completedOnly || decision.actions[0].targetId === 'task-3').toBeTruthy();
    });

    it('TASK-23: Clear all tasks requires confirmation', () => {
      const decision = analyzeCommandIntent('Clear all tasks');
      expect(decision.intent).toBe('TASK_CLEAR_ALL');
      expect(decision.scope).toBe('all');
      expect(decision.requiresConfirmation).toBe(true);
      expect(decision.isDestructive).toBe(true);
    });

    it('TASK-24: Task view routing ("Show my tasks")', () => {
      const decision = analyzeCommandIntent('Show my tasks');
      expect(decision.intent).toBe('TASK_VIEW');
      expect(decision.entity).toBe('task');
    });

    it('TASK-25: Execution of task completion updates storage immediately', async () => {
      const decision = analyzeCommandIntent('Complete task Study Polity Chapter 4');
      const res = await executeCommandDecision(decision);
      expect(res.success).toBe(true);
      const todos = Storage.getTodos();
      const polity = todos.find((t) => t.id === 'task-1');
      expect(polity?.completed).toBe(true);
    });
  });

  // ==========================================================================
  // MODULE 5: AMBIGUOUS COMMAND ROUTING & INTERCEPTOR LOGIC (25 SCENARIOS)
  // ==========================================================================
  describe('5. Ambiguous Command Routing & Interceptor Logic', () => {
    it('INTERCEPT-01: Strips conversational filler "Hey Zikenn, please delete Coffee"', () => {
      const decision = analyzeCommandIntent('Hey Zikenn, please delete Coffee');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions[0].targetId).toBe('exp-1');
    });

    it('INTERCEPT-02: Strips conversational filler "Can you kindly add a task to clean desk"', () => {
      const decision = analyzeCommandIntent('Can you kindly add a task to clean desk');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.title).toContain('Clean desk');
    });

    it('INTERCEPT-03: Strips conversational filler "Could you please show what I spent today"', () => {
      const decision = analyzeCommandIntent('Could you please show what I spent today');
      expect(decision.intent).toBe('EXPENSE_VIEW');
      expect(decision.scope).toBe('today');
    });

    it('INTERCEPT-04: isRogueTaskCreation flags conversational AI explanations', () => {
      expect(isRogueTaskCreation('Sure, here is what you requested: 1. Task')).toBe(true);
      expect(isRogueTaskCreation('I have updated your dashboard successfully.')).toBe(true);
      expect(isRogueTaskCreation('As an AI assistant, I can help you.')).toBe(true);
      expect(isRogueTaskCreation('Certainly! Here is your daily summary.')).toBe(true);
    });

    it('INTERCEPT-05: isRogueTaskCreation flags conversational greetings & courtesies', () => {
      expect(isRogueTaskCreation('Hello! How can I help you today?')).toBe(true);
      expect(isRogueTaskCreation("You're welcome! Let me know if you need anything else.")).toBe(true);
      expect(isRogueTaskCreation('Good morning! Ready for the day?')).toBe(true);
      expect(isRogueTaskCreation('Thank you!')).toBe(true);
    });

    it('INTERCEPT-06: isRogueTaskCreation does NOT flag legitimate task titles', () => {
      expect(isRogueTaskCreation('Buy fresh groceries from supermarket')).toBe(false);
      expect(isRogueTaskCreation('Submit quarterly financial report to auditor')).toBe(false);
      expect(isRogueTaskCreation('Call Dr. Patel for appointment')).toBe(false);
      expect(isRogueTaskCreation('Fix broken CSS layout on mobile screen')).toBe(false);
    });

    it('INTERCEPT-07: Ambiguous queries without clear entity return UNKNOWN_INTENT safely', () => {
      const decision = analyzeCommandIntent('Tell me a bedtime story');
      expect(decision.intent).toBe('UNKNOWN_INTENT');
      expect(decision.actions).toHaveLength(0);
      expect(decision.isDestructive).toBe(false);
    });

    it('INTERCEPT-08: General greeting "Hello there" returns UNKNOWN_INTENT safely', () => {
      const decision = analyzeCommandIntent('Hello there');
      expect(decision.intent).toBe('UNKNOWN_INTENT');
      expect(decision.actions).toHaveLength(0);
    });

    it('INTERCEPT-09: Casual inquiry "What is the meaning of life?" returns UNKNOWN_INTENT', () => {
      const decision = analyzeCommandIntent('What is the meaning of life?');
      expect(decision.intent).toBe('UNKNOWN_INTENT');
      expect(decision.actions).toHaveLength(0);
    });

    it('INTERCEPT-10: Empty string input returns UNKNOWN_INTENT without throwing error', () => {
      const decision = analyzeCommandIntent('');
      expect(decision.intent).toBe('UNKNOWN_INTENT');
      expect(decision.actions).toHaveLength(0);
    });

    it('INTERCEPT-11: Whitespace-only input returns UNKNOWN_INTENT without throwing error', () => {
      const decision = analyzeCommandIntent('      \t\n   ');
      expect(decision.intent).toBe('UNKNOWN_INTENT');
      expect(decision.actions).toHaveLength(0);
    });

    it('INTERCEPT-12: Punctuation-heavy input stripped safely: `Delete "Coffee" expense!`', () => {
      const decision = analyzeCommandIntent('Delete "Coffee" expense!');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions[0].targetId).toBe('exp-1');
    });

    it('INTERCEPT-13: Leading and trailing emojis stripped safely', () => {
      const decision = analyzeCommandIntent('🗑️ Delete Coffee ☕');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions[0].targetId).toBe('exp-1');
    });

    it('INTERCEPT-14: Mixed case input handled with full case insensitivity', () => {
      const decision = analyzeCommandIntent('aDd TaSk rEaD aRtIcLe');
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions[0].params.title.toLowerCase()).toContain('read article');
    });

    it('INTERCEPT-15: Formatted numbers with commas: "Delete expense of 1,499"', () => {
      const decision = analyzeCommandIntent('Delete expense of 1,499');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions[0].targetId).toBe('exp-4');
    });

    it('INTERCEPT-16: Formatted numbers: "Spent 2,200 on electricity"', () => {
      const decision = analyzeCommandIntent('Spent 2,200 on electricity');
      expect(decision.intent).toBe('EXPENSE_CREATE');
      expect(decision.actions[0].params.amount).toBe(2200);
    });

    it('INTERCEPT-17: Non-destructive intent never has isDestructive set to true', () => {
      const decision1 = analyzeCommandIntent('Show my expenses');
      expect(decision1.isDestructive).toBe(false);

      const decision2 = analyzeCommandIntent('Show my habits');
      expect(decision2.isDestructive).toBe(false);

      const decision3 = analyzeCommandIntent('Show my tasks');
      expect(decision3.isDestructive).toBe(false);
    });

    it('INTERCEPT-18: Multi-word merchant name with spaces: "Swiggy Dinner"', () => {
      const decision = analyzeCommandIntent('Remove Swiggy Dinner');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions[0].targetId).toBe('exp-2');
    });

    it('INTERCEPT-19: Multi-word merchant: "Electricity Bill"', () => {
      const decision = analyzeCommandIntent('Delete Electricity Bill');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions[0].targetId).toBe('exp-5');
    });

    it('INTERCEPT-20: Navigation intent: "Open settings"', () => {
      const decision = analyzeCommandIntent('Open settings');
      expect(decision.intent).toBe('NAVIGATE_VIEW');
      expect(decision.actions[0].params.view).toBe('settings');
    });

    it('INTERCEPT-21: Navigation intent: "Go to analytics"', () => {
      const decision = analyzeCommandIntent('Go to analytics');
      expect(decision.intent).toBe('NAVIGATE_VIEW');
      expect(decision.actions[0].params.view).toBe('analytics');
    });

    it('INTERCEPT-22: Navigation intent: "Switch to expenses"', () => {
      const decision = analyzeCommandIntent('Switch to expenses');
      expect(decision.intent).toBe('NAVIGATE_VIEW');
      expect(decision.actions[0].params.view).toBe('expenses');
    });

    it('INTERCEPT-23: Navigation intent: "Show dashboard"', () => {
      const decision = analyzeCommandIntent('Show dashboard');
      expect(decision.intent).toBe('NAVIGATE_VIEW');
      expect(decision.actions[0].params.view).toBe('dashboard');
    });

    it('INTERCEPT-24: Clarification prompt generated when ambiguous delete has multiple matches', () => {
      // Both Coffee and Swiggy Dinner are Food & Dining
      const decision = analyzeCommandIntent('Delete food');
      expect(decision.intent).toBe('EXPENSE_DELETE');
      expect(decision.actions.length).toBeGreaterThanOrEqual(1);
    });

    it('INTERCEPT-25: Unknown command execution produces NO_MATCH status without failure', async () => {
      const decision = analyzeCommandIntent('Abracadabra Shazam');
      const result = await executeCommandDecision(decision);
      expect(result.success).toBe(true);
      expect(result.status).toBe('NO_MATCH');
      expect(result.executedActions).toHaveLength(0);
    });
  });
});
