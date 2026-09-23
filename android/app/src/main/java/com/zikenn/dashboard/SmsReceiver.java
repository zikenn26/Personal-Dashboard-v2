package com.zikenn.dashboard;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import androidx.core.content.ContextCompat;

/**
 * Android BroadcastReceiver that monitors incoming SMS messages in real-time
 * and in background. Filters for financial transaction messages and forwards
 * them to SmsTransactionPlugin for local, secure auto-logging into Spending.
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
            // Check runtime permission
            boolean hasPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
            if (!hasPermission) {
                Log.d(TAG, "RECEIVE_SMS permission not granted; ignoring incoming SMS");
                return;
            }

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            // Default to true if permission is granted, unless explicitly disabled by user
            boolean isEnabled = prefs.getBoolean(KEY_SMS_AUTO_ENABLED, true);
            if (!isEnabled) {
                Log.d(TAG, "User explicitly disabled SMS expense tracking; ignoring");
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

            // Pre-filter: Check if it's a financial transaction and NOT an OTP or promotional spam
            if (isLikelyFinancialTransaction(sender, body)) {
                Log.d(TAG, "Financial SMS detected from: " + sender);
                SmsTransactionPlugin.handleIncomingSms(context, sender, body, timestamp);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing incoming SMS", e);
        }
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
