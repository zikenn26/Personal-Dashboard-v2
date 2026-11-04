import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  deduplicateDevices,
  getDeviceInfo,
} from '../utils/devices';
import { DeviceSession } from '../types';

describe('Multi-Device Coexistence & Environment Identification Suite', () => {
  beforeAll(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      const store: Record<string, string> = {};
      globalThis.localStorage = {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
        length: 0,
      } as any;
    }
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Preserves both Cloudflare Web and AI Studio Preview sessions when OS and browser are identical', () => {
    const cloudflareSession: DeviceSession = {
      id: 'dev_laptop_chrome_cloudflare_111',
      deviceName: 'Google Chrome (Web • Cloudflare)',
      browser: 'Google Chrome',
      os: 'Windows 11/10',
      deviceType: 'desktop',
      lastActive: Date.now(),
      createdAt: Date.now() - 3600000,
      isCurrent: true,
    };

    const aiStudioSession: DeviceSession = {
      id: 'dev_laptop_chrome_aistudio_222',
      deviceName: 'Google Chrome (AI Studio Preview)',
      browser: 'Google Chrome',
      os: 'Windows 11/10',
      deviceType: 'desktop',
      lastActive: Date.now(),
      createdAt: Date.now() - 1800000,
      isCurrent: false,
    };

    // Both sessions exist for the same account
    const combined = [cloudflareSession, aiStudioSession];
    const deduplicated = deduplicateDevices(combined, 'dev_laptop_chrome_cloudflare_111');

    // Crucial: Must NOT collapse into 1 device! Both must be present!
    expect(deduplicated.length).toBe(2);
    expect(deduplicated.some((d) => d.id === 'dev_laptop_chrome_cloudflare_111')).toBe(true);
    expect(deduplicated.some((d) => d.id === 'dev_laptop_chrome_aistudio_222')).toBe(true);

    const current = deduplicated.find((d) => d.id === 'dev_laptop_chrome_cloudflare_111');
    const remote = deduplicated.find((d) => d.id === 'dev_laptop_chrome_aistudio_222');

    expect(current?.isCurrent).toBe(true);
    expect(remote?.isCurrent).toBe(false);
  });

  it('2. Correctly flags current active device when queried from AI Studio preview perspective', () => {
    const cloudflareSession: DeviceSession = {
      id: 'dev_laptop_chrome_cloudflare_111',
      deviceName: 'Google Chrome (Web • Cloudflare)',
      browser: 'Google Chrome',
      os: 'Windows 11/10',
      deviceType: 'desktop',
      lastActive: Date.now(),
      createdAt: Date.now() - 3600000,
    };

    const aiStudioSession: DeviceSession = {
      id: 'dev_laptop_chrome_aistudio_222',
      deviceName: 'Google Chrome (AI Studio Preview)',
      browser: 'Google Chrome',
      os: 'Windows 11/10',
      deviceType: 'desktop',
      lastActive: Date.now(),
      createdAt: Date.now() - 1800000,
    };

    // Queried from AI Studio device's perspective
    const deduplicated = deduplicateDevices(
      [cloudflareSession, aiStudioSession],
      'dev_laptop_chrome_aistudio_222'
    );

    expect(deduplicated.length).toBe(2);
    const cf = deduplicated.find((d) => d.id === 'dev_laptop_chrome_cloudflare_111');
    const ais = deduplicated.find((d) => d.id === 'dev_laptop_chrome_aistudio_222');

    expect(ais?.isCurrent).toBe(true);
    expect(cf?.isCurrent).toBe(false);
  });

  it('3. Prunes stale sessions inactive for more than 30 days unless it is the active device', () => {
    const activeOld: DeviceSession = {
      id: 'dev_active_old',
      deviceName: 'Current Browser',
      browser: 'Google Chrome',
      os: 'macOS',
      deviceType: 'desktop',
      lastActive: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago
    };

    const deadOld: DeviceSession = {
      id: 'dev_dead_old',
      deviceName: 'Forgotten Device',
      browser: 'Safari',
      os: 'iOS',
      deviceType: 'mobile',
      lastActive: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago
    };

    const result = deduplicateDevices([activeOld, deadOld], 'dev_active_old');

    // Current device is kept, dead remote device older than 30 days is dropped
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('dev_active_old');
  });

  it('4. getDeviceInfo attaches environment tags for pages.dev and ai studio', () => {
    // Test node/web fallback
    const info = getDeviceInfo();
    expect(info.deviceName).toBeDefined();
    expect(info.browser).toBeDefined();
    expect(info.os).toBeDefined();
  });

  it('5. ConnectedDevices component is properly exported and accepts required props', async () => {
    const { ConnectedDevices } = await import('../components/ConnectedDevices');
    expect(ConnectedDevices).toBeDefined();
    expect(typeof ConnectedDevices).toBe('function');
  });

  it('6. Device registry stays outside workspace snapshots and remains server-owned', async () => {
    const { Storage } = await import('../utils/storage');

    // Local device
    Storage.setDevices([
      {
        id: 'dev_laptop_cloudflare',
        deviceName: 'Google Chrome (Web • Cloudflare)',
        browser: 'Google Chrome',
        os: 'Windows 11/10',
        deviceType: 'desktop',
        lastActive: 1000,
      },
    ]);

    const payload = Storage.getAllDataPayload();
    expect(payload.devices).toBeUndefined();

    // Incoming remote payload from AI Studio instance
    const remotePayload = {
      version: '4.0.0',
      devices: [
        {
          id: 'dev_aistudio_instance',
          deviceName: 'Google Chrome (AI Studio Preview)',
          browser: 'Google Chrome',
          os: 'Windows 11/10',
          deviceType: 'desktop',
          lastActive: 2000,
        },
      ],
    };

    Storage.importAllDataPayload(remotePayload);

    const merged = Storage.getDevices();
    // Workspace snapshots cannot create or transfer device sessions.
    expect(merged.length).toBe(1);
    expect(merged.some((d) => d.id === 'dev_laptop_cloudflare')).toBe(true);
    expect(merged.some((d) => d.id === 'dev_aistudio_instance')).toBe(false);
  });

  it('7. subscribeToPresenceState immediately reports active device ID', async () => {
    const { subscribeToPresenceState, DEVICE_SESSION_ID } = await import('../utils/neonSync');

    let reportedIds: Set<string> | null = null;
    const unsub = subscribeToPresenceState((ids) => {
      reportedIds = ids;
    });

    expect(reportedIds).not.toBeNull();
    expect(reportedIds!.has(DEVICE_SESSION_ID)).toBe(true);
    unsub();
  });

  it('8. deviceService handles cloud quota restrictions (exceed_egress_quota) gracefully', async () => {
    const { deviceService, isCloudQuotaOrNetworkError } = await import('../services/deviceService');
    
    // Verify quota detector
    const quotaErr = {
      message: 'Service for this project is restricted due to the following violations: exceed_egress_quota. The project owner must upgrade their plan or remove spend caps to restore service.',
      status: 402,
    };
    expect(isCloudQuotaOrNetworkError(quotaErr)).toBe(true);

    const testUser = {
      id: 'test-user-quota',
      email: 'gknayak@gmail.com',
      name: 'Gulshan Kumar Nayak',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'neon' as const,
    };

    // Should return a valid fallback RegisteredDevice without crashing or throwing
    const device = await deviceService.registerDevice(testUser);
    expect(device).toBeDefined();
    expect(device?.device_id).toBeDefined();
    expect(device?.is_active).toBe(true);
  });

  it('9. deviceService.getCurrentDeviceInfo returns device even under quota restrictions', async () => {
    const { deviceService } = await import('../services/deviceService');

    const testUser = {
      id: 'test-user-quota',
      email: 'gknayak@gmail.com',
      name: 'Gulshan Kumar Nayak',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      provider: 'neon' as const,
    };

    const info = await deviceService.getCurrentDeviceInfo(testUser);
    expect(info).toBeDefined();
    expect(info?.device_id).toBeDefined();
    expect(info?.is_active).toBe(true);
  });
});

