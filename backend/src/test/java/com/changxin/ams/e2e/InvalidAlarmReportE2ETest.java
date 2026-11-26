package com.changxin.ams.e2e;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * TC-API-E2E-006: every failure branch of {@code POST /api/alarms/test} keeps its 422 contract and
 * leaves exactly one invalid alarm, which the AVPA014 report serves through definition, query,
 * export and authenticated-only access over real HTTP.
 *
 * <p>Seed facts: {@code F01=Fab01}, {@code F02} is not bound to {@code SS03}, {@code PRT_NODYE} is
 * an active setting of {@code F01/SS03/EQP01}. Trigger titles share a unique marker so the report
 * can be narrowed to rows written by this run.
 */
@DisplayName("TC-API-E2E-006 无效警报留存与 AVPA014 报表查询汇出")
class InvalidAlarmReportE2ETest extends E2ETestBase {

    private static final String REPORT = "AVPA014";
    private static final String PATH = "/api/reports/" + REPORT;
    private static final String DEFINITION = "/api/report-defs/" + REPORT;
    private static final List<String> REASONS = List.of(
            "未设定厂别", "未设定子系统", "未设定机台", "找不到事件", "警报设定未启用", "忽略相同警报");

    @Test
    void shouldPersistFailuresAndServeReport() throws Exception {
        // 1) The report definition keeps the existing definition contract (columns, conditions, no forced filter).
        var definition = client.get(DEFINITION).requireOk("report definition");
        assertThat(definition.text("/row/REPORT_NAME")).isEqualTo("无效警报查询");
        assertThat(definition.text("/row/ATLEAST_ONE_CONDITION")).isEqualTo("N");
        assertThat(fields(definition.json().path("row").path("COLUMNS"))).containsExactly(
                "INVALID_ID", "CREATE_DT", "REASON", "FACTORY_ID", "FACTORY_NAME", "SUB_SYS_ID", "SUB_SYS_NAME",
                "EQP_ID", "ALARM_INFO_ID", "TITLE", "RECEIVE_TYPE", "SOURCE_TYPE");
        assertThat(fields(definition.json().path("row").path("CONDITIONS"))).contains(
                "CREATE_DT", "REASON", "FACTORY_ID", "SUB_SYS_ID", "EQP_ID", "ALARM_INFO_ID");

        // 2) Each invalid branch reachable without editing event levels: unchanged 422 +
        // exactly one persisted record.
        var marker = "E2E-INV-" + UUID.randomUUID().toString().substring(0, 8);
        // "找不到事件" is tried first: it does not create an alarm, so the later duplicate-suppression
        // case still starts from a clean four-key combination.
        assertInvalid(body("F01", "SS03", "EQP01", "MISSING_ALARM", marker + "-event"), "找不到事件",
                marker + "-event");
        assertInvalid(body("MISSING_FACTORY", "SS03", "EQP01", "PRT_NODYE", marker + "-factory"), "未设定厂别",
                marker + "-factory");
        assertInvalid(body("F02", "SS03", "EQP01", "PRT_NODYE", marker + "-subsys"), "未设定子系统",
                marker + "-subsys");
        assertInvalid(body("F01", "SS03", "MISSING_EQP", "PRT_NODYE", marker + "-eqp"), "未设定机台",
                marker + "-eqp");
        var settingKey = alarmSettingKey("PRT_NODYE", "EQP01");
        client.put("/api/master/AVMA009/" + settingKey, Map.of("ACTIVE", "N"))
                .requireOk("disable alarm setting");
        try {
            assertInvalid(body("F01", "SS03", "EQP01", "PRT_NODYE", marker + "-disabled"), "警报设定未启用",
                    marker + "-disabled");
        } finally {
            client.put("/api/master/AVMA009/" + settingKey, Map.of("ACTIVE", "Y"))
                    .requireOk("restore alarm setting");
        }

        // A successful trigger followed by the same four keys inside the ignore window is rejected.
        client.post("/api/alarms/test", body("F01", "SS03", "EQP01", "PRT_NODYE", marker + "-source"))
                .requireOk("trigger source alarm");
        assertInvalid(body("F01", "SS03", "EQP01", "PRT_NODYE", marker + "-duplicate"), "忽略相同警报",
                marker + "-duplicate");

        // 未设定层级1 / 未设定发送人员 need event-level master edits; their persistence is covered by
        // WorkflowIntegrationTest, here we only pin the unchanged failure contract over HTTP.
        assertFailureOnly(body("F01", "SS03", "EQP01", "PRT_MOTOR_ERR", marker + "-level1"), "未设定层级1");

        // 3) A successful trigger is not an invalid alarm.
        var success = client.post("/api/alarms/test",
                body("F01", "SS03", "EQP01", "PRT_NODYE", marker + "-success"));
        assertThat(success.ok()).isTrue();
        assertThat(success.text("/alarm/STATUS")).isEqualTo("Process");

        // 4) Range query returns exactly this run's failures in CREATE_DT descending order.
        var rows = invalidRows(Map.of("TITLE", textFilter("contains", marker)));
        assertThat(rows).hasSize(REASONS.size());
        assertThat(rows.stream().map(r -> r.path("REASON").asText()).toList())
                .containsExactlyInAnyOrderElementsOf(REASONS);
        var times = rows.stream().map(r -> Instant.parse(r.path("CREATE_DT").asText())).toList();
        var descending = new ArrayList<>(times);
        descending.sort((a, b) -> b.compareTo(a));
        assertThat(times).isEqualTo(descending);

        // Non-existent master codes keep the raw input; names may be empty for missing masters.
        // The 找不到事件 record is the oldest here because it was triggered first.
        assertThat(rows.get(rows.size() - 1).path("REASON").asText()).isEqualTo("找不到事件");
        var missingFactory = only(rows, "REASON", "未设定厂别");
        assertThat(missingFactory.path("FACTORY_ID").asText()).isEqualTo("MISSING_FACTORY");
        assertThat(missingFactory.path("FACTORY_NAME").asText()).isEmpty();
        assertThat(missingFactory.path("TITLE").asText()).isEqualTo(marker + "-factory");
        assertThat(missingFactory.path("INVALID_ID").asText()).isNotBlank();
        assertThat(missingFactory.path("RECEIVE_TYPE").asText()).isEqualTo("Mock");
        assertThat(missingFactory.path("SOURCE_TYPE").asText()).isEqualTo("Test");
        var missingEqp = only(rows, "REASON", "未设定机台");
        assertThat(missingEqp.path("EQP_ID").asText()).isEqualTo("MISSING_EQP");
        assertThat(missingEqp.path("FACTORY_NAME").asText()).isEqualTo("Fab01");
        assertThat(missingEqp.path("SUB_SYS_ID").asText()).isEqualTo("SS03");

        // 5) Time range is endpoint inclusive: the exact CREATE_DT used as both bounds matches the row.
        var oldest = only(rows, "REASON", "未设定厂别").path("CREATE_DT").asText();
        var endpoint = invalidRows(Map.of(
                "TITLE", textFilter("contains", marker),
                "CREATE_DT", dateFilter("between", oldest, oldest)));
        assertThat(endpoint).anySatisfy(r -> assertThat(r.path("REASON").asText()).isEqualTo("未设定厂别"));

        // 6) Intersection and operator semantics; empty result is a normal empty state.
        assertThat(invalidRows(Map.of(
                "TITLE", textFilter("contains", marker),
                "REASON", textFilter("eq", "未设定机台"),
                "EQP_ID", textFilter("contains", "MISSING")))).hasSize(1);
        assertThat(invalidRows(Map.of(
                "TITLE", textFilter("contains", marker),
                "REASON", textFilter("contains", "不存在的失效原因")))).isEmpty();
        assertThat(invalidRows(Map.of(
                "CREATE_DT", dateFilter("between", "2000-01-01T00:00:00Z", "2000-01-01T00:00:01Z")))).isEmpty();

        // Unknown condition fields stay rejected by the existing contract.
        var unknown = client.post(PATH + "/query", Map.of("conditions",
                Map.of("UNKNOWN_FIELD", textFilter("contains", marker))));
        assertThat(unknown.status()).isEqualTo(400);
        assertThat(unknown.ok()).isFalse();

        // 7) Export the current rows: declared columns only, reason and time cells carry the values.
        var exported = client.post(PATH + "/export", Map.of("rows", rows)).requireOk("export report");
        assertThat(exported.text("/filename")).isEqualTo("无效警报查询.xlsx");
        var bytes = Base64.getDecoder().decode(exported.text("/base64"));
        var formatter = new DataFormatter();
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            var sheet = book.getSheetAt(0);
            var header = new ArrayList<String>();
            var headerRow = sheet.getRow(0);
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                header.add(formatter.formatCellValue(headerRow.getCell(i)));
            }
            assertThat(header).containsExactlyElementsOf(labels(definition.json().path("row").path("COLUMNS")));
            assertThat(sheet.getLastRowNum()).isEqualTo(rows.size());
            var reasonColumn = header.indexOf("失效原因");
            var createColumn = header.indexOf("资料时间");
            var eqpColumn = header.indexOf("机台代码");
            var exportedEqp = false;
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                var row = sheet.getRow(i);
                assertThat(formatter.formatCellValue(row.getCell(createColumn))).isNotBlank();
                if ("MISSING_EQP".equals(formatter.formatCellValue(row.getCell(eqpColumn)))) {
                    exportedEqp = true;
                    assertThat(formatter.formatCellValue(row.getCell(reasonColumn))).isEqualTo("未设定机台");
                }
            }
            assertThat(exportedEqp).as("export contains the queried rows").isTrue();
        }

        // 8) No session, no data: definition, query and the trigger side effect are all rejected.
        var anonymous = new E2EHttpClient(instance.baseUrl());
        assertThat(anonymous.anonymousGet(DEFINITION).status()).isEqualTo(401);
        assertThat(anonymous.post(PATH + "/query", Map.of("conditions", Map.of())).status()).isEqualTo(401);
        assertThat(anonymous.post("/api/alarms/test",
                body("F01", "SS03", "EQP01", "PRT_NODYE", marker + "-anonymous")).status())
                .isEqualTo(401);
        assertThat(invalidRows(Map.of("TITLE", textFilter("contains", marker + "-anonymous")))).isEmpty();
    }

    private void assertInvalid(Map<String, Object> body, String reason, String title) {
        assertFailureOnly(body, reason);
        var rows = invalidRows(Map.of("TITLE", textFilter("eq", title)));
        assertThat(rows).as("%s must persist one invalid alarm".formatted(reason)).hasSize(1);
        assertThat(rows.get(0).path("REASON").asText()).isEqualTo(reason);
        assertThat(rows.get(0).path("TITLE").asText()).isEqualTo(title);
    }

    private void assertFailureOnly(Map<String, Object> body, String reason) {
        var response = client.post("/api/alarms/test", body);
        assertThat(response.status()).as("trigger %s".formatted(reason)).isEqualTo(422);
        assertThat(response.json().path("ok").asBoolean(true)).isFalse();
        assertThat(response.text("/message")).isEqualTo(reason);
    }

    private List<JsonNode> invalidRows(Map<String, Object> conditions) {
        var response = client.post(PATH + "/query", Map.of("conditions", conditions)).requireOk("query report");
        var rows = new ArrayList<JsonNode>();
        response.json().path("rows").forEach(rows::add);
        return rows;
    }

    /** Reads the active seed alarm setting key through the existing master list API. */
    private String alarmSettingKey(String alarmCode, String eqpKey) {
        var filters = "{\"FACTORY_KEY\":\"F01\",\"SUB_SYS_KEY\":\"SS03\",\"EQP_KEY\":\"%s\",\"ALARM_INFO_ID\":\"%s\"}"
                .formatted(eqpKey, alarmCode);
        var response = client.get("/api/master/AVMA009?showHidden=1&filters=" + filters)
                .requireOk("list alarm settings");
        for (JsonNode row : response.json().path("rows")) {
            if (eqpKey.equals(row.path("EQP_KEY").asText()) && alarmCode.equals(row.path("ALARM_INFO_ID").asText())) {
                return row.path("ALARM_INFO_KEY").asText();
            }
        }
        throw new AssertionError("Seed alarm setting not found for " + alarmCode + "/" + eqpKey);
    }

    private static JsonNode only(List<JsonNode> rows, String field, String value) {
        var matches = rows.stream().filter(r -> value.equals(r.path(field).asText())).toList();
        assertThat(matches).as("exactly one row with %s=%s".formatted(field, value)).hasSize(1);
        return matches.get(0);
    }

    private static Map<String, Object> body(String factoryKey, String subsysKey, String eqpKey, String alarmCode,
                                            String title) {
        var body = new LinkedHashMap<String, Object>();
        body.put("factoryKey", factoryKey);
        body.put("subsysKey", subsysKey);
        body.put("eqpKey", eqpKey);
        body.put("alarmCode", alarmCode);
        body.put("title", title);
        body.put("content", "e2e invalid alarm " + title);
        return body;
    }

    private static Map<String, Object> textFilter(String operator, String value) {
        return Map.of("enabled", true, "type", "text", "operator", operator, "value", value);
    }

    private static Map<String, Object> dateFilter(String operator, String from, String to) {
        return Map.of("enabled", true, "type", "date", "operator", operator, "from", from, "to", to);
    }

    private static List<String> fields(JsonNode array) {
        var values = new ArrayList<String>();
        array.forEach(c -> values.add(c.path("field").asText()));
        return values;
    }

    private static List<String> labels(JsonNode array) {
        var values = new ArrayList<String>();
        array.forEach(c -> values.add(c.path("label").asText()));
        return values;
    }
}
