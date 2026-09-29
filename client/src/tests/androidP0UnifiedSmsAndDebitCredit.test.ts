import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { Storage, STORAGE_KEYS } from '../utils/storage';
import { smsExpenseService, isTraiServiceSender, isLikelyFinancialSms } from '../services/smsExpenseService';
import { parseSmsTransaction } from '../services/smsParser';
import { isCreditTransaction, getTransactionDirection } from '../utils/expenseUtils';
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

describe('P0 – Unified SMS Controls, Native Inbox Scan, and Debit/Credit Parity', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.clearSmsTransactionLogs();
    Storage.setSmsAutoTrackingEnabled(true);
  });

  describe('1. Indian Bank Senders & Financial Detection without -S Suffix', () => {
    const indianBankSenders = [
      'AD-ICICIB',
      'VM-HDFCBK',
      'VK-HDFCBK',
      'AX-AXISBK',
      'BZ-SBIINB',
      'SBIUPI',
      'ICICIB',
      'HDFCBK',
      'KOTAKB',
      'PNB',
      'BOI',
      'CANBNK',
      'YESBNK',
      'UNIONB',
    ];

    it('identifies all common Indian banking sender formats as eligible without requiring -S suffix', () => {
      indianBankSenders.forEach((sender) => {
        const isEligible = isTraiServiceSender(sender);
        expect(isEligible, `Expected ${sender} to be recognized as eligible bank sender`).toBe(true);
      });
    });

    it('detects transaction SMS using body patterns (debited, credited, UPI, UTR, RRN, IMPS, NEFT, RTGS, Txn ID, Ref No, A/c)', () => {
      const patterns = [
        {
          sender: 'AD-ICICIB',
          body: 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.',
          expectedType: 'expense',
          expectedAmt: 303.0,
        },
        {
          sender: 'VM-HDFCBK',
          body: 'Rs 450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI Ref: 429384928342. Avl bal: Rs 14,200.00.',
          expectedType: 'expense',
          expectedAmt: 450.0,
        },
        {
          sender: 'BZ-SBIINB',
          body: 'Dear SBI User, A/c XX9876 debited by Rs 1200.00 on 23Sep26 transfer to MOHIT SHARMA UTR 429482938492. Avail Bal: Rs 4,500.',
          expectedType: 'expense',
          expectedAmt: 1200.0,
        },
        {
          sender: 'SBIUPI',
          body: 'Dear UPI user A/C 9876 debited by 850.00 on 24-Sep-26 to RELIANCE RRN 556677889900.',
          expectedType: 'expense',
          expectedAmt: 850.0,
        },
        {
          sender: 'CANBNK',
          body: 'Canara Bank A/c ending 5678 debited INR 1,500.00 on 23-09-2026 by IMPS Ref 50928392810. Bal Rs.18,340.00.',
          expectedType: 'expense',
          expectedAmt: 1500.0,
        },
        {
          sender: 'YESBNK',
          body: 'Yes Bank: Rs. 2,500.00 credited to A/c XX1234 on 24-Sep-26 by NEFT from INFOSYS LTD. Ref No 998877665544.',
          expectedType: 'income',
          expectedAmt: 2500.0,
        },
        {
          sender: 'UNIONB',
          body: 'Union Bank of India: A/c XX4321 debited for Rs 12,000.00 via RTGS Transaction ID 887766554433 on 24-09-2026.',
          expectedType: 'expense',
          expectedAmt: 12000.0,
        },
      ];

      patterns.forEach(({ sender, body, expectedType, expectedAmt }) => {
        expect(isLikelyFinancialSms(sender, body)).toBe(true);
        const parsed = parseSmsTransaction(body, sender);
        expect(parsed.isTransaction, `Body pattern failed for: ${body}`).toBe(true);
        expect(parsed.amount).toBe(expectedAmt);
        expect(parsed.type).toBe(expectedType);
      });
    });

    it('strictly rejects OTPs, promotions, loan ads, and recharge offers', () => {
      const nonFinancial = [
        {
          sender: 'AD-HDFCBK',
          body: 'Your OTP for transaction of Rs.500 at Swiggy is 492810. Do not share this OTP with anyone. Valid for 10 mins.',
        },
        {
          sender: 'AD-ICICIB',
          body: '492019 is your secret OTP to authenticate your payment of Rs 1,200. Do not share with anyone.',
        },
        {
          sender: 'AX-AXISBK',
          body: 'Congratulations! You are eligible for pre-approved instant personal loan up to Rs. 5,00,000. Click here to claim.',
        },
        {
          sender: 'BZ-SBIINB',
          body: 'Special recharge offer! Recharge with Rs. 299 now and get 2GB/day + unlimited calls. Click link to recharge.',
        },
        {
          sender: 'AIRTEL',
          body: 'Exclusive recharge offer: Get 10% cashback on recharge of Rs 499 or above using Airtel Payments Bank.',
        },
      ];

      nonFinancial.forEach(({ sender, body }) => {
        const isFinancial = isLikelyFinancialSms(sender, body);
        expect(isFinancial, `Expected rejection for: ${body}`).toBe(false);
        const parsed = parseSmsTransaction(body, sender);
        expect(parsed.isTransaction, `Expected parsed.isTransaction to be false for: ${body}`).toBe(false);
      });
    });
  });

  describe('2. Manual Scan Flow (10/20/30/50 candidates, Selection, Already Existing)', () => {
    it('queries candidate transactions and flags already existing items without hiding them', async () => {
      // Seed an existing transaction in Spending
      Storage.addExpense({
        id: 'exp-existing-1',
        name: 'Swiggy',
        amount: 450,
        category: 'Dining Out',
        date: '2026-09-23',
        billingCycle: 'one-time',
        active: true,
        direction: 'DEBIT',
        referenceId: '429384928342',
        smsReferenceId: '429384928342',
      });

      // Mock inbox reader containing 3 real bank messages
      smsExpenseService.setInboxReaderForTesting(async () => ({
        messages: [
          {
            sender: 'AD-ICICIB',
            body: 'ICICI Bank Acct XX070 debited for Rs 303.00 on 25-Sep-26; ARPITA PRIYADAR credited. UPI:663416590461.',
            timestamp: Date.now() - 1000,
          },
          {
            sender: 'VM-HDFCBK',
            body: 'Rs 450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342. Avl bal: Rs 14,200.00.',
            timestamp: Date.now() - 2000,
          },
          {
            sender: 'BZ-SBIINB',
            body: 'Dear UPI user A/C 9876 debited by 1200.00 on 23Sep26 transfer to MOHIT SHARMA Ref No 429482938492.',
            timestamp: Date.now() - 3000,
          },
        ],
      }));

      const candidates = await smsExpenseService.getRecentTransactionCandidates(10);
      expect(candidates.length).toBe(3);

      // Verify Swiggy is identified as already existing
      const swiggyCandidate = candidates.find((c) => c.referenceId === '429384928342');
      expect(swiggyCandidate).toBeDefined();
      expect(swiggyCandidate?.isExisting).toBe(true);

      // Verify the other two are new
      const arpitaCandidate = candidates.find((c) => c.referenceId === '663416590461');
      expect(arpitaCandidate).toBeDefined();
      expect(arpitaCandidate?.isExisting).toBe(false);

      // Log only the non-existing candidates
      const chosenToLog = candidates.filter((c) => !c.isExisting);
      const rescanResult = await smsExpenseService.logSelectedCandidates(chosenToLog);

      expect(rescanResult.imported).toBe(2);
      expect(rescanResult.alreadyExisting).toBe(0);

      // Now if we log all candidates (including Swiggy):
      const secondLogResult = await smsExpenseService.logSelectedCandidates(candidates);
      expect(secondLogResult.alreadyExisting).toBe(3); // All 3 now exist
      expect(secondLogResult.imported).toBe(0); // Zero duplicate insertions!
    });
  });

  describe('3. Debit / Credit Direction & Spending Parity', () => {
    it('defaults manual expense to DEBIT, and correctly counts only Debits in total spending', () => {
      // 1. Add manual debit
      Storage.addExpense({
        id: 'exp-1',
        name: 'Lunch with team',
        amount: 800,
        category: 'Dining Out',
        date: '2026-09-25',
        billingCycle: 'one-time',
        active: true,
        direction: 'DEBIT',
        transactionType: 'DEBIT',
      });

      // 2. Add manual credit (refund / salary / cashback)
      Storage.addExpense({
        id: 'exp-2',
        name: 'Zomato Refund',
        amount: 350,
        category: 'Dining Out',
        date: '2026-09-25',
        billingCycle: 'one-time',
        active: true,
        direction: 'CREDIT',
        transactionType: 'CREDIT',
      });

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);

      const debitItem = expenses.find((e) => e.id === 'exp-1');
      const creditItem = expenses.find((e) => e.id === 'exp-2');

      expect(isCreditTransaction(debitItem!)).toBe(false);
      expect(isCreditTransaction(creditItem!)).toBe(true);
      expect(getTransactionDirection(debitItem!)).toBe('DEBIT');
      expect(getTransactionDirection(creditItem!)).toBe('CREDIT');

      // Month Spending calculation parity check:
      // Month spending must count DEBITS ONLY (₹800), NOT inflated by credits (₹350)
      const monthDebits = expenses
        .filter((e) => !isCreditTransaction(e))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const monthCredits = expenses
        .filter((e) => isCreditTransaction(e))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      expect(monthDebits).toBe(800);
      expect(monthCredits).toBe(350);
    });
  });
});
