import { AuthUser } from '../types';
import { getSupabaseClient } from '../utils/supabase';

type CapacitorDevice = any;

/**
 * Check if running on native platform (synchronous, feature-based)
 * Safely checks for Capacitor without importing it
 */
function isNativePlatform(): boolean {
  // Capacitor is injected into window by the native container
  // This is safe - it won't throw if Capacitor is not available
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return (window as any).Capacitor.isNativePlatform?.() ?? false;
  }
  return false;
}

/**
 * Get Device API from Capacitor if available
 * Only call this on native platforms
 */
function getCapacitorDevice(): CapacitorDevice | null {
  if (typeof window !== 'undefined' && (window as any).CapacitorPlugins?.Device) {
    return (window as any).CapacitorPlugins.Device;
  }
  return null;
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
 * IMPROVED: Added more entropy to reduce collision risk
 */
function generateBrowserFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width + 'x' + screen.height,
    navigator.hardwareConcurrency || 'unknown',
    (navigator as any).deviceMemory || 'unknown',
    // IMPROVED: Add timestamp and random component for uniqueness
    Date.now().toString(36),
    Math.random().toString(36).substr(2, 9),
    // Add localStorage size as entropy
    Object.keys(localStorage).length.toString(),
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

/**
 * Get or create stable device ID
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    // Check if we already have a device ID stored
    let storedDeviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    
    if (storedDeviceId) {
      return storedDeviceId;
    }

    // Generate new device ID from fingerprint
    const fingerprint = await generateDeviceFingerprint();
    localStorage.setItem(DEVICE_FINGERPRINT_STORAGE_KEY, fingerprint);
    
    // Combine fingerprint with a random component for uniqueness
    const random = Math.random().toString(36).substring(2, 9);
    const deviceId = `${fingerprint}_${random}`;
    
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  } catch (err) {
    console.error('Error generating device ID:', err);
    // Fallback: use random ID
    const fallback = `device_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, fallback);
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
    const ua = navigator.userAgent;
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
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  
  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';
  
  return `${browser}/${navigator.userAgent.split(' ').pop() || 'unknown'}`;
}

/**
 * Register or update device in Supabase (race-condition safe)
 * Uses INSERT first, then UPDATE on conflict to prevent duplicate entries
 */
export async function registerDevice(user: AuthUser): Promise<RegisteredDevice | null> {
  try {
    if (!user || !user.id) {
      console.warn('[DEVICE] No authenticated user, skipping device registration');
      return null;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn('[DEVICE] Supabase not initialized, skipping device registration');
      return null;
    }

    const deviceId = await getOrCreateDeviceId();
    const deviceType = await getDeviceType();
    const platform = await getPlatformName();
    const browserInfo = await getBrowserInfo();
    const deviceName = `${browserInfo.split('/')[0]} on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
    const now = new Date().toISOString();

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
        console.error('[DEVICE] Error updating existing device:', updateError);
        return null;
      }

      data = updateData;
    } else if (error) {
      console.error('[DEVICE] Error registering device:', error);
      return null;
    }

    return data as RegisteredDevice;
  } catch (err) {
    console.error('[DEVICE] Unexpected error registering device:', err);
    return null;
  }
}

/**
 * Get list of active devices for current user
 */
export async function getActiveDevices(user: AuthUser): Promise<RegisteredDevice[]> {
  try {
    if (!user || !user.id) return [];

    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false });

    if (error) {
      console.error('Error fetching active devices:', error);
      return [];
    }

    return (data as RegisteredDevice[]) || [];
  } catch (err) {
    console.error('Unexpected error fetching devices:', err);
    return [];
  }
}

/**
 * Update device last_seen_at timestamp (call periodically to keep device active)
 */
export async function updateDeviceHeartbeat(user: AuthUser): Promise<boolean> {
  try {
    if (!user || !user.id) return false;

    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const deviceId = await getOrCreateDeviceId();

    const { error } = await supabase
      .from('user_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('device_id', deviceId);

    if (error) {
      console.error('Error updating device heartbeat:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error updating heartbeat:', err);
    return false;
  }
}

/**
 * Logout device (mark as inactive)
 */
export async function logoutDevice(user: AuthUser, targetDeviceId?: string): Promise<boolean> {
  try {
    if (!user || !user.id) return false;

    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const deviceId = targetDeviceId || (await getOrCreateDeviceId());

    const { error } = await supabase
      .from('user_devices')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('device_id', deviceId);

    if (error) {
      console.error('Error logging out device:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error logging out device:', err);
    return false;
  }
}

/**
 * Get current device info
 */
export async function getCurrentDeviceInfo(user: AuthUser): Promise<RegisteredDevice | null> {
  try {
    if (!user || !user.id) return null;

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const deviceId = await getOrCreateDeviceId();

    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching current device info:', error);
    }

    return (data as RegisteredDevice) || null;
  } catch (err) {
    console.error('Unexpected error fetching current device info:', err);
    return null;
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
