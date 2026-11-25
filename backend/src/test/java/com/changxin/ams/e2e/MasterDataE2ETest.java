package com.changxin.ams.e2e;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** TC-API-E2E-002: factory master add / duplicate / edit / hide / history / restore. */
@DisplayName("TC-API-E2E-002 厂别主档增改停用与历史")
class MasterDataE2ETest extends E2ETestBase {

    private static final String PATH = "/api/master/SBRM_FACTORY";

    private String createdKey;

    @AfterEach
    void deactivateTestFactory() {
        if (createdKey == null) {
            return;
        }
        try {
            client.post(PATH + "/" + createdKey + "/hide", Map.of());
        } catch (RuntimeException ignored) {
            // The isolated database is discarded with the instance anyway.
        }
        createdKey = null;
    }

    @Test
    void shouldCreateUpdateHideAndRestoreFactory() {
        var code = "E2E" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        var created = client.post(PATH, Map.of(
                        "FACTORY_ID", code,
                        "FACTORY_NAME", "E2E 厂别",
                        "FACTORY_DESC", "created by e2e"))
                .requireOk("create factory");
        var key = created.text("/row/FACTORY_KEY");
        assertThat(key).isNotBlank();
        createdKey = key;
        assertThat(created.text("/row/FACTORY_ID")).isEqualTo(code);
        assertThat(created.text("/row/ACTIVE")).isEqualTo("Y");

        var visible = client.get(PATH + "?showHidden=0").requireOk("list factories");
        assertContainsRow(toRows(visible.json().path("rows")), "FACTORY_ID", code);

        var duplicate = client.post(PATH, Map.of("FACTORY_ID", code, "FACTORY_NAME", "duplicate"));
        assertThat(duplicate.status()).isEqualTo(400);
        assertThat(duplicate.ok()).isFalse();
        assertThat(duplicate.text("/message")).contains("唯一");

        var missing = client.post(PATH, Map.of("FACTORY_NAME", "no code"));
        assertThat(missing.status()).isEqualTo(400);
        assertThat(missing.text("/message")).contains("必填");

        client.put(PATH + "/" + key, Map.of("FACTORY_NAME", "E2E 厂别（修改）"))
                .requireOk("update factory");
        var updated = client.get(PATH + "?showHidden=0").requireOk("list after update");
        assertThat(rowsWhere(updated.json().path("rows"), "FACTORY_KEY", key))
                .singleElement()
                .satisfies(row -> assertThat(row.get("FACTORY_NAME")).isEqualTo("E2E 厂别（修改）"));

        client.post(PATH + "/" + key + "/hide", Map.of()).requireOk("hide factory");
        assertThat(rowsWhere(client.get(PATH + "?showHidden=0").requireOk("list hidden").json().path("rows"), "FACTORY_KEY", key))
                .isEmpty();
        var hidden = rowsWhere(client.get(PATH + "?showHidden=1").requireOk("list all").json().path("rows"), "FACTORY_KEY", key);
        assertThat(hidden).singleElement().satisfies(row -> assertThat(row.get("ACTIVE")).isEqualTo("N"));

        var history = client.get(PATH + "/history?key=" + key).requireOk("history");
        var actions = toRows(history.json().path("rows")).stream().map(row -> row.get("ACTION")).toList();
        assertThat(actions).contains("AddNew", "Modify", "Hide");
        assertThat(toRows(history.json().path("rows"))).allSatisfy(row -> {
            assertThat(row.get("TRX_DT")).isNotNull();
            assertThat(row.get("USER_ID")).isEqualTo(ADMIN);
        });

        client.post(PATH + "/" + key + "/show", Map.of()).requireOk("restore factory");
        var restored = rowsWhere(client.get(PATH + "?showHidden=0").requireOk("list restored").json().path("rows"), "FACTORY_KEY", key);
        assertThat(restored).singleElement().satisfies(row -> assertThat(row.get("ACTIVE")).isEqualTo("Y"));
    }

    private static List<Map<String, Object>> rowsWhere(com.fasterxml.jackson.databind.JsonNode rows, String field, String value) {
        return toRows(rows).stream().filter(row -> value.equals(String.valueOf(row.get(field)))).toList();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> toRows(com.fasterxml.jackson.databind.JsonNode node) {
        return com.changxin.ams.Json.MAPPER.convertValue(node, List.class);
    }
}
