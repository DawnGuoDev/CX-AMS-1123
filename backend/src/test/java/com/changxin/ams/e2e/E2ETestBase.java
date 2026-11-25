package com.changxin.ams.e2e;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;

/**
 * Boots one real AMS process per test class and exposes an authenticated client.
 *
 * <p>Text cases: {@code docs/e2e/backend-api-e2e.md}. Disabled by default because it needs the
 * packaged jar; run with {@code ./scripts/run-java-e2e.sh} (sets {@code ams.e2e.enabled=true}).
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
abstract class E2ETestBase {

    static final String ADMIN = "E0043258";
    static final String INITIAL_PASSWORD = "123456";

    protected E2EInstance instance;
    protected E2EHttpClient client;

    @BeforeAll
    void startInstance() {
        org.junit.jupiter.api.Assumptions.assumeTrue(
                Boolean.getBoolean("ams.e2e.enabled"),
                "Backend HTTP E2E is disabled; run ./scripts/run-java-e2e.sh");
        instance = E2EInstance.start();
        client = new E2EHttpClient(instance.baseUrl());
        client.login(ADMIN, INITIAL_PASSWORD);
    }

    @AfterAll
    void stopInstance() {
        if (instance != null) {
            instance.close();
        }
    }

    protected static void assertContainsRow(List<Map<String, Object>> rows, String field, String value) {
        assertThat(rows).anySatisfy(row -> assertThat(String.valueOf(row.get(field))).isEqualTo(value));
    }
}
