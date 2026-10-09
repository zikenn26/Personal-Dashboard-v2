package com.zikenn.dashboard;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "ScreenTime")
public class ScreenTimePlugin extends Plugin {
    private static final String TAG = "ScreenTimePlugin";

    // In-memory icon cache to avoid re-encoding base64 icons across queries
    private static final Map<String, String> ICON_CACHE = new ConcurrentHashMap<>();
    private static final Map<String, String> APP_NAME_CACHE = new ConcurrentHashMap<>();

    /**
     * Check if PACKAGE_USAGE_STATS permission has been granted by user in Android Settings.
     */
    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", isUsageAccessGranted());
        call.resolve(ret);
    }

    /**
     * Open Android Settings -> Usage Access screen so user can grant permission.
     */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Some OEM ROMs crash if package URI is provided to ACTION_USAGE_ACCESS_SETTINGS,
            // so we attempt with package URI first, then fallback to general settings.
            try {
                intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                ctx.startActivity(intent);
            } catch (Exception e) {
                intent.setData(null);
                ctx.startActivity(intent);
            }

            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch usage access settings", e);
            call.reject("Failed to open usage access settings: " + e.getMessage());
        }
    }

    /**
     * Query detailed daily screen time usage for a specific calendar day.
     */
    @PluginMethod
    public void getDailyUsage(PluginCall call) {
        if (!isUsageAccessGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("hasData", false);
            ret.put("error", "PERMISSION_REQUIRED");
            ret.put("message", "PACKAGE_USAGE_STATS permission is required to access device screen time.");
            call.resolve(ret);
            return;
        }

        String targetDateStr = call.getString("date");
        boolean includeIcons = call.getBoolean("includeIcons", true);
        boolean excludeSelf = call.getBoolean("excludeSelf", true);

        try {
            Context ctx = getContext();
            UsageStatsManager usageStatsManager = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usageStatsManager == null) {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                ret.put("hasData", false);
                ret.put("error", "SERVICE_UNAVAILABLE");
                ret.put("message", "UsageStatsManager service is not available on this device.");
                call.resolve(ret);
                return;
            }

            // Parse a strict local calendar date. Invalid/future dates must not be silently normalized.
            Calendar startCal = Calendar.getInstance();
            if (targetDateStr != null && !targetDateStr.trim().isEmpty()) {
                SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
                inputFormat.setLenient(false);
                inputFormat.setTimeZone(java.util.TimeZone.getDefault());
                ParsePosition parsePosition = new ParsePosition(0);
                Date parsedDate = inputFormat.parse(targetDateStr, parsePosition);
                if (targetDateStr.length() != 10 || parsedDate == null
                        || parsePosition.getIndex() != targetDateStr.length()) {
                    JSObject invalid = new JSObject();
                    invalid.put("granted", true);
                    invalid.put("hasData", false);
                    invalid.put("error", "INVALID_DATE");
                    invalid.put("message", "Date must be a valid local date in yyyy-MM-dd format.");
                    call.resolve(invalid);
                    return;
                }
                startCal.setTime(parsedDate);
            }
            startCal.set(Calendar.HOUR_OF_DAY, 0);
            startCal.set(Calendar.MINUTE, 0);
            startCal.set(Calendar.SECOND, 0);
            startCal.set(Calendar.MILLISECOND, 0);
            long startOfDay = startCal.getTimeInMillis();

            Calendar nextDayCal = (Calendar) startCal.clone();
            nextDayCal.add(Calendar.DAY_OF_YEAR, 1);
            long endOfDayExclusive = nextDayCal.getTimeInMillis();

            long now = System.currentTimeMillis();
            if (startOfDay > now) {
                JSObject invalid = new JSObject();
                invalid.put("granted", true);
                invalid.put("hasData", false);
                invalid.put("error", "FUTURE_DATE");
                invalid.put("message", "Screen time is not available for a future date.");
                call.resolve(invalid);
                return;
            }
            long effectiveEnd = Math.min(now, endOfDayExclusive);

            // Use UsageStatsManager aggregates as the canonical source for app totals. This keeps
            // the daily app list and 7-day history on the same Android reporting model.
            Map<String, AppUsageStat> appUsageMap = new HashMap<>();
            List<UsageStats> statsList = usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY, startOfDay, effectiveEnd);
            if (statsList != null) {
                for (UsageStats usage : statsList) {
                    long totalTime = Math.max(0L, usage.getTotalTimeInForeground());
                    if (totalTime <= 0L || usage.getPackageName() == null) continue;
                    AppUsageStat stat = appUsageMap.get(usage.getPackageName());
                    if (stat == null) {
                        stat = new AppUsageStat(usage.getPackageName());
                        appUsageMap.put(usage.getPackageName(), stat);
                    }
                    stat.durationMillis += totalTime;
                    // UsageStats does not expose a reliable session count. Do not invent one.
                    stat.sessionCount = -1;
                }
            }

            // Hourly breakdown is reconstructed separately from UsageEvents and is explicitly
            // marked approximate. It is never used to calculate the authoritative app totals.
            long[] hourlyBuckets = new long[24];
            boolean hourlyDataAvailable = buildApproximateHourlyBuckets(
                    usageStatsManager, startOfDay, effectiveEnd, hourlyBuckets);
            String dataSource = "usageStatsAggregate";

            // Format target date label
            SimpleDateFormat readableFmt = new SimpleDateFormat("EEEE, MMM d", Locale.US);
            Date targetDate = new Date(startOfDay);
            String formattedDate = readableFmt.format(targetDate);
            String isoDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(targetDate);

            // Filter, sort, total, then build app objects with percentages (no JSArray read-back).
            String ourPackage = ctx.getPackageName();
            PackageManager pm = ctx.getPackageManager();
            List<AppUsageStat> sortedList = new ArrayList<>(appUsageMap.values());
            Collections.sort(sortedList, (a, b) -> Long.compare(b.durationMillis, a.durationMillis));

            long totalDeviceMillis = 0;
            for (AppUsageStat item : sortedList) {
                if (item.durationMillis < 5000) continue;
                boolean isCurrentApp = item.packageName.equals(ourPackage);
                if (excludeSelf && isCurrentApp) continue;
                totalDeviceMillis += item.durationMillis;
            }

            JSArray appsArray = new JSArray();
            JSArray topAppsArray = new JSArray();
            int rank = 1;
            for (AppUsageStat item : sortedList) {
                if (item.durationMillis < 5000) continue;
                boolean isCurrentApp = item.packageName.equals(ourPackage);
                if (excludeSelf && isCurrentApp) continue;

                JSObject appObj = buildAppJson(ctx, pm, item, includeIcons, isCurrentApp, rank);
                double percentage = totalDeviceMillis > 0
                        ? item.durationMillis * 100.0 / totalDeviceMillis : 0.0;
                appObj.put("percentageOfTotal", Math.round(percentage * 10.0) / 10.0);
                appsArray.put(appObj);
                if (topAppsArray.length() < 5) topAppsArray.put(appObj);
                rank++;
            }

            // Hourly breakdown array
            JSArray hourlyArray = new JSArray();
            for (int h = 0; h < 24; h++) {
                JSObject hObj = new JSObject();
                hObj.put("hour", h);
                hObj.put("label", formatHourLabel(h));
                hObj.put("durationMinutes", Math.round(hourlyBuckets[h] / 60000.0));
                hObj.put("durationMillis", hourlyBuckets[h]);
                hourlyArray.put(hObj);
            }

            // Past 7 days summary
            JSArray past7DaysArray = getPast7DaysArray(ctx, usageStatsManager, excludeSelf);

            // Compute the 7-day average directly from Android aggregate statistics.
            // Avoid reading objects back from JSArray because Capacitor versions differ
            // in which JSArray getter methods they expose.
            long total7DaysMillis = getPast7DaysTotalMillis(ctx, usageStatsManager, excludeSelf);
            long dailyAvgMinutes = Math.round((total7DaysMillis / 7.0) / 60000.0);

            JSObject response = new JSObject();
            response.put("granted", true);
            response.put("isNativeAndroid", true);
            response.put("date", isoDate);
            response.put("formattedDate", formattedDate);
            response.put("totalMinutes", Math.round(totalDeviceMillis / 60000.0));
            response.put("totalMillis", totalDeviceMillis);
            response.put("apps", appsArray);
            response.put("topApps", topAppsArray);
            response.put("hourlyUsage", hourlyArray);
            response.put("past7Days", past7DaysArray);
            response.put("dailyAverageMinutes", dailyAvgMinutes);
            response.put("hasData", totalDeviceMillis > 0);
            response.put("lastSyncedTimestamp", now);
            response.put("dataSource", dataSource);
            response.put("hourlyDataAvailable", hourlyDataAvailable);
            response.put("hourlyUsageIsApproximate", true);
            response.put("accuracyNotice", "Per-app totals and 7-day history use Android UsageStatsManager aggregate statistics. Hourly buckets are reconstructed from UsageEvents and are approximate, especially with split-screen or overlapping activities.");
            response.put("limitationsNotice", "Android UsageStatsManager data can vary by Android version and device. Totals represent reported app foreground time, not necessarily screen-on time.");

            call.resolve(response);
        } catch (Exception e) {
            Log.e(TAG, "Error querying daily screen time usage", e);
            call.reject("Failed to query usage stats: " + e.getMessage());
        }
    }

    /**
     * Query past 7 days of daily screen time totals.
     */
    @PluginMethod
    public void getPast7DaysUsage(PluginCall call) {
        if (!isUsageAccessGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            call.resolve(ret);
            return;
        }

        try {
            boolean excludeSelf = call.getBoolean("excludeSelf", true);
            UsageStatsManager usageStatsManager = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
            if (usageStatsManager == null) {
                JSObject error = new JSObject();
                error.put("granted", true);
                error.put("hasData", false);
                error.put("error", "SERVICE_UNAVAILABLE");
                error.put("message", "UsageStatsManager service is not available on this device.");
                call.resolve(error);
                return;
            }
            JSArray days = getPast7DaysArray(getContext(), usageStatsManager, excludeSelf);

            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("days", days);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to query 7-day stats: " + e.getMessage());
        }
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private boolean isUsageAccessGranted() {
        Context ctx = getContext();
        AppOpsManager appOps = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;

        int mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                ctx.getPackageName()
        );

        if (mode == AppOpsManager.MODE_DEFAULT) {
            return ctx.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED;
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private void addSession(
            String pkg,
            long sessionStart,
            long sessionEnd,
            long dayStart,
            long dayEnd,
            Map<String, AppUsageStat> appUsageMap,
            long[] hourlyBuckets
    ) {
        if (pkg == null || sessionEnd <= sessionStart) return;

        // Clip an exclusive-end session to the requested local day [dayStart, dayEnd).
        long clampedStart = Math.max(sessionStart, dayStart);
        long clampedEnd = Math.min(sessionEnd, dayEnd);
        if (clampedEnd <= clampedStart) return;

        long duration = clampedEnd - clampedStart;
        // Guard against implausible single-session spans caused by missing Android events.
        if (duration > 16L * 60L * 60L * 1000L) return;

        AppUsageStat stat = appUsageMap.get(pkg);
        if (stat == null) {
            stat = new AppUsageStat(pkg);
            appUsageMap.put(pkg, stat);
        }
        stat.durationMillis += duration;
        stat.sessionCount += 1;

        // Distribute session duration into the 24 hourly buckets
        distributeHourly(clampedStart, clampedEnd, hourlyBuckets);
    }

    private void distributeHourly(long start, long end, long[] hourlyBuckets) {
        Calendar cal = Calendar.getInstance();
        long current = start;
        while (current < end) {
            cal.setTimeInMillis(current);
            int hour = cal.get(Calendar.HOUR_OF_DAY);
            Calendar nextHour = (Calendar) cal.clone();
            nextHour.set(Calendar.MINUTE, 0);
            nextHour.set(Calendar.SECOND, 0);
            nextHour.set(Calendar.MILLISECOND, 0);
            nextHour.add(Calendar.HOUR_OF_DAY, 1);
            long sliceEnd = Math.min(end, nextHour.getTimeInMillis());
            if (hour >= 0 && hour < 24 && sliceEnd > current) {
                hourlyBuckets[hour] += sliceEnd - current;
            }
            current = sliceEnd;
        }
    }

    /**
     * Builds an approximate hourly chart from usage events. These buckets are for visualization
     * only; per-app totals come from UsageStatsManager aggregates.
     */
    private boolean buildApproximateHourlyBuckets(UsageStatsManager mgr, long start, long end, long[] buckets) {
        if (mgr == null || end <= start) return false;
        UsageEvents events = mgr.queryEvents(start, end);
        if (events == null) return false;

        Map<String, ForegroundState> active = new HashMap<>();
        boolean sawEvents = false;
        UsageEvents.Event event = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            sawEvents = true;
            int type = event.getEventType();
            String pkg = event.getPackageName();
            long time = event.getTimeStamp();
            boolean resumed = type == UsageEvents.Event.ACTIVITY_RESUMED || type == 1;
            boolean paused = type == UsageEvents.Event.ACTIVITY_PAUSED || type == 2;
            boolean screenEnded = type == 16 || type == 17 || type == 26;

            if (resumed && pkg != null) {
                ForegroundState state = active.get(pkg);
                if (state == null) {
                    state = new ForegroundState();
                    state.startTime = time;
                    active.put(pkg, state);
                }
                state.activityCount++;
            } else if (paused && pkg != null) {
                ForegroundState state = active.get(pkg);
                if (state != null) {
                    state.activityCount = Math.max(0, state.activityCount - 1);
                    if (state.activityCount == 0) {
                        addDurationToHourlyBuckets(state.startTime, time, start, end, buckets);
                        active.remove(pkg);
                    }
                }
            } else if (screenEnded) {
                for (ForegroundState state : active.values()) {
                    addDurationToHourlyBuckets(state.startTime, time, start, end, buckets);
                }
                active.clear();
            }
        }

        for (ForegroundState state : active.values()) {
            addDurationToHourlyBuckets(state.startTime, end, start, end, buckets);
        }
        return sawEvents;
    }

    private void addDurationToHourlyBuckets(long sessionStart, long sessionEnd, long dayStart, long dayEnd, long[] buckets) {
        if (sessionEnd <= sessionStart) return;
        long current = Math.max(sessionStart, dayStart);
        long clippedEnd = Math.min(sessionEnd, dayEnd);
        Calendar cal = Calendar.getInstance();
        while (current < clippedEnd) {
            cal.setTimeInMillis(current);
            int hour = cal.get(Calendar.HOUR_OF_DAY);
            Calendar nextHour = (Calendar) cal.clone();
            nextHour.set(Calendar.MINUTE, 0);
            nextHour.set(Calendar.SECOND, 0);
            nextHour.set(Calendar.MILLISECOND, 0);
            nextHour.add(Calendar.HOUR_OF_DAY, 1);
            long sliceEnd = Math.min(clippedEnd, nextHour.getTimeInMillis());
            if (hour >= 0 && hour < 24 && sliceEnd > current) {
                buckets[hour] += sliceEnd - current;
            }
            current = sliceEnd;
        }
    }

    private long getPast7DaysTotalMillis(Context ctx, UsageStatsManager mgr, boolean excludeSelf) {
        if (mgr == null) return 0L;

        String ourPackage = ctx.getPackageName();
        long totalMillis = 0L;
        long now = System.currentTimeMillis();

        for (int i = 6; i >= 0; i--) {
            Calendar day = Calendar.getInstance();
            day.add(Calendar.DAY_OF_YEAR, -i);
            day.set(Calendar.HOUR_OF_DAY, 0);
            day.set(Calendar.MINUTE, 0);
            day.set(Calendar.SECOND, 0);
            day.set(Calendar.MILLISECOND, 0);

            long start = day.getTimeInMillis();
            Calendar nextDay = (Calendar) day.clone();
            nextDay.add(Calendar.DAY_OF_YEAR, 1);
            long end = Math.min(now, nextDay.getTimeInMillis());
            if (end <= start) continue;

            List<UsageStats> stats = mgr.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY, start, end);
            if (stats == null) continue;

            for (UsageStats stat : stats) {
                if (stat == null || stat.getPackageName() == null) continue;
                if (excludeSelf && ourPackage.equals(stat.getPackageName())) continue;
                totalMillis += Math.max(0L, stat.getTotalTimeInForeground());
            }
        }
        return totalMillis;
    }

    private JSArray getPast7DaysArray(Context ctx, UsageStatsManager mgr, boolean excludeSelf) {
        JSArray arr = new JSArray();
        SimpleDateFormat isoFmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        SimpleDateFormat dayFmt = new SimpleDateFormat("EEE", Locale.US);

        String ourPackage = ctx.getPackageName();

        // Query last 7 days from 6 days ago up to today
        for (int i = 6; i >= 0; i--) {
            Calendar c = Calendar.getInstance();
            c.add(Calendar.DAY_OF_YEAR, -i);
            c.set(Calendar.HOUR_OF_DAY, 0);
            c.set(Calendar.MINUTE, 0);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            long start = c.getTimeInMillis();

            Calendar nextDay = (Calendar) c.clone();
            nextDay.add(Calendar.DAY_OF_YEAR, 1);
            long end = Math.min(System.currentTimeMillis(), nextDay.getTimeInMillis());

            long totalDayMillis = 0;
            List<UsageStats> list = mgr.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end);
            if (list != null) {
                for (UsageStats u : list) {
                    if (excludeSelf && u.getPackageName().equals(ourPackage)) continue;
                    totalDayMillis += Math.max(0L, u.getTotalTimeInForeground());
                }
            }

            JSObject dayObj = new JSObject();
            dayObj.put("date", isoFmt.format(new Date(start)));
            dayObj.put("dayOfWeek", dayFmt.format(new Date(start)));
            dayObj.put("isToday", i == 0);
            dayObj.put("totalMinutes", Math.round(totalDayMillis / 60000.0));
            dayObj.put("totalMillis", totalDayMillis);
            dayObj.put("dataSource", "usageStatsAggregate");
            arr.put(dayObj);
        }

        return arr;
    }

    private JSObject buildAppJson(
            Context ctx,
            PackageManager pm,
            AppUsageStat item,
            boolean includeIcons,
            boolean isCurrentApp,
            int rank
    ) {
        JSObject obj = new JSObject();
        obj.put("packageName", item.packageName);
        obj.put("rank", rank);
        obj.put("durationMillis", item.durationMillis);
        obj.put("durationMinutes", Math.round(item.durationMillis / 60000.0));
        if (item.sessionCount >= 0) {
            obj.put("sessionCount", item.sessionCount);
            obj.put("sessionCountAvailable", true);
        } else {
            obj.put("sessionCountAvailable", false);
        }
        obj.put("isCurrentApp", isCurrentApp);

        // App Name and Category
        String appName = APP_NAME_CACHE.get(item.packageName);
        String category = "General";
        boolean isSystemApp = false;

        try {
            ApplicationInfo appInfo = pm.getApplicationInfo(item.packageName, 0);
            if (appName == null) {
                CharSequence label = pm.getApplicationLabel(appInfo);
                appName = label != null ? label.toString() : item.packageName;
                APP_NAME_CACHE.put(item.packageName, appName);
            }

            isSystemApp = (appInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                category = mapCategory(appInfo.category, item.packageName, isSystemApp);
            } else {
                category = heuristicCategory(item.packageName, isSystemApp);
            }

            // Encode icon if requested
            if (includeIcons) {
                String base64Icon = ICON_CACHE.get(item.packageName);
                if (base64Icon == null) {
                    Drawable iconDrawable = pm.getApplicationIcon(appInfo);
                    base64Icon = drawableToBase64(iconDrawable);
                    if (base64Icon != null) {
                        ICON_CACHE.put(item.packageName, base64Icon);
                    }
                }
                if (base64Icon != null) {
                    obj.put("icon", base64Icon);
                }
            }
        } catch (PackageManager.NameNotFoundException e) {
            appName = formatPackageFallback(item.packageName);
            category = heuristicCategory(item.packageName, false);
        } catch (Exception e) {
            appName = formatPackageFallback(item.packageName);
        }

        obj.put("appName", appName);
        obj.put("category", category);
        obj.put("isSystemApp", isSystemApp);

        return obj;
    }

    private String mapCategory(int categoryCode, String pkg, boolean isSystem) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            switch (categoryCode) {
                case ApplicationInfo.CATEGORY_GAME:
                    return "Gaming";
                case ApplicationInfo.CATEGORY_AUDIO:
                    return "Audio & Music";
                case ApplicationInfo.CATEGORY_VIDEO:
                    return "Video & Movies";
                case ApplicationInfo.CATEGORY_IMAGE:
                    return "Photos & Art";
                case ApplicationInfo.CATEGORY_SOCIAL:
                    return "Social";
                case ApplicationInfo.CATEGORY_NEWS:
                    return "News & Reading";
                case ApplicationInfo.CATEGORY_MAPS:
                    return "Navigation";
                case ApplicationInfo.CATEGORY_PRODUCTIVITY:
                    return "Productivity";
                default:
                    return heuristicCategory(pkg, isSystem);
            }
        }
        return heuristicCategory(pkg, isSystem);
    }

    private String heuristicCategory(String pkg, boolean isSystem) {
        String lower = pkg.toLowerCase();
        if (lower.contains("whatsapp") || lower.contains("instagram") || lower.contains("twitter")
                || lower.contains("telegram") || lower.contains("facebook") || lower.contains("snapchat")
                || lower.contains("reddit") || lower.contains("tiktok") || lower.contains("discord")) {
            return "Social";
        }
        if (lower.contains("youtube") || lower.contains("netflix") || lower.contains("spotify")
                || lower.contains("hotstar") || lower.contains("primevideo") || lower.contains("music")
                || lower.contains("twitch")) {
            return "Entertainment";
        }
        if (lower.contains("chrome") || lower.contains("firefox") || lower.contains("browser")
                || lower.contains("opera") || lower.contains("brave")) {
            return "Browser";
        }
        if (lower.contains("gmail") || lower.contains("docs") || lower.contains("sheets")
                || lower.contains("slack") || lower.contains("notion") || lower.contains("keep")
                || lower.contains("calendar") || lower.contains("task") || lower.contains("office")) {
            return "Productivity";
        }
        if (lower.contains("game") || lower.contains("supercell") || lower.contains("pubg")
                || lower.contains("roblox") || lower.contains("minecraft")) {
            return "Gaming";
        }
        if (isSystem) {
            return "System";
        }
        return "Utility";
    }

    private String formatPackageFallback(String pkg) {
        if (pkg == null) return "App";
        String[] parts = pkg.split("\\.");
        if (parts.length > 0) {
            String last = parts[parts.length - 1];
            if (last.length() > 0) {
                return Character.toUpperCase(last.charAt(0)) + last.substring(1);
            }
        }
        return pkg;
    }

    private String formatHourLabel(int hour) {
        if (hour == 0) return "12 AM";
        if (hour < 12) return hour + " AM";
        if (hour == 12) return "12 PM";
        return (hour - 12) + " PM";
    }

    private String drawableToBase64(Drawable drawable) {
        Bitmap source = null;
        Bitmap scaled = null;
        boolean ownsSource = false;
        try {
            if (drawable == null) return null;

            if (drawable instanceof BitmapDrawable) {
                source = ((BitmapDrawable) drawable).getBitmap();
            } else {
                int intrinsicWidth = drawable.getIntrinsicWidth();
                int intrinsicHeight = drawable.getIntrinsicHeight();
                int width = intrinsicWidth > 0 ? Math.min(intrinsicWidth, 96) : 72;
                int height = intrinsicHeight > 0 ? Math.min(intrinsicHeight, 96) : 72;
                source = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                ownsSource = true;
                Canvas canvas = new Canvas(source);
                drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
                drawable.draw(canvas);
            }

            scaled = Bitmap.createScaledBitmap(source, 64, 64, true);
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            scaled.compress(Bitmap.CompressFormat.PNG, 100, stream);
            byte[] byteArray = stream.toByteArray();
            return "data:image/png;base64," + Base64.encodeToString(byteArray, Base64.NO_WRAP);
        } catch (Exception e) {
            Log.w(TAG, "Unable to encode app icon", e);
            return null;
        } finally {
            if (scaled != null && scaled != source && !scaled.isRecycled()) scaled.recycle();
            if (ownsSource && source != null && !source.isRecycled()) source.recycle();
        }
    }

    private static class ForegroundState {
        long startTime;
        int activityCount;
    }

    private static class AppUsageStat {
        final String packageName;
        long durationMillis = 0;
        int sessionCount = 0;

        AppUsageStat(String packageName) {
            this.packageName = packageName;
        }
    }
}
