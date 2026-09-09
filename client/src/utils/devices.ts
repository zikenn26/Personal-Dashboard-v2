import { DeviceSession } from '../types';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  DEVICE_SESSION_ID,
  getCustomWorkspaceIdentifier,
} from './supabase';

const DEVICE_STORAGE_PREFIX = 'notion_os_device_sessions_';

/**
 * Detect client device, operating system, and browser platform cleanly
 */
export const getDeviceInfo = (): {
  deviceName: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
} => {
  if (typeof navigator === 'undefined') {
    return {
      deviceName: 'Web Browser',
      browser: 'Web',
      os: 'Cloud',
      deviceType: 'desktop',
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

  return {
    deviceName: `${browser} on ${os}`,
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
 * Deduplicate device sessions so that each physical device (identified by exact ID or OS + Browser + DeviceType)
 * is displayed ONLY ONCE in the account settings device list.
 */
export const deduplicateDevices = (
  devices: DeviceSession[],
  currentDeviceId: string = DEVICE_SESSION_ID
): DeviceSession[] => {
  if (!Array.isArray(devices) || devices.length === 0) return [];

  const deviceMap = new Map<string, DeviceSession>();

  for (const d of devices) {
    if (!d || !d.os || !d.browser) continue;

    // Normalize device key by OS, Browser, and Device Type
    const key = `${d.os.trim().toLowerCase()}___${d.browser.trim().toLowerCase()}___${d.deviceType || 'desktop'}`;

    const existing = deviceMap.get(key);
    if (!existing) {
      deviceMap.set(key, { ...d });
    } else {
      // Prioritize keeping the current device ID if one of them matches
      const isCurrentEntry = d.id === currentDeviceId || existing.id === currentDeviceId;
      const idToKeep =
        d.id === currentDeviceId
          ? d.id
          : existing.id === currentDeviceId
          ? existing.id
          : (d.lastActive || 0) >= (existing.lastActive || 0)
          ? d.id
          : existing.id;

      deviceMap.set(key, {
        ...existing,
        id: idToKeep,
        deviceName: d.deviceName || existing.deviceName,
        os: existing.os,
        browser: existing.browser,
        deviceType: existing.deviceType || d.deviceType,
        // Retain the latest activity
        lastActive: Math.max(d.lastActive || 0, existing.lastActive || 0),
        // Retain the earliest registration
        createdAt: Math.min(d.createdAt || Date.now(), existing.createdAt || Date.now()),
        isCurrent: isCurrentEntry,
      });
    }
  }

  return Array.from(deviceMap.values()).map((d) => ({
    ...d,
    isCurrent: d.id === currentDeviceId,
  }));
};

/**
 * Register current device session in cloud & local database
 */
export const registerCurrentDevice = async (email: string): Promise<DeviceSession[]> => {
  if (!email) return [];
  const cleanEmail = email.trim().toLowerCase();
  const info = getDeviceInfo();

  const currentDevice: DeviceSession = {
    id: DEVICE_SESSION_ID,
    deviceName: info.deviceName,
    browser: info.browser,
    os: info.os,
    deviceType: info.deviceType,
    lastActive: Date.now(),
    createdAt: Date.now(),
    isCurrent: true,
  };

  // 1. Load existing devices
  let existingDevices = await fetchAccountDevices(cleanEmail);

  // 2. Filter out stale sessions older than 45 days
  const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
  existingDevices = existingDevices.filter((d) => d.lastActive > cutoff);

  // 3. Upsert current device: match by exact persistent ID or exact device fingerprint (OS + Browser + Type)
  const existingIdx = existingDevices.findIndex(
    (d) =>
      d.id === DEVICE_SESSION_ID ||
      (d.os.trim().toLowerCase() === info.os.trim().toLowerCase() &&
        d.browser.trim().toLowerCase() === info.browser.trim().toLowerCase() &&
        d.deviceType === info.deviceType)
  );

  if (existingIdx >= 0) {
    existingDevices[existingIdx] = {
      ...existingDevices[existingIdx],
      ...currentDevice,
      id: DEVICE_SESSION_ID,
      createdAt: existingDevices[existingIdx].createdAt || currentDevice.createdAt,
      lastActive: Date.now(),
      isCurrent: true,
    };
  } else {
    existingDevices.unshift(currentDevice);
  }

  // 4. Deduplicate to guarantee exactly one entry per physical device
  existingDevices = deduplicateDevices(existingDevices, DEVICE_SESSION_ID);

  // Save to local cache
  saveLocalDevices(cleanEmail, existingDevices);

  // Save to Supabase Cloud
  const client = getSupabaseClient();
  if (client && isSupabaseConfigured()) {
    try {
      const authIdentifier = `account_devices_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      await client.from('user_workspaces').upsert(
        {
          user_identifier: authIdentifier,
          user_email: cleanEmail,
          workspace_data: {
            devices: existingDevices,
            updatedAt: Date.now(),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_identifier' }
      );
    } catch (err) {
      console.warn('Could not sync device registration to Supabase:', err);
    }
  }

  return existingDevices.map((d) => ({
    ...d,
    isCurrent: d.id === DEVICE_SESSION_ID,
  }));
};

/**
 * Fetch all active devices where this account is logged in
 */
export const fetchAccountDevices = async (email: string): Promise<DeviceSession[]> => {
  if (!email) return [];
  const cleanEmail = email.trim().toLowerCase();
  const localList = getLocalDevices(cleanEmail);

  const client = getSupabaseClient();
  if (client && isSupabaseConfigured()) {
    try {
      const authIdentifier = `account_devices_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      const { data, error } = await client
        .from('user_workspaces')
        .select('workspace_data')
        .eq('user_identifier', authIdentifier)
        .maybeSingle();

      if (!error && data?.workspace_data?.devices && Array.isArray(data.workspace_data.devices)) {
        const rawCloudDevices: DeviceSession[] = data.workspace_data.devices;
        const cloudDevices = deduplicateDevices(rawCloudDevices, DEVICE_SESSION_ID);

        // If duplicate device entries were detected and pruned, persist the cleaned list back to Supabase
        if (cloudDevices.length < rawCloudDevices.length) {
          try {
            await client.from('user_workspaces').upsert(
              {
                user_identifier: authIdentifier,
                user_email: cleanEmail,
                workspace_data: {
                  devices: cloudDevices,
                  updatedAt: Date.now(),
                },
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_identifier' }
            );
          } catch {}
        }

        saveLocalDevices(cleanEmail, cloudDevices);
        return cloudDevices
          .map((d) => ({ ...d, isCurrent: d.id === DEVICE_SESSION_ID }))
          .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));
      }
    } catch (err) {
      console.warn('Could not load devices from Supabase, using local cache:', err);
    }
  }

  // Fallback to local cache with current device guaranteed
  const deduplicatedLocal = deduplicateDevices(localList, DEVICE_SESSION_ID);
  if (deduplicatedLocal.length === 0) {
    const info = getDeviceInfo();
    const fallbackCurrent: DeviceSession = {
      id: DEVICE_SESSION_ID,
      deviceName: info.deviceName,
      browser: info.browser,
      os: info.os,
      deviceType: info.deviceType,
      lastActive: Date.now(),
      createdAt: Date.now(),
      isCurrent: true,
    };
    saveLocalDevices(cleanEmail, [fallbackCurrent]);
    return [fallbackCurrent];
  }

  return deduplicatedLocal
    .map((d) => ({ ...d, isCurrent: d.id === DEVICE_SESSION_ID }))
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

  // 1. Fetch current devices list
  const currentList = await fetchAccountDevices(cleanEmail);
  const updatedList = currentList.filter((d) => d.id !== targetDeviceId);

  saveLocalDevices(cleanEmail, updatedList);

  // 2. Persist to Supabase
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
            revokedDeviceId: targetDeviceId,
            revokedAt: Date.now(),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_identifier' }
      );

      // 3. Broadcast revocation over Realtime WebSocket channel to trigger immediate logout on target device
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
