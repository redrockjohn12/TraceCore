package com.atlastechnologies.tracecore;
import android.content.*;import androidx.core.content.ContextCompat;
public class BootReceiver extends BroadcastReceiver{public void onReceive(Context c,Intent i){if(Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())&&Prefs.bool(c,"tracking")){try{ContextCompat.startForegroundService(c,new Intent(c,LocationService.class));}catch(Exception ignored){}}}}
