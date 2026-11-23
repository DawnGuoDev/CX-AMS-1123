'use strict';

import {
  esc, icon, statusChip, openDrawer, openModal, toast, confirmDialog, trxLabel, channelLabel, withLoading
} from '../ui.js';
import { t, fmtDT } from '../i18n.js';

export async function openAlarmDrawer(ctx, alarmKey, onChange) {
  let data;
  try {
    const res = await ctx.api.get('/api/alarms/' + encodeURIComponent(alarmKey));
    data = res.alarm;
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  let tab = 'info';
  let countdownTimer = null;
  const body = document.createElement('div');
  const footer = document.createElement('div');
  footer.className = 'modal-actions';

  const drawer = openDrawer({
    title: t('警报详情'),
    subtitle: data.ALARM_ID,
    width: 760,
    body,
    footer,
    onClose: () => {
      if (countdownTimer) clearInterval(countdownTimer);
    }
  });

  const render = () => {
    const a = data;
    const levelPills = (a.LEVELS || []).map(lv => {
      const cls = lv.LEVEL_ID === a.CURRENT_LEVEL && a.STATUS === 'Process' ? 'active' : lv.STATUS === 'Closed' ? 'done' : '';
      return `<div class="level-pill ${cls}">
        <div class="lp-name">LEVEL-${lv.LEVEL_ID} ${esc(lv.LEVEL_DESC || '')}</div>
        <div class="lp-val">${lv.ACK_COUNT} / ${lv.REQUIRED_ACK} ${esc(t('确认人数'))}</div>
        <div class="lp-sub">${esc(fmtDT(lv.START_DT))}</div>
      </div>`;
    }).join('');
    const ackHtml = (a.ACK_USERS || []).length
      ? `<div class="ack-list">${a.ACK_USERS.map(u => `<span class="ack-person">${icon('check', 11)}${esc(u.USER_ID)} ${esc(u.USER_NAME)}</span>`).join('')}</div>`
      : `<span class="muted small">${esc(t('尚无资料'))}</span>`;
    const content = `
      <div class="alarm-hero">
        <div>
          <div class="alarm-hero-title">${esc(a.TITLE || '')}</div>
          <div class="alarm-hero-meta">
            <span>${icon('factory', 12)}${esc(a.FACTORY_ID)} ${esc(a.FACTORY_NAME)}</span>
            <span>${icon('eqp', 12)}${esc(a.SUB_SYS_ID)} / ${esc(a.EQP_ID)}</span>
            <span>${icon('clock', 12)}${esc(fmtDT(a.CREATE_DT))}</span>
          </div>
        </div>
        <div style="text-align:right">
          ${statusChip(a.STATUS)}
          <div class="alarm-countdown" id="alarm-countdown" style="margin-top:7px;${a.STATUS === 'Process' ? '' : 'display:none'}">–</div>
        </div>
      </div>
      <div class="tabs" id="detail-tabs">
        <button class="tab ${tab === 'info' ? 'active' : ''}" data-tab="info">${esc(t('警报资讯'))}</button>
        <button class="tab ${tab === 'notify' ? 'active' : ''}" data-tab="notify">${esc(t('通知纪录'))}<span class="tab-count">${a.NOTIFICATIONS.length}</span></button>
        <button class="tab ${tab === 'trx' ? 'active' : ''}" data-tab="trx">${esc(t('交易履历'))}<span class="tab-count">${a.TRANSACTIONS.length}</span></button>
      </div>
      <div id="detail-content" style="padding-top:14px"></div>
    `;
    body.innerHTML = content;
    const contentEl = body.querySelector('#detail-content');
    if (tab === 'info') {
      contentEl.innerHTML = `
        ${levelPills ? `<div class="level-strip">${levelPills}</div>` : ''}
        <div class="info-grid">
          ${infoCell('警报识别码', a.ALARM_ID)}
          ${infoCell('状态', statusChip(a.STATUS), true)}
          ${infoCell('厂别', `${a.FACTORY_ID} ${a.FACTORY_NAME}`)}
          ${infoCell('子系统', `${a.SUB_SYS_ID} ${a.SUB_SYS_NAME}`)}
          ${infoCell('机台', `${a.EQP_ID} ${a.EQP_NAME || ''}`)}
          ${infoCell('警报代码', a.ALARM_INFO_ID || '–')}
          ${infoCell('警报说明', a.ALARM_ID_DESC || '–')}
          ${infoCell('事件通知', a.EVENT_ID ? `${a.EVENT_ID} ${a.EVENT_NAME || ''}` : t('手动发送'))}
          ${infoCell('目前层级', 'LEVEL-' + a.CURRENT_LEVEL)}
          ${infoCell('优先权代码', a.PRIORITY)}
          ${infoCell('需要回应人数', a.LEVEL_REQUIRED == null ? '–' : a.LEVEL_REQUIRED)}
          ${infoCell('已确认人数', a.LEVEL_ACK_COUNT == null ? '–' : a.LEVEL_ACK_COUNT)}
          ${infoCell('首次开始处理时间', fmtDT(a.FIRST_PROCESS_DT))}
          ${infoCell('处理完成日期时间', fmtDT(a.COMPLETE_DT) || '–')}
          ${infoCell('资料取得方式', a.RECEIVE_TYPE)}
          ${infoCell('资料来源', a.IS_MANUAL === 'Y' ? t('手动发送') : t('补登'))}
          ${infoCell('最后 ACK 时间', fmtDT(a.LAST_ACK_DT) || '–')}
          ${infoCell('回应备注', a.ACK_CMT || '–')}
        </div>
        <div class="card-head" style="border:0;padding:16px 0 7px"><h3>${esc(t('警报详细内容'))}</h3></div>
        <div class="content-box">${esc(a.CONTENT || '–')}</div>
        <div class="card-head" style="border:0;padding:16px 0 7px"><h3>${esc(t('已确认人员'))} <span class="card-sub">${a.LEVEL_ACK_COUNT || 0} / ${a.LEVEL_REQUIRED == null ? '–' : a.LEVEL_REQUIRED}</span></h3></div>
        ${ackHtml}
      `;
    } else if (tab === 'notify') {
      contentEl.innerHTML = a.NOTIFICATIONS.length ? `<div class="verify-table-wrap"><table class="verify-table notify-table">
        <colgroup><col style="width:150px"/><col style="width:56px"/><col style="width:145px"/><col style="width:66px"/><col style="width:200px"/><col style="width:78px"/></colgroup>
        <thead><tr><th>${esc(t('发送时间'))}</th><th>LEVEL</th><th>${esc(t('接收人'))}</th><th>${esc(t('渠道'))}</th><th>${esc(t('目标'))}</th><th>${esc(t('结果'))}</th></tr></thead>
        <tbody>${a.NOTIFICATIONS.map(n => `<tr>
          <td class="mono">${esc(fmtDT(n.SEND_DT))}</td>
          <td>L${esc(n.LEVEL_ID)}</td>
          <td title="${esc(n.USER_ID + ' ' + n.USER_NAME)}">${esc(n.USER_ID)} ${esc(n.USER_NAME)}</td>
          <td>${esc(channelLabel(n.CHANNEL))}</td>
          <td title="${esc(n.TARGET)}">${esc(n.TARGET)}</td>
          <td title="${esc(n.MESSAGE)}">${statusChip(n.RESULT === 'Success' ? 'Success' : 'Fail')}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<div class="empty-state">${icon('bell', 26)}<div class="empty-title mt-8">${esc(t('没有通知'))}</div></div>`;
    } else {
      contentEl.innerHTML = `<div class="timeline">${a.TRANSACTIONS.map(tr => {
        const cls = tr.TRX_TYPE === 'AlarmComplete' ? 'done' : tr.TRX_TYPE === 'AlarmFail' ? 'fail' : tr.TRX_TYPE === 'Terminate' ? 'warn' : tr.TRX_TYPE === 'LevelUpgrade' ? 'warn' : '';
        return `<div class="tl-item ${cls}">
          <div class="tl-head">#${tr.SEQ} ${esc(trxLabel(tr.TRX_TYPE))} <span class="badge badge-gray">${esc(tr.STATUS_AFTER || '')}</span></div>
          <div class="tl-time">${esc(fmtDT(tr.TRX_DT))} · ${esc(tr.USER_ID)} ${esc(tr.USER_NAME)}</div>
          ${tr.NOTE ? `<div class="tl-note">${esc(tr.NOTE)}</div>` : ''}
        </div>`;
      }).join('')}</div>`;
    }
    body.querySelectorAll('#detail-tabs .tab').forEach(btn => {
      btn.addEventListener('click', () => { tab = btn.dataset.tab; render(); });
    });
    // footer
    footer.innerHTML = `
      <button class="btn btn-ghost" id="detail-open-confirm">${esc(t('打开确认页'))} ${icon('arrowRight', 14)}</button>
      ${a.CAN_TERMINATE ? `<button class="btn btn-danger" id="detail-terminate">${esc(t('警报中断'))}</button>` : ''}
      ${a.CAN_ACK ? `<button class="btn btn-primary" id="detail-ack">${esc(t('警报确认'))}</button>` : ''}
    `;
    footer.querySelector('#detail-open-confirm').addEventListener('click', () => {
      drawer.close();
      ctx.navigate('#/confirm/' + encodeURIComponent(a.ALARM_KEY));
    });
    const ackBtn = footer.querySelector('#detail-ack');
    if (ackBtn) ackBtn.addEventListener('click', () => ackAction(ctx, a, () => { drawer.close(); if (onChange) onChange(); }));
    const termBtn = footer.querySelector('#detail-terminate');
    if (termBtn) termBtn.addEventListener('click', () => terminateAction(ctx, a, () => { drawer.close(); if (onChange) onChange(); }));
    startCountdown();
  };

  const startCountdown = () => {
    if (countdownTimer) clearInterval(countdownTimer);
    const el = body.querySelector('#alarm-countdown');
    if (!el) return;
    if (data.STATUS !== 'Process') { el.style.display = 'none'; return; }
    const tick = () => {
      const start = new Date(data.LEVEL_START || data.LEVEL_PROCESS_DT).getTime();
      const interval = Number(data.LEVEL_INTERVAL_SEC || 0) * 1000;
      const left = Math.max(0, Math.round((start + interval - Date.now()) / 1000));
      const m = Math.floor(left / 60);
      const s = left % 60;
      el.textContent = (data.HAS_NEXT_LEVEL ? t('升级倒数') : t('升级倒数')) + ' ' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      if (left <= 0) el.textContent = t('升级') + '…';
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  };

  render();
  return drawer;
}

function infoCell(label, value, raw = false) {
  return `<div class="info-cell"><div class="ic-label">${esc(t(label))}</div><div class="ic-value">${raw ? value : esc(value == null || value === '' ? '–' : value)}</div></div>`;
}

export function ackAction(ctx, alarm, onDone, initialNote = '') {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="hint-bar mb-12">${icon('info', 15)}<div>${esc(t('警报确认'))} · ${esc(alarm.ALARM_ID)}<br/>${esc(alarm.TITLE || '')}<br/><span class="muted">确认后系统会累计回应人数，达标即完成警报。</span></div></div>
    <div class="form-field" style="grid-template-columns:1fr">
      <div class="form-control"><textarea class="input" id="ack-cmt" rows="3" placeholder="${esc(t('回应备注'))}">${esc(initialNote)}</textarea></div>
    </div>
  `;
  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'btn btn-ghost';
  cancel.textContent = t('取消');
  const ok = document.createElement('button');
  ok.className = 'btn btn-primary';
  ok.textContent = t('警报确认');
  footer.append(cancel, ok);
  const modal = openModal({ title: t('警报确认'), width: 520, body, footer, className: 'modal-sm' });
  cancel.addEventListener('click', modal.close);
  ok.addEventListener('click', async () => {
    ok.disabled = true;
    try {
      const res = await ctx.api.post(`/api/alarms/${encodeURIComponent(alarm.ALARM_KEY)}/ack`, { cmt: body.querySelector('#ack-cmt').value.trim() });
      modal.close();
      toast(res.completed ? t('警报已确认') + ' · ' + t('完成') : t('警报已确认'));
      window.dispatchEvent(new CustomEvent('ams:inbox-refresh'));
      if (onDone) onDone(res);
    } catch (err) {
      toast(err.message, 'error');
      ok.disabled = false;
    }
  });
}

export function terminateAction(ctx, alarm, onDone) {
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="hint-bar warn mb-12">${icon('warning', 15)}<div>${esc(t('中断后警报将无法再确认'))}<br/>${esc(alarm.ALARM_ID)} · ${esc(alarm.TITLE || '')}</div></div>
    <div class="form-field" style="grid-template-columns:1fr">
      <div class="form-control"><textarea class="input" id="term-cmt" rows="3" placeholder="${esc(t('备注'))}"></textarea></div>
    </div>
  `;
  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'btn btn-ghost';
  cancel.textContent = t('取消');
  const ok = document.createElement('button');
  ok.className = 'btn btn-danger';
  ok.textContent = t('警报中断');
  footer.append(cancel, ok);
  const modal = openModal({ title: t('警报中断'), width: 520, body, footer, className: 'modal-sm' });
  cancel.addEventListener('click', modal.close);
  ok.addEventListener('click', async () => {
    ok.disabled = true;
    try {
      const res = await ctx.api.post(`/api/alarms/${encodeURIComponent(alarm.ALARM_KEY)}/terminate`, { cmt: body.querySelector('#term-cmt').value.trim() });
      modal.close();
      toast(t('警报已中断'));
      window.dispatchEvent(new CustomEvent('ams:inbox-refresh'));
      if (onDone) onDone(res);
    } catch (err) {
      toast(err.message, 'error');
      ok.disabled = false;
    }
  });
}
