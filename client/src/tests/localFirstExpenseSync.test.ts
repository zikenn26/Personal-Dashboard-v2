import { beforeAll, describe, it, expect, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { expenseRepo } from '../repositories/expenseRepository';
import { expenseSyncService } from '../services/expenseSyncService';
import { Storage } from '../utils/storage';
import { Auth } from '../utils/auth';
import { getUserInitials } from '../utils/userUtils';
import { mergeExpenseLists } from '../utils/expenseUtils';
import { ExpenseItem, HabitItem } from '../types';

beforeAll(() => {
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

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
});

describe('Local-First Expense Storage & Reliable Sync Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    Storage.clearMemoryCaches();
    await expenseRepo.init();
    await expenseRepo.clear();
    await expenseRepo.clearOutbox();
  });

  it('1. Expense CRUD commits locally to repository and enqueues outbox mutation with tombstones', async () => {
    const expense: ExpenseItem = {
      id: 'exp-loc-1',
      name: 'Groceries Local First',
      amount: 450,
      category: 'Food & Dining',
      date: '2026-03-29',
      paymentMethod: 'UPI',
      billingCycle: 'one-time',
      active: true,
      updatedAt: Date.now(),
    };

    // Add expense via Storage which drives local-first DB and outbox queue
    Storage.addExpense(expense);
    await new Promise((r) => setTimeout(r, 50));

    const inDb = await expenseRepo.getById('exp-loc-1');
    expect(inDb).toBeDefined();
    expect(inDb?.name).toBe('Groceries Local First');
    expect(inDb?.amount).toBe(450);

    // Outbox mutation must be enqueued
    const outboxAfterAdd = await expenseRepo.getPendingOutbox();
    expect(outboxAfterAdd.length).toBeGreaterThanOrEqual(1);
    expect(outboxAfterAdd.some((m) => m.expenseId === 'exp-loc-1')).toBe(true);

    // Delete expense locally creates tombstone
    Storage.deleteExpense('exp-loc-1');
    await new Promise((r) => setTimeout(r, 50));

    const inDbAfterDelete = await expenseRepo.getById('exp-loc-1');
    expect(inDbAfterDelete).toBeNull();

    const tombstones = await expenseRepo.getTombstones();
    expect(tombstones.has('exp-loc-1')).toBe(true);

    const outboxAfterDelete = await expenseRepo.getPendingOutbox();
    const deleteMutation = outboxAfterDelete.find((m) => m.expenseId === 'exp-loc-1' && m.action === 'delete');
    expect(deleteMutation).toBeDefined();
  });

  it('2. Remote sync reconciliation respects deletion tombstones and never resurrects deleted items', () => {
    const localExpenses: ExpenseItem[] = [
      {
        id: 'exp-loc-2',
        title: 'Coffee at Blue Tokai',
        amount: 220,
        category: 'Food & Dining',
        date: '2026-03-29',
        paymentMethod: 'UPI',
        billingCycle: 'one-time',
        active: true,
        updatedAt: 1000,
      },
    ];

    // Remote contains an item that was deleted locally ('exp-deleted-99')
    const remoteExpenses: ExpenseItem[] = [
      ...localExpenses,
      {
        id: 'exp-deleted-99',
        title: 'Stale Remote Expense',
        amount: 1500,
        category: 'Shopping',
        date: '2026-03-25',
        paymentMethod: 'Credit Card',
        billingCycle: 'one-time',
        active: true,
        updatedAt: 500,
      },
    ];

    const tombstones = new Set<string>(['exp-deleted-99']);
    const merged = mergeExpenseLists(localExpenses, remoteExpenses, tombstones);

    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe('exp-loc-2');
    expect(merged.find((e) => e.id === 'exp-deleted-99')).toBeUndefined();
  });

  it('3. Habit completions across days (Mon, Tue, Wed) persist and are never unticked by remote background sync', () => {
    const habitId = 'habit-study-1';
    const habit: HabitItem = {
      id: habitId,
      name: 'Deep Work & Study',
      category: 'Learning',
      frequency: 'daily',
      target: 7,
      completedDays: [true, true, true, false, false, false, false], // Mon, Tue, Wed
      completedDates: ['2026-03-23', '2026-03-24', '2026-03-25'],
      streak: 3,
      history: [],
      updatedAt: Date.now(),
    };

    Storage.setHabits([habit]);

    // Simulate incoming remote payload from Supabase with older unticked state (completedDays: all false)
    const staleCloudPayload = {
      habits: [
        {
          id: habitId,
          name: 'Deep Work & Study',
          category: 'Learning',
          frequency: 'daily',
          target: 7,
          completedDays: [false, false, false, false, false, false, false], // Cloud older state
          completedDates: [],
          streak: 0,
          history: [],
          updatedAt: habit.updatedAt! - 50000, // Older timestamp
        },
      ],
      _meta: {
        timestamp: Date.now() + 10000, // Remote server clock might be ahead
      },
    };

    // Run importAllDataPayload
    Storage.importAllDataPayload(staleCloudPayload);

    // Verify local ticks on Mon, Tue, Wed remain ticked and are NOT unticked!
    const persistedHabits = Storage.getHabits();
    const persistedHabit = persistedHabits.find((h) => h.id === habitId);
    expect(persistedHabit).toBeDefined();
    expect(persistedHabit?.completedDays[0]).toBe(true);
    expect(persistedHabit?.completedDays[1]).toBe(true);
    expect(persistedHabit?.completedDays[2]).toBe(true);
    expect(persistedHabit?.completedDates).toContain('2026-03-23');
    expect(persistedHabit?.completedDates).toContain('2026-03-24');
    expect(persistedHabit?.completedDates).toContain('2026-03-25');
  });

  it('4. Custom profile name "Gulshan Nayak" persists and produces initial "GN" instead of "GK"', async () => {
    // Initial profile
    const profile = Storage.getProfile();
    const updated = {
      ...profile,
      name: 'Gulshan Nayak',
      contactEmail: 'gknayak@gmail.com',
    };

    Storage.setProfile(updated);
    await Auth.updateCurrentUserName('Gulshan Nayak');

    const freshProfile = Storage.getProfile();
    expect(freshProfile.name).toBe('Gulshan Nayak');

    // Initials calculation for "Gulshan Nayak" must be GN (not GK)
    const initials = getUserInitials(freshProfile.name);
    expect(initials).toBe('GN');

    // Simulate cloud workspace payload containing older/default "Gulshan Kumar Nayak"
    const cloudPayloadWithOldName = {
      profile: {
        ...freshProfile,
        name: 'Gulshan Kumar Nayak',
        contactEmail: 'gknayak@gmail.com',
      },
    };

    Storage.importAllDataPayload(cloudPayloadWithOldName);

    // Custom name "Gulshan Nayak" must be preserved!
    const rehydrated = Storage.getProfile();
    expect(rehydrated.name).toBe('Gulshan Nayak');
    expect(getUserInitials(rehydrated.name)).toBe('GN');
  });

  it('5. Storage.initLocalExpenseDb migrates localStorage expenses into IndexedDB idempotently', async () => {
    const legacyExpenses: ExpenseItem[] = [
      {
        id: 'legacy-1',
        title: 'Electricity Bill',
        amount: 1200,
        category: 'Bills & Utilities',
        date: '2026-03-28',
        paymentMethod: 'UPI',
        billingCycle: 'monthly',
        active: true,
      },
      {
        id: 'legacy-2',
        title: 'Metro Card Recharge',
        amount: 500,
        category: 'Transport',
        date: '2026-03-29',
        paymentMethod: 'Card',
        billingCycle: 'one-time',
        active: true,
      },
    ];

    Storage.setExpenses(legacyExpenses);

    const loaded = await Storage.initLocalExpenseDb();
    expect(loaded.length).toBeGreaterThanOrEqual(2);
    expect(loaded.some((e) => e.id === 'legacy-1')).toBe(true);
    expect(loaded.some((e) => e.id === 'legacy-2')).toBe(true);

    const inRepo = await expenseRepo.getAll();
    expect(inRepo.some((e) => e.id === 'legacy-1')).toBe(true);
    expect(inRepo.some((e) => e.id === 'legacy-2')).toBe(true);
  });
});
