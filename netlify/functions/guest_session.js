// Guest session: create and read a simple guest identity
// - GET: returns current guest { id, name } if cookies exist
// - POST: body { name } -> sets wa_guest_id and wa_guest_name cookies for 30 days

function json(status, body, headers = {}, cookies /* string[] */) {
  const res = { statusCode: status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }, body: JSON.stringify(body) };
  if (cookies && cookies.length) res.multiValueHeaders = { 'Set-Cookie': cookies };
  return res;
}

function parseCookies(header) {
  const out = {}; if (!header) return out;
  header.split(/;\s*/).forEach(kv => { const i = kv.indexOf('='); if (i > 0) { const k = kv.slice(0, i).trim(); const v = kv.slice(i + 1).trim(); if (k && !(k in out)) out[k] = decodeURIComponent(v); } });
  return out;
}

function isLocalDev(event) {
  const hdrs = event?.headers || {}; const host = String(hdrs.host || hdrs.Host || '').toLowerCase();
  return host.startsWith('localhost:') || host.startsWith('127.0.0.1');
}

function cookie(name, value, event, { maxAge, secure = true, httpOnly = false, sameSite = 'Lax', path = '/' } = {}) {
  const hdrs = event?.headers || {}; const host = hdrs.host || hdrs.Host || '';
  let s = `${name}=${encodeURIComponent(value ?? '')}`;
  if (maxAge != null) s += `; Max-Age=${maxAge}`;
  if (path) s += `; Path=${path}`;
  if (/willenaenglish\.com$/i.test(host)) s += '; Domain=.willenaenglish.com';
  if (secure) s += '; Secure';
  if (httpOnly) s += '; HttpOnly';
  if (sameSite) s += `; SameSite=${sameSite}`;
  return s;
}

function sanitizeName(raw) {
  const s = String(raw || '').trim();
  let t = s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
  // Allow: ASCII letters/numbers/underscore/space/-.', plus Hangul Jamo and Syllables
  // Avoid Unicode property escapes to support older Node runtimes
  t = t.replace(/[^\w \-.'\u3131-\u318E\uAC00-\uD7A3]/g, '');
  if (!t) t = 'Guest';
  return t.slice(0, 32);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }, body: '' };
  }

  const dev = isLocalDev(event);
  const cookieFlags = { maxAge: 60 * 60 * 24 * 30, sameSite: dev ? 'Lax' : 'None', secure: !dev, httpOnly: false };

  if (event.httpMethod === 'GET') {
    const hdrs = event.headers || {}; const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
    const c = parseCookies(cookieHeader);
    const id = c['wa_guest_id'] || null; const name = c['wa_guest_name'] || null;
    return json(200, { success: true, guest: id ? { id, name: name || 'Guest' } : null });
  }

  if (event.httpMethod === 'POST') {
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
    const desiredName = sanitizeName(body.name);
    function genId(){
      try {
        const { randomUUID } = require('crypto');
        if (typeof randomUUID === 'function') return randomUUID();
      } catch {}
      try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      } catch {}
      return 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
    const guestId = genId();
    const cookies = [
      cookie('wa_guest_id', guestId, event, cookieFlags),
      cookie('wa_guest_name', desiredName, event, cookieFlags),
    ];
    return json(200, { success: true, guest: { id: guestId, name: desiredName } }, {}, cookies);
  }

  return json(405, { success: false, error: 'Method not allowed' });
};
