package com.zikenn.dashboard;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsTransactionPlugin.class);
        registerPlugin(ScratchPadWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        handleWidgetIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWidgetIntent(intent);
    }

    private void handleWidgetIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String target = intent.getStringExtra("target_screen");
        if (ScratchPadWidgetProvider.ACTION_OPEN_SCRATCHPAD.equals(action) || "scratchpad".equals(target)) {
            boolean autoAdd = intent.getBooleanExtra("auto_add", false);
            ScratchPadWidgetPlugin.setPendingWidgetOpen(autoAdd);
        }
    }
}
