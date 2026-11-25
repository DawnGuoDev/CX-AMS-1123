package com.changxin.ams;

import static com.changxin.ams.Json.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class ApiController {
    private static final Logger LOG=LoggerFactory.getLogger(ApiController.class);
    private final Store store; private final Auth auth; private final Masters masters;
    private final AlarmEngine engine; private final Reports reports; private final Excel excel; private final SmtpDelivery smtp;
    public ApiController(Store store,Auth auth,Masters masters,AlarmEngine engine,Reports reports,Excel excel,SmtpDelivery smtp) {
        this.store=store; this.auth=auth; this.masters=masters; this.engine=engine; this.reports=reports; this.excel=excel; this.smtp=smtp;
    }
    @RequestMapping(value="/api/**",method={RequestMethod.GET,RequestMethod.POST,RequestMethod.PUT})
    public ResponseEntity<Object> api(HttpServletRequest req,@RequestBody(required=false) Map<String,Object> input,@RequestParam Map<String,String> query) {
        var body=input == null ? m() : input; var q=new LinkedHashMap<String,Object>(query);
        String path=req.getRequestURI().substring(5), method=req.getMethod();
        String header=req.getHeader("Authorization"), token=header != null && header.startsWith("Bearer ") ? header.substring(7) : "";
        Supplier<Object> work=() -> {
            if (path.equals("login") && method.equals("POST")) return auth.login(body);
            var user=copy(auth.user(token));
            user.put("_REQUEST_IP",req.getRemoteAddr());
            if (path.equals("logout") && method.equals("POST")) { auth.logout(token); return m("ok",true); }
            if (path.equals("bootstrap") && method.equals("GET")) return m("ok",true,"user",user,"loginAt",auth.loginAt(token),
                "nav",masters.nav(),"options",masters.options(),"meta",store.metadata,"smtpConfigured",smtp.configured(),"serverTime",now());
            if (method.equals("GET")) return get(path,q,user);
            return mutate(path,method,body,user);
        };
        Object result=method.equals("GET") ? store.read(work) : store.write(work);
        int status=result instanceof Map && Boolean.FALSE.equals(obj(result).get("ok")) ? num(obj(result).getOrDefault("status",400)) : 200;
        return ResponseEntity.status(status).body(result);
    }
    private boolean masterRoute(String route) { return List.of("master","mapping","masterdetail").contains(route); }
    private String kind(String route) { return switch(route) { case "master" -> "masters"; case "mapping" -> "mappings"; default -> "masterDetails"; }; }
    private Object get(String path,Map<String,Object> q,Map<String,Object> user) {
        String[] p=path.split("/");
        if (p.length>=2 && masterRoute(p[0])) {
            String kind=kind(p[0]);
            if (p.length==3 && p[2].equals("history")) {
                var meta=masters.meta(kind,p[1]);
                return m("ok",true,"rows",store.history(s(meta,kind.equals("masters") ? "table" : kind.equals("mappings") ? "mapTable" : "masterTable"),s(q,"key")));
            }
            if (p.length==2) return masters.get(kind,p[1],q);
        }
        if (p.length==2 && p[0].equals("report-defs")) return m("ok",true,"row",reports.definition(p[1]));
        return switch (path) {
            case "options" -> m("ok",true,"options",masters.options());
            case "summary/master" -> m("ok",true,"rows",reports.summary("",""));
            case "summary/detail" -> m("ok",true,"rows",reports.summary(s(q,"factory"),s(q,"subsys")));
            case "alarms/pending" -> m("ok",true,"rows",reports.pending(user));
            case "alarms/test/options" -> alarmOptions(q);
            default -> {
                if (p.length==2 && p[0].equals("alarms")) yield m("ok",true,"alarm",s(q,"transaction").isBlank()
                    ? engine.detail(p[1],user) : engine.historicalDetail(p[1],s(q,"transaction"),user));
                throw new ApiException(404,"API 不存在");
            }
        };
    }
    private Object mutate(String path,String method,Map<String,Object> body,Map<String,Object> user) {
        String[] p=path.split("/");
        if (p.length>=2 && masterRoute(p[0])) {
            String kind=kind(p[0]);
            masters.meta(kind,p[1]);
            if (p[0].equals("masterdetail") && p.length>=3 && List.of("export","import").contains(p[2]))
                throw new ApiException(400,"事件主档及层级请使用页面维护");
            if (method.equals("POST")) {
                if (p.length==3 && p[2].equals("export")) return excel.export(kind,p[1],eq(body,"mode","template"));
                if (p.length==4 && p[2].equals("import") && p[3].equals("verify")) return excel.verify(kind,p[1],s(body,"base64"));
                if (p.length==3 && p[2].equals("import")) return excel.importRows(kind,p[1],rows(body.get("rows")),user);
                if (p.length==4 && !p[0].equals("mapping")) return masters.hide(kind,p[1],p[2],p[3],user);
                if (p[0].equals("mapping") && p.length==3) return masters.saveMapping(p[1],p[2],list(body.get("itemKeys")),user);
                if (p.length==2 && !p[0].equals("mapping")) return masters.save(kind,p[1],null,body,user);
            }
            if (method.equals("PUT") && p[0].equals("master") && p.length==3) return masters.save(kind,p[1],p[2],body,user);
        }
        if (method.equals("POST") && p.length==3 && p[0].equals("reports")) {
            var def=reports.definition(p[1]);
            var columns=p[1].equals("AVPA013") ? reports.summaryColumns(!s(body,"factory").isBlank()) : rows(def.get("COLUMNS"));
            // Export the visible query snapshot, including column filters and sort order.
            // Only declared report columns are written; this endpoint never mutates business data.
            if (p[2].equals("export")) return excel.workbook(s(def,"REPORT_NAME"),columns,rows(body.get("rows")));
            var data=reports.query(p[1],obj(body.get("conditions")));
            if (p[1].equals("AVPA013") && !s(body,"factory").isBlank()) {
                data=reports.summary(s(body,"factory"),s(body,"subsys"));
            }
            if (p[2].equals("query")) return m("ok",true,"rows",data,"columns",columns,"total",data.size(),"lastUpdate",now());
        }
        if (method.equals("POST") && p.length==3 && p[0].equals("alarms") && p[2].equals("ack")) return engine.action(p[1],"ack",body,user);
        if (method.equals("POST") && path.equals("alarms/test")) return engine.trigger(body,user);
        throw new ApiException(404,"API 不存在");
    }
    private Map<String,Object> alarmOptions(Map<String,Object> q) {
        var options=masters.options();
        Map<String,Map<String,Object>> codes=new LinkedHashMap<>();
        for (var r : store.table("alarm_settings").stream().filter(Json::active).filter(r ->
            eq(r,"FACTORY_KEY",q.get("factoryKey")) && eq(r,"SUB_SYS_KEY",q.get("subsysKey"))
            && (eq(r,"EQP_KEY","*") || eq(r,"EQP_KEY",q.get("eqpKey")))).toList())
            codes.put(s(r,"ALARM_INFO_ID"),m("value",r.get("ALARM_INFO_ID"),"label",s(r,"ALARM_INFO_ID")+" "+s(r,"ALARM_ID_DESC")));
        return m("ok",true,"factories",options.get("factory"),"subsystems",
            obj(options.get("subsystemByFactory")).getOrDefault(s(q,"factoryKey"),List.of()),
            "eqps",options.get("eqp"),"alarmCodes",new ArrayList<>(codes.values()));
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
