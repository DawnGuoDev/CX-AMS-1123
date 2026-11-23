package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class Reports {
    private final Store store;
    private final AlarmEngine engine;
    public Reports(Store store, AlarmEngine engine) { this.store=store; this.engine=engine; }
    public List<Map<String,Object>> pending(Map<String,Object> user) {
        return store.table("alarms").stream().map(r -> engine.enrich(r,user)).filter(r -> Boolean.TRUE.equals(r.get("CAN_ACK")))
            .sorted(Comparator.comparingInt((Map<String,Object> r) -> n(r,"PRIORITY")).reversed()).toList();
    }
    public Map<String,Object> inbox(Map<String,Object> user) {
        var rows = store.table("alarm_notifications").stream().filter(r -> eq(r,"USER_KEY",user.get("USER_KEY")))
            .sorted(Comparator.comparing((Map<String,Object> r) -> s(r,"SEND_DT")).reversed()).limit(80).map(r -> {
                var alarm = store.find("alarms","ALARM_KEY",r.get("ALARM_KEY"));
                var out = alarm == null ? m() : engine.enrich(alarm,user); out.putAll(r); return out;
            }).toList();
        return m("ok",true,"rows",rows,"pending",pending(user).size());
    }
    private Object condition(Map<String,Object> c, String key) {
        Object value = c.get(key);
        if (value instanceof Map) return Boolean.FALSE.equals(obj(value).get("enabled")) ? null : obj(value).get("value");
        return value;
    }
    public List<Map<String,Object>> query(String code, Map<String,Object> c) {
        if (code.equals("AVPA008")) return devices();
        if (code.equals("AVPA013")) return summary("","");
        require(List.of("AVPA004","AVPA005","AVPA007").contains(code),"报表不存在");
        var def = store.find("report_defs","REPORT_ID",code);
        if (def != null && eq(def,"ATLEAST_ONE_CONDITION","Y"))
            require(c.entrySet().stream().anyMatch(e -> e.getValue() instanceof Map ?
                !Boolean.FALSE.equals(obj(e.getValue()).get("enabled")) && obj(e.getValue()).values().stream().anyMatch(v -> v instanceof String && !str(v).isBlank())
                : !str(e.getValue()).isBlank()),"至少选择一个查询条件");
        List<Map<String,Object>> source = code.equals("AVPA005") ? store.table("alarm_invalid") :
            store.table("alarms").stream().map(r -> engine.enrich(r,null)).toList();
        var range = obj(c.get("CREATE_DT"));
        Set<String> groupEqps = new HashSet<>();
        String group = str(condition(c,"EQP_GROUP_KEY"));
        if (!group.isBlank()) store.table("eqp_group_eqp").stream().filter(r -> eq(r,"EQP_GROUP_KEY",group)).forEach(r -> {
            var eqp = store.find("eqps","EQP_KEY",r.get("EQP_KEY")); if (eqp != null) groupEqps.add(s(eqp,"EQP_ID"));
        });
        var filtered = source.stream().filter(r -> {
            String date = s(r,"CREATE_DT"); date = date.length() >= 10 ? date.substring(0,10) : date;
            if (!Boolean.FALSE.equals(range.get("enabled"))) {
                if (!s(range,"from").isBlank() && date.compareTo(s(range,"from"))<0) return false;
                if (!s(range,"to").isBlank() && date.compareTo(s(range,"to"))>0) return false;
            }
            if (!group.isBlank() && !groupEqps.contains(s(r,"EQP_ID"))) return false;
            for (String key : List.of("EQP_ID","SUB_SYS_ID","STATUS","FACTORY_ID","ALARM_INFO_ID","TITLE")) {
                String value = str(condition(c,key)).toLowerCase(Locale.ROOT);
                if (!value.isBlank() && !s(r,key).toLowerCase(Locale.ROOT).contains(value)) return false;
            }
            return true;
        }).sorted(Comparator.comparing((Map<String,Object> r) -> s(r,"CREATE_DT")).reversed()).toList();
        if (!code.equals("AVPA007")) return filtered;
        Map<String,Map<String,Object>> alarms = new HashMap<>();
        filtered.forEach(r -> alarms.put(s(r,"ALARM_KEY"),r));
        return store.table("alarm_transactions").stream().filter(r -> alarms.containsKey(s(r,"ALARM_KEY"))).map(t -> {
            var row = copy(alarms.get(s(t,"ALARM_KEY"))); row.putAll(t); row.put("TRX_NOTE",t.get("NOTE"));
            var user = store.find("users","USER_KEY",t.get("USER_KEY")); row.put("TRX_USER_ID",user == null ? "SYSTEM" : user.get("USER_ID")); return row;
        }).sorted(Comparator.comparing((Map<String,Object> r) -> s(r,"TRX_DT")).reversed()).toList();
    }
    public List<Map<String,Object>> devices() {
        Map<String,Map<String,Object>> groups = new LinkedHashMap<>();
        Map<String,Integer> severity = Map.of("OK",1,"Unknown",2,"Close",3,"NG",4,"Error",5);
        for (var device : store.table("devices")) {
            String key=s(device,"SERVER_ID")+"|"+s(device,"AGENT_ID");
            var row=groups.computeIfAbsent(key,k -> m("SERVER_ID",device.get("SERVER_ID"),"AGENT_ID",device.get("AGENT_ID"),
                "AGENT_STATUS","OK","RECEIVED_COUNT",0,"SUCCESSFUL_COUNT",0,"FAIL_COUNT",0,"DEVICE_ERROR_COUNT",0,"DEVICES",new ArrayList<>()));
            for (String count : List.of("RECEIVED_COUNT","SUCCESSFUL_COUNT","FAIL_COUNT")) row.put(count,n(row,count)+n(device,count));
            if (severity.getOrDefault(s(device,"DEVICE_STATUS"),2)>=3) row.put("DEVICE_ERROR_COUNT",n(row,"DEVICE_ERROR_COUNT")+1);
            if (severity.getOrDefault(s(device,"DEVICE_STATUS"),2)>severity.getOrDefault(s(row,"AGENT_STATUS"),1)) row.put("AGENT_STATUS",device.get("DEVICE_STATUS"));
            rows(row.get("DEVICES")).add(device); row.put("STATUS_DESC",eq(row,"AGENT_STATUS","OK") ? "所有装置运作正常" : "部分装置需检查");
        }
        return new ArrayList<>(groups.values());
    }
    public List<Map<String,Object>> summary(String factory, String subsys) {
        Map<String,Map<String,Object>> out = new LinkedHashMap<>();
        for (var alarm : store.table("alarms").stream().filter(r -> eq(r,"STATUS","Process")).toList()) {
            if (!factory.isBlank() && !(eq(alarm,"FACTORY_KEY",factory) && eq(alarm,"SUB_SYS_KEY",subsys))) continue;
            String key = factory.isBlank() ? s(alarm,"FACTORY_KEY")+"|"+s(alarm,"SUB_SYS_KEY") : s(alarm,"EQP_KEY");
            var row = out.computeIfAbsent(key,k -> {
                var e=engine.enrich(alarm,null); var r=m("ALARM_COUNT",0);
                for (String f : List.of("FACTORY_KEY","FACTORY_ID","FACTORY_NAME","SUB_SYS_KEY","SUB_SYS_ID","SUB_SYS_NAME")) r.put(f,e.get(f));
                if (!factory.isBlank()) { r.put("EQP_ID",e.get("EQP_ID")); r.put("EQP_NAME",e.get("EQP_NAME")); } return r;
            });
            row.put("ALARM_COUNT",n(row,"ALARM_COUNT")+1);
        }
        return out.values().stream().sorted(Comparator.comparingInt((Map<String,Object> r) -> n(r,"ALARM_COUNT")).reversed()).toList();
    }
    public Map<String,Object> dashboard(Map<String,Object> user) {
        String today=LocalDate.now(ZoneOffset.UTC).toString();
        var alarms=store.table("alarms"); var todays=alarms.stream().filter(r -> s(r,"CREATE_DT").startsWith(today)).toList();
        long complete=todays.stream().filter(r -> eq(r,"STATUS","Completed")).count();
        var hourly=new ArrayList<Map<String,Object>>();
        for (int i=11;i>=0;i--) {
            long end=System.currentTimeMillis()-i*3_600_000L, start=end-3_600_000L;
            hourly.add(m("hour",Instant.ofEpochMilli(end).atZone(ZoneOffset.UTC).getHour(),
                "count",alarms.stream().filter(r -> time(r.get("CREATE_DT"))>=start && time(r.get("CREATE_DT"))<end).count()));
        }
        return m("ok",true,"kpi",m("today",todays.size(),"process",alarms.stream().filter(r -> eq(r,"STATUS","Process")).count(),
            "pending",pending(user).size(),"completedToday",complete,"invalidToday",store.table("alarm_invalid").stream().filter(r -> s(r,"CREATE_DT").startsWith(today)).count(),
            "completedRate",todays.isEmpty()?0:complete*100/todays.size()),"hourly",hourly,
            "recent",alarms.stream().sorted(Comparator.comparing((Map<String,Object> r) -> s(r,"CREATE_DT")).reversed()).limit(8).map(r -> engine.enrich(r,user)).toList(),
            "deviceSummary",m("total",store.table("devices").size(),"ok",store.table("devices").stream().filter(r -> eq(r,"DEVICE_STATUS","OK")).count(),
                "abnormal",store.table("devices").stream().filter(r -> List.of("Error","NG","Close").contains(s(r,"DEVICE_STATUS"))).count()),
            "summary",summary("",""),"autoLogs",store.table("auto_status_logs").stream().limit(4).toList(),"lastUpdate",now());
    }
}
