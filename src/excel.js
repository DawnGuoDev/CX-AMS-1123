'use strict';

const ExcelJS = require('exceljs');
const { getDb } = require('./db');
const { buildOptions } = require('./options');
const { MASTERS, MAPPINGS } = require('./metadata');
const { fieldValues, validate } = require('./master-service');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3557' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10, name: 'Microsoft JhengHei' };
const BODY_FONT = { size: 10, name: 'Microsoft JhengHei' };
const BORDER = {
  top: { style: 'thin', color: { argb: 'FFD6DEE8' } },
  left: { style: 'thin', color: { argb: 'FFD6DEE8' } },
  bottom: { style: 'thin', color: { argb: 'FFD6DEE8' } },
  right: { style: 'thin', color: { argb: 'FFD6DEE8' } }
};

function styleSheet(ws, widths) {
  const header = ws.getRow(1);
  header.height = 24;
  header.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER;
  });
  ws.eachRow((row, index) => {
    if (index === 1) return;
    row.eachCell(cell => {
      cell.font = BODY_FONT;
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle' };
    });
  });
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function optionLabel(options, field, value) {
  if (!field.optionSet) return value;
  const list = options[field.optionSet] || [];
  const found = list.find(o => o.value === value);
  return found ? found.label : value;
}

async function workbookBuffer(wb) {
  return wb.xlsx.writeBuffer();
}

async function masterWorkbook(code, mode) {
  const meta = MASTERS[code];
  if (!meta) throw new Error('页面不存在');
  const db = getDb();
  const options = buildOptions();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AMS';
  wb.created = new Date();
  const wsMode = mode === 'template';
  const sheetName = meta.title.slice(0, 28) || 'Data';
  const ws = wb.addWorksheet(sheetName);
  ws.columns = meta.fields.map(f => ({ header: f.label, key: f.name, width: Math.max(12, Math.min(40, Math.round((f.width || 140) / 7))) }));
  if (!wsMode) {
    const rows = db[meta.table].filter(r => r.ACTIVE !== 'N').map(r => {
      const out = {};
      meta.fields.forEach(f => {
        let v = r[f.name];
        if (f.type === 'select') v = optionLabel(options, f, v);
        if (f.type === 'checkbox') v = v === 'Y' ? '是' : '否';
        if (f.type === 'datetime' && v) v = new Date(v).toLocaleString('zh-CN', { hour12: false });
        out[f.name] = v == null ? '' : v;
      });
      return out;
    });
    ws.addRows(rows);
  } else {
    ws.addRow(meta.fields.reduce((o, f) => { o[f.name] = ''; return o; }, {}));
    ws.spliceRows(2, 1);
  }
  styleSheet(ws, ws.columns.map(c => c.width));
  return { buffer: await workbookBuffer(wb), filename: `${meta.title}_${wsMode ? '范本' : '资料'}.xlsx` };
}

async function mappingWorkbook(code, mode) {
  const meta = MAPPINGS[code];
  if (!meta) throw new Error('页面不存在');
  const db = getDb();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mapping');
  const headers = [
    meta.master.display[0] + '（' + meta.master.label + '代码）',
    meta.master.display[1] || '',
    meta.item.display[0] + '（' + meta.item.label + '代码）',
    meta.item.display[1] || ''
  ];
  ws.columns = [
    { header: headers[0], key: 'MASTER_CODE', width: 24 },
    { header: headers[1], key: 'MASTER_NAME', width: 28 },
    { header: headers[2], key: 'ITEM_CODE', width: 24 },
    { header: headers[3], key: 'ITEM_NAME', width: 30 }
  ];
  if (mode !== 'template') {
    const rows = db[meta.mapTable].map(m => {
      const master = db[meta.master.table].find(x => x[meta.master.key] === m[meta.mapMasterFk]) || {};
      const item = db[meta.item.table].find(x => x[meta.item.key] === m[meta.mapItemFk]) || {};
      return {
        MASTER_CODE: master[meta.master.display[0]],
        MASTER_NAME: master[meta.master.display[1]] || '',
        ITEM_CODE: item[meta.item.display[0]],
        ITEM_NAME: item[meta.item.display[1]] || ''
      };
    });
    ws.addRows(rows);
  }
  styleSheet(ws, [24, 28, 24, 30]);
  return { buffer: await workbookBuffer(wb), filename: `${meta.title}_${mode === 'template' ? '范本' : '资料'}.xlsx` };
}

function resolveOption(options, field, input) {
  if (!field.optionSet) return input;
  const list = options[field.optionSet] || [];
  const s = String(input == null ? '' : input).trim();
  if (!s) return '';
  const found = list.find(o => o.value === s)
    || list.find(o => String(o.code || '') === s)
    || list.find(o => String(o.label) === s)
    || list.find(o => String(o.name || '') === s)
    || list.find(o => String(o.label).includes(s));
  return found ? found.value : s;
}

async function verifyMasterImport(code, base64) {
  const meta = MASTERS[code];
  if (!meta) throw new Error('页面不存在');
  const db = getDb();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(base64, 'base64'));
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Excel 档案没有工作表');
  const headers = [];
  ws.getRow(1).eachCell((cell, col) => { headers[col] = String(cell.value == null ? '' : cell.text || cell.value).trim(); });
  const options = buildOptions();
  const labelToField = {};
  meta.fields.forEach(f => {
    labelToField[f.label] = f;
    labelToField[f.name] = f;
  });
  const fieldByCol = {};
  headers.forEach((h, col) => {
    if (!h) return;
    const f = labelToField[h];
    if (f) fieldByCol[col] = f;
  });
  const rows = [];
  const seen = new Set();
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const raw = {};
    let hasValue = false;
    Object.entries(fieldByCol).forEach(([col, f]) => {
      const cell = row.getCell(Number(col));
      let v = cell.value;
      if (v && typeof v === 'object' && v.text) v = v.text;
      if (v instanceof Date) v = v.toISOString();
      if (v != null && v !== '') hasValue = true;
      raw[f.name] = v == null ? '' : v;
    });
    if (!hasValue) continue;
    meta.fields.forEach(f => {
      if (f.type === 'select') raw[f.name] = resolveOption(options, f, raw[f.name]);
      if (f.type === 'checkbox') raw[f.name] = (raw[f.name] === '是' || raw[f.name] === 'Y' || raw[f.name] === true) ? 'Y' : 'N';
    });
    const values = fieldValues(meta, raw);
    const errors = validate(meta, values, null);
    const uniqueKey = (meta.uniqueFields || []).map(f => values[f]).join('||');
    if (uniqueKey && seen.has(uniqueKey)) errors.push('档案内唯一键重复');
    if (uniqueKey) seen.add(uniqueKey);
    rows.push({
      rowNo: r,
      values,
      display: meta.fields.map(f => ({ label: f.label, value: raw[f.name] })),
      valid: errors.length === 0,
      error: errors.join('；')
    });
  }
  return { meta, rows };
}

async function verifyMappingImport(code, base64) {
  const meta = MAPPINGS[code];
  if (!meta) throw new Error('页面不存在');
  const db = getDb();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(base64, 'base64'));
  const ws = wb.worksheets[0];
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const masterCode = ws.getCell(r, 1).text.trim();
    const itemCode = ws.getCell(r, 3).text.trim();
    if (!masterCode && !itemCode) continue;
    const master = db[meta.master.table].find(x => String(x[meta.master.display[0]]) === masterCode);
    const item = db[meta.item.table].find(x => String(x[meta.item.display[0]]) === itemCode);
    const errors = [];
    if (!master) errors.push('主档代码不存在');
    if (!item) errors.push('对应代码不存在');
    rows.push({
      rowNo: r, masterCode, itemCode,
      masterKey: master ? master[meta.master.key] : null,
      itemKey: item ? item[meta.item.key] : null,
      valid: errors.length === 0, error: errors.join('；')
    });
  }
  return { meta, rows };
}

async function reportWorkbook(code, columns, rows, title) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  const cols = columns && columns.length ? columns : Object.keys(rows[0] || {}).map(k => ({ field: k, label: k }));
  ws.columns = cols.map(c => ({ header: c.label, key: c.field, width: Math.max(12, Math.min(38, c.label.length * 2 + 8)) }));
  ws.addRows(rows.map(row => {
    const out = {};
    cols.forEach(c => {
      let v = row[c.field];
      if (v == null) v = '';
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        v = new Date(v).toLocaleString('zh-CN', { hour12: false });
      }
      out[c.field] = v;
    });
    return out;
  }));
  styleSheet(ws, ws.columns.map(c => c.width));
  return { buffer: await workbookBuffer(wb), filename: `${title || code}_${new Date().toISOString().slice(0, 10)}.xlsx` };
}

module.exports = {
  masterWorkbook,
  mappingWorkbook,
  verifyMasterImport,
  verifyMappingImport,
  reportWorkbook
};
