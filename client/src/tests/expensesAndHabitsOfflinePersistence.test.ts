import { describe, it, expect, beforeEach } from 'vitest';
import { Storage, STORAGE_KEYS, getScopedKey } from '../utils/storage';
import { ExpenseItem, HabitItem } from '../types';

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
    key: (idx: number) => Object.keys(store)[idx] || null,
    length: 0,
  } as any;
}

describe('Expenses and Habits Full Offline Persistence & Non-Disappearance Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    Storage.clearMemoryCaches();
  });

  describe('1. Expenses Offline Recovery and Historical Merging', () => {
    it('recovers full expense dataset from offline cache when scoped storage is empty or blank', () => {
      const historicalExpenses: ExpenseItem[] = [
        {
          id: 'exp-hist-1',
          name: 'Supermarket Groceries',
          amount: 1450,
          category: 'Groceries',
          date: '2026-09-15',
          direction: 'DEBIT',
          active: true,
        },
        {
          id: 'exp-hist-2',
          name: 'Coffee Shop',
          amount: 220,
          category: 'Food & Dining',
          date: '2026-10-01',
          direction: 'DEBIT',
          active: true,
        },
      ];

      // Simulate multi-tier offline cache populated
      localStorage.setItem('lifeos_offline_expenses_cache', JSON.stringify(historicalExpenses));
      // Scoped item is empty []
      localStorage.setItem(getScopedKey(STORAGE_KEYS.EXPENSES), '[]');

      const result = Storage.getExpenses();
      expect(result.length).toBe(2);
      expect(result.map((e) => e.id)).toContain('exp-hist-1');
      expect(result.map((e) => e.id)).toContain('exp-hist-2');
    });

    it('merges historical expenses when scoped storage only contains today transaction', () => {
      const historicalExpenses: ExpenseItem[] = [
        {
          id: 'exp-older-month',
          name: 'Flight Ticket',
          amount: 5400,
          category: 'Transport',
          date: '2026-08-10',
          direction: 'DEBIT',
          active: true,
        },
      ];
      localStorage.setItem('lifeos_offline_expenses_cache', JSON.stringify(historicalExpenses));

      const todayExpense: ExpenseItem = {
        id: 'exp-today-1',
        name: 'Lunch Bistro',
        amount: 350,
        category: 'Food & Dining',
        date: '2026-10-24',
        direction: 'DEBIT',
        active: true,
      };

      // Set only today's expense in scoped storage (simulating partial load or separate write)
      localStorage.setItem(getScopedKey(STORAGE_KEYS.EXPENSES), JSON.stringify([todayExpense]));
      Storage.clearMemoryExpensesCache();

      // Ensure reading back retrieves BOTH today's and historical expenses
      const allExpenses = Storage.getExpenses();
      expect(allExpenses.length).toBe(2);
      expect(allExpenses.some((e) => e.id === 'exp-today-1')).toBe(true);
      expect(allExpenses.some((e) => e.id === 'exp-older-month')).toBe(true);
    });

    it('setExpenses updates multi-tier offline cache', () => {
      const expenses: ExpenseItem[] = [
        {
          id: 'exp-test-offline-write',
          name: 'Broadband Bill',
          amount: 999,
          category: 'Utilities',
          date: '2026-10-24',
          direction: 'DEBIT',
          active: true,
        },
      ];

      Storage.setExpenses(expenses);

      // Verify backup exists
      const backup = localStorage.getItem('lifeos_expenses_backup');
      expect(backup).not.toBeNull();
      const parsed = JSON.parse(backup!);
      expect(parsed[0].id).toBe('exp-test-offline-write');
    });
  });

  describe('2. Habits Offline Persistence and Progress Retention', () => {
    it('persists habits to offline cache and recovers when scoped storage is lost', () => {
      const sampleHabits: HabitItem[] = [
        {
          id: 'habit-fitness-1',
          title: 'Morning Run & Core',
          category: 'Fitness',
          completedDays: [true, true, false, true, false, false, false],
          completedDates: ['2026-10-19', '2026-10-20', '2026-10-22'],
          streak: 3,
        },
      ];

      Storage.setHabits(sampleHabits);

      // Clear scoped key directly to simulate cold restart / offline reset
      localStorage.removeItem(getScopedKey(STORAGE_KEYS.HABITS));

      const recovered = Storage.getHabits();
      expect(recovered.length).toBeGreaterThan(0);
      const found = recovered.find((h) => h.id === 'habit-fitness-1');
      expect(found).toBeDefined();
      expect(found?.completedDates).toContain('2026-10-19');
      expect(found?.completedDates).toContain('2026-10-22');
    });

    it('importAllDataPayload preserves completedDates calendar history across sync', () => {
      const localHabit: HabitItem = {
        id: 'habit-study-1',
        title: 'Deep Work Session',
        category: 'Learning',
        completedDays: [true, false, false, false, false, false, false],
        completedDates: ['2026-10-05', '2026-10-12'],
        streak: 2,
        updatedAt: 1000,
      };
      Storage.setHabits([localHabit]);

      // Incoming cloud payload with another completion date
      const cloudPayload = {
        habits: [
          {
            id: 'habit-study-1',
            title: 'Deep Work Session',
            category: 'Learning',
            completedDays: [false, true, false, false, false, false, false],
            completedDates: ['2026-10-13', '2026-10-20'],
            streak: 3,
            updatedAt: 2000,
          },
        ],
      };

      Storage.importAllDataPayload(cloudPayload);

      const mergedHabits = Storage.getHabits();
      const target = mergedHabits.find((h) => h.id === 'habit-study-1');
      expect(target).toBeDefined();
      // Must contain union of all completed dates (both local and cloud)
      expect(target?.completedDates).toContain('2026-10-05');
      expect(target?.completedDates).toContain('2026-10-12');
      expect(target?.completedDates).toContain('2026-10-13');
      expect(target?.completedDates).toContain('2026-10-20');
    });

    it('persists and recovers habit history records offline', () => {
      const history = [
        {
          id: 'week-2026-09-28',
          weekStart: '2026-09-28',
          label: 'Sep 28 – Oct 04, 2026',
          days: [true, true, true, true, true, false, false],
          completionRate: 71,
        },
      ];

      Storage.setHabitHistory(history);

      // Verify offline habit history cache is populated
      const loaded = Storage.getHabitHistory();
      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe('week-2026-09-28');
    });
  });
});
