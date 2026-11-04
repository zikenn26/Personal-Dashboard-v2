import { ExpenseItem, ExpenseSyncStatus, ExpenseSyncMode, ExpenseMigrationState } from '../types';
import { expenseRepo } from '../repositories/expenseRepository';
import { isWorkOfflineMode, getCustomWorkspaceIdentifier, getCustomWorkspaceEmail, DEVICE_SESSION_ID } from '../utils/neonSync';
import { Storage } from '../utils/storage';
import { isOnline } from '../utils/offlineDetection';
import { exchangeSyncBatch, SyncMutationV2 } from './syncProtocol';

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
  private syncMode: ExpenseSyncMode = 'versioned_outbox';
  private migrationState: ExpenseMigrationState = 'completed';

  private currentStatus: ExpenseSyncStatus = {
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: Date.now(),
    lastError: null,
    syncMode: 'versioned_outbox',
    migrationState: 'completed',
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

    // Periodic background polling (every 30 seconds when tab/app is active and authenticated)
    setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const workspaceId = getCustomWorkspaceIdentifier();
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('notion_os_auth_token_v1') || '' : '';
      if (!token || !workspaceId || workspaceId.startsWith('user_guest') || isWorkOfflineMode() || !isOnline()) {
        return;
      }
      void this.syncExpenses({ background: true });
    }, 30000);
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

  public async syncDeltaWithServer(): Promise<SyncExpensesResult> {
    const workspaceId = getCustomWorkspaceIdentifier();
    const cursorKey = `notion_os_sync_v2_cursor_${workspaceId}`;
    const revisionsKey = `notion_os_sync_v2_revisions_${workspaceId}`;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('notion_os_auth_token_v1') || '' : '';
    if (!token || !workspaceId || workspaceId.startsWith('user_guest')) {
      const pending = await expenseRepo.getPendingOutbox();
      this.updateStatus({ state: 'synced', pendingCount: pending.length });
      return { success: false, pushedCount: 0, pulledCount: 0, pendingCount: pending.length, message: 'An authenticated account is required for cloud sync.' };
    }

    if (isWorkOfflineMode() || !isOnline()) {
      const pending = await expenseRepo.getPendingOutbox();
      this.updateStatus({ state: 'offline', pendingCount: pending.length });
      return { success: false, pushedCount: 0, pulledCount: 0, pendingCount: pending.length, message: 'Device is offline or Work Offline is enabled.' };
    }

    this.syncMode = 'versioned_outbox';
    let requestEpoch = ++this.currentEpoch;
    this.isSyncing = true;
    this.updateStatus({ state: 'syncing' });
    try {
      let cursor = localStorage.getItem(cursorKey) || '0';
      let revisions: Record<string, number> = {};
      try { revisions = JSON.parse(localStorage.getItem(revisionsKey) || '{}'); } catch {}

      // Initialize the revisioned cursor from its own event history. Legacy
      // workspace snapshots and dedicated expense tables are never imported.
      if (cursor === '0') {
        // Read the v2 event history first so records already migrated by another
        // device start at the correct revision instead of colliding at revision 0.
        for (let page = 0; page < 20; page++) {
          const history = await exchangeSyncBatch({
            workspaceIdentifier: workspaceId,
            userEmail: getCustomWorkspaceEmail(),
            deviceId: DEVICE_SESSION_ID,
            bearerToken: token,
            cursor,
            mutations: [],
          });
          for (const change of history.changes) {
            if (change.module === 'expenses') revisions[change.entity_id] = Math.max(Number(revisions[change.entity_id] || 0), change.revision);
          }
          cursor = history.next_cursor || cursor;
          if (!history.has_more) break;
        }
        localStorage.setItem(cursorKey, cursor);
        localStorage.setItem(revisionsKey, JSON.stringify(revisions));
      }

      let pushedCount = 0;
      let pulledCount = 0;
      let conflictCount = 0;
      const localMutationEntityIds = new Set<string>();
      const maxRounds = 20;
      for (let round = 0; round < maxRounds; round++) {
        const pending = await expenseRepo.getPendingOutbox();
        const batch = pending.slice(0, 250);
        const mutations: SyncMutationV2[] = [];
        const serverMutationParents = new Map<string, string>();
        const expectedSubmutations = new Map<string, string[]>();
        const entityRevisionOffsets: Record<string, number> = {};
        for (const item of batch) {
          const payload = (item.payload || item.data || {}) as any;
          if (item.action === 'batch_delete' && Array.isArray(payload.ids)) {
            const children: string[] = [];
            for (const rawId of payload.ids) {
              const entityId = String(rawId || '').trim();
              if (!entityId) continue;
              const subId = `${item.id}:${entityId}`;
              const offset = entityRevisionOffsets[entityId] || 0;
              const original = Array.isArray(payload.expenses)
                ? payload.expenses.find((expense: any) => String(expense?.id) === entityId) || { id: entityId }
                : { id: entityId };
              mutations.push({ mutation_id: subId, module: 'expenses', entity_id: entityId,
                operation: 'delete', base_revision: Number(revisions[entityId] || 0) + offset,
                payload: { ...original, id: entityId, is_deleted: true } });
              localMutationEntityIds.add(entityId);
              entityRevisionOffsets[entityId] = offset + 1;
              children.push(subId);
              serverMutationParents.set(subId, item.id);
            }
            if (children.length === 0) {
              await expenseRepo.dequeueMutations([item.id]);
              continue;
            }
            expectedSubmutations.set(item.id, children);
            continue;
          }
          const entityId = String(payload.id || item.expenseId || '').trim();
          if (!entityId || entityId === 'all-cleared' || entityId === 'batch-delete') continue;
          localMutationEntityIds.add(entityId);
          const offset = entityRevisionOffsets[entityId] || 0;
          mutations.push({
            mutation_id: item.id,
            module: 'expenses',
            entity_id: entityId,
            operation: item.action === 'delete' || item.action === 'batch_delete' || payload.is_deleted ? 'delete' : 'upsert',
            base_revision: Number(revisions[entityId] || payload._syncRevision || 0) + offset,
            payload: payload.expense || payload,
          });
          serverMutationParents.set(item.id, item.id);
          entityRevisionOffsets[entityId] = offset + 1;
        }

        const result = await exchangeSyncBatch({
          workspaceIdentifier: workspaceId,
          userEmail: getCustomWorkspaceEmail(),
          deviceId: DEVICE_SESSION_ID,
          bearerToken: token,
          cursor,
          mutations,
        });
        if (requestEpoch !== this.currentEpoch) throw new Error('Sync superseded by a newer request');

        if (result.accepted_mutation_ids.length) {
          const acceptedSet = new Set(result.accepted_mutation_ids);
          const acknowledgedOutboxIds: string[] = [];
          for (const [parentId, childIds] of expectedSubmutations) {
            if (childIds.length > 0 && childIds.every((id) => acceptedSet.has(id))) acknowledgedOutboxIds.push(parentId);
          }
          for (const acceptedId of result.accepted_mutation_ids) {
            const parentId = serverMutationParents.get(acceptedId);
            if (parentId && !expectedSubmutations.has(parentId)) acknowledgedOutboxIds.push(parentId);
          }
          const uniqueAcknowledged = Array.from(new Set(acknowledgedOutboxIds));
          if (uniqueAcknowledged.length) await expenseRepo.dequeueMutations(uniqueAcknowledged);
          pushedCount += uniqueAcknowledged.length;
        }
        conflictCount += result.conflicts.length;

        const localById = new Map(Storage.getExpenses().map((expense) => [String(expense.id), expense]));
        const deletedIds: string[] = [];
        for (const change of result.changes) {
          if (change.module !== 'expenses') continue;
          revisions[change.entity_id] = Math.max(Number(revisions[change.entity_id] || 0), change.revision);
          if (change.device_id === DEVICE_SESSION_ID || localMutationEntityIds.has(change.entity_id)) continue;
          if (change.operation === 'delete') {
            localById.delete(change.entity_id);
            deletedIds.push(change.entity_id);
            await expenseRepo.recordTombstone(change.entity_id);
          } else {
            const remote = { ...(change.payload as any), id: change.entity_id, _syncRevision: change.revision } as ExpenseItem;
            localById.set(change.entity_id, remote);
            await expenseRepo.save(remote);
            pulledCount++;
          }
        }
        cursor = result.next_cursor || cursor;
        const merged = Array.from(localById.values());
        Storage.setExpenses(merged, { enqueueChanges: false });
        await expenseRepo.saveBatch(merged);
        if (deletedIds.length) Storage.purgeExpensesFromAllCaches(deletedIds);
        // Advance the cursor only after pulled data is durably applied. If the
        // app stops earlier, the same server changes are replayed safely.
        localStorage.setItem(cursorKey, cursor);
        localStorage.setItem(revisionsKey, JSON.stringify(revisions));
        if (typeof window !== 'undefined' && result.changes.length) {
          window.dispatchEvent(new CustomEvent('dashboard-data-updated', { detail: { module: 'expenses', updatedExpenses: merged } }));
        }
        if (!result.has_more && (pending.length <= batch.length || result.accepted_mutation_ids.length === 0)) break;
      }

      const remaining = await expenseRepo.getPendingOutbox();
      this.updateStatus({
        state: conflictCount ? 'error' : remaining.length ? 'pending' : 'synced',
        pendingCount: remaining.length,
        lastSyncedAt: Date.now(),
        lastError: conflictCount ? `${conflictCount} expense change(s) conflict with a newer server revision and remain queued.` : null,
      });
      return { success: conflictCount === 0, pushedCount, pulledCount, pendingCount: remaining.length,
        message: conflictCount ? 'Sync completed with conflicts; local changes remain queued.' : 'Revisioned expense sync completed.' };
    } catch (err: any) {
      const pending = await expenseRepo.getPendingOutbox();
      this.updateStatus({ state: 'error', pendingCount: pending.length, lastError: err?.message || 'Sync error' });
      return { success: false, pushedCount: 0, pulledCount: 0, pendingCount: pending.length, message: err?.message || 'Sync error', error: err?.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /** Run only the revisioned Neon outbox protocol for signed-in accounts. */
  public async syncExpenses(options: { manual?: boolean; background?: boolean } = {}): Promise<SyncExpensesResult> {
    const pending = await expenseRepo.getPendingOutbox();
    if (isWorkOfflineMode() || !isOnline()) {
      this.updateStatus({ state: 'offline', pendingCount: pending.length });
      return { success: false, pushedCount: 0, pulledCount: 0, pendingCount: pending.length,
        message: isWorkOfflineMode() ? 'Work Offline is enabled. Network sync is paused.' : 'Device is offline.' };
    }
    if (!options.manual && this.activeSyncPromise) return this.activeSyncPromise;
    const promise = this.syncDeltaWithServer();
    this.activeSyncPromise = promise;
    try {
      return await promise;
    } finally {
      if (this.activeSyncPromise === promise) this.activeSyncPromise = null;
    }
  }

}

export const expenseSyncService = new ExpenseSyncService();
