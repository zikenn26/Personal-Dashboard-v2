import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase (Vite client)
const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
 */
const isIframeOrPreview = (): boolean => {
  if (typeof window === 'undefined') return false;
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

let activeUserIdentifier = 'user_guest';
let activeUserEmail = 'user@workspace.app';

export const setCustomWorkspaceIdentifier = (id: string) => {
  if (id && id.trim()) {
    activeUserIdentifier = id.trim();
  }
};

export const setCustomWorkspaceEmail = (email: string) => {
  if (email && email.trim() && !email.includes('hcl-software.com')) {
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

// Unique Device Session ID to prevent self-looping on Realtime echo
export const DEVICE_SESSION_ID =
  typeof window !== 'undefined'
    ? window.sessionStorage?.getItem('lifeos_device_session_id') ||
      (() => {
        const id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        try {
          window.sessionStorage?.setItem('lifeos_device_session_id', id);
        } catch {
          // ignore
        }
        return id;
      })()
    : 'server_env';

let lastPushedTimestamp = 0;
let autoSyncTimeout: any = null;
let broadcastSyncTimeout: any = null;
let activeRealtimeChannel: any = null;
let currentSyncStatus: 'synced' | 'syncing' | 'error' | 'idle' = 'idle';
const statusListeners = new Set<(status: 'synced' | 'syncing' | 'error' | 'idle') => void>();

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

  try {
    notifyStatus('syncing');
    const now = new Date().toISOString();
    lastPushedTimestamp = Date.now();

    // Include device session id inside workspace_data metadata
    const enrichedPayload = {
      ...workspacePayload,
      _meta: {
        lastDeviceId: DEVICE_SESSION_ID,
        clientTimestamp: Date.now(),
      },
    };

    // Thoroughly sanitize any legacy company email references
    if (enrichedPayload.profile && enrichedPayload.profile.contactEmail?.includes('hcl-software.com')) {
      enrichedPayload.profile.contactEmail = activeUserEmail || 'user@workspace.app';
    }

    // Broadcast immediately over WebSocket to peer devices with sub-30ms latency
    broadcastWorkspaceUpdate(enrichedPayload);

    const activeId = getCustomWorkspaceIdentifier();
    let resolvedEmail = activeUserEmail || workspacePayload?.profile?.contactEmail || 'user@workspace.app';
    if (resolvedEmail.includes('hcl-software.com')) {
      resolvedEmail = 'user@workspace.app';
    }

    const payloadToSave = {
      user_identifier: activeId,
      user_email: resolvedEmail,
      workspace_data: enrichedPayload,
      updated_at: now,
    };

    const { error } = await client
      .from('user_workspaces')
      .upsert(payloadToSave, { onConflict: 'user_identifier' });

    if (error) {
      console.warn('Supabase sync notice (will retry automatically):', error.message || error);
      notifyStatus('error');
      return {
        success: false,
        message: `Cloud sync notice: ${error.message}`,
      };
    }

    notifyStatus('synced');
    return {
      success: true,
      message: isAutoSync ? 'Auto-synced to Supabase' : 'Workspace successfully backed up to Supabase Cloud',
      timestamp: now,
    };
  } catch (err: any) {
    console.warn('Supabase sync notice:', err?.message || 'Network delay');
    notifyStatus('error');
    return {
      success: false,
      message: `Sync notice: ${err?.message || 'Network failure'}`,
    };
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
  onRemoteChange: (data: any, timestamp: string) => void
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

            // Ignore if this change originated from this same browser session
            if (payload.deviceId === DEVICE_SESSION_ID) {
              return;
            }

            onRemoteChange(payload.data, payload.timestamp || new Date().toISOString());
            notifyStatus('synced');
          } catch (e) {
            console.warn('Realtime broadcast payload error:', e);
          }
        }
      )
      // 2. Postgres replication database changes (authoritative state persistence)
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

            // Trigger silent real-time hydration on this device
            onRemoteChange(newRecord.workspace_data, newRecord.updated_at || new Date().toISOString());
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
-- SUPABASE POSTGRESQL SCHEMA FOR NOTION OS & WORKFOLIO (FREE TIER)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- 1. Create the user_workspaces table for cloud synchronization
CREATE TABLE IF NOT EXISTS public.user_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_identifier TEXT UNIQUE NOT NULL DEFAULT 'gulshan_workspace_default',
    user_email TEXT,
    workspace_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies allowing public anon access for this single-user portfolio/workspace
CREATE POLICY "Allow public read of user workspaces" 
ON public.user_workspaces 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert/update of user workspaces" 
ON public.user_workspaces 
FOR ALL 
USING (true)
WITH CHECK (true);

-- 4. Enable Realtime updates for live collaboration / multi-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_workspaces;

-- 5. Create Storage Buckets for Images, Avatars, and PDF exports
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('workspace_media', 'workspace_media', true),
    ('avatars', 'avatars', true),
    ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage Bucket Public Access Policies
CREATE POLICY "Public Media Access" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('workspace_media', 'avatars', 'covers'));

CREATE POLICY "Public Media Uploads" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id IN ('workspace_media', 'avatars', 'covers'));

CREATE POLICY "Public Media Updates" 
ON storage.objects FOR UPDATE 
USING (bucket_id IN ('workspace_media', 'avatars', 'covers'));
`;
