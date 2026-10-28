import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { parseSmsTransaction } from '../services/smsParser';
import { smsExpenseService, isTraiServiceSender, SmsTransaction, smsPluginWebImpl } from '../services/smsExpenseService';
import { Storage } from '../utils/storage';
import { ExpenseItem } from '../types';
import { Capacitor } from '@capacitor/core';

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

  if (typeof globalThis.window === 'undefined') {
    const listeners: Record<string, Function[]> = {};
    (globalThis as any).window = {
      addEventListener: (type: string, cb: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(cb);
      },
      removeEventListener: (type: string, cb: Function) => {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter((fn) => fn !== cb);
        }
      },
      dispatchEvent: (evt: any) => {
        if (listeners[evt.type]) {
          listeners[evt.type].forEach((fn) => fn(evt));
        }
        return true;
      },
    };
  }

  if (typeof globalThis.CustomEvent === 'undefined') {
    (globalThis as any).CustomEvent = class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params?: { detail: any }) {
        this.type = type;
        this.detail = params?.detail;
      }
    };
  }
}

describe('Phase 5 — Android SMS Expense Auto-Logging Comprehensive Suite', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.clearSmsTransactionLogs();
    Storage.setSmsAutoTrackingEnabled(true);
    vi.restoreAllMocks();
  });

  // 1. Valid UPI debit
  it('1. correctly parses and logs a valid UPI debit transaction', () => {
    const sms = 'Paid Rs. 350.00 to SWIGGY via UPI on 25-Sep-26. UPI Ref: 429384928342.';
    const res = smsExpenseService.processSms(sms, 'AD-ICICIB', 1000, false);

    expect(res.status).toBe('logged');
    expect(res.parsed.isTransaction).toBe(true);
    expect(res.parsed.amount).toBe(350);
    expect(res.parsed.type).toBe('expense');
    expect(res.parsed.merchant).toBe('Swiggy');
    expect(res.parsed.paymentMethod).toBe('UPI');
    expect(res.parsed.referenceId).toBe('429384928342');

    const expenses = Storage.getExpenses();
    expect(expenses.length).toBe(1);
    expect(expenses[0].name).toBe('Swiggy');
    expect(expenses[0].amount).toBe(350);
    expect(expenses[0].smsReferenceId).toBe('429384928342');
    expect(expenses[0].source).toBe('sms_auto');
  });

  // 2. Valid bank debit
  it('2. correctly parses and logs a valid bank debit transaction', () => {
    const sms = 'Your A/c XX1234 is debited for Rs 1,450.00 on 25-Sep-26 by Transfer to Mohit Sharma. Bal: Rs 45,000.';
    const res = smsExpenseService.processSms(sms, 'VM-HDFCBK', 1000, false);

    expect(res.status).toBe('logged');
    expect(res.parsed.isTransaction).toBe(true);
    expect(res.parsed.amount).toBe(1450);
    expect(res.parsed.type).toBe('expense');
    expect(res.parsed.merchant).toBe('Mohit Sharma');

    const expenses = Storage.getExpenses();
    expect(expenses.length).toBe(1);
    expect(expenses[0].amount).toBe(1450);
    expect(expenses[0].name).toBe('Mohit Sharma');
  });

  // 3. Card transaction
  it('3. correctly parses and logs a credit/debit card transaction', () => {
    const sms = 'Axis Bank: INR 2,499.00 spent on Card ending 4412 at AMAZON INDIA on 24-Sep-2026. Txn ID: 998877665544.';
    const res = smsExpenseService.processSms(sms, 'AX-AXISBK', 1000, false);

    expect(res.status).toBe('logged');
    expect(res.parsed.amount).toBe(2499);
    expect(res.parsed.merchant).toBe('Amazon India');
    expect(res.parsed.paymentMethod).toBe('Credit Card');
    expect(res.parsed.referenceId).toBe('998877665544');

    const expenses = Storage.getExpenses();
    expect(expenses.length).toBe(1);
    expect(expenses[0].paymentMethod).toBe('Credit Card');
    expect(expenses[0].amount).toBe(2499);
  });

  // 4. ATM withdrawal where supported
  it('4. correctly parses and logs an ATM cash withdrawal', () => {
    const sms = 'Rs. 2,000.00 withdrawn from ATM A/c XX4321 on 25-Sep-26. Avl Bal: Rs 18,000.';
    const res = smsExpenseService.processSms(sms, 'BZ-SBIINB', 1000, false);

    expect(res.status).toBe('logged');
    expect(res.parsed.amount).toBe(2000);
    expect(res.parsed.type).toBe('expense');
    expect(res.parsed.merchant.toLowerCase()).toContain('atm');

    const expenses = Storage.getExpenses();
    expect(expenses.length).toBe(1);
    expect(expenses[0].amount).toBe(2000);
  });

  // 5. OTP rejection
  it('5. strictly rejects authentication OTP and security messages', () => {
    const sms = 'Your OTP for transaction of Rs.500 at Swiggy is 492810. Do not share this OTP with anyone.';
    const res = smsExpenseService.processSms(sms, 'HDFCBK', 1000, false);

    expect(res.status).toBe('ignored_not_financial');
    expect(res.parsed.isTransaction).toBe(false);
    expect(Storage.getExpenses().length).toBe(0);
  });

  // 6. Promotional SMS rejection
  it('6. strictly rejects promotional and marketing loan pre-approvals', () => {
    const sms = 'Congratulations! You are eligible for a Pre-Approved Loan of Rs 5,00,000. Apply now at loan.bank.com.';
    const res = smsExpenseService.processSms(sms, 'AD-BAJAJF-P', 1000, false);

    expect(res.status).toBe('ignored_not_financial');
    expect(res.parsed.isTransaction).toBe(false);
    expect(Storage.getExpenses().length).toBe(0);
  });

  // 7. Bill reminder rejection
  it('7. strictly rejects upcoming bill payment reminders before payment', () => {
    const sms = 'Dear Customer, your Credit Card bill of Rs. 4,500.00 is due on 05-Oct-26. Pay now to avoid late fee.';
    const res = smsExpenseService.processSms(sms, 'AX-AXISBK', 1000, false);

    expect(res.status).toBe('ignored_not_financial');
    expect(res.parsed.isTransaction).toBe(false);
    expect(Storage.getExpenses().length).toBe(0);
  });

  // 8. Declined transaction rejection
  it('8. strictly rejects declined or failed transactions', () => {
    const sms = 'Transaction of Rs. 650.00 at Zomato was declined due to insufficient balance in your account.';
    const res = smsExpenseService.processSms(sms, 'ICICIB', 1000, false);

    expect(res.status).toBe('ignored_not_financial');
    expect(res.parsed.isTransaction).toBe(false);
    expect(Storage.getExpenses().length).toBe(0);
  });

  // 9. Balance-only SMS rejection
  it('9. strictly rejects balance inquiry and generic balance update messages', () => {
    const sms = 'Dear Customer, available balance in your account XX0987 is Rs. 14,250.75 as on 26-Sep-26.';
    const res = smsExpenseService.processSms(sms, 'SBIUPI', 1000, false);

    expect(res.status).toBe('ignored_not_financial');
    expect(res.parsed.isTransaction).toBe(false);
    expect(Storage.getExpenses().length).toBe(0);
  });

  // 10. Different currency formats
  it('10. handles different currency representations and amounts without currency prefix', () => {
    // ₹ symbol
    const parsedRupee = parseSmsTransaction('₹850.00 debited for order at Blinkit. UPI: 123456789012.', 'AD-ICICIB');
    expect(parsedRupee.amount).toBe(850);
    expect(parsedRupee.currency).toBe('₹');

    // Rs. format
    const parsedRs = parseSmsTransaction('Rs.450.00 debited from A/c 4120 to SWIGGY. UPI: 429384928342.', 'VM-HDFCBK');
    expect(parsedRs.amount).toBe(450);

    // INR format
    const parsedInr = parseSmsTransaction('INR 1,200.00 spent on card at Decathlon. Ref: 987654321098.', 'AX-AXISBK');
    expect(parsedInr.amount).toBe(1200);

    // Amount without currency prefix
    const parsedNoPrefix = parseSmsTransaction(
      'Dear UPI user A/C 9876 debited by 1200.00 on 23Sep26 transfer to MOHIT SHARMA Ref No 429482938492.',
      'SBIUPI'
    );
    expect(parsedNoPrefix.amount).toBe(1200);
    expect(parsedNoPrefix.merchant).toBe('Mohit Sharma');
  });

  // 11. Different Indian bank sender formats
  it('11. recognizes diverse Indian bank sender headers while rejecting spam / personal numbers', () => {
    const validHeaders = [
      'AD-ICICIB',
      'VM-HDFCBK',
      'BZ-SBIINB',
      'AX-AXISBK',
      'AD-SBIUPI-S',
      'AD-ICICIT-S',
      'AX-AXISBK-S',
      'HDFCBK',
      'ICICIB',
      'SBIUPI',
    ];
    validHeaders.forEach((h) => {
      expect(isTraiServiceSender(h)).toBe(true);
    });

    const invalidHeaders = ['+919876543210', '9876543210', 'VM-PROMO-P', 'AD-BAJAJF-P', 'BAJAJ', 'FRIEND'];
    invalidHeaders.forEach((h) => {
      expect(isTraiServiceSender(h)).toBe(false);
    });
  });

  // 12. Missing merchant fallback
  it('12. provides safe fallback merchant without inventing fictitious names', () => {
    const sms = 'A/c XX1234 debited for Rs 300.00 on 25-Sep-26. UPI Ref: 112233445566.';
    const res = smsExpenseService.processSms(sms, 'AD-ICICIB', 1000, false);

    expect(res.status).toBe('logged');
    expect(res.parsed.merchant).toBeDefined();
    expect(res.parsed.merchant.length).toBeGreaterThan(0);
    // Should be a sensible fallback like UPI Payment
    expect(['UPI Payment', 'ICICI Bank', 'Other']).toContain(res.parsed.merchant);
    expect(Storage.getExpenses().length).toBe(1);
  });

  // 13. Duplicate SMS
  it('13. deduplicates identical incoming SMS broadcasts', () => {
    const sms = 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';

    const res1 = smsExpenseService.processSms(sms, 'AD-ICICIB', 1000, false);
    expect(res1.status).toBe('logged');

    // Duplicate arrival (e.g. system retry or re-broadcast)
    const res2 = smsExpenseService.processSms(sms, 'AD-ICICIB', 2000, false);
    expect(res2.status).toBe('duplicate_skipped');

    expect(Storage.getExpenses().length).toBe(1);
  });

  // 14. Same SMS received by receiver and inbox scanner
  it('14. prevents duplicate entry when same SMS is seen by both live receiver and inbox scanner', async () => {
    const sms = 'Rs. 450.00 debited from HDFC Bank A/c 4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342.';

    // 1. Live receiver intercepts
    const res = smsExpenseService.processSms(sms, 'VM-HDFCBK', 1000, false);
    expect(res.status).toBe('logged');
    expect(Storage.getExpenses().length).toBe(1);

    // 2. Later, inbox scanner scans the inbox which contains that same SMS
    smsExpenseService.setInboxReaderForTesting(async () => ({
      messages: [
        {
          sender: 'VM-HDFCBK',
          body: sms,
          timestamp: 1000,
        },
      ],
    }));

    try {
      const summary = await smsExpenseService.scanRecentInbox(10);
      expect(summary.scanned).toBe(1);
      expect(summary.transactionsFound).toBe(1);
      expect(summary.imported).toBe(0);
      expect(summary.skippedDuplicates).toBe(1);

      // Still only 1 expense in spending!
      expect(Storage.getExpenses().length).toBe(1);
    } finally {
      smsExpenseService.setInboxReaderForTesting(null);
    }
  });

  // 15. App restart after SMS processing
  it('15. retains deduplication state across application restarts', () => {
    const sms = 'Rs. 990.00 debited from A/c 5500 on 24-Sep-26 to Zomato. UPI: 887766554433.';
    const res1 = smsExpenseService.processSms(sms, 'AD-ICICIB', 1000, false);
    expect(res1.status).toBe('logged');

    // Simulate app restart: re-read stored fingerprints and expenses from Storage
    const existing = Storage.getExpenses();
    expect(existing.length).toBe(1);

    // Incoming duplicate after restart
    const res2 = smsExpenseService.processSms(sms, 'AD-ICICIB', 5000, false);
    expect(res2.status).toBe('duplicate_skipped');
    expect(Storage.getExpenses().length).toBe(1);
  });

  // 16. Permission denied
  it('16. handles permission denied gracefully without crashing or enabling auto-tracking', async () => {
    vi.spyOn(smsExpenseService, 'isAndroidDevice').mockReturnValue(true);
    vi.spyOn(smsPluginWebImpl, 'requestPermissions').mockResolvedValue({
      sms: 'denied',
      receiveSms: 'denied',
    } as any);

    // Set explicitly disabled
    Storage.setSmsAutoTrackingEnabled(false);

    const status = await smsExpenseService.requestPermission();
    expect(status).toBe('denied');
    expect(Storage.isSmsAutoTrackingEnabled()).toBe(false);
  });

  // 17. Permission granted
  it('17. enables auto-tracking upon user granting permission', async () => {
    vi.spyOn(smsExpenseService, 'isAndroidDevice').mockReturnValue(true);
    vi.spyOn(smsPluginWebImpl, 'requestPermissions').mockResolvedValue({
      sms: 'granted',
      receiveSms: 'granted',
    } as any);

    const status = await smsExpenseService.requestPermission();
    expect(status).toBe('granted');
    expect(Storage.isSmsAutoTrackingEnabled()).toBe(true);
  });

  // 18. Historical inbox scan
  it('18. scans historical inbox, imports unseen transactions, and reports exact summary', async () => {
    smsExpenseService.setInboxReaderForTesting(async () => ({
      messages: [
        {
          sender: 'AD-ICICIB',
          body: 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.',
          timestamp: 1000,
        },
        {
          sender: 'VM-HDFCBK',
          body: 'Rs. 450.00 debited from HDFC Bank A/c 4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342.',
          timestamp: 2000,
        },
        {
          sender: 'VM-HDFCBK',
          body: 'Your OTP for Swiggy payment is 592810. Do not share this OTP.',
          timestamp: 3000,
        },
      ],
    }));

    try {
      const summary = await smsExpenseService.scanRecentInbox(10);
      expect(summary.scanned).toBe(3);
      expect(summary.transactionsFound).toBe(2);
      expect(summary.imported).toBe(2);
      expect(summary.skippedDuplicates).toBe(0);
      expect(summary.ignored).toBe(1);

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);
    } finally {
      smsExpenseService.setInboxReaderForTesting(null);
    }
  });

  // 19. New incoming SMS event
  it('19. processes live incoming SMS events and dispatches custom event', () => {
    let capturedEventDetail: any = null;
    const listener = (e: any) => {
      capturedEventDetail = e.detail;
    };
    window.addEventListener('sms_expense_auto_logged', listener);

    try {
      const sms = 'Paid Rs. 199.00 to ZEPTO via UPI on 25-Sep-26. UPI Ref: 554433221100.';
      const res = smsExpenseService.processSms(sms, 'AD-GPAY', 1000, false);

      expect(res.status).toBe('logged');
      expect(capturedEventDetail).not.toBeNull();
      expect(capturedEventDetail.expense.amount).toBe(199);
      expect(capturedEventDetail.expense.name).toBe('Zepto');
      expect(Storage.getExpenses().length).toBe(1);
    } finally {
      window.removeEventListener('sms_expense_auto_logged', listener);
    }
  });

  // 20. Transaction creation using existing mutation / store
  it('20. ensures SMS expenses use canonical schema and integrate seamlessly with existing spending totals', () => {
    // 1. Manually add an existing manual expense
    const manualExpense: ExpenseItem = {
      id: 'exp-manual-1',
      name: 'Coffee',
      amount: 150,
      category: 'Snacks & Coffee',
      date: '2026-09-25',
      paymentMethod: 'UPI',
    };
    Storage.setExpenses([manualExpense]);

    // 2. Auto-log an expense from SMS
    const sms = 'Paid Rs. 350.00 to SWIGGY via UPI on 25-Sep-26. UPI Ref: 429384928342.';
    const res = smsExpenseService.processSms(sms, 'AD-ICICIB', 1000, false);
    expect(res.status).toBe('logged');

    // 3. Inspect updated expenses list
    const allExpenses = Storage.getExpenses();
    expect(allExpenses.length).toBe(2);

    // Verify SMS expense has canonical attributes
    const smsExpense = allExpenses.find((e) => e.id === res.expense?.id);
    expect(smsExpense).toBeDefined();
    expect(smsExpense?.amount).toBe(350);
    expect(smsExpense?.source).toBe('sms_auto');
    expect(smsExpense?.smsReferenceId).toBe('429384928342');

    // Total spending calculation matches sum of manual + SMS expenses
    const totalSpending = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    expect(totalSpending).toBe(500); // 150 + 350
  });
});
