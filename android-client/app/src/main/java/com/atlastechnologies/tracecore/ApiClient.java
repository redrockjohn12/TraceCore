package com.atlastechnologies.tracecore;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class ApiClient {

    private ApiClient() {}

    public static JSONObject call(
            String base,
            String path,
            String method,
            String token,
            JSONObject body
    ) throws Exception {

        String cleanBase = base == null ? "" : base.trim();

        while (cleanBase.endsWith("/")) {
            cleanBase = cleanBase.substring(0, cleanBase.length() - 1);
        }

        String cleanPath = path == null ? "" : path.trim();

        if (!cleanPath.startsWith("/")) {
            cleanPath = "/" + cleanPath;
        }

        String urlString = cleanBase + cleanPath;

        HttpURLConnection connection =
                (HttpURLConnection) new URL(urlString).openConnection();

        connection.setRequestMethod(method);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setUseCaches(false);
        connection.setDoInput(true);

        connection.setRequestProperty(
                "Accept",
                "application/json"
        );

        connection.setRequestProperty(
                "Content-Type",
                "application/json; charset=UTF-8"
        );

        connection.setRequestProperty(
                "User-Agent",
                "TraceCore-Android/10.0"
        );

        if (token != null && !token.trim().isEmpty()) {
            connection.setRequestProperty(
                    "Authorization",
                    "Bearer " + token.trim()
            );
        }

        if (body != null &&
                ("POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method))) {

            connection.setDoOutput(true);

            byte[] data =
                    body.toString().getBytes(StandardCharsets.UTF_8);

            connection.setFixedLengthStreamingMode(data.length);

            try (OutputStream output =
                         connection.getOutputStream()) {

                output.write(data);
                output.flush();
            }
        }

        int status = connection.getResponseCode();

        InputStream stream;

        if (status >= 400) {
            stream = connection.getErrorStream();
        } else {
            stream = connection.getInputStream();
        }

        String response = "";

        if (stream != null) {

            StringBuilder result = new StringBuilder();

            try (BufferedReader reader =
                         new BufferedReader(
                                 new InputStreamReader(
                                         stream,
                                         StandardCharsets.UTF_8))) {

                String line;

                while ((line = reader.readLine()) != null) {
                    result.append(line);
                }
            }

            response = result.toString().trim();
        }

        connection.disconnect();

        if (response.isEmpty()) {

            if (status >= 200 && status < 300) {
                return new JSONObject();
            }

            throw new Exception(
                    "Server returned HTTP " + status +
                    " with an empty response"
            );
        }

        if (response.startsWith("<!DOCTYPE")
                || response.startsWith("<html")
                || response.startsWith("<HTML")
                || response.contains("<html")) {

            String preview = response;

            if (preview.length() > 300) {
                preview = preview.substring(0, 300);
            }

            throw new Exception(
                    "Server returned HTML instead of JSON. HTTP "
                            + status
                            + ". URL: "
                            + urlString
                            + ". Response: "
                            + preview
            );
        }

        JSONObject json;

        try {
            json = new JSONObject(response);
        } catch (Exception jsonError) {

            String preview = response;

            if (preview.length() > 300) {
                preview = preview.substring(0, 300);
            }

            throw new Exception(
                    "Invalid JSON from server. HTTP "
                            + status
                            + ". Response: "
                            + preview
            );
        }

        if (status < 200 || status >= 300) {

            String error =
                    json.optString(
                            "error",
                            "HTTP " + status
                    );

            throw new Exception(error);
        }

        return json;
    }
}
