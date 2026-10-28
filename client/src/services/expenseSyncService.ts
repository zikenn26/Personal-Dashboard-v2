import {
  ExpenseItem,
  ExpenseSyncStatus,
  OutboxMutation,
  ExpenseSyncMode,
  ExpenseMigrationState,
} from '../types';
import { expenseRepo } from '../repositories/expenseRepository';
import {
  isSupabaseConfigured,
  getSupabaseClient,
  fetchWorkspaceFromSupabase,
  syncWorkspaceToSupabase,
  isWorkOfflineMode,
  getCustomWorkspaceIdentifier,
  pushExpenseMutationsToDedicatedTable,
  fetchExpensesFromDedicatedTable,
  migrateJsonbExpensesToDedicatedTable,
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
  syncMode?: ExpenseSyncMode;
}

type SyncStatusListener = (status: ExpenseSyncStatus) => void;

class ExpenseSyncService {
  private syncMode: ExpenseSyncMode = 'offline_local_first';
  private migrationState: ExpenseMigrationState = 'pending';

  private currentStatus: ExpenseSyncStatus = {
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: Date.now(),
    lastError: null,
    syncMode: 'offline_local_first',
    migrationState: 'pending',
  };
  private listeners: Set<SyncStatusListener> = new Set();
  private isSyncing = false;
  private syncDebounceTimer: any = null;
  private isInitialized = false;
  private currentEpoch = 0;
  private activeSyncPromise: Promise<SyncExpensesResult> | null = null;

  constructor() {
    this.initLifecycle();
  }

  public getSyncMode(): ExpenseSyncMode {
    return this.syncMode;
  }

  public getMigrationState(): ExpenseMigrationState {
    return this.migrationState;
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

    window.addEventListener('offline', () => {
      this.updateStatus({
        state: 'offline',
        syncMode: 'offline_local_first',
      });
    });

    // Opportunistically run idempotent migration in background
    setTimeout(() => {
      if (!isWorkOfflineMode() && isSupabaseConfigured()) {
        void this.runMigration();
      }
    }, 1500);
  }

  public async runMigration(): Promise<void> {
    if (isWorkOfflineMode() || !isSupabaseConfigured()) return;
    this.migrationState = 'in_progress';
    this.updateStatus({ migrationState: 'in_progress' });
    try {
      const res = await migrateJsonbExpensesToDedicatedTable();
      if (res.success) {
        this.migrationState = 'completed';
        this.syncMode = 'dedicated_table';
        this.updateStatus({ migrationState: 'completed', syncMode: 'dedicated_table' });
      } else {
        this.migrationState = 'fallback_mode';
        this.syncMode = 'workspace_jsonb_fallback';
        this.updateStatus({ migrationState: 'fallback_mode', syncMode: 'workspace_jsonb_fallback' });
      }
    } catch {
      this.migrationState = 'failed';
      this.updateStatus({ migrationState: 'failed' });
    }
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
   * Main sync routine: Local-first outbox push to dedicated table followed by safe bidirectional remote reconciliation
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

    // Single-Flight coalescing: If a background sync is already in flight and this is also background, coalesce
    if (!isManual && this.activeSyncPromise) {
      return this.activeSyncPromise;
    }

    // Allocate an incremental Epoch token for this sync attempt.
    // If a manual sync is initiated, bumping the epoch supersedes previous in-flight syncs
    // so any late responses from old requests are safely discarded and cannot mutate state or dequeue outbox items.
    const requestEpoch = ++this.currentEpoch;
    this.isSyncing = true;
    this.updateStatus({ state: 'syncing' });

    const executeSync = async (): Promise<SyncExpensesResult> => {
      try {
        const outbox = await expenseRepo.getPendingOutbox();
        const tombstones = await expenseRepo.getTombstones();
        let pushedCount = 0;
        let pulledCount = 0;
        const inFlightMutationIds = outbox.map((m) => m.id);

        // 1. PUSH PHASE: First attempt dedicated Supabase table `public.user_expenses`
        let dedicatedPushSuccessful = false;
        let needsWorkspaceFallback = false;

        if (outbox.length > 0) {
          const dedicatedRes = await pushExpenseMutationsToDedicatedTable(outbox);

          // Epoch verification: If a newer request was issued while waiting for server response, abort immediately
          if (requestEpoch !== this.currentEpoch) {
            console.warn('[EXPENSE_SYNC] Push phase completed for superseded epoch; discarding mutation changes:', { requestEpoch, currentEpoch: this.currentEpoch });
            return {
              success: false,
              pushedCount: 0,
              pulledCount: 0,
              pendingCount: (await expenseRepo.getPendingOutbox()).length,
              message: 'Superseded by newer sync request',
            };
          }

          if (dedicatedRes.success) {
            dedicatedPushSuccessful = true;
            pushedCount = dedicatedRes.pushedIds.length;

            // Dequeue ONLY verified acknowledged mutations
            if (dedicatedRes.pushedIds.length > 0) {
              await expenseRepo.dequeueMutations(dedicatedRes.pushedIds);
            }

            // If server rejected mutations because records are tombstoned on server, enforce local tombstones
            if (dedicatedRes.serverTombstonedIds && dedicatedRes.serverTombstonedIds.length > 0) {
              console.warn('[TOMBSTONE_DIAGNOSTIC] Server confirmed tombstones for:', dedicatedRes.serverTombstonedIds);
              await expenseRepo.recordTombstones(dedicatedRes.serverTombstonedIds);
              await expenseRepo.deleteBatch(dedicatedRes.serverTombstonedIds);
              Storage.deleteExpenses(dedicatedRes.serverTombstonedIds);
            }

            // Preserve conflicted mutations into Trash under deletion-wins policy before dequeuing
            if (dedicatedRes.conflictRejectedMutationIds && dedicatedRes.conflictRejectedMutationIds.length > 0) {
              const conflictSet = new Set(dedicatedRes.conflictRejectedMutationIds);
              const conflicted = outbox.filter((m) => conflictSet.has(m.id));
              conflicted.forEach((m) => {
                const item = (m.data || m.payload) as any;
                if (item && typeof item === 'object') {
                  Storage.moveToTrash(
                    'expenses',
                    item,
                    `[Conflict: Server Deletion Wins] ${item.name || 'Expense'} (₹${Number(item.amount) || 0})`
                  );
                }
              });
              await expenseRepo.dequeueMutations(dedicatedRes.conflictRejectedMutationIds);
            }
          } else if (dedicatedRes.isFallbackNeeded) {
            needsWorkspaceFallback = true;
          } else {
            throw new Error(dedicatedRes.error || 'Failed to push mutations to dedicated expense table');
          }
        }

        // Fallback: If public.user_expenses table is missing, push via user_workspaces with OCC protection
        if ((needsWorkspaceFallback || (!dedicatedPushSuccessful && outbox.length > 0)) && inFlightMutationIds.length > 0) {
          const localExpenses = await expenseRepo.getAll();
          const payloadToSync: any = Storage.getAllDataPayload();
          payloadToSync.expenses = localExpenses;
          payloadToSync.deletedExpenseIds = Array.from(tombstones);

          payloadToSync._meta = {
            ...(payloadToSync._meta || {}),
            deletedExpenseIds: Array.from(tombstones),
            syncVersion: Date.now(),
            clientTimestamp: Date.now(),
          };

          const syncResult = await syncWorkspaceToSupabase(payloadToSync, !isManual);

          // Epoch verification
          if (requestEpoch !== this.currentEpoch) {
            console.warn('[EXPENSE_SYNC] Fallback push completed for superseded epoch; discarding changes');
            return {
              success: false,
              pushedCount: 0,
              pulledCount: 0,
              pendingCount: (await expenseRepo.getPendingOutbox()).length,
              message: 'Superseded by newer sync request',
            };
          }

          if (syncResult.success) {
            pushedCount = inFlightMutationIds.length;
            await expenseRepo.dequeueMutations(inFlightMutationIds);
          } else {
            throw new Error(syncResult.message || 'Failed to sync with Supabase Cloud');
          }
        }

        // 2. PULL PHASE: Safe remote reconciliation
        let dedicatedPullSuccessful = false;
        const dedicatedFetch = await fetchExpensesFromDedicatedTable();

        // Epoch verification before applying remote data
        if (requestEpoch !== this.currentEpoch) {
          console.warn('[EXPENSE_SYNC] Pull phase completed for superseded epoch; skipping remote merge');
          return {
            success: false,
            pushedCount: 0,
            pulledCount: 0,
            pendingCount: (await expenseRepo.getPendingOutbox()).length,
            message: 'Superseded by newer sync request',
          };
        }

        if (dedicatedFetch.success) {
          dedicatedPullSuccessful = true;
          // Ingest remote deletion tombstones
          if (dedicatedFetch.tombstones.length > 0) {
            await expenseRepo.recordTombstones(dedicatedFetch.tombstones);
            await expenseRepo.deleteBatch(dedicatedFetch.tombstones);
          }

          const currentTombstones = await expenseRepo.getTombstones();
          const validRemote = dedicatedFetch.data.filter((e) => {
            if (!e || !e.id) return false;
            return !currentTombstones.has(String(e.id).trim());
          });

          const freshLocal = await expenseRepo.getAll();
          const merged = mergeExpenseLists(freshLocal, validRemote, currentTombstones);

          await expenseRepo.saveBatch(merged);
          pulledCount = validRemote.length;
          Storage.setExpenses(merged);

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('dashboard-data-updated', {
                detail: { module: 'expenses', updatedExpenses: merged },
              })
            );
          }
        }

        // Fallback pull: If dedicated table is not available, pull from user_workspaces
        if (!dedicatedPullSuccessful && dedicatedFetch.isFallbackNeeded) {
          const remoteFetch = await fetchWorkspaceFromSupabase();

          // Epoch verification
          if (requestEpoch !== this.currentEpoch) {
            return {
              success: false,
              pushedCount: 0,
              pulledCount: 0,
              pendingCount: (await expenseRepo.getPendingOutbox()).length,
              message: 'Superseded by newer sync request',
            };
          }

          if (remoteFetch.success && remoteFetch.data) {
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

              const validRemote = remoteExpenses.filter((e) => {
                if (!e || !e.id) return false;
                const id = String(e.id).trim();
                return !currentTombstones.has(id) && (e as any).is_deleted !== true && (e as any).isDeleted !== true;
              });

              const freshLocal = await expenseRepo.getAll();
              const merged = mergeExpenseLists(freshLocal, validRemote, currentTombstones);

              await expenseRepo.saveBatch(merged);
              pulledCount = validRemote.length;
              Storage.setExpenses(merged);

              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('dashboard-data-updated', {
                    detail: { module: 'expenses', updatedExpenses: merged },
                  })
                );
              }
            }
          } else if (!remoteFetch.success) {
            throw new Error(remoteFetch.message || 'Failed to fetch from fallback workspace in Supabase Cloud');
          }
        } else if (!dedicatedPullSuccessful && !dedicatedFetch.success) {
          throw new Error(dedicatedFetch.error || 'Failed to retrieve expenses from Supabase dedicated table');
        }

        if (dedicatedPushSuccessful || dedicatedPullSuccessful) {
          this.syncMode = 'dedicated_table';
        } else if (needsWorkspaceFallback) {
          this.syncMode = 'workspace_jsonb_fallback';
        }

        // Final epoch check before marking synced status
        if (requestEpoch !== this.currentEpoch) {
          return {
            success: false,
            pushedCount: 0,
            pulledCount: 0,
            pendingCount: (await expenseRepo.getPendingOutbox()).length,
            message: 'Superseded by newer sync request',
          };
        }

        const remainingOutbox = await expenseRepo.getPendingOutbox();
        this.updateStatus({
          state: remainingOutbox.length > 0 ? 'pending' : 'synced',
          pendingCount: remainingOutbox.length,
          lastSyncedAt: Date.now(),
          lastError: null,
          syncMode: this.syncMode,
        });

        return {
          success: true,
          pushedCount,
          pulledCount,
          pendingCount: remainingOutbox.length,
          syncMode: this.syncMode,
          message:
            this.syncMode === 'dedicated_table'
              ? 'Spending successfully synchronized with dedicated table (public.user_expenses)'
              : 'Spending successfully synchronized with Supabase Cloud (workspace fallback mode)',
        };
      } catch (err: any) {
        if (requestEpoch !== this.currentEpoch) {
          return {
            success: false,
            pushedCount: 0,
            pulledCount: 0,
            pendingCount: (await expenseRepo.getPendingOutbox()).length,
            message: 'Superseded by newer sync request',
          };
        }

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
        if (requestEpoch === this.currentEpoch) {
          this.isSyncing = false;
        }
      }
    };

    const promise = executeSync();
    this.activeSyncPromise = promise;
    promise.finally(() => {
      if (this.activeSyncPromise === promise) {
        this.activeSyncPromise = null;
      }
    });

    return promise;
  }
}

export const expenseSyncService = new ExpenseSyncService();
