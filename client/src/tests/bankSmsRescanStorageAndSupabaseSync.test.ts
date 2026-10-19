import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { smsExpenseService, SmsTransactionCandidate, isDeepEqualExpense } from '../services/smsExpenseService';
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

  it('6. pending SMS queue is acknowledged safely: unhandled or failed items remain for retry', async () => {
    let nativeQueue = [
      { id: 'sms-1', sender: 'AD-HDFCBK-S', body: 'Rs 150.00 debited from A/C 1234 to Blinkit on 25-Sep-26. UPI: 778899001122.', timestamp: Date.now() },
      { id: 'sms-2', sender: 'AD-HDFCBK-S', body: 'Rs 250.00 debited from A/C 1234 to Zepto on 25-Sep-26. UPI: 778899001133.', timestamp: Date.now() },
    ];

    vi.spyOn(smsExpenseService, 'isNativePluginAvailable').mockResolvedValue(true);
    const { smsPluginWebImpl } = await import('../services/smsExpenseService');
    const getPendingSpy = vi.spyOn(smsPluginWebImpl, 'getPendingSms').mockImplementation(async () => {
      return { messages: [...nativeQueue] };
    });
    const ackSpy = vi.spyOn(smsPluginWebImpl, 'acknowledgePendingSms').mockImplementation(async (opts) => {
      const idsToRemove = new Set(opts.ids || []);
      nativeQueue = nativeQueue.filter((item) => !idsToRemove.has(item.id));
      return { success: true };
    });

    const loggedCount = await smsExpenseService.syncPendingBackgroundMessages();
    expect(loggedCount).toBe(2);

    // Both messages were acknowledged
    expect(ackSpy).toHaveBeenCalled();
    expect(nativeQueue.length).toBe(0);

    const stored = Storage.getExpenses();
    expect(stored.length).toBe(2);
    expect(stored.map((e) => e.name)).toEqual(expect.arrayContaining(['Blinkit', 'Zepto']));

    getPendingSpy.mockRestore();
    ackSpy.mockRestore();
  });

  it('7. shows success notifications ONLY after persistence checks succeed', async () => {
    vi.spyOn(smsExpenseService, 'isNativeAndroidApp').mockReturnValue(true);
    const { smsPluginWebImpl } = await import('../services/smsExpenseService');
    const notifSpy = vi.spyOn(smsPluginWebImpl, 'showTransactionNotification');

    // 1. Process genuine financial SMS -> should succeed and trigger notification
    const resValid = smsExpenseService.processSms(
      'Rs. 750.00 debited from HDFC Bank A/c **4321 on 25-09-2026 to ZOMATO. UPI: 334455667788.',
      'AD-HDFCBK-S',
      Date.now(),
      false
    );
    expect(resValid.status).toBe('logged');
    await new Promise((r) => setTimeout(r, 20));
    expect(notifSpy).toHaveBeenCalled();

    // 2. Process duplicate SMS -> should NOT trigger notification
    notifSpy.mockClear();
    const resDup = smsExpenseService.processSms(
      'Rs. 750.00 debited from HDFC Bank A/c **4321 on 25-09-2026 to ZOMATO. UPI: 334455667788.',
      'AD-HDFCBK-S',
      Date.now(),
      false
    );
    expect(resDup.status).toBe('duplicate_skipped');
    expect(notifSpy).not.toHaveBeenCalled();

    // 3. Process non-financial text -> should NOT trigger notification
    notifSpy.mockClear();
    const resNonFin = smsExpenseService.processSms(
      'Your OTP for login is 123456. Valid for 10 minutes.',
      'AD-HDFCBK-S',
      Date.now(),
      false
    );
    expect(resNonFin.status).toBe('ignored_not_financial');
    expect(notifSpy).not.toHaveBeenCalled();

    notifSpy.mockRestore();
  });

  it('8. user logout clears pending native queue and memory cache, preventing cross-session leakage', async () => {
    vi.spyOn(smsExpenseService, 'isNativePluginAvailable').mockResolvedValue(true);
    const { smsPluginWebImpl } = await import('../services/smsExpenseService');
    const clearSpy = vi.spyOn(smsPluginWebImpl, 'clearPendingSms');
    const { Auth } = await import('../utils/auth');

    await Auth.signOut();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('9. cross-device reconciliation: web client preserves remote APK-authoritative SMS transactions', async () => {
    // Simulate Supabase existing cloud data containing an SMS transaction committed by the APK
    const apkSmsExpense = {
      id: 'exp-sms-1792260835864-8fne0',
      name: 'Uber India',
      amount: 450,
      category: 'Transportation',
      date: '2026-09-25',
      referenceId: '429482938492',
      smsReferenceId: '429482938492',
      direction: 'DEBIT' as const,
      source: 'sms_auto',
      rawSmsText: 'Debited Rs 450 to Uber Ref 429482938492',
      active: true,
      createdAt: 1792260835864,
      updatedAt: 1792260835864,
    };

    // Web client has a locally created manual expense, but DOES NOT have the APK SMS expense yet
    const webManualExpense = {
      id: 'exp-manual-web-1',
      name: 'Book Purchase',
      amount: 600,
      category: 'Education',
      date: '2026-09-25',
      direction: 'DEBIT' as const,
      active: true,
      createdAt: 1792260850000,
      updatedAt: 1792260850000,
    };

    // Reconcile via mergeExpenseLists with APK authority rules
    const reconciled = supabaseUtils.mergeExpenseLists([webManualExpense], [apkSmsExpense]);

    // Both the manual web expense AND the APK-committed SMS expense are preserved
    expect(reconciled.length).toBe(2);
    const ids = reconciled.map((e) => e.id);
    expect(ids).toContain('exp-sms-1792260835864-8fne0');
    expect(ids).toContain('exp-manual-web-1');
  });

  it('10. deleted expense tombstones are strictly respected across devices and never resurrected', async () => {
    const deletedId = 'exp-sms-deleted-1';
    const activeExpense = {
      id: 'exp-active-1',
      name: 'Groceries',
      amount: 1500,
      category: 'Groceries',
      date: '2026-09-25',
      direction: 'DEBIT' as const,
      active: true,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const deletedExpense = {
      id: deletedId,
      name: 'Cancelled Service',
      amount: 800,
      category: 'Utilities',
      date: '2026-09-25',
      direction: 'DEBIT' as const,
      active: true,
      createdAt: 1000,
      updatedAt: 1000,
    };

    const trashedIds = new Set<string>([deletedId]);
    const reconciled = supabaseUtils.mergeExpenseLists([activeExpense], [activeExpense, deletedExpense], trashedIds);

    expect(reconciled.length).toBe(1);
    expect(reconciled[0].id).toBe('exp-active-1');
    expect(reconciled.find((e) => e.id === deletedId)).toBeUndefined();
  });

  it('11. isDeepEqualExpense performs rigorous deep verification and detects any field corruption or mismatch', () => {
    const baseExpense = {
      id: 'exp-test-deep-1',
      name: 'Starbucks Coffee',
      amount: 450.5,
      category: 'Snacks & Coffee',
      date: '2026-09-25',
      direction: 'DEBIT' as const,
      transactionType: 'DEBIT' as const,
      referenceId: 'UPI1234567890',
      active: true,
      rawSmsText: 'Debited 450.50 at Starbucks Coffee UPI 1234567890',
    };

    // Exact match passes
    expect(isDeepEqualExpense(baseExpense, { ...baseExpense })).toBe(true);

    // Mismatched amount fails
    expect(isDeepEqualExpense({ ...baseExpense, amount: 450.0 }, baseExpense)).toBe(false);

    // Mismatched direction fails
    expect(isDeepEqualExpense({ ...baseExpense, direction: 'CREDIT' as any }, baseExpense)).toBe(false);

    // Mismatched date fails
    expect(isDeepEqualExpense({ ...baseExpense, date: '2026-09-26' }, baseExpense)).toBe(false);

    // Mismatched name fails
    expect(isDeepEqualExpense({ ...baseExpense, name: 'Costa Coffee' }, baseExpense)).toBe(false);

    // Mismatched category fails
    expect(isDeepEqualExpense({ ...baseExpense, category: 'Dining Out' }, baseExpense)).toBe(false);

    // Inactive record fails
    expect(isDeepEqualExpense({ ...baseExpense, active: false }, baseExpense)).toBe(false);

    // Mismatched ID without matching reference fails
    expect(isDeepEqualExpense({ ...baseExpense, id: 'exp-other-id', referenceId: undefined }, { ...baseExpense, id: 'exp-expected-id', referenceId: undefined })).toBe(false);
  });

  it('12. two legitimate purchases with identical amounts, dates, and merchant names: verification locates the specific record and does not use ambiguous composite matching', async () => {
    // Pre-existing purchase: Morning coffee at Starbucks for ₹350
    const purchase1 = {
      id: 'exp-starbucks-morning',
      name: 'Starbucks',
      amount: 350,
      category: 'Snacks & Coffee',
      date: '2026-09-25',
      direction: 'DEBIT' as const,
      referenceId: 'REF-STARBUCKS-AM',
      smsReferenceId: 'REF-STARBUCKS-AM',
      active: true,
      rawSmsText: 'Rs 350 debited at Starbucks AM Ref REF-STARBUCKS-AM',
    };
    Storage.setExpenses([purchase1]);

    // Second purchase in afternoon at Starbucks for identical ₹350 with different reference
    const res = smsExpenseService.processSms(
      'Rs 350 debited from A/C 9999 to Starbucks on 25-Sep-26. UPI: 998877665544.',
      'AD-HDFCBK-S',
      Date.now(),
      false
    );

    expect(res.status).toBe('logged');
    expect(res.success).toBe(true);
    expect(res.expense).toBeDefined();

    // The two expenses must remain separate records without composite collision
    const allExpenses = Storage.getExpenses();
    expect(allExpenses.length).toBe(2);
    expect(allExpenses.map((e) => e.referenceId)).toEqual(
      expect.arrayContaining(['REF-STARBUCKS-AM', '998877665544'])
    );
  });

  it('13. transient write-to-storage failure withholds native queue ACK, enqueues to retry queue, and recovers via processPendingWriteRetries', async () => {
    // Mock Storage.addExpense to simulate a transient failure (e.g. storage error)
    const originalAddExpense = Storage.addExpense;
    let failWrite = true;
    vi.spyOn(Storage, 'addExpense').mockImplementation((exp) => {
      if (failWrite) {
        // Does not persist
        return Storage.getExpenses();
      }
      return originalAddExpense(exp);
    });

    let nativeQueue = [
      { id: 'transient-sms-1', sender: 'AD-HDFCBK-S', body: 'Rs 880.00 debited from A/C 1234 to Apollo on 25-Sep-26. UPI: 998811223344.', timestamp: Date.now() },
    ];

    vi.spyOn(smsExpenseService, 'isNativePluginAvailable').mockResolvedValue(true);
    const { smsPluginWebImpl } = await import('../services/smsExpenseService');
    vi.spyOn(smsPluginWebImpl, 'getPendingSms').mockImplementation(async () => ({ messages: [...nativeQueue] }));
    const ackSpy = vi.spyOn(smsPluginWebImpl, 'acknowledgePendingSms').mockImplementation(async (opts) => {
      const idsToRemove = new Set(opts.ids || []);
      nativeQueue = nativeQueue.filter((item) => !idsToRemove.has(item.id));
      return { success: true };
    });

    // Run sync when storage write fails
    const loggedCount = await smsExpenseService.syncPendingBackgroundMessages();
    expect(loggedCount).toBe(0);

    // Native queue was NOT acknowledged; message is kept for retry
    expect(nativeQueue.length).toBe(1);

    // Item was safely enqueued into the persistent write retry queue
    const retryQueue = Storage.getSmsWriteRetryQueue();
    expect(retryQueue.length).toBe(1);
    expect(retryQueue[0].expense.name).toBe('Apollo');
    expect(retryQueue[0].expense.amount).toBe(880);

    // Storage becomes writable again (transient failure resolved)
    failWrite = false;

    // Process retry queue
    const recovered = await smsExpenseService.processPendingWriteRetries();
    expect(recovered).toBe(1);

    // Storage now contains Apollo
    const stored = Storage.getExpenses();
    expect(stored.some((e) => e.name === 'Apollo' && e.amount === 880)).toBe(true);

    // Retry queue is now cleared
    expect(Storage.getSmsWriteRetryQueue().length).toBe(0);

    vi.restoreAllMocks();
  });

  it('14. user sign-out preserves pending messages in user recovery storage without loss, and restores on login', async () => {
    vi.spyOn(smsExpenseService, 'isNativePluginAvailable').mockResolvedValue(true);
    const { smsPluginWebImpl } = await import('../services/smsExpenseService');
    const { Auth } = await import('../utils/auth');

    // Simulate native queue having an unprocessed pending message that could not be written initially
    let nativeMessages = [
      { id: 'pending-sms-logout', sender: 'AD-HDFCBK-S', body: 'Rs 120.00 debited to Metro on 25-Sep-26. UPI: 445566778899.', timestamp: Date.now() },
    ];
    vi.spyOn(smsPluginWebImpl, 'getPendingSms').mockImplementation(async () => ({ messages: [...nativeMessages] }));
    vi.spyOn(smsPluginWebImpl, 'clearPendingSms').mockImplementation(async () => {
      nativeMessages = [];
      return { success: true };
    });

    // Temporarily fail writes during logout sync so message remains in pending queue
    const origAdd = Storage.addExpense;
    let storageLocked = true;
    vi.spyOn(Storage, 'addExpense').mockImplementation((exp) => {
      if (storageLocked) return Storage.getExpenses();
      return origAdd(exp);
    });

    // User "user_alice" signs out
    const testUser = {
      id: 'usr_alice_123',
      email: 'alice@example.com',
      name: 'Alice',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'supabase' as const,
    };
    Auth.setCurrentUser(testUser);

    // Preserve pending queue before sign out
    await smsExpenseService.preservePendingQueueBeforeSignOut(testUser.id);

    // Native queue is cleared so subsequent user has a clean state
    expect(nativeMessages.length).toBe(0);

    // User-scoped recovery storage holds the unprocessed message
    const recoveryKey = `user_${testUser.id}_unprocessed_pending_sms`;
    const preservedRaw = localStorage.getItem(recoveryKey);
    expect(preservedRaw).not.toBeNull();
    const preserved = JSON.parse(preservedRaw!);
    expect(preserved.length).toBe(1);
    expect(preserved[0].id).toBe('pending-sms-logout');

    // Storage is unlocked
    storageLocked = false;

    // User logs back in
    const restoredCount = await smsExpenseService.restorePreservedPendingSmsForUser(testUser.id);
    expect(restoredCount).toBe(1);

    // Expense is now properly logged in Storage
    const stored = Storage.getExpenses();
    expect(stored.some((e) => e.name === 'Metro' && e.amount === 120)).toBe(true);

    // Recovery key is cleared after restoration
    expect(localStorage.getItem(recoveryKey)).toBeNull();

    vi.restoreAllMocks();
  });

  it('15. non-native web sync merges remote APK-authoritative SMS transactions while preserving legitimate web manual transactions without APK making itself exclusive owner of all expenses', () => {
    // Remote workspace contains:
    // 1. APK-committed SMS expense
    // 2. An older manual expense created yesterday
    const apkSmsExpense = {
      id: 'exp-sms-apk-1',
      name: 'Swiggy Delivery',
      amount: 320,
      category: 'Dining Out',
      date: '2026-09-25',
      direction: 'DEBIT' as const,
      source: 'sms_auto',
      rawSmsText: 'Debited 320 to Swiggy UPI 5544332211',
      active: true,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const olderManualExpense = {
      id: 'exp-manual-1',
      name: 'Old Book',
      amount: 250,
      category: 'Education',
      date: '2026-09-24',
      direction: 'DEBIT' as const,
      active: true,
      createdAt: 500,
      updatedAt: 500,
    };

    // Web client has edited the older manual expense AND added a new manual expense
    const editedManualExpense = {
      ...olderManualExpense,
      amount: 300, // user updated price on web
      updatedAt: 2000,
    };
    const newWebManualExpense = {
      id: 'exp-manual-web-2',
      name: 'Stationery',
      amount: 150,
      category: 'Office',
      date: '2026-09-25',
      direction: 'DEBIT' as const,
      active: true,
      createdAt: 1500,
      updatedAt: 1500,
    };

    // Non-native web sync performs merge
    const merged = supabaseUtils.mergeExpenseLists(
      [editedManualExpense, newWebManualExpense],
      [apkSmsExpense, olderManualExpense]
    );

    expect(merged.length).toBe(3);

    // 1. APK SMS expense is safely retained
    const smsItem = merged.find((e) => e.id === 'exp-sms-apk-1');
    expect(smsItem).toBeDefined();
    expect(smsItem?.amount).toBe(320);

    // 2. Web manual addition is safely retained
    const webNewItem = merged.find((e) => e.id === 'exp-manual-web-2');
    expect(webNewItem).toBeDefined();
    expect(webNewItem?.amount).toBe(150);

    // 3. Web manual edit (updated price to 300) wins over older remote snapshot
    const editedItem = merged.find((e) => e.id === 'exp-manual-1');
    expect(editedItem).toBeDefined();
    expect(editedItem?.amount).toBe(300);
  });
});

