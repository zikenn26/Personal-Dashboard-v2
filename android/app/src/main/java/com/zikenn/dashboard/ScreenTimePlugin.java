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
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "ScreenTime")
public class ScreenTimePlugin extends Plugin {
    private static final String TAG = "ScreenTimePlugin";

    // In-memory icon and app name caches across queries
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
     * Uses ScreenTimeCalculator event-union algorithm to match Digital Wellbeing.
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

            String ourPackage = ctx.getPackageName();
            PackageManager pm = ctx.getPackageManager();

            // 1. Query Raw UsageEvents with a 24-hour pre-midnight lookback to capture sessions crossing 00:00:00
            long lookbackStart = startOfDay - (24 * 60 * 60 * 1000L);
            UsageEvents events = usageStatsManager.queryEvents(lookbackStart, effectiveEnd);

            List<ScreenTimeCalculator.RawEvent> rawEventList = new ArrayList<>();
            if (events != null) {
                UsageEvents.Event event = new UsageEvents.Event();
                while (events.hasNextEvent()) {
                    events.getNextEvent(event);
                    rawEventList.add(new ScreenTimeCalculator.RawEvent(
                            event.getPackageName(),
                            event.getTimeStamp(),
                            event.getEventType()
                    ));
                }
            }

            // Also query Android's OS-aggregated UsageStats for cross-verification & reconciliation
            Map<String, Long> osAggregatedAppTimes = new HashMap<>();
            List<UsageStats> osStatsList = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startOfDay, effectiveEnd);
            if (osStatsList != null) {
                for (UsageStats u : osStatsList) {
                    if (u == null || u.getPackageName() == null) continue;
                    String pkg = u.getPackageName();
                    if (excludeSelf && ourPackage.equals(pkg)) continue;

                    long firstTime = u.getFirstTimeStamp();
                    long lastTime = u.getLastTimeStamp();
                    if (firstTime > effectiveEnd || lastTime < startOfDay) {
                        continue;
                    }

                    long fgTime = Math.max(0L, u.getTotalTimeInForeground());
                    if (fgTime <= 0) continue;

                    Long existing = osAggregatedAppTimes.get(pkg);
                    if (existing == null || fgTime > existing) {
                        osAggregatedAppTimes.put(pkg, fgTime);
                    }
                }
            }

            ScreenTimeCalculator.DailyResult calcResult;
            String calculationMode;
            long originalEventTotal = 0L;
            long maxSingleApp = 0L;
            int reconciledCount = 0;

            if (!rawEventList.isEmpty()) {
                // Primary method: Reconstruct non-overlapping intervals via ScreenTimeCalculator
                calcResult = ScreenTimeCalculator.calculateDailyScreenTime(
                        rawEventList,
                        startOfDay,
                        effectiveEnd,
                        excludeSelf ? ourPackage : null
                );
                originalEventTotal = calcResult.totalDeviceMillis;
                calculationMode = "usageEventsUnion";

                // Reconcile with OS-level UsageStats to ensure no app's foreground time is undercounted
                // (e.g. if OEM drops events or circular event buffer evicted older sessions)
                for (Map.Entry<String, Long> osEntry : osAggregatedAppTimes.entrySet()) {
                    String pkg = osEntry.getKey();
                    long osDuration = osEntry.getValue();
                    if (osDuration > maxSingleApp) {
                        maxSingleApp = osDuration;
                    }

                    ScreenTimeCalculator.AppCalculation appCalc = calcResult.appUsage.get(pkg);
                    if (appCalc == null) {
                        if (osDuration >= 1000L) {
                            appCalc = new ScreenTimeCalculator.AppCalculation(pkg);
                            appCalc.durationMillis = osDuration;
                            appCalc.sessionCount = 1;
                            calcResult.appUsage.put(pkg, appCalc);
                            reconciledCount++;
                        }
                    } else if (osDuration > appCalc.durationMillis) {
                        appCalc.durationMillis = osDuration;
                        reconciledCount++;
                    }
                }

                for (ScreenTimeCalculator.AppCalculation app : calcResult.appUsage.values()) {
                    if (app.durationMillis > maxSingleApp) {
                        maxSingleApp = app.durationMillis;
                    }
                }

                // Total screen time cannot be less than the highest individual app's foreground time
                // and cannot exceed wall-clock elapsed time
                long wallClockElapsed = Math.max(0L, effectiveEnd - startOfDay);
                calcResult.totalDeviceMillis = Math.min(Math.max(calcResult.totalDeviceMillis, maxSingleApp), wallClockElapsed);

                if (reconciledCount > 0) {
                    calculationMode = "hybridReconciled";
                }
            } else {
                // Secondary fallback if UsageEvents is blocked by an OEM ROM
                calcResult = executeAggregateFallback(usageStatsManager, startOfDay, effectiveEnd, excludeSelf ? ourPackage : null);
                calculationMode = "usageStatsFallback";
            }

            // 2. Format target date labels
            SimpleDateFormat readableFmt = new SimpleDateFormat("EEEE, MMM d", Locale.US);
            Date targetDate = new Date(startOfDay);
            String formattedDate = readableFmt.format(targetDate);
            String isoDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(targetDate);

            // 3. Build Apps list sorted by duration descending
            List<ScreenTimeCalculator.AppCalculation> sortedApps = new ArrayList<>(calcResult.appUsage.values());
            Collections.sort(sortedApps, new Comparator<ScreenTimeCalculator.AppCalculation>() {
                @Override
                public int compare(ScreenTimeCalculator.AppCalculation a, ScreenTimeCalculator.AppCalculation b) {
                    return Long.compare(b.durationMillis, a.durationMillis);
                }
            });

            long totalDeviceMillis = calcResult.totalDeviceMillis;

            JSArray appsArray = new JSArray();
            JSArray topAppsArray = new JSArray();
            int rank = 1;

            for (ScreenTimeCalculator.AppCalculation appStat : sortedApps) {
                // Filter out sub-5-second blips
                if (appStat.durationMillis < 5000L) continue;

                boolean isCurrentApp = appStat.packageName.equals(ourPackage);
                if (excludeSelf && isCurrentApp) continue;

                JSObject appObj = buildAppJson(ctx, pm, appStat, includeIcons, isCurrentApp, rank, totalDeviceMillis);
                appsArray.put(appObj);

                if (topAppsArray.length() < 5) {
                    topAppsArray.put(appObj);
                }
                rank++;
            }

            // 4. Build 24 Hourly Buckets, scaled to match totalDeviceMillis if reconciled
            long sumHourly = 0L;
            for (int h = 0; h < 24; h++) {
                sumHourly += calcResult.hourlyBuckets[h];
            }
            if (sumHourly > 0 && totalDeviceMillis > sumHourly) {
                double scaleFactor = (double) totalDeviceMillis / (double) sumHourly;
                for (int h = 0; h < 24; h++) {
                    calcResult.hourlyBuckets[h] = Math.round(calcResult.hourlyBuckets[h] * scaleFactor);
                }
            }

            JSArray hourlyArray = new JSArray();
            for (int h = 0; h < 24; h++) {
                JSObject hObj = new JSObject();
                hObj.put("hour", h);
                hObj.put("label", formatHourLabel(h));
                hObj.put("durationMinutes", Math.round(calcResult.hourlyBuckets[h] / 60000.0));
                hObj.put("durationMillis", calcResult.hourlyBuckets[h]);
                hourlyArray.put(hObj);
            }

            // 5. Past 7 days summary using the same unified calculation
            JSArray past7DaysArray = getPast7DaysArray(ctx, usageStatsManager, excludeSelf);

            // Compute 7-day average from past 7 days
            long total7DaysMillis = 0L;
            for (int i = 0; i < past7DaysArray.length(); i++) {
                total7DaysMillis += past7DaysArray.getJSONObject(i).getLong("totalMillis");
            }
            long dailyAvgMinutes = Math.round((total7DaysMillis / 7.0) / 60000.0);

            // 6. Build Diagnostic Payload for auditability & verification
            JSObject diagnostics = new JSObject();
            diagnostics.put("calculationMode", calculationMode);
            diagnostics.put("rawEventsCount", calcResult.rawEventsCount);
            diagnostics.put("duplicatesDiscarded", calcResult.duplicatesDiscarded);
            diagnostics.put("openSessionsCapped", calcResult.openSessionsCapped);
            diagnostics.put("reconstructedSessionsCount", calcResult.allSessions.size());
            diagnostics.put("mergedIntervalsCount", calcResult.mergedDeviceIntervals.size());
            diagnostics.put("dayStartMillis", startOfDay);
            diagnostics.put("effectiveEndMillis", effectiveEnd);
            diagnostics.put("wallClockElapsedMillis", effectiveEnd - startOfDay);
            diagnostics.put("reconciledAppsCount", reconciledCount);
            diagnostics.put("eventReconstructedTotalMillis", originalEventTotal);
            diagnostics.put("aggregateUsageStatsMaxSingleApp", maxSingleApp);

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
            response.put("dataSource", calculationMode);
            response.put("hourlyDataAvailable", true);
            response.put("diagnostics", diagnostics);
            response.put("accuracyNotice", "Device screen time is calculated as the non-overlapping mathematical union of foreground sessions on an active screen, matching Android Digital Wellbeing.");
            response.put("limitationsNotice", "Native statistics gathered via Android UsageStatsManager. Calculations reflect active foreground time on interactive screen.");

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

    /**
     * Fallback for devices where UsageEvents is disabled by OEM ROM.
     * Deduplicates multiple daily buckets for each package using Math.max()
     * and strictly caps total device time to wall-clock elapsed time.
     */
    private ScreenTimeCalculator.DailyResult executeAggregateFallback(
            UsageStatsManager mgr,
            long startOfDay,
            long effectiveEnd,
            String excludedPackage
    ) {
        ScreenTimeCalculator.DailyResult result = new ScreenTimeCalculator.DailyResult();
        List<UsageStats> statsList = mgr.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startOfDay, effectiveEnd);
        if (statsList == null) return result;

        Map<String, Long> deduped = new HashMap<>();
        for (UsageStats u : statsList) {
            if (u == null || u.getPackageName() == null) continue;
            String pkg = u.getPackageName();
            if (excludedPackage != null && excludedPackage.equals(pkg)) continue;

            long time = Math.max(0L, u.getTotalTimeInForeground());
            Long existing = deduped.get(pkg);
            if (existing == null || time > existing) {
                deduped.put(pkg, time);
            }
        }

        long sumTime = 0L;
        for (Map.Entry<String, Long> entry : deduped.entrySet()) {
            if (entry.getValue() < 5000L) continue;
            ScreenTimeCalculator.AppCalculation app = new ScreenTimeCalculator.AppCalculation(entry.getKey());
            app.durationMillis = entry.getValue();
            app.sessionCount = 1;
            result.appUsage.put(entry.getKey(), app);
            sumTime += entry.getValue();
        }

        // Bounded by wall-clock time today to prevent impossible durations
        long maxPossible = Math.max(0L, effectiveEnd - startOfDay);
        result.totalDeviceMillis = Math.min(sumTime, maxPossible);

        return result;
    }

    /**
     * Reconstruct past 7 days using the same unified ScreenTimeCalculator logic.
     */
    private JSArray getPast7DaysArray(Context ctx, UsageStatsManager mgr, boolean excludeSelf) {
        JSArray arr = new JSArray();
        SimpleDateFormat isoFmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        SimpleDateFormat dayFmt = new SimpleDateFormat("EEE", Locale.US);

        String ourPackage = ctx.getPackageName();
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

            long lookback = start - (24 * 60 * 60 * 1000L);
            UsageEvents events = mgr.queryEvents(lookback, end);

            List<ScreenTimeCalculator.RawEvent> eventList = new ArrayList<>();
            if (events != null) {
                UsageEvents.Event event = new UsageEvents.Event();
                while (events.hasNextEvent()) {
                    events.getNextEvent(event);
                    eventList.add(new ScreenTimeCalculator.RawEvent(
                            event.getPackageName(),
                            event.getTimeStamp(),
                            event.getEventType()
                    ));
                }
            }

            long totalDayMillis = 0L;
            if (!eventList.isEmpty()) {
                ScreenTimeCalculator.DailyResult res = ScreenTimeCalculator.calculateDailyScreenTime(
                        eventList,
                        start,
                        end,
                        excludeSelf ? ourPackage : null
                );
                // Also reconcile with OS UsageStats
                long maxSingle = 0L;
                List<UsageStats> dayStats = mgr.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end);
                if (dayStats != null) {
                    for (UsageStats u : dayStats) {
                        if (u == null || u.getPackageName() == null) continue;
                        if (excludeSelf && ourPackage.equals(u.getPackageName())) continue;
                        if (u.getFirstTimeStamp() <= end && u.getLastTimeStamp() >= start) {
                            maxSingle = Math.max(maxSingle, u.getTotalTimeInForeground());
                        }
                    }
                }
                long wallClock = Math.max(0L, end - start);
                totalDayMillis = Math.min(Math.max(res.totalDeviceMillis, maxSingle), wallClock);
            } else {
                ScreenTimeCalculator.DailyResult res = executeAggregateFallback(
                        mgr, start, end, excludeSelf ? ourPackage : null);
                totalDayMillis = res.totalDeviceMillis;
            }

            JSObject dayObj = new JSObject();
            dayObj.put("date", isoFmt.format(new Date(start)));
            dayObj.put("dayOfWeek", dayFmt.format(new Date(start)));
            dayObj.put("isToday", i == 0);
            dayObj.put("totalMinutes", Math.round(totalDayMillis / 60000.0));
            dayObj.put("totalMillis", totalDayMillis);
            dayObj.put("dataSource", "usageEventsUnion");
            arr.put(dayObj);
        }

        return arr;
    }

    private JSObject buildAppJson(
            Context ctx,
            PackageManager pm,
            ScreenTimeCalculator.AppCalculation item,
            boolean includeIcons,
            boolean isCurrentApp,
            int rank,
            long totalDeviceMillis
    ) {
        JSObject obj = new JSObject();
        obj.put("packageName", item.packageName);
        obj.put("rank", rank);
        obj.put("durationMillis", item.durationMillis);
        obj.put("durationMinutes", Math.round(item.durationMillis / 60000.0));
        obj.put("sessionCount", item.sessionCount);
        obj.put("sessionCountAvailable", true);
        obj.put("isCurrentApp", isCurrentApp);

        double pct = totalDeviceMillis > 0 ? (item.durationMillis * 100.0 / totalDeviceMillis) : 0.0;
        obj.put("percentageOfTotal", Math.round(pct * 10.0) / 10.0);

        // App Name and Category
        String appName = APP_NAME_CACHE.get(item.packageName);
        String category = "General";
        boolean isSystemApp = false;

        try {
            ApplicationInfo appInfo = pm.getApplicationInfo(item.packageName, 0);
            CharSequence label = pm.getApplicationLabel(appInfo);

            if (appName == null) {
                appName = ScreenTimeCalculator.resolveCleanAppName(item.packageName, label);
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
            // App was uninstalled earlier today or visibility restricted; resolve via clean dictionary/heuristics
            if (appName == null) {
                appName = ScreenTimeCalculator.resolveCleanAppName(item.packageName, null);
                APP_NAME_CACHE.put(item.packageName, appName);
            }
            category = heuristicCategory(item.packageName, false);
        } catch (Exception e) {
            if (appName == null) {
                appName = ScreenTimeCalculator.resolveCleanAppName(item.packageName, null);
                APP_NAME_CACHE.put(item.packageName, appName);
            }
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
        String lower = pkg.toLowerCase(Locale.US);
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
}
