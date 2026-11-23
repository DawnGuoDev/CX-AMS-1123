'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildSeed } = require('./seed');

const DATA_DIR = process.env.AMS_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;
let writeTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!db.meta || !db.settings) throw new Error('invalid db');
      return db;
    } catch (err) {
      const backup = DB_FILE + '.broken-' + Date.now();
      fs.copyFileSync(DB_FILE, backup);
      console.warn('[AMS] 资料档损毁，已备份至', backup, '并重新建立种子资料');
    }
  }
  db = buildSeed();
  saveNow();
  return db;
}

function getDb() {
  if (!db) load();
  return db;
}

function saveNow() {
  if (!db) return;
  ensureDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function save() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try { saveNow(); } catch (err) { console.error('[AMS] 储存失败', err); }
  }, 40);
}

function nextKey(table, prefix, width = 3) {
  const d = getDb();
  d.meta.seq[table] = (d.meta.seq[table] || 0) + 1;
  return prefix + String(d.meta.seq[table]).padStart(width, '0');
}

function nextAlarmId() {
  const d = getDb();
  d.meta.seq.alarmId = (d.meta.seq.alarmId || 1000) + 1;
  return '0000000000' + d.meta.seq.alarmId.toString(16).toUpperCase().padStart(5, '0');
}

function hashPassword(pw) {
  return crypto.createHash('sha256').update('ams::' + String(pw)).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function addHistory({ table, recordKey, label, action, active = 'Y', before = null, after = null, user, ip = '127.0.0.1', host = 'AMS-WEB01' }) {
  const d = getDb();
  const key = nextKey('history', 'H', 6);
  const entry = {
    HIST_KEY: key,
    TABLE_NAME: table,
    RECORD_KEY: recordKey,
    RECORD_LABEL: label || recordKey,
    ACTION: action,
    ACTIVE: active,
    BEFORE_JSON: before ? JSON.stringify(before) : null,
    AFTER_JSON: after ? JSON.stringify(after) : null,
    TRX_DT: nowIso(),
    USER_KEY: user ? user.USER_KEY : null,
    USER_ID: user ? user.USER_ID : 'SYSTEM',
    USER_NAME: user ? user.USER_NAME : '系统',
    IP: ip,
    HOST: host
  };
  d.history.unshift(entry);
  if (d.history.length > 3000) d.history.length = 3000;
  save();
  return entry;
}

function resetDb() {
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
  db = buildSeed();
  saveNow();
}

module.exports = {
  DB_FILE,
  getDb,
  load,
  save,
  saveNow,
  nextKey,
  nextAlarmId,
  hashPassword,
  addHistory,
  nowIso,
  resetDb
};
