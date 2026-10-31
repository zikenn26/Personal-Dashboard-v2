import { Capacitor } from '@capacitor/core';
import { DeviceSession } from '../types';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  DEVICE_SESSION_ID,
  getCustomWorkspaceIdentifier,
  scheduleAutoSyncToSupabase,
  subscribeToPresenceState,
  getOnlineDeviceIds,
} from './supabase';
import { Storage } from './storage';

export { DEVICE_SESSION_ID, getOnlineDeviceIds, subscribeToPresenceState };

const DEVICE_STORAGE_PREFIX = 'notion_os_device_sessions_';

/**
 * Detect client device, operating system, and browser platform cleanly
 */
export const getDeviceInfo = (): {
  deviceName: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  isApk?: boolean;
} => {
  const isNativeApk =
    typeof Capacitor !== 'undefined' &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android';

  if (isNativeApk) {
    return {
      deviceName: 'Android APK App',
      browser: 'Android Native APK',
      os: 'Android Native',
      deviceType: 'mobile',
      isApk: true,
    };
  }

  if (typeof navigator === 'undefined') {
    return {
      deviceName: 'Web Browser',
      browser: 'Web',
      os: 'Cloud',
      deviceType: 'desktop',
      isApk: false,
    };
  }

  const ua = navigator.userAgent;

  let os = 'Unknown OS';
  if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Windows NT 10.0/i.test(ua)) os = 'Windows 11/10';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';

  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/iPad|tablet/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/iPhone|Android|Mobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Detect runtime host environment context (Cloudflare Pages, AI Studio Preview, Localhost)
  let envTag = '';
  if (typeof window !== 'undefined' && window.location) {
    const host = (window.location.hostname || '').toLowerCase();
    if (host.includes('pages.dev')) {
      envTag = 'Web • Cloudflare';
    } else if (
      host.includes('ais-') ||
      host.includes('aistudio') ||
      host.includes('googleusercontent') ||
      host.includes('run.app')
    ) {
      envTag = 'AI Studio Preview';
    } else if (host === 'localhost' || host === '127.0.0.1') {
      envTag = 'Localhost Dev';
    }
  }

  const deviceName = envTag ? `${browser} (${envTag})` : `${browser} on ${os}`;

  return {
    deviceName,
    browser,
    os,
    deviceType,
  };
};

const getLocalDevices = (cleanEmail: string): DeviceSession[] => {
  try {
    const raw = localStorage.getItem(`${DEVICE_STORAGE_PREFIX}${cleanEmail}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
};

const saveLocalDevices = (cleanEmail: string, devices: DeviceSession[]) => {
  try {
    localStorage.setItem(`${DEVICE_STORAGE_PREFIX}${cleanEmail}`, JSON.stringify(devices));
  } catch {
    // ignore
  }
};

/**
 * Deduplicate device sessions strictly by persistent Session ID.
 * Each separate device/browser instance (with its own persistent ID) is preserved,
 * while stale sessions inactive for more than 30 days are pruned.
 */
export const deduplicateDevices = (
  devices: DeviceSession[],
  currentDeviceId: string = DEVICE_SESSION_ID
): DeviceSession[] => {
  if (!Array.isArray(devices) || devices.length === 0) return [];

  const deviceMap = new Map<string, DeviceSession>();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days inactivity cutoff

  for (const d of devices) {
    if (!d || !d.id) continue;

    // Prune stale sessions older than 30 days unless it is the active device
    if (d.id !== currentDeviceId && d.lastActive && d.lastActive < cutoff) {
      continue;
    }

    const existing = deviceMap.get(d.id);
    if (!existing) {
      deviceMap.set(d.id, {
        ...d,
        isCurrent: d.id === currentDeviceId,
      });
    } else {
      // Merge records for the exact same session ID
      deviceMap.set(d.id, {
        ...existing,
        ...d,
        id: d.id,
        deviceName: d.deviceName || existing.deviceName,
        lastActive: Math.max(d.lastActive || 0, existing.lastActive || 0),
        createdAt: Math.min(d.createdAt || Date.now(), existing.createdAt || Date.now()),
        isCurrent: d.id === currentDeviceId,
      });
    }
  }

  return Array.from(deviceMap.values()).map((d) => ({
    ...d,
    isCurrent: d.id === currentDeviceId,
  }));
};

/**
 * Register current device session in cloud & local database.
 * Preserves peer device sessions and synchronizes through primary workspace payload.
 */
export const registerCurrentDevice = async (email: string): Promise<DeviceSession[]> => {
  if (!email) return [];
  const cleanEmail = email.trim().toLowerCase();
  const list = await fetchAccountDevices(cleanEmail);

  // Trigger sync of primary workspace to Supabase Cloud so all devices receive the updated registry
  try {
    scheduleAutoSyncToSupabase(() => Storage.getAllDataPayload(), 50);
  } catch {}

  return list;
};

/**
 * Fetch all active devices where this account is logged in
 */
export const fetchAccountDevices = async (email: string): Promise<DeviceSession[]> => {
  if (!email) return [];
  const cleanEmail = email.trim().toLowerCase();

  // 1. Read from Storage (synced atomically with primary Supabase workspace)
  let stored = Storage.getDevices();
  if (!Array.isArray(stored) || stored.length === 0) {
    stored = getLocalDevices(cleanEmail);
  }

  const currentInfo = getDeviceInfo();
  const currentDevice: DeviceSession = {
    id: DEVICE_SESSION_ID,
    deviceName: currentInfo.deviceName,
    browser: currentInfo.browser,
    os: currentInfo.os,
    deviceType: currentInfo.deviceType,
    lastActive: Date.now(),
    createdAt: Date.now(),
    isCurrent: true,
    isApk: Boolean(currentInfo.isApk),
  };

  // Upsert current device into the list
  const existingIdx = stored.findIndex((d) => d.id === DEVICE_SESSION_ID);
  if (existingIdx >= 0) {
    stored[existingIdx] = {
      ...stored[existingIdx],
      ...currentDevice,
      lastActive: Date.now(),
    };
  } else {
    stored.unshift(currentDevice);
  }

  const deduplicated = deduplicateDevices(stored, DEVICE_SESSION_ID);
  Storage.setDevices(deduplicated);
  saveLocalDevices(cleanEmail, deduplicated);

  return deduplicated
    .map((d) => ({
      ...d,
      isCurrent: d.id === DEVICE_SESSION_ID,
    }))
    .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));
};

/**
 * Revoke/Logout a specific device session
 */
export const revokeDeviceSession = async (
  email: string,
  targetDeviceId: string
): Promise<{ success: boolean; isSelf: boolean }> => {
  if (!email || !targetDeviceId) return { success: false, isSelf: false };
  const cleanEmail = email.trim().toLowerCase();
  const isSelf = targetDeviceId === DEVICE_SESSION_ID;

  // Remove from Storage and local cache
  const currentList = Storage.getDevices();
  const updatedList = currentList.filter((d) => d.id !== targetDeviceId);
  Storage.setDevices(updatedList);
  saveLocalDevices(cleanEmail, updatedList);

  // Broadcast revocation command over Supabase Realtime websocket
  const client = getSupabaseClient();
  if (client && isSupabaseConfigured()) {
    try {
      const channelName = `realtime_workspace_${getCustomWorkspaceIdentifier()}`;
      const channel = client.channel(channelName);
      await channel.send({
        type: 'broadcast',
        event: 'device_logout_command',
        payload: {
          targetDeviceId,
          email: cleanEmail,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.warn('Error broadcasting remote device logout:', err);
    }
  }

  // Trigger immediate sync of primary workspace to persist the revoked list
  scheduleAutoSyncToSupabase(() => Storage.getAllDataPayload(), 50);

  return { success: true, isSelf };
};

/**
 * Helper to simulate a secondary device for demonstration or testing
 */
export const simulateSecondaryDevice = async (email: string): Promise<DeviceSession[]> => {
  if (!email) return [];
  const cleanEmail = email.trim().toLowerCase();
  const currentList = await fetchAccountDevices(cleanEmail);

  const mockTypes: Array<{ name: string; browser: string; os: string; type: 'mobile' | 'desktop' | 'tablet' }> = [
    { name: 'Apple Safari on iPhone 15', browser: 'Safari', os: 'iOS 18', type: 'mobile' },
    { name: 'Google Chrome on Windows 11', browser: 'Chrome', os: 'Windows 11', type: 'desktop' },
    { name: 'Apple Safari on iPad Pro', browser: 'Safari', os: 'iPadOS', type: 'tablet' },
    { name: 'Mozilla Firefox on MacBook Air', browser: 'Firefox', os: 'macOS', type: 'desktop' },
  ];

  const pick = mockTypes[currentList.length % mockTypes.length];
  const simId = 'dev_sim_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

  const simulatedDevice: DeviceSession = {
    id: simId,
    deviceName: pick.name,
    browser: pick.browser,
    os: pick.os,
    deviceType: pick.type,
    lastActive: Date.now() - 1000 * 60 * 12, // 12 mins ago
    createdAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    isCurrent: false,
  };

  const updatedList = [...currentList, simulatedDevice];
  saveLocalDevices(cleanEmail, updatedList);

  const client = getSupabaseClient();
  if (client && isSupabaseConfigured()) {
    try {
      const authIdentifier = `account_devices_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      await client.from('user_workspaces').upsert(
        {
          user_identifier: authIdentifier,
          user_email: cleanEmail,
          workspace_data: {
            devices: updatedList,
            updatedAt: Date.now(),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_identifier' }
      );
    } catch {
      // ignore
    }
  }

  return updatedList.map((d) => ({
    ...d,
    isCurrent: d.id === DEVICE_SESSION_ID,
  }));
};

/**
 * Checks whether an authentic Android APK device is present in the account device session list.
 */
export const hasApkDeviceInstalled = (devices: DeviceSession[]): boolean => {
  if (!Array.isArray(devices)) return false;
  return devices.some(
    (d) =>
      d &&
      (d.isApk ||
        d.browser === 'Android Native APK' ||
        d.os === 'Android Native' ||
        d.deviceName?.includes('APK'))
  );
};

/**
 * Returns the most recently active Android APK device registered to this account.
 */
export const getApkDevice = (devices: DeviceSession[]): DeviceSession | undefined => {
  if (!Array.isArray(devices)) return undefined;
  const apkDevices = devices.filter(
    (d) =>
      d &&
      (d.isApk ||
        d.browser === 'Android Native APK' ||
        d.os === 'Android Native' ||
        d.deviceName?.includes('APK'))
  );
  if (apkDevices.length === 0) return undefined;
  return apkDevices.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))[0];
};

/**
 * Checks whether the current environment is a web browser running on an Android mobile device.
 */
export const isAndroidBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const isNative =
    typeof Capacitor !== 'undefined' &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android';
  if (isNative) return false;
  return /Android/i.test(navigator.userAgent);
};

/**
 * Launches the native Android APK via Android intent link from Android Chrome.
 */
export const launchNativeApkIntent = (): void => {
  if (typeof window === 'undefined') return;
  const intentUri = 'intent://open#Intent;scheme=zikenn;package=com.zikenn.dashboard;end';
  window.location.href = intentUri;
};

/**
 * Subscribe to live device presence changes broadcasted across active sessions.
 */
export const subscribeToDevicePresence = (
  email: string,
  onDevicesChange: (devices: DeviceSession[]) => void
): (() => void) => {
  if (!email) return () => {};
  const cleanEmail = email.trim().toLowerCase();

  // 1. Listen to storage devices-updated event (fired when workspace data syncs from cloud or local change)
  const handleStorageUpdate = async () => {
    const list = await fetchAccountDevices(cleanEmail);
    onDevicesChange(list);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('devices-updated', handleStorageUpdate);
  }

  // 2. Listen to Supabase Realtime presence state changes
  const unsubPresence = subscribeToPresenceState(async () => {
    const list = await fetchAccountDevices(cleanEmail);
    onDevicesChange(list);
  });

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('devices-updated', handleStorageUpdate);
    }
    unsubPresence();
  };
};

