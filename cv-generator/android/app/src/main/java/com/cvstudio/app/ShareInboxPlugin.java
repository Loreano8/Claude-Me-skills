package com.cvstudio.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * « Partager → CV Studio » depuis LinkedIn, WhatsApp, le navigateur… :
 * garde le texte partagé jusqu'à ce que la page « Offre » le demande (voir src/lib/shareInbox.ts).
 */
@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {

    private static String pending;
    private static ShareInboxPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    static void receive(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return;
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        pending = subject != null && !subject.trim().isEmpty() && !text.contains(subject) ? subject + "\n" + text : text;
        // Consommé : un retour sur l'appli ne doit pas relire le même partage.
        intent.setAction(Intent.ACTION_MAIN);
        if (instance != null) instance.notifyListeners("shared", new JSObject(), true);
    }

    @PluginMethod
    public void take(PluginCall call) {
        JSObject result = new JSObject();
        result.put("text", pending);
        pending = null;
        call.resolve(result);
    }
}
