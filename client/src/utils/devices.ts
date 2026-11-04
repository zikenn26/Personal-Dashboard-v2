import { Capacitor } from '@capacitor/core';
import { DeviceSession } from '../types';
import { DEVICE_SESSION_ID, getOnlineDeviceIds, subscribeToPresenceState } from './neonSync';
import { Storage } from './storage';

const authenticatedHeaders = (): Record<string, string> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('notion_os_auth_token_v1') || '' : '';
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export { DEVICE_SESSION_ID, getOnlineDeviceIds, subscribeToPresenceState };

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
  const info = getDeviceInfo();
  try {
    await fetch('/api/sync/devices/heartbeat', {
      method: 'POST',
      headers: authenticatedHeaders(),
      body: JSON.stringify({ device_id: DEVICE_SESSION_ID, device_name: info.deviceName, platform: info.isApk ? 'android' : info.deviceType, environment: info.browser }),
    });
  } catch {}
  return fetchAccountDevices(email);
};

export const fetchAccountDevices = async (email: string): Promise<DeviceSession[]> => {
  if (!email) return [];
  try {
    const response = await fetch('/api/sync/devices', { headers: authenticatedHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.devices)) return [];
    const devices: DeviceSession[] = result.devices.map((device: any) => ({
      id: device.id,
      deviceName: device.device_name || 'Active Session',
      browser: device.environment || device.user_agent || 'Web Browser',
      os: device.platform || 'Web',
      deviceType: ['android', 'ios'].includes(String(device.platform).toLowerCase()) ? 'mobile' : 'desktop',
      lastActive: Number(device.last_active) || Date.now(),
      createdAt: Number(device.created_at) || Date.now(),
      isCurrent: device.id === DEVICE_SESSION_ID,
      isApk: Boolean(device.platform === 'android' || device.device_name?.includes('APK') || device.environment?.includes('APK')),
    }));
    Storage.setDevices(devices);
    return devices.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  } catch {
    return [];
  }
};

export const revokeDeviceSession = async (
  email: string,
  targetDeviceId: string
): Promise<{ success: boolean; isSelf: boolean }> => {
  if (!email || !targetDeviceId) return { success: false, isSelf: false };
  const isSelf = targetDeviceId === DEVICE_SESSION_ID;
  try {
    const response = await fetch(`/api/sync/devices/${encodeURIComponent(targetDeviceId)}`, { method: 'DELETE', headers: authenticatedHeaders() });
    if (!response.ok) return { success: false, isSelf };
    Storage.setDevices(Storage.getDevices().filter((device) => device.id !== targetDeviceId));
    return { success: true, isSelf };
  } catch {
    return { success: false, isSelf };
  }
};

export const simulateSecondaryDevice = async (email: string): Promise<DeviceSession[]> => {
  // The server enforces one active device session per account.
  return fetchAccountDevices(email);
};
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
  const poll = async () => onDevicesChange(await fetchAccountDevices(email));
  const timer = setInterval(() => void poll(), 8000);
  if (typeof window !== 'undefined') window.addEventListener('focus', poll);
  return () => {
    clearInterval(timer);
    if (typeof window !== 'undefined') window.removeEventListener('focus', poll);
  };
};
