import { beforeAll, describe, it, expect, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { generateUUID, isValidUUID } from '../utils/uuid';
import { Storage } from '../utils/storage';
import { expenseRepo } from '../repositories/expenseRepository';
import { expenseSyncService } from '../services/expenseSyncService';
import { ExpenseItem } from '../types';

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

describe('Timestamp-Based Delta Sync Architecture with UUIDs', () => {
  beforeEach(async () => {
    localStorage.clear();
    Storage.clearMemoryCaches();
    Storage.setExpenses([]);
    await expenseRepo.clear();
    await expenseRepo.clearOutbox();
  });

  it('1. Generates standard RFC 4122 v4 UUIDs', () => {
    const id1 = generateUUID();
    const id2 = generateUUID();

    expect(isValidUUID(id1)).toBe(true);
    expect(isValidUUID(id2)).toBe(true);
    expect(id1).not.toBe(id2);
    // UUID v4 format: 8-4-4-4-12 hex chars with version 4
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id1)).toBe(true);
  });

  it('2. Storage.addExpense assigns UUID v4, updated_at, and is_deleted: false', () => {
    const newExp: ExpenseItem = {
      id: '',
      name: 'Organic Groceries',
      amount: 1450,
      category: 'Food',
      date: '2026-11-02',
    };

    const updatedList = Storage.addExpense(newExp);
    expect(updatedList.length).toBe(1);

    const saved = updatedList[0];
    expect(isValidUUID(saved.id)).toBe(true);
    expect(saved.is_deleted).toBe(false);
    expect(saved.updated_at).toBeDefined();
    expect(new Date(saved.updated_at!).getTime()).toBeGreaterThan(0);
  });

  it('3. Storage.deleteExpense records soft-delete with is_deleted: true and updated_at', async () => {
    const expId = generateUUID();
    const newExp: ExpenseItem = {
      id: expId,
      name: 'Movie Tickets',
      amount: 500,
      category: 'Entertainment',
      date: '2026-11-02',
    };

    Storage.addExpense(newExp);
    expect(Storage.getExpenses().length).toBe(1);

    Storage.deleteExpense(expId);
    expect(Storage.getExpenses().length).toBe(0);

    // Allow async microtask/indexedDB mutation enqueue to complete
    await new Promise((r) => setTimeout(r, 50));

    const outbox = await expenseRepo.getPendingOutbox();
    const deleteMutation = outbox.find((m) => m.expenseId === expId && m.action === 'delete');
    expect(deleteMutation).toBeDefined();

    const payload = (deleteMutation?.payload || deleteMutation?.data) as any;
    expect(payload.is_deleted).toBe(true);
    expect(payload.updated_at).toBeDefined();
  });

  it('4. Stores and retrieves last_sync_timestamp locally', () => {
    expect(Storage.getLastSyncTimestamp()).toBeNull();

    const timestamp = '2026-11-02T12:00:00.000Z';
    Storage.setLastSyncTimestamp(timestamp);
    expect(Storage.getLastSyncTimestamp()).toBe(timestamp);
  });

  it('5. Background delta sync pushes outbox mutations and merges remote server updates cleanly', async () => {
    const localId = generateUUID();
    const remoteId = generateUUID();

    // Seed local expense
    Storage.addExpense({
      id: localId,
      name: 'Local Coffee',
      amount: 250,
      category: 'Food',
      date: '2026-11-02',
    });
    await new Promise((r) => setTimeout(r, 0));
    const [localMutation] = await expenseRepo.getPendingOutbox();
    expect(localMutation).toBeDefined();

    const serverTimestamp = '2026-11-02T12:05:00.000Z';
    const remoteRecord: ExpenseItem = {
      id: remoteId,
      name: 'Cloud Subscription',
      amount: 999,
      category: 'Software',
      date: '2026-11-02',
      direction: 'DEBIT',
      is_deleted: false,
      updated_at: serverTimestamp,
    };

    // Mock backend POST /api/sync using the mutation acknowledgement contract.
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        server_timestamp: serverTimestamp,
        pulled_records: [remoteRecord],
        pushed_count: 1,
        pulled_count: 1,
        accepted_mutation_ids: [localMutation.id],
        rejected_mutation_ids: [],
      }),
    });

    try {
      const syncResult = await expenseSyncService.syncDeltaWithServer();
      expect(syncResult.success).toBe(true);
      expect(syncResult.pulledCount).toBe(1);

      // Verify remote record was merged into local storage
      const finalExpenses = Storage.getExpenses();
      expect(finalExpenses.some((e) => e.id === remoteId)).toBe(true);
      expect(finalExpenses.some((e) => e.id === localId)).toBe(true);

      // Verify last_sync_timestamp was updated
      expect(Storage.getLastSyncTimestamp()).toBe(serverTimestamp);

      // Verify outbox was dequeued
      const remainingOutbox = await expenseRepo.getPendingOutbox();
      expect(remainingOutbox.length).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('6. Rejected outbox mutations remain queued for retry or conflict review', async () => {
    const localId = generateUUID();
    Storage.addExpense({ id: localId, name: 'Pending Local Edit', amount: 500, category: 'Food', date: '2026-11-02' });
    await new Promise((r) => setTimeout(r, 0));
    const [mutation] = await expenseRepo.getPendingOutbox();
    expect(mutation).toBeDefined();

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        server_timestamp: '2026-11-02T12:05:00.000Z',
        pulled_records: [],
        accepted_mutation_ids: [],
        rejected_mutation_ids: [mutation.id],
      }),
    });

    try {
      const result = await expenseSyncService.syncDeltaWithServer();
      expect(result.success).toBe(true);
      expect(result.pendingCount).toBe(1);
      expect((await expenseRepo.getPendingOutbox()).map((item) => item.id)).toContain(mutation.id);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
