import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { parseSmsTransaction } from '../services/smsParser';
import { smsExpenseService, isTraiServiceSender, isBankOrFinancialSender } from '../services/smsExpenseService';
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

describe('LifeOS v2 Phase 4.1 – Critical SMS Regression Fix', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.clearSmsTransactionLogs();
    Storage.setSmsAutoTrackingEnabled(true);
  });

  // =========================================================================
  // 1. PAYEE NAME EXTRACTION (Instead of generic "UPI")
  // =========================================================================
  describe('1. Payee Name Extraction: Correct recipient instead of "UPI"', () => {
    it('extracts "Arpita Priyadar" from standard transfer to payee', () => {
      const sms = 'Dear UPI user A/C 9876 debited by 500.00 on 24-Sep-26 transfer to Arpita Priyadar Ref No 429482938491. Avail Bal: Rs 4,500.';
      const res = parseSmsTransaction(sms, 'AD-SBIUPI');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
      expect(res.merchant).not.toBe('UPI');
      expect(res.merchant).not.toBe('UPI Payment');
      expect(res.amount).toBe(500);
      expect(res.referenceId).toBe('429482938491');
    });

    it('extracts "Arpita Priyadar" from "to UPI/Arpita Priyadar"', () => {
      const sms = 'Rs 250.00 debited from ICICI Bank A/c XX123 on 24-Sep-26 to UPI/Arpita Priyadar. Ref: 123456789012.';
      const res = parseSmsTransaction(sms, 'AD-ICICIB');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
      expect(res.merchant).not.toBe('UPI');
    });

    it('extracts "Arpita Priyadar" from "towards UPI to Arpita Priyadar"', () => {
      const sms = 'A/c *1234 debited by Rs.100.00 on 24-09-26 towards UPI to Arpita Priyadar (UPI Ref: 429482938492)';
      const res = parseSmsTransaction(sms, 'HDFCBK');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
      expect(res.merchant).not.toBe('UPI');
    });

    it('extracts "Arpita Priyadar" from "by UPI to Arpita Priyadar"', () => {
      const sms = 'Your A/c no. XX1234 debited for Rs.750.00 on 24-09-26 by UPI to Arpita Priyadar. UTR: 887766554433.';
      const res = parseSmsTransaction(sms, 'AX-AXISBK');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
    });

    it('extracts "Arpita Priyadar" from VPA parenthesized name "to VPA arpitapriyadar@okaxis (Arpita Priyadar)"', () => {
      const sms = 'Rs.500.00 debited from A/c **1234 to VPA arpitapriyadar@okaxis (Arpita Priyadar) on 24-09-26. Ref 554433221100.';
      const res = parseSmsTransaction(sms, 'KOTAKB');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
    });

    it('extracts "Arpita Priyadar" from VPA handle "arpita.priyadar@okhdfcbank"', () => {
      const sms = 'INR 350.00 debited from A/c 5678 to arpita.priyadar@okhdfcbank on 24-Sep-26. UPI Ref 998877665544.';
      const res = parseSmsTransaction(sms, 'AD-HDFCBK');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
    });

    it('extracts "Arpita Priyadar" from hyphenated UPI format "UPI:123456789012-Arpita Priyadar"', () => {
      const sms = 'Kotak Bank: Rs 200.00 debited from A/c XX3344 on 24-Sep-26. UPI:123456789012-Arpita Priyadar. Bal: Rs 12,090.00.';
      const res = parseSmsTransaction(sms, 'BZ-KOTAKB');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
    });

    it('extracts "Arpita Priyadar" from info slash format "Info: UPI/123456789012/Arpita Priyadar/ICICI"', () => {
      const sms = 'Your a/c 1234 is debited by Rs 500.00 on 24-09-2026. Info: UPI/123456789012/Arpita Priyadar/ICICI. Avl Bal Rs 5,000.';
      const res = parseSmsTransaction(sms, 'VM-BOBTXN');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
    });

    it('extracts "Arpita Priyadar" from explicit "Payee: Arpita Priyadar"', () => {
      const sms = 'Debit of Rs. 1,000.00 completed on 24-Sep-2026. Payee: Arpita Priyadar. UPI Ref 443322110099. Bal: Rs. 20,000.';
      const res = parseSmsTransaction(sms, 'ID-UNIONB');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
    });

    it('extracts "Arpita Priyadar" from multiline SMS', () => {
      const sms = `HDFC Bank Alert:
Rs. 600.00 debited
To: Arpita Priyadar
UPI Ref: 665544332211
Date: 24-Sep-26`;
      const res = parseSmsTransaction(sms, 'HDFCBK');
      expect(res.isTransaction).toBe(true);
      expect(res.merchant).toBe('Arpita Priyadar');
    });
  });

  // =========================================================================
  // 2. MULTIPLE PAYMENTS TO THE SAME RECIPIENT
  // =========================================================================
  describe('2. Multiple Payments to Same Recipient', () => {
    it('creates two separate transactions when two payments are made to Arpita Priyadar with different reference IDs', () => {
      const sms1 = 'Dear UPI user A/C 9876 debited by 500.00 on 24-Sep-26 transfer to Arpita Priyadar Ref No 429482938491. Avail Bal: Rs 4,500.';
      const sms2 = 'Dear UPI user A/C 9876 debited by 500.00 on 24-Sep-26 transfer to Arpita Priyadar Ref No 429482938492. Avail Bal: Rs 4,000.';

      const res1 = smsExpenseService.processSms(sms1, 'AD-SBIUPI', Date.now(), false);
      const res2 = smsExpenseService.processSms(sms2, 'AD-SBIUPI', Date.now() + 60000, false);

      expect(res1.status).toBe('logged');
      expect(res2.status).toBe('logged');

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);
      expect(expenses[0].name).toBe('Arpita Priyadar');
      expect(expenses[1].name).toBe('Arpita Priyadar');
      expect(expenses[0].smsReferenceId).toBe('429482938492');
      expect(expenses[1].smsReferenceId).toBe('429482938491');
    });

    it('creates two separate transactions when two payments are made to Arpita Priyadar with different amounts', () => {
      const sms1 = 'Rs. 250.00 debited from A/c *1234 on 24-Sep-26 to Arpita Priyadar.';
      const sms2 = 'Rs. 750.00 debited from A/c *1234 on 24-Sep-26 to Arpita Priyadar.';

      const res1 = smsExpenseService.processSms(sms1, 'HDFCBK', Date.now(), false);
      const res2 = smsExpenseService.processSms(sms2, 'HDFCBK', Date.now() + 120000, false);

      expect(res1.status).toBe('logged');
      expect(res2.status).toBe('logged');

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);
      expect(expenses.find(e => e.amount === 250 && e.name === 'Arpita Priyadar')).toBeDefined();
      expect(expenses.find(e => e.amount === 750 && e.name === 'Arpita Priyadar')).toBeDefined();
    });
  });

  // =========================================================================
  // 3. SCAN RECENT BANK SMS & DEDUPLICATION IDEMPOTENCY
  // =========================================================================
  describe('3. Scan Recent Bank SMS & Deduplication Idempotency', () => {
    it('imports every unseen transaction on initial scan, and skips all duplicates on re-scan', () => {
      const sampleInbox = [
        {
          sender: 'VK-HDFCBK',
          body: 'Rs.450.00 debited from HDFC Bank A/c **4120 on 24-Sep-26 to SWIGGY. UPI: 429384928342. Avl bal: Rs.14,200.00.',
          timestamp: Date.now() - 3600000,
        },
        {
          sender: 'AD-ICICIB',
          body: 'Dear Customer, your Acct ending 1234 has been debited by INR 643.60 on 24-Sep-26 to Arpita Priyadar. UPI:132241653425. Avail Bal: Rs 44,566.40.',
          timestamp: Date.now() - 1800000,
        },
        {
          sender: 'BZ-KOTAKB',
          body: 'Kotak Bank: Rs 250.00 debited from A/c XX3344 on 24-Sep-26. UPI:556677889900-CHAAYOS. Bal: Rs 12,090.00.',
          timestamp: Date.now() - 900000,
        },
      ];

      // PASS 1: Simulate "Scan Recent Bank SMS"
      let pass1Logged = 0;
      let pass1Skipped = 0;
      for (const msg of sampleInbox) {
        const res = smsExpenseService.processSms(msg.body, msg.sender, msg.timestamp, false);
        if (res.status === 'logged') pass1Logged++;
        else if (res.status === 'duplicate_skipped') pass1Skipped++;
      }

      expect(pass1Logged).toBe(3);
      expect(pass1Skipped).toBe(0);
      expect(Storage.getExpenses().length).toBe(3);

      // PASS 2: Simulate clicking "Scan Recent Bank SMS" again
      let pass2Logged = 0;
      let pass2Skipped = 0;
      for (const msg of sampleInbox) {
        const res = smsExpenseService.processSms(msg.body, msg.sender, msg.timestamp, false);
        if (res.status === 'logged') pass2Logged++;
        else if (res.status === 'duplicate_skipped') pass2Skipped++;
      }

      // PASS 2 MUST create ZERO new entries and skip ALL 3 as duplicates!
      expect(pass2Logged).toBe(0);
      expect(pass2Skipped).toBe(3);
      expect(Storage.getExpenses().length).toBe(3);
    });
  });

  // =========================================================================
  // 4. BANK HEADERS & MONITORING (Capturing non -S headers)
  // =========================================================================
  describe('4. Bank Senders & Automatic Monitoring', () => {
    it('accepts legitimate Indian bank senders that do NOT end with -S', () => {
      const bankSenders = [
        'VK-HDFCBK',
        'AD-ICICIB',
        'AX-AXISBK',
        'JM-SBIINB',
        'BP-CANBNK',
        'BZ-KOTAKB',
        'HDFCBANK',
        'SBIINB',
        'PAYTM',
      ];

      for (const sender of bankSenders) {
        expect(isBankOrFinancialSender(sender)).toBe(true);
      }
    });

    it('rejects personal 10-12 digit mobile numbers', () => {
      const personalNumbers = ['9876543210', '+919876543210', '919876543210'];
      for (const num of personalNumbers) {
        expect(isBankOrFinancialSender(num)).toBe(false);
      }
    });

    it('captures transaction from real bank sender without -S suffix during monitoring', () => {
      const sms = 'Rs 300.00 debited from A/c XX1234 on 24-Sep-26 to Zomato. UPI Ref 776655443322.';
      const res = smsExpenseService.processSms(sms, 'VK-HDFCBK', Date.now(), false);
      expect(res.status).toBe('logged');
      expect(res.expense?.name).toBe('Zomato');
      expect(res.expense?.amount).toBe(300);
    });
  });
});
