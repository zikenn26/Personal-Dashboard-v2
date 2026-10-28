import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { parseSmsTransaction, toTitleCase, cleanMerchantName } from '../services/smsParser';
import { smsExpenseService } from '../services/smsExpenseService';
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

describe('Phase 4.1 – Critical SMS Regression Fix Suite', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.clearSmsTransactionLogs();
    Storage.clearProcessedSmsFingerprints();
    Storage.setSmsAutoTrackingEnabled(true);
  });

  // =========================================================================
  // 1. NEW FEATURE: PAYEE NAME EXTRACTION
  // =========================================================================
  describe('1. Payee Name Extraction & Title Case Normalization', () => {
    it('accurately extracts and displays recipient name from ICICI Bank SMS example', () => {
      const sms =
        'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';
      const res = parseSmsTransaction(sms, 'AD-ICICIT-S', new Date('2026-09-25T10:00:00Z').getTime());

      expect(res.isTransaction).toBe(true);
      expect(res.amount).toBe(303);
      expect(res.merchant).toBe('Arpita Priyadar'); // Payee in Title Case
      expect(res.referenceId).toBe('663416590461');
      expect(res.paymentMethod).toBe('UPI');
      expect(res.date).toBe('2026-09-25');
      expect(res.bankOrAccount).toContain('ICICI');
    });

    it('supports "credited" patterns (e.g. "...; ARPITA PRIYADAR credited.")', () => {
      const sms = 'Acct XX123 debited for INR 150.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:123456789012.';
      const res = parseSmsTransaction(sms, 'AD-HDFCBK-S');
      expect(res.merchant).toBe('Arpita Priyadar');
    });

    it('supports "has been credited" patterns', () => {
      const sms = 'Acct XX123 debited for Rs. 500.00; RAMESH KUMAR has been credited. Ref 998877665544.';
      const res = parseSmsTransaction(sms, 'AD-SBIUPI-S');
      expect(res.merchant).toBe('Ramesh Kumar');
    });

    it('supports "credited to <NAME>" patterns', () => {
      const sms = 'Your account debited for Rs 750.00 and credited to SNEHA PATEL on 25-Sep-26. UPI:887766554433.';
      const res = parseSmsTransaction(sms, 'AX-AXISBK-S');
      expect(res.merchant).toBe('Sneha Patel');
    });

    it('supports "paid to <NAME>" patterns', () => {
      const sms = 'Paid to Arpita Priyadar Rs 303.00 from ICICI Bank Acct XX070. UPI Ref 663416590461.';
      const res = parseSmsTransaction(sms, 'AD-ICICIT-S');
      expect(res.merchant).toBe('Arpita Priyadar');
    });

    it('supports "sent to <NAME>" patterns', () => {
      const sms = 'Rs 1,200 sent to RAHUL VERMA from your Bank Acct **9876 via UPI. Ref: 445566778899.';
      const res = parseSmsTransaction(sms, 'AD-SBIUPI-S');
      expect(res.merchant).toBe('Rahul Verma');
    });

    it('supports "transfer to <NAME>" patterns', () => {
      const sms = 'Rs. 850 transferred to MOHIT SHARMA via UPI Ref 112233445566. Avl Bal: Rs 15,000.';
      const res = parseSmsTransaction(sms, 'AD-HDFCBK-S');
      expect(res.merchant).toBe('Mohit Sharma');
    });

    it('supports standard merchant names (Swiggy, Kfc, Starbucks, Amazon)', () => {
      const sms1 = 'Rs.450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342.';
      expect(parseSmsTransaction(sms1).merchant).toBe('Swiggy');

      const sms2 = 'Rs.320.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to KFC. UPI: 998877665544.';
      expect(parseSmsTransaction(sms2).merchant).toBe('Kfc');

      const sms3 = 'Axis Bank: INR 350.00 spent on Card ending 4412 at STARBUCKS on 23-09-2026.';
      expect(parseSmsTransaction(sms3).merchant).toBe('Starbucks');
    });

    it('supports UPI handles when no explicit payee name exists', () => {
      const sms = 'Paid Rs 250 to arpita.priyadar@okaxis via UPI. Txn ID: 5566778899.';
      const res = parseSmsTransaction(sms);
      expect(res.merchant).toBe('Arpita Priyadar');
    });

    it('always formats names in Title Case across all inputs', () => {
      expect(toTitleCase('ARPITA PRIYADAR')).toBe('Arpita Priyadar');
      expect(toTitleCase('arpita priyadar')).toBe('Arpita Priyadar');
      expect(toTitleCase('aRpiTa pRiYaDar')).toBe('Arpita Priyadar');
      expect(toTitleCase('AMIT KUMAR SHARMA')).toBe('Amit Kumar Sharma');
      expect(toTitleCase('SWIGGY')).toBe('Swiggy');
      expect(toTitleCase('KFC')).toBe('Kfc');
    });
  });

  // =========================================================================
  // 2. DUPLICATE DETECTION & MULTIPLE PAYMENTS TO SAME RECIPIENT
  // =========================================================================
  describe('2. Duplicate Detection & Multi-Payment Integrity', () => {
    it('creates TWO separate transactions for multiple payments to the same recipient with different UTR/Reference IDs', () => {
      const payment1 =
        'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';
      const payment2 =
        'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590462.';

      const res1 = smsExpenseService.processSms(payment1, 'AD-ICICIT-S', Date.now(), false);
      expect(res1.status).toBe('logged');

      const res2 = smsExpenseService.processSms(payment2, 'AD-ICICIT-S', Date.now() + 60000, false);
      expect(res2.status).toBe('logged');

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);
      expect(expenses[0].name).toBe('Arpita Priyadar');
      expect(expenses[1].name).toBe('Arpita Priyadar');
      expect(expenses[0].smsReferenceId).toBe('663416590462');
      expect(expenses[1].smsReferenceId).toBe('663416590461');
    });

    it('creates TWO separate transactions for multiple payments to the same recipient with different amounts', () => {
      const payment1 =
        'Rs 303.00 debited from Acct XX070 on 25-Sep-26 to ARPITA PRIYADAR. UPI Ref: 100000000001.';
      const payment2 =
        'Rs 500.00 debited from Acct XX070 on 25-Sep-26 to ARPITA PRIYADAR. UPI Ref: 100000000002.';

      const res1 = smsExpenseService.processSms(payment1, 'AD-ICICIT-S', Date.now(), false);
      expect(res1.status).toBe('logged');

      const res2 = smsExpenseService.processSms(payment2, 'AD-ICICIT-S', Date.now() + 10000, false);
      expect(res2.status).toBe('logged');

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);
      expect(expenses.map((e) => e.amount)).toEqual([500, 303]);
    });

    it('strictly skips identical duplicate SMS when delivered a second time (matching UTR)', () => {
      const payment =
        'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';

      const res1 = smsExpenseService.processSms(payment, 'AD-ICICIT-S', Date.now(), false);
      expect(res1.status).toBe('logged');

      // Second delivery: identical UTR
      const res2 = smsExpenseService.processSms(payment, 'AD-ICICIT-S', Date.now() + 5000, false);
      expect(res2.status).toBe('duplicate_skipped');
      expect(res2.reason).toContain('already processed');

      expect(Storage.getExpenses().length).toBe(1);
    });

    it('never deduplicates merely by payee or amount alone', () => {
      const payment1 = 'Debited Rs. 200 for UPI to Swiggy. Ref 111111111111.';
      const payment2 = 'Debited Rs. 200 for UPI to Swiggy. Ref 222222222222.';

      smsExpenseService.processSms(payment1, 'AD-HDFCBK-S', Date.now(), false);
      smsExpenseService.processSms(payment2, 'AD-HDFCBK-S', Date.now() + 30000, false);

      expect(Storage.getExpenses().length).toBe(2);
    });
  });

  // =========================================================================
  // 3. AUTOMATIC SMS MONITORING & SENDER HANDLING
  // =========================================================================
  describe('3. Automatic SMS Monitoring & Bank Senders Capture', () => {
    it('captures valid bank transaction SMS originating from standard TRAI senders without -S (e.g. AD-HDFCBK, AX-ICICIB, VM-SBIINB)', () => {
      const sms1 =
        'Rs.450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342.';
      const res1 = smsExpenseService.processSms(sms1, 'AD-HDFCBK', Date.now(), false);
      expect(res1.status).toBe('logged');

      const sms2 =
        'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.';
      const res2 = smsExpenseService.processSms(sms2, 'AX-ICICIB', Date.now(), false);
      expect(res2.status).toBe('logged');
    });

    it('captures valid bank transaction SMS originating from raw bank name headers (e.g. HDFCBK, SBIINB)', () => {
      const sms =
        'Rs 500 debited from SBI A/c XX123 on 25-Sep-26 to Chaayos. UPI: 998877665544.';
      const res = smsExpenseService.processSms(sms, 'SBIINB', Date.now(), false);
      expect(res.status).toBe('logged');
    });

    it('strictly filters personal mobile numbers with non-financial text', () => {
      const sms = 'Hey, can you call me when you reach home?';
      const res = smsExpenseService.processSms(sms, '+919876543210', Date.now(), false);
      expect(res.status).toBe('ignored_not_financial');
      expect(Storage.getExpenses().length).toBe(0);
    });
  });

  // =========================================================================
  // 4. SCAN RECENT BANK SMS & INBOX RESCAN
  // =========================================================================
  describe('4. Scan Recent Bank SMS (Rescan & Summary Metrics)', () => {
    it('rescans SMS, imports unseen transactions, and reports summary with required metrics', async () => {
      // Simulate native plugin returning inbox messages
      const simulatedInbox = [
        {
          sender: 'AD-ICICIT-S',
          body: 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.',
          timestamp: Date.now() - 3600000,
        },
        {
          sender: 'AD-HDFCBK',
          body: 'Rs.450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342.',
          timestamp: Date.now() - 7200000,
        },
        {
          sender: 'AD-SBIUPI-S',
          body: 'Your OTP for transaction of Rs.500 is 123456. Do not share.',
          timestamp: Date.now() - 10000000,
        },
      ];

      // Test scanning via direct processing simulation
      let scanned = simulatedInbox.length;
      let transactionsFound = 0;
      let imported = 0;
      let duplicatesSkipped = 0;

      for (const msg of simulatedInbox) {
        const res = smsExpenseService.processSms(msg.body, msg.sender, msg.timestamp, false);
        if (res.status === 'logged') {
          transactionsFound++;
          imported++;
        } else if (res.status === 'duplicate_skipped') {
          transactionsFound++;
          duplicatesSkipped++;
        }
      }

      expect(scanned).toBe(3);
      expect(transactionsFound).toBe(2);
      expect(imported).toBe(2);
      expect(duplicatesSkipped).toBe(0);
      expect(Storage.getExpenses().length).toBe(2);

      // Running Scan again creates ZERO duplicates!
      let secondImported = 0;
      let secondDuplicatesSkipped = 0;
      for (const msg of simulatedInbox) {
        const res = smsExpenseService.processSms(msg.body, msg.sender, msg.timestamp, false);
        if (res.status === 'logged') {
          secondImported++;
        } else if (res.status === 'duplicate_skipped') {
          secondDuplicatesSkipped++;
        }
      }

      expect(secondImported).toBe(0);
      expect(secondDuplicatesSkipped).toBe(2);
      expect(Storage.getExpenses().length).toBe(2); // Still exactly 2
    });
  });
});
