import { describe, it, expect, beforeEach } from 'vitest';
import { Storage, STORAGE_KEYS } from '../utils/storage';
import { ExpenseItem } from '../types';
import { normalizeExpenseDateKey, getLocalDateKey } from '../utils/expenseUtils';
import { setCustomWorkspaceEmail, setCustomWorkspaceIdentifier } from '../utils/neonSync';

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
    key: (idx: number) => Object.keys(store)[idx] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as any;
}

describe('Offline Spending Persistence and Cache Resilience Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    Storage.clearMemoryCaches();
    Storage.setDeletedExpenseIds([]);
    setCustomWorkspaceIdentifier('user_usr_gknayak_gmail_com');
    setCustomWorkspaceEmail('gknayak@gmail.com');
  });

  it('1. persists expenses in the account-scoped canonical local store', () => {
    const testExpenses: ExpenseItem[] = [
      {
        id: 'exp-1',
        name: 'Grocery Store',
        amount: 850,
        category: 'Groceries',
        date: '2026-10-20',
        direction: 'DEBIT',
        active: true,
      },
      {
        id: 'exp-2',
        name: 'Salary Credit',
        amount: 50000,
        category: 'Salary',
        date: '2026-10-01',
        direction: 'CREDIT',
        active: true,
      },
    ];

    Storage.setExpenses(testExpenses);

    // Workspace-scoped storage is canonical; old global cache keys are ignored.
    const userCacheRaw = localStorage.getItem(`user_usr_gknayak_gmail_com_${STORAGE_KEYS.EXPENSES}`);
    expect(userCacheRaw).toBeTruthy();
    const parsed = JSON.parse(userCacheRaw!);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('exp-1');
    expect(parsed[1].id).toBe('exp-2');

    expect(localStorage.getItem('lifeos_offline_expenses_cache')).toBeNull();
    expect(localStorage.getItem('gknayak@gmail.com_offline_expenses_cache')).toBeNull();
  });

  it('2. does not recover a legacy account cache when canonical scoped storage is empty', () => {
    // Simulate an old cache left by the retired multi-tier recovery path.
    const cachedItems: ExpenseItem[] = [
      {
        id: 'exp-cached-101',
        name: 'Petrol / Fuel',
        amount: 500,
        category: 'Transport',
        date: '2026-10-15',
        direction: 'DEBIT',
        active: true,
      },
      {
        id: 'exp-cached-102',
        name: 'Dining',
        amount: 720,
        category: 'Food & Dining',
        date: '2026-10-18',
        direction: 'DEBIT',
        active: true,
      },
    ];

    // Seed only the user's offline cache (simulating fresh tab open before cloud or scoped key was populated)
    localStorage.setItem('gknayak@gmail.com_offline_expenses_cache', JSON.stringify(cachedItems));

    // Scoped key is not present
    const ws = 'user_usr_gknayak_gmail_com';
    expect(localStorage.getItem(`${ws}_${STORAGE_KEYS.EXPENSES}`)).toBeNull();

    const recovered = Storage.getExpenses();
    expect(recovered).toEqual([]);
    expect(localStorage.getItem(`${ws}_${STORAGE_KEYS.EXPENSES}`)).toBeNull();
  });

  it('3. normalizes DD/MM/YYYY and DD-MM-YYYY dates correctly so period filtering does not blank out transactions', () => {
    // Standard Indian financial statements and Money Manager formats
    expect(normalizeExpenseDateKey('24/10/2026')).toBe('2026-10-24');
    expect(normalizeExpenseDateKey('05/09/2026')).toBe('2026-09-05');
    expect(normalizeExpenseDateKey('15-08-2026')).toBe('2026-08-15');
    expect(normalizeExpenseDateKey('2026-10-24')).toBe('2026-10-24');
    expect(normalizeExpenseDateKey('2026-10-24T10:30:00.000Z')).toBe('2026-10-24');
  });

  it('4. performs date healing on read so legacy items with DD/MM/YYYY are normalized to YYYY-MM-DD in storage', () => {
    const rawLegacyItems: ExpenseItem[] = [
      {
        id: 'exp-legacy-1',
        name: 'Bookstore',
        amount: 450,
        category: 'Education',
        date: '18/10/2026',
        direction: 'DEBIT',
        active: true,
      },
    ];

    Storage.setExpenses(rawLegacyItems);

    const retrieved = Storage.getExpenses();
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].date).toBe('2026-10-18');
  });

  it('5. an authoritative empty server snapshot clears stale local expenses', () => {
    const offlineItems: ExpenseItem[] = [
      {
        id: 'exp-local-1',
        name: 'Electricity Bill',
        amount: 1400,
        category: 'Bills & Utilities',
        date: '2026-10-10',
        direction: 'DEBIT',
        active: true,
      },
      {
        id: 'exp-local-2',
        name: 'Internet Fiber',
        amount: 999,
        category: 'Bills & Utilities',
        date: '2026-10-12',
        direction: 'DEBIT',
        active: true,
      },
    ];

    // Seed local expenses
    Storage.setExpenses(offlineItems);
    expect(Storage.getExpenses()).toHaveLength(2);

    // Incoming remote cloud snapshot has an empty expenses array (or partial cloud state)
    const remotePayload = {
      expenses: [],
      todos: [],
      profile: { name: 'Gulshan Kumar Nayak' },
    };

    Storage.importAllDataPayload(remotePayload);

    // Server state is authoritative; untracked local cache rows cannot override it.
    const afterSync = Storage.getExpenses();
    expect(afterSync).toEqual([]);
  });

  it('6. an authoritative server snapshot replaces the local ledger', () => {
    const localItems: ExpenseItem[] = [
      {
        id: 'exp-local-only',
        name: 'Coffee Shop',
        amount: 120,
        category: 'Snacks & Coffee',
        date: '2026-10-22',
        direction: 'DEBIT',
        active: true,
      },
    ];
    Storage.setExpenses(localItems);

    const cloudPayload = {
      expenses: [
        {
          id: 'exp-cloud-only',
          name: 'Supermarket',
          amount: 1800,
          category: 'Groceries',
          date: '2026-10-23',
          direction: 'DEBIT',
          active: true,
        },
      ],
    };

    Storage.importAllDataPayload(cloudPayload);

    const merged = Storage.getExpenses();
    expect(merged).toHaveLength(1);
    const ids = merged.map((e) => e.id);
    expect(ids).toContain('exp-cloud-only');
    expect(ids).not.toContain('exp-local-only');
  });
});
