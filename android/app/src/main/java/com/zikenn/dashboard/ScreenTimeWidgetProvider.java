package com.zikenn.dashboard;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ScreenTimeWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "ScreenTimeWidgetPrefs";
    public static final String KEY_TOTAL_MINUTES = "screentime_total_minutes";
    public static final String KEY_FORMATTED_DURATION = "screentime_formatted_duration";
    public static final String KEY_HAS_PERMISSION = "screentime_has_permission";
    public static final String KEY_HAS_DATA = "screentime_has_data";
    public static final String KEY_LAST_UPDATED = "screentime_last_updated";
    public static final String KEY_TARGET_DATE = "screentime_target_date";

    public static final String ACTION_OPEN_SCREENTIME = "com.zikenn.dashboard.ACTION_OPEN_SCREENTIME";
    public static final String ACTION_WIDGET_UPDATE = "com.zikenn.dashboard.ACTION_SCREENTIME_WIDGET_UPDATE";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        if (appWidgetIds == null) return;
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        if (context == null || appWidgetManager == null) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.screentime_widget);

        boolean hasPermission = prefs.getBoolean(KEY_HAS_PERMISSION, true);
        boolean hasData = prefs.getBoolean(KEY_HAS_DATA, false);
        String formattedDuration = prefs.getString(KEY_FORMATTED_DURATION, "0m");
        String targetDate = prefs.getString(KEY_TARGET_DATE, "");

        String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        boolean isDateCurrent = todayDate.equals(targetDate);

        if (!hasPermission) {
            // Permission needed state: Never show false zero!
            views.setViewVisibility(R.id.widget_screentime_duration, View.GONE);
            views.setViewVisibility(R.id.widget_screentime_unavailable, View.VISIBLE);
            views.setTextViewText(R.id.widget_screentime_status_title, context.getString(R.string.screentime_widget_perm_needed));
            views.setTextViewText(R.id.widget_screentime_status_desc, context.getString(R.string.screentime_widget_tap_to_setup));
        } else if (!isDateCurrent && !hasData) {
            // New day before first sync
            views.setViewVisibility(R.id.widget_screentime_duration, View.VISIBLE);
            views.setViewVisibility(R.id.widget_screentime_unavailable, View.GONE);
            views.setTextViewText(R.id.widget_screentime_duration, "0m");
        } else {
            // Normal state: display verified Screen Time duration
            views.setViewVisibility(R.id.widget_screentime_duration, View.VISIBLE);
            views.setViewVisibility(R.id.widget_screentime_unavailable, View.GONE);
            views.setTextViewText(R.id.widget_screentime_duration, formattedDuration);
        }

        // Tap widget -> open Screen Time screen in APK
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setAction(ACTION_OPEN_SCREENTIME);
        openIntent.putExtra("target_screen", "screentime");
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId * 30,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        views.setOnClickPendingIntent(R.id.widget_screentime_root, pendingIntent);

        try {
            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void updateWidgetData(Context context, long totalMinutes, String formattedDuration, boolean hasPermission, boolean hasData) {
        if (context == null) return;
        try {
            String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                    .putLong(KEY_TOTAL_MINUTES, totalMinutes)
                    .putString(KEY_FORMATTED_DURATION, formattedDuration)
                    .putBoolean(KEY_HAS_PERMISSION, hasPermission)
                    .putBoolean(KEY_HAS_DATA, hasData)
                    .putString(KEY_TARGET_DATE, todayDate)
                    .putLong(KEY_LAST_UPDATED, System.currentTimeMillis())
                    .apply();

            updateAllWidgets(context);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void updateAllWidgets(Context context) {
        if (context == null) return;
        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, ScreenTimeWidgetProvider.class);
            int[] allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            if (allWidgetIds != null && allWidgetIds.length > 0) {
                for (int widgetId : allWidgetIds) {
                    updateAppWidget(context, appWidgetManager, widgetId);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static String formatMinutesToDuration(long totalMinutes) {
        if (totalMinutes <= 0) return "0m";
        long hours = totalMinutes / 60;
        long mins = totalMinutes % 60;
        if (hours > 0) {
            return hours + "h " + (mins < 10 ? "0" + mins : mins) + "m";
        }
        return mins + "m";
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_WIDGET_UPDATE.equals(action) ||
                AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action) ||
                Intent.ACTION_DATE_CHANGED.equals(action) ||
                Intent.ACTION_TIME_CHANGED.equals(action) ||
                Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
                updateAllWidgets(context);
            }
        }
    }
}
