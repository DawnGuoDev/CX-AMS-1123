package com.changxin.ams;

import static com.changxin.ams.Json.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class ApiController {
    private static final Logger LOG=LoggerFactory.getLogger(ApiController.class);
    private final Store store; private final Auth auth; private final Masters masters;
    private final AlarmEngine engine; private final Reports reports; private final Configurations configs; private final Excel excel;
    public ApiController(Store store,Auth auth,Masters masters,AlarmEngine engine,Reports reports,Configurations configs,Excel excel) {
        this.store=store; this.auth=auth; this.masters=masters; this.engine=engine; this.reports=reports; this.configs=configs; this.excel=excel;
    }
    @RequestMapping(value="/api/**",method={RequestMethod.GET,RequestMethod.POST,RequestMethod.PUT})
    public ResponseEntity<Object> api(HttpServletRequest req,@RequestBody(required=false) Map<String,Object> input,@RequestParam Map<String,String> query) {
        var body=input == null ? m() : input; var q=new LinkedHashMap<String,Object>(query);
        String path=req.getRequestURI().substring(5), method=req.getMethod();
        String header=req.getHeader("Authorization"), token=header != null && header.startsWith("Bearer ") ? header.substring(7) : "";
        Supplier<Object> work=() -> {
            if (path.equals("login") && method.equals("POST")) return auth.login(body);
            var user=auth.user(token);
            if (path.equals("logout") && method.equals("POST")) { auth.logout(token); return m("ok",true); }
            if (path.equals("me")) return m("ok",true,"user",user,"loginAt",auth.loginAt(token),"settings",store.data().get("settings"),"serverTime",now());
            if (path.equals("bootstrap")) return m("ok",true,"user",user,"loginAt",auth.loginAt(token),"nav",masters.nav(),
                "options",masters.options(),"meta",store.metadata,"settings",store.data().get("settings"),"serverTime",now());
            if (method.equals("GET")) return get(path,q,user);
            return mutate(path,method,q,body,user);
        };
        Object result=method.equals("GET") ? store.read(work) : store.write(work);
        int status=result instanceof Map && Boolean.FALSE.equals(obj(result).get("ok")) ? num(obj(result).getOrDefault("status",400)) : 200;
        return ResponseEntity.status(status).body(result);
    }
    private Object get(String path,Map<String,Object> q,Map<String,Object> user) {
        String[] p=path.split("/");
        if (p.length>=2 && List.of("master","mapping","masterdetail").contains(p[0])) {
            String kind=kind(p[0]);
            if (p.length==3 && p[2].equals("history")) {
                var meta=masters.meta(kind,p[1]);
                return m("ok",true,"rows",store.history(s(meta,kind.equals("masters") ? "table" : kind.equals("mappings") ? "mapTable" : "masterTable"),s(q,"key")));
            }
            if (p.length==2) return masters.get(kind,p[1],q);
        }
        if (Configurations.TYPES.containsKey(p[0])) {
            if (p.length==1) return configs.get(p[0],q);
            if (p[0].equals("report-defs") && p.length==2) {
                var row=copy(store.mustFind("report_defs","REPORT_ID",p[1]));
                for (String f : List.of("CONDITIONS","COLUMNS","DISPLAY","ADVANCED"))
                    row.put(f,parse(str(row.getOrDefault(f+"_JSON",List.of("CONDITIONS","COLUMNS").contains(f) ? "[]" : "{}"))));
                return m("ok",true,"row",row);
            }
        }
        return switch (path) {
            case "nav" -> m("ok",true,"nav",masters.nav());
            case "options" -> m("ok",true,"options",masters.options());
            case "functions" -> m("ok",true,"rows",store.table("functions"));
            case "devices" -> m("ok",true,"rows",store.table("devices"),"history",store.history("devices",null));
            case "event-tree" -> configs.tree(s(q,"factory"),s(q,"subsys"));
            case "dashboard" -> reports.dashboard(user);
            case "inbox" -> reports.inbox(user);
            case "summary/master" -> m("ok",true,"rows",reports.summary("",""));
            case "summary/detail" -> m("ok",true,"rows",reports.summary(s(q,"factory"),s(q,"subsys")));
            case "alarms/pending" -> m("ok",true,"rows",reports.pending(user));
            case "alarms/process" -> m("ok",true,"rows",store.table("alarms").stream().filter(r -> eq(r,"STATUS","Process") && !eq(r,"IS_MANUAL","Y")).map(r -> engine.enrich(r,user)).toList());
            case "alarm-subjects" -> m("ok",true,"rows",store.table("alarm_subjects"));
            case "alarms/manual/options","alarms/backfill/options" -> alarmOptions(q);
            case "batch-alarm/query" -> m("ok",true,"rows",batchRows(q));
            case "health" -> m("ok",true,"version","java-vue-1.0.0","time",now());
            default -> {
                if (p.length==2 && p[0].equals("alarms")) yield m("ok",true,"alarm",engine.detail(p[1],user));
                throw new ApiException(404,"API 不存在");
            }
        };
    }
    private String kind(String route) { return switch(route) { case "master" -> "masters"; case "mapping" -> "mappings"; default -> "masterDetails"; }; }
    private Object mutate(String path,String method,Map<String,Object> q,Map<String,Object> body,Map<String,Object> user) {
        String[] p=path.split("/");
        if (p.length>=2 && List.of("master","mapping","masterdetail").contains(p[0])) {
            String kind=kind(p[0]);
            if (p[0].equals("masterdetail") && p.length>=3 && List.of("export","import").contains(p[2]))
                throw new ApiException(400,"主从档请使用页面维护主档与明细");
            if (p.length==3 && p[2].equals("export")) return excel.export(kind,p[1],eq(body,"mode","template"));
            if (p.length==4 && p[2].equals("import") && p[3].equals("verify")) return excel.verify(kind,p[1],s(body,"base64"));
            if (p.length==3 && p[2].equals("import")) return excel.importRows(kind,p[1],rows(body.get("rows")),user);
            if (p.length==4) return masters.hide(kind,p[1],p[2],p[3],user);
            if (p[0].equals("mapping") && p.length==3) return masters.saveMapping(p[1],p[2],list(body.get("itemKeys")),user);
            if ((p[0].equals("master") && (p.length==2 || method.equals("PUT"))) || p[0].equals("masterdetail"))
                return masters.save(kind,p[1],p.length>2 ? p[2] : null,body,user);
        }
        if (Configurations.TYPES.containsKey(p[0]) && !path.equals("auto-status/scan")) {
            if (p.length==1) return configs.save(p[0],body,user);
            if (p.length==3) { var def=Configurations.TYPES.get(p[0]); return masters.setActive(def.get(0),def.get(1),p[1],p[2],user); }
        }
        if (p.length==3 && p[0].equals("reports")) {
            var data=reports.query(p[1],obj(body.get("conditions"))); var def=store.mustFind("report_defs","REPORT_ID",p[1]);
            var columns=rows(parse(str(def.getOrDefault("COLUMNS_JSON","[]"))));
            if (p[2].equals("export")) return excel.workbook(p[1],columns,data);
            if (p[2].equals("query")) return m("ok",true,"rows",data,"columns",columns,"total",data.size(),"lastUpdate",now());
        }
        if (p.length==3 && p[0].equals("alarms")) return engine.action(p[1],p[2],body,user);
        switch (path) {
            case "alarms/backfill": return engine.backfill(body,user);
            case "alarms/manual": return engine.manual(body,user);
            case "functions": return configs.functions(body,user);
            case "event-tree/save": return configs.saveTree(body,user);
            case "auto-status/scan": return m("ok",true,"logs",engine.scan(user));
            case "devices/save":
                for (var item : rows(body.get("items"))) {
                    var row=store.mustFind("devices","DEVICE_KEY",item.get("DEVICE_KEY")); var before=copy(row);
                    row.put("ENABLE",eq(item,"ENABLE","Y") ? "Y" : "N"); store.audit("devices",s(row,"DEVICE_KEY"),"Modify",before,row,user);
                }
                return m("ok",true);
            case "batch-alarm/change":
                require(List.of("Y","N").contains(s(body,"active")),"状态无效");
                for (Object key : list(body.get("keys"))) masters.hide("masters","AVMA009",str(key),eq(body,"active","Y") ? "show" : "hide",user);
                return m("ok",true,"changed",list(body.get("keys")).size());
            case "settings":
                require(n(body,"demoSpeed")>=1 && n(body,"demoSpeed")<=120,"时钟倍率必须在 1～120");
                obj(store.data().get("settings")).put("demoSpeed",n(body,"demoSpeed")); return m("ok",true,"settings",store.data().get("settings"));
            case "sql/parse","sql/test": return sql(s(body,"sql"),path.endsWith("test"));
            default: throw new ApiException(404,"API 不存在");
        }
    }
    private List<Map<String,Object>> batchRows(Map<String,Object> q) {
        return store.table("alarm_settings").stream().filter(r -> {
            for (String[] pair : new String[][]{{"active","ACTIVE"},{"factoryKey","FACTORY_KEY"},{"subsysKey","SUB_SYS_KEY"},{"eqpKey","EQP_KEY"}})
                if (!s(q,pair[0]).isBlank() && !eq(r,pair[1],q.get(pair[0]))) return false;
            if (!s(r,"ALARM_INFO_ID").toLowerCase(Locale.ROOT).contains(s(q,"alarmCode").toLowerCase(Locale.ROOT))) return false;
            return s(q,"groupKey").isBlank() || eq(r,"EQP_KEY","*") || store.table("eqp_group_eqp").stream().anyMatch(m -> eq(m,"EQP_GROUP_KEY",q.get("groupKey")) && eq(m,"EQP_KEY",r.get("EQP_KEY")));
        }).toList();
    }
    private Map<String,Object> alarmOptions(Map<String,Object> q) {
        var options=masters.options();
        var groups=store.table("eqp_group_eqp").stream().filter(r -> eq(r,"EQP_KEY",q.get("eqpKey"))).map(r -> s(r,"EQP_GROUP_KEY")).toList();
        var peers=store.table("eqp_group_eqp").stream().filter(r -> groups.contains(s(r,"EQP_GROUP_KEY"))).map(r -> s(r,"EQP_KEY")).toList();
        Map<String,Map<String,Object>> codes=new LinkedHashMap<>();
        for (var r : store.table("alarm_settings").stream().filter(Json::active).filter(r -> eq(r,"FACTORY_KEY",q.get("factoryKey")) && eq(r,"SUB_SYS_KEY",q.get("subsysKey"))).toList()) {
            String match=eq(r,"EQP_KEY","*") || eq(r,"EQP_KEY",q.get("eqpKey")) ? "exact" : peers.contains(s(r,"EQP_KEY")) ? "fallback" : "none";
            if (match.equals("none")) continue;
            if (!codes.containsKey(s(r,"ALARM_INFO_ID")) || match.equals("exact")) codes.put(s(r,"ALARM_INFO_ID"),
                m("value",r.get("ALARM_INFO_ID"),"label",s(r,"ALARM_INFO_ID")+" "+s(r,"ALARM_ID_DESC")+(match.equals("fallback") ? "（群组回退）" : ""),"match",match,"settingKey",r.get("ALARM_INFO_KEY")));
        }
        return m("ok",true,"factories",options.get("factory"),"subsystems",s(q,"factoryKey").isBlank() ? options.get("subsystem") :
            obj(options.get("subsystemByFactory")).getOrDefault(s(q,"factoryKey"),List.of()),"eqps",options.get("eqp"),
            "alarmCodes",new ArrayList<>(codes.values()),"users",options.get("user"),"channels",options.get("sendChannel"));
    }
    private Map<String,Object> sql(String sql,boolean test) {
        var matcher=Pattern.compile("(?is)^\\s*select\\s+(.+?)\\s+from\\s+").matcher(sql);
        require(matcher.find(),"请输入 SELECT … FROM …；仅解析结构，不连接业务数据库");
        var fields=Arrays.stream(matcher.group(1).split(",")).map(String::trim).map(text -> {
            var alias=Pattern.compile("(?i)\\s+as\\s+(\\w+)$").matcher(text);
            String name=alias.find() ? alias.group(1) : text.substring(text.lastIndexOf('.')+1).replaceAll("[^A-Za-z0-9_]","");
            return m("name",name,"label",name,"raw",text);
        }).filter(r -> !s(r,"name").isBlank()).toList();
        var data=new ArrayList<Map<String,Object>>();
        if (test) for (int i=1;i<=3;i++) { var row=m(); for (var field : fields) row.put(s(field,"name"),"SAMPLE-"+i); data.add(row); }
        return m("ok",true,"fields",fields,"rows",data,"simulated",true,"message","仅结构解析与模拟结果，SQL 未执行");
    }
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Object> business(ApiException e) { return ResponseEntity.status(e.status).body(m("ok",false,"message",e.getMessage())); }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> unexpected(Exception e) {
        String trace=UUID.randomUUID().toString();
        LOG.error("[AMS] request failed traceId={} type={}",trace,e.getClass().getSimpleName());
        return ResponseEntity.internalServerError().body(m("ok",false,"message","系统错误","traceId",trace));
    }
}
