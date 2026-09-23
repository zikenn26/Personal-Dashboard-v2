package com.zikenn.dashboard;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsTransactionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
