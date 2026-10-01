import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import {
  SUPABASE_URL as BUILTIN_SUPABASE_URL,
  SUPABASE_ANON_KEY as BUILTIN_SUPABASE_ANON_KEY,
} from './supabaseConfig';

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
 * Checks if running inside an iframe, Cloud Run preview container, or dev environment
 * where third-party requests may be restricted by sandbox or CORS policies.
 * In native Capacitor (Android), this returns false so requests go directly to Supabase.
 */
const isIframeOrPreview = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) {
      return false;
    }
  } catch {
    // Ignore if Capacitor is not present in pure web runtime
  }
  try {
    const isIframe = window.self !== window.top;
    const isAiStudio =
      window.location.hostname.includes('run.app') ||
      window.location.hostname.includes('aistudio');
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    return isIframe || isAiStudio || isLocal || Boolean(import.meta.env.DEV);
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
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request)?.url || '';

  if (urlStr && supabaseUrl && urlStr.startsWith(supabaseUrl)) {
    const proxiedUrl = urlStr.replace(supabaseUrl, '/api/supabase');

    // In iframe or preview container, route through same-origin proxy first
    if (isIframeOrPreview()) {
      try {
        const proxyRes = await fetch(proxiedUrl, init);
        // If proxy handled the request successfully (not 404 from static hosts), return
        if (proxyRes.status !== 404) {
          return proxyRes;
        }
      } catch (proxyErr) {
        // Fall back to direct fetch if proxy fails
      }
    }

    // Direct fetch attempt (used in Cloudflare Pages and standalone mobile apps)
    try {
      return await fetch(input, init);
    } catch (directErr) {
      // If direct fetch fails with TypeError: Failed to fetch, retry via proxy
      try {
        const fallbackRes = await fetch(proxiedUrl, init);
        return fallbackRes;
      } catch {
        throw directErr;
      }
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
  if (typeof window === 'undefined') return { id: 'user_guest', email: 'user@workspace.app' };
  try {
    const raw = localStorage.getItem('notion_os_auth_user_v1');
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.email) {
        const cleanEmail = user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        return {
          id: `user_${cleanEmail}`,
          email: user.email.trim().toLowerCase(),
        };
      }
    }
  } catch {}
  return { id: 'user_guest', email: 'user@workspace.app' };
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
  return activeUserIdentifier || 'user_guest';
};

export const getCustomWorkspaceEmail = (): string => {
  return activeUserEmail || 'user@workspace.app';
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
let activeRealtimeChannel: any = null;
let currentSyncStatus: 'synced' | 'syncing' | 'error' | 'idle' = 'idle';
const statusListeners = new Set<(status: 'synced' | 'syncing' | 'error' | 'idle') => void>();

// ---------------------------------------------------------------------------
// Workspace sync ordering / stale-write protection
// ---------------------------------------------------------------------------
// The workspace is currently stored as one JSONB snapshot.  Multiple devices
// can therefore race: an older snapshot can arrive after a newer deletion and
// resurrect deleted data.  These values let this client reject stale remote
// snapshots and serialize local writes.  The database `updated_at` column is
// also used as the server-side write guard.
let syncWriteQueue: Promise<void> = Promise.resolve();
let latestLocalMutationTimestamp =
  typeof window !== 'undefined'
    ? Number(localStorage.getItem('lifeos_workspace_sync_clock') || '0')
    : 0;
let latestKnownRemoteTimestamp = 0;

const getSyncTimestamp = (): number => {
  const now = Date.now();
  if (typeof window === 'undefined') {
    return now;
  }

  try {
    const key = 'lifeos_workspace_sync_clock';
    const previous = Number(localStorage.getItem(key) || '0');
    const next = Math.max(now, previous + 1, latestKnownRemoteTimestamp + 1);
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

export const getAutoSyncStatus = () => currentSyncStatus;

/**
 * Broadcast workspace changes via WebSocket directly to all connected devices.
 * Delivers updates in <30ms without waiting for database writes.
 */
export const broadcastWorkspaceUpdate = (enrichedPayload: any) => {
  if (!activeRealtimeChannel) return;
  try {
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
      .select('updated_at')
      .eq('user_identifier', WORKSPACE_USER_IDENTIFIER)
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

  if (!workspacePayload) {
    return {
      success: false,
      message: 'No workspace payload supplied.',
    };
  }

  // Every local write receives a monotonically increasing client timestamp.
  // This is deliberately generated at commit time, not when the UI changed,
  // so debounced auto-syncs cannot accidentally reuse an old ordering value.
  const syncTimestampMs = getSyncTimestamp();
  latestLocalMutationTimestamp = Math.max(latestLocalMutationTimestamp, syncTimestampMs);
  const now = new Date(syncTimestampMs).toISOString();

  // Serialize writes made by this browser/device.  Without this queue, an
  // older in-flight request can finish after a newer request and overwrite it.
  let resolveQueued!: () => void;
  const previousQueue = syncWriteQueue;
  syncWriteQueue = new Promise<void>((resolve) => {
    resolveQueued = resolve;
  });

  await previousQueue;

  try {
    notifyStatus('syncing');

    const enrichedPayload = {
      ...workspacePayload,
      _meta: {
        ...(workspacePayload?._meta || {}),
        lastDeviceId: DEVICE_SESSION_ID,
        clientTimestamp: syncTimestampMs,
        syncVersion: syncTimestampMs,
      },
    };

    // Broadcast only after the local ordering value has been assigned.
    broadcastWorkspaceUpdate(enrichedPayload);

    const activeId = getCustomWorkspaceIdentifier();
    const resolvedEmail =
      activeUserEmail || workspacePayload?.profile?.contactEmail || 'user@workspace.app';

    let authenticatedUserId: string | null = null;
    try {
      const { data: authData } = await client.auth.getUser();
      if (authData?.user?.id) {
        authenticatedUserId = authData.user.id;
      }
    } catch {
      // Offline or unauthenticated; the database request below will report it.
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

    // IMPORTANT:
    // Do NOT use upsert here.  Upsert has no stale-write protection and was
    // capable of allowing an older whole-workspace snapshot to resurrect
    // deleted expenses.  First determine whether the row exists, then perform
    // an UPDATE guarded by updated_at.
    const { data: existingRow, error: lookupError } = await client
      .from('user_workspaces')
      .select('updated_at')
      .eq('user_identifier', activeId)
      .maybeSingle();

    if (lookupError) {
      notifyStatus('error');
      return {
        success: false,
        message: `Cloud sync lookup failed: ${lookupError.message}`,
      };
    }

    if (!existingRow) {
      // First write for this workspace.
      const { error: insertError } = await client
        .from('user_workspaces')
        .insert(payloadToSave);

      if (insertError) {
        // Another device may have created the row between SELECT and INSERT.
        // Retry through the guarded UPDATE path rather than falling back to
        // an unguarded upsert.
        const { data: retryRow, error: retryLookupError } = await client
          .from('user_workspaces')
          .select('updated_at')
          .eq('user_identifier', activeId)
          .maybeSingle();

        if (retryLookupError || !retryRow) {
          notifyStatus('error');
          return {
            success: false,
            message: `Cloud sync insert failed: ${insertError.message}`,
          };
        }

        const remoteTimestamp = parseSyncTimestamp(retryRow.updated_at);
        if (remoteTimestamp >= syncTimestampMs) {
          latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, remoteTimestamp);
          notifyStatus('synced');
          return {
            success: true,
            message: 'Cloud already contains a newer workspace version; stale local write was rejected.',
            timestamp: retryRow.updated_at,
          };
        }

        const { error: guardedRetryError } = await client
          .from('user_workspaces')
          .update(payloadToSave)
          .eq('user_identifier', activeId)
          .lt('updated_at', now);

        if (guardedRetryError) {
          notifyStatus('error');
          return {
            success: false,
            message: `Cloud sync retry failed: ${guardedRetryError.message}`,
          };
        }
      }
    } else {
      const remoteTimestamp = parseSyncTimestamp(existingRow.updated_at);

      // Never overwrite a newer server snapshot with an older client snapshot.
      if (remoteTimestamp >= syncTimestampMs) {
        latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, remoteTimestamp);
        notifyStatus('synced');
        return {
          success: true,
          message: 'Cloud already contains a newer workspace version; stale local write was rejected.',
          timestamp: existingRow.updated_at,
        };
      }

      // PostgreSQL evaluates the timestamp predicate at update time. If another
      // device wins the race between SELECT and UPDATE, this UPDATE affects
      // zero rows and our snapshot is safely discarded instead of resurrecting
      // deleted records.
      const { data: updatedRows, error: updateError } = await client
        .from('user_workspaces')
        .update(payloadToSave)
        .eq('user_identifier', activeId)
        .lt('updated_at', now)
        .select('updated_at');

      if (updateError) {
        notifyStatus('error');
        return {
          success: false,
          message: `Cloud sync update failed: ${updateError.message}`,
        };
      }

      if (!updatedRows || updatedRows.length === 0) {
        const { data: winnerRow } = await client
          .from('user_workspaces')
          .select('updated_at')
          .eq('user_identifier', activeId)
          .maybeSingle();

        const winnerTimestamp = parseSyncTimestamp(winnerRow?.updated_at);
        latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, winnerTimestamp);

        notifyStatus('synced');
        return {
          success: true,
          message: 'A newer workspace version won the sync race; stale local snapshot was not written.',
          timestamp: winnerRow?.updated_at,
        };
      }
    }

    latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, syncTimestampMs);
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
    resolveQueued();
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
  if (!isSupabaseConfigured()) return;

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

            // Ignore if this change originated from this same browser session.
            if (payload.deviceId === DEVICE_SESSION_ID) {
              return;
            }

            const remoteClientTimestamp = parseSyncTimestamp(
              payload.data?._meta?.syncVersion ?? payload.data?._meta?.clientTimestamp ?? payload.timestamp
            );

            // Never allow an older broadcast to roll the local workspace
            // backwards after a newer local mutation.
            if (
              remoteClientTimestamp > 0 &&
              remoteClientTimestamp < latestLocalMutationTimestamp
            ) {
              console.info('Ignoring stale workspace broadcast:', {
                remoteClientTimestamp,
                latestLocalMutationTimestamp,
              });
              return;
            }

            if (remoteClientTimestamp > 0) {
              latestKnownRemoteTimestamp = Math.max(
                latestKnownRemoteTimestamp,
                remoteClientTimestamp
              );
            }

            onRemoteChange(payload.data, payload.timestamp || new Date().toISOString());
            notifyStatus('synced');
          } catch (e) {
            console.warn('Realtime broadcast payload error:', e);
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
            if (payload && payload.targetDeviceId === DEVICE_SESSION_ID) {
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
            // Ignore if this change originated from this same browser session.
            if (meta?.lastDeviceId === DEVICE_SESSION_ID) {
              return;
            }

            const remoteClientTimestamp = parseSyncTimestamp(
              meta?.syncVersion ?? meta?.clientTimestamp ?? newRecord.updated_at
            );

            // Reject stale Postgres events. This is especially important after
            // a deletion: an older snapshot must not be allowed to resurrect it.
            if (
              remoteClientTimestamp > 0 &&
              remoteClientTimestamp < latestLocalMutationTimestamp
            ) {
              console.info('Ignoring stale Supabase realtime workspace update:', {
                remoteClientTimestamp,
                latestLocalMutationTimestamp,
              });
              return;
            }

            if (remoteClientTimestamp > 0) {
              latestKnownRemoteTimestamp = Math.max(
                latestKnownRemoteTimestamp,
                remoteClientTimestamp
              );
            }

            // Trigger silent real-time hydration on this device.
            onRemoteChange(
              newRecord.workspace_data,
              newRecord.updated_at || new Date().toISOString()
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
    const { data, error } = await client
      .from('user_workspaces')
      .select('workspace_data, updated_at')
      .eq('user_identifier', activeId)
      .maybeSingle();

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

    const cloudTimestamp = parseSyncTimestamp(
      data.workspace_data?._meta?.syncVersion ??
        data.workspace_data?._meta?.clientTimestamp ??
        data.updated_at
    );

    // If this device has a newer local mutation, do not hand an older cloud
    // snapshot to the app for hydration. The previous behavior could overwrite
    // a freshly deleted expense with an older cloud array.
    if (
      cloudTimestamp > 0 &&
      latestLocalMutationTimestamp > 0 &&
      cloudTimestamp < latestLocalMutationTimestamp
    ) {
      return {
        success: false,
        message: 'Cloud snapshot is older than local changes; local workspace was preserved.',
        timestamp: data.updated_at,
      };
    }

    if (cloudTimestamp > 0) {
      latestKnownRemoteTimestamp = Math.max(latestKnownRemoteTimestamp, cloudTimestamp);
    }

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
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
);

CREATE POLICY "Users can insert own workspace"
ON public.user_workspaces
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
);

CREATE POLICY "Users can update own workspace"
ON public.user_workspaces
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
)
WITH CHECK (
    auth.uid() = user_id
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
);

CREATE POLICY "Users can delete own workspace"
ON public.user_workspaces
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
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
`;
