import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { parseSmsTransaction, inferExpenseCategory } from '../services/smsParser';
import { smsExpenseService } from '../services/smsExpenseService';
import { Storage, STORAGE_KEYS } from '../utils/storage';
import { ExpenseItem } from '../types';

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

describe('Android SMS Expense & Transaction Auto-Logging Suite', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Non-Transaction and Safety Rejections', () => {
    it('strictly rejects authentication OTP messages containing an amount', () => {
      const otpSms =
        'Your OTP for transaction of Rs.500 at Swiggy is 492810. Do not share this OTP with anyone. Valid for 10 mins.';
      const res = parseSmsTransaction(otpSms, 'HDFCBK');

      expect(res.isTransaction).toBe(false);
      expect(res.ignoreReason).toContain('OTP');
    });

    it('strictly rejects promotional loan offers with amounts', () => {
      const loanSms =
        'Congratulations! You are eligible for pre-approved personal loan up to Rs. 5,00,000. Apply now: https://short.url';
      const res = parseSmsTransaction(loanSms, 'BAJAJ');

      expect(res.isTransaction).toBe(false);
      expect(res.ignoreReason).toContain('Promotional');
    });

    it('strictly rejects upcoming unpaid bill due reminders', () => {
      const billDueSms =
        'Your electricity bill of Rs 1,450 is due on 28-Sep. Pay now to avoid late fee and disconnection.';
      const res = parseSmsTransaction(billDueSms, 'BESCOM');

      expect(res.isTransaction).toBe(false);
      expect(res.ignoreReason).toContain('Upcoming Bill Due');
    });

    it('strictly rejects telecom plan and data quota expiry messages', () => {
      const dataSms =
        'Your daily data pack has expired. Recharge with Rs 19 to get 1GB high speed data.';
      const res = parseSmsTransaction(dataSms, 'JIO');

      expect(res.isTransaction).toBe(false);
      expect(res.ignoreReason).toBeDefined();
    });

    it('strictly rejects failed or declined transactions', () => {
      const failedSms =
        'Transaction of Rs 850.00 at DMart was DECLINED due to incorrect PIN. Please retry.';
      const res = parseSmsTransaction(failedSms, 'SBIINB');

      expect(res.isTransaction).toBe(false);
      expect(res.ignoreReason).toContain('declined');
    });

    it('strictly rejects empty or blank SMS text', () => {
      const res = parseSmsTransaction('   ', 'UNKNOWN');
      expect(res.isTransaction).toBe(false);
    });
  });

  describe('2. Real Bank SMS Parsing & Extraction', () => {
    it('correctly extracts HDFC Bank UPI debit for Food & Dining', () => {
      const text =
        'Rs.450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342. Avl bal: Rs.14,200.00.';
      const res = parseSmsTransaction(text, 'HDFCBK');

      expect(res.isTransaction).toBe(true);
      expect(res.type).toBe('expense');
      expect(res.amount).toBe(450);
      expect(res.currency).toBe('₹');
      expect(res.merchant).toBe('Swiggy');
      expect(res.category).toBe('Dining Out');
      expect(res.referenceId).toBe('429384928342');
      expect(res.accountLast4).toBe('4120');
      expect(res.paymentMethod).toBe('UPI');
      expect(res.bankOrAccount).toContain('HDFC Bank');
    });

    it('correctly extracts SBI UPI person-to-person transfer', () => {
      const text =
        'Dear UPI user A/C 9876 debited by 1200.00 on 23Sep26 transfer to MOHIT SHARMA Ref No 429482938492.';
      const res = parseSmsTransaction(text, 'SBIINB');

      expect(res.isTransaction).toBe(true);
      expect(res.type).toBe('expense');
      expect(res.amount).toBe(1200);
      expect(res.merchant).toBe('Mohit Sharma');
      expect(res.referenceId).toBe('429482938492');
      expect(res.accountLast4).toBe('9876');
      expect(res.bankOrAccount).toContain('State Bank of India');
    });

    it('correctly extracts ICICI Credit Card purchase for Shopping', () => {
      const text =
        'Your ICICI Bank Credit Card XX2004 has been used for purchase of INR 2,499.00 at AMAZON INDIA on 23-Sep-2026. Avl Lmt: INR 85,000.';
      const res = parseSmsTransaction(text, 'ICICIB');

      expect(res.isTransaction).toBe(true);
      expect(res.type).toBe('expense');
      expect(res.amount).toBe(2499);
      expect(res.merchant).toBe('Amazon India');
      expect(res.category).toBe('Shopping & Retail');
      expect(res.paymentMethod).toBe('Credit Card');
      expect(res.accountLast4).toBe('2004');
    });

    it('correctly extracts Axis Bank card purchase for Coffee & Snacks', () => {
      const text =
        'Axis Bank: INR 350.00 spent on Card ending 4412 at STARBUCKS on 23-09-2026 14:15:30. Avail Bal: INR 12,500.00.';
      const res = parseSmsTransaction(text, 'AXISBK');

      expect(res.isTransaction).toBe(true);
      expect(res.amount).toBe(350);
      expect(res.merchant).toBe('Starbucks');
      expect(res.category).toBe('Snacks & Coffee');
      expect(res.time).toBe('14:15');
      expect(res.paymentMethod).toBe('Credit Card');
    });

    it('correctly extracts Zepto grocery order via GPay', () => {
      const text = 'Paid Rs.199 to ZEPTO via Google Pay UPI. Txn ID: 40928392834.';
      const res = parseSmsTransaction(text, 'GPAY');

      expect(res.isTransaction).toBe(true);
      expect(res.amount).toBe(199);
      expect(res.merchant).toBe('Zepto');
      expect(res.category).toBe('Groceries & Food');
      expect(res.paymentMethod).toBe('UPI');
      expect(res.referenceId).toBe('40928392834');
    });

    it('correctly extracts ATM Cash Withdrawal', () => {
      const text =
        'Rs.2000.00 withdrawn from ATM using Debit Card **1234 on 23-Sep-26. Avl bal: Rs.8,500.';
      const res = parseSmsTransaction(text, 'HDFCBK');

      expect(res.isTransaction).toBe(true);
      expect(res.type).toBe('expense');
      expect(res.amount).toBe(2000);
      expect(res.merchant).toBe('ATM Cash Withdrawal');
      expect(res.paymentMethod).toBe('Debit Card');
      expect(res.accountLast4).toBe('1234');
    });

    it('correctly extracts Salary or Income Credit', () => {
      const text = 'A/c *4512 credited with INR 45,000.00 on 23-Sep-26 by Salary. Avl Bal: INR 52,000.';
      const res = parseSmsTransaction(text, 'HDFCBK');

      expect(res.isTransaction).toBe(true);
      expect(res.type).toBe('income');
      expect(res.amount).toBe(45000);
      expect(res.merchant).toContain('Salary');
    });
  });

  describe('3. Automated Expense Logging & Duplicate Prevention', () => {
    it('creates an ExpenseItem in Storage when valid financial SMS arrives', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      const smsText =
        'Rs.320.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to KFC. UPI: 998877665544.';
      const result = smsExpenseService.processSms(smsText, 'AD-HDFCBK-S', Date.now(), false);

      expect(result.success).toBe(true);
      expect(result.status).toBe('logged');
      expect(result.expense).toBeDefined();
      expect(result.expense?.amount).toBe(320);
      expect(result.expense?.name).toBe('Kfc');
      expect(result.expense?.source).toBe('sms_auto');

      // Verify stored in Storage.getExpenses()
      const stored = Storage.getExpenses();
      expect(stored.length).toBe(1);
      expect(stored[0].id).toBe(result.expense?.id);

      // Verify audit log
      const logs = Storage.getSmsTransactionLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('logged');
    });

    it('intelligently prevents duplicate entry when identical SMS arrives twice', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      const smsText =
        'Paid Rs.150 to Chai Point via PhonePe UPI. UPI Ref: 123456789012.';

      // First delivery
      const first = smsExpenseService.processSms(smsText, 'AD-PHONEPE-S', Date.now(), false);
      expect(first.status).toBe('logged');
      expect(Storage.getExpenses().length).toBe(1);

      // Duplicate delivery (e.g. telecom retry or dual SMS alert)
      const second = smsExpenseService.processSms(smsText, 'AD-PHONEPE-S', Date.now(), false);
      expect(second.status).toBe('duplicate_skipped');
      expect(second.reason).toBeDefined();

      // Total expenses should still strictly be 1!
      expect(Storage.getExpenses().length).toBe(1);
    });

    it('prevents duplicate when transaction already logged with matching reference ID', () => {
      // Pre-seed an existing expense with matching reference ID
      const existing: ExpenseItem = {
        id: 'exp-manual-1',
        name: 'Dominos Pizza',
        amount: 650,
        category: 'Food & Dining',
        date: '2026-09-23',
        smsReferenceId: 'REF-DOMINOS-9988',
      };
      Storage.setExpenses([existing]);

      const smsText =
        'INR 650.00 debited from Card **1111 at DOMINOS on 23-Sep-26. Txn ID: REF-DOMINOS-9988.';
      const res = smsExpenseService.processSms(smsText, 'AD-HDFCBK-S', Date.now(), false);

      expect(res.status).toBe('duplicate_skipped');
      expect(res.reason).toContain('REF-DOMINOS-9988');
      expect(Storage.getExpenses().length).toBe(1);
    });

    it('prevents duplicate when matching same amount, same date, and same merchant name without time variance', () => {
      const existing: ExpenseItem = {
        id: 'exp-manual-2',
        name: 'Starbucks',
        amount: 350,
        category: 'Snacks & Coffee',
        date: '2026-09-23',
      };
      Storage.setExpenses([existing]);

      const smsText =
        'Axis Bank: INR 350.00 spent on Card ending 4412 at STARBUCKS on 23-09-2026.';
      const res = smsExpenseService.processSms(smsText, 'AX-AXISBK-S', Date.now(), false);

      expect(res.status).toBe('duplicate_skipped');
      expect(Storage.getExpenses().length).toBe(1);
    });

    it('correctly retains TWO genuinely separate purchases from the same merchant for the same amount (different Ref IDs)', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      // Morning purchase at Starbucks
      const sms1 =
        'Axis Bank: INR 350.00 spent on Card ending 4412 at STARBUCKS on 23-09-2026 10:00:00. Txn ID: AX-STB-001.';
      const res1 = smsExpenseService.processSms(sms1, 'AX-AXISBK-S', Date.now(), false);
      expect(res1.status).toBe('logged');
      expect(Storage.getExpenses().length).toBe(1);

      // Afternoon purchase at same Starbucks for same amount, but different Txn ID & timestamp
      const sms2 =
        'Axis Bank: INR 350.00 spent on Card ending 4412 at STARBUCKS on 23-09-2026 15:30:00. Txn ID: AX-STB-002.';
      const res2 = smsExpenseService.processSms(sms2, 'AX-AXISBK-S', Date.now(), false);
      expect(res2.status).toBe('logged');
      // BOTH distinct purchases must be retained!
      expect(Storage.getExpenses().length).toBe(2);
      expect(Storage.getExpenses()[0].smsReferenceId).toBe('AX-STB-002');
      expect(Storage.getExpenses()[1].smsReferenceId).toBe('AX-STB-001');
    });

    it('correctly retains TWO separate purchases without Ref IDs if timestamps are separated by > 5 minutes', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      const sms1 =
        'Rs.120.00 debited from A/c *1234 on 23-Sep-26 at 09:15 to Chai Point.';
      const res1 = smsExpenseService.processSms(sms1, 'AD-HDFCBK-S', Date.now(), false);
      expect(res1.status).toBe('logged');
      expect(Storage.getExpenses().length).toBe(1);

      const sms2 =
        'Rs.120.00 debited from A/c *1234 on 23-Sep-26 at 16:45 to Chai Point.';
      const res2 = smsExpenseService.processSms(sms2, 'AD-HDFCBK-S', Date.now(), false);
      expect(res2.status).toBe('logged');
      expect(Storage.getExpenses().length).toBe(2);
    });

    it('strictly ignores any SMS not originating from a sender ending in -S (case-insensitive)', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      // Senders not ending in -S
      const nonSSenders = ['FRIEND', '9876543210', 'VM-PROMO-P', 'AD-HDFC-B', 'HDFCBANK', 'GOOGLE'];
      for (const sender of nonSSenders) {
        const sms = 'Rs. 500 debited from A/c *1234 to Merchant. UPI: 11223344.';
        const res = smsExpenseService.processSms(sms, sender, Date.now(), false);
        expect(res.status).toBe('ignored_not_financial');
        expect(res.reason).toContain("does not end with '-S'");
      }

      // Expenses should strictly remain 0!
      expect(Storage.getExpenses().length).toBe(0);
    });

    it('strictly ignores OTP and promotional SMS even if sent from a valid -S header', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      const otpSms =
        'Your OTP for transaction of Rs.500 at Swiggy is 492810. Do not share this OTP with anyone.';
      const otpRes = smsExpenseService.processSms(otpSms, 'AD-HDFCBK-S', Date.now(), false);
      expect(otpRes.status).toBe('ignored_not_financial');
      expect(otpRes.reason).toContain('OTP');

      const promoSms =
        'Congratulations! You are eligible for pre-approved personal loan up to Rs. 5,00,000. Apply now.';
      const promoRes = smsExpenseService.processSms(promoSms, 'AX-AXISBK-S', Date.now(), false);
      expect(promoRes.status).toBe('ignored_not_financial');

      expect(Storage.getExpenses().length).toBe(0);
    });

    it('prevents duplicate after app restart/retry simulation', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      const smsText =
        'Rs.450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342.';
      const first = smsExpenseService.processSms(smsText, 'AD-HDFCBK-S', Date.now(), false);
      expect(first.status).toBe('logged');
      expect(Storage.getExpenses().length).toBe(1);

      // Simulate app restart / retry pass reading the same SMS
      const retry = smsExpenseService.processSms(smsText, 'AD-HDFCBK-S', Date.now(), false);
      expect(retry.status).toBe('duplicate_skipped');
      expect(Storage.getExpenses().length).toBe(1);
    });
  });

  describe('4. Complete End-to-End Workflow', () => {
    it('Enable SMS Detection → grant permission → receive genuine -S transaction SMS → correctly categorize → exactly one Spending entry', async () => {
      // Setup fresh state
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(false);
      expect(Storage.isSmsAutoTrackingEnabled()).toBe(false);

      // Step 1: Enable SMS Detection & grant permission
      vi.spyOn(smsExpenseService, 'isAndroidDevice').mockReturnValue(true);
      const permResult = await smsExpenseService.requestPermission();
      expect(permResult).toBe('granted');
      expect(Storage.isSmsAutoTrackingEnabled()).toBe(true);

      // Step 2: Receive genuine -S transaction SMS
      const sms =
        'Rs.785.00 debited from SBI Bank A/c *8899 on 23-Sep-26 to IRCTC. UPI Ref: 334455667788.';
      const sender = 'AD-SBIUPI-S';

      const result = smsExpenseService.processSms(sms, sender, Date.now(), false);
      expect(result.success).toBe(true);
      expect(result.status).toBe('logged');

      // Step 3: Verify categorization
      expect(result.expense?.category).toBe('Travel & Leisure');
      expect(result.expense?.amount).toBe(785);
      expect(result.expense?.name).toBe('Irctc');
      expect(result.expense?.smsReferenceId).toBe('334455667788');

      // Step 4: Verify exactly one Spending entry is created
      const allExpenses = Storage.getExpenses();
      expect(allExpenses.length).toBe(1);
      expect(allExpenses[0].id).toBe(result.expense?.id);
      expect(allExpenses[0].amount).toBe(785);
    });
  });

  describe('5. Settings Toggle and State Persistence', () => {
    it('persists enabled state in Storage', async () => {
      expect(Storage.isSmsAutoTrackingEnabled()).toBe(false);

      await smsExpenseService.setAutoTrackingEnabled(true);
      expect(Storage.isSmsAutoTrackingEnabled()).toBe(true);

      await smsExpenseService.setAutoTrackingEnabled(false);
      expect(Storage.isSmsAutoTrackingEnabled()).toBe(false);
    });

    it('maintains and clears SMS audit logs properly', () => {
      Storage.clearSmsTransactionLogs();
      expect(Storage.getSmsTransactionLogs().length).toBe(0);

      smsExpenseService.processSms('Random non-financial text', 'FRIEND', Date.now(), false);
      expect(Storage.getSmsTransactionLogs().length).toBe(1);
      expect(Storage.getSmsTransactionLogs()[0].status).toBe('ignored_not_financial');

      Storage.clearSmsTransactionLogs();
      expect(Storage.getSmsTransactionLogs().length).toBe(0);
    });
  });

  describe('6. Rapid Same-Bank Transactions & UPI Deduplication Priority', () => {
    it('reliably extracts UPI reference numbers from formats with colon, quotes, or slashes', () => {
      const sms1 = 'Dear Customer, your Acct ending 1234 has been debited by INR 1748.60 on 24-Sep-26 towards UPI:131834525249. Available Bal: Rs 5000.';
      const res1 = parseSmsTransaction(sms1, 'AD-ICICIT-S');
      expect(res1.isTransaction).toBe(true);
      expect(res1.amount).toBe(1748.60);
      expect(res1.referenceId).toBe('131834525249');

      const smsQuotes = 'ICICI Bank: Acct XX123 debited with Rs 643.60 on 24-Sep-26. UPI: "132241653425". Avl Bal: INR 4356.40';
      const resQuotes = parseSmsTransaction(smsQuotes, 'AD-ICICIT-S');
      expect(resQuotes.isTransaction).toBe(true);
      expect(resQuotes.amount).toBe(643.60);
      expect(resQuotes.referenceId).toBe('132241653425');

      const smsSlash = 'ICICI Bank: Acct XX123 debited with Rs 1748.60 on 24-Sep-26. Info: UPI/131834525249/Merchant. Avail Bal: INR 5000';
      const resSlash = parseSmsTransaction(smsSlash, 'AD-ICICIT-S');
      expect(resSlash.isTransaction).toBe(true);
      expect(resSlash.referenceId).toBe('131834525249');

      const smsHyphen = 'ICICI Bank: Acct XX123 debited with Rs 1748.60 on 24-Sep-26. UPI:131834525249-Merchant Name. Avl Bal: INR 5000';
      const resHyphen = parseSmsTransaction(smsHyphen, 'AD-ICICIT-S');
      expect(resHyphen.isTransaction).toBe(true);
      expect(resHyphen.referenceId).toBe('131834525249');
    });

    it('correctly logs both rapid genuine transactions from the same bank (ICICI Rs 1748.60 & Rs 643.60)', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      const now = Date.now();

      // Transaction 1: Rs 1748.60 — UPI: "131834525249"
      const sms1 =
        'Dear Customer, your Acct ending 1234 has been debited by INR 1748.60 on 24-Sep-26 towards UPI:131834525249. Available Bal: Rs 5000.';
      const res1 = smsExpenseService.processSms(sms1, 'AD-ICICIT-S', now, false);
      expect(res1.status).toBe('logged');
      expect(res1.expense?.amount).toBe(1748.60);
      expect(res1.expense?.smsReferenceId).toBe('131834525249');

      // Transaction 2: Rs 643.60 — UPI: "132241653425" (arriving 1 minute later from same bank & account)
      const sms2 =
        'Dear Customer, your Acct ending 1234 has been debited by INR 643.60 on 24-Sep-26 towards UPI:132241653425. Available Bal: Rs 4356.40.';
      const res2 = smsExpenseService.processSms(sms2, 'AD-ICICIT-S', now + 60000, false);
      expect(res2.status).toBe('logged');
      expect(res2.expense?.amount).toBe(643.60);
      expect(res2.expense?.smsReferenceId).toBe('132241653425');

      // Verify BOTH transactions are recorded in Spending
      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);
      expect(expenses[0].smsReferenceId).toBe('132241653425');
      expect(expenses[0].amount).toBe(643.60);
      expect(expenses[1].smsReferenceId).toBe('131834525249');
      expect(expenses[1].amount).toBe(1748.60);
    });

    it('always creates separate Spending entries for different UPI references even with same amount, merchant, and bank within 2 minutes', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      const baseTime = Date.now();

      // First order: Rs 450 at Swiggy via ICICI UPI Ref: 131834525249
      const sms1 =
        'ICICI Bank: Rs 450.00 debited from A/c XX123 on 24-Sep-26 to SWIGGY. UPI:131834525249.';
      const res1 = smsExpenseService.processSms(sms1, 'AD-ICICIT-S', baseTime, false);
      expect(res1.status).toBe('logged');

      // Second order: Rs 450 at Swiggy via ICICI UPI Ref: 132241653425 (placed 2 minutes later)
      const sms2 =
        'ICICI Bank: Rs 450.00 debited from A/c XX123 on 24-Sep-26 to SWIGGY. UPI:132241653425.';
      const res2 = smsExpenseService.processSms(sms2, 'AD-ICICIT-S', baseTime + 120000, false);
      expect(res2.status).toBe('logged');

      // Both must be retained since they have distinct UPI references
      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);
      expect(expenses.map((e) => e.smsReferenceId).sort()).toEqual(['131834525249', '132241653425']);
    });

    it('prevents duplicate when the exact same UPI reference is delivered again', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      const sms =
        'ICICI Bank: Rs 1748.60 debited from A/c XX123 on 24-Sep-26. UPI:131834525249.';
      const res1 = smsExpenseService.processSms(sms, 'AD-ICICIT-S', Date.now(), false);
      expect(res1.status).toBe('logged');

      // Re-delivery of identical reference ID
      const retrySms =
        'ICICI Bank: Rs 1748.60 debited from A/c XX123 on 24-Sep-26. UPI:131834525249. Repeat notice.';
      const res2 = smsExpenseService.processSms(retrySms, 'AD-ICICIT-S', Date.now() + 5000, false);
      expect(res2.status).toBe('duplicate_skipped');
      expect(res2.reason).toContain('131834525249');

      expect(Storage.getExpenses().length).toBe(1);
    });

    it('uses the 5-minute duplicate heuristic ONLY when NO transaction/reference ID can be extracted', () => {
      Storage.setExpenses([]);
      Storage.setSmsAutoTrackingEnabled(true);

      // SMS without reference ID
      const smsWithoutRef1 =
        'Rs 250.00 debited from A/c ending 1234 on 24-Sep-26 at 11:00 to Chaayos.';
      const res1 = smsExpenseService.processSms(smsWithoutRef1, 'AD-HDFCBK-S', Date.now(), false);
      expect(res1.status).toBe('logged');
      expect(res1.expense?.smsReferenceId).toBeUndefined();

      // Similar SMS within 2 minutes without reference ID -> duplicate heuristic triggers
      const smsWithoutRef2 =
        'Rs 250.00 debited from A/c ending 1234 on 24-Sep-26 at 11:02 to Chaayos.';
      const res2 = smsExpenseService.processSms(smsWithoutRef2, 'AD-HDFCBK-S', Date.now() + 120000, false);
      expect(res2.status).toBe('duplicate_skipped');
      expect(res2.reason).toContain('Chaayos');

      expect(Storage.getExpenses().length).toBe(1);
    });
  });
});
