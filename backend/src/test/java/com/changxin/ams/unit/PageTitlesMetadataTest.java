package com.changxin.ams.unit;

import static com.changxin.ams.Json.*;
import static org.assertj.core.api.Assertions.*;

import java.io.InputStream;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Guards the report page headings. Report pages (AVPA004/007/008/013) have no master
 * definition, so Workspace.vue resolves their heading from metadata.pageTitles; a missing
 * key renders "页面不存在" even though the page itself works.
 */
class PageTitlesMetadataTest {
    @Test
    void everyReportPageHasAnExplicitPageTitle() throws Exception {
        Map<String,Object> metadata;
        try (InputStream in = getClass().getResourceAsStream("/metadata.json")) {
            metadata = obj(MAPPER.readValue(in, Map.class));
        }
        var pageTitles = obj(metadata.get("pageTitles"));
        for (String code : List.of("AVPA004", "AVPA007", "AVPA008", "AVPA013"))
            assertThat(s(pageTitles, code)).as("pageTitles.%s", code).isNotBlank().isNotEqualTo("页面不存在");
        assertThat(s(pageTitles, "AVPA004")).isEqualTo("警报处理查询");
        assertThat(s(pageTitles, "AVPA007")).isEqualTo("历史记录查询");
        assertThat(s(pageTitles, "AVPA008")).isEqualTo("无效警报查询");
    }
}
