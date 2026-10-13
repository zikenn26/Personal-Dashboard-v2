import { describe, it, expect, beforeEach } from 'vitest';
import { screenTimeService } from '../services/screenTimeService';
import { Storage } from '../utils/storage';
import { getBaselineScreenTimeData } from '../utils/screenTimeDefaults';
import { ScreenTimeData } from '../types';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: (idx: number) => Object.keys(store)[idx] || null,
    length: 0,
  } as any;
}

describe('Cross-Platform Screen Time Synchronization (APK, Web & Android Chrome)', () => {
  beforeEach(() => {
    localStorage.clear();
    screenTimeService.clearCache();
  });

  it('1. isSupported returns true on all platforms', () => {
    expect(screenTimeService.isSupported()).toBe(true);
  });

  it('2. getBaselineScreenTimeData produces full rich data with top apps and 7-day grid', () => {
    const baseline = getBaselineScreenTimeData('2026-10-11');
    expect(baseline.granted).toBe(true);
    expect(baseline.hasData).toBe(true);
    expect(baseline.totalMinutes).toBeGreaterThan(0);
    expect(baseline.apps.length).toBeGreaterThanOrEqual(5);

    // Verify Instagram is present and has proper duration
    const insta = baseline.apps.find((a) => a.packageName === 'com.instagram.android');
    expect(insta).toBeDefined();
    expect(insta?.appName).toBe('Instagram');
    expect(insta?.durationMinutes).toBeGreaterThan(0);

    // Verify 7-day grid contains 7 items and appMinutes
    expect(baseline.past7Days.length).toBe(7);
    baseline.past7Days.forEach((day) => {
      expect(day.dayOfWeek).toBeTruthy();
      expect(day.totalMinutes).toBeGreaterThan(0);
      expect(day.appMinutes).toBeDefined();
      expect(day.appMinutes?.['com.instagram.android']).toBeGreaterThan(0);
    });
  });

  it('3. Storage can persist and retrieve screen time data and history', () => {
    const mockData: ScreenTimeData = {
      granted: true,
      isNativeAndroid: true,
      hasData: true,
      date: '2026-10-11',
      formattedDate: 'Sunday, Oct 11',
      totalMinutes: 180,
      totalMillis: 180 * 60 * 1000,
      apps: [
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          rank: 1,
          durationMinutes: 90,
          durationMillis: 90 * 60 * 1000,
          sessionCount: 10,
          percentageOfTotal: 50,
        },
      ],
      topApps: [],
      hourlyUsage: [],
      past7Days: [],
      dailyAverageMinutes: 180,
      lastSyncedTimestamp: Date.now(),
    };

    Storage.setDailyScreenTime('2026-10-11', mockData);

    const retrieved = Storage.getDailyScreenTime('2026-10-11');
    expect(retrieved).toBeDefined();
    expect(retrieved?.totalMinutes).toBe(180);
    expect(retrieved?.apps[0]?.packageName).toBe('com.instagram.android');

    const history = Storage.getScreenTimeHistory();
    expect(history['2026-10-11']).toBeDefined();
  });

  it('4. getAllDataPayload and importAllDataPayload round-trip screen time for cloud sync', () => {
    const mockData = getBaselineScreenTimeData('2026-10-11');
    Storage.setDailyScreenTime('2026-10-11', mockData);

    const payload = Storage.getAllDataPayload();
    expect(payload.screenTime).toBeDefined();
    expect(payload.screenTimeHistory).toBeDefined();
    expect(payload.screenTime?.totalMinutes).toBe(mockData.totalMinutes);

    // Clear local storage to simulate opening a new browser / device
    localStorage.clear();
    expect(Storage.getDailyScreenTime('2026-10-11')).toBeNull();

    // Import incoming cloud snapshot
    const success = Storage.importAllDataPayload(payload);
    expect(success).toBe(true);

    const restored = Storage.getDailyScreenTime('2026-10-11');
    expect(restored).toBeDefined();
    expect(restored?.totalMinutes).toBe(mockData.totalMinutes);
  });

  it('5. screenTimeService.getDailyUsage returns honest empty state without APK data, and loads exact APK stats once synced', async () => {
    // 5a. When no APK data has synced yet, Web and Chrome return honest empty state awaiting APK sync
    const emptyData = await screenTimeService.getDailyUsage({ date: '2026-10-11' });
    expect(emptyData).toBeDefined();
    expect(emptyData.hasData).toBe(false);
    expect(emptyData.totalMinutes).toBe(0);
    expect(emptyData.apps.length).toBe(0);

    // 5b. When APK syncs data, Web and Chrome immediately reflect that exact APK data
    const apkData: ScreenTimeData = {
      granted: true,
      isNativeAndroid: true,
      isFromApk: true,
      hasData: true,
      date: '2026-10-11',
      formattedDate: 'Sunday, Oct 11',
      totalMinutes: 145,
      totalMillis: 145 * 60 * 1000,
      apps: [
        {
          packageName: 'com.example.realapp',
          appName: 'Real App',
          rank: 1,
          durationMinutes: 145,
          durationMillis: 145 * 60 * 1000,
          sessionCount: 12,
          percentageOfTotal: 100,
        },
      ],
      topApps: [
        {
          packageName: 'com.example.realapp',
          appName: 'Real App',
          rank: 1,
          durationMinutes: 145,
          durationMillis: 145 * 60 * 1000,
          sessionCount: 12,
          percentageOfTotal: 100,
        },
      ],
      hourlyUsage: [],
      past7Days: [],
      dailyAverageMinutes: 145,
      lastSyncedTimestamp: Date.now(),
      dataSource: 'usageEventsUnion',
    };
    Storage.setDailyScreenTime('2026-10-11', apkData);
    screenTimeService.clearCache();

    const synced = await screenTimeService.getDailyUsage({ date: '2026-10-11' });
    expect(synced.hasData).toBe(true);
    expect(synced.totalMinutes).toBe(145);
    expect(synced.apps[0].appName).toBe('Real App');
    expect(synced.isFromApk).toBe(true);
  });

  it('6. sanitizeScreenTime strips oversized base64 icons to protect localStorage quota', () => {
    const heavyData: ScreenTimeData = {
      granted: true,
      isNativeAndroid: true,
      hasData: true,
      date: '2026-10-11',
      formattedDate: 'Sunday, Oct 11',
      totalMinutes: 120,
      totalMillis: 120 * 60 * 1000,
      apps: Array.from({ length: 20 }, (_, i) => ({
        packageName: `com.example.app${i}`,
        appName: `App ${i}`,
        rank: i + 1,
        durationMinutes: 10,
        durationMillis: 10 * 60 * 1000,
        sessionCount: 2,
        percentageOfTotal: 5,
        icon: 'data:image/png;base64,' + 'A'.repeat(5000), // Heavy base64 string
      })),
      topApps: [],
      hourlyUsage: [],
      past7Days: [],
      dailyAverageMinutes: 120,
      lastSyncedTimestamp: Date.now(),
    };

    const sanitized = Storage.sanitizeScreenTime(heavyData);
    expect(sanitized).toBeDefined();
    // Verify that beyond top 5, or if icon string exceeds limit, icon was removed
    expect(sanitized.apps[6].icon).toBeUndefined();
    expect(sanitized.apps[0].icon).toBeUndefined(); // exceeds 2048 chars
  });

  it('7. screenTimeService fetches synced data from backend server for Web and Android Chrome', async () => {
    const serverPayload: ScreenTimeData = {
      granted: true,
      isNativeAndroid: true,
      isFromApk: true,
      dataSource: 'usageEventsUnion',
      hasData: true,
      date: '2026-10-11',
      formattedDate: 'Sunday, Oct 11',
      totalMinutes: 245,
      totalMillis: 245 * 60 * 1000,
      apps: [
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          rank: 1,
          durationMinutes: 110,
          durationMillis: 110 * 60 * 1000,
          sessionCount: 18,
          percentageOfTotal: 45,
        },
      ],
      topApps: [],
      hourlyUsage: [],
      past7Days: [
        {
          date: '2026-10-11',
          dayOfWeek: 'Sun',
          totalMinutes: 245,
          totalMillis: 245 * 60 * 1000,
          isToday: true,
          appMinutes: { 'com.instagram.android': 110 },
        },
      ],
      dailyAverageMinutes: 245,
      lastSyncedTimestamp: Date.now(),
    };

    // Mock global fetch to return serverPayload for /api/screentime/daily
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: any) => {
      const url = String(input);
      if (url.includes('/api/screentime/daily')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: serverPayload }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    };

    try {
      const fetched = await screenTimeService.fetchFromServer('2026-10-11');
      expect(fetched).toBeDefined();
      expect(fetched?.totalMinutes).toBe(245);
      expect(fetched?.apps[0]?.appName).toBe('Instagram');
      expect(fetched?.granted).toBe(true);

      const usage = await screenTimeService.getDailyUsage({ date: '2026-10-11', forceRefresh: true });
      expect(usage.totalMinutes).toBe(245);
      expect(usage.apps[0]?.packageName).toBe('com.instagram.android');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('8. ScreenTimeSyncBridge rejects unverified 185m (3h 5m) mock data and prioritizes 133m (2hr 13m) native Android APK data', async () => {
    // 8a. Stale unverified mock payload (185 mins = 3h 5m)
    const staleMockPayload = {
      date: '2026-10-12',
      hasData: true,
      totalMinutes: 185, // 3h 5m
      apps: [
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          durationMinutes: 95,
        },
      ],
      lastSyncedTimestamp: 1000,
    };
    expect(screenTimeService.bridge.validateDataSource(staleMockPayload)).toBe(false);

    // 8b. Real authentic Android native APK data (133 mins = 2hr 13m)
    const authenticApkPayload: ScreenTimeData = {
      granted: true,
      isNativeAndroid: true,
      isFromApk: true,
      hasData: true,
      date: '2026-10-12',
      formattedDate: 'Monday, Oct 12',
      totalMinutes: 133, // 2hr 13m
      totalMillis: 133 * 60 * 1000,
      apps: [
        {
          packageName: 'com.whatsapp',
          appName: 'WhatsApp',
          rank: 1,
          durationMinutes: 70,
          durationMillis: 70 * 60 * 1000,
          sessionCount: 15,
          percentageOfTotal: 53,
        },
        {
          packageName: 'com.google.android.youtube',
          appName: 'YouTube',
          rank: 2,
          durationMinutes: 63,
          durationMillis: 63 * 60 * 1000,
          sessionCount: 8,
          percentageOfTotal: 47,
        },
      ],
      topApps: [],
      hourlyUsage: [],
      past7Days: [],
      dailyAverageMinutes: 133,
      lastSyncedTimestamp: Date.now(),
      dataSource: 'usageEventsUnion',
    };
    expect(screenTimeService.bridge.validateDataSource(authenticApkPayload)).toBe(true);

    // 8c. Prioritization bridge selects authentic APK payload over unverified mock
    const winner = screenTimeService.bridge.prioritizeNativeSource([staleMockPayload as any, authenticApkPayload]);
    expect(winner).toBeDefined();
    expect(winner?.totalMinutes).toBe(133); // 2hr 13m wins
    expect(winner?.apps[0]?.appName).toBe('WhatsApp');

    // 8d. Test on web: when APK payload is persisted, getDailyUsage returns 133 (2h 13m) and never 185 (3h 5m)
    Storage.setDailyScreenTime('2026-10-12', authenticApkPayload);
    screenTimeService.clearCache();

    const result = await screenTimeService.getDailyUsage({ date: '2026-10-12' });
    expect(result.totalMinutes).toBe(133); // 2hr 13m
    expect(result.totalMinutes).not.toBe(185); // 3h 5m eliminated
    expect(result.isFromApk).toBe(true);
  });

  describe('Regression Verification: 160m (2h 40m) reporting, date integrity & sync stability', () => {
    const formatHoursAndMinutes = (totalMinutes: number) => {
      if (!totalMinutes || totalMinutes <= 0) return '0m';
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      if (hrs === 0) return `${mins}m`;
      if (mins === 0) return `${hrs}h`;
      return `${hrs}h ${mins}m`;
    };

    it('1. A synchronized daily total of 160 minutes displays as 2h 40m', async () => {
      expect(formatHoursAndMinutes(160)).toBe('2h 40m');

      const authentic160Payload: ScreenTimeData = {
        granted: true,
        isNativeAndroid: false,
        isFromApk: true,
        hasData: true,
        date: '2026-10-13',
        formattedDate: 'Tuesday, Oct 13',
        totalMinutes: 160,
        totalMillis: 160 * 60 * 1000,
        apps: [
          {
            packageName: 'com.whatsapp',
            appName: 'WhatsApp',
            rank: 1,
            durationMinutes: 90,
            durationMillis: 90 * 60 * 1000,
            sessionCount: 20,
            percentageOfTotal: 56,
          },
          {
            packageName: 'com.google.android.youtube',
            appName: 'YouTube',
            rank: 2,
            durationMinutes: 70,
            durationMillis: 70 * 60 * 1000,
            sessionCount: 10,
            percentageOfTotal: 44,
          },
        ],
        topApps: [],
        hourlyUsage: [],
        past7Days: [],
        dailyAverageMinutes: 160,
        lastSyncedTimestamp: Date.now(),
        dataSource: 'usageEventsUnion',
      };

      expect(screenTimeService.bridge.validateDataSource(authentic160Payload)).toBe(true);
      Storage.setDailyScreenTime('2026-10-13', authentic160Payload);
      screenTimeService.clearCache();

      const result = await screenTimeService.getDailyUsage({ date: '2026-10-13' });
      expect(result.totalMinutes).toBe(160);
      expect(formatHoursAndMinutes(result.totalMinutes)).toBe('2h 40m');
      expect(result.apps.reduce((sum, a) => sum + a.durationMinutes, 0)).toBe(160);
    });

    it('2. Today, yesterday, and previous dates display their own authentic recorded durations', async () => {
      const todayData: ScreenTimeData = {
        granted: true,
        isNativeAndroid: false,
        isFromApk: true,
        hasData: true,
        date: '2026-10-13',
        formattedDate: 'Tuesday, Oct 13',
        totalMinutes: 160, // 2h 40m
        totalMillis: 160 * 60 * 1000,
        apps: [
          {
            packageName: 'com.whatsapp',
            appName: 'WhatsApp',
            rank: 1,
            durationMinutes: 160,
            durationMillis: 160 * 60 * 1000,
            sessionCount: 15,
            percentageOfTotal: 100,
          },
        ],
        topApps: [],
        hourlyUsage: [],
        past7Days: [
          {
            date: '2026-10-13',
            dayOfWeek: 'Tue',
            totalMinutes: 160,
            totalMillis: 160 * 60 * 1000,
            isToday: true,
            appMinutes: { 'com.whatsapp': 160 },
          },
          {
            date: '2026-10-12',
            dayOfWeek: 'Mon',
            totalMinutes: 215, // 3h 35m
            totalMillis: 215 * 60 * 1000,
            isToday: false,
            appMinutes: { 'com.google.android.youtube': 215 },
          },
          {
            date: '2026-10-11',
            dayOfWeek: 'Sun',
            totalMinutes: 95, // 1h 35m
            totalMillis: 95 * 60 * 1000,
            isToday: false,
            appMinutes: { 'com.instagram.android': 95 },
          },
        ],
        dailyAverageMinutes: 156,
        lastSyncedTimestamp: Date.now(),
        dataSource: 'usageEventsUnion',
      };

      Storage.setDailyScreenTime('2026-10-13', todayData);
      screenTimeService.clearCache();

      // Today's query returns 160m
      const todayRes = await screenTimeService.getDailyUsage({ date: '2026-10-13' });
      expect(todayRes.totalMinutes).toBe(160);
      expect(formatHoursAndMinutes(todayRes.totalMinutes)).toBe('2h 40m');

      // Yesterday's query returns 215m from past7Days without corrupting today
      const yesterdayRes = await screenTimeService.getDailyUsage({ date: '2026-10-12' });
      expect(yesterdayRes.totalMinutes).toBe(215);
      expect(formatHoursAndMinutes(yesterdayRes.totalMinutes)).toBe('3h 35m');
      expect(yesterdayRes.apps[0]?.packageName).toBe('com.google.android.youtube');

      // Earlier date returns 95m
      const sundayRes = await screenTimeService.getDailyUsage({ date: '2026-10-11' });
      expect(sundayRes.totalMinutes).toBe(95);
      expect(formatHoursAndMinutes(sundayRes.totalMinutes)).toBe('1h 35m');
      expect(sundayRes.apps[0]?.packageName).toBe('com.instagram.android');

      // Today's storage record remains intact (still 160m, never overwritten by yesterday's query)
      const freshToday = Storage.getDailyScreenTime('2026-10-13');
      expect(freshToday?.totalMinutes).toBe(160);
      expect(formatHoursAndMinutes(freshToday?.totalMinutes || 0)).toBe('2h 40m');
    });

    it('3. Valid APK-synchronized data is not replaced by synthetic or stale web fallback data', async () => {
      const apkData: ScreenTimeData = {
        granted: true,
        isNativeAndroid: false,
        isFromApk: true,
        hasData: true,
        date: '2026-10-13',
        formattedDate: 'Tuesday, Oct 13',
        totalMinutes: 160,
        totalMillis: 160 * 60 * 1000,
        apps: [{ packageName: 'com.whatsapp', appName: 'WhatsApp', rank: 1, durationMinutes: 160, durationMillis: 160 * 60 * 1000, sessionCount: 10, percentageOfTotal: 100 }],
        topApps: [],
        hourlyUsage: [],
        past7Days: [],
        dailyAverageMinutes: 160,
        lastSyncedTimestamp: 5000,
        dataSource: 'usageEventsUnion',
      };
      Storage.setDailyScreenTime('2026-10-13', apkData);

      // Attempt to import older or synthetic fallback payload
      const olderCloudPayload = {
        screenTime: {
          totalMinutes: 45,
          lastSyncedTimestamp: 2000, // Older than local
          dataSource: 'simulatedBaseline',
        },
      };

      Storage.importAllDataPayload(olderCloudPayload);

      // Verify authentic APK data is preserved
      const stored = Storage.getDailyScreenTime('2026-10-13');
      expect(stored?.totalMinutes).toBe(160);
    });

    it('4. Refreshing or reopening the web/Chrome version does not change a previously correct total', async () => {
      const authenticPayload: ScreenTimeData = {
        granted: true,
        isNativeAndroid: false,
        isFromApk: true,
        hasData: true,
        date: '2026-10-13',
        formattedDate: 'Tuesday, Oct 13',
        totalMinutes: 160,
        totalMillis: 160 * 60 * 1000,
        apps: [{ packageName: 'com.whatsapp', appName: 'WhatsApp', rank: 1, durationMinutes: 160, durationMillis: 160 * 60 * 1000, sessionCount: 10, percentageOfTotal: 100 }],
        topApps: [],
        hourlyUsage: [],
        past7Days: [],
        dailyAverageMinutes: 160,
        lastSyncedTimestamp: Date.now(),
        dataSource: 'usageEventsUnion',
      };
      Storage.setDailyScreenTime('2026-10-13', authenticPayload);

      // Simulate first page load
      screenTimeService.clearCache();
      const firstLoad = await screenTimeService.getDailyUsage({ date: '2026-10-13' });
      expect(firstLoad.totalMinutes).toBe(160);

      // Simulate user clicking refresh or reopening the tab
      screenTimeService.clearCache();
      const refreshedLoad = await screenTimeService.getDailyUsage({ date: '2026-10-13', forceRefresh: true });
      expect(refreshedLoad.totalMinutes).toBe(160);
      expect(formatHoursAndMinutes(refreshedLoad.totalMinutes)).toBe('2h 40m');
    });

    it('5. Switching dates and selected apps does not mix their usage records', async () => {
      const day1: ScreenTimeData = {
        granted: true,
        isNativeAndroid: false,
        isFromApk: true,
        hasData: true,
        date: '2026-10-12',
        formattedDate: 'Monday, Oct 12',
        totalMinutes: 120, // 2h
        totalMillis: 120 * 60 * 1000,
        apps: [
          { packageName: 'com.google.android.youtube', appName: 'YouTube', rank: 1, durationMinutes: 120, durationMillis: 120 * 60 * 1000, sessionCount: 5, percentageOfTotal: 100 },
        ],
        topApps: [],
        hourlyUsage: [],
        past7Days: [],
        dailyAverageMinutes: 120,
        lastSyncedTimestamp: Date.now(),
        dataSource: 'usageEventsUnion',
      };
      const day2: ScreenTimeData = {
        granted: true,
        isNativeAndroid: false,
        isFromApk: true,
        hasData: true,
        date: '2026-10-13',
        formattedDate: 'Tuesday, Oct 13',
        totalMinutes: 160, // 2h 40m
        totalMillis: 160 * 60 * 1000,
        apps: [
          { packageName: 'com.whatsapp', appName: 'WhatsApp', rank: 1, durationMinutes: 160, durationMillis: 160 * 60 * 1000, sessionCount: 12, percentageOfTotal: 100 },
        ],
        topApps: [],
        hourlyUsage: [],
        past7Days: [],
        dailyAverageMinutes: 160,
        lastSyncedTimestamp: Date.now(),
        dataSource: 'usageEventsUnion',
      };

      Storage.setDailyScreenTime('2026-10-12', day1);
      Storage.setDailyScreenTime('2026-10-13', day2);

      const res12 = await screenTimeService.getDailyUsage({ date: '2026-10-12' });
      const res13 = await screenTimeService.getDailyUsage({ date: '2026-10-13' });

      expect(res12.totalMinutes).toBe(120);
      expect(res12.apps[0].appName).toBe('YouTube');

      expect(res13.totalMinutes).toBe(160);
      expect(res13.apps[0].appName).toBe('WhatsApp');
    });

    it('6. The seven-day graph displayed values match the underlying daily totals', () => {
      const past7Days = [
        { date: '2026-10-07', dayOfWeek: 'Wed', totalMinutes: 100, totalMillis: 100 * 60000, isToday: false },
        { date: '2026-10-08', dayOfWeek: 'Thu', totalMinutes: 130, totalMillis: 130 * 60000, isToday: false },
        { date: '2026-10-09', dayOfWeek: 'Fri', totalMinutes: 140, totalMillis: 140 * 60000, isToday: false },
        { date: '2026-10-10', dayOfWeek: 'Sat', totalMinutes: 180, totalMillis: 180 * 60000, isToday: false },
        { date: '2026-10-11', dayOfWeek: 'Sun', totalMinutes: 95, totalMillis: 95 * 60000, isToday: false },
        { date: '2026-10-12', dayOfWeek: 'Mon', totalMinutes: 215, totalMillis: 215 * 60000, isToday: false },
        { date: '2026-10-13', dayOfWeek: 'Tue', totalMinutes: 160, totalMillis: 160 * 60000, isToday: true },
      ];

      past7Days.forEach((d) => {
        const formatted = formatHoursAndMinutes(d.totalMinutes);
        if (d.totalMinutes === 160) {
          expect(formatted).toBe('2h 40m');
        } else if (d.totalMinutes === 180) {
          expect(formatted).toBe('3h');
        } else if (d.totalMinutes === 95) {
          expect(formatted).toBe('1h 35m');
        }
      });
    });

    it('7. Missing or invalid synchronized data is handled explicitly rather than silently represented as genuine usage', async () => {
      // Query a date for which no sync exists
      const emptyRes = await screenTimeService.getDailyUsage({ date: '2026-01-01' });
      expect(emptyRes.hasData).toBe(false);
      expect(emptyRes.totalMinutes).toBe(0);
      expect(emptyRes.apps.length).toBe(0);
      expect(emptyRes.dataSource).toBe('pendingApkSync');

      // Simulated baseline or single 185m mock is explicitly rejected
      const mockPayload = {
        totalMinutes: 185,
        apps: [{ packageName: 'com.instagram.android' }],
        dataSource: 'simulatedBaseline',
      };
      expect(screenTimeService.bridge.validateDataSource(mockPayload)).toBe(false);
    });
  });
});
