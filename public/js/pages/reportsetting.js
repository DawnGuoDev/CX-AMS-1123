'use strict';

import {
  esc, icon, DataGrid, openModal, toast, confirmDialog, showLoading, hideLoading,
  statusChip, actionLabel, tabsHtml, bindTabs, formGrid, readForm, emptyState
} from '../ui.js';
import { t } from '../i18n.js';

const STEPS = [
  '报表资讯', '资料来源', '查询条件', '查询条件与语法对应', '资料呈现', '栏位资讯',
  '监控设定', 'DrillDown', '图表资讯', '图例资讯', 'Y轴资讯', '数列资讯', '圆饼图资讯',
  '枢纽显示资讯', '枢纽分析资讯', '枢纽扩充方法', '枢纽DrillDown资讯', '资讯确认'
];

const OPTION_SETS = ['factory', 'subsystem', 'eqp', 'eqpGroup', 'eqpType', 'eqpStatus', 'user', 'userGroup', 'event', 'eventGroup'];
const INPUT_TYPES = [
  { value: 'dateRange', label: '日期区间' },
  { value: 'select', label: '下拉选单' },
  { value: 'text', label: '文字输入' }
];

export async function render(container, ctx) {
  let rows = [];
  let history = [];
  let tab = 'data';
  let selectedKey = null;
  let grid = null;

  container.innerHTML = `<div class="card">
    ${tabsHtml([{ key: 'data', label: '资料' }, { key: 'history', label: '履历' }], tab)}
    <div id="rpt-body"></div>
  </div>`;
  bindTabs(container.querySelector('.card'), (key) => { tab = key; draw(); });

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      const res = await ctx.api.get('/api/report-defs');
      rows = res.rows;
      history = res.history || [];
      if (selectedKey && !rows.some(r => r.REPORT_KEY === selectedKey)) selectedKey = null;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { if (!silent) hideLoading(); }
  };

  const draw = () => {
    const body = container.querySelector('#rpt-body');
    if (tab === 'history') {
      body.innerHTML = `<div class="toolbar"><button class="tool-btn" id="rpt-href">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button></div><div id="rpt-history"></div>`;
      new DataGrid(body.querySelector('#rpt-history'), {
        rows: history, rowKey: 'HIST_KEY', showFilter: false,
        columns: [
          { field: 'ACTIVE', label: '资料状态', type: 'yn', width: 85 },
          { field: 'ACTION', label: '交易类别', width: 100, render: r => esc(actionLabel(r.ACTION)) },
          { field: 'TRX_DT', label: '修改时间', type: 'datetime', width: 155 },
          { field: 'USER_ID', label: '修改人员代码', width: 110 },
          { field: 'USER_NAME', label: '修改人员名称', width: 110 },
          { field: 'RECORD_LABEL', label: '报表', width: 150 }
        ]
      });
      body.querySelector('#rpt-href').addEventListener('click', () => load(true));
      return;
    }
    body.innerHTML = `
      <div class="toolbar">
        <button class="tool-btn tool-add" data-action="add">${icon('plus', 15)}<span>${esc(t('新增'))}</span></button>
        <button class="tool-btn" data-action="copy">${icon('copy', 15)}<span>${esc(t('复制'))}</span></button>
        <button class="tool-btn" data-action="edit">${icon('edit', 15)}<span>${esc(t('修改'))}</span></button>
        <span class="tool-sep"></span>
        <button class="tool-btn" data-action="hide">${icon('hide', 15)}<span>${esc(t('隐藏'))}</span></button>
        <button class="tool-btn" data-action="show">${icon('show', 15)}<span>${esc(t('取消隐藏'))}</span></button>
        <button class="tool-btn" data-action="refresh">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
        <div class="toolbar-right"><span class="inline-note">${icon('info', 13)} 报表定义会驱动 AVPA004 / 005 / 007 / 008 查询页</span></div>
      </div>
      <div id="rpt-grid"></div>
    `;
    grid = new DataGrid(body.querySelector('#rpt-grid'), {
      rows, rowKey: 'REPORT_KEY', selectable: 'single', pageSize: 20,
      columns: [
        { field: 'REPORT_ID', label: '报表代码', width: 150 },
        { field: 'REPORT_NAME', label: '报表名称', width: 200, render: r => esc(t(r.REPORT_NAME)) },
        { field: 'REPORT_DESC', label: '报表描述', width: 340, render: r => esc(t(r.REPORT_DESC)) },
        { field: 'CONNECTION_STRING_NAME', label: '连线字串', width: 150 },
        { field: 'ATLEAST_ONE_CONDITION', label: '至少一条件', width: 110, type: 'yn' },
        { field: 'ACTIVE', label: '状态', width: 85, render: r => statusChip(r.ACTIVE === 'Y' ? 'Y' : 'N') },
        { field: 'MTR_DATE', label: '修改时间', type: 'datetime', width: 155 }
      ],
      onRowClick: (row) => { selectedKey = row.REPORT_KEY; updateEnabled(); }
    });
    if (selectedKey) { grid.selected.add(selectedKey); grid.render(); }
    updateEnabled();
    body.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => handleAction(btn.dataset.action)));
  };

  const updateEnabled = () => {
    const row = rows.find(r => r.REPORT_KEY === selectedKey);
    ['copy', 'edit', 'hide'].forEach(a => {
      const btn = container.querySelector(`[data-action="${a}"]`);
      if (btn) btn.disabled = !row;
    });
    const show = container.querySelector('[data-action="show"]');
    if (show) show.disabled = !row || row.ACTIVE !== 'N';
  };

  const handleAction = async (action) => {
    const row = rows.find(r => r.REPORT_KEY === selectedKey);
    if (['copy', 'edit', 'hide', 'show'].includes(action) && !row) { toast(t('请选择一笔资料'), 'warning'); return; }
    if (action === 'add') openWizard('add', null);
    else if (action === 'copy') openWizard('copy', row);
    else if (action === 'edit') openWizard('edit', row);
    else if (action === 'hide') {
      const ok = await confirmDialog({ title: t('隐藏'), message: `确定要隐藏报表「${row.REPORT_ID}」？`, okText: t('隐藏'), danger: true });
      if (!ok) return;
      try { await ctx.api.post(`/api/report-defs/${row.REPORT_KEY}/hide`); toast(t('操作成功')); load(true); } catch (e) { toast(e.message, 'error'); }
    } else if (action === 'show') {
      try { await ctx.api.post(`/api/report-defs/${row.REPORT_KEY}/show`); toast(t('操作成功')); load(true); } catch (e) { toast(e.message, 'error'); }
    } else if (action === 'refresh') { load(true); toast(t('资料已更新'), 'info'); }
  };

  const openWizard = (mode, row) => {
    const isEdit = mode === 'edit';
    const draft = mode === 'add' ? {
      REPORT_ID: '', REPORT_NAME: '', REPORT_DESC: '', CONNECTION_STRING_NAME: 'AMS_DB',
      ATLEAST_ONE_CONDITION: 'N', DATASOURCE_TYPE: 'SQL', QUERY_SQL: '', PROCEDURE_CURSOR: '', PATH_NAME: '', OBJ_NAME: ''
    } : { ...row };
    if (mode === 'copy') { draft.REPORT_ID = ''; delete draft.REPORT_KEY; }
    const conditions = parseJson(draft.CONDITIONS_JSON, []);
    const columns = parseJson(draft.COLUMNS_JSON, []);
    const display = parseJson(draft.DISPLAY_JSON, { displayType: 'Grid', pageSizes: '20,25,50,100,200,500', exportType: 'Excel', gridBackgroundColor: '#ffffff' });
    const advanced = parseJson(draft.ADVANCED_JSON, {});
    let step = 0;
    const body = document.createElement('div');
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const modal = openModal({
      title: `${t('报表设定')} - ${t(isEdit ? '修改' : mode === 'copy' ? '复制' : '新增')}`,
      width: 'min(1240px, 96vw)', body, footer, className: 'modal-full'
    });
    body.innerHTML = `<div class="report-wizard">
      <div class="wizard-steps" id="rpt-steps"></div>
      <div class="wizard-main">
        <div class="wizard-content" id="rpt-step-content"></div>
        <div class="wizard-foot" id="rpt-step-foot"></div>
      </div>
    </div>`;

    const adv = (key) => {
      if (!advanced[key] || typeof advanced[key] !== 'object') advanced[key] = {};
      return advanced[key];
    };
    const advRows = (key) => {
      if (!Array.isArray(advanced[key])) advanced[key] = [];
      return advanced[key];
    };

    const stepFields = () => {
      if (step === 0) return {
        target: draft,
        fields: [
          { name: 'REPORT_ID', label: '报表代码', type: 'text', required: true, readOnlyOnEdit: isEdit },
          { name: 'REPORT_NAME', label: '报表名称', type: 'text', required: true },
          { name: 'REPORT_DESC', label: '报表描述', type: 'text', full: true },
          { name: 'CONNECTION_STRING_NAME', label: '连线字串名称', type: 'text', required: true },
          { name: 'ATLEAST_ONE_CONDITION', label: '至少一个查询条件', type: 'checkbox' }
        ]
      };
      if (step === 1) return {
        target: draft,
        fields: [
          { name: 'DATASOURCE_TYPE', label: '资料来源方式', type: 'select', options: ctx.options.reportDataSourceType, required: true },
          { name: 'PROCEDURE_CURSOR', label: 'Procedure 回传 Cursor', type: 'text' },
          { name: 'PATH_NAME', label: '路径名称', type: 'text' },
          { name: 'OBJ_NAME', label: '物件名称', type: 'text' },
          { name: 'QUERY_SQL', label: '查询语法', type: 'textarea', full: true, required: true }
        ]
      };
      if (step === 4) return {
        target: display,
        fields: [
          { name: 'displayType', label: '画面摆设', type: 'select', options: ctx.options.displayType, required: true },
          { name: 'exportType', label: '汇出类型', type: 'select', options: ctx.options.exportType },
          { name: 'pageSizes', label: '表格列数', type: 'text' },
          { name: 'gridBackgroundColor', label: '表格背景色', type: 'text' },
          { name: 'chartPosition', label: '图表位置', type: 'text' },
          { name: 'dataAfterQueryAction', label: '查询后动作', type: 'select', options: ctx.options.dataAfterQueryAction }
        ]
      };
      if (step === 8) return {
        target: adv('chart'),
        fields: [
          { name: 'isPie', label: '是否为圆饼图', type: 'checkbox' },
          { name: 'backgroundColor', label: '背景色', type: 'text' },
          { name: 'backgroundAlpha', label: '背景色透明度', type: 'number' },
          { name: 'borderColor', label: '框线颜色', type: 'text' },
          { name: 'borderAlpha', label: '框线透明度', type: 'number' },
          { name: 'xField', label: 'X 轴栏位名称', type: 'text' },
          { name: 'xColor', label: 'X 轴颜色', type: 'text' },
          { name: 'labelRotate', label: '标签旋转角度', type: 'number' },
          { name: 'flip', label: '翻转图片', type: 'checkbox' },
          { name: 'gridColor', label: '格线颜色', type: 'text' },
          { name: 'gridAlpha', label: '格线透明度', type: 'number' },
          { name: 'gridCount', label: '格线数量', type: 'number' }
        ]
      };
      if (step === 9) return {
        target: adv('legend'),
        fields: [
          { name: 'position', label: '图例位置', type: 'text' },
          { name: 'borderColor', label: '图例框线颜色', type: 'text' },
          { name: 'borderAlpha', label: '框线透明度', type: 'number' },
          { name: 'textColor', label: '图例文字颜色', type: 'text' },
          { name: 'align', label: '文字对齐方式', type: 'text' },
          { name: 'tooltip', label: 'Tooltip 显示格式', type: 'text' },
          { name: 'valueWidth', label: '图例值宽度', type: 'number' }
        ]
      };
      if (step === 12) return {
        target: adv('pie'),
        fields: [
          { name: 'innerDiameter', label: '内圆直径百分比', type: 'number' },
          { name: 'seriesName', label: '数列名称', type: 'text' }
        ]
      };
      if (step === 13) return {
        target: adv('pivotDisplay'),
        fields: [
          { name: 'enabled', label: '启用枢纽分析', type: 'checkbox' },
          { name: 'subtotalColumn', label: '计算小计在资料栏', type: 'checkbox' },
          { name: 'subtotalRow', label: '计算小计在资料列', type: 'checkbox' },
          { name: 'subtotalColumnColor', label: '小计栏位颜色', type: 'text' },
          { name: 'subtotalRowColor', label: '小计列颜色', type: 'text' },
          { name: 'totalColumn', label: '计算总计在资料栏', type: 'checkbox' },
          { name: 'totalRow', label: '计算总计在资料列', type: 'checkbox' },
          { name: 'totalColor', label: '总计文字颜色', type: 'text' },
          { name: 'emptyText', label: '无资料的文字', type: 'text' }
        ]
      };
      if (step === 6) return {
        target: adv('monitor'),
        fields: []
      };
      return null;
    };

    const drawSteps = () => {
      body.querySelector('#rpt-steps').innerHTML = STEPS.map((s, i) => `
        <div class="wizard-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}" data-step="${i}">
          <span class="ws-num">${i < step ? '✓' : i + 1}</span><span>${esc(t(s))}</span>
        </div>`).join('');
      body.querySelectorAll('[data-step]').forEach(el => el.addEventListener('click', () => {
        collectStep();
        step = Number(el.dataset.step);
        drawContent();
      }));
    };

    const collectStep = () => {
      const content = body.querySelector('#rpt-step-content');
      const cfg = stepFields();
      if (cfg && cfg.fields.length) {
        const values = readForm(content, cfg.fields);
        Object.assign(cfg.target, values);
      }
    };

    const tableEditor = (host, rowsArr, columnsDef, name) => {
      host.innerHTML = `<div class="form-section">
        <div class="form-section-head"><span>${esc(t(name))}</span>
          <button class="btn btn-sm btn-subtle" data-add-row>${icon('plus', 12)} ${esc(t('新增'))}</button></div>
        <div class="form-section-body" style="padding:0"><div class="dg-scroll"><table class="sub-grid">
          <thead><tr>${columnsDef.map(c => `<th>${esc(t(c.label))}</th>`).join('')}<th></th></tr></thead>
          <tbody>${rowsArr.map((r, i) => `<tr data-i="${i}">
            ${columnsDef.map(c => `<td>${c.type === 'checkbox'
              ? `<input type="checkbox" data-k="${c.key}" ${r[c.key] ? 'checked' : ''}/>`
              : `<input class="input" data-k="${c.key}" value="${esc(r[c.key] == null ? '' : r[c.key])}" ${c.type === 'number' ? 'type="number"' : ''}/>`}</td>`).join('')}
            <td><button class="row-del" data-del-row="${i}">${icon('trash', 13)}</button></td>
          </tr>`).join('')}</tbody>
        </table></div></div>
      </div>`;
      host.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener('change', () => {
        const i = Number(inp.closest('tr').dataset.i);
        rowsArr[i][inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? Number(inp.value) : inp.value);
      }));
      host.querySelectorAll('[data-del-row]').forEach(btn => btn.addEventListener('click', () => { rowsArr.splice(Number(btn.dataset.delRow), 1); drawContent(); }));
      host.querySelector('[data-add-row]').addEventListener('click', () => {
        const row = {};
        columnsDef.forEach(c => { row[c.key] = c.type === 'checkbox' ? false : ''; });
        rowsArr.push(row);
        drawContent();
      });
    };

    const drawContent = () => {
      drawSteps();
      const content = body.querySelector('#rpt-step-content');
      const cfg = stepFields();
      let html = `<div class="wizard-title">${step + 1}. ${esc(t(STEPS[step]))}</div>
        <div class="wizard-desc">${esc(stepDesc(step))}</div>`;
      if (cfg && cfg.fields.length) {
        html += `<div class="form-section"><div class="form-section-body">${formGrid(cfg.fields.map(f => ({ ...f, disabled: isEdit && f.readOnlyOnEdit })), cfg.target, ctx.options, { columns: 2 })}</div></div>`;
        if (step === 1) html += `<div class="hint-bar">${icon('info', 14)}<div>本机演示环境不会执行自订 SQL；SQL 仅保存为报表定义，查询页使用内建资料集。可修改查询条件与栏位来影响报表呈现。</div></div>`;
      }
      if (step === 2) {
        html += `<div id="cond-editor"></div>`;
      } else if (step === 3) {
        html += `<div id="cond-sql"></div>`;
      } else if (step === 5) {
        html += `<div id="col-editor"></div>`;
      } else if (step === 6) {
        html += `<div class="hint-bar">${icon('info', 14)}<div>监控设定页签为预留功能，预设隐藏。</div></div>`;
      } else if (step === 7) {
        html += `<div id="drill-editor"></div>`;
      } else if (step === 10) {
        html += `<div id="yaxis-editor"></div>`;
      } else if (step === 11) {
        html += `<div id="series-editor"></div>`;
      } else if (step === 14) {
        html += `<div id="pivot-designer"></div>`;
      } else if (step === 15) {
        html += `<div id="pivot-extend"></div>`;
      } else if (step === 16) {
        html += `<div id="pivot-drill"></div>`;
      } else if (step === 17) {
        html += `<div class="json-preview">${esc(JSON.stringify(confirmData(), null, 2))}</div>`;
      }
      content.innerHTML = html;
      if (step === 2) renderConditions(content.querySelector('#cond-editor'));
      if (step === 3) renderConditionSql(content.querySelector('#cond-sql'));
      if (step === 5) renderColumns(content.querySelector('#col-editor'));
      if (step === 7) tableEditor(content.querySelector('#drill-editor'), advRows('drilldown'), [
        { key: 'field', label: '行值' }, { key: 'condition', label: '条件' }, { key: 'value', label: '值' }
      ], 'DrillDown');
      if (step === 10) tableEditor(content.querySelector('#yaxis-editor'), advRows('yAxes'), [
        { key: 'name', label: '轴的名称' }, { key: 'title', label: '轴的标题' }, { key: 'color', label: '颜色' },
        { key: 'alpha', label: '透明度', type: 'number' }, { key: 'position', label: '位置' }, { key: 'stackType', label: '堆叠类型' }
      ], 'Y轴资讯');
      if (step === 11) tableEditor(content.querySelector('#series-editor'), advRows('series'), [
        { key: 'name', label: '数列名称' }, { key: 'axis', label: '轴的名称' }, { key: 'color', label: '颜色' },
        { key: 'alpha', label: '透明度', type: 'number' }, { key: 'type', label: '数列类型' },
        { key: 'stacked', label: '柱状图独立', type: 'checkbox' }, { key: 'barWidth', label: '条状宽度', type: 'number' }
      ], '数列资讯');
      if (step === 14) renderPivotDesigner(content.querySelector('#pivot-designer'));
      if (step === 15) tableEditor(content.querySelector('#pivot-extend'), advRows('pivotExtend'), [
        { key: 'name', label: '显示名称' }, { key: 'expression', label: '表达式' }
      ], '枢纽扩充方法');
      if (step === 16) tableEditor(content.querySelector('#pivot-drill'), advRows('pivotDrilldown'), [
        { key: 'field', label: '栏位' }, { key: 'condition', label: '条件' }
      ], '枢纽DrillDown');
      drawFooter();
    };

    const stepDesc = (s) => ({
      0: '定义报表代码、名称与连线资讯，并决定是否要求至少一个查询条件。',
      1: '设定资料来源方式与查询语法；本机环境仅保存定义。',
      2: '定义查询页的过滤条件、预设值与资料来源。',
      3: '将查询条件变数与 SQL 语法对应。',
      4: '设定查询结果的呈现方式、分页与汇出行为。',
      5: '定义结果表格的栏位、宽度、隐藏与 DrillDown 报表。',
      6: '预留监控页签。',
      7: '设定单元格下钻的栏位与条件。',
      8: '图表、颜色与格线设定。',
      9: '图例位置、颜色与 Tooltip 格式。',
      10: 'Y 轴名称、颜色、堆叠与标题样式。',
      11: '数列名称、颜色、类型与节点样式。',
      12: '圆饼图内圆直径与数列名称。',
      13: '枢纽分析总开关、小计与总计显示。',
      14: '拖拽式枢纽分析设计：加入列、栏与值。',
      15: '枢纽扩充资料行的方法。',
      16: '枢纽分析的 DrillDown 设定。',
      17: '确认整份报表定义后储存。'
    }[s] || '');

    const renderConditions = (host) => {
      host.innerHTML = `<div class="form-section"><div class="form-section-head"><span>${esc(t('查询条件'))}</span>
        <button class="btn btn-sm btn-subtle" id="add-cond">${icon('plus', 12)} ${esc(t('新增'))}</button></div>
        <div class="form-section-body" style="padding:0"><div class="dg-scroll"><table class="sub-grid">
          <thead><tr><th>变数名称</th><th>栏位显示代码</th><th>输入类型</th><th>资料来源</th><th>预设天数</th><th>必填</th><th></th></tr></thead>
          <tbody>${conditions.map((c, i) => `<tr data-i="${i}">
            <td><input class="input" data-c="field" value="${esc(c.field || '')}"/></td>
            <td><input class="input" data-c="label" value="${esc(c.label || '')}"/></td>
            <td><select class="input" data-c="type">${INPUT_TYPES.map(o => `<option value="${esc(o.value)}" ${c.type === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></td>
            <td><select class="input" data-c="optionSet"><option value="">—</option>${OPTION_SETS.map(o => `<option value="${o}" ${c.optionSet === o ? 'selected' : ''}>${o}</option>`).join('')}</select></td>
            <td><input class="input" data-c="defaultDays" type="number" value="${esc(c.defaultDays || '')}" style="width:70px"/></td>
            <td style="text-align:center"><input type="checkbox" data-c="enabled" ${c.enabled ? 'checked' : ''}/></td>
            <td><button class="row-del" data-del="${i}">${icon('trash', 13)}</button></td>
          </tr>`).join('')}</tbody>
        </table></div></div></div>`;
      host.querySelectorAll('[data-c]').forEach(inp => inp.addEventListener('change', () => {
        const i = Number(inp.closest('tr').dataset.i);
        const k = inp.dataset.c;
        conditions[i][k] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? Number(inp.value) : inp.value);
      }));
      host.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => { conditions.splice(Number(btn.dataset.del), 1); drawContent(); }));
      host.querySelector('#add-cond').addEventListener('click', () => {
        conditions.push({ field: '', label: '', type: 'dateRange', defaultDays: 7, enabled: true });
        drawContent();
      });
    };

    const renderConditionSql = (host) => {
      const arr = advRows('conditionSql');
      tableEditor(host, arr, [
        { key: 'variable', label: '变数名称' }, { key: 'operator', label: '运算子' }, { key: 'value', label: '固定值' }
      ], '查询条件与语法对应');
    };

    const renderColumns = (host) => {
      host.innerHTML = `<div class="form-section"><div class="form-section-head"><span>${esc(t('栏位资讯'))}</span>
        <button class="btn btn-sm btn-subtle" id="add-col">${icon('plus', 12)} ${esc(t('新增'))}</button></div>
        <div class="form-section-body" style="padding:0"><div class="dg-scroll"><table class="sub-grid">
          <thead><tr><th>域名</th><th>栏位显示代码</th><th>宽度</th><th>隐藏</th><th>DrillDown</th><th>数字格式</th><th></th></tr></thead>
          <tbody>${columns.map((c, i) => `<tr data-i="${i}">
            <td><input class="input" data-col="field" value="${esc(c.field || '')}"/></td>
            <td><input class="input" data-col="label" value="${esc(c.label || '')}"/></td>
            <td><input class="input" data-col="width" type="number" value="${esc(c.width || 140)}" style="width:80px"/></td>
            <td style="text-align:center"><input type="checkbox" data-col="hidden" ${c.hidden ? 'checked' : ''}/></td>
            <td><input class="input" data-col="drillDown" value="${esc(c.drillDown || '')}"/></td>
            <td><input class="input" data-col="numberFormat" value="${esc(c.numberFormat || '')}"/></td>
            <td><button class="row-del" data-del="${i}">${icon('trash', 13)}</button></td>
          </tr>`).join('')}</tbody>
        </table></div></div></div>`;
      host.querySelectorAll('[data-col]').forEach(inp => inp.addEventListener('change', () => {
        const i = Number(inp.closest('tr').dataset.i);
        const k = inp.dataset.col;
        columns[i][k] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? Number(inp.value) : inp.value);
      }));
      host.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => { columns.splice(Number(btn.dataset.del), 1); drawContent(); }));
      host.querySelector('#add-col').addEventListener('click', () => {
        columns.push({ field: '', label: '', width: 140, hidden: false });
        drawContent();
      });
    };

    const renderPivotDesigner = (host) => {
      const pivot = adv('pivot');
      if (!Array.isArray(pivot.rows)) pivot.rows = [];
      if (!Array.isArray(pivot.cols)) pivot.cols = [];
      if (!Array.isArray(pivot.values)) pivot.values = [];
      const fields = [...new Set(columns.map(c => c.field).filter(Boolean))];
      const zone = (key, label) => `<div class="transfer-panel" style="min-height:120px">
        <div class="transfer-head"><span>${esc(t(label))}</span><span class="badge badge-gray">${pivot[key].length}</span></div>
        <div style="padding:8px;display:flex;flex-wrap:wrap;gap:5px">${pivot[key].map((f, i) => `<span class="filter-chip">${esc(f)}<button data-remove="${key}:${i}">${icon('close', 9)}</button></span>`).join('') || `<span class="small muted">${esc(t('无资料'))}</span>`}</div>
      </div>`;
      host.innerHTML = `<div class="grid-2" style="grid-template-columns:220px 1fr;gap:12px">
        <div class="field-list">${fields.length ? fields.map(f => `<div class="field-item" data-pf="${esc(f)}">${esc(f)}</div>`).join('') : `<div class="field-item muted">请先在步骤 6 定义栏位</div>`}</div>
        <div>
          <div class="row-gap mb-8">
            <select class="input" id="pivot-field" style="max-width:220px">${fields.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select>
            <button class="btn btn-sm btn-ghost" data-add-pivot="rows">→ 列</button>
            <button class="btn btn-sm btn-ghost" data-add-pivot="cols">→ 栏</button>
            <button class="btn btn-sm btn-ghost" data-add-pivot="values">→ 值</button>
          </div>
          <div class="grid-3">${zone('rows', '资料列')}${zone('cols', '资料栏')}${zone('values', '值')}</div>
        </div>
      </div>`;
      host.querySelectorAll('[data-add-pivot]').forEach(btn => btn.addEventListener('click', () => {
        const f = host.querySelector('#pivot-field').value;
        if (!f) return;
        const key = btn.dataset.addPivot;
        if (!pivot[key].includes(f)) pivot[key].push(f);
        drawContent();
      }));
      host.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
        const [key, i] = btn.dataset.remove.split(':');
        pivot[key].splice(Number(i), 1);
        drawContent();
      }));
    };

    const confirmData = () => ({
      REPORT_ID: draft.REPORT_ID, REPORT_NAME: draft.REPORT_NAME, REPORT_DESC: draft.REPORT_DESC,
      CONNECTION_STRING_NAME: draft.CONNECTION_STRING_NAME,
      ATLEAST_ONE_CONDITION: draft.ATLEAST_ONE_CONDITION,
      DATASOURCE_TYPE: draft.DATASOURCE_TYPE, QUERY_SQL: draft.QUERY_SQL,
      CONDITIONS: conditions, COLUMNS: columns, DISPLAY: display,
      ADVANCED: advanced
    });

    const drawFooter = () => {
      const foot = body.querySelector('#rpt-step-foot');
      foot.innerHTML = `<div class="small muted">${step + 1} / 18 · ${esc(t(STEPS[step]))}</div>
        <div class="wf-right">
          <button class="btn btn-ghost" id="rpt-prev" ${step === 0 ? 'disabled' : ''}>${esc(t('上一步'))}</button>
          <button class="btn btn-ghost" id="rpt-cancel">${esc(t('取消'))}</button>
          ${step === 17 ? `<button class="btn btn-primary" id="rpt-save">${esc(t('储存'))}</button>` : `<button class="btn btn-primary" id="rpt-next">${esc(t('下一步'))}</button>`}
        </div>`;
      foot.querySelector('#rpt-prev').addEventListener('click', () => { collectStep(); step -= 1; drawContent(); });
      foot.querySelector('#rpt-cancel').addEventListener('click', modal.close);
      const next = foot.querySelector('#rpt-next');
      if (next) next.addEventListener('click', () => {
        collectStep();
        if (step === 0 && (!draft.REPORT_ID || !draft.REPORT_NAME)) { toast('报表代码与名称为必填', 'warning'); return; }
        step += 1;
        drawContent();
      });
      const save = foot.querySelector('#rpt-save');
      if (save) save.addEventListener('click', async () => {
        collectStep();
        if (!draft.REPORT_ID || !draft.REPORT_NAME) { toast('报表代码与名称为必填', 'warning'); step = 0; drawContent(); return; }
        save.disabled = true;
        const payload = {
          ...draft,
          CONDITIONS_JSON: JSON.stringify(conditions),
          COLUMNS_JSON: JSON.stringify(columns),
          DISPLAY_JSON: JSON.stringify(display),
          ADVANCED_JSON: JSON.stringify(advanced)
        };
        if (isEdit) payload.REPORT_KEY = row.REPORT_KEY;
        delete payload.CONDITIONS;
        delete payload.COLUMNS;
        delete payload.DISPLAY;
        delete payload.ADVANCED;
        try {
          await ctx.api.post('/api/report-defs', payload);
          toast(t('储存成功')); modal.close(); selectedKey = payload.REPORT_KEY || null; load(true);
        } catch (err) { toast(err.message, 'error', 5000); save.disabled = false; }
      });
    };

    drawContent();
  };

  await load();
}

function parseJson(v, fallback) {
  try { return JSON.parse(v || 'null') == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
}
