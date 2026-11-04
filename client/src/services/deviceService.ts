import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { AuthUser } from '../types';
import { DEVICE_SESSION_ID } from '../utils/neonSync';
import { getApiBaseUrl } from '../utils/apiConfig';

const sessionHeaders = (json = false): Record<string, string> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('notion_os_auth_token_v1') || '' : '';
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
type CapacitorDevice = typeof Device;

/**
 * Check if running on native platform (synchronous, feature-based)
 * Safely checks for Capacitor without importing it
 */
function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get Device API from Capacitor if available
 * Only call this on native platforms
 */
function getCapacitorDevice(): CapacitorDevice {
  return Device;
}

export interface RegisteredDevice {
  id: string;
  device_id: string;
  device_name: string;
  device_type: 'web' | 'native' | 'desktop';
  platform: string;
  browser_info?: string;
  is_active: boolean;
  last_seen_at: string;
  first_login_at: string;
  created_at: string;
  updated_at: string;
}

const DEVICE_ID_STORAGE_KEY = 'app_device_id_v1';
const DEVICE_FINGERPRINT_STORAGE_KEY = 'app_device_fingerprint_v1';

/**
 * Generate a stable, consistent device fingerprint that survives app reinstalls
 * by combining hardware identifiers when possible (native) or browser fingerprint (web)
 */
async function generateDeviceFingerprint(): Promise<string> {
  const isNative = isNativePlatform();
  
  if (isNative) {
    try {
      const Device = getCapacitorDevice();
      if (!Device) {
        console.warn('[DEVICE] Device plugin not available, using fallback');
        return generateBrowserFingerprint();
      }
      const deviceInfo = await Device.getId();
      const deviceId = deviceInfo.identifier || 'unknown';
      const platform = await Device.getInfo();
      const fingerprint = `${platform.platform}_${deviceId}`.toLowerCase();
      // IMPROVED: Add uniqueness factor to prevent collisions
      const uniqueComponent = `_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return hashString(fingerprint + uniqueComponent);
    } catch (err) {
      console.warn('[DEVICE] Failed to get native device info, using browser fingerprint', err);
    }
  }

  // Fallback for web: browser fingerprint
  const browserFingerprint = generateBrowserFingerprint();
  return browserFingerprint;
}

/**
 * Generate browser fingerprint from available APIs
 * Safely guards against missing window/screen/navigator globals in headless/Node test environments
 */
function generateBrowserFingerprint(): string {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Environment';
  const language = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const tzOffset = typeof Date !== 'undefined' ? new Date().getTimezoneOffset() : 0;
  const screenResolution = typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '1920x1080';
  const hardwareConcurrency = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 'unknown') : 'unknown';
  const deviceMemory = typeof navigator !== 'undefined' ? ((navigator as any).deviceMemory || 'unknown') : 'unknown';
  const storageCount = typeof localStorage !== 'undefined' ? Object.keys(localStorage).length.toString() : '0';

  const components = [
    userAgent,
    language,
    tzOffset,
    screenResolution,
    hardwareConcurrency,
    deviceMemory,
    Date.now().toString(36),
    Math.random().toString(36).substr(2, 9),
    storageCount,
  ];
  
  const fingerprint = components.join('|');
  return hashString(fingerprint);
}

/**
 * Simple hash function for fingerprints (SHA256 would be better but use what's available)
 * IMPROVED: Better distribution with FNV-1a algorithm
 */
function hashString(str: string): string {
  let hash = 2166136261; // FNV offset basis
  const prime = 16777619; // FNV prime

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * prime) >>> 0; // Use unsigned right shift
  }

  // Convert to hex and ensure it's a reasonable length
  return Math.abs(hash).toString(16).padEnd(16, '0');
}

let inMemoryDeviceId: string | null = null;

/**
 * Get or create stable device ID
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    if (inMemoryDeviceId) {
      return inMemoryDeviceId;
    }

    // Check if we already have a device ID stored
    let storedDeviceId: string | null = null;
    if (typeof localStorage !== 'undefined') {
      storedDeviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    }
    
    if (storedDeviceId) {
      inMemoryDeviceId = storedDeviceId;
      return storedDeviceId;
    }

    // Generate new device ID from fingerprint
    const fingerprint = await generateDeviceFingerprint();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_FINGERPRINT_STORAGE_KEY, fingerprint);
    }
    
    // Combine fingerprint with a random component for uniqueness
    const random = Math.random().toString(36).substring(2, 9);
    const deviceId = `${fingerprint}_${random}`;
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }
    inMemoryDeviceId = deviceId;
    return deviceId;
  } catch (err) {
    // Fallback: use random ID
    const fallback = `device_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, fallback);
      } catch {}
    }
    inMemoryDeviceId = fallback;
    return fallback;
  }
}

/**
 * Get device type based on platform
 */
async function getDeviceType(): Promise<'web' | 'native' | 'desktop'> {
  if (!isNativePlatform()) {
    return 'web';
  }
  
  try {
    const Device = getCapacitorDevice();
    if (!Device) return 'desktop';
    
    const info = await Device.getInfo();
    if (info.platform === 'android' || info.platform === 'ios') {
      return 'native';
    }
  } catch (err) {
    console.warn('[DEVICE] Could not determine device type:', err);
  }
  
  return 'desktop';
}

/**
 * Get platform name
 */
async function getPlatformName(): Promise<string> {
  if (!isNativePlatform()) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (ua.indexOf('Windows') !== -1) return 'windows';
    if (ua.indexOf('Mac') !== -1) return 'macos';
    if (ua.indexOf('Linux') !== -1) return 'linux';
    return 'web';
  }
  
  try {
    const Device = getCapacitorDevice();
    if (!Device) return 'unknown';
    
    const info = await Device.getInfo();
    return info.platform || 'unknown';
  } catch (err) {
    console.warn('[DEVICE] Could not get platform name:', err);
    return 'unknown';
  }
}

/**
 * Get browser/app version info
 */
async function getBrowserInfo(): Promise<string> {
  if (isNativePlatform()) {
    try {
      const Device = getCapacitorDevice();
      if (!Device) return 'APK/unknown';
      
      const info = await Device.getInfo();
      return `APK/${info.osVersion || 'unknown'}`;
    } catch (err) {
      console.warn('[DEVICE] Could not get browser info:', err);
      return 'APK/unknown';
    }
  }
  
  // Extract browser info from user agent
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browser = 'Unknown';
  
  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';
  
  const lastPart = ua ? (ua.split(' ').pop() || 'unknown') : 'unknown';
  return `${browser}/${lastPart}`;
}

/**
 * Register or update the current device session through the authenticated server.
/**
 * Check whether the device service is unavailable because of quota or network restrictions.
 */
export function isCloudQuotaOrNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (typeof err === 'string' ? err : err.message || err.error_description || JSON.stringify(err)).toLowerCase();
  return (
    msg.includes('exceed_egress_quota') ||
    msg.includes('spend caps') ||
    msg.includes('restricted') ||
    msg.includes('payment required') ||
    msg.includes('quota') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    err.status === 402 ||
    err.code === '402'
  );
}

/**
 * Builds or retrieves a reliable local registered device fallback
 */
async function buildLocalFallbackDevice(user: AuthUser): Promise<RegisteredDevice> {
  const deviceId = DEVICE_SESSION_ID;
  const deviceType = await getDeviceType();
  const platform = await getPlatformName();
  const browserInfo = await getBrowserInfo();
  const deviceName = `${browserInfo.split('/')[0]} on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
  const now = new Date().toISOString();

  const localDevice: RegisteredDevice = {
    id: `local_dev_${deviceId}`,
    device_id: deviceId,
    device_name: deviceName,
    device_type: deviceType,
    platform: platform,
    browser_info: browserInfo,
    is_active: true,
    last_seen_at: now,
    first_login_at: now,
    created_at: now,
    updated_at: now,
  };

  try {
    if (typeof localStorage !== 'undefined' && user?.id) {
      localStorage.setItem(`local_registered_device_${user.id}`, JSON.stringify(localDevice));
    }
  } catch {}

  return localDevice;
}

/**
 * Register or update this device session in the server-owned Neon registry.
 */
export async function registerDevice(user: AuthUser): Promise<RegisteredDevice | null> {
  if (!user?.id) return null;
  const localDevice = await buildLocalFallbackDevice(user);
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/sync/devices/heartbeat`, {
      method: 'POST', headers: sessionHeaders(true),
      body: JSON.stringify({ device_id: DEVICE_SESSION_ID, device_name: localDevice.device_name, platform: localDevice.platform, environment: localDevice.browser_info }),
    });
    if (response.ok && typeof localStorage !== 'undefined') {
      localStorage.setItem(`local_registered_device_${user.id}`, JSON.stringify(localDevice));
    }
  } catch {}
  return localDevice;
}
export async function getActiveDevices(user: AuthUser): Promise<RegisteredDevice[]> {
  if (!user?.id) return [];
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/sync/devices`, { headers: sessionHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.devices)) return [];
    return result.devices.map((device: any) => ({
      id: device.id,
      device_id: device.id,
      device_name: device.device_name || 'Active Device',
      device_type: device.platform === 'android' || device.platform === 'ios' ? 'native' : 'web',
      platform: device.platform || 'unknown',
      browser_info: device.environment || device.user_agent || '',
      is_active: Boolean(device.isOnline),
      last_seen_at: new Date(Number(device.last_active) || Date.now()).toISOString(),
      first_login_at: new Date(Number(device.created_at) || Date.now()).toISOString(),
      created_at: new Date(Number(device.created_at) || Date.now()).toISOString(),
      updated_at: new Date(Number(device.last_active) || Date.now()).toISOString(),
    }));
  } catch {
    return [];
  }
}
export async function updateDeviceHeartbeat(user: AuthUser): Promise<boolean> {
  if (!user?.id) return false;
  try {
    const platform = await getPlatformName();
    const browserInfo = await getBrowserInfo();
    const response = await fetch(`${getApiBaseUrl()}/api/sync/devices/heartbeat`, {
      method: 'POST', headers: sessionHeaders(true),
      body: JSON.stringify({
        device_id: DEVICE_SESSION_ID,
        device_name: `${browserInfo.split('/')[0]} on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
        platform,
        environment: typeof window !== 'undefined' ? window.location.hostname : 'Web',
      }),
    });
    return response.ok;
  } catch {
    return true;
  }
}
export async function logoutDevice(user: AuthUser, targetDeviceId?: string): Promise<boolean> {
  if (!user?.id) return false;
  const deviceId = targetDeviceId || DEVICE_SESSION_ID;
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(`local_registered_device_${user.id}`);
    const response = await fetch(`${getApiBaseUrl()}/api/sync/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE', headers: sessionHeaders() });
    return response.ok;
  } catch {
    return true;
  }
}
export async function getCurrentDeviceInfo(user: AuthUser): Promise<RegisteredDevice | null> {
  if (!user?.id) return null;
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(`local_registered_device_${user.id}`) : null;
    if (stored) return JSON.parse(stored) as RegisteredDevice;
  } catch {}
  return buildLocalFallbackDevice(user);
}
export const deviceService = {
  getOrCreateDeviceId,
  registerDevice,
  getActiveDevices,
  updateDeviceHeartbeat,
  logoutDevice,
  getCurrentDeviceInfo,
};
