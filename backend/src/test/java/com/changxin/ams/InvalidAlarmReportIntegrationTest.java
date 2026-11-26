package com.changxin.ams;

import static com.changxin.ams.Json.*;
import static org.assertj.core.api.Assertions.*;

import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:invalid-alarm;DB_CLOSE_DELAY=-1","ams.scheduling=false",
    "ams.smtp.from=ams@example.invalid","ams.smtp.auth=false","ams.smtp.starttls=false","ams.public-url=http://localhost:8181"})
class InvalidAlarmReportIntegrationTest {
    @Autowired Store store; @Autowired AlarmEngine engine; @Autowired Reports reports; @Autowired Excel excel; @Autowired JdbcTemplate jdbc;
    Map<String,Object> user;

    void reset() throws Exception {
        try(var in=getClass().getResourceAsStream("/seed.json")) {
            var seed=obj(MAPPER.readValue(in,Map.class));
            store.write(()->{store.data().clear();store.data().putAll(seed);return null;});
        }
        user=store.read(()->clean(store.mustFind("users","USER_KEY","U001")));
    }
    Map<String,Object> body() { return m("factoryKey","F01","subsysKey","SS03","eqpKey","EQP01","alarmCode","PRT_NODYE","title","无效警报测试","content","请检查设备"); }
    Map<String,Object> invalid(Map<String,Object> body) { return store.write(()->engine.trigger(body,user)); }
    List<Map<String,Object>> invalidAlarms() { return store.read(()->store.table("invalid_alarms")); }
    Map<String,Object> time() { return m("CREATE_DT",m("enabled",true,"type","date","operator","between","from","2000-01-01T00:00:00Z","to","2999-01-01T00:00:00Z")); }

    @Test void failureTypesAreRecordedWithReasonAndFailuresDoNotCreateAlarms() throws Exception {
        reset();
        assertThat(invalid(m("factoryKey","BAD","subsysKey","SS03","eqpKey","EQP01","alarmCode","PRT_NODYE")))
            .containsEntry("ok",false).containsEntry("status",422).containsEntry("message","未设定厂别");
        var row=invalidAlarms().getFirst();
        assertThat(row).containsEntry("FAILURE_TYPE",AlarmEngine.FAILURE_NO_FACTORY).containsEntry("FAILURE_REASON","未设定厂别")
            .containsEntry("ALARM_INFO_ID","PRT_NODYE").containsEntry("SOURCE","TEST_API").containsEntry("SOURCE_USER_ID","E0043258");
        assertThat(store.read(()->store.table("alarms"))).isEmpty();
        assertThat(store.read(()->store.table("alarm_notifications"))).isEmpty();
        assertThat(store.read(()->store.table("alarm_transactions"))).isEmpty();

        assertThat(invalid(m("factoryKey","F01","subsysKey","BAD","eqpKey","EQP01","alarmCode","PRT_NODYE"))).containsEntry("message","未设定子系统");
        assertThat(invalidAlarms().getFirst()).containsEntry("FAILURE_TYPE",AlarmEngine.FAILURE_NO_SUBSYS);
        assertThat(invalid(m("factoryKey","F01","subsysKey","SS03","eqpKey","BAD","alarmCode","PRT_NODYE"))).containsEntry("message","未设定机台");
        assertThat(invalidAlarms().getFirst()).containsEntry("FAILURE_TYPE",AlarmEngine.FAILURE_NO_EQP);
        store.write(()->{store.mustFind("alarm_settings","ALARM_INFO_ID","PRT_NODYE").put("ACTIVE","N");return null;});
        assertThat(invalid(body())).containsEntry("message","警报设定未启用");
        assertThat(invalidAlarms().getFirst()).containsEntry("FAILURE_TYPE",AlarmEngine.FAILURE_SETTING_DISABLED);

        reset();
        store.write(()->{store.table("alarm_settings").removeIf(r -> eq(r,"ALARM_INFO_ID","PRT_NODYE"));return null;});
        assertThat(invalid(body())).containsEntry("message","找不到事件");
        assertThat(invalidAlarms().getFirst()).containsEntry("FAILURE_TYPE",AlarmEngine.FAILURE_EVENT_NOT_FOUND);

        reset();
        store.write(()->{store.table("event_levels").removeIf(r -> eq(r,"EVENT_KEY","EVT01"));return null;});
        assertThat(invalid(body())).containsEntry("message","未设定层级1");
        assertThat(invalidAlarms().getFirst()).containsEntry("FAILURE_TYPE",AlarmEngine.FAILURE_NO_LEVEL1);
        assertThat(invalidAlarms().getFirst()).containsEntry("FAILURE_REASON","未设定层级1");

        reset();
        store.write(()->{store.mustFind("event_levels","EVENT_LEVEL_KEY","LV0001").put("USER_KEYS",List.of());return null;});
        assertThat(invalid(body())).containsEntry("message","未设定发送人员");
        assertThat(invalidAlarms().getFirst()).containsEntry("FAILURE_TYPE",AlarmEngine.FAILURE_NO_RECIPIENTS);

        reset();
        var accepted=store.write(()->engine.trigger(body(),user));
        assertThat(accepted).containsEntry("ok",true);
        assertThat(invalidAlarms()).isEmpty();
        var alarmKey=s(obj(accepted.get("alarm")),"ALARM_KEY");
        assertThat(invalid(body())).containsEntry("message","忽略相同警报");
        assertThat(invalidAlarms()).hasSize(1);
        assertThat(invalidAlarms().getFirst()).containsEntry("FAILURE_TYPE",AlarmEngine.FAILURE_DUPLICATE_IGNORED)
            .containsEntry("DUPLICATE_ALARM_KEY",alarmKey);
        assertThat(store.read(()->store.table("alarms"))).hasSize(1);

        for(var record:invalidAlarms()) {
            assertThat(s(record,"INVALID_KEY")).matches("invalid_alarms-\\d{6}");
            assertThat(s(record,"INVALID_ID")).matches("IVD-\\d{8}-\\d{6}");
            assertThat(s(record,"EVENT_KEY")).isNotBlank();
        }
    }

    @Test void invalidAlarmQueryRequiresTimeRangeSupportsFiltersAndSorts() throws Exception {
        reset();
        invalid(m("factoryKey","BAD","subsysKey","SS03","eqpKey","EQP01","alarmCode","A001"));
        invalid(m("factoryKey","F01","subsysKey","BAD","eqpKey","EQP01","alarmCode","B002"));
        invalid(m("factoryKey","F01","subsysKey","SS03","eqpKey","BAD","alarmCode","C003"));
        assertThatThrownBy(()->store.read(()->reports.query("AVPA008",m()))).isInstanceOf(ApiException.class)
            .hasMessage("无效警报查询必须指定时间区间");
        assertThatThrownBy(()->store.read(()->reports.query("AVPA008",m("CREATE_DT",m("enabled",false,"from","2020-01-01T00:00:00Z")))))
            .isInstanceOf(ApiException.class).hasMessage("无效警报查询必须指定时间区间");

        var all=store.read(()->reports.query("AVPA008",time()));
        assertThat(all).hasSize(3);
        assertThat(all).isSortedAccordingTo((a,b)->s(b,"CREATE_DT").compareTo(s(a,"CREATE_DT")));

        var first=s(all.getLast(),"CREATE_DT");
        // Browser payloads are second-precision local times, not the nanosecond ISO form stored in CREATE_DT.
        var seconds=LocalDateTime.ofInstant(Instant.parse(first),ZoneId.systemDefault()).withNano(0).toString();
        // All three records can fall in the same displayed second, so combine the exact window
        // with an identity filter the way a user narrows results in the browser.
        var exact=m("CREATE_DT",m("enabled",true,"type","date","operator","between","from",seconds,"to",seconds),
            "ALARM_INFO_ID",m("enabled",true,"operator","eq","value","C003"));
        assertThat(store.read(()->reports.query("AVPA008",exact))).hasSize(1);
        var left=m("CREATE_DT",m("enabled",true,"type","date","operator","between","from","2000-01-01T00:00:00Z","to",""));
        assertThat(store.read(()->reports.query("AVPA008",left))).hasSize(3);
        var right=m("CREATE_DT",m("enabled",true,"type","date","operator","between","from","","to","2999-01-01T00:00:00Z"));
        assertThat(store.read(()->reports.query("AVPA008",right))).hasSize(3);

        // Mirrors the browser, which tags each condition with its column type before sending it.
        var conditions=time(); conditions.put("FAILURE_TYPE",m("enabled",true,"operator","eq","value","NO_EQP","type","text"));
        conditions.put("ALARM_INFO_ID",m("enabled",true,"operator","eq","value","C003","type","text"));
        var filtered=store.read(()->reports.query("AVPA008",conditions));
        assertThat(filtered).hasSize(1);
        assertThat(filtered.getFirst()).containsEntry("ALARM_INFO_ID","C003").containsEntry("FAILURE_REASON","未设定机台");
        conditions.put("BAD_FIELD",m("enabled",true,"operator","eq","value","x"));
        assertThatThrownBy(()->store.read(()->reports.query("AVPA008",conditions))).isInstanceOf(ApiException.class)
            .hasMessage("查询字段无效");
    }

    @Test void invalidAlarmExportUsesDeclaredColumnsAndFilteredRows() throws Exception {
        reset();
        invalid(m("factoryKey","BAD","subsysKey","SS03","eqpKey","EQP01","alarmCode","A001"));
        invalid(m("factoryKey","F01","subsysKey","BAD","eqpKey","EQP01","alarmCode","B002"));
        var columns=store.read(()->reports.definition("AVPA008").get("COLUMNS"));
        var rows=store.read(()->reports.query("AVPA008",time()));
        var exported=store.read(()->excel.workbook("invalid-alarms",rows(columns),rows));
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(Base64.getDecoder().decode(s(exported,"base64"))))) {
            var sheet=book.getSheetAt(0);
            assertThat(sheet.getLastRowNum()+1).isEqualTo(rows.size()+1);
            assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("无效警报识别码");
            assertThat(sheet.getRow(0).getCell(2).getStringCellValue()).isEqualTo("失效类型");
        }
        var conditions=time(); conditions.put("FAILURE_TYPE",m("enabled",true,"operator","eq","value","NO_FACTORY"));
        var filtered=store.read(()->reports.query("AVPA008",conditions));
        assertThat(filtered).hasSize(1);
        var empty=store.read(()->excel.workbook("invalid-alarms-empty",rows(columns),List.of()));
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(Base64.getDecoder().decode(s(empty,"base64"))))) {
            assertThat(book.getSheetAt(0).getLastRowNum()).isZero();
        }
    }

    @Test void reportPagesKeepTheirHeadingsAfterBootstrap() {
        // Report pages are not in metadata.masters, so Workspace.vue falls back to meta.pageTitles.
        var meta=store.read(()->store.metadata);
        var titles=obj(meta.get("pageTitles"));
        for(String code:List.of("AVPA004","AVPA007","AVPA008","AVPA013"))
            assertThat(s(titles,code)).as("pageTitles.%s",code).isNotBlank().isNotEqualTo("页面不存在");
    }

    @Test void oldSnapshotMigratesInvalidAlarmReportIdempotently() throws Exception {
        reset();
        store.write(()->{
            store.data().remove("invalid_alarms");
            obj(obj(store.data().get("meta")).get("seq")).remove("invalid_alarms");
            rows(store.data().get("report_defs")).removeIf(r -> eq(r,"REPORT_ID","AVPA008"));
            rows(store.data().get("functions")).removeIf(r -> eq(r,"FUNCTION_KEY","AVPA008"));
            return null;
        });
        var first=new Store(jdbc);
        assertThat(first.read(()->first.table("invalid_alarms"))).isEmpty();
        assertThat(first.read(()->obj(obj(first.data().get("meta")).get("seq")).get("invalid_alarms"))).isEqualTo(0);
        assertThat(first.read(()->first.table("report_defs"))).anySatisfy(r -> assertThat(r).containsEntry("REPORT_ID","AVPA008"));
        assertThat(first.read(()->first.table("functions"))).anySatisfy(r -> assertThat(r)
            .containsEntry("FUNCTION_KEY","AVPA008").containsEntry("FUNCTION_NAME","无效警报查询").containsEntry("SORT",12));
        var second=new Store(jdbc);
        assertThat(second.read(()->first.table("report_defs").stream().filter(r -> eq(r,"REPORT_ID","AVPA008")).toList())).hasSize(1);
        assertThat(second.read(()->first.table("functions").stream().filter(r -> eq(r,"FUNCTION_KEY","AVPA008")).toList())).hasSize(1);
        for(String code:List.of("AVPA004","AVPA007","AVPA013"))
            assertThat(second.read(()->second.table("report_defs").stream().filter(r -> eq(r,"REPORT_ID",code)).toList())).hasSize(1);
    }
}
