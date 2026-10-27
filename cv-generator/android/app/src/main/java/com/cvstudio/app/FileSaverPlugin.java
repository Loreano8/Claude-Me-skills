package com.cvstudio.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/**
 * « Enregistrer sur le téléphone » : ouvre le sélecteur de dossier d'Android (Téléchargements, Documents,
 * carte SD, Drive…) et y écrit le fichier généré (voir src/export/save.ts).
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void saveAs(PluginCall call) {
        String fileName = call.getString("fileName", "document");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        if (call.getString("data") == null) {
            call.reject("Fichier vide.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "onPicked");
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject res = new JSObject();
        Intent data = result.getData();
        Uri uri = data != null ? data.getData() : null;
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            res.put("saved", false);
            call.resolve(res);
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new Exception("emplacement inaccessible");
            out.write(Base64.decode(call.getString("data"), Base64.DEFAULT));
            res.put("saved", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Impossible d'enregistrer le fichier à cet endroit.");
        }
    }
}
