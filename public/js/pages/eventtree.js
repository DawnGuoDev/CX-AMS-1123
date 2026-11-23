'use strict';

import {
  esc, icon, toast, openModal, confirmDialog, showLoading, hideLoading, emptyState,
  statusChip
} from '../ui.js';
import { t } from '../i18n.js';

const CHANNELS = [
  ['Email', '电子邮件'],
  ['Phone', '电话语音'],
  ['Voice', '语音电话'],
  ['Sms', '手机短信'],
  ['WeChat', '微信'],
  ['LINE', 'LINE'],
  ['IPPhoneExt', 'IPPhone(Ext)'],
  ['IPPhoneIM', 'IPPhone(IM)'],
  ['IM', 'IM（TeamPlus）']
];

export async function render(container, ctx) {
  let factoryKey = ctx.options.factory[0]?.value || '';
  let subsysKey = '';
  let tree = [];
  let groups = [];
  let channels = CHANNELS;
  let imGroupTypes = ctx.options.imGroupType || [];
  let selected = null;
  let collapsed = new Set();
  let dirty = false;

  const initialSubs = () => (ctx.options.subsystemByFactory[factoryKey] || [])[0]?.value || '';
  subsysKey = initialSubs();

  container.innerHTML = `
    <div class="card mb-16">
      <div class="query-bar">
        <div class="qf"><label>${esc(t('厂别'))}</label>
          <select class="input" id="et-factory">${ctx.options.factory.map(o => `<option value="${esc(o.value)}" ${o.value === factoryKey ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
        </div>
        <div class="qf"><label>${esc(t('子系统'))}</label>
          <select class="input" id="et-subsys">${(ctx.options.subsystemByFactory[factoryKey] || []).map(o => `<option value="${esc(o.value)}" ${o.value === subsysKey ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
        </div>
        <div class="qb-actions">
          <button class="btn btn-primary" id="et-query">${icon('search', 15)} ${esc(t('查询'))}</button>
        </div>
      </div>
    </div>
    <div class="event-page-grid">
      <div class="card">
        <div class="toolbar">
          <button class="tool-btn tool-add" id="et-save">${icon('check', 15)}<span>${esc(t('储存'))}</span></button>
          <span class="tool-sep"></span>
          <button class="tool-btn" id="et-expand">${icon('chevronDown', 15)}<span>${esc(t('展开'))}</span></button>
          <button class="tool-btn" id="et-collapse">${icon('chevronRight', 15)}<span>${esc(t('收合'))}</span></button>
          <button class="tool-btn" id="et-refresh">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
          <span class="tool-sep"></span>
          <button class="tool-btn" id="et-export">${icon('export', 15)}<span>${esc(t('汇出'))}</span></button>
          <button class="tool-btn" id="et-import">${icon('import', 15)}<span>${esc(t('汇入'))}</span></button>
          <div class="toolbar-right"><span class="inline-note" id="et-state"></span></div>
        </div>
        <div class="tree-scroll" id="et-tree"></div>
      </div>
      <div class="property-panel">
        <div class="property-head"><span>${esc(t('属性'))}</span><span class="small muted" id="et-selected-type"></span></div>
        <div class="property-body" id="et-property"></div>
      </div>
    </div>
    <input type="file" id="et-file" accept=".csv" hidden/>
  `;

  const factorySel = container.querySelector('#et-factory');
  const subsysSel = container.querySelector('#et-subsys');

  factorySel.addEventListener('change', () => {
    factoryKey = factorySel.value;
    const list = ctx.options.subsystemByFactory[factoryKey] || [];
    subsysSel.innerHTML = list.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
    subsysKey = list[0]?.value || '';
  });

  const load = async (silent = false) => {
    if (!factoryKey || !subsysKey) {
      tree = [];
      drawTree();
      return;
    }
    if (!silent) showLoading(t('读取中'));
    try {
      const res = await ctx.api.get(`/api/event-tree?factory=${encodeURIComponent(factoryKey)}&subsys=${encodeURIComponent(subsysKey)}`);
      tree = res.tree;
      groups = res.groups || [];
      channels = (res.channels || []).map(c => [c.value, c.label]).filter(([v]) => CHANNELS.some(([x]) => x === v));
      imGroupTypes = res.imGroupTypes || imGroupTypes;
      selected = null;
      dirty = false;
      drawTree();
      drawProperty();
      updateState();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) {
      toast(err.message, 'error');
    } finally { if (!silent) hideLoading(); }
  };

  const updateState = () => {
    const el = container.querySelector('#et-state');
    if (el) el.innerHTML = dirty ? `<span style="color:var(--orange)">${icon('warning', 12)} 有未储存的变更</span>` : `${icon('check', 12)} 已储存`;
  };

  const findGroup = (event, level, groupKey) => {
    const lv = event.LEVELS.find(l => l.EVENT_LEVEL_KEY === level.EVENT_LEVEL_KEY);
    return lv ? lv.GROUPS.find(g => g.EVENT_GROUP_KEY === groupKey || g.ELG_KEY === groupKey) : null;
  };

  const drawTree = () => {
    const host = container.querySelector('#et-tree');
    if (!tree.length) {
      host.innerHTML = `<div class="property-empty">${esc(t('请先选择厂别与子系统后查询'))}</div>`;
      return;
    }
    const renderLevel = (event, level) => {
      const lvCollapsed = collapsed.has(level.EVENT_LEVEL_KEY);
      const isSelected = selected && selected.type === 'level' && selected.level.EVENT_LEVEL_KEY === level.EVENT_LEVEL_KEY;
      return `<div class="tree-node" data-level="${esc(level.EVENT_LEVEL_KEY)}">
        <div class="tree-row ${isSelected ? 'selected' : ''}" data-type="level" data-event="${esc(event.EVENT_KEY)}" data-level="${esc(level.EVENT_LEVEL_KEY)}">
          <button class="tree-toggle" data-toggle="${esc(level.EVENT_LEVEL_KEY)}">${icon(lvCollapsed ? 'chevronRight' : 'chevronDown', 13)}</button>
          <span class="tree-icon level">${icon('tree', 13)}</span>
          <span class="tree-label">LEVEL-${esc(level.EVENT_LEVEL_ID)}　${esc(level.EVENT_LEVEL_DESC || '')}</span>
          <span class="tree-badge">${esc(level.NUMBER_OF_ACK_USERS)} ${esc(t('人'))} / ${esc(level.LEVEL_INTERVAL)} min</span>
        </div>
        ${lvCollapsed ? '' : `<div class="tree-children">
          ${level.GROUPS.length ? level.GROUPS.map(g => {
            const gSelected = selected && selected.type === 'group' && selected.elgKey === g.ELG_KEY;
            return `<div class="tree-row ${gSelected ? 'selected' : ''}" data-type="group" data-event="${esc(event.EVENT_KEY)}" data-level="${esc(level.EVENT_LEVEL_KEY)}" data-elg="${esc(g.ELG_KEY)}">
              <span class="tree-toggle placeholder"></span>
              <span class="tree-icon group">${icon('user', 13)}</span>
              <span class="tree-label">${esc(g.EVENT_GROUP_ID)}　${esc(g.EVENT_GROUP_NAME)}</span>
              <span class="tree-badge">${esc(channelText(g.ENABLE_SEND_DEVICES))}</span>
            </div>`;
          }).join('') : `<div class="tree-row dim"><span class="tree-toggle placeholder"></span><span class="tree-label" style="padding-left:2px">— ${esc(t('尚未设定群组对应'))}</span></div>`}
        </div>`}
      </div>`;
    };
    host.innerHTML = tree.map(event => {
      const evCollapsed = collapsed.has(event.EVENT_KEY);
      const isSelected = selected && selected.type === 'event' && selected.event.EVENT_KEY === event.EVENT_KEY;
      return `<div class="tree-node">
        <div class="tree-row ${isSelected ? 'selected' : ''}" data-type="event" data-event="${esc(event.EVENT_KEY)}">
          <button class="tree-toggle" data-toggle="${esc(event.EVENT_KEY)}">${icon(evCollapsed ? 'chevronRight' : 'chevronDown', 13)}</button>
          <span class="tree-icon">${icon('alarm', 13)}</span>
          <span class="tree-label"><b>${esc(event.EVENT_ID)}</b>　${esc(event.EVENT_NAME)}</span>
          <span class="tree-badge">P${esc(event.EVENT_PRIORITY_ID || 0)} · ${event.LEVELS.length} levels</span>
        </div>
        ${evCollapsed ? '' : `<div class="tree-children">${event.LEVELS.map(level => renderLevel(event, level)).join('')}</div>`}
      </div>`;
    }).join('');

    host.querySelectorAll('.tree-row[data-type]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-toggle]')) return;
        selectNode(row.dataset.type, row.dataset.event, row.dataset.level, row.dataset.elg);
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const type = row.dataset.type;
        if (type !== 'level' && type !== 'group') return;
        showContextMenu(e.clientX, e.clientY, type, row.dataset);
      });
    });
    host.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.toggle;
        if (collapsed.has(key)) collapsed.delete(key);
        else collapsed.add(key);
        drawTree();
      });
    });
  };

  const selectNode = (type, eventKey, levelKey, elgKey) => {
    const event = tree.find(e => e.EVENT_KEY === eventKey);
    if (!event) return;
    if (type === 'event') selected = { type, event };
    if (type === 'level') {
      const level = event.LEVELS.find(l => l.EVENT_LEVEL_KEY === levelKey);
      selected = { type, event, level };
    }
    if (type === 'group') {
      const level = event.LEVELS.find(l => l.EVENT_LEVEL_KEY === levelKey);
      const group = level && level.GROUPS.find(g => g.ELG_KEY === elgKey);
      selected = { type, event, level, group, elgKey };
    }
    drawTree();
    drawProperty();
  };

  const drawProperty = () => {
    const host = container.querySelector('#et-property');
    const typeEl = container.querySelector('#et-selected-type');
    if (!selected) {
      typeEl.textContent = '';
      host.innerHTML = `<div class="property-empty">${icon('tree', 26)}<div class="mt-8">${esc(t('点选左侧事件、层级或群组'))}</div><div class="small muted mt-8">${esc(t('右键层级可新增群组对应；右键群组可修改或移除。'))}</div></div>`;
      return;
    }
    if (selected.type === 'event') {
      const e = selected.event;
      typeEl.textContent = 'EVENT';
      host.innerHTML = `
        <div class="event-summary">
          <div class="es-item">${esc(t('厂别'))} <b>${esc(factoryLabel())}</b></div>
          <div class="es-item">${esc(t('子系统'))} <b>${esc(subsysLabel())}</b></div>
          <div class="es-item">${esc(t('优先权'))} <b>${esc(e.EVENT_PRIORITY_ID)}</b></div>
        </div>
        <div class="info-grid">
          ${infoCell('事件通知代码', e.EVENT_ID)}
          ${infoCell('事件通知名称', e.EVENT_NAME)}
          <div class="info-cell span-2"><div class="ic-label">${esc(t('事件通知说明'))}</div><div class="ic-value">${esc(e.EVENT_DESC || '–')}</div></div>
          ${infoCell('事件层级', `${e.LEVELS.length} levels`)}
          ${infoCell('群组对应', `${e.LEVELS.reduce((s, l) => s + l.GROUPS.length, 0)} mappings`)}
        </div>
        <div class="hint-bar mt-12">${icon('info', 14)}<div>事件层级与升级间隔在「事件通知设定」维护。此页负责将层级对应到通知群组与发送渠道。</div></div>
      `;
      return;
    }
    if (selected.type === 'level') {
      const { event, level } = selected;
      typeEl.textContent = `LEVEL-${level.EVENT_LEVEL_ID}`;
      host.innerHTML = `
        <div class="event-summary">
          <div class="es-item">${esc(t('事件'))} <b>${esc(event.EVENT_ID)}</b></div>
          <div class="es-item">${esc(t('需要回应的人数'))} <b>${esc(level.NUMBER_OF_ACK_USERS)}</b></div>
          <div class="es-item">${esc(t('升级层级时间间隔(分)'))} <b>${esc(level.LEVEL_INTERVAL)}</b></div>
        </div>
        <div class="info-grid">
          ${infoCell('事件层级代码', 'LEVEL-' + level.EVENT_LEVEL_ID)}
          ${infoCell('事件层级说明', level.EVENT_LEVEL_DESC)}
          ${infoCell('失败重送次数', level.FAIL_RETRY_TIMES)}
          ${infoCell('失败重送时间间隔(秒)', level.FAIL_RETRY_INTERVAL)}
        </div>
        <div class="prop-actions">
          <button class="btn btn-primary btn-sm" id="prop-add-group">${icon('plus', 13)} ${esc(t('新增群组对应'))}</button>
        </div>
      `;
      host.querySelector('#prop-add-group').addEventListener('click', () => openGroupDialog(event, level, null));
      return;
    }
    if (selected.type === 'group') {
      const { event, level, group } = selected;
      typeEl.textContent = 'GROUP';
      const deviceList = String(group.ENABLE_SEND_DEVICES || '').split(';').filter(Boolean);
      host.innerHTML = `
        <div class="event-summary">
          <div class="es-item">${esc(t('事件'))} <b>${esc(event.EVENT_ID)}</b></div>
          <div class="es-item">LEVEL <b>${esc(level.EVENT_LEVEL_ID)}</b></div>
          <div class="es-item">${esc(t('成员'))} <b>${esc(group.MEMBER_COUNT)}</b></div>
        </div>
        <div class="info-grid">
          ${infoCell('事件通知人员群组代码', group.EVENT_GROUP_ID)}
          ${infoCell('事件通知人员群组名称', group.EVENT_GROUP_NAME)}
          <div class="info-cell span-2"><div class="ic-label">${esc(t('发送渠道'))}</div><div class="ic-value">
            <div class="row-gap">${deviceList.length ? deviceList.map(d => `<span class="badge badge-blue">${esc(channelName(d))}</span>`).join('') : `<span class="muted">${esc(t('未设定'))}</span>`}</div>
          </div></div>
          ${group.E_IM_GROUP_TYPE ? infoCell('IM 群组类型', group.E_IM_GROUP_TYPE) : ''}
        </div>
        <div class="prop-actions">
          <button class="btn btn-primary btn-sm" id="prop-edit-group">${icon('edit', 13)} ${esc(t('修改'))}</button>
          <button class="btn btn-danger btn-sm" id="prop-remove-group">${icon('trash', 13)} ${esc(t('移除'))}</button>
        </div>
      `;
      host.querySelector('#prop-edit-group').addEventListener('click', () => openGroupDialog(event, level, group));
      host.querySelector('#prop-remove-group').addEventListener('click', async () => {
        const ok = await confirmDialog({ title: t('移除群组对应'), message: `确定要移除 LEVEL-${level.EVENT_LEVEL_ID} 的「${group.EVENT_GROUP_ID}」对应？`, okText: t('移除'), danger: true });
        if (!ok) return;
        level.GROUPS = level.GROUPS.filter(g => g.ELG_KEY !== group.ELG_KEY);
        dirty = true;
        selected = { type: 'level', event, level };
        drawTree(); drawProperty(); updateState();
      });
    }
  };

  const openGroupDialog = (event, level, group) => {
    const used = level.GROUPS.filter(g => !group || g.ELG_KEY !== group.ELG_KEY).map(g => g.EVENT_GROUP_KEY);
    const available = groups.filter(g => !used.includes(g.value));
    const selectedDevices = group ? String(group.ENABLE_SEND_DEVICES || '').split(';').filter(Boolean) : ['Email'];
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="form-field mb-16" style="grid-template-columns:120px 1fr">
        <div class="form-label">${esc(t('通知群组'))}</div>
        <div class="form-control">
          <select class="input" id="eg-group" ${group ? 'disabled' : ''}>
            <option value="">${esc(t('请选择'))}</option>
            ${(group ? groups : available).map(g => `<option value="${esc(g.value)}" ${group && g.value === group.EVENT_GROUP_KEY ? 'selected' : ''}>${esc(g.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-head">${icon('bell', 13)} ${esc(t('发送渠道'))}</div>
        <div class="form-section-body">
          <div class="channel-grid">
            ${CHANNELS.map(([key, label]) => `<label class="channel-row"><span class="cr-name">${esc(t(label))}</span><input type="checkbox" data-channel="${key}" ${selectedDevices.includes(key) ? 'checked' : ''}/></label>`).join('')}
          </div>
          <div class="form-field mt-12" style="grid-template-columns:120px 1fr">
            <div class="form-label">IM 群组类型</div>
            <div class="form-control">
              <select class="input" id="eg-im-type">
                <option value="">${esc(t('未设定'))}</option>
                ${imGroupTypes.map(o => `<option value="${esc(o.value)}" ${group && group.E_IM_GROUP_TYPE === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
      <div class="hint-bar mt-12">${icon('info', 14)}<div>发送渠道会与「事件通知设定」中的层级回应人数、升级间隔一起决定派发行为。至少需选择一个渠道。</div></div>
    `;
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost'; cancel.textContent = t('取消');
    const ok = document.createElement('button');
    ok.className = 'btn btn-primary'; ok.textContent = t('确认');
    footer.append(cancel, ok);
    const modal = openModal({ title: (group ? t('修改') : t('新增群组对应')) + ` · LEVEL-${level.EVENT_LEVEL_ID}`, width: 680, body, footer });
    cancel.addEventListener('click', modal.close);
    ok.addEventListener('click', () => {
      const groupKey = body.querySelector('#eg-group').value;
      if (!groupKey) { toast(t('请选择至少一个群组'), 'warning'); return; }
      const devices = [...body.querySelectorAll('[data-channel]:checked')].map(c => c.dataset.channel);
      if (!devices.length) { toast('请选择至少一个发送渠道', 'warning'); return; }
      const imType = body.querySelector('#eg-im-type').value;
      const groupInfo = groups.find(g => g.value === groupKey);
      const imGroupType = imType;
      if (group) {
        group.ENABLE_SEND_DEVICES = devices.join(';');
        group.E_IM_GROUP_TYPE = imGroupType;
      } else {
        level.GROUPS.push({
          ELG_KEY: 'local_' + Date.now(),
          EVENT_LEVEL_KEY: level.EVENT_LEVEL_KEY,
          EVENT_GROUP_KEY: groupKey,
          EVENT_GROUP_ID: groupInfo ? groupInfo.code : '',
          EVENT_GROUP_NAME: groupInfo ? groupInfo.name : '',
          ENABLE_SEND_DEVICES: devices.join(';'),
          E_IM_GROUP_TYPE: imGroupType,
          GROUP_SEQ: level.GROUPS.length + 1,
          MEMBER_COUNT: groupInfo ? (groupInfo.memberCount || 0) : 0
        });
      }
      dirty = true;
      modal.close();
      selected = { type: 'group', event, level, group: level.GROUPS.find(g => g.EVENT_GROUP_KEY === groupKey) };
      drawTree(); drawProperty(); updateState();
    });
  };

  let contextMenu = null;
  const closeContext = () => { if (contextMenu) { contextMenu.remove(); contextMenu = null; } };
  const showContextMenu = (x, y, type, dataset) => {
    closeContext();
    contextMenu = document.createElement('div');
    contextMenu.className = 'tree-context';
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    const event = tree.find(e => e.EVENT_KEY === dataset.event);
    const level = event && event.LEVELS.find(l => l.EVENT_LEVEL_KEY === dataset.level);
    if (type === 'level') {
      contextMenu.innerHTML = `<button id="ctx-add">${icon('plus', 13)} ${esc(t('新增群组对应'))}</button>`;
      document.body.appendChild(contextMenu);
      contextMenu.querySelector('#ctx-add').addEventListener('click', () => { closeContext(); openGroupDialog(event, level, null); });
    } else {
      const group = level && level.GROUPS.find(g => g.ELG_KEY === dataset.elg);
      contextMenu.innerHTML = `<button id="ctx-edit">${icon('edit', 13)} ${esc(t('修改'))}</button>
        <div class="sep"></div><button id="ctx-remove" class="danger">${icon('trash', 13)} ${esc(t('移除'))}</button>`;
      document.body.appendChild(contextMenu);
      contextMenu.querySelector('#ctx-edit').addEventListener('click', () => { closeContext(); openGroupDialog(event, level, group); });
      contextMenu.querySelector('#ctx-remove').addEventListener('click', async () => {
        closeContext();
        const ok = await confirmDialog({ title: t('移除群组对应'), message: '确定要移除此群组对应？', okText: t('移除'), danger: true });
        if (!ok) return;
        level.GROUPS = level.GROUPS.filter(g => g.ELG_KEY !== group.ELG_KEY);
        dirty = true;
        selected = { type: 'level', event, level };
        drawTree(); drawProperty(); updateState();
      });
    }
    setTimeout(() => document.addEventListener('click', closeContext, { once: true }), 0);
  };

  container.querySelector('#et-save').addEventListener('click', async () => {
    if (!dirty) { toast(t('没有需要储存的变更'), 'info'); return; }
    showLoading(t('储存'));
    try {
      const levels = tree.flatMap(e => e.LEVELS.map(l => ({
        levelKey: l.EVENT_LEVEL_KEY,
        groups: l.GROUPS.map(g => ({
          groupKey: g.EVENT_GROUP_KEY,
          devices: String(g.ENABLE_SEND_DEVICES || '').split(';').filter(Boolean),
          imType: g.E_IM_GROUP_TYPE || ''
        }))
      })));
      await ctx.api.post('/api/event-tree/save', { factoryKey, subsysKey, levels });
      toast(t('储存成功'));
      await load(true);
    } catch (err) { toast(err.message, 'error'); } finally { hideLoading(); }
  });
  container.querySelector('#et-refresh').addEventListener('click', () => { load(); toast(t('资料已更新'), 'info'); });
  container.querySelector('#et-expand').addEventListener('click', () => { collapsed.clear(); drawTree(); });
  container.querySelector('#et-collapse').addEventListener('click', () => {
    tree.forEach(e => { collapsed.add(e.EVENT_KEY); e.LEVELS.forEach(l => collapsed.add(l.EVENT_LEVEL_KEY)); });
    drawTree();
  });
  container.querySelector('#et-query').addEventListener('click', () => load());

  container.querySelector('#et-export').addEventListener('click', () => {
    if (!tree.length) { toast(t('无资料'), 'warning'); return; }
    const rows = [['EVENT_ID', 'EVENT_NAME', 'LEVEL', 'LEVEL_DESC', 'EVENT_GROUP_ID', 'EVENT_GROUP_NAME', 'ENABLE_SEND_DEVICES', 'E_IM_GROUP_TYPE', 'MEMBER_COUNT']];
    tree.forEach(e => e.LEVELS.forEach(l => {
      if (!l.GROUPS.length) rows.push([e.EVENT_ID, e.EVENT_NAME, l.EVENT_LEVEL_ID, l.EVENT_LEVEL_DESC, '', '', '', '', '']);
      l.GROUPS.forEach(g => rows.push([e.EVENT_ID, e.EVENT_NAME, l.EVENT_LEVEL_ID, l.EVENT_LEVEL_DESC, g.EVENT_GROUP_ID, g.EVENT_GROUP_NAME, g.ENABLE_SEND_DEVICES, g.E_IM_GROUP_TYPE, g.MEMBER_COUNT]));
    }));
    const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AVMA008_${factoryKey}_${subsysKey}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(t('已汇出'));
  });

  container.querySelector('#et-import').addEventListener('click', () => container.querySelector('#et-file').click());
  container.querySelector('#et-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = parseCsv(String(reader.result || '').replace(/^\ufeff/, ''));
      if (lines.length < 2) { toast('CSV 没有资料', 'warning'); return; }
      const header = lines[0].map(h => h.trim());
      const idx = (name) => header.indexOf(name);
      const iEvent = idx('EVENT_ID');
      const iLevel = idx('LEVEL');
      const iGroup = idx('EVENT_GROUP_ID');
      const iDev = idx('ENABLE_SEND_DEVICES');
      const iIm = idx('E_IM_GROUP_TYPE');
      if (iEvent < 0 || iLevel < 0 || iGroup < 0) { toast('CSV 栏位不正确', 'error'); return; }
      const imported = new Map();
      lines.slice(1).forEach(cols => {
        const event = tree.find(e => e.EVENT_ID === cols[iEvent]);
        if (!event) return;
        const level = event.LEVELS.find(l => String(l.EVENT_LEVEL_ID) === String(cols[iLevel]));
        if (!level) return;
        const key = level.EVENT_LEVEL_KEY;
        if (!imported.has(key)) imported.set(key, []);
        if (cols[iGroup]) {
          const gi = groups.find(g => g.code === cols[iGroup]);
          imported.get(key).push({
            ELG_KEY: 'local_' + Math.random().toString(36).slice(2),
            EVENT_LEVEL_KEY: key,
            EVENT_GROUP_KEY: gi ? gi.value : '',
            EVENT_GROUP_ID: cols[iGroup],
            EVENT_GROUP_NAME: gi ? gi.name : '',
            ENABLE_SEND_DEVICES: cols[iDev] || 'Email',
            E_IM_GROUP_TYPE: cols[iIm] || '',
            GROUP_SEQ: 0,
            MEMBER_COUNT: 0
          });
        }
      });
      imported.forEach((list, levelKey) => {
        tree.forEach(e => {
          const l = e.LEVELS.find(x => x.EVENT_LEVEL_KEY === levelKey);
          if (l) l.GROUPS = list.map((g, i) => ({ ...g, GROUP_SEQ: i + 1 }));
        });
      });
      dirty = true;
      drawTree(); drawProperty(); updateState();
      toast('汇入完成，请按「储存」套用');
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  });

  const factoryLabel = () => (ctx.options.factory.find(o => o.value === factoryKey) || {}).label || '';
  const subsysLabel = () => ((ctx.options.subsystemByFactory[factoryKey] || []).find(o => o.value === subsysKey) || {}).label || '';
  const channelText = (val) => String(val || '').split(';').filter(Boolean).map(channelName).join(' / ');
  const channelName = (key) => t((CHANNELS.find(c => c[0] === key) || [key, key])[1]);

  await load();
}

function infoCell(label, value) {
  return `<div class="info-cell"><div class="ic-label">${esc(t(label))}</div><div class="ic-value">${esc(value == null || value === '' ? '–' : value)}</div></div>`;
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quote = false;
      else cur += ch;
    } else if (ch === '"') quote = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
