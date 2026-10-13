import { describe, it, expect } from 'vitest';
import {
  calculateScreenTime,
  mergeIntervals,
  resolveCleanAppName,
  distributeMergedIntervalsHourly,
  formatYAxisHours,
  getAppHourlyUsage,
  EVENT_ACTIVITY_RESUMED,
  EVENT_ACTIVITY_PAUSED,
  EVENT_ACTIVITY_STOPPED,
  EVENT_USER_INTERACTION,
  EVENT_SCREEN_NON_INTERACTIVE,
  EVENT_SCREEN_INTERACTIVE,
  EVENT_DEVICE_SHUTDOWN,
  EVENT_DEVICE_STARTUP,
  EVENT_KEYGUARD_SHOWN,
  RawUsageEvent,
} from '../utils/screenTimeCalculator';

describe('Screen Time Calculation Engine & Digital Wellbeing Parity', () => {
  // Base day: 2026-10-10 00:00:00 UTC
  const START_OF_DAY = 1760054400000;
  const END_OF_DAY = START_OF_DAY + 24 * 60 * 60 * 1000; // 2026-10-11 00:00:00 UTC

  it('1. correctly calculates normal sequential foreground sessions without double counting', () => {
    // 09:00 - 09:30: WhatsApp (30m)
    // 09:30 - 10:00: YouTube (30m)
    const t9_00 = START_OF_DAY + 9 * 3600 * 1000;
    const t9_30 = t9_00 + 30 * 60 * 1000;
    const t10_00 = t9_00 + 60 * 60 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'com.whatsapp', timestamp: t9_00, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.whatsapp', timestamp: t9_30, eventType: EVENT_ACTIVITY_PAUSED },
      { packageName: 'com.google.android.youtube', timestamp: t9_30, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.google.android.youtube', timestamp: t10_00, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    expect(result.totalDeviceMinutes).toBe(60);
    expect(result.totalDeviceMillis).toBe(60 * 60 * 1000);

    const whatsapp = result.apps.find((a) => a.packageName === 'com.whatsapp');
    const youtube = result.apps.find((a) => a.packageName === 'com.google.android.youtube');

    expect(whatsapp).toBeDefined();
    expect(whatsapp?.appName).toBe('WhatsApp');
    expect(whatsapp?.durationMinutes).toBe(30);

    expect(youtube).toBeDefined();
    expect(youtube?.appName).toBe('YouTube');
    expect(youtube?.durationMinutes).toBe(30);
  });

  it('2. handles rapid app switching and consecutive sessions accurately', () => {
    // User switches rapidly between Instagram and Chrome
    const t1 = START_OF_DAY + 12 * 3600 * 1000;
    const t2 = t1 + 45 * 1000; // 45s in Instagram
    const t3 = t2 + 30 * 1000; // 30s in Chrome
    const t4 = t3 + 60 * 1000; // 60s in Instagram

    const events: RawUsageEvent[] = [
      { packageName: 'com.instagram.android', timestamp: t1, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.android.chrome', timestamp: t2, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.instagram.android', timestamp: t3, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.instagram.android', timestamp: t4, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    // Total wall-clock time from t1 to t4 = 45s + 30s + 60s = 135s (2.25 min)
    expect(result.totalDeviceMillis).toBe(135 * 1000);

    const insta = result.apps.find((a) => a.packageName === 'com.instagram.android');
    const chrome = result.apps.find((a) => a.packageName === 'com.android.chrome');

    expect(insta?.appName).toBe('Instagram');
    expect(insta?.durationMillis).toBe(105 * 1000); // 45s + 60s
    expect(chrome?.appName).toBe('Chrome');
    expect(chrome?.durationMillis).toBe(30 * 1000);
  });

  it('3. deduplicates duplicate events and handles out-of-order timestamps', () => {
    const t1 = START_OF_DAY + 10 * 3600 * 1000;
    const t2 = t1 + 15 * 60 * 1000;

    const events: RawUsageEvent[] = [
      // Duplicate resume events at exact same millisecond
      { packageName: 'com.snapchat.android', timestamp: t1, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.snapchat.android', timestamp: t1, eventType: EVENT_ACTIVITY_RESUMED },
      // Out of order events
      { packageName: 'com.snapchat.android', timestamp: t2, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    expect(result.duplicatesDiscarded).toBe(1);
    expect(result.totalDeviceMinutes).toBe(15);
    const snap = result.apps.find((a) => a.packageName === 'com.snapchat.android');
    expect(snap?.appName).toBe('Snapchat');
    expect(snap?.durationMinutes).toBe(15);
  });

  it('4. caps missing session-end events to prevent unclosed overnight leaks', () => {
    // User opened app at 02:00 AM, screen turned off without explicit paused event
    // or device fell asleep until 09:00 AM (7 hours later)
    const t2am = START_OF_DAY + 2 * 3600 * 1000;
    const t9am = START_OF_DAY + 9 * 3600 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'com.twitter.android', timestamp: t2am, eventType: EVENT_ACTIVITY_RESUMED },
      // 7 hours later
      { packageName: 'com.twitter.android', timestamp: t9am, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    // Must be capped to MAX_SESSION_DURATION (1 hour), NOT 7 hours!
    expect(result.openSessionsCapped).toBe(1);
    expect(result.totalDeviceMinutes).toBe(60);
  });

  it('5. handles multi-window / picture-in-picture overlapping intervals via Mathematical Union', () => {
    // Digital Wellbeing test:
    // User runs YouTube PiP and WhatsApp side-by-side from 14:00 to 15:00 (1 hour).
    // Sum of individual apps = 1h + 1h = 2h.
    // Total device screen time MUST BE 1h (the interval union), NOT 2h!
    const t14_00 = START_OF_DAY + 14 * 3600 * 1000;
    const t15_00 = START_OF_DAY + 15 * 3600 * 1000;

    // Both apps active on overlapping intervals
    const intervals = [
      { start: t14_00, end: t15_00 }, // YouTube PiP
      { start: t14_00, end: t15_00 }, // WhatsApp main window
    ];

    const merged = mergeIntervals(intervals);

    expect(merged.length).toBe(1);
    expect(merged[0].duration).toBe(60 * 60 * 1000); // exactly 1 hour
  });

  it('6. strictly clips sessions crossing midnight boundaries to the requested calendar day', () => {
    // App opened at 23:45 yesterday (15m before midnight) and closed at 00:30 today (30m after midnight)
    const t23_45_yesterday = START_OF_DAY - 15 * 60 * 1000;
    const t00_30_today = START_OF_DAY + 30 * 60 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'com.spotify.music.android', timestamp: t23_45_yesterday, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.spotify.music.android', timestamp: t00_30_today, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    // Only the 30 minutes that occurred today should be counted for today!
    expect(result.totalDeviceMinutes).toBe(30);
    expect(result.totalDeviceMillis).toBe(30 * 60 * 1000);
  });

  it('7. closes sessions immediately upon screen lock, keyguard, or device shutdown', () => {
    const t1 = START_OF_DAY + 11 * 3600 * 1000;
    const tLock = t1 + 10 * 60 * 1000; // Locked after 10m
    const tUnlock = tLock + 20 * 60 * 1000; // Phone remained locked for 20m

    const events: RawUsageEvent[] = [
      { packageName: 'com.instagram.android', timestamp: t1, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.instagram.android', timestamp: tLock, eventType: EVENT_SCREEN_NON_INTERACTIVE },
      // Later unlocked, nothing opened yet
      { packageName: 'android', timestamp: tUnlock, eventType: EVENT_SCREEN_INTERACTIVE },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    // Screen time must be 10 minutes, not 30 minutes!
    expect(result.totalDeviceMinutes).toBe(10);
    expect(result.totalDeviceMillis).toBe(10 * 60 * 1000);
  });

  it('8. slices device screen time into 24 exact hourly buckets that sum to total screen time', () => {
    // 08:30 to 09:30 (1 hour spanning across two hour buckets: 30m in 8am, 30m in 9am)
    const t8_30 = START_OF_DAY + 8 * 3600 * 1000 + 30 * 60 * 1000;
    const t9_30 = START_OF_DAY + 9 * 3600 * 1000 + 30 * 60 * 1000;

    const merged = [{ start: t8_30, end: t9_30, duration: 60 * 60 * 1000 }];
    const hourly = distributeMergedIntervalsHourly(merged, START_OF_DAY);

    expect(hourly[8]).toBe(30 * 60 * 1000); // 30m in hour 8
    expect(hourly[9]).toBe(30 * 60 * 1000); // 30m in hour 9
    expect(hourly[10]).toBe(0);

    const sumHourly = hourly.reduce((a, b) => a + b, 0);
    expect(sumHourly).toBe(60 * 60 * 1000);
  });

  it('9. resolves proper human-readable app names and NEVER falls back to generic "Android"', () => {
    expect(resolveCleanAppName('com.instagram.android')).toBe('Instagram');
    expect(resolveCleanAppName('com.snapchat.android')).toBe('Snapchat');
    expect(resolveCleanAppName('com.whatsapp')).toBe('WhatsApp');
    expect(resolveCleanAppName('com.google.android.youtube')).toBe('YouTube');
    expect(resolveCleanAppName('com.spotify.music.android')).toBe('Spotify');
    expect(resolveCleanAppName('com.twitter.android')).toBe('X (Twitter)');
    expect(resolveCleanAppName('com.facebook.katana')).toBe('Facebook');
    expect(resolveCleanAppName('com.facebook.orca')).toBe('Messenger');
    expect(resolveCleanAppName('com.amazon.mShop.android.shopping')).toBe('Amazon');
    expect(resolveCleanAppName('com.netflix.mediaclient')).toBe('Netflix');
    expect(resolveCleanAppName('org.telegram.messenger')).toBe('Telegram');
    expect(resolveCleanAppName('com.android.chrome')).toBe('Chrome');

    // Unknown third-party app with .android package suffix
    expect(resolveCleanAppName('com.foobar.app.android')).toBe('Foobar');
    expect(resolveCleanAppName('com.customapp.android')).toBe('Customapp');

    // Only genuine OS package returns Android System
    expect(resolveCleanAppName('android')).toBe('Android System');

    // Uses PackageManager label when valid
    expect(resolveCleanAppName('com.unknown.pkg', 'My Cool Game')).toBe('My Cool Game');

    // Rejects bogus "android" label from unmapped system calls
    expect(resolveCleanAppName('com.instagram.android', 'android')).toBe('Instagram');
    expect(resolveCleanAppName('com.snapchat.android', 'Android')).toBe('Snapchat');
  });

  it('10. handles currently open sessions gracefully at query time', () => {
    // App was resumed 5 minutes ago and is still in use right now at query cutoff
    const queryTime = START_OF_DAY + 16 * 3600 * 1000;
    const tResume = queryTime - 5 * 60 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'com.whatsapp', timestamp: tResume, eventType: EVENT_ACTIVITY_RESUMED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, queryTime);

    expect(result.totalDeviceMinutes).toBe(5);
    expect(result.apps[0]?.durationMinutes).toBe(5);
  });

  it('11. preserves legitimate long sessions (>60m video/movie with interactions) without undercounting', () => {
    // User watches YouTube video for 90 minutes (14:00 to 15:30) with touch interaction at 14:45
    const t14_00 = START_OF_DAY + 14 * 3600 * 1000;
    const t14_45 = t14_00 + 45 * 60 * 1000;
    const t15_30 = t14_00 + 90 * 60 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'com.google.android.youtube', timestamp: t14_00, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.google.android.youtube', timestamp: t14_45, eventType: EVENT_USER_INTERACTION },
      { packageName: 'com.google.android.youtube', timestamp: t15_30, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    // Full 90 minutes must be preserved, not capped to 5 or 60 minutes!
    expect(result.totalDeviceMinutes).toBe(90);
    const yt = result.apps.find((a) => a.packageName === 'com.google.android.youtube');
    expect(yt?.durationMinutes).toBe(90);
  });

  it('12. ensures intra-app navigation with EVENT_ACTIVITY_STOPPED does not kill active foreground tracking', () => {
    // Navigating inside Instagram: FeedActivity -> DetailActivity
    // 10:00:00 - Feed resumes
    // 10:00:30 - Detail resumes
    // 10:00:30.100 - Feed stops (ACTIVITY_STOPPED)
    // 10:20:00 - User finishes and pauses Detail
    const t10_00 = START_OF_DAY + 10 * 3600 * 1000;
    const t10_00_30 = t10_00 + 30 * 1000;
    const t10_00_30_100 = t10_00_30 + 100;
    const t10_20 = t10_00 + 20 * 60 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'com.instagram.android', timestamp: t10_00, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.instagram.android', timestamp: t10_00_30, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.instagram.android', timestamp: t10_00_30_100, eventType: EVENT_ACTIVITY_STOPPED },
      { packageName: 'com.instagram.android', timestamp: t10_20, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    // Total time should be full 20 minutes, NOT 30 seconds!
    expect(result.totalDeviceMinutes).toBe(20);
    const insta = result.apps.find((a) => a.packageName === 'com.instagram.android');
    expect(insta?.durationMinutes).toBe(20);
  });

  it('13. recovers active package from EVENT_USER_INTERACTION after screen unlock', () => {
    // Screen unlocks without immediate ACTIVITY_RESUMED event, but user interacts with WhatsApp
    const t1 = START_OF_DAY + 8 * 3600 * 1000;
    const tInteract = t1 + 1000;
    const tPause = t1 + 15 * 60 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'android', timestamp: t1, eventType: EVENT_SCREEN_INTERACTIVE },
      { packageName: 'com.whatsapp', timestamp: tInteract, eventType: EVENT_USER_INTERACTION },
      { packageName: 'com.whatsapp', timestamp: tPause, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    expect(result.totalDeviceMinutes).toBe(15);
    const wa = result.apps.find((a) => a.packageName === 'com.whatsapp');
    expect(wa?.durationMinutes).toBe(15);
  });

  it('14. maintains continuous foreground session when internal activity transitions interleave onResume and onPause', () => {
    // Standard Android Activity transition:
    // 14:00:00 - MainActivity.onResume()
    // 14:05:00 - DetailActivity.onResume()
    // 14:05:00.020 - MainActivity.onPause()
    // 14:45:00 - DetailActivity.onPause()
    const t14_00 = START_OF_DAY + 14 * 3600 * 1000;
    const t14_05 = t14_00 + 5 * 60 * 1000;
    const t14_05_020 = t14_05 + 20;
    const t14_45 = t14_00 + 45 * 60 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'com.instagram.android', className: 'com.instagram.mainactivity.MainActivity', timestamp: t14_00, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.instagram.android', className: 'com.instagram.modal.ModalActivity', timestamp: t14_05, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.instagram.android', className: 'com.instagram.mainactivity.MainActivity', timestamp: t14_05_020, eventType: EVENT_ACTIVITY_PAUSED },
      { packageName: 'com.instagram.android', className: 'com.instagram.modal.ModalActivity', timestamp: t14_45, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    // Full 45 minutes must be counted (MainActivity's pause at 14:05:00.020 must NOT wipe out ModalActivity!)
    expect(result.totalDeviceMinutes).toBe(45);
    const insta = result.apps.find((a) => a.packageName === 'com.instagram.android');
    expect(insta?.durationMinutes).toBe(45);
  });

  it('15. verifies exact mathematical equality between hourly bucket sums and total device screen time', () => {
    // 01:30 to 03:15 (1h 45m = 105 min): crosses hour 1, hour 2, and hour 3
    // With user touch interaction at 02:30
    // Hour 1 (01:00-02:00): 30 min (01:30-02:00)
    // Hour 2 (02:00-03:00): 60 min
    // Hour 3 (03:00-04:00): 15 min (03:00-03:15)
    const tStart = START_OF_DAY + 1.5 * 3600 * 1000; // 01:30
    const tInteract = START_OF_DAY + 2.5 * 3600 * 1000; // 02:30
    const tEnd = START_OF_DAY + 3.25 * 3600 * 1000;  // 03:15

    const events: RawUsageEvent[] = [
      { packageName: 'com.netflix.mediaclient', timestamp: tStart, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.netflix.mediaclient', timestamp: tInteract, eventType: EVENT_USER_INTERACTION },
      { packageName: 'com.netflix.mediaclient', timestamp: tEnd, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    expect(result.totalDeviceMillis).toBe(105 * 60 * 1000);
    expect(result.hourlyTotalMillis).toBe(result.totalDeviceMillis);

    expect(result.hourlyBuckets[1].durationMinutes).toBe(30);
    expect(result.hourlyBuckets[2].durationMinutes).toBe(60);
    expect(result.hourlyBuckets[3].durationMinutes).toBe(15);
  });

  it('16. audits and records discarded intervals outside reporting window', () => {
    // Session 1: 22:00 to 23:30 yesterday (strictly before START_OF_DAY)
    // Session 2: 10:00 to 11:00 today (valid)
    const tYesterdayStart = START_OF_DAY - 2 * 3600 * 1000;
    const tYesterdayEnd = START_OF_DAY - 30 * 60 * 1000;
    const tTodayStart = START_OF_DAY + 10 * 3600 * 1000;
    const tTodayEnd = tTodayStart + 60 * 60 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'com.twitter.android', timestamp: tYesterdayStart, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.twitter.android', timestamp: tYesterdayEnd, eventType: EVENT_ACTIVITY_PAUSED },
      { packageName: 'com.twitter.android', timestamp: tTodayStart, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.twitter.android', timestamp: tTodayEnd, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    expect(result.totalDeviceMinutes).toBe(60);
    expect(result.discardedIntervals.length).toBeGreaterThanOrEqual(1);
    const yesterdayDiscarded = result.discardedIntervals.find((d) => d.packageName === 'com.twitter.android');
    expect(yesterdayDiscarded).toBeDefined();
    expect(yesterdayDiscarded?.reason).toContain('before calendar day start');
  });

  it('17. calculates per-app 24-hour distribution strictly matching each apps active sessions', () => {
    // 08:00 - 08:30: WhatsApp (30m in hour 8)
    // 14:00 - 15:30: YouTube (60m in hour 14, 30m in hour 15)
    const t8_00 = START_OF_DAY + 8 * 3600 * 1000;
    const t8_30 = t8_00 + 30 * 60 * 1000;
    const t14_00 = START_OF_DAY + 14 * 3600 * 1000;
    const t14_45 = t14_00 + 45 * 60 * 1000;
    const t15_30 = t14_00 + 90 * 60 * 1000;

    const events: RawUsageEvent[] = [
      { packageName: 'com.whatsapp', timestamp: t8_00, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.whatsapp', timestamp: t8_30, eventType: EVENT_ACTIVITY_PAUSED },
      { packageName: 'com.google.android.youtube', timestamp: t14_00, eventType: EVENT_ACTIVITY_RESUMED },
      { packageName: 'com.google.android.youtube', timestamp: t14_45, eventType: EVENT_USER_INTERACTION },
      { packageName: 'com.google.android.youtube', timestamp: t15_30, eventType: EVENT_ACTIVITY_PAUSED },
    ];

    const result = calculateScreenTime(events, START_OF_DAY, END_OF_DAY);

    const whatsapp = result.apps.find((a) => a.packageName === 'com.whatsapp');
    expect(whatsapp).toBeDefined();
    expect(whatsapp?.hourlyUsage).toBeDefined();
    expect(whatsapp?.hourlyUsage?.length).toBe(24);
    expect(whatsapp?.hourlyUsage?.[8].durationMinutes).toBe(30);
    expect(whatsapp?.hourlyUsage?.[14].durationMinutes).toBe(0);

    const youtube = result.apps.find((a) => a.packageName === 'com.google.android.youtube');
    expect(youtube).toBeDefined();
    expect(youtube?.hourlyUsage).toBeDefined();
    expect(youtube?.hourlyUsage?.[14].durationMinutes).toBe(60);
    expect(youtube?.hourlyUsage?.[15].durationMinutes).toBe(30);
    expect(youtube?.hourlyUsage?.[8].durationMinutes).toBe(0);
  });

  it('18. getAppHourlyUsage isolates selected apps data and returns total when unselected', () => {
    const mockData: any = {
      totalMinutes: 120,
      hourlyUsage: Array.from({ length: 24 }).map((_, h) => ({
        hour: h,
        label: `${h}:00`,
        durationMinutes: h === 10 ? 60 : h === 11 ? 60 : 0,
        durationMillis: (h === 10 ? 60 : h === 11 ? 60 : 0) * 60000,
      })),
      apps: [
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          durationMinutes: 45,
          hourlyUsage: Array.from({ length: 24 }).map((_, h) => ({
            hour: h,
            label: `${h}:00`,
            durationMinutes: h === 10 ? 45 : 0,
            durationMillis: (h === 10 ? 45 : 0) * 60000,
          })),
        },
        {
          packageName: 'com.spotify.music',
          appName: 'Spotify',
          durationMinutes: 20,
          // No precomputed hourlyUsage - tests fallback proportional distribution
        },
      ],
    };

    // When no app is selected, returns total device hourly usage
    const overall = getAppHourlyUsage(mockData, null);
    expect(overall[10].durationMinutes).toBe(60);
    expect(overall[11].durationMinutes).toBe(60);

    // When Instagram is selected, returns only Instagram's usage
    const instaHourly = getAppHourlyUsage(mockData, 'com.instagram.android');
    expect(instaHourly[10].durationMinutes).toBe(45);
    expect(instaHourly[11].durationMinutes).toBe(0);

    // When Spotify is selected without explicit buckets, proportionally distributes its 20m across active hours 10 & 11
    const spotifyHourly = getAppHourlyUsage(mockData, 'com.spotify.music');
    const spotifyTotal = spotifyHourly.reduce((s, h) => s + h.durationMinutes, 0);
    expect(spotifyTotal).toBe(20);
    expect(spotifyHourly[10].durationMinutes + spotifyHourly[11].durationMinutes).toBe(20);
  });

  it('19. formatYAxisHours converts minute metrics to human-readable hours', () => {
    expect(formatYAxisHours(0)).toBe('0h');
    expect(formatYAxisHours(60)).toBe('1h');
    expect(formatYAxisHours(120)).toBe('2h');
    expect(formatYAxisHours(180)).toBe('3h');
    expect(formatYAxisHours(240)).toBe('4h');
    expect(formatYAxisHours(300)).toBe('5h');
    expect(formatYAxisHours(30)).toBe('0.5h');
    expect(formatYAxisHours(90)).toBe('1.5h');
    expect(formatYAxisHours(150)).toBe('2.5h');
    expect(formatYAxisHours(15)).toBe('0.25h');
    expect(formatYAxisHours(45)).toBe('0.75h');
  });

  it('20. handles zero-usage days and low-usage apps without misleading labels or errors', () => {
    const emptyHourly = getAppHourlyUsage(null, null);
    expect(emptyHourly).toEqual([]);

    const zeroAppData: any = {
      totalMinutes: 0,
      hourlyUsage: Array.from({ length: 24 }).map((_, h) => ({
        hour: h,
        label: `${h}:00`,
        durationMinutes: 0,
        durationMillis: 0,
      })),
      apps: [
        {
          packageName: 'com.dormant.app',
          appName: 'Dormant App',
          durationMinutes: 0,
        },
      ],
    };

    const dormantHourly = getAppHourlyUsage(zeroAppData, 'com.dormant.app');
    expect(dormantHourly.length).toBe(24);
    expect(dormantHourly.every((h) => h.durationMinutes === 0)).toBe(true);
  });
});
