'use strict';

import { api } from './api.js';
import { t, setLang, getLang, fmtDT, fmtTime } from './i18n.js';
import { icon, esc, toast, openDrawer, showLoading, hideLoading, emptyState, closeAllOverlays } from './ui.js';

const app = document.getElementById('app');
const state = {
  user: null,
  loginAt: null,
  nav: [],
  options: {},
  meta: { masters: {}, mappings: {}, masterDetails: {}, pageTitles: {} },
  settings: {},
  route: { name: 'home', code: 'HOME' },
  cleanup: [],
  clockTimer: null,
  inboxTimer: null,
  pendingInbox: 0,
  rendered: false
};

const PAGE_DESC = {
  HOME: '全厂区警报态势、待办与装置健康总览。',
  MCMS038: '维护系统功能选单树，保存后立即影响上方导航。',
  MCMS040: '定义一般型主档的表结构、栏位与查询语法。',
  MCMS042: '定义 Mapping 型主档（两表对应）的资料来源与栏位。',
  MCMS041: '定义主档＋明细档型主档的结构与栏位。',
  MCMS051: '以四步向导定义批次状态变更作业。',
  CVMA015: '依警报自动切换机台与 Chamber 机况，支援批量设定与手动扫描。',
  AVPA002: '不经过事件层级，直接自选人员与渠道发送警报。',
  AVPA009: '事后补录机台警报，系统依警报通知设定逐级派发。',
  AVPA003: '检视通知给您的处理中警报，勾选后回报确认。',
  AVPA006: '强制中断处理中的警报，无需达到回应人数。',
  AVPA013: '依厂别、子系统与机台即时汇总处理中警报数量，每 10 秒自动更新。',
  AVPA004: '查询时间区间内所有警报的处理状况，可汇出 Excel。',
  AVPA007: '查询警报完整交易履历，至少须选择一个查询条件。',
  AVPA005: '查询未成功触发的警报与失效原因。',
  AVPA008: '查询 Server／Agent／装置的运行状态与收发统计。',
  RPTSET001: '以 18 个步骤定义报表资料来源、条件、栏位与图表呈现。',
  AVPA015: '集中启用／停用各 Agent 下的警报发送装置。',
  CVMA014: '依条件批量查询警报通知设定，并批次隐藏或恢复。',
  AVMA008: '以树状结构将事件层级对应到通知群组，并设定发送渠道。',
  AVMA010: '以 SQL 条件与时间区间定义客制化警报触发规则。',
  SBRM_REPO: '维护仓库基本资料（名称与地址），支持增删改查。',
  CONFIRM: '检视警报内容并完成确认或中断。'
};

const PAGE_LOADERS = {
  HOME: () => import('./pages/dashboard.js').then(m => m.render),
  MCMS038: () => import('./pages/menu.js').then(m => m.render),
  MCMS040: () => import('./pages/brmdef.js').then(m => m.render),
  MCMS042: () => import('./pages/brmdef.js').then(m => m.render),
  MCMS041: () => import('./pages/brmdef.js').then(m => m.render),
  MCMS051: () => import('./pages/batchstatus.js').then(m => m.render),
  CVMA015: () => import('./pages/autostatus.js').then(m => m.render),
  AVMA008: () => import('./pages/eventtree.js').then(m => m.render),
  AVMA010: () => import('./pages/conditions.js').then(m => m.render),
  AVPA015: () => import('./pages/devices.js').then(m => m.render),
  CVMA014: () => import('./pages/batchhide.js').then(m => m.render),
  AVPA002: () => import('./pages/alarm-ops.js').then(m => m.renderManual),
  AVPA009: () => import('./pages/alarm-ops.js').then(m => m.renderBackfill),
  AVPA003: () => import('./pages/alarm-ops.js').then(m => m.renderAck),
  AVPA006: () => import('./pages/alarm-ops.js').then(m => m.renderTerminate),
  AVPA013: () => import('./pages/reports.js').then(m => m.renderSummary),
  AVPA004: () => import('./pages/reports.js').then(m => m.renderReport),
  AVPA005: () => import('./pages/reports.js').then(m => m.renderReport),
  AVPA007: () => import('./pages/reports.js').then(m => m.renderReport),
  AVPA008: () => import('./pages/reports.js').then(m => m.renderReport),
  RPTSET001: () => import('./pages/reportsetting.js').then(m => m.render),
  CONFIRM: () => import('./pages/alarm-ops.js').then(m => m.renderConfirm)
};

/* --------------------------------------------------------------- 初始化 */
async function boot() {
  setLang(getLang());
  window.addEventListener('hashchange', route);
  window.addEventListener('ams:inbox-refresh', () => updateInboxBadge());
  window.addEventListener('ams:unauthorized', () => {
    state.user = null;
    state.rendered = false;
    if (state.clockTimer) clearInterval(state.clockTimer);
    if (state.inboxTimer) clearInterval(state.inboxTimer);
    renderLogin(t('登入已逾时，请重新登入'));
  });
  if (!api.token) {
    renderLogin();
    return;
  }
  try {
    const data = await api.get('/api/bootstrap');
    applyBootstrap(data);
    renderShell();
    await route();
  } catch (err) {
    renderLogin(err.message || t('服务连线异常'));
  }
}

function applyBootstrap(data) {
  state.user = data.user;
  state.loginAt = data.loginAt;
  state.nav = data.nav || [];
  state.options = data.options || {};
  state.meta = data.meta || state.meta;
  state.settings = data.settings || {};
  window.__AMS_OPTIONS__ = state.options;
  state.rendered = false;
}

async function reloadBootstrap() {
  const data = await api.get('/api/bootstrap');
  applyBootstrap(data);
}

/* ------------------------------------------------------------------ 登录 */
function renderLogin(errorMessage = '') {
  state.rendered = false;
  if (state.clockTimer) clearInterval(state.clockTimer);
  if (state.inboxTimer) clearInterval(state.inboxTimer);
  const langOptions = [
    ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['en', 'English']
  ];
  const saved = localStorage.getItem('ams_last_user') || 'E0043258';
  app.innerHTML = `
    <div class="login-shell">
      <section class="login-brand">
        <div class="login-brand-top">
          <div class="brand-mark">${bellMark()}</div>
          <div class="brand-text">
            <div class="brand-name">AMS<span>.</span></div>
            <div class="brand-sub">Alarm Management System</div>
          </div>
        </div>
        <div class="login-hero">
          <h1>${esc(t('让每一则警报'))}<br/>${esc(t('都被'))}<em>${esc(t('及时回应'))}</em></h1>
          <p>${esc(t('全厂区共享警报管理平台。整合 MES、EAP、FDC、SPC、EDC 等子系统与机台的异常警讯，依四要素匹配通知设定，多通道逐级升级，直到异常闭环。'))}</p>
          <div class="login-points">
            <div class="login-point">
              <div class="lp-icon">${icon('filter', 16)}</div>
              <div><b>${esc(t('四要素精准匹配'))}</b><span>${esc(t('厂别 + 子系统 + 机台 + 警报代码，支援机台群组回退。'))}</span></div>
            </div>
            <div class="login-point">
              <div class="lp-icon">${icon('alarm', 16)}</div>
              <div><b>${esc(t('层级升级与多通道派发'))}</b><span>${esc(t('Email、短信、语音、IM，未达回应人数自动升级。'))}</span></div>
            </div>
            <div class="login-point">
              <div class="lp-icon">${icon('report', 16)}</div>
              <div><b>${esc(t('完整履历与报表'))}</b><span>${esc(t('从建立、发送、确认、升级到完成，全程可追溯。'))}</span></div>
            </div>
          </div>
        </div>
        <div class="login-brand-foot">
          <span><span class="dot"></span>${esc(t('服务正常'))}</span>
          <span>Version ${esc(state.settings.version || '3.0.0')}</span>
          <span>Local Demo Environment</span>
        </div>
      </section>
      <section class="login-panel">
        <div class="login-lang">
          <select class="lang-select" id="login-lang">
            ${langOptions.map(([v, l]) => `<option value="${v}" ${getLang() === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="login-card">
          <div class="login-card-head">
            <div class="eyebrow">Alarm Management System</div>
            <h2>${esc(t('欢迎回来'))}</h2>
            <p>${esc(t('登录以进入警报管理平台'))}</p>
          </div>
          <form class="login-form" id="login-form">
            <div class="login-error ${errorMessage ? 'show' : ''}" id="login-error">${esc(errorMessage)}</div>
            <div class="lf-field">
              <label>${esc(t('账号'))}</label>
              <div class="login-input-wrap">${icon('user', 16)}<input class="input login-input" id="login-user" value="${esc(saved)}" autocomplete="username" placeholder="E0043258"/></div>
            </div>
            <div class="lf-field">
              <label>${esc(t('密码'))}</label>
              <div class="login-input-wrap">${icon('settings', 16)}<input class="input login-input" id="login-pass" type="password" value="123456" autocomplete="current-password" placeholder="••••••"/></div>
            </div>
            <div class="login-row">
              <label class="checkbox-label"><input type="checkbox" checked/> ${esc(t('记住账号'))}</label>
              <span>${esc(t('单一会话登入'))}</span>
            </div>
            <button class="btn btn-primary btn-block login-btn" type="submit">${esc(t('登录'))} ${icon('arrowRight', 15)}</button>
          </form>
          <div class="login-demo">
            <div class="login-demo-title">${esc(t('演示账号'))} · ${esc(t('快速填入'))}</div>
            <div class="demo-accounts">
              <button class="demo-account" data-user="E0043258">
                <span class="da-left"><span class="da-avatar">BC</span><span><span class="da-name">陈柏睿 BROCK</span><br/><span class="da-role">${esc(t('系统管理员 · 设备工程师'))}</span></span></span>
                <span class="da-id">E0043258</span>
              </button>
              <button class="demo-account" data-user="E0043288">
                <span class="da-left"><span class="da-avatar">KW</span><span><span class="da-name">王凯文 KEVIN</span><br/><span class="da-role">${esc(t('值班主管 · LEVEL-2'))}</span></span></span>
                <span class="da-id">E0043288</span>
              </button>
              <button class="demo-account" data-user="E0043271">
                <span class="da-left"><span class="da-avatar">YH</span><span><span class="da-name">许雅婷 AMY</span><br/><span class="da-role">${esc(t('制程工程师 · LEVEL-1'))}</span></span></span>
                <span class="da-id">E0043271</span>
              </button>
            </div>
          </div>
          <div class="login-foot">AMS v3.0.0 · ${esc(t('本地演示环境'))}<br/>${esc(t('本机演示环境 · 资料保存在 data/db.json'))}</div>
        </div>
      </section>
    </div>
  `;
  document.getElementById('login-lang').addEventListener('change', (e) => {
    setLang(e.target.value);
    renderLogin();
  });
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await doLogin(document.getElementById('login-user').value.trim(), document.getElementById('login-pass').value);
  });
  document.querySelectorAll('.demo-account').forEach(btn => {
    btn.addEventListener('click', () => doLogin(btn.dataset.user, '123456'));
  });
  setTimeout(() => document.getElementById('login-pass')?.focus(), 150);
}

async function doLogin(userId, password) {
  const errorEl = document.getElementById('login-error');
  if (!userId || !password) {
    if (errorEl) { errorEl.textContent = t('请输入账号与密码'); errorEl.classList.add('show'); }
    return;
  }
  showLoading(t('登录'));
  try {
    const res = await api.login(userId, password);
    api.setToken(res.token);
    localStorage.setItem('ams_last_user', userId);
    const data = await api.get('/api/bootstrap');
    applyBootstrap(data);
    renderShell();
    await route();
    toast(t('登录成功') + ' · ' + state.user.USER_NAME);
  } catch (err) {
    if (errorEl) { errorEl.textContent = err.message || t('登录失败'); errorEl.classList.add('show'); }
  } finally {
    hideLoading();
  }
}

function bellMark() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0-6 6v4l-2 4h16l-2-4V9a6 6 0 0 0-6-6Z"/><path d="M10 21h4"/><path d="M12 8v4"/></svg>`;
}

/* ------------------------------------------------------------------ 壳层 */
function renderShell() {
  const u = state.user;
  const initials = (u.ENGLISH_NAME || u.USER_ID || 'U').slice(0, 2).toUpperCase();
  const speed = Number(state.settings.demoSpeed || 10);
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#/home">
          <div class="brand-mark">${bellMark()}</div>
          <div class="brand-text">
            <div class="brand-name">AMS<span>.</span></div>
            <div class="brand-sub">Alarm Management System</div>
          </div>
        </a>
        <div class="topbar-right">
          <span class="system-pill"><span class="dot"></span>${esc(t('服务正常'))}</span>
          <label class="speed-select" title="${esc(t('演示时钟'))}">${icon('clock', 13)}<span>${esc(t('演示时钟'))}</span>
            <select id="speed-select">
              ${[1, 10, 30, 60].map(s => `<option value="${s}" ${s === speed ? 'selected' : ''}>×${s}</option>`).join('')}
            </select>
          </label>
          <button class="icon-btn" id="inbox-btn" title="${esc(t('通知'))}">${icon('bell', 18)}<span class="badge-dot" id="inbox-badge" style="display:none">0</span></button>
          <select class="lang-select" id="lang-select">
            <option value="zh-CN" ${getLang() === 'zh-CN' ? 'selected' : ''}>简体中文</option>
            <option value="zh-TW" ${getLang() === 'zh-TW' ? 'selected' : ''}>繁體中文</option>
            <option value="en" ${getLang() === 'en' ? 'selected' : ''}>English</option>
          </select>
          <span class="top-divider"></span>
          <div class="user-chip">
            <div class="user-avatar">${esc(initials)}</div>
            <div class="user-meta">
              <div class="u-name">${esc(u.USER_NAME)}</div>
              <div class="u-sub">${esc(u.USER_ID)} · ${esc(u.ORGAN_KEY || '')}</div>
            </div>
          </div>
          <span class="login-time">${esc(fmtDT(state.loginAt))}</span>
          <button class="icon-btn" id="logout-btn" title="${esc(t('登出'))}">${icon('logout', 17)}</button>
        </div>
      </header>
      <nav class="mainnav" id="mainnav">${buildNav()}</nav>
      <main class="page-wrap">
        <div class="page-head" id="page-head"></div>
        <div id="page"></div>
      </main>
      <footer class="statusbar">
        <div class="statusbar-left">
          <span><span class="dot"></span>${esc(t('本地演示环境'))}</span>
          <span>Version ${esc(state.settings.version || '3.0.0')}</span>
          <span>JSON Data Store</span>
        </div>
        <div class="statusbar-right">
          <span id="status-clock">${esc(fmtDT(new Date()))}</span>
          <span>${esc(u.USER_NAME)} · ${esc(u.USER_ID)}</span>
        </div>
      </footer>
    </div>
  `;
  state.rendered = true;
  bindShell();
  updateInboxBadge();
}

function routeFor(node) {
  if (!node) return '#/home';
  if (node.id === 'HOME') return '#/home';
  if (node.type === 'PAGE') {
    if (node.path && node.path.startsWith('#/') && !node.path.startsWith('#/page/')) return node.path;
    return '#/page/' + node.id;
  }
  return '#/page/' + node.id;
}

function navLeaves(nodes, out = []) {
  nodes.forEach(n => {
    if (n.children && n.children.length) navLeaves(n.children, out);
    else out.push(n);
  });
  return out;
}

function buildNav() {
  const trail = findTrail(state.route.code);
  const activeKeys = new Set((trail || []).map(n => n.key));
  return state.nav.map(top => {
    if (!top.children || !top.children.length) {
      const active = state.route.code === top.id;
      return `<div class="nav-item ${active ? 'active' : ''}">
        <a class="nav-link" href="${routeFor(top)}" data-nav="1">${top.id === 'HOME' ? icon('home', 15) : ''}<span>${esc(t(top.name))}</span></a>
      </div>`;
    }
    const leaves = navLeaves(top.children);
    const active = activeKeys.has(top.key);
    const nested = top.children.some(c => c.children && c.children.length);
    const cls = nested ? 'wide' : leaves.length > 12 ? 'wide wide-3' : leaves.length > 6 ? 'wide' : '';
    const content = top.children.map(child => {
      if (child.children && child.children.length) {
        return `<div class="nav-col">
          <div class="nav-menu-group">${esc(t(child.name))}</div>
          ${child.children.map(item => menuItem(item)).join('')}
        </div>`;
      }
      return menuItem(child);
    }).join('');
    return `<div class="nav-item has-menu ${active ? 'active' : ''}" data-nav-key="${esc(top.key)}">
      <button class="nav-link" type="button">${top.id === 'ALM' ? icon('alarm', 15) : top.id === 'RPT' ? icon('report', 15) : top.id === 'SYS' ? icon('settings', 15) : icon('eqp', 15)}<span>${esc(t(top.name))}</span><span class="nav-caret">${icon('chevronDown', 12)}</span></button>
      <div class="nav-menu ${cls}">${content}</div>
    </div>`;
  }).join('');
}

function menuItem(node) {
  const active = state.route.code === node.id;
  return `<a class="nav-menu-item ${active ? 'current' : ''}" href="${routeFor(node)}" data-nav="1"><span>${esc(t(node.name))}</span></a>`;
}

function findTrail(code, nodes = state.nav, trail = []) {
  for (const n of nodes) {
    const next = [...trail, n];
    if (n.id === code) return next;
    if (n.children && n.children.length) {
      const found = findTrail(code, n.children, next);
      if (found) return found;
    }
  }
  return null;
}

function positionMenu(item) {
  const menu = item.querySelector('.nav-menu');
  if (!menu || window.innerWidth <= 900) return;
  menu.style.left = '0px';
  const rect = item.getBoundingClientRect();
  const width = menu.offsetWidth;
  let shift = 0;
  const overflowRight = rect.left + width - (window.innerWidth - 14);
  if (overflowRight > 0) shift = -overflowRight;
  if (rect.left + shift < 12) shift = 12 - rect.left;
  menu.style.left = shift + 'px';
}

function bindShell() {
  const nav = document.getElementById('mainnav');
  nav.querySelectorAll('.nav-item.has-menu > .nav-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.nav-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.nav-item.open').forEach(x => x.classList.remove('open'));
      if (!wasOpen) {
        item.classList.add('open');
        positionMenu(item);
      }
    });
  });
  nav.querySelectorAll('a[data-nav]').forEach(a => {
    a.addEventListener('click', () => {
      document.querySelectorAll('.nav-item.open').forEach(x => x.classList.remove('open'));
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-item.has-menu')) {
      document.querySelectorAll('.nav-item.open').forEach(x => x.classList.remove('open'));
    }
  });
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await api.logout(); } catch (e) { /* ignore */ }
    api.setToken('');
    state.user = null;
    toast(t('登出成功'), 'info');
    renderLogin();
    location.hash = '#/login';
  });
  document.getElementById('lang-select').addEventListener('change', async (e) => {
    setLang(e.target.value);
    renderShell();
    await route(true);
  });
  document.getElementById('speed-select').addEventListener('change', async (e) => {
    const speed = Number(e.target.value);
    try {
      const res = await api.post('/api/settings', { demoSpeed: speed });
      state.settings = res.settings;
      toast(`${t('演示时钟')} → ×${speed}`, 'info');
      if (state.route.code !== 'HOME') await route(true);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  document.getElementById('inbox-btn').addEventListener('click', openInbox);
  if (state.clockTimer) clearInterval(state.clockTimer);
  state.clockTimer = setInterval(() => {
    const el = document.getElementById('status-clock');
    if (el) el.textContent = fmtDT(new Date());
  }, 1000);
  if (state.inboxTimer) clearInterval(state.inboxTimer);
  state.inboxTimer = setInterval(updateInboxBadge, 60000);
}

async function updateInboxBadge() {
  try {
    const res = await api.get('/api/inbox');
    state.pendingInbox = res.pending || 0;
    const badgeEl = document.getElementById('inbox-badge');
    if (badgeEl) {
      badgeEl.textContent = state.pendingInbox > 99 ? '99+' : state.pendingInbox;
      badgeEl.style.display = state.pendingInbox > 0 ? 'grid' : 'none';
    }
  } catch (e) { /* silent */ }
}

/* ------------------------------------------------------------------ 路由 */
function parseHash() {
  const hash = location.hash || '#/home';
  if (hash.startsWith('#/confirm/')) {
    return { name: 'confirm', code: 'CONFIRM', alarmId: decodeURIComponent(hash.slice('#/confirm/'.length)) };
  }
  if (hash.startsWith('#/page/')) {
    return { name: 'page', code: decodeURIComponent(hash.slice('#/page/'.length)) };
  }
  if (hash.startsWith('#/home')) return { name: 'home', code: 'HOME' };
  if (hash.startsWith('#/login')) return { name: 'login', code: 'LOGIN' };
  return { name: 'home', code: 'HOME' };
}

function pageTitleFor(code) {
  if (code === 'HOME') return t('首页');
  if (code === 'CONFIRM') return t('警报确认');
  if (state.meta.masters[code]) return t(state.meta.masters[code].title);
  if (state.meta.mappings[code]) return t(state.meta.mappings[code].title);
  if (state.meta.masterDetails[code]) return t(state.meta.masterDetails[code].title);
  return t(state.meta.pageTitles[code] || code);
}

function pageDescFor(code) {
  if (state.meta.masters[code]) return state.meta.masters[code].desc;
  if (state.meta.mappings[code]) return state.meta.mappings[code].desc;
  if (state.meta.masterDetails[code]) return state.meta.masterDetails[code].desc;
  return PAGE_DESC[code] || '';
}

function setHead(code, extra = {}) {
  const head = document.getElementById('page-head');
  if (!head) return;
  const trail = findTrail(code);
  const crumbs = [`<span>${esc(t('首页'))}</span>`];
  (trail || []).filter(n => n.id !== 'HOME').forEach(n => {
    crumbs.push('<span class="sep">/</span>');
    crumbs.push(`<span class="${n.id === code ? 'current' : ''}">${esc(t(n.name))}</span>`);
  });
  if (!trail && code !== 'HOME') {
    crumbs.push('<span class="sep">/</span>');
    crumbs.push(`<span class="current">${esc(extra.title || pageTitleFor(code))}</span>`);
  }
  head.innerHTML = `
    <div>
      <div class="breadcrumb">${crumbs.join('')}</div>
      <div class="page-title">${esc(extra.title || pageTitleFor(code))}</div>
      <div class="page-desc">${esc(t(extra.desc || pageDescFor(code)))}</div>
    </div>
    <div class="page-head-actions">
      <div class="page-head-meta">
        <div>${esc(t('资料更新时间'))}</div>
        <div id="head-updated">${esc(fmtDT(new Date()))}</div>
      </div>
    </div>
  `;
}

async function route(force = false) {
  if (!state.user) {
    if (!document.querySelector('.login-shell')) renderLogin();
    return;
  }
  const parsed = parseHash();
  if (parsed.name === 'login') {
    location.hash = '#/home';
    return;
  }
  if (!force && state.route.name === parsed.name && state.route.code === parsed.code && state.route.alarmId === parsed.alarmId && document.getElementById('page')?.dataset.rendered === '1') return;
  state.route = parsed;
  if (!state.rendered) renderShell();
  closeAllOverlays();
  setHead(parsed.code);
  // 清理前一页
  state.cleanup.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });
  state.cleanup = [];
  const container = document.getElementById('page');
  container.dataset.rendered = '0';
  container.innerHTML = `<div class="card"><div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div><div class="empty-title">${esc(t('读取中'))}</div></div></div>`;
  document.querySelectorAll('.nav-item.open').forEach(x => x.classList.remove('open'));
  const ctx = buildContext(parsed);
  try {
    await renderPage(container, ctx);
    container.dataset.rendered = '1';
    const updated = document.getElementById('head-updated');
    if (updated && ctx.updatedAt) updated.textContent = fmtDT(ctx.updatedAt);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="card"><div class="empty-state">
      <div class="empty-icon">${icon('warning', 28)}</div>
      <div class="empty-title">${esc(t('读取失败'))}</div>
      <div class="empty-sub">${esc(err.message || '')}</div>
      <button class="btn btn-ghost btn-sm mt-12" onclick="location.reload()">${esc(t('重新整理'))}</button>
    </div></div>`;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function renderPage(container, ctx) {
  const { code } = state.route;
  if (state.meta.masters[code]) {
    const m = await import('./pages/generic.js');
    return m.renderMaster(container, ctx);
  }
  if (state.meta.mappings[code]) {
    const m = await import('./pages/generic.js');
    return m.renderMapping(container, ctx);
  }
  if (state.meta.masterDetails[code]) {
    const m = await import('./pages/generic.js');
    return m.renderMasterDetail(container, ctx);
  }
  const loader = PAGE_LOADERS[code];
  if (!loader) {
    container.innerHTML = `<div class="card">${emptyState('页面建置中', 'info', code)}</div>`;
    return;
  }
  const render = await loader();
  return render(container, ctx);
}

function buildContext(parsed) {
  return {
    api,
    user: state.user,
    loginAt: state.loginAt,
    nav: state.nav,
    options: state.options,
    meta: state.meta,
    settings: state.settings,
    route: parsed,
    navigate(hash) { if (location.hash === hash) route(true); else location.hash = hash; },
    toast,
    setHead,
    setUpdated(iso) {
      this.updatedAt = iso || new Date().toISOString();
      const el = document.getElementById('head-updated');
      if (el) el.textContent = fmtDT(this.updatedAt);
    },
    registerCleanup(fn) { if (typeof fn === 'function') state.cleanup.push(fn); },
    async refreshBootstrap() {
      await reloadBootstrap();
      renderShell();
    },
    async refreshOptions() {
      const res = await api.get('/api/options');
      Object.keys(state.options).forEach(k => { delete state.options[k]; });
      Object.assign(state.options, res.options);
      window.__AMS_OPTIONS__ = state.options;
    },
    reloadPage() { return route(true); }
  };
}

/* ------------------------------------------------------------------ 收件箱 */
async function openInbox() {
  try {
    const res = await api.get('/api/inbox');
    const rows = res.rows || [];
    const body = document.createElement('div');
    let filter = 'All';
    const renderList = () => {
      const list = rows.filter(r => filter === 'All' || r.CHANNEL === filter);
      const listEl = body.querySelector('.inbox-list');
      if (!listEl) return;
      listEl.innerHTML = list.length ? list.map(item => `
        <div class="inbox-item ${item.CAN_ACK ? 'unread' : ''}" data-key="${esc(item.ALARM_KEY)}">
          <div class="inbox-channel ${esc(item.CHANNEL)}">${esc(item.CHANNEL === 'Email' ? 'MAIL' : item.CHANNEL === 'Sms' ? 'SMS' : item.CHANNEL === 'IM' ? 'IM' : 'TEL')}</div>
          <div class="inbox-main">
            <div class="inbox-title">${esc(item.TITLE || item.MESSAGE)}</div>
            <div class="inbox-sub">${esc(item.ALARM_ID)} · ${esc(item.FACTORY_ID)} / ${esc(item.SUB_SYS_ID)} / ${esc(item.EQP_ID)} · ${esc(t(item.RESULT === 'Success' ? '已发送' : '发送失败'))}</div>
            <div class="inbox-time">${esc(fmtDT(item.SEND_DT))}${item.RESULT !== 'Success' ? ' · ' + esc(item.MESSAGE) : ''}</div>
          </div>
        </div>`).join('') : `<div class="empty-state">${icon('bell', 28)}<div class="empty-title mt-8">${esc(t('没有通知'))}</div></div>`;
      listEl.querySelectorAll('.inbox-item').forEach(el => {
        el.addEventListener('click', () => {
          drawer.close();
          location.hash = '#/confirm/' + encodeURIComponent(el.dataset.key);
        });
      });
    };
    body.innerHTML = `
      <div class="hint-bar mb-12">${icon('info', 15)}<div>${esc(t('模拟收件箱'))} · 通知会派发到您的 Email／短信／IM／语音。${res.pending ? ` 目前有 <b>${res.pending}</b> 笔${esc(t('待我确认'))}。` : ''}</div></div>
      <div class="inbox-tabs">
        ${[['All', '全部'], ['Email', '邮件'], ['Sms', '短信'], ['IM', '飞书'], ['Phone', '语音']].map(([k, l]) => `<button class="inbox-filter ${k === 'All' ? 'active' : ''}" data-filter="${k}">${esc(t(l))}</button>`).join('')}
        <button class="btn btn-sm btn-subtle" id="go-pending" style="margin-left:auto">${esc(t('前往确认'))}</button>
      </div>
      <div class="inbox-list"></div>
    `;
    const drawer = openDrawer({
      title: t('通知收件箱'),
      subtitle: `${rows.length} ${t('通知')} · ${res.pending || 0} ${t('待我确认')}`,
      body, width: 460, small: true
    });
    renderList();
    body.querySelectorAll('.inbox-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.filter;
        body.querySelectorAll('.inbox-filter').forEach(b => b.classList.toggle('active', b === btn));
        renderList();
      });
    });
    body.querySelector('#go-pending').addEventListener('click', () => {
      drawer.close();
      location.hash = '#/page/AVPA003';
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* 键盘快捷关闭 */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.nav-item.open').forEach(x => x.classList.remove('open'));
  }
});

boot();
