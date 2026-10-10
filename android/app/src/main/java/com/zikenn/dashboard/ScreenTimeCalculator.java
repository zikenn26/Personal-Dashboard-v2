package com.zikenn.dashboard;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * ScreenTimeCalculator
 *
 * Implements the exact, verified Screen Time calculation algorithm:
 * 1. Reconstructs user-interactive foreground sessions from raw UsageEvents.
 * 2. Deduplicates repeated events and handles rapid switching.
 * 3. Caps open or missing-end sessions using MAX_SESSION_DURATION to prevent overnight leaks.
 * 4. Strictly clips all intervals to local calendar-day boundaries [startOfDay, effectiveEnd].
 * 5. Calculates individual app foreground durations.
 * 6. Calculates TOTAL DEVICE SCREEN TIME as the non-overlapping mathematical UNION of all
 *    foreground intervals, eliminating multi-window / PiP double-counting to match Digital Wellbeing.
 * 7. Slices the merged device intervals into 24 exact hourly buckets.
 * 8. Resolves human-readable app names without generic "Android" fallbacks.
 */
public class ScreenTimeCalculator {

    // Cap single unclosed session to 60 minutes to prevent overnight leaks if OS fails to dispatch paused event
    public static final long MAX_SESSION_DURATION_MS = 60 * 60 * 1000L; // 1 hour

    // Minimum session threshold to filter out transient sub-second IPC blips
    public static final long MIN_SESSION_DURATION_MS = 1000L; // 1 second

    // Standard Android UsageEvents event types
    public static final int EVENT_ACTIVITY_RESUMED = 1;
    public static final int EVENT_ACTIVITY_PAUSED = 2;
    public static final int EVENT_USER_INTERACTION = 7;
    public static final int EVENT_SCREEN_INTERACTIVE = 15;
    public static final int EVENT_SCREEN_NON_INTERACTIVE = 16;
    public static final int EVENT_KEYGUARD_SHOWN = 17;
    public static final int EVENT_KEYGUARD_HIDDEN = 18;
    public static final int EVENT_ACTIVITY_STOPPED = 23;
    public static final int EVENT_DEVICE_SHUTDOWN = 26;
    public static final int EVENT_DEVICE_STARTUP = 27;

    /**
     * Represents a single timestamped event from UsageStatsManager.queryEvents().
     */
    public static class RawEvent {
        public final String packageName;
        public final long timestamp;
        public final int eventType;

        public RawEvent(String packageName, long timestamp, int eventType) {
            this.packageName = packageName;
            this.timestamp = timestamp;
            this.eventType = eventType;
        }
    }

    /**
     * An open or closed continuous foreground session for a specific application.
     */
    public static class SessionInterval {
        public final String packageName;
        public final long start;
        public final long end;

        public SessionInterval(String packageName, long start, long end) {
            this.packageName = packageName;
            this.start = start;
            this.end = end;
        }

        public long getDuration() {
            return Math.max(0L, end - start);
        }
    }

    /**
     * A non-overlapping time interval used for total device screen time.
     */
    public static class TimeInterval {
        public final long start;
        public final long end;

        public TimeInterval(long start, long end) {
            this.start = start;
            this.end = end;
        }

        public long getDuration() {
            return Math.max(0L, end - start);
        }
    }

    /**
     * Calculated usage stats for a specific application package.
     */
    public static class AppCalculation {
        public final String packageName;
        public long durationMillis = 0L;
        public int sessionCount = 0;

        public AppCalculation(String packageName) {
            this.packageName = packageName;
        }
    }

    /**
     * Complete calculation results for a calendar day.
     */
    public static class DailyResult {
        public long totalDeviceMillis = 0L;
        public Map<String, AppCalculation> appUsage = new HashMap<>();
        public long[] hourlyBuckets = new long[24];
        public List<SessionInterval> allSessions = new ArrayList<>();
        public List<TimeInterval> mergedDeviceIntervals = new ArrayList<>();
        public int rawEventsCount = 0;
        public int duplicatesDiscarded = 0;
        public int openSessionsCapped = 0;
    }

    /**
     * Calculate daily screen time from raw usage events.
     *
     * @param events List of raw usage events.
     * @param startOfDay Local calendar midnight timestamp in ms (inclusive).
     * @param effectiveEnd Query cutoff timestamp in ms (typically min(now, endOfDayExclusive)).
     * @param excludedPackage Package name to exclude from totals (e.g. self app).
     * @return DailyResult containing total screen time, per-app breakdown, and hourly buckets.
     */
    public static DailyResult calculateDailyScreenTime(
            List<RawEvent> events,
            long startOfDay,
            long effectiveEnd,
            String excludedPackage
    ) {
        DailyResult result = new DailyResult();
        if (events == null || events.isEmpty() || effectiveEnd <= startOfDay) {
            return result;
        }

        result.rawEventsCount = events.size();

        // 1. Sort events chronologically. Secondary sort: PAUSE before RESUME if identical timestamp.
        List<RawEvent> sortedEvents = new ArrayList<>(events);
        Collections.sort(sortedEvents, new Comparator<RawEvent>() {
            @Override
            public int compare(RawEvent a, RawEvent b) {
                if (a.timestamp != b.timestamp) {
                    return Long.compare(a.timestamp, b.timestamp);
                }
                // At exact same millisecond: process screen off or pause before new resume
                return Integer.compare(getEventPriority(a.eventType), getEventPriority(b.eventType));
            }

            private int getEventPriority(int type) {
                switch (type) {
                    case EVENT_SCREEN_NON_INTERACTIVE:
                    case EVENT_KEYGUARD_SHOWN:
                    case EVENT_DEVICE_SHUTDOWN:
                    case EVENT_ACTIVITY_PAUSED:
                    case EVENT_ACTIVITY_STOPPED:
                        return 0; // Close existing first
                    case EVENT_SCREEN_INTERACTIVE:
                    case EVENT_KEYGUARD_HIDDEN:
                    case EVENT_DEVICE_STARTUP:
                        return 1;
                    case EVENT_ACTIVITY_RESUMED:
                        return 2; // Open new session last
                    default:
                        return 3;
                }
            }
        });

        // 2. Track current active foreground app session
        String activePkg = null;
        long sessionStartTime = 0L;
        long lastInteractionTime = 0L;
        boolean isScreenInteractive = true;

        List<SessionInterval> rawSessions = new ArrayList<>();

        for (RawEvent event : sortedEvents) {
            long t = event.timestamp;
            int type = event.eventType;
            String pkg = event.packageName;

            // Discard duplicate identical events at same millisecond
            if (activePkg != null && activePkg.equals(pkg) && type == EVENT_ACTIVITY_RESUMED && t == sessionStartTime) {
                result.duplicatesDiscarded++;
                continue;
            }

            switch (type) {
                case EVENT_ACTIVITY_RESUMED:
                    // If another app was currently active, close its session at timestamp t
                    if (activePkg != null && sessionStartTime > 0) {
                        long sessionEnd = resolveSessionEnd(sessionStartTime, t, lastInteractionTime, result);
                        rawSessions.add(new SessionInterval(activePkg, sessionStartTime, sessionEnd));
                    }
                    activePkg = pkg;
                    sessionStartTime = t;
                    lastInteractionTime = t;
                    isScreenInteractive = true;
                    break;

                case EVENT_ACTIVITY_PAUSED:
                case EVENT_ACTIVITY_STOPPED:
                    if (activePkg != null && activePkg.equals(pkg)) {
                        long sessionEnd = resolveSessionEnd(sessionStartTime, t, lastInteractionTime, result);
                        rawSessions.add(new SessionInterval(activePkg, sessionStartTime, sessionEnd));
                        activePkg = null;
                        sessionStartTime = 0L;
                    }
                    break;

                case EVENT_SCREEN_NON_INTERACTIVE:
                case EVENT_KEYGUARD_SHOWN:
                case EVENT_DEVICE_SHUTDOWN:
                    isScreenInteractive = false;
                    if (activePkg != null && sessionStartTime > 0) {
                        long sessionEnd = resolveSessionEnd(sessionStartTime, t, lastInteractionTime, result);
                        rawSessions.add(new SessionInterval(activePkg, sessionStartTime, sessionEnd));
                        activePkg = null;
                        sessionStartTime = 0L;
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

                default:
                    break;
            }
        }

        // 3. Handle currently open session at query time
        if (activePkg != null && sessionStartTime > 0 && isScreenInteractive) {
            long sessionEnd = Math.min(effectiveEnd, sessionStartTime + MAX_SESSION_DURATION_MS);
            if (effectiveEnd > sessionStartTime) {
                sessionEnd = Math.min(effectiveEnd, Math.max(sessionStartTime + MIN_SESSION_DURATION_MS, sessionEnd));
                rawSessions.add(new SessionInterval(activePkg, sessionStartTime, sessionEnd));
            }
        }

        // 4. Clip all sessions strictly to calendar day bounds [startOfDay, effectiveEnd]
        List<SessionInterval> validDaySessions = new ArrayList<>();
        for (SessionInterval s : rawSessions) {
            long clampedStart = Math.max(s.start, startOfDay);
            long clampedEnd = Math.min(s.end, effectiveEnd);

            if (clampedEnd > clampedStart && (clampedEnd - clampedStart) >= MIN_SESSION_DURATION_MS) {
                validDaySessions.add(new SessionInterval(s.packageName, clampedStart, clampedEnd));
            }
        }
        result.allSessions = validDaySessions;

        // 5. Calculate per-app totals
        for (SessionInterval s : validDaySessions) {
            if (excludedPackage != null && excludedPackage.equals(s.packageName)) {
                continue;
            }
            AppCalculation app = result.appUsage.get(s.packageName);
            if (app == null) {
                app = new AppCalculation(s.packageName);
                result.appUsage.put(s.packageName, app);
            }
            app.durationMillis += s.getDuration();
            app.sessionCount += 1;
        }

        // 6. Calculate TOTAL DEVICE SCREEN TIME using Interval Union (Merge Overlapping Intervals)
        // This ensures multi-window, PiP, rapid switches, and overlaps CANNOT inflate total screen time
        List<TimeInterval> deviceIntervals = new ArrayList<>();
        for (SessionInterval s : validDaySessions) {
            if (excludedPackage != null && excludedPackage.equals(s.packageName)) {
                continue;
            }
            deviceIntervals.add(new TimeInterval(s.start, s.end));
        }

        List<TimeInterval> merged = mergeIntervals(deviceIntervals);
        result.mergedDeviceIntervals = merged;

        long deviceTotal = 0L;
        for (TimeInterval interval : merged) {
            deviceTotal += interval.getDuration();
        }
        result.totalDeviceMillis = deviceTotal;

        // 7. Distribute merged intervals into 24 exact hourly buckets
        distributeMergedIntervalsHourly(merged, startOfDay, result.hourlyBuckets);

        return result;
    }

    private static long resolveSessionEnd(long start, long end, long lastInteraction, DailyResult result) {
        if (end <= start) {
            return start;
        }
        long duration = end - start;
        if (duration > MAX_SESSION_DURATION_MS) {
            result.openSessionsCapped++;
            // If interaction occurred, cap to interaction + 5 mins, else cap to start + MAX_SESSION_DURATION
            if (lastInteraction > start && lastInteraction < end) {
                return Math.min(end, lastInteraction + (5 * 60 * 1000L));
            }
            return start + MAX_SESSION_DURATION_MS;
        }
        return end;
    }

    /**
     * Mathematically merges overlapping or adjacent time intervals.
     * Guaranteed that no intervals overlap in the returned list.
     */
    public static List<TimeInterval> mergeIntervals(List<TimeInterval> intervals) {
        if (intervals == null || intervals.isEmpty()) {
            return Collections.emptyList();
        }

        List<TimeInterval> sorted = new ArrayList<>(intervals);
        Collections.sort(sorted, new Comparator<TimeInterval>() {
            @Override
            public int compare(TimeInterval a, TimeInterval b) {
                return Long.compare(a.start, b.start);
            }
        });

        List<TimeInterval> merged = new ArrayList<>();
        TimeInterval current = sorted.get(0);

        for (int i = 1; i < sorted.size(); i++) {
            TimeInterval next = sorted.get(i);
            if (next.start <= current.end) {
                // Overlapping or touching intervals: extend current end
                current = new TimeInterval(current.start, Math.max(current.end, next.end));
            } else {
                merged.add(current);
                current = next;
            }
        }
        merged.add(current);
        return merged;
    }

    /**
     * Slices non-overlapping time intervals into 24 exact hourly buckets [0..23].
     */
    public static void distributeMergedIntervalsHourly(List<TimeInterval> intervals, long dayStart, long[] hourlyBuckets) {
        if (intervals == null || intervals.isEmpty() || hourlyBuckets == null || hourlyBuckets.length < 24) {
            return;
        }

        long hourMs = 60 * 60 * 1000L;

        for (TimeInterval interval : intervals) {
            long start = interval.start;
            long end = interval.end;
            if (end <= start) continue;

            for (int h = 0; h < 24; h++) {
                long hStart = dayStart + (h * hourMs);
                long hEnd = hStart + hourMs;

                long sliceStart = Math.max(start, hStart);
                long sliceEnd = Math.min(end, hEnd);

                if (sliceEnd > sliceStart) {
                    hourlyBuckets[h] += (sliceEnd - sliceStart);
                }
            }
        }
    }

    // =========================================================================
    // APPLICATION NAME RESOLUTION & FALLBACK HEURISTICS
    // =========================================================================

    private static final Map<String, String> KNOWN_APP_NAMES = new HashMap<>();
    static {
        KNOWN_APP_NAMES.put("com.instagram.android", "Instagram");
        KNOWN_APP_NAMES.put("com.snapchat.android", "Snapchat");
        KNOWN_APP_NAMES.put("com.whatsapp", "WhatsApp");
        KNOWN_APP_NAMES.put("com.whatsapp.w4b", "WhatsApp Business");
        KNOWN_APP_NAMES.put("com.google.android.youtube", "YouTube");
        KNOWN_APP_NAMES.put("com.google.android.apps.youtube.music", "YouTube Music");
        KNOWN_APP_NAMES.put("com.spotify.music", "Spotify");
        KNOWN_APP_NAMES.put("com.spotify.music.android", "Spotify");
        KNOWN_APP_NAMES.put("com.twitter.android", "X (Twitter)");
        KNOWN_APP_NAMES.put("com.twitter", "X (Twitter)");
        KNOWN_APP_NAMES.put("com.facebook.katana", "Facebook");
        KNOWN_APP_NAMES.put("com.facebook.orca", "Messenger");
        KNOWN_APP_NAMES.put("com.facebook.lite", "Facebook Lite");
        KNOWN_APP_NAMES.put("com.android.chrome", "Chrome");
        KNOWN_APP_NAMES.put("org.mozilla.firefox", "Firefox");
        KNOWN_APP_NAMES.put("com.opera.browser", "Opera");
        KNOWN_APP_NAMES.put("com.brave.browser", "Brave");
        KNOWN_APP_NAMES.put("com.google.android.gm", "Gmail");
        KNOWN_APP_NAMES.put("com.google.android.apps.maps", "Google Maps");
        KNOWN_APP_NAMES.put("com.google.android.apps.photos", "Google Photos");
        KNOWN_APP_NAMES.put("com.google.android.apps.docs", "Google Docs");
        KNOWN_APP_NAMES.put("com.google.android.apps.docs.editors.sheets", "Google Sheets");
        KNOWN_APP_NAMES.put("com.google.android.apps.docs.editors.slides", "Google Slides");
        KNOWN_APP_NAMES.put("com.google.android.keep", "Google Keep");
        KNOWN_APP_NAMES.put("com.google.android.calculator", "Calculator");
        KNOWN_APP_NAMES.put("com.google.android.deskclock", "Clock");
        KNOWN_APP_NAMES.put("com.google.android.calendar", "Google Calendar");
        KNOWN_APP_NAMES.put("org.telegram.messenger", "Telegram");
        KNOWN_APP_NAMES.put("org.thoughtcrime.securesms", "Signal");
        KNOWN_APP_NAMES.put("com.reddit.frontpage", "Reddit");
        KNOWN_APP_NAMES.put("com.zhiliaoapp.musically", "TikTok");
        KNOWN_APP_NAMES.put("com.ss.android.ugc.trill", "TikTok");
        KNOWN_APP_NAMES.put("com.amazon.mShop.android.shopping", "Amazon");
        KNOWN_APP_NAMES.put("in.amazon.mShop.android.shopping", "Amazon");
        KNOWN_APP_NAMES.put("com.netflix.mediaclient", "Netflix");
        KNOWN_APP_NAMES.put("com.disney.disneyplus", "Disney+");
        KNOWN_APP_NAMES.put("com.amazon.avod.thirdpartyclient", "Prime Video");
        KNOWN_APP_NAMES.put("com.linkedin.android", "LinkedIn");
        KNOWN_APP_NAMES.put("com.pinterest", "Pinterest");
        KNOWN_APP_NAMES.put("com.discord", "Discord");
        KNOWN_APP_NAMES.put("com.microsoft.teams", "Microsoft Teams");
        KNOWN_APP_NAMES.put("com.slack", "Slack");
        KNOWN_APP_NAMES.put("notion.id", "Notion");
        KNOWN_APP_NAMES.put("com.duolingo", "Duolingo");
        KNOWN_APP_NAMES.put("com.supercell.clashofclans", "Clash of Clans");
        KNOWN_APP_NAMES.put("com.supercell.brawlstars", "Brawl Stars");
        KNOWN_APP_NAMES.put("com.dts.freefireth", "Free Fire");
        KNOWN_APP_NAMES.put("com.pubg.imobile", "BGMI / PUBG");
        KNOWN_APP_NAMES.put("com.roblox.client", "Roblox");
        KNOWN_APP_NAMES.put("com.mojang.minecraftpe", "Minecraft");
        KNOWN_APP_NAMES.put("com.android.settings", "Settings");
        KNOWN_APP_NAMES.put("android", "Android System");
    }

    /**
     * Resolves a package name to a clean, human-readable application name.
     * Guaranteed to never return "Android" for non-Android OS packages.
     *
     * @param packageName Android package name (e.g. "com.instagram.android")
     * @param systemLabel Optional label obtained from PackageManager (can be null or empty)
     * @return Proper application name (e.g. "Instagram")
     */
    public static String resolveCleanAppName(String packageName, CharSequence systemLabel) {
        if (packageName == null || packageName.trim().isEmpty()) {
            return "Application";
        }

        String pkg = packageName.trim();

        // 1. If PackageManager gave a valid non-empty label that isn't generic "Android" or the raw package
        if (systemLabel != null) {
            String labelStr = systemLabel.toString().trim();
            if (!labelStr.isEmpty() && !labelStr.equalsIgnoreCase("android") && !labelStr.equalsIgnoreCase(pkg)) {
                return labelStr;
            }
        }

        // 2. Check well-known package dictionary
        if (KNOWN_APP_NAMES.containsKey(pkg)) {
            return KNOWN_APP_NAMES.get(pkg);
        }

        // Check without trailing suffix
        String lowerPkg = pkg.toLowerCase(Locale.US);
        for (Map.Entry<String, String> entry : KNOWN_APP_NAMES.entrySet()) {
            if (lowerPkg.equals(entry.getKey().toLowerCase(Locale.US))) {
                return entry.getValue();
            }
        }

        // 3. Smart Heuristic: parse segments, skipping generic tokens
        String[] parts = pkg.split("\\.");
        List<String> meaningfulParts = new ArrayList<>();
        for (String part : parts) {
            String p = part.trim().toLowerCase(Locale.US);
            if (p.isEmpty()) continue;
            // Filter out generic domain and packaging words
            if (p.equals("com") || p.equals("org") || p.equals("net") || p.equals("in") || p.equals("io")
                    || p.equals("android") || p.equals("app") || p.equals("apps") || p.equals("mobile")
                    || p.equals("client") || p.equals("release") || p.equals("lite") || p.equals("google")) {
                continue;
            }
            meaningfulParts.add(part);
        }

        if (!meaningfulParts.isEmpty()) {
            // Pick the primary meaningful token (last significant word or first if only one)
            String target = meaningfulParts.get(meaningfulParts.size() - 1);
            if (target.length() > 0) {
                return Character.toUpperCase(target.charAt(0)) + target.substring(1);
            }
        }

        // 4. Absolute fallback
        if (parts.length > 0) {
            String candidate = parts[parts.length - 1];
            if (candidate.equalsIgnoreCase("android") && parts.length > 1) {
                candidate = parts[parts.length - 2];
            }
            if (candidate.length() > 0) {
                return Character.toUpperCase(candidate.charAt(0)) + candidate.substring(1);
            }
        }

        return pkg;
    }
}
