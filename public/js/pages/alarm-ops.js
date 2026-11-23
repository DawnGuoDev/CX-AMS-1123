'use strict';

import {
  esc, icon, DataGrid, openModal, toast, confirmDialog, showLoading, hideLoading,
  multiSelectHtml, bindMultiSelect, statusChip, emptyState, channelLabel, toolbar
} from '../ui.js';
import { t, fmtDT } from '../i18n.js';
import { openAlarmDrawer, ackAction, terminateAction } from './alarm-detail.js';

function row(label, control, required = false, help = '') {
  return `<div class="form-field ${required ? 'is-required' : ''}">
    <div class="form-label">${esc(t(label))}${required ? '<span class="req">*</span>' : ''}</div>
    <div class="form-control">${control}${help ? `<div class="form-help">${esc(t(help))}</div>` : ''}</div>
  </div>`;
}

function selectHtml(id, options, value, placeholder = '请选择', disabled = false) {
  return `<select class="input" id="${id}" ${disabled ? 'disabled' : ''}>
    <option value="">${esc(t(placeholder))}</option>
    ${options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
  </select>`;
}

/* ================================================================ 手动发送 */
export async function renderManual(container, ctx) {
  let data;
  try {
    data = await ctx.api.get('/api/alarms/manual/options');
  } catch (err) {
    container.innerHTML = `<div class="card">${emptyState(err.message, 'warning')}</div>`;
    return;
  }
  const factoryOptions = data.factories;
  const subsysOptions = data.subsystems;
  const userOptions = data.users;
  const channelOptions = data.channels;
  container.innerHTML = `
    <div class="manual-layout">
      <div class="hint-bar mb-16">${icon('info', 15)}<div>手动发送<b>不经过事件层级</b>，不支援警报中断；警报有效时间预设为 30 分钟（依演示时钟换算）。发送方式可复选，若人员未设定对应联络资料，警报会建立但该渠道发送失败。</div></div>
      <div class="manual-card">
        <div class="manual-head">
          <h2>${icon('bell', 18)} ${esc(t('警报手动发送作业'))}</h2>
          <p>自行定义警报讯息与接收人员，直接透过所选渠道派发。</p>
        </div>
        <div class="manual-body">
          <div class="manual-form">
            ${row('厂别代码', selectHtml('manual-factory', factoryOptions, factoryOptions[0] && factoryOptions[0].value, '请选择'))}
            ${row('子系统代码', selectHtml('manual-subsys', subsysOptions, '', '请选择'), true)}
            ${row('使用者代码', multiSelectHtml('manual-users', userOptions, [], '可复选多位使用者'), true, '点选输入框展开人员清单，可搜索与复选。')}
            ${row('发送方式', multiSelectHtml('manual-channels', channelOptions, [], '可复选多种发送方式'), true)}
            ${row('警报标题', `<div class="input-group"><input class="input" id="manual-subject" placeholder="${esc(t('警报标题'))}"/><button class="btn btn-ghost btn-sm" id="manual-history" style="height:34px;flex:none">${icon('clock', 14)} ${esc(t('历史纪录'))}</button></div>`, false, '可由历史常用语句带出标题。')}
            ${row('警报详细内容', `<textarea class="input" id="manual-content" rows="9" placeholder="${esc(t('警报详细内容'))}"></textarea>`, false, '内容为空时将以 Empty Content 发送。')}
          </div>
          <div class="manual-actions">
            <button class="btn btn-primary btn-lg" id="manual-send">${icon('play', 15)} ${esc(t('发送'))}</button>
            <button class="btn btn-danger btn-lg" id="manual-clear">${icon('x', 15)} ${esc(t('清除'))}</button>
          </div>
        </div>
      </div>
    </div>
  `;
  const usersMs = bindMultiSelect(container.querySelector('.multi-select[data-name="manual-users"]'));
  const channelsMs = bindMultiSelect(container.querySelector('.multi-select[data-name="manual-channels"]'));
  const subjectInput = container.querySelector('#manual-subject');
  const contentInput = container.querySelector('#manual-content');

  container.querySelector('#manual-history').addEventListener('click', async () => {
    try {
      const res = await ctx.api.get('/api/alarm-subjects');
      const body = document.createElement('div');
      body.innerHTML = `<div class="history-list">${res.rows.length ? res.rows.map(s => `<div class="history-subject" data-subject="${esc(s.SUBJECT)}"><span>${esc(s.SUBJECT)}</span><span class="hs-time">${esc(fmtDT(s.LAST_USED_DT))}</span></div>`).join('') : `<div class="empty-state">${esc(t('无资料'))}</div>`}</div>`;
      const modal = openModal({ title: t('历史常用语句'), width: 620, body });
      body.querySelectorAll('[data-subject]').forEach(el => {
        el.addEventListener('click', () => { subjectInput.value = el.dataset.subject; modal.close(); });
      });
    } catch (err) { toast(err.message, 'error'); }
  });

  container.querySelector('#manual-clear').addEventListener('click', () => {
    container.querySelector('#manual-subsys').value = '';
    usersMs.values = [];
    channelsMs.values = [];
    subjectInput.value = '';
    contentInput.value = '';
  });

  container.querySelector('#manual-send').addEventListener('click', async () => {
    const factoryKey = container.querySelector('#manual-factory').value;
    const subsysKey = container.querySelector('#manual-subsys').value;
    const userKeys = usersMs.values;
    const channels = channelsMs.values;
    if (!factoryKey) { toast('请选择厂别', 'warning'); return; }
    if (!subsysKey) { toast('请选择子系统', 'warning'); return; }
    if (!userKeys.length) { toast(t('请选择至少一位接收人员'), 'warning'); return; }
    if (!channels.length) { toast(t('请选择至少一种发送方式'), 'warning'); return; }
    showLoading(t('发送'));
    try {
      const res = await ctx.api.post('/api/alarms/manual', {
        factoryKey, subsysKey, userKeys, channels,
        title: subjectInput.value.trim(), content: contentInput.value.trim()
      });
      hideLoading();
      showSendResult(ctx, res, { manual: true });
    } catch (err) {
      hideLoading();
      toast(err.message, 'error', 5000);
    }
  });
}

/* ================================================================ 补登 */
export async function renderBackfill(container, ctx) {
  let options;
  try {
    options = await ctx.api.get('/api/alarms/backfill/options');
  } catch (err) {
    container.innerHTML = `<div class="card">${emptyState(err.message, 'warning')}</div>`;
    return;
  }
  container.innerHTML = `
    <div class="manual-layout">
      <div class="hint-bar mb-16">${icon('info', 15)}<div>补登会依「厂别 + 子系统 + 机台 + 警报代码」匹配警报通知设定，再按事件层级逐级通知。若同一群组内其他机台有相同警报设定，将自动<b>群组回退匹配</b>。常用于测试警报设定是否正常。</div></div>
      <div class="manual-card">
        <div class="manual-head">
          <h2>${icon('edit', 18)} ${esc(t('警报补登作业'))}</h2>
          <p>事后补录机台警报，系统自动寻找对应的通知事件与层级。</p>
        </div>
        <div class="manual-body">
          <div class="manual-form">
            ${row('厂别代码', selectHtml('bf-factory', options.factories, options.factories[0] && options.factories[0].value, '请选择'), true)}
            ${row('子系统代码', selectHtml('bf-subsys', options.subsystems, '', '请选择'), true)}
            ${row('机台代码', selectHtml('bf-eqp', options.eqps, '', '请选择'), true)}
            ${row('警报代码', `<select class="input" id="bf-alarm"><option value="">${esc(t('请选择'))}</option></select>`, true, '「群组回退」表示该机台本身没有设定，将由同群组其他机台的警报设定回退匹配。')}
            ${row('警报标题', `<div class="input-group"><input class="input" id="bf-subject" placeholder="${esc(t('警报标题'))}"/><button class="btn btn-ghost btn-sm" id="bf-history" style="height:34px;flex:none">${icon('clock', 14)} ${esc(t('历史纪录'))}</button></div>`, false, '空值发送时替换为 Empty Subject。')}
            ${row('警报详细内容', `<textarea class="input" id="bf-content" rows="8" placeholder="${esc(t('警报详细内容'))}"></textarea>`, false, '空值发送时替换为 Empty Content。')}
          </div>
          <div class="manual-actions">
            <button class="btn btn-primary btn-lg" id="bf-send">${icon('play', 15)} ${esc(t('发送'))}</button>
            <button class="btn btn-danger btn-lg" id="bf-clear">${icon('x', 15)} ${esc(t('清除'))}</button>
          </div>
        </div>
      </div>
    </div>
  `;
  const factorySel = container.querySelector('#bf-factory');
  const subsysSel = container.querySelector('#bf-subsys');
  const eqpSel = container.querySelector('#bf-eqp');
  const alarmSel = container.querySelector('#bf-alarm');
  const subjectInput = container.querySelector('#bf-subject');
  const contentInput = container.querySelector('#bf-content');

  const loadCodes = async () => {
    const factoryKey = factorySel.value;
    const subsysKey = subsysSel.value;
    const eqpKey = eqpSel.value;
    if (!factoryKey || !subsysKey) { alarmSel.innerHTML = `<option value="">${esc(t('请选择'))}</option>`; return; }
    try {
      const res = await ctx.api.get(`/api/alarms/backfill/options?factoryKey=${encodeURIComponent(factoryKey)}&subsysKey=${encodeURIComponent(subsysKey)}&eqpKey=${encodeURIComponent(eqpKey)}`);
      alarmSel.innerHTML = `<option value="">${esc(t('请选择'))}</option>` + res.alarmCodes.map(c => `<option value="${esc(c.value)}">${esc(c.label)}${c.match === 'fallback' ? '（群组回退）' : ''}</option>`).join('');
    } catch (err) { toast(err.message, 'error'); }
  };

  const loadSubsys = async () => {
    const res = await ctx.api.get(`/api/alarms/backfill/options?factoryKey=${encodeURIComponent(factorySel.value)}`);
    subsysSel.innerHTML = `<option value="">${esc(t('请选择'))}</option>` + res.subsystems.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
    alarmSel.innerHTML = `<option value="">${esc(t('请选择'))}</option>`;
  };

  factorySel.addEventListener('change', loadSubsys);
  subsysSel.addEventListener('change', loadCodes);
  eqpSel.addEventListener('change', loadCodes);
  if (factorySel.value) await loadSubsys();

  container.querySelector('#bf-history').addEventListener('click', async () => {
    try {
      const res = await ctx.api.get('/api/alarm-subjects');
      const body = document.createElement('div');
      body.innerHTML = `<div class="history-list">${res.rows.map(s => `<div class="history-subject" data-subject="${esc(s.SUBJECT)}"><span>${esc(s.SUBJECT)}</span><span class="hs-time">${esc(fmtDT(s.LAST_USED_DT))}</span></div>`).join('')}</div>`;
      const modal = openModal({ title: t('历史常用语句'), width: 620, body });
      body.querySelectorAll('[data-subject]').forEach(el => {
        el.addEventListener('click', () => { subjectInput.value = el.dataset.subject; modal.close(); });
      });
    } catch (err) { toast(err.message, 'error'); }
  });

  container.querySelector('#bf-clear').addEventListener('click', () => {
    subsysSel.value = ''; eqpSel.value = ''; alarmSel.innerHTML = `<option value="">${esc(t('请选择'))}</option>`;
    subjectInput.value = ''; contentInput.value = '';
  });

  container.querySelector('#bf-send').addEventListener('click', async () => {
    if (!factorySel.value) { toast('请选择厂别', 'warning'); return; }
    if (!subsysSel.value) { toast('请选择子系统', 'warning'); return; }
    if (!eqpSel.value) { toast('请选择机台', 'warning'); return; }
    if (!alarmSel.value) { toast('请选择警报代码', 'warning'); return; }
    showLoading(t('发送'));
    try {
      const res = await ctx.api.post('/api/alarms/backfill', {
        factoryKey: factorySel.value, subsysKey: subsysSel.value, eqpKey: eqpSel.value,
        alarmCode: alarmSel.value, title: subjectInput.value.trim(), content: contentInput.value.trim()
      });
      hideLoading();
      showSendResult(ctx, res, { manual: false });
    } catch (err) {
      hideLoading();
      showSendResult(ctx, { ok: false, message: err.message, ...(err.data || {}) }, { manual: false });
    }
  });
}

function showSendResult(ctx, res, { manual }) {
  const body = document.createElement('div');
  if (!res.ok) {
    body.innerHTML = `<div class="hint-bar warn mb-12">${icon('warning', 15)}<div>警报未成功触发，已写入<b>无效警报</b>。</div></div>
      <div class="info-grid">
        <div class="info-cell"><div class="ic-label">${esc(t('失效类型'))}</div><div class="ic-value"><span class="badge badge-red">${esc(res.invalidType || '–')}</span></div></div>
        <div class="info-cell"><div class="ic-label">${esc(t('说明'))}</div><div class="ic-value">${esc(res.message || '')}</div></div>
      </div>`;
  } else {
    const a = res.alarm || {};
    body.innerHTML = `
      <div class="alarm-hero">
        <div>
          <div class="alarm-hero-title">${esc(a.TITLE || '')}</div>
          <div class="alarm-hero-meta">
            <span class="mono">${esc(a.ALARM_ID || '')}</span>
            <span>${esc(a.FACTORY_ID || '')} / ${esc(a.SUB_SYS_ID || '')} / ${esc(a.EQP_ID || '')}</span>
          </div>
        </div>
        ${statusChip(a.STATUS || 'Process')}
      </div>
      ${res.logOnly ? `<div class="hint-bar warn mb-12">${icon('warning', 15)}<div>子系统设定 BYPASS=Y，此次警报<b>仅记录不发送</b>。</div></div>` : ''}
      ${res.matchedBy === 'group-fallback' ? `<div class="hint-bar mb-12">${icon('info', 15)}<div>此警报为<b>机台群组回退匹配</b>：机台本身无设定，已套用同群组其他机台的警报通知设定。</div></div>` : ''}
      <div class="info-grid">
        <div class="info-cell"><div class="ic-label">${esc(t('目前事件层级'))}</div><div class="ic-value">LEVEL-${esc(a.CURRENT_LEVEL || 1)} ${esc(a.LEVEL_DESC || '')}</div></div>
        <div class="info-cell"><div class="ic-label">${esc(t('需要回应的人数'))}</div><div class="ic-value">${esc(a.LEVEL_REQUIRED == null ? '–' : a.LEVEL_REQUIRED)}</div></div>
        <div class="info-cell"><div class="ic-label">${esc(t('通知纪录'))}</div><div class="ic-value">${esc(a.NOTIFY_COUNT || 0)} ${esc(t('笔'))}</div></div>
        <div class="info-cell"><div class="ic-label">${esc(t('通知方式'))}</div><div class="ic-value">Email / SMS / IM 依事件层级设定</div></div>
      </div>
      <div class="hint-bar mt-12">${icon('bell', 15)}<div>${esc(t('通知已派发'))}。可在右上角<b>${esc(t('通知收件箱'))}</b>查看模拟通知，或打开确认页完成回应。</div></div>
    `;
  }
  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  if (res.ok && res.alarm) {
    const open = document.createElement('button');
    open.className = 'btn btn-primary';
    open.textContent = t('开启确认页');
    open.addEventListener('click', () => {
      modal.close();
      ctx.navigate('#/confirm/' + encodeURIComponent(res.alarm.ALARM_KEY));
    });
    const detail = document.createElement('button');
    detail.className = 'btn btn-ghost';
    detail.textContent = t('详情');
    detail.addEventListener('click', () => {
      modal.close();
      openAlarmDrawer(ctx, res.alarm.ALARM_KEY);
    });
    footer.append(detail, open);
  } else {
    const go = document.createElement('button');
    go.className = 'btn btn-ghost';
    go.textContent = t('前往确认') + ' / ' + t('无效警报查询');
    go.addEventListener('click', () => { modal.close(); ctx.navigate('#/page/AVPA005'); });
    footer.append(go);
  }
  const modal = openModal({
    title: res.ok ? t('警报发送成功') : t('操作失败'),
    width: 620, body, footer, className: 'modal-sm'
  });
}

/* ================================================================ 确认回报 */
export async function renderAck(container, ctx) {
  let rows = [];
  let grid = null;
  let note = '';
  const load = async () => {
    showLoading(t('读取中'));
    try {
      const res = await ctx.api.get('/api/alarms/pending');
      rows = res.rows;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { hideLoading(); }
  };
  const draw = () => {
    container.innerHTML = `
      <div class="hint-bar mb-16">${icon('info', 15)}<div>仅显示<b>通知给您</b>且目前层级尚未确认的处理中警报。回应人数达标后，警报状态将自动改为 Completed；逾时未达标则升级至下一层级。</div></div>
      <div class="card">
        <div class="toolbar">
          <button class="tool-btn" id="ack-refresh">${icon('refresh', 15)}<span>${esc(t('更新'))}</span></button>
          <div class="toolbar-right"><span class="inline-note">${icon('bell', 13)} ${rows.length} ${esc(t('待确认警报'))}</span></div>
        </div>
        <div id="ack-grid"></div>
        <div class="toolbar" style="border-top:1px solid var(--line-2);border-bottom:0;padding:10px 14px">
          <input class="input" id="ack-note" style="max-width:400px" placeholder="${esc(t('回应备注'))}" value="${esc(note)}"/>
          <button class="btn btn-primary" id="ack-submit" style="margin-left:12px">${icon('check', 15)} ${esc(t('确认'))}</button>
          <span class="small muted" style="margin-left:10px">${esc(t('可复选多笔，回应备注可留空'))}</span>
        </div>
      </div>
    `;
    grid = new DataGrid(container.querySelector('#ack-grid'), {
      rows, rowKey: 'ALARM_KEY', selectable: 'multi', pageSize: 20,
      columns: [
        { field: 'ALARM_ID', label: '警报识别码', width: 158 },
        { field: 'TITLE', label: '警报标题', width: 230, render: r => `<span title="${esc(r.TITLE)}">${esc(r.TITLE)}</span>` },
        { field: 'FACTORY_ID', label: '厂别', width: 85 },
        { field: 'SUB_SYS_ID', label: '子系统', width: 80 },
        { field: 'EQP_ID', label: '机台', width: 90 },
        { field: 'CURRENT_LEVEL', label: '层级', width: 65, render: r => `LEVEL-${esc(r.CURRENT_LEVEL)}` },
        { field: 'LEVEL_ACK_COUNT', label: '回应人数', width: 95, render: r => `${r.LEVEL_ACK_COUNT} / ${r.LEVEL_REQUIRED == null ? '–' : r.LEVEL_REQUIRED}` },
        { field: 'STATUS', label: '状态', type: 'status', width: 95 },
        { field: 'LEVEL_START', label: '本层开始时间', type: 'datetime', width: 155 },
        { field: 'PRIORITY', label: '优先权', type: 'priority', width: 70 },
        {
          field: '_ops', label: '操作', width: 68, sortable: false, filterable: false,
          render: r => `<button class="btn btn-sm btn-ghost no-row-click" data-detail="${esc(r.ALARM_KEY)}">${esc(t('详情'))}</button>`
        }
      ]
    });
    container.querySelectorAll('[data-detail]').forEach(btn => {
      btn.addEventListener('click', () => openAlarmDrawer(ctx, btn.dataset.detail, load));
    });
    container.querySelector('#ack-note').addEventListener('input', (e) => { note = e.target.value; });
    container.querySelector('#ack-refresh').addEventListener('click', () => { load(); toast(t('资料已更新'), 'info'); });
    container.querySelector('#ack-submit').addEventListener('click', async () => {
      const keys = grid.getSelected();
      if (!keys.length) { toast(t('请选择至少一笔资料'), 'warning'); return; }
      const ok = await confirmDialog({ title: t('警报确认'), message: `确定要确认所选 ${keys.length} 笔警报？`, okText: t('确认') });
      if (!ok) return;
      showLoading(t('处理中'));
      let done = 0;
      let failed = 0;
      let completed = 0;
      for (const key of keys) {
        try {
          const res = await ctx.api.post(`/api/alarms/${encodeURIComponent(key)}/ack`, { cmt: note });
          done += 1;
          if (res.completed) completed += 1;
        } catch (e) { failed += 1; }
      }
      hideLoading();
      if (done) toast(`${t('警报已确认')} ${done} ${t('笔')}${completed ? `，${completed} ${t('笔')}${t('完成')}` : ''}`, 'success');
      if (failed) toast(`${failed} ${t('笔')}${t('操作失败')}`, 'error');
      note = '';
      load().then(() => updateInbox());
    });
  };
  await load();
}

/* ================================================================ 强制中断 */
export async function renderTerminate(container, ctx) {
  let rows = [];
  let grid = null;
  let note = '';
  const load = async () => {
    showLoading(t('读取中'));
    try {
      const res = await ctx.api.get('/api/alarms/process');
      rows = res.rows;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { hideLoading(); }
  };
  const draw = () => {
    container.innerHTML = `
      <div class="hint-bar warn mb-16">${icon('warning', 15)}<div>强制中断<b>不需要达到回应人数</b>，适用于误报或事件已处理完毕但尚有人员未确认。手动发送的警报不支援中断。中断前请确认勾选的警报正确。</div></div>
      <div class="card">
        <div class="toolbar">
          <button class="tool-btn" id="term-refresh">${icon('refresh', 15)}<span>${esc(t('查询'))}</span></button>
          <div class="toolbar-right"><span class="inline-note">${icon('alarm', 13)} ${rows.length} ${esc(t('处理中警报'))}</span></div>
        </div>
        <div id="term-grid"></div>
        <div class="toolbar" style="border-top:1px solid var(--line-2);border-bottom:0;padding:10px 14px">
          <input class="input" id="term-note" style="max-width:400px" placeholder="${esc(t('备注'))}" value="${esc(note)}"/>
          <button class="btn btn-danger" id="term-submit" style="margin-left:12px">${icon('x', 15)} ${esc(t('确认'))}</button>
        </div>
      </div>
    `;
    grid = new DataGrid(container.querySelector('#term-grid'), {
      rows, rowKey: 'ALARM_KEY', selectable: 'multi', pageSize: 20,
      columns: [
        { field: 'ALARM_ID', label: '警报识别码', width: 158 },
        { field: 'CREATE_DT', label: '产生警报时间', type: 'datetime', width: 155 },
        { field: 'TITLE', label: '警报标题', width: 230, render: r => `<span title="${esc(r.TITLE)}">${esc(r.TITLE)}</span>` },
        { field: 'FACTORY_ID', label: '厂别', width: 80 },
        { field: 'SUB_SYS_ID', label: '子系统', width: 80 },
        { field: 'EQP_ID', label: '机台', width: 90 },
        { field: 'CURRENT_LEVEL', label: '层级', width: 65, render: r => `LEVEL-${esc(r.CURRENT_LEVEL)}` },
        { field: 'STATUS', label: '状态', type: 'status', width: 95 },
        { field: 'LEVEL_START', label: '每次处理启始', type: 'datetime', width: 155 },
        {
          field: '_ops', label: '操作', width: 68, sortable: false, filterable: false,
          render: r => `<button class="btn btn-sm btn-ghost no-row-click" data-detail="${esc(r.ALARM_KEY)}">${esc(t('详情'))}</button>`
        }
      ]
    });
    container.querySelectorAll('[data-detail]').forEach(btn => {
      btn.addEventListener('click', () => openAlarmDrawer(ctx, btn.dataset.detail, load));
    });
    container.querySelector('#term-note').addEventListener('input', (e) => { note = e.target.value; });
    container.querySelector('#term-refresh').addEventListener('click', () => { load(); toast(t('资料已更新'), 'info'); });
    container.querySelector('#term-submit').addEventListener('click', async () => {
      const keys = grid.getSelected();
      if (!keys.length) { toast(t('请选择至少一笔资料'), 'warning'); return; }
      const ok = await confirmDialog({ title: t('警报中断'), message: `确定要中断所选 ${keys.length} 笔警报？${t('中断后警报将无法再确认')}`, okText: t('警报中断'), danger: true });
      if (!ok) return;
      showLoading(t('处理中'));
      let done = 0;
      let failed = 0;
      for (const key of keys) {
        try {
          await ctx.api.post(`/api/alarms/${encodeURIComponent(key)}/terminate`, { cmt: note });
          done += 1;
        } catch (e) { failed += 1; }
      }
      hideLoading();
      if (done) toast(`${t('警报已中断')} ${done} ${t('笔')}`, 'success');
      if (failed) toast(`${failed} ${t('笔')}${t('操作失败')}`, 'error');
      note = '';
      load();
    });
  };
  await load();
}

function updateInbox() {
  window.dispatchEvent(new CustomEvent('ams:inbox-refresh'));
}

/* ================================================================ 确认页 */
export async function renderConfirm(container, ctx) {
  let data;
  let timer = null;
  const load = async () => {
    try {
      const res = await ctx.api.get('/api/alarms/' + encodeURIComponent(ctx.route.alarmId));
      data = res.alarm;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) {
      container.innerHTML = `<div class="card">${emptyState(err.message, 'warning')}</div>`;
    }
  };
  const draw = () => {
    const a = data;
    container.innerHTML = `
      <div class="manual-layout" style="max-width:820px">
        <div class="alarm-hero" style="padding:18px;margin-bottom:16px">
          <div>
            <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:5px">Alarm Confirmation</div>
            <div class="alarm-hero-title" style="font-size:18px">${esc(a.TITLE)}</div>
            <div class="alarm-hero-meta">
              <span class="mono">${esc(a.ALARM_ID)}</span>
              <span>${esc(a.FACTORY_ID)} ${esc(a.FACTORY_NAME)}</span>
              <span>${esc(a.SUB_SYS_ID)} / ${esc(a.EQP_ID)}</span>
            </div>
          </div>
          <div style="text-align:right">${statusChip(a.STATUS)}<div id="confirm-countdown" class="alarm-countdown" style="margin-top:7px">–</div></div>
        </div>
        ${!a.CAN_ACK && a.STATUS === 'Process' ? `<div class="hint-bar warn mb-16">${icon('warning', 15)}<div>您已确认过此警报，或不是目前层级被通知的人员，无法再次确认。</div></div>` : ''}
        ${a.STATUS !== 'Process' ? `<div class="hint-bar mb-16">${icon('info', 15)}<div>此警报目前状态为 <b>${esc(a.STATUS)}</b>，已完成处理。</div></div>` : ''}
        <div class="manual-card">
          <div class="tabs" id="confirm-tabs">
            <button class="tab active" data-ctab="info">${esc(t('警报资讯'))}</button>
            <button class="tab" data-ctab="content">${esc(t('警报详细内容'))}</button>
            <button class="tab" data-ctab="note">${esc(t('回应备注'))}</button>
          </div>
          <div style="padding:18px" id="confirm-tab-content"></div>
          <div style="padding:0 18px 18px;display:flex;gap:10px;justify-content:flex-end">
            <button class="btn btn-primary" id="confirm-ack" ${a.CAN_ACK ? '' : 'disabled'}>${icon('check', 15)} ${esc(t('警报确认'))}</button>
            ${a.CAN_TERMINATE ? `<button class="btn btn-danger" id="confirm-term">${icon('x', 15)} ${esc(t('警报中断'))}</button>` : ''}
          </div>
        </div>
        <div class="mt-16" style="text-align:center"><a href="#/page/AVPA003" class="small">${esc(t('返回'))} · ${esc(t('警报确认回报作业'))}</a></div>
      </div>
    `;
    const content = container.querySelector('#confirm-tab-content');
    const renderTab = (tab) => {
      if (tab === 'info') {
        content.innerHTML = `<div class="info-grid">
          <div class="info-cell"><div class="ic-label">${esc(t('警报识别码'))}</div><div class="ic-value mono">${esc(a.ALARM_ID)}</div></div>
          <div class="info-cell"><div class="ic-label">${esc(t('厂别'))}</div><div class="ic-value">${esc(a.FACTORY_ID)} ${esc(a.FACTORY_NAME)}</div></div>
          <div class="info-cell"><div class="ic-label">${esc(t('子系统'))}</div><div class="ic-value">${esc(a.SUB_SYS_ID)} ${esc(a.SUB_SYS_NAME)}</div></div>
          <div class="info-cell"><div class="ic-label">${esc(t('机台'))}</div><div class="ic-value">${esc(a.EQP_ID)} ${esc(a.EQP_NAME || '')}</div></div>
          <div class="info-cell"><div class="ic-label">${esc(t('警报代码'))}</div><div class="ic-value">${esc(a.ALARM_INFO_ID || '–')}</div></div>
          <div class="info-cell"><div class="ic-label">${esc(t('事件通知'))}</div><div class="ic-value">${esc(a.EVENT_ID || t('手动发送'))}</div></div>
          <div class="info-cell"><div class="ic-label">${esc(t('目前事件层级'))}</div><div class="ic-value">LEVEL-${esc(a.CURRENT_LEVEL)} ${esc(a.LEVEL_DESC || '')}</div></div>
          <div class="info-cell"><div class="ic-label">${esc(t('产生警报时间'))}</div><div class="ic-value">${esc(fmtDT(a.CREATE_DT))}</div></div>
          <div class="info-cell"><div class="ic-label">${esc(t('优先权代码'))}</div><div class="ic-value">${esc(a.PRIORITY)}</div></div>
          <div class="info-cell"><div class="ic-label">${esc(t('确认人数'))}</div><div class="ic-value">${esc(a.LEVEL_ACK_COUNT)} / ${esc(a.LEVEL_REQUIRED == null ? '–' : a.LEVEL_REQUIRED)}</div></div>
        </div>`;
      } else if (tab === 'content') {
        content.innerHTML = `<div class="content-box">${esc(a.CONTENT || '–')}</div>`;
      } else {
        content.innerHTML = `<textarea class="input" id="confirm-note" rows="4" placeholder="${esc(t('回应备注'))}"></textarea>`;
      }
    };
    renderTab('info');
    container.querySelectorAll('#confirm-tabs .tab').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#confirm-tabs .tab').forEach(b => b.classList.toggle('active', b === btn));
        renderTab(btn.dataset.ctab);
      });
    });
    const ackBtn = container.querySelector('#confirm-ack');
    if (ackBtn) {
      ackBtn.addEventListener('click', () => {
        const cmt = container.querySelector('#confirm-note')?.value || '';
        ackAction(ctx, a, () => load(), cmt);
      });
    }
    const termBtn = container.querySelector('#confirm-term');
    if (termBtn) termBtn.addEventListener('click', () => terminateAction(ctx, a, () => load()));
    clearInterval(timer);
    const cd = container.querySelector('#confirm-countdown');
    const tick = () => {
      if (!cd) return;
      if (a.STATUS !== 'Process') { cd.style.display = 'none'; return; }
      const start = new Date(a.LEVEL_START || a.LEVEL_PROCESS_DT).getTime();
      const interval = Number(a.LEVEL_INTERVAL_SEC || 0) * 1000;
      const left = Math.max(0, Math.round((start + interval - Date.now()) / 1000));
      cd.textContent = `${t('升级倒数')} ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    };
    tick();
    timer = setInterval(tick, 1000);
    ctx.registerCleanup(() => clearInterval(timer));
  };
  await load();
}
