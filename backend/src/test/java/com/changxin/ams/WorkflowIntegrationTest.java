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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:workflow;DB_CLOSE_DELAY=-1","ams.scheduling=false"})
@AutoConfigureMockMvc
class WorkflowIntegrationTest {
    @Autowired Store store;
    @Autowired Auth auth;
    @Autowired AlarmEngine engine;
    @Autowired Masters masters;
    @Autowired Reports reports;
    @Autowired Excel excel;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc http;
    Map<String,Object> user;

    @BeforeEach void reset() throws Exception {
        try (var in=getClass().getResourceAsStream("/seed.json")) {
            var seed=obj(MAPPER.readValue(in,Map.class));
            store.write(() -> { store.data().clear(); store.data().putAll(seed);
                for (String table:List.of("alarms","alarm_levels","alarm_acks","alarm_notifications","alarm_transactions","alarm_invalid","auto_status_logs"))
                    store.table(table).clear();
                return null;
            });
        }
        user=store.read(() -> clean(store.mustFind("users","USER_KEY","U001")));
    }
    Map<String,Object> body() { return m("factoryKey","F01","subsysKey","SS03","eqpKey","EQP01","alarmCode","PRT_NODYE","title","Integration alarm","content","test"); }
    Map<String,Object> send() { return store.write(() -> engine.backfill(body(),user)); }
    Map<String,Object> alarm() { return obj(send().get("alarm")); }
    String login() throws Exception {
        return s(obj(parse(http.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON)
            .content(encode(m("userId","E0043258","password","123456")))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString())),"token");
    }
    @Test void authenticationSingleSessionAndNoPasswordDisclosure() throws Exception {
        http.perform(get("/api/bootstrap")).andExpect(status().isUnauthorized());
        String first=login(), second=login();
        http.perform(get("/api/me").header("Authorization","Bearer "+first)).andExpect(status().isUnauthorized());
        String bootstrap=http.perform(get("/api/bootstrap").header("Authorization","Bearer "+second))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(bootstrap).doesNotContain("PASSWORD_HASH");
        String users=http.perform(get("/api/master/SBRM_USER").header("Authorization","Bearer "+second))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(users).doesNotContain("PASSWORD_HASH");
    }
    @Test void exactMatchDuplicateRejectionAndAckCompletion() {
        var result=send(); var alarm=obj(result.get("alarm")); String key=s(alarm,"ALARM_KEY");
        assertThat(result.get("matchedBy")).isEqualTo("exact");
        assertThat(send()).containsEntry("ok",false).containsEntry("status",422);
        assertThat(store.read(() -> store.table("alarm_invalid").size())).isEqualTo(1);
        var recipients=store.read(() -> engine.members("LV0001"));
        assertThat(recipients.size()).isGreaterThanOrEqualTo(2);
        store.write(() -> engine.action(key,"ack",m("cmt","first"),recipients.get(0)));
        assertThatThrownBy(() -> store.write(() -> engine.action(key,"ack",m(),recipients.get(0)))).isInstanceOf(ApiException.class);
        var completed=store.write(() -> engine.action(key,"ack",m("cmt","second"),recipients.get(1)));
        assertThat(obj(completed.get("alarm")).get("STATUS")).isEqualTo("Completed");
    }
    @Test void concurrentDuplicatesCommitOnlyOneAlarm() throws Exception {
        try (var pool=Executors.newFixedThreadPool(8)) {
            var tasks=new ArrayList<Callable<Map<String,Object>>>();
            for(int i=0;i<16;i++) tasks.add(this::send);
            var results=pool.invokeAll(tasks);
            int accepted=0;
            for(var r:results) if(Boolean.TRUE.equals(r.get().get("ok"))) accepted++;
            assertThat(accepted).isEqualTo(1);
            assertThat(store.read(() -> store.table("alarms").size())).isEqualTo(1);
            assertThat(store.read(() -> store.table("alarm_invalid").size())).isEqualTo(15);
        }
    }
    @Test void groupFallbackAndStatusSuppression() {
        var b=body(); b.put("eqpKey","EQP02");
        var result=store.write(() -> engine.backfill(b,user));
        assertThat(result).containsEntry("ok",true).containsEntry("matchedBy","group-fallback");
        store.write(() -> { store.table("alarms").clear();
            var eqp=store.mustFind("eqps","EQP_KEY","EQP01");
            store.table("eqp_type_status").add(m("EQP_TYPE_KEY",eqp.get("EQP_TYPE_KEY"),"EQP_STATUS_KEY",eqp.get("CURRENT_STATUS")));
            return null;
        });
        assertThat(send()).containsEntry("ok",false);
    }
    @Test void zeroAckAndBypassFinishWithoutPendingWork() {
        store.write(() -> { store.mustFind("event_levels","EVENT_LEVEL_KEY","LV0001").put("NUMBER_OF_ACK_USERS","0"); return null; });
        assertThat(alarm().get("STATUS")).isEqualTo("Completed");
        store.write(() -> { store.table("alarms").clear(); store.mustFind("subsystems","SUB_SYS_KEY","SS03").put("BYPASS","Y"); return null; });
        assertThat(alarm().get("STATUS")).isEqualTo("LogOnly");
    }
    @Test void retryEscalationAndFinalTimeout() {
        String key=s(alarm(),"ALARM_KEY");
        store.write(() -> { store.table("alarm_levels").getFirst().put("NEXT_RESEND_DT",Instant.EPOCH.toString()); engine.tick(); return null; });
        assertThat(store.read(() -> n(store.table("alarm_levels").getFirst(),"RESEND_COUNT"))).isEqualTo(1);
        store.write(() -> { store.table("alarm_levels").getFirst().put("START_DT",Instant.EPOCH.toString()); engine.tick(); return null; });
        assertThat(store.read(() -> n(store.mustFind("alarms","ALARM_KEY",key),"CURRENT_LEVEL"))).isEqualTo(2);
        store.write(() -> { store.table("alarm_levels").forEach(r -> r.put("START_DT",Instant.EPOCH.toString())); engine.tick(); return null; });
        assertThat(store.read(() -> s(store.mustFind("alarms","ALARM_KEY",key),"STATUS"))).isEqualTo("NoNextLevel");
    }
    @Test void manualAlarmAppearsInRecipientsPendingAndCannotTerminate() {
        var b=m("factoryKey","F01","subsysKey","SS03","userKeys",List.of("U001"),"channels",List.of("Email"),"requiredAck","1","title","Manual");
        var alarm=obj(store.write(() -> engine.manual(b,user)).get("alarm"));
        assertThat(store.read(() -> reports.pending(user))).extracting(r -> r.get("ALARM_KEY")).contains(alarm.get("ALARM_KEY"));
        assertThatThrownBy(() -> store.write(() -> engine.action(s(alarm,"ALARM_KEY"),"terminate",m(),user))).isInstanceOf(ApiException.class);
        assertThat(obj(store.write(() -> engine.action(s(alarm,"ALARM_KEY"),"ack",m(),user)).get("alarm")).get("STATUS")).isEqualTo("Completed");
    }
    @Test void invalidDetailRollsBackSequenceAndChildren() {
        var before=store.read(() -> store.data());
        var event=store.read(() -> copy(store.mustFind("events","EVENT_KEY","EVT01")));
        event.put("details",List.of(m("EVENT_LEVEL_ID",2,"NUMBER_OF_ACK_USERS","1","LEVEL_INTERVAL",10)));
        assertThatThrownBy(() -> store.write(() -> masters.save("masterDetails","AVMA007",null,event,user))).isInstanceOf(ApiException.class);
        assertThat(store.read(() -> store.data())).isEqualTo(before);
    }
    @Test void excelExportVerifyAndImportRevalidatesForgedFlag() {
        var meta=store.metadata;
        String code=obj(meta.get("masters")).entrySet().stream().filter(e -> eq(obj(e.getValue()),"table","factories")).findFirst().orElseThrow().getKey();
        var file=excel.workbook("factories",List.of(m("field","FACTORY_ID","label","FACTORY_ID"),m("field","FACTORY_NAME","label","FACTORY_NAME")),List.of(m("FACTORY_ID","QA_FACTORY","FACTORY_NAME","QA factory")));
        var verified=store.read(() -> excel.verify("masters",code,s(file,"base64")));
        var input=rows(verified.get("rows"));
        assertThat(input).hasSize(1);
        assertThat(input.getFirst()).containsEntry("valid",true);
        assertThat(store.write(() -> excel.importRows("masters",code,input,user))).containsEntry("success",1);
        // The second request still claims valid=true, but its unique code is now taken.
        var rejected=store.write(() -> excel.importRows("masters",code,input,user));
        assertThat(rejected).containsEntry("success",0);
        assertThat(list(rejected.get("errors"))).hasSize(1);
        assertThat(s(store.read(() -> excel.export("masters",code,false)),"base64")).isNotBlank();
    }
    @Test void autoStatusUsesValidSeedReferencesAndIsIdempotent() {
        var b=m("factoryKey","F01","subsysKey","SS01","eqpKey","EQP04","alarmCode","EQP_OVERHEAT","title","Temperature");
        store.write(() -> { store.mustFind("eqps","EQP_KEY","EQP04").put("CURRENT_STATUS","ST01");
            store.table("eqp_type_status").clear(); return null; });
        assertThat(store.write(() -> engine.backfill(b,user))).containsEntry("ok",true);
        var logs=store.write(() -> engine.scan(user));
        assertThat(logs).hasSize(1);
        assertThat(store.read(() -> s(store.mustFind("eqps","EQP_KEY","EQP04"),"CURRENT_STATUS"))).isEqualTo("ST03");
        assertThat(store.write(() -> engine.scan(user))).hasSize(1);
    }
    @Test void durableSnapshotReloadAndDetachedResponses() throws Exception {
        var result=alarm(); result.put("TITLE","client mutation");
        Store reopened=new Store(jdbc);
        assertThat(reopened.read(() -> reopened.table("alarms"))).hasSize(1);
        assertThat(reopened.read(() -> s(reopened.table("alarms").getFirst(),"TITLE"))).isEqualTo("Integration alarm");
    }
    @Test void allReadPagesAndReportsHaveWorkingEndpoints() throws Exception {
        String token=login();
        for(String kind:List.of("masters","mappings","masterDetails")) {
            String route=kind.equals("masters")?"master":kind.equals("mappings")?"mapping":"masterdetail";
            for(String code:obj(store.metadata.get(kind)).keySet())
                http.perform(get("/api/"+route+"/"+code).header("Authorization","Bearer "+token)).andExpect(status().isOk());
        }
        http.perform(get("/api/event-tree").param("factory","F01").param("subsys","SS03")
            .header("Authorization","Bearer "+token)).andExpect(status().isOk());
        for(String route:List.of("dashboard","inbox","report-defs","auto-status","devices","functions","summary/master"))
            http.perform(get("/api/"+route).header("Authorization","Bearer "+token)).andExpect(status().isOk());
        for(String code:List.of("AVPA004","AVPA005","AVPA007","AVPA008","AVPA013"))
            http.perform(post("/api/reports/"+code+"/query").header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"conditions\":{\"CREATE_DT\":{\"enabled\":true,\"from\":\"2020-01-01\"}}}")).andExpect(status().isOk());
    }
}
