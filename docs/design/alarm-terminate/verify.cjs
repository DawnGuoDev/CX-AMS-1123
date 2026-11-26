// 校验脚本：确认原型关键交互（非产品运行代码）。
// 1) 在本目录启动静态服务，例如：python3 -m http.server 8097
// 2) 安装 playwright-core 并提供 Chromium 后执行：node verify.cjs
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
// Chromium 路径可用 CHROMIUM 覆盖，默认使用本机 chromium-browser。
const OUT = process.env.OUT || '.';
const URL = process.env.URL || 'http://127.0.0.1:8097/';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium-browser', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => console.log('PAGE ERR', e.message));
  const shot = async n => { await p.screenshot({path: OUT + n + '.png'}); console.log('shot', n); };
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  await p.screenshot({path: OUT + '00-作业总览.png', fullPage: true});
  // 1 有权限详情
  await p.evaluate(() => window.__proto.openDetail('ALK-0007')); await p.waitForTimeout(350);
  await shot('01-有权限详情');
  // 2 无权限详情
  await p.evaluate(() => { window.__proto.closeAll(); window.__proto.persona('operator'); window.__proto.openDetail('ALK-0007'); }); await p.waitForTimeout(350);
  await shot('02-无权限详情');
  // 3 二次确认
  await p.evaluate(() => { window.__proto.closeAll(); window.__proto.persona('admin'); window.__proto.openDetail('ALK-0007'); }); await p.waitForTimeout(300);
  await p.click('#btnTerminate'); await p.waitForTimeout(300);
  // 先展示空原因校验态，再填入原因 —— 截图取自填写后（校验通过）
  await p.click('#btnConfirmTerminate'); await p.waitForTimeout(150);
  const errShown = await p.locator('#cmtErr.show').isVisible();
  await p.fill('#cmtInput', '机台已修复，研磨液流量恢复正常，无需再通知与升级流程。'); await p.waitForTimeout(250);
  await shot('03-中断二次确认');
  // 4 中断后详情
  await p.click('#btnConfirmTerminate'); await p.waitForTimeout(1100);
  await p.evaluate(() => { document.querySelector('#detailOverlay .modal-body').scrollTop = 0; }); await p.waitForTimeout(300);
  await shot('04-中断后详情');
  // 额外：交易履历
  await p.click('#recordTabs [data-tab="TRANSACTIONS"]'); await p.waitForTimeout(400);
  await shot('05-中断后交易履历');
  const st = await p.evaluate(() => { const a = window.__proto.get('ALK-0007'); return {status:a.STATUS, notif:a.NOTIFICATIONS.map(n=>n.RESULT), levels:a.LEVELS.map(l=>l.STATUS), trx:a.TRANSACTIONS.map(t=>t.TRX_TYPE)}; });
  console.log('emptyCauseValidation=' + errShown, JSON.stringify(st));
  const ok = errShown && st.status === 'Terminated' && st.notif.join(',') === 'Success,Skipped'
    && st.levels.every(s => s === 'Closed') && st.trx.at(-1) === 'AlarmTerminate';
  console.log(ok ? 'VERIFY PASS' : 'VERIFY FAIL');
  if (!ok) process.exitCode = 1;
  await b.close();
})();
