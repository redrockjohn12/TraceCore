package com.atlastechnologies.tracecore;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.*;

import org.json.JSONObject;

public class LocationService extends Service {

    private FusedLocationProviderClient client;
    private LocationCallback callback;

    private static final String CHANNEL = "tracecore_location";

    @Override
    public void onCreate() {
        super.onCreate();

        createChannel();

        Intent launch = new Intent(this, MainActivity.class);

        PendingIntent pi = PendingIntent.getActivity(
                this,
                10,
                launch,
                PendingIntent.FLAG_IMMUTABLE |
                PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification notification =
                new NotificationCompat.Builder(this, CHANNEL)
                        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                        .setContentTitle("TraceCore protection active")
                        .setContentText("Device location protection is running")
                        .setOngoing(true)
                        .setContentIntent(pi)
                        .build();

        startForeground(1001, notification);

        client = LocationServices.getFusedLocationProviderClient(this);

        callback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null || result.getLastLocation() == null) {
                    return;
                }

                android.location.Location loc =
                        result.getLastLocation();

                sendLocation(
                        loc.getLatitude(),
                        loc.getLongitude(),
                        loc.getAccuracy()
                );
            }
        };
    }

    private void createChannel() {
        NotificationChannel channel =
                new NotificationChannel(
                        CHANNEL,
                        "TraceCore Location",
                        NotificationManager.IMPORTANCE_LOW
                );

        NotificationManager nm =
                getSystemService(NotificationManager.class);

        if (nm != null) {
            nm.createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {

        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {

            stopSelf();
            return START_NOT_STICKY;
        }

        LocationRequest request =
                new LocationRequest.Builder(
                        Priority.PRIORITY_HIGH_ACCURACY,
                        300000
                )
                .setMinUpdateIntervalMillis(60000)
                .setWaitForAccurateLocation(false)
                .build();

        client.requestLocationUpdates(
                request,
                callback,
                getMainLooper()
        );

        return START_STICKY;
    }

    private void sendLocation(
            double latitude,
            double longitude,
            float accuracy
    ) {
        String token =
                Prefs.get(this, "deviceToken", "");

        String recovery =
                Prefs.get(this, "recoveryId", "");

        String base =
                Prefs.get(
                        this,
                        "base",
                        BuildConfig.TRACECORE_BASE_URL
                );

        if (token.isEmpty() || recovery.isEmpty()) {
            return;
        }

        new Thread(() -> {
            try {
                JSONObject body = new JSONObject();

                body.put("latitude", latitude);
                body.put("longitude", longitude);
                body.put("accuracy", accuracy);

                ApiClient.call(
                        base,
                        "/api/devices/" +
                        recovery +
                        "/location",
                        "POST",
                        token,
                        body
                );

            } catch (Exception ignored) {
            }
        }).start();
    }

    @Override
    public void onDestroy() {

        if (client != null && callback != null) {
            client.removeLocationUpdates(callback);
        }

        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
