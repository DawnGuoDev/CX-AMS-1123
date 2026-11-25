package com.changxin.ams.e2e;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** TC-API-E2E-004: export template, validate an upload, reject invalid rows, import, 404 contract. */
@DisplayName("TC-API-E2E-004 汇出、导入校验与错误契约")
class MasterImportExportE2ETest extends E2ETestBase {

    private static final String PATH = "/api/master/SBRM_FACTORY";
    private static final ObjectMapper JSON = new ObjectMapper();

    private String importedKey;

    @AfterEach
    void deactivateImportedFactory() {
        if (importedKey != null) {
            client.post(PATH + "/" + importedKey + "/hide", Map.of());
            importedKey = null;
        }
    }

    @Test
    void shouldExportValidateImportAndRejectUnknownApi() throws Exception {
        var exported = client.post(PATH + "/export", Map.of("mode", "template")).requireOk("export template");
        assertThat(exported.text("/filename")).endsWith(".xlsx");
        var templateBytes = Base64.getDecoder().decode(exported.text("/base64"));
        assertThat((Object) templateBytes).isNotNull();
        assertThat(templateBytes.length).isPositive();
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(templateBytes))) {
            var header = book.getSheetAt(0).getRow(0);
            assertThat((Object) header).isNotNull();
            assertThat(cells(header)).contains("FACTORY_ID", "FACTORY_NAME");
        }

        // 1) The untouched template has no data rows; 2) an invalid row fails validation.
        var emptyVerify = client.post(PATH + "/import/verify", Map.of("base64", exported.text("/base64")))
                .requireOk("verify empty template");
        assertThat(emptyVerify.json().path("rows")).isEmpty();

        var invalidVerify = client.post(PATH + "/import/verify", Map.of("base64", workbookBase64(List.of(
                Map.of("FACTORY_NAME", "缺少代码"))))).requireOk("verify invalid row");
        var invalidRows = invalidVerify.json().path("rows");
        assertThat(invalidRows).hasSize(1);
        assertThat(invalidRows.get(0).path("valid").asBoolean()).isFalse();
        assertThat(invalidRows.get(0).path("message").asText()).contains("必填");

        // Import never trusts the browser flag: an invalid row is skipped and not persisted.
        var invalidImport = client.post(PATH + "/import", Map.of("rows", List.of(Map.of(
                        "rowNo", 2, "valid", false, "values", Map.of("FACTORY_NAME", "缺少代码")))))
                .requireOk("import invalid row");
        assertThat(invalidImport.json().path("success").asInt()).isZero();
        assertThat(client.get(PATH + "?showHidden=1").requireOk("list after invalid import")
                .json().path("rows").toString()).doesNotContain("缺少代码");

        // A valid row is imported exactly once.
        var code = "E2EIMP" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        var validVerify = client.post(PATH + "/import/verify", Map.of("base64", workbookBase64(List.of(
                Map.of("FACTORY_ID", code, "FACTORY_NAME", "E2E 汇入厂别"))))).requireOk("verify valid row");
        var validRow = validVerify.json().path("rows").get(0);
        assertThat(validRow.path("valid").asBoolean()).isTrue();
        var validImport = client.post(PATH + "/import", Map.of("rows", List.of(Map.of(
                "rowNo", validRow.path("rowNo").asInt(),
                "valid", true,
                "values", validRow.path("values"))))).requireOk("import valid row");
        assertThat(validImport.json().path("success").asInt()).isEqualTo(1);

        var imported = client.get(PATH + "?showHidden=1&q=" + code).requireOk("find imported factory");
        var rows = imported.json().path("rows");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).path("FACTORY_ID").asText()).isEqualTo(code);
        importedKey = rows.get(0).path("FACTORY_KEY").asText();

        var missing = client.post("/api/not-exists", Map.of());
        assertThat(missing.status()).isEqualTo(404);
        assertThat(missing.ok()).isFalse();

        var unknownMode = client.post(PATH + "/export", Map.of("mode", "unknown"));
        assertThat(unknownMode.status()).isLessThan(500);
    }

    private static String workbookBase64(List<Map<String, String>> rows) throws Exception {
        try (var book = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var sheet = book.createSheet("Data");
            var header = sheet.createRow(0);
            header.createCell(0).setCellValue("FACTORY_ID");
            header.createCell(1).setCellValue("FACTORY_NAME");
            int index = 1;
            for (var row : rows) {
                var sheetRow = sheet.createRow(index++);
                sheetRow.createCell(0).setCellValue(row.getOrDefault("FACTORY_ID", ""));
                sheetRow.createCell(1).setCellValue(row.getOrDefault("FACTORY_NAME", ""));
            }
            book.write(out);
            return Base64.getEncoder().encodeToString(out.toByteArray());
        }
    }

    private static List<String> cells(Row row) {
        var values = new java.util.ArrayList<String>();
        var formatter = new org.apache.poi.ss.usermodel.DataFormatter(java.util.Locale.ROOT);
        for (int i = 0; i < row.getLastCellNum(); i++) {
            values.add(formatter.formatCellValue(row.getCell(i)));
        }
        return values;
    }
}
