import { Capacitor } from '@capacitor/core';
import { mergeExpenseLists, normalizeExpenseDateKey, getLocalDateKey } from './expenseUtils';
import { ExpenseItem, OutboxMutation } from '../types';
import { acknowledgeWorkspaceSnapshot, exchangeSyncBatch, fetchWorkspaceSnapshotV2, getPendingWorkspaceSnapshot, queueWorkspaceSnapshot, saveWorkspaceConflicts, WorkspaceSyncConflict } from '../services/syncProtocol';
import { getApiBaseUrl } from './apiConfig';
export { mergeExpenseLists };


/**
 * Detects if running inside Capacitor Android native platform, Android WebView,
 * or native mobile wrapper.
 */
export const isNativeOrMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
    if ((window as any).androidBridge !== undefined) return true;
    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') return true;
    // Capacitor on Android serves from https://localhost with empty port
    if (
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      !window.location.port &&
      typeof navigator !== 'undefined' &&
      navigator.userAgent.includes('Android')
    ) {
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
};

export interface CloudSyncResult {
  success: boolean;
  message: string;
  /** True when the server answered successfully and confirmed no workspace exists. */
  exists?: boolean;
  timestamp?: string;
  data?: any;
  revision?: number;
  cursor?: string;
}

function mergeWorkspaceConflict(base: any, local: any, remote: any, path: Array<string | { id: string }> = [], conflicts: Array<Omit<WorkspaceSyncConflict, 'id' | 'workspaceId' | 'detectedAt' | 'remoteRevision'>> = []): any {
  if (JSON.stringify(local) === JSON.stringify(remote)) return local;
  if (JSON.stringify(local) === JSON.stringify(base)) return remote;
  if (JSON.stringify(remote) === JSON.stringify(base)) return local;
  if (Array.isArray(local) && Array.isArray(remote)) {
    const byId = (values: any[]) => new Map(values.filter((v) => v && typeof v === 'object' && v.id != null).map((v) => [String(v.id), v]));
    const localMap = byId(local);
    const remoteMap = byId(remote);
    const baseMap = byId(Array.isArray(base) ? base : []);
    if (localMap.size !== local.length || remoteMap.size !== remote.length) {
      conflicts.push({ path, baseValue: base, localValue: local, remoteValue: remote });
      return local;
    }
    const merged = new Map<string, any>();
    for (const id of new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()])) {
      const before = baseMap.get(id);
      const l = localMap.get(id);
      const r = remoteMap.get(id);
      if (l === undefined && r === undefined) continue;
      if (l === undefined) {
        if (before !== undefined && JSON.stringify(r) === JSON.stringify(before)) continue;
        if (r !== undefined) {
          if (before !== undefined) conflicts.push({ path: [...path, { id }], baseValue: before, localValue: undefined, remoteValue: r });
          merged.set(id, r);
        }
      } else if (r === undefined) {
        if (before !== undefined && JSON.stringify(l) === JSON.stringify(before)) continue;
        if (before !== undefined) conflicts.push({ path: [...path, { id }], baseValue: before, localValue: l, remoteValue: undefined });
        merged.set(id, l);
      } else {
        merged.set(id, mergeWorkspaceConflict(before || {}, l, r, [...path, { id }], conflicts));
      }
    }
    return Array.from(merged.values());
  }
  if (local && remote && typeof local === 'object' && typeof remote === 'object') {
    const result: Record<string, any> = {};
    for (const key of new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])) {
      result[key] = mergeWorkspaceConflict(base?.[key], local[key], remote[key], [...path, key], conflicts);
    }
    return result;
  }
  conflicts.push({ path, baseValue: base, localValue: local, remoteValue: remote });
  return local;
}

export function applyWorkspaceConflictChoice(payload: any, conflict: WorkspaceSyncConflict, choice: 'local' | 'remote'): any {
  const result = structuredClone(payload);
  const value = choice === 'local' ? conflict.localValue : conflict.remoteValue;
  let parent: any = result;
  for (let index = 0; index < conflict.path.length; index++) {
    const part = conflict.path[index];
    const isLast = index === conflict.path.length - 1;
    if (typeof part === 'string') {
      if (isLast) {
        if (value === undefined) delete parent[part];
        else parent[part] = value;
      } else {
        parent[part] ??= typeof conflict.path[index + 1] === 'object' ? [] : {};
        parent = parent[part];
      }
    } else {
      if (!Array.isArray(parent)) return result;
      const itemIndex = parent.findIndex((item: any) => item && String(item.id) === part.id);
      if (isLast) {
        if (value === undefined && itemIndex >= 0) parent.splice(itemIndex, 1);
        else if (value !== undefined && itemIndex >= 0) parent[itemIndex] = value;
        else if (value !== undefined) parent.push(value);
      } else {
        if (itemIndex < 0) return result;
        parent = parent[itemIndex];
      }
    }
  }
  return result;
}

export async function reconcileIncomingWorkspaceSnapshotV2(
  localPayload: any,
  remotePayload: any,
  remoteRevision?: number,
  remoteCursor?: string
): Promise<{ payload: any; needsSync: boolean }> {
  const workspaceId = getCustomWorkspaceIdentifier();
  const baseKey = `notion_os_workspace_v2_base_${workspaceId}`;
  const revisionKey = `notion_os_workspace_v2_revision_${workspaceId}`;
  const cursorKey = `notion_os_workspace_v2_cursor_${workspaceId}`;

  // In a singleton session architecture, remote cloud snapshots are authoritative
  const remoteWorkspace = workspacePayloadWithoutExpenseLedger(remotePayload || {});
  localStorage.setItem(baseKey, JSON.stringify(remoteWorkspace));
  if (remoteRevision != null) localStorage.setItem(revisionKey, String(remoteRevision));
  if (remoteCursor) localStorage.setItem(cursorKey, remoteCursor);

  return { payload: remoteWorkspace, needsSync: false };
}

const workspacePayloadWithoutExpenseLedger = (payload: any): any => {
  if (!payload || typeof payload !== 'object') return payload;
  const { expenses: _expenses, deletedExpenseIds: _deletedExpenseIds, ...rest } = payload;
  return rest;
};

async function syncWorkspaceSnapshotV2(payload: any, auto: boolean): Promise<CloudSyncResult> {
  const workspaceId = getCustomWorkspaceIdentifier();
  const email = getCustomWorkspaceEmail();
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('notion_os_auth_token_v1') || '' : '';
  if (!token || !workspaceId || workspaceId === 'user_guest' || !email || email === 'guest@workspace.local') {
    return { success: false, message: 'An active account session is required for revisioned workspace sync.' };
  }
  const revisionKey = `notion_os_workspace_v2_revision_${workspaceId}`;
  const baseKey = `notion_os_workspace_v2_base_${workspaceId}`;
  const cursorKey = `notion_os_workspace_v2_cursor_${workspaceId}`;
  let revision = Number(localStorage.getItem(revisionKey) || 0);
  let cursor = localStorage.getItem(cursorKey) || '0';
  const queued = await queueWorkspaceSnapshot(workspaceId, payload);
  const pending = await getPendingWorkspaceSnapshot(workspaceId);
  const snapshotSequence = pending?.sequence || queued.sequence;
  let candidate = workspacePayloadWithoutExpenseLedger(pending?.payload || payload);
  const deviceId = DEVICE_SESSION_ID;

  for (let attempt = 0; attempt < 4; attempt++) {
    const mutationId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `workspace-${Date.now()}-${Math.random()}`;
    const result = await exchangeSyncBatch({
      workspaceIdentifier: workspaceId, userEmail: email, deviceId, bearerToken: token, cursor,
      mutations: [{ mutation_id: mutationId, module: 'workspace', entity_id: 'root', operation: 'upsert',
        base_revision: revision, payload: candidate }],
    });
    if (result.accepted_mutation_ids.includes(mutationId)) {
      const ownChange = [...result.changes].reverse().find((change) => change.mutation_id === mutationId);
      revision = ownChange?.revision || revision + 1;
      candidate = ownChange?.payload || candidate;
      cursor = result.next_cursor || cursor;
      localStorage.setItem(revisionKey, String(revision));
      localStorage.setItem(baseKey, JSON.stringify(candidate));
      localStorage.setItem(cursorKey, cursor);
      await acknowledgeWorkspaceSnapshot(workspaceId, snapshotSequence);
      notifyStatus('synced');
      return { success: true, message: auto ? 'Workspace changes synced.' : 'Workspace synced.', timestamp: new Date().toISOString(), data: candidate };
    }
    const conflict = result.conflicts.find((item) => item.mutation_id === mutationId);
    if (!conflict?.current) throw new Error('Workspace sync conflict did not include the current server snapshot.');
    // Singleton session: advance our local base revision to the server's current revision and retry saving immediately
    revision = conflict.current_revision;
    cursor = result.next_cursor || cursor;
  }
  notifyStatus('error');
  return { success: false, message: 'Workspace sync retried. Changes will retry automatically.' };
}

const getInitialActiveUser = (): { id: string; email: string } => {
  if (typeof window === 'undefined') return { id: 'user_guest', email: 'guest@workspace.local' };
  try {
    const isSignedOut = localStorage.getItem('notion_os_auth_signed_out') === 'true';
    if (isSignedOut) {
      return { id: 'user_guest', email: 'guest@workspace.local' };
    }
    const raw = localStorage.getItem('notion_os_auth_user_v1');
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.id && user.id !== 'guest') {
        return {
          id: `user_${user.id}`,
          email: user.email ? user.email.trim().toLowerCase() : 'guest@workspace.local',
        };
      }
    }
  } catch {}
  return { id: 'user_guest', email: 'guest@workspace.local' };
};

const initialUser = getInitialActiveUser();
let activeUserIdentifier = initialUser.id;
let activeUserEmail = initialUser.email;

export const setCustomWorkspaceIdentifier = (id: string) => {
  if (id && id.trim()) {
    activeUserIdentifier = id.trim();
  }
};

export const setCustomWorkspaceEmail = (email: string) => {
  if (email && email.trim()) {
    activeUserEmail = email.trim().toLowerCase();
  }
};

export const getCustomWorkspaceIdentifier = (): string => {
  if (!activeUserIdentifier || activeUserIdentifier === 'user_guest') {
    if (typeof window !== 'undefined') {
      try {
        const isSignedOut = localStorage.getItem('notion_os_auth_signed_out') === 'true';
        if (!isSignedOut) {
          const raw = localStorage.getItem('notion_os_auth_user_v1');
          if (raw) {
            const user = JSON.parse(raw);
            if (user && user.id && user.id !== 'guest') {
              activeUserIdentifier = `user_${user.id}`;
              if (user.email) activeUserEmail = user.email.trim().toLowerCase();
            }
          }
        }
      } catch {}
    }
  }
  return activeUserIdentifier || 'user_guest';
};

export const getCustomWorkspaceEmail = (): string => {
  if (!activeUserEmail || activeUserEmail === 'guest@workspace.local') {
    if (typeof window !== 'undefined') {
      try {
        const isSignedOut = localStorage.getItem('notion_os_auth_signed_out') === 'true';
        if (!isSignedOut) {
          const raw = localStorage.getItem('notion_os_auth_user_v1');
          if (raw) {
            const user = JSON.parse(raw);
            if (user && user.email) {
              activeUserEmail = user.email.trim().toLowerCase();
            }
          }
        }
      } catch {}
    }
  }
  return activeUserEmail || 'guest@workspace.local';
};

export const WORKSPACE_USER_IDENTIFIER = 'user_guest';

// Get or generate a persistent hardware/browser device ID that stays identical across logins and restarts
export const getPersistentDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server_env';
  try {
    let id = localStorage.getItem('lifeos_persistent_device_id');
    if (!id) {
      // Check legacy session storage first to maintain continuity
      id =
        window.sessionStorage?.getItem('lifeos_device_session_id') ||
        'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('lifeos_persistent_device_id', id);
    }
    // Mirror to sessionStorage so all tabs on this device match
    try {
      window.sessionStorage?.setItem('lifeos_device_session_id', id);
    } catch {}
    return id;
  } catch {
    return 'dev_' + Math.random().toString(36).substring(2, 11);
  }
};

// Unique Device Session ID that persists reliably across browser restarts and logins
export const DEVICE_SESSION_ID = getPersistentDeviceId();

let lastPushedTimestamp = 0;
let autoSyncTimeout: any = null;
let broadcastSyncTimeout: any = null;
let reconnectRealtimeTimeout: any = null;
let realtimeReconnectAttempts = 0;
let currentSyncStatus: 'synced' | 'syncing' | 'error' | 'idle' = 'idle';

// Cross-device workspace ordering.
// A local monotonic clock prevents an older snapshot from replacing a newer
// deletion/update when Broadcast and Postgres realtime events arrive out of order.
let latestLocalMutationTimestamp =
  typeof window !== 'undefined'
    ? Number(localStorage.getItem('lifeos_workspace_sync_clock') || '0')
    : 0;
let latestKnownRemoteTimestamp = 0;
let lastAppliedRemoteVersion = 0;
let lastAppliedRemoteUpdatedAt = '';

export const getLastAppliedRemoteVersion = () => lastAppliedRemoteVersion;
export const getLastAppliedRemoteUpdatedAt = () => lastAppliedRemoteUpdatedAt;

const getSyncTimestamp = (): number => {
  const now = Date.now();
  if (typeof window === 'undefined') return now;

  try {
    const key = 'lifeos_workspace_sync_clock';
    const previous = Number(localStorage.getItem(key) || '0');
    const next = Math.max(
      now,
      previous + 1,
      latestKnownRemoteTimestamp + 1
    );
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return now;
  }
};

const parseSyncTimestamp = (value: any): number => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getPayloadSyncTimestamp = (payload: any, fallback?: any): number => {
  return Math.max(
    parseSyncTimestamp(payload?._meta?.syncVersion),
    parseSyncTimestamp(payload?._meta?.clientTimestamp),
    parseSyncTimestamp(fallback)
  );
};
const statusListeners = new Set<(status: 'synced' | 'syncing' | 'error' | 'idle') => void>();

const WORK_OFFLINE_STORAGE_KEY = 'notion_os_work_offline_v1';
let manualWorkOfflineEnabled =
  typeof localStorage !== 'undefined' && localStorage.getItem(WORK_OFFLINE_STORAGE_KEY) === 'true';

/** Pause background and manual cloud sync on this device while retaining local edits. */
export const setWorkOfflineMode = (enabled: boolean): void => {
  manualWorkOfflineEnabled = enabled;
  if (enabled) {
    if (broadcastSyncTimeout) clearTimeout(broadcastSyncTimeout);
    if (autoSyncTimeout) clearTimeout(autoSyncTimeout);
    broadcastSyncTimeout = null;
    autoSyncTimeout = null;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      if (enabled) localStorage.setItem(WORK_OFFLINE_STORAGE_KEY, 'true');
      else localStorage.removeItem(WORK_OFFLINE_STORAGE_KEY);
    }
  } catch {
    // The in-memory setting still applies when browser storage is unavailable.
  }
};

export const isWorkOfflineMode = (): boolean => manualWorkOfflineEnabled;

const isNetworkOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

const queueSignedInWorkspaceSnapshot = async (payload: any): Promise<boolean> => {
  try {
    const activeId = getCustomWorkspaceIdentifier();
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('notion_os_auth_token_v1') || '' : '';
    if (!payload || !token || !activeId || activeId === 'user_guest' || activeId.startsWith('user_guest') ||
        !activeUserEmail || activeUserEmail === 'guest@workspace.local') return false;
    await queueWorkspaceSnapshot(activeId, payload);
    return true;
  } catch {
    return false;
  }
};

const presenceListeners = new Set<(onlineDeviceIds: Set<string>) => void>();
let latestOnlineDeviceIds = new Set<string>([DEVICE_SESSION_ID]);

export const subscribeToPresenceState = (callback: (onlineDeviceIds: Set<string>) => void): (() => void) => {
  presenceListeners.add(callback);
  callback(latestOnlineDeviceIds);
  return () => {
    presenceListeners.delete(callback);
  };
};

export const getOnlineDeviceIds = (): Set<string> => latestOnlineDeviceIds;

const notifyPresenceListeners = (presenceState: Record<string, any[]>) => {
  const ids = new Set<string>([DEVICE_SESSION_ID]);
  if (presenceState && typeof presenceState === 'object') {
    Object.keys(presenceState).forEach((key) => {
      if (key) ids.add(key);
    });
  }
  latestOnlineDeviceIds = ids;
  presenceListeners.forEach((listener) => {
    try {
      listener(ids);
    } catch {}
  });
};

export const getAutoSyncStatus = () => currentSyncStatus;

// Modern Cross-Tab Synchronization Channel
let tabBroadcastChannel: BroadcastChannel | null = null;
export const getTabBroadcastChannel = (): BroadcastChannel | null => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!tabBroadcastChannel) {
    try {
      tabBroadcastChannel = new BroadcastChannel('lifeos_workspace_cross_tab_channel');
    } catch {
      tabBroadcastChannel = null;
    }
  }
  return tabBroadcastChannel;
};

/**
 * Broadcast workspace changes via BroadcastChannel to other browser tabs and WebSocket to other devices.
 * Delivers updates in <10ms across tabs without waiting for database writes.
 */
export const broadcastWorkspaceUpdate = (enrichedPayload: any) => {
  const activeId = getCustomWorkspaceIdentifier();
  if (activeId === 'user_guest' || activeId.startsWith('user_guest') || !activeUserEmail || activeUserEmail === 'guest@workspace.local') {
    return;
  }

  // Signal other tabs to read the authenticated versioned snapshot. Full local
  // payloads are never broadcast as a second, non-versioned write path.
  try {
    localStorage.setItem('lifeos_workspace_sync_clock', String(Date.now()));
  } catch {}
};

export const subscribeToSyncStatus = (listener: (status: 'synced' | 'syncing' | 'error' | 'idle') => void) => {
  statusListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    statusListeners.delete(listener);
  };
};

const notifyStatus = (status: 'synced' | 'syncing' | 'error' | 'idle') => {
  currentSyncStatus = status;
  statusListeners.forEach((fn) => {
    try {
      fn(status);
    } catch (e) {
      console.warn('Status listener error:', e);
    }
  });
};

/** Check the authenticated server's Neon storage connection. */
export const testStorageConnection = async (): Promise<{
  connected: boolean;
  message: string;
  details?: any;
}> => {
  try {
    const token = localStorage.getItem('notion_os_auth_token_v1') || '';
    const response = await fetch(`${getApiBaseUrl()}/api/storage/diagnostic`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return {
      connected: response.ok,
      message: response.ok ? 'Connected to the authenticated Neon storage service' : 'Neon DB connection error',
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Connection failed: ${err?.message || 'Unknown network error'}`,
      details: err,
    };
  }
};

/**
 * Fetch the canonical workspace entity through the versioned Neon protocol.
 */
export const fetchWorkspaceFromServer = async (): Promise<CloudSyncResult> => {
  try {
    const activeId = getCustomWorkspaceIdentifier();
    const activeEmail = getCustomWorkspaceEmail();
    const token = localStorage.getItem('notion_os_auth_token_v1') || '';
    if (!token || !activeId || activeId === 'user_guest') {
      return { success: false, message: 'An authenticated account is required to read the cloud workspace.' };
    }
    const cursor = localStorage.getItem(`notion_os_workspace_v2_cursor_${activeId}`) || '0';
    const response = await fetchWorkspaceSnapshotV2({ workspaceIdentifier: activeId, userEmail: activeEmail,
      deviceId: DEVICE_SESSION_ID, bearerToken: token, cursor });
    if (response.snapshot?.payload) {
      const remoteVersion = Number(response.snapshot.revision || 0);
      lastAppliedRemoteVersion = Math.max(lastAppliedRemoteVersion, remoteVersion);
      latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, remoteVersion);
      latestLocalMutationTimestamp = Math.max(latestLocalMutationTimestamp, remoteVersion);
      localStorage.setItem(`notion_os_workspace_v2_revision_${activeId}`, String(remoteVersion));
      localStorage.setItem(`notion_os_workspace_v2_cursor_${activeId}`, response.next_cursor || '0');
      return {
        success: true,
        message: 'Retrieved versioned workspace snapshot from Neon.',
        data: response.snapshot.payload,
        revision: remoteVersion,
        cursor: response.next_cursor || '0',
      };
    }
    return { success: true, exists: false, message: 'No server snapshot found', data: null };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Server fetch error' };
  }
};

/**
 * Lightweight check if server hub has a newer workspace snapshot.
 */
export const checkHasNewerServerWorkspace = async (): Promise<boolean> => {
  try {
    const activeId = getCustomWorkspaceIdentifier();
    const activeEmail = getCustomWorkspaceEmail();
    const token = localStorage.getItem('notion_os_auth_token_v1') || '';
    if (!token || activeId === 'user_guest') return false;
    const knownCursor = localStorage.getItem(`notion_os_workspace_v2_cursor_${activeId}`) || '0';
    const result = await fetchWorkspaceSnapshotV2({ workspaceIdentifier: activeId, userEmail: activeEmail,
      deviceId: DEVICE_SESSION_ID, bearerToken: token, cursor: knownCursor });
    return result.next_cursor !== knownCursor;
  } catch {
    return false;
  }
};

/** Persist the canonical workspace root through the authenticated v2 outbox. */
export const syncWorkspaceToServer = async (workspacePayload: any, isAutoSync = false): Promise<CloudSyncResult> => {
  if (manualWorkOfflineEnabled) {
    notifyStatus('idle');
    return { success: false, message: 'Work Offline is enabled. Cloud sync is paused.' };
  }
  const activeId = getCustomWorkspaceIdentifier();
  const token = localStorage.getItem('notion_os_auth_token_v1') || '';
  if (!token || activeId === 'user_guest' || activeId.startsWith('user_guest') || getCustomWorkspaceEmail() === 'guest@workspace.local') {
    return { success: false, message: 'An authenticated account is required for versioned sync.' };
  }
  if (isNetworkOffline()) {
    const queued = await queueSignedInWorkspaceSnapshot(workspacePayload);
    notifyStatus(queued ? 'idle' : 'error');
    return { success: false, message: queued ? 'Offline changes were queued on this device.' : 'Could not queue offline changes.' };
  }
  const syncTimestampMs = getSyncTimestamp();
  const enrichedPayload = {
    ...workspacePayloadWithoutExpenseLedger(workspacePayload),
    _meta: {
      ...(workspacePayload?._meta || {}),
      lastDeviceId: DEVICE_SESSION_ID,
      clientTimestamp: syncTimestampMs,
      syncVersion: syncTimestampMs,
      ...(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
        ? { apkInstalled: true, lastApkSyncTimestamp: Date.now(), apkDeviceName: 'Android Native APK' }
        : {}),
    },
  };
  notifyStatus('syncing');
  broadcastWorkspaceUpdate(enrichedPayload);
  try {
    const result = await syncWorkspaceSnapshotV2(enrichedPayload, isAutoSync);
    notifyStatus(result.success ? 'synced' : 'error');
    return result;
  } catch (err: any) {
    notifyStatus('error');
    return { success: false, message: err?.message || 'Versioned workspace sync failed.' };
  }
};

/**
 * Schedule a debounced workspace sync through the authenticated server API.
 * Broadcasts to connected devices within 150ms and persists to PostgreSQL within 600ms.
 */
export const scheduleAutoSyncToServer = (
  payloadGetter: () => any,
  delayMs = 600
) => {
  if (manualWorkOfflineEnabled) return;
  if (isNetworkOffline()) {
    try {
      const activeId = getCustomWorkspaceIdentifier();
      const token = localStorage.getItem('notion_os_auth_token_v1');
      if (!token || !activeId || activeId === 'user_guest' || activeId.startsWith('user_guest') ||
          !activeUserEmail || activeUserEmail === 'guest@workspace.local') return;
      const payload = payloadGetter();
      if (payload) void queueSignedInWorkspaceSnapshot(payload);
    } catch {}
    return;
  }
  const activeId = getCustomWorkspaceIdentifier();
  const hasV2Session = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('notion_os_auth_token_v1')) && activeId !== 'user_guest';
  if (!hasV2Session) return;
  if (activeId === 'user_guest' || activeId.startsWith('user_guest') || !activeUserEmail || activeUserEmail === 'guest@workspace.local') {
    return;
  }

  // 1. Instant WebSocket broadcast to peer devices (zero perceptible lag)
  if (broadcastSyncTimeout) {
    clearTimeout(broadcastSyncTimeout);
  }
  broadcastSyncTimeout = setTimeout(() => {
    try {
      const payload = payloadGetter();
      if (payload) {
        broadcastWorkspaceUpdate({
          ...payload,
          _meta: {
            lastDeviceId: DEVICE_SESSION_ID,
            clientTimestamp: Date.now(),
          },
        });
      }
    } catch {
      // ignore
    }
  }, 120);

  // 2. Debounced PostgreSQL upsert for durable persistent storage
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }

  notifyStatus('syncing');
  autoSyncTimeout = setTimeout(async () => {
    try {
      const payload = payloadGetter();
      if (payload) {
        await syncWorkspaceToServer(payload, true);
      }
    } catch (err) {
      console.warn('Background auto-sync failed:', err);
      notifyStatus('error');
    }
  }, delayMs);
};

/**
 * Atomic promise chain queue for serializing flushAutoSyncImmediately across rapid triggers.
 * Guarantees atomicity and monotonic sequence ordering even when multiple devices or rapid local
 * events fire concurrently.
 */
let flushExecutionQueue: Promise<any> = Promise.resolve();

/**
 * Flush any pending auto-sync immediately (e.g. before tab switch or page close).
 * Atomically queues the operation to prevent in-flight race conditions.
 */
export const flushAutoSyncImmediately = async (
  payload: any,
  syncFn: (payload: any, isAutoSync?: boolean) => Promise<CloudSyncResult> = syncWorkspaceToServer
): Promise<CloudSyncResult | void> => {
  if (manualWorkOfflineEnabled) return;
  if (isNetworkOffline()) {
    await queueSignedInWorkspaceSnapshot(payload);
    return;
  }
  const activeId = getCustomWorkspaceIdentifier();
  const hasV2Session = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('notion_os_auth_token_v1')) && activeId !== 'user_guest';
  if (!hasV2Session || !payload) return;
  if (broadcastSyncTimeout) {
    clearTimeout(broadcastSyncTimeout);
    broadcastSyncTimeout = null;
  }
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
    autoSyncTimeout = null;
  }
  // Atomically serialize through the promise queue
  flushExecutionQueue = flushExecutionQueue
    .catch(() => {})
    .then(async () => {
      return await syncFn(payload, true);
    });

  return await flushExecutionQueue;
};

/**
 * Listen for cross-tab hints and poll the canonical versioned workspace.
 */
export const subscribeToRealtimeWorkspace = (
  onRemoteChange: (data: any, timestamp: string) => void,
  onDeviceRevoked?: () => void
): (() => void) => {
  const activeId = getCustomWorkspaceIdentifier();
  if (activeId === 'user_guest' || activeId.startsWith('user_guest') || !activeUserEmail || activeUserEmail === 'guest@workspace.local') {
    return () => {};
  }

  let isDestroyed = false;
  let isPolling = false;
  let isVerifying = false;

  // Cross-tab signals are hints only; the receiver always reads the canonical
  // server snapshot through the authenticated, revisioned endpoint.
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === 'lifeos_workspace_sync_clock') void pollServerWorkspace();
  };
  const verifySession = async () => {
    if (isDestroyed || isVerifying || !onDeviceRevoked) return;
    const token = localStorage.getItem('notion_os_auth_token_v1') || '';
    if (!token) return;
    isVerifying = true;
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}` } });
      if ((response.status === 401 || response.status === 403) && !isDestroyed) onDeviceRevoked();
    } catch {
      // A temporary network failure does not revoke an offline session.
    } finally {
      isVerifying = false;
    }
  };
  const pollServerWorkspace = async () => {
    if (isDestroyed || isPolling) return;
    isPolling = true;
    try {
      const result = await fetchWorkspaceFromServer();
      if (result.success && result.data && !isDestroyed) {
        const remoteVersion = Number(result.revision || 0);
        if (remoteVersion > lastAppliedRemoteVersion) {
          lastAppliedRemoteVersion = remoteVersion;
          lastAppliedRemoteUpdatedAt = result.timestamp || new Date().toISOString();
          onRemoteChange(result.data, lastAppliedRemoteUpdatedAt);
          notifyStatus('synced');
        }
      }
    } finally {
      isPolling = false;
    }
  };

  const pollInterval = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void pollServerWorkspace();
    }
  }, 4000);
  const sessionInterval = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') void verifySession();
  }, 30000);
  const handleFocusOrVisibility = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void pollServerWorkspace();
      void verifySession();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('focus', handleFocusOrVisibility);
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleFocusOrVisibility);

  return () => {
    isDestroyed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', handleFocusOrVisibility);
    }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    clearInterval(pollInterval);
    clearInterval(sessionInterval);
  };
};

/**
 * Checks if the Android native APK has synced to this user's account,
 * returning its registration status and recent sync timestamp.
 */
export const isApkInstalledInAccount = (workspaceData?: any): {
  isInstalled: boolean;
  lastSync: number | null;
  deviceName?: string;
} => {
  const meta = workspaceData?._meta;
  if (meta?.apkInstalled) {
    return {
      isInstalled: true,
      lastSync: meta.lastApkSyncTimestamp || null,
      deviceName: meta.apkDeviceName || 'Android Native APK',
    };
  }
  return { isInstalled: false, lastSync: null };
};
