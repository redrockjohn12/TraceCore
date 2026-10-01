#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "=== TRACECORE POLISHED APK BUILD ==="

APP="app/src/main"
mkdir -p "$APP/java/com/atlastechnologies/tracecore"
mkdir -p "$APP/res/layout" "$APP/res/drawable" "$APP/res/values" "$APP/res/mipmap-anydpi-v26"

cat > "$APP/res/values/colors.xml" <<'XML'
<resources>
    <color name="tc_bg">#07111F</color>
    <color name="tc_surface">#0D1B2A</color>
    <color name="tc_surface2">#12263A</color>
    <color name="tc_blue">#27A7FF</color>
    <color name="tc_blue_dark">#0877C9</color>
    <color name="tc_green">#22C55E</color>
    <color name="tc_red">#EF4444</color>
    <color name="tc_orange">#F59E0B</color>
    <color name="tc_text">#F8FAFC</color>
    <color name="tc_muted">#94A3B8</color>
    <color name="tc_border">#20364D</color>
    <color name="white">#FFFFFF</color>
</resources>
XML

cat > "$APP/res/values/themes.xml" <<'XML'
<resources>
    <style name="Theme.TraceCore" parent="android:style/Theme.Material.NoActionBar">
        <item name="android:fontFamily">sans</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:statusBarColor">@color/tc_bg</item>
        <item name="android:navigationBarColor">@color/tc_bg</item>
        <item name="android:windowActionModeOverlay">true</item>
        <item name="android:colorAccent">@color/tc_blue</item>
    </style>
</resources>
XML

cat > "$APP/res/values/strings.xml" <<'XML'
<resources>
    <string name="app_name">TraceCore</string>
</resources>
XML

cat > "$APP/res/drawable/ic_tracecore_logo.xml" <<'XML'
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="96dp"
    android:height="96dp"
    android:viewportWidth="96"
    android:viewportHeight="96">
    <path android:fillColor="#27A7FF"
        android:pathData="M48,5 L82,18 L82,45 C82,67 68,82 48,91 C28,82 14,67 14,45 L14,18 Z"/>
    <path android:fillColor="#07111F"
        android:pathData="M48,15 L72,24 L72,44 C72,60 63,71 48,79 C33,71 24,60 24,44 L24,24 Z"/>
    <path android:fillColor="#FFFFFF"
        android:pathData="M48,25 C40,25 34,31 34,39 C34,49 48,63 48,63 C48,63 62,49 62,39 C62,31 56,25 48,25 Z"/>
    <path android:fillColor="#27A7FF"
        android:pathData="M48,32 C44,32 41,35 41,39 C41,43 44,46 48,46 C52,46 55,43 55,39 C55,35 52,32 48,32 Z"/>
</vector>
XML

cat > "$APP/res/drawable/bg_card.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/tc_surface"/>
    <corners android:radius="20dp"/>
    <stroke android:width="1dp" android:color="@color/tc_border"/>
    <padding android:left="18dp" android:top="18dp" android:right="18dp" android:bottom="18dp"/>
</shape>
XML

cat > "$APP/res/drawable/bg_input.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/tc_surface2"/>
    <corners android:radius="14dp"/>
    <stroke android:width="1dp" android:color="@color/tc_border"/>
    <padding android:left="16dp" android:top="2dp" android:right="16dp" android:bottom="2dp"/>
</shape>
XML

cat > "$APP/res/drawable/bg_primary.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/tc_blue"/>
    <corners android:radius="14dp"/>
    <padding android:left="18dp" android:top="13dp" android:right="18dp" android:bottom="13dp"/>
</shape>
XML

cat > "$APP/res/drawable/bg_danger.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/tc_red"/>
    <corners android:radius="14dp"/>
    <padding android:left="18dp" android:top="13dp" android:right="18dp" android:bottom="13dp"/>
</shape>
XML

cat > "$APP/res/drawable/bg_warning.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/tc_orange"/>
    <corners android:radius="14dp"/>
    <padding android:left="18dp" android:top="13dp" android:right="18dp" android:bottom="13dp"/>
</shape>
XML

cat > "$APP/res/drawable/bg_success.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="#163A28"/>
    <corners android:radius="14dp"/>
    <stroke android:width="1dp" android:color="@color/tc_green"/>
    <padding android:left="14dp" android:top="10dp" android:right="14dp" android:bottom="10dp"/>
</shape>
XML

cat > "$APP/res/mipmap-anydpi-v26/ic_launcher.xml" <<'XML'
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/tc_bg"/>
    <foreground android:drawable="@drawable/ic_tracecore_logo"/>
</adaptive-icon>
XML

cat > "$APP/res/mipmap-anydpi-v26/ic_launcher_round.xml" <<'XML'
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/tc_bg"/>
    <foreground android:drawable="@drawable/ic_tracecore_logo"/>
</adaptive-icon>
XML

cat > "$APP/res/layout/activity_main.xml" <<'XML'
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/rootScroll"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/tc_bg"
    android:fillViewport="true">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="20dp">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:gravity="center_vertical"
            android:orientation="horizontal">

            <ImageView
                android:id="@+id/logo"
                android:layout_width="62dp"
                android:layout_height="62dp"
                android:src="@drawable/ic_tracecore_logo"
                android:contentDescription="TraceCore"/>

            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:orientation="vertical"
                android:paddingStart="14dp">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="TraceCore"
                    android:textColor="@color/tc_text"
                    android:textSize="28sp"
                    android:textStyle="bold"/>

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Protect. Locate. Recover."
                    android:textColor="@color/tc_muted"
                    android:textSize="14sp"/>
            </LinearLayout>
        </LinearLayout>

        <Space android:layout_width="1dp" android:layout_height="22dp"/>

        <LinearLayout
            android:id="@+id/loginPanel"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:background="@drawable/bg_card"
            android:padding="20dp">

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Welcome back"
                android:textColor="@color/tc_text"
                android:textSize="23sp"
                android:textStyle="bold"/>

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="5dp"
                android:text="Sign in to protect and manage your device."
                android:textColor="@color/tc_muted"
                android:textSize="14sp"/>

            <EditText
                android:id="@+id/email"
                android:layout_width="match_parent"
                android:layout_height="52dp"
                android:layout_marginTop="18dp"
                android:background="@drawable/bg_input"
                android:hint="Email address"
                android:inputType="textEmailAddress"
                android:textColor="@color/tc_text"
                android:textColorHint="@color/tc_muted"/>

            <EditText
                android:id="@+id/password"
                android:layout_width="match_parent"
                android:layout_height="52dp"
                android:layout_marginTop="10dp"
                android:background="@drawable/bg_input"
                android:hint="Password"
                android:inputType="textPassword"
                android:textColor="@color/tc_text"
                android:textColorHint="@color/tc_muted"/>

            <Button
                android:id="@+id/login"
                android:layout_width="match_parent"
                android:layout_height="52dp"
                android:layout_marginTop="16dp"
                android:background="@drawable/bg_primary"
                android:text="SIGN IN"
                android:textColor="@color/white"
                android:textStyle="bold"/>

            <Button
                android:id="@+id/register"
                android:layout_width="match_parent"
                android:layout_height="52dp"
                android:layout_marginTop="8dp"
                android:text="CREATE / REGISTER DEVICE"
                android:textColor="@color/tc_blue"
                android:backgroundTint="@color/tc_surface2"/>
        </LinearLayout>

        <LinearLayout
            android:id="@+id/dashboard"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:visibility="gone">

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:gravity="center_vertical"
                android:orientation="horizontal"
                android:background="@drawable/bg_success">

                <TextView
                    android:id="@+id/protectionDot"
                    android:layout_width="18dp"
                    android:layout_height="18dp"
                    android:text="●"
                    android:textColor="@color/tc_green"
                    android:textSize="18sp"/>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:paddingStart="10dp">

                    <TextView
                        android:id="@+id/protectionTitle"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="DEVICE PROTECTED"
                        android:textColor="@color/tc_text"
                        android:textStyle="bold"/>

                    <TextView
                        android:id="@+id/protectionStatus"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="TraceCore is monitoring this device."
                        android:textColor="@color/tc_muted"
                        android:textSize="12sp"/>
                </LinearLayout>
            </LinearLayout>

            <Space android:layout_width="1dp" android:layout_height="14dp"/>

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="vertical"
                android:background="@drawable/bg_card">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Find My Phone"
                    android:textColor="@color/tc_text"
                    android:textSize="21sp"
                    android:textStyle="bold"/>

                <TextView
                    android:id="@+id/locationText"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="6dp"
                    android:text="No location reported yet."
                    android:textColor="@color/tc_muted"
                    android:textSize="14sp"/>

                <Button
                    android:id="@+id/find"
                    android:layout_width="match_parent"
                    android:layout_height="52dp"
                    android:layout_marginTop="14dp"
                    android:background="@drawable/bg_primary"
                    android:text="📍  LOCATE DEVICE"
                    android:textColor="@color/white"
                    android:textStyle="bold"/>

                <Button
                    android:id="@+id/gps"
                    android:layout_width="match_parent"
                    android:layout_height="50dp"
                    android:text="ENABLE GPS PROTECTION"
                    android:textColor="@color/tc_blue"
                    android:backgroundTint="@color/tc_surface2"/>
            </LinearLayout>

            <Space android:layout_width="1dp" android:layout_height="14dp"/>

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="vertical"
                android:background="@drawable/bg_card">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Lost Phone Protection"
                    android:textColor="@color/tc_text"
                    android:textSize="21sp"
                    android:textStyle="bold"/>

                <TextView
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="5dp"
                    android:text="Use these controls if your device is missing."
                    android:textColor="@color/tc_muted"/>

                <Button
                    android:id="@+id/lost"
                    android:layout_width="match_parent"
                    android:layout_height="52dp"
                    android:layout_marginTop="14dp"
                    android:background="@drawable/bg_warning"
                    android:text="⚠  MARK AS LOST"
                    android:textColor="@color/white"
                    android:textStyle="bold"/>

                <Button
                    android:id="@+id/stolen"
                    android:layout_width="match_parent"
                    android:layout_height="52dp"
                    android:layout_marginTop="8dp"
                    android:background="@drawable/bg_danger"
                    android:text="🚨  MARK AS STOLEN"
                    android:textColor="@color/white"
                    android:textStyle="bold"/>

                <Button
                    android:id="@+id/recovered"
                    android:layout_width="match_parent"
                    android:layout_height="52dp"
                    android:layout_marginTop="8dp"
                    android:text="✓  MARK AS RECOVERED"
                    android:textColor="@color/tc_green"
                    android:backgroundTint="@color/tc_surface2"/>
            </LinearLayout>

            <Space android:layout_width="1dp" android:layout_height="14dp"/>

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="vertical"
                android:background="@drawable/bg_card">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Device"
                    android:textColor="@color/tc_text"
                    android:textSize="20sp"
                    android:textStyle="bold"/>

                <TextView
                    android:id="@+id/deviceName"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="10dp"
                    android:text="Device"
                    android:textColor="@color/tc_text"/>

                <TextView
                    android:id="@+id/recoveryId"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="6dp"
                    android:text="Recovery ID: —"
                    android:textColor="@color/tc_muted"/>

                <TextView
                    android:id="@+id/deviceState"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="6dp"
                    android:text="Status: —"
                    android:textColor="@color/tc_muted"/>
            </LinearLayout>

            <Space android:layout_width="1dp" android:layout_height="14dp"/>

            <Button
                android:id="@+id/admin"
                android:layout_width="match_parent"
                android:layout_height="50dp"
                android:text="DEVICE SECURITY SETTINGS"
                android:textColor="@color/tc_muted"
                android:backgroundTint="@color/tc_surface2"/>

            <Button
                android:id="@+id/stop"
                android:layout_width="match_parent"
                android:layout_height="50dp"
                android:text="STOP GPS SERVICE"
                android:textColor="@color/tc_muted"
                android:backgroundTint="@color/tc_surface2"/>

        </LinearLayout>

        <TextView
            android:id="@+id/status"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="18dp"
            android:text="Ready"
            android:textColor="@color/tc_muted"
            android:textSize="13sp"/>

        <TextView
            android:id="@+id/baseUrl"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:visibility="gone"/>

        <EditText
            android:id="@+id/name"
            android:layout_width="match_parent"
            android:layout_height="1dp"
            android:visibility="gone"/>

        <EditText
            android:id="@+id/serial"
            android:layout_width="match_parent"
            android:layout_height="1dp"
            android:visibility="gone"/>

        <EditText
            android:id="@+id/imei"
            android:layout_width="match_parent"
            android:layout_height="1dp"
            android:visibility="gone"/>

        <TextView
            android:id="@+id/credential"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:visibility="gone"/>
    </LinearLayout>
</ScrollView>
XML

cat > "$APP/java/com/atlastechnologies/tracecore/MainActivity.java" <<'JAVA'
package com.atlastechnologies.tracecore;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.*;
import org.json.JSONObject;

public class MainActivity extends Activity {
    EditText email,password,base,name,serial,imei;
    TextView status,locationText,deviceName,recoveryId,deviceState,protectionTitle,protectionStatus;
    LinearLayout loginPanel,dashboard;
    String token="";
    String recovery="";
    String currentStatus="protected";

    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        setContentView(R.layout.activity_main);

        email=findViewById(R.id.email);
        password=findViewById(R.id.password);
        base=findViewById(R.id.baseUrl);
        name=findViewById(R.id.name);
        serial=findViewById(R.id.serial);
        imei=findViewById(R.id.imei);
        status=findViewById(R.id.status);
        locationText=findViewById(R.id.locationText);
        deviceName=findViewById(R.id.deviceName);
        recoveryId=findViewById(R.id.recoveryId);
        deviceState=findViewById(R.id.deviceState);
        protectionTitle=findViewById(R.id.protectionTitle);
        protectionStatus=findViewById(R.id.protectionStatus);
        loginPanel=findViewById(R.id.loginPanel);
        dashboard=findViewById(R.id.dashboard);

        base.setText(Prefs.get(this,"base",BuildConfig.TRACECORE_BASE_URL));
        email.setText(Prefs.get(this,"email",""));

        findViewById(R.id.login).setOnClickListener(v->login());
        findViewById(R.id.register).setOnClickListener(v->registerDevice());
        findViewById(R.id.gps).setOnClickListener(v->enableGps());
        findViewById(R.id.find).setOnClickListener(v->findDevice());
        findViewById(R.id.lost).setOnClickListener(v->changeStatus("lost"));
        findViewById(R.id.stolen).setOnClickListener(v->changeStatus("stolen"));
        findViewById(R.id.recovered).setOnClickListener(v->changeStatus("recovered"));
        findViewById(R.id.stop).setOnClickListener(v->{
            Prefs.bool(this,"tracking",false);
            stopService(new Intent(this,LocationService.class));
            status.setText("GPS protection stopped.");
        });
        findViewById(R.id.admin).setOnClickListener(v->
            startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS)));
    }

    String base(){
        String s=base.getText().toString().trim();
        if(s.length()==0)s=BuildConfig.TRACECORE_BASE_URL;
        return s.endsWith("/")?s.substring(0,s.length()-1):s;
    }

    void login(){
        setStatus("Signing in...");
        new Thread(()->{
            try{
                JSONObject x=new JSONObject();
                x.put("email",email.getText().toString().trim());
                x.put("password",password.getText().toString());
                JSONObject r=ApiClient.call(base(),"/api/auth/login","POST","",x);
                token=r.optString("token",r.optString("accessToken",""));
                if(token.length()==0)throw new Exception("Server did not return a login token.");
                Prefs.put(this,"email",email.getText().toString().trim());
                Prefs.put(this,"token",token);
                runOnUiThread(()->showDashboard());
            }catch(Exception e){setStatus("Login: "+clean(e));}
        }).start();
    }

    void registerDevice(){
        setStatus("Registering this device...");
        new Thread(()->{
            try{
                String t=Prefs.get(this,"token","");
                JSONObject x=new JSONObject();
                x.put("deviceName","Redrock Android");
                x.put("platform","Android");
                x.put("manufacturer",android.os.Build.MANUFACTURER);
                x.put("model",android.os.Build.MODEL);
                x.put("ownership","personal");
                x.put("serial","");
                x.put("imei","");
                JSONObject r=ApiClient.call(base(),"/api/devices/register","POST",t,x);
                recovery=r.optString("recoveryId",r.optString("recovery_id",""));
                String dt=r.optString("deviceToken","");
                if(dt.length()>0)Prefs.put(this,"deviceToken",dt);
                Prefs.put(this,"recoveryId",recovery);
                runOnUiThread(()->{
                    showDashboard();
                    recoveryId.setText("Recovery ID: "+(recovery.length()>0?recovery:"Registered"));
                    status.setText("Device registered successfully.");
                });
            }catch(Exception e){setStatus("Registration: "+clean(e));}
        }).start();
    }

    void showDashboard(){
        loginPanel.setVisibility(android.view.View.GONE);
        dashboard.setVisibility(android.view.View.VISIBLE);
        recovery=Prefs.get(this,"recoveryId","");
        recoveryId.setText("Recovery ID: "+(recovery.length()>0?recovery:"Not registered"));
        deviceName.setText("Redrock Android • "+android.os.Build.MODEL);
        deviceState.setText("Status: "+currentStatus.toUpperCase());
        protectionTitle.setText("DEVICE PROTECTED");
        protectionStatus.setText("TraceCore is ready to protect this device.");
        loadDevice();
    }

    void loadDevice(){
        String r=Prefs.get(this,"recoveryId","");
        if(r.length()==0)return;
        new Thread(()->{
            try{
                JSONObject d=ApiClient.call(base(),"/api/devices/"+r,"GET",Prefs.get(this,"token",""),null);
                currentStatus=d.optString("status","protected");
                JSONObject loc=d.optJSONObject("lastLocation");
                String text="No location reported yet.";
                if(loc!=null){
                    double lat=loc.optDouble("latitude",loc.optDouble("lat",0));
                    double lon=loc.optDouble("longitude",loc.optDouble("lng",0));
                    if(lat!=0 || lon!=0)text="Last known location: "+lat+", "+lon;
                }
                String finalText=text;
                runOnUiThread(()->{
                    deviceState.setText("Status: "+currentStatus.toUpperCase());
                    locationText.setText(finalText);
                    updateProtection();
                });
            }catch(Exception ignored){}
        }).start();
    }

    void changeStatus(String s){
        String r=Prefs.get(this,"recoveryId","");
        if(r.length()==0){setStatus("Register the device first.");return;}
        setStatus("Updating device status...");
        new Thread(()->{
            try{
                JSONObject x=new JSONObject();
                x.put("status",s);
                ApiClient.call(base(),"/api/devices/"+r+"/status","POST",Prefs.get(this,"token",""),x);
                currentStatus=s;
                runOnUiThread(()->{
                    deviceState.setText("Status: "+s.toUpperCase());
                    updateProtection();
                    status.setText("Device marked "+s+".");
                });
            }catch(Exception e){setStatus("Status update: "+clean(e));}
        }).start();
    }

    void updateProtection(){
        protectionTitle.setText(currentStatus.equals("protected")?"DEVICE PROTECTED":"DEVICE "+currentStatus.toUpperCase());
        protectionStatus.setText(currentStatus.equals("lost")?
            "Lost mode is active. Check the last known location.":
            currentStatus.equals("stolen")?
            "Stolen status is active. Use TraceCore recovery tools.":
            currentStatus.equals("recovered")?
            "Device recovered. Protection is active again.":
            "TraceCore is monitoring this device.");
    }

    void findDevice(){
        String text=locationText.getText().toString();
        if(text.contains(":") && text.matches(".*-?[0-9]+\\.[0-9]+, -?[0-9]+\\.[0-9]+.*")){
            try{
                String p=text.substring(text.indexOf(":")+1).trim();
                String[] a=p.split(",");
                Intent i=new Intent(Intent.ACTION_VIEW, Uri.parse("geo:"+a[0].trim()+","+a[1].trim()+"?q="+a[0].trim()+","+a[1].trim()));
                startActivity(i);
                return;
            }catch(Exception ignored){}
        }
        loadDevice();
        setStatus("Refreshing last known location...");
    }

    void enableGps(){
        if(android.os.Build.VERSION.SDK_INT>=23 &&
           checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},100);
            return;
        }
        Prefs.bool(this,"tracking",true);
        startService(new Intent(this,LocationService.class));
        setStatus("GPS protection enabled.");
    }

    void setStatus(String s){
        runOnUiThread(()->status.setText(s));
    }

    String clean(Exception e){
        String s=e.getMessage();
        return s==null?e.getClass().getSimpleName():s.replace("java.lang.","");
    }
}
JAVA

# Ensure manifest uses the polished theme and launcher icon.
python - <<'PY'
from pathlib import Path
p=Path("app/src/main/AndroidManifest.xml")
s=p.read_text()
s=s.replace('android:theme="@style/Theme.TraceCore"', 'android:theme="@style/Theme.TraceCore"')
if 'android:icon=' not in s:
    s=s.replace('<application', '<application android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round"')
p.write_text(s)
PY

chmod +x upgrade-polished.sh

echo "=== BUILDING ==="
./gradlew clean assembleDebug

mkdir -p ~/storage/downloads
cp -f app/build/outputs/apk/debug/app-debug.apk ~/storage/downloads/TraceCore-V10-REAL.apk

echo
echo "=============================================="
echo "TRACECORE REAL APK CREATED"
echo "=============================================="
echo "APK:"
echo "~/storage/downloads/TraceCore-V10-REAL.apk"
echo
echo "Install this APK manually."
