package com.changxin.ams.e2e;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * TC-API-E2E-005: force-terminate over real HTTP (SPEC-AMS-ALARM-TERMINATE-001, REQ-001~004/006).
 *
 * <p>Complements {@code AlarmTerminateIntegrationTest} (engine level) with the wire contract the browser
 * depends on: status codes, error messages, {@code CAN_TERMINATE}, the process work list and report rows.
 * SMTP is not configured, so a fresh alarm stays {@code Process} and nobody can ACK — exactly the state an
 * operator terminates. Authorization comes from the live user master, never from the UI.
 */
@DisplayName("TC-API-E2E-005 警报强制中断接口契约")
class AlarmTerminateE2ETest extends E2ETestBase {

    private static final String NO_PERMISSION_USER = "E0043260";

    /** Each case reserves a distinct seed alarm setting: the trigger API ignores repeats per equipment. */
    private String trigger(String eqpKey, String alarmCode) {
        var title = "e2e terminate " + UUID.randomUUID().toString().substring(0, 8);
        var triggered = client.post("/api/alarms/test", Map.of(
                        "factoryKey", "F01", "subsysKey", "SS03", "eqpKey", eqpKey,
                        "alarmCode", alarmCode, "title", title, "content", "e2e terminate content"))
                .requireOk("trigger alarm " + eqpKey);
        assertThat(triggered.text("/alarm/STATUS")).isEqualTo("Process");
        return triggered.text("/alarm/ALARM_KEY");
    }

    private int alarmCount(String factoryKey, String subsysKey) {
        var summary = client.post("/api/reports/AVPA013/query", Map.of("conditions", Map.of()))
                .requireOk("AVPA013 summary");
        int total = 0;
        for (var row : summary.json().path("rows")) {
            if (factoryKey.equals(row.path("FACTORY_KEY").asText()) && subsysKey.equals(row.path("SUB_SYS_KEY").asText())) {
                total += row.path("ALARM_COUNT").asInt();
            }
        }
        return total;
    }

    private int terminateTransactionCount(String key) {
        var body = Map.of("conditions", Map.of(
                "TRX_TYPE", Map.of("enabled", true, "operator", "eq", "value", "AlarmTerminate")));
        var rows = client.post("/api/reports/AVPA007/query", body).requireOk("AVPA007 AlarmTerminate").json().path("rows");
        int count = 0;
        for (var row : rows) {
            if (key.equals(row.path("ALARM_KEY").asText())) {
                count++;
            }
        }
        return count;
    }

    private ObjectNode adminRow() {
        var users = client.get("/api/master/SBRM_USER").requireOk("user list").json().path("rows");
        for (var row : users) {
            if (ADMIN.equals(row.path("USER_ID").asText())) {
                return (ObjectNode) row;
            }
        }
        throw new AssertionError("seed user " + ADMIN + " must exist");
    }

    /** PUT replaces the whole record, so the permission is flipped on the current row instead of merged. */
    private void setAdminPermission(String value) {
        var row = adminRow();
        row.put("CAN_TERMINATE", value);
        row.remove("PASSWORD_HASH");
        client.put("/api/master/SBRM_USER/" + row.path("USER_KEY").asText(), row).requireOk("set CAN_TERMINATE=" + value);
        assertThat(adminRow().path("CAN_TERMINATE").asText()).isEqualTo(value);
    }

    @Test
    void shouldTerminateOverHttpAndConvergeNotificationsAndReports() {
        var key = trigger("EQP01", "PRT_NODYE");
        var processingBefore = alarmCount("F01", "SS03");

        // REQ-002: while Process and authorized the action is flagged; CAN_ACK stays false (no mail was
        // delivered), which proves termination does not depend on acknowledgment.
        var before = client.get("/api/alarms/" + key).requireOk("detail before terminate");
        assertThat(before.json().path("alarm").path("CAN_TERMINATE").asBoolean()).isTrue();
        assertThat(before.json().path("alarm").path("CAN_ACK").asBoolean()).isFalse();
        assertThat(before.json().path("alarm").path("NOTIFICATIONS")).isNotEmpty();

        var terminated = client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "接口 E2E：机台已修复"))
                .requireOk("terminate alarm");
        assertThat(terminated.json().path("terminated").asBoolean()).isTrue();
        assertThat(terminated.text("/alarm/STATUS")).isEqualTo("Terminated");
        assertThat(terminated.text("/alarm/TERMINATE_CMT")).isEqualTo("接口 E2E：机台已修复");
        assertThat(terminated.text("/alarm/TERMINATE_USER_ID")).isEqualTo(ADMIN);
        assertThat(terminated.text("/alarm/TERMINATE_USER_NAME")).isEqualTo("陈柏睿");
        assertThat(terminated.text("/alarm/TERMINATE_DT")).isNotBlank();
        assertThat(terminated.text("/alarm/COMPLETE_DT")).isEqualTo(terminated.text("/alarm/TERMINATE_DT"));

        // REQ-004: the same transaction skips every queued notification and closes the active level.
        var after = client.get("/api/alarms/" + key).requireOk("detail after terminate");
        assertThat(after.json().path("alarm").path("CAN_TERMINATE").asBoolean()).isFalse();
        assertThat(after.json().path("alarm").path("NOTIFICATIONS")).isNotEmpty()
                .allSatisfy(notice -> {
                    assertThat(notice.path("RESULT").asText()).isEqualTo("Skipped");
                    assertThat(notice.path("MESSAGE").asText()).isEqualTo("警报已中断，取消发送");
                    assertThat(notice.path("SEND_DT").asText()).isNotBlank();
                });
        assertThat(after.json().path("alarm").path("LEVELS")).isNotEmpty()
                .allSatisfy(level -> assertThat(level.path("STATUS").asText()).isEqualTo("Closed"));
        assertThat(after.json().path("alarm").path("TRANSACTIONS")).anySatisfy(trx -> {
            assertThat(trx.path("TRX_TYPE").asText()).isEqualTo("AlarmTerminate");
            assertThat(trx.path("STATUS_BEFORE").asText()).isEqualTo("Process");
            assertThat(trx.path("STATUS_AFTER").asText()).isEqualTo("Terminated");
            assertThat(trx.path("NOTE").asText()).isEqualTo("接口 E2E：机台已修复");
        });

        // REQ-004: no longer listed for the work page nor for the acknowledgment inbox.
        assertThat(client.get("/api/alarms/process").requireOk("work list").json().path("rows")
                .findValuesAsText("ALARM_KEY")).doesNotContain(key);
        assertThat(client.get("/api/alarms/pending").requireOk("pending list").json().path("rows")
                .findValuesAsText("ALARM_KEY")).doesNotContain(key);

        // REQ-006: AVPA007 by transaction type, AVPA004 by status, AVPA013 no longer counting it.
        var byType = client.post("/api/reports/AVPA007/query", Map.of("conditions",
                Map.of("TRX_TYPE", Map.of("enabled", true, "operator", "eq", "value", "AlarmTerminate"))))
                .requireOk("AVPA007 by TRX_TYPE");
        assertThat(byType.json().path("rows")).anySatisfy(row -> {
            assertThat(row.path("ALARM_KEY").asText()).isEqualTo(key);
            assertThat(row.path("STATUS").asText()).isEqualTo("Terminated");
            assertThat(row.path("NOTE").asText()).isEqualTo("接口 E2E：机台已修复");
        });
        var byStatus = client.post("/api/reports/AVPA004/query", Map.of("conditions",
                Map.of("STATUS", Map.of("enabled", true, "operator", "eq", "value", "Terminated"))))
                .requireOk("AVPA004 by STATUS");
        assertThat(byStatus.json().path("rows")).anySatisfy(row -> {
            assertThat(row.path("ALARM_KEY").asText()).isEqualTo(key);
            assertThat(row.path("COMPLETE_DT").asText()).isNotBlank();
        });
        assertThat(alarmCount("F01", "SS03")).isEqualTo(processingBefore - 1);
    }

    @Test
    void shouldRejectUnauthorizedStatusAndInvalidReasonWithoutSideEffects() {
        var key = trigger("EQP01", "PRT_MOTOR_ERR");

        // REQ-001/003: the server, not the UI, decides permission.
        client.login(NO_PERMISSION_USER, INITIAL_PASSWORD);
        var denied = client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "越权尝试"));
        assertThat(denied.ok()).isFalse();
        assertThat(denied.status()).isEqualTo(400);
        assertThat(denied.text("/message")).isEqualTo("您没有强制中断权限");
        assertThat(client.get("/api/alarms/" + key).requireOk("detail as viewer")
                .json().path("alarm").path("CAN_TERMINATE").asBoolean()).isFalse();
        client.login(ADMIN, INITIAL_PASSWORD);

        // REQ-003: the reason is required after trimming and the 500 character limit is a 400.
        var blank = client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "   "));
        assertThat(blank.status()).isEqualTo(400);
        assertThat(blank.text("/message")).isEqualTo("请填写中断原因");
        var missing = client.post("/api/alarms/" + key + "/terminate", Map.of());
        assertThat(missing.status()).isEqualTo(400);
        assertThat(client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "x".repeat(501))).text("/message"))
                .isEqualTo("中断原因不可超过 500 个字符");

        // Nothing above changed the alarm and it is still offered to the authorised account.
        var untouched = client.get("/api/alarms/" + key).requireOk("detail after rejections");
        assertThat(untouched.text("/alarm/STATUS")).isEqualTo("Process");
        assertThat(untouched.text("/alarm/TERMINATE_DT")).isNull();
        assertThat(untouched.text("/alarm/CAN_TERMINATE")).isEqualTo("true");

        // The boundary is inclusive: exactly 500 characters is accepted.
        var accepted = client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "y".repeat(500)))
                .requireOk("terminate with 500 characters");
        assertThat(accepted.text("/alarm/TERMINATE_CMT")).hasSize(500);

        // A finished alarm cannot be terminated twice and no second transaction is written.
        var again = client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "再次中断"));
        assertThat(again.status()).isEqualTo(400);
        assertThat(again.text("/message")).isEqualTo("该警报已非处理中状态");
        assertThat(terminateTransactionCount(key)).isEqualTo(1);
    }

    /**
     * REQ-003: {@code :key} accepts {@code ALARM_KEY} or {@code ALARM_ID} (same lookup as the ack route),
     * so an operator can terminate from a report row that only shows the alarm id.
     */
    @Test
    void shouldLocateTheAlarmByAlarmIdAsWellAsByAlarmKey() {
        var key = trigger("EQP01", "PRT_NODYE");
        var alarmId = client.get("/api/alarms/" + key).requireOk("detail for ALARM_ID").text("/alarm/ALARM_ID");
        assertThat(alarmId).isNotBlank();

        var terminated = client.post("/api/alarms/" + alarmId + "/terminate", Map.of("cmt", "以警报识别码中断"))
                .requireOk("terminate by ALARM_ID");
        assertThat(terminated.text("/alarm/ALARM_KEY")).isEqualTo(key);
        assertThat(terminated.text("/alarm/STATUS")).isEqualTo("Terminated");

        // The alias is not a second alarm: releasing the ALARM_ID key can only hit the same record once.
        var direct = client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "重复中断"));
        assertThat(direct.status()).isEqualTo(400);
        assertThat(direct.text("/message")).isEqualTo("该警报已非处理中状态");
        assertThat(terminateTransactionCount(key)).isEqualTo(1);
    }

    @Test
    void shouldReturnNotFoundForUnknownAlarm() {
        var missing = client.post("/api/alarms/alarms-999999/terminate", Map.of("cmt", "不存在"));
        assertThat(missing.status()).isEqualTo(404);
        assertThat(missing.text("/message")).isEqualTo("警报不存在");
        assertThat(missing.ok()).isFalse();
    }

    @Test
    void shouldExposeTheTerminateWorkPageAndTheAlarmStatusOption() {
        var key = trigger("EQP01", "PRT_NODYE");

        // REQ-007: the work page lists Process alarms only and flags the action for the operator.
        var work = client.get("/api/alarms/process").requireOk("work list");
        assertThat(work.json().path("rows")).anySatisfy(row -> {
            assertThat(row.path("ALARM_KEY").asText()).isEqualTo(key);
            assertThat(row.path("STATUS").asText()).isEqualTo("Process");
            assertThat(row.path("CAN_TERMINATE").asBoolean()).isTrue();
        });
        assertThat(work.json().path("rows")).allSatisfy(row ->
                assertThat(row.path("STATUS").asText()).isEqualTo("Process"));

        // Bootstrap exposes the new menu entry and the appended status option.
        var bootstrap = client.get("/api/bootstrap").requireOk("bootstrap");
        assertThat(bootstrap.json().path("nav").findValuesAsText("key")).contains("ALARM_LIST");
        var statuses = bootstrap.json().path("options").path("alarmStatus").findValuesAsText("value");
        assertThat(statuses).containsExactly("Process", "Completed", "NoNextLevel", "Terminated");

        client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "作业页用例结束")).requireOk("terminate work item");
        assertThat(client.get("/api/alarms/process").requireOk("work list after terminate")
                .json().path("rows").findValuesAsText("ALARM_KEY")).doesNotContain(key);
    }

    @Test
    void shouldReadThePermissionFromTheLiveMasterRecord() {
        var key = trigger("EQP01", "PRT_NODYE");
        try {
            // REQ-001: revoking takes effect on the next request without a new login.
            setAdminPermission("N");
            assertThat(client.get("/api/alarms/" + key).requireOk("detail after revoke")
                    .json().path("alarm").path("CAN_TERMINATE").asBoolean()).isFalse();
            var denied = client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "撤销后尝试"));
            assertThat(denied.status()).isEqualTo(400);
            assertThat(denied.text("/message")).isEqualTo("您没有强制中断权限");

            // Granting it again restores both the flag and the action.
            setAdminPermission("Y");
            assertThat(client.get("/api/alarms/" + key).requireOk("detail after grant")
                    .json().path("alarm").path("CAN_TERMINATE").asBoolean()).isTrue();
            client.post("/api/alarms/" + key + "/terminate", Map.of("cmt", "恢复权限后中断"))
                    .requireOk("terminate after grant");
        } finally {
            // This instance is discarded after the class, but leave the seed state consistent anyway.
            setAdminPermission("Y");
        }
    }
}
