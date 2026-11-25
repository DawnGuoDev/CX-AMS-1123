package com.changxin.ams;

import static com.changxin.ams.Json.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:workflow;DB_CLOSE_DELAY=-1","ams.scheduling=false",
    "ams.smtp.from=ams@example.invalid","ams.smtp.auth=false","ams.smtp.starttls=false","ams.public-url=http://localhost:8180"})
@AutoConfigureMockMvc
class WorkflowIntegrationTest {
    static final SmtpCapture smtp=new SmtpCapture();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("ams.smtp.host",()->"localhost"); registry.add("ams.smtp.port",smtp::port);
    }
    @AfterAll static void closeSmtp() throws Exception { smtp.close(); }
    @Autowired Store store; @Autowired AlarmEngine engine; @Autowired Masters masters;
    @Autowired Reports reports; @Autowired Excel excel; @Autowired JdbcTemplate jdbc; @Autowired MockMvc http;
    Map<String,Object> user;
    @BeforeEach void reset() throws Exception {
        try(var in=getClass().getResourceAsStream("/seed.json")) {
            var seed=obj(MAPPER.readValue(in,Map.class));
            store.write(()->{store.data().clear();store.data().putAll(seed);return null;});
        }
        smtp.rejectRecipient=""; smtp.messages.clear();
        user=store.read(()->clean(store.mustFind("users","USER_KEY","U001")));
    }
    Map<String,Object> body() { return m("factoryKey","F01","subsysKey","SS03","eqpKey","EQP01","alarmCode","PRT_NODYE","title","SMTP 测试告警","content","请检查设备"); }
    Map<String,Object> send() { return store.write(()->engine.trigger(body(),user)); }
    Map<String,Object> alarm() { return obj(send().get("alarm")); }
    void tick() { store.write(()->{engine.tick();return null;}); }
    String login() throws Exception {
        return s(obj(parse(http.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON)
            .content(encode(m("userId","E0043258","password","123456")))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString())),"token");
    }
    @Test void authenticationSingleSessionAndNoPasswordDisclosure() throws Exception {
        http.perform(get("/api/bootstrap")).andExpect(status().isUnauthorized());
        String first=login(),second=login();
        http.perform(get("/api/bootstrap").header("Authorization","Bearer "+first)).andExpect(status().isUnauthorized());
        String data=http.perform(get("/api/bootstrap").header("Authorization","Bearer "+second)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(data).doesNotContain("PASSWORD_HASH","eqpGroup","userGroup","MCMS038","AVPA005");
    }
    @Test void realSmtpMessageAndAuthenticatedAckCompletion() throws Exception {
        String key=s(alarm(),"ALARM_KEY");
        assertThat(store.read(()->reports.pending(user))).isEmpty();
        engine.dispatch();
        assertThat(smtp.messages).hasSize(engine.members("LV0001").size());
        var mail=new MimeMessage(Session.getInstance(new Properties()),new ByteArrayInputStream(smtp.messages.getFirst().getBytes(StandardCharsets.UTF_8)));
        assertThat(mail.getSubject()).isEqualTo("[AMS] SMTP 测试告警");
        assertThat(mail.getContent().toString()).contains("http://localhost:8180/#/ack/"+key,"请检查设备","打开链接不会自动确认");
        assertThat(store.read(()->reports.pending(user))).hasSize(1);
        http.perform(post("/api/alarms/"+key+"/ack").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        var outsider=store.read(()->clean(store.mustFind("users","USER_KEY","U012")));
        assertThatThrownBy(()->store.write(()->engine.action(key,"ack",m(),outsider))).isInstanceOf(ApiException.class);
        store.write(()->engine.action(key,"ack",m("cmt","first"),user));
        assertThatThrownBy(()->store.write(()->engine.action(key,"ack",m(),user))).isInstanceOf(ApiException.class);
        var second=store.read(()->clean(store.mustFind("users","USER_KEY","U002")));
        assertThat(obj(store.write(()->engine.action(key,"ack",m("cmt","second"),second)).get("alarm"))).containsEntry("STATUS","Completed");
        assertThat(store.read(()->reports.summary("",""))).isEmpty();
    }
    @Test void duplicateAlarmsAreIgnoredConcurrently() throws Exception {
        try(var pool=Executors.newFixedThreadPool(8)) {
            var tasks=new ArrayList<Callable<Map<String,Object>>>();
            for(int i=0;i<16;i++)tasks.add(this::send);
            int accepted=0;for(var result:pool.invokeAll(tasks))if(Boolean.TRUE.equals(result.get().get("ok")))accepted++;
            assertThat(accepted).isEqualTo(1);
            assertThat(store.read(()->store.table("alarms"))).hasSize(1);
        }
    }
    @Test void exactAndWildcardMatchingWithoutGroupFallback() {
        var b=body();b.put("eqpKey","EQP02");
        assertThat(store.write(()->engine.trigger(b,user))).containsEntry("ok",false);
        store.write(()->{store.mustFind("alarm_settings","ALARM_INFO_ID","PRT_NODYE").put("EQP_KEY","*");return null;});
        assertThat(store.write(()->engine.trigger(b,user))).containsEntry("ok",true);
    }
    @Test void successfulUnacknowledgedMailIsNotRetried() {
        alarm();engine.dispatch();
        store.write(()->{store.table("alarm_notifications").forEach(n->n.put("SEND_DT",Instant.EPOCH.toString()));return null;});
        tick();engine.dispatch();
        assertThat(smtp.messages).hasSize(3);
        assertThat(store.read(()->n(store.table("alarm_levels").getFirst(),"RESEND_COUNT"))).isZero();
    }
    @Test void retriesOnlyFailedRecipientUntilLimitThenEscalates() {
        smtp.rejectRecipient=s(user,"E_MAIL");String key=s(alarm(),"ALARM_KEY");
        engine.dispatch();assertThat(smtp.messages).hasSize(2);
        for(int attempt=1;attempt<=3;attempt++) {
            store.write(()->{store.table("alarm_notifications").forEach(n->n.put("SEND_DT",Instant.EPOCH.toString()));return null;});
            tick();engine.dispatch();
        }
        assertThat(smtp.messages).hasSize(2);
        assertThat(store.read(()->store.table("alarm_notifications").stream().filter(n->eq(n,"USER_KEY","U001")).toList())).hasSize(3);
        store.write(()->{store.table("alarm_levels").getFirst().put("START_DT",Instant.EPOCH.toString());return null;});
        tick();assertThat(store.read(()->n(store.mustFind("alarms","ALARM_KEY",key),"CURRENT_LEVEL"))).isEqualTo(2);
        store.write(()->{store.table("alarm_levels").forEach(r->r.put("START_DT",Instant.EPOCH.toString()));return null;});
        tick();assertThat(store.read(()->s(store.mustFind("alarms","ALARM_KEY",key),"STATUS"))).isEqualTo("NoNextLevel");
    }
    @Test void successfulRetryEnablesAckAndStopsRetrying() {
        smtp.rejectRecipient=s(user,"E_MAIL");alarm();engine.dispatch();
        assertThat(store.read(()->reports.pending(user))).isEmpty();
        smtp.rejectRecipient="";
        store.write(()->{store.table("alarm_notifications").forEach(n->n.put("SEND_DT",Instant.EPOCH.toString()));return null;});
        tick();engine.dispatch();
        assertThat(smtp.messages).hasSize(3);
        assertThat(store.read(()->reports.pending(user))).hasSize(1);
    }
    @Test void zeroAckWaitsForSuccessfulSmtpDelivery() {
        store.write(()->{store.mustFind("event_levels","EVENT_LEVEL_KEY","LV0001").put("NUMBER_OF_ACK_USERS","0");return null;});
        assertThat(alarm()).containsEntry("STATUS","Process");tick();
        assertThat(store.read(()->store.table("alarms").getFirst())).containsEntry("STATUS","Process");
        engine.dispatch();tick();
        assertThat(store.read(()->store.table("alarms").getFirst())).containsEntry("STATUS","Completed");
    }
    @Test void zeroAckStillRetriesFailedEmail() {
        store.write(()->{store.mustFind("event_levels","EVENT_LEVEL_KEY","LV0001").put("NUMBER_OF_ACK_USERS","0");return null;});
        smtp.rejectRecipient=s(user,"E_MAIL");alarm();engine.dispatch();tick();
        assertThat(store.read(()->store.table("alarms").getFirst())).containsEntry("STATUS","Process");
        smtp.rejectRecipient="";
        store.write(()->{store.table("alarm_notifications").forEach(n->n.put("SEND_DT",Instant.EPOCH.toString()));return null;});
        tick();engine.dispatch();tick();
        assertThat(store.read(()->store.table("alarms").getFirst())).containsEntry("STATUS","Completed");
        assertThat(smtp.messages).hasSize(3);
    }
    @Test void levelRecipientsValidationAndHistoryAreAtomic() {
        var event=store.read(()->copy(store.mustFind("events","EVENT_KEY","EVT01")));
        var levels=store.read(()->engine.levels("EVT01"));event.put("details",levels);
        levels.getFirst().put("USER_KEYS",List.of("U001"));
        var before=store.read(()->store.data());
        assertThatThrownBy(()->store.write(()->masters.save("masterDetails","AVMA007",null,event,user))).isInstanceOf(ApiException.class);
        assertThat(store.read(()->store.data())).isEqualTo(before);
        levels.getFirst().put("NUMBER_OF_ACK_USERS","*");
        store.write(()->masters.save("masterDetails","AVMA007",null,event,user));
        assertThat(engine.members("LV0001")).hasSize(1);
        assertThat(store.read(()->s(store.table("history").getFirst(),"AFTER_JSON"))).contains("USER_KEYS");
        String key=s(alarm(),"ALARM_KEY");engine.dispatch();
        assertThat(obj(store.write(()->engine.action(key,"ack",m(),user)).get("alarm"))).containsEntry("STATUS","Completed");
    }
    @Test void runningAlarmKeepsItsLevelDefinitionsAfterConfigurationEdit() {
        String key=s(alarm(),"ALARM_KEY");engine.dispatch();
        store.write(()->{
            store.table("event_levels").removeIf(r->eq(r,"EVENT_KEY","EVT01"));
            store.table("alarm_levels").getFirst().put("START_DT",Instant.EPOCH.toString());return null;
        });
        tick();engine.dispatch();
        assertThat(store.read(()->n(store.mustFind("alarms","ALARM_KEY",key),"CURRENT_LEVEL"))).isEqualTo(2);
        assertThat(smtp.messages.size()).isGreaterThan(3);
    }
    @Test void excelImportHistoryRevalidationAndHiddenExport() throws Exception {
        var file=excel.workbook("factories",List.of(m("field","FACTORY_ID","label","FACTORY_ID"),m("field","FACTORY_NAME","label","FACTORY_NAME")),
            List.of(m("FACTORY_ID","QA_FACTORY","FACTORY_NAME","QA factory")));
        var input=rows(store.read(()->excel.verify("masters","SBRM_FACTORY",s(file,"base64"))).get("rows"));
        assertThat(input.getFirst()).containsEntry("valid",true);
        assertThat(store.write(()->excel.importRows("masters","SBRM_FACTORY",input,user))).containsEntry("success",1);
        assertThat(store.read(()->store.table("history").getFirst())).containsEntry("ACTION","Import");
        assertThat(store.write(()->excel.importRows("masters","SBRM_FACTORY",input,user))).containsEntry("success",0);
        store.write(()->masters.hide("masters","SBRM_FACTORY",s(store.mustFind("factories","FACTORY_ID","QA_FACTORY"),"FACTORY_KEY"),"hide",user));
        var exported=store.read(()->excel.export("masters","SBRM_FACTORY",false));
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(Base64.getDecoder().decode(s(exported,"base64"))))) {
            assertThat(book.getSheetAt(0).getLastRowNum()).isEqualTo(3);
        }
    }
    @Test void reportFiltersHistoryStatesAndEmptyExport() {
        String key=s(alarm(),"ALARM_KEY");engine.dispatch();
        var conditions=m("TITLE",m("enabled",true,"operator","starts","value","SMTP"));
        assertThat(store.read(()->reports.query("AVPA004",conditions))).hasSize(1);
        conditions.put("EQP_ID",m("enabled",true,"operator","eq","value","NOT_FOUND"));
        assertThat(store.read(()->reports.query("AVPA004",conditions))).isEmpty();
        assertThat(s(excel.workbook("empty",rows(reports.definition("AVPA004").get("COLUMNS")),List.of()),"base64")).isNotBlank();
        store.write(()->engine.action(key,"ack",m(),user));
        store.write(()->engine.action(key,"ack",m(),store.mustFind("users","USER_KEY","U002")));
        var history=store.read(()->reports.query("AVPA007",m("TITLE",m("enabled",true,"value","SMTP","operator","contains"))));
        assertThat(history).anySatisfy(r->assertThat(r).containsEntry("TRX_TYPE","Create").containsEntry("STATUS","Process").containsEntry("COMPLETE_DT",null))
            .anySatisfy(r->assertThat(r).containsEntry("TRX_TYPE","AlarmComplete").containsEntry("STATUS","Completed"));
        assertThatThrownBy(()->reports.query("AVPA007",m("TITLE",m("enabled",false,"value","SMTP")))).isInstanceOf(ApiException.class);
    }
    @Test void durableSnapshotReloadAndDetachedResponses() throws Exception {
        var result=alarm();result.put("TITLE","client mutation");
        Store reopened=new Store(jdbc);
        assertThat(reopened.read(()->s(reopened.table("alarms").getFirst(),"TITLE"))).isEqualTo("SMTP 测试告警");
    }
    @Test void checkedPagesWorkAndRemovedApisReturn404() throws Exception {
        String token=login();
        for(String kind:List.of("masters","mappings","masterDetails")) {
            String route=kind.equals("masters")?"master":kind.equals("mappings")?"mapping":"masterdetail";
            for(String code:obj(store.metadata.get(kind)).keySet())
                http.perform(get("/api/"+route+"/"+code).header("Authorization","Bearer "+token)).andExpect(status().isOk());
        }
        for(String code:List.of("AVPA004","AVPA007","AVPA013"))
            http.perform(post("/api/reports/"+code+"/query").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"conditions\":{\"CREATE_DT\":{\"enabled\":true,\"type\":\"date\",\"operator\":\"between\",\"from\":\"2020-01-01\"}}}")).andExpect(status().isOk());
        for(String route:List.of("event-tree","devices","auto-status","functions","master/SBRM_USER_GROUP","report-defs/AVPA005","report-defs/AVPA008"))
            http.perform(get("/api/"+route).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
        for(String route:List.of("alarms/manual","alarms/backfill","event-tree/save","sql/test","devices/save","batch-alarm/change"))
            http.perform(post("/api/"+route).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isNotFound());
    }
}
