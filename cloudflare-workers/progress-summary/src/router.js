import baseWorker from './index.js';
import { handleTeacherInsights } from './teacher-insights.js';

const ALLOWED_ORIGINS = new Set([
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://cf.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000',
]);

function cors(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://teachers.willenaenglish.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status = 200, origin = '', cacheSeconds = 0) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) };
  headers['Cache-Control'] = cacheSeconds > 0 ? `private, max-age=${cacheSeconds}` : 'private, no-store';
  return new Response(JSON.stringify(data), { status, headers });
}

function parseCookies(raw) {
  const out = {};
  String(raw || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0,i).trim()] = decodeURIComponent(part.slice(i+1).trim());
  });
  return out;
}

function accessToken(request) {
  const auth = String(request.headers.get('Authorization') || '');
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i,'').trim();
  const cookies = parseCookies(request.headers.get('Cookie'));
  return cookies.sb_access || cookies['sb-access'] || '';
}

async function getUser(env, token) {
  if (!token) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function supabaseSelect(env, table, query) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!r.ok) throw new Error(`Supabase ${table} query failed: ${await r.text()}`);
  return r.json();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const section = String(url.searchParams.get('section') || '').toLowerCase();
    if (!section.startsWith('teacher_')) return baseWorker.fetch(request, env, ctx);

    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'GET') return jsonResponse({ success:false, error:'Method Not Allowed' }, 405, origin);
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return jsonResponse({ success:false, error:'Teacher insights service misconfigured' }, 500, origin);

    try {
      const user = await getUser(env, accessToken(request));
      if (!user || !user.id) return jsonResponse({ success:false, error:'Not signed in' }, 401, origin);
      return await handleTeacherInsights({ request, env, userId:user.id, section, origin, jsonResponse, supabaseSelect });
    } catch (error) {
      console.error('[teacher-insights] error', error);
      return jsonResponse({ success:false, error:error?.message || 'Teacher insights failed' }, 500, origin);
    }
  }
};
