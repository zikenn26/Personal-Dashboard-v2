package com.zikenn.dashboard;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScratchPadWidget")
public class ScratchPadWidgetPlugin extends Plugin {

    private static ScratchPadWidgetPlugin instance;
    private static boolean pendingOpenScratchpad = false;
    private static boolean pendingAutoAdd = false;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void setPendingWidgetOpen(boolean autoAdd) {
        pendingOpenScratchpad = true;
        pendingAutoAdd = autoAdd;
        if (instance != null) {
            instance.emitWidgetOpenEvent(autoAdd);
        }
    }

    private void emitWidgetOpenEvent(boolean autoAdd) {
        JSObject ret = new JSObject();
        ret.put("openScratchpad", true);
        ret.put("autoAdd", autoAdd);
        notifyListeners("widgetOpenScratchpad", ret);
    }

    @PluginMethod
    public void syncScratchpad(PluginCall call) {
        String content = call.getString("content", "");
        Context context = getContext();

        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences(
                    ScratchPadWidgetProvider.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            prefs.edit()
                    .putString(ScratchPadWidgetProvider.KEY_CONTENT, content)
                    .putLong(ScratchPadWidgetProvider.KEY_TIMESTAMP, System.currentTimeMillis())
                    .apply();

            // Notify all home screen widgets immediately
            ScratchPadWidgetProvider.updateAllWidgets(context);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getScratchpad(PluginCall call) {
        Context context = getContext();
        String content = "";
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences(
                    ScratchPadWidgetProvider.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            content = prefs.getString(ScratchPadWidgetProvider.KEY_CONTENT, "");
        }
        JSObject ret = new JSObject();
        ret.put("content", content);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkLaunchIntent(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("openScratchpad", pendingOpenScratchpad);
        ret.put("autoAdd", pendingAutoAdd);

        // Reset once consumed so the app doesn't repeatedly jump to scratchpad on tab switches
        pendingOpenScratchpad = false;
        pendingAutoAdd = false;

        call.resolve(ret);
    }
}
