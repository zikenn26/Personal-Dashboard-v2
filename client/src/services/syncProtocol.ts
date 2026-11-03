export interface SyncMutationV2 {
  mutation_id: string;
  module: string;
  entity_id: string;
  operation: 'upsert' | 'delete';
  base_revision: number;
  payload: Record<string, unknown>;
}
export interface SyncChangeV2 extends SyncMutationV2 {
  cursor: string;
  device_id: string;
  revision: number;
}

export interface SyncProtocolResponse {
  success: boolean;
  accepted_mutation_ids: string[];
  conflicts: Array<{
    mutation_id: string;
    module: string;
    entity_id: string;
    expected_revision: number;
    current_revision: number;
    current: { payload: Record<string, unknown>; is_deleted: boolean } | null;
  }>;
  changes: SyncChangeV2[];
  next_cursor: string;
  has_more: boolean;
  snapshot?: { payload: any; revision: number } | null;
}

export interface SyncProtocolRequest {
  workspaceIdentifier: string;
  userEmail: string;
  deviceId: string;
  bearerToken: string;
  cursor: string;
  mutations?: SyncMutationV2[];
}

/** Push a bounded batch and pull server-ordered changes using an opaque cursor. */
export async function exchangeSyncBatch(request: SyncProtocolRequest): Promise<SyncProtocolResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/sync/v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${request.bearerToken}`,
    },
    body: JSON.stringify({
      workspace_identifier: request.workspaceIdentifier,
      user_email: request.userEmail,
      device_id: request.deviceId,
      cursor: request.cursor || '0',
      mutations: request.mutations || [],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Sync failed (${response.status})`);
  }
  return data as SyncProtocolResponse;
}

export async function fetchWorkspaceSnapshotV2(request: Omit<SyncProtocolRequest, 'mutations'>): Promise<SyncProtocolResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/sync/v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${request.bearerToken}` },
    body: JSON.stringify({ workspace_identifier: request.workspaceIdentifier, user_email: request.userEmail,
      device_id: request.deviceId, cursor: request.cursor || '0', snapshot: true, mutations: [] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || `Sync failed (${response.status})`);
  return data as SyncProtocolResponse;
}
import { getApiBaseUrl } from '../utils/apiConfig';

const SNAPSHOT_DB = 'lifeos_sync_protocol';
const SNAPSHOT_STORE = 'workspace_outbox';
const CONFLICT_STORE = 'workspace_conflicts';
let lastSnapshotSequence = 0;
const snapshotDb = (): Promise<IDBDatabase | null> => new Promise((resolve) => {
  if (typeof indexedDB === 'undefined') return resolve(null);
  const request = indexedDB.open(SNAPSHOT_DB, 2);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(SNAPSHOT_STORE)) request.result.createObjectStore(SNAPSHOT_STORE, { keyPath: 'workspaceId' });
    if (!request.result.objectStoreNames.contains(CONFLICT_STORE)) request.result.createObjectStore(CONFLICT_STORE, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

export interface PendingWorkspaceSnapshot {
  workspaceId: string;
  sequence: number;
  payload: any;
}

export interface WorkspaceSyncConflict {
  id: string;
  workspaceId: string;
  detectedAt: number;
  path: Array<string | { id: string }>;
  baseValue: unknown;
  localValue: unknown;
  remoteValue: unknown;
  remoteRevision: number;
}

export async function saveWorkspaceConflicts(conflicts: WorkspaceSyncConflict[]): Promise<void> {
  if (!conflicts.length) return;
  const db = await snapshotDb();
  if (db) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONFLICT_STORE, 'readwrite');
      const store = tx.objectStore(CONFLICT_STORE);
      conflicts.forEach((conflict) => store.put(conflict));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } else {
    const current = await getWorkspaceConflicts(conflicts[0].workspaceId);
    localStorage.setItem(`lifeos_workspace_conflicts_${conflicts[0].workspaceId}`, JSON.stringify([...current, ...conflicts]));
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('workspace-sync-conflicts-updated'));
}

export async function getWorkspaceConflicts(workspaceId: string): Promise<WorkspaceSyncConflict[]> {
  const db = await snapshotDb();
  if (db) {
    const values = await new Promise<WorkspaceSyncConflict[]>((resolve) => {
      const tx = db.transaction(CONFLICT_STORE, 'readonly');
      const request = tx.objectStore(CONFLICT_STORE).getAll();
      request.onsuccess = () => resolve((request.result || []).filter((item: WorkspaceSyncConflict) => item.workspaceId === workspaceId));
      request.onerror = () => resolve([]);
    });
    db.close();
    return values.sort((a, b) => a.detectedAt - b.detectedAt);
  }
  try { return JSON.parse(localStorage.getItem(`lifeos_workspace_conflicts_${workspaceId}`) || '[]'); } catch { return []; }
}

export async function deleteWorkspaceConflict(conflictId: string, workspaceId: string): Promise<void> {
  const db = await snapshotDb();
  if (db) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONFLICT_STORE, 'readwrite');
      tx.objectStore(CONFLICT_STORE).delete(conflictId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } else {
    const remaining = (await getWorkspaceConflicts(workspaceId)).filter((item) => item.id !== conflictId);
    localStorage.setItem(`lifeos_workspace_conflicts_${workspaceId}`, JSON.stringify(remaining));
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('workspace-sync-conflicts-updated'));
}

/** Persist the latest complete local workspace for retry after offline periods. */
export async function queueWorkspaceSnapshot(workspaceId: string, payload: any): Promise<PendingWorkspaceSnapshot> {
  const db = await snapshotDb();
  if (db) {
    const entry = await new Promise<PendingWorkspaceSnapshot>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const request = store.get(workspaceId);
      let next: PendingWorkspaceSnapshot;
      request.onsuccess = () => {
        next = { workspaceId, sequence: Math.max(Date.now(), lastSnapshotSequence + 1, Number(request.result?.sequence || 0) + 1), payload };
        lastSnapshotSequence = next.sequence;
        store.put(next);
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve(next!);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Workspace outbox transaction aborted'));
    });
    db.close();
    return entry;
  } else {
    const key = `lifeos_workspace_outbox_${workspaceId}`;
    let previous = 0;
    try { previous = Number(JSON.parse(localStorage.getItem(key) || 'null')?.sequence || 0); } catch {}
    const entry = { workspaceId, sequence: Math.max(Date.now(), lastSnapshotSequence + 1, previous + 1), payload };
    lastSnapshotSequence = entry.sequence;
    localStorage.setItem(`lifeos_workspace_outbox_${workspaceId}`, JSON.stringify(entry));
    return entry;
  }
}

export async function getPendingWorkspaceSnapshot(workspaceId: string): Promise<PendingWorkspaceSnapshot | null> {
  const db = await snapshotDb();
  if (db) {
    const value = await new Promise<PendingWorkspaceSnapshot | null>((resolve) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const request = tx.objectStore(SNAPSHOT_STORE).get(workspaceId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
    db.close();
    return value;
  }
  try { return JSON.parse(localStorage.getItem(`lifeos_workspace_outbox_${workspaceId}`) || 'null'); } catch { return null; }
}

export async function acknowledgeWorkspaceSnapshot(workspaceId: string, sequence: number): Promise<void> {
  const db = await snapshotDb();
  if (db) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const request = store.get(workspaceId);
      request.onsuccess = () => {
        if (request.result?.sequence === sequence) store.delete(workspaceId);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return;
  }
  try {
    const key = `lifeos_workspace_outbox_${workspaceId}`;
    const entry = JSON.parse(localStorage.getItem(key) || 'null');
    if (entry?.sequence === sequence) localStorage.removeItem(key);
  } catch {}
}
