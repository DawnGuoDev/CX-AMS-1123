package com.changxin.ams.unit;

import static org.assertj.core.api.Assertions.assertThat;

import com.changxin.ams.Auth;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("密码哈希")
class AuthPasswordTest {

    @Test
    void hashesWithSha256HexAndSaltPrefix() {
        var hash = Auth.hash("123456");
        assertThat(hash).hasSize(64).matches("[0-9a-f]{64}");
        assertThat(hash).isEqualTo(Auth.hash("123456"));
    }

    @Test
    void differentPasswordsProduceDifferentHashes() {
        assertThat(Auth.hash("123456")).isNotEqualTo(Auth.hash("1234567"));
        assertThat(Auth.hash("")).isNotEqualTo(Auth.hash(" "));
    }

    @Test
    void initialPasswordMatchesTheSeedHash() throws Exception {
        // Seed users all share the initial password; the stored hash must stay compatible.
        try (var in = getClass().getResourceAsStream("/seed.json")) {
            var seed = com.changxin.ams.Json.obj(com.changxin.ams.Json.MAPPER.readValue(in, java.util.Map.class));
            var stored = com.changxin.ams.Json.s(com.changxin.ams.Json.rows(seed.get("users")).getFirst(), "PASSWORD_HASH");
            assertThat(Auth.hash("123456")).isEqualTo(stored);
        }
    }

    @Test
    void hashIsDeterministicForSameInput() {
        var once = Auth.hash("E2eAdmin.1234");
        assertThat(Auth.hash("E2eAdmin.1234")).isEqualTo(once);
        assertThat(once).doesNotContain("E2eAdmin.1234");
    }
}
