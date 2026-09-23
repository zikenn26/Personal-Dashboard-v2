package com.zikenn.dashboard;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import androidx.core.content.ContextCompat;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Android BroadcastReceiver that monitors incoming SMS messages in real-time
 * and in background.
 *
 * Captures raw SMS payloads, outputs comprehensive diagnostics to Logcat,
 * and forwards them to SmsTransactionPlugin for local processing and Spending auto-logging.
 */
public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "LifeOS_SmsReceiver";
    public static final String PREFS_NAME = "ZikennSmsPrefs";
    public static final String KEY_SMS_AUTO_ENABLED = "sms_auto_logging_enabled";

    // Deduplication cache to prevent dual-processing when both static manifest receiver
    // and dynamic runtime receiver intercept the same broadcast within 3 seconds.
    private static final Map<String, Long> recentBroadcasts = Collections.synchronizedMap(
        new LinkedHashMap<String, Long>(50, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
                return size() > 100;
            }
        }
    );

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "============================================================");
        Log.i(TAG, "[SMS_RECEIVER] Broadcast received! Action=" + (intent != null ? intent.getAction() : "null"));

        if (intent == null) {
            Log.w(TAG, "[SMS_RECEIVER] Received intent is null; ignoring.");
            return;
        }

        String action = intent.getAction();
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(action)) {
            Log.w(TAG, "[SMS_RECEIVER] Unhandled intent action: " + action);
            return;
        }

        try {
            // 1. Check runtime RECEIVE_SMS permission
            boolean hasPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
            Log.i(TAG, "[SMS_RECEIVER] Manifest.permission.RECEIVE_SMS granted=" + hasPermission);
            if (!hasPermission) {
                Log.w(TAG, "[SMS_RECEIVER] BLOCKED: RECEIVE_SMS permission has not been granted by user in Android App Settings!");
                return;
            }

            // 2. Check if auto-logging is enabled in preferences
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean isEnabled = prefs.getBoolean(KEY_SMS_AUTO_ENABLED, true);
            Log.i(TAG, "[SMS_RECEIVER] sms_auto_logging_enabled in SharedPreferences=" + isEnabled);
            if (!isEnabled) {
                Log.w(TAG, "[SMS_RECEIVER] User has explicitly disabled SMS expense tracking in app settings; skipping.");
                return;
            }

            // 3. Extract SMS messages using modern standard Telephony API first (API 19+)
            SmsMessage[] messages = null;
            try {
                messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            } catch (Exception e) {
                Log.w(TAG, "[SMS_RECEIVER] Telephony.Sms.Intents.getMessagesFromIntent threw: " + e.getMessage());
            }

            String sender = "";
            StringBuilder fullBody = new StringBuilder();
            long timestamp = System.currentTimeMillis();

            if (messages != null && messages.length > 0) {
                Log.i(TAG, "[SMS_RECEIVER] Extracted " + messages.length + " message segment(s) via Telephony.Sms.Intents");
                for (SmsMessage sms : messages) {
                    if (sms != null) {
                        if (sender.isEmpty()) {
                            sender = sms.getDisplayOriginatingAddress();
                            timestamp = sms.getTimestampMillis();
                        }
                        String bodyPart = sms.getMessageBody();
                        if (bodyPart != null) {
                            fullBody.append(bodyPart);
                        }
                    }
                }
            } else {
                // Fallback to legacy bundle PDUs extraction
                Log.i(TAG, "[SMS_RECEIVER] Using bundle PDUs fallback extraction");
                Bundle bundle = intent.getExtras();
                if (bundle == null) {
                    Log.w(TAG, "[SMS_RECEIVER] Intent bundle is null; no PDUs available");
                    return;
                }

                Object[] pdus = (Object[]) bundle.get("pdus");
                if (pdus == null || pdus.length == 0) {
                    Log.w(TAG, "[SMS_RECEIVER] No PDUs found in intent bundle");
                    return;
                }

                String format = bundle.getString("format");
                for (Object pdu : pdus) {
                    SmsMessage sms;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        sms = SmsMessage.createFromPdu((byte[]) pdu, format);
                    } else {
                        sms = SmsMessage.createFromPdu((byte[]) pdu);
                    }

                    if (sms != null) {
                        if (sender.isEmpty()) {
                            sender = sms.getDisplayOriginatingAddress();
                            timestamp = sms.getTimestampMillis();
                        }
                        String bodyPart = sms.getMessageBody();
                        if (bodyPart != null) {
                            fullBody.append(bodyPart);
                        }
                    }
                }
            }

            String body = fullBody.toString();
            if (body.isEmpty()) {
                Log.w(TAG, "[SMS_RECEIVER] Extracted SMS body is empty; ignoring");
                return;
            }

            // 4. De-duplicate immediate duplicate broadcasts within 3000ms
            String dedupeKey = sender + ":" + body.hashCode();
            Long lastSeen = recentBroadcasts.get(dedupeKey);
            long now = System.currentTimeMillis();
            if (lastSeen != null && (now - lastSeen) < 3000) {
                Log.i(TAG, "[SMS_RECEIVER] Ignored duplicate broadcast delivery within 3s for " + sender);
                return;
            }
            recentBroadcasts.put(dedupeKey, now);

            // 5. Output raw captured content (sanitized for logcat privacy)
            Log.i(TAG, "[SMS_RECEIVER] RAW SMS CAPTURED!");
            Log.i(TAG, "[SMS_RECEIVER] Originating Sender: " + sender);
            Log.i(TAG, "[SMS_RECEIVER] Timestamp: " + timestamp);
            Log.i(TAG, "[SMS_RECEIVER] Body Length: " + body.length());
            Log.i(TAG, "[SMS_RECEIVER] Sanitized Content: " + sanitizeForLog(body));

            boolean isFinancial = isLikelyFinancialTransaction(sender, body);
            Log.i(TAG, "[SMS_RECEIVER] Heuristic Financial Classification: " + (isFinancial ? "YES (Transaction alert)" : "NO (Non-transactional / OTP / Info)"));

            // 6. Forward payload to SmsTransactionPlugin for real-time delivery and pending queue
            SmsTransactionPlugin.handleIncomingSms(context, sender, body, timestamp);
            Log.i(TAG, "[SMS_RECEIVER] Successfully dispatched SMS payload to SmsTransactionPlugin");
            Log.i(TAG, "============================================================");
        } catch (Exception e) {
            Log.e(TAG, "[SMS_RECEIVER] Fatal error processing incoming SMS broadcast", e);
        }
    }

    /**
     * Sanitizes sensitive data (card numbers, full account numbers, OTPs)
     * so diagnostic logs can be inspected safely via adb logcat.
     */
    public static String sanitizeForLog(String text) {
        if (text == null) return "";
        // Mask 12-16 digit card/account numbers
        String s = text.replaceAll("\\b(\\d{4})[ -]?(\\d{4})[ -]?(\\d{4})[ -]?(\\d{4})\\b", "****-****-****-$4");
        // Mask explicit account numbers with 5+ digits
        s = s.replaceAll("(?i)(?:a/c|acct|acc|account)\\s*(?:no\\.?)?\\s*[:#]?\\s*([X*]*\\d{4,})", "A/C ****");
        // Mask 6-digit OTP codes if present
        s = s.replaceAll("(?i)(?:otp|code)\\s*(?:is|:)?\\s*\\b\\d{4,8}\\b", "OTP ******");
        return s;
    }

    /**
     * Fast, comprehensive local heuristic to identify financial transaction SMS
     * (debits, credits, UPI, cards, bank alerts) while rejecting OTPs, loans, and promotional spam.
     */
    public static boolean isLikelyFinancialTransaction(String sender, String body) {
        if (body == null || body.trim().isEmpty()) return false;
        String lower = body.toLowerCase();

        // 1. Strict OTP & Authentication rejection
        if (lower.contains("otp") && (
            lower.contains("do not share") || 
            lower.contains("valid for") || 
            lower.contains("is your") || 
            lower.contains("secret") || 
            lower.contains("use this") ||
            lower.contains("authenticate") ||
            lower.contains("one time password")
        )) {
            return false;
        }

        if (lower.contains("verification code") || 
            lower.contains("security code") ||
            lower.contains("is your one time password")) {
            return false;
        }

        // 2. Reject promotional / marketing loans & schemes
        if (lower.contains("pre-approved loan") || 
            lower.contains("apply for instant loan") || 
            lower.contains("personal loan up to") || 
            lower.contains("click here to claim") || 
            lower.contains("congratulations! you won") ||
            lower.contains("apply for credit card")) {
            return false;
        }

        // 3. Reject declined or failed transactions
        if (lower.contains("declined") || 
            lower.contains("payment failed") || 
            lower.contains("transaction failed") || 
            lower.contains("unsuccessful") ||
            lower.contains("failed due to")) {
            return false;
        }

        // 4. Must contain at least one digit (amount, account last digits, or date)
        if (!lower.matches(".*\\d+.*")) {
            return false;
        }

        // 5. Must contain a financial transaction verb or banking indicator
        boolean hasTxnVerb = 
            lower.contains("debited") || 
            lower.contains("credited") || 
            lower.contains("paid") || 
            lower.contains("spent") || 
            lower.contains("withdrawn") || 
            lower.contains("transferred") || 
            lower.contains("transfer to") || 
            lower.contains("sent to") || 
            lower.contains("purchase") || 
            lower.contains("charged") || 
            lower.contains("deducted") || 
            lower.contains("txn of") || 
            lower.contains("payment of") || 
            lower.contains("received") || 
            lower.contains("deposited") || 
            lower.contains("refund") || 
            lower.contains("cashback") || 
            lower.contains("vpa") || 
            lower.contains("pos txn") || 
            lower.contains("atm wdl") || 
            lower.contains("upi ref") || 
            lower.contains("ref no") ||
            lower.contains("rrn") ||
            lower.contains("card ending") ||
            lower.contains("a/c ending") ||
            lower.contains("acct ending") ||
            lower.contains("avl bal") ||
            lower.contains("avail bal") ||
            lower.contains("dr to") ||
            lower.contains("cr to");

        return hasTxnVerb;
    }
}
