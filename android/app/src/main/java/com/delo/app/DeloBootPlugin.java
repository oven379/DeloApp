package com.delo.app;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Плагин для определения запуска «только для перепланирования» (после перезагрузки).
 * JS вызывает getLaunchReason() при старте и при reason=reschedule синхронизирует напоминания и закрывает приложение.
 */
@CapacitorPlugin(name = "DeloBoot")
public class DeloBootPlugin extends Plugin {

    private static final String PREFS_NAME = "delo_prefs";
    private static final String KEY_RESCHEDULE_ON_BOOT = "reschedule_on_boot";

    @PluginMethod
    public void getLaunchReason(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.resolve(json("normal"));
            return;
        }
        boolean reschedule = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(KEY_RESCHEDULE_ON_BOOT, false);
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_RESCHEDULE_ON_BOOT)
                .apply();
        JSObject ret = new JSObject();
        ret.put("reason", reschedule ? "reschedule" : "normal");
        call.resolve(ret);
    }

    private static JSObject json(String reason) {
        JSObject o = new JSObject();
        o.put("reason", reason);
        return o;
    }
}
