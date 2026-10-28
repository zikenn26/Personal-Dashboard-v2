import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { Storage } from '../utils/storage';
import { ExpenseItem } from '../types';
import { IntentRouter } from '../services/ai/intentRouter';
import { parseStructuredExpenseIntent } from '../services/ai/adapters/moneyAdapter';
import {
  getTransactionDisplayTitle,
  isCreditTransaction,
  getTransactionDirection,
  getAvailableTransactionMetadata,
  compareExpensesByDateTimeDesc,
} from '../utils/expenseUtils';
import { smsExpenseService } from '../services/smsExpenseService';
import { parseSmsTransaction } from '../services/smsParser';

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

describe('Phase 8 — Spending & Transaction System Production Hardening Suite', () => {
  let router: IntentRouter;

  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.clearSmsTransactionLogs();
    Storage.setSmsAutoTrackingEnabled(true);
    router = new IntentRouter();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // PART 1 — AI EXPENSE COMMAND PARSING & ACTION WORD PURGING
  // =========================================================================
  describe('1. AI Expense Command Parsing & Action Word Purging', () => {
    const todayStr = new Date().toISOString().split('T')[0];

    it('parses "add 39 rs breakfast": amount=39, title="Breakfast", merchant!=="add"', async () => {
      const parsed = parseStructuredExpenseIntent('add 39 rs breakfast', todayStr);
      expect(parsed).not.toBeNull();
      expect(parsed?.intent).toBe('CREATE_EXPENSE');
      expect(parsed?.amount).toBe(39);
      expect(parsed?.title).toBe('Breakfast');
      expect(parsed?.merchant).toBeNull();
      expect(parsed?.title.toLowerCase()).not.toBe('add');

      const res = await router.route('add 39 rs breakfast');
      expect(res.module).toBe('money');
      expect(res.reply).toContain('39');
      expect(res.reply).toContain('Breakfast');

      const expenses = Storage.getExpenses();
      expect(expenses).toHaveLength(1);
      expect(expenses[0].amount).toBe(39);
      expect(expenses[0].name).toBe('Breakfast');
      expect(expenses[0].name.toLowerCase()).not.toBe('add');
    });

    it('parses "log ₹250 lunch": amount=250, title="Lunch", category="Dining Out"', async () => {
      const parsed = parseStructuredExpenseIntent('log ₹250 lunch', todayStr);
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(250);
      expect(parsed?.title).toBe('Lunch');
      expect(parsed?.category).toBe('Dining Out');

      const res = await router.route('log ₹250 lunch');
      expect(res.module).toBe('money');
      const expenses = Storage.getExpenses();
      expect(expenses).toHaveLength(1);
      expect(expenses[0].amount).toBe(250);
      expect(expenses[0].name).toBe('Lunch');
    });

    it('parses "record 500 for groceries": amount=500, title="Groceries", category="Groceries & Food"', async () => {
      const parsed = parseStructuredExpenseIntent('record 500 for groceries', todayStr);
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(500);
      expect(parsed?.title).toBe('Groceries');
      expect(parsed?.category).toBe('Groceries & Food');

      const res = await router.route('record 500 for groceries');
      expect(res.module).toBe('money');
      const expenses = Storage.getExpenses();
      expect(expenses[0].amount).toBe(500);
      expect(expenses[0].name).toBe('Groceries');
    });

    it('parses "add ₹700 at Amazon": amount=700, merchant="Amazon", title="Amazon"', async () => {
      const parsed = parseStructuredExpenseIntent('add ₹700 at Amazon', todayStr);
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(700);
      expect(parsed?.merchant).toBe('Amazon');
      expect(parsed?.title).toBe('Amazon');

      const res = await router.route('add ₹700 at Amazon');
      expect(res.module).toBe('money');
      const expenses = Storage.getExpenses();
      expect(expenses[0].amount).toBe(700);
      expect(expenses[0].name).toBe('Amazon');
      expect(expenses[0].merchant).toBe('Amazon');
    });

    it('parses "add ₹300 for breakfast at Starbucks": amount=300, merchant="Starbucks", category="Dining Out"', async () => {
      const parsed = parseStructuredExpenseIntent('add ₹300 for breakfast at Starbucks', todayStr);
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(300);
      expect(parsed?.merchant).toBe('Starbucks');
      expect(parsed?.title).toBe('Starbucks');
      expect(parsed?.category).toBe('Dining Out');

      const res = await router.route('add ₹300 for breakfast at Starbucks');
      expect(res.module).toBe('money');
      const expenses = Storage.getExpenses();
      expect(expenses[0].amount).toBe(300);
      expect(expenses[0].name).toBe('Starbucks');
    });

    it('handles ambiguous "add 100": asks for missing category without creating a fake transaction', async () => {
      const parsed = parseStructuredExpenseIntent('add 100', todayStr);
      expect(parsed?.intent).toBe('AMBIGUOUS');
      expect(parsed?.missingField).toBe('category');

      const res = await router.route('add 100');
      expect(res.module).toBe('money');
      expect(res.reply).toContain('categorize');
      expect(res.reply).toContain('100');

      // No expense should have been created!
      expect(Storage.getExpenses()).toHaveLength(0);
    });

    it('parses "add 500 to Rahul": payee="Rahul", title="Rahul", does not set category="Rahul"', async () => {
      const parsed = parseStructuredExpenseIntent('add 500 to Rahul', todayStr);
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(500);
      expect(parsed?.merchant).toBe('Rahul');
      expect(parsed?.payee).toBe('Rahul');
      expect(parsed?.title).toBe('Rahul');
      expect(parsed?.category).not.toBe('Rahul');

      const res = await router.route('add 500 to Rahul');
      expect(res.module).toBe('money');
      const expenses = Storage.getExpenses();
      expect(expenses[0].amount).toBe(500);
      expect(expenses[0].name).toBe('Rahul');
      expect(expenses[0].payee).toBe('Rahul');
    });

    it('ensures action words (add, log, record, enter, track, spend, spent, paid) NEVER become titles', () => {
      const actionWords = ['add', 'log', 'record', 'save', 'create', 'enter', 'track', 'spend', 'spent', 'paid'];
      actionWords.forEach((word) => {
        const parsed = parseStructuredExpenseIntent(`${word} 50 on coffee`, todayStr);
        expect(parsed?.title.toLowerCase()).not.toBe(word);
        expect(parsed?.title).toBe('Coffee');
      });
    });
  });

  // =========================================================================
  // PART 2 & 3 — TRANSACTION METADATA PRESERVATION & DETAIL VIEW
  // =========================================================================
  describe('2. Transaction Metadata Preservation & Detail Presentation', () => {
    it('persists and exposes complete SMS metadata in canonical ExpenseItem', () => {
      const sms = 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADARSINI credited. UPI:663416590461.';
      const res = smsExpenseService.processSms(sms, 'AD-ICICIB', 1000, false);
      expect(res.status).toBe('logged');

      const expenses = Storage.getExpenses();
      expect(expenses).toHaveLength(1);
      const item = expenses[0];

      // Verification of all metadata fields
      expect(item.name).toBe('Arpita Priyadarsini');
      expect(item.amount).toBe(303);
      expect(item.referenceId).toBe('663416590461');
      expect(item.smsReferenceId).toBe('663416590461');
      expect(item.upiReference).toBe('663416590461');
      expect(item.bankName).toBe('ICICI Bank');
      expect(item.maskedAccount).toBe('XX070');
      expect(item.paymentMethod).toBe('UPI');
      expect(item.direction).toBe('DEBIT');
      expect(item.source).toBe('sms_auto');

      // Detail metadata extraction
      const metadata = getAvailableTransactionMetadata(item);
      const keys = metadata.map((m) => m.key);
      expect(keys).toContain('direction');
      expect(keys).toContain('bank');
      expect(keys).toContain('account');
      expect(keys).toContain('upiReference');
      expect(keys).toContain('source');

      const bankItem = metadata.find((m) => m.key === 'bank');
      expect(bankItem?.value).toContain('ICICI Bank');

      const accountItem = metadata.find((m) => m.key === 'account');
      expect(accountItem?.value).toBe('XX070');
      // Ensure sensitive data is not exposed
      expect(accountItem?.value).not.toMatch(/^\d{10,}$/);
    });

    it('dynamically omits empty/unavailable fields in detail metadata view', () => {
      const manualExpense: ExpenseItem = {
        id: 'exp-manual',
        name: 'Coffee at Cafe',
        amount: 120,
        category: 'Snacks & Coffee',
        date: '2026-09-27',
        paymentMethod: 'Cash',
      };

      const metadata = getAvailableTransactionMetadata(manualExpense);
      const keys = metadata.map((m) => m.key);

      expect(keys).toContain('category');
      expect(keys).toContain('paymentMethod');
      // Should NOT have empty bank, account, upiReference, or referenceId
      expect(keys).not.toContain('bank');
      expect(keys).not.toContain('account');
      expect(keys).not.toContain('upiReference');
      expect(keys).not.toContain('referenceId');
    });

    it('preserves SMS metadata across app reload / simulated restart', () => {
      const initialItem: ExpenseItem = {
        id: 'exp-1',
        name: 'Arpita Priyadar',
        amount: 303,
        category: 'Other',
        date: '2026-09-25',
        time: '10:42',
        paymentMethod: 'UPI',
        referenceId: '663416590461',
        bankName: 'ICICI Bank',
        maskedAccount: 'XX070',
        direction: 'DEBIT',
        source: 'sms_auto',
      };

      Storage.setExpenses([initialItem]);

      // Re-read from storage
      const reloaded = Storage.getExpenses();
      expect(reloaded[0].referenceId).toBe('663416590461');
      expect(reloaded[0].bankName).toBe('ICICI Bank');
      expect(reloaded[0].maskedAccount).toBe('XX070');
      expect(reloaded[0].direction).toBe('DEBIT');
      expect(reloaded[0].source).toBe('sms_auto');
    });
  });

  // =========================================================================
  // PART 4 & 5 — DEBIT / CREDIT DIRECTION & SPENDING CALCULATIONS
  // =========================================================================
  describe('3. Debit/Credit Semantics & Spending Calculation Integrity', () => {
    it('correctly classifies Debit vs Credit transactions', () => {
      const debitExp: ExpenseItem = {
        id: 'exp-d',
        name: 'Swiggy',
        amount: 450,
        category: 'Dining Out',
        date: '2026-09-25',
        direction: 'DEBIT',
      };

      const creditExp: ExpenseItem = {
        id: 'exp-c',
        name: 'Amazon Refund',
        amount: 499,
        category: 'Shopping & Retail',
        date: '2026-09-25',
        direction: 'CREDIT',
        transactionType: 'CREDIT',
      };

      expect(isCreditTransaction(debitExp)).toBe(false);
      expect(getTransactionDirection(debitExp)).toBe('DEBIT');

      expect(isCreditTransaction(creditExp)).toBe(true);
      expect(getTransactionDirection(creditExp)).toBe('CREDIT');
    });

    it('spending calculations only sum debits so credits/refunds do not inflate money spent', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const expenses: ExpenseItem[] = [
        { id: '1', name: 'Lunch', amount: 300, category: 'Dining Out', date: todayStr, direction: 'DEBIT' },
        { id: '2', name: 'Cab', amount: 200, category: 'Taxi & Transit', date: todayStr, direction: 'DEBIT' },
        // Credit refund of ₹1,000 received today
        { id: '3', name: 'Flight Refund', amount: 1000, category: 'Travel & Leisure', date: todayStr, direction: 'CREDIT' },
      ];

      Storage.setExpenses(expenses);

      // AI "How much did I spend today?" query
      const res = await router.route('How much did I spend today?');
      expect(res.module).toBe('money');
      // Total spending must be 300 + 200 = 500, NOT 1,500!
      expect(res.reply).toContain('500');
      expect(res.reply).not.toContain('1,500');
    });
  });

  // =========================================================================
  // PART 6 — HOME SPENDING WIDGET INTEGRITY
  // =========================================================================
  describe('4. Home Spending Widget Exact-4 Real Records', () => {
    it('takes strictly the 4 newest real transactions ordered descending by date and time', () => {
      const testExpenses: ExpenseItem[] = [
        { id: 'exp-1', name: 'Morning Tea', amount: 20, category: 'Snacks & Coffee', date: '2026-09-25', time: '08:00' },
        { id: 'exp-2', name: 'Lunch', amount: 250, category: 'Dining Out', date: '2026-09-25', time: '13:00' },
        { id: 'exp-3', name: 'Coffee', amount: 150, category: 'Snacks & Coffee', date: '2026-09-25', time: '16:00' },
        { id: 'exp-4', name: 'Dinner', amount: 400, category: 'Dining Out', date: '2026-09-25', time: '20:00' },
        { id: 'exp-5', name: 'Late Snack', amount: 80, category: 'Snacks & Coffee', date: '2026-09-25', time: '23:30' },
      ];

      const sorted = [...testExpenses].sort(compareExpensesByDateTimeDesc);
      const top4 = sorted.slice(0, 4);

      expect(top4).toHaveLength(4);
      expect(top4[0].name).toBe('Late Snack'); // Newest (23:30)
      expect(top4[1].name).toBe('Dinner');     // (20:00)
      expect(top4[2].name).toBe('Coffee');     // (16:00)
      expect(top4[3].name).toBe('Lunch');      // (13:00)
      // exp-1 (08:00) is excluded because only top 4 are rendered
      expect(top4.map((e) => e.id)).not.toContain('exp-1');
    });

    it('renders fewer than 4 real transactions without generating fake placeholder rows', () => {
      const twoExpenses: ExpenseItem[] = [
        { id: 'exp-1', name: 'Coffee', amount: 100, category: 'Snacks & Coffee', date: '2026-09-25' },
        { id: 'exp-2', name: 'Book', amount: 450, category: 'Education', date: '2026-09-24' },
      ];

      const top4 = [...twoExpenses].sort(compareExpensesByDateTimeDesc).slice(0, 4);
      expect(top4).toHaveLength(2);
      expect(top4.every((e) => Boolean(e.id && e.name))).toBe(true);
    });
  });

  // =========================================================================
  // PART 7 & 10 — HUMAN-READABLE TITLES & CLEAN PRODUCTION DATA
  // =========================================================================
  describe('5. Human-Readable Titles & Production Purity', () => {
    it('prioritizes payee/merchant name over generic "UPI" or "Bank Debit"', () => {
      const expWithPayee: ExpenseItem = {
        id: '1',
        name: 'UPI Payment',
        payee: 'ARPITA PRIYADARSINI',
        amount: 303,
        category: 'Other',
        date: '2026-09-25',
      };
      expect(getTransactionDisplayTitle(expWithPayee)).toBe('ARPITA PRIYADARSINI');

      const expWithMerchant: ExpenseItem = {
        id: '2',
        name: 'Bank Debit',
        merchant: 'Amazon',
        amount: 799,
        category: 'Shopping & Retail',
        date: '2026-09-25',
      };
      expect(getTransactionDisplayTitle(expWithMerchant)).toBe('Amazon');
    });

    it('never uses imperative command verbs (add, log, record) as display titles', () => {
      const buggedExp: ExpenseItem = {
        id: '3',
        name: 'add',
        category: 'Dining Out',
        amount: 39,
        date: '2026-09-25',
      };
      const title = getTransactionDisplayTitle(buggedExp);
      expect(title.toLowerCase()).not.toBe('add');
      expect(title).toBe('Dining Out');
    });

    it('initializes clean with 0 mock transactions in fresh state', () => {
      expect(Storage.getExpenses()).toEqual([]);
    });
  });
});
