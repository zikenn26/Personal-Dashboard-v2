import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { smsExpenseService, SmsTransactionCandidate } from '../services/smsExpenseService';
import { Storage } from '../utils/storage';
import * as supabaseUtils from '../utils/supabase';

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

describe('Bank SMS Rescan – Storage Verification, Persistence & Supabase Cloud Sync Suite', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    setupMockStorage();
    localStorage.clear();
    Storage.resetToDefault();
    Storage.setExpenses([]);
    Storage.clearProcessedSmsFingerprints();
    Storage.clearSmsTransactionLogs();
    vi.restoreAllMocks();
    vi.spyOn(supabaseUtils, 'flushAutoSyncImmediately').mockResolvedValue(undefined as any);
  });

  it('1. performs immediate read-after-write verification for 3 detected transactions without storage verification errors', async () => {
    // 3 distinct candidate transactions:
    // 1. SBI UPI debit with explicit reference ID
    // 2. ICICI Credit Card swipe without reference ID
    // 3. HDFC Netbanking / debit transfer with 12-digit ref
    const candidate1: SmsTransactionCandidate = {
      id: 'cand-1',
      sender: 'AD-SBIUPI-S',
      timestamp: Date.now() - 300000,
      rawSms: 'Dear UPI user A/C 9876 debited by 1200.00 on 24Sep26 transfer to MOHIT SHARMA Ref No 429482938492.',
      amount: 1200,
      currency: '₹',
      payee: 'Mohit Sharma',
      merchant: 'Mohit Sharma',
      category: 'Other',
      paymentMethod: 'UPI',
      bankName: 'State Bank of India',
      referenceId: '429482938492',
      direction: 'DEBIT',
      date: '2026-09-24',
      time: '12:30',
      preview: 'Debited 1200 transfer to Mohit Sharma',
      isExisting: false,
    };

    const candidate2: SmsTransactionCandidate = {
      id: 'cand-2',
      sender: 'AD-ICICIT-S',
      timestamp: Date.now() - 200000,
      rawSms: 'Your ICICI Bank Credit Card **** has been used for purchase of INR 2,499.00 at AMAZON INDIA on 24-Sep-2026. Avl Lmt: INR 85,000.',
      amount: 2499,
      currency: '₹',
      payee: 'Amazon India',
      merchant: 'Amazon India',
      category: 'Shopping & Retail',
      paymentMethod: 'Credit Card',
      bankName: 'ICICI Bank',
      direction: 'DEBIT',
      date: '2026-09-24',
      time: '12:35',
      preview: 'Purchase of INR 2499 at Amazon India',
      isExisting: false,
    };

    const candidate3: SmsTransactionCandidate = {
      id: 'cand-3',
      sender: 'VM-HDFCBK-S',
      timestamp: Date.now() - 100000,
      rawSms: 'Rs. 450.00 debited from HDFC Bank A/C **4321 on 24-09-2026 towards SWIGGY. Ref: 663416590461. Bal: Rs 15200.',
      amount: 450,
      currency: '₹',
      payee: 'Swiggy',
      merchant: 'Swiggy',
      category: 'Dining Out',
      paymentMethod: 'Net Banking',
      bankName: 'HDFC Bank',
      referenceId: '663416590461',
      direction: 'DEBIT',
      date: '2026-09-24',
      time: '12:40',
      preview: 'Rs. 450.00 debited towards Swiggy',
      isExisting: false,
    };

    const flushSpy = vi.spyOn(supabaseUtils, 'flushAutoSyncImmediately').mockResolvedValue(undefined as any);

    // Execute rescan logging
    const result = await smsExpenseService.logSelectedCandidates([candidate1, candidate2, candidate3]);

    // Verify all 3 were imported with ZERO failures
    expect(result.scanned).toBe(3);
    expect(result.selected).toBe(3);
    expect(result.imported).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.failures).toEqual([]);

    // Check immediate read-after-write from Storage.getExpenses()
    const stored = Storage.getExpenses();
    expect(stored.length).toBe(3);

    const amounts = stored.map((e) => e.amount);
    expect(amounts).toContain(1200);
    expect(amounts).toContain(2499);
    expect(amounts).toContain(450);

    const names = stored.map((e) => e.name);
    expect(names).toContain('Mohit Sharma');
    expect(names).toContain('Amazon India');
    expect(names).toContain('Swiggy');

    // Supabase auto-sync flush was properly invoked and awaited
    expect(flushSpy).toHaveBeenCalled();
  });

  it('2. guarantees idempotence: re-running rescan for the same transactions flags all as alreadyExisting with 0 failures', async () => {
    const candidate1: SmsTransactionCandidate = {
      id: 'cand-sbi-1',
      sender: 'AD-SBIUPI-S',
      timestamp: 1790000000000,
      rawSms: 'Dear UPI user A/C 9876 debited by 350.00 on 24Sep26 transfer to CHAAYOS Ref No 556677889900.',
      amount: 350,
      currency: '₹',
      payee: 'Chaayos',
      merchant: 'Chaayos',
      category: 'Snacks & Coffee',
      paymentMethod: 'UPI',
      bankName: 'State Bank of India',
      referenceId: '556677889900',
      direction: 'DEBIT',
      date: '2026-09-24',
      preview: 'Chaayos ₹350',
      isExisting: false,
    };

    // First import
    const firstResult = await smsExpenseService.logSelectedCandidates([candidate1]);
    expect(firstResult.imported).toBe(1);
    expect(firstResult.alreadyExisting).toBe(0);
    expect(firstResult.failed).toBe(0);

    // Second import with identical candidate (retry simulation)
    const retryResult = await smsExpenseService.logSelectedCandidates([candidate1]);
    expect(retryResult.imported).toBe(0);
    expect(retryResult.alreadyExisting).toBe(1);
    expect(retryResult.failed).toBe(0);

    // Storage count remains exactly 1 (no duplicate rows)
    const stored = Storage.getExpenses();
    expect(stored.length).toBe(1);
    expect(stored[0].amount).toBe(350);
  });

  it('3. simulates app restart and verifies full data persistence across cold start', async () => {
    const candidate: SmsTransactionCandidate = {
      id: 'cand-restart-1',
      sender: 'AD-ICICIT-S',
      timestamp: 1790000000000,
      rawSms: 'Your ICICI Bank Credit Card **** has been used for purchase of INR 999.00 at ZOMATO on 24-Sep-2026. Avl Lmt: INR 80,000.',
      amount: 999,
      currency: '₹',
      payee: 'Zomato',
      merchant: 'Zomato',
      category: 'Dining Out',
      paymentMethod: 'Credit Card',
      bankName: 'ICICI Bank',
      direction: 'DEBIT',
      date: '2026-09-24',
      preview: 'Zomato ₹999',
      isExisting: false,
    };

    await smsExpenseService.logSelectedCandidates([candidate]);

    // Cold start simulation: read directly from localStorage through a new call
    const rawFromStorage = localStorage.getItem(supabaseUtils.getCustomWorkspaceIdentifier() + '_notion_os_v4_expenses');
    expect(rawFromStorage).not.toBeNull();
    const parsedFromStorage = JSON.parse(rawFromStorage!);
    expect(Array.isArray(parsedFromStorage)).toBe(true);
    expect(parsedFromStorage.length).toBe(1);
    expect(parsedFromStorage[0].name).toBe('Zomato');
    expect(parsedFromStorage[0].amount).toBe(999);

    // Verified by Storage.getExpenses()
    const expensesAfterRestart = Storage.getExpenses();
    expect(expensesAfterRestart.length).toBe(1);
    expect(expensesAfterRestart[0].id).toBe(parsedFromStorage[0].id);
  });

  it('4. ensures graceful resilience if Supabase cloud sync rejects or is offline', async () => {
    const candidate: SmsTransactionCandidate = {
      id: 'cand-offline-1',
      sender: 'AD-HDFCBK-S',
      timestamp: 1790000000000,
      rawSms: 'Dear Customer, your A/c ending in 4321 is debited by Rs. 500.00 on 24-Sep-26 at 15:30 to UBER UPI:112233445566',
      amount: 500,
      currency: '₹',
      payee: 'Uber',
      merchant: 'Uber',
      category: 'Transportation',
      paymentMethod: 'UPI',
      bankName: 'HDFC Bank',
      referenceId: '112233445566',
      direction: 'DEBIT',
      date: '2026-09-24',
      preview: 'Uber ₹500',
      isExisting: false,
    };

    // Simulate Supabase network/cloud failure
    vi.spyOn(supabaseUtils, 'flushAutoSyncImmediately').mockRejectedValue(new Error('Network offline'));

    // Rescan should still succeed in persisting locally and verifying
    const result = await smsExpenseService.logSelectedCandidates([candidate]);
    expect(result.imported).toBe(1);
    expect(result.failed).toBe(0);

    const stored = Storage.getExpenses();
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe('Uber');
    expect(stored[0].amount).toBe(500);
  });

  it('5. preserves stable expense IDs and correctly synchronizes updated existing entries', () => {
    const preExisting = {
      id: 'exp-pre-existing-1',
      name: 'Starbucks Coffee',
      amount: 300,
      category: 'Dining Out',
      date: '2026-09-24',
      referenceId: '998877665544',
      smsReferenceId: '998877665544',
      direction: 'DEBIT' as const,
      active: true,
      createdAt: 1000,
      updatedAt: 1000,
    };
    Storage.setExpenses([preExisting]);

    // Add expense with the same reference ID
    const newEntry = {
      id: 'exp-sms-temp-id',
      name: 'Starbucks Coffee',
      amount: 300,
      category: 'Dining Out',
      date: '2026-09-24',
      referenceId: '998877665544',
      smsReferenceId: '998877665544',
      direction: 'DEBIT' as const,
      active: true,
      createdAt: 2000,
      updatedAt: 2000,
    };

    const updated = Storage.addExpense(newEntry);
    expect(updated.length).toBe(1);
    // Preserves the existing primary ID
    expect(updated[0].id).toBe('exp-pre-existing-1');
    // Caller's object ID is also synchronized
    expect(newEntry.id).toBe('exp-pre-existing-1');

    // Storage.getExpenses() immediately reflects this preserved ID
    const verified = Storage.getExpenses();
    expect(verified.length).toBe(1);
    expect(verified[0].id).toBe('exp-pre-existing-1');
  });
});
