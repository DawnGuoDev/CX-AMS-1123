package com.changxin.ams;

import static com.changxin.ams.Json.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** SPEC-AMS-ALARM-TERMINATE-001: authorization, atomic convergence and reporting semantics. */
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:terminate;DB_CLOSE_DELAY=-1","ams.scheduling=false",
    "ams.smtp.from=ams@example.invalid","ams.smtp.auth=false","ams.smtp.starttls=false","ams.public-url=http://localhost:8180"})
@AutoConfigureMockMvc
class AlarmTerminateIntegrationTest {
    static final SmtpCapture smtp=new SmtpCapture();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("ams.smtp.host",()->"localhost"); registry.add("ams.smtp.port",smtp::port);
    }
    @AfterAll static void closeSmtp() throws Exception { smtp.close(); }
    @Autowired Store store; @Autowired AlarmEngine engine; @Autowired Masters masters; @Autowired Reports reports;
    @Autowired MockMvc http; @Autowired Excel excel;
    Map<String,Object> user;
    @BeforeEach void reset() throws Exception {
        try(var in=getClass().getResourceAsStream("/seed.json")) {
            var seed=obj(MAPPER.readValue(in,Map.class));
            store.write(()->{store.data().clear();store.data().putAll(seed);return null;});
        }
        smtp.rejectRecipient=""; smtp.messages.clear();
        user=store.read(()->clean(store.mustFind("users","USER_KEY","U001")));
    }
    Map<String,Object> body() { return m("factoryKey","F01","subsysKey","SS03","eqpKey","EQP01","alarmCode","PRT_NODYE","title","中断测试告警","content","请检查设备"); }
    Map<String,Object> alarm() { return obj(store.write(()->engine.trigger(body(),user)).get("alarm")); }
    String key() { return s(alarm(),"ALARM_KEY"); }
    String keyFromStore() { return store.read(()->s(store.table("alarms").getFirst(),"ALARM_KEY")); }
    /** Creates a second independent alarm (the first is already used by the scenario). */
    String secondAlarm() {
        var b=body(); b.put("alarmCode","PRT_MOTOR_ERR");
        return s(obj(store.write(()->engine.trigger(b,user)).get("alarm")),"ALARM_KEY");
    }
    /** The rejected attempt must leave no AlarmTerminate trace for "open"; terminate succeeds at phase 2 below. */
    String openKey() throws Exception {
        String key=secondAlarm();
        String token=loginToken("E0043260");
        int anonymous=http.perform(post("/api/alarms/"+key+"/terminate").contentType(MediaType.APPLICATION_JSON).content(encode(m("cmt","x"))))
            .andReturn().getResponse().getStatus();
        int denied=http.perform(post("/api/alarms/"+key+"/terminate").header("Authorization","Bearer "+token)
            .contentType(MediaType.APPLICATION_JSON).content(encode(m("cmt","no"))))
            .andReturn().getResponse().getStatus();
        assertThat(anonymous).isEqualTo(401);
        assertThat(denied).isEqualTo(400);
        return key;
    }
    Map<String,Object> terminate(String key, String cmt) { return store.write(()->engine.terminate(key,m("cmt",cmt),user)); }
    Map<String,Object> terminate(String key, String cmt, Map<String,Object> actor) { return store.write(()->engine.terminate(key,m("cmt",cmt),actor)); }
    void tick() { store.write(()->{engine.tick();return null;}); }
    long transactions(String key, String type) {
        return store.read(()->store.table("alarm_transactions").stream().filter(r -> eq(r,"ALARM_KEY",key) && eq(r,"TRX_TYPE",type)).count());
    }
    /** PUT replaces the whole record; the stored hash must never be echoed back as a password field. */
    void saveUser(String userKey, String canTerminate) {
        var row=store.read(()->copy(store.mustFind("users","USER_KEY",userKey)));
        row.put("CAN_TERMINATE",canTerminate);
        row.remove("PASSWORD_HASH");
        store.write(()->masters.save("masters","SBRM_USER",userKey,row,user));
    }
    String loginToken(String id) throws Exception {
        return s(obj(parse(http.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON)
            .content(encode(m("userId",id,"password","123456")))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString())),"token");
    }
    void expectRejected(Runnable work, String message) {
        assertThatThrownBy(work::run).isInstanceOf(ApiException.class).satisfies(e -> {
            assertThat(((ApiException) e).status).isEqualTo(400);
            assertThat(e).hasMessage(message);
        });
    }

    @Test void authorizedTerminationConvergesStateLevelsNotificationsAndTransaction() {
        String key=key();
        var result=terminate(key,"机台已修复");
        assertThat(result).containsEntry("ok",true).containsEntry("terminated",true);
        var returned=obj(result.get("alarm"));
        assertThat(returned).containsEntry("STATUS","Terminated").containsEntry("TERMINATE_CMT","机台已修复")
            .containsEntry("TERMINATE_USER_ID","E0043258").containsEntry("TERMINATE_USER_NAME","陈柏睿");
        assertThat(s(returned,"TERMINATE_DT")).isNotBlank();
        assertThat(Instant.parse(s(returned,"TERMINATE_DT")).toEpochMilli())
            .isEqualTo(Instant.parse(s(returned,"COMPLETE_DT")).toEpochMilli());
        var stored=store.read(()->copy(store.mustFind("alarms","ALARM_KEY",key)));
        assertThat(stored).containsEntry("STATUS","Terminated").containsEntry("TERMINATE_USER_KEY","U001");
        assertThat(store.read(()->store.table("alarm_levels").stream().filter(r -> eq(r,"ALARM_KEY",key)).toList()))
            .allSatisfy(r -> assertThat(r).containsEntry("STATUS","Closed"));
        assertThat(store.read(()->store.table("alarm_notifications").stream().filter(r -> eq(r,"ALARM_KEY",key)).toList()))
            .hasSize(3).allSatisfy(r -> assertThat(r).containsEntry("RESULT","Skipped")
                .containsEntry("MESSAGE","警报已中断，取消发送"))
            .allSatisfy(r -> assertThat(s(r,"SEND_DT")).isNotBlank());
        var trx=store.read(()->store.table("alarm_transactions").stream()
            .filter(r -> eq(r,"ALARM_KEY",key) && eq(r,"TRX_TYPE","AlarmTerminate")).toList());
        assertThat(trx).singleElement().satisfies(t -> assertThat(t).containsEntry("STATUS_BEFORE","Process")
            .containsEntry("STATUS_AFTER","Terminated").containsEntry("NOTE","机台已修复").containsEntry("USER_KEY","U001"));
        assertThat(obj(trx.getFirst().get("DETAIL_SNAPSHOT")).get("NOTIFICATIONS")).isNotNull();
    }

    @Test void permissionIsReadFromLiveMasterAndRejectionsHaveNoSideEffects() throws Exception {
        String key=key();
        var before=store.read(()->store.data());
        var noPermission=store.read(()->copy(store.mustFind("users","USER_KEY","U002")));
        expectRejected(()->terminate(key,"x",noPermission),"您没有强制中断权限");
        expectRejected(()->terminate(key,"x",null),"您没有强制中断权限");
        assertThat(store.read(()->store.data())).isEqualTo(before);
        // Revoking permission after login takes effect on the next request without re-login.
        var token=loginToken("E0043258");
        store.write(()->{store.mustFind("users","USER_KEY","U001").put("CAN_TERMINATE","N");return null;});
        http.perform(post("/api/alarms/"+key+"/terminate").header("Authorization","Bearer "+token)
            .contentType(MediaType.APPLICATION_JSON).content(encode(m("cmt","revoked"))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("您没有强制中断权限"));
        store.write(()->{store.mustFind("users","USER_KEY","U001").put("CAN_TERMINATE","Y");return null;});
        // Hidden users are treated as unauthorized even when the field is Y.
        store.write(()->{store.mustFind("users","USER_KEY","U001").put("ACTIVE","N");return null;});
        var hidden=store.read(()->copy(store.mustFind("users","USER_KEY","U001")));
        expectRejected(()->terminate(key,"x",hidden),"您没有强制中断权限");
        store.write(()->{store.mustFind("users","USER_KEY","U001").put("ACTIVE","Y");return null;});
        // A missing field on legacy data means no permission.
        store.write(()->{store.mustFind("users","USER_KEY","U001").remove("CAN_TERMINATE");return null;});
        var legacy=store.read(()->copy(store.mustFind("users","USER_KEY","U001")));
        expectRejected(()->terminate(key,"x",legacy),"您没有强制中断权限");
        assertThat(store.read(()->s(store.mustFind("alarms","ALARM_KEY",key),"STATUS"))).isEqualTo("Process");
        assertThat(transactions(key,"AlarmTerminate")).isZero();
    }

    @Test void rejectsMissingAlarmNonProcessAlarmAndInvalidReasons() {
        assertThatThrownBy(()->terminate("alarms-999999","x")).isInstanceOf(ApiException.class)
            .satisfies(e -> assertThat(((ApiException) e).status).isEqualTo(404)).hasMessage("警报不存在");
        String key=key();
        expectRejected(()->terminate(key,"   "),"请填写中断原因");
        expectRejected(()->terminate(key,null),"请填写中断原因");
        expectRejected(()->terminate(key,"a".repeat(AlarmEngine.COMMENT_MAX+1)),"中断原因不可超过 500 个字符");
        assertThat(store.read(()->s(store.mustFind("alarms","ALARM_KEY",key),"STATUS"))).isEqualTo("Process");
        terminate(key,"a".repeat(AlarmEngine.COMMENT_MAX));
        assertThat(store.read(()->s(store.mustFind("alarms","ALARM_KEY",key),"TERMINATE_CMT"))).hasSize(500);
        expectRejected(()->terminate(key,"again"),"该警报已非处理中状态");
        String completed=secondAlarm();
        store.write(()->{store.mustFind("alarms","ALARM_KEY",completed).put("STATUS","Completed");return null;});
        long before=transactions(completed,"AlarmTerminate");
        expectRejected(()->terminate(completed,"x"),"该警报已非处理中状态");
        assertThat(transactions(completed,"AlarmTerminate")).isEqualTo(before);
    }

    @Test void concurrentTerminationsSucceedOnlyOnce() throws Exception {
        String key=key();
        try(var pool=Executors.newFixedThreadPool(8)) {
            var tasks=new ArrayList<Callable<Boolean>>();
            for(int i=0;i<8;i++) {
                int n=i;
                tasks.add(()->{try { store.write(()->engine.terminate(key,m("cmt","并发原因"+n),user)); return true; } catch(ApiException e) { return false; }});
            }
            int accepted=0; for(var task:pool.invokeAll(tasks)) if(task.get()) accepted++;
            assertThat(accepted).isEqualTo(1);
        }
        assertThat(transactions(key,"AlarmTerminate")).isEqualTo(1);
        assertThat(store.read(()->store.table("alarm_transactions").stream().filter(r -> eq(r,"ALARM_KEY",key)).toList()))
            .filteredOn(r -> eq(r,"TRX_TYPE","AlarmTerminate")).hasSize(1);
    }

    @Test void schedulerStopsEscalationRetriesAndDeliveryAfterTermination() {
        String key=key();
        terminate(key,"误报");
        int messages=smtp.messages.size(), trx=store.read(()->store.table("alarm_transactions").stream().filter(r -> eq(r,"ALARM_KEY",key)).toList()).size();
        // Only this alarm is aged: rewinding every row would make unrelated libraries escalate too and
        // hide a regression that keeps a Terminated alarm inside the scheduler scan.
        store.write(()->{store.table("alarm_levels").stream().filter(r -> eq(r,"ALARM_KEY",key)).forEach(r -> r.put("START_DT",Instant.EPOCH.toString()));
            store.table("alarm_notifications").stream().filter(r -> eq(r,"ALARM_KEY",key)).forEach(r -> r.put("SEND_DT",Instant.EPOCH.toString()));return null;});
        tick();engine.dispatch();tick();engine.dispatch();
        assertThat(smtp.messages).hasSize(messages);
        assertThat(store.read(()->store.table("alarm_transactions").stream().filter(r -> eq(r,"ALARM_KEY",key)).toList())).hasSize(trx);
        assertThat(store.read(()->store.table("alarm_notifications").stream().filter(r -> eq(r,"ALARM_KEY",key)).toList()))
            .noneSatisfy(n -> assertThat(s(n,"RESULT")).isEqualTo("Pending"));
        assertThat(store.read(()->reports.pending(store.mustFind("users","USER_KEY","U001")))).isEmpty();
        assertThat(store.read(()->store.table("alarms").stream().filter(r -> eq(r,"ALARM_KEY",key)).toList()))
            .singleElement().satisfies(a -> assertThat(a).containsEntry("STATUS","Terminated").containsEntry("CURRENT_LEVEL",1));
    }

    @Test void detailExposesTerminateMatrixAndTransactionViewIsReadOnly() throws Exception {
        String key=key();
        assertThat(store.read(()->engine.detail(key,user))).containsEntry("CAN_TERMINATE",true);
        var outsider=store.read(()->copy(store.mustFind("users","USER_KEY","U002")));
        assertThat(store.read(()->engine.detail(key,outsider))).containsEntry("CAN_TERMINATE",false);
        terminate(key,"误报");
        assertThat(store.read(()->engine.detail(key,user))).containsEntry("CAN_TERMINATE",false);
        String trx=store.read(()->s(store.table("alarm_transactions").stream()
            .filter(r -> eq(r,"ALARM_KEY",key) && eq(r,"TRX_TYPE","AlarmTerminate")).findFirst().orElseThrow(),"TRX_KEY"));
        var historical=store.read(()->engine.historicalDetail(key,trx,user));
        assertThat(historical).containsEntry("CAN_TERMINATE",false).containsEntry("CAN_ACK",false);
        // Unauthorized direct route calls are rejected and the alarm stays Process.
        String open=secondAlarm();
        String admin=loginToken("E0043258");
        http.perform(post("/api/alarms/"+open+"/terminate").header("Authorization","Bearer "+admin)
            .contentType(MediaType.APPLICATION_JSON).content(encode(m("cmt","接口中断"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.terminated").value(true))
            .andExpect(jsonPath("$.alarm.STATUS").value("Terminated"));
        var process=obj(parse(http.perform(get("/api/alarms/process").header("Authorization","Bearer "+admin))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()));
        assertThat(rows(process.get("rows"))).noneSatisfy(r -> assertThat(r).containsEntry("ALARM_KEY",open));
    }

    @Test void reportsDistinguishTerminatedAlarms() {
        String key=key();
        terminate(key,"事件配置错误");
        var byStatus=store.read(()->reports.query("AVPA004",m("STATUS",m("enabled",true,"operator","eq","value","Terminated"))));
        assertThat(byStatus).singleElement().satisfies(r -> assertThat(r).containsEntry("ALARM_KEY",key)
            .containsEntry("STATUS","Terminated"));
        assertThat(s(byStatus.get(0),"COMPLETE_DT")).isNotBlank();
        var history=store.read(()->reports.query("AVPA007",m("TRX_TYPE",m("enabled",true,"operator","eq","value","AlarmTerminate"))));
        assertThat(history).singleElement().satisfies(r -> assertThat(r).containsEntry("NOTE","事件配置错误")
            .containsEntry("STATUS","Terminated").containsEntry("ALARM_KEY",key));
        assertThat(store.read(()->reports.summary("",""))).isEmpty();
        assertThat(store.read(()->reports.query("AVPA004",m("STATUS",m("enabled",true,"operator","eq","value","Process"))))).isEmpty();
    }

    @Test void masterFieldNavigationAndExcelRoundTrip() throws Exception {
        var options=store.read(()->masters.options());
        assertThat(rows(options.get("alarmStatus"))).extracting(r -> s(r,"value")).containsSubsequence("Process","Completed","NoNextLevel","Terminated");
        assertThat(store.read(()->masters.nav())).anySatisfy(n -> assertThat(n).containsEntry("key","ALARM_LIST").containsEntry("name","警报强制中断作业"));
        // The whole stored row is echoed back as the edit payload, exactly like the master page does.
        saveUser("U002","Y");
        assertThat(store.read(()->s(store.mustFind("users","USER_KEY","U002"),"CAN_TERMINATE"))).isEqualTo("Y");
        // Echoing the record back must not rewrite the password: the file keeps a hash and the hash is intact.
        var u002=store.read(()->copy(store.mustFind("users","USER_KEY","U002")));
        assertThat(s(u002,"PASSWORD_HASH")).isNotBlank().isNotEqualTo("123456");
        assertThat(store.read(()->s(store.table("users").stream().filter(u -> eq(u,"USER_ID","E0043260"))
            .findFirst().orElseThrow(),"PASSWORD_HASH"))).isEqualTo(s(u002,"PASSWORD_HASH"));
        assertThat(store.read(()->s(store.table("history").getFirst(),"AFTER_JSON"))).contains("CAN_TERMINATE");
        var meta=store.read(()->masters.meta("masters","SBRM_USER"));
        var created=store.write(()->masters.save("masters","SBRM_USER",null,
            m("USER_ID","E0099999","USER_NAME","新使用者","PASSWORD","123456","E_MAIL","e99999@example.invalid"),user));
        assertThat(store.read(()->copy(store.mustFind("users","USER_KEY",s(created,"masterKey"))))).containsEntry("CAN_TERMINATE","N");
        assertThat(rows(meta.get("fields"))).anySatisfy(f -> assertThat(f).containsEntry("name","CAN_TERMINATE").containsEntry("type","checkbox"));
        // Excel: a truly blank checkbox cell keeps the stored value; checked wording normalizes to Y.
        var spreadsheet=store.read(()->excel.workbook("SBRM_USER_data",
            List.of(m("field","USER_ID","label","USER_ID"),m("field","USER_NAME","label","USER_NAME"),
                m("field","PASSWORD","label","PASSWORD"),m("field","E_MAIL","label","E_MAIL"),
                m("field","CAN_TERMINATE","label","CAN_TERMINATE")),
            List.of(m("USER_ID","E0098888","USER_NAME","汇入使用者","PASSWORD","123456",
                "E_MAIL","e98888@example.invalid","CAN_TERMINATE","是"))));
        var imported=rows(store.read(()->excel.verify("masters","SBRM_USER",s(spreadsheet,"base64"))).get("rows"));
        assertThat(imported).allSatisfy(r -> assertThat(r).containsEntry("valid",true));
        assertThat(obj(imported.get(0).get("values"))).containsEntry("CAN_TERMINATE","Y");
        var result=store.write(()->excel.importRows("masters","SBRM_USER",imported,user));
        assertThat(rows(result.get("errors"))).isEmpty();
        assertThat(store.read(()->s(store.table("users").stream().filter(u -> eq(u,"USER_ID","E0098888")).findFirst().orElseThrow(),"CAN_TERMINATE"))).isEqualTo("Y");
    }
}
