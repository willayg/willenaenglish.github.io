/**
 * Cloudflare Worker: verify-student
 * Replacement for Netlify function verify_student.js
 * Validates student identity via Supabase REST, with in-memory rate limiting.
 */

const ALLOWED_ORIGINS = [
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://cf.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:9000'
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-store',
  };
}

function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

const RATE = { ip: new Map(), user: new Map() };
const MAX_FAILED = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 5 * 60 * 1000;

function normalize(val) {
  return (val || '')
    .toString()
    .trim()
    .normalize('NFC')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function buildIlikePattern(val) {
  if (!val) return null;
  const escaped = val.replace(/[%_]/g, ch => `\\${ch}`);
  return `%${escaped}%`;
}

function getClientIp(request) {
  const h = request.headers;
  return (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim() || 'unknown';
}

function checkRate(map, key, success) {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry) {
    entry = { count: 0, firstAt: now, lockedUntil: 0 };
    map.set(key, entry);
  }

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { blocked: true, retryAfterMs: entry.lockedUntil - now };
  }

  if (success) {
    map.delete(key);
    return { blocked: false };
  }

  if (now - entry.firstAt > WINDOW_MS) {
    entry.count = 0;
    entry.firstAt = now;
  }

  entry.count += 1;
  if (entry.count >= MAX_FAILED) {
    entry.lockedUntil = now + LOCKOUT_MS;
    return { blocked: true, retryAfterMs: LOCKOUT_MS };
  }

  return { blocked: false };
}

function isBlocked(map, key) {
  const entry = map.get(key);
  return entry && entry.lockedUntil && entry.lockedUntil > Date.now();
}

async function fetchCandidates(env, koreanPattern, englishPattern, limit = 50) {
  const params = new URLSearchParams();
  params.set('role', 'eq.student');
  params.set('select', 'id,username,email,name,korean_name,phone');
  params.set('limit', String(limit));
  if (koreanPattern) params.set('korean_name', `ilike.${koreanPattern}`);
  if (englishPattern) params.set('name', `ilike.${englishPattern}`);

  const url = `${env.SUPABASE_URL}/rest/v1/profiles?${params.toString()}`;
  const resp = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Supabase query failed: ${resp.status} ${msg}`);
  }

  return await resp.json();
}

async function insertAudit(env, record) {
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/auth_password_audit`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([record]),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.warn('[verify-student] audit insert failed:', resp.status, txt);
    }
  } catch (e) {
    console.warn('[verify-student] audit insert threw:', e.message);
  }
}

function matchRecord(row, normalizedKoreanInput, normalizedEnglishInput, normalizedAuthCode) {
  if (!row || !row.phone) return false;
  const nk = normalize(row.korean_name);
  const ne = normalize(row.name);
  const koreanMatches = normalizedKoreanInput
    ? nk.includes(normalizedKoreanInput) || normalizedKoreanInput.includes(nk)
    : false;
  const englishMatches = normalizedEnglishInput
    ? ne.includes(normalizedEnglishInput) || normalizedEnglishInput.includes(ne)
    : false;
  if (!koreanMatches || !englishMatches) return false;

  const phoneDigits = String(row.phone).replace(/\D/g, '');
  if (phoneDigits.length < 4) return false;
  return phoneDigits.slice(-4) === normalizedAuthCode;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: getCorsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, origin);
    }

    if (!body || typeof body !== 'object') {
      return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, origin);
    }

    const { korean_name, name, auth_code } = body;
    if (!korean_name || !name || !auth_code) {
      return jsonResponse({ success: false, error: 'Missing required fields' }, 400, origin);
    }

    const koreanNameValue = String(korean_name).trim();
    const englishNameValue = String(name).trim();
    const normalizedKoreanInput = normalize(koreanNameValue);
    const normalizedEnglishInput = normalize(englishNameValue);
    const normalizedAuthCode = String(auth_code).replace(/\D/g, '').slice(-4);

    if (normalizedAuthCode.length !== 4) {
      return jsonResponse({ success: false, error: 'Authentication code must be 4 digits.' }, 400, origin);
    }

    const clientIp = getClientIp(request);
    const userKey = `user:${normalizedKoreanInput}|${normalizedEnglishInput}`;

    // Check existing lockouts without incrementing
    if (isBlocked(RATE.ip, clientIp)) {
      return jsonResponse({ success: false, error: 'Too many requests from this IP. Try again later.' }, 429, origin);
    }
    if (isBlocked(RATE.user, userKey)) {
      return jsonResponse({ success: false, error: 'Too many attempts for this user. Try again later.' }, 429, origin);
    }

    const patternVariants = [
      { korean: buildIlikePattern(koreanNameValue), english: buildIlikePattern(englishNameValue) },
      { korean: null, english: buildIlikePattern(englishNameValue) },
      { korean: buildIlikePattern(koreanNameValue), english: null },
    ].filter(v => v.korean || v.english);

    let records = [];
    let lastErr = null;

    try {
      for (const variant of patternVariants) {
        const data = await fetchCandidates(env, variant.korean, variant.english, 50);
        if (Array.isArray(data) && data.length) {
          records = data;
          break;
        }
      }

      if (!records.length) {
        const fallback = await fetchCandidates(env, null, null, 25);
        records = Array.isArray(fallback) ? fallback : [];
      }
    } catch (e) {
      lastErr = e;
    }

    if (!records.length && lastErr) {
      return jsonResponse({ success: false, error: 'Database error occurred.' }, 500, origin);
    }

    const match = records.find(row => matchRecord(row, normalizedKoreanInput, normalizedEnglishInput, normalizedAuthCode));
    const hadNameMatches = records.length > 0;
    const hasPhoneData = records.some(r => r && r.phone);

    if (!match) {
      await insertAudit(env, {
        user_id: null,
        actor: null,
        source: 'verify_student',
        ip: clientIp,
        action: 'easy_login_attempt',
        success: false,
        timestamp: new Date().toISOString(),
        note: 'not_found',
        extra: JSON.stringify({ matchedOnName: hadNameMatches, anyPhonePresent: hasPhoneData })
      });

      checkRate(RATE.ip, clientIp, false);
      checkRate(RATE.user, userKey, false);

      return jsonResponse({ success: false, error: 'Student not found. Please check your information.' }, 404, origin);
    }

    await insertAudit(env, {
      user_id: match.id,
      actor: match.username,
      source: 'verify_student',
      ip: clientIp,
      action: 'easy_login_attempt',
      success: true,
      timestamp: new Date().toISOString(),
      note: 'success'
    });

    checkRate(RATE.ip, clientIp, true);
    checkRate(RATE.user, userKey, true);

    return jsonResponse({
      success: true,
      student: {
        id: match.id,
        username: match.username,
        email: match.email,
        name: match.name,
        korean_name: match.korean_name
      }
    }, 200, origin);
  }
};
