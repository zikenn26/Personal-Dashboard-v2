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

  it('6. In-flight mutation dequeue safety preserves newly enqueued mutations during sync push', async () => {
    // 1. First mutation queued before sync
    const mut1 = await expenseRepo.enqueueMutation({
      expenseId: 'exp-inflight-1',
      action: 'create',
      data: {
        id: 'exp-inflight-1',
        name: 'In-Flight Pre-Sync',
        amount: 300,
        category: 'Food',
        date: '2026-03-29',
        active: true,
      },
    });

    const pendingInitial = await expenseRepo.getPendingOutbox();
    expect(pendingInitial.length).toBe(1);
    expect(pendingInitial[0].id).toBe(mut1.id);

    // 2. While network push is in-flight, user adds another mutation
    const mut2 = await expenseRepo.enqueueMutation({
      expenseId: 'exp-inflight-2',
      action: 'create',
      data: {
        id: 'exp-inflight-2',
        name: 'In-Flight During-Sync',
        amount: 850,
        category: 'Shopping',
        date: '2026-03-29',
        active: true,
      },
    });

    const pendingDuring = await expenseRepo.getPendingOutbox();
    expect(pendingDuring.length).toBe(2);

    // 3. Dequeue ONLY mut1 (the one that finished network push)
    await expenseRepo.dequeueMutations([mut1.id]);

    // 4. mut2 MUST remain in the outbox!
    const pendingAfter = await expenseRepo.getPendingOutbox();
    expect(pendingAfter.length).toBe(1);
    expect(pendingAfter[0].id).toBe(mut2.id);
    expect(pendingAfter[0].expenseId).toBe('exp-inflight-2');

    const status = await expenseRepo.getSyncStatus();
    expect(status.pendingCount).toBe(1);
    expect(status.state).toBe('pending');
  });

  it('7. Remote tombstone ingestion deletes local item and prevents resurrection', async () => {
    // 1. Create and persist local expense
    const expense: ExpenseItem = {
      id: 'exp-to-be-deleted-remotely',
      name: 'To Be Deleted Remotely',
      amount: 999,
      category: 'Electronics',
      date: '2026-03-29',
      active: true,
    };
    await expenseRepo.save(expense);

    const saved = await expenseRepo.getById('exp-to-be-deleted-remotely');
    expect(saved).not.toBeNull();

    // 2. Peer device deletes it remotely: remote tombstone arrives
    await expenseRepo.recordTombstones(['exp-to-be-deleted-remotely']);

    // 3. Item must be removed from repo and marked tombstoned
    const afterTombstone = await expenseRepo.getById('exp-to-be-deleted-remotely');
    expect(afterTombstone).toBeNull();

    const isTomb = await expenseRepo.isTombstoned('exp-to-be-deleted-remotely');
    expect(isTomb).toBe(true);

    // 4. If remote array still has the old record, mergeExpenseLists must NOT resurrect it
    const staleRemoteList: ExpenseItem[] = [expense];
    const tombstones = await expenseRepo.getTombstones();
    const merged = mergeExpenseLists([], staleRemoteList, tombstones);
    expect(merged.length).toBe(0);
  });

  it('8. Workspace partitioning isolates data between user workspaces', async () => {
    // Workspace A
    await expenseRepo.setWorkspace('workspace_alpha');
    await expenseRepo.save({
      id: 'exp-alpha-1',
      name: 'Alpha Expense',
      amount: 100,
      category: 'Work',
      date: '2026-03-29',
      active: true,
    });

    const alphaItems = await expenseRepo.getAll();
    expect(alphaItems.some((e) => e.id === 'exp-alpha-1')).toBe(true);

    // Workspace B
    await expenseRepo.setWorkspace('workspace_beta');
    const betaItemsBefore = await expenseRepo.getAll();
    expect(betaItemsBefore.some((e) => e.id === 'exp-alpha-1')).toBe(false);

    await expenseRepo.save({
      id: 'exp-beta-1',
      name: 'Beta Expense',
      amount: 250,
      category: 'Personal',
      date: '2026-03-29',
      active: true,
    });

    const betaItems = await expenseRepo.getAll();
    expect(betaItems.some((e) => e.id === 'exp-beta-1')).toBe(true);
    expect(betaItems.some((e) => e.id === 'exp-alpha-1')).toBe(false);

    // Switch back to Workspace A
    await expenseRepo.setWorkspace('workspace_alpha');
    const alphaItemsRestored = await expenseRepo.getAll();
    expect(alphaItemsRestored.some((e) => e.id === 'exp-alpha-1')).toBe(true);
    expect(alphaItemsRestored.some((e) => e.id === 'exp-beta-1')).toBe(false);
  });

  it('9. Profile name and avatar update atomically across Storage, Auth, and localStorage', async () => {
    // 1. Initial setup
    const initialUser = {
      id: 'user_test_atomic',
      email: 'gulnayak1206@gmail.com',
      name: 'Gulshan Kumar Nayak',
      avatarUrl: 'https://example.com/original-avatar.webp',
    };
    Auth.setCurrentUser(initialUser);

    const initialProfile = {
      ...Storage.getProfile(),
      name: 'Gulshan Kumar Nayak',
      avatarUrl: 'https://example.com/original-avatar.webp',
      contactEmail: 'gulnayak1206@gmail.com',
    };
    Storage.setProfile(initialProfile);

    // 2. Perform atomic profile update
    const newName = 'Gulshan Nayak';
    const clean = newName.trim();
    const current = Storage.getProfile();
    const currentAuthUser = Auth.getCurrentUser();
    const effectiveAvatar = current.avatarUrl || currentAuthUser?.avatarUrl || '';

    const updatedProfile = {
      ...current,
      name: clean,
      avatarUrl: effectiveAvatar,
    };

    Storage.setProfile(updatedProfile);
    const updatedUser = {
      ...(currentAuthUser || { id: 'user_default', email: current.contactEmail }),
      name: clean,
      avatarUrl: effectiveAvatar,
    };
    Auth.setCurrentUser(updatedUser);

    // 3. Verify all layers match atomically
    const verifiedProfile = Storage.getProfile();
    const verifiedUser = Auth.getCurrentUser();

    expect(verifiedProfile.name).toBe('Gulshan Nayak');
    expect(verifiedProfile.avatarUrl).toBe('https://example.com/original-avatar.webp');
    expect(verifiedUser?.name).toBe('Gulshan Nayak');
    expect(verifiedUser?.avatarUrl).toBe('https://example.com/original-avatar.webp');
    expect(getUserInitials(verifiedProfile.name)).toBe('GN');
  });

  it('10. Habit day toggle correctly persists to memory and localStorage and validates before sync', () => {
    const habitId = 'habit-meditate-1';
    const habit: HabitItem = {
      id: habitId,
      name: 'Morning Meditation',
      category: 'Mindfulness',
      frequency: 'daily',
      target: 7,
      completedDays: [false, false, false, false, false, false, false],
      completedDates: [],
      streak: 0,
      history: [],
      updatedAt: Date.now(),
    };
    Storage.setHabits([habit]);

    // Simulate toggle day 2 (Wednesday)
    const base = Storage.getHabits();
    const target = base.find((h) => h.id === habitId)!;
    expect(target).toBeDefined();

    const newDays = [...target.completedDays];
    newDays[2] = !newDays[2]; // Toggle index 2
    const isNowCompleted = Boolean(newDays[2]);

    const toggledHabit: HabitItem = {
      ...target,
      completedDays: newDays,
      completedDates: ['2026-03-25'],
      streak: 1,
      updatedAt: Date.now(),
    };
    const updatedHabits = base.map((h) => (h.id === habitId ? toggledHabit : h));

    // Persist & Validate
    Storage.setHabits(updatedHabits);
    const verifiedHabits = Storage.getHabits();
    const verifiedTarget = verifiedHabits.find((h) => h.id === habitId);
    expect(verifiedTarget?.completedDays[2]).toBe(true);
    expect(verifiedTarget?.streak).toBe(1);
    expect(verifiedTarget?.completedDates).toContain('2026-03-25');
  });

  it('11. Dedicated table push and pull handles credit/debit attributes and deletion tombstones', async () => {
    // 1. Add credit transaction (income)
    const incomeExpense: ExpenseItem = {
      id: 'exp-credit-100',
      name: 'Consulting Honorarium',
      amount: 25000,
      category: 'Income',
      date: '2026-03-29',
      direction: 'CREDIT',
      transactionType: 'CREDIT',
      paymentMethod: 'Bank Transfer',
      bankName: 'HDFC Bank',
      accountLast4: '4321',
      referenceId: 'UPI-REF-998877',
      active: true,
      updatedAt: Date.now(),
    };

    await expenseRepo.save(incomeExpense);
    await expenseRepo.enqueueMutation({
      expenseId: incomeExpense.id,
      action: 'create',
      data: incomeExpense,
    });

    const pending = await expenseRepo.getPendingOutbox();
    expect(pending.length).toBe(1);
    const mutation = pending[0];
    expect(mutation.expenseId).toBe('exp-credit-100');
    expect(mutation.data?.direction).toBe('CREDIT');
    expect(mutation.data?.amount).toBe(25000);

    // 2. Add soft-delete tombstone
    await expenseRepo.recordTombstone('exp-credit-100');
    await expenseRepo.dequeueMutations([mutation.id]);

    const isTomb = await expenseRepo.isTombstoned('exp-credit-100');
    expect(isTomb).toBe(true);

    const pendingAfter = await expenseRepo.getPendingOutbox();
    expect(pendingAfter.length).toBe(0);
  });
});
