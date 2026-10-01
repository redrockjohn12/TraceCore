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
