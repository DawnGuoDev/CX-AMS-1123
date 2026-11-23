'use strict';

import {
  esc, icon, toast, openModal, confirmDialog, showLoading, hideLoading,
  formGrid, readForm, bindDependentSelects
} from '../ui.js';
import { t } from '../i18n.js';

const FUNC_TYPES = [
  { value: 'GROUP', label: 'GROUP（选单群组）' },
  { value: 'PAGE', label: 'PAGE（系统页面）' },
  { value: 'LINK', label: 'LINK（外部链接）' }
];

export async function render(container, ctx) {
  let nodes = [];
  let selectedKey = null;
  let collapsed = new Set();
  let dirty = false;
  let dragKey = null;

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      const res = await ctx.api.get('/api/functions');
      nodes = res.rows.map(n => ({ ...n }));
      selectedKey = nodes[0]?.FUNCTION_KEY || null;
      dirty = false;
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { if (!silent) hideLoading(); }
  };

  const childrenOf = (key) => nodes.filter(n => (n.PARENT_KEY || null) === key).sort((a, b) => (a.SORT || 0) - (b.SORT || 0));
  const selectedNode = () => nodes.find(n => n.FUNCTION_KEY === selectedKey);

  const draw = () => {
    container.innerHTML = `
      <div class="hint-bar mb-16">${icon('info', 15)}<div>维护上方导航的功能树。拖拽节点可调整顺序；保存后立即套用到系统选单。功能代码需唯一，页面节点请使用 <span class="mono">#/page/页面代码</span> 路径。</div></div>
      <div class="event-page-grid" style="grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)">
        <div class="card">
          <div class="toolbar">
            <button class="tool-btn tool-add" id="fn-save">${icon('check', 15)}<span>${esc(t('储存'))}</span></button>
            <span class="tool-sep"></span>
            <button class="tool-btn" id="fn-add-root">${icon('plus', 15)}<span>${esc(t('新增顶层'))}</span></button>
            <button class="tool-btn" id="fn-expand">${icon('chevronDown', 15)}<span>${esc(t('展开'))}</span></button>
            <button class="tool-btn" id="fn-collapse">${icon('chevronRight', 15)}<span>${esc(t('收合'))}</span></button>
            <span class="tool-sep"></span>
            <button class="tool-btn" id="fn-export">${icon('export', 15)}<span>${esc(t('汇出'))}</span></button>
            <button class="tool-btn" id="fn-import">${icon('import', 15)}<span>${esc(t('汇入'))}</span></button>
            <div class="toolbar-right"><span class="inline-note" id="fn-state"></span></div>
          </div>
          <div class="tree-scroll" id="fn-tree"></div>
        </div>
        <div class="property-panel">
          <div class="property-head"><span>${esc(t('功能属性'))}</span><span class="small muted" id="fn-type"></span></div>
          <div class="property-body" id="fn-property"></div>
        </div>
      </div>
      <input type="file" id="fn-file" accept=".json,application/json" hidden/>
    `;
    drawTree();
    drawProperty();
    updateState();
    container.querySelector('#fn-save').addEventListener('click', save);
    container.querySelector('#fn-add-root').addEventListener('click', () => addChild(null));
    container.querySelector('#fn-expand').addEventListener('click', () => { collapsed.clear(); drawTree(); });
    container.querySelector('#fn-collapse').addEventListener('click', () => {
      nodes.forEach(n => { if (childrenOf(n.FUNCTION_KEY).length) collapsed.add(n.FUNCTION_KEY); });
      drawTree();
    });
    container.querySelector('#fn-export').addEventListener('click', exportJson);
    container.querySelector('#fn-import').addEventListener('click', () => container.querySelector('#fn-file').click());
    container.querySelector('#fn-file').addEventListener('change', importJson);
  };

  const updateState = () => {
    const el = container.querySelector('#fn-state');
    if (el) el.innerHTML = dirty ? `<span style="color:var(--orange)">${icon('warning', 12)} 有未储存的变更</span>` : `${icon('check', 12)} 已储存`;
  };

  const drawTree = () => {
    const host = container.querySelector('#fn-tree');
    const renderNode = (node, depth = 0) => {
      const kids = childrenOf(node.FUNCTION_KEY);
      const isCollapsed = collapsed.has(node.FUNCTION_KEY);
      const isSelected = node.FUNCTION_KEY === selectedKey;
      const iconName = node.FUNC_TYPE === 'GROUP' ? 'menu' : node.FUNC_TYPE === 'LINK' ? 'link' : 'file';
      return `<div class="tree-node" draggable="true" data-key="${esc(node.FUNCTION_KEY)}">
        <div class="tree-row ${isSelected ? 'selected' : ''}" data-type="function" data-key="${esc(node.FUNCTION_KEY)}">
          ${kids.length ? `<button class="tree-toggle" data-toggle="${esc(node.FUNCTION_KEY)}">${icon(isCollapsed ? 'chevronRight' : 'chevronDown', 13)}</button>` : `<span class="tree-toggle placeholder"></span>`}
          <span class="tree-icon">${icon(iconName, 13)}</span>
          <span class="tree-label">${esc(node.FUNCTION_NAME)} <span class="mono" style="font-size:9px;color:var(--muted-2)">${esc(node.FUNCTION_ID)}</span></span>
          ${node.VISIBLE === 'N' ? '<span class="badge badge-gray">隐藏</span>' : ''}
          ${kids.length ? `<span class="tree-badge">${kids.length}</span>` : ''}
        </div>
        ${kids.length && !isCollapsed ? `<div class="tree-children">${kids.map(k => renderNode(k, depth + 1)).join('')}</div>` : ''}
      </div>`;
    };
    const roots = childrenOf(null);
    host.innerHTML = roots.length ? roots.map(n => renderNode(n)).join('') : `<div class="property-empty">${esc(t('无资料'))}</div>`;

    host.querySelectorAll('.tree-row[data-type="function"]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-toggle]')) return;
        selectedKey = row.dataset.key;
        drawTree(); drawProperty();
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedKey = row.dataset.key;
        drawTree(); drawProperty();
        showContextMenu(e.clientX, e.clientY, selectedNode());
      });
      row.addEventListener('dragstart', (e) => {
        dragKey = row.dataset.key;
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragover', (e) => { e.preventDefault(); });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = nodes.find(n => n.FUNCTION_KEY === row.dataset.key);
        const dragged = nodes.find(n => n.FUNCTION_KEY === dragKey);
        if (!target || !dragged || target.FUNCTION_KEY === dragged.FUNCTION_KEY) return;
        if ((target.PARENT_KEY || null) !== (dragged.PARENT_KEY || null)) {
          toast('仅支援同一层级内拖拽排序', 'warning');
          return;
        }
        const siblings = childrenOf(target.PARENT_KEY);
        const from = siblings.findIndex(n => n.FUNCTION_KEY === dragged.FUNCTION_KEY);
        const to = siblings.findIndex(n => n.FUNCTION_KEY === target.FUNCTION_KEY);
        siblings.splice(from, 1);
        siblings.splice(to, 0, dragged);
        siblings.forEach((n, i) => { n.SORT = i + 1; });
        dirty = true;
        drawTree(); updateState();
      });
    });
    host.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.toggle;
        if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key);
        drawTree();
      });
    });
  };

  const drawProperty = () => {
    const node = selectedNode();
    const host = container.querySelector('#fn-property');
    const typeEl = container.querySelector('#fn-type');
    if (!node) {
      typeEl.textContent = '';
      host.innerHTML = `<div class="property-empty">${icon('menu', 26)}<div class="mt-8">${esc(t('请选择功能节点'))}</div></div>`;
      return;
    }
    typeEl.textContent = node.FUNC_TYPE;
    const parent = nodes.find(n => n.FUNCTION_KEY === node.PARENT_KEY);
    const fields = [
      { name: 'FUNCTION_ID', label: '功能代码', type: 'text', required: true },
      { name: 'FUNCTION_NAME', label: '功能名称', type: 'text', required: true },
      { name: 'FUNC_TYPE', label: '平台类型', type: 'select', options: FUNC_TYPES },
      { name: 'PATH', label: '路径名称', type: 'text' },
      { name: 'OBJ_NAME', label: '物件名称', type: 'text' },
      { name: 'HYPERLINK', label: '网址', type: 'text' },
      { name: 'SORT', label: '排序', type: 'number' },
      { name: 'VISIBLE', label: '功能显示', type: 'select', options: [{ value: 'Y', label: 'Y（显示）' }, { value: 'N', label: 'N（隐藏）' }] },
      { name: 'LOAD_VISIBLE', label: '加载显示', type: 'select', options: [{ value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }] }
    ];
    const safeFields = fields.map(f => f.options ? { ...f, type: 'select' } : f);
    const values = { ...node, SORT: node.SORT || 0 };
    // 手动渲染（options 直接给入）
    const html = `<div class="info-grid mb-16">
        <div class="info-cell"><div class="ic-label">${esc(t('上阶功能'))}</div><div class="ic-value">${esc(parent ? parent.FUNCTION_NAME : '— 顶层 —')}</div></div>
        <div class="info-cell"><div class="ic-label">${esc(t('子功能'))}</div><div class="ic-value">${childrenOf(node.FUNCTION_KEY).length}</div></div>
      </div>
      <div class="form-grid cols-1">
        ${safeFields.map(f => {
          let control;
          if (f.options) {
            control = `<select class="input" name="${f.name}">${f.options.map(o => `<option value="${esc(o.value)}" ${String(values[f.name]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
          } else if (f.type === 'number') {
            control = `<input class="input" type="number" name="${f.name}" value="${esc(values[f.name] || 0)}"/>`;
          } else {
            control = `<input class="input" type="text" name="${f.name}" value="${esc(values[f.name] || '')}"/>`;
          }
          return `<div class="form-field"><div class="form-label">${esc(t(f.label))}${f.required ? '<span class="req">*</span>' : ''}</div><div class="form-control">${control}</div></div>`;
        }).join('')}
        <div class="form-field"><div class="form-label">${esc(t('属性参数'))}</div><div class="form-control"><textarea class="input" id="fn-props" rows="3">${esc(pretty(node.PROPERTIES_JSON))}</textarea></div></div>
        <div class="form-field"><div class="form-label">Action 权限</div><div class="form-control"><textarea class="input" id="fn-actions" rows="3">${esc(pretty(node.ACTIONS_JSON))}</textarea></div></div>
      </div>
      <div class="prop-actions">
        <button class="btn btn-primary btn-sm" id="fn-apply">${icon('check', 13)} ${esc(t('确认'))}</button>
        <button class="btn btn-ghost btn-sm" id="fn-add-child">${icon('plus', 13)} ${esc(t('新增'))}</button>
        <button class="btn btn-ghost btn-sm" id="fn-copy">${icon('copy', 13)} ${esc(t('复制'))}</button>
        <button class="btn btn-ghost btn-sm" id="fn-up">↑</button>
        <button class="btn btn-ghost btn-sm" id="fn-down">↓</button>
        <button class="btn btn-danger btn-sm" id="fn-remove">${icon('trash', 13)} ${esc(t('移除'))}</button>
      </div>`;
    host.innerHTML = html;
    host.querySelector('#fn-apply').addEventListener('click', () => applyForm());
    host.querySelector('#fn-add-child').addEventListener('click', () => addChild(node));
    host.querySelector('#fn-copy').addEventListener('click', () => copyNode(node));
    host.querySelector('#fn-up').addEventListener('click', () => moveNode(node, -1));
    host.querySelector('#fn-down').addEventListener('click', () => moveNode(node, 1));
    host.querySelector('#fn-remove').addEventListener('click', () => removeNode(node));
  };

  const applyForm = () => {
    const node = selectedNode();
    const host = container.querySelector('#fn-property');
    host.querySelectorAll('[name]').forEach(inp => {
      node[inp.name] = inp.name === 'SORT' ? Number(inp.value) || 0 : inp.value;
    });
    try {
      node.PROPERTIES_JSON = JSON.stringify(JSON.parse(host.querySelector('#fn-props').value || '{}'));
      node.ACTIONS_JSON = JSON.stringify(JSON.parse(host.querySelector('#fn-actions').value || '[]'));
    } catch (e) {
      toast('属性参数或 Action 权限不是合法 JSON', 'error');
      return;
    }
    dirty = true;
    toast(t('操作成功'), 'info');
    drawTree(); drawProperty(); updateState();
  };

  const addChild = (parent) => {
    const parentKey = parent ? (parent.FUNC_TYPE === 'GROUP' ? parent.FUNCTION_KEY : parent.PARENT_KEY || null) : null;
    const siblings = childrenOf(parentKey);
    const key = 'new_' + Date.now();
    const node = {
      FUNCTION_KEY: key, FUNCTION_ID: 'NEW_FUNCTION', FUNCTION_NAME: '新功能',
      PARENT_KEY: parentKey, FUNC_TYPE: 'PAGE', PATH: '#/page/NEW_FUNCTION', SORT: siblings.length + 1,
      VISIBLE: 'Y', LOAD_VISIBLE: 'Y', OBJ_NAME: '', HYPERLINK: '',
      PROPERTIES_JSON: '{}', ACTIONS_JSON: '[]', ACTIVE: 'Y'
    };
    nodes.push(node);
    selectedKey = key;
    dirty = true;
    drawTree(); drawProperty(); updateState();
  };

  const copyNode = (node) => {
    const key = 'new_' + Date.now();
    nodes.push({
      ...node, FUNCTION_KEY: key, FUNCTION_ID: node.FUNCTION_ID + '_COPY',
      FUNCTION_NAME: node.FUNCTION_NAME + '（复制）', SORT: (node.SORT || 0) + 1
    });
    selectedKey = key;
    dirty = true;
    drawTree(); drawProperty(); updateState();
  };

  const removeNode = async (node) => {
    if (childrenOf(node.FUNCTION_KEY).length) { toast('请先移除子功能', 'warning'); return; }
    const ok = await confirmDialog({ title: t('移除'), message: `确定要移除功能「${node.FUNCTION_NAME}」？保存后导航将不再显示。`, okText: t('移除'), danger: true });
    if (!ok) return;
    nodes = nodes.filter(n => n.FUNCTION_KEY !== node.FUNCTION_KEY);
    selectedKey = null;
    dirty = true;
    drawTree(); drawProperty(); updateState();
  };

  const moveNode = (node, dir) => {
    const siblings = childrenOf(node.PARENT_KEY);
    const idx = siblings.findIndex(n => n.FUNCTION_KEY === node.FUNCTION_KEY);
    const next = idx + dir;
    if (next < 0 || next >= siblings.length) return;
    [siblings[idx], siblings[next]] = [siblings[next], siblings[idx]];
    siblings.forEach((n, i) => { n.SORT = i + 1; });
    dirty = true;
    drawTree(); updateState();
  };

  let menu = null;
  const closeMenu = () => { if (menu) { menu.remove(); menu = null; } };
  const showContextMenu = (x, y, node) => {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'tree-context';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.innerHTML = `<button id="ctx-add">${icon('plus', 13)} ${esc(t('新增'))}</button>
      <button id="ctx-copy">${icon('copy', 13)} ${esc(t('复制'))}</button>
      <div class="sep"></div>
      <button id="ctx-remove" class="danger">${icon('trash', 13)} ${esc(t('移除'))}</button>`;
    document.body.appendChild(menu);
    menu.querySelector('#ctx-add').addEventListener('click', () => { closeMenu(); addChild(node); });
    menu.querySelector('#ctx-copy').addEventListener('click', () => { closeMenu(); copyNode(node); });
    menu.querySelector('#ctx-remove').addEventListener('click', () => { closeMenu(); removeNode(node); });
    setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
  };

  const save = async () => {
    const ids = new Set();
    for (const n of nodes) {
      if (!n.FUNCTION_ID) { toast('功能代码不可为空', 'warning'); return; }
      if (ids.has(n.FUNCTION_ID)) { toast(`功能代码重复：${n.FUNCTION_ID}`, 'error'); return; }
      ids.add(n.FUNCTION_ID);
    }
    showLoading(t('储存'));
    try {
      const payload = nodes.map(n => ({
        ...n,
        FUNCTION_KEY: String(n.FUNCTION_KEY).startsWith('new_') ? undefined : n.FUNCTION_KEY
      }));
      const res = await ctx.api.post('/api/functions', { nodes: payload });
      toast(t('储存成功'));
      dirty = false;
      await ctx.refreshBootstrap();
      await ctx.reloadPage();
    } catch (err) {
      toast(err.message, 'error', 5000);
    } finally { hideLoading(); }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'AMS_functions.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(t('已汇出'));
  };

  const importJson = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(String(reader.result));
        if (!Array.isArray(arr)) throw new Error('格式错误');
        nodes = arr.map(n => ({ ...n, FUNCTION_KEY: n.FUNCTION_KEY || 'new_' + Math.random().toString(36).slice(2) }));
        selectedKey = nodes[0]?.FUNCTION_KEY || null;
        dirty = true;
        drawTree(); drawProperty(); updateState();
        toast('汇入完成，请按「储存」套用');
      } catch (err) {
        toast('JSON 格式错误：' + err.message, 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  await load();
}

function pretty(json) {
  try { return JSON.stringify(JSON.parse(json || '{}'), null, 2); } catch (e) { return json || ''; }
}
