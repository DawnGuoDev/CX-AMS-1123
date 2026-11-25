package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Single-instance transactional snapshot store. The lock covers validation,
 * mutation and durable commit, including scheduler work. Failed operations
 * restore the pre-transaction state; API callers never receive live references.
 */
@Component
public class Store {
    private final JdbcTemplate jdbc;
    private Map<String, Object> data;
    public final Map<String, Object> metadata;

    public Store(JdbcTemplate jdbc) throws IOException {
        this.jdbc = jdbc;
        metadata = load("metadata.json");
        jdbc.execute("CREATE TABLE IF NOT EXISTS AMS_STATE (ID INT PRIMARY KEY, PAYLOAD CLOB NOT NULL)");
        var saved = jdbc.queryForList("SELECT PAYLOAD FROM AMS_STATE WHERE ID=1", String.class);
        if (saved.isEmpty()) {
            data = load("seed.json");
            long shift = System.currentTimeMillis() - time(obj(data.get("meta")).get("seededAt"));
            shiftDates(data, shift);
            obj(data.get("meta")).put("seededAt", now());
            persist();
        } else {
            data = obj(parse(saved.getFirst()));
            require(eq(obj(data.get("meta")),"schema","checked-mvp-1"),"数据库属于旧版演示，请使用新的 ams-mvp 数据库");
        }
    }
    private Map<String, Object> load(String file) throws IOException {
        try (var in = new ClassPathResource(file).getInputStream()) {
            return obj(MAPPER.readValue(in, Map.class));
        }
    }
    @SuppressWarnings("unchecked")
    private void shiftDates(Object value, long delta) {
        if (value instanceof Map<?, ?> map) {
            ((Map<String, Object>) map).replaceAll((k, v) -> {
                if (v instanceof String text && text.matches("\\d{4}-\\d{2}-\\d{2}T.*Z")) {
                    try { return Instant.ofEpochMilli(time(text) + delta).toString(); } catch (Exception ignored) {}
                }
                shiftDates(v, delta); return v;
            });
        } else if (value instanceof List<?> values) values.forEach(v -> shiftDates(v, delta));
    }
    public synchronized <T> T read(Supplier<T> task) { return detached(task.get()); }
    public synchronized <T> T write(Supplier<T> task) {
        Map<String, Object> before = copy(data);
        try {
            T result = task.get();
            if (!data.equals(before)) persist();
            return detached(result);
        } catch (RuntimeException e) { data = before; throw e; }
    }
    @SuppressWarnings("unchecked")
    private <T> T detached(T result) {
        if (result == null) return null;
        return (T) MAPPER.convertValue(result, Object.class);
    }
    private void persist() {
        jdbc.update("MERGE INTO AMS_STATE (ID,PAYLOAD) KEY(ID) VALUES (1,?)", encode(data));
    }
    public Map<String, Object> data() { return data; }
    public List<Map<String, Object>> table(String name) {
        return rows(data.computeIfAbsent(name, k -> new ArrayList<>()));
    }
    public Map<String, Object> find(String table, String field, Object key) {
        return table(table).stream().filter(r -> eq(r, field, key)).findFirst().orElse(null);
    }
    public Map<String, Object> mustFind(String table, String field, Object key) {
        var row = find(table, field, key);
        if (row == null) throw new ApiException(404, "资料不存在");
        return row;
    }
    public String key(String table) {
        var seq = obj(obj(data.get("meta")).get("seq"));
        int next = num(seq.get(table)) + 1; seq.put(table, next);
        return table + "-" + String.format("%06d", next);
    }
    public void audit(String table, String key, String action, Object before, Object after, Map<String, Object> user) {
        var u = user == null ? m("USER_ID", "SYSTEM", "USER_NAME", "系统") : user;
        table("history").addFirst(m("HIST_KEY", key("history"), "TABLE_NAME", table,
            "RECORD_KEY", key, "RECORD_LABEL", key, "ACTION", action,
            "ACTIVE", after instanceof Map ? obj(after).getOrDefault("ACTIVE", "Y") : "Y",
            "BEFORE_JSON", before == null ? null : encode(before), "AFTER_JSON", after == null ? null : encode(after),
            "TRX_DT", now(), "USER_KEY", u.get("USER_KEY"), "USER_ID", u.get("USER_ID"),
            "USER_NAME", u.get("USER_NAME"), "IP", u.getOrDefault("_REQUEST_IP",""), "HOST", ""));
    }
    public List<Map<String, Object>> history(String table, String key) {
        return table("history").stream().filter(r -> eq(r, "TABLE_NAME", table))
            .filter(r -> key == null || key.isBlank() || eq(r, "RECORD_KEY", key)).limit(300).toList();
    }
}
