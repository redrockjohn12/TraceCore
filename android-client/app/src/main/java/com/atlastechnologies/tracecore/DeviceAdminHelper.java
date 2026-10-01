package com.atlastechnologies.tracecore;
import android.app.admin.*;import android.content.*;
public final class DeviceAdminHelper{public static boolean isOwner(Context c){DevicePolicyManager d=(DevicePolicyManager)c.getSystemService(Context.DEVICE_POLICY_SERVICE);return d!=null&&d.isDeviceOwnerApp(c.getPackageName());}public static void lock(Context c){try{DevicePolicyManager d=(DevicePolicyManager)c.getSystemService(Context.DEVICE_POLICY_SERVICE);if(isOwner(c))d.lockNow();}catch(Exception ignored){}}}
