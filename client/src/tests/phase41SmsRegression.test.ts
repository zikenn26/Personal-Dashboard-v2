import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { parseSmsTransaction, toTitleCase, cleanMerchantName } from '../services/smsParser';
import { smsExpenseService, isTraiServiceSender } from '../services/smsExpenseService';
import { Storage } from '../utils/storage';

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

describe('Phase 4.1 Critical SMS Regression & Payee Extraction Suite', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.clearSmsTransactionLogs();
    Storage.setSmsAutoTrackingEnabled(true);
  });

  // ==========================================================================
  // 1. NEW FEATURE: PAYEE NAME EXTRACTION & TITLE CASE
  // ==========================================================================
  describe('1. Payee Name Extraction & Title Case', () => {
    it('extracts Arpita Priyadar from user specified ICICI Bank SMS sample', () => {
      const sms = 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';
      const res = parseSmsTransaction(sms, 'AD-ICICIB');

      expect(res.isTransaction).toBe(true);
      expect(res.type).toBe('expense');
      expect(res.amount).toBe(303);
      expect(res.currency).toBe('₹');
      // Must extract actual recipient/payee name instead of "UPI"
      expect(res.merchant).toBe('Arpita Priyadar');
      expect(res.payee).toBe('Arpita Priyadar');
      expect(res.referenceId).toBe('663416590461');
      expect(res.paymentMethod).toBe('UPI');
      expect(res.bankOrAccount).toContain('ICICI');
      expect(res.date).toBe('2026-09-25');
    });

    it('always formats names in Title Case (e.g. uppercase, lowercase, mixed case)', () => {
      expect(toTitleCase('ARPITA PRIYADAR')).toBe('Arpita Priyadar');
      expect(toTitleCase('arpita priyadar')).toBe('Arpita Priyadar');
      expect(toTitleCase('Arpita Priyadar')).toBe('Arpita Priyadar');
      expect(toTitleCase('SWIGGY BANGALORE')).toBe('Swiggy Bangalore');
      expect(toTitleCase('MOHIT SHARMA')).toBe('Mohit Sharma');
      expect(cleanMerchantName('ARPITA PRIYADAR')).toBe('Arpita Priyadar');
      expect(cleanMerchantName('ZOMATO FOODS')).toBe('Zomato Foods');
    });

    it('supports "credited" patterns (e.g. "; NAME credited", "credited to NAME", "credited: NAME")', () => {
      // Pattern 1: Semicolon delimited
      const sms1 = 'A/c XX123 debited for Rs 500.00 on 25-Sep-26; MOHIT SHARMA credited. UPI:123456789012.';
      const res1 = parseSmsTransaction(sms1, 'ICICIB');
      expect(res1.merchant).toBe('Mohit Sharma');

      // Pattern 2: credited to
      const sms2 = 'Debited Rs. 420.00 from A/c 5678 and credited to POOJA VERMA. Ref 987654321012.';
      const res2 = parseSmsTransaction(sms2, 'HDFCBK');
      expect(res2.merchant).toBe('Pooja Verma');

      // Pattern 3: multiline credited
      const sms3 = 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26\nARPITA PRIYADAR credited.\nUPI:663416590461.';
      const res3 = parseSmsTransaction(sms3, 'AD-ICICIB');
      expect(res3.merchant).toBe('Arpita Priyadar');
    });

    it('supports "paid to", "sent to", "transfer to" patterns', () => {
      const smsPaidTo = 'Rs. 450.00 debited from A/c 4120 on 23-Sep-26 paid to SWIGGY. UPI: 429384928342.';
      expect(parseSmsTransaction(smsPaidTo, 'HDFCBK').merchant).toBe('Swiggy');

      const smsSentTo = 'INR 500 debited from A/c 9900 sent to ROHAN GUPTA. Ref 554433221100.';
      expect(parseSmsTransaction(smsSentTo, 'AXISBK').merchant).toBe('Rohan Gupta');

      const smsTransferTo = 'Dear UPI user A/C 9876 debited by 1200.00 on 23Sep26 transfer to MOHIT SHARMA Ref No 429482938492.';
      expect(parseSmsTransaction(smsTransferTo, 'SBIUPI').merchant).toBe('Mohit Sharma');
    });

    it('extracts merchant names from "purchase at", "at [Merchant]"', () => {
      const smsAt = 'Used on Card ending 4412 for purchase of Rs 2499.00 at AMAZON INDIA on 23-Sep-2026. Txn ID: 998877665544.';
      expect(parseSmsTransaction(smsAt, 'ICICI').merchant).toBe('Amazon India');

      const smsStarbucks = 'INR 350.00 spent on Card ending 4412 at STARBUCKS on 23-09-2026 14:15:30.';
      expect(parseSmsTransaction(smsStarbucks, 'AXIS').merchant).toBe('Starbucks');
    });

    it('extracts and titles UPI handles when no name exists', () => {
      const smsVpa = 'Debited Rs 250 to vpa arpitapriyadar@okaxis on 25-Sep-26. UPI: 112233445566.';
      const res = parseSmsTransaction(smsVpa, 'ICICIB');
      expect(res.merchant).toBe('Arpitapriyadar');

      const smsVpaDots = 'Debited Rs 250 to vpa arpita.priyadar@okaxis on 25-Sep-26. UPI: 112233445566.';
      const resDots = parseSmsTransaction(smsVpaDots, 'ICICIB');
      expect(resDots.merchant).toBe('Arpita Priyadar');
    });
  });

  // ==========================================================================
  // 2. DEDUPLICATION ENGINE FIXES
  // ==========================================================================
  describe('2. Deduplication Engine Rules', () => {
    it('creates two separate transactions for two payments to the same person with different UTR numbers', () => {
      const sms1 = 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';
      const sms2 = 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590462.';

      const res1 = smsExpenseService.processSms(sms1, 'AD-ICICIB', 1000, false);
      const res2 = smsExpenseService.processSms(sms2, 'AD-ICICIB', 2000, false);

      expect(res1.status).toBe('logged');
      expect(res2.status).toBe('logged');

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);
      expect(expenses[0].name).toBe('Arpita Priyadar');
      expect(expenses[1].name).toBe('Arpita Priyadar');
      expect(expenses[0].amount).toBe(303);
      expect(expenses[1].amount).toBe(303);
      expect(expenses.map((e) => e.smsReferenceId).sort()).toEqual(['663416590461', '663416590462']);
    });

    it('creates two separate transactions for two payments to the same person with different amounts', () => {
      const sms1 = 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26 to ARPITA PRIYADAR.';
      const sms2 = 'ICICI Bank Acct XX070 debited for Rs 500.00 on 25-Sep-26 to ARPITA PRIYADAR.';

      const res1 = smsExpenseService.processSms(sms1, 'AD-ICICIB', 1000, false);
      const res2 = smsExpenseService.processSms(sms2, 'AD-ICICIB', 2000, false);

      expect(res1.status).toBe('logged');
      expect(res2.status).toBe('logged');

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);
      expect(expenses.find((e) => e.amount === 303)).toBeDefined();
      expect(expenses.find((e) => e.amount === 500)).toBeDefined();
    });

    it('correctly rejects true duplicate replays of the same transaction SMS', () => {
      const sms = 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';

      const res1 = smsExpenseService.processSms(sms, 'AD-ICICIB', 1000, false);
      expect(res1.status).toBe('logged');

      // Replaying identical SMS
      const res2 = smsExpenseService.processSms(sms, 'AD-ICICIB', 2000, false);
      expect(res2.status).toBe('duplicate_skipped');

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(1);
    });

    it('never deduplicates solely on payee name or amount', () => {
      const parsed1 = parseSmsTransaction('Debited 500 to Swiggy on 25-Sep-26 UPI:111111111111', 'HDFCBK');
      const parsed2 = parseSmsTransaction('Debited 500 to Swiggy on 25-Sep-26 UPI:222222222222', 'HDFCBK');

      const decision = smsExpenseService.checkIsDuplicate(parsed2, [
        {
          id: 'exp-1',
          name: 'Swiggy',
          amount: 500,
          date: '2026-09-25',
          category: 'Dining Out',
          smsReferenceId: '111111111111',
        },
      ]);

      expect(decision.isDuplicate).toBe(false);
    });
  });

  // ==========================================================================
  // 3. SENDER CAPTURE & AUTO MONITORING FIX
  // ==========================================================================
  describe('3. Bank Sender Capture During Automatic Monitoring', () => {
    it('captures bank transaction SMS from senders without -S suffix', () => {
      const senders = ['AD-ICICIB', 'VK-ICICIT', 'VM-HDFCBK', 'BZ-SBIINB', 'AX-AXISBK', 'HDFCBK', 'ICICIB', 'SBIUPI'];

      senders.forEach((sender, idx) => {
        expect(isTraiServiceSender(sender)).toBe(true);

        const sms = `Bank Acct XX${idx} debited for Rs ${100 + idx}.00 on 25-Sep-26 to Store ${idx}. UPI: 99887766000${idx}.`;
        const res = smsExpenseService.processSms(sms, sender, 1000 + idx, false);
        expect(res.status).toBe('logged');
        expect(res.expense?.amount).toBe(100 + idx);
      });

      expect(Storage.getExpenses().length).toBe(senders.length);
    });
  });

  // ==========================================================================
  // 4. SCAN RECENT BANK SMS WORKFLOW
  // ==========================================================================
  describe('4. Scan Recent Bank SMS Inbox Workflow', () => {
    it('imports all unseen transactions and reports exact summary metrics', async () => {
      smsExpenseService.setInboxReaderForTesting(async () => ({
        messages: [
          {
            sender: 'AD-ICICIB',
            body: 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.',
            timestamp: 1000,
          },
          {
            sender: 'HDFCBK',
            body: 'Rs.450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342. Avl bal: Rs.14,200.00.',
            timestamp: 2000,
          },
          {
            sender: 'HDFCBK',
            body: 'Your OTP for transaction of Rs.500 at Swiggy is 492810. Do not share this OTP.',
            timestamp: 3000,
          },
        ],
      }));

      try {
        // Run first scan
        const summary1 = await smsExpenseService.scanRecentInbox(10);
        expect(summary1.scanned).toBe(3);
        expect(summary1.transactionsFound).toBe(2);
        expect(summary1.imported).toBe(2);
        expect(summary1.skippedDuplicates).toBe(0);
        expect(summary1.ignored).toBe(1);

        const expenses = Storage.getExpenses();
        expect(expenses.length).toBe(2);
        expect(expenses[0].name).toBe('Swiggy');
        expect(expenses[1].name).toBe('Arpita Priyadar');

        // Run second scan with exact same messages in inbox
        const summary2 = await smsExpenseService.scanRecentInbox(10);
        expect(summary2.scanned).toBe(3);
        expect(summary2.transactionsFound).toBe(2);
        expect(summary2.imported).toBe(0); // Zero duplicates imported!
        expect(summary2.skippedDuplicates).toBe(2); // Both recognized as duplicates!
        expect(summary2.ignored).toBe(1);

        // Spending list remains at 2
        expect(Storage.getExpenses().length).toBe(2);
      } finally {
        smsExpenseService.setInboxReaderForTesting(null);
      }
    });
  });
});
