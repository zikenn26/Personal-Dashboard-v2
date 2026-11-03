// Database client types and connectors
export type SupabaseClient = any;
import { Capacitor } from '@capacitor/core';
import {
  SUPABASE_URL as BUILTIN_SUPABASE_URL,
  SUPABASE_ANON_KEY as BUILTIN_SUPABASE_ANON_KEY,
  getEffectiveSupabaseUrl,
  getEffectiveSupabaseAnonKey,
  setCustomSupabaseCredentials,
  hasCustomSupabaseCredentials,
} from './neonConfig';
import { mergeExpenseLists, normalizeExpenseDateKey, getLocalDateKey } from './expenseUtils';
import { OWNER_GKN_HABITS, OWNER_GKN_EXPENSES } from './userUtils';
import { ExpenseItem, OutboxMutation } from '../types';
import { realtimeHub } from './realtimeHub';
import { acknowledgeWorkspaceSnapshot, exchangeSyncBatch, fetchWorkspaceSnapshotV2, getPendingWorkspaceSnapshot, queueWorkspaceSnapshot, saveWorkspaceConflicts, WorkspaceSyncConflict } from '../services/syncProtocol';
export {
  mergeExpenseLists,
  getEffectiveSupabaseUrl,
  getEffectiveSupabaseAnonKey,
  setCustomSupabaseCredentials,
  hasCustomSupabaseCredentials,
};

/**
 * Master Dataset Seeding: Triggered upon connecting to a fresh cloud instance.
 * Checks if the remote database is empty, and if we are on the native Android APK
 * (the authoritative master of SMS expenses), automatically publishes the local
 * master dataset to seed the fresh cloud project.
 */
export const checkAndTriggerMasterApkSeed = async (): Promise<boolean> => {
  try {
    const activeId = getCustomWorkspaceIdentifier();
    if (activeId === 'user_guest' || activeId.startsWith('user_guest')) return false;

    // Check if the cloud has existing valid data via server
    const remoteWorkspace = await fetchWorkspaceFromServer();

    const remoteExpenses = remoteWorkspace.data?.expenses || [];

    // If the database is completely empty or missing expenses, we assume it's fresh
    if (!remoteWorkspace.success || remoteExpenses.length === 0) {
      // Are we the master source of truth? (Android Native APK)
      // Or in the context of the migration, if we have local expenses, we'll assume we are the seeder.
      let localWorkspaceStr = localStorage.getItem('lifeos_workspace_snapshot') || localStorage.getItem('lifeos_data_v4');
      if (!localWorkspaceStr) return false;

      const localWorkspace = JSON.parse(localWorkspaceStr);
      if (!localWorkspace || !localWorkspace.expenses || localWorkspace.expenses.length === 0) {
        return false; // Nothing to seed
      }

      console.log(`[Master Seed Engine] Fresh cloud project detected. Seeding ${localWorkspace.expenses.length} master expenses...`);

      // Tag it specifically as the master seed payload
      if (!localWorkspace._meta) localWorkspace._meta = {};
      localWorkspace._meta.isMasterApkSeed = true;

      const res = await syncWorkspaceToServer(localWorkspace);
      return res.success;
    }

    return false; // Cloud already has data, no need to seed
  } catch (err) {
    console.warn('Failed in Master Seed Engine:', err);
    return false;
  }
};


// Clean Supabase URL (strip /rest/v1 or trailing slashes if passed)
const cleanSupabaseUrl = (url: string): string => {
  if (!url) return '';
  let cleaned = url.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
};

let supabaseInstance: SupabaseClient | null = null;
let lastConfiguredUrl = '';
let lastConfiguredKey = '';

export const resetSupabaseClient = (): void => {
  supabaseInstance = null;
  lastConfiguredUrl = '';
  lastConfiguredKey = '';
};

/**
 * Checks if Cloud Database is configured in the environment.
 * Neon Serverless PostgreSQL is authoritative and active.
 */
export const isSupabaseConfigured = (): boolean => {
  return true;
};
export const isNeonConfigured = (): boolean => {
  return true;
};

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

/**
 * Checks if running inside an iframe, Cloud Run preview container, or dev environment
 * where third-party requests may be restricted by sandbox or CORS policies.
 * In native Capacitor (Android), this returns false so requests go directly to Supabase.
 */
const isIframeOrPreview = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (isNativeOrMobile()) return false;
  try {
    const isIframe = window.self !== window.top;
    const isAiStudio =
      window.location.hostname.includes('run.app') ||
      window.location.hostname.includes('aistudio');
    const isLocalDev =
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      Boolean(window.location.port);
    return isIframe || isAiStudio || isLocalDev || Boolean(import.meta.env.DEV);
  } catch {
    return true;
  }
};

/**
 * Smart fetch wrapper that routes Supabase requests through the same-origin proxy
 * (/api/supabase) when running in an iframe or preview container, preventing
 * "TypeError: Failed to fetch" caused by iframe sandboxes or CORS restrictions.
 */
export const supabaseFetch: typeof fetch = async (input, init) => {
  const isMobile = isNativeOrMobile();
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request)?.url || '';

  const activeSupabaseUrl = cleanSupabaseUrl(getEffectiveSupabaseUrl());

  if (urlStr && activeSupabaseUrl && urlStr.startsWith(activeSupabaseUrl)) {
    // In iframe or preview container, route through same-origin proxy first
    // On native mobile (Android APK), NEVER route through same-origin proxy (/api/supabase)
    if (!isMobile && isIframeOrPreview()) {
      const proxiedUrl = urlStr.replace(activeSupabaseUrl, '/api/supabase');
      try {
        const proxyRes = await fetch(proxiedUrl, init);
        // If proxy handled the request successfully (not 404 from static hosts), return
        if (proxyRes.status !== 404) {
          const contentType = proxyRes.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            return proxyRes;
          }
        }
      } catch (proxyErr) {
        // Fall back to direct fetch if proxy fails
      }
    }

    // Direct fetch attempt (used in Cloudflare Pages and standalone mobile apps)
    try {
      return await fetch(input, init);
    } catch (directErr) {
      // If direct fetch fails, only retry via proxy on web preview environments (never in native APK)
      if (!isMobile && isIframeOrPreview()) {
        const proxiedUrl = urlStr.replace(activeSupabaseUrl, '/api/supabase');
        try {
          const fallbackRes = await fetch(proxiedUrl, init);
          const contentType = fallbackRes.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            return fallbackRes;
          }
        } catch {
          throw directErr;
        }
      }
      throw directErr;
    }
  }

  return fetch(input, init);
};

/**
 * Lazy getter for the Supabase client.
 */
export const getSupabaseClient = (): any | null => {
  // Disabled for Neon DB migration: routes all sync to server hub via syncWorkspaceToServer
  return null;
};

export const validateSupabaseConnection = async (): Promise<boolean> => {
  // We're migrating to Neon, just check if the server is healthy
  try {
    const res = await fetch('/api/sync/devices');
    return res.ok;
  } catch {
    return false;
  }
};

export interface CloudSyncResult {
  success: boolean;
  message: string;
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
  let base: any = null;
  try {
    const rawBase = localStorage.getItem(baseKey);
    if (rawBase) base = JSON.parse(rawBase);
  } catch {}

  const localWorkspace = workspacePayloadWithoutExpenseLedger(localPayload || {});
  const remoteWorkspace = workspacePayloadWithoutExpenseLedger(remotePayload || {});
  let merged = remoteWorkspace;
  const pending = await getPendingWorkspaceSnapshot(workspaceId);
  if (base || pending) {
    const conflicts: Array<Omit<WorkspaceSyncConflict, 'id' | 'workspaceId' | 'detectedAt' | 'remoteRevision'>> = [];
    merged = mergeWorkspaceConflict(base || {}, localWorkspace, remoteWorkspace, [], conflicts);
    if (conflicts.length) {
      await saveWorkspaceConflicts(conflicts.map((conflict) => ({
        ...conflict,
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `conflict-${Date.now()}-${Math.random()}`,
        workspaceId,
        detectedAt: Date.now(),
        remoteRevision: remoteRevision || 0,
      })));
    }
  }

  localStorage.setItem(baseKey, JSON.stringify(remoteWorkspace));
  if (remoteRevision != null) localStorage.setItem(revisionKey, String(remoteRevision));
  if (remoteCursor) localStorage.setItem(cursorKey, remoteCursor);
  return { payload: merged, needsSync: JSON.stringify(merged) !== JSON.stringify(remoteWorkspace) };
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
  let base: any = {};
  try { base = JSON.parse(localStorage.getItem(baseKey) || '{}'); } catch {}
  const queued = await queueWorkspaceSnapshot(workspaceId, payload);
  const pending = await getPendingWorkspaceSnapshot(workspaceId);
  const snapshotSequence = pending?.sequence || queued.sequence;
  let candidate = workspacePayloadWithoutExpenseLedger(pending?.payload || payload);
  const deviceId = DEVICE_SESSION_ID;
  const recordedConflicts: Array<Omit<WorkspaceSyncConflict, 'id' | 'workspaceId' | 'detectedAt' | 'remoteRevision'>> = [];

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
    const remotePayload = workspacePayloadWithoutExpenseLedger(conflict.current.payload);
    const found: typeof recordedConflicts = [];
    candidate = mergeWorkspaceConflict(base, candidate, remotePayload, [], found);
    recordedConflicts.push(...found);
    base = remotePayload;
    revision = conflict.current_revision;
    if (found.length) {
      await saveWorkspaceConflicts(found.map((item) => ({
        ...item,
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `conflict-${Date.now()}-${Math.random()}`,
        workspaceId,
        detectedAt: Date.now(),
        remoteRevision: conflict.current_revision,
      })));
    }
  }
  notifyStatus('error');
  return { success: false, message: 'Workspace changed on another device repeatedly. Local data was kept; sync will retry.' };
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
let activeRealtimeChannel: any = null;
let currentSyncStatus: 'synced' | 'syncing' | 'error' | 'idle' = 'idle';

// Cross-device workspace ordering.
// A local monotonic clock prevents an older snapshot from replacing a newer
// deletion/update when Broadcast and Postgres realtime events arrive out of order.
let syncWriteQueue: Promise<void> = Promise.resolve();
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

  // 1. Cross-tab instant broadcast via modern browser BroadcastChannel
  try {
    const ch = getTabBroadcastChannel();
    if (ch) {
      ch.postMessage({
        type: 'workspace_sync',
        deviceId: DEVICE_SESSION_ID,
        workspaceId: activeId,
        userEmail: activeUserEmail,
        timestamp: new Date().toISOString(),
        data: enrichedPayload,
      });
    }
  } catch (err) {
    console.warn('Cross-tab broadcast notice:', err);
  }

  // 2. Also signal sync clock timestamp to trigger storage events across windows
  try {
    localStorage.setItem('lifeos_workspace_sync_clock', String(Date.now()));
  } catch {}

  // 3. Modern Full-Duplex WebSocket live sync hub push to other tabs, devices, and platforms (<30ms)
  try {
    realtimeHub.sendMutation('workspace', 'UPSERT', enrichedPayload);
  } catch (wsErr) {
    console.warn('[RealtimeHub] Live sync broadcast notice:', wsErr);
  }

  // 4. Fall back to WebSocket channel if active
  if (!activeRealtimeChannel) return;
  if (activeRealtimeChannel.state && activeRealtimeChannel.state !== 'joined') return;
  try {
    const serialized = JSON.stringify(enrichedPayload);
    // Supabase tenant broadcast payload limit is 250KB. Keep payload under 200KB for safety
    if (serialized.length <= 200_000) {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'workspace_sync',
        payload: {
          data: enrichedPayload,
          deviceId: DEVICE_SESSION_ID,
          timestamp: new Date().toISOString(),
        },
      }).catch((err: any) => {
        console.warn('Realtime broadcast send notice:', err);
      });
    } else {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'workspace_sync_ping',
        payload: {
          deviceId: DEVICE_SESSION_ID,
          timestamp: new Date().toISOString(),
        },
      }).catch((err: any) => {
        console.warn('Realtime broadcast ping notice:', err);
      });
    }
  } catch (err) {
    console.warn('Failed to send broadcast update:', err);
  }
};

/**
 * Broadcast instant alarm events (set, snooze, dismiss, delete) to all devices
 * logged into the same user account with sub-30ms delivery.
 */
export const broadcastAlarmAction = (
  action: 'set' | 'snooze' | 'dismiss' | 'delete',
  alarm: any | null
) => {
  if (!activeRealtimeChannel) return;
  try {
    activeRealtimeChannel.send({
      type: 'broadcast',
      event: 'alarm_action',
      payload: {
        action,
        alarm,
        deviceId: DEVICE_SESSION_ID,
        timestamp: Date.now(),
      },
    }).catch((err: any) => {
      console.warn('Realtime alarm action broadcast notice:', err);
    });
  } catch (err) {
    console.warn('Failed to broadcast alarm action:', err);
  }
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

/**
 * Test connectivity with the Supabase database.
 */
export const testSupabaseConnection = async (): Promise<{
  connected: boolean;
  message: string;
  details?: any;
}> => {
  try {
    const response = await fetch('/api/sync/workspace?user_identifier=test');
    return {
      connected: response.ok,
      message: response.ok ? 'Successfully connected to Neon Cloud Database' : 'Neon DB connection error',
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
 * Helper to detect Supabase egress quota violation errors (HTTP 402).
 */
export const isEgressQuotaError = (err: any): boolean => {
  if (!err) return false;
  const str = (typeof err === 'string' ? err : err.message || JSON.stringify(err)).toLowerCase();
  return (
    str.includes('exceed_egress_quota') ||
    str.includes('spend caps') ||
    str.includes('restricted') ||
    err.status === 402 ||
    err.code === '402'
  );
};

/**
 * Push workspace payload to applet-hosted sync relay server (/api/sync/workspace).
 */
export const syncWorkspaceToServer = async (payload: any): Promise<CloudSyncResult> => {
  try {
    const activeId = getCustomWorkspaceIdentifier();
    const activeEmail = getCustomWorkspaceEmail();
    const isNativeApk = isNativeOrMobile();

    const response = await fetch('/api/sync/workspace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_identifier: activeId,
        user_email: activeEmail,
        workspace_data: payload,
        updated_at: new Date().toISOString(),
        sync_version: Date.now(),
        is_apk: isNativeApk,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, message: err?.error || 'Server sync error' };
    }

    const res = await response.json();
    return {
      success: true,
      message: 'Workspace synced with Server Cloud Hub',
      timestamp: res.updated_at,
      data: res,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Server network error' };
  }
};

/**
 * Fetch workspace payload from applet-hosted sync relay server (/api/sync/workspace).
 */
export const fetchWorkspaceFromServer = async (): Promise<CloudSyncResult> => {
  try {
    const activeId = getCustomWorkspaceIdentifier();
    const activeEmail = getCustomWorkspaceEmail();
    const query = new URLSearchParams({
      user_identifier: activeId,
      user_email: activeEmail,
    });
    const response = await fetch(`/api/sync/workspace?${query.toString()}`);
    if (!response.ok) {
      return { success: false, message: 'Server hub query failed' };
    }
    const res = await response.json();
    if (res.exists && res.workspace_data) {
      const remoteVersion = getPayloadSyncTimestamp(
        res.workspace_data,
        res.updated_at
      );
      lastAppliedRemoteVersion = Math.max(lastAppliedRemoteVersion, remoteVersion);
      latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, remoteVersion);
      latestLocalMutationTimestamp = Math.max(latestLocalMutationTimestamp, remoteVersion);

      return {
        success: true,
        message: 'Retrieved authoritative workspace from Server Cloud Hub',
        timestamp: res.updated_at,
        data: res.workspace_data,
      };
    }
    return { success: false, message: 'No server snapshot found' };
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
    const query = new URLSearchParams({
      user_identifier: activeId,
      user_email: activeEmail,
    });
    const response = await fetch(`/api/sync/workspace?${query.toString()}`);
    if (!response.ok) return false;
    const res = await response.json();
    if (res.exists && res.updated_at) {
      return res.updated_at !== lastAppliedRemoteUpdatedAt;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Upload whole workspace state payload to Supabase database.
 */
export const syncWorkspaceToSupabase = async (
  workspacePayload: any,
  isAutoSync = false
): Promise<CloudSyncResult> => {
  if (manualWorkOfflineEnabled) {
    notifyStatus('idle');
    return { success: false, message: 'Work Offline is enabled. Cloud sync is paused.' };
  }
  const hasVersionedSession = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('notion_os_auth_token_v1')) &&
    getCustomWorkspaceIdentifier() !== 'user_guest' && getCustomWorkspaceEmail() !== 'guest@workspace.local';
  if (hasVersionedSession) {
    notifyStatus('syncing');
    const syncTimestampMs = getSyncTimestamp();
    const enrichedPayload = {
      ...workspacePayloadWithoutExpenseLedger(workspacePayload),
      _meta: { ...(workspacePayload?._meta || {}), lastDeviceId: DEVICE_SESSION_ID,
        clientTimestamp: syncTimestampMs, syncVersion: syncTimestampMs,
        ...(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
          ? { apkInstalled: true, lastApkSyncTimestamp: Date.now(), apkDeviceName: 'Android Native APK' }
          : {}) },
    };
    broadcastWorkspaceUpdate(enrichedPayload);
    try {
      return await syncWorkspaceSnapshotV2(enrichedPayload, isAutoSync);
    } catch (err: any) {
      notifyStatus('error');
      return { success: false, message: err?.message || 'Revisioned workspace sync failed.' };
    }
  }

  const client = getSupabaseClient();
  if (!client) {
    // If Supabase is unconfigured, sync to server relay directly
    notifyStatus('syncing');
    const syncTimestampMs = getSyncTimestamp();
    const isNativeApk = isNativeOrMobile();
    const enrichedPayload = {
      ...workspacePayload,
      _meta: {
        ...(workspacePayload?._meta || {}),
        lastDeviceId: DEVICE_SESSION_ID,
        clientTimestamp: syncTimestampMs,
        syncVersion: syncTimestampMs,
        ...(isNativeApk
          ? {
              apkInstalled: true,
              lastApkSyncTimestamp: Date.now(),
              apkDeviceName: 'Android Native APK',
            }
          : {}),
      },
    };

    // Broadcast immediately to peer browser tabs (<5ms)
    broadcastWorkspaceUpdate(enrichedPayload);

    const serverRes = await syncWorkspaceToServer(enrichedPayload);
    notifyStatus(serverRes.success ? 'synced' : 'idle');
    return serverRes;
  }

  // Serialize cloud writes from this device. This prevents two local flushes
  // from completing in the opposite order in which they were created.
  let resolveQueue!: () => void;
  const previousQueue = syncWriteQueue;
  syncWriteQueue = new Promise<void>((resolve) => {
    resolveQueue = resolve;
  });
  await previousQueue;

  try {
    notifyStatus('syncing');

    let syncTimestampMs = getSyncTimestamp();
    latestLocalMutationTimestamp = Math.max(
      latestLocalMutationTimestamp,
      syncTimestampMs
    );
    latestKnownRemoteTimestamp = Math.max(
      latestKnownRemoteTimestamp,
      syncTimestampMs
    );

    let now = new Date(syncTimestampMs).toISOString();

    const isNativeApk = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    const enrichedPayload = {
      ...workspacePayload,
      _meta: {
        ...(workspacePayload?._meta || {}),
        lastDeviceId: DEVICE_SESSION_ID,
        clientTimestamp: syncTimestampMs,
        syncVersion: syncTimestampMs,
        ...(isNativeApk
          ? {
              apkInstalled: true,
              lastApkSyncTimestamp: Date.now(),
              apkDeviceName: 'Android Native APK',
            }
          : {}),
      },
    };

    // Broadcast the exact same snapshot that will be persisted.
    broadcastWorkspaceUpdate(enrichedPayload);

    const activeId = getCustomWorkspaceIdentifier();
    if (activeId === 'user_guest' || activeId.startsWith('user_guest') || !activeUserEmail || activeUserEmail === 'guest@workspace.local') {
      notifyStatus('idle');
      return {
        success: false,
        message: 'Guest workspace is local-only. Sign in to sync with Supabase Cloud.',
      };
    }

    const resolvedEmail =
      activeUserEmail ||
      workspacePayload?.profile?.contactEmail ||
      'user@workspace.app';

    let authenticatedUserId: string | null = null;
    try {
      const { data: authData } = await client.auth.getUser();
      if (authData?.user?.id) {
        authenticatedUserId = authData.user.id;
      }
    } catch {
      // Offline or unauthenticated.
    }

    const payloadToSave: Record<string, any> = {
      user_identifier: activeId,
      user_email: resolvedEmail,
      workspace_data: enrichedPayload,
      updated_at: now,
    };
    if (authenticatedUserId) {
      payloadToSave.user_id = authenticatedUserId;
    }

    // Read the current cloud version before writing. Never overwrite a newer
    // remote snapshot with an older local snapshot.
    const { data: existing, error: readError } = await client
      .from('user_workspaces')
      .select('workspace_data, updated_at')
      .eq('user_identifier', activeId)
      .maybeSingle();

    if (readError) {
      console.warn('Supabase sync read notice:', readError.message || readError);
      notifyStatus('error');
      return {
        success: false,
        message: `Cloud sync notice: ${readError.message}`,
      };
    }

    if (!existing) {
      let { error: insertError } = await client
        .from('user_workspaces')
        .insert(payloadToSave);

      if (insertError && (insertError.code === '42703' || insertError.message?.includes('user_id'))) {
        delete payloadToSave.user_id;
        const retry = await client.from('user_workspaces').insert(payloadToSave);
        insertError = retry.error;
      }

      if (insertError) {
        // Another device may have created the row between our read and insert.
        // Re-read it and only update if our version is newer.
        const { data: winner } = await client
          .from('user_workspaces')
          .select('workspace_data, updated_at')
          .eq('user_identifier', activeId)
          .maybeSingle();

        const remoteVersion = getPayloadSyncTimestamp(
          winner?.workspace_data,
          winner?.updated_at
        );

        if (remoteVersion >= syncTimestampMs) {
          latestKnownRemoteTimestamp = Math.max(
            latestKnownRemoteTimestamp,
            remoteVersion
          );
          notifyStatus('synced');
          return {
            success: true,
            message: 'Newer cloud state already exists; local snapshot not overwritten.',
            timestamp: winner?.updated_at,
          };
        }

        const { error: retryUpdateError } = await client
          .from('user_workspaces')
          .update(payloadToSave)
          .eq('user_identifier', activeId)
          .lt('updated_at', now);

        if (retryUpdateError) {
          notifyStatus('error');
          return {
            success: false,
            message: `Cloud sync notice: ${retryUpdateError.message}`,
          };
        }
      }
    } else {
      const remoteVersion = getPayloadSyncTimestamp(
        existing.workspace_data,
        existing.updated_at
      );

      latestKnownRemoteTimestamp = Math.max(
        latestKnownRemoteTimestamp,
        remoteVersion
      );

      // Collect all trashed / deleted expense IDs across local payload and remote snapshot
      const trashedExpenseIds = new Set<string>();
      const addTrash = (source: any) => {
        if (Array.isArray(source?.trash)) {
          source.trash.forEach((t: any) => {
            if (t && (t.module === 'expenses' || !t.module)) {
              if (t.data?.id) trashedExpenseIds.add(String(t.data.id).trim());
              if (typeof t.data === 'string' && t.data.trim()) trashedExpenseIds.add(t.data.trim());
              if (t.id) trashedExpenseIds.add(String(t.id).trim());
            }
          });
        }
        if (Array.isArray(source?._meta?.deletedExpenseIds)) {
          source._meta.deletedExpenseIds.forEach((id: string) => {
            if (id) trashedExpenseIds.add(String(id).trim());
          });
        }
      };
      addTrash(existing.workspace_data);
      addTrash(payloadToSave.workspace_data);

      // Also read local deleted IDs and tombstoned refs from localStorage directly
      try {
        const rawDel = localStorage.getItem('notion_os_v4_deleted_expense_ids');
        if (rawDel) {
          const parsedDel = JSON.parse(rawDel);
          if (Array.isArray(parsedDel)) {
            parsedDel.forEach((id: string) => {
              if (id) trashedExpenseIds.add(String(id).trim());
            });
          }
        }
      } catch {}

      const tombstonedRefSet = new Set<string>();
      try {
        const rawTomb = localStorage.getItem('notion_os_v4_tombstoned_refs');
        if (rawTomb) {
          const parsedTomb = JSON.parse(rawTomb);
          if (Array.isArray(parsedTomb)) {
            parsedTomb.forEach((ref: string) => {
              if (ref) tombstonedRefSet.add(String(ref).trim().toUpperCase());
            });
          }
        }
      } catch {}

      // Clean local expenses of any known trashed / deleted items
      if (Array.isArray(payloadToSave.workspace_data?.expenses)) {
        payloadToSave.workspace_data.expenses = payloadToSave.workspace_data.expenses.filter(
          (e: any) => e && e.id && !trashedExpenseIds.has(String(e.id).trim())
        );
      }

      // Persist deletedExpenseIds in metadata so peer devices know these items are deleted
      if (trashedExpenseIds.size > 0 && payloadToSave.workspace_data) {
        if (!payloadToSave.workspace_data._meta) payloadToSave.workspace_data._meta = {};
        payloadToSave.workspace_data._meta.deletedExpenseIds = Array.from(trashedExpenseIds).slice(-500);
      }

      // APK-Authoritative Expense Reconciliation & Cross-Device Consistency:
      // 1. Android Native APK is authoritative for SMS-derived transactions.
      // 2. Desktop Chrome & mobile Chrome must preserve all valid committed SMS transactions
      //    from the remote workspace, while preserving user manual additions and edits.
      // 3. Deletions (trashedExpenseIds) are strictly respected across all devices.
      const remoteExpenses = Array.isArray(existing.workspace_data?.expenses)
        ? existing.workspace_data.expenses
        : [];
      let localExpenses = Array.isArray(payloadToSave.workspace_data?.expenses)
        ? payloadToSave.workspace_data.expenses
        : [];

      if (payloadToSave.workspace_data) {
        // Safely reconcile local and remote expenses
        const reconciled = mergeExpenseLists(localExpenses, remoteExpenses, trashedExpenseIds);

        // If uploading from a non-native client (e.g. desktop Chrome / mobile Chrome),
        // strictly ensure that all SMS-derived expenses committed by the APK are kept intact
        // UNLESS explicitly tombstoned or trashed.
        if (!isNativeApk && remoteExpenses.length > 0) {
          const recIdSet = new Set(reconciled.map((e: any) => String(e.id).trim()));
          const recRefSet = new Set(
            reconciled
              .map((e: any) => (e.smsReferenceId || e.referenceId || e.upiReference || '').trim().toUpperCase())
              .filter((r: string) => r.length >= 4)
          );

          remoteExpenses.forEach((remoteExp: any) => {
            if (!remoteExp || !remoteExp.id) return;
            const expId = String(remoteExp.id).trim();
            if (trashedExpenseIds.has(expId)) return;

            const remoteRef = (remoteExp.smsReferenceId || remoteExp.referenceId || remoteExp.upiReference || '').trim().toUpperCase();
            if (remoteRef && tombstonedRefSet.has(remoteRef)) return;

            const isSmsExpense =
              remoteExp.source === 'sms_auto' ||
              remoteExp.source === 'sms_rescan' ||
              expId.startsWith('exp-sms-') ||
              Boolean(remoteExp.rawSmsText || remoteExp.smsReferenceId || remoteExp.upiReference);

            if (isSmsExpense) {
              const hasIdMatch = recIdSet.has(expId);
              const hasRefMatch = remoteRef && remoteRef.length >= 4 && recRefSet.has(remoteRef);

              if (!hasIdMatch && !hasRefMatch) {
                reconciled.push(remoteExp);
                recIdSet.add(expId);
                if (remoteRef) recRefSet.add(remoteRef);
              }
            }
          });
        }

        payloadToSave.workspace_data.expenses = reconciled;
      }

      // Authoritative APK Screen Time Protection:
      // When uploading from a non-native client (e.g. Chrome / Web), NEVER overwrite
      // authentic native APK screen time records in the cloud with stale or empty web data.
      if (!isNativeApk && existing.workspace_data?.screenTime && payloadToSave.workspace_data) {
        const remoteSt = existing.workspace_data.screenTime;
        const localSt = payloadToSave.workspace_data.screenTime;
        const isRemoteApk = Boolean(
          remoteSt.isFromApk ||
          remoteSt.isNativeAndroid ||
          remoteSt.dataSource === 'usageEventsUnion' ||
          remoteSt.dataSource === 'usageStatsFallback' ||
          remoteSt.dataSource === 'android_native_apk'
        );
        const isLocalApk = Boolean(
          localSt?.isFromApk ||
          localSt?.isNativeAndroid ||
          localSt?.dataSource === 'usageEventsUnion' ||
          localSt?.dataSource === 'usageStatsFallback' ||
          localSt?.dataSource === 'android_native_apk'
        );

        if (isRemoteApk && (!isLocalApk || (remoteSt.lastSyncedTimestamp || 0) >= (localSt?.lastSyncedTimestamp || 0))) {
          payloadToSave.workspace_data.screenTime = remoteSt;
        }
      }

      if (!isNativeApk && existing.workspace_data?.screenTimeHistory && typeof existing.workspace_data.screenTimeHistory === 'object' && payloadToSave.workspace_data) {
        const mergedHistory = {
          ...existing.workspace_data.screenTimeHistory,
          ...(payloadToSave.workspace_data.screenTimeHistory || {}),
        };
        Object.entries(existing.workspace_data.screenTimeHistory).forEach(([d, val]: [string, any]) => {
          if (val && (val.isFromApk || val.isNativeAndroid || val.dataSource === 'usageEventsUnion')) {
            const localVal = payloadToSave.workspace_data?.screenTimeHistory?.[d];
            if (!localVal || !localVal.isFromApk || (val.lastSyncedTimestamp || 0) >= (localVal.lastSyncedTimestamp || 0)) {
              mergedHistory[d] = val;
            }
          }
        });
        payloadToSave.workspace_data.screenTimeHistory = mergedHistory;
      }

      // Reconcile registered devices across local payload and existing cloud workspace
      const remoteDevices = Array.isArray(existing.workspace_data?.devices) ? existing.workspace_data.devices : [];
      const localDevices = Array.isArray(payloadToSave.workspace_data?.devices) ? payloadToSave.workspace_data.devices : [];
      const deviceMap = new Map<string, any>();
      remoteDevices.forEach((d: any) => {
        if (d && d.id) deviceMap.set(d.id, d);
      });
      localDevices.forEach((d: any) => {
        if (d && d.id) {
          const ex = deviceMap.get(d.id);
          if (!ex) {
            deviceMap.set(d.id, d);
          } else {
            deviceMap.set(d.id, {
              ...ex,
              ...d,
              deviceName: d.deviceName || ex.deviceName,
              lastActive: Math.max(ex.lastActive || 0, d.lastActive || 0),
              createdAt: Math.min(ex.createdAt || Date.now(), d.createdAt || Date.now()),
            });
          }
        }
      });
      if (payloadToSave.workspace_data) {
        payloadToSave.workspace_data.devices = Array.from(deviceMap.values());
      }

      if (remoteVersion >= syncTimestampMs) {
        // Monotonically advance sync clock ahead of remote snapshot to ensure user's local mutation is preserved
        syncTimestampMs = remoteVersion + 1000;
        latestLocalMutationTimestamp = syncTimestampMs;
        try {
          localStorage.setItem('lifeos_workspace_sync_clock', String(syncTimestampMs));
        } catch {}
        now = new Date(syncTimestampMs).toISOString();
        payloadToSave.updated_at = now;
        if (payloadToSave.workspace_data?._meta) {
          payloadToSave.workspace_data._meta.syncVersion = syncTimestampMs;
          payloadToSave.workspace_data._meta.clientTimestamp = syncTimestampMs;
        }
      }

      // Optimistic Concurrency Control (OCC): ensure we don't clobber a concurrent remote update
      let updateQuery = client
        .from('user_workspaces')
        .update(payloadToSave)
        .eq('user_identifier', activeId);

      if (existing && existing.updated_at) {
        updateQuery = updateQuery.eq('updated_at', existing.updated_at);
      }

      let { data: updatedRows, error: updateError } = await updateQuery.select('updated_at');

      if (updateError && (updateError.code === '42703' || updateError.message?.includes('user_id'))) {
        delete payloadToSave.user_id;
        let retryQuery = client
          .from('user_workspaces')
          .update(payloadToSave)
          .eq('user_identifier', activeId);
        if (existing && existing.updated_at) {
          retryQuery = retryQuery.eq('updated_at', existing.updated_at);
        }
        const retryUpdate = await retryQuery.select('updated_at');
        updatedRows = retryUpdate.data;
        updateError = retryUpdate.error;
      }

      // If OCC conflict detected (0 rows updated because remote row was modified concurrently)
      if (!updateError && existing && existing.updated_at && (!updatedRows || updatedRows.length === 0)) {
        console.warn('[SUPABASE_SYNC] OCC conflict detected: remote workspace updated concurrently. Re-fetching and merging...');
        const { data: freshRemote } = await client
          .from('user_workspaces')
          .select('id, user_identifier, workspace_data, updated_at')
          .eq('user_identifier', activeId)
          .maybeSingle();

        if (freshRemote && freshRemote.workspace_data) {
          const freshRemoteExpenses = Array.isArray(freshRemote.workspace_data.expenses) ? freshRemote.workspace_data.expenses : [];
          const curExpenses = Array.isArray(payloadToSave.workspace_data?.expenses) ? payloadToSave.workspace_data.expenses : [];
          const reconciledExpenses = mergeExpenseLists(curExpenses, freshRemoteExpenses, trashedExpenseIds);
          if (payloadToSave.workspace_data) {
            payloadToSave.workspace_data.expenses = reconciledExpenses;
          }
          const freshVersion = getPayloadSyncTimestamp(freshRemote.workspace_data, freshRemote.updated_at);
          syncTimestampMs = Math.max(syncTimestampMs, freshVersion + 1000);
          now = new Date(syncTimestampMs).toISOString();
          payloadToSave.updated_at = now;
          if (payloadToSave.workspace_data?._meta) {
            payloadToSave.workspace_data._meta.syncVersion = syncTimestampMs;
            payloadToSave.workspace_data._meta.clientTimestamp = syncTimestampMs;
          }

          const occRetry = await client
            .from('user_workspaces')
            .update(payloadToSave)
            .eq('user_identifier', activeId)
            .eq('updated_at', freshRemote.updated_at)
            .select('updated_at');

          if (!occRetry.error) {
            updatedRows = occRetry.data;
          } else {
            updateError = occRetry.error;
          }
        }
      }

      if (updateError) {
        console.warn(
          'Supabase update notice:',
          updateError.message || updateError
        );
        notifyStatus('error');
        return {
          success: false,
          message: `Cloud sync notice: ${updateError.message}`,
        };
      }
    }

    latestKnownRemoteTimestamp = Math.max(
      latestKnownRemoteTimestamp,
      syncTimestampMs
    );
    notifyStatus('synced');

    return {
      success: true,
      message: isAutoSync
        ? 'Auto-synced to Supabase'
        : 'Workspace successfully backed up to Supabase Cloud',
      timestamp: now,
    };
  } catch (err: any) {
    console.warn('Supabase sync notice:', err?.message || 'Network delay');
    notifyStatus('error');
    return {
      success: false,
      message: `Sync notice: ${err?.message || 'Network failure'}`,
    };
  } finally {
    resolveQueue();
  }
};

import { ConnectionPolicyManager } from '../services/connectionPolicy';

let manualWorkOfflineEnabled = false;

export const isWorkOfflineMode = (): boolean => {
  if (manualWorkOfflineEnabled) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return false;
};

export const setWorkOfflineMode = (val: boolean): void => {
  manualWorkOfflineEnabled = !!val;
  if (manualWorkOfflineEnabled) {
    if (broadcastSyncTimeout) clearTimeout(broadcastSyncTimeout);
    if (autoSyncTimeout) clearTimeout(autoSyncTimeout);
    broadcastSyncTimeout = null;
    autoSyncTimeout = null;
  }
};

/**
 * Schedule high-speed auto-sync to Supabase.
 * Broadcasts to connected devices within 150ms and persists to PostgreSQL within 600ms.
 */
export const scheduleAutoSyncToSupabase = (
  payloadGetter: () => any,
  delayMs = 600
) => {
  if (manualWorkOfflineEnabled) return;
  if (isWorkOfflineMode()) {
    try {
      const activeId = getCustomWorkspaceIdentifier();
      if (!activeId || activeId === 'user_guest' || activeId.startsWith('user_guest') ||
          !activeUserEmail || activeUserEmail === 'guest@workspace.local') return;
      const payload = payloadGetter();
      if (payload) {
        void queueWorkspaceSnapshot(getCustomWorkspaceIdentifier(), payload);
      }
    } catch {}
    return;
  }
  const activeId = getCustomWorkspaceIdentifier();
  const hasV2Session = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('notion_os_auth_token_v1')) && activeId !== 'user_guest';
  if (!isSupabaseConfigured() && !hasV2Session) return;
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
        await syncWorkspaceToSupabase(payload, true);
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
  syncFn: (payload: any, isAutoSync?: boolean) => Promise<CloudSyncResult> = syncWorkspaceToSupabase
): Promise<CloudSyncResult | void> => {
  if (manualWorkOfflineEnabled) return;
  if (isWorkOfflineMode()) {
    if (payload && getCustomWorkspaceIdentifier() !== 'user_guest') {
      await queueWorkspaceSnapshot(getCustomWorkspaceIdentifier(), payload);
    }
    return;
  }
  const activeId = getCustomWorkspaceIdentifier();
  const hasV2Session = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('notion_os_auth_token_v1')) && activeId !== 'user_guest';
  if ((!isSupabaseConfigured() && !hasV2Session) || !payload) return;
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
 * Listen to live real-time changes across devices via Supabase Realtime websocket channels.
 * Supports both instant broadcast events (<30ms) and postgres database updates.
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

  // 1. Instant Cross-Tab Synchronization via modern Browser BroadcastChannel (<5ms)
  const tabChannel = getTabBroadcastChannel();
  const handleTabBroadcast = (event: MessageEvent) => {
    if (isDestroyed) return;
    try {
      const msg = event?.data;
      if (!msg) return;

      // Handle remote device revocation command
      if (msg.type === 'device_logout_command' && onDeviceRevoked) {
        if (msg.targetDeviceId === DEVICE_SESSION_ID || msg.targetDeviceId === '*' || msg.forceAllDevices) {
          onDeviceRevoked();
        }
        return;
      }

      // Ignore echoes from this exact tab session
      if (msg.deviceId === DEVICE_SESSION_ID) return;

      // Ensure message belongs to the current active workspace
      const currentWorkspaceId = getCustomWorkspaceIdentifier();
      if (msg.workspaceId && currentWorkspaceId && msg.workspaceId !== currentWorkspaceId) return;

      if (msg.type === 'workspace_sync' && msg.data) {
        const remoteVersion = getPayloadSyncTimestamp(msg.data, msg.timestamp);
        lastAppliedRemoteVersion = Math.max(lastAppliedRemoteVersion, remoteVersion);
        lastAppliedRemoteUpdatedAt = msg.timestamp || new Date(remoteVersion).toISOString();
        latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, remoteVersion);
        latestLocalMutationTimestamp = Math.max(latestLocalMutationTimestamp, remoteVersion);

        onRemoteChange(msg.data, lastAppliedRemoteUpdatedAt);
        notifyStatus('synced');
      }
    } catch (e) {
      console.warn('Cross-tab broadcast listener error:', e);
    }
  };

  if (tabChannel) {
    tabChannel.addEventListener('message', handleTabBroadcast);
  }

  // 1.5. Full-duplex WebSocket live sync hub listener (<20ms across devices)
  const unsubRealtimeWs = realtimeHub.subscribeUpdates((msg: any) => {
    if (isDestroyed) return;
    try {
      if (msg && msg.type === 'WORKSPACE_UPDATED') {
        if (msg.sourceDeviceId === DEVICE_SESSION_ID) return;
        const incoming = msg.fullWorkspace || msg.payload;
        if (incoming) {
          const remoteVersion = msg.vectorTimestamp || msg.syncVersion || Date.now();
          lastAppliedRemoteVersion = Math.max(lastAppliedRemoteVersion, remoteVersion);
          lastAppliedRemoteUpdatedAt = msg.timestamp || new Date(remoteVersion).toISOString();
          latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, remoteVersion);
          latestLocalMutationTimestamp = Math.max(latestLocalMutationTimestamp, remoteVersion);

          onRemoteChange(incoming, lastAppliedRemoteUpdatedAt);
          notifyStatus('synced');
        }
      }
    } catch (e) {
      console.warn('[RealtimeHub] Error handling workspace update in subscriber:', e);
    }
  });

  // 2. Cross-tab storage event listener: when another tab updates localStorage
  const handleStorageEvent = (e: StorageEvent) => {
    if (isDestroyed) return;
    if (e.key === 'lifeos_workspace_sync_clock' || (e.key && e.key.includes('_notion_os_v4_'))) {
      void pollServerWorkspace();
    }
  };
  // 3. Fast Server Check against Neon DB Server (/api/sync/workspace)
  const pollServerWorkspace = async () => {
    if (isDestroyed) return;
    try {
      const res = await fetchWorkspaceFromServer();
      if (res.success && res.data && !isDestroyed) {
        const remoteVersion = getPayloadSyncTimestamp(res.data, res.timestamp);
        if (remoteVersion > lastAppliedRemoteVersion || (res.timestamp && res.timestamp !== lastAppliedRemoteUpdatedAt)) {
          lastAppliedRemoteVersion = Math.max(lastAppliedRemoteVersion, remoteVersion);
          lastAppliedRemoteUpdatedAt = res.timestamp || new Date(remoteVersion).toISOString();
          latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, remoteVersion);
          latestLocalMutationTimestamp = Math.max(latestLocalMutationTimestamp, remoteVersion);

          onRemoteChange(res.data, lastAppliedRemoteUpdatedAt);
          notifyStatus('synced');
        }
      }
    } catch {
      // Ignore background poll errors
    }
  };

  // Poll server every 4 seconds when tab is active/visible
  const pollInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void pollServerWorkspace();
    }
  }, 4000);

  // Poll immediately on window focus and visibility change
  const handleFocusOrVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void pollServerWorkspace();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('focus', handleFocusOrVisibility);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleFocusOrVisibility);
  }

  // 4. Fallback to Supabase WebSocket channel if configured
  const client = getSupabaseClient();
  let cleanUpChannel: (() => void) | null = null;

  if (client) {
    try {
      const channelName = `realtime_workspace_${activeId}`;
      if (activeRealtimeChannel) {
        try {
          client.removeChannel(activeRealtimeChannel);
        } catch {}
        activeRealtimeChannel = null;
      }

      const channel = client
        .channel(channelName, {
          config: {
            broadcast: { self: false, ack: false },
            presence: { key: DEVICE_SESSION_ID },
          },
        })
        .on('presence', { event: 'sync' }, () => {
          try {
            notifyPresenceListeners(channel.presenceState());
          } catch {}
        })
        .on('broadcast', { event: 'workspace_sync' }, (res: any) => {
          try {
            const payload = res?.payload;
            if (!payload || !payload.data || payload.deviceId === DEVICE_SESSION_ID) return;
            const remoteVersion = getPayloadSyncTimestamp(payload.data, payload.timestamp);
            lastAppliedRemoteVersion = Math.max(lastAppliedRemoteVersion, remoteVersion);
            lastAppliedRemoteUpdatedAt = payload.timestamp || '';
            onRemoteChange(payload.data, payload.timestamp || new Date(remoteVersion).toISOString());
            notifyStatus('synced');
          } catch (e) {
            console.warn('Realtime broadcast payload error:', e);
          }
        })
        .subscribe();

      activeRealtimeChannel = channel;
      cleanUpChannel = () => {
        try {
          if (activeRealtimeChannel === channel) {
            client.removeChannel(channel);
            activeRealtimeChannel = null;
          }
        } catch {}
      };
    } catch {
      // Ignore websocket fallback error
    }
  }

  return () => {
    isDestroyed = true;
    if (tabChannel) {
      tabChannel.removeEventListener('message', handleTabBroadcast);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', handleFocusOrVisibility);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    }
    clearInterval(pollInterval);
    unsubRealtimeWs();
    if (cleanUpChannel) {
      cleanUpChannel();
    }
  };
};

export const getActiveRealtimeChannel = () => activeRealtimeChannel;

/**
 * Fetch latest workspace payload from Supabase database.
 */
export const fetchWorkspaceFromSupabase = async (): Promise<CloudSyncResult> => {
  const activeId = getCustomWorkspaceIdentifier();
  if (activeId === 'user_guest' || activeId.startsWith('user_guest') || !activeUserEmail || activeUserEmail === 'guest@workspace.local') {
    return {
      success: false,
      message: 'Guest workspace is local-only.',
    };
  }

  const sessionToken = typeof localStorage !== 'undefined' ? localStorage.getItem('notion_os_auth_token_v1') || '' : '';
  if (sessionToken) {
    try {
      const revisionKey = `notion_os_workspace_v2_revision_${activeId}`;
      const cursorKey = `notion_os_workspace_v2_cursor_${activeId}`;
      const result = await fetchWorkspaceSnapshotV2({
        workspaceIdentifier: activeId,
        userEmail: getCustomWorkspaceEmail(),
        deviceId: DEVICE_SESSION_ID,
        bearerToken: sessionToken,
        cursor: localStorage.getItem(cursorKey) || '0',
      });
      if (result.snapshot?.payload) {
        localStorage.setItem(revisionKey, String(result.snapshot.revision));
        const workspacePayload = workspacePayloadWithoutExpenseLedger(result.snapshot.payload);
        localStorage.setItem(cursorKey, result.next_cursor || '0');
        return { success: true, message: 'Retrieved revisioned workspace snapshot.', data: workspacePayload,
          timestamp: new Date().toISOString(), revision: result.snapshot.revision, cursor: result.next_cursor || '0' };
      }
    } catch (err) {
      console.warn('[SYNC_V2] Snapshot read fallback:', err);
    }
  }

  const client = getSupabaseClient();
  if (!client) {
    const serverResult = await fetchWorkspaceFromServer();
    if (serverResult.success && serverResult.data) {
      return serverResult;
    }
    return {
      success: false,
      message: 'Server hub query returned no existing snapshot. Local data remains active.',
    };
  }

  try {
    let { data, error } = await client
      .from('user_workspaces')
      .select('workspace_data, updated_at')
      .eq('user_identifier', activeId)
      .maybeSingle();

    // Migration fallback for existing accounts: check if existing workspace exists under user_email
    if (!error && (!data || !data.workspace_data) && activeUserEmail) {
      const isGknUser = activeUserEmail === '' || activeUserEmail === '';
      const emailFilter = `user_email.eq.${activeUserEmail}`;

      const { data: legacyRow, error: legacyErr } = await client
        .from('user_workspaces')
        .select('workspace_data, updated_at, user_identifier')
        .or(emailFilter)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!legacyErr && legacyRow && legacyRow.workspace_data && !legacyRow.user_identifier.startsWith('account_')) {
        data = legacyRow;
      }
    }

    if (error || !data || !data.workspace_data) {
      // Check server hub fallback
      const serverResult = await fetchWorkspaceFromServer();
      if (serverResult.success && serverResult.data) {
        return serverResult;
      }
      if (error) {
        return {
          success: false,
          message: `Failed to retrieve cloud data: ${error.message}`,
        };
      }
      return {
        success: false,
        message: 'No existing cloud data found for this workspace. Ready for initial migration.',
      };
    }

    // Ensure authentic habits and expenses for primary accounts are never returned as empty
    const isGknAccount = activeUserEmail === '' || activeUserEmail === '';
    if (isGknAccount && data.workspace_data) {
      if (!Array.isArray(data.workspace_data.habits) || data.workspace_data.habits.length === 0) {
        data.workspace_data.habits = [...OWNER_GKN_HABITS];
      }
      if (!Array.isArray(data.workspace_data.expenses) || data.workspace_data.expenses.length === 0) {
        data.workspace_data.expenses = [...OWNER_GKN_EXPENSES];
      }
    }

    const remoteVersion = getPayloadSyncTimestamp(
      data.workspace_data,
      data.updated_at
    );
    lastAppliedRemoteVersion = Math.max(
      lastAppliedRemoteVersion,
      remoteVersion
    );
    latestKnownRemoteTimestamp = Math.max(
      latestKnownRemoteTimestamp,
      remoteVersion
    );
    latestLocalMutationTimestamp = Math.max(
      latestLocalMutationTimestamp,
      remoteVersion
    );

    return {
      success: true,
      message: 'Successfully retrieved cloud data from Supabase',
      timestamp: data.updated_at,
      data: data.workspace_data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Cloud retrieval error: ${err?.message || 'Network failure'}`,
    };
  }
};

/**
 * Fast check to see if Supabase Cloud has a newer workspace version than what
 * this device has currently applied. Ideal for lightweight visibility/periodic polling.
 */
export const checkHasNewerCloudWorkspace = async (): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !isSupabaseConfigured()) {
    return await checkHasNewerServerWorkspace();
  }

  try {
    const activeId = getCustomWorkspaceIdentifier();
    if (activeId === 'user_guest' || activeId.startsWith('user_guest') || !activeUserEmail || activeUserEmail === 'guest@workspace.local') {
      return false;
    }
    // Egress optimization: ONLY select updated_at (tiny ~30-byte string), NEVER workspace_data (megabytes)!
    const { data, error } = await client
      .from('user_workspaces')
      .select('updated_at')
      .eq('user_identifier', activeId)
      .maybeSingle();

    if (error || !data) {
      return await checkHasNewerServerWorkspace();
    }

    const remoteUpdatedAt = data.updated_at || '';
    if (remoteUpdatedAt && remoteUpdatedAt !== lastAppliedRemoteUpdatedAt) {
      return true;
    }
    return await checkHasNewerServerWorkspace();
  } catch {
    return await checkHasNewerServerWorkspace();
  }
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

/**
 * Upload a file/image to Supabase Storage Bucket.
 */
export const uploadFileToSupabaseStorage = async (
  bucket: string,
  filePath: string,
  file: File | Blob
): Promise<{ url: string | null; error: string | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      url: null,
      error: 'Supabase storage is not configured.',
    };
  }

  try {
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      return { url: null, error: uploadError.message };
    }

    const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      error: null,
    };
  } catch (err: any) {
    return {
      url: null,
      error: err?.message || 'Unknown storage upload error',
    };
  }
};

/**
 * Pushes individual expense mutations to the dedicated `public.user_expenses` table.
 * Supports creates, updates, and soft-delete tombstones.
 */
export const pushExpenseMutationsToDedicatedTable = async (
  mutations: OutboxMutation[]
): Promise<{
  success: boolean;
  pushedIds: string[];
  serverTombstonedIds?: string[];
  conflictRejectedMutationIds?: string[];
  error?: string;
  isFallbackNeeded?: boolean;
}> => {
  if (!mutations || mutations.length === 0) {
    return { success: true, pushedIds: [] };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, pushedIds: [], error: 'Supabase client not configured', isFallbackNeeded: true };
  }

  const activeId = getCustomWorkspaceIdentifier();
  const resolvedEmail = activeUserEmail || 'user@workspace.app';

  let authenticatedUserId: string | null = null;
  try {
    const { data: authData } = await client.auth.getUser();
    if (authData?.user?.id) {
      authenticatedUserId = authData.user.id;
    }
  } catch {
    // Offline or session unavailable
  }

  const recordsToUpsert: any[] = [];
  const inFlightMutationIds: string[] = [];

  for (const mut of mutations) {
    if (!mut) continue;
    inFlightMutationIds.push(mut.id);

    if (mut.action === 'delete') {
      const delId = String(mut.expenseId || mut.payload?.id || '').trim();
      if (!delId) continue;
      const targetExp = (mut.data || mut.payload?.expense || {}) as Partial<ExpenseItem>;
      recordsToUpsert.push({
        id: delId,
        user_id: authenticatedUserId || undefined,
        workspace_identifier: activeId,
        user_email: resolvedEmail,
        name: (targetExp.name || 'Expense').trim(),
        amount: Number(targetExp.amount) || 0,
        category: (targetExp.category || 'Other').trim(),
        date: targetExp.date || getLocalDateKey(),
        time: targetExp.time || null,
        direction: targetExp.direction || 'DEBIT',
        payment_method: targetExp.paymentMethod || null,
        bank_name: targetExp.bankName || targetExp.bankOrAccount || null,
        account_last4: targetExp.accountLast4 || null,
        reference_id: targetExp.referenceId || null,
        sms_reference_id: targetExp.smsReferenceId || null,
        active: false,
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        client_updated_at: mut.timestamp || Date.now(),
        updated_at: new Date().toISOString(),
        version: 1,
      });
    } else if (mut.action === 'batch_delete') {
      const ids: string[] = Array.isArray(mut.payload?.ids) ? mut.payload.ids : [mut.expenseId];
      const itemsMap = new Map<string, Partial<ExpenseItem>>();
      if (Array.isArray(mut.payload?.expenses)) {
        mut.payload.expenses.forEach((e: any) => {
          if (e && e.id) itemsMap.set(String(e.id).trim(), e);
        });
      }
      ids.forEach((delId) => {
        const cleanId = String(delId).trim();
        if (!cleanId) return;
        const targetExp = itemsMap.get(cleanId) || {};
        recordsToUpsert.push({
          id: cleanId,
          user_id: authenticatedUserId || undefined,
          workspace_identifier: activeId,
          user_email: resolvedEmail,
          name: (targetExp.name || 'Expense').trim(),
          amount: Number(targetExp.amount) || 0,
          category: (targetExp.category || 'Other').trim(),
          date: targetExp.date || getLocalDateKey(),
          time: targetExp.time || null,
          direction: targetExp.direction || 'DEBIT',
          payment_method: targetExp.paymentMethod || null,
          bank_name: targetExp.bankName || targetExp.bankOrAccount || null,
          account_last4: targetExp.accountLast4 || null,
          reference_id: targetExp.referenceId || null,
          sms_reference_id: targetExp.smsReferenceId || null,
          active: false,
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          client_updated_at: mut.timestamp || Date.now(),
          updated_at: new Date().toISOString(),
          version: 1,
        });
      });
    } else {
      // create or update
      const item = (mut.data || mut.payload) as ExpenseItem;
      if (!item || !item.id) continue;
      const cleanId = String(item.id).trim();

      const isCredit =
        item.direction === 'CREDIT' ||
        item.transactionType === 'CREDIT' ||
        item.transactionType === 'income' ||
        (item as any).type === 'income' ||
        (item as any).type === 'CREDIT';
      const direction: 'DEBIT' | 'CREDIT' = isCredit ? 'CREDIT' : 'DEBIT';

      const rawAmount = Number(item.amount);
      const safeAmount = Number.isFinite(rawAmount) ? Math.round(Math.abs(rawAmount) * 100) / 100 : 0;

      recordsToUpsert.push({
        id: cleanId,
        user_id: authenticatedUserId || undefined,
        workspace_identifier: activeId,
        user_email: resolvedEmail,
        name: (item.name || 'Expense').trim() || 'Expense',
        amount: safeAmount,
        category: (item.category || 'Other').trim() || 'Other',
        date: normalizeExpenseDateKey(item.date) || getLocalDateKey(),
        time: item.time || null,
        direction,
        payment_method: item.paymentMethod || null,
        billing_cycle: item.billingCycle || null,
        notes: item.notes || null,
        bank_name: item.bankName || item.bankOrAccount || null,
        masked_account: item.maskedAccount || null,
        account_last4: item.accountLast4 || null,
        reference_id: item.referenceId || null,
        sms_reference_id: item.smsReferenceId || null,
        upi_reference: item.upiReference || null,
        raw_sms_text: item.rawSmsText || null,
        merchant: item.merchant || null,
        payee: item.payee || null,
        source: item.source || 'manual',
        source_file: item.sourceFile || null,
        import_batch_id: item.importBatchId || null,
        active: item.active !== false,
        is_deleted: false,
        deleted_at: null,
        client_updated_at: Number(item.updatedAt) || Date.now(),
        updated_at: new Date().toISOString(),
        version: 1,
      });
    }
  }

  if (recordsToUpsert.length === 0) {
    return { success: true, pushedIds: inFlightMutationIds };
  }

  try {
    let { data: returnedRows, error } = await client
      .from('user_expenses')
      .upsert(recordsToUpsert, { onConflict: 'id' })
      .select('id, version, client_updated_at, is_deleted, amount, name, updated_at');

    // Handle column / schema variations gracefully (e.g. if user_id column is omitted or restricted)
    if (error && (error.code === '42703' || error.message?.includes('user_id'))) {
      const recordsWithoutUserId = recordsToUpsert.map((r) => {
        const copy = { ...r };
        delete copy.user_id;
        return copy;
      });
      const retry = await client
        .from('user_expenses')
        .upsert(recordsWithoutUserId, { onConflict: 'id' })
        .select('id, version, client_updated_at, is_deleted, amount, name, updated_at');
      error = retry.error;
      returnedRows = retry.data;
    }

    if (error) {
      const isMissingTable = error.code === '42P01' || error.message?.includes('relation "public.user_expenses" does not exist');
      console.warn('[EXPENSE_DEDICATED_SYNC] Table write error:', error.message);
      return {
        success: false,
        pushedIds: [],
        error: error.message,
        isFallbackNeeded: isMissingTable,
      };
    }

    const verifiedPushedIds: string[] = [];
    const serverTombstonedIds: string[] = [];
    const conflictRejectedMutationIds: string[] = [];

    if (Array.isArray(returnedRows) && returnedRows.length > 0) {
      const returnedMap = new Map<string, any>();
      for (const row of returnedRows) {
        if (row && row.id) {
          returnedMap.set(String(row.id).trim(), row);
        }
      }

      for (const mut of mutations) {
        const cleanExpId = String(mut.expenseId || mut.id).trim();
        const row = returnedMap.get(cleanExpId);
        if (!row) {
          console.warn('[EXPENSE_DEDICATED_SYNC] Mutation unacknowledged by server:', { mutationId: mut.id, expenseId: cleanExpId });
          continue;
        }

        if (mut.action === 'delete') {
          // Deletion mutation must have is_deleted === true on server
          if (row.is_deleted === true) {
            verifiedPushedIds.push(mut.id);
          } else {
            console.warn('[EXPENSE_DEDICATED_SYNC] Deletion mutation unconfirmed (server has is_deleted=false):', cleanExpId);
          }
        } else {
          // Create or update mutation: server must accept write (is_deleted === false)
          // If server kept is_deleted === true, trigger rejected resurrection!
          if (row.is_deleted !== true) {
            verifiedPushedIds.push(mut.id);
          } else {
            console.warn('[TOMBSTONE_DIAGNOSTIC] Server rejected resurrection: expense was deleted on server. Tombstone enforced:', cleanExpId);
            serverTombstonedIds.push(cleanExpId);
            conflictRejectedMutationIds.push(mut.id);
          }
        }
      }
    } else {
      // Fallback if environment doesn't return rows with select
      verifiedPushedIds.push(...inFlightMutationIds);
    }

    return {
      success: true,
      pushedIds: verifiedPushedIds,
      serverTombstonedIds,
      conflictRejectedMutationIds,
    };
  } catch (err: any) {
    return {
      success: false,
      pushedIds: [],
      error: err?.message || 'Network failure',
      isFallbackNeeded: false,
    };
  }
};

/**
 * Fetches expenses and tombstones directly from `public.user_expenses`.
 */
export const fetchExpensesFromDedicatedTable = async (): Promise<{
  success: boolean;
  data: ExpenseItem[];
  tombstones: string[];
  error?: string;
  isFallbackNeeded?: boolean;
}> => {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, data: [], tombstones: [], error: 'Supabase client not configured', isFallbackNeeded: true };
  }

  const activeId = getCustomWorkspaceIdentifier();
  if (activeId === 'user_guest' || !activeUserEmail || activeUserEmail === 'guest@workspace.local') {
    return { success: false, data: [], tombstones: [], error: 'Guest workspace is local-only', isFallbackNeeded: false };
  }

  try {
    let query = client.from('user_expenses').select('*');

    if (activeUserEmail) {
      query = query.or(`workspace_identifier.eq.${activeId},user_email.eq.${activeUserEmail}`);
    } else {
      query = query.eq('workspace_identifier', activeId);
    }

    const { data: rows, error } = await query;

    if (error) {
      const isMissingTable = error.code === '42P01' || error.message?.includes('relation "public.user_expenses" does not exist');
      console.warn('[EXPENSE_DEDICATED_SYNC] Table fetch notice:', error.message);
      return {
        success: false,
        data: [],
        tombstones: [],
        error: error.message,
        isFallbackNeeded: isMissingTable,
      };
    }

    if (!Array.isArray(rows)) {
      return { success: true, data: [], tombstones: [] };
    }

    const activeExpenses: ExpenseItem[] = [];
    const tombstones: string[] = [];

    for (const r of rows) {
      if (!r || !r.id) continue;
      const idStr = String(r.id).trim();

      if (r.is_deleted === true) {
        tombstones.push(idStr);
        continue;
      }

      const item: ExpenseItem = {
        id: idStr,
        name: r.name || 'Expense',
        amount: Number(r.amount) || 0,
        category: r.category || 'Other',
        date: r.date || getLocalDateKey(),
        time: r.time || undefined,
        direction: r.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        transactionType: r.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        paymentMethod: r.payment_method || undefined,
        billingCycle: r.billing_cycle || undefined,
        notes: r.notes || undefined,
        bankName: r.bank_name || undefined,
        bankOrAccount: r.bank_name || undefined,
        maskedAccount: r.masked_account || undefined,
        accountLast4: r.account_last4 || undefined,
        referenceId: r.reference_id || undefined,
        smsReferenceId: r.sms_reference_id || undefined,
        upiReference: r.upi_reference || undefined,
        rawSmsText: r.raw_sms_text || undefined,
        merchant: r.merchant || undefined,
        payee: r.payee || undefined,
        source: r.source || 'manual',
        sourceFile: r.source_file || undefined,
        importBatchId: r.import_batch_id || undefined,
        active: r.active !== false,
        createdAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
        updatedAt: r.client_updated_at ? Number(r.client_updated_at) : (r.updated_at ? new Date(r.updated_at).getTime() : Date.now()),
      };

      activeExpenses.push(item);
    }

    return {
      success: true,
      data: activeExpenses,
      tombstones,
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      tombstones: [],
      error: err?.message || 'Network failure',
      isFallbackNeeded: false,
    };
  }
};

/**
 * Safe, idempotent migration of legacy JSONB workspace expenses into `public.user_expenses`.
 */
export const migrateJsonbExpensesToDedicatedTable = async (
  options?: { force?: boolean }
): Promise<{ migratedCount: number; success: boolean; message: string }> => {
  const activeId = getCustomWorkspaceIdentifier();
  const migrationKey = `lifeos_expenses_migrated_${activeId}`;

  if (!options?.force && typeof localStorage !== 'undefined' && localStorage.getItem(migrationKey)) {
    return { success: true, migratedCount: 0, message: 'Expenses already migrated to dedicated table' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, migratedCount: 0, message: 'Supabase client not configured' };
  }

  try {
    const remoteWorkspace = await fetchWorkspaceFromSupabase();
    const remoteExpenses: ExpenseItem[] = remoteWorkspace.success && Array.isArray(remoteWorkspace.data?.expenses)
      ? remoteWorkspace.data.expenses
      : [];

    const localRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('notion_os_expenses_v1') : null;
    let localExpenses: ExpenseItem[] = [];
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed)) localExpenses = parsed;
      } catch {}
    }

    const combinedMap = new Map<string, ExpenseItem>();
    localExpenses.forEach((e) => {
      if (e && e.id) combinedMap.set(String(e.id).trim(), e);
    });
    remoteExpenses.forEach((e) => {
      if (e && e.id) {
        const cleanId = String(e.id).trim();
        const existing = combinedMap.get(cleanId);
        if (!existing || Number(e.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
          combinedMap.set(cleanId, e);
        }
      }
    });

    const itemsToMigrate = Array.from(combinedMap.values());
    if (itemsToMigrate.length === 0) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(migrationKey, JSON.stringify({ timestamp: Date.now(), count: 0 }));
      }
      return { success: true, migratedCount: 0, message: 'No existing JSONB expenses to migrate' };
    }

    const batchSize = 50;
    let totalMigrated = 0;

    for (let i = 0; i < itemsToMigrate.length; i += batchSize) {
      const slice = itemsToMigrate.slice(i, i + batchSize);
      const fakeMutations: OutboxMutation[] = slice.map((item) => ({
        id: `mig-${item.id}`,
        expenseId: item.id,
        action: 'create',
        data: item,
        timestamp: Number(item.updatedAt) || Date.now(),
        retryCount: 0,
      }));

      const pushRes = await pushExpenseMutationsToDedicatedTable(fakeMutations);
      if (!pushRes.success && pushRes.isFallbackNeeded) {
        return {
          success: false,
          migratedCount: totalMigrated,
          message: 'Dedicated table not available; remaining in JSONB workspace mode.',
        };
      }
      if (pushRes.success) {
        totalMigrated += slice.length;
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        migrationKey,
        JSON.stringify({ timestamp: Date.now(), count: totalMigrated })
      );
    }

    console.info(`[EXPENSE_MIGRATION] Successfully migrated ${totalMigrated} expenses to dedicated table`);
    return {
      success: true,
      migratedCount: totalMigrated,
      message: `Successfully migrated ${totalMigrated} expenses to public.user_expenses`,
    };
  } catch (err: any) {
    return {
      success: false,
      migratedCount: 0,
      message: `Migration error: ${err?.message || 'Unknown error'}`,
    };
  }
};

/**
 * Standard SQL DDL Schema for Supabase Free Tier
 */
export const SUPABASE_SQL_SCHEMA = `-- =========================================================================
-- SUPABASE POSTGRESQL PRODUCTION SECURITY SCHEMA FOR PERSONAL DASHBOARD
-- =========================================================================

-- 1. Create the user_workspaces table for cloud synchronization
CREATE TABLE IF NOT EXISTS public.user_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_identifier TEXT UNIQUE NOT NULL,
    user_email TEXT,
    workspace_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_user_workspaces_user_id ON public.user_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspaces_identifier ON public.user_workspaces(user_identifier);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;

-- 3. Revoke insecure open policies if previously set
DROP POLICY IF EXISTS "Allow public read of user workspaces" ON public.user_workspaces;
DROP POLICY IF EXISTS "Allow public insert/update of user workspaces" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can read own workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can insert own workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can update own workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can delete own workspace" ON public.user_workspaces;

-- 4. Secure RLS Policies: Authenticated users can only access their own workspace
CREATE POLICY "Users can read own workspace"
ON public.user_workspaces
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

CREATE POLICY "Users can insert own workspace"
ON public.user_workspaces
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

CREATE POLICY "Users can update own workspace"
ON public.user_workspaces
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
)
WITH CHECK (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

CREATE POLICY "Users can delete own workspace"
ON public.user_workspaces
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

-- 5. Realtime publication for multi-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_workspaces;

-- 6. Storage Buckets Configuration
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('workspace_media', 'workspace_media', false),
    ('avatars', 'avatars', true),
    ('covers', 'covers', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Drop legacy storage policies
DROP POLICY IF EXISTS "Public Media Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own private media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view portfolio assets" ON storage.objects;

-- Storage object policies: Only authenticated users can upload to their own folder path
CREATE POLICY "Authenticated users can upload own media" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id IN ('workspace_media', 'avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own media" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
    bucket_id IN ('workspace_media', 'avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own media" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id IN ('workspace_media', 'avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Workspace media is private to authenticated owner
CREATE POLICY "Users can read own private media" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
    bucket_id = 'workspace_media'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public portfolio assets (avatars/covers) can be publicly viewed for web portfolio showcase
CREATE POLICY "Public can view portfolio assets" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id IN ('avatars', 'covers'));

-- =========================================================================
-- 7. DEDICATED EXPENSES TABLE FOR INDIVIDUAL MUTATION SYNCHRONIZATION
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.user_expenses (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_identifier TEXT NOT NULL,
    user_email TEXT,
    name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    direction TEXT NOT NULL DEFAULT 'DEBIT',
    payment_method TEXT,
    billing_cycle TEXT,
    notes TEXT,
    bank_name TEXT,
    masked_account TEXT,
    account_last4 TEXT,
    reference_id TEXT,
    sms_reference_id TEXT,
    upi_reference TEXT,
    raw_sms_text TEXT,
    merchant TEXT,
    payee TEXT,
    source TEXT,
    source_file TEXT,
    import_batch_id TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_updated_at BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_user_expenses_workspace ON public.user_expenses(workspace_identifier);
CREATE INDEX IF NOT EXISTS idx_user_expenses_user_id ON public.user_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_expenses_date ON public.user_expenses(workspace_identifier, date);
CREATE INDEX IF NOT EXISTS idx_user_expenses_updated_at ON public.user_expenses(workspace_identifier, updated_at);
CREATE INDEX IF NOT EXISTS idx_user_expenses_ref ON public.user_expenses(workspace_identifier, sms_reference_id);

ALTER TABLE public.user_expenses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_authorized_workspace(ws_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE AS $$
BEGIN
    IF ws_id IS NULL THEN
        RETURN FALSE;
    END IF;
    IF ws_id = 'user_' || auth.uid()::text OR ws_id = auth.uid()::text THEN
        RETURN TRUE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.user_workspaces w
        WHERE w.user_identifier = ws_id
          AND (w.user_id = auth.uid() OR w.user_identifier = 'user_' || auth.uid()::text OR w.user_identifier = auth.uid()::text)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_authorized_workspace(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authorized_workspace(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Users can read own expenses" ON public.user_expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.user_expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.user_expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.user_expenses;

CREATE POLICY "Users can read own expenses"
ON public.user_expenses FOR SELECT TO authenticated
USING (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
);

CREATE POLICY "Users can insert own expenses"
ON public.user_expenses FOR INSERT TO authenticated
WITH CHECK (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
    AND (user_email IS NULL OR lower(user_email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
);

CREATE POLICY "Users can update own expenses"
ON public.user_expenses FOR UPDATE TO authenticated
USING (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
)
WITH CHECK (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
    AND (user_email IS NULL OR lower(user_email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
);

CREATE POLICY "Users can delete own expenses"
ON public.user_expenses FOR DELETE TO authenticated
USING (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
);

-- =========================================================================
-- 8. SERVER-ENFORCED OPTIMISTIC CONCURRENCY, ANTI-RESURRECTION & SOFT-DELETE
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_user_expense_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE AND COALESCE(NEW.client_updated_at, 0) <= COALESCE(OLD.client_updated_at, 0)) THEN
            RETURN OLD;
        END IF;

        IF (COALESCE(NEW.client_updated_at, 0) < COALESCE(OLD.client_updated_at, 0)) THEN
            RETURN OLD;
        END IF;

        IF (NEW.client_updated_at = OLD.client_updated_at AND NEW.is_deleted = OLD.is_deleted AND NEW.amount = OLD.amount AND NEW.name = OLD.name) THEN
            RETURN OLD;
        END IF;

        IF (NEW.is_deleted = TRUE) THEN
            IF (NEW.amount = 0 AND OLD.amount > 0) THEN
                NEW.amount := OLD.amount;
            END IF;
            IF ((NEW.name IS NULL OR NEW.name = '' OR NEW.name = 'Deleted Expense') AND (OLD.name IS NOT NULL AND OLD.name <> 'Deleted Expense')) THEN
                NEW.name := OLD.name;
            END IF;
            IF ((NEW.category IS NULL OR NEW.category = '' OR NEW.category = 'Other') AND (OLD.category IS NOT NULL AND OLD.category <> 'Other')) THEN
                NEW.category := OLD.category;
            END IF;
            IF (NEW.date IS NULL OR NEW.date = '') THEN
                NEW.date := OLD.date;
            END IF;
            IF (NEW.direction IS NULL) THEN
                NEW.direction := OLD.direction;
            END IF;
            IF (NEW.bank_name IS NULL) THEN
                NEW.bank_name := OLD.bank_name;
            END IF;
            IF (NEW.account_last4 IS NULL) THEN
                NEW.account_last4 := OLD.account_last4;
            END IF;
            IF (NEW.reference_id IS NULL) THEN
                NEW.reference_id := OLD.reference_id;
            END IF;
            IF (NEW.sms_reference_id IS NULL) THEN
                NEW.sms_reference_id := OLD.sms_reference_id;
            END IF;
            NEW.deleted_at := COALESCE(NEW.deleted_at, timezone('utc'::text, now()));
        END IF;

        NEW.version := COALESCE(OLD.version, 1) + 1;
        NEW.updated_at := timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_expenses_upsert ON public.user_expenses;
CREATE TRIGGER trg_user_expenses_upsert
BEFORE UPDATE ON public.user_expenses
FOR EACH ROW EXECUTE FUNCTION public.handle_user_expense_upsert();

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_expenses;
`;
