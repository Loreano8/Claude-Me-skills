package com.cvstudio.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareInboxPlugin.class);
        registerPlugin(FileSaverPlugin.class);
        // BridgeActivity transmet l'intention de démarrage à onNewIntent() : le partage y est lu.
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        ShareInboxPlugin.receive(intent);
    }
}
