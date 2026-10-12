import { registerPlugin, Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { ScreenTimeData } from '../types';
import { getLocalDateString } from '../utils/screenTimeCalculator';
import { Storage } from '../utils/storage';
import { getEmptyScreenTimeData } from '../utils/screenTimeDefaults';
import { scheduleAutoSyncToSupabase } from '../utils/supabase';

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
  private broadcastChannel: BroadcastChannel | null = null;
  private pollIntervalId: any = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isAndroid = this.isNative && Capacitor.getPlatform() === 'android';
    this.setupResumeListener();
    this.setupStorageListener();
    this.setupBroadcastChannel();
    this.setupFocusListener();
    this.startPeriodicSync();
  }

  public isSupported(): boolean {
    return true;
  }

  public isNativeAndroid(): boolean {
    return this.isAndroid;
  }

  private setupBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('screentime_sync_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.screenTime) {
          const incoming: ScreenTimeData = event.data.screenTime;
          this.clearCache();
          Storage.setDailyScreenTime(incoming.date, incoming);
          this.notifyListeners(incoming);
        }
      };
    } catch {
      // Ignore if unavailable
    }
  }

  private broadcastUpdate(data: ScreenTimeData) {
    try {
      this.broadcastChannel?.postMessage({ screenTime: data });
    } catch {
      // Ignore
    }
  }

  private setupFocusListener() {
    if (typeof window === 'undefined') return;
    try {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isAndroid) {
          void this.pollServerForUpdates();
        }
      });
      window.addEventListener('focus', () => {
        if (!this.isAndroid) {
          void this.pollServerForUpdates();
        }
      });
    } catch {
      // Ignore
    }
  }

  private startPeriodicSync() {
    if (this.isAndroid || typeof window === 'undefined') return;
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    this.pollIntervalId = setInterval(() => {
      void this.pollServerForUpdates();
    }, 30000);
  }

  public async pollServerForUpdates(): Promise<void> {
    if (this.isAndroid) return;
    try {
      const today = getLocalDateString();
      const serverData = await this.fetchFromServer(today);
      if (serverData && serverData.hasData && serverData.totalMinutes > 0) {
        const local = Storage.getDailyScreenTime(today);
        if (!local || (serverData.lastSyncedTimestamp || 0) > (local.lastSyncedTimestamp || 0) || local.totalMinutes !== serverData.totalMinutes) {
          Storage.setDailyScreenTime(today, serverData);
          this.clearCache();
          this.notifyListeners(serverData);
        }
      }
    } catch {
      // Ignore network errors during background polling
    }
  }

  private getServerBaseUrl(): string {
    if (typeof window === 'undefined') return '';
    try {
      const stored = localStorage.getItem('personal_dashboard_backend_url');
      if (stored && stored.startsWith('http')) {
        return stored.replace(/\/+$/, '');
      }
      const origin = window.location.origin || '';
      if (origin && !origin.includes('localhost') && !origin.startsWith('capacitor://')) {
        return origin.replace(/\/+$/, '');
      }
    } catch {
      // Ignore
    }
    return '';
  }

  /**
   * Synchronize screen time to local backend server so Web and Android Chrome can consume it.
   */
  public async syncToServer(data: ScreenTimeData): Promise<boolean> {
    try {
      const baseUrl = this.getServerBaseUrl();
      const sanitized = Storage.sanitizeScreenTime(data);
      const res = await fetch(`${baseUrl}/api/screentime/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenTime: sanitized,
          date: sanitized.date,
          history: Storage.getScreenTimeHistory(),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch screen time for a date from the local backend server.
   */
  public async fetchFromServer(date: string): Promise<ScreenTimeData | null> {
    try {
      const baseUrl = this.getServerBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${baseUrl}/api/screentime/daily?date=${encodeURIComponent(date)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const item = json.data as ScreenTimeData;
          if (item && item.dataSource !== 'simulatedBaseline') {
            return {
              ...item,
              granted: true,
              isNativeAndroid: false,
              isFromApk: true,
              hasData: true,
            };
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private setupStorageListener() {
    if (typeof window === 'undefined') return;
    try {
      window.addEventListener('screentime-updated', (e: any) => {
        if (e.detail?.data) {
          this.clearCache();
          this.notifyListeners(e.detail.data);
        }
      });
      window.addEventListener('dashboard-data-updated', (e: any) => {
        if (e.detail?.module === 'screentime') {
          this.clearCache();
          const latest = Storage.getScreenTimeData();
          if (latest) {
            this.notifyListeners(latest);
          }
        }
      });
    } catch {
      // Ignore in non-browser environments
    }
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

  public notifyListeners(data: ScreenTimeData) {
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
    if (!this.isAndroid) return true;
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
      console.warn('[ScreenTimeService] Permission is native to Android system settings');
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
   * Get Daily Usage stats for a target calendar day (defaults to today in local time).
   * Works on native Android APK as well as Web and Android Chrome via synced/stored stats.
   */
  public async getDailyUsage(options?: {
    date?: string; // YYYY-MM-DD
    includeIcons?: boolean;
    excludeSelf?: boolean;
    forceRefresh?: boolean;
  }): Promise<ScreenTimeData> {
    const todayIso = getLocalDateString();
    const targetDate = options?.date || todayIso;
    const includeIcons = options?.includeIcons ?? true;
    const excludeSelf = options?.excludeSelf ?? true;
    const forceRefresh = options?.forceRefresh ?? false;

    // Platform validation: Browser / Web fallback (Support Web and Android Chrome)
    if (!this.isAndroid) {
      const cacheKey = `web_${targetDate}_${forceRefresh}`;
      if (!forceRefresh && memoryCache[cacheKey]) {
        const cached = memoryCache[cacheKey];
        if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
          return cached.data;
        }
      }

      // 1. First, check local backend server for stats synced from APK
      try {
        const serverData = await this.fetchFromServer(targetDate);
        if (serverData && serverData.hasData && serverData.totalMinutes >= 0 && serverData.dataSource !== 'simulatedBaseline') {
          Storage.setDailyScreenTime(targetDate, serverData);
          memoryCache[cacheKey] = {
            data: serverData,
            timestamp: Date.now(),
          };
          this.notifyListeners(serverData);
          return serverData;
        }
      } catch {
        // Fall through to storage/empty state
      }

      // 2. Check local storage for synced screen time data from APK for this specific date
      const storedForDate = Storage.getDailyScreenTime(targetDate);
      if (storedForDate && storedForDate.hasData && storedForDate.dataSource !== 'simulatedBaseline') {
        const enriched: ScreenTimeData = {
          ...storedForDate,
          granted: true,
          isNativeAndroid: false,
          isFromApk: true,
          hasData: true,
          date: targetDate,
        };
        memoryCache[cacheKey] = {
          data: enriched,
          timestamp: Date.now(),
        };
        return enriched;
      }

      // 3. Check if latest general screen time data from APK is available and matches today
      const latestStored = Storage.getScreenTimeData();
      if (latestStored && latestStored.hasData && latestStored.dataSource !== 'simulatedBaseline') {
        if (latestStored.date === targetDate || (!options?.date && latestStored.date === todayIso)) {
          const enriched: ScreenTimeData = {
            ...latestStored,
            granted: true,
            isNativeAndroid: false,
            isFromApk: true,
            hasData: true,
            date: targetDate,
          };
          memoryCache[cacheKey] = {
            data: enriched,
            timestamp: Date.now(),
          };
          return enriched;
        }
      }

      // 4. In Chrome and Web, ONLY take data from the APK version.
      // Never fabricate false numbers or mock app hours.
      // If no APK data has synced yet, return the honest empty state.
      const emptyState = getEmptyScreenTimeData(targetDate);
      memoryCache[cacheKey] = {
        data: emptyState,
        timestamp: Date.now(),
      };
      return emptyState;
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
          isFromApk: true,
          hasData: Boolean(result?.hasData),
          date: result?.date || targetDate,
          formattedDate:
            result?.formattedDate ||
            new Date(targetDate + 'T12:00:00').toLocaleDateString(undefined, {
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
          dataSource: result?.dataSource || 'usageEventsUnion',
          accuracyNotice:
            result?.accuracyNotice ||
            'Device screen time is calculated as the non-overlapping mathematical union of foreground sessions on an active screen, matching Android Digital Wellbeing.',
          limitationsNotice:
            result?.limitationsNotice ||
            'Native statistics reported by Android UsageStatsManager. Usage events are aggregated locally on device.',
          diagnostics: result?.diagnostics,
          error: result?.error,
          message: result?.message,
        };

        // Persist to local storage and sync to Server & Supabase so stats are available in Web and Android Chrome
        if (screenTimeData.hasData && screenTimeData.totalMinutes > 0) {
          Storage.setDailyScreenTime(targetDate, screenTimeData);
          void this.syncToServer(screenTimeData);
          this.broadcastUpdate(screenTimeData);
          scheduleAutoSyncToSupabase(() => Storage.getAllDataPayload(), 300);
        }

        memoryCache[cacheKey] = {
          data: screenTimeData,
          timestamp: Date.now(),
        };

        this.notifyListeners(screenTimeData);
        return screenTimeData;
      } catch (err: any) {
        console.error('[ScreenTimeService] getDailyUsage error:', err);
        // Fall back to stored screen time if query fails
        const fallback = Storage.getDailyScreenTime(targetDate) || Storage.getScreenTimeData();
        if (fallback && fallback.hasData) {
          return fallback;
        }

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

