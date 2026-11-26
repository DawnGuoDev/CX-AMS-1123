package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.io.*;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

@Service
public class Excel {
    private final Store store; private final Masters masters;
    public Excel(Store store, Masters masters) { this.store=store; this.masters=masters; }
    public Map<String,Object> workbook(String filename, List<Map<String,Object>> columns, List<Map<String,Object>> data) {
        try (var book=new XSSFWorkbook(); var bytes=new ByteArrayOutputStream()) {
            var sheet=book.createSheet("Data"); var header=sheet.createRow(0);
            var style=book.createCellStyle(); var font=book.createFont(); font.setBold(true); style.setFont(font);
            for (int i=0;i<columns.size();i++) {
                var c=columns.get(i); header.createCell(i).setCellValue(s(c,"label")); header.getCell(i).setCellStyle(style);
                sheet.setColumnWidth(i,24*256);
            }
            int index=1;
            for (var record : data) {
                var row=sheet.createRow(index++);
                for (int i=0;i<columns.size();i++) {
                    var cell=row.createCell(i); Object value=record.get(s(columns.get(i),"field"));
                    if (value instanceof Number number) cell.setCellValue(number.doubleValue());
                    else cell.setCellValue(value instanceof Map || value instanceof List ? encode(value) : str(value));
                }
            }
            sheet.createFreezePane(0,1); book.write(bytes);
            return m("ok",true,"filename",filename+".xlsx","base64",Base64.getEncoder().encodeToString(bytes.toByteArray()));
        } catch (IOException e) { throw new ApiException(500,"Excel 汇出失败"); }
    }
    public Map<String,Object> export(String kind,String code,boolean template) {
        var meta=masters.meta(kind,code);
        if (kind.equals("mappings")) {
            var master=obj(meta.get("master")); var item=obj(meta.get("item"));
            String masterHeader=s(master,"excelHeader","MASTER_CODE"),itemHeader=s(item,"excelHeader","ITEM_CODE");
            String masterExcelHeader=s(meta,"masterExcelHeader",masterHeader);
            var data=template ? List.<Map<String,Object>>of() : store.table(s(meta,"mapTable")).stream().filter(r -> {
                var a=store.find(s(master,"table"),s(master,"key"),r.get(s(meta,"mapMasterFk")));
                var b=store.find(s(item,"table"),s(item,"key"),r.get(s(meta,"mapItemFk")));
                return a!=null && b!=null && active(a) && active(b);
            }).map(r -> {
                var a=store.find(s(master,"table"),s(master,"key"),r.get(s(meta,"mapMasterFk")));
                var b=store.find(s(item,"table"),s(item,"key"),r.get(s(meta,"mapItemFk")));
                return m(masterExcelHeader,a == null ? "" : a.get(str(list(master.get("display")).getFirst())),
                    "ITEM_CODE",b == null ? "" : b.get(str(list(item.get("display")).getFirst())));
            }).toList();
            return workbook(code+(template?"_template":"_data"),List.of(
                m("field",masterExcelHeader,"label",masterHeader),m("field","ITEM_CODE","label",itemHeader)),data);
        }
        var columns=rows(meta.get("fields")).stream().filter(f -> !eq(f,"type","password") && !Boolean.TRUE.equals(f.get("readOnly")))
            .map(f -> m("field",f.get("name"),"label",f.get("name"))).toList();
        return workbook(code+(template?"_template":"_data"),columns,template ? List.of() : store.table(s(meta,"table")).stream().filter(Json::active).map(Json::clean).toList());
    }
    public Map<String,Object> verify(String kind,String code,String base64) {
        require(base64.length()<=16_000_000,"Excel 文件过大（限 12 MB）");
        var meta=masters.meta(kind,code); var results=new ArrayList<Map<String,Object>>();
        try (var book=new XSSFWorkbook(new ByteArrayInputStream(Base64.getDecoder().decode(base64)))) {
            require(book.getNumberOfSheets()>0,"Excel 没有工作表");
            var sheet=book.getSheetAt(0); require(sheet.getPhysicalNumberOfRows()>0,"Excel 缺少表头");
            require(sheet.getLastRowNum()<=5000,"单次最多汇入 5000 列");
            var formatter=new DataFormatter(Locale.ROOT);
            var header=sheet.getRow(0); require(header != null,"Excel 缺少表头");
            for (int i=1;i<=sheet.getLastRowNum();i++) {
                var source=sheet.getRow(i); if (source == null) continue;
                var values=m();
                for (int j=0;j<header.getLastCellNum();j++) {
                    String headerName=formatter.formatCellValue(header.getCell(j));
                    String key=kind.equals("masters") ? rows(meta.get("fields")).stream().filter(f -> eq(f,"label",headerName))
                        .map(f -> s(f,"name")).findFirst().orElse(headerName) : headerName;
                    if (!key.isBlank()) values.put(key,formatter.formatCellValue(source.getCell(j)));
                }
                if (values.values().stream().allMatch(v -> str(v).isBlank())) continue;
                var result=m("rowNo",i+1,"values",values,"valid",true,"message","可汇入");
                try {
                    if (kind.equals("mappings")) result.putAll(mappingKeys(meta,values));
                    else {
                        for (var field : rows(meta.get("fields"))) {
                            String name=s(field,"name"),set=s(field,"optionSet"),text=s(values,name);
                            if (!set.isBlank() && !text.isBlank()) {
                                var option=rows(masters.options().get(set)).stream().filter(o -> eq(o,"value",text) || eq(o,"code",text) || eq(o,"label",text)).findFirst().orElse(null);
                                if (option != null) values.put(name,option.get("value"));
                            }
                            if (eq(field,"type","checkbox")) values.put(name,List.of("Y","是","true","1").contains(text) ? "Y" : "N");
                        }
                        values=masters.values(meta,values,false);
                        masters.validate(meta,values,s(meta,"table"),s(meta,"keyField")); result.put("values",values);
                    }
                } catch (ApiException e) { result.put("valid",false); result.put("message",e.getMessage()); }
                results.add(result);
            }
        } catch (ApiException e) { throw e; }
        catch (Exception e) { throw new ApiException(400,"无法读取 Excel，请使用 .xlsx 范本"); }
        return m("ok",true,"meta",meta,"rows",results);
    }
    private Map<String,Object> mappingKeys(Map<String,Object> meta,Map<String,Object> values) {
        var a=obj(meta.get("master")); var b=obj(meta.get("item"));
        String masterHeader=s(a,"excelHeader","MASTER_CODE"),itemHeader=s(b,"excelHeader","ITEM_CODE");
        String masterCode=s(meta,"masterExcelHeader",masterHeader),itemCode=s(meta,"itemExcelHeader",itemHeader);
        var master=store.mustFind(s(a,"table"),str(list(a.get("display")).getFirst()),str(values,masterCode));
        var item=store.mustFind(s(b,"table"),str(list(b.get("display")).getFirst()),str(values,itemCode));
        require(active(master) && active(item),"对应资料已隐藏");
        return m("masterKey",master.get(s(a,"key")),"itemKey",item.get(s(b,"key")));
    }
    public Map<String,Object> importRows(String kind,String code,List<Map<String,Object>> input,Map<String,Object> user) {
        require(input.size()<=5000,"单次最多汇入 5000 列");
        int success=0; var errors=new ArrayList<String>();
        for (var candidate : input) {
            if (!Boolean.TRUE.equals(candidate.get("valid"))) continue;
            // Revalidate all submitted values. Never trust the browser's valid flag.
            try {
                if (kind.equals("mappings")) {
                    var meta=masters.meta(kind,code); var keys=mappingKeys(meta,obj(candidate.get("values")));
                    var current=new ArrayList<Object>(store.table(s(meta,"mapTable")).stream().filter(r -> eq(r,s(meta,"mapMasterFk"),keys.get("masterKey"))).map(r -> r.get(s(meta,"mapItemFk"))).toList());
                    if (!current.contains(keys.get("itemKey"))) {
                        current.add(keys.get("itemKey")); masters.saveMapping(code,s(keys,"masterKey"),current,user);
                        store.table("history").getFirst().put("ACTION","Import"); success++;
                    }
                } else {
                    masters.save("masters",code,null,obj(candidate.get("values")),user);
                    store.table("history").getFirst().put("ACTION","Import"); success++;
                }
            } catch (ApiException e) { errors.add("第 "+s(candidate,"rowNo")+" 列："+e.getMessage()); }
        }
        return m("ok",true,"success",success,"errors",errors);
    }
}
