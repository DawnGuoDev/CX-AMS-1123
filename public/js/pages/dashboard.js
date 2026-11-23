'use strict';

import { esc, icon, statusChip, emptyState, showLoading, hideLoading, toast } from '../ui.js';
import { t, fmtDT, fmtTime, relTime } from '../i18n.js';
import { openAlarmDrawer } from './alarm-detail.js';

export async function render(container, ctx) {
  container.innerHTML = `<div class="card"><div class="empty-state"><div class="spinner" style="margin:0 auto 12px"></div><div class="empty-title">${esc(t('读取中'))}</div></div></div>`;
  let data;
  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      data = await ctx.api.get('/api/dashboard');
      paint();
      ctx.setUpdated(data.lastUpdate);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      if (!silent) hideLoading();
    }
  };

  const paint = () => {
    const k = data.kpi;
    const maxHour = Math.max(1, ...data.hourly.map(h => h.count));
    const maxSub = Math.max(1, ...data.topSubsys.map(s => s.count));
    container.innerHTML = `
      <div class="kpi-row">
        ${kpiCard('今日警报', k.today, 'alarm', '今日累计建立警报', 'alarm', 'kpi-alarm')}
        ${kpiCard('处理中警报', k.process, 'activity', '等待人员确认或中断', 'clock', '')}
        ${kpiCard('待我确认', k.pending, 'pending', '通知给我且尚未确认', 'bell', 'kpi-pending')}
        ${kpiCard('无效警报', k.invalidToday, 'invalid', '今日未成功触发', 'warning', 'kpi-invalid')}
        ${kpiCard('完成率', k.completedRate, 'rate', '今日完成 / 今日警报', 'check', 'kpi-rate', '%')}
      </div>

      <div class="dash-grid">
        <section class="card">
          <div class="card-head">
            <h3>${icon('chart', 15)} ${esc(t('近 12 小时'))} <span class="card-sub">Alarm Volume</span></h3>
            <div class="card-actions">
              <span class="legend"><span><i style="background:#146aa8"></i>${esc(t('警报数量'))}</span></span>
              <button class="btn btn-sm btn-ghost" id="dash-refresh">${icon('refresh', 13)} ${esc(t('重新整理'))}</button>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-bars">
              ${data.hourly.map(h => `<div class="chart-bar-col">
                <div class="chart-bar" style="height:${Math.max(2, h.count / maxHour * 82)}%"><span class="bar-val">${h.count || ''}</span></div>
                <div class="chart-bar-label">${String(h.hour).padStart(2, '0')}:00</div>
              </div>`).join('')}
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h3>${icon('alarm', 15)} ${esc(t('警报分布'))} <span class="card-sub">${esc(t('处理中警报'))}</span></h3>
            <span class="badge badge-blue">${k.process} ${esc(t('笔'))}</span>
          </div>
          <div class="card-body">
            ${data.topSubsys.length ? `<div class="dist-list">${data.topSubsys.map((s, i) => `
              <div class="dist-item">
                <div class="dist-head"><span>${esc(s.name)}</span><b>${s.count}</b></div>
                <div class="dist-track"><div class="dist-fill" style="width:${Math.max(6, s.count / maxSub * 100)}%;opacity:${1 - i * 0.12}"></div></div>
              </div>`).join('')}</div>` : emptyState('目前没有处理中的警报', 'check')}
            ${k.pending ? `<div class="hint-bar mt-16">${icon('bell', 15)}<div>${esc(t('待我确认'))} <b>${k.pending}</b> ${esc(t('笔'))} ·
              <a href="#/page/AVPA003" style="font-weight:600">${esc(t('前往确认'))}</a></div></div>` : ''}
          </div>
        </section>
      </div>

      <div class="dash-grid">
        <section class="card">
          <div class="card-head">
            <h3>${icon('clock', 15)} ${esc(t('最新警报'))}</h3>
            <a class="btn btn-sm btn-ghost" href="#/page/AVPA004">${esc(t('查看全部'))} ${icon('arrowRight', 13)}</a>
          </div>
          <div class="recent-list">
            ${data.recent.length ? data.recent.map(a => `
              <div class="recent-item" data-alarm="${esc(a.ALARM_KEY)}">
                <div class="recent-time">${esc(fmtTime(a.CREATE_DT))}</div>
                <div class="recent-main">
                  <div class="recent-title">${esc(a.TITLE)}</div>
                  <div class="recent-sub">${esc(a.ALARM_ID)} · ${esc(a.FACTORY_ID)} / ${esc(a.SUB_SYS_ID)} / ${esc(a.EQP_ID)} · L${esc(a.CURRENT_LEVEL)} · P${esc(a.PRIORITY)}</div>
                </div>
                ${statusChip(a.STATUS)}
              </div>`).join('') : emptyState('尚无资料', 'alarm')}
          </div>
        </section>

        <div style="display:flex;flex-direction:column;gap:16px">
          <section class="card">
            <div class="card-head">
              <h3>${icon('server', 15)} ${esc(t('装置健康'))}</h3>
              <a class="btn btn-sm btn-ghost" href="#/page/AVPA008">${esc(t('详情'))}</a>
            </div>
            <div class="card-body">
              <div class="device-mini">
                <div class="device-mini-item"><div class="device-mini-label">${esc(t('总装置'))}</div><div class="device-mini-value">${data.deviceSummary.total}</div></div>
                <div class="device-mini-item"><div class="device-mini-label">${esc(t('正常'))}</div><div class="device-mini-value" style="color:var(--green)">${data.deviceSummary.ok}</div></div>
                <div class="device-mini-item"><div class="device-mini-label">${esc(t('异常'))}</div><div class="device-mini-value" style="color:var(--red)">${data.deviceSummary.abnormal}</div></div>
                <div class="device-mini-item"><div class="device-mini-label">${esc(t('未验证'))}</div><div class="device-mini-value" style="color:var(--muted)">${data.deviceSummary.unknown}</div></div>
              </div>
              ${data.autoLogs.length ? `<div class="mt-16"><div class="small muted mb-8">${esc(t('最近执行'))} · ${esc(t('自动切机况'))}</div>
                ${data.autoLogs.slice(0, 2).map(l => `<div class="small" style="padding:6px 0;border-top:1px solid var(--line-2);color:var(--ink-2)">
                  <b>${esc(l.EQP_ID)}</b> ${esc(l.FROM_STATUS)} → ${esc(l.TO_STATUS)}
                  <span class="muted" style="float:right">${esc(relTime(l.TRX_DT))}</span>
                </div>`).join('')}</div>` : ''}
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h3>${icon('play', 15)} ${esc(t('快捷作业'))}</h3></div>
            <div class="card-body">
              <div class="quick-links">
                <a class="quick-link" href="#/page/AVPA002"><span class="ql-icon">${icon('bell', 14)}</span>${esc(t('警报手动发送作业'))}<span class="ql-arrow">${icon('chevronRight', 13)}</span></a>
                <a class="quick-link" href="#/page/AVPA009"><span class="ql-icon">${icon('edit', 14)}</span>${esc(t('警报补登作业'))}<span class="ql-arrow">${icon('chevronRight', 13)}</span></a>
                <a class="quick-link" href="#/page/AVPA013"><span class="ql-icon">${icon('chart', 14)}</span>${esc(t('即时警报彙整'))}<span class="ql-arrow">${icon('chevronRight', 13)}</span></a>
                <a class="quick-link" href="#/page/AVPA006"><span class="ql-icon">${icon('x', 14)}</span>${esc(t('警报强制中断作业'))}<span class="ql-arrow">${icon('chevronRight', 13)}</span></a>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
    container.querySelector('#dash-refresh').addEventListener('click', () => load());
    container.querySelectorAll('[data-alarm]').forEach(el => {
      el.addEventListener('click', () => openAlarmDrawer(ctx, el.dataset.alarm, () => load(true)));
    });
  };

  await load();
  const timer = setInterval(() => load(true), 30000);
  ctx.registerCleanup(() => clearInterval(timer));
}

function kpiCard(label, value, iconName, foot, footIcon, cls, suffix = '') {
  return `<div class="kpi-card ${cls}">
    <div class="kpi-top">
      <div class="kpi-label">${esc(t(label))}</div>
      <div class="kpi-icon">${icon(iconName, 15)}</div>
    </div>
    <div class="kpi-value">${value}${suffix ? `<small>${suffix}</small>` : ''}</div>
    <div class="kpi-foot">${icon(footIcon, 11)} ${esc(t(foot))}</div>
  </div>`;
}
