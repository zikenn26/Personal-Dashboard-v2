package com.zikenn.dashboard;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

/**
 * Android BroadcastReceiver that monitors incoming SMS messages in real-time
 * and in background. Filters for financial transaction messages and forwards
 * them to SmsTransactionPlugin for local, secure auto-logging.
 */
public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "ZikennSmsReceiver";
    public static final String PREFS_NAME = "ZikennSmsPrefs";
    public static final String KEY_SMS_AUTO_ENABLED = "sms_auto_logging_enabled";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean isEnabled = prefs.getBoolean(KEY_SMS_AUTO_ENABLED, false);
            if (!isEnabled) {
                // User has not enabled SMS expense tracking; respect privacy and ignore
                return;
            }

            Bundle bundle = intent.getExtras();
            if (bundle == null) return;

            Object[] pdus = (Object[]) bundle.get("pdus");
            if (pdus == null || pdus.length == 0) return;

            String format = bundle.getString("format");
            StringBuilder fullBody = new StringBuilder();
            String sender = "";
            long timestamp = System.currentTimeMillis();

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

            String body = fullBody.toString();
            if (body.isEmpty()) return;

            // Pre-filter: Check if it's a financial transaction and NOT a plain OTP or spam
            if (isLikelyFinancialTransaction(sender, body)) {
                Log.d(TAG, "Financial SMS detected from: " + sender);
                SmsTransactionPlugin.handleIncomingSms(context, sender, body, timestamp);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing incoming SMS", e);
        }
    }

    /**
     * Fast local heuristic to detect financial SMS while ignoring OTPs, ads, spam, and personal chats.
     */
    public static boolean isLikelyFinancialTransaction(String sender, String body) {
        if (body == null || body.trim().isEmpty()) return false;
        String lower = body.toLowerCase();

        // 1. Strict OTP rejection: If message is clearly an authentication code or password, ignore
        if (lower.contains("do not share this otp") || 
            lower.contains("is your one time password") ||
            lower.contains("is your otp") ||
            lower.contains("use this otp") ||
            lower.contains("verification code is") ||
            lower.contains("security code is")) {
            return false;
        }

        // 2. Reject promotional / marketing loans
        if (lower.contains("pre-approved loan") || 
            lower.contains("apply for instant loan") || 
            lower.contains("click here to claim") || 
            lower.contains("congratulations! you won")) {
            return false;
        }

        // 3. Must have a currency or amount pattern
        boolean hasCurrency = lower.contains("rs.") || lower.contains("rs ") || lower.contains("inr") ||
                              lower.contains("₹") || lower.contains("$") || lower.contains("usd") ||
                              lower.contains("eur") || lower.contains("gbp") || lower.contains("aed") ||
                              lower.matches(".*\\b\\d+(?:\\.\\d{1,2})?\\s*(?:rs|inr|rupees)\\b.*");

        if (!hasCurrency) return false;

        // 4. Must have a transaction action verb
        boolean hasTxnVerb = lower.contains("debited") || lower.contains("credited") || 
                             lower.contains("paid") || lower.contains("spent") || 
                             lower.contains("withdrawn") || lower.contains("transferred") || 
                             lower.contains("sent") || lower.contains("purchase") || 
                             lower.contains("charged") || lower.contains("deducted") || 
                             lower.contains("txn of") || lower.contains("payment of") || 
                             lower.contains("received") || lower.contains("deposited") || 
                             lower.contains("refund") || lower.contains("cashback") || 
                             lower.contains("vpa") || lower.contains("pos txn") || 
                             lower.contains("atm wdl") || lower.contains("upi ref");

        return hasTxnVerb;
    }
}
