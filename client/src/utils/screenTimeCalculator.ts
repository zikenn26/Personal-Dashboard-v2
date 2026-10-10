/**
 * Screen Time Calculation Engine
 *
 * Implements the verified Digital Wellbeing matching formula:
 * 1. Reconstructs user-interactive foreground sessions from timestamped UsageEvents.
 * 2. Handles rapid switching, out-of-order/duplicate events, device restarts, and unclosed sessions.
 * 3. Enforces local calendar-day midnight boundaries [startOfDay, effectiveEnd].
 * 4. Resolves per-app durations.
 * 5. Computes Total Device Screen Time as the non-overlapping mathematical UNION of all
 *    active intervals, strictly eliminating multi-window, PiP, and concurrent foreground inflation.
 * 6. Slices non-overlapping intervals into 24 exact hourly buckets.
 * 7. Resolves clean application names without generic "Android" fallbacks.
 */

export const MAX_SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour cap for unclosed sessions
export const MIN_SESSION_DURATION_MS = 1000; // 1 second threshold

export const EVENT_ACTIVITY_RESUMED = 1;
export const EVENT_ACTIVITY_PAUSED = 2;
export const EVENT_USER_INTERACTION = 7;
export const EVENT_SCREEN_INTERACTIVE = 15;
export const EVENT_SCREEN_NON_INTERACTIVE = 16;
export const EVENT_KEYGUARD_SHOWN = 17;
export const EVENT_KEYGUARD_HIDDEN = 18;
export const EVENT_ACTIVITY_STOPPED = 23;
export const EVENT_DEVICE_SHUTDOWN = 26;
export const EVENT_DEVICE_STARTUP = 27;

export interface RawUsageEvent {
  packageName: string;
  timestamp: number;
  eventType: number;
}

export interface SessionInterval {
  packageName: string;
  start: number;
  end: number;
  duration: number;
}

export interface TimeInterval {
  start: number;
  end: number;
  duration: number;
}

export interface AppCalculation {
  packageName: string;
  appName: string;
  durationMillis: number;
  durationMinutes: number;
  sessionCount: number;
  percentageOfTotal: number;
}

export interface CalculationResult {
  totalDeviceMillis: number;
  totalDeviceMinutes: number;
  apps: AppCalculation[];
  hourlyBuckets: {
    hour: number;
    label: string;
    durationMillis: number;
    durationMinutes: number;
  }[];
  allSessions: SessionInterval[];
  mergedIntervals: TimeInterval[];
  rawEventsCount: number;
  duplicatesDiscarded: number;
  openSessionsCapped: number;
}

/**
 * Mathematically merges overlapping or adjacent time intervals.
 * Guaranteed that no intervals overlap in the returned list.
 */
export function mergeIntervals(intervals: { start: number; end: number }[]): TimeInterval[] {
  if (!intervals || intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: TimeInterval[] = [];

  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= currentEnd) {
      // Overlapping or touching intervals
      currentEnd = Math.max(currentEnd, next.end);
    } else {
      if (currentEnd > currentStart) {
        merged.push({
          start: currentStart,
          end: currentEnd,
          duration: currentEnd - currentStart,
        });
      }
      currentStart = next.start;
      currentEnd = next.end;
    }
  }

  if (currentEnd > currentStart) {
    merged.push({
      start: currentStart,
      end: currentEnd,
      duration: currentEnd - currentStart,
    });
  }

  return merged;
}

/**
 * Slices non-overlapping time intervals into 24 exact hourly buckets [0..23].
 */
export function distributeMergedIntervalsHourly(
  mergedIntervals: TimeInterval[],
  dayStart: number
): number[] {
  const buckets = new Array(24).fill(0);
  const hourMs = 60 * 60 * 1000;

  for (const interval of mergedIntervals) {
    const start = interval.start;
    const end = interval.end;
    if (end <= start) continue;

    for (let h = 0; h < 24; h++) {
      const hStart = dayStart + h * hourMs;
      const hEnd = hStart + hourMs;

      const sliceStart = Math.max(start, hStart);
      const sliceEnd = Math.min(end, hEnd);

      if (sliceEnd > sliceStart) {
        buckets[h] += sliceEnd - sliceStart;
      }
    }
  }

  return buckets;
}

/**
 * Known package name dictionary to ensure instantaneous, bulletproof resolution.
 */
export const KNOWN_PACKAGES: Record<string, string> = {
  'com.instagram.android': 'Instagram',
  'com.snapchat.android': 'Snapchat',
  'com.whatsapp': 'WhatsApp',
  'com.whatsapp.w4b': 'WhatsApp Business',
  'com.google.android.youtube': 'YouTube',
  'com.google.android.apps.youtube.music': 'YouTube Music',
  'com.spotify.music': 'Spotify',
  'com.spotify.music.android': 'Spotify',
  'com.twitter.android': 'X (Twitter)',
  'com.twitter': 'X (Twitter)',
  'com.facebook.katana': 'Facebook',
  'com.facebook.orca': 'Messenger',
  'com.facebook.lite': 'Facebook Lite',
  'com.android.chrome': 'Chrome',
  'org.mozilla.firefox': 'Firefox',
  'com.opera.browser': 'Opera',
  'com.brave.browser': 'Brave',
  'com.google.android.gm': 'Gmail',
  'com.google.android.apps.maps': 'Google Maps',
  'com.google.android.apps.photos': 'Google Photos',
  'com.google.android.apps.docs': 'Google Docs',
  'com.google.android.keep': 'Google Keep',
  'com.google.android.calculator': 'Calculator',
  'com.google.android.deskclock': 'Clock',
  'com.google.android.calendar': 'Google Calendar',
  'org.telegram.messenger': 'Telegram',
  'com.reddit.frontpage': 'Reddit',
  'com.zhiliaoapp.musically': 'TikTok',
  'com.ss.android.ugc.trill': 'TikTok',
  'com.amazon.mShop.android.shopping': 'Amazon',
  'in.amazon.mShop.android.shopping': 'Amazon',
  'com.netflix.mediaclient': 'Netflix',
  'com.disney.disneyplus': 'Disney+',
  'com.linkedin.android': 'LinkedIn',
  'com.pinterest': 'Pinterest',
  'com.discord': 'Discord',
  'com.microsoft.teams': 'Microsoft Teams',
  'com.slack': 'Slack',
  'notion.id': 'Notion',
  'com.duolingo': 'Duolingo',
  'com.supercell.clashofclans': 'Clash of Clans',
  'com.pubg.imobile': 'BGMI / PUBG',
  'com.android.settings': 'Settings',
  android: 'Android System',
};

/**
 * Resolves a package name to a clean, human-readable application name.
 * Never returns "Android" for non-Android OS packages.
 */
export function resolveCleanAppName(packageName: string, systemLabel?: string | null): string {
  if (!packageName || !packageName.trim()) return 'Application';

  const pkg = packageName.trim();

  // 1. If PackageManager provided a valid non-empty label that isn't generic "Android" or the raw package
  if (systemLabel && systemLabel.trim()) {
    const label = systemLabel.trim();
    if (label.toLowerCase() !== 'android' && label.toLowerCase() !== pkg.toLowerCase()) {
      return label;
    }
  }

  // 2. Check well-known package dictionary
  if (KNOWN_PACKAGES[pkg]) {
    return KNOWN_PACKAGES[pkg];
  }

  const lowerPkg = pkg.toLowerCase();
  for (const [k, v] of Object.entries(KNOWN_PACKAGES)) {
    if (k.toLowerCase() === lowerPkg) {
      return v;
    }
  }

  // 3. Smart Heuristic: parse segments, filtering out generic packaging words
  const parts = pkg.split('.');
  const meaningfulParts: string[] = [];

  for (const part of parts) {
    const p = part.trim().toLowerCase();
    if (!p) continue;
    if (
      p === 'com' ||
      p === 'org' ||
      p === 'net' ||
      p === 'in' ||
      p === 'io' ||
      p === 'android' ||
      p === 'app' ||
      p === 'apps' ||
      p === 'mobile' ||
      p === 'client' ||
      p === 'release' ||
      p === 'lite' ||
      p === 'google'
    ) {
      continue;
    }
    meaningfulParts.push(part);
  }

  if (meaningfulParts.length > 0) {
    const target = meaningfulParts[meaningfulParts.length - 1];
    return target.charAt(0).toUpperCase() + target.slice(1);
  }

  // 4. Absolute fallback: never take trailing "android"
  if (parts.length > 0) {
    let candidate = parts[parts.length - 1];
    if (candidate.toLowerCase() === 'android' && parts.length > 1) {
      candidate = parts[parts.length - 2];
    }
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  return pkg;
}

/**
 * Calculates daily screen time from raw usage events.
 */
export function calculateScreenTime(
  events: RawUsageEvent[],
  startOfDay: number,
  effectiveEnd: number,
  excludedPackage?: string
): CalculationResult {
  const result: CalculationResult = {
    totalDeviceMillis: 0,
    totalDeviceMinutes: 0,
    apps: [],
    hourlyBuckets: Array.from({ length: 24 }).map((_, h) => ({
      hour: h,
      label: h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
      durationMillis: 0,
      durationMinutes: 0,
    })),
    allSessions: [],
    mergedIntervals: [],
    rawEventsCount: events?.length || 0,
    duplicatesDiscarded: 0,
    openSessionsCapped: 0,
  };

  if (!events || events.length === 0 || effectiveEnd <= startOfDay) {
    return result;
  }

  // 1. Chronological sort
  const sorted = [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    const getPriority = (type: number) => {
      switch (type) {
        case EVENT_SCREEN_NON_INTERACTIVE:
        case EVENT_KEYGUARD_SHOWN:
        case EVENT_DEVICE_SHUTDOWN:
        case EVENT_ACTIVITY_PAUSED:
        case EVENT_ACTIVITY_STOPPED:
          return 0;
        case EVENT_SCREEN_INTERACTIVE:
        case EVENT_KEYGUARD_HIDDEN:
        case EVENT_DEVICE_STARTUP:
          return 1;
        case EVENT_ACTIVITY_RESUMED:
          return 2;
        default:
          return 3;
      }
    };
    return getPriority(a.eventType) - getPriority(b.eventType);
  });

  // 2. Session reconstruction
  let activePkg: string | null = null;
  let sessionStartTime = 0;
  let lastInteractionTime = 0;
  let isScreenInteractive = true;

  const rawSessions: { packageName: string; start: number; end: number }[] = [];

  const resolveSessionEnd = (start: number, end: number, lastInteraction: number) => {
    if (end <= start) return start;
    const duration = end - start;
    if (duration > MAX_SESSION_DURATION_MS) {
      result.openSessionsCapped++;
      if (lastInteraction > start && lastInteraction < end) {
        return Math.min(end, lastInteraction + 5 * 60 * 1000);
      }
      return start + MAX_SESSION_DURATION_MS;
    }
    return end;
  };

  for (const event of sorted) {
    const t = event.timestamp;
    const type = event.eventType;
    const pkg = event.packageName;

    // Discard identical duplicate events
    if (activePkg === pkg && type === EVENT_ACTIVITY_RESUMED && t === sessionStartTime) {
      result.duplicatesDiscarded++;
      continue;
    }

    switch (type) {
      case EVENT_ACTIVITY_RESUMED:
        if (activePkg && sessionStartTime > 0) {
          const sessionEnd = resolveSessionEnd(sessionStartTime, t, lastInteractionTime);
          rawSessions.push({ packageName: activePkg, start: sessionStartTime, end: sessionEnd });
        }
        activePkg = pkg;
        sessionStartTime = t;
        lastInteractionTime = t;
        isScreenInteractive = true;
        break;

      case EVENT_ACTIVITY_PAUSED:
      case EVENT_ACTIVITY_STOPPED:
        if (activePkg === pkg && sessionStartTime > 0) {
          const sessionEnd = resolveSessionEnd(sessionStartTime, t, lastInteractionTime);
          rawSessions.push({ packageName: activePkg, start: sessionStartTime, end: sessionEnd });
          activePkg = null;
          sessionStartTime = 0;
        }
        break;

      case EVENT_SCREEN_NON_INTERACTIVE:
      case EVENT_KEYGUARD_SHOWN:
      case EVENT_DEVICE_SHUTDOWN:
        isScreenInteractive = false;
        if (activePkg && sessionStartTime > 0) {
          const sessionEnd = resolveSessionEnd(sessionStartTime, t, lastInteractionTime);
          rawSessions.push({ packageName: activePkg, start: sessionStartTime, end: sessionEnd });
          activePkg = null;
          sessionStartTime = 0;
        }
        break;

      case EVENT_SCREEN_INTERACTIVE:
      case EVENT_KEYGUARD_HIDDEN:
      case EVENT_DEVICE_STARTUP:
        isScreenInteractive = true;
        lastInteractionTime = t;
        break;

      case EVENT_USER_INTERACTION:
        lastInteractionTime = t;
        break;
    }
  }

  // 3. Handle currently open session at query time
  if (activePkg && sessionStartTime > 0 && isScreenInteractive) {
    let sessionEnd = Math.min(effectiveEnd, sessionStartTime + MAX_SESSION_DURATION_MS);
    if (effectiveEnd > sessionStartTime) {
      sessionEnd = Math.min(
        effectiveEnd,
        Math.max(sessionStartTime + MIN_SESSION_DURATION_MS, sessionEnd)
      );
      rawSessions.push({ packageName: activePkg, start: sessionStartTime, end: sessionEnd });
    }
  }

  // 4. Clip to calendar day bounds [startOfDay, effectiveEnd]
  const validDaySessions: SessionInterval[] = [];
  for (const s of rawSessions) {
    const clampedStart = Math.max(s.start, startOfDay);
    const clampedEnd = Math.min(s.end, effectiveEnd);

    if (clampedEnd > clampedStart && clampedEnd - clampedStart >= MIN_SESSION_DURATION_MS) {
      validDaySessions.push({
        packageName: s.packageName,
        start: clampedStart,
        end: clampedEnd,
        duration: clampedEnd - clampedStart,
      });
    }
  }
  result.allSessions = validDaySessions;

  // 5. Calculate per-app totals
  const appMap = new Map<string, { durationMillis: number; sessionCount: number }>();
  for (const s of validDaySessions) {
    if (excludedPackage && excludedPackage === s.packageName) continue;
    const existing = appMap.get(s.packageName) || { durationMillis: 0, sessionCount: 0 };
    existing.durationMillis += s.duration;
    existing.sessionCount += 1;
    appMap.set(s.packageName, existing);
  }

  // 6. Calculate Total Device Screen Time using Interval Union
  const deviceIntervals = validDaySessions
    .filter((s) => !excludedPackage || s.packageName !== excludedPackage)
    .map((s) => ({ start: s.start, end: s.end }));

  const merged = mergeIntervals(deviceIntervals);
  result.mergedIntervals = merged;

  let deviceTotal = 0;
  for (const interval of merged) {
    deviceTotal += interval.duration;
  }
  result.totalDeviceMillis = deviceTotal;
  result.totalDeviceMinutes = Math.round(deviceTotal / 60000);

  // 7. Hourly buckets
  const hourlyValues = distributeMergedIntervalsHourly(merged, startOfDay);
  for (let h = 0; h < 24; h++) {
    result.hourlyBuckets[h].durationMillis = hourlyValues[h];
    result.hourlyBuckets[h].durationMinutes = Math.round(hourlyValues[h] / 60000);
  }

  // 8. Build sorted App list with percentages
  const apps: AppCalculation[] = [];
  for (const [pkg, stat] of appMap.entries()) {
    if (stat.durationMillis < 5000) continue;
    const pct = deviceTotal > 0 ? (stat.durationMillis * 100) / deviceTotal : 0;
    apps.push({
      packageName: pkg,
      appName: resolveCleanAppName(pkg),
      durationMillis: stat.durationMillis,
      durationMinutes: Math.round(stat.durationMillis / 60000),
      sessionCount: stat.sessionCount,
      percentageOfTotal: Math.round(pct * 10) / 10,
    });
  }

  apps.sort((a, b) => b.durationMillis - a.durationMillis);
  result.apps = apps;

  return result;
}
