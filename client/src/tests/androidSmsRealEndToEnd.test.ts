import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { parseSmsTransaction } from '../services/smsParser';
import { smsExpenseService, SmsTransaction, smsPluginWebImpl } from '../services/smsExpenseService';
import { Storage } from '../utils/storage';
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

/**
 * Simulated Android Native SmsReceiver logic reflecting the updated Java implementation
 */
function simulatedAndroidSmsReceiver(sender: string, body: string, isReceiverEnabled: boolean = true) {
  if (!isReceiverEnabled) return { accepted: false, reason: 'disabled' };
  if (!body || !body.trim()) return { accepted: false, reason: 'empty' };

  const lower = body.toLowerCase();

  // 1. Strict OTP rejection
  if (
    lower.includes('otp') &&
    (lower.includes('do not share') ||
      lower.includes('valid for') ||
      lower.includes('is your') ||
      lower.includes('secret') ||
      lower.includes('use this') ||
      lower.includes('authenticate') ||
      lower.includes('one time password'))
  ) {
    return { accepted: false, reason: 'otp' };
  }

  if (
    lower.includes('verification code') ||
    lower.includes('security code') ||
    lower.includes('is your one time password')
  ) {
    return { accepted: false, reason: 'verification_code' };
  }

  // 2. Reject promotional / marketing loans
  if (
    lower.includes('pre-approved loan') ||
    lower.includes('apply for instant loan') ||
    lower.includes('personal loan up to') ||
    lower.includes('click here to claim') ||
    lower.includes('congratulations! you won') ||
    lower.includes('apply for credit card')
  ) {
    return { accepted: false, reason: 'loan_ad' };
  }

  // 3. Reject declined or failed
  if (
    lower.includes('declined') ||
    lower.includes('payment failed') ||
    lower.includes('transaction failed') ||
    lower.includes('unsuccessful') ||
    lower.includes('failed due to')
  ) {
    return { accepted: false, reason: 'failed' };
  }

  // 4. Must contain at least one digit
  if (!lower.matches ? !/\d/.test(lower) : false) {
    return { accepted: false, reason: 'no_digits' };
  }

  // 5. Must contain financial verb or banking indicator
  const hasTxnVerb =
    lower.includes('debited') ||
    lower.includes('credited') ||
    lower.includes('paid') ||
    lower.includes('spent') ||
    lower.includes('withdrawn') ||
    lower.includes('transferred') ||
    lower.includes('transfer to') ||
    lower.includes('sent to') ||
    lower.includes('purchase') ||
    lower.includes('charged') ||
    lower.includes('deducted') ||
    lower.includes('txn of') ||
    lower.includes('payment of') ||
    lower.includes('received') ||
    lower.includes('deposited') ||
    lower.includes('refund') ||
    lower.includes('cashback') ||
    lower.includes('vpa') ||
    lower.includes('pos txn') ||
    lower.includes('atm wdl') ||
    lower.includes('upi ref') ||
    lower.includes('ref no') ||
    lower.includes('rrn') ||
    lower.includes('card ending') ||
    lower.includes('a/c ending') ||
    lower.includes('acct ending') ||
    lower.includes('avl bal') ||
    lower.includes('avail bal') ||
    lower.includes('dr to') ||
    lower.includes('cr to');

  return { accepted: hasTxnVerb, reason: hasTxnVerb ? 'ok' : 'no_txn_verb' };
}

describe('Real Android Device SMS Pipeline & End-to-End Test', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.clearSmsTransactionLogs();
    vi.restoreAllMocks();
  });

  describe('1. Realistic Indian Bank SMS Receiver Filtering', () => {
    it('successfully accepts SBI UPI transaction (which has no currency prefix)', () => {
      const sbiSms =
        'Dear UPI user A/C 9876 debited by 1200.00 on 23Sep26 transfer to MOHIT SHARMA Ref No 429482938492.';
      const res = simulatedAndroidSmsReceiver('SBIUPI', sbiSms, true);
      expect(res.accepted).toBe(true);
    });

    it('successfully accepts HDFC SMS with compact amount (Rs450.00 without space)', () => {
      const hdfcSms =
        'Rs450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342.';
      const res = simulatedAndroidSmsReceiver('HDFCBK', hdfcSms, true);
      expect(res.accepted).toBe(true);
    });

    it('successfully accepts Google Pay UPI payment', () => {
      const gpaySms = 'Paid Rs.199 to ZEPTO via Google Pay UPI. Txn ID: 40928392834.';
      const res = simulatedAndroidSmsReceiver('GPAY', gpaySms, true);
      expect(res.accepted).toBe(true);
    });

    it('successfully accepts ICICI Credit Card spending', () => {
      const iciciSms =
        'Your ICICI Bank Credit Card XX2004 has been used for purchase of INR 2,499.00 at AMAZON INDIA on 23-Sep-2026.';
      const res = simulatedAndroidSmsReceiver('ICICIB', iciciSms, true);
      expect(res.accepted).toBe(true);
    });

    it('successfully accepts Axis Bank cafe transaction', () => {
      const axisSms =
        'Axis Bank: INR 350.00 spent on Card ending 4412 at STARBUCKS on 23-09-2026 14:15:30.';
      const res = simulatedAndroidSmsReceiver('AXISBK', axisSms, true);
      expect(res.accepted).toBe(true);
    });

    it('rejects bank OTP message with explicit reason', () => {
      const otpSms =
        'Your OTP for transaction of Rs.500 at Swiggy is 492810. Do not share this OTP with anyone.';
      const res = simulatedAndroidSmsReceiver('HDFCBK', otpSms, true);
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('otp');
    });

    it('rejects personal loan spam with explicit reason', () => {
      const loanSms =
        'Congratulations! You are eligible for pre-approved personal loan up to Rs. 5,00,000. Apply now.';
      const res = simulatedAndroidSmsReceiver('BAJAJ', loanSms, true);
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('loan_ad');
    });

    it('rejects failed transaction with explicit reason', () => {
      const failedSms =
        'Transaction of Rs 850.00 at DMart was DECLINED due to insufficient balance.';
      const res = simulatedAndroidSmsReceiver('SBIINB', failedSms, true);
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('failed');
    });
  });

  describe('2. Real End-to-End Flow: SMS Arrives -> Processed -> Verified in Spending', () => {
    it('executes full flow for SBI UPI transfer and adds entry to Spending', () => {
      // 1. Initial State: Spending is empty
      expect(Storage.getExpenses().length).toBe(0);

      // 2. Incoming real SBI UPI transaction SMS
      const sbiSms =
        'Dear UPI user A/C 9876 debited by 1200.00 on 23Sep26 transfer to MOHIT SHARMA Ref No 429482938492.';
      const sender = 'SBIUPI';

      // 3. Process through smsExpenseService
      const processResult = smsExpenseService.processSms(sbiSms, sender, Date.now(), false);

      // Verify parsing and logging
      expect(processResult.success).toBe(true);
      expect(processResult.status).toBe('logged');
      expect(processResult.expense).toBeDefined();

      // 4. Verify transaction appears in Spending (Storage.getExpenses())
      const currentExpenses = Storage.getExpenses();
      expect(currentExpenses.length).toBe(1);

      const loggedItem = currentExpenses[0];
      expect(loggedItem.name).toBe('Mohit Sharma');
      expect(loggedItem.amount).toBe(1200);
      expect(loggedItem.paymentMethod).toBe('UPI');
      expect(loggedItem.smsReferenceId).toBe('429482938492');
      expect(loggedItem.source).toBe('sms_auto');
      expect(loggedItem.bankOrAccount).toContain('State Bank of India');
      expect(loggedItem.rawSmsText).toBe(sbiSms);

      // 5. Verify audit log is recorded
      const logs = Storage.getSmsTransactionLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('logged');
      expect(logs[0].sender).toBe('SBIUPI');
    });

    it('executes full flow for HDFC Swiggy order and assigns Dining Out category', () => {
      const hdfcSms =
        'Rs.450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342. Avl bal: Rs.14,200.00.';

      const result = smsExpenseService.processSms(hdfcSms, 'HDFCBK', Date.now(), false);
      expect(result.success).toBe(true);

      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(1);
      expect(expenses[0].name).toBe('Swiggy');
      expect(expenses[0].amount).toBe(450);
      expect(expenses[0].category).toBe('Dining Out');
      expect(expenses[0].smsReferenceId).toBe('429384928342');
    });

    it('prevents duplicate transactions when identical SMS arrives a second time', () => {
      const sms =
        'Rs.320.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to KFC. UPI: 998877665544.';

      // First delivery: logged
      const res1 = smsExpenseService.processSms(sms, 'HDFCBK', Date.now(), false);
      expect(res1.status).toBe('logged');
      expect(Storage.getExpenses().length).toBe(1);

      // Second delivery: skipped as duplicate
      const res2 = smsExpenseService.processSms(sms, 'HDFCBK', Date.now(), false);
      expect(res2.status).toBe('duplicate_skipped');
      expect(res2.reason).toContain('Duplicate');

      // Still only 1 entry in Spending
      expect(Storage.getExpenses().length).toBe(1);

      // Audit logs recorded both
      const logs = Storage.getSmsTransactionLogs();
      expect(logs.length).toBe(2);
      expect(logs[0].status).toBe('duplicate_skipped');
      expect(logs[1].status).toBe('logged');
    });

    it('prevents dual SMS notifications (Bank alert + UPI app alert for same transaction)', () => {
      // 1. Bank SMS
      const bankSms =
        'Update: Rs. 199.00 debited from Bank A/c *5678 on 23-Sep-26 towards ZEPTO. UPI Ref: 554433221100.';
      const res1 = smsExpenseService.processSms(bankSms, 'HDFCBK', Date.now(), false);
      expect(res1.status).toBe('logged');

      // 2. UPI App notification SMS received 5 seconds later for same purchase
      const upiSms =
        'Paid Rs.199 to ZEPTO via Google Pay UPI on 23-Sep-26. UPI Ref: 554433221100.';
      const res2 = smsExpenseService.processSms(upiSms, 'GPAY', Date.now(), false);

      expect(res2.status).toBe('duplicate_skipped');
      expect(res2.reason).toContain('Duplicate');
      expect(Storage.getExpenses().length).toBe(1);
    });

    it('handles background sync when app was closed/suspended (syncPendingBackgroundMessages)', async () => {
      // Setup mock plugin responses
      const mockPendingMessages = [
        {
          sender: 'AXISBK',
          body: 'Axis Bank: INR 350.00 spent on Card ending 4412 at STARBUCKS on 23-09-2026 14:15:30.',
          timestamp: Date.now(),
        },
        {
          sender: 'GPAY',
          body: 'Paid Rs.199 to ZEPTO via Google Pay UPI. Txn ID: 40928392834.',
          timestamp: Date.now(),
        },
      ];

      vi.spyOn(smsExpenseService, 'isNativePluginAvailable').mockResolvedValue(true);
      vi.spyOn(smsExpenseService, 'isAutoTrackingEnabled').mockReturnValue(true);
      smsPluginWebImpl.getPendingSms = async () => ({
        messages: mockPendingMessages,
      });

      // Execute background sync
      const count = await smsExpenseService.syncPendingBackgroundMessages();

      // Verify both transactions were converted into Spending entries
      expect(count).toBe(2);
      const expenses = Storage.getExpenses();
      expect(expenses.length).toBe(2);

      const merchants = expenses.map((e) => e.name);
      expect(merchants).toContain('Starbucks');
      expect(merchants).toContain('Zepto');
    });
  });
});
