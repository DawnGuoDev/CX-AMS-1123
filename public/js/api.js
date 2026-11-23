'use strict';

const TOKEN_KEY = 'ams_token';

export const api = {
  get token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  setToken(v) {
    if (v) localStorage.setItem(TOKEN_KEY, v);
    else localStorage.removeItem(TOKEN_KEY);
  },
  async request(method, url, body, opts = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: opts.signal
      });
    } catch (err) {
      throw new Error('无法连线至伺服器');
    }
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { message: text }; }
    if (res.status === 401) {
      this.setToken('');
      window.dispatchEvent(new CustomEvent('ams:unauthorized', { detail: data }));
    }
    if (!res.ok && !data.message) data.message = `HTTP ${res.status}`;
    if (!res.ok) {
      const err = new Error(data.message || '操作失败');
      err.data = data;
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  login(userId, password) { return this.post('/api/login', { userId, password }); },
  logout() { return this.post('/api/logout', {}); }
};

export function saveBase64(filename, base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveBlob(filename, blob);
}

export function saveBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
