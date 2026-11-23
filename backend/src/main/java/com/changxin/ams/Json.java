package com.changxin.ams;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;

/** Helpers for the existing metadata-driven AMS record format. */
public final class Json {
    public static final ObjectMapper MAPPER = new ObjectMapper();
    private Json() {}
    public static Map<String, Object> m(Object... pairs) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) out.put(String.valueOf(pairs[i]), pairs[i + 1]);
        return out;
    }
    @SuppressWarnings("unchecked")
    public static Map<String, Object> obj(Object v) {
        return v instanceof Map ? (Map<String, Object>) v : new LinkedHashMap<>();
    }
    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> rows(Object v) {
        return v instanceof List ? (List<Map<String, Object>>) v : new ArrayList<>();
    }
    @SuppressWarnings("unchecked")
    public static List<Object> list(Object v) {
        return v instanceof List ? (List<Object>) v : new ArrayList<>();
    }
    public static String s(Map<String, Object> r, String k) { return str(r.get(k)); }
    public static String str(Object v) { return v == null ? "" : String.valueOf(v); }
    public static int n(Map<String, Object> r, String k) { return num(r.get(k)); }
    public static int num(Object v) {
        try { return (int) Double.parseDouble(str(v)); } catch (NumberFormatException e) { return 0; }
    }
    public static boolean eq(Map<String, Object> r, String k, Object v) { return s(r, k).equals(str(v)); }
    public static boolean active(Map<String, Object> r) { return !eq(r, "ACTIVE", "N"); }
    public static String now() { return Instant.now().toString(); }
    public static long time(Object v) {
        try { return Instant.parse(str(v)).toEpochMilli(); } catch (Exception e) { return 0; }
    }
    public static String encode(Object v) {
        try { return MAPPER.writeValueAsString(v); } catch (Exception e) { throw new IllegalArgumentException("资料无法序列化", e); }
    }
    public static Object parse(String v) {
        try { return MAPPER.readValue(v, Object.class); } catch (Exception e) { throw new ApiException(400, "JSON 格式错误"); }
    }
    public static Map<String, Object> copy(Map<String, Object> v) {
        return MAPPER.convertValue(v, new TypeReference<>() {});
    }
    public static Map<String, Object> clean(Map<String, Object> v) {
        Map<String, Object> out = copy(v);
        out.remove("PASSWORD_HASH"); out.remove("PASSWORD");
        return out;
    }
    public static void require(boolean condition, String message) {
        if (!condition) throw new ApiException(400, message);
    }
    public static final class ApiException extends RuntimeException {
        public final int status;
        public ApiException(int status, String message) { super(message); this.status = status; }
    }
}
