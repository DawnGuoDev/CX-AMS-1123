package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class Masters {
    private final Store store;
    public Masters(Store store) { this.store = store; }
    public Map<String, Object> meta(String kind, String code) {
        var result = obj(obj(store.metadata.get(kind)).get(code));
        if (result.isEmpty()) throw new ApiException(404, "页面不存在：" + code);
        return result;
    }
    public List<Map<String, Object>> filtered(String table, Map<String, Object> query) {
        var filters = query.get("filters") instanceof String ? obj(parse(s(query, "filters"))) : obj(query.get("filters"));
        String q = s(query, "q").toLowerCase(Locale.ROOT);
        return store.table(table).stream().filter(r -> eq(query, "showHidden", "1") || active(r))
            .filter(r -> q.isBlank() || clean(r).values().stream().anyMatch(v -> str(v).toLowerCase(Locale.ROOT).contains(q)))
            .filter(r -> filters.entrySet().stream().allMatch(e -> str(e.getValue()).isEmpty() ||
                s(r, e.getKey()).toLowerCase(Locale.ROOT).contains(str(e.getValue()).toLowerCase(Locale.ROOT))))
            .sorted(Comparator.comparing((Map<String, Object> r) -> s(r, "MTR_DATE")).reversed())
            .map(Json::clean).toList();
    }
    public Map<String, Object> get(String kind, String code, Map<String, Object> query) {
        var meta = meta(kind, code);
        if (kind.equals("mappings")) {
            var master = obj(meta.get("master")); var item = obj(meta.get("item"));
            return m("ok", true, "meta", meta,
                "masters", store.table(s(master, "table")).stream().filter(Json::active).map(Json::clean).toList(),
                "items", store.table(s(item, "table")).stream().filter(Json::active).map(Json::clean).toList(),
                "mapRows", store.table(s(meta, "mapTable")), "history", store.history(s(meta, "mapTable"), null));
        }
        boolean detail = kind.equals("masterDetails");
        String table = s(meta, detail ? "masterTable" : "table");
        var rows = filtered(table, query);
        var result = m("ok", true, "meta", meta, detail ? "masters" : "rows", rows,
            "total", rows.size(), "history", store.history(table, null));
        if (detail) result.put("details", store.table(s(obj(meta.get("detail")), "table")));
        return result;
    }
    public Map<String, Object> values(Map<String, Object> meta, Map<String, Object> body, boolean edit) {
        Map<String, Object> values = new LinkedHashMap<>();
        for (var f : rows(meta.get("fields"))) {
            String name = s(f, "name");
            if (Boolean.TRUE.equals(f.get("readOnly")) || (edit && Boolean.TRUE.equals(f.get("readOnlyOnEdit"))) || !body.containsKey(name)) continue;
            Object value = body.get(name);
            if (eq(f, "type", "number") && value != null && !str(value).isBlank()) {
                try {
                    double number = Double.parseDouble(str(value));
                    require(Double.isFinite(number), s(f, "label") + "必须为有限数值");
                    value = number;
                } catch (NumberFormatException e) { throw new ApiException(400, s(f, "label") + "必须为数值"); }
            } else if (eq(f, "type", "checkbox"))
                value = List.of("true", "Y", "1").contains(str(value)) ? "Y" : "N";
            else if (value instanceof String text) value = text.trim();
            values.put(name, value);
        }
        return values;
    }
    public void validate(Map<String, Object> meta, Map<String, Object> row, String table, String keyField) {
        for (var f : rows(meta.get("fields"))) {
            if (Boolean.TRUE.equals(f.get("required"))) require(!s(row, s(f, "name")).isBlank(), s(f, "label") + "为必填");
        }
        var unique = new ArrayList<List<Object>>();
        for (Object key : list(meta.get("uniqueFields"))) unique.add(List.of(key));
        for (Object group : list(meta.get("uniqueComposite"))) unique.add(list(group));
        for (Object group : list(meta.get("masterUnique"))) unique.add(list(group));
        for (var fields : unique) {
            boolean duplicate = store.table(table).stream().anyMatch(r -> !eq(r, keyField, row.get(keyField))
                && fields.stream().allMatch(f -> eq(r, str(f), row.get(str(f)))));
            require(!duplicate, "唯一键组合已存在：" + fields);
        }
        var options = options();
        for (var field : rows(meta.get("fields"))) {
            String set = s(field, "optionSet"), name = s(field, "name");
            if (!set.isBlank() && !s(row, name).isBlank() && options.get(set) instanceof List<?>)
                require(rows(options.get(set)).stream().anyMatch(o -> eq(o, "value", row.get(name))),
                    s(field, "label") + "引用的资料不存在或已隐藏");
        }
        if (!s(row, "FACTORY_KEY").isBlank() && !s(row, "SUB_SYS_KEY").isBlank())
            require(store.table("factory_subsys").stream().anyMatch(r -> eq(r, "FACTORY_KEY", row.get("FACTORY_KEY"))
                && eq(r, "SUB_SYS_KEY", row.get("SUB_SYS_KEY"))), "子系统不属于所选厂别");
        if (eq(meta, "code", "AVMA009")) {
            var event = store.mustFind("events", "EVENT_KEY", row.get("EVENT_KEY"));
            require(eq(event, "FACTORY_KEY", row.get("FACTORY_KEY")) && eq(event, "SUB_SYS_KEY", row.get("SUB_SYS_KEY")),
                "通知事件不属于所选厂别／子系统");
            require(n(row, "IGNORE_PERIOD") >= 0, "忽略间隔不可为负数");
        }
        if (table.equals("users") && !s(row,"E_MAIL").isBlank()) {
            try { new jakarta.mail.internet.InternetAddress(s(row,"E_MAIL"),true).validate(); }
            catch (jakarta.mail.internet.AddressException e) { throw new ApiException(400,"E-Mail 格式无效"); }
        }
    }
    public Map<String, Object> save(String kind, String code, String key, Map<String, Object> body, Map<String, Object> user) {
        var meta = meta(kind, code);
        boolean detail = kind.equals("masterDetails");
        String table = s(meta, detail ? "masterTable" : "table");
        String keyField = s(meta, detail ? "masterKey" : "keyField");
        if (detail) key = s(body, keyField);
        boolean edit = key != null && !key.isBlank();
        var existing = edit ? store.mustFind(table, keyField, key) : m();
        var row = edit ? copy(existing) : copy(obj(meta.get("defaults")));
        row.putAll(values(meta, body, edit));
        if (!edit) { row.put(keyField, store.key(table)); row.put("ACTIVE", "Y"); }
        validate(meta, row, table, keyField);
        var before = edit ? clean(existing) : null;
        if (detail && before != null) before.put("details",copy(m("rows",store.table("event_levels").stream()
            .filter(r -> eq(r,"EVENT_KEY",existing.get("EVENT_KEY"))).toList())).get("rows"));
        if (detail) saveDetails(meta, row, body);
        String password = s(row, "PASSWORD"); row.remove("PASSWORD");
        if (table.equals("users") && (!edit || !password.isBlank()))
            row.put("PASSWORD_HASH", Auth.hash(password.isBlank() ? "123456" : password));
        stamp(row, user);
        var after=clean(row);
        if (detail) after.put("details",store.table("event_levels").stream().filter(r -> eq(r,"EVENT_KEY",row.get("EVENT_KEY"))).toList());
        store.audit(table, s(row, keyField), edit ? "Modify" : "AddNew", before, after, user);
        if (edit) { existing.clear(); existing.putAll(row); } else store.table(table).addFirst(row);
        return m("ok", true, "row", clean(row), "masterKey", row.get(keyField));
    }
    private void saveDetails(Map<String, Object> meta, Map<String, Object> master, Map<String, Object> body) {
        var d = obj(meta.get("detail"));
        String table = s(d, "table"), fk = s(d, "fk"), masterKey = s(master, s(meta, "masterKey"));
        List<Map<String, Object>> details = new ArrayList<>();
        {
            var input = new ArrayList<>(rows(body.get("details")));
            require(!input.isEmpty(), "至少设定 LEVEL-1");
            input.sort(Comparator.comparingInt(r -> n(r, "EVENT_LEVEL_ID")));
            Set<String> keys = new HashSet<>();
            for (int i = 0; i < input.size(); i++) {
                var source = input.get(i);
                require(n(source, "EVENT_LEVEL_ID") == i + 1, "事件层级代码必须从 1 开始连续设定");
                String ack = s(source, "NUMBER_OF_ACK_USERS");
                require(ack.equals("*") || ack.matches("\\d+"), "回应人数必须为非负整数或 *");
                require(n(source, "LEVEL_INTERVAL") > 0, "升级间隔必须大于 0");
                require(n(source, "FAIL_RETRY_TIMES") >= 0 && (n(source, "FAIL_RETRY_TIMES") == 0 || n(source, "FAIL_RETRY_INTERVAL") > 0), "重送次数或间隔无效");
                for (String field : List.of("EVENT_LEVEL_ID","LEVEL_INTERVAL","FAIL_RETRY_TIMES","FAIL_RETRY_INTERVAL"))
                    require(s(source,field).matches("\\d+(\\.0+)?"),"层级、间隔和重送次数必须为非负整数");
                var recipients=new ArrayList<>(new LinkedHashSet<>(list(source.get("USER_KEYS"))));
                require(!recipients.isEmpty(),"每个层级至少选择一位通知人员");
                for (Object recipient : recipients) {
                    var person=store.mustFind("users","USER_KEY",recipient);
                    require(active(person) && !s(person,"E_MAIL").isBlank(),"通知人员必须启用且设定 E-Mail");
                }
                require(ack.equals("*") || n(source,"NUMBER_OF_ACK_USERS")<=recipients.size(),"回应人数不可超过本层级通知人数");
                String key = s(source, s(d, "key"));
                if (!key.isBlank()) {
                    var old = store.mustFind(table, s(d, "key"), key);
                    require(eq(old, fk, masterKey), "层级不属于本事件");
                } else key = store.key(table);
                require(keys.add(key), "层级资料重复");
                var row = values(d, source, false);
                row.putAll(m(s(d, "key"), key, fk, masterKey, "ACTIVE", "Y"));
                row.put("USER_KEYS",recipients);
                details.add(row);
            }
        }
        store.table(table).removeIf(r -> eq(r, fk, masterKey));
        store.table(table).addAll(details);
    }
    public Map<String, Object> hide(String kind, String code, String key, String action, Map<String, Object> user) {
        require(List.of("hide", "show").contains(action), "未知操作");
        var meta = meta(kind, code);
        boolean detail = kind.equals("masterDetails");
        return setActive(s(meta, detail ? "masterTable" : "table"), s(meta, detail ? "masterKey" : "keyField"), key, action, user);
    }
    public Map<String, Object> setActive(String table, String keyField, String key, String action, Map<String, Object> user) {
        require(List.of("hide", "show", "delete").contains(action), "未知操作");
        var row = store.mustFind(table, keyField, key); var before = clean(row);
        row.put("ACTIVE", action.equals("show") ? "Y" : "N"); stamp(row, user);
        store.audit(table, key, action.equals("show") ? "Show" : "Hide", before, clean(row), user);
        return m("ok", true, "row", clean(row));
    }
    public Map<String, Object> saveMapping(String code, String key, List<Object> keys, Map<String, Object> user) {
        var meta = meta("mappings", code); var master = obj(meta.get("master")); var item = obj(meta.get("item"));
        require(active(store.mustFind(s(master, "table"), s(master, "key"), key)), "主档已隐藏");
        for (Object itemKey : keys) require(active(store.mustFind(s(item, "table"), s(item, "key"), itemKey)), "对应资料已隐藏");
        String table = s(meta, "mapTable"), fk = s(meta, "mapMasterFk");
        var before = store.table(table).stream().filter(r -> eq(r, fk, key)).map(Json::copy).toList();
        store.table(table).removeIf(r -> eq(r, fk, key));
        new LinkedHashSet<>(keys).forEach(k -> store.table(table).add(m("MAP_KEY", store.key(table), fk, key, s(meta, "mapItemFk"), k)));
        store.audit(table, key, "Modify", before, keys, user);
        return m("ok", true, "count", keys.size());
    }
    public void stamp(Map<String, Object> row, Map<String, Object> user) {
        row.putAll(m("MTR_DATE", now(), "MTR_USER_KEY", user.get("USER_KEY"), "MTR_USER_NAME", user.get("USER_NAME")));
    }
    public Map<String, Object> options() {
        var out = m();
        String[][] sets = {
            {"factory","factories","FACTORY_KEY","FACTORY_ID","FACTORY_NAME"},
            {"subsystem","subsystems","SUB_SYS_KEY","SUB_SYS_ID","SUB_SYS_NAME"},
            {"eqp","eqps","EQP_KEY","EQP_ID","EQP_NAME"},
            {"user","users","USER_KEY","USER_ID","USER_NAME"},
            {"event","events","EVENT_KEY","EVENT_ID","EVENT_NAME"},
            {"alarmSetting","alarm_settings","ALARM_INFO_KEY","ALARM_INFO_ID","ALARM_ID_DESC"}
        };
        for (String[] set : sets) out.put(set[0], store.table(set[1]).stream().filter(Json::active).map(r ->
            m("value", r.get(set[2]), "code", r.get(set[3]), "name", r.get(set[4]),
                "label", s(r,set[3]) + " " + s(r,set[4]), "factoryKey", r.get("FACTORY_KEY"),
                "subsysKey", r.get("SUB_SYS_KEY"), "eqpKey", r.get("EQP_KEY"), "organ", r.get("ORGAN_KEY"))).toList());
        var any = new ArrayList<>(rows(out.get("eqp"))); any.addFirst(m("value","*","label","* 任一机台")); out.put("eqpWithAny", any);
        var byFactory = m();
        for (var f : rows(out.get("factory"))) byFactory.put(s(f,"value"), rows(out.get("subsystem")).stream()
            .filter(s -> store.table("factory_subsys").stream().anyMatch(r -> eq(r,"FACTORY_KEY",f.get("value")) && eq(r,"SUB_SYS_KEY",s.get("value")))).toList());
        out.put("subsystemByFactory", byFactory);
        out.put("department", store.table("users").stream().map(r -> s(r,"ORGAN_KEY")).distinct().map(v -> m("value",v,"label",v)).toList());
        Map<String, String> enums = Map.ofEntries(
            Map.entry("shift","A,B,C,D"),Map.entry("gender","M,F"),Map.entry("yesno","Y,N"),
            Map.entry("alarmStatus","Process,Completed,NoNextLevel,LogOnly"),Map.entry("activeStatus","Y,N"));
        enums.forEach((k,v) -> out.put(k, Arrays.stream(v.split(",")).map(x -> m("value",x,"label",x)).toList()));
        return out;
    }
    public List<Map<String, Object>> nav() { return nav(null, new HashSet<>()); }
    private List<Map<String, Object>> nav(String parent, Set<String> ancestors) {
        return store.table("functions").stream().filter(Json::active).filter(r -> !eq(r,"VISIBLE","N"))
            .filter(r -> eq(r,"PARENT_KEY",parent)).sorted(Comparator.comparingInt(r -> n(r,"SORT"))).map(r -> {
                String key = s(r,"FUNCTION_KEY");
                require(!ancestors.contains(key), "菜单存在循环引用");
                var next = new HashSet<>(ancestors); next.add(key);
                return m("key",key,"id",r.get("FUNCTION_ID"),"name",r.get("FUNCTION_NAME"),
                    "type",r.get("FUNC_TYPE"),"path",r.get("PATH"),"children",nav(key,next));
            }).toList();
    }
}
