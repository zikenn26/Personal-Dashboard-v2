import { registerPlugin, Capacitor } from '@capacitor/core';
import { ExpenseItem, ParsedSmsTransaction, SmsTransactionLogItem } from '../types';
import { Storage } from '../utils/storage';
import { broadcastDataChanged } from './commandMappingService';
import { nativeService } from './nativeService';
import { Sound } from '../utils/audio';
import { parseSmsTransaction } from './smsParser';
import { toast } from 'sonner';

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

  // Known bank / financial service keywords
  const bankKeywords = [
    'ICICI', 'HDFC', 'SBI', 'AXIS', 'KOTAK', 'PNB', 'CANARA', 'CANBNK',
    'BOB', 'BARODA', 'UNION', 'INDUS', 'FEDERAL', 'FEDBNK', 'IDFC',
    'YESB', 'PAYTM', 'GPAY', 'PHONEPE', 'BHIM', 'UPI', 'AIRTEL', 'AMEX',
    'CITI', 'STANDARD', 'SCB', 'RBL', 'IDBI', 'BANDHAN', 'AUBANK', 'IOB',
    'CENTRAL', 'UCO', 'INDIANB', 'MAHABANK', 'POSTBK', 'IPPB'
  ];
  if (bankKeywords.some((kw) => clean.includes(kw))) {
    return true;
  }

  // Accept standard 2-letter operator prefix + hyphen + alphanumeric sender ID format (e.g. AD-ICICIB, BZ-SBIINB)
  if (/^[A-Z]{2}-[A-Z0-9]{5,8}$/.test(clean)) {
    return true;
  }

  return false;
}

export const isBankOrFinancialSender = isTraiServiceSender;

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
    if (!Capacitor.isNativePlatform() || !this.isAndroidDevice()) {
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
    // 0. TRAI SERVICE SENDER FILTER (TRAI Regulation Check)
    // =========================================================================
    // Target only SMS whose sender/header is a legitimate banking / transaction service sender.
    if (!isTraiServiceSender(sender)) {
      const skipReason = `SMS ignored: Sender title "${sender || '(empty)'}" is not an authorized banking or transactional service sender. Rejected before parsing/storage.`;
      logDeviceDiagnostic('warn', 'LifeOS_SMS:SKIPPED_NOT_TRAI_SERVICE', skipReason, {
        sender: sender || '(unknown)',
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
      // 2. DIAGNOSTIC LOGCAT: RAW CAPTURE BEFORE PARSER
      // =========================================================================
      logDeviceDiagnostic('info', 'LifeOS_SMS:RAW_PAYLOAD', 'Incoming SMS captured before parser', {
        sender: sender || '(unknown)',
        timestampISO: new Date(timestamp).toISOString(),
        timestampMs: timestamp,
        rawBodyLength: body ? body.length : 0,
        sanitizedContent: sanitizedBody,
        isAutoTrackingEnabled: this.isAutoTrackingEnabled(),
        platform: Capacitor.getPlatform(),
      });

      // Execute semantic extraction
      const parsed = parseSmsTransaction(body, sender, timestamp);

      // =========================================================================
      // 3. DIAGNOSTIC LOGCAT: FINANCIAL CLASSIFICATION CHECK
      // =========================================================================
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
      // 4. DIAGNOSTIC LOGCAT: FULL DATA OBJECT BEFORE DUPLICATE CHECK
      // =========================================================================
      const preDuplicateDataObject = {
        amount: parsed.amount,
        currency: parsed.currency || 'INR',
        type: parsed.type,
        merchant: parsed.merchant,
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
        'LifeOS_SMS:FINANCIAL_IDENTIFIED',
        'SMS identified as financial transaction (Pre-Duplicate Check Data Object)',
        preDuplicateDataObject
      );

      // =========================================================================
      // 5. DUPLICATE CHECK EVALUATION (Redundancy Prevention)
      // =========================================================================
      const existingExpenses = Storage.getExpenses();
      const dupCheck = this.checkIsDuplicate(parsed, existingExpenses, body);

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

      // 6. Construct and auto-log new Expense entry
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

      // Prepend to expenses list
      const updatedExpenses = [newExpense, ...existingExpenses];
      Storage.setExpenses(updatedExpenses);

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
      // 7. DIAGNOSTIC LOGCAT: LOGGED TO SPENDING
      // =========================================================================
      logDeviceDiagnostic('info', 'LifeOS_SMS:LOGGED_TO_SPENDING', `Transaction auto-logged to Spending: ${newExpense.name} (₹${newExpense.amount})`, {
        expenseId: newExpense.id,
        merchant: newExpense.name,
        amount: newExpense.amount,
        category: newExpense.category,
        paymentMethod: newExpense.paymentMethod,
        referenceId: newExpense.smsReferenceId,
        date: newExpense.date,
        time: newExpense.time,
        bankOrAccount: newExpense.bankOrAccount,
      });

      // Dispatch system events so dashboard views update immediately
      broadcastDataChanged('expenses', { newExpense });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sms_expense_auto_logged', {
            detail: { expense: newExpense, parsed },
          })
        );
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
    }
  }

  /**
   * Syncs messages that were queued by SmsReceiver while the app was backgrounded or terminated
   */
  public async syncPendingBackgroundMessages(): Promise<number> {
    if (!this.isAutoTrackingEnabled()) return 0;
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

    // 5. Also listen for app resume / visibility change / window focus to flush background SMS
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
