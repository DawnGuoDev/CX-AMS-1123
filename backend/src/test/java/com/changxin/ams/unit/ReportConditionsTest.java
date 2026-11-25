package com.changxin.ams.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.changxin.ams.Json;
import com.changxin.ams.Reports;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Report filtering rules. These are pure evaluations of {@link Reports#query} against an in-memory
 * store stub, so a broken operator is caught without booting Spring or H2.
 */
@DisplayName("报表查询条件运算")
class ReportConditionsTest {

    private final com.changxin.ams.Store store = org.mockito.Mockito.mock(com.changxin.ams.Store.class);
    private final com.changxin.ams.AlarmEngine engine = org.mockito.Mockito.mock(com.changxin.ams.AlarmEngine.class);

    private final Reports reports = new Reports(store, engine);

    private void givenDefinitionsAndAlarms() {
        org.mockito.Mockito.clearInvocations(store, engine);
        var definition = Json.m(
                "REPORT_ID", "AVPA004",
                "REPORT_NAME", "process",
                "ATLEAST_ONE_CONDITION", "Y",
                "COLUMNS", List.of(
                        Json.m("field", "TITLE", "label", "警报标题"),
                        Json.m("field", "CREATE_DT", "label", "创建时间"),
                        Json.m("field", "EQP_ID", "label", "机台代码")));
        org.mockito.Mockito.when(store.mustFind("report_defs", "REPORT_ID", "AVPA004")).thenReturn(definition);
        var alarms = List.of(
                Json.m("ALARM_KEY", "A1", "TITLE", "Printer no dye", "EQP_ID", "EQP01", "CREATE_DT", "2026-01-01T10:00:00Z"),
                Json.m("ALARM_KEY", "A2", "TITLE", "Overheat", "EQP_ID", "EQP02", "CREATE_DT", "2026-01-01T12:00:00Z"),
                Json.m("ALARM_KEY", "A3", "TITLE", "Offset no dye", "EQP_ID", "EQP03", "CREATE_DT", "2026-01-02T09:30:00Z"));
        org.mockito.Mockito.when(store.table("alarms")).thenReturn(new java.util.ArrayList<>(alarms));
        org.mockito.Mockito.when(store.table("alarm_transactions")).thenReturn(new java.util.ArrayList<>());
        org.mockito.Mockito.when(engine.enrich(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.isNull()))
                .thenAnswer(invocation -> Json.copy(invocation.getArgument(0)));
    }

    private static Map<String, Object> text(String operator, String value) {
        var condition = new LinkedHashMap<String, Object>();
        condition.put("enabled", true);
        condition.put("operator", operator);
        condition.put("value", value);
        return Json.m("TITLE", condition);
    }

    @Test
    void requiresAtLeastOneEnabledConditionWithValue() {
        givenDefinitionsAndAlarms();
        assertThatThrownBy(() -> reports.query("AVPA004", Map.of()))
                .hasMessageContaining("至少选择一个查询条件");
    }

    @Test
    void containsAndNotContainsAreCaseInsensitive() {
        givenDefinitionsAndAlarms();
        assertThat(titles(reports.query("AVPA004", text("contains", "NO DYE"))))
                .containsExactly("Offset no dye", "Printer no dye");
        assertThat(titles(reports.query("AVPA004", text("notContains", "no dye"))))
                .containsExactly("Overheat");
    }

    @Test
    void startsEndsAndEqualityOperators() {
        givenDefinitionsAndAlarms();
        assertThat(titles(reports.query("AVPA004", text("starts", "printer")))).containsExactly("Printer no dye");
        assertThat(titles(reports.query("AVPA004", text("ends", "DYE")))).containsExactly("Offset no dye", "Printer no dye");
        assertThat(titles(reports.query("AVPA004", text("eq", "overheat")))).containsExactly("Overheat");
        assertThat(titles(reports.query("AVPA004", text("neq", "overheat")))).containsExactly("Offset no dye", "Printer no dye");
    }

    @Test
    void dateRangeIsInclusiveOfBothBounds() {
        givenDefinitionsAndAlarms();
        var condition = new LinkedHashMap<String, Object>();
        condition.put("enabled", true);
        condition.put("operator", "between");
        condition.put("from", "2026-01-01T00:00:00Z");
        condition.put("to", "2026-01-01T23:59:59Z");
        var rows = reports.query("AVPA004", Json.m("CREATE_DT", condition));
        assertThat(rows).extracting(row -> row.get("ALARM_KEY")).containsExactly("A2", "A1");
    }

    @Test
    void dateComparisonOperatorsAndInvalidFieldAreRejected() {
        givenDefinitionsAndAlarms();
        var condition = new LinkedHashMap<String, Object>();
        condition.put("enabled", true);
        condition.put("operator", "gte");
        condition.put("value", "2026-01-02T00:00:00Z");
        assertThat(titles(reports.query("AVPA004", Json.m("CREATE_DT", condition)))).containsExactly("Offset no dye");

        assertThatThrownBy(() -> reports.query("AVPA004", Json.m("NOT_A_COLUMN", condition)))
                .hasMessageContaining("查询字段无效");
    }

    private static List<String> titles(List<Map<String, Object>> rows) {
        return rows.stream().map(row -> String.valueOf(row.get("TITLE"))).toList();
    }
}
