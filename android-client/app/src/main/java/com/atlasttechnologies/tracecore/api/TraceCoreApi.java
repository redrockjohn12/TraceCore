package com.atlasttechnologies.tracecore.api;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class TraceCoreApi {
    private final String baseUrl;
    public TraceCoreApi(String baseUrl) { this.baseUrl = baseUrl.replaceAll("/$", ""); }

    public String login(String email, String password) throws Exception {
        return request("POST", "/api/auth/login", "{\"email\":\""+esc(email)+"\",\"password\":\""+esc(password)+"\"}", null);
    }
    public String issueDeviceCredential(String ownerToken, String recoveryId) throws Exception {
        return request("POST", "/api/devices/"+enc(recoveryId)+"/device-credential", "{}", "Bearer " + ownerToken);
    }
    public String deviceMe(String deviceCredential) throws Exception {
        return request("GET", "/api/device/me", null, "Device " + deviceCredential);
    }
    public String sendLocation(String deviceCredential, double lat, double lon, float accuracy) throws Exception {
        String json = "{\"latitude\":"+lat+",\"longitude\":"+lon+",\"accuracy\":"+accuracy+"}";
        return request("POST", "/api/device/location", json, "Device " + deviceCredential);
    }
    public String heartbeat(String deviceCredential) throws Exception {
        return request("POST", "/api/device/heartbeat", "{}", "Device " + deviceCredential);
    }

    private String request(String method, String path, String body, String authorization) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(baseUrl + path).openConnection();
        c.setRequestMethod(method); c.setConnectTimeout(10000); c.setReadTimeout(15000);
        c.setRequestProperty("Accept", "application/json");
        if (authorization != null) c.setRequestProperty("Authorization", authorization);
        if (body != null) { c.setRequestProperty("Content-Type", "application/json"); c.setDoOutput(true); try(OutputStream out=c.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));} }
        int code=c.getResponseCode();
        java.io.InputStream stream = code>=400 ? c.getErrorStream() : c.getInputStream();
        BufferedReader reader=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8));
        StringBuilder response=new StringBuilder(); String line; while((line=reader.readLine())!=null)response.append(line); reader.close(); c.disconnect();
        if(code>=400)throw new Exception("HTTP "+code+": "+response);
        return response.toString();
    }
    private static String esc(String s){return String.valueOf(s).replace("\\","\\\\").replace("\"","\\\"");}
    private static String enc(String s) throws Exception{return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8.toString());}
}
