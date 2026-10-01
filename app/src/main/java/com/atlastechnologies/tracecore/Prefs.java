package com.atlastechnologies.tracecore;

import android.content.Context;
import android.content.SharedPreferences;

public class Prefs {
    private static SharedPreferences p(Context c) {
        return c.getSharedPreferences("tracecore", Context.MODE_PRIVATE);
    }

    public static String get(Context c, String key, String def) {
        return p(c).getString(key, def);
    }

    public static void put(Context c, String key, String value) {
        p(c).edit().putString(key, value).apply();
    }

    public static boolean bool(Context c, String key, boolean value) {
        if (value != p(c).getBoolean(key, value)) {
            p(c).edit().putBoolean(key, value).apply();
        }
        return value;
    }

    public static boolean getBool(Context c, String key, boolean def) {
        return p(c).getBoolean(key, def);
    }
}
