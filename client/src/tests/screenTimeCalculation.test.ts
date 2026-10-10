import { describe, it, expect } from 'vitest';
import {
  calculateScreenTime,
  mergeIntervals,
  resolveCleanAppName,
  distributeMergedIntervalsHourly,
  EVENT_ACTIVITY_RESUMED,
  EVENT_ACTIVITY_PAUSED,
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
});
