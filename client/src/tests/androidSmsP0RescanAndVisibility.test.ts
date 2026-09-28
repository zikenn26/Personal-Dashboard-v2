import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  smsExpenseService,
  SmsTransactionCandidate,
  isTraiServiceSender,
} from '../services/smsExpenseService';
import { parseSmsTransaction } from '../services/smsParser';
import { Storage } from '../utils/storage';
import { ExpenseItem } from '../types';
import {
  getTransactionDisplayTitle,
  isCreditTransaction,
  compareExpensesByDateTimeDesc,
} from '../utils/expenseUtils';
import { getCustomWorkspaceIdentifier, setCustomWorkspaceIdentifier } from '../utils/supabase';

function setupMockLocalStorage() {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
  if (typeof globalThis.CustomEvent === 'undefined') {
    (globalThis as any).CustomEvent = class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params?: { detail?: any }) {
        this.type = type;
        this.detail = params?.detail;
      }
    };
  }
  if (typeof globalThis.dispatchEvent === 'undefined') {
    const listeners: Record<string, Array<(e: any) => void>> = {};
    (globalThis as any).addEventListener = (type: string, cb: any) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(cb);
    };
    (globalThis as any).removeEventListener = (type: string, cb: any) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((fn) => fn !== cb);
      }
    };
    (globalThis as any).dispatchEvent = (event: any) => {
      const cbs = listeners[event.type] || [];
      cbs.forEach((cb) => cb(event));
      return true;
    };
  }
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

describe('P0 — SMS Rescan Selection & Detected Transactions Visibility', () => {
  beforeEach(() => {
    setupMockLocalStorage();
    Storage.setExpenses([]);
    Storage.setSmsAutoTrackingEnabled(true);
    Storage.clearProcessedSmsFingerprints();
    setCustomWorkspaceIdentifier('user_gulnayak1206@gmail.com');
  });

  describe('A. Automatic Transaction Visibility Pipeline', () => {
    it('simulates a valid bank SMS, verifies detection, canonical storage, reload, and spending rendering', () => {
      const sms =
        'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';
      const sender = 'AD-ICICIB';
      const timestamp = new Date('2026-09-25T10:42:00').getTime();

      // 1. SMS detected and processed
      const result = smsExpenseService.processSms(sms, sender, timestamp, false);
      expect(result.success).toBe(true);
      expect(result.status).toBe('logged');
      expect(result.expense).toBeDefined();

      // 2. Canonical ExpenseItem created with correct fields
      const expense = result.expense!;
      expect(expense.name).toBe('Arpita Priyadar');
      expect(expense.amount).toBe(303);
      expect(expense.direction).toBe('DEBIT');
      expect(expense.referenceId).toBe('663416590461');
      expect(expense.bankName || expense.bankOrAccount).toContain('ICICI');

      // 3. Stored in canonical Storage
      const stored = Storage.getExpenses();
      expect(stored.length).toBe(1);
      expect(stored[0].id).toBe(expense.id);

      // 4. Expense survives reload (read fresh from persistent storage)
      const reloaded = Storage.getExpenses();
      expect(reloaded).toHaveLength(1);
      expect(reloaded[0].amount).toBe(303);
      expect(reloaded[0].referenceId).toBe('663416590461');

      // 5. Spending data source contains the transaction
      const spendingDataSource = Storage.getExpenses();
      const target = spendingDataSource.find((e) => e.referenceId === '663416590461');
      expect(target).toBeDefined();

      // 6. Spending UI rendering helpers format it properly
      const displayTitle = getTransactionDisplayTitle(target!);
      expect(displayTitle).toBe('Arpita Priyadar');
      expect(isCreditTransaction(target!)).toBe(false);
    });

    it('updates reactive state listeners immediately upon background SMS arrival without page reload', () => {
      let eventPayload: any = null;
      const listener = (e: Event) => {
        eventPayload = (e as CustomEvent).detail;
      };
      window.addEventListener('sms_expense_auto_logged', listener);

      const sms =
        'Rs 450.00 debited from HDFC Bank A/c **4120 on 24-Sep-26 to SWIGGY. UPI: 429384928342. Avl bal: Rs.14,200.00.';
      smsExpenseService.processSms(sms, 'VK-HDFCBK', Date.now(), false);

      expect(eventPayload).not.toBeNull();
      expect(eventPayload.expense.name).toBe('Swiggy');
      expect(eventPayload.updatedExpenses).toHaveLength(1);

      window.removeEventListener('sms_expense_auto_logged', listener);
    });
  });

  describe('B. Controlled Manual Rescan (10 / 20 / 30 / 50 SMS)', () => {
    it('returns candidate transactions for count options 10, 20, 30, and 50', async () => {
      for (const count of [10, 20, 30, 50] as Array<10 | 20 | 30 | 50>) {
        const candidates = await smsExpenseService.getRecentTransactionCandidates(count);
        expect(Array.isArray(candidates)).toBe(true);
        expect(candidates.length).toBeLessThanOrEqual(count);
        // All returned candidates must be financial transactions with positive amount
        for (const cand of candidates) {
          expect(cand.amount).toBeGreaterThan(0);
          expect(cand.payee || cand.merchant).toBeTruthy();
          expect(cand.preview).toBeTruthy();
        }
        // Must be sorted newest -> oldest by timestamp
        for (let i = 0; i < candidates.length - 1; i++) {
          expect(candidates[i].timestamp).toBeGreaterThanOrEqual(candidates[i + 1].timestamp);
        }
      }
    });

    it('identifies candidate metadata: amount, payee, bank, reference, date, preview', async () => {
      const candidates = await smsExpenseService.getRecentTransactionCandidates(10);
      const iciciCand = candidates.find((c) => c.referenceId === '663416590461');
      expect(iciciCand).toBeDefined();
      expect(iciciCand!.amount).toBe(303);
      expect(iciciCand!.payee).toBe('Arpita Priyadar');
      expect(iciciCand!.bankName).toContain('ICICI');
      expect(iciciCand!.paymentMethod).toBe('UPI');
      expect(iciciCand!.direction).toBe('DEBIT');
    });
  });

  describe('C. User Multi-Selection (Arbitrary Combinations)', () => {
    it('processes arbitrary selection subsets (e.g. index 0 and 2) correctly', async () => {
      const candidates = await smsExpenseService.getRecentTransactionCandidates(20);
      expect(candidates.length).toBeGreaterThanOrEqual(3);

      // Select candidate 0 and candidate 2
      const selected = [candidates[0], candidates[2]];
      const res = await smsExpenseService.logSelectedCandidates(selected);

      expect(res.selected).toBe(2);
      expect(res.imported).toBe(2);
      expect(res.failed).toBe(0);

      const expenses = Storage.getExpenses();
      expect(expenses).toHaveLength(2);
      expect(expenses.some((e) => e.referenceId === selected[0].referenceId)).toBe(true);
      expect(expenses.some((e) => e.referenceId === selected[1].referenceId)).toBe(true);
    });
  });

  describe('D. No Silent Skipping — User Selection Has Priority', () => {
    it('attempts to log user-selected SMS without silently discarding them', async () => {
      const candidate: SmsTransactionCandidate = {
        id: 'cand-test-priority-1',
        rawSms:
          'Kotak Bank: Rs 250.00 debited from A/c **** on 24-Sep-26. UPI:556677889900-CHAAYOS. Bal: Rs 12,090.00.',
        sender: 'BZ-KOTAKB',
        timestamp: Date.now(),
        amount: 250,
        currency: '₹',
        payee: 'Chaayos',
        merchant: 'Chaayos',
        category: 'Food',
        paymentMethod: 'UPI',
        bankName: 'Kotak Bank',
        referenceId: '556677889900',
        direction: 'DEBIT',
        date: '2026-09-24',
        time: '12:30',
        preview: 'Kotak Bank: Rs 250.00 debited...',
        isExisting: false,
      };

      const result = await smsExpenseService.logSelectedCandidates([candidate]);
      expect(result.selected).toBe(1);
      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);

      const stored = Storage.getExpenses();
      expect(stored.find((e) => e.referenceId === '556677889900')).toBeDefined();
    });
  });

  describe('E. Replay / Existing Transaction Reporting', () => {
    it('explicitly reports Already Existing when candidate was previously logged rather than silent skip', async () => {
      const candidate: SmsTransactionCandidate = {
        id: 'cand-replay-test-1',
        rawSms:
          'Dear UPI user A/C 9876 debited by 1200.00 on 24Sep26 transfer to MOHIT SHARMA Ref No 429482938492.',
        sender: 'AD-SBIUPI',
        timestamp: Date.now(),
        amount: 1200,
        currency: '₹',
        payee: 'Mohit Sharma',
        merchant: 'Mohit Sharma',
        category: 'Transfer',
        paymentMethod: 'UPI',
        bankName: 'SBI',
        referenceId: '429482938492',
        direction: 'DEBIT',
        date: '2026-09-24',
        time: '14:00',
        preview: 'Dear UPI user A/C 9876 debited by 1200.00...',
        isExisting: false,
      };

      // Pass 1: Import
      const firstRes = await smsExpenseService.logSelectedCandidates([candidate]);
      expect(firstRes.imported).toBe(1);
      expect(firstRes.alreadyExisting).toBe(0);

      // Pass 2: Re-scan / replay candidate
      const secondRes = await smsExpenseService.logSelectedCandidates([candidate]);
      expect(secondRes.imported).toBe(0);
      expect(secondRes.alreadyExisting).toBe(1);
      expect(secondRes.failed).toBe(0);

      // Existing records are preserved and not corrupted
      const current = Storage.getExpenses();
      expect(current).toHaveLength(1);
      expect(current[0].referenceId).toBe('429482938492');
    });
  });

  describe('F. Real Bank / UPI Formats & End-to-End Persistence', () => {
    it('handles ICICI UPI format exactly as specified', () => {
      const sms =
        'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';
      const parsed = parseSmsTransaction(sms, 'AD-ICICIB', Date.now());

      expect(parsed.isTransaction).toBe(true);
      expect(parsed.amount).toBe(303);
      expect(parsed.payee).toBe('Arpita Priyadar');
      expect(parsed.bankName || parsed.bank).toContain('ICICI');
      expect(parsed.referenceId).toBe('663416590461');
      expect(parsed.paymentMethod).toBe('UPI');
      expect(parsed.type).toBe('expense');
    });

    it('handles Credit Card purchase format', () => {
      const sms =
        'Your ICICI Bank Credit Card XX2004 has been used for purchase of INR 2,499.00 at AMAZON INDIA on 23-Sep-2026. Avl Lmt: INR 85,000.';
      const res = smsExpenseService.processSms(sms, 'AD-ICICIT-S', Date.now(), false);

      expect(res.success).toBe(true);
      expect(res.expense!.amount).toBe(2499);
      expect(res.expense!.name).toBe('Amazon India');
      expect(res.expense!.direction).toBe('DEBIT');
    });
  });

  describe('G. Workspace Sync & Cloud Hydration Safety', () => {
    it('ensures workspace identity is set to user_<email>', () => {
      expect(getCustomWorkspaceIdentifier()).toBe('user_gulnayak1206@gmail.com');
    });

    it('never overwrites existing local expenses with an empty array during cloud sync hydration', () => {
      // Create local expense
      const localExp: ExpenseItem = {
        id: 'local-exp-1',
        name: 'Lunch at Cafe',
        amount: 220,
        category: 'Food',
        date: '2026-09-28',
        source: 'sms_auto',
        direction: 'DEBIT',
        active: true,
      };
      Storage.setExpenses([localExp]);

      // Simulate incoming empty cloud payload
      const emptyCloudPayload = {
        profile: { name: 'Gul Nayak', avatarUrl: '' },
        expenses: [],
      };
      Storage.importAllDataPayload(emptyCloudPayload);

      // Local expense must NOT be erased!
      const current = Storage.getExpenses();
      expect(current).toHaveLength(1);
      expect(current[0].id).toBe('local-exp-1');
      expect(current[0].amount).toBe(220);
    });

    it('merges cloud payload with local expenses deterministically', () => {
      const localExp: ExpenseItem = {
        id: 'local-exp-sms',
        name: 'Auto-logged SMS item',
        amount: 303,
        referenceId: '663416590461',
        category: 'Food',
        date: '2026-09-28',
        source: 'sms_auto',
        direction: 'DEBIT',
        active: true,
      };
      Storage.setExpenses([localExp]);

      const cloudExp: ExpenseItem = {
        id: 'cloud-exp-manual',
        name: 'Manual Expense from Web',
        amount: 500,
        category: 'Shopping',
        date: '2026-09-27',
        source: 'manual',
        direction: 'DEBIT',
        active: true,
      };
      Storage.importAllDataPayload({
        expenses: [cloudExp],
      });

      const merged = Storage.getExpenses();
      expect(merged).toHaveLength(2);
      expect(merged.some((e) => e.id === 'local-exp-sms')).toBe(true);
      expect(merged.some((e) => e.id === 'cloud-exp-manual')).toBe(true);
    });
  });
});
