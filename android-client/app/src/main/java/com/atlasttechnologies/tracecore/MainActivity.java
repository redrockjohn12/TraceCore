package com.atlasttechnologies.tracecore;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.location.LocationListener;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.ViewGroup;
import android.widget.*;

import com.atlasttechnologies.tracecore.api.TraceCoreApi;
import com.atlasttechnologies.tracecore.api.TraceCoreConfig;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int LOCATION_REQUEST = 100;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private SharedPreferences prefs;
    private EditText email, password, recoveryId, credential;
    private TextView status;
    private Button permissionButton, locateButton;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("tracecore", MODE_PRIVATE);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 40, 32, 30);

        TextView title = new TextView(this);
        title.setText("TraceCore\n\nProtected Device");
        title.setTextSize(24);
        root.addView(title, new LinearLayout.LayoutParams(-1, -2));

        TextView info = new TextView(this);
        info.setText("Location reporting requires Android Location to be ON and TraceCore to have location permission.");
        root.addView(info, new LinearLayout.LayoutParams(-1, -2));

        permissionButton = new Button(this);
        permissionButton.setText("Grant Location Permission");
        permissionButton.setOnClickListener(v -> ensureLocationReady());
        root.addView(permissionButton);

        email = field("Owner email");
        password = field("Owner password");
        password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        recoveryId = field("Recovery ID (TC-...)");
        credential = field("Device credential (saved after enrollment)");
        root.addView(email); root.addView(password); root.addView(recoveryId); root.addView(credential);

        recoveryId.setText(prefs.getString("recoveryId", ""));
        credential.setText(prefs.getString("deviceCredential", ""));

        Button connect = new Button(this);
        connect.setText("Enroll / Connect Device");
        connect.setOnClickListener(v -> connect());
        root.addView(connect);

        locateButton = new Button(this);
        locateButton.setText("Send Current Location");
        locateButton.setOnClickListener(v -> sendLocation());
        root.addView(locateButton);

        Button ping = new Button(this);
        ping.setText("Send Heartbeat");
        ping.setOnClickListener(v -> heartbeat());
        root.addView(ping);

        status = new TextView(this);
        status.setText("\nServer: " + TraceCoreConfig.API_BASE_URL + "\nChecking location permission…");
        root.addView(status, new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);

        updateLocationUi();
        // Explicitly request foreground location when the app opens.
        if (!hasLocationPermission()) requestLocationPermission();
    }

    private EditText field(String hint) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setSingleLine(true);
        e.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return e;
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isLocationEnabled() {
        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (lm == null) return false;
        try {
            return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception e) { return false; }
    }

    private void requestLocationPermission() {
        requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST);
    }

    private void ensureLocationReady() {
        if (!hasLocationPermission()) {
            status.setText("\nRequesting Android location permission…");
            requestLocationPermission();
            return;
        }
        if (!isLocationEnabled()) {
            status.setText("\nAndroid Location is OFF. Turn it ON, then return to TraceCore.");
            try { startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)); } catch (Exception ignored) {}
            return;
        }
        status.setText("\nLocation permission granted and Location is ON. TraceCore is ready for GPS.");
        updateLocationUi();
    }

    private void updateLocationUi() {
        if (permissionButton == null) return;
        if (hasLocationPermission()) permissionButton.setText(isLocationEnabled() ? "Location Ready ✓" : "Turn On Android Location");
        else permissionButton.setText("Grant Location Permission");
    }

    private void connect() {
        if (!hasLocationPermission() || !isLocationEnabled()) { ensureLocationReady(); return; }
        final String em=email.getText().toString().trim(), pw=password.getText().toString(), rid=recoveryId.getText().toString().trim();
        if(em.isEmpty() || pw.isEmpty() || rid.isEmpty()) { status.setText("\nOwner email, password and Recovery ID are required for first enrollment."); return; }
        status.setText("\nConnecting and issuing device credential…");
        executor.execute(() -> { try {
            TraceCoreApi api = new TraceCoreApi(TraceCoreConfig.API_BASE_URL);
            String login = api.login(em, pw);
            String ownerToken = new JSONObject(login).getString("token");
            String response = api.issueDeviceCredential(ownerToken, rid);
            String cred = new JSONObject(response).getString("deviceCredential");
            prefs.edit().putString("recoveryId", rid).putString("deviceCredential", cred).apply();
            api.heartbeat(cred);
            runOnUiThread(() -> { credential.setText(cred); password.setText(""); status.setText("\nDevice enrolled successfully. Credential saved on this phone.\nHeartbeat sent."); });
        } catch(Exception e) { runOnUiThread(() -> status.setText("\nEnrollment error: " + e.getMessage())); } });
    }

    private void sendLocation() {
        if (!hasLocationPermission() || !isLocationEnabled()) { ensureLocationReady(); return; }
        final String cred = credential.getText().toString().trim();
        if (cred.isEmpty()) { status.setText("\nNo saved device credential. Enroll the device first."); return; }
        locateButton.setEnabled(false);
        status.setText("\nGetting current GPS location…");

        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (lm == null) {
            locateButton.setEnabled(true);
            status.setText("\nAndroid Location Manager is unavailable.");
            return;
        }

        final LocationListener listener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                try { lm.removeUpdates(this); } catch (Exception ignored) {}
                uploadLocation(cred, location);
            }
            @Override public void onProviderEnabled(String provider) { updateLocationUi(); }
            @Override public void onProviderDisabled(String provider) { updateLocationUi(); }
        };

        try {
            String provider = LocationManager.GPS_PROVIDER;
            if (!lm.isProviderEnabled(provider)) provider = LocationManager.NETWORK_PROVIDER;
            lm.requestLocationUpdates(provider, 0L, 0f, listener, getMainLooper());

            // A last-known fix gives the test a fallback if a fresh fix is not immediately available.
            Location last = lm.getLastKnownLocation(provider);
            if (last != null && (System.currentTimeMillis() - last.getTime() < 5 * 60 * 1000L)) {
                try { lm.removeUpdates(listener); } catch (Exception ignored) {}
                uploadLocation(cred, last);
            }
        } catch (SecurityException e) {
            locateButton.setEnabled(true);
            status.setText("\nLocation permission is required. Tap 'Grant Location Permission'.");
        } catch (Exception e) {
            locateButton.setEnabled(true);
            status.setText("\nGPS error: " + e.getMessage());
        }
    }

    private void heartbeat() {
        final String cred=credential.getText().toString().trim();
        if(cred.isEmpty()) { status.setText("\nNo device credential saved. Enroll first."); return; }
        executor.execute(() -> { try { new TraceCoreApi(TraceCoreConfig.API_BASE_URL).heartbeat(cred); runOnUiThread(() -> status.setText("\nHeartbeat sent successfully.")); } catch(Exception e) { runOnUiThread(() -> status.setText("\nHeartbeat error: " + e.getMessage())); } });
    }

    @Override public void onRequestPermissionsResult(int r, String[] p, int[] g) {
        super.onRequestPermissionsResult(r, p, g);
        if(r == LOCATION_REQUEST) {
            updateLocationUi();
            if (hasLocationPermission()) status.setText("\nLocation permission granted. Now make sure Android Location is ON.");
            else status.setText("\nLocation permission was not granted. Tap 'Grant Location Permission' and allow it.");
        }
    }

    @Override protected void onResume() { super.onResume(); updateLocationUi(); }
    @Override protected void onDestroy() { executor.shutdownNow(); super.onDestroy(); }
}
