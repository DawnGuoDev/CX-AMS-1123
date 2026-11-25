package com.changxin.ams.e2e;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** TC-API-E2E-001: login, bootstrap, rejection and logout against a real HTTP process. */
@DisplayName("TC-API-E2E-001 认证主链路与未授权拒绝")
class BackendAuthE2ETest extends E2ETestBase {

    @Test
    void shouldLoginBootstrapAndRejectUnauthorizedAccess() {
        var anonymous = client.anonymousGet("/api/bootstrap");
        assertThat(anonymous.status()).isEqualTo(401);
        assertThat(anonymous.ok()).isFalse();
        assertThat(anonymous.text("/message")).isNotBlank();

        var wrong = client.post("/api/login", Map.of("userId", ADMIN, "password", "wrong-password"));
        assertThat(wrong.status()).isEqualTo(401);
        assertThat(wrong.ok()).isFalse();

        var login = client.post("/api/login", Map.of("userId", ADMIN, "password", INITIAL_PASSWORD))
                .requireOk("login");
        client.token(login.text("/token"));
        assertThat(login.text("/token")).matches("[0-9a-f]{64}");
        assertThat(login.text("/user/USER_ID")).isEqualTo(ADMIN);
        assertThat(login.body()).doesNotContain("PASSWORD_HASH");

        var bootstrap = client.get("/api/bootstrap").requireOk("bootstrap");
        assertThat(bootstrap.json().path("nav")).isNotEmpty();
        bootstrap.json().path("nav").forEach(node -> {
            if (!node.path("path").asText("").isBlank()) {
                assertThat(node.path("path").asText()).startsWith("#/");
            }
        });
        assertThat(bootstrap.json().path("options").path("factory").isArray()).isTrue();
        assertThat(bootstrap.json().path("meta").path("masters").path("SBRM_FACTORY").path("code").asText())
                .isEqualTo("SBRM_FACTORY");

        // A client without a token must be rejected, both with no header and with a stale one.
        var noToken = new E2EHttpClient(instance.baseUrl());
        assertThat(noToken.get("/api/bootstrap").status()).isEqualTo(401);

        client.post("/api/logout", Map.of()).requireOk("logout");
        assertThat(client.get("/api/bootstrap").status()).isEqualTo(401);

        client.login(ADMIN, INITIAL_PASSWORD);
        assertThat(client.get("/api/bootstrap").requireOk("bootstrap after re-login").status()).isEqualTo(200);
    }
}
