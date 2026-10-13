package com.zikenn.dashboard;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SpendingWidget")
public class SpendingWidgetPlugin extends Plugin {

    private static SpendingWidgetPlugin instance;
    private static boolean pendingOpenSpending = false;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void setPendingWidgetOpen() {
        pendingOpenSpending = true;
        if (instance != null) {
            instance.emitWidgetOpenEvent();
        }
    }

    private void emitWidgetOpenEvent() {
        JSObject ret = new JSObject();
        ret.put("openSpending", true);
        notifyListeners("widgetOpenSpending", ret);
    }

    @PluginMethod
    public void syncSpendingData(PluginCall call) {
        Context context = getContext();
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences(
                    SpendingWidgetProvider.PREFS_NAME,
                    Context.MODE_PRIVATE
            );

            SharedPreferences.Editor editor = prefs.edit();

            Double todayValue = call.getDouble("todayTotal");
            double todayTotal = todayValue != null ? todayValue : 0.0;
            editor.putFloat(SpendingWidgetProvider.KEY_TODAY_TOTAL, (float) todayTotal);
            editor.putString(SpendingWidgetProvider.KEY_TODAY_AMOUNT_FORMATTED, call.getString("formattedTodayTotal", "₹0"));
            editor.putString(SpendingWidgetProvider.KEY_TODAY_TREND_TEXT, call.getString("todayTrendText", ""));
            editor.putString(SpendingWidgetProvider.KEY_TODAY_TREND_COLOR, call.getString("todayTrendColor", "neutral"));
            editor.putBoolean(SpendingWidgetProvider.KEY_TODAY_TREND_VISIBLE, Boolean.TRUE.equals(call.getBoolean("todayTrendVisible", false)));

            Double weekValue = call.getDouble("weekTotal");
            double weekTotal = weekValue != null ? weekValue : 0.0;
            editor.putFloat(SpendingWidgetProvider.KEY_WEEK_TOTAL, (float) weekTotal);
            editor.putString(SpendingWidgetProvider.KEY_WEEK_AMOUNT_FORMATTED, call.getString("formattedWeekTotal", "₹0"));
            editor.putString(SpendingWidgetProvider.KEY_WEEK_TREND_TEXT, call.getString("weekTrendText", ""));
            editor.putString(SpendingWidgetProvider.KEY_WEEK_TREND_COLOR, call.getString("weekTrendColor", "neutral"));
            editor.putBoolean(SpendingWidgetProvider.KEY_WEEK_TREND_VISIBLE, Boolean.TRUE.equals(call.getBoolean("weekTrendVisible", false)));

            editor.putLong(SpendingWidgetProvider.KEY_LAST_UPDATED, System.currentTimeMillis());
            editor.apply();

            // Refresh all widget instances on the user's home screen
            SpendingWidgetProvider.updateAllWidgets(context);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkLaunchIntent(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("openSpending", pendingOpenSpending);
        pendingOpenSpending = false;
        call.resolve(ret);
    }
}
