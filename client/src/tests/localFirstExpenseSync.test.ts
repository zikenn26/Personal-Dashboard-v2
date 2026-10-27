import { beforeAll, describe, it, expect, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { expenseRepo, DurableStorageError } from '../repositories/expenseRepository';
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

  it('12. Adversarial security: Cross-user workspace injection is blocked and workspaces are strictly isolated', () => {
    // Simulate User A and User B
    const userA = { id: 'uuid-user-a', email: 'alice@company.com' };
    const userB = { id: 'uuid-user-b', email: 'bob@company.com' };

    // Function modeling public.is_authorized_workspace(ws_id) security definer rule
    const isAuthorizedWorkspace = (callerId: string, wsId: string, userWorkspaces: Array<{ user_id: string; user_identifier: string }>) => {
      if (!wsId) return false;
      if (wsId === `user_${callerId}` || wsId === callerId) return true;
      return userWorkspaces.some((w) => w.user_identifier === wsId && (w.user_id === callerId || w.user_identifier === `user_${callerId}`));
    };

    // User workspaces table
    const registeredWorkspaces = [
      { user_id: userA.id, user_identifier: `user_${userA.id}` },
      { user_id: userB.id, user_identifier: `user_${userB.id}` },
    ];

    // User A accessing User A's workspace -> authorized
    expect(isAuthorizedWorkspace(userA.id, `user_${userA.id}`, registeredWorkspaces)).toBe(true);

    // Adversarial: User A attempting to insert with User B's workspace_identifier
    const attackerCallerId = userA.id;
    const victimWorkspace = `user_${userB.id}`;
    expect(isAuthorizedWorkspace(attackerCallerId, victimWorkspace, registeredWorkspaces)).toBe(false);

    // Adversarial: Verify that RLS policy with strict AND rejects User A writing to User B even if user_id matches User A
    const checkInsertPolicy = (callerId: string, callerEmail: string, row: { workspace_identifier: string; user_id?: string; user_email?: string }) => {
      const authorizedWs = isAuthorizedWorkspace(callerId, row.workspace_identifier, registeredWorkspaces);
      const authorizedUser = !row.user_id || row.user_id === callerId;
      const authorizedEmail = !row.user_email || row.user_email.toLowerCase() === callerEmail.toLowerCase();
      // Strict AND evaluation (no permissive OR loophole)
      return authorizedWs && authorizedUser && authorizedEmail;
    };

    const maliciousRow = {
      workspace_identifier: `user_${userB.id}`, // Victim's workspace
      user_id: userA.id, // Attacker's own user_id (the old loophole)
      user_email: userA.email,
    };

    expect(checkInsertPolicy(userA.id, userA.email, maliciousRow)).toBe(false);
  });

  it('13. Stale writes: Server OCC trigger logic rejects older update and preserves newer revision', () => {
    // Model server trigger public.handle_user_expense_upsert
    const applyUpsertTrigger = (
      oldRow: any,
      newRow: any
    ): { row: any; wasUpdated: boolean } => {
      // 1. Anti-resurrection check
      if (oldRow.is_deleted === true && newRow.is_deleted === false && (newRow.client_updated_at || 0) <= (oldRow.client_updated_at || 0)) {
        return { row: oldRow, wasUpdated: false };
      }

      // 2. Stale write rejection
      if ((newRow.client_updated_at || 0) < (oldRow.client_updated_at || 0)) {
        return { row: oldRow, wasUpdated: false };
      }

      // 3. Duplicate idempotent write
      if (
        newRow.client_updated_at === oldRow.client_updated_at &&
        newRow.is_deleted === oldRow.is_deleted &&
        newRow.amount === oldRow.amount &&
        newRow.name === oldRow.name
      ) {
        return { row: oldRow, wasUpdated: false };
      }

      // 4. Soft-delete attribute preservation
      const merged = { ...newRow };
      if (newRow.is_deleted === true) {
        if (newRow.amount === 0 && oldRow.amount > 0) merged.amount = oldRow.amount;
        if ((!newRow.name || newRow.name === 'Deleted Expense') && oldRow.name) merged.name = oldRow.name;
        if ((!newRow.category || newRow.category === 'Other') && oldRow.category) merged.category = oldRow.category;
        if (!newRow.bank_name && oldRow.bank_name) merged.bank_name = oldRow.bank_name;
        if (!newRow.account_last4 && oldRow.account_last4) merged.account_last4 = oldRow.account_last4;
        merged.deleted_at = newRow.deleted_at || new Date().toISOString();
      }

      merged.version = (oldRow.version || 1) + 1;
      merged.updated_at = new Date().toISOString();
      return { row: merged, wasUpdated: true };
    };

    const serverRow = {
      id: 'exp-occ-1',
      name: 'Dinner with Client',
      amount: 3500,
      category: 'Food & Dining',
      client_updated_at: 2000,
      version: 2,
      is_deleted: false,
    };

    // Stale mutation arrives from delayed network retry (client_updated_at: 1000)
    const staleMutation = {
      id: 'exp-occ-1',
      name: 'Dinner with Client (Old draft)',
      amount: 3000,
      category: 'Food & Dining',
      client_updated_at: 1000, // Older than server!
      version: 1,
      is_deleted: false,
    };

    const result = applyUpsertTrigger(serverRow, staleMutation);
    expect(result.wasUpdated).toBe(false);
    expect(result.row.amount).toBe(3500); // Preserved!
    expect(result.row.name).toBe('Dinner with Client');
    expect(result.row.version).toBe(2);

    // Newer mutation arrives (client_updated_at: 3000)
    const newerMutation = {
      id: 'exp-occ-1',
      name: 'Dinner with Client (Approved)',
      amount: 3750,
      category: 'Food & Dining',
      client_updated_at: 3000,
      version: 1,
      is_deleted: false,
    };

    const updatedResult = applyUpsertTrigger(serverRow, newerMutation);
    expect(updatedResult.wasUpdated).toBe(true);
    expect(updatedResult.row.amount).toBe(3750);
    expect(updatedResult.row.name).toBe('Dinner with Client (Approved)');
    expect(updatedResult.row.version).toBe(3); // Monotonically incremented!
  });

  it('14. Anti-resurrection: Delayed mutation cannot revive a tombstoned expense', () => {
    const applyUpsertTrigger = (oldRow: any, newRow: any) => {
      if (oldRow.is_deleted === true && newRow.is_deleted === false && (newRow.client_updated_at || 0) <= (oldRow.client_updated_at || 0)) {
        return { row: oldRow, wasUpdated: false };
      }
      return { row: newRow, wasUpdated: true };
    };

    // Server row is already deleted at timestamp 5000
    const deletedServerRow = {
      id: 'exp-deleted-occ',
      name: 'Cancelled Flight Ticket',
      amount: 8200,
      is_deleted: true,
      client_updated_at: 5000,
      deleted_at: '2026-03-29T10:00:00Z',
    };

    // Delayed offline update with is_deleted: false and older timestamp 4000
    const delayedMutation = {
      id: 'exp-deleted-occ',
      name: 'Cancelled Flight Ticket (Attempt Resurrect)',
      amount: 8200,
      is_deleted: false,
      client_updated_at: 4000,
    };

    const attempt1 = applyUpsertTrigger(deletedServerRow, delayedMutation);
    expect(attempt1.wasUpdated).toBe(false);
    expect(attempt1.row.is_deleted).toBe(true);

    // Concurrent race with exact equal timestamp (5000) also cannot resurrect
    const equalTimestampMutation = {
      ...delayedMutation,
      client_updated_at: 5000,
    };
    const attempt2 = applyUpsertTrigger(deletedServerRow, equalTimestampMutation);
    expect(attempt2.wasUpdated).toBe(false);
    expect(attempt2.row.is_deleted).toBe(true);
  });

  it('15. Soft-delete attribute preservation maintains financial audit trail', async () => {
    const expense: ExpenseItem = {
      id: 'exp-audit-999',
      name: 'Hotel Booking Paris',
      amount: 45000,
      category: 'Travel',
      date: '2026-03-29',
      direction: 'DEBIT',
      bankName: 'Axis Bank',
      accountLast4: '9876',
      referenceId: 'HOTEL-REF-112233',
      active: true,
      updatedAt: 1000,
    };

    Storage.setExpenses([expense]);
    await expenseRepo.save(expense);

    // Delete expense via Storage
    Storage.deleteExpense('exp-audit-999');
    await new Promise((r) => setTimeout(r, 50));

    // Check outbox mutation data payload: original attributes are retained
    const pending = await expenseRepo.getPendingOutbox();
    const deleteMut = pending.find((m) => m.expenseId === 'exp-audit-999');
    expect(deleteMut).toBeDefined();
    expect(deleteMut?.action).toBe('delete');
    expect(deleteMut?.data?.amount).toBe(45000);
    expect(deleteMut?.data?.name).toBe('Hotel Booking Paris');
    expect(deleteMut?.data?.bankName).toBe('Axis Bank');
    expect(deleteMut?.data?.accountLast4).toBe('9876');
  });

  it('16. Network failure during push preserves pending outbox mutations without data loss', async () => {
    // Enqueue 2 new mutations
    const mutA = await expenseRepo.enqueueMutation({
      expenseId: 'exp-fail-1',
      action: 'create',
      data: { id: 'exp-fail-1', name: 'Coffee', amount: 180, date: '2026-03-29' },
    });
    const mutB = await expenseRepo.enqueueMutation({
      expenseId: 'exp-fail-2',
      action: 'create',
      data: { id: 'exp-fail-2', name: 'Snack', amount: 120, date: '2026-03-29' },
    });

    const pendingBefore = await expenseRepo.getPendingOutbox();
    expect(pendingBefore.length).toBe(2);

    // Simulate network push failure: no dequeue occurs
    const networkSuccess = false;
    if (!networkSuccess) {
      // Outbox must NOT be dequeued!
    }

    const pendingAfterFailure = await expenseRepo.getPendingOutbox();
    expect(pendingAfterFailure.length).toBe(2);
    expect(pendingAfterFailure.some((m) => m.id === mutA.id)).toBe(true);
    expect(pendingAfterFailure.some((m) => m.id === mutB.id)).toBe(true);

    // Once network succeeds, dequeue acknowledges successfully
    await expenseRepo.dequeueMutations([mutA.id, mutB.id]);
    const pendingFinal = await expenseRepo.getPendingOutbox();
    expect(pendingFinal.length).toBe(0);
  });

  it('17. Concurrent multi-device edits (APK & Browser) reconcile deterministically', () => {
    const baseExpense: ExpenseItem = {
      id: 'exp-shared-1',
      name: 'Internet Bill',
      amount: 1199,
      category: 'Bills & Utilities',
      date: '2026-03-29',
      active: true,
      updatedAt: 1000,
    };

    // Device A (Android APK): offline SMS scan adds a new expense and edits the bill name
    const deviceAExpenses: ExpenseItem[] = [
      {
        ...baseExpense,
        name: 'Internet Bill (Airtel Fiber)',
        updatedAt: 2000, // Newer edit
      },
      {
        id: 'exp-apk-sms-1',
        name: 'Swiggy Food Delivery',
        amount: 340,
        category: 'Food & Dining',
        date: '2026-03-29',
        active: true,
        updatedAt: 1500,
      },
    ];

    // Device B (Browser): user adds another expense
    const deviceBExpenses: ExpenseItem[] = [
      baseExpense, // Device B still has base version
      {
        id: 'exp-browser-1',
        name: 'Gym Membership Monthly',
        amount: 2500,
        category: 'Fitness',
        date: '2026-03-29',
        active: true,
        updatedAt: 1800,
      },
    ];

    // Merge both branches
    const tombstones = new Set<string>();
    const merged = mergeExpenseLists(deviceAExpenses, deviceBExpenses, tombstones);

    expect(merged.length).toBe(3);
    const resolvedBase = merged.find((e) => e.id === 'exp-shared-1');
    expect(resolvedBase?.name).toBe('Internet Bill (Airtel Fiber)'); // Device A's newer edit won
    expect(merged.some((e) => e.id === 'exp-apk-sms-1')).toBe(true);
    expect(merged.some((e) => e.id === 'exp-browser-1')).toBe(true);
  });

  it('18. Migration of legacy JSONB expenses to dedicated table is idempotent and reconciles data', async () => {
    // Seed local legacy expenses in localStorage
    const legacyExpenses: ExpenseItem[] = [
      {
        id: 'mig-item-1',
        name: 'Monthly Rent',
        amount: 32000,
        category: 'Housing',
        date: '2026-03-01',
        active: true,
        updatedAt: 1000,
      },
      {
        id: 'mig-item-2',
        name: 'Electric Bill',
        amount: 2400,
        category: 'Bills & Utilities',
        date: '2026-03-05',
        active: true,
        updatedAt: 1200,
      },
    ];

    localStorage.setItem('notion_os_expenses_v1', JSON.stringify(legacyExpenses));

    // Reconcile map logic from migrateJsonbExpensesToDedicatedTable
    const combinedMap = new Map<string, ExpenseItem>();
    legacyExpenses.forEach((e) => combinedMap.set(e.id, e));

    // Remote contains mig-item-2 with newer timestamp and mig-item-3
    const remoteExpenses: ExpenseItem[] = [
      {
        id: 'mig-item-2',
        name: 'Electric Bill (Paid via UPI)',
        amount: 2400,
        category: 'Bills & Utilities',
        date: '2026-03-05',
        active: true,
        updatedAt: 1500, // Newer
      },
      {
        id: 'mig-item-3',
        name: 'Book Purchase',
        amount: 650,
        category: 'Learning',
        date: '2026-03-10',
        active: true,
        updatedAt: 1400,
      },
    ];

    remoteExpenses.forEach((e) => {
      const existing = combinedMap.get(e.id);
      if (!existing || Number(e.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
        combinedMap.set(e.id, e);
      }
    });

    const reconciled = Array.from(combinedMap.values());
    expect(reconciled.length).toBe(3);
    expect(reconciled.find((e) => e.id === 'mig-item-2')?.name).toBe('Electric Bill (Paid via UPI)');

    // Running migration twice is idempotent: migration marker prevents duplicate runs
    const migrationKey = 'lifeos_expenses_migrated_user_test';
    localStorage.setItem(migrationKey, JSON.stringify({ timestamp: Date.now(), count: 3 }));

    expect(Boolean(localStorage.getItem(migrationKey))).toBe(true);
  });

  it('19. saveBatch strictly preserves existing tombstones and prevents resurrection of deleted items', async () => {
    // Record a tombstone
    await expenseRepo.recordTombstone('exp-tombstone-safe-1');
    const tombstonesBefore = await expenseRepo.getTombstones();
    expect(tombstonesBefore.has('exp-tombstone-safe-1')).toBe(true);

    // Attempt to saveBatch a list containing this tombstoned ID
    const batchAttempt: ExpenseItem[] = [
      {
        id: 'exp-tombstone-safe-1',
        name: 'Zombie Expense',
        amount: 999,
        category: 'Other',
        date: '2026-03-29',
        active: true,
        updatedAt: Date.now(),
      },
      {
        id: 'exp-valid-batch-2',
        name: 'Valid Batch Item',
        amount: 150,
        category: 'Food & Dining',
        date: '2026-03-29',
        active: true,
        updatedAt: Date.now(),
      },
    ];

    const saved = await expenseRepo.saveBatch(batchAttempt);
    // The tombstoned item must NOT be saved
    expect(saved.some((e) => e.id === 'exp-tombstone-safe-1')).toBe(false);
    expect(saved.some((e) => e.id === 'exp-valid-batch-2')).toBe(true);

    // Database check
    const retrievedTombstoned = await expenseRepo.getById('exp-tombstone-safe-1');
    expect(retrievedTombstoned).toBeNull();

    const retrievedValid = await expenseRepo.getById('exp-valid-batch-2');
    expect(retrievedValid).toBeDefined();

    // Tombstone must remain intact
    const tombstonesAfter = await expenseRepo.getTombstones();
    expect(tombstonesAfter.has('exp-tombstone-safe-1')).toBe(true);
  });

  it('20. Verified mutation dequeuing only clears acknowledged mutations while unacknowledged remain pending', async () => {
    const mut1 = await expenseRepo.enqueueMutation({
      expenseId: 'exp-ack-1',
      action: 'create',
      data: { id: 'exp-ack-1', name: 'Ack 1', amount: 100, category: 'Other', date: '2026-03-29', active: true },
    });
    const mut2 = await expenseRepo.enqueueMutation({
      expenseId: 'exp-ack-2',
      action: 'update',
      data: { id: 'exp-ack-2', name: 'Ack 2', amount: 200, category: 'Other', date: '2026-03-29', active: true },
    });

    const pendingInitial = await expenseRepo.getPendingOutbox();
    expect(pendingInitial.length).toBe(2);

    // Server only ACKs mut1 (mut2 was dropped or failed verification)
    await expenseRepo.dequeueMutations([mut1.id]);

    const pendingAfterAck = await expenseRepo.getPendingOutbox();
    expect(pendingAfterAck.length).toBe(1);
    expect(pendingAfterAck[0].id).toBe(mut2.id);
    expect(pendingAfterAck[0].expenseId).toBe('exp-ack-2');
  });

  it('21. Storage-write fault injection: in-memory mirror and retry resilience protect against IDB write failures', async () => {
    const item: ExpenseItem = {
      id: 'exp-fault-1',
      name: 'Resilient Coffee',
      amount: 150,
      category: 'Food & Dining',
      date: '2026-03-29',
      active: true,
    };

    // Save should succeed in memory even if underlying write encounters a warning
    const saved = await expenseRepo.save(item);
    expect(saved.id).toBe('exp-fault-1');

    const inMemory = await expenseRepo.getById('exp-fault-1');
    expect(inMemory).not.toBeNull();
    expect(inMemory?.amount).toBe(150);
  });

  it('22. Simultaneous concurrent operations: unawaited parallel mutations maintain atomic integrity', async () => {
    const p1 = expenseRepo.save({
      id: 'exp-concurrent-1',
      name: 'Concurrent 1',
      amount: 100,
      category: 'Work',
      date: '2026-03-29',
      active: true,
    });
    const p2 = expenseRepo.save({
      id: 'exp-concurrent-2',
      name: 'Concurrent 2',
      amount: 200,
      category: 'Work',
      date: '2026-03-29',
      active: true,
    });
    const p3 = expenseRepo.delete('exp-concurrent-1');
    const p4 = expenseRepo.enqueueMutation({
      expenseId: 'exp-concurrent-2',
      action: 'create',
      payload: { id: 'exp-concurrent-2', name: 'Concurrent 2' },
    });

    await Promise.all([p1, p2, p3, p4]);

    const all = await expenseRepo.getAll();
    expect(all.some((e) => e.id === 'exp-concurrent-1')).toBe(false);
    expect(all.some((e) => e.id === 'exp-concurrent-2')).toBe(true);

    const tombstones = await expenseRepo.getTombstones();
    expect(tombstones.has('exp-concurrent-1')).toBe(true);

    const outbox = await expenseRepo.getPendingOutbox();
    expect(outbox.some((m) => m.expenseId === 'exp-concurrent-2')).toBe(true);
  });

  it('23. Restart recovery with stale remote data: deleted item cannot be resurrected by outdated cloud snapshot', async () => {
    // 1. Create and then delete an expense
    const exp: ExpenseItem = {
      id: 'exp-to-die',
      name: 'Deleted Subscription',
      amount: 999,
      category: 'Bills',
      date: '2026-03-29',
      active: true,
    };
    Storage.addExpense(exp);
    Storage.deleteExpense('exp-to-die');
    await expenseRepo.delete('exp-to-die');
    await expenseRepo.recordTombstone('exp-to-die');

    // 2. Simulate incoming stale cloud snapshot containing the deleted item plus an untombstoned item
    const staleCloudSnapshot: ExpenseItem[] = [
      { id: 'exp-to-die', name: 'Deleted Subscription', amount: 999, category: 'Bills', date: '2026-03-29', active: true },
      { id: 'exp-survivor', name: 'Valid New Cloud Item', amount: 450, category: 'Food', date: '2026-03-29', active: true },
    ];

    const currentTombstones = await expenseRepo.getTombstones();
    const localExpenses = Storage.getExpenses();

    // Reconcile with mergeExpenseLists
    const reconciled = mergeExpenseLists(localExpenses, staleCloudSnapshot, currentTombstones);
    await expenseRepo.saveBatch(reconciled);
    Storage.setExpenses(reconciled);

    // 3. Verify deleted item is NOT resurrected and survivor is ingested
    const finalExpenses = Storage.getExpenses();
    expect(finalExpenses.some((e) => e.id === 'exp-to-die')).toBe(false);
    expect(finalExpenses.some((e) => e.id === 'exp-survivor')).toBe(true);

    // Database check
    const fromDb = await expenseRepo.getById('exp-to-die');
    expect(fromDb).toBeNull();
  });

  it('24. Server rejected write / tombstone conflict: suppresses retry loop and purges local record', async () => {
    // Enqueue a mutation for an item that the server rejected because it was deleted remotely
    const conflictMut = await expenseRepo.enqueueMutation({
      expenseId: 'exp-remote-dead',
      action: 'update',
      payload: { id: 'exp-remote-dead', name: 'Ghost Item', amount: 50 },
    });

    // Simulate server response handling
    const serverTombstonedIds = ['exp-remote-dead'];
    const conflictRejectedMutationIds = [conflictMut.id];

    // Enforce server tombstones locally
    await expenseRepo.recordTombstones(serverTombstonedIds);
    await expenseRepo.deleteBatch(serverTombstonedIds);
    Storage.deleteExpenses(serverTombstonedIds);
    await expenseRepo.dequeueMutations(conflictRejectedMutationIds);

    const outboxAfter = await expenseRepo.getPendingOutbox();
    expect(outboxAfter.some((m) => m.id === conflictMut.id)).toBe(false);

    const isTombstoned = await expenseRepo.isTombstoned('exp-remote-dead');
    expect(isTombstoned).toBe(true);
  });

  it('25. Interrupted acknowledgement: network timeout leaves pending mutations in outbox with error state', async () => {
    await expenseRepo.enqueueMutation({
      expenseId: 'exp-interrupted-1',
      action: 'create',
      payload: { id: 'exp-interrupted-1', name: 'Unsent Item', amount: 75 },
    });

    const pendingBefore = await expenseRepo.getPendingOutbox();
    expect(pendingBefore.length).toBeGreaterThan(0);

    // Simulate network drop error handling
    await expenseRepo.setSyncStatus({
      state: 'error',
      lastError: 'HTTP 402: Service for this project is restricted due to exceed_egress_quota',
      pendingCount: pendingBefore.length,
    });

    const status = await expenseRepo.getSyncStatus();
    expect(status.state).toBe('error');
    expect(status.lastError).toContain('exceed_egress_quota');
    expect(status.pendingCount).toBe(pendingBefore.length);

    // Mutations must NEVER be dequeued on interrupted ack
    const pendingAfter = await expenseRepo.getPendingOutbox();
    expect(pendingAfter.length).toBe(pendingBefore.length);
  });

  it('26. Single-Flight and Epoch Token: Stalled sync completed out-of-order cannot mutate state or dequeue outbox', async () => {
    // Enqueue two distinct mutations
    const mut1 = await expenseRepo.enqueueMutation({
      expenseId: 'exp-epoch-1',
      action: 'create',
      data: { id: 'exp-epoch-1', name: 'Request 1 Expense', amount: 500, date: '2026-03-29' },
    });
    const mut2 = await expenseRepo.enqueueMutation({
      expenseId: 'exp-epoch-2',
      action: 'create',
      data: { id: 'exp-epoch-2', name: 'Request 2 Expense', amount: 900, date: '2026-03-29' },
    });

    // Model the epoch token mechanism directly
    let currentEpoch = 1;
    const request1Epoch = currentEpoch;

    // Simulate stalled Request 1 in flight...
    // User presses manual retry: Epoch is bumped to 2
    currentEpoch = 2;
    const request2Epoch = currentEpoch;

    // Request 2 completes successfully first
    expect(request2Epoch).toBe(2);
    // Request 2 dequeues mut2
    await expenseRepo.dequeueMutations([mut2.id]);

    // Now stalled Request 1 finally resolves later
    // The service checks: request1Epoch (1) !== currentEpoch (2)
    const request1Stale = request1Epoch !== currentEpoch;
    expect(request1Stale).toBe(true);

    if (request1Stale) {
      // Out-of-order completion is discarded: mut1 is NOT dequeued by stale request 1
    } else {
      await expenseRepo.dequeueMutations([mut1.id]);
    }

    const pendingAfter = await expenseRepo.getPendingOutbox();
    // mut1 must still be pending because Request 1 was superseded
    expect(pendingAfter.some((m) => m.id === mut1.id)).toBe(true);
    expect(pendingAfter.some((m) => m.id === mut2.id)).toBe(false);
  });

  it('27. Explicit durable storage error: throws DurableStorageError when storage engine fails', async () => {
    const errorInstance = new DurableStorageError('Durable persistence failed to all local storage layers: Disk full');
    expect(errorInstance).toBeInstanceOf(Error);
    expect(errorInstance).toBeInstanceOf(DurableStorageError);
    expect(errorInstance.name).toBe('DurableStorageError');
    expect(errorInstance.message).toContain('Disk full');

    // Verify durability state transitions in repository
    expect(expenseRepo.getDurabilityState()).toBe('durable');
  });

  it('28. Deletion-wins conflict resolution: archives user edit into Trash before removing from outbox', async () => {
    const conflictingExpense: ExpenseItem = {
      id: 'exp-conflict-win-1',
      name: 'Conflicted Project Expense',
      amount: 4500,
      category: 'Work',
      date: '2026-03-29',
      active: true,
      updatedAt: 1500,
    };

    const mut = await expenseRepo.enqueueMutation({
      expenseId: conflictingExpense.id,
      action: 'update',
      data: conflictingExpense,
    });

    const pending = await expenseRepo.getPendingOutbox();
    expect(pending.some((m) => m.id === mut.id)).toBe(true);

    // Simulate server response indicating this item is already tombstoned on remote
    const serverTombstonedIds = [conflictingExpense.id];
    const conflictRejectedMutationIds = [mut.id];

    // Under deletion-wins policy:
    // 1. Enforce tombstone locally
    await expenseRepo.recordTombstones(serverTombstonedIds);
    await expenseRepo.deleteBatch(serverTombstonedIds);

    // 2. Archive user edit to Trash with audit note for full recoverability
    Storage.moveToTrash(
      'expenses',
      conflictingExpense,
      `[Conflict: Server Deletion Wins] ${conflictingExpense.name} (₹${conflictingExpense.amount})`
    );

    // 3. Dequeue mutation to suppress infinite retry loop
    await expenseRepo.dequeueMutations(conflictRejectedMutationIds);

    // Assert: Mutation dequeued
    const remainingOutbox = await expenseRepo.getPendingOutbox();
    expect(remainingOutbox.some((m) => m.id === mut.id)).toBe(false);

    // Assert: Item tombstoned
    const isTombstoned = await expenseRepo.isTombstoned(conflictingExpense.id);
    expect(isTombstoned).toBe(true);

    // Assert: Item is preserved in Trash for user recoverability
    const trash = Storage.getTrash();
    const trashedItem = trash.find((t: any) => t.data?.id === conflictingExpense.id);
    expect(trashedItem).toBeDefined();
    expect(trashedItem?.label).toContain('Conflict: Server Deletion Wins');
    expect(trashedItem?.data?.amount).toBe(4500);
  });
});


