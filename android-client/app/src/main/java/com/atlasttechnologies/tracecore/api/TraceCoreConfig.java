package com.atlasttechnologies.tracecore.api;

public final class TraceCoreConfig {
    private TraceCoreConfig() {}
    // For TraceCore running in Termux on this same Android phone.
    // If this does not connect on your device, replace it with the phone's LAN IP, e.g. http://192.168.1.20:3000
    public static final String API_BASE_URL = "http://127.0.0.1:3000";
}
