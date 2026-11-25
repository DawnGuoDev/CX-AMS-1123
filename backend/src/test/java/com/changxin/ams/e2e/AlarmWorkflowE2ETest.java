package com.changxin.ams.e2e;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * TC-API-E2E-003: trigger a test alarm, inspect it, then acknowledge it over HTTP.
 *
 * <p>SMTP is intentionally not configured: every delivery must be {@code Fail} (never a fake
 * success) and ACK must be refused until mail actually succeeds, which matches the product rule
 * that acknowledgment requires a delivered notification.
 */
@DisplayName("TC-API-E2E-003 测试告警触发、待确认与 ACK 闭环")
class AlarmWorkflowE2ETest extends E2ETestBase {

    @Test
    void shouldTriggerAlarmAndEnforceAckRules() {
        var options = client.get("/api/alarms/test/options?factoryKey=F01&subsysKey=SS03&eqpKey=EQP01")
                .requireOk("alarm test options");
        var codes = options.json().path("alarmCodes").findValuesAsText("value");
        assertThat(codes).contains("PRT_NODYE");

        var title = "e2e alarm " + UUID.randomUUID().toString().substring(0, 8);
        var triggered = client.post("/api/alarms/test", Map.of(
                        "factoryKey", "F01",
                        "subsysKey", "SS03",
                        "eqpKey", "EQP01",
                        "alarmCode", "PRT_NODYE",
                        "title", title,
                        "content", "e2e alarm content"))
                .requireOk("trigger test alarm");
        var key = triggered.text("/alarm/ALARM_KEY");
        assertThat(key).isNotBlank();
        assertThat(triggered.text("/alarm/STATUS")).isEqualTo("Process");
        assertThat(triggered.json().has("logOnly")).isFalse();

        // /alarms/pending lists what the current account may ACK. Without SMTP the first-level mail
        // delivery fails, so the alarm must NOT be ackable yet; the detail endpoint still returns it.
        var pending = client.get("/api/alarms/pending").requireOk("pending alarms");
        assertThat(pending.json().path("rows").findValuesAsText("ALARM_KEY")).doesNotContain(key);

        var detail = client.get("/api/alarms/" + key).requireOk("alarm detail");
        assertThat(detail.text("/alarm/TITLE")).isEqualTo(title);
        assertThat(detail.json().path("alarm").path("LEVEL_REQUIRED").asInt()).isPositive();
        var notifications = detail.json().path("alarm").path("NOTIFICATIONS");
        assertThat(notifications).isNotEmpty();
        for (var notice : notifications) {
            assertThat(notice.path("RESULT").asText()).isEqualTo("Pending");
            assertThat(notice.path("CHANNEL").asText()).isEqualTo("Email");
        }

        // Ack before any successful delivery must be refused (CAN_ACK=false), and the same request
        // must not inflate the acknowledgment counter.
        var earlyAck = client.post("/api/alarms/" + key + "/ack", Map.of("cmt", "too early"));
        assertThat(earlyAck.ok()).isFalse();
        assertThat(earlyAck.status()).isBetween(400, 499);
        assertThat(earlyAck.text("/message")).contains("待确认人员");

        var afterAckAttempt = client.get("/api/alarms/" + key).requireOk("detail after rejected ack");
        assertThat(afterAckAttempt.json().path("alarm").path("ACK_USERS")).isEmpty();
        assertThat(afterAckAttempt.json().path("alarm").path("LEVEL_ACK_COUNT").asInt()).isZero();
        assertThat(afterAckAttempt.json().path("alarm").path("STATUS").asText()).isEqualTo("Process");

        var unknown = client.get("/api/alarms/NOT-EXISTING").requireStatus(404, "unknown alarm");
        assertThat(unknown.ok()).isFalse();

    }
}
