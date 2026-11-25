package com.changxin.ams.unit;

import static com.changxin.ams.Json.*;
import static org.assertj.core.api.Assertions.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("JSON 辅助方法")
class JsonHelpersTest {

    @Test
    void buildsOrderedMapsFromPairs() {
        var map = m("a", 1, "b", null);
        assertThat(map).containsExactly(entry("a", 1), entry("b", null));
    }

    @Test
    void normalizesUnexpectedTypesToEmptyCollections() {
        assertThat(obj("text")).isEmpty();
        assertThat(obj(null)).isEmpty();
        assertThat(rows(Map.of("rows", List.of()))).isEmpty();
        assertThat(list("x")).isEmpty();
    }

    @Test
    void stringAndNumberConversionsAreNullSafe() {
        var row = m("TEXT", "value", "NUM", "12", "DOUBLE", 3.9, "NULL", null);
        assertThat(s(row, "TEXT")).isEqualTo("value");
        assertThat(s(row, "NULL")).isEmpty();
        assertThat(n(row, "NUM")).isEqualTo(12);
        assertThat(n(row, "DOUBLE")).isEqualTo(3);
        assertThat(n(row, "MISSING")).isZero();
        assertThat(str(null)).isEmpty();
    }

    @Test
    void comparesValuesAsStringsAndTreatsOnlyNAsInactive() {
        var row = m("ACTIVE", "N");
        assertThat(eq(row, "ACTIVE", "N")).isTrue();
        assertThat(active(row)).isFalse();
        assertThat(active(m())).isTrue();
        assertThat(active(m("ACTIVE", "Y"))).isTrue();
        assertThat(eq(m("X", 10), "X", "10")).isTrue();
    }

    @Test
    void parsesInstantAndFallsBackForInvalidValues() {
        assertThat(time("1970-01-01T00:00:01Z")).isEqualTo(1000L);
        assertThat(time("not-a-date")).isZero();
        assertThat(time(null)).isZero();
    }

    @Test
    void requireThrowsBusinessExceptionWithStatus() {
        assertThatCode(() -> require(true, "ok")).doesNotThrowAnyException();
        assertThatThrownBy(() -> require(false, "必须填写"))
                .isInstanceOf(ApiException.class)
                .hasMessage("必须填写")
                .extracting(e -> ((ApiException) e).status)
                .isEqualTo(400);
    }

    @Test
    void cleanReturnsDeepCopyWithSecretsRemoved() {
        var source = m("USER_ID", "E0043258", "PASSWORD", "plain", "PASSWORD_HASH", "hash");
        var cleaned = clean(source);
        assertThat(cleaned).containsOnlyKeys("USER_ID");
        assertThat(source).containsKeys("PASSWORD", "PASSWORD_HASH");
    }

    @Test
    void encodeAndParseRoundTripNestedValues() {
        var original = Map.of("a", List.of(1, 2), "b", Map.of("c", "d"));
        assertThat(obj(parse(encode(original)))).isEqualTo(original);
        assertThatThrownBy(() -> parse("{not json"))
                .isInstanceOf(ApiException.class)
                .hasMessage("JSON 格式错误");
    }
}
