package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class Auth {
    private static final long IDLE_TIMEOUT_MS = 1_800_000L;
    private record Session(String userKey, String loginAt, long seen) {}
    private final Map<String, Session> sessions = new HashMap<>();
    private final Store store;
    public Auth(Store store) { this.store = store; }
    public static String hash(String password) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(("ams::" + password).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public synchronized Map<String, Object> login(Map<String, Object> body) {
        var user = store.find("users", "USER_ID", s(body, "userId").trim());
        if (user == null || !active(user) || !MessageDigest.isEqual(
                s(user, "PASSWORD_HASH").getBytes(StandardCharsets.UTF_8),
                hash(s(body, "password")).getBytes(StandardCharsets.UTF_8)))
            throw new ApiException(401, "账号或密码错误，或账号已停用");
        sessions.entrySet().removeIf(e -> System.currentTimeMillis() - e.getValue().seen > IDLE_TIMEOUT_MS);
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        String at = now();
        sessions.put(token, new Session(s(user, "USER_KEY"), at, System.currentTimeMillis()));
        return m("ok", true, "token", token, "user", clean(user), "loginAt", at);
    }
    public synchronized Map<String, Object> user(String token) {
        Session session = sessions.get(token);
        if (session == null || System.currentTimeMillis() - session.seen > IDLE_TIMEOUT_MS) {
            sessions.remove(token); throw new ApiException(401, "登入已逾时，请重新登入");
        }
        var user = store.find("users", "USER_KEY", session.userKey);
        if (user == null || !active(user)) {
            sessions.remove(token); throw new ApiException(401, "账号已停用");
        }
        sessions.put(token, new Session(session.userKey, session.loginAt, System.currentTimeMillis()));
        return clean(user);
    }
    public synchronized String loginAt(String token) { var session = sessions.get(token); return session == null ? "" : session.loginAt; }
    public synchronized void logout(String token) { sessions.remove(token); }
}
