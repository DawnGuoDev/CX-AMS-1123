package com.changxin.ams.e2e;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Thin JSON client for backend E2E tests. All AMS APIs live under {@code /api/**} and every
 * response carries {@code ok}; failures include the status, path and a truncated body.
 */
final class E2EHttpClient {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final HttpClient http;
    private final String baseUrl;
    private String token;

    E2EHttpClient(String baseUrl) {
        this.baseUrl = baseUrl;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    record Response(int status, String body) {
        JsonNode json() {
            try {
                return body.isBlank() ? JSON.createObjectNode() : JSON.readTree(body);
            } catch (IOException e) {
                throw new AssertionError("Response is not JSON (status " + status + "): " + truncate(body), e);
            }
        }

        boolean ok() {
            return json().path("ok").asBoolean(false);
        }

        String text(String pointer) {
            var node = json().at(pointer);
            return node.isMissingNode() || node.isNull() ? null : node.asText();
        }

        Response requireOk(String step) {
            if (status != 200 || !ok()) {
                throw new AssertionError("Step [" + step + "] expected HTTP 200 with ok=true but got HTTP " + status
                        + ": " + truncate(body));
            }
            return this;
        }

        Response requireStatus(int expected, String step) {
            if (status != expected) {
                throw new AssertionError("Step [" + step + "] expected HTTP " + expected + " but got " + status
                        + ": " + truncate(body));
            }
            return this;
        }
    }

    /** Injects a token obtained elsewhere (for re-login assertions). */
    void token(String value) {
        this.token = value;
    }

    void login(String userId, String password) {
        var response = post("/api/login", Map.of("userId", userId, "password", password)).requireOk("login " + userId);
        token = response.text("/token");
        if (token == null || !token.matches("[0-9a-f]{64}")) {
            throw new AssertionError("Login must return a 64-hex token for " + userId);
        }
    }

    Response get(String path) {
        return send(request(path).GET().build());
    }

    Response post(String path, Object body) {
        return sendJson(request(path), "POST", body);
    }

    Response put(String path, Object body) {
        return sendJson(request(path), "PUT", body);
    }

    /** Sends a request without any Authorization header. */
    Response anonymousGet(String path) {
        return send(HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/json")
                .GET()
                .build());
    }

    private HttpRequest.Builder request(String path) {
        var builder = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/json");
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        return builder;
    }

    private Response sendJson(HttpRequest.Builder builder, String method, Object body) {
        try {
            return send(builder.method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)))
                    .header("Content-Type", "application/json")
                    .build());
        } catch (IOException e) {
            throw new AssertionError("Cannot serialize request body for " + method, e);
        }
    }

    private Response send(HttpRequest request) {
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            return new Response(response.statusCode(), response.body());
        } catch (IOException e) {
            throw new AssertionError("HTTP request failed: " + request.method() + " " + request.uri(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Interrupted during HTTP request", e);
        }
    }

    static String truncate(String body) {
        if (body == null) {
            return "";
        }
        return body.length() <= 1500 ? body : body.substring(0, 1500) + "...<truncated>";
    }
}
