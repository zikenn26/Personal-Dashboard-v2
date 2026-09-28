import { registerPlugin, Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { ExpenseItem, ParsedSmsTransaction, SmsTransactionLogItem } from '../types';
import { Storage } from '../utils/storage';
import { broadcastDataChanged } from './commandMappingService';
import { nativeService } from './nativeService';
import { Sound } from '../utils/audio';
import { parseSmsTransaction } from './smsParser';
import { scheduleAutoSyncToSupabase, getCustomWorkspaceIdentifier } from '../utils/supabase';
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
  getPendingSms(): Promise<{ messages: Array<{ sender: string; body: string; timestamp: number }> }>;
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
  getPendingSms: async () => ({ messages: [] as Array<{ sender: string; body: string; timestamp: number }> }),
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
    'ICICI', 'HDFC', 'SBI', 'AXIS', 'KOTAK', 'PNB', 'CANARA', 'CANBNK',
    'BOB', 'BARODA', 'UNION', 'INDUS', 'FEDERAL', 'FEDBNK', 'IDFC',
    'YES', 'YESB', 'YESBANK', 'PAYTM', 'GPAY', 'PHONEPE', 'BHIM', 'UPI', 'AIRTEL', 'AMEX',
    'CITI', 'STANDARD', 'SCB', 'RBL', 'IDBI', 'BANDHAN', 'AUBANK', 'IOB',
    'CENTRAL', 'UCO', 'INDIANB', 'MAHABANK', 'MAHABK', 'POSTBK', 'IPPB',
    'BOI', 'BANKOFINDIA', 'DBS', 'HSBC', 'J&K', 'JKBANK', 'KVB', 'KARUR',
    'SIB', 'SOUTHINDBK', 'CSB', 'UJJIVAN', 'EQUITAS', 'FINCARE', 'ESAF',
    'SURYODAY', 'CRED', 'SLICE', 'JUPITER', 'FI'
  ];
  if (bankKeywords.some((kw) => clean.includes(kw))) {
    return true;
  }

  return false;
}

export const isBankOrFinancialSender = isTraiServiceSender;/**
 * Fast, comprehensive local heuristic to identify financial transaction SMS
 * (debits, credits, UPI, cards, bank alerts) while rejecting OTPs, loans, and promotional spam.
 * Fully aligned with native SmsReceiver.java heuristic.
 */
export function isLikelyFinancialSms(sender: string, body: string): boolean {
  if (!body || !body.trim()) return false;
  const lower = body.toLowerCase();

  // 1. Strict OTP & Authentication rejection
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
    return false;
  }

  if (
    lower.includes('verification code') ||
    lower.includes('security code') ||
    lower.includes('is your one time password')
  ) {
    return false;
  }

  // 2. Reject promotional / marketing loans & schemes
  if (
    lower.includes('pre-approved loan') ||
    lower.includes('apply for instant loan') ||
    lower.includes('personal loan up to') ||
    lower.includes('click here to claim') ||
    lower.includes('congratulations! you won') ||
    lower.includes('apply for credit card')
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

  return hasTxnVerb;
}

class SmsExpenseService {
  private isInitialized = false;
  private isListening = false;
  private removeListenerCallback: (() => void) | null = null;
  private inFlightFingerprints = new Set<string>();

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
   * Returns current user preference for auto-tracking
   */
  public isAutoTrackingEnabled(): boolean {
    return Storage.isSmsAutoTrackingEnabled();
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
      const refKey = `ref_id_${cleanRef}`;

      // Check if this exact Reference ID was already processed in fingerprint history
      if (processedFingerprints.includes(refKey)) {
        return {
          isDuplicate: true,
          reason: `Duplicate: Transaction with Reference ID ${parsed.referenceId} already processed`,
        };
      }

      // Check if an existing Spending entry already has this exact Reference ID
      const matchByRef = existingExpenses.find(
        (e) =>
          (e.smsReferenceId && e.smsReferenceId.trim().toUpperCase() === cleanRef) ||
          (e.notes && e.notes.toUpperCase().includes(cleanRef))
      );
      if (matchByRef) {
        return {
          isDuplicate: true,
          reason: `Duplicate: Transaction with Reference ID ${parsed.referenceId} already exists ("${matchByRef.name}")`,
        };
      }

      // Protection against true duplicate SMS broadcasts, retries, and queue reprocessing:
      // If the raw text is 100% identical to a prior delivery
      if (rawBody && rawBody.trim()) {
        const rawHash = `raw_sms_${rawBody.trim().toLowerCase().replace(/\s+/g, ' ')}`;
        if (processedFingerprints.includes(rawHash)) {
          return { isDuplicate: true, reason: 'Duplicate: Identical raw SMS payload already processed' };
        }

        const matchByRawText = existingExpenses.find(
          (e) => e.rawSmsText && e.rawSmsText.trim().toLowerCase() === rawBody.trim().toLowerCase()
        );
        if (matchByRawText) {
          return { isDuplicate: true, reason: 'Duplicate: Identical raw SMS text already logged in Spending' };
        }
      }

      // Also check exact deterministic fingerprint (which incorporates the clean reference ID)
      if (parsed.fingerprint && processedFingerprints.includes(parsed.fingerprint)) {
        return { isDuplicate: true, reason: 'Duplicate: Exact SMS fingerprint already processed' };
      }

      // CRITICAL REQUIREMENT:
      // If two SMS have different transaction/reference IDs, always create separate Spending entries,
      // even if they are from the same bank, same account, same merchant, and within five minutes.
      // Since this transaction has a valid, non-duplicate reference ID, IT IS A GENUINE SEPARATE TRANSACTION.
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
      const rawHash = `raw_sms_${rawBody.trim().toLowerCase().replace(/\s+/g, ' ')}`;
      if (processedFingerprints.includes(rawHash)) {
        return { isDuplicate: true, reason: 'Duplicate: Identical raw SMS payload already processed' };
      }

      const matchByRawText = existingExpenses.find(
        (e) => e.rawSmsText && e.rawSmsText.trim().toLowerCase() === rawBody.trim().toLowerCase()
      );
      if (matchByRawText) {
        return { isDuplicate: true, reason: 'Duplicate: Identical raw SMS text already logged in Spending' };
      }
    }

    if (parsed.fingerprint && processedFingerprints.includes(parsed.fingerprint)) {
      return { isDuplicate: true, reason: 'Duplicate: Duplicate SMS fingerprint already processed' };
    }

    // B. Composite fingerprint check: (bank + amount + timestamp + payee + message hash)
    const cleanPayee = (parsed.payee || parsed.merchant || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanBank = (parsed.bankName || parsed.bankOrAccount || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const compositeKey = `composite_${cleanBank}_${parsed.amount.toFixed(2)}_${parsed.date}_${cleanPayee}_${parsed.time || ''}`;
    if (processedFingerprints.includes(compositeKey)) {
      return { isDuplicate: true, reason: 'Duplicate: Matching composite transaction fingerprint already processed' };
    }

    // C. Contextual matching: strictly fallback when NO reference ID exists.
    // Must match: exact same amount, same date, same payee/merchant, within 3 minutes.
    const matchByDetails = existingExpenses.find((e) => {
      // Different amounts to the same payee are NEVER duplicates:
      if (Math.abs(Number(e.amount) - parsed.amount) > 0.01) return false;

      // Must match exact date
      if (e.date !== parsed.date) return false;

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
    status: 'logged' | 'duplicate_skipped' | 'ignored_not_financial';
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
      // CHECKPOINT 5 — STORAGE MUTATION RESULT
      // =========================================================================
      const notesParts: string[] = [];
      if (parsed.bankOrAccount) notesParts.push(parsed.bankOrAccount);
      if (parsed.referenceId) notesParts.push(`Ref: ${parsed.referenceId}`);
      notesParts.push('Auto-logged from SMS');

      const newExpense: ExpenseItem = {
        id: `exp-sms-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
      };

      // Mutate storage using canonical Storage.addExpense
      const updatedExpenses = Storage.addExpense(newExpense);

      logDeviceDiagnostic('info', 'LifeOS_SMS:5_STORAGE_MUTATION_RESULT LifeOS_SMS:LOGGED_TO_SPENDING', `ExpenseItem committed to Storage: ${newExpense.name} (₹${newExpense.amount})`, {
        expenseId: newExpense.id,
        direction: newExpense.direction,
        referenceId: newExpense.referenceId,
        totalExpensesNow: updatedExpenses.length,
      });

      // =========================================================================
      // CHECKPOINT 6 — LOCAL PERSISTENCE VERIFICATION
      // =========================================================================
      const verifiedExpenses = Storage.getExpenses();
      const isPersisted = verifiedExpenses.some((e) => e.id === newExpense.id);

      if (!isPersisted) {
        const errorReason = `Storage verification failed: Expense ${newExpense.id} was not present in Storage.getExpenses() immediately after write!`;
        logDeviceDiagnostic('error', 'LifeOS_SMS:6_LOCAL_PERSISTENCE_RESULT', errorReason, {
          expenseId: newExpense.id,
          expectedCount: updatedExpenses.length,
          actualCount: verifiedExpenses.length,
        });
        return {
          success: false,
          status: 'ignored_not_financial',
          reason: errorReason,
          expense: newExpense,
          parsed,
        };
      }

      logDeviceDiagnostic('info', 'LifeOS_SMS:6_LOCAL_PERSISTENCE_RESULT', 'Verified persistent storage insertion successfully', {
        expenseId: newExpense.id,
        verifiedCount: verifiedExpenses.length,
      });

      // Save multi-vector fingerprints to prevent any future duplicate
      Storage.addProcessedSmsFingerprint(parsed.fingerprint);
      Storage.addProcessedSmsFingerprint(`raw_sms_${body.trim().toLowerCase().replace(/\s+/g, ' ')}`);
      if (parsed.referenceId) {
        Storage.addProcessedSmsFingerprint(`ref_id_${parsed.referenceId.trim().toUpperCase()}`);
      }
      const cleanPayee = (parsed.payee || parsed.merchant || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanBank = (parsed.bankName || parsed.bankOrAccount || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      Storage.addProcessedSmsFingerprint(`composite_${cleanBank}_${parsed.amount.toFixed(2)}_${parsed.date}_${cleanPayee}_${parsed.time || ''}`);

      // Record audit log
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
      // CHECKPOINT 7 — CLOUD SYNC RESULT
      // =========================================================================
      try {
        scheduleAutoSyncToSupabase(() => Storage.getAllDataPayload(), 150);
        logDeviceDiagnostic('info', 'LifeOS_SMS:7_SYNC_RESULT', 'Scheduled cloud workspace sync with new transaction', {
          workspace: getCustomWorkspaceIdentifier(),
          expenseId: newExpense.id,
        });
      } catch (syncErr: any) {
        logDeviceDiagnostic('warn', 'LifeOS_SMS:7_SYNC_RESULT', 'Sync schedule notice (offline or local workspace): ' + (syncErr?.message || syncErr));
      }

      // =========================================================================
      // CHECKPOINT 8 — SPENDING REFRESH / STATE UPDATE
      // =========================================================================
      // Dispatch system events with explicit updatedExpenses array so all dashboard views update in real time
      broadcastDataChanged('expenses', { newExpense, updatedExpenses: verifiedExpenses });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sms_expense_auto_logged', {
            detail: { expense: newExpense, parsed, updatedExpenses: verifiedExpenses },
          })
        );
      }

      logDeviceDiagnostic('info', 'LifeOS_SMS:8_SPENDING_REFRESH_STATE_UPDATE', 'Dispatched real-time Spending UI update events', {
        expenseId: newExpense.id,
        title: newExpense.name,
        amount: newExpense.amount,
      });

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
    if (!(await this.isNativePluginAvailable())) return 0;

    try {
      const res = await SmsTransaction.getPendingSms();
      const rawMessages = res?.messages || [];
      if (rawMessages.length === 0) return 0;

      // Clear pending queue in native layer immediately to avoid re-syncing in concurrent passes
      await SmsTransaction.clearPendingSms();

      // Redundancy Prevention: In-memory deduplication of pending queue
      const uniqueMap = new Map<string, { sender: string; body: string; timestamp: number }>();
      for (const msg of rawMessages) {
        const dedupeKey = `${(msg.sender || '').toUpperCase()}:${(msg.body || '').trim()}`;
        if (!uniqueMap.has(dedupeKey)) {
          uniqueMap.set(dedupeKey, msg);
        }
      }
      const messages = Array.from(uniqueMap.values());

      let loggedCount = 0;
      for (const msg of messages) {
        const result = this.processSms(msg.body, msg.sender, msg.timestamp, false);
        if (result.status === 'logged') {
          loggedCount++;
        }
      }

      if (loggedCount > 0) {
        const fresh = Storage.getExpenses();
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
        const res = await SmsTransaction.readRecentSms({ limit: count });
        rawMessages = res?.messages || [];
      } catch (err) {
        console.warn('Native readRecentSms failed:', err);
      }
    } else if (typeof (smsPluginWebImpl as any)._inboxMock === 'function') {
      const res = await (smsPluginWebImpl as any)._inboxMock({ limit: count });
      rawMessages = res?.messages || [];
    }

    const currentExpenses = Storage.getExpenses();
    const candidates: SmsTransactionCandidate[] = [];

    // Filter and extract financial transactions
    for (const msg of rawMessages) {
      if (!msg.body || !msg.body.trim()) continue;
      const parsed = parseSmsTransaction(msg.body, msg.sender, msg.timestamp);
      if (!parsed.isTransaction || parsed.amount <= 0) {
        continue;
      }

      // Check if this candidate already matches an existing expense in canonical Storage
      const cleanRef = parsed.referenceId ? parsed.referenceId.trim().toUpperCase() : '';
      let isExisting = false;
      let existingMatchTitle: string | undefined;

      if (cleanRef) {
        const found = currentExpenses.find(
          (e) =>
            (e.smsReferenceId && e.smsReferenceId.trim().toUpperCase() === cleanRef) ||
            (e.referenceId && e.referenceId.trim().toUpperCase() === cleanRef) ||
            (e.notes && e.notes.toUpperCase().includes(cleanRef))
        );
        if (found) {
          isExisting = true;
          existingMatchTitle = found.name;
        }
      }

      if (!isExisting) {
        const matchByRaw = currentExpenses.find(
          (e) => e.rawSmsText && e.rawSmsText.trim().toLowerCase() === msg.body.trim().toLowerCase()
        );
        if (matchByRaw) {
          isExisting = true;
          existingMatchTitle = matchByRaw.name;
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
      scanned: selectedCandidates.length,
      transactionsFound: selectedCandidates.length,
      selected: selectedCandidates.length,
      imported: 0,
      alreadyExisting: 0,
      failed: 0,
      failures: [],
      importedExpenses: [],
    };

    if (!selectedCandidates || selectedCandidates.length === 0) {
      return result;
    }

    for (const cand of selectedCandidates) {
      try {
        const currentExpenses = Storage.getExpenses();
        const cleanRef = cand.referenceId ? cand.referenceId.trim().toUpperCase() : '';

        // Deterministic check against existing transactions
        let isAlreadyExisting = false;
        let existingItem: ExpenseItem | undefined;

        if (cleanRef) {
          existingItem = currentExpenses.find(
            (e) =>
              (e.smsReferenceId && e.smsReferenceId.trim().toUpperCase() === cleanRef) ||
              (e.referenceId && e.referenceId.trim().toUpperCase() === cleanRef) ||
              (e.notes && e.notes.toUpperCase().includes(cleanRef))
          );
          if (existingItem) {
            isAlreadyExisting = true;
          }
        }

        if (!isAlreadyExisting) {
          existingItem = currentExpenses.find(
            (e) => e.rawSmsText && e.rawSmsText.trim().toLowerCase() === cand.rawSms.trim().toLowerCase()
          );
          if (existingItem) {
            isAlreadyExisting = true;
          }
        }

        if (isAlreadyExisting && existingItem) {
          result.alreadyExisting++;
          logDeviceDiagnostic('info', 'LifeOS_SMS:RESCAN_ALREADY_EXISTS', `Manual rescan item already existing in Spending: ${existingItem.name}`, {
            candidateId: cand.id,
            matchedExpenseId: existingItem.id,
            payee: cand.payee,
            amount: cand.amount,
            referenceId: cand.referenceId,
          });
          continue;
        }

        // New transaction: construct canonical ExpenseItem
        const notesParts: string[] = [];
        if (cand.bankName) notesParts.push(cand.bankName);
        if (cand.referenceId) notesParts.push(`Ref: ${cand.referenceId}`);
        notesParts.push('Imported via SMS Rescan');

        const newExpense: ExpenseItem = {
          id: `exp-sms-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: cand.payee || cand.merchant,
          amount: cand.amount,
          category: (cand.category as any) || 'Other',
          date: cand.date,
          time: cand.time,
          paymentMethod: cand.paymentMethod as any,
          notes: notesParts.join(' • '),
          rawSmsText: cand.rawSms,
          smsReferenceId: cand.referenceId,
          referenceId: cand.referenceId,
          upiReference: cand.paymentMethod === 'UPI' ? cand.referenceId : undefined,
          source: 'sms_auto',
          direction: cand.direction,
          transactionType: cand.direction,
          bankName: cand.bankName,
          merchant: cand.merchant,
          payee: cand.payee,
          active: true,
        };

        // Mutate storage using canonical Storage.addExpense
        Storage.addExpense(newExpense);

        // Verification of persistence
        const reloaded = Storage.getExpenses();
        const isVerified = reloaded.some((e) => e.id === newExpense.id);

        if (!isVerified) {
          result.failed++;
          result.failures.push({
            candidateId: cand.id,
            reason: `Storage verification failed: could not confirm persistence of ${cand.payee} (₹${cand.amount})`,
          });
          continue;
        }

        // Register fingerprints
        if (cand.referenceId) {
          Storage.addProcessedSmsFingerprint(`ref_id_${cand.referenceId.trim().toUpperCase()}`);
        }
        Storage.addProcessedSmsFingerprint(`raw_sms_${cand.rawSms.trim().toLowerCase().replace(/\s+/g, ' ')}`);

        result.imported++;
        result.importedExpenses.push(newExpense);

        // Audit log
        const logItem: SmsTransactionLogItem = {
          id: `sms-log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp: cand.timestamp,
          sender: cand.sender,
          rawSms: cand.rawSms,
          status: 'logged',
          expenseId: newExpense.id,
          parsed: {
            amount: cand.amount,
            merchant: cand.merchant,
            category: cand.category,
            type: cand.direction === 'CREDIT' ? 'income' : 'expense',
            date: cand.date,
            referenceId: cand.referenceId,
          },
        };
        Storage.addSmsTransactionLog(logItem);

        logDeviceDiagnostic('info', 'LifeOS_SMS:RESCAN_IMPORTED', `Manual Rescan logged: ${newExpense.name} (₹${newExpense.amount})`, {
          expenseId: newExpense.id,
          referenceId: newExpense.referenceId,
        });
      } catch (err: any) {
        result.failed++;
        result.failures.push({
          candidateId: cand.id,
          reason: err?.message || 'Unexpected error while logging transaction',
        });
      }
    }

    if (result.imported > 0) {
      // Re-sync to cloud workspace
      try {
        scheduleAutoSyncToSupabase(() => Storage.getAllDataPayload(), 150);
      } catch {}

      // Dispatch UI update events
      const freshExpenses = Storage.getExpenses();
      broadcastDataChanged('expenses', { updatedExpenses: freshExpenses });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sms_expense_auto_logged', {
            detail: { updatedExpenses: freshExpenses, count: result.imported },
          })
        );
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
        const handle = await SmsTransaction.addListener('onSmsReceived', (data) => {
          if (!this.isAutoTrackingEnabled()) return;
          this.processSms(data.body, data.sender, data.timestamp, true);
        });

        this.removeListenerCallback = () => {
          handle.remove();
        };
        this.isListening = true;

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
    }
  }
}

export const smsExpenseService = new SmsExpenseService();
