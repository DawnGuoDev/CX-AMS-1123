'use strict';

import {
  esc, icon, DataGrid, toast, confirmDialog, showLoading, hideLoading, statusChip, emptyState
} from '../ui.js';
import { t } from '../i18n.js';

export async function render(container, ctx) {
  const state = {
    active: 'Y', alarmCode: '', groupKey: '', factoryKey: '', eqpKey: '', subsysKey: ''
  };
  const enabled = { active: true, alarmCode: false, groupKey: false, factoryKey: false, eqpKey: false, subsysKey: false };
  let rows = [];
  let grid = null;

  const factoryOptions = ctx.options.factory;
  const subsystemOptions = ctx.options.subsystem;
  const groupOptions = ctx.options.eqpGroup;
  const eqpOptions = ctx.options.eqp;

  const draw = () => {
    container.innerHTML = `
      <div class="card mb-16">
        <div class="filter-panel">
          <div class="filter-grid">
            <div class="filter-cell">
              <input type="checkbox" data-enable="active" checked disabled/>
              <label>${esc(t('启用状态'))}</label>
              <select class="input" id="bh-active" ${enabled.active ? '' : 'disabled'}>
                <option value="Y" ${state.active === 'Y' ? 'selected' : ''}>Y（启用）</option>
                <option value="N" ${state.active === 'N' ? 'selected' : ''}>N（停用）</option>
              </select>
            </div>
            <div class="filter-cell">
              <input type="checkbox" data-enable="alarmCode" ${enabled.alarmCode ? 'checked' : ''}/>
              <label>${esc(t('警报代码'))}</label>
              <input class="input" id="bh-alarm" value="${esc(state.alarmCode)}" ${enabled.alarmCode ? '' : 'disabled'}/>
            </div>
            <div class="filter-cell">
              <input type="checkbox" data-enable="groupKey" ${enabled.groupKey ? 'checked' : ''}/>
              <label>${esc(t('机台群组'))}</label>
              <select class="input" id="bh-group" ${enabled.groupKey ? '' : 'disabled'}>
                <option value="">${esc(t('全部'))}</option>
                ${groupOptions.map(o => `<option value="${esc(o.value)}" ${state.groupKey === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
              </select>
            </div>
            <div class="filter-cell">
              <input type="checkbox" data-enable="factoryKey" ${enabled.factoryKey ? 'checked' : ''}/>
              <label>${esc(t('厂别'))}</label>
              <select class="input" id="bh-factory" ${enabled.factoryKey ? '' : 'disabled'}>
                <option value="">${esc(t('全部'))}</option>
                ${factoryOptions.map(o => `<option value="${esc(o.value)}" ${state.factoryKey === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
              </select>
            </div>
            <div class="filter-cell">
              <input type="checkbox" data-enable="eqpKey" ${enabled.eqpKey ? 'checked' : ''}/>
              <label>${esc(t('机台代码'))}</label>
              <select class="input" id="bh-eqp" ${enabled.eqpKey ? '' : 'disabled'}>
                <option value="">${esc(t('全部'))}</option>
                ${eqpOptions.map(o => `<option value="${esc(o.value)}" ${state.eqpKey === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
              </select>
            </div>
            <div class="filter-cell">
              <input type="checkbox" data-enable="subsysKey" ${enabled.subsysKey ? 'checked' : ''}/>
              <label>${esc(t('子系统代码'))}</label>
              <select class="input" id="bh-subsys" ${enabled.subsysKey ? '' : 'disabled'}>
                <option value="">${esc(t('全部'))}</option>
                ${subsystemOptions.map(o => `<option value="${esc(o.value)}" ${state.subsysKey === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="filter-actions">
            <button class="btn btn-ghost" id="bh-clear">${icon('refresh', 14)} ${esc(t('清除'))}</button>
            <button class="btn btn-primary" id="bh-query">${icon('search', 14)} ${esc(t('查询'))}</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <button class="tool-btn" id="bh-hide" disabled>${icon('hide', 15)}<span>${esc(t('隐藏'))}</span></button>
          <button class="tool-btn" id="bh-show" disabled>${icon('show', 15)}<span>${esc(t('取消隐藏'))}</span></button>
          <span class="tool-sep"></span>
          <button class="tool-btn" id="bh-refresh">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
          <div class="toolbar-right"><span class="small muted" id="bh-count"></span></div>
        </div>
        <div id="bh-grid"></div>
      </div>
    `;
    bind();
    renderGrid();
  };

  const renderGrid = () => {
    const host = container.querySelector('#bh-grid');
    host.innerHTML = '';
    grid = new DataGrid(host, {
      rows, rowKey: 'ALARM_INFO_KEY', selectable: 'multi', pageSize: 20,
      columns: [
        { field: 'ALARM_INFO_ID', label: '警报代码', width: 150 },
        { field: 'ALARM_ID_DESC', label: '警报说明', width: 220 },
        { field: 'FACTORY_ID', label: '厂别代码', width: 95 },
        { field: 'FACTORY_NAME', label: '厂别名称', width: 110 },
        { field: 'SUB_SYS_ID', label: '子系统代码', width: 95 },
        { field: 'SUB_SYS_NAME', label: '子系统名称', width: 150 },
        { field: 'EQP_ID', label: '机台代码', width: 100 },
        { field: 'EQP_NAME', label: '机台名称', width: 130 },
        { field: 'EVENT_ID', label: '事件通知代码', width: 170 },
        { field: 'IGNORE_PERIOD', label: '忽略间隔(秒)', width: 110, type: 'number' },
        { field: 'ACTIVE', label: '状态', width: 95, render: r => statusChip(r.ACTIVE === 'Y' ? 'Y' : 'N') }
      ]
    });
    const countEl = container.querySelector('#bh-count');
    if (countEl) countEl.textContent = `${rows.length} ${t('笔')}`;
    updateEnabled();
    // 监听勾选
    host.addEventListener('click', () => setTimeout(updateEnabled, 0));
    host.addEventListener('change', () => setTimeout(updateEnabled, 0));
  };

  const updateEnabled = () => {
    const count = grid ? grid.getSelected().length : 0;
    const hideBtn = container.querySelector('#bh-hide');
    const showBtn = container.querySelector('#bh-show');
    if (hideBtn) hideBtn.disabled = count === 0;
    if (showBtn) showBtn.disabled = count === 0;
  };

  const bind = () => {
    container.querySelectorAll('[data-enable]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.dataset.enable === 'active') return;
        enabled[cb.dataset.enable] = cb.checked;
        draw();
      });
    });
    container.querySelector('#bh-active')?.addEventListener('change', (e) => { state.active = e.target.value; });
    container.querySelector('#bh-alarm')?.addEventListener('input', (e) => { state.alarmCode = e.target.value; });
    container.querySelector('#bh-group')?.addEventListener('change', (e) => {
      state.groupKey = e.target.value;
      if (state.groupKey) {
        const keys = new Set((ctx.options.eqp || []).filter(o => (o.groupKeys || []).includes(state.groupKey)).map(o => o.value));
        // options 未带群组关系，保留全部机台供选取
      }
    });
    container.querySelector('#bh-factory')?.addEventListener('change', (e) => { state.factoryKey = e.target.value; });
    container.querySelector('#bh-eqp')?.addEventListener('change', (e) => { state.eqpKey = e.target.value; });
    container.querySelector('#bh-subsys')?.addEventListener('change', (e) => { state.subsysKey = e.target.value; });
    container.querySelector('#bh-query').addEventListener('click', query);
    container.querySelector('#bh-clear').addEventListener('click', () => {
      state.alarmCode = ''; state.groupKey = ''; state.factoryKey = ''; state.eqpKey = ''; state.subsysKey = '';
      Object.keys(enabled).forEach(k => { enabled[k] = k === 'active'; });
      rows = [];
      draw();
    });
    container.querySelector('#bh-refresh').addEventListener('click', query);
    container.querySelector('#bh-hide').addEventListener('click', () => change('N'));
    container.querySelector('#bh-show').addEventListener('click', () => change('Y'));
  };

  const query = async () => {
    const qs = new URLSearchParams();
    qs.set('active', state.active);
    if (enabled.alarmCode && state.alarmCode) qs.set('alarmCode', state.alarmCode);
    if (enabled.groupKey && state.groupKey) qs.set('groupKey', state.groupKey);
    if (enabled.factoryKey && state.factoryKey) qs.set('factoryKey', state.factoryKey);
    if (enabled.eqpKey && state.eqpKey) qs.set('eqpKey', state.eqpKey);
    if (enabled.subsysKey && state.subsysKey) qs.set('subsysKey', state.subsysKey);
    showLoading(t('查询'));
    try {
      const res = await ctx.api.get('/api/batch-alarm/query?' + qs.toString());
      rows = res.rows;
      renderGrid();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { hideLoading(); }
  };

  const change = async (active) => {
    const keys = grid.getSelected();
    if (!keys.length) return;
    const ok = await confirmDialog({
      title: active === 'N' ? t('隐藏') : t('取消隐藏'),
      message: `确定要${active === 'N' ? '停用' : '启用'}所选 ${keys.length} 笔警报通知设定？`,
      okText: t('确认'), danger: active === 'N'
    });
    if (!ok) return;
    showLoading(t('处理中'));
    try {
      const res = await ctx.api.post('/api/batch-alarm/change', { keys, active });
      toast(`${t('操作成功')} · ${res.changed} ${t('笔')}`);
      await ctx.refreshOptions();
      await query();
    } catch (err) { toast(err.message, 'error'); } finally { hideLoading(); }
  };

  draw();
  await query();
}
