package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class Configurations {
    public static final Map<String,List<String>> TYPES = Map.of(
        "brm-defs",List.of("brm_defs","BRM_KEY","BRM_ID","BRM_NAME"),
        "batch-defs",List.of("batch_defs","BATCH_KEY","BATCH_ID","BATCH_NAME"),
        "alarm-conditions",List.of("alarm_conditions","CONDITION_KEY","CONDITION_ID","CONDITION_NAME"),
        "auto-status",List.of("auto_status_rules","AUTO_KEY","AUTO_ID","AUTO_NAME"),
        "report-defs",List.of("report_defs","REPORT_KEY","REPORT_ID","REPORT_NAME"));
    private final Store store; private final Masters masters;
    public Configurations(Store store, Masters masters) { this.store=store; this.masters=masters; }
    public Map<String,Object> get(String type, Map<String,Object> query) {
        var def=TYPES.get(type);
        var rows=masters.filtered(def.get(0),query).stream().filter(r -> !type.equals("brm-defs") || s(query,"type").isBlank() || eq(r,"BRM_TYPE",query.get("type"))).toList();
        return m("ok",true,"rows",rows,"history",store.history(def.get(0),null),"logs",type.equals("auto-status") ? store.table("auto_status_logs") : List.of());
    }
    public Map<String,Object> save(String type, Map<String,Object> body, Map<String,Object> user) {
        var def=TYPES.get(type);
        require(!s(body,def.get(2)).isBlank() && !s(body,def.get(3)).isBlank(),"代码与名称为必填");
        String key=s(body,def.get(1));
        require(store.table(def.get(0)).stream().noneMatch(r -> eq(r,def.get(2),body.get(def.get(2))) && !eq(r,def.get(1),key)),"代码已存在");
        var old=key.isBlank() ? null : store.mustFind(def.get(0),def.get(1),key);
        var row=old == null ? m() : copy(old); row.putAll(body);
        for (var e : new ArrayList<>(row.entrySet())) if (e.getKey().endsWith("_JSON")) {
            if (e.getValue() instanceof String text) parse(text);
            else row.put(e.getKey(),encode(e.getValue()));
        }
        if (type.equals("report-defs")) for (String field : List.of("CONDITIONS","COLUMNS","DISPLAY","ADVANCED"))
            if (body.containsKey(field)) row.put(field+"_JSON",encode(body.get(field)));
        if (type.equals("auto-status")) {
            store.mustFind("subsystems","SUB_SYS_KEY",row.get("SUB_SYS_KEY"));
            if (!eq(row,"EQP_KEY","*")) store.mustFind("eqps","EQP_KEY",row.get("EQP_KEY"));
            var alarm=store.mustFind("alarm_settings","ALARM_INFO_KEY",row.get("ALARM_INFO_KEY"));
            require(eq(alarm,"SUB_SYS_KEY",row.get("SUB_SYS_KEY")),"警报不属于所选子系统");
            store.mustFind("eqp_status","EQP_STATUS_KEY",row.get("TARGET_STATUS"));
            for (String status : List.of("INITIAL_STATUS","TARGET_STATUS2")) if (!s(row,status).isBlank()) store.mustFind("eqp_status","EQP_STATUS_KEY",row.get(status));
        }
        if (old == null) { row.put(def.get(1),store.key(def.get(0))); row.put("ACTIVE","Y"); }
        masters.stamp(row,user);
        store.audit(def.get(0),s(row,def.get(1)),old == null ? "AddNew" : "Modify",old,row,user);
        if (old != null) { old.clear(); old.putAll(row); } else store.table(def.get(0)).addFirst(row);
        return m("ok",true,"row",row);
    }
    public Map<String,Object> tree(String factory, String subsys) {
        require(!factory.isBlank() && !subsys.isBlank(),"请选择厂别与子系统");
        var tree=store.table("events").stream().filter(Json::active).filter(e -> eq(e,"FACTORY_KEY",factory) && eq(e,"SUB_SYS_KEY",subsys)).map(e -> {
            var event=copy(e);
            event.put("LEVELS",store.table("event_levels").stream().filter(Json::active).filter(l -> eq(l,"EVENT_KEY",e.get("EVENT_KEY")))
                .sorted(Comparator.comparingInt(l -> n(l,"EVENT_LEVEL_ID"))).map(l -> {
                    var level=copy(l);
                    level.put("GROUPS",store.table("event_level_groups").stream().filter(g -> eq(g,"EVENT_LEVEL_KEY",l.get("EVENT_LEVEL_KEY"))).map(g -> {
                        var group=copy(g); var def=store.find("event_groups","EVENT_GROUP_KEY",g.get("EVENT_GROUP_KEY"));
                        if (def != null) group.putAll(m("EVENT_GROUP_ID",def.get("EVENT_GROUP_ID"),"EVENT_GROUP_NAME",def.get("EVENT_GROUP_NAME")));
                        group.put("MEMBER_COUNT",store.table("event_group_users").stream().filter(u -> eq(u,"EVENT_GROUP_KEY",g.get("EVENT_GROUP_KEY"))).count());
                        return group;
                    }).toList()); return level;
                }).toList()); return event;
        }).toList();
        var options=masters.options();
        return m("ok",true,"tree",tree,"groups",obj(options.get("groupByFactorySubsys")).getOrDefault(factory+"||"+subsys,List.of()),
            "channels",options.get("sendChannel"),"imGroupTypes",options.get("imGroupType"));
    }
    public Map<String,Object> saveTree(Map<String,Object> b, Map<String,Object> user) {
        String factory=s(b,"factoryKey"),subsys=s(b,"subsysKey");
        require(!factory.isBlank() && !subsys.isBlank(),"请选择厂别与子系统");
        var events=store.table("events").stream().filter(e -> eq(e,"FACTORY_KEY",factory) && eq(e,"SUB_SYS_KEY",subsys)).map(e -> s(e,"EVENT_KEY")).toList();
        var levelKeys=store.table("event_levels").stream().filter(l -> events.contains(s(l,"EVENT_KEY"))).map(l -> s(l,"EVENT_LEVEL_KEY")).toList();
        Set<String> seen=new HashSet<>(); var replacement=new ArrayList<Map<String,Object>>();
        for (var level : rows(b.get("levels"))) {
            String key=s(level,"levelKey"); require(levelKeys.contains(key) && seen.add(key),"层级不属于本厂别／子系统或重复");
            Set<String> groups=new HashSet<>();
            for (var g : rows(level.get("groups"))) {
                var group=store.mustFind("event_groups","EVENT_GROUP_KEY",g.get("groupKey"));
                require(active(group) && eq(group,"FACTORY_KEY",factory) && eq(group,"SUB_SYS_KEY",subsys),"通知群组不属于本厂别／子系统");
                require(groups.add(s(g,"groupKey")),"通知群组重复");
                var devices=g.get("devices") instanceof List ? list(g.get("devices")).stream().map(Json::str).toList() : Arrays.asList(s(g,"devices").split(";"));
                require(!devices.isEmpty() && devices.stream().allMatch(d -> List.of("Email","Sms","Phone","Voice","IM").contains(d)),"发送方式无效");
                replacement.add(m("ELG_KEY",store.key("event_level_groups"),"EVENT_LEVEL_KEY",key,"EVENT_GROUP_KEY",g.get("groupKey"),
                    "ENABLE_SEND_DEVICES",String.join(";",devices),"E_IM_GROUP_TYPE",g.getOrDefault("imType","ByEventGroup"),"GROUP_SEQ",groups.size(),"ACTIVE","Y"));
            }
        }
        require(seen.size()==levelKeys.size(),"请提交该厂别／子系统的完整层级");
        var before=store.table("event_level_groups").stream().filter(g -> levelKeys.contains(s(g,"EVENT_LEVEL_KEY"))).map(Json::copy).toList();
        store.table("event_level_groups").removeIf(g -> levelKeys.contains(s(g,"EVENT_LEVEL_KEY")));
        store.table("event_level_groups").addAll(replacement);
        store.audit("event_level_groups",factory+"||"+subsys,"Modify",before,replacement,user);
        return m("ok",true);
    }
    public Map<String,Object> functions(Map<String,Object> b, Map<String,Object> user) {
        require(b.get("nodes") instanceof List,"菜单格式错误");
        var nodes=rows(b.get("nodes")); Set<String> ids=new HashSet<>(),keys=new HashSet<>();
        for (var n : nodes) {
            require(!s(n,"FUNCTION_ID").isBlank() && ids.add(s(n,"FUNCTION_ID")),"功能代码为空或重复");
            if (s(n,"FUNCTION_KEY").isBlank()) n.put("FUNCTION_KEY",store.key("functions"));
            require(keys.add(s(n,"FUNCTION_KEY")),"菜单主键重复");
        }
        Map<String,String> parents=new HashMap<>();
        for (var n : nodes) {
            String parent=s(n,"PARENT_KEY");
            require(parent.isBlank() || keys.contains(parent),"父菜单不存在");
            parents.put(s(n,"FUNCTION_KEY"),parent);
        }
        for (String key : keys) {
            Set<String> path=new HashSet<>();
            for (String cursor=key; !cursor.isBlank(); cursor=parents.getOrDefault(cursor,"")) require(path.add(cursor),"菜单不可循环引用");
        }
        store.audit("functions","*","Modify",store.table("functions"),nodes,user);
        store.data().put("functions",nodes);
        return m("ok",true,"nav",masters.nav());
    }
}
