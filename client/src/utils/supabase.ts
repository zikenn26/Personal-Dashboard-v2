import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import {
  SUPABASE_URL as BUILTIN_SUPABASE_URL,
  SUPABASE_ANON_KEY as BUILTIN_SUPABASE_ANON_KEY,
} from './supabaseConfig';
import { mergeExpenseLists, normalizeExpenseDateKey, getLocalDateKey } from './expenseUtils';
import { OWNER_GKN_HABITS } from './userUtils';
import { ExpenseItem, OutboxMutation } from '../types';
export { mergeExpenseLists };

// Environment variables for Supabase (Vite client)
const rawUrl = import.meta.env.VITE_SUPABASE_URL || BUILTIN_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || BUILTIN_SUPABASE_ANON_KEY || '';

// Clean Supabase URL (strip /rest/v1 or trailing slashes if passed)
const cleanSupabaseUrl = (url: string): string => {
  if (!url) return '';
  let cleaned = url.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
};

const supabaseUrl = cleanSupabaseUrl(rawUrl);
const supabaseAnonKey = rawKey.trim();

let supabaseInstance: SupabaseClient | null = null;

/**
 * Checks if Supabase credentials are configured in the environment.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl !== 'https://your-project-id.supabase.co' &&
      !supabaseUrl.includes('your-project-id') &&
      supabaseAnonKey !== 'your-supabase-anon-key'
  );
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

  if (urlStr && supabaseUrl && urlStr.startsWith(supabaseUrl)) {
    // In iframe or preview container, route through same-origin proxy first
    // On native mobile (Android APK), NEVER route through same-origin proxy (/api/supabase)
    if (!isMobile && isIframeOrPreview()) {
      const proxiedUrl = urlStr.replace(supabaseUrl, '/api/supabase');
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
        const proxiedUrl = urlStr.replace(supabaseUrl, '/api/supabase');
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
export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          fetch: supabaseFetch,
        },
      });
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return supabaseInstance;
};

export const validateSupabaseConnection = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const response = await supabaseFetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });
    return response.ok;
  } catch (e) {
    return false;
  }
};

export interface CloudSyncResult {
  success: boolean;
  message: string;
  timestamp?: string;
  data?: any;
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

const getPayloadSyncTimestamp = (payload: any, fallback?: any): number => {
  return Math.max(
    parseSyncTimestamp(payload?._meta?.syncVersion),
    parseSyncTimestamp(payload?._meta?.clientTimestamp),
    parseSyncTimestamp(fallback)
  );
};
const statusListeners = new Set<(status: 'synced' | 'syncing' | 'error' | 'idle') => void>();

export const getAutoSyncStatus = () => currentSyncStatus;

/**
 * Broadcast workspace changes via WebSocket directly to all connected devices.
 * Delivers updates in <30ms without waiting for database writes.
 */
export const broadcastWorkspaceUpdate = (enrichedPayload: any) => {
  if (!activeRealtimeChannel) return;
  // Guard against sending before channel is joined to prevent REST fallback and HTTP 422
  if (activeRealtimeChannel.state && activeRealtimeChannel.state !== 'joined') return;
  const activeId = getCustomWorkspaceIdentifier();
  if (activeId === 'user_guest' || activeId.startsWith('user_guest') || !activeUserEmail || activeUserEmail === 'guest@workspace.local') return;
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
      // Send lightweight sync ping telling peer devices to pull latest workspace directly
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
  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      message: 'Supabase credentials not configured in .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)',
    };
  }

  try {
    const { data, error } = await client
      .from('user_workspaces')
      .select('id')
      .limit(1);

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return {
          connected: false,
          message: 'Connected to Supabase project, but "user_workspaces" table is missing. Run the SQL schema to create it.',
          details: error,
        };
      }
      return {
        connected: false,
        message: `Supabase query error: ${error.message}`,
        details: error,
      };
    }

    return {
      connected: true,
      message: 'Successfully connected to Supabase Cloud Database',
      details: data,
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
 * Upload whole workspace state payload to Supabase database.
 */
export const syncWorkspaceToSupabase = async (
  workspacePayload: any,
  isAutoSync = false
): Promise<CloudSyncResult> => {
  const client = getSupabaseClient();
  if (!client) {
    notifyStatus('idle');
    return {
      success: false,
      message: 'Supabase not configured. Data is stored safely in LocalStorage.',
    };
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
      if (
        payloadToSave.workspace_data &&
        (!Array.isArray(payloadToSave.workspace_data.expenses) || payloadToSave.workspace_data.expenses.length === 0)
      ) {
        try {
          const activeEmail = (activeUserEmail || '').toLowerCase().trim();
          const cachedRaw =
            (activeEmail ? localStorage.getItem(`${activeEmail}_offline_expenses_cache`) : null) ||
            localStorage.getItem('lifeos_offline_expenses_cache') ||
            localStorage.getItem('lifeos_expenses_backup');
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              payloadToSave.workspace_data.expenses = parsed;
            }
          }
        } catch {}
      }

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

      if (localExpenses.length === 0) {
        try {
          const activeEmail = (activeUserEmail || '').toLowerCase().trim();
          const cachedRaw =
            (activeEmail ? localStorage.getItem(`${activeEmail}_offline_expenses_cache`) : null) ||
            localStorage.getItem('lifeos_offline_expenses_cache') ||
            localStorage.getItem('lifeos_expenses_backup');
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localExpenses = parsed;
            }
          }
        } catch {}
      }

      if (payloadToSave.workspace_data) {
        // Safely reconcile local and remote expenses
        const reconciled = mergeExpenseLists(localExpenses, remoteExpenses, trashedExpenseIds);

        // If uploading from a non-native client (e.g. desktop Chrome / mobile Chrome),
        // strictly ensure that all SMS-derived expenses committed by the APK are kept intact.
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

            const isSmsExpense =
              remoteExp.source === 'sms_auto' ||
              remoteExp.source === 'sms_rescan' ||
              expId.startsWith('exp-sms-') ||
              Boolean(remoteExp.rawSmsText || remoteExp.smsReferenceId || remoteExp.upiReference);

            if (isSmsExpense) {
              const remoteRef = (remoteExp.smsReferenceId || remoteExp.referenceId || remoteExp.upiReference || '').trim().toUpperCase();
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

let workOfflineEnabled = false;

/**
 * Set the offline working mode.
 * When enabled, halts scheduleAutoSyncToSupabase and flushAutoSyncImmediately.
 */
export const setWorkOfflineMode = (enabled: boolean) => {
  workOfflineEnabled = !!enabled;
  if (workOfflineEnabled) {
    if (broadcastSyncTimeout) {
      clearTimeout(broadcastSyncTimeout);
      broadcastSyncTimeout = null;
    }
    if (autoSyncTimeout) {
      clearTimeout(autoSyncTimeout);
      autoSyncTimeout = null;
    }
    notifyStatus('idle');
  }
};

/**
 * Check if the workspace is currently in offline mode.
 */
export const isWorkOfflineMode = (): boolean => {
  if (workOfflineEnabled) return true;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('notion_os_v4_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.workOffline) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
};

/**
 * Schedule high-speed auto-sync to Supabase.
 * Broadcasts to connected devices within 150ms and persists to PostgreSQL within 600ms.
 */
export const scheduleAutoSyncToSupabase = (
  payloadGetter: () => any,
  delayMs = 600
) => {
  if (isWorkOfflineMode()) return;
  if (!isSupabaseConfigured()) return;
  const activeId = getCustomWorkspaceIdentifier();
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
 * Flush any pending auto-sync immediately (e.g. before tab switch or page close).
 */
export const flushAutoSyncImmediately = async (payload: any) => {
  if (isWorkOfflineMode()) return;
  if (!isSupabaseConfigured() || !payload) return;
  if (broadcastSyncTimeout) {
    clearTimeout(broadcastSyncTimeout);
    broadcastSyncTimeout = null;
  }
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
    autoSyncTimeout = null;
  }
  await syncWorkspaceToSupabase(payload, true);
};

/**
 * Listen to live real-time changes across devices via Supabase Realtime websocket channels.
 * Supports both instant broadcast events (<30ms) and postgres database updates.
 */
export const subscribeToRealtimeWorkspace = (
  onRemoteChange: (data: any, timestamp: string) => void,
  onDeviceRevoked?: () => void
): (() => void) => {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  try {
    const activeId = getCustomWorkspaceIdentifier();
    if (activeId === 'user_guest' || activeId.startsWith('user_guest') || !activeUserEmail || activeUserEmail === 'guest@workspace.local') {
      return () => {};
    }
    const channelName = `realtime_workspace_${activeId}`;

    // Clean up any stale channel before subscribing to the new user workspace channel
    if (activeRealtimeChannel) {
      try {
        client.removeChannel(activeRealtimeChannel);
      } catch {
        // ignore
      }
      activeRealtimeChannel = null;
    }

    const channel = client
      .channel(channelName, {
        config: {
          broadcast: { self: false, ack: false },
        },
      })
      // 1. Instant WebSocket broadcast channel from peer devices (sub-30ms)
      .on(
        'broadcast',
        { event: 'workspace_sync' },
        (res: any) => {
          try {
            const payload = res?.payload;
            if (!payload || !payload.data) return;

            // Ignore if this change originated from this same browser session
            if (payload.deviceId === DEVICE_SESSION_ID) {
              return;
            }

            const remoteVersion = getPayloadSyncTimestamp(
              payload.data,
              payload.timestamp
            );
            const remoteTs = payload.timestamp || '';
            // Do not discard remote peer broadcasts due to local clock skew
            if (remoteVersion === lastAppliedRemoteVersion && remoteTs && remoteTs === lastAppliedRemoteUpdatedAt) {
              return;
            }

            lastAppliedRemoteVersion = Math.max(lastAppliedRemoteVersion, remoteVersion);
            lastAppliedRemoteUpdatedAt = remoteTs;
            latestKnownRemoteTimestamp = Math.max(
              latestKnownRemoteTimestamp,
              remoteVersion
            );
            latestLocalMutationTimestamp = Math.max(
              latestLocalMutationTimestamp,
              remoteVersion
            );

            onRemoteChange(
              payload.data,
              payload.timestamp || new Date(remoteVersion).toISOString()
            );
            notifyStatus('synced');
          } catch (e) {
            console.warn('Realtime broadcast payload error:', e);
          }
        }
      )
      // 1b. Lightweight ping from peer device when payload was large (>200KB)
      .on(
        'broadcast',
        { event: 'workspace_sync_ping' },
        async (res: any) => {
          try {
            const payload = res?.payload;
            if (!payload || payload.deviceId === DEVICE_SESSION_ID) return;
            const remoteResult = await fetchWorkspaceFromSupabase();
            if (remoteResult.success && remoteResult.data) {
              onRemoteChange(remoteResult.data, remoteResult.timestamp || new Date().toISOString());
              notifyStatus('synced');
            }
          } catch (e) {
            console.warn('Realtime workspace_sync_ping handler notice:', e);
          }
        }
      )
      // 2. Remote device revocation/logout broadcast listener
      .on(
        'broadcast',
        { event: 'device_logout_command' },
        (res: any) => {
          try {
            const payload = res?.payload;
            if (
              payload &&
              (payload.targetDeviceId === DEVICE_SESSION_ID ||
                payload.targetDeviceId === '*' ||
                payload.forceAllDevices === true)
            ) {
              if (onDeviceRevoked) {
                onDeviceRevoked();
              }
            }
          } catch (e) {
            console.warn('Realtime device logout error:', e);
          }
        }
      )
      // 3. Instant peer-to-peer alarm action broadcast (sub-30ms cross-device snooze/dismiss/delete/set)
      .on(
        'broadcast',
        { event: 'alarm_action' },
        (res: any) => {
          try {
            const payload = res?.payload;
            if (!payload) return;
            if (payload.deviceId === DEVICE_SESSION_ID) return;

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('remote-alarm-sync', { detail: payload })
              );
            }
          } catch (e) {
            console.warn('Realtime alarm_action listener error:', e);
          }
        }
      )
      // 4. Postgres replication database changes (authoritative state persistence)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_workspaces',
          filter: `user_identifier=eq.${activeId}`,
        },
        (payload: any) => {
          try {
            const newRecord = payload.new;
            if (!newRecord || !newRecord.workspace_data) return;
            if (newRecord.user_identifier && newRecord.user_identifier !== activeId) return;

            const meta = newRecord.workspace_data?._meta;
            // Ignore if this change originated from this same browser session
            if (meta?.lastDeviceId === DEVICE_SESSION_ID) {
              return;
            }

            const remoteVersion = getPayloadSyncTimestamp(
              newRecord.workspace_data,
              newRecord.updated_at
            );
            const remoteUpdatedAt = newRecord.updated_at || '';
            // Reject identical already-applied update
            if (remoteUpdatedAt && remoteUpdatedAt === lastAppliedRemoteUpdatedAt && remoteVersion === lastAppliedRemoteVersion) {
              return;
            }

            lastAppliedRemoteUpdatedAt = remoteUpdatedAt;
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

            // Trigger silent real-time hydration on this device for this newer workspace snapshot
            onRemoteChange(
              newRecord.workspace_data,
              newRecord.updated_at || new Date(remoteVersion).toISOString()
            );
            notifyStatus('synced');
          } catch (e) {
            console.warn('Realtime postgres_changes payload error:', e);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          notifyStatus('synced');
          realtimeReconnectAttempts = 0;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime channel disconnected or timed out:', status);
          notifyStatus('idle');
          if (reconnectRealtimeTimeout) clearTimeout(reconnectRealtimeTimeout);
          if (realtimeReconnectAttempts < 5) {
            const delay = Math.min(30000, 3000 * Math.pow(1.5, realtimeReconnectAttempts));
            realtimeReconnectAttempts++;
            reconnectRealtimeTimeout = setTimeout(() => {
              if (activeRealtimeChannel) {
                try {
                  client.removeChannel(activeRealtimeChannel);
                } catch {}
                activeRealtimeChannel = null;
              }
              subscribeToRealtimeWorkspace(onRemoteChange, onDeviceRevoked);
            }, delay);
          }
        }
      });

    activeRealtimeChannel = channel;

    return () => {
      try {
        if (activeRealtimeChannel === channel) {
          client.removeChannel(channel);
          activeRealtimeChannel = null;
        }
      } catch (err) {
        console.warn('Error removing realtime channel:', err);
      }
    };
  } catch (err) {
    console.warn('Could not subscribe to Supabase Realtime:', err);
    return () => {};
  }
};

/**
 * Fetch latest workspace payload from Supabase database.
 */
export const fetchWorkspaceFromSupabase = async (): Promise<CloudSyncResult> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase not configured. Using local data.',
    };
  }

  try {
    const activeId = getCustomWorkspaceIdentifier();
    if (activeId === 'user_guest' || activeId.startsWith('user_guest') || !activeUserEmail || activeUserEmail === 'guest@workspace.local') {
      return {
        success: false,
        message: 'Guest workspace is local-only.',
      };
    }

    let { data, error } = await client
      .from('user_workspaces')
      .select('workspace_data, updated_at')
      .eq('user_identifier', activeId)
      .maybeSingle();

    // Migration fallback for existing accounts: check if existing workspace exists under user_email
    if (!error && (!data || !data.workspace_data) && activeUserEmail) {
      const isGknUser = activeUserEmail === 'gknayak@gmail.com' || activeUserEmail === 'gulnayak1206@gmail.com';
      const emailFilter = isGknUser
        ? 'user_email.eq.gknayak@gmail.com,user_email.eq.gulnayak1206@gmail.com'
        : `user_email.eq.${activeUserEmail}`;

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

    if (error) {
      return {
        success: false,
        message: `Failed to retrieve cloud data: ${error.message}`,
      };
    }

    if (!data || !data.workspace_data) {
      return {
        success: false,
        message: 'No existing cloud data found for this workspace. Ready for initial migration.',
      };
    }

    // Ensure authentic habits for primary accounts are never returned as empty
    const isGknAccount = activeUserEmail === 'gknayak@gmail.com' || activeUserEmail === 'gulnayak1206@gmail.com';
    if (isGknAccount && data.workspace_data && (!Array.isArray(data.workspace_data.habits) || data.workspace_data.habits.length === 0)) {
      data.workspace_data.habits = [...OWNER_GKN_HABITS];
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
  if (!isSupabaseConfigured()) return false;
  const client = getSupabaseClient();
  if (!client) return false;

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

    if (error || !data) return false;

    const remoteUpdatedAt = data.updated_at || '';
    if (remoteUpdatedAt && remoteUpdatedAt !== lastAppliedRemoteUpdatedAt) {
      return true;
    }
    return false;
  } catch {
    return false;
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
): Promise<{ success: boolean; pushedIds: string[]; error?: string; isFallbackNeeded?: boolean }> => {
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
          // Row was not returned by Postgres (e.g. upsert ignored or RLS blocked)
          continue;
        }

        if (mut.action === 'delete') {
          // Deletion mutation must have is_deleted === true on server
          if (row.is_deleted === true) {
            verifiedPushedIds.push(mut.id);
          }
        } else {
          // Create or update mutation: server must accept write (is_deleted === false)
          // If server kept is_deleted === true, trigger rejected resurrection!
          if (row.is_deleted !== true) {
            verifiedPushedIds.push(mut.id);
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
