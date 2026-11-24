package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class AlarmEngine {
    private final Store store;
    private final SmtpDelivery smtp;
    public AlarmEngine(Store store, SmtpDelivery smtp) { this.store = store; this.smtp = smtp; }
    public List<Map<String, Object>> levels(Object event) {
        return store.table("event_levels").stream().filter(Json::active).filter(r -> eq(r,"EVENT_KEY",event))
            .sorted(Comparator.comparingInt(r -> n(r,"EVENT_LEVEL_ID"))).toList();
    }
    public List<Map<String, Object>> members(Object level) {
        var definition = store.mustFind("event_levels","EVENT_LEVEL_KEY",level);
        return store.table("users").stream().filter(Json::active)
            .filter(r -> list(definition.get("USER_KEYS")).contains(r.get("USER_KEY"))).toList();
    }
    private List<Map<String, Object>> related(String table, Object key) {
        return store.table(table).stream().filter(r -> eq(r,"ALARM_KEY",key)).toList();
    }
    private Map<String, Object> run(Map<String, Object> alarm) {
        return related("alarm_levels",alarm.get("ALARM_KEY")).stream()
            .filter(r -> n(r,"LEVEL_ID") == n(alarm,"CURRENT_LEVEL")).findFirst().orElse(m());
    }
    private void transaction(Map<String, Object> alarm, String type, String before, Map<String, Object> user, String note) {
        var snapshot=copy(alarm); snapshot.remove("LEVEL_DEFINITIONS");
        store.table("alarm_transactions").add(m("TRX_KEY",store.key("alarm_transactions"),"ALARM_KEY",alarm.get("ALARM_KEY"),
            "SEQ",related("alarm_transactions",alarm.get("ALARM_KEY")).size()+1,"TRX_TYPE",type,
            "STATUS_BEFORE",before,"STATUS_AFTER",alarm.get("STATUS"),"USER_KEY",user == null ? null : user.get("USER_KEY"),
            "TRX_DT",now(),"NOTE",note,"SNAPSHOT",snapshot));
    }
    public Map<String, Object> enrich(Map<String, Object> alarm, Map<String, Object> user) {
        var result = copy(alarm);
        for (String[] join : new String[][]{{"factories","FACTORY_KEY","FACTORY_ID","FACTORY_NAME"},
                {"subsystems","SUB_SYS_KEY","SUB_SYS_ID","SUB_SYS_NAME"},{"eqps","EQP_KEY","EQP_ID","EQP_NAME"},
                {"events","EVENT_KEY","EVENT_ID","EVENT_NAME"},{"alarm_settings","ALARM_INFO_KEY","ALARM_INFO_ID","ALARM_ID_DESC"}}) {
            var row = store.find(join[0],join[1],alarm.get(join[1]));
            result.put(join[2],row == null ? "" : row.get(join[2]));
            result.put(join[3],row == null ? "" : row.get(join[3]));
        }
        if (eq(alarm,"EQP_KEY","*")) result.putAll(m("EQP_ID","*","EQP_NAME","任一机台"));
        var run = run(alarm);
        var ack = related("alarm_acks",alarm.get("ALARM_KEY")).stream().filter(r -> n(r,"LEVEL_ID") == n(alarm,"CURRENT_LEVEL")).toList();
        boolean notified = related("alarm_notifications",alarm.get("ALARM_KEY")).stream()
            .anyMatch(r -> n(r,"LEVEL_ID") == n(alarm,"CURRENT_LEVEL") && eq(r,"RESULT","Success") && user != null && eq(r,"USER_KEY",user.get("USER_KEY")));
        boolean acked = ack.stream().anyMatch(r -> user != null && eq(r,"USER_KEY",user.get("USER_KEY")));
        result.putAll(m("CAN_ACK",eq(alarm,"STATUS","Process") && notified && !acked,
            "LEVEL_START",run.get("START_DT"),"LEVEL_REQUIRED",run.get("REQUIRED_ACK"),
            "LEVEL_ACK_COUNT",run.getOrDefault("ACK_COUNT",0),"LEVEL_RESEND_COUNT",run.getOrDefault("RESEND_COUNT",0),
            "ACK_USERS",ack,"NOTIFY_COUNT",related("alarm_notifications",alarm.get("ALARM_KEY")).size()));
        return result;
    }
    public Map<String, Object> detail(String key, Map<String, Object> user) {
        var alarm = store.table("alarms").stream().filter(r -> eq(r,"ALARM_KEY",key) || eq(r,"ALARM_ID",key)).findFirst()
            .orElseThrow(() -> new ApiException(404,"警报不存在"));
        var result = enrich(alarm,user);
        for (String[] section : new String[][]{{"LEVELS","alarm_levels"},{"ACKS","alarm_acks"},{"NOTIFICATIONS","alarm_notifications"},{"TRANSACTIONS","alarm_transactions"}})
            result.put(section[0],related(section[1],alarm.get("ALARM_KEY")).stream().map(r -> {
                var out = copy(r); var u = store.find("users","USER_KEY",r.get("USER_KEY"));
                out.put("USER_ID",u == null ? "SYSTEM" : u.get("USER_ID")); out.put("USER_NAME",u == null ? "系统" : u.get("USER_NAME")); return out;
            }).toList());
        return result;
    }
    private Map<String, Object> invalid(Map<String, Object> body, String reason) {
        return m("ok",false,"status",422,"message",reason);
    }
    public Map<String, Object> trigger(Map<String, Object> body, Map<String, Object> user) {
        var f = store.find("factories","FACTORY_KEY",body.get("factoryKey"));
        if (f == null || !active(f)) return invalid(body,"未设定厂别");
        var s = store.find("subsystems","SUB_SYS_KEY",body.get("subsysKey"));
        if (s == null || !active(s) || store.table("factory_subsys").stream().noneMatch(r ->
            eq(r,"FACTORY_KEY",body.get("factoryKey")) && eq(r,"SUB_SYS_KEY",body.get("subsysKey")))) return invalid(body,"未设定子系统");
        var eqp = store.find("eqps","EQP_KEY",body.get("eqpKey"));
        if (eqp == null || !active(eqp)) return invalid(body,"未设定机台");
        var candidates = store.table("alarm_settings").stream().filter(r -> eq(r,"FACTORY_KEY",body.get("factoryKey"))
            && eq(r,"SUB_SYS_KEY",body.get("subsysKey")) && eq(r,"ALARM_INFO_ID",body.get("alarmCode"))).toList();
        var setting = candidates.stream().filter(r -> eq(r,"EQP_KEY",body.get("eqpKey"))).findFirst().orElse(null);
        String match = "exact";
        if (setting == null) setting = candidates.stream().filter(r -> eq(r,"EQP_KEY","*")).findFirst().orElse(null);
        if (setting == null) return invalid(body,"找不到事件");
        if (!active(setting)) return invalid(body,"警报设定未启用");
        var event = store.find("events","EVENT_KEY",setting.get("EVENT_KEY"));
        if (event == null || !active(event)) return invalid(body,"找不到事件");
        String settingKey = s(setting,"ALARM_INFO_KEY");
        int ignore = setting.containsKey("IGNORE_PERIOD") ? n(setting,"IGNORE_PERIOD") : 900;
        boolean duplicate = store.table("alarms").stream().anyMatch(r -> eq(r,"FACTORY_KEY",body.get("factoryKey"))
            && eq(r,"SUB_SYS_KEY",body.get("subsysKey")) && eq(r,"EQP_KEY",body.get("eqpKey")) && eq(r,"ALARM_INFO_KEY",settingKey)
            && System.currentTimeMillis()-time(r.get("CREATE_DT")) < ignore * 1000L);
        if (duplicate) return invalid(body,"忽略相同警报");
        if (eq(s,"BYPASS","Y")) {
            var alarm = create(body,setting,event);
            alarm.put("STATUS","LogOnly"); alarm.put("COMPLETE_DT",now());
            transaction(alarm,"Modify","Process",user,"子系统 BYPASS，仅记录");
            return m("ok",true,"alarm",enrich(alarm,user),"matchedBy",match,"logOnly",true);
        }
        var first = levels(event.get("EVENT_KEY")).stream().filter(r -> n(r,"EVENT_LEVEL_ID")==1).findFirst().orElse(null);
        if (first == null) return invalid(body,"未设定层级1");
        if (members(first.get("EVENT_LEVEL_KEY")).isEmpty()) return invalid(body,"未设定发送人员");
        var alarm = create(body,setting,event); startLevel(alarm,first,user);
        return m("ok",true,"alarm",enrich(alarm,user),"matchedBy",match,"logOnly",false);
    }
    private Map<String, Object> create(Map<String, Object> b, Map<String, Object> setting, Map<String, Object> event) {
        var alarm = m("ALARM_KEY",store.key("alarms"),"ALARM_ID",store.key("alarmId"),"TITLE",s(b,"title").isBlank() ? "Empty Subject" : b.get("title"),
            "CONTENT",s(b,"content").isBlank() ? "Empty Content" : b.get("content"),"STATUS","Process","FACTORY_KEY",b.get("factoryKey"),"SUB_SYS_KEY",b.get("subsysKey"),
            "EQP_KEY",b.get("eqpKey"),"ALARM_INFO_KEY",setting.get("ALARM_INFO_KEY"),
            "EVENT_KEY",event.get("EVENT_KEY"),"CURRENT_LEVEL",1,"PRIORITY",setting.getOrDefault("EVENT_PTY_ID",event.getOrDefault("EVENT_PRIORITY_ID",5)),
            "CREATE_DT",now(),"FIRST_PROCESS_DT",now(),"LEVEL_PROCESS_DT",now(),"SEND_DT",now(),"LAST_ACK_DT",null,"COMPLETE_DT",null,
            "RECEIVE_TYPE","Mock","ACK_CMT",null,"SOURCE_TYPE","Test");
        store.table("alarms").addFirst(alarm); transaction(alarm,"Create","Open",null,"警报建立");
        alarm.put("LEVEL_DEFINITIONS",copy(m("levels",levels(event.get("EVENT_KEY")))).get("levels"));
        return alarm;
    }
    private void startLevel(Map<String, Object> alarm, Map<String, Object> level, Map<String, Object> user) {
        var members = store.table("users").stream().filter(Json::active)
            .filter(r -> list(level.get("USER_KEYS")).contains(r.get("USER_KEY"))).toList();
        int required = eq(level,"NUMBER_OF_ACK_USERS","*") ? members.size() : n(level,"NUMBER_OF_ACK_USERS");
        alarm.putAll(m("CURRENT_LEVEL",n(level,"EVENT_LEVEL_ID"),"LEVEL_PROCESS_DT",now(),"SEND_DT",now(),"ACK_REQUIRED",required));
        store.table("alarm_levels").add(m("LEVEL_RUN_KEY",store.key("alarm_levels"),"ALARM_KEY",alarm.get("ALARM_KEY"),
            "LEVEL_ID",alarm.get("CURRENT_LEVEL"),"START_DT",now(),"REQUIRED_ACK",required,"ACK_COUNT",0,"RESEND_COUNT",0,
            "NEXT_RESEND_DT",null,
            "STATUS","Active","LEVEL_DESC",level.get("EVENT_LEVEL_DESC")));
        transaction(alarm,"Modify","Process",user,"LEVEL-"+n(alarm,"CURRENT_LEVEL")+" 发送");
        for (var recipient : members) queue(alarm,recipient.get("USER_KEY"),s(recipient,"E_MAIL"),false);
    }
    private void queue(Map<String,Object> alarm, Object userKey, String target, boolean retry) {
        store.table("alarm_notifications").add(m("NOTIFY_KEY",store.key("alarm_notifications"),"ALARM_KEY",alarm.get("ALARM_KEY"),
            "USER_KEY",userKey,"LEVEL_ID",alarm.get("CURRENT_LEVEL"),"CHANNEL","Email","TARGET",target,"SEND_DT",null,
            "RESULT","Pending","MESSAGE","等待 SMTP 发送","RETRY",retry ? 1 : 0));
    }
    /** The single dispatcher performs network I/O outside the snapshot transaction lock. */
    public synchronized void dispatch() {
        var pending = store.read(() -> store.table("alarm_notifications").stream().filter(r -> eq(r,"RESULT","Pending"))
            .sorted(Comparator.comparingInt((Map<String,Object> r) ->
                n(store.mustFind("alarms","ALARM_KEY",r.get("ALARM_KEY")),"PRIORITY")).reversed()).limit(20).toList());
        for (var notice : pending) {
            var alarm = store.read(() -> store.mustFind("alarms","ALARM_KEY",notice.get("ALARM_KEY")));
            boolean current = n(notice,"LEVEL_ID")==n(alarm,"CURRENT_LEVEL")
                && (eq(alarm,"STATUS","Process") || (eq(alarm,"STATUS","Completed") && n(alarm,"ACK_REQUIRED")==0));
            String error = current ? smtp.send(notice,alarm) : "本层级已结束，取消待发送通知";
            store.write(() -> {
                var row = store.mustFind("alarm_notifications","NOTIFY_KEY",notice.get("NOTIFY_KEY"));
                row.putAll(m("RESULT",!current ? "Skipped" : error.isBlank() ? "Success" : "Fail",
                    "MESSAGE",error.isBlank() ? "SMTP 服务器已接受邮件" : error,"SEND_DT",now()));
                return null;
            });
        }
    }
    private void close(Map<String, Object> alarm, String status, String type, Map<String, Object> user, String note) {
        alarm.put("STATUS",status); alarm.put("COMPLETE_DT",now());
        related("alarm_levels",alarm.get("ALARM_KEY")).stream().filter(r -> eq(r,"STATUS","Active")).forEach(r -> r.put("STATUS","Closed"));
        transaction(alarm,type,"Process",user,note);
    }
    public Map<String, Object> action(String key, String action, Map<String, Object> b, Map<String, Object> user) {
        var alarm = store.mustFind("alarms","ALARM_KEY",key);
        require(eq(alarm,"STATUS","Process"),"该警报已非处理中状态");
        if (action.equals("ack")) {
            require(Boolean.TRUE.equals(enrich(alarm,user).get("CAN_ACK")),"您不是本层级待确认人员，或已确认过此警报");
            store.table("alarm_acks").add(m("ACK_KEY",store.key("alarm_acks"),"ALARM_KEY",key,"USER_KEY",user.get("USER_KEY"),
                "LEVEL_ID",alarm.get("CURRENT_LEVEL"),"ACK_DT",now(),"ACK_CMT",b.get("cmt")));
            var run = run(alarm); run.put("ACK_COUNT",n(run,"ACK_COUNT")+1);
            alarm.put("LAST_ACK_DT",now()); alarm.put("ACK_CMT",b.get("cmt"));
            transaction(alarm,"UserAck","Process",user,s(b,"cmt"));
            if (n(run,"ACK_COUNT") >= n(run,"REQUIRED_ACK")) close(alarm,"Completed","AlarmComplete",user,"回应人数达标");
        } else throw new ApiException(404,"未知警报操作");
        return m("ok",true,"alarm",enrich(alarm,user),"completed",eq(alarm,"STATUS","Completed"));
    }
    public void tick() {
        long now = System.currentTimeMillis();
        for (var alarm : store.table("alarms").stream().filter(r -> eq(r,"STATUS","Process")).sorted(Comparator.comparingInt((Map<String,Object> r) -> n(r,"PRIORITY")).reversed()).toList()) {
            var run = run(alarm); if (run.isEmpty()) continue;
            var delivery = new LinkedHashMap<String,Map<String,Object>>();
            related("alarm_notifications",alarm.get("ALARM_KEY")).stream()
                .filter(r -> n(r,"LEVEL_ID")==n(alarm,"CURRENT_LEVEL")).forEach(r -> delivery.put(s(r,"USER_KEY"),r));
            boolean sent = !delivery.isEmpty() && delivery.values().stream().allMatch(r -> eq(r,"RESULT","Success"));
            if (n(run,"ACK_COUNT") >= n(run,"REQUIRED_ACK") && (n(run,"REQUIRED_ACK")>0 || sent)) {
                close(alarm,"Completed","AlarmComplete",null,"回应人数达标"); continue;
            }
            var levels = rows(alarm.get("LEVEL_DEFINITIONS"));
            var level = levels.stream().filter(r -> n(r,"EVENT_LEVEL_ID")==n(alarm,"CURRENT_LEVEL")).findFirst().orElse(m());
            long interval = Math.max(1,n(level,"LEVEL_INTERVAL"))*60000L;
            if (now-time(run.get("START_DT")) >= interval) {
                var next = levels.stream().filter(r -> n(r,"EVENT_LEVEL_ID")==n(alarm,"CURRENT_LEVEL")+1).findFirst().orElse(null);
                if (next == null) close(alarm,"NoNextLevel","AlarmFail",null,"已无下一层级，逾时未达回应人数");
                else {
                    run.put("STATUS","Closed"); transaction(alarm,"LevelUpgrade","Process",null,"升级至 LEVEL-"+n(next,"EVENT_LEVEL_ID")); startLevel(alarm,next,null);
                }
            } else if (!level.isEmpty()) {
                var latest = new LinkedHashMap<String,Map<String,Object>>();
                related("alarm_notifications",alarm.get("ALARM_KEY")).stream()
                    .filter(r -> n(r,"LEVEL_ID")==n(alarm,"CURRENT_LEVEL")).forEach(r -> latest.put(s(r,"USER_KEY"),r));
                for (var notice : latest.values()) {
                    long attempts = related("alarm_notifications",alarm.get("ALARM_KEY")).stream().filter(r ->
                        n(r,"LEVEL_ID")==n(alarm,"CURRENT_LEVEL") && eq(r,"USER_KEY",notice.get("USER_KEY"))).count();
                    if (eq(notice,"RESULT","Fail") && attempts <= n(level,"FAIL_RETRY_TIMES")
                        && now-time(notice.get("SEND_DT")) >= n(level,"FAIL_RETRY_INTERVAL")*1000L) {
                        queue(alarm,notice.get("USER_KEY"),s(notice,"TARGET"),true);
                        run.put("RESEND_COUNT",Math.max(n(run,"RESEND_COUNT"),(int)attempts));
                        transaction(alarm,"Modify","Process",null,"Email 失败重送第 "+attempts+" 次");
                    }
                }
            }
        }
    }
}
