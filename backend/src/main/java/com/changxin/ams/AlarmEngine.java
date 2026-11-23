package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class AlarmEngine {
    private final Store store;
    private static final Map<String, String> CONTACT = Map.of("Email","E_MAIL","Sms","ALARM_SMS_TEL","Phone","EXTENSION","Voice","EXTENSION","IM","IM_ID");
    private static final Map<String, String> DEVICE = Map.of("Email","Email01","Sms","Sms01","Phone","Phone01","Voice","Phone01","IM","Im01");
    public AlarmEngine(Store store) { this.store = store; }
    private int speed() { return Math.max(1, n(obj(store.data().get("settings")), "demoSpeed")); }
    public List<Map<String, Object>> levels(Object event) {
        return store.table("event_levels").stream().filter(Json::active).filter(r -> eq(r,"EVENT_KEY",event))
            .sorted(Comparator.comparingInt(r -> n(r,"EVENT_LEVEL_ID"))).toList();
    }
    private List<Map<String, Object>> groups(Object level) {
        return store.table("event_level_groups").stream().filter(Json::active).filter(r -> eq(r,"EVENT_LEVEL_KEY",level))
            .filter(r -> { var group = store.find("event_groups","EVENT_GROUP_KEY",r.get("EVENT_GROUP_KEY")); return group != null && active(group); })
            .sorted(Comparator.comparingInt(r -> n(r,"GROUP_SEQ"))).toList();
    }
    public List<Map<String, Object>> members(Object level) {
        var keys = groups(level).stream().map(r -> s(r,"EVENT_GROUP_KEY")).toList();
        var users = store.table("event_group_users").stream().filter(r -> keys.contains(s(r,"EVENT_GROUP_KEY"))).map(r -> s(r,"USER_KEY")).toList();
        return store.table("users").stream().filter(Json::active).filter(r -> users.contains(s(r,"USER_KEY"))).toList();
    }
    private List<String> channels(Object level) {
        return groups(level).stream().flatMap(r -> Arrays.stream(s(r,"ENABLE_SEND_DEVICES").split(";")))
            .filter(CONTACT::containsKey).distinct().toList();
    }
    private List<Map<String, Object>> related(String table, Object key) {
        return store.table(table).stream().filter(r -> eq(r,"ALARM_KEY",key)).toList();
    }
    private Map<String, Object> run(Map<String, Object> alarm) {
        return related("alarm_levels",alarm.get("ALARM_KEY")).stream()
            .filter(r -> n(r,"LEVEL_ID") == n(alarm,"CURRENT_LEVEL")).findFirst().orElse(m());
    }
    private void transaction(Map<String, Object> alarm, String type, String before, Map<String, Object> user, String note) {
        store.table("alarm_transactions").add(m("TRX_KEY",store.key("alarm_transactions"),"ALARM_KEY",alarm.get("ALARM_KEY"),
            "SEQ",related("alarm_transactions",alarm.get("ALARM_KEY")).size()+1,"TRX_TYPE",type,
            "STATUS_BEFORE",before,"STATUS_AFTER",alarm.get("STATUS"),"USER_KEY",user == null ? null : user.get("USER_KEY"),"TRX_DT",now(),"NOTE",note));
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
            .anyMatch(r -> n(r,"LEVEL_ID") == n(alarm,"CURRENT_LEVEL") && user != null && eq(r,"USER_KEY",user.get("USER_KEY")));
        boolean acked = ack.stream().anyMatch(r -> user != null && eq(r,"USER_KEY",user.get("USER_KEY")));
        result.putAll(m("CAN_ACK",eq(alarm,"STATUS","Process") && notified && !acked,
            "CAN_TERMINATE",eq(alarm,"STATUS","Process") && !eq(alarm,"IS_MANUAL","Y"),
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
        var row = m("INVALID_KEY",store.key("alarm_invalid"),"INVALID_ID",store.key("invalid_id"),"CREATE_DT",now(),
            "TITLE",body.get("title"),"CONTENT",body.get("content"),"ALARM_INFO_ID",body.get("alarmCode"),
            "INVALID_TYPE",reason,"RECEIVE_TYPE","WebPage","RAW_JSON",encode(body));
        for (String[] j : new String[][]{{"factories","FACTORY_KEY","factoryKey","FACTORY_ID","FACTORY_NAME"},
                {"subsystems","SUB_SYS_KEY","subsysKey","SUB_SYS_ID","SUB_SYS_NAME"},{"eqps","EQP_KEY","eqpKey","EQP_ID","EQP_NAME"}}) {
            var r = store.find(j[0],j[1],body.get(j[2]));
            row.put(j[3],r == null ? "" : r.get(j[3])); row.put(j[4],r == null ? "" : r.get(j[4]));
        }
        store.table("alarm_invalid").addFirst(row);
        // A rejected alarm is still a committed business outcome.
        return m("ok",false,"status",422,"message",reason,"invalidType",reason,"invalid",row);
    }
    public Map<String, Object> backfill(Map<String, Object> body, Map<String, Object> user) {
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
        if (setting == null) {
            var groupKeys = store.table("eqp_group_eqp").stream().filter(r -> eq(r,"EQP_KEY",body.get("eqpKey"))).map(r -> s(r,"EQP_GROUP_KEY")).toList();
            var peers = store.table("eqp_group_eqp").stream().filter(r -> groupKeys.contains(s(r,"EQP_GROUP_KEY"))).map(r -> s(r,"EQP_KEY")).toList();
            setting = candidates.stream().filter(r -> peers.contains(s(r,"EQP_KEY"))).findFirst().orElse(null);
            match = "group-fallback";
        }
        if (setting == null) return invalid(body,"找不到事件");
        if (!active(setting)) return invalid(body,"警报设定未启用");
        var event = store.find("events","EVENT_KEY",setting.get("EVENT_KEY"));
        if (event == null || !active(event)) return invalid(body,"找不到事件");
        String settingKey = s(setting,"ALARM_INFO_KEY");
        int ignore = setting.containsKey("IGNORE_PERIOD") ? n(setting,"IGNORE_PERIOD") : 900;
        boolean duplicate = store.table("alarms").stream().anyMatch(r -> eq(r,"FACTORY_KEY",body.get("factoryKey"))
            && eq(r,"SUB_SYS_KEY",body.get("subsysKey")) && eq(r,"EQP_KEY",body.get("eqpKey")) && eq(r,"ALARM_INFO_KEY",settingKey)
            && (System.currentTimeMillis()-time(r.get("CREATE_DT"))) * speed() < ignore * 1000L);
        if (duplicate) return invalid(body,"忽略相同警报");
        if (eq(s,"BYPASS","Y")) {
            var alarm = create(body,setting,event,false);
            alarm.put("STATUS","LogOnly"); alarm.put("COMPLETE_DT",now());
            transaction(alarm,"Modify","Process",user,"子系统 BYPASS，仅记录");
            return m("ok",true,"alarm",enrich(alarm,user),"matchedBy",match,"logOnly",true);
        }
        var first = levels(event.get("EVENT_KEY")).stream().filter(r -> n(r,"EVENT_LEVEL_ID")==1).findFirst().orElse(null);
        if (first == null) return invalid(body,"未设定层级1");
        if (channels(first.get("EVENT_LEVEL_KEY")).isEmpty()) return invalid(body,"未设定发送方式");
        if (members(first.get("EVENT_LEVEL_KEY")).isEmpty()) return invalid(body,"未设定发送人员");
        if (store.table("eqp_type_status").stream().anyMatch(r -> eq(r,"EQP_TYPE_KEY",eqp.get("EQP_TYPE_KEY")) && eq(r,"EQP_STATUS_KEY",eqp.get("CURRENT_STATUS"))))
            return invalid(body,"在某机况下无需发送");
        var alarm = create(body,setting,event,false); startLevel(alarm,first,user);
        return m("ok",true,"alarm",enrich(alarm,user),"matchedBy",match,"logOnly",false);
    }
    private Map<String, Object> create(Map<String, Object> b, Map<String, Object> setting, Map<String, Object> event, boolean manual) {
        var alarm = m("ALARM_KEY",store.key("alarms"),"ALARM_ID",store.key("alarmId"),"TITLE",s(b,"title").isBlank() ? "Empty Subject" : b.get("title"),
            "CONTENT",s(b,"content").isBlank() ? "Empty Content" : b.get("content"),"STATUS","Process","FACTORY_KEY",b.get("factoryKey"),"SUB_SYS_KEY",b.get("subsysKey"),
            "EQP_KEY",manual ? "*" : b.get("eqpKey"),"ALARM_INFO_KEY",setting == null ? null : setting.get("ALARM_INFO_KEY"),
            "EVENT_KEY",event == null ? null : event.get("EVENT_KEY"),"CURRENT_LEVEL",1,"PRIORITY",setting == null ? 9 : setting.getOrDefault("EVENT_PTY_ID",5),
            "CREATE_DT",now(),"FIRST_PROCESS_DT",now(),"LEVEL_PROCESS_DT",now(),"SEND_DT",now(),"LAST_ACK_DT",null,"COMPLETE_DT",null,
            "RECEIVE_TYPE","WebPage","ACK_CMT",null,"TERMINATE_CMT",null,"IS_MANUAL",manual ? "Y" : "N","SOURCE_TYPE",manual ? "Manual" : "Backfill");
        store.table("alarms").addFirst(alarm); transaction(alarm,"Create","Open",null,"警报建立");
        var subject = store.find("alarm_subjects","SUBJECT",alarm.get("TITLE"));
        if (subject == null) {
            subject = m("SUBJECT_KEY",store.key("alarm_subjects"),"SUBJECT",alarm.get("TITLE"),"USE_COUNT",0);
            store.table("alarm_subjects").addFirst(subject);
        }
        subject.put("USE_COUNT",n(subject,"USE_COUNT")+1); subject.put("LAST_USED_DT",now());
        return alarm;
    }
    private void startLevel(Map<String, Object> alarm, Map<String, Object> level, Map<String, Object> user) {
        var members = members(level.get("EVENT_LEVEL_KEY"));
        int required = eq(level,"NUMBER_OF_ACK_USERS","*") ? members.size() : n(level,"NUMBER_OF_ACK_USERS");
        alarm.putAll(m("CURRENT_LEVEL",level.get("EVENT_LEVEL_ID"),"LEVEL_PROCESS_DT",now(),"SEND_DT",now(),"ACK_REQUIRED",required));
        store.table("alarm_levels").add(m("LEVEL_RUN_KEY",store.key("alarm_levels"),"ALARM_KEY",alarm.get("ALARM_KEY"),
            "LEVEL_ID",alarm.get("CURRENT_LEVEL"),"START_DT",now(),"REQUIRED_ACK",required,"ACK_COUNT",0,"RESEND_COUNT",0,
            "NEXT_RESEND_DT",Instant.ofEpochMilli(System.currentTimeMillis()+n(level,"FAIL_RETRY_INTERVAL")*1000L/speed()).toString(),
            "STATUS","Active","LEVEL_DESC",level.get("EVENT_LEVEL_DESC")));
        transaction(alarm,"Modify","Process",user,"LEVEL-"+n(alarm,"CURRENT_LEVEL")+" 发送");
        notifyLevel(alarm,level,false);
        if (required == 0) close(alarm,"Completed","AlarmComplete",user,"本层级无需回应");
    }
    private void notifyLevel(Map<String, Object> alarm, Map<String, Object> level, boolean retry) {
        // Preserve each group's own channels; never cross-product all groups/channels.
        Set<String> sent = new HashSet<>();
        for (var group : groups(level.get("EVENT_LEVEL_KEY"))) {
            var keys = store.table("event_group_users").stream().filter(r -> eq(r,"EVENT_GROUP_KEY",group.get("EVENT_GROUP_KEY"))).map(r -> s(r,"USER_KEY")).toList();
            for (var user : store.table("users").stream().filter(Json::active).filter(r -> keys.contains(s(r,"USER_KEY"))).toList()) {
                boolean acked = related("alarm_acks",alarm.get("ALARM_KEY")).stream().anyMatch(r -> eq(r,"USER_KEY",user.get("USER_KEY")) && n(r,"LEVEL_ID")==n(alarm,"CURRENT_LEVEL"));
                if (retry && acked) continue;
                for (String ch : s(group,"ENABLE_SEND_DEVICES").split(";")) {
                    if (CONTACT.containsKey(ch) && sent.add(s(user,"USER_KEY")+"|"+ch)) notifyOne(alarm,user,ch,retry);
                }
            }
        }
    }
    private void notifyOne(Map<String, Object> alarm, Map<String, Object> user, String channel, boolean retry) {
        var device = store.find("devices","DEVICE_ID",DEVICE.get(channel));
        String target = s(user,CONTACT.get(channel));
        String message = target.isBlank() ? "未设定联络资料" : device == null ? "找不到装置" :
            !eq(device,"ENABLE","Y") ? "装置未启用" : List.of("NG","Error","Close").contains(s(device,"DEVICE_STATUS")) ? "装置异常" : "";
        boolean success = message.isBlank();
        store.table("alarm_notifications").add(m("NOTIFY_KEY",store.key("alarm_notifications"),"ALARM_KEY",alarm.get("ALARM_KEY"),
            "USER_KEY",user.get("USER_KEY"),"LEVEL_ID",alarm.get("CURRENT_LEVEL"),"CHANNEL",channel,"TARGET",target,"SEND_DT",now(),
            "RESULT",success ? "Success" : "Fail","MESSAGE",success ? "模拟通道已派发" : message,"RETRY",retry ? 1 : 0));
        if (device != null) {
            device.put("RECEIVED_COUNT",n(device,"RECEIVED_COUNT")+1);
            String counter = success ? "SUCCESSFUL_COUNT" : "FAIL_COUNT";
            device.put(counter,n(device,counter)+1); device.put("TRX_DATE",now());
            if (success && eq(device,"DEVICE_STATUS","Unknown")) device.put("DEVICE_STATUS","OK");
        }
    }
    public Map<String, Object> manual(Map<String, Object> body, Map<String, Object> user) {
        require(active(store.mustFind("factories","FACTORY_KEY",body.get("factoryKey"))),"厂别已隐藏");
        require(active(store.mustFind("subsystems","SUB_SYS_KEY",body.get("subsysKey"))),"子系统已隐藏");
        require(store.table("factory_subsys").stream().anyMatch(r -> eq(r,"FACTORY_KEY",body.get("factoryKey")) && eq(r,"SUB_SYS_KEY",body.get("subsysKey"))),"子系统不属于所选厂别");
        var recipients = new LinkedHashSet<>(list(body.get("userKeys"))); var channels = new LinkedHashSet<>(list(body.get("channels")));
        require(!recipients.isEmpty() && !channels.isEmpty(),"请选择接收人员和发送方式");
        for (Object key : recipients) require(active(store.mustFind("users","USER_KEY",key)),"使用者已隐藏");
        for (Object ch : channels) require(CONTACT.containsKey(str(ch)),"发送方式无效");
        int required = eq(body,"requiredAck","*") ? recipients.size() : Math.max(1,n(body,"requiredAck"));
        require(required <= recipients.size(),"回应人数不可超过接收人数");
        var alarm = create(body,null,null,true); alarm.put("ACK_REQUIRED",required);
        store.table("alarm_levels").add(m("LEVEL_RUN_KEY",store.key("alarm_levels"),"ALARM_KEY",alarm.get("ALARM_KEY"),"LEVEL_ID",1,
            "START_DT",now(),"REQUIRED_ACK",required,"ACK_COUNT",0,"RESEND_COUNT",0,"STATUS","Active","LEVEL_DESC","手动发送"));
        transaction(alarm,"Modify","Process",user,"手动警报发送");
        for (Object key : recipients) for (Object ch : channels) notifyOne(alarm,store.mustFind("users","USER_KEY",key),str(ch),false);
        return m("ok",true,"alarm",enrich(alarm,user));
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
        } else if (action.equals("terminate")) {
            require(!eq(alarm,"IS_MANUAL","Y"),"手动发送的警报不支援中断");
            alarm.put("TERMINATE_CMT",b.get("cmt")); close(alarm,"Terminated","Terminate",user,s(b,"cmt"));
        } else throw new ApiException(404,"未知警报操作");
        return m("ok",true,"alarm",enrich(alarm,user),"completed",eq(alarm,"STATUS","Completed"));
    }
    public void tick() {
        long now = System.currentTimeMillis();
        for (var alarm : store.table("alarms").stream().filter(r -> eq(r,"STATUS","Process")).sorted(Comparator.comparingInt((Map<String,Object> r) -> n(r,"PRIORITY")).reversed()).toList()) {
            var run = run(alarm); if (run.isEmpty()) continue;
            if (n(run,"ACK_COUNT") >= n(run,"REQUIRED_ACK")) { close(alarm,"Completed","AlarmComplete",null,"回应人数达标"); continue; }
            var levels = levels(alarm.get("EVENT_KEY"));
            var level = levels.stream().filter(r -> n(r,"EVENT_LEVEL_ID")==n(alarm,"CURRENT_LEVEL")).findFirst().orElse(m());
            long interval = (eq(alarm,"IS_MANUAL","Y") ? 30 : Math.max(1,n(level,"LEVEL_INTERVAL")))*60000L/speed();
            if (now-time(run.get("START_DT")) >= interval) {
                var next = levels.stream().filter(r -> n(r,"EVENT_LEVEL_ID")==n(alarm,"CURRENT_LEVEL")+1).findFirst().orElse(null);
                if (next == null) close(alarm,"NoNextLevel","AlarmFail",null,"已无下一层级，逾时未达回应人数");
                else {
                    run.put("STATUS","Closed"); transaction(alarm,"LevelUpgrade","Process",null,"升级至 LEVEL-"+n(next,"EVENT_LEVEL_ID")); startLevel(alarm,next,null);
                }
            } else if (!level.isEmpty() && n(run,"RESEND_COUNT") < n(level,"FAIL_RETRY_TIMES") && now >= time(run.get("NEXT_RESEND_DT"))) {
                notifyLevel(alarm,level,true); run.put("RESEND_COUNT",n(run,"RESEND_COUNT")+1);
                run.put("NEXT_RESEND_DT",Instant.ofEpochMilli(now+n(level,"FAIL_RETRY_INTERVAL")*1000L/speed()).toString());
                transaction(alarm,"Modify","Process",null,"失败重送第 "+n(run,"RESEND_COUNT")+" 次");
            }
        }
    }
    public List<Map<String, Object>> scan(Map<String, Object> user) {
        for (var alarm : store.table("alarms").stream().filter(r -> List.of("Process","Completed").contains(s(r,"STATUS")))
                .filter(r -> System.currentTimeMillis()-time(r.get("CREATE_DT")) < 1_800_000).toList()) {
            for (var rule : store.table("auto_status_rules").stream().filter(Json::active).toList()) {
                if (!eq(rule,"ALARM_INFO_KEY",alarm.get("ALARM_INFO_KEY")) || !eq(rule,"SUB_SYS_KEY",alarm.get("SUB_SYS_KEY"))
                    || !(eq(rule,"EQP_KEY","*") || eq(rule,"EQP_KEY",alarm.get("EQP_KEY")))) continue;
                if (store.table("auto_status_logs").stream().anyMatch(r -> eq(r,"AUTO_KEY",rule.get("AUTO_KEY")) && eq(r,"ALARM_ID",alarm.get("ALARM_ID")))) continue;
                var eqp = store.find("eqps","EQP_KEY",alarm.get("EQP_KEY")); if (eqp == null) continue;
                if (!s(rule,"CHAMBER").isBlank() && store.table("chambers").stream().noneMatch(c ->
                    (eq(c,"PROCRSC_KEY",rule.get("CHAMBER")) || eq(c,"PROCRSC_ID",rule.get("CHAMBER")))
                    && eq(c,"EQP_KEY",eqp.get("EQP_KEY")) && active(c))) continue;
                if (!s(rule,"INITIAL_STATUS").isBlank() && !eq(eqp,"CURRENT_STATUS",rule.get("INITIAL_STATUS"))) continue;
                var target = store.find("eqp_status","EQP_STATUS_KEY",rule.get("TARGET_STATUS")); if (target == null) continue;
                var before = copy(eqp);
                eqp.put("CURRENT_STATUS",rule.get("TARGET_STATUS"));
                if (!s(rule,"TARGET_STATUS2").isBlank() && store.find("eqp_status","EQP_STATUS_KEY",rule.get("TARGET_STATUS2")) != null)
                    eqp.put("CURRENT_STATUS",rule.get("TARGET_STATUS2"));
                if (eq(rule,"RELATED_CHAMBER","Y")) store.table("chambers").stream().filter(r -> eq(r,"EQP_KEY",eqp.get("EQP_KEY")))
                    .forEach(r -> r.put("CURRENT_STATUS",eqp.get("CURRENT_STATUS")));
                store.table("auto_status_logs").addFirst(m("ALOG_KEY",store.key("auto_status_logs"),"AUTO_KEY",rule.get("AUTO_KEY"),
                    "EQP_ID",eqp.get("EQP_ID"),"ALARM_ID",alarm.get("ALARM_ID"),"FROM_STATUS",before.get("CURRENT_STATUS"),
                    "TO_STATUS",eqp.get("CURRENT_STATUS"),"TRX_DT",now(),"RESULT","Success","MESSAGE","本地模拟切机况"));
                store.audit("eqps",s(eqp,"EQP_KEY"),"Modify",before,eqp,user);
            }
        }
        return store.table("auto_status_logs").stream().limit(30).toList();
    }
}
