package com.atlastechnologies.tracecore;
import android.content.*;
public final class Prefs{static final String P="tracecore";static SharedPreferences p(Context c){return c.getSharedPreferences(P,Context.MODE_PRIVATE);}static String get(Context c,String k,String d){return p(c).getString(k,d);}static void put(Context c,String k,String v){p(c).edit().putString(k,v).apply();}static boolean bool(Context c,String k){return p(c).getBoolean(k,false);}static void bool(Context c,String k,boolean v){p(c).edit().putBoolean(k,v).apply();}}
