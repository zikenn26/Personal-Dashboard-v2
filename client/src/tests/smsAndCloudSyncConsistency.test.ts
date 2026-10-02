import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { Storage } from '../utils/storage';
import { smsExpenseService } from '../services/smsExpenseService';
import { ExpenseItem } from '../types';
import { normalizeExpenseDateKey, getLocalDateKey } from '../utils/expenseUtils';

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
      key: (idx: number) => Object.keys(store)[idx] ?? null,
      length: 0,
    } as any;
  }
}

describe('SMS Logging and Cloud Sync Consistency Suite', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.setTrash([]);
  });

  it('1. ensures deleted expenses are not resurrected when cloud payload sync arrives', () => {
    // User had 3 expenses of ₹200 on device
    const exp1: ExpenseItem = { id: 'exp-1', name: 'Coffee', amount: 200, category: 'Food & Dining', date: getLocalDateKey() };
    const exp2: ExpenseItem = { id: 'exp-2', name: 'Coffee', amount: 200, category: 'Food & Dining', date: getLocalDateKey() };
    const exp3: ExpenseItem = { id: 'exp-3', name: 'Coffee', amount: 200, category: 'Food & Dining', date: getLocalDateKey() };
    Storage.setExpenses([exp1, exp2, exp3]);

    // User on web deletes exp2 and exp3 and moves them to trash
    Storage.moveToTrash('expenses', exp2, 'Coffee (₹200)');
    Storage.moveToTrash('expenses', exp3, 'Coffee (₹200)');

    // Cloud now has only exp1
    const cloudPayload = {
      expenses: [exp1],
      trash: Storage.getTrash(),
    };

    // Device receives cloud payload sync
    Storage.importAllDataPayload(cloudPayload);

    // Verified: Only exp1 remains, exp2 and exp3 are NOT resurrected!
    const active = Storage.getExpenses();
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('exp-1');
  });

  it('2. preserves recently received unsynced SMS transactions when cloud sync arrives', () => {
    // Device receives SMS transaction locally while offline/unsynced
    const recentSmsId = `exp-sms-${Date.now()}-abc`;
    const smsExp: ExpenseItem = {
      id: recentSmsId,
      name: 'Supermarket',
      amount: 450,
      category: 'Groceries & Food',
      date: getLocalDateKey(),
      source: 'sms_auto',
    };
    Storage.setExpenses([smsExp]);

    // Cloud payload without this new SMS yet
    const cloudPayload = {
      expenses: [{ id: 'exp-old', name: 'Netflix', amount: 649, category: 'Tech & Subscriptions', date: '2026-09-01' }],
    };

    Storage.importAllDataPayload(cloudPayload);

    // Both old cloud expense and newly auto-logged local SMS are present
    const updated = Storage.getExpenses();
    expect(updated.some((e) => e.id === recentSmsId)).toBe(true);
    expect(updated.some((e) => e.id === 'exp-old')).toBe(true);
  });

  it('3. ensures normalizeExpenseDateKey handles ISO dates and calendar dates accurately', () => {
    const today = new Date();
    const todayKey = getLocalDateKey(today);
    expect(normalizeExpenseDateKey(todayKey)).toBe(todayKey);
    expect(normalizeExpenseDateKey('2026-10-02T14:30:00.000Z')).toBe('2026-10-02');
    expect(normalizeExpenseDateKey('2026-10-02')).toBe('2026-10-02');
  });

  it('4. ensures SMS auto-logging logs bank debits immediately without lag', () => {
    const sms = 'Dear Customer, your A/c ending in 4321 is debited by Rs. 200.00 on 02-Oct-26 at 15:30 to Swiggy UPI:987654321012';
    const result = smsExpenseService.processSms(sms, 'AD-HDFCBK-S', Date.now(), false);

    expect(result.success).toBe(true);
    expect(result.status).toBe('logged');
    expect(result.parsed.amount).toBe(200);
    expect(result.parsed.referenceId).toBe('987654321012');

    const stored = Storage.getExpenses();
    expect(stored.some((e) => e.amount === 200 && e.referenceId === '987654321012')).toBe(true);
  });
});
