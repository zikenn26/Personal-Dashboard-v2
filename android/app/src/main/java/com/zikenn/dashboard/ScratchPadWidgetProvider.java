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

public class ScratchPadWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "ScratchPadWidgetPrefs";
    public static final String KEY_CONTENT = "scratchpad_content";
    public static final String KEY_TIMESTAMP = "scratchpad_timestamp";
    public static final String ACTION_OPEN_SCRATCHPAD = "com.zikenn.dashboard.ACTION_OPEN_SCRATCHPAD";
    public static final String ACTION_WIDGET_UPDATE = "com.zikenn.dashboard.ACTION_SCRATCHPAD_WIDGET_UPDATE";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        if (appWidgetIds == null) return;
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String rawContent = prefs.getString(KEY_CONTENT, "");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.scratchpad_widget);

        String trimmed = rawContent != null ? rawContent.trim() : "";
        if (trimmed.isEmpty()) {
            views.setViewVisibility(R.id.widget_content, View.GONE);
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_content, View.VISIBLE);
            views.setViewVisibility(R.id.widget_empty, View.GONE);
            views.setTextViewText(R.id.widget_content, trimmed);
        }

        // Tap entire widget -> open app directly to Scratch Pad
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setAction(ACTION_OPEN_SCRATCHPAD);
        openAppIntent.putExtra("target_screen", "scratchpad");
        openAppIntent.putExtra("auto_add", false);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent rootPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId * 10,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, rootPendingIntent);

        // Tap "+" button -> open app and trigger new note / bullet
        Intent addNoteIntent = new Intent(context, MainActivity.class);
        addNoteIntent.setAction(ACTION_OPEN_SCRATCHPAD);
        addNoteIntent.putExtra("target_screen", "scratchpad");
        addNoteIntent.putExtra("auto_add", true);
        addNoteIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent addPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId * 10 + 1,
                addNoteIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_add, addPendingIntent);

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
            ComponentName thisWidget = new ComponentName(context, ScratchPadWidgetProvider.class);
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
            if (ACTION_WIDGET_UPDATE.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
                updateAllWidgets(context);
            }
        }
    }
}
