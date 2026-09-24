import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { parseSmsTransaction } from '../services/smsParser';
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

/**
 * ============================================================================
 * PERMANENT REGRESSION TEST SUITE: INDIAN BANKING SMS & DEDUPLICATION ENGINE
 * ============================================================================
 *
 * This test suite guarantees permanent protection against regressions in:
 * 1. Reference ID extraction for all standard Indian banking & UPI formats:
 *    - "UPI:131834525249"
 *    - "UPI: 131834525249"
 *    - "UPI:\"131834525249\""
 *    - "UPI/131834525249/Merchant"
 *    - "UTR:123456789012"
 *    - "RRN:123456789012"
 *    - "Txn ID:123456789012"
 * 2. Real-world message templates from all 8 major Indian financial institutions:
 *    - ICICI Bank
 *    - State Bank of India (SBI)
 *    - HDFC Bank
 *    - Axis Bank
 *    - Kotak Mahindra Bank
 *    - Union Bank of India
 *    - Punjab National Bank (PNB)
 *    - Canara Bank
 * 3. Fundamental transaction invariants for EVERY bank format:
 *    - Exact reference ID extraction
 *    - Exactly one Spending entry per unique reference ID
 *    - Zero duplicates created when replaying the identical SMS
 *    - Strict separation of rapid consecutive transactions (different reference IDs
 *      never merged even with same bank, account, merchant, amount, within 1-2 minutes)
 */

describe('Permanent Bank-Format Regression Suite', () => {
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
  // SECTION 1: MANDATED REFERENCE ID PATTERN REGRESSIONS
  // ==========================================================================
  describe('1. Reference ID Pattern Formats', () => {
    const requiredPatterns = [
      {
        formatName: 'UPI:131834525249 (No space after colon)',
        sms: 'Dear Customer, your Acct ending 1234 has been debited by INR 1748.60 on 24-Sep-26 towards UPI:131834525249. Available Bal: Rs 45,210.00.',
        sender: 'AD-ICICIT-S',
        expectedRef: '131834525249',
        expectedAmount: 1748.60,
      },
      {
        formatName: 'UPI: 131834525249 (Space after colon)',
        sms: 'Dear Customer, your Acct ending 1234 has been debited by INR 643.60 on 24-Sep-26 towards UPI: 131834525249. Available Bal: Rs 44,566.40.',
        sender: 'AD-ICICIT-S',
        expectedRef: '131834525249',
        expectedAmount: 643.60,
      },
      {
        formatName: 'UPI:"131834525249" (Quoted 12-digit number)',
        sms: 'ICICI Bank: Acct XX123 debited with Rs 1748.60 on 24-Sep-26. UPI:"131834525249". Avl Bal: INR 4356.40.',
        sender: 'AD-ICICIT-S',
        expectedRef: '131834525249',
        expectedAmount: 1748.60,
      },
      {
        formatName: 'UPI/131834525249/Merchant (Slash-delimited format)',
        sms: 'ICICI Bank: Acct XX123 debited with Rs 1748.60 on 24-Sep-26. Info: UPI/131834525249/Swiggy. Avail Bal: INR 5000.',
        sender: 'AD-ICICIT-S',
        expectedRef: '131834525249',
        expectedAmount: 1748.60,
      },
      {
        formatName: 'UTR:123456789012 (Standard RTGS/NEFT/IMPS UTR)',
        sms: 'HDFC Bank: Rs 5,500.00 debited from A/c **4120 on 24-Sep-26. UTR:123456789012. Avl bal: Rs 14,200.00.',
        sender: 'AD-HDFCBK-S',
        expectedRef: '123456789012',
        expectedAmount: 5500.00,
      },
      {
        formatName: 'RRN:123456789012 (Retrieval Reference Number)',
        sms: 'SBI Bank: Your A/C *9876 is debited by Rs.1,200.00 on 24-09-2026. RRN:123456789012. Bal: Rs.4,500.00.',
        sender: 'AD-SBIUPI-S',
        expectedRef: '123456789012',
        expectedAmount: 1200.00,
      },
      {
        formatName: 'Txn ID:123456789012 (Transaction ID format)',
        sms: 'Axis Bank: INR 650.00 spent on Card ending 4412 at DOMINOS on 24-09-2026. Txn ID:123456789012. Avl Limit: INR 85,000.',
        sender: 'AX-AXISBK-S',
        expectedRef: '123456789012',
        expectedAmount: 650.00,
      },
    ];

    for (const pattern of requiredPatterns) {
      describe(`Pattern: ${pattern.formatName}`, () => {
        it('1. correctly extracts the exact reference ID and amount', () => {
          const parsed = parseSmsTransaction(pattern.sms, pattern.sender);
          expect(parsed.isTransaction).toBe(true);
          expect(parsed.referenceId).toBe(pattern.expectedRef);
          expect(parsed.amount).toBe(pattern.expectedAmount);
        });

        it('2. creates exactly one Spending entry upon processing', () => {
          const res = smsExpenseService.processSms(pattern.sms, pattern.sender, Date.now(), false);
          expect(res.status).toBe('logged');
          expect(res.expense).toBeDefined();
          expect(res.expense?.smsReferenceId).toBe(pattern.expectedRef);

          const expenses = Storage.getExpenses();
          expect(expenses.length).toBe(1);
          expect(expenses[0].smsReferenceId).toBe(pattern.expectedRef);
        });

        it('3. replaying the identical SMS never creates a duplicate', () => {
          const t1 = Date.now();
          const res1 = smsExpenseService.processSms(pattern.sms, pattern.sender, t1, false);
          expect(res1.status).toBe('logged');

          // Replay immediately
          const res2 = smsExpenseService.processSms(pattern.sms, pattern.sender, t1 + 3000, false);
          expect(res2.status).toBe('duplicate_skipped');

          // Replay with minor trailing whitespace noise or retry flag
          const res3 = smsExpenseService.processSms(pattern.sms + ' ', pattern.sender, t1 + 6000, false);
          expect(res3.status).toBe('duplicate_skipped');

          expect(Storage.getExpenses().length).toBe(1);
        });

        it('4. creates separate Spending entries for different reference IDs within minutes', () => {
          const t1 = Date.now();
          const res1 = smsExpenseService.processSms(pattern.sms, pattern.sender, t1, false);
          expect(res1.status).toBe('logged');

          // Second transaction arriving 1 minute later with different reference ID (e.g. 998877665544)
          const distinctRef = '998877665544';
          const secondSms = pattern.sms.replace(pattern.expectedRef, distinctRef);
          const res2 = smsExpenseService.processSms(secondSms, pattern.sender, t1 + 60000, false);
          expect(res2.status).toBe('logged');
          expect(res2.expense?.smsReferenceId).toBe(distinctRef);

          const expenses = Storage.getExpenses();
          expect(expenses.length).toBe(2);
          const loggedRefs = expenses.map((e) => e.smsReferenceId).sort();
          expect(loggedRefs).toEqual([pattern.expectedRef, distinctRef].sort());
        });
      });
    }
  });

  // ==========================================================================
  // SECTION 2: MAJOR INDIAN BANKS REGRESSION MATRIX
  // ==========================================================================
  describe('2. Major Indian Banks Realistic SMS Matrix', () => {
    const majorBanks = [
      {
        bankName: 'ICICI Bank',
        sender: 'AD-ICICIT-S',
        sms: 'Dear Customer, your Acct ending 1234 has been debited by INR 1,748.60 on 24-Sep-26 towards UPI:131834525249. Available Bal: Rs 45,210.00.',
        expectedRef: '131834525249',
        expectedAmount: 1748.60,
        expectedBankSnippet: 'ICICI',
      },
      {
        bankName: 'State Bank of India (SBI UPI)',
        sender: 'AD-SBIUPI-S',
        sms: 'Dear UPI user A/C 9876 debited by 1200.00 on 24Sep26 transfer to MOHIT SHARMA Ref No 429482938492. Avail Bal: Rs 4,500.00.',
        expectedRef: '429482938492',
        expectedAmount: 1200.00,
        expectedBankSnippet: 'State Bank of India',
      },
      {
        bankName: 'State Bank of India (SBI NetBanking / Core)',
        sender: 'AD-SBINB-S',
        sms: 'Your A/C *9876 debited by Rs.2,450.00 on 24-09-2026. RRN:123456789012. Bal: Rs.8,500.00.',
        expectedRef: '123456789012',
        expectedAmount: 2450.00,
        expectedBankSnippet: 'State Bank of India',
      },
      {
        bankName: 'HDFC Bank',
        sender: 'AD-HDFCBK-S',
        sms: 'Rs.450.00 debited from HDFC Bank A/c **4120 on 24-Sep-26 to SWIGGY. UPI: 429384928342. Avl bal: Rs.14,200.00.',
        expectedRef: '429384928342',
        expectedAmount: 450.00,
        expectedBankSnippet: 'HDFC',
      },
      {
        bankName: 'Axis Bank',
        sender: 'AX-AXISBK-S',
        sms: 'Axis Bank: INR 650.00 spent on Card ending 4412 at DOMINOS on 24-09-2026 12:30:00. Txn ID:123456789012. Avl Limit: INR 85,000.00.',
        expectedRef: '123456789012',
        expectedAmount: 650.00,
        expectedBankSnippet: 'Axis',
      },
      {
        bankName: 'Kotak Mahindra Bank',
        sender: 'AD-KOTAKB-S',
        sms: 'Kotak Bank: Rs 890.50 debited from A/c **3344 on 24-Sep-26. UPI:131834525249-ZOMATO. Bal: Rs 12,340.00.',
        expectedRef: '131834525249',
        expectedAmount: 890.50,
        expectedBankSnippet: 'Kotak',
      },
      {
        bankName: 'Union Bank of India',
        sender: 'AD-UNIONB-S',
        sms: 'Union Bank: Your A/C *5678 is debited by Rs.1,500.00 on 24-Sep-26. UTR:123456789012. Avl Bal: Rs.18,340.00.',
        expectedRef: '123456789012',
        expectedAmount: 1500.00,
        expectedBankSnippet: 'Union Bank',
      },
      {
        bankName: 'Punjab National Bank (PNB)',
        sender: 'AD-PNBSMS-S',
        sms: 'PNB: Dear Customer, Rs 1250.00 debited from A/c **7890 on 24-Sep-26 to FLIPKART. RRN:123456789012. Avail Bal: Rs 9,450.00.',
        expectedRef: '123456789012',
        expectedAmount: 1250.00,
        expectedBankSnippet: 'Punjab National Bank',
      },
      {
        bankName: 'Canara Bank',
        sender: 'AD-CANARA-S',
        sms: 'Canara Bank: Rs 340.00 debited from A/c **2145 on 24-Sep-26. UPI/131834525249/Merchant. Avail Bal Rs 5,600.00.',
        expectedRef: '131834525249',
        expectedAmount: 340.00,
        expectedBankSnippet: 'Canara',
      },
    ];

    for (const bank of majorBanks) {
      describe(`Bank: ${bank.bankName}`, () => {
        it('confirms the reference ID, amount, and bank are extracted correctly', () => {
          const parsed = parseSmsTransaction(bank.sms, bank.sender);
          expect(parsed.isTransaction).toBe(true);
          expect(parsed.referenceId).toBe(bank.expectedRef);
          expect(parsed.amount).toBe(bank.expectedAmount);
          expect(parsed.bankOrAccount).toContain(bank.expectedBankSnippet);
        });

        it('confirms each unique reference ID creates exactly one Spending entry', () => {
          const res = smsExpenseService.processSms(bank.sms, bank.sender, Date.now(), false);
          expect(res.status).toBe('logged');
          expect(res.expense).toBeDefined();
          expect(res.expense?.smsReferenceId).toBe(bank.expectedRef);

          const expenses = Storage.getExpenses();
          expect(expenses.length).toBe(1);
          expect(expenses[0].smsReferenceId).toBe(bank.expectedRef);
          expect(expenses[0].amount).toBe(bank.expectedAmount);
        });

        it('confirms replaying the same SMS never creates a duplicate', () => {
          const t = Date.now();
          const res1 = smsExpenseService.processSms(bank.sms, bank.sender, t, false);
          expect(res1.status).toBe('logged');

          // Duplicate replay attempts
          const res2 = smsExpenseService.processSms(bank.sms, bank.sender, t + 1000, false);
          expect(res2.status).toBe('duplicate_skipped');

          const res3 = smsExpenseService.processSms(bank.sms, bank.sender, t + 120000, false);
          expect(res3.status).toBe('duplicate_skipped');

          expect(Storage.getExpenses().length).toBe(1);
        });

        it('confirms different reference IDs from same bank within minutes are always treated as separate transactions', () => {
          const t = Date.now();
          // First transaction
          const res1 = smsExpenseService.processSms(bank.sms, bank.sender, t, false);
          expect(res1.status).toBe('logged');

          // Second transaction with different reference ID 2 minutes later
          const diffRef = '882233445566';
          const secondSms = bank.sms.replace(bank.expectedRef, diffRef);
          const res2 = smsExpenseService.processSms(secondSms, bank.sender, t + 120000, false);
          expect(res2.status).toBe('logged');
          expect(res2.expense?.smsReferenceId).toBe(diffRef);

          const expenses = Storage.getExpenses();
          expect(expenses.length).toBe(2);
          const savedRefs = expenses.map((e) => e.smsReferenceId).sort();
          expect(savedRefs).toEqual([bank.expectedRef, diffRef].sort());
        });
      });
    }
  });

  // ==========================================================================
  // SECTION 3: RAPID MULTI-BURST CONCURRENCY & DEDUPLICATION SAFETY
  // ==========================================================================
  describe('3. Multi-Burst Consecutive Transactions (Real-world Rapid Spending)', () => {
    it('handles a burst of 4 rapid UPI transactions across different banks within 3 minutes', () => {
      const burstTransactions = [
        {
          sender: 'AD-ICICIT-S',
          sms: 'Dear Customer, your Acct ending 1234 has been debited by INR 1748.60 on 24-Sep-26 towards UPI:131834525249. Available Bal: Rs 45,210.00.',
          ref: '131834525249',
          amount: 1748.60,
        },
        {
          sender: 'AD-ICICIT-S',
          sms: 'Dear Customer, your Acct ending 1234 has been debited by INR 643.60 on 24-Sep-26 towards UPI:132241653425. Available Bal: Rs 44,566.40.',
          ref: '132241653425',
          amount: 643.60,
        },
        {
          sender: 'AD-HDFCBK-S',
          sms: 'Rs.450.00 debited from HDFC Bank A/c **4120 on 24-Sep-26 to SWIGGY. UPI: 429384928342. Avl bal: Rs.14,200.00.',
          ref: '429384928342',
          amount: 450.00,
        },
        {
          sender: 'AD-KOTAKB-S',
          sms: 'Kotak Bank: Rs 250.00 debited from A/c **3344 on 24-Sep-26. UPI:556677889900-CHAAYOS. Bal: Rs 12,090.00.',
          ref: '556677889900',
          amount: 250.00,
        },
      ];

      const baseTime = Date.now();
      burstTransactions.forEach((tx, idx) => {
        const res = smsExpenseService.processSms(tx.sms, tx.sender, baseTime + idx * 30000, false);
        expect(res.status).toBe('logged');
        expect(res.expense?.smsReferenceId).toBe(tx.ref);
        expect(res.expense?.amount).toBe(tx.amount);
      });

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(4);
      expect(expenses.map((e) => e.smsReferenceId).sort()).toEqual(
        burstTransactions.map((t) => t.ref).sort()
      );
    });

    it('gracefully handles and separates identical amounts and merchants when reference IDs differ', () => {
      // 3 identical coffee payments of Rs. 150 at Chaayos 45 seconds apart with distinct UPI refs
      const baseTime = Date.now();
      const refs = ['100000000001', '100000000002', '100000000003'];

      refs.forEach((ref, i) => {
        const sms = `Dear Customer, Acct XX123 debited by INR 150.00 on 24-Sep-26 to CHAAYOS. UPI:${ref}. Avail Bal: Rs 1000.`;
        const res = smsExpenseService.processSms(sms, 'AD-ICICIT-S', baseTime + i * 45000, false);
        expect(res.status).toBe('logged');
        expect(res.expense?.smsReferenceId).toBe(ref);
      });

      expect(Storage.getExpenses().length).toBe(3);
    });
  });
});
