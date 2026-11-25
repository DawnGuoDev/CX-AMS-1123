package com.changxin.ams;

import static com.changxin.ams.Json.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.io.*;
import java.time.Instant;
import java.util.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:manual;DB_CLOSE_DELAY=-1","ams.scheduling=false",
    "ams.smtp.from=ams@example.invalid","ams.smtp.auth=false","ams.smtp.starttls=false","ams.public-url=http://localhost:8180"})
@AutoConfigureMockMvc
class ManualAlignmentIntegrationTest {
    static final SmtpCapture smtp=new SmtpCapture();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("ams.smtp.host",()->"localhost");r.add("ams.smtp.port",smtp::port);
    }
    @AfterAll static void close() throws Exception {smtp.close();}
    @Autowired Store store; @Autowired Masters masters; @Autowired Excel excel;
    @Autowired Reports reports; @Autowired AlarmEngine engine; @Autowired MockMvc http; @Autowired JdbcTemplate jdbc;
    Map<String,Object> user;
    @BeforeEach void reset() throws Exception {
        try(var in=getClass().getResourceAsStream("/seed.json")) {
            var seed=obj(MAPPER.readValue(in,Map.class));
            store.write(()->{store.data().clear();store.data().putAll(seed);return null;});
        }
        smtp.messages.clear();smtp.rejectRecipient="";
        user=store.read(()->clean(store.mustFind("users","USER_KEY","U001")));
    }
    Map<String,Object> event(String id) {
        var e=store.read(()->copy(store.mustFind("events","EVENT_KEY","EVT01")));
        e.remove("EVENT_KEY");e.put("EVENT_ID",id);
        var levels=store.read(()->engine.levels("EVT01"));
        levels.forEach(l->l.remove("EVENT_LEVEL_KEY"));e.put("details",levels);return e;
    }
    String login() throws Exception {
        return s(obj(parse(http.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON)
            .content(encode(m("userId","E0043258","password","123456")))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString())),"token");
    }
    Map<String,Object> postJson(String path,Map<String,Object> body,String token) throws Exception {
        return obj(parse(http.perform(post("/api/"+path).header("Authorization","Bearer "+token)
            .contentType(MediaType.APPLICATION_JSON).content(encode(body))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString()));
    }
    Map<String,Object> alarm() {
        return obj(store.write(()->engine.trigger(m("factoryKey","F01","subsysKey","SS03","eqpKey","EQP01",
            "alarmCode","PRT_NODYE","title","Manual alarm","content","Manual content"),user)).get("alarm"));
    }
    @Test void userFieldsPasswordAndAuditArePreservedWithoutSecretExport() throws Exception {
        var values=m("USER_ID","NEW_EMP","USER_NAME","New employee","MIDDLE_NAME","middle","IPPHONE_IM","im",
            "IPPHONE_EXT","123","ALARM_SMS_PHONE","456","ALARM_PHONE","789","HIRE_DATE","2026-11-24","IS_EMPLOYEE","Y");
        assertThatThrownBy(()->store.write(()->masters.save("masters","SBRM_USER",null,values,user))).hasMessageContaining("密码");
        values.put("PASSWORD","manual-password");
        String token=login();
        var created=obj(postJson("master/SBRM_USER",values,token).get("row"));
        assertThat(created).containsEntry("MIDDLE_NAME","middle").containsEntry("IS_EMPLOYEE","Y").doesNotContainKeys("PASSWORD","PASSWORD_HASH");
        var audit=store.read(()->store.table("history").getFirst());
        assertThat(audit).containsEntry("IP","127.0.0.1").containsEntry("HOST","").containsEntry("USER_ID","E0043258");
        String key=s(created,"USER_KEY");
        String hash=store.read(()->s(store.mustFind("users","USER_KEY",key),"PASSWORD_HASH"));
        store.write(()->masters.save("masters","SBRM_USER",key,m("PASSWORD","","USER_ID","CHANGED"),user));
        assertThat(store.read(()->store.mustFind("users","USER_KEY",key))).containsEntry("PASSWORD_HASH",hash).containsEntry("USER_ID","NEW_EMP");
        try(var book=workbook(excel.export("masters","SBRM_USER",false))) {
            assertThat(book.getSheetAt(0).getRow(0).toString()).doesNotContain("PASSWORD");
        }
        assertThat(s(audit,"AFTER_JSON")).doesNotContain("manual-password","PASSWORD");
    }
    @Test void eventLocksRequiredIntegersAndGapsAreValidatedAtomically() {
        var e=event("EDIT_EVENT");e.put("EVENT_KEY","EVT01");e.put("FACTORY_KEY","F02");e.put("SUB_SYS_KEY","SS01");
        store.write(()->masters.save("masterDetails","AVMA007",null,e,user));
        assertThat(store.read(()->store.mustFind("events","EVENT_KEY","EVT01"))).containsEntry("FACTORY_KEY","F01").containsEntry("SUB_SYS_KEY","SS03");
        for(String field:List.of("EVENT_LEVEL_ID","NUMBER_OF_ACK_USERS","LEVEL_INTERVAL","FAIL_RETRY_TIMES","FAIL_RETRY_INTERVAL")) {
            var invalid=event("BAD_"+field);rows(invalid.get("details")).getFirst().put(field,"");
            var before=store.read(store::data);
            assertThatThrownBy(()->store.write(()->masters.save("masterDetails","AVMA007",null,invalid,user))).isInstanceOf(ApiException.class);
            assertThat(store.read(store::data)).isEqualTo(before);
        }
        for(Object bad:List.of("1.5",0,-1,3)) {
            var invalid=event("BAD_LEVEL");rows(invalid.get("details")).getFirst().put("EVENT_LEVEL_ID",bad);
            assertThatThrownBy(()->store.write(()->masters.save("masterDetails","AVMA007",null,invalid,user))).isInstanceOf(ApiException.class);
        }
    }
    @Test void reportTimeOperatorsUseSecondsAndDefinitionsUpgradePersistedData() throws Exception {
        var alarm=alarm();
        store.write(()->{store.mustFind("alarms","ALARM_KEY",alarm.get("ALARM_KEY")).put("CREATE_DT","2026-11-24T10:00:30.500Z");return null;});
        var reopened=new Store(jdbc);var reReports=new Reports(reopened,new AlarmEngine(reopened,null));
        assertThat(rows(reReports.definition("AVPA004").get("COLUMNS")).stream().map(c->s(c,"field"))).contains("CONTENT_TYPE","LEVEL_PROCESS_DT","SEND_DT","LAST_ACK_DT");
        assertThat(reopened.read(()->reopened.table("alarms"))).hasSize(1);
        for(var sample:List.of(m("op","eq","v","2026-11-24T10:00:30Z","count",1),m("op","eq","v","2026-11-24T10:00:31Z","count",0),
            m("op","neq","v","2026-11-24T10:00:30Z","count",0),m("op","lt","v","2026-11-24T10:00:31Z","count",1),
            m("op","lte","v","2026-11-24T10:00:30Z","count",1),m("op","gt","v","2026-11-24T10:00:30Z","count",0),
            m("op","gte","v","2026-11-24T10:00:30Z","count",1))) {
            assertThat(reports.query("AVPA004",m("CREATE_DT",m("enabled",true,"operator",sample.get("op"),"value",sample.get("v"))))).hasSize(n(sample,"count"));
        }
        assertThat(reports.query("AVPA004",m("CREATE_DT",m("enabled",true,"operator","between","from","2026-11-24T10:00:31Z","to","2026-11-24T11:00:00Z")))).isEmpty();
        for(var sample:List.of(m("op","contains","v","alarm","n",1),m("op","notContains","v","alarm","n",0),m("op","starts","v","Manual","n",1),
            m("op","ends","v","alarm","n",1),m("op","eq","v","manual alarm","n",1),m("op","neq","v","Manual alarm","n",0)))
            assertThat(reports.query("AVPA004",m("TITLE",m("enabled",true,"operator",sample.get("op"),"value",sample.get("v"))))).hasSize(n(sample,"n"));
    }
    @Test void exportUsesSubmittedVisibleSnapshotIncludingEmptyHeaders() throws Exception {
        String token=login();alarm();
        var visible=reports.query("AVPA004",m());visible.getFirst().put("TITLE","snapshot before refresh");
        var result=postJson("reports/AVPA004/export",m("rows",visible),token);
        assertThat(s(result,"filename")).startsWith("警报处理查询");
        try(var book=workbook(result)) {
            assertThat(book.getSheetAt(0).getLastRowNum()).isEqualTo(1);
            assertThat(book.getSheetAt(0).getRow(1).getCell(2).getStringCellValue()).isEqualTo("snapshot before refresh");
        }
        try(var book=workbook(postJson("reports/AVPA007/export",m("rows",List.of()),token))) {
            assertThat(book.getSheetAt(0).getLastRowNum()).isZero();assertThat(book.getSheetAt(0).getRow(0).getLastCellNum()).isGreaterThan((short)15);
        }
        assertThat(reports.summaryColumns(true).stream().map(c->s(c,"field"))).contains("FACTORY_ID","FACTORY_NAME","SUB_SYS_ID","SUB_SYS_NAME","EQP_ID","EQP_NAME");
    }
    @Test void historicalDetailKeepsOriginalStateAfterSingleAcknowledgments() throws Exception {
        String key=s(alarm(),"ALARM_KEY");engine.dispatch();
        String first=s(store.read(()->store.table("alarm_transactions").getFirst()),"TRX_KEY");
        assertThat(postJson("alarms/"+key+"/ack",m("cmt","single remark"),login())).containsEntry("ok",true);
        assertThat(store.read(()->store.table("alarm_acks").getFirst())).containsEntry("ACK_CMT","single remark");
        store.write(()->engine.action(key,"ack",m(),store.mustFind("users","USER_KEY","U002")));
        var history=engine.historicalDetail(key,first,user);
        assertThat(history).containsEntry("STATUS","Process").containsEntry("CAN_ACK",false).containsEntry("COMPLETE_DT",null);
        assertThat(obj(history.get("HISTORY_CONTEXT"))).containsEntry("SEQ",1);
        assertThat(rows(history.get("ACKS"))).isEmpty();
        assertThat(rows(history.get("TRANSACTIONS"))).extracting(r->n(r,"SEQ")).containsExactly(1);
    }
    @Test void failedRetryIntervalUsesSecondsAndSuccessfulRecipientsAreNotResent() {
        smtp.rejectRecipient=s(user,"E_MAIL");alarm();engine.dispatch();
        store.write(()->{store.table("alarm_notifications").forEach(n->n.put("SEND_DT",Instant.now().minusSeconds(1).toString()));engine.tick();return null;});
        assertThat(store.read(()->store.table("alarm_notifications"))).hasSize(3);
        store.write(()->{store.table("alarm_notifications").forEach(n->n.put("SEND_DT",Instant.EPOCH.toString()));engine.tick();return null;});
        assertThat(store.read(()->store.table("alarm_notifications"))).hasSize(4);
        assertThat(smtp.messages).hasSize(2);
    }
    @Test void basicMastersRequiredCodesUniquenessAndHideRestore() {
        for(String code:List.of("SBRM_FACTORY","SBRM_EQP","AVMA003")) {
            var meta=masters.meta("masters",code);String table=s(meta,"table"),keyField=s(meta,"keyField"),id=s(meta,"idField");
            var original=store.read(()->clean(store.table(table).getFirst()));
            var duplicate=copy(original);duplicate.remove(keyField);
            assertThatThrownBy(()->store.write(()->masters.save("masters",code,null,duplicate,user))).hasMessageContaining("唯一");
            var fresh=copy(duplicate);fresh.put(id,"QA_"+code);
            var required=rows(meta.get("fields")).stream().filter(f->Boolean.TRUE.equals(f.get("required"))&&!eq(f,"name",id)).findFirst().orElseThrow();
            var invalid=copy(fresh);invalid.put(s(required,"name"),"");
            assertThatThrownBy(()->store.write(()->masters.save("masters",code,null,invalid,user))).hasMessageContaining("必填");
            var created=obj(store.write(()->masters.save("masters",code,null,fresh,user)).get("row"));
            String key=s(created,keyField);
            store.write(()->masters.hide("masters",code,key,"hide",user));
            assertThat(rows(masters.get("masters",code,m()).get("rows"))).noneMatch(r->eq(r,keyField,key));
            assertThat(rows(masters.get("masters",code,m("showHidden","1")).get("rows"))).anyMatch(r->eq(r,keyField,key)&&eq(r,"ACTIVE","N"));
            store.write(()->masters.hide("masters",code,key,"show",user));
            assertThat(rows(masters.get("masters",code,m()).get("rows"))).anyMatch(r->eq(r,keyField,key)&&eq(r,"ACTIVE","Y"));
        }
    }
    @Test void alarmCompositeAndAssociationValidationAndMappingSave() {
        var setting=store.read(()->clean(store.table("alarm_settings").getFirst()));
        setting.remove("ALARM_INFO_KEY");
        assertThatThrownBy(()->store.write(()->masters.save("masters","AVMA009",null,setting,user))).hasMessageContaining("唯一");
        setting.put("ALARM_INFO_ID","QA_ALARM");
        for(Object bad:List.of(-1,"0.5","")) {
            setting.put("IGNORE_PERIOD",bad);
            assertThatThrownBy(()->store.write(()->masters.save("masters","AVMA009",null,setting,user))).isInstanceOf(ApiException.class);
        }
        setting.put("IGNORE_PERIOD",0);setting.put("EQP_KEY","*");setting.put("ALARM_CMT","roundtrip comment");
        assertThat(obj(store.write(()->masters.save("masters","AVMA009",null,setting,user)).get("row"))).containsEntry("ALARM_CMT","roundtrip comment");
        setting.put("ALARM_INFO_ID","QA_WRONG_EVENT");setting.put("EVENT_KEY","EVT04");
        assertThatThrownBy(()->store.write(()->masters.save("masters","AVMA009",null,setting,user))).hasMessageContaining("不属于");
        var before=store.read(store::data);
        assertThatThrownBy(()->store.write(()->masters.saveMapping("AVMA004","F01",List.of("MISSING"),user))).isInstanceOf(ApiException.class);
        assertThat(store.read(store::data)).isEqualTo(before);
        store.write(()->masters.saveMapping("AVMA004","F01",List.of("SS03"),user));
        assertThat(rows(masters.get("mappings","AVMA004",m()).get("mapRows")).stream()
            .filter(r->eq(r,"FACTORY_KEY","F01")).map(r->s(r,"SUB_SYS_KEY"))).containsExactly("SS03");
    }
    XSSFWorkbook workbook(Map<String,Object> result) throws IOException {
        return new XSSFWorkbook(new ByteArrayInputStream(Base64.getDecoder().decode(s(result,"base64"))));
    }
}
