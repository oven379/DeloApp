package app.delodelai;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_NAME = "delo_prefs";
    private static final String KEY_RESCHEDULE_ON_BOOT = "reschedule_on_boot";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        Intent intent = getIntent();
        if (intent != null && "reschedule".equals(intent.getStringExtra("delo_launch"))) {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .putBoolean(KEY_RESCHEDULE_ON_BOOT, true)
                    .apply();
        }
        initialPlugins.add(DeloBootPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
