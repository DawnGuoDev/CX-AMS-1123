package com.changxin.ams;

import static com.changxin.ams.Json.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:usergroup;DB_CLOSE_DELAY=-1","ams.scheduling=false",
    "ams.smtp.from=ams@example.invalid","ams.smtp.auth=false","ams.smtp.starttls=false","ams.public-url=http://localhost:8180"})
@AutoConfigureMockMvc
class UserGroupManagementIntegrationTest {
    @Autowired Store store; @Autowired Masters masters; @Autowired MockMvc http; @Autowired JdbcTemplate jdbc;
    Map<String,Object> user;
    @BeforeEach void reset() throws Exception {
        try(var in=getClass().getResourceAsStream("/seed.json")) {
            var seed=obj(MAPPER.readValue(in,Map.class));
            store.write(()->{store.data().clear();store.data().putAll(seed);return null;});
        }
        user=store.read(()->clean(store.mustFind("users","USER_KEY","U001")));
    }
    @Test void oldUserCodeRemainsMissing() throws Exception {
        String token=login();
        http.perform(get("/api/bootstrap").header("Authorization","Bearer "+token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.meta.masters.SBRM_USERGROUP").exists())
            .andExpect(jsonPath("$.meta.mappings.SBRM_USERGROUP_MAP").exists())
            .andExpect(jsonPath("$.nav[?(@.id=='SBRM_USERGROUP')]").isNotEmpty())
            .andExpect(jsonPath("$.nav[?(@.id=='SBRM_USERGROUP_MAP')]").isNotEmpty());
        http.perform(get("/api/master/SBRM_USER_GROUP").header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
    }
    @Test void groupCrudUniqueIgnoreCaseAndHiddenRelationRecovery() {
        var created=store.write(()->masters.save("masters","SBRM_USERGROUP",null,m("GROUP_ID"," Admin ","GROUP_NAME","系统群组","GROUP_DESC","管理"),user));
        String key=str(created.get("masterKey"));
        assertThat(key).isEqualTo("user_groups-000001");
        assertThatThrownBy(()->store.write(()->masters.save("masters","SBRM_USERGROUP",null,m("GROUP_ID","admin","GROUP_NAME","重复"),user)))
            .isInstanceOf(ApiException.class).hasMessageContaining("唯一键组合已存在");
        var saved=store.write(()->masters.save("masters","SBRM_USERGROUP",key,m("GROUP_ID","CHANGED","GROUP_NAME","系统群组"),user));
        assertThat(obj(saved.get("row")).get("GROUP_ID")).isEqualTo("Admin");
        store.write(()->masters.saveMapping("SBRM_USERGROUP_MAP",key,List.of("U001","U002"),user));
        store.write(()->masters.hide("masters","SBRM_USERGROUP",key,"hide",user));
        assertThatThrownBy(()->store.write(()->masters.saveMapping("SBRM_USERGROUP_MAP",key,List.of("U001"),user)))
            .isInstanceOf(ApiException.class).hasMessage("主档已隐藏");
        store.write(()->masters.hide("masters","SBRM_USERGROUP",key,"show",user));
        assertThat(store.read(()->store.table("user_group_users").stream().filter(r->eq(r,"GROUP_KEY",key)).map(r->s(r,"USER_KEY")).toList()))
            .containsExactly("U001","U002");
        assertThatThrownBy(()->store.write(()->masters.saveMapping("SBRM_USERGROUP_MAP",key,List.of("U001","U001","U999"),user)))
            .isInstanceOf(ApiException.class).hasMessage("资料不存在");
    }
    @Test void mappingSaveIsWholeGroupReplaceDeduplicatedAndAudited() {
        var group=store.write(()->masters.save("masters","SBRM_USERGROUP",null,m("GROUP_ID","QA","GROUP_NAME","品質"),user));
        String key=str(group.get("masterKey"));
        store.write(()->masters.saveMapping("SBRM_USERGROUP_MAP",key,List.of("U001","U002","U001"),user));
        assertThat(store.read(()->store.table("user_group_users").stream().filter(r->eq(r,"GROUP_KEY",key)).map(r->s(r,"USER_KEY")).toList()))
            .containsExactly("U001","U002");
        assertThat(store.read(()->store.table("history").getFirst())).containsEntry("TABLE_NAME","user_group_users");
        store.write(()->masters.saveMapping("SBRM_USERGROUP_MAP",key,List.of("U002","U003"),user));
        assertThat(store.read(()->store.table("user_group_users").stream().filter(r->eq(r,"GROUP_KEY",key)).map(r->s(r,"USER_KEY")).toList()))
            .containsExactly("U002","U003");
        var mapping=store.read(()->masters.get("mappings","SBRM_USERGROUP_MAP",m()));
        assertThat(mapping).containsKeys("masters","items","mapRows","history");
    }
    @Test void excelUsesMetadataGroupAndUserHeaders() throws Exception {
        var group=store.write(()->masters.save("masters","SBRM_USERGROUP",null,m("GROUP_ID","QA","GROUP_NAME","品質"),user));
        String key=str(group.get("masterKey"));
        var template=store.read(()->excelMapTemplate());
        try(var book=new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(
            Base64.getDecoder().decode(s(template,"base64"))))) {
            var row=book.getSheetAt(0).getRow(0);
            assertThat(row.getCell(0).getStringCellValue()).isEqualTo("GROUP_ID");
            assertThat(row.getCell(1).getStringCellValue()).isEqualTo("USER_ID");
        }
        var file=store.read(()->excelMapWorkbook());
        var input=rows(store.read(()->new Excel(store,masters).verify("mappings","SBRM_USERGROUP_MAP",s(file,"base64"))).get("rows"));
        assertThat(input.getFirst()).containsEntry("valid",true);
        assertThat(obj(input.getFirst().get("values"))).containsEntry("GROUP_ID","QA").containsEntry("USER_ID","E0043258");
        assertThat(store.write(()->new Excel(store,masters).importRows("mappings","SBRM_USERGROUP_MAP",input,user))).containsEntry("success",1);
        assertThat(store.read(()->store.table("user_group_users").getFirst())).containsEntry("GROUP_KEY",key).containsEntry("USER_KEY","U001");
    }
    Map<String,Object> excelMapTemplate() { return new Excel(store,masters).export("mappings","SBRM_USERGROUP_MAP",true); }
    Map<String,Object> excelMapWorkbook() {
        return new Excel(store,masters).workbook("usergroup-map",List.of(
            m("field","GROUP_ID","label","GROUP_ID"),m("field","USER_ID","label","USER_ID")),
            List.of(m("GROUP_ID","QA","USER_ID","E0043258")));
    }
    String login() throws Exception {
        return s(obj(parse(http.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON)
            .content(encode(m("userId","E0043258","password","123456")))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString())),"token");
    }
}
