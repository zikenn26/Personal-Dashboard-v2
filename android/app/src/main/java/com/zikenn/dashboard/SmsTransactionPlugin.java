package com.zikenn.dashboard;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
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
        Log.i(TAG, "SmsTransactionPlugin loaded successfully");
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void logDiagnostic(PluginCall call) {
        String tag = call.getString("tag", "LifeOS_SMS");
        String level = call.getString("level", "info");
        String message = call.getString("message", "");

        switch (level != null ? level.toLowerCase() : "info") {
            case "error":
                Log.e(tag, message);
                break;
            case "warn":
                Log.w(tag, message);
                break;
            case "debug":
                Log.d(tag, message);
                break;
            case "info":
            default:
                Log.i(tag, message);
                break;
        }
        call.resolve();
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

        // On Android, RECEIVE_SMS or READ_SMS grant permission for transaction scanning/logging
        String status = (hasReceive || hasRead) ? "granted" : "prompt";
        JSObject ret = new JSObject();
        ret.put("sms", status);
        ret.put("receiveSms", hasReceive ? "granted" : "prompt");
        ret.put("readSms", hasRead ? "granted" : "prompt");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        requestPermissionForAlias("sms", call, "smsPermissionCallback");
    }

    @PermissionCallback
    public void smsPermissionCallback(PluginCall call) {
        Context context = getContext();
        boolean hasReceive = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasRead = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;

        if (hasReceive || hasRead) {
            // Automatically ensure tracking is enabled in SharedPreferences when permission is granted
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_SMS_AUTO_ENABLED, true).apply();
            Log.d(TAG, "SMS permissions granted; enabled KEY_SMS_AUTO_ENABLED");
        }

        String status = (hasReceive || hasRead) ? "granted" : "denied";
        JSObject ret = new JSObject();
        ret.put("sms", status);
        ret.put("receiveSms", hasReceive ? "granted" : "denied");
        ret.put("readSms", hasRead ? "granted" : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to open app settings", e);
            call.reject("Could not open settings: " + e.getMessage());
        }
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
            Log.w(TAG, "readRecentSms: READ_SMS permission is not granted");
            call.reject("READ_SMS permission is not granted");
            return;
        }

        int limit = call.getInt("limit", 50);
        JSArray results = new JSArray();

        try {
            ContentResolver cr = context.getContentResolver();
            Uri inboxUri = Uri.parse("content://sms/inbox");
            String[] projection = new String[] { "_id", "address", "body", "date" };
            
            Cursor cursor = null;
            try {
                // 1. Primary Query: content://sms/inbox newest to oldest
                cursor = cr.query(inboxUri, projection, null, null, "date DESC");
            } catch (Exception e1) {
                Log.w(TAG, "cr.query content://sms/inbox with projection failed: " + e1.getMessage());
            }

            // Fallback 1: content://sms/inbox without projection
            if (cursor == null) {
                try {
                    cursor = cr.query(inboxUri, null, null, null, "date DESC");
                } catch (Exception e2) {
                    Log.w(TAG, "cr.query content://sms/inbox fallback failed: " + e2.getMessage());
                }
            }

            // Fallback 2: Universal content://sms with type = 1 (Inbox)
            if (cursor == null || cursor.getCount() == 0) {
                if (cursor != null) cursor.close();
                try {
                    Uri genericUri = Uri.parse("content://sms");
                    cursor = cr.query(genericUri, projection, "type = 1", null, "date DESC");
                } catch (Exception e3) {
                    Log.w(TAG, "cr.query content://sms fallback with projection failed: " + e3.getMessage());
                    try {
                        Uri genericUri = Uri.parse("content://sms");
                        cursor = cr.query(genericUri, null, "type = 1", null, "date DESC");
                    } catch (Exception e4) {
                        Log.e(TAG, "cr.query content://sms fallback failed: " + e4.getMessage());
                    }
                }
            }

            if (cursor != null) {
                int scanned = 0;
                int maxScan = Math.max(limit * 20, 1000);
                while (cursor.moveToNext() && scanned < maxScan && results.length() < (limit * 2)) {
                    scanned++;
                    int addressIdx = cursor.getColumnIndex("address");
                    int bodyIdx = cursor.getColumnIndex("body");
                    int dateIdx = cursor.getColumnIndex("date");

                    String address = addressIdx >= 0 ? cursor.getString(addressIdx) : "";
                    String body = bodyIdx >= 0 ? cursor.getString(bodyIdx) : "";
                    long date = dateIdx >= 0 ? cursor.getLong(dateIdx) : System.currentTimeMillis();

                    if (body == null || body.trim().isEmpty()) {
                        continue;
                    }

                    String lower = body.toLowerCase();

                    // Reject pure authentication OTPs and marketing promos
                    if (lower.contains("otp") && (
                        lower.contains("do not share") || 
                        lower.contains("valid for") || 
                        lower.contains("secret code") || 
                        lower.contains("one time password") ||
                        lower.contains("verification code"))) {
                        continue;
                    }
                    if (lower.contains("pre-approved loan") || 
                        lower.contains("apply for instant loan") || 
                        lower.contains("recharge offer") || 
                        lower.contains("recharge now")) {
                        continue;
                    }

                    // Inclusive candidate detection: bank sender OR transaction keywords
                    boolean isBankSender = SmsReceiver.isTraiServiceSender(address);
                    boolean isFinancial = SmsReceiver.isLikelyFinancialTransaction(address, body);
                    boolean hasFinancialKeywords = 
                        lower.contains("debited") || 
                        lower.contains("credited") || 
                        lower.contains("paid") || 
                        lower.contains("spent") || 
                        lower.contains("transferred") || 
                        lower.contains("withdrawn") || 
                        lower.contains("upi") || 
                        lower.contains("utr") || 
                        lower.contains("rrn") || 
                        lower.contains("imps") || 
                        lower.contains("neft") || 
                        lower.contains("rtgs") || 
                        lower.contains("ref no") || 
                        lower.contains("transaction id") || 
                        lower.contains("a/c") || 
                        lower.contains("acct") || 
                        lower.contains("rs.") || 
                        lower.contains("inr");

                    if (isBankSender || isFinancial || hasFinancialKeywords) {
                        JSObject item = new JSObject();
                        item.put("sender", address != null ? address : "");
                        item.put("body", body);
                        item.put("timestamp", date);
                        results.put(item);
                    }
                }
                cursor.close();
            }
            Log.i(TAG, "readRecentSms: Retrieved " + results.length() + " candidate SMS records for limit=" + limit);
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
            if (!SmsReceiver.isLikelyFinancialTransaction(sender, body) && !SmsReceiver.isEligibleBankSender(sender, body)) {
                Log.i(TAG, "[PLUGIN_SMS] Dropped non-financial SMS from: " + sender);
                return;
            }

            JSObject data = new JSObject();
            data.put("sender", sender);
            data.put("body", body);
            data.put("timestamp", timestamp);

            // 1. If plugin instance is active and web view is listening, notify immediately
            if (instance != null) {
                instance.notifyListeners("onSmsReceived", data);
            }

            // 2. Persist in pending queue so background arrivals are guaranteed processed
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String current = prefs.getString(KEY_PENDING_SMS, "[]");
            JSONArray arr;
            try {
                arr = new JSONArray(current);
            } catch (Exception e) {
                arr = new JSONArray();
            }

            // Redundancy Prevention: Check if this SMS is already queued
            for (int i = 0; i < arr.length(); i++) {
                JSONObject existing = arr.getJSONObject(i);
                if (sender.equalsIgnoreCase(existing.optString("sender")) &&
                    body.equals(existing.optString("body"))) {
                    Log.i(TAG, "[PLUGIN_SMS] SMS already in pending queue; skipping redundant insertion.");
                    return;
                }
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
            Log.i(TAG, "[PLUGIN_SMS] Successfully queued incoming SMS from: " + sender + " (live_listener=" + (instance != null) + ")");

            // 3. Show subtle notification to user if app is in background/closed AND message is likely financial
            if (instance == null && SmsReceiver.isLikelyFinancialTransaction(sender, body)) {
                showBackgroundNotification(context, sender, body);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to handle incoming SMS", e);
        }
    }

    /**
     * Shows a clean Android system notification when a transaction SMS is logged in the background
     */
    private static void showBackgroundNotification(Context context, String sender, String body) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            String channelId = "lifeos_sms_transactions";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "SMS Expense Auto-Logging",
                    NotificationManager.IMPORTANCE_DEFAULT
                );
                channel.setDescription("Alerts when financial transactions received via SMS are auto-logged");
                nm.createNotificationChannel(channel);
            }

            Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            PendingIntent pendingIntent = null;
            if (launchIntent != null) {
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                pendingIntent = PendingIntent.getActivity(context, 0, launchIntent, flags);
            }

            String summary = body.length() > 60 ? body.substring(0, 57) + "..." : body;

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.stat_notify_more)
                .setContentTitle("💳 Transaction Detected (" + sender + ")")
                .setContentText(summary + " • Tap to review in Spending")
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

            if (pendingIntent != null) {
                builder.setContentIntent(pendingIntent);
            }

            nm.notify((int) (System.currentTimeMillis() % 100000), builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Failed to post background SMS notification", e);
        }
    }
}
