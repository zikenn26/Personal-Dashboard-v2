package com.zikenn.dashboard;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "SmsTransaction",
    permissions = {
        @Permission(
            alias = "sms",
            strings = {
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS
            }
        )
    }
)
public class SmsTransactionPlugin extends Plugin {
    private static final String TAG = "SmsTransactionPlugin";
    private static SmsTransactionPlugin instance;

    public static final String PREFS_NAME = "ZikennSmsPrefs";
    public static final String KEY_SMS_AUTO_ENABLED = "sms_auto_logging_enabled";
    public static final String KEY_PENDING_SMS = "pending_sms_transactions";

    @Override
    public void load() {
        super.load();
        instance = this;
        Log.d(TAG, "SmsTransactionPlugin loaded successfully");
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        ret.put("platform", "android");
        call.resolve(ret);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context context = getContext();
        boolean hasReceive = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasRead = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("sms", (hasReceive && hasRead) ? "granted" : "prompt");
        ret.put("receiveSms", hasReceive ? "granted" : "prompt");
        ret.put("readSms", hasRead ? "granted" : "prompt");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        requestPermissionForAlias("sms", call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        this.checkPermissions(call);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_SMS_AUTO_ENABLED, enabled).apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean(KEY_SMS_AUTO_ENABLED, false);

        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void getPendingSms(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String pendingRaw = prefs.getString(KEY_PENDING_SMS, "[]");

        JSArray messages = new JSArray();
        try {
            JSONArray arr = new JSONArray(pendingRaw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                JSObject js = new JSObject();
                js.put("sender", obj.optString("sender"));
                js.put("body", obj.optString("body"));
                js.put("timestamp", obj.optLong("timestamp"));
                messages.put(js);
            }
            // Clear pending after retrieval to prevent repeated reads
            prefs.edit().putString(KEY_PENDING_SMS, "[]").apply();
        } catch (Exception e) {
            Log.e(TAG, "Error parsing pending SMS", e);
        }

        JSObject ret = new JSObject();
        ret.put("messages", messages);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingSms(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_PENDING_SMS, "[]").apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void readRecentSms(PluginCall call) {
        Context context = getContext();
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            call.reject("READ_SMS permission is not granted");
            return;
        }

        int limit = call.getInt("limit", 50);
        JSArray results = new JSArray();

        try {
            ContentResolver cr = context.getContentResolver();
            Uri inboxUri = Uri.parse("content://sms/inbox");
            String[] projection = new String[] { "_id", "address", "body", "date" };
            Cursor cursor = cr.query(inboxUri, projection, null, null, "date DESC LIMIT " + limit);

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String address = cursor.getString(cursor.getColumnIndexOrThrow("address"));
                    String body = cursor.getString(cursor.getColumnIndexOrThrow("body"));
                    long date = cursor.getLong(cursor.getColumnIndexOrThrow("date"));

                    if (SmsReceiver.isLikelyFinancialTransaction(address, body)) {
                        JSObject item = new JSObject();
                        item.put("sender", address);
                        item.put("body", body);
                        item.put("timestamp", date);
                        results.put(item);
                    }
                }
                cursor.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying SMS inbox", e);
            call.reject("Failed to query SMS inbox: " + e.getMessage());
            return;
        }

        JSObject ret = new JSObject();
        ret.put("messages", results);
        call.resolve(ret);
    }

    /**
     * Called by SmsReceiver when a new incoming transaction SMS is intercepted.
     */
    public static void handleIncomingSms(Context context, String sender, String body, long timestamp) {
        try {
            JSObject data = new JSObject();
            data.put("sender", sender);
            data.put("body", body);
            data.put("timestamp", timestamp);

            // 1. If plugin instance is active and web view is listening, notify immediately
            if (instance != null) {
                instance.notifyListeners("onSmsReceived", data);
            }

            // 2. Also persist in pending queue so background arrivals are guaranteed processed
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String current = prefs.getString(KEY_PENDING_SMS, "[]");
            JSONArray arr;
            try {
                arr = new JSONArray(current);
            } catch (Exception e) {
                arr = new JSONArray();
            }

            JSONObject newObj = new JSONObject();
            newObj.put("sender", sender);
            newObj.put("body", body);
            newObj.put("timestamp", timestamp);
            arr.put(newObj);

            // Cap the pending queue size to last 50 items
            if (arr.length() > 50) {
                JSONArray trimmed = new JSONArray();
                for (int i = arr.length() - 50; i < arr.length(); i++) {
                    trimmed.put(arr.get(i));
                }
                arr = trimmed;
            }

            prefs.edit().putString(KEY_PENDING_SMS, arr.toString()).apply();
            Log.d(TAG, "Successfully queued incoming transaction SMS from: " + sender);
        } catch (Exception e) {
            Log.e(TAG, "Failed to handle incoming SMS", e);
        }
    }
}
