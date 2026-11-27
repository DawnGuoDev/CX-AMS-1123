package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.util.*;
import java.time.*;
import org.springframework.stereotype.Service;

@Service
public class Reports {
    private final Store store; private final AlarmEngine engine;
    public Reports(Store store, AlarmEngine engine) { this.store=store; this.engine=engine; }
    public Map<String,Object> definition(String code) {
        if (!List.of("AVPA004","AVPA007","AVPA008","AVPA013").contains(code)) throw new ApiException(404,"报表不存在");
        var def=copy(store.mustFind("report_defs","REPORT_ID",code));
        if(!code.equals("AVPA013")) {
            for(String[] f:new String[][]{{"CONTENT_TYPE","警报讯息内容类型"},{"LEVEL_PROCESS_DT","每次处理启始时间"},
                {"SEND_DT","每次发送启始时间"},{"FACTORY_NAME","厂别名称"},{"SUB_SYS_NAME","子系统名称"},{"EVENT_NAME","事件通知名称"}})
                if(rows(def.get("COLUMNS")).stream().noneMatch(c->eq(c,"field",f[0])))
                    rows(def.get("COLUMNS")).add(m("field",f[0],"label",f[1]));
            if(code.equals("AVPA004") && rows(def.get("COLUMNS")).stream().noneMatch(c->eq(c,"field","LAST_ACK_DT")))
                rows(def.get("COLUMNS")).add(m("field","LAST_ACK_DT","label","最后 ACK 时间"));
            for(var c:rows(def.get("COLUMNS"))) {
                c.put("type",s(c,"field").endsWith("_DT")?"date":"text");
                if(eq(c,"field","TRX_DT")) c.put("link",true);
            }
            def.put("CONDITIONS",copy(m("rows",def.get("COLUMNS"))).get("rows"));
        }
        return def;
    }
    public List<Map<String,Object>> pending(Map<String,Object> user) {
        return store.table("alarms").stream().map(r -> {
            var row=engine.enrich(r,user);row.put("USER_ID",user.get("USER_ID"));row.put("USER_NAME",user.get("USER_NAME"));return row;
        }).filter(r -> Boolean.TRUE.equals(r.get("CAN_ACK")))
            .sorted(Comparator.comparingInt((Map<String,Object> r) -> n(r,"PRIORITY")).reversed()).toList();
    }
    public List<Map<String,Object>> query(String code, Map<String,Object> conditions) {
        var def=definition(code);
        if (code.equals("AVPA013")) return summary("","");
        // AVPA008 always requires a time window, so report that rule first instead of the generic condition rule.
        if (code.equals("AVPA008")) {
            var timeCondition=obj(conditions.get("CREATE_DT"));
            require(Boolean.TRUE.equals(timeCondition.get("enabled"))
                && (!s(timeCondition,"value").isBlank() || !s(timeCondition,"from").isBlank() || !s(timeCondition,"to").isBlank()),
                "无效警报查询必须指定时间区间");
        }
        if (eq(def,"ATLEAST_ONE_CONDITION","Y")) require(conditions.values().stream().map(Json::obj).anyMatch(c ->
            Boolean.TRUE.equals(c.get("enabled")) && (!s(c,"value").isBlank() || !s(c,"from").isBlank() || !s(c,"to").isBlank())),"至少选择一个查询条件");
        List<Map<String,Object>> source=code.equals("AVPA008")
            ? store.table("invalid_alarms").stream().map(Json::copy).toList()
            : store.table("alarms").stream().map(r -> engine.enrich(r,null)).toList();
        if (code.equals("AVPA007")) {
            var byKey=new HashMap<String,Map<String,Object>>(); source.forEach(r -> byKey.put(s(r,"ALARM_KEY"),r));
            source=store.table("alarm_transactions").stream().filter(r -> byKey.containsKey(s(r,"ALARM_KEY"))).map(t -> {
                var r=t.get("SNAPSHOT") instanceof Map ? engine.enrich(obj(t.get("SNAPSHOT")),null) : copy(byKey.get(s(t,"ALARM_KEY")));
                r.putAll(t); r.remove("SNAPSHOT"); r.remove("DETAIL_SNAPSHOT"); r.remove("LEVEL_DEFINITIONS");
                r.put("STATUS",t.get("STATUS_AFTER"));
                var user=store.find("users","USER_KEY",t.get("USER_KEY"));
                r.put("TRX_USER_ID",user == null ? "SYSTEM" : user.get("USER_ID")); return r;
            }).toList();
        }
        Set<String> allowed=new HashSet<>(); rows(def.get("COLUMNS")).forEach(c -> allowed.add(s(c,"field")));
        return source.stream().filter(r -> conditions.entrySet().stream().allMatch(e -> {
            require(allowed.contains(e.getKey()),"查询字段无效");
            var condition=copy(obj(e.getValue()));
            condition.put("type",e.getKey().endsWith("_DT")?"date":"text");
            return matches(r.get(e.getKey()),condition);
        })).sorted(Comparator.comparing((Map<String,Object> r) -> s(r,code.equals("AVPA007") ? "TRX_DT" : "CREATE_DT")).reversed()).toList();
    }
    private boolean matches(Object raw,Map<String,Object> c) {
        if (!Boolean.TRUE.equals(c.get("enabled"))) return true;
        String actual=str(raw).toLowerCase(Locale.ROOT), value=s(c,"value").toLowerCase(Locale.ROOT);
        String op=s(c,"operator");
        if (eq(c,"type","date")) {
            if(value.isBlank() && s(c,"from").isBlank() && s(c,"to").isBlank()) return true;
            if(actual.isBlank()) return false;
            long a=date(str(raw));
            if (op.equals("between")) return (s(c,"from").isBlank() || a>=date(s(c,"from")))
                && (s(c,"to").isBlank() || a<=date(s(c,"to")));
            long v=date(s(c,"value"));
            return switch(op) {case "eq"->a==v;case "neq"->a!=v;case "lt"->a<v;case "lte"->a<=v;
                case "gt"->a>v;case "gte"->a>=v;default->throw new ApiException(400,"日期运算无效");};
        }
        if (value.isBlank()) return true;
        int comparison=actual.compareTo(value);
        return switch(op) {
            case "eq" -> actual.equals(value); case "neq" -> !actual.equals(value);
            case "notContains" -> !actual.contains(value); case "starts" -> actual.startsWith(value);
            case "ends" -> actual.endsWith(value); case "lt" -> comparison<0; case "lte" -> comparison<=0;
            case "gt" -> comparison>0; case "gte" -> comparison>=0;
            default -> actual.contains(value);
        };
    }
    private long date(String value) {
        try {
            try {return Instant.parse(value).getEpochSecond();}
            catch(Exception ignored) {
                return (value.length()==10?LocalDate.parse(value).atStartOfDay():LocalDateTime.parse(value))
                    .atZone(ZoneId.systemDefault()).toEpochSecond();
            }
        } catch(Exception e) {throw new ApiException(400,"日期时间格式无效");}
    }
    public List<Map<String,Object>> summaryColumns(boolean detail) {
        var columns=new ArrayList<>(rows(definition("AVPA013").get("COLUMNS")));
        if(detail) {
            columns.add(columns.size()-1,m("field","EQP_ID","label","机台代码"));
            columns.add(columns.size()-1,m("field","EQP_NAME","label","机台名称"));
        }
        return columns;
    }
    public List<Map<String,Object>> summary(String factory, String subsys) {
        Map<String,Map<String,Object>> out=new LinkedHashMap<>();
        for (var alarm : store.table("alarms").stream().filter(r -> eq(r,"STATUS","Process")).toList()) {
            if (!factory.isBlank() && !(eq(alarm,"FACTORY_KEY",factory) && eq(alarm,"SUB_SYS_KEY",subsys))) continue;
            String key=factory.isBlank() ? s(alarm,"FACTORY_KEY")+"|"+s(alarm,"SUB_SYS_KEY") : s(alarm,"EQP_KEY");
            var row=out.computeIfAbsent(key,k -> {
                var e=engine.enrich(alarm,null); var r=m("ALARM_COUNT",0);
                for (String f : List.of("FACTORY_KEY","FACTORY_ID","FACTORY_NAME","SUB_SYS_KEY","SUB_SYS_ID","SUB_SYS_NAME")) r.put(f,e.get(f));
                if (!factory.isBlank()) { r.put("EQP_ID",e.get("EQP_ID")); r.put("EQP_NAME",e.get("EQP_NAME")); } return r;
            });
            row.put("ALARM_COUNT",n(row,"ALARM_COUNT")+1);
        }
        return out.values().stream().sorted(Comparator.comparingInt((Map<String,Object> r) -> n(r,"ALARM_COUNT")).reversed()).toList();
    }
}
