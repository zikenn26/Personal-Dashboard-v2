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
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });
  return response.ok;
};

export interface CloudSyncResult {
  success: boolean;
  message: string;
  timestamp?: string;
  data?: any;
}

let activeUserIdentifier = 'user_guest';

export const setCustomWorkspaceIdentifier = (id: string) => {
  if (id && id.trim()) {
    activeUserIdentifier = id.trim();
  }
};

export const getCustomWorkspaceIdentifier = (): string => {
  return activeUserIdentifier || 'user_guest';
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
let currentSyncStatus: 'synced' | 'syncing' | 'error' | 'idle' = 'idle';
const statusListeners = new Set<(status: 'synced' | 'syncing' | 'error' | 'idle') => void>();

export const getAutoSyncStatus = () => currentSyncStatus;

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

    const activeId = getCustomWorkspaceIdentifier();
    const payloadToSave = {
      user_identifier: activeId,
      user_email: workspacePayload?.profile?.contactEmail || 'user@workspace.app',
      workspace_data: enrichedPayload,
      updated_at: now,
    };

    const { error } = await client
      .from('user_workspaces')
      .upsert(payloadToSave, { onConflict: 'user_identifier' });

    if (error) {
      console.error('Supabase sync error:', error);
      notifyStatus('error');
      return {
        success: false,
        message: `Cloud sync failed: ${error.message}`,
      };
    }

    notifyStatus('synced');
    return {
      success: true,
      message: isAutoSync ? 'Auto-synced to Supabase' : 'Workspace successfully backed up to Supabase Cloud',
      timestamp: now,
    };
  } catch (err: any) {
    console.error('Supabase exception:', err);
    notifyStatus('error');
    return {
      success: false,
      message: `Sync exception: ${err?.message || 'Network failure'}`,
    };
  }
};

/**
 * Schedule a debounced auto-sync to Supabase.
 * Fast & lightweight (batches multiple rapid keystrokes into a single background query).
 */
export const scheduleAutoSyncToSupabase = (
  payloadGetter: () => any,
  delayMs = 1200
) => {
  if (!isSupabaseConfigured()) return;

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
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
    autoSyncTimeout = null;
  }
  await syncWorkspaceToSupabase(payload, true);
};

/**
 * Listen to live real-time changes across devices via Supabase Realtime websocket channels.
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
    const channel = client
      .channel(channelName)
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

            const meta = newRecord.workspace_data?._meta;
            // Ignore if this change originated from this same browser session
            if (meta?.lastDeviceId === DEVICE_SESSION_ID) {
              return;
            }

            // Prevent echo if we just pushed in the last 1.5 seconds
            if (Date.now() - lastPushedTimestamp < 1500) {
              return;
            }

            // Trigger silent real-time hydration on this device
            onRemoteChange(newRecord.workspace_data, newRecord.updated_at || new Date().toISOString());
            notifyStatus('synced');
          } catch (e) {
            console.warn('Realtime payload handling error:', e);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          notifyStatus('synced');
        }
      });

    return () => {
      try {
        client.removeChannel(channel);
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
