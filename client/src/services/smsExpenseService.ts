import { registerPlugin, Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { ExpenseItem, ParsedSmsTransaction, SmsTransactionLogItem, SmsWriteRetryItem } from '../types';
import { Storage } from '../utils/storage';
import { ConnectionPolicyManager } from './connectionPolicy';
import { expenseRepo } from '../repositories/expenseRepository';
import { broadcastDataChanged } from './commandMappingService';
import { nativeService } from './nativeService';
import { Sound } from '../utils/audio';
import { parseSmsTransaction } from './smsParser';
import { normalizeExpenseDateKey } from '../utils/expenseUtils';
import { scheduleAutoSyncToSupabase, flushAutoSyncImmediately, getCustomWorkspaceIdentifier } from '../utils/supabase';
import { toast } from 'sonner';

export interface SmsTransactionCandidate {
  id: string;
  rawSms: string;
  sender: string;
  timestamp: number;
  amount: number;
  currency: string;
  payee: string;
  merchant: string;
  category: string;
  paymentMethod: string;
  bankName: string;
  referenceId?: string;
  direction: 'DEBIT' | 'CREDIT';
  date: string;
  time?: string;
  preview: string;
  isExisting: boolean;
  existingMatchTitle?: string;
}

export interface SmsRescanResult {
  scanned: number;
  transactionsFound: number;
  selected: number;
  imported: number;
  alreadyExisting: number;
  failed: number;
  failures: Array<{ candidateId: string; reason: string }>;
  importedExpenses: ExpenseItem[];
}

export interface SmsTransactionPluginInterface {
  isAvailable(): Promise<{ available: boolean; platform: string }>;
  checkPermissions(): Promise<{ sms: 'granted' | 'denied' | 'prompt'; receiveSms?: string; readSms?: string }>;
  requestPermissions(): Promise<{ sms: 'granted' | 'denied' | 'prompt'; receiveSms?: string; readSms?: string }>;
  setEnabled(options: { enabled: boolean }): Promise<{ success: boolean; enabled: boolean }>;
  isEnabled(): Promise<{ enabled: boolean }>;
  getPendingSms(): Promise<{ messages: Array<{ id?: string; sender: string; body: string; timestamp: number }> }>;
  acknowledgePendingSms(options: { ids?: string[]; hashes?: string[] }): Promise<{ success: boolean }>;
  showTransactionNotification(options: { title: string; body: string }): Promise<{ success: boolean }>;
  clearPendingSms(): Promise<{ success: boolean }>;
  readRecentSms(options?: { limit?: number }): Promise<{ messages: Array<{ sender: string; body: string; timestamp: number }> }>;
  logDiagnostic?(options: { tag?: string; level?: 'info' | 'warn' | 'error' | 'debug'; message: string }): Promise<void>;
  addListener(
    eventName: 'onSmsReceived',
    listenerFunc: (data: { sender: string; body: string; timestamp: number }) => void
  ): Promise<{ remove: () => void }>;
}

export const smsPluginWebImpl = {
  isAvailable: async () => ({ available: false, platform: 'web' }),
  checkPermissions: async () => ({ sms: 'prompt' as const }),
  requestPermissions: async () => ({ sms: 'granted' as const, receiveSms: 'granted' }),
  setEnabled: async (opts: { enabled: boolean }) => ({ success: true, enabled: opts.enabled }),
  isEnabled: async () => ({ enabled: true }),
  getPendingSms: async () => ({ messages: [] as Array<{ id?: string; sender: string; body: string; timestamp: number }> }),
  acknowledgePendingSms: async (_opts?: { ids?: string[]; hashes?: string[] }) => ({ success: true }),
  showTransactionNotification: async (_opts?: { title: string; body: string }) => ({ success: true }),
  clearPendingSms: async () => ({ success: true }),
  readRecentSms: async (opts?: { limit?: number }) => {
    if (typeof (smsPluginWebImpl as any)._inboxMock === 'function') {
      return (smsPluginWebImpl as any)._inboxMock(opts);
    }
    return { messages: [] as Array<{ sender: string; body: string; timestamp: number }> };
  },
  logDiagnostic: async () => {},
  addListener: async () => ({ remove: () => {} }),
};

/**
 * Sanitizes sensitive banking and identity data from SMS texts
 * before outputting diagnostic logs to device Logcat or console.
 */
export function sanitizeSmsForLog(text: string): string {
  if (!text) return '';
  return text
    // Mask 12-16 digit card / account sequences
    .replace(/\b(\d{4})[ -]?(\d{4})[ -]?(\d{4})[ -]?(\d{4})\b/g, '****-****-****-$4')
    // Mask bank accounts
    .replace(/(a\/c|acct|acc|account|card)\s*(?:no\.?)?\s*[:#]?\s*([X*]*\d{4,})/gi, '$1 ****')
    // Mask OTP codes
    .replace(/(otp|code|secret)\s*(?:is|:)?\s*\b\d{4,8}\b/gi, '$1 ******')
    // Mask phone numbers in UPI handles
    .replace(/\b(\d{6})(\d{4})@([a-zA-Z]+)\b/g, '******$2@$3');
}

/**
 * Robust diagnostic logger that outputs directly to Android Logcat
 * (via Capacitor console bridge and native SmsTransaction.logDiagnostic)
 */
export function logDeviceDiagnostic(
  level: 'info' | 'warn' | 'error' | 'debug',
  tag: string,
  message: string,
  payload?: Record<string, any> | string
) {
  const formattedPayload =
    payload !== undefined
      ? typeof payload === 'string'
        ? payload
        : JSON.stringify(payload, null, 2)
      : '';
  const fullLog = formattedPayload ? `[${tag}] ${message}\nDATA: ${formattedPayload}` : `[${tag}] ${message}`;

  // 1. Output to standard console (automatically redirected to Android Logcat by Capacitor / Chromium)
  switch (level) {
    case 'error':
      console.error(fullLog);
      break;
    case 'warn':
      console.warn(fullLog);
      break;
    case 'debug':
      console.debug(fullLog);
      break;
    case 'info':
    default:
      console.info(fullLog);
      break;
  }

  // 2. Direct native logcat output when running on device
  try {
    if (Capacitor.isNativePlatform() && SmsTransaction.logDiagnostic) {
      SmsTransaction.logDiagnostic({
        tag: tag.split(':')[0] || 'LifeOS_SMS',
        level,
        message: fullLog,
      }).catch(() => {});
    }
  } catch {
    // Ignore bridge errors in test/mock environments
  }
}

export const SmsTransaction = registerPlugin<SmsTransactionPluginInterface>('SmsTransaction', {
  web: () => smsPluginWebImpl,
});

if (!(SmsTransaction as any).showTransactionNotification) {
  (SmsTransaction as any).showTransactionNotification = (opts: { title: string; body: string }) =>
    smsPluginWebImpl.showTransactionNotification(opts);
}
if (!(SmsTransaction as any).acknowledgePendingSms) {
  (SmsTransaction as any).acknowledgePendingSms = (opts: { ids?: string[]; hashes?: string[] }) =>
    smsPluginWebImpl.acknowledgePendingSms(opts);
}

/**
 * Strict deep-equality verification between a persisted ExpenseItem from Storage
 * and the expected ExpenseItem being written.
 *
 * Verifies that the specific record in Storage matches:
 * 1. Primary ID or canonical preserved reference ID
 * 2. Exact amount (within 0.001 precision)
 * 3. Direction and transaction type ('DEBIT' | 'CREDIT')
 * 4. Normalized date key (YYYY-MM-DD)
 * 5. Normalized name / merchant
 * 6. Normalized category
 * 7. Active state
 * 8. Bank / Reference ID (if present)
 * 9. Normalized raw SMS text (if present)
 *
 * Never permits an ambiguous composite match to verify an unwritten or different record.
 */
export function isDeepEqualExpense(actual: ExpenseItem | null | undefined, expected: ExpenseItem | null | undefined): boolean {
  if (!actual || !expected) return false;

  const actualId = String(actual.id || '').trim();
  const expectedId = String(expected.id || '').trim();

  const cleanActualRef = (actual.referenceId || actual.smsReferenceId || actual.upiReference || '').trim().toUpperCase();
  const cleanExpectedRef = (expected.referenceId || expected.smsReferenceId || expected.upiReference || '').trim().toUpperCase();

  const idMatches = Boolean(actualId && expectedId && actualId === expectedId);
  const refMatches = Boolean(
    cleanExpectedRef &&
    cleanExpectedRef.length >= 4 &&
    cleanActualRef &&
    (cleanActualRef === cleanExpectedRef || cleanActualRef.includes(cleanExpectedRef) || cleanExpectedRef.includes(cleanActualRef))
  );

  // Must match either the exact written ID or the explicit bank/UPI reference ID
  if (!idMatches && !refMatches) {
    return false;
  }

  // Exact amount check
  const actualAmt = Number(actual.amount);
  const expectedAmt = Number(expected.amount);
  if (!Number.isFinite(actualAmt) || !Number.isFinite(expectedAmt)) return false;
  if (Math.abs(actualAmt - expectedAmt) >= 0.01) return false;

  // Exact direction check
  const actualDir = (actual.direction || actual.transactionType || 'DEBIT').toUpperCase();
  const expectedDir = (expected.direction || expected.transactionType || 'DEBIT').toUpperCase();
  if (actualDir !== expectedDir) return false;

  // Normalized Date Key check
  const actualDate = normalizeExpenseDateKey(actual.date);
  const expectedDate = normalizeExpenseDateKey(expected.date);
  if (actualDate !== expectedDate) return false;

  // Name / Merchant check
  const actualName = (actual.name || '').trim().toLowerCase();
  const expectedName = (expected.name || '').trim().toLowerCase();
  if (actualName !== expectedName) return false;

  // Category check
  const actualCat = (actual.category || '').trim().toLowerCase();
  const expectedCat = (expected.category || '').trim().toLowerCase();
  if (actualCat !== expectedCat) return false;

  // Active state check
  if (actual.active === false && expected.active !== false) return false;

  // Raw SMS text check (if present on expected)
  if (expected.rawSmsText && actual.rawSmsText) {
    const actualRaw = actual.rawSmsText.trim().toLowerCase().replace(/\s+/g, ' ');
    const expectedRaw = expected.rawSmsText.trim().toLowerCase().replace(/\s+/g, ' ');
    if (actualRaw !== expectedRaw) return false;
  }

  return true;
}

/**
 * Under Telecom Regulatory Authority of India (TRAI) DLT regulations,
 * legitimate transactional and banking service messages are assigned headers ending
 * with the letter "S" or "T" (e.g., AD-ICICIT-S, AX-AXISBK-S, VM-IRCTCi-S, VA-UNIONB-S, AD-SBIUPI-S)
 * or standard alphanumeric bank codes (e.g. AD-ICICIB, VM-HDFCBK, BZ-SBIINB, HDFCBK, ICICIB, SBIUPI).
 * Personal numbers (+91...) and promotional headers (-P, PROMO, etc.) are ignored.
 */
export function isTraiServiceSender(sender: string): boolean {
  if (!sender || typeof sender !== 'string') return false;
  const clean = sender.trim().toUpperCase();

  // Reject personal phone numbers (+91..., 9+ consecutive digits)
  if (/^\+?\d{9,}$/.test(clean.replace(/[\s-]/g, ''))) {
    return false;
  }

  // Reject promotional senders ending with -P or containing PROMO / OFFER / BAJAJ
  if (clean.endsWith('-P') || clean.includes('PROMO') || clean.includes('OFFER') || clean === 'BAJAJ') {
    return false;
  }

  // Accept TRAI service / transactional suffix (-S, -T)
  if (clean.endsWith('-S') || clean.endsWith('-T')) {
    return true;
  }

  // Known Indian bank / financial service keywords
  const bankKeywords = [
    'ICICI', 'ICICIB', 'HDFC', 'HDFCBK', 'SBI', 'SBIUPI', 'SBIINB', 'AXIS', 'AXISBK',
    'KOTAK', 'KOTAKB', 'PNB', 'CANARA', 'CANBNK', 'BOB', 'BARODA', 'UNION', 'UNIONB',
    'INDUS', 'FEDERAL', 'FEDBNK', 'IDFC', 'YES', 'YESB', 'YESBK', 'YESBNK', 'YESBANK',
    'PAYTM', 'GPAY', 'PHONEPE', 'BHIM', 'UPI', 'AIRTEL', 'AMEX',
    'CITI', 'STANDARD', 'SCB', 'RBL', 'IDBI', 'BANDHAN', 'AUBANK', 'IOB',
    'CENTRAL', 'UCO', 'INDIANB', 'MAHABANK', 'MAHABK', 'POSTBK', 'IPPB',
    'BOI', 'BANKOFINDIA', 'DBS', 'HSBC', 'J&K', 'JKBANK', 'KVB', 'KARUR',
    'SIB', 'SOUTHINDBK', 'CSB', 'UJJIVAN', 'EQUITAS', 'FINCARE', 'ESAF',
    'SURYODAY', 'CRED', 'SLICE', 'JUPITER', 'FI'
  ];
  if (bankKeywords.some((kw) => clean.includes(kw))) {
    return true;
  }

  // Standard 2-letter prefix + hyphen + alphanumeric sender ID format (e.g. AD-ICICIB, BZ-SBIINB)
  if (/^[A-Z]{2}-[A-Z0-9]{3,9}$/.test(clean)) {
    return true;
  }

  return false;
}

export const isBankOrFinancialSender = isTraiServiceSender;

/**
 * Fast, comprehensive local heuristic to identify financial transaction SMS
 * (debits, credits, UPI, cards, bank alerts) while rejecting OTPs, loans, and promotional spam.
 * Fully aligned with native SmsReceiver.java heuristic.
 */
export function isLikelyFinancialSms(sender: string, body: string): boolean {
  if (!body || !body.trim()) return false;
  const lower = body.toLowerCase();

  // 1. Strict OTP & Authentication rejection
  if (
    (lower.includes('otp') &&
      (lower.includes('is your') ||
        lower.includes('secret otp') ||
        lower.includes('valid for') ||
        lower.includes('to authenticate') ||
        lower.includes('use this otp') ||
        /otp\s*(?:is|:)?\s*\d+/.test(lower))) ||
    lower.includes('is your one time password') ||
    lower.includes('is your verification code') ||
    lower.includes('security code')
  ) {
    return false;
  }

  // 2. Reject promotional / marketing loans, schemes & recharge offers
  if (
    lower.includes('pre-approved loan') ||
    lower.includes('apply for instant loan') ||
    lower.includes('personal loan up to') ||
    lower.includes('click here to claim') ||
    lower.includes('congratulations! you won') ||
    lower.includes('apply for credit card') ||
    lower.includes('recharge offer') ||
    lower.includes('recharge now') ||
    lower.includes('special recharge') ||
    lower.includes('cashback on recharge')
  ) {
    return false;
  }

  // 3. Reject declined or failed transactions
  if (
    lower.includes('declined') ||
    lower.includes('payment failed') ||
    lower.includes('transaction failed') ||
    lower.includes('unsuccessful') ||
    lower.includes('failed due to')
  ) {
    return false;
  }

  // 4. Must contain at least one digit (amount, account, or date)
  if (!/\d/.test(lower)) {
    return false;
  }

  // 5. Must contain a financial transaction verb or banking indicator
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
    lower.includes('payment for') ||
    lower.includes('payment confirmed') ||
    lower.includes('payment successful') ||
    lower.includes('payment done') ||
    lower.includes('payment') ||
    lower.includes('received') ||
    lower.includes('deposited') ||
    lower.includes('refund') ||
    lower.includes('cashback') ||
    lower.includes('upi') ||
    lower.includes('utr') ||
    lower.includes('rrn') ||
    lower.includes('imps') ||
    lower.includes('neft') ||
    lower.includes('rtgs') ||
    lower.includes('transaction id') ||
    lower.includes('trans id') ||
    lower.includes('txn id') ||
    lower.includes('ref no') ||
    lower.includes('vpa') ||
    lower.includes('pos txn') ||
    lower.includes('atm wdl') ||
    lower.includes('card ending') ||
    lower.includes('a/c ending') ||
    lower.includes('acct ending') ||
    lower.includes('a/c') ||
    lower.includes('acct') ||
    lower.includes('avl bal') ||
    lower.includes('avail bal') ||
    lower.includes('dr to') ||
    lower.includes('cr to');

  return hasTxnVerb;
}

class SmsExpenseService {
  private isInitialized = false;
  private isListening = false;
  private removeListenerCallback: (() => void) | null = null;
  private inFlightFingerprints = new Set<string>();
  private inFlightTransactionKeys = new Set<string>();

  /**
   * Checks whether the current platform is Android (native Capacitor or Android browser)
   */
  public isAndroidDevice(): boolean {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/android/i.test(ua)) return true;
    }
    return nativeService.isAndroid() || Capacitor.getPlatform() === 'android';
  }

  /**
   * Checks if native Capacitor Android SMS plugin is available
   */
  public async isNativePluginAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    try {
      const res = await SmsTransaction.isAvailable();
      return !!res?.available;
    } catch {
      return false;
    }
  }

  /**
   * Returns true if running inside native Android APK
   */
  public isNativeAndroidApp(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Returns current user preference for auto-tracking
   */
  public isAutoTrackingEnabled(): boolean {
    return Storage.isSmsAutoTrackingEnabled();
  }

  /**
   * Ensures that the native SMS listener is active and registered
   */
  public async ensureNativeListenerRegistered(): Promise<void> {
    if (this.isListening) return;
    if (!(await this.isNativePluginAvailable())) return;
    try {
      const handle = await SmsTransaction.addListener('onSmsReceived', (data) => {
        if (!this.isAutoTrackingEnabled()) return;
        // Hold incoming SMS in native pending inbox while offline to prevent multi-device inconsistency
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          logDeviceDiagnostic('info', 'LifeOS_SMS:OFFLINE_SMS_HELD', 'Incoming SMS held in native pending inbox until reconnected to prevent inconsistency', {
            sender: data.sender,
          });
          return;
        }
        this.processSms(data.body, data.sender, data.timestamp, true);
      });
      this.removeListenerCallback = () => {
        handle.remove();
      };
      this.isListening = true;
    } catch (err) {
      console.warn('Could not register native SMS listener:', err);
    }
  }

  /**
   * Sets auto-tracking enabled state and syncs to native SharedPreferences
   */
  public async setAutoTrackingEnabled(enabled: boolean): Promise<void> {
    Storage.setSmsAutoTrackingEnabled(enabled);
    if (typeof window !== 'undefined') {
      if (!enabled) {
        localStorage.setItem('lifeos_sms_explicitly_disabled', 'true');
      } else {
        localStorage.removeItem('lifeos_sms_explicitly_disabled');
      }
    }

    if (await this.isNativePluginAvailable()) {
      try {
        await SmsTransaction.setEnabled({ enabled });
      } catch (err) {
        console.warn('Failed to sync SMS enabled state with native Android bridge:', err);
      }
    }

    if (enabled) {
      await this.ensureNativeListenerRegistered();
      // If enabled, immediately sync any pending background messages
      await this.syncPendingBackgroundMessages();
    }
  }

  /**
   * Check Android SMS permissions
   */
  public async checkPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    if (!this.isAndroidDevice()) {
      return 'unsupported';
    }
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await SmsTransaction.checkPermissions();
        return (res.sms || (res.receiveSms === 'granted' ? 'granted' : 'prompt')) as any;
      }
      return Storage.isSmsAutoTrackingEnabled() ? 'granted' : 'prompt';
    } catch {
      return 'prompt';
    }
  }

  /**
   * Request Android SMS runtime permissions with user prompt
   */
  public async requestPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    if (!this.isAndroidDevice()) {
      return 'unsupported';
    }
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await SmsTransaction.requestPermissions();
        const status = (res.sms || (res.receiveSms === 'granted' ? 'granted' : 'denied')) as any;
        if (status === 'granted') {
          await this.setAutoTrackingEnabled(true);
        }
        return status;
      }
      // On web simulation / test environment
      const res = await (smsPluginWebImpl as any).requestPermissions();
      const status = (res?.sms || (res?.receiveSms === 'granted' ? 'granted' : 'denied')) as any;
      if (status === 'granted') {
        await this.setAutoTrackingEnabled(true);
      }
      return status;
    } catch (err) {
      console.warn('SMS permission request failed:', err);
      return 'denied';
    }
  }

  /**
   * Checks whether a parsed transaction is a duplicate of an existing entry.
   * Compares against:
   * 1. Processed fingerprint cache
   * 2. Raw SMS payload hash
   * 3. Existing expenses with identical reference ID
   * 4. Same date, same amount, and matching merchant within tolerance
   */
  /**
   * Checks whether a parsed transaction is a duplicate of an existing entry.
   * Compares against strictly prioritized criteria:
   * 1. Transaction / Reference ID (strongest identifier)
   * 2. Raw SMS identity / payload hash
   * 3. Contextual matching (date, amount, merchant, time) only as a fallback
   *
   * Note: A clearly different transaction/reference ID must NEVER be merged
   * merely because amount, merchant, and timestamp are similar.
   */
  /**
   * Evaluates if a candidate transaction is a duplicate.
   *
   * Priority Hierarchy:
   * 1. Transaction / Reference ID (UPI Ref, RRN, Txn ID) is the HIGHEST-PRIORITY identity.
   *    - If two SMS have different transaction/reference IDs, ALWAYS create separate Spending entries,
   *      even if they are from the same bank, same account, same merchant, and within five minutes.
   *    - A transaction with a known reference ID is only duplicate if that exact reference ID
   *      was already processed or exists in Spending.
   * 2. Raw SMS Identity / Hash:
   *    - Guards against identical raw SMS broadcast deliveries, retries, and queue reprocessing.
   * 3. Fallback Heuristic (ONLY when NO transaction/reference ID can be extracted):
   *    - The 5-minute duplicate heuristic (same amount, same merchant, same date within 5 mins)
   *      is strictly used ONLY when no reference ID is present on the incoming SMS.
   *    - Contextual heuristics must NEVER override a valid, different transaction/reference ID.
   */
  public checkIsDuplicate(
    parsed: ParsedSmsTransaction,
    existingExpenses: ExpenseItem[] = Storage.getExpenses(),
    rawBody?: string
  ): { isDuplicate: boolean; reason?: string } {
    const processedFingerprints = Storage.getProcessedSmsFingerprints();

    // =========================================================================
    // 1. HIGHEST-PRIORITY IDENTITY: Transaction / Reference ID (UPI Ref, UTR, RRN, Txn ID, IMPS)
    // =========================================================================
    const cleanRef = parsed.referenceId ? parsed.referenceId.trim().toUpperCase() : '';
    const hasReferenceId = cleanRef.length > 0;

    if (hasReferenceId) {
      // Check if reference is tombstoned (actively deleted by user)
      if (Storage.isRefTombstoned(cleanRef)) {
        return {
          isDuplicate: true,
          reason: `Duplicate: Transaction with Reference ID ${parsed.referenceId} was previously deleted by user`,
        };
      }

      const trashExpenses = Storage.getTrash().filter((t) => !t.module || t.module === 'expenses');
      const matchInTrash = trashExpenses.find((t) => {
        const d: any = t.data;
        return (
          (d?.smsReferenceId && String(d.smsReferenceId).trim().toUpperCase() === cleanRef) ||
          (d?.referenceId && String(d.referenceId).trim().toUpperCase() === cleanRef) ||
          (d?.upiReference && String(d.upiReference).trim().toUpperCase() === cleanRef)
        );
      });
      if (matchInTrash) {
        return {
          isDuplicate: true,
          reason: `Duplicate: Transaction with Reference ID ${parsed.referenceId} was deleted by user`,
        };
      }

      const refKey = `ref_id_${cleanRef}`;

      // Check if this exact Reference ID was already processed in fingerprint history
      if (processedFingerprints.includes(refKey)) {
        return {
          isDuplicate: true,
          reason: `Duplicate: Transaction with Reference ID ${parsed.referenceId} already processed`,
        };
      }

      // Check if an existing Spending entry already has this exact Reference ID
      const refUpper = cleanRef;
      const matchByRef = existingExpenses.find(
        (e) =>
          (e.smsReferenceId && e.smsReferenceId.trim().toUpperCase() === refUpper) ||
          (e.referenceId && e.referenceId.trim().toUpperCase() === refUpper) ||
          (e.upiReference && e.upiReference.trim().toUpperCase() === refUpper) ||
          (e.notes && e.notes.toUpperCase().includes(refUpper))
      );
      if (matchByRef) {
        return {
          isDuplicate: true,
          reason: `Duplicate: Transaction with Reference ID ${parsed.referenceId} already exists ("${matchByRef.name}")`,
        };
      }

      // Protection against true duplicate SMS broadcasts, retries, and queue reprocessing:
      // If the raw text is 100% identical to a prior delivery already in Spending
      if (rawBody && rawBody.trim()) {
        const matchByRawText = existingExpenses.find(
          (e) => e.rawSmsText && e.rawSmsText.trim().toLowerCase() === rawBody.trim().toLowerCase()
        );
        if (matchByRawText) {
          return { isDuplicate: true, reason: 'Duplicate: Identical raw SMS text already logged in Spending' };
        }
      }

      // CRITICAL REQUIREMENT:
      // If two SMS have different transaction/reference IDs, always create separate Spending entries,
      // even if they are from the same bank, same account, same merchant, and within five minutes.
      // Since this transaction has a valid, non-duplicate reference ID and is absent from existingExpenses,
      // IT IS A GENUINE DISTINCT TRANSACTION.
      return { isDuplicate: false };
    }

    // =========================================================================
    // 2. TRANSACTIONS WITHOUT REFERENCE ID:
    // Priority: Composite fingerprint & strict duplicate verification
    // "Two payments to the same person with different amounts must create two separate transactions"
    // "Never deduplicate using only payee, merchant, sender, or amount"
    // =========================================================================
    // A. Protection against identical raw SMS delivery repeats
    if (rawBody && rawBody.trim()) {
      const rawLower = rawBody.trim().toLowerCase();
      const matchByRawText = existingExpenses.find(
        (e) => e.rawSmsText && e.rawSmsText.trim().toLowerCase() === rawLower
      );
      if (matchByRawText) {
        return { isDuplicate: true, reason: 'Duplicate: Identical raw SMS text already logged in Spending' };
      }

      const trashExpenses = Storage.getTrash().filter((t) => !t.module || t.module === 'expenses');
      const matchTrashByRaw = trashExpenses.find((t) => {
        const d: any = t.data;
        return d?.rawSmsText && String(d.rawSmsText).trim().toLowerCase() === rawLower;
      });
      if (matchTrashByRaw) {
        return { isDuplicate: true, reason: 'Duplicate: Transaction was previously deleted by user' };
      }
    }

    // C. Contextual matching: strictly fallback when NO reference ID exists.
    // Must match: exact same amount, same date, same payee/merchant, within 3 minutes.
    const cleanPayee = (parsed.payee || parsed.merchant || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchByDetails = existingExpenses.find((e) => {
      // Different amounts to the same payee are NEVER duplicates:
      if (Math.abs(Number(e.amount) - parsed.amount) > 0.01) return false;

      // Must match exact date (canonicalized)
      if (normalizeExpenseDateKey(e.date) !== normalizeExpenseDateKey(parsed.date)) return false;

      // If existing expense has a specific reference ID and candidate does not,
      // they cannot be assumed duplicates without identical raw text.
      if (e.smsReferenceId && (!parsed.referenceId || e.smsReferenceId !== parsed.referenceId)) {
        return false;
      }

      // Check merchant / payee name similarity
      const existingNameClean = (e.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const merchantMatches =
        cleanPayee &&
        (existingNameClean.includes(cleanPayee) || cleanPayee.includes(existingNameClean));
      if (!merchantMatches) return false;

      // 3-minute duplicate heuristic for identical amount + payee without reference ID:
      if (e.time && parsed.time) {
        const [eH, eM] = e.time.split(':').map(Number);
        const [pH, pM] = parsed.time.split(':').map(Number);
        if (!isNaN(eH) && !isNaN(eM) && !isNaN(pH) && !isNaN(pM)) {
          const diffMinutes = Math.abs((eH * 60 + eM) - (pH * 60 + pM));
          if (diffMinutes > 3) {
            return false;
          }
        }
      }

      return true;
    });

    if (matchByDetails) {
      return {
        isDuplicate: true,
        reason: `Duplicate: Identical transaction of ₹${parsed.amount} to "${matchByDetails.name}" already logged for ${parsed.date}`,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Processes a single raw SMS message string.
   * Performs semantic extraction, duplicate detection, and writes to Storage if valid.
   */
  public processSms(
    body: string,
    sender: string = '',
    timestamp: number = Date.now(),
    showToastNotification: boolean = true
  ): {
    success: boolean;
    status: 'logged' | 'duplicate_skipped' | 'ignored_not_financial' | 'storage_failed';
    reason?: string;
    expense?: ExpenseItem;
    parsed: ParsedSmsTransaction;
  } {
    const sanitizedBody = sanitizeSmsForLog(body);

    // =========================================================================
    // 0. SENDER & FINANCIAL CONTENT ELIGIBILITY CHECK
    // =========================================================================
    // Verify that sender is an authorized banking / TRAI sender (if sender provided),
    // and that body meets the financial transaction heuristic (not OTP, spam, or promo).
    const hasSender = Boolean(sender && sender.trim());
    const isEligibleSender = hasSender ? isTraiServiceSender(sender) : true;
    const isFinancialHeuristic = isLikelyFinancialSms(sender, body);

    if (!isEligibleSender || !isFinancialHeuristic) {
      const skipReason = !isEligibleSender
        ? `SMS ignored: Sender "${sender || '(empty)'}" is not an authorized banking sender.`
        : `SMS ignored: Message body has no financial transaction content or is non-transactional (OTP/verification/promo).`;
      logDeviceDiagnostic('warn', 'LifeOS_SMS:SKIPPED_NOT_FINANCIAL', 'Message was NOT identified as a financial transaction', {
        sender: sender || '(unknown)',
        whySkipped: skipReason,
        sanitizedPreview: sanitizedBody.slice(0, 100),
      });

      const logItem: SmsTransactionLogItem = {
        id: `sms-log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp,
        sender,
        rawSms: body,
        status: 'ignored_not_financial',
        reason: skipReason,
      };
      Storage.addSmsTransactionLog(logItem);

      return {
        success: false,
        status: 'ignored_not_financial',
        reason: skipReason,
        parsed: {
          isTransaction: false,
          amount: 0,
          currency: '₹',
          type: 'expense',
          merchant: 'Unknown',
          category: 'Others',
          paymentMethod: 'Other',
          confidence: 0,
          date: '',
          rawSms: body,
          sender,
          timestamp,
          ignoreReason: skipReason,
          fingerprint: '',
        },
      };
    }

    // =========================================================================
    // 1. IN-FLIGHT CONCURRENCY LOCK (Redundancy Prevention)
    // =========================================================================
    const inFlightKey = `${(sender || '').toUpperCase()}:${body.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    if (this.inFlightFingerprints.has(inFlightKey)) {
      return {
        success: false,
        status: 'duplicate_skipped',
        reason: 'Transaction is already being processed concurrently',
        parsed: parseSmsTransaction(body, sender, timestamp),
      };
    }
    this.inFlightFingerprints.add(inFlightKey);

    try {
      // =========================================================================
      // CHECKPOINT 1 — SMS RECEIVED
      // =========================================================================
      logDeviceDiagnostic('info', 'LifeOS_SMS:1_SMS_RECEIVED LifeOS_SMS:RAW_PAYLOAD', 'Incoming SMS captured before parser', {
        sender: sender || '(unknown)',
        timestampISO: new Date(timestamp).toISOString(),
        timestampMs: timestamp,
        rawBodyLength: body ? body.length : 0,
        sanitizedContent: sanitizedBody,
        isAutoTrackingEnabled: this.isAutoTrackingEnabled(),
        platform: Capacitor.getPlatform(),
        workspace: getCustomWorkspaceIdentifier(),
      });

      // =========================================================================
      // CHECKPOINT 2 — PARSER RESULT
      // =========================================================================
      const parsed = parseSmsTransaction(body, sender, timestamp);

      // Use the extracted transaction/reference ID as the canonical in-flight key.
      // If no reference ID exists, fall back to the normalized raw SMS payload.
      // This is intentionally separate from the existing raw-body lock because two
      // delivery paths can present the same transaction with minor body formatting
      // differences.
      const canonicalTransactionKey = parsed.referenceId
        ? `ref:${parsed.referenceId.trim().toUpperCase()}`
        : `raw:${body.trim().toLowerCase().replace(/\s+/g, ' ')}`;

      if (this.inFlightTransactionKeys.has(canonicalTransactionKey)) {
        logDeviceDiagnostic('warn', 'LifeOS_SMS:IN_FLIGHT_DUPLICATE', 'Same transaction is already being committed; skipping second writer', {
          referenceId: parsed.referenceId || null,
          sender: sender || '(unknown)',
          keyType: parsed.referenceId ? 'referenceId' : 'rawSms',
        });
        return {
          success: false,
          status: 'duplicate_skipped',
          reason: 'Transaction is already being committed through another SMS delivery path',
          parsed,
        };
      }

      this.inFlightTransactionKeys.add(canonicalTransactionKey);

      logDeviceDiagnostic('info', 'LifeOS_SMS:2_PARSER_RESULT', 'Parser extraction complete', {
        isTransaction: parsed.isTransaction,
        confidence: parsed.confidence,
        ignoreReason: parsed.ignoreReason || null,
        type: parsed.type,
      });

      if (!parsed.isTransaction) {
        const skipReason = parsed.ignoreReason || 'Unrelated message (OTP, promotional advertisement, service alert, or non-transactional text)';

        logDeviceDiagnostic('warn', 'LifeOS_SMS:SKIPPED_NOT_FINANCIAL', 'Message was NOT identified as a financial transaction', {
          sender: sender || '(unknown)',
          whySkipped: skipReason,
          sanitizedPreview: sanitizedBody.slice(0, 140),
        });

        const logItem: SmsTransactionLogItem = {
          id: `sms-log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp,
          sender,
          rawSms: body,
          status: 'ignored_not_financial',
          reason: skipReason,
        };
        Storage.addSmsTransactionLog(logItem);

        return {
          success: false,
          status: 'ignored_not_financial',
          reason: skipReason,
          parsed,
        };
      }

      // =========================================================================
      // CHECKPOINT 3 — EXTRACTED TRANSACTION
      // =========================================================================
      const extractedTransactionData = {
        amount: parsed.amount,
        currency: parsed.currency || 'INR',
        type: parsed.type,
        merchant: parsed.merchant,
        payee: parsed.payee || parsed.merchant,
        category: parsed.category,
        paymentMethod: parsed.paymentMethod,
        bankOrAccount: parsed.bankOrAccount,
        referenceId: parsed.referenceId || null,
        balance: parsed.balance !== undefined ? parsed.balance : null,
        date: parsed.date,
        time: parsed.time,
        fingerprint: parsed.fingerprint,
        confidence: parsed.confidence,
        source: 'sms_auto',
      };

      logDeviceDiagnostic(
        'info',
        'LifeOS_SMS:3_EXTRACTED_TRANSACTION LifeOS_SMS:FINANCIAL_IDENTIFIED',
        'Pre-Duplicate Check Data Object',
        extractedTransactionData
      );

      // =========================================================================
      // CHECKPOINT 4 — DEDUPE DECISION
      // =========================================================================
      const existingExpenses = Storage.getExpenses();
      const dupCheck = this.checkIsDuplicate(parsed, existingExpenses, body);

      logDeviceDiagnostic('info', 'LifeOS_SMS:4_DEDUPE_DECISION', 'Deduplication check completed', {
        isDuplicate: dupCheck.isDuplicate,
        reason: dupCheck.reason || 'None (transaction is unique)',
        existingExpensesCount: existingExpenses.length,
      });

      if (dupCheck.isDuplicate) {
        logDeviceDiagnostic('warn', 'LifeOS_SMS:SKIPPED_DUPLICATE', 'Duplicate transaction detected; skipping auto-logging to Spending', {
          merchant: parsed.merchant,
          amount: parsed.amount,
          referenceId: parsed.referenceId,
          reason: dupCheck.reason,
          fingerprint: parsed.fingerprint,
        });

        // Mark fingerprint and raw body hash so repeated SMS broadcasts don't re-trigger
        Storage.addProcessedSmsFingerprint(parsed.fingerprint);
        Storage.addProcessedSmsFingerprint(`raw_sms_${body.trim().toLowerCase().replace(/\s+/g, ' ')}`);
        if (parsed.referenceId) {
          Storage.addProcessedSmsFingerprint(`ref_id_${parsed.referenceId.trim().toUpperCase()}`);
        }

        const logItem: SmsTransactionLogItem = {
          id: `sms-log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp,
          sender,
          rawSms: body,
          status: 'duplicate_skipped',
          reason: dupCheck.reason,
          parsed: {
            amount: parsed.amount,
            merchant: parsed.merchant,
            category: String(parsed.category),
            type: parsed.type,
            date: parsed.date,
            referenceId: parsed.referenceId,
          },
        };
        Storage.addSmsTransactionLog(logItem);

        return {
          success: false,
          status: 'duplicate_skipped',
          reason: dupCheck.reason,
          parsed,
        };
      }

      // =========================================================================
      // CHECKPOINT 5 — OFFLINE INBOX & STORAGE MUTATION
      // =========================================================================
      const notesParts: string[] = [];
      if (parsed.bankOrAccount) notesParts.push(parsed.bankOrAccount);
      if (parsed.referenceId) notesParts.push(`Ref: ${parsed.referenceId}`);
      notesParts.push('Auto-logged from SMS');

      const nowMs = Date.now();
      const newExpense: ExpenseItem = {
        id: `exp-sms-${nowMs}-${Math.random().toString(36).substr(2, 5)}`,
        name: parsed.payee || parsed.merchant,
        amount: parsed.amount,
        category: parsed.category,
        date: parsed.date,
        time: parsed.time,
        paymentMethod: parsed.paymentMethod,
        notes: notesParts.join(' • '),
        rawSmsText: parsed.rawSms,
        smsReferenceId: parsed.referenceId,
        referenceId: parsed.referenceId,
        upiReference: parsed.paymentMethod === 'UPI' ? parsed.referenceId : undefined,
        source: 'sms_auto',
        direction: parsed.type === 'income' ? 'CREDIT' : 'DEBIT',
        transactionType: parsed.type === 'income' ? 'CREDIT' : 'DEBIT',
        bankOrAccount: parsed.bankOrAccount,
        bankName: parsed.bankName || parsed.bank,
        maskedAccount: parsed.maskedAccount || parsed.account,
        accountLast4: parsed.accountLast4,
        merchant: parsed.merchant,
        payee: parsed.payee || parsed.merchant,
        active: true,
        createdAt: nowMs,
        updatedAt: nowMs,
      };

      // Mutate storage using canonical synchronous Storage.addExpense
      try {
        Storage.addExpense(newExpense);
      } catch (err: any) {
        Storage.addSmsWriteRetryItem({
          id: `retry-${Date.now()}-${newExpense.id}`,
          expense: newExpense,
          rawSms: body,
          sender,
          timestamp,
          attempts: 1,
          lastAttemptAt: Date.now(),
          lastError: err?.message || 'Failed to save',
        });
        return {
          success: false,
          status: 'storage_failed',
          reason: err?.message || 'Failed to save',
          parsed,
        };
      }

      const finalExpenses = Storage.getExpenses();
      const isSaved = finalExpenses.some((e) => e.id === newExpense.id);
      if (!isSaved) {
        Storage.addSmsWriteRetryItem({
          id: `retry-${Date.now()}-${newExpense.id}`,
          expense: newExpense,
          rawSms: body,
          sender,
          timestamp,
          attempts: 1,
          lastAttemptAt: Date.now(),
          lastError: 'Storage write failed verification',
        });
        return {
          success: false,
          status: 'storage_failed',
          reason: 'Storage write failed verification',
          parsed,
        };
      }

      // Save multi-vector fingerprints
      Storage.addProcessedSmsFingerprint(parsed.fingerprint);
      Storage.addProcessedSmsFingerprint(`raw_sms_${body.trim().toLowerCase().replace(/\s+/g, ' ')}`);
      if (parsed.referenceId) {
        Storage.addProcessedSmsFingerprint(`ref_id_${parsed.referenceId.trim().toUpperCase()}`);
      }
      const cleanPayee = (parsed.payee || parsed.merchant || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanBank = (parsed.bankName || parsed.bankOrAccount || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      Storage.addProcessedSmsFingerprint(`composite_${cleanBank}_${parsed.amount.toFixed(2)}_${parsed.date}_${cleanPayee}_${parsed.time || ''}`);

      const logItem: SmsTransactionLogItem = {
        id: `sms-log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp,
        sender,
        rawSms: body,
        status: 'logged',
        expenseId: newExpense.id,
        parsed: {
          amount: parsed.amount,
          merchant: parsed.merchant,
          category: String(parsed.category),
          type: parsed.type,
          date: parsed.date,
          referenceId: parsed.referenceId,
        },
      };
      Storage.addSmsTransactionLog(logItem);

      // =========================================================================
      // CHECKPOINT 8 — SPENDING REFRESH / STATE UPDATE
      // =========================================================================
      // Dispatch system events with explicit updatedExpenses array so all dashboard views update in real time
      broadcastDataChanged('expenses', { newExpense, updatedExpenses: finalExpenses });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sms_expense_auto_logged', {
            detail: { expense: newExpense, parsed, updatedExpenses: finalExpenses },
          })
        );
      }

      logDeviceDiagnostic('info', 'LifeOS_SMS:LOGGED_TO_SPENDING LifeOS_SMS:8_SPENDING_REFRESH_STATE_UPDATE', `Auto-logged to Spending: ${newExpense.name} (₹${newExpense.amount})`, {
        expenseId: newExpense.id,
        title: newExpense.name,
        amount: newExpense.amount,
      });

      // Show native system notification ONLY after local persistence verification has succeeded
      if (this.isNativeAndroidApp()) {
        const formattedAmount = `₹${newExpense.amount.toLocaleString('en-IN')}`;
        const title = `💳 ${newExpense.name} (${formattedAmount})`;
        const bodyDesc = `${newExpense.category} • ${newExpense.bankOrAccount || newExpense.paymentMethod || 'Bank SMS'}`;
        void this.postNativeSuccessNotification(title, bodyDesc);
      }

      // Subtle feedback: Audio, Haptics, and In-App Toast
      try {
        const settings = Storage.getSettings();
        Sound.complete(settings.soundEnabled);
        nativeService.triggerHaptic('success');
      } catch {}

      if (showToastNotification) {
        toast.success(
          `💳 Auto-logged ₹${parsed.amount.toLocaleString()} at ${parsed.merchant}`,
          {
            description: `${parsed.category} • ${parsed.bankOrAccount || parsed.paymentMethod || 'Bank SMS'}`,
            duration: 4000,
          }
        );
      }

      return {
        success: true,
        status: 'logged',
        expense: newExpense,
        parsed,
      };
    } finally {
      this.inFlightFingerprints.delete(inFlightKey);
      // canonicalTransactionKey is created only after parsing, so recover it from
      // the same body when no reference is available. For reference-based SMS the
      // parser is deterministic; reparse only for lock cleanup.
      try {
        const cleanupParsed = parseSmsTransaction(body, sender, timestamp);
        const cleanupKey = cleanupParsed.referenceId
          ? `ref:${cleanupParsed.referenceId.trim().toUpperCase()}`
          : `raw:${body.trim().toLowerCase().replace(/\s+/g, ' ')}`;
        this.inFlightTransactionKeys.delete(cleanupKey);
      } catch {
        this.inFlightTransactionKeys.delete(`raw:${body.trim().toLowerCase().replace(/\s+/g, ' ')}`);
      }
    }
  }

  /**
   * Posts native Android notification after transaction has been successfully verified in Storage
   */
  public async postNativeSuccessNotification(title: string, body: string): Promise<void> {
    try {
      await SmsTransaction.showTransactionNotification({ title, body });
    } catch (err) {
      console.warn('Could not post native success notification:', err);
    }
  }

  /**
   * Clears pending queue from native Android SharedPreferences (e.g. on user logout)
   */
  public async clearPendingQueue(): Promise<void> {
    try {
      if (await this.isNativePluginAvailable()) {
        await SmsTransaction.clearPendingSms();
      }
    } catch (e) {
      console.warn('Could not clear native pending SMS queue:', e);
    }
  }

  /**
   * Processes transient write-to-storage failure queue
   */
  public async processPendingWriteRetries(): Promise<number> {
    const queue = Storage.getSmsWriteRetryQueue();
    if (!queue || queue.length === 0) return 0;

    let recoveredCount = 0;
    const remaining: SmsWriteRetryItem[] = [];

    for (const item of queue) {
      if (item.attempts >= 5) {
        logDeviceDiagnostic('error', 'LifeOS_SMS:WRITE_RETRY_EXHAUSTED', 'Write retry exhausted after 5 attempts', {
          expenseId: item.expense.id,
          lastError: item.lastError,
        });
        continue;
      }

      try {
        Storage.addExpense(item.expense);
        recoveredCount++;
        logDeviceDiagnostic('info', 'LifeOS_SMS:WRITE_RETRY_SUCCESS', 'Successfully recovered failed write from retry queue', {
          expenseId: item.expense.id,
        });
      } catch (err: any) {
        remaining.push({
          ...item,
          attempts: item.attempts + 1,
          lastAttemptAt: Date.now(),
          lastError: err?.message || String(err),
        });
      }
    }

    Storage.setSmsWriteRetryQueue(remaining);

    if (recoveredCount > 0) {
      const freshExpenses = Storage.getExpenses();
      broadcastDataChanged('expenses', { updatedExpenses: freshExpenses });
    }

    return recoveredCount;
  }

  /**
   * Preserves any unhandled pending messages in user recovery storage before sign-out
   */
  public async preservePendingQueueBeforeSignOut(userId: string): Promise<void> {
    try {
      if (!(await this.isNativePluginAvailable())) return;
      // 1. First attempt to sync pending messages so they are committed to this user's workspace
      await this.syncPendingBackgroundMessages();

      // 2. Read any remaining messages from native queue
      const res = await SmsTransaction.getPendingSms();
      const remaining = res?.messages || [];
      if (remaining.length > 0 && userId) {
        const recoveryKey = `user_${userId}_unprocessed_pending_sms`;
        const existingRaw = localStorage.getItem(recoveryKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        localStorage.setItem(recoveryKey, JSON.stringify([...existing, ...remaining].slice(0, 50)));
      }

      // 3. Clear native queue so next user doesn't receive previous user's messages
      await SmsTransaction.clearPendingSms();
    } catch (e) {
      console.warn('Notice preserving pending queue before sign out:', e);
    }
  }

  /**
   * Restores and processes any unhandled pending messages that were preserved for this user
   */
  public async restorePreservedPendingSmsForUser(userId: string): Promise<number> {
    if (!userId) return 0;
    const recoveryKey = `user_${userId}_unprocessed_pending_sms`;
    const existingRaw = localStorage.getItem(recoveryKey);
    if (!existingRaw) return 0;
    try {
      const savedMessages: Array<{ sender: string; body: string; timestamp: number }> = JSON.parse(existingRaw);
      localStorage.removeItem(recoveryKey);
      if (!Array.isArray(savedMessages) || savedMessages.length === 0) return 0;

      let processedCount = 0;
      for (const msg of savedMessages) {
        const res = this.processSms(msg.body, msg.sender, msg.timestamp, false);
        if (res.status === 'logged') processedCount++;
      }
      return processedCount;
    } catch {
      localStorage.removeItem(recoveryKey);
      return 0;
    }
  }

  /**
   * Syncs messages that were queued by SmsReceiver while the app was backgrounded or terminated
   */
  public async syncPendingBackgroundMessages(): Promise<number> {
    const isExplicitlyDisabled =
      typeof window !== 'undefined' &&
      localStorage.getItem('lifeos_sms_explicitly_disabled') === 'true';
    if (isExplicitlyDisabled) return 0;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // Hold incoming SMS in native pending inbox while offline to prevent multi-device dirty writes
      return 0;
    }
    if (!(await this.isNativePluginAvailable())) return 0;

    try {
      const res = await SmsTransaction.getPendingSms();
      const rawMessages = res?.messages || [];
      if (rawMessages.length === 0) return 0;

      // Redundancy Prevention: In-memory deduplication of pending queue
      const uniqueMap = new Map<string, { id?: string; sender: string; body: string; timestamp: number }>();
      for (const msg of rawMessages) {
        const dedupeKey = `${(msg.sender || '').toUpperCase()}:${(msg.body || '').trim()}`;
        if (!uniqueMap.has(dedupeKey)) {
          uniqueMap.set(dedupeKey, msg);
        }
      }
      const messages = Array.from(uniqueMap.values());

      let loggedCount = 0;
      const ackIds: string[] = [];
      const ackHashes: string[] = [];

      for (const msg of messages) {
        const hash = `${(msg.sender || '').toUpperCase()}:${(msg.body || '').trim()}`.toLowerCase();
        const result = this.processSms(msg.body, msg.sender, msg.timestamp, false);
        if (result.status === 'logged') {
          loggedCount++;
          if (msg.id) ackIds.push(msg.id);
          ackHashes.push(hash);
        } else if (result.status === 'duplicate_skipped' || result.status === 'ignored_not_financial') {
          // Acknowledge duplicates and non-financial messages so they are not repeatedly processed
          if (msg.id) ackIds.push(msg.id);
          ackHashes.push(hash);
        } else if (result.status === 'storage_failed') {
          // Withhold ACK from native queue so message remains safe for retry
          logDeviceDiagnostic('warn', 'LifeOS_SMS:PENDING_ACK_WITHHELD', 'Withheld ACK for pending SMS due to storage verification failure; will retry on next cycle', {
            msgId: msg.id,
            reason: result.reason,
          });
        }
      }

      // Safely acknowledge processed messages from the native queue
      if (ackIds.length > 0 || ackHashes.length > 0) {
        try {
          await SmsTransaction.acknowledgePendingSms({ ids: ackIds, hashes: ackHashes });
        } catch (ackErr) {
          console.warn('Failed to acknowledge processed SMS in native queue:', ackErr);
        }
      }

      if (loggedCount > 0) {
        const fresh = Storage.getExpenses();
        // Immediately persist merged workspace state to Supabase so background wakeups don't overwrite it
        try {
          await flushAutoSyncImmediately({
            ...Storage.getAllDataPayload(),
            expenses: fresh,
          });
        } catch (syncErr) {
          console.warn('Failed immediate cloud flush after logging pending SMS:', syncErr);
        }
        broadcastDataChanged('expenses', { updatedExpenses: fresh });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('sms_expense_auto_logged', {
              detail: { updatedExpenses: fresh, count: loggedCount },
            })
          );
        }
        toast.info(`📱 Auto-logged ${loggedCount} spending transaction(s) received via SMS`);
      }

      return loggedCount;
    } catch (err) {
      console.warn('Error syncing pending background SMS:', err);
      return 0;
    }
  }

  /**
   * Scans device SMS inbox for recent transaction messages (requires READ_SMS permission)
   */
  public async scanRecentInbox(limit: number = 50): Promise<{
    scanned: number;
    recognized: number;
    transactionsFound: number;
    imported: number;
    logged: number;
    skippedDuplicates: number;
    rejectedNonFinancial: number;
    ignored: number;
  }> {
    const summary = {
      scanned: 0,
      recognized: 0,
      transactionsFound: 0,
      imported: 0,
      logged: 0,
      skippedDuplicates: 0,
      rejectedNonFinancial: 0,
      ignored: 0,
    };

    const isNative = await this.isNativePluginAvailable();
    if (!isNative && typeof (smsPluginWebImpl as any)._inboxMock !== 'function') {
      return summary;
    }

    try {
      const res = await SmsTransaction.readRecentSms({ limit });
      const messages = res?.messages || [];
      summary.scanned = messages.length;

      for (const msg of messages) {
        const result = this.processSms(msg.body, msg.sender, msg.timestamp, false);
        if (result.status === 'logged') {
          summary.recognized++;
          summary.transactionsFound++;
          summary.imported++;
          summary.logged++;
        } else if (result.status === 'duplicate_skipped') {
          summary.recognized++;
          summary.transactionsFound++;
          summary.skippedDuplicates++;
        } else {
          summary.rejectedNonFinancial++;
          summary.ignored++;
        }
      }

      return summary;
    } catch (err) {
      console.warn('Failed to scan recent inbox SMS:', err);
      throw err;
    }
  }

  /**
   * Helper method for testing or simulating inbox scan in non-native environments
   */
  public setInboxReaderForTesting(
    fn:
      | ((opts?: { limit?: number }) => Promise<{
          messages: Array<{ sender: string; body: string; timestamp: number }>;
        }>)
      | null
  ) {
    (smsPluginWebImpl as any)._inboxMock = fn;
  }

  /**
   * Reads up to `count` recent transaction-related SMS messages from the inbox.
   * Filters candidate SMS through financial parser logic and returns sorted newest -> oldest.
   */
  public async getRecentTransactionCandidates(
    count: 10 | 20 | 30 | 50 = 20
  ): Promise<SmsTransactionCandidate[]> {
    let rawMessages: Array<{ sender: string; body: string; timestamp: number }> = [];

    const isNative = await this.isNativePluginAvailable();
    if (isNative) {
      try {
        const permStatus = await this.checkPermission();
        if (permStatus !== 'granted') {
          await this.requestPermission();
        }
        const res = await SmsTransaction.readRecentSms({ limit: count });
        rawMessages = res?.messages || [];
      } catch (err) {
        console.warn('Native readRecentSms failed, attempting retry with permission request:', err);
        try {
          await this.requestPermission();
          const retryRes = await SmsTransaction.readRecentSms({ limit: count });
          rawMessages = retryRes?.messages || [];
        } catch (retryErr) {
          console.error('Retry readRecentSms failed:', retryErr);
        }
      }
    } else if (typeof (smsPluginWebImpl as any)._inboxMock === 'function') {
      const res = await (smsPluginWebImpl as any)._inboxMock({ limit: count });
      rawMessages = res?.messages || [];
    }

    const currentExpenses = Storage.getExpenses();
    const candidates: SmsTransactionCandidate[] = [];
    const seenCandidateKeys = new Set<string>();

    // Filter and extract financial transactions
    for (const msg of rawMessages) {
      if (!msg.body || !msg.body.trim()) continue;
      const parsed = parseSmsTransaction(msg.body, msg.sender, msg.timestamp);
      if (!parsed.isTransaction || parsed.amount <= 0) {
        continue;
      }

      // Deduplicate candidates among themselves (same referenceId or identical amount+payee+date)
      const cleanRef = parsed.referenceId ? parsed.referenceId.trim().toUpperCase() : '';
      // Reference ID is the strongest identity. Without one, use the raw SMS payload
      // plus timestamp so two legitimate same-amount/same-payee transactions are not
      // collapsed into one candidate merely because they happened on the same day.
      const normalizedRaw = msg.body.trim().toLowerCase().replace(/\s+/g, ' ');
      const candidateKey = cleanRef
        ? `ref_${cleanRef}`
        : `raw_${normalizedRaw}_${msg.timestamp}`;

      if (seenCandidateKeys.has(candidateKey)) {
        continue;
      }
      seenCandidateKeys.add(candidateKey);

      // Check if this candidate already matches an existing expense in canonical Storage
      let isExisting = false;
      let existingMatchTitle: string | undefined;

      if (cleanRef) {
        if (Storage.isRefTombstoned(cleanRef)) {
          isExisting = true;
          existingMatchTitle = 'Previously deleted transaction';
        } else {
          const found = currentExpenses.find(
            (e) =>
              (e.smsReferenceId && e.smsReferenceId.trim().toUpperCase() === cleanRef) ||
              (e.referenceId && e.referenceId.trim().toUpperCase() === cleanRef) ||
              (e.notes && e.notes.toUpperCase().includes(cleanRef))
          );
          if (found) {
            isExisting = true;
            existingMatchTitle = found.name;
          } else {
            const matchTrashByRef = Storage.getTrash().find((t) => {
              if (t.module && t.module !== 'expenses') return false;
              const d: any = t.data;
              return (
                (d?.smsReferenceId && String(d.smsReferenceId).trim().toUpperCase() === cleanRef) ||
                (d?.referenceId && String(d.referenceId).trim().toUpperCase() === cleanRef) ||
                (d?.upiReference && String(d.upiReference).trim().toUpperCase() === cleanRef) ||
                (d?.notes && String(d.notes).toUpperCase().includes(cleanRef))
              );
            });
            if (matchTrashByRef) {
              isExisting = true;
              existingMatchTitle = `Deleted: ${matchTrashByRef.label || (matchTrashByRef.data as any)?.name || 'Expense'}`;
            }
          }
        }
      }

      if (!isExisting) {
        const msgBodyTrimmed = msg.body.trim().toLowerCase();
        const matchByRaw = currentExpenses.find(
          (e) => e.rawSmsText && e.rawSmsText.trim().toLowerCase() === msgBodyTrimmed
        );
        if (matchByRaw) {
          isExisting = true;
          existingMatchTitle = matchByRaw.name;
        } else {
          const matchTrashByRaw = Storage.getTrash().find((t) => {
            if (t.module && t.module !== 'expenses') return false;
            const d: any = t.data;
            return d?.rawSmsText && String(d.rawSmsText).trim().toLowerCase() === msgBodyTrimmed;
          });
          if (matchTrashByRaw) {
            isExisting = true;
            existingMatchTitle = `Deleted: ${matchTrashByRaw.label || (matchTrashByRaw.data as any)?.name || 'Expense'}`;
          }
        }
      }

      const candidateId = `cand-${msg.timestamp}-${Math.random().toString(36).substr(2, 6)}`;
      const snippet = msg.body.length > 75 ? msg.body.substring(0, 72) + '...' : msg.body;

      candidates.push({
        id: candidateId,
        rawSms: msg.body,
        sender: msg.sender,
        timestamp: msg.timestamp,
        amount: parsed.amount,
        currency: parsed.currency || '₹',
        payee: parsed.payee || parsed.merchant,
        merchant: parsed.merchant,
        category: parsed.category,
        paymentMethod: parsed.paymentMethod,
        bankName: parsed.bankName || parsed.bank || 'Bank',
        referenceId: parsed.referenceId,
        direction: parsed.type === 'income' ? 'CREDIT' : 'DEBIT',
        date: parsed.date,
        time: parsed.time,
        preview: snippet,
        isExisting,
        existingMatchTitle,
      });

      if (candidates.length >= count) {
        break;
      }
    }

    // Sort newest -> oldest by timestamp
    return candidates.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Logs explicitly user-selected SMS candidates from manual Rescan.
   *
   * ABSOLUTE RULE: USER SELECTION HAS PRIORITY.
   * Never silently discard, remove, or hide user selections.
   * If a candidate already corresponds to an existing transaction, deterministically report
   * it as "already existing" without corrupting existing records.
   * If candidate is new, create canonical ExpenseItem, persist to Storage, verify,
   * push to Supabase, and dispatch UI updates.
   */
  public async logSelectedCandidates(
    selectedCandidates: SmsTransactionCandidate[]
  ): Promise<SmsRescanResult> {
    const result: SmsRescanResult = {
      scanned: selectedCandidates?.length || 0,
      transactionsFound: selectedCandidates?.length || 0,
      selected: selectedCandidates?.length || 0,
      imported: 0,
      alreadyExisting: 0,
      failed: 0,
      failures: [],
      importedExpenses: [],
    };

    if (!selectedCandidates || selectedCandidates.length === 0) {
      return result;
    }

    // IMPORTANT: Manual rescan now uses the exact same canonical transaction
    // pipeline as live SMS, background SMS, and inbox scan. There must be only
    // one writer for SMS-derived expenses; otherwise a manual rescan can bypass
    // the normal duplicate checks and create a second row for the same SMS.
    const selectedKeys = new Set<string>();

    for (const cand of selectedCandidates) {
      const normalizedRaw = (cand.rawSms || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const cleanRef = cand.referenceId ? cand.referenceId.trim().toUpperCase() : '';
      const transactionKey = cleanRef
        ? `ref_${cleanRef}`
        : `raw_${normalizedRaw}_${cand.timestamp}`;

      // Protect the same selection from being submitted twice in one rescan action.
      if (selectedKeys.has(transactionKey)) {
        result.alreadyExisting++;
        continue;
      }
      selectedKeys.add(transactionKey);

      try {
        // processSms reparses the original SMS and performs the canonical:
        // eligibility -> parser -> reference/raw/context dedupe -> Storage write
        // -> persistence verification -> fingerprinting -> audit -> sync -> UI event.
        const processResult = this.processSms(
          cand.rawSms,
          cand.sender,
          cand.timestamp,
          false
        );

        if (processResult.status === 'logged' && processResult.expense) {
          result.imported++;
          result.importedExpenses.push(processResult.expense);
          continue;
        }

        if (processResult.status === 'duplicate_skipped') {
          result.alreadyExisting++;
          logDeviceDiagnostic(
            'info',
            'LifeOS_SMS:RESCAN_ALREADY_EXISTS',
            `Manual rescan item was already present or already processed: ${cand.payee}`,
            {
              candidateId: cand.id,
              payee: cand.payee,
              amount: cand.amount,
              referenceId: cand.referenceId,
              reason: processResult.reason,
            }
          );
          continue;
        }

        result.failed++;
        result.failures.push({
          candidateId: cand.id,
          reason: processResult.reason || 'SMS was not accepted as a financial transaction',
        });
      } catch (err: any) {
        result.failed++;
        result.failures.push({
          candidateId: cand.id,
          reason: err?.message || 'Unexpected error while logging transaction',
        });
      }
    }

    // processSms already dispatches the UI/cloud-sync event for each successful
    // import. Emit one final consolidated event as well so screens that mounted
    // during the rescan receive the complete latest expense list.
    if (result.imported > 0) {
      const freshExpenses = Storage.getExpenses();

      // Synchronize to Supabase Cloud in background
      void flushAutoSyncImmediately({
        ...Storage.getAllDataPayload(),
        expenses: freshExpenses,
      }).then(() => {
        logDeviceDiagnostic('info', 'LifeOS_SMS:RESCAN_CLOUD_SYNC', 'Synchronized imported rescan expenses to Supabase cloud', {
          importedCount: result.imported,
          totalExpenses: freshExpenses.length,
        });
      }).catch((syncErr: any) => {
        logDeviceDiagnostic('warn', 'LifeOS_SMS:RESCAN_CLOUD_SYNC', 'Notice syncing rescan to cloud (stored safely in local storage): ' + (syncErr?.message || syncErr));
      });

      try {
        broadcastDataChanged('expenses', { updatedExpenses: freshExpenses });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('sms_expense_auto_logged', {
              detail: {
                updatedExpenses: freshExpenses,
                count: result.imported,
                source: 'manual_rescan',
              },
            })
          );
        }
      } catch (eventErr) {
        logDeviceDiagnostic('warn', 'LifeOS_SMS:RESCAN_UI_UPDATE', 'Failed to dispatch consolidated rescan UI event', {
          error: eventErr instanceof Error ? eventErr.message : String(eventErr),
        });
      }

      try {
        const settings = Storage.getSettings();
        Sound.complete(settings.soundEnabled);
        nativeService.triggerHaptic('success');
      } catch {}
    }

    return result;
  }

  /**
   * Initialize native SMS listener and background queue listener
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (await this.isNativePluginAvailable()) {
      try {
        // 1. Check native permissions
        const permRes = await SmsTransaction.checkPermissions();
        const hasPermission = permRes.sms === 'granted' || permRes.receiveSms === 'granted';

        // 2. If Android permission is granted, ensure auto-tracking is enabled
        // unless the user explicitly disabled it previously
        const isExplicitlyDisabled =
          typeof window !== 'undefined' &&
          localStorage.getItem('lifeos_sms_explicitly_disabled') === 'true';

        if (hasPermission && !isExplicitlyDisabled) {
          Storage.setSmsAutoTrackingEnabled(true);
          await SmsTransaction.setEnabled({ enabled: true });
        } else {
          // Sync current setting to native SharedPreferences
          await SmsTransaction.setEnabled({ enabled: this.isAutoTrackingEnabled() });
        }

        // 3. Register native real-time incoming SMS event listener
        await this.ensureNativeListenerRegistered();

        // 4. Always sync any background transactions intercepted while app was closed
        if (this.isAutoTrackingEnabled()) {
          await this.syncPendingBackgroundMessages();
        }
      } catch (err) {
        console.warn('Could not initialize native SMS listener:', err);
      }
    }

    // 5. Capacitor Native App Resume & Foreground Listeners
    if (Capacitor.isNativePlatform()) {
      try {
        CapApp.addListener('appStateChange', (state) => {
          if (state.isActive && this.isAutoTrackingEnabled()) {
            void this.syncPendingBackgroundMessages();
          }
        });
        CapApp.addListener('resume', () => {
          if (this.isAutoTrackingEnabled()) {
            void this.syncPendingBackgroundMessages();
          }
        });
      } catch {}
    }

    // 6. Also listen for app resume / visibility change / window focus to flush background SMS
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isAutoTrackingEnabled()) {
          this.syncPendingBackgroundMessages();
        }
      });
      window.addEventListener('focus', () => {
        if (this.isAutoTrackingEnabled()) {
          this.syncPendingBackgroundMessages();
        }
      });
      window.addEventListener('online', () => {
        if (this.isAutoTrackingEnabled()) {
          void this.syncPendingBackgroundMessages();
        }
      });
    }
  }
}

export const smsExpenseService = new SmsExpenseService();
