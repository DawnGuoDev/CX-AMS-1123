'use strict';

const crypto = require('crypto');
const { getDb, hashPassword } = require('./db');

const sessions = new Map();
const SESSION_EXPIRE_MS = 30 * 60 * 1000;

function publicUser(u) {
  if (!u) return null;
  const { PASSWORD_HASH, ...rest } = u;
  return rest;
}

function login(userId, password, req) {
  const db = getDb();
  const user = db.users.find(u => u.USER_ID === String(userId || '').trim());
  if (!user || user.ACTIVE === 'N') return { ok: false, message: '账号不存在或已停用' };
  if (user.PASSWORD_HASH !== hashPassword(password || '')) return { ok: false, message: '密码错误' };
  // 单一会话：新登入踢出旧会话
  for (const [token, s] of sessions.entries()) {
    if (s.user.USER_KEY === user.USER_KEY) sessions.delete(token);
  }
  const token = crypto.randomBytes(24).toString('hex');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const session = {
    token,
    user: publicUser(user),
    loginAt: new Date().toISOString(),
    lastSeen: Date.now(),
    ip: ip || '127.0.0.1',
    host: 'AMS-WEB01'
  };
  sessions.set(token, session);
  return { ok: true, token, user: session.user, loginAt: session.loginAt };
}

function logout(token) {
  sessions.delete(token);
}

function cleanup() {
  const now = Date.now();
  for (const [token, s] of sessions.entries()) {
    if (now - s.lastSeen > SESSION_EXPIRE_MS) sessions.delete(token);
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && req.query.token) token = String(req.query.token);
  if (!token) return res.status(401).json({ ok: false, message: '请先登入', code: 'NO_SESSION' });
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ ok: false, message: '登入已逾时，请重新登入', code: 'SESSION_EXPIRED' });
  if (Date.now() - session.lastSeen > SESSION_EXPIRE_MS) {
    sessions.delete(token);
    return res.status(401).json({ ok: false, message: '登入已逾时，请重新登入', code: 'SESSION_EXPIRED' });
  }
  session.lastSeen = Date.now();
  const user = getDb().users.find(u => u.USER_KEY === session.user.USER_KEY);
  if (!user || user.ACTIVE === 'N') {
    sessions.delete(token);
    return res.status(401).json({ ok: false, message: '账号已停用', code: 'USER_DISABLED' });
  }
  req.user = publicUser(user);
  req.token = token;
  req.session = session;
  next();
}

setInterval(cleanup, 60 * 1000).unref();

module.exports = { login, logout, authMiddleware, publicUser, SESSION_EXPIRE_MS };
