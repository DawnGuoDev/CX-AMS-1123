'use strict';

const path = require('path');
const express = require('express');
const { load, saveNow, getDb } = require('./src/db');
const api = require('./src/api');
const engine = require('./src/alarm-engine');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

load();
engine.startEngine();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'AMS', version: getDb().meta.version, time: new Date().toISOString() });
});

app.use('/api', api);
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  etag: true
}));

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, message: 'API 不存在' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[AMS] Unhandled error', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, message: '系统错误：' + err.message });
});

const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   AMS  Alarm Management System  v3.0.0       ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(`  本机网址 : http://localhost:${PORT}`);
  console.log('  演示账号 : E0043258 / 123456  (系统管理员)');
  console.log('             E0043288 / 123456  (值班主管)');
  console.log('             E0043271 / 123456  (制程工程师)');
  console.log(`  资料档   : ${path.join(__dirname, 'data', 'db.json')}`);
  console.log('');
});

function shutdown() {
  try { saveNow(); } catch (e) { /* ignore */ }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
