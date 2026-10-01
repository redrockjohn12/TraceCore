package com.atlastechnologies.tracecore;

import java.io.*;
import java.net.*;
import org.json.JSONObject;

public class ApiClient {

    public static JSONObject call(
            String base,
            String path,
            String method,
            String token,
            JSONObject body
    ) throws Exception {

        if (base == null || base.trim().isEmpty()) {
            throw new Exception("Server URL is empty.");
        }

        base = base.trim();

        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }

        if (!path.startsWith("/")) {
            path = "/" + path;
        }

        URL url = new URL(base + path);
        HttpURLConnection c = (HttpURLConnection) url.openConnection();

        c.setRequestMethod(method);
        c.setConnectTimeout(10000);
        c.setReadTimeout(20000);
        c.setRequestProperty("Accept", "application/json");
        c.setRequestProperty("Content-Type", "application/json");

        if (token != null && !token.isEmpty()) {
            c.setRequestProperty("Authorization", "Bearer " + token);
        }

        if (body != null && !"GET".equalsIgnoreCase(method)) {
            c.setDoOutput(true);

            byte[] data = body.toString().getBytes("UTF-8");

            OutputStream os = c.getOutputStream();
            os.write(data);
            os.flush();
            os.close();
        }

        int code = c.getResponseCode();

        InputStream stream;

        if (code >= 200 && code < 400) {
            stream = c.getInputStream();
        } else {
            stream = c.getErrorStream();
        }

        if (stream == null) {
            throw new Exception("Server returned HTTP " + code);
        }

        BufferedReader reader =
                new BufferedReader(new InputStreamReader(stream, "UTF-8"));

        StringBuilder result = new StringBuilder();
        String line;

        while ((line = reader.readLine()) != null) {
            result.append(line);
        }

        reader.close();
        c.disconnect();

        String response = result.toString().trim();

        if (response.isEmpty()) {
            if (code >= 200 && code < 300) {
                return new JSONObject();
            }
            throw new Exception("Server returned HTTP " + code);
        }

        if (response.startsWith("<!DOCTYPE") ||
            response.startsWith("<html") ||
            response.startsWith("<HTML")) {
            throw new Exception(
                    "Server returned HTML instead of JSON (HTTP " + code + ")."
            );
        }

        JSONObject json;

        try {
            json = new JSONObject(response);
        } catch (Exception e) {
            throw new Exception(
                    "Invalid server response (HTTP " + code + "): " +
                    response.substring(0, Math.min(180, response.length()))
            );
        }

        if (code < 200 || code >= 300) {
            String message =
                    json.optString("message",
                    json.optString("error",
                    "Server returned HTTP " + code));

            throw new Exception(message);
        }

        return json;
    }
}
