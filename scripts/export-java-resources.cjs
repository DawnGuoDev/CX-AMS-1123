// Development-only migration utility. Java runs independently of Node.js.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'backend/src/main/resources');
fs.mkdirSync(dir, { recursive: true });
const meta = require('../src/metadata');
const seed = require('../src/seed').buildSeed();
seed.meta.seededAt = new Date().toISOString();
// Resolve legacy demo rules against actual seed keys.
const alarmCodes = ['FDC_GASFLOW', 'EQP_OVERHEAT', 'MES_SERVICE_DOWN'];
seed.auto_status_rules.forEach((rule, index) => {
  const alarm = seed.alarm_settings.find(row => row.ALARM_INFO_ID === alarmCodes[index]);
  rule.ALARM_INFO_KEY = alarm.ALARM_INFO_KEY;
  rule.SUB_SYS_KEY = alarm.SUB_SYS_KEY;
  for (const field of ['INITIAL_STATUS', 'TARGET_STATUS', 'TARGET_STATUS2']) {
    if (rule[field]) rule[field] = seed.eqp_status.find(row => row.EQP_STATUS_ID === rule[field]).EQP_STATUS_KEY;
  }
});
fs.writeFileSync(path.join(dir, 'seed.json'), JSON.stringify(seed, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
  masters: meta.MASTERS, mappings: meta.MAPPINGS,
  masterDetails: meta.MASTER_DETAILS, pageTitles: meta.PAGE_TITLES,
}, null, 2) + '\n');
