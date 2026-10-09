import { registerPlugin, Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { ScreenTimeData } from '../types';

export interface ScreenTimePluginInterface {
  hasPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ opened: boolean }>;
  getDailyUsage(options?: {
    date?: string;
    includeIcons?: boolean;
    excludeSelf?: boolean;
  }): Promise<ScreenTimeData>;
  getPast7DaysUsage(options?: {
    excludeSelf?: boolean;
  }): Promise<{ granted: boolean; days?: any[] }>;
}

const ScreenTime = registerPlugin<ScreenTimePluginInterface>('ScreenTime');

// Cache configuration
const CACHE_TTL_MS = 45 * 1000; // 45 seconds cache TTL to avoid duplicate concurrent/burst queries
interface CachedRecord {
  data: ScreenTimeData;
  timestamp: number;
}
const memoryCache: Record<string, CachedRecord> = {};
let pendingQueryPromise: Promise<ScreenTimeData> | null = null;
let pendingQueryKey: string | null = null;

// Event listeners for subscribers (e.g. dashboard card and full screen time view)
type ScreenTimeListener = (data: ScreenTimeData) => void;
const listeners = new Set<ScreenTimeListener>();

class ScreenTimeService {
  private isAndroid: boolean;
  private isNative: boolean;
  private resumeListenerBound = false;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isAndroid = this.isNative && Capacitor.getPlatform() === 'android';
    this.setupResumeListener();
  }

  public isSupported(): boolean {
    return this.isAndroid;
  }

  private setupResumeListener() {
    if (this.resumeListenerBound || !this.isNative) return;
    try {
      void CapApp.addListener('appStateChange', (state) => {
        if (state.isActive && this.isAndroid) {
          // Invalidate cache and auto-fetch fresh stats when app resumes (e.g. from Settings)
          void this.getDailyUsage({ forceRefresh: true }).then((data) => {
            this.notifyListeners(data);
          }).catch(() => {});
        }
      });
      this.resumeListenerBound = true;
    } catch {
      // Ignore if CapApp listener is unavailable in some contexts
    }
  }

  public subscribe(listener: ScreenTimeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  private notifyListeners(data: ScreenTimeData) {
    listeners.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error('[ScreenTimeService] listener error:', err);
      }
    });
  }

  /**
   * Check if PACKAGE_USAGE_STATS permission is granted
   */
  public async checkPermission(): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      const res = await ScreenTime.hasPermission();
      return Boolean(res?.granted);
    } catch (err) {
      console.warn('[ScreenTimeService] checkPermission error:', err);
      return false;
    }
  }

  /**
   * Launch Android Settings -> Usage Access screen
   */
  public async requestPermission(): Promise<boolean> {
    if (!this.isAndroid) {
      console.warn('[ScreenTimeService] Permission cannot be requested on non-Android platform');
      return false;
    }
    try {
      const res = await ScreenTime.requestPermission();
      return Boolean(res?.opened);
    } catch (err) {
      console.error('[ScreenTimeService] requestPermission error:', err);
      return false;
    }
  }

  /**
   * Get Daily Usage stats for a target calendar day (defaults to today in local time)
   */
  public async getDailyUsage(options?: {
    date?: string; // YYYY-MM-DD
    includeIcons?: boolean;
    excludeSelf?: boolean;
    forceRefresh?: boolean;
  }): Promise<ScreenTimeData> {
    const todayIso = new Date().toISOString().split('T')[0];
    const targetDate = options?.date || todayIso;
    const includeIcons = options?.includeIcons ?? true;
    const excludeSelf = options?.excludeSelf ?? true;
    const forceRefresh = options?.forceRefresh ?? false;

    // Platform validation: Browser / Web fallback (Never fabricate mock usage)
    if (!this.isAndroid) {
      const webResult: ScreenTimeData = {
        granted: false,
        isNativeAndroid: false,
        hasData: false,
        date: targetDate,
        formattedDate: new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        }),
        totalMinutes: 0,
        totalMillis: 0,
        apps: [],
        topApps: [],
        hourlyUsage: Array.from({ length: 24 }).map((_, h) => ({
          hour: h,
          label: h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
          durationMinutes: 0,
          durationMillis: 0,
        })),
        past7Days: [],
        dailyAverageMinutes: 0,
        lastSyncedTimestamp: Date.now(),
        error: 'PLATFORM_UNSUPPORTED',
        message:
          'Device-wide Screen Time usage tracking requires Android OS UsageStatsManager and is available exclusively when running on Android devices.',
        limitationsNotice:
          'Web browsers do not have access to OS application telemetry. Run the Android build on a real Android device or emulator with Usage Access enabled.',
      };
      return webResult;
    }

    // Check memory cache
    const cacheKey = `${targetDate}_${includeIcons}_${excludeSelf}`;
    if (!forceRefresh && memoryCache[cacheKey]) {
      const cached = memoryCache[cacheKey];
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // Coalesce duplicate concurrent requests
    if (pendingQueryPromise && pendingQueryKey === cacheKey) {
      return pendingQueryPromise;
    }

    pendingQueryKey = cacheKey;
    pendingQueryPromise = (async () => {
      try {
        const result = await ScreenTime.getDailyUsage({
          date: targetDate,
          includeIcons,
          excludeSelf,
        });

        const screenTimeData: ScreenTimeData = {
          granted: Boolean(result?.granted),
          isNativeAndroid: true,
          hasData: Boolean(result?.hasData),
          date: result?.date || targetDate,
          formattedDate:
            result?.formattedDate ||
            new Date(targetDate).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }),
          totalMinutes: Number(result?.totalMinutes || 0),
          totalMillis: Number(result?.totalMillis || 0),
          apps: Array.isArray(result?.apps) ? result.apps : [],
          topApps: Array.isArray(result?.topApps) ? result.topApps : [],
          hourlyUsage: Array.isArray(result?.hourlyUsage) ? result.hourlyUsage : [],
          past7Days: Array.isArray(result?.past7Days) ? result.past7Days : [],
          dailyAverageMinutes: Number(result?.dailyAverageMinutes || 0),
          lastSyncedTimestamp: Number(result?.lastSyncedTimestamp || Date.now()),
          limitationsNotice:
            result?.limitationsNotice ||
            'Native statistics reported by Android UsageStatsManager. Usage events are aggregated locally on device.',
          error: result?.error,
          message: result?.message,
        };

        memoryCache[cacheKey] = {
          data: screenTimeData,
          timestamp: Date.now(),
        };

        this.notifyListeners(screenTimeData);
        return screenTimeData;
      } catch (err: any) {
        console.error('[ScreenTimeService] getDailyUsage error:', err);
        const errorResult: ScreenTimeData = {
          granted: false,
          isNativeAndroid: true,
          hasData: false,
          date: targetDate,
          formattedDate: targetDate,
          totalMinutes: 0,
          totalMillis: 0,
          apps: [],
          topApps: [],
          hourlyUsage: [],
          past7Days: [],
          dailyAverageMinutes: 0,
          lastSyncedTimestamp: Date.now(),
          error: 'QUERY_FAILED',
          message: err?.message || 'Failed to query native UsageStatsManager statistics.',
          limitationsNotice: 'Error communicating with Android UsageStatsManager.',
        };
        return errorResult;
      } finally {
        pendingQueryPromise = null;
        pendingQueryKey = null;
      }
    })();

    return pendingQueryPromise;
  }

  /**
   * Invalidate local memory cache
   */
  public clearCache(): void {
    Object.keys(memoryCache).forEach((k) => delete memoryCache[k]);
  }
}

export const screenTimeService = new ScreenTimeService();
