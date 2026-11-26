package com.changxin.ams.unit;

import static com.changxin.ams.Json.s;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.changxin.ams.ApiException;
import com.changxin.ams.Auth;
import com.changxin.ams.Store;
import java.util.ArrayList;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Session ownership rules. Mockito only replaces the JDBC transport; the store still reads the
 * packaged seed resource, so these tests validate authentication without booting Spring or H2.
 */
@DisplayName("会话隔离")
class AuthSessionTest {

    private Auth auth;
    private Map<String, Object> firstUser;

    @BeforeEach
    void createAuthFromSeed() throws Exception {
        var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn(new ArrayList<>());
        auth = new Auth(new Store(jdbc));
        firstUser = auth.login(Map.of("userId", "E0043258", "password", "123456"));
    }

    @Test
    void loginKeepsOtherSessionsOfSameUser() {
        var second = auth.login(Map.of("userId", "E0043258", "password", "123456"));
        var first = s(firstUser, "token");
        var secondToken = s(second, "token");

        assertThat(s(auth.user(first), "USER_ID")).isEqualTo("E0043258");
        assertThat(s(auth.user(secondToken), "USER_ID")).isEqualTo("E0043258");
    }

    @Test
    void loginIssuesUniqueToken() {
        var second = auth.login(Map.of("userId", "E0043258", "password", "123456"));

        var firstToken = s(firstUser, "token");
        var secondToken = s(second, "token");
        assertThat(firstToken).isNotEqualTo(secondToken);
        assertThat(firstToken).matches("[0-9a-f]{64}");
        assertThat(secondToken).matches("[0-9a-f]{64}");
    }

    @Test
    void logoutIsIdempotentForUnknownToken() {
        assertThatCode(() -> auth.logout("unknown")).doesNotThrowAnyException();
        assertThatCode(() -> auth.logout("")).doesNotThrowAnyException();
        assertThatThrownBy(() -> auth.user("unknown"))
                .isInstanceOf(ApiException.class)
                .hasMessage("登入已逾时，请重新登入")
                .extracting(e -> ((ApiException) e).status)
                .isEqualTo(401);
    }

    @Test
    void timeoutCleanupDoesNotRemoveFreshSessionsOfWorkmate() {
        var second = auth.login(Map.of("userId", "E0043258", "password", "123456"));

        // login() executes timeout cleanup, but the pre-existing token has just been renewed and must survive it.
        assertThatCode(() -> auth.user(s(firstUser, "token"))).doesNotThrowAnyException();
        assertThatCode(() -> auth.user(s(second, "token"))).doesNotThrowAnyException();
    }
}
