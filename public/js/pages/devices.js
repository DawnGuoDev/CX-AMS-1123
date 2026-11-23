'use strict';

import { esc, icon, toast, showLoading, hideLoading, statusChip, emptyState } from '../ui.js';
import { t, fmtDT } from '../i18n.js';

export async function render(container, ctx) {
  let rows = [];
  let dirty = new Set();

  const load = async (silent = false) => {
    if (!silent) showLoading(t('读取中'));
    try {
      const res = await ctx.api.get('/api/devices');
      rows = res.rows;
      dirty = new Set();
      draw();
      ctx.setUpdated(new Date().toISOString());
    } catch (err) { toast(err.message, 'error'); } finally { if (!silent) hideLoading(); }
  };

  const draw = () => {
    const groups = {};
    rows.forEach(d => {
      const key = d.SERVER_ID + '||' + d.AGENT_ID;
      (groups[key] = groups[key] || []).push(d);
    });
    const statusCount = (s) => rows.filter(d => d.DEVICE_STATUS === s).length;
    container.innerHTML = `
      <div class="hint-bar mb-16">${icon('info', 15)}<div>勾选「启用」控制各 Agent 下的发送装置。修改后需按「储存」套用；装置状态需等待 Agent 下次检查才会更新。OK=正常、Unknown=尚未验证、Error=严重错误、NG=轻微错误、Close=已停用。</div></div>
      <div class="card">
        <div class="toolbar">
          <button class="tool-btn" id="device-refresh">${icon('refresh', 15)}<span>${esc(t('重新整理'))}</span></button>
          <button class="tool-btn tool-add" id="device-save">${icon('check', 15)}<span>${esc(t('储存'))}</span></button>
          <div class="toolbar-right">
            <div class="legend">
              <span><i style="background:var(--green)"></i>OK ${statusCount('OK')}</span>
              <span><i style="background:var(--red)"></i>Error ${statusCount('Error')}</span>
              <span><i style="background:var(--orange)"></i>NG ${statusCount('NG')}</span>
              <span><i style="background:#9aa9ba"></i>Unknown ${statusCount('Unknown')}</span>
              <span><i style="background:#65748a"></i>Close ${statusCount('Close')}</span>
            </div>
          </div>
        </div>
        <div class="dg-scroll">
          <table class="dg">
            <thead>
              <tr>
                <th style="width:70px">${esc(t('启用'))}</th>
                <th style="width:130px">${esc(t('Server 代码'))}</th>
                <th style="width:130px">${esc(t('Agent 代码'))}</th>
                <th style="width:130px">${esc(t('装置代码'))}</th>
                <th style="width:110px">${esc(t('装置状态'))}</th>
                <th>${esc(t('状态说明'))}</th>
                <th style="width:90px">${esc(t('接收'))}</th>
                <th style="width:90px">${esc(t('成功'))}</th>
                <th style="width:90px">${esc(t('失败'))}</th>
                <th style="width:160px">${esc(t('最后更新时间'))}</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(groups).map(([key, list]) => `
                <tr class="device-group-row"><td colspan="10">${icon('server', 13)} ${esc(list[0].SERVER_ID)} / ${esc(list[0].AGENT_ID)} · ${list.length} ${esc(t('装置'))}</td></tr>
                ${list.map(d => `<tr>
                  <td><label class="switch" style="height:auto"><input type="checkbox" data-device="${esc(d.DEVICE_KEY)}" ${d.ENABLE === 'Y' ? 'checked' : ''}/><span class="switch-track"></span></label></td>
                  <td class="mono">${esc(d.SERVER_ID)}</td>
                  <td class="mono">${esc(d.AGENT_ID)}</td>
                  <td><span class="device-name">${esc(d.DEVICE_ID)}</span></td>
                  <td>${statusChip(d.DEVICE_STATUS)}</td>
                  <td><span title="${esc(d.DEVICE_STATUS_DESC)}">${esc(d.DEVICE_STATUS_DESC)}</span></td>
                  <td class="num">${esc(d.RECEIVED_COUNT)}</td>
                  <td class="num">${esc(d.SUCCESSFUL_COUNT)}</td>
                  <td class="num" style="color:${d.FAIL_COUNT > 0 ? 'var(--red)' : 'inherit'}">${esc(d.FAIL_COUNT)}</td>
                  <td class="mono">${esc(fmtDT(d.TRX_DATE))}</td>
                </tr>`).join('')}
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    container.querySelectorAll('[data-device]').forEach(cb => {
      cb.addEventListener('change', () => dirty.add(cb.dataset.device));
    });
    container.querySelector('#device-refresh').addEventListener('click', () => { load(); toast(t('资料已更新'), 'info'); });
    container.querySelector('#device-save').addEventListener('click', async () => {
      if (!dirty.size) { toast(t('没有需要储存的变更'), 'info'); return; }
      const items = [...dirty].map(key => {
        const row = rows.find(d => d.DEVICE_KEY === key);
        const input = container.querySelector(`[data-device="${key}"]`);
        return { DEVICE_KEY: key, ENABLE: input.checked ? 'Y' : 'N' };
      });
      showLoading(t('储存'));
      try {
        const res = await ctx.api.post('/api/devices/save', { items });
        toast(`${t('储存成功')} · ${res.changed} ${t('笔')}`);
        await load(true);
      } catch (err) { toast(err.message, 'error'); } finally { hideLoading(); }
    });
  };

  await load();
}
