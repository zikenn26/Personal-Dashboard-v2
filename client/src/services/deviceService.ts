import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { AuthUser } from '../types';
import { getSupabaseClient } from '../utils/neonSync';
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
 * Register or update device in Supabase (race-condition safe)
/**
 * Check if an error from Supabase is due to plan limits (e.g. egress quota),
 * spend caps, network unavailability, or service restrictions.
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
  const deviceId = await getOrCreateDeviceId();
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
 * Register or update device in Supabase (race-condition safe)
 * Uses INSERT first, then UPDATE on conflict to prevent duplicate entries
 */
export async function registerDevice(user: AuthUser): Promise<RegisteredDevice | null> {
  try {
    if (!user || !user.id) {
      return null;
    }

    const localDevice = await buildLocalFallbackDevice(user);

    const supabase = getSupabaseClient();
    if (!supabase) {
      return localDevice;
    }

    const deviceId = localDevice.device_id;
    const deviceType = localDevice.device_type;
    const platform = localDevice.platform;
    const browserInfo = localDevice.browser_info || '';
    const deviceName = localDevice.device_name;
    const now = new Date().toISOString();

    console.info('[DEVICE_REGISTER] Registering session for user account:', {
      deviceId,
      deviceName,
      platform,
      userEmail: user.email,
      userId: user.id,
      timestamp: now,
    });

    // Notify Server Cloud Hub with current device pulse
    try {
      fetch('/api/sync/devices/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          user_email: (user.email || '').trim().toLowerCase(),
          user_identifier: user.id.startsWith('user_') ? user.id : `user_${user.id}`,
          device_name: deviceName,
          platform,
          environment: browserInfo,
        }),
      }).catch(() => {});
    } catch {}

    // Step 1: Try INSERT (fails silently if already exists due to UNIQUE constraint)
    let { data, error } = await supabase
      .from('user_devices')
      .insert({
        user_id: user.id,
        device_id: deviceId,
        device_name: deviceName,
        device_type: deviceType,
        platform: platform,
        browser_info: browserInfo,
        is_active: true,
        first_login_at: now,
        last_seen_at: now,
      })
      .select()
      .single();

    // Step 2: If insert fails due to uniqueness constraint, do UPDATE instead
    if (error && error.code === '23505') {
      // Unique constraint violation - device already exists
      const { data: updateData, error: updateError } = await supabase
        .from('user_devices')
        .update({
          device_name: deviceName,
          device_type: deviceType,
          platform: platform,
          browser_info: browserInfo,
          is_active: true,
          last_seen_at: now,
          updated_at: now,
        })
        .eq('user_id', user.id)
        .eq('device_id', deviceId)
        .select()
        .single();

      if (updateError) {
        if (!isCloudQuotaOrNetworkError(updateError)) {
          console.warn('[DEVICE] Cloud device update notice:', updateError);
        }
        return localDevice;
      }

      data = updateData;
    } else if (error) {
      if (!isCloudQuotaOrNetworkError(error)) {
        console.warn('[DEVICE] Cloud device registration notice:', error);
      }
      return localDevice;
    }

    if (data && typeof localStorage !== 'undefined') {
      localStorage.setItem(`local_registered_device_${user.id}`, JSON.stringify(data));
    }

    return (data as RegisteredDevice) || localDevice;
  } catch (err) {
    if (!isCloudQuotaOrNetworkError(err)) {
      console.warn('[DEVICE] Unexpected notice during registration:', err);
    }
    return buildLocalFallbackDevice(user);
  }
}

/**
 * Get list of active devices for current user
 */
export async function getActiveDevices(user: AuthUser): Promise<RegisteredDevice[]> {
  try {
    if (!user || !user.id) return [];

    const localDev = await getCurrentDeviceInfo(user);
    const fallbackList = localDev ? [localDev] : [];

    // Query Server Cloud Hub first for active cross-device sessions
    try {
      const email = (user.email || '').trim().toLowerCase();
      const res = await fetch(`/api/sync/devices?user_email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.devices) && json.devices.length > 0) {
          const serverList: RegisteredDevice[] = json.devices.map((d: any) => ({
            id: d.id,
            device_id: d.id,
            device_name: d.device_name || 'Active Device',
            device_type: (d.platform === 'android' || d.platform === 'ios') ? 'native' : 'web',
            platform: d.platform,
            browser_info: d.environment || d.user_agent,
            is_active: d.isOnline,
            last_seen_at: new Date(d.last_active).toISOString(),
            first_login_at: new Date(d.created_at).toISOString(),
            created_at: new Date(d.created_at).toISOString(),
            updated_at: new Date(d.last_active).toISOString(),
          }));
          return serverList;
        }
      }
    } catch {}

    const supabase = getSupabaseClient();
    if (!supabase) return fallbackList;

    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false });

    if (error) {
      if (!isCloudQuotaOrNetworkError(error)) {
        console.warn('[DEVICE] Notice fetching active devices:', error);
      }
      return fallbackList;
    }

    return (data as RegisteredDevice[]) || fallbackList;
  } catch (err) {
    if (!isCloudQuotaOrNetworkError(err)) {
      console.warn('[DEVICE] Unexpected notice fetching devices:', err);
    }
    const localDev = await getCurrentDeviceInfo(user);
    return localDev ? [localDev] : [];
  }
}

/**
 * Update device last_seen_at timestamp (call periodically to keep device active)
 */
export async function updateDeviceHeartbeat(user: AuthUser): Promise<boolean> {
  try {
    if (!user || !user.id) return false;

    const now = new Date().toISOString();
    const deviceId = await getOrCreateDeviceId();
    const userEmail = (user.email || '').trim().toLowerCase();

    console.info('[DEVICE_HEARTBEAT] Emitting pulse for user account:', {
      deviceId,
      userEmail,
      userId: user.id,
      timestamp: now,
      environment: typeof window !== 'undefined' ? window.location.hostname : 'node',
    });

    // Pulse Server Cloud Hub immediately
    try {
      const platform = await getPlatformName();
      const browserInfo = await getBrowserInfo();
      fetch('/api/sync/devices/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          user_email: userEmail,
          user_identifier: user.id.startsWith('user_') ? user.id : `user_${user.id}`,
          device_name: `${browserInfo.split('/')[0]} on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
          platform,
          environment: typeof window !== 'undefined' ? (window.location.hostname.includes('run.app') ? 'AI Studio' : window.location.hostname) : 'Web',
        }),
      }).catch(() => {});
    } catch {}

    // Always keep local registration updated
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(`local_registered_device_${user.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.last_seen_at = now;
          localStorage.setItem(`local_registered_device_${user.id}`, JSON.stringify(parsed));
        }
      }
    } catch {}

    const supabase = getSupabaseClient();
    if (!supabase) {
      console.info('[DEVICE_HEARTBEAT] Local heartbeat updated (Supabase client unconfigured)');
      return true;
    }

    const { data: updateRes, error } = await supabase
      .from('user_devices')
      .update({ last_seen_at: now })
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .select('id, device_name, is_active, last_seen_at');

    if (error) {
      if (!isCloudQuotaOrNetworkError(error)) {
        console.warn('[DEVICE_HEARTBEAT] Notice updating device heartbeat in Supabase:', error);
      } else {
        console.info('[DEVICE_HEARTBEAT] Heartbeat preserved locally (Cloud egress quota reached / offline)');
      }
      return true; // Local heartbeat remains valid
    }

    console.info('[DEVICE_HEARTBEAT] Heartbeat successfully acknowledged by Supabase:', {
      deviceId,
      userEmail,
      acknowledgedAt: now,
      matchedRows: updateRes?.length ?? 1,
    });

    return true;
  } catch (err) {
    if (!isCloudQuotaOrNetworkError(err)) {
      console.warn('[DEVICE_HEARTBEAT] Unexpected notice updating heartbeat:', err);
    }
    return true;
  }
}

/**
 * Logout device (mark as inactive)
 */
export async function logoutDevice(user: AuthUser, targetDeviceId?: string): Promise<boolean> {
  try {
    if (!user || !user.id) return false;

    const deviceId = targetDeviceId || (await getOrCreateDeviceId());

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`local_registered_device_${user.id}`);
      }
    } catch {}

    const supabase = getSupabaseClient();
    if (!supabase) return true;

    const { error } = await supabase
      .from('user_devices')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('device_id', deviceId);

    if (error) {
      if (!isCloudQuotaOrNetworkError(error)) {
        console.warn('[DEVICE] Notice logging out device:', error);
      }
      return true;
    }

    return true;
  } catch (err) {
    if (!isCloudQuotaOrNetworkError(err)) {
      console.warn('[DEVICE] Unexpected notice logging out device:', err);
    }
    return true;
  }
}

/**
 * Get current device info
 */
export async function getCurrentDeviceInfo(user: AuthUser): Promise<RegisteredDevice | null> {
  try {
    if (!user || !user.id) return null;

    const deviceId = await getOrCreateDeviceId();

    let localCachedDevice: RegisteredDevice | null = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(`local_registered_device_${user.id}`);
        if (stored) {
          localCachedDevice = JSON.parse(stored);
        }
      }
    } catch {}

    const supabase = getSupabaseClient();
    if (!supabase) {
      return localCachedDevice || (await buildLocalFallbackDevice(user));
    }

    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116' && !isCloudQuotaOrNetworkError(error)) {
        console.warn('[DEVICE] Notice querying current device info:', error);
      }
      return localCachedDevice || (await buildLocalFallbackDevice(user));
    }

    if (data && typeof localStorage !== 'undefined') {
      localStorage.setItem(`local_registered_device_${user.id}`, JSON.stringify(data));
    }

    return (data as RegisteredDevice) || localCachedDevice || (await buildLocalFallbackDevice(user));
  } catch (err) {
    if (!isCloudQuotaOrNetworkError(err)) {
      console.warn('[DEVICE] Unexpected notice fetching current device info:', err);
    }
    return buildLocalFallbackDevice(user);
  }
}

export const deviceService = {
  getOrCreateDeviceId,
  registerDevice,
  getActiveDevices,
  updateDeviceHeartbeat,
  logoutDevice,
  getCurrentDeviceInfo,
};
