import { ExpenseItem, ExpenseSyncStatus, OutboxMutation } from '../types';
import { expenseRepo } from '../repositories/expenseRepository';
import {
  isSupabaseConfigured,
  getSupabaseClient,
  fetchWorkspaceFromSupabase,
  syncWorkspaceToSupabase,
  isWorkOfflineMode,
  getCustomWorkspaceIdentifier,
} from '../utils/supabase';
import { mergeExpenseLists } from '../utils/expenseUtils';
import { Storage } from '../utils/storage';
import { Capacitor } from '@capacitor/core';

export interface SyncExpensesResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  pendingCount: number;
  message: string;
  error?: string;
}

type SyncStatusListener = (status: ExpenseSyncStatus) => void;

class ExpenseSyncService {
  private currentStatus: ExpenseSyncStatus = {
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: Date.now(),
    lastError: null,
  };
  private listeners: Set<SyncStatusListener> = new Set();
  private isSyncing = false;
  private syncDebounceTimer: any = null;
  private isInitialized = false;

  constructor() {
    this.initLifecycle();
  }

  private initLifecycle() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    // Listen to online events
    window.addEventListener('online', () => {
      console.info('[EXPENSE_SYNC] Device came online, auto-syncing pending outbox...');
      void this.syncExpenses({ background: true });
    });

    window.addEventListener('focus', () => {
      if (document.visibilityState === 'visible') {
        void this.syncExpenses({ background: true });
      }
    });

    // Listen to offline mode toggle changes
    window.addEventListener('work-offline-toggled', () => {
      this.updateStatus({
        state: isWorkOfflineMode() ? 'offline' : (this.currentStatus.pendingCount > 0 ? 'pending' : 'synced'),
      });
    });
  }

  public getExpenseSyncStatus(): ExpenseSyncStatus {
    return { ...this.currentStatus };
  }

  public onSyncStatusChange(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getExpenseSyncStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateStatus(newPartial: Partial<ExpenseSyncStatus>) {
    this.currentStatus = {
      ...this.currentStatus,
      ...newPartial,
    };
    void expenseRepo.setSyncStatus(this.currentStatus);

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(this.getExpenseSyncStatus());
      } catch (err) {
        console.warn('[EXPENSE_SYNC] Error in status listener:', err);
      }
    });

    // Broadcast DOM event for reactive components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('expense-sync-status-changed', {
          detail: this.getExpenseSyncStatus(),
        })
      );
    }
  }

  public notifyMutationEnqueued(pendingCount: number) {
    this.updateStatus({
      state: isWorkOfflineMode() ? 'offline' : 'pending',
      pendingCount,
    });
    this.scheduleAutoSync(800);
  }

  public scheduleAutoSync(delayMs = 800) {
    if (isWorkOfflineMode()) return;
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      void this.syncExpenses({ background: true });
    }, delayMs);
  }

  /**
   * Main sync routine: Local-first outbox push followed by safe incremental cloud reconciliation
   */
  public async syncExpenses(options: { manual?: boolean; background?: boolean } = {}): Promise<SyncExpensesResult> {
    const isManual = Boolean(options.manual);

    if (isWorkOfflineMode()) {
      const outbox = await expenseRepo.getPendingOutbox();
      this.updateStatus({
        state: 'offline',
        pendingCount: outbox.length,
      });
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        pendingCount: outbox.length,
        message: 'Work Offline is enabled. Network cloud sync is paused.',
      };
    }

    if (!isSupabaseConfigured()) {
      const outbox = await expenseRepo.getPendingOutbox();
      this.updateStatus({
        state: 'offline',
        pendingCount: outbox.length,
      });
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        pendingCount: outbox.length,
        message: 'Supabase Cloud is not configured. Storing in local durable database.',
      };
    }

    if (this.isSyncing) {
      return {
        success: true,
        pushedCount: 0,
        pulledCount: 0,
        pendingCount: this.currentStatus.pendingCount,
        message: 'Sync already in progress...',
      };
    }

    this.isSyncing = true;
    this.updateStatus({ state: 'syncing' });

    try {
      const outbox = await expenseRepo.getPendingOutbox();
      const tombstones = await expenseRepo.getTombstones();
      let pushedCount = 0;
      let pulledCount = 0;

      // 1. PUSH PHASE: Reconcile outbox mutations with Supabase
      const localExpenses = await expenseRepo.getAll();
      const payloadToSync: any = Storage.getAllDataPayload();
      payloadToSync.expenses = localExpenses;
      payloadToSync.deletedExpenseIds = Array.from(tombstones);

      // Ensure explicit deletion tombstones are included in payload metadata
      payloadToSync._meta = {
        ...(payloadToSync._meta || {}),
        deletedExpenseIds: Array.from(tombstones),
        syncVersion: Date.now(),
        clientTimestamp: Date.now(),
      };

      // Track the specific mutation IDs in-flight for this sync pass
      const inFlightMutationIds = outbox.map((m) => m.id);

      const syncResult = await syncWorkspaceToSupabase(payloadToSync, !isManual);

      if (syncResult.success) {
        // Successfully pushed to Supabase: dequeue ONLY the mutations that were in flight
        pushedCount = inFlightMutationIds.length;
        if (inFlightMutationIds.length > 0) {
          await expenseRepo.dequeueMutations(inFlightMutationIds);
        }
      } else {
        throw new Error(syncResult.message || 'Failed to sync with Supabase Cloud');
      }

      // 2. PULL PHASE: Safe remote reconciliation
      const remoteFetch = await fetchWorkspaceFromSupabase();
      if (remoteFetch.success && remoteFetch.data) {
        // Absorb remote deletion tombstones from remote payload
        const remoteTombstoneIds: string[] = [
          ...(Array.isArray(remoteFetch.data._meta?.deletedExpenseIds) ? remoteFetch.data._meta.deletedExpenseIds : []),
          ...(Array.isArray(remoteFetch.data.deletedExpenseIds) ? remoteFetch.data.deletedExpenseIds : []),
        ];

        if (Array.isArray(remoteFetch.data.trash)) {
          remoteFetch.data.trash.forEach((t: any) => {
            if (t && (t.module === 'expenses' || !t.module)) {
              if (t.data?.id) remoteTombstoneIds.push(String(t.data.id).trim());
              if (typeof t.data === 'string' && t.data.trim()) remoteTombstoneIds.push(t.data.trim());
              if (t.id) remoteTombstoneIds.push(String(t.id).trim());
            }
          });
        }

        if (remoteTombstoneIds.length > 0) {
          await expenseRepo.recordTombstones(remoteTombstoneIds);
          await expenseRepo.deleteBatch(remoteTombstoneIds);
        }

        if (Array.isArray(remoteFetch.data.expenses)) {
          const remoteExpenses: ExpenseItem[] = remoteFetch.data.expenses;
          const currentTombstones = await expenseRepo.getTombstones();

          // Filter out any remote expenses that have been deleted locally or remotely
          const validRemote = remoteExpenses.filter((e) => {
            if (!e || !e.id) return false;
            const id = String(e.id).trim();
            return !currentTombstones.has(id) && (e as any).is_deleted !== true && (e as any).isDeleted !== true;
          });

          // Current fresh local items
          const freshLocal = await expenseRepo.getAll();
          const merged = mergeExpenseLists(freshLocal, validRemote, currentTombstones);

          // Preserve any newly committed local additions
          await expenseRepo.saveBatch(merged);
          pulledCount = validRemote.length;

          // Keep Storage memory mirror and local caches synchronized
          Storage.setExpenses(merged);

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('dashboard-data-updated', {
                detail: { module: 'expenses', updatedExpenses: merged },
              })
            );
          }
        }
      }

      const remainingOutbox = await expenseRepo.getPendingOutbox();
      this.updateStatus({
        state: remainingOutbox.length > 0 ? 'pending' : 'synced',
        pendingCount: remainingOutbox.length,
        lastSyncedAt: Date.now(),
        lastError: null,
      });

      return {
        success: true,
        pushedCount,
        pulledCount,
        pendingCount: 0,
        message: 'Spending successfully synchronized with Supabase Cloud',
      };
    } catch (err: any) {
      console.warn('[EXPENSE_SYNC] Sync error notice:', err);
      const outbox = await expenseRepo.getPendingOutbox();
      const errorMsg = err?.message || 'Network error during sync';

      this.updateStatus({
        state: 'error',
        pendingCount: outbox.length,
        lastError: errorMsg,
      });

      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        pendingCount: outbox.length,
        message: errorMsg,
        error: errorMsg,
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const expenseSyncService = new ExpenseSyncService();
