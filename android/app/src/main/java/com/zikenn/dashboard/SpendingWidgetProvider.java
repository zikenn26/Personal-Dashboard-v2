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

public class SpendingWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "SpendingWidgetPrefs";
    public static final String KEY_TODAY_TOTAL = "spending_today_total";
    public static final String KEY_TODAY_AMOUNT_FORMATTED = "spending_today_amount_formatted";
    public static final String KEY_TODAY_TREND_TEXT = "spending_today_trend_text";
    public static final String KEY_TODAY_TREND_COLOR = "spending_today_trend_color"; // "green", "red", "neutral"
    public static final String KEY_TODAY_TREND_VISIBLE = "spending_today_trend_visible";

    public static final String KEY_WEEK_TOTAL = "spending_week_total";
    public static final String KEY_WEEK_AMOUNT_FORMATTED = "spending_week_amount_formatted";
    public static final String KEY_WEEK_TREND_TEXT = "spending_week_trend_text";
    public static final String KEY_WEEK_TREND_COLOR = "spending_week_trend_color";
    public static final String KEY_WEEK_TREND_VISIBLE = "spending_week_trend_visible";

    public static final String KEY_LAST_UPDATED = "spending_last_updated";
    public static final String ACTION_OPEN_SPENDING = "com.zikenn.dashboard.ACTION_OPEN_SPENDING";
    public static final String ACTION_WIDGET_UPDATE = "com.zikenn.dashboard.ACTION_SPENDING_WIDGET_UPDATE";

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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.spending_widget);

        // 1. Populate Today's spending
        String todayFormatted = prefs.getString(KEY_TODAY_AMOUNT_FORMATTED, "₹0");
        views.setTextViewText(R.id.widget_today_amount, todayFormatted);

        boolean todayTrendVisible = prefs.getBoolean(KEY_TODAY_TREND_VISIBLE, false);
        if (todayTrendVisible) {
            String todayTrend = prefs.getString(KEY_TODAY_TREND_TEXT, "");
            String todayColor = prefs.getString(KEY_TODAY_TREND_COLOR, "neutral");
            views.setTextViewText(R.id.widget_today_trend, todayTrend);
            int colorVal = "red".equalsIgnoreCase(todayColor) ? 0xFFF87171 :
                           "green".equalsIgnoreCase(todayColor) ? 0xFF34D399 : 0xFF94A3B8;
            views.setTextColor(R.id.widget_today_trend, colorVal);
            views.setViewVisibility(R.id.widget_today_trend, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_today_trend, View.GONE);
        }

        // 2. Populate This Week's spending
        String weekFormatted = prefs.getString(KEY_WEEK_AMOUNT_FORMATTED, "₹0");
        views.setTextViewText(R.id.widget_week_amount, weekFormatted);

        boolean weekTrendVisible = prefs.getBoolean(KEY_WEEK_TREND_VISIBLE, false);
        if (weekTrendVisible) {
            String weekTrend = prefs.getString(KEY_WEEK_TREND_TEXT, "");
            String weekColor = prefs.getString(KEY_WEEK_TREND_COLOR, "neutral");
            views.setTextViewText(R.id.widget_week_trend, weekTrend);
            int colorVal = "red".equalsIgnoreCase(weekColor) ? 0xFFF87171 :
                           "green".equalsIgnoreCase(weekColor) ? 0xFF34D399 : 0xFF94A3B8;
            views.setTextColor(R.id.widget_week_trend, colorVal);
            views.setViewVisibility(R.id.widget_week_trend, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_week_trend, View.GONE);
        }

        // 3. Tapping either section or root opens the Spending (Money) page in the APK
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setAction(ACTION_OPEN_SPENDING);
        openAppIntent.putExtra("target_screen", "spending");
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent clickPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId * 20,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        views.setOnClickPendingIntent(R.id.widget_spending_root, clickPendingIntent);
        views.setOnClickPendingIntent(R.id.widget_section_today, clickPendingIntent);
        views.setOnClickPendingIntent(R.id.widget_section_week, clickPendingIntent);

        try {
            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void updateAllWidgets(Context context) {
        if (context == null) return;
        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, SpendingWidgetProvider.class);
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
