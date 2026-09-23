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
  requestPermissions(): Promise<{ sms: 'granted' | 'denied' | 'prompt' }>;
  setEnabled(options: { enabled: boolean }): Promise<{ success: boolean; enabled: boolean }>;
  isEnabled(): Promise<{ enabled: boolean }>;
  getPendingSms(): Promise<{ messages: Array<{ sender: string; body: string; timestamp: number }> }>;
  clearPendingSms(): Promise<{ success: boolean }>;
  readRecentSms(options?: { limit?: number }): Promise<{ messages: Array<{ sender: string; body: string; timestamp: number }> }>;
  addListener(
    eventName: 'onSmsReceived',
    listenerFunc: (data: { sender: string; body: string; timestamp: number }) => void
  ): Promise<{ remove: () => void }>;
}

export const SmsTransaction = registerPlugin<SmsTransactionPluginInterface>('SmsTransaction');

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
        return res.sms || 'prompt';
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
        const status = res.sms || 'prompt';
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
    const parsed = parseSmsTransaction(body, sender, timestamp);

    // 1. Not a financial transaction
    if (!parsed.isTransaction) {
      const logItem: SmsTransactionLogItem = {
        id: `sms-log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp,
        sender,
        rawSms: body,
        status: 'ignored_not_financial',
        reason: parsed.ignoreReason || 'Unrelated message (OTP, promotion, or service notice)',
      };
      Storage.addSmsTransactionLog(logItem);

      return {
        success: false,
        status: 'ignored_not_financial',
        reason: logItem.reason,
        parsed,
      };
    }

    // 2. Check for duplicate transaction
    const existingExpenses = Storage.getExpenses();
    const dupCheck = this.checkIsDuplicate(parsed, existingExpenses);

    if (dupCheck.isDuplicate) {
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

    // 3. Construct and auto-log new Expense entry
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

    // Check if auto-tracking is enabled
    const enabled = this.isAutoTrackingEnabled();

    if (await this.isNativePluginAvailable()) {
      try {
        // Register native real-time incoming SMS event listener
        const handle = await SmsTransaction.addListener('onSmsReceived', (data) => {
          if (!this.isAutoTrackingEnabled()) return;
          this.processSms(data.body, data.sender, data.timestamp, true);
        });

        this.removeListenerCallback = () => {
          handle.remove();
        };
        this.isListening = true;

        // If enabled, sync any background transactions intercepted while app was closed
        if (enabled) {
          await this.syncPendingBackgroundMessages();
        }
      } catch (err) {
        console.warn('Could not initialize native SMS listener:', err);
      }
    }

    // Also listen for app resume / visibility change to flush background SMS
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isAutoTrackingEnabled()) {
          this.syncPendingBackgroundMessages();
        }
      });
    }
  }
}

export const smsExpenseService = new SmsExpenseService();
