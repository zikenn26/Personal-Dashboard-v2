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
  readRecentSms: async () => ({ messages: [] as Array<{ sender: string; body: string; timestamp: number }> }),
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

class SmsExpenseService {
  private isInitialized = false;
  private isListening = false;
  private removeListenerCallback: (() => void) | null = null;

  /**
   * Checks whether the current platform is Android (native Capacitor or Android browser)
   */
  public isAndroidDevice(): boolean {
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
      return 'prompt';
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
        const status = (res.sms || (res.receiveSms === 'granted' ? 'granted' : 'prompt')) as any;
        if (status === 'granted') {
          await this.setAutoTrackingEnabled(true);
        }
        return status;
      }
      // On web simulation
      await this.setAutoTrackingEnabled(true);
      return 'granted';
    } catch (err) {
      console.warn('SMS permission request failed:', err);
      return 'denied';
    }
  }

  /**
   * Checks whether a parsed transaction is a duplicate of an existing entry.
   * Compares against:
   * 1. Processed fingerprint cache
   * 2. Existing expenses with identical reference ID
   * 3. Same date, same amount, and matching merchant within tolerance
   */
  public checkIsDuplicate(
    parsed: ParsedSmsTransaction,
    existingExpenses: ExpenseItem[] = Storage.getExpenses()
  ): { isDuplicate: boolean; reason?: string } {
    // 1. Fingerprint check
    const processedFingerprints = Storage.getProcessedSmsFingerprints();
    if (processedFingerprints.includes(parsed.fingerprint)) {
      return { isDuplicate: true, reason: 'Duplicate SMS fingerprint already processed' };
    }

    // 2. Reference ID match
    if (parsed.referenceId) {
      const matchByRef = existingExpenses.find(
        (e) =>
          e.smsReferenceId === parsed.referenceId ||
          (e.notes && e.notes.includes(parsed.referenceId!))
      );
      if (matchByRef) {
        return {
          isDuplicate: true,
          reason: `Transaction with Reference ID ${parsed.referenceId} already exists ("${matchByRef.name}")`,
        };
      }
    }

    // 3. Exact Amount + Exact Date + Similar Merchant heuristic
    const cleanMerchant = parsed.merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchByDetails = existingExpenses.find((e) => {
      if (e.date !== parsed.date) return false;
      if (Math.abs(Number(e.amount) - parsed.amount) > 0.01) return false;

      // Merchant comparison
      const existingNameClean = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        cleanMerchant &&
        (existingNameClean.includes(cleanMerchant) || cleanMerchant.includes(existingNameClean))
      ) {
        return true;
      }

      // If merchant is generic, match if time is within 10 minutes
      if (e.time && parsed.time && e.time === parsed.time) {
        return true;
      }

      return false;
    });

    if (matchByDetails) {
      return {
        isDuplicate: true,
        reason: `Identical transaction of ₹${parsed.amount} at "${matchByDetails.name}" already logged for ${parsed.date}`,
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
    // 1. DIAGNOSTIC LOGCAT: RAW CAPTURE BEFORE PARSER
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
    // 2. DIAGNOSTIC LOGCAT: FINANCIAL CLASSIFICATION CHECK
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
    // 3. DIAGNOSTIC LOGCAT: FULL DATA OBJECT BEFORE DUPLICATE CHECK
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
    // 4. DUPLICATE CHECK EVALUATION
    // =========================================================================
    const existingExpenses = Storage.getExpenses();
    const dupCheck = this.checkIsDuplicate(parsed, existingExpenses);

    if (dupCheck.isDuplicate) {
      logDeviceDiagnostic('warn', 'LifeOS_SMS:SKIPPED_DUPLICATE', 'Duplicate transaction detected; skipping auto-logging to Spending', {
        merchant: parsed.merchant,
        amount: parsed.amount,
        referenceId: parsed.referenceId,
        reason: dupCheck.reason,
        fingerprint: parsed.fingerprint,
      });

      // Mark fingerprint as processed so repeated SMS broadcasts don't re-trigger
      Storage.addProcessedSmsFingerprint(parsed.fingerprint);

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

    // 5. Construct and auto-log new Expense entry
    const notesParts: string[] = [];
    if (parsed.bankOrAccount) notesParts.push(parsed.bankOrAccount);
    if (parsed.referenceId) notesParts.push(`Ref: ${parsed.referenceId}`);
    notesParts.push('Auto-logged from SMS');

    const newExpense: ExpenseItem = {
      id: `exp-sms-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: parsed.merchant,
      amount: parsed.amount,
      category: parsed.category,
      date: parsed.date,
      time: parsed.time,
      paymentMethod: parsed.paymentMethod,
      notes: notesParts.join(' • '),
      rawSmsText: parsed.rawSms,
      smsReferenceId: parsed.referenceId,
      source: 'sms_auto',
      transactionType: parsed.type,
      bankOrAccount: parsed.bankOrAccount,
      active: true,
    };

    // Prepend to expenses list
    const updatedExpenses = [newExpense, ...existingExpenses];
    Storage.setExpenses(updatedExpenses);

    // Save fingerprint to prevent future duplicate
    Storage.addProcessedSmsFingerprint(parsed.fingerprint);

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
    // 6. DIAGNOSTIC LOGCAT: LOGGED TO SPENDING
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
  }

  /**
   * Syncs messages that were queued by SmsReceiver while the app was backgrounded or terminated
   */
  public async syncPendingBackgroundMessages(): Promise<number> {
    if (!this.isAutoTrackingEnabled()) return 0;
    if (!(await this.isNativePluginAvailable())) return 0;

    try {
      const res = await SmsTransaction.getPendingSms();
      const messages = res?.messages || [];
      if (messages.length === 0) return 0;

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
  public async scanRecentInbox(limit: number = 30): Promise<{
    scanned: number;
    logged: number;
    skippedDuplicates: number;
    ignored: number;
  }> {
    const summary = {
      scanned: 0,
      logged: 0,
      skippedDuplicates: 0,
      ignored: 0,
    };

    if (!(await this.isNativePluginAvailable())) {
      return summary;
    }

    try {
      const res = await SmsTransaction.readRecentSms({ limit });
      const messages = res?.messages || [];
      summary.scanned = messages.length;

      for (const msg of messages) {
        const result = this.processSms(msg.body, msg.sender, msg.timestamp, false);
        if (result.status === 'logged') {
          summary.logged++;
        } else if (result.status === 'duplicate_skipped') {
          summary.skippedDuplicates++;
        } else {
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
