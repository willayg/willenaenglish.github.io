// Test Admin API: create/list tests and upsert entries
// Tables (create these in Supabase):
// create table if not exists tests (
//   id uuid primary key default gen_random_uuid(),
//   name text not null,
//   date date,
//   columns jsonb not null,
//   class text,
//   created_by uuid,
//   created_at timestamptz default now()
// );
// create table if not exists test_entries (
//   id uuid primary key default gen_random_uuid(),
//   test_id uuid references tests(id) on delete cascade,
//   user_id uuid references profiles(id) on delete cascade,
//   data jsonb not null,
//   updated_at timestamptz default now(),
//   unique(test_id, user_id)
// );

function makeCorsHeaders(event, extra = {}) {
  const ALLOWLIST = new Set([
    'https://www.willenaenglish.com',
    'https://willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'http://localhost:9000',
    'http://localhost:8888',
  ]);
  const hdrs = event.headers || {};
  const origin = (hdrs.origin || hdrs.Origin || '').trim();
  const allow = ALLOWLIST.has(origin) ? origin : 'https://willenaenglish.netlify.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    ...extra,
  };
}

function respond(event, statusCode, bodyObj, extraHeaders = {}) {
  return { statusCode, headers: { ...makeCorsHeaders(event), 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(bodyObj) };
}

function cookieToken(event) {
  const hdrs = event.headers || {};
  const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
  const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
  return m ? decodeURIComponent(m[1]) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };

  const qs = event.queryStringParameters || {};
  const action = qs.action;

  let createClient;
  try { ({ createClient } = await import('@supabase/supabase-js')); }
  catch { ({ createClient } = require('@supabase/supabase-js')); }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return respond(event, 500, { success:false, error:'Missing env' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const db = admin;

  // Auth
  const access = cookieToken(event);
  if (!access) return respond(event, 401, { success:false, error:'Not signed in' });
  let actorId = null, role = null; let isTeacher=false, isAdmin=false;
  try {
    const { data, error } = await admin.auth.getUser(access);
    if (error || !data?.user) return respond(event, 401, { success:false, error:'Not signed in' });
    actorId = data.user.id;
    const { data: prof } = await db.from('profiles').select('role').eq('id', actorId).single();
    role = String(prof?.role||'').toLowerCase();
    isAdmin = role==='admin'; isTeacher = role==='teacher';
    if (!isAdmin && !isTeacher) return respond(event, 403, { success:false, error:'Forbidden' });
  } catch {
    return respond(event, 401, { success:false, error:'Not signed in' });
  }

  // Helpers to parse body
  function getBody() { try { return JSON.parse(event.body||'{}'); } catch { return {}; } }

  try {
    if (action === 'create_test' && event.httpMethod === 'POST') {
      const body = getBody();
      const name = (body.name||'').trim();
      const date = body.date || null;
      const columns = Array.isArray(body.columns) ? body.columns : [];
      const klass = (body.class||'').trim() || null;
      if (!name || !columns.length) return respond(event, 400, { success:false, error:'name and columns required' });
      const insert = { name, date, columns, class: klass, created_by: actorId };
      const { data, error } = await db.from('tests').insert(insert).select('*').single();
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true, test: data });
    }

    if (action === 'list_tests' && event.httpMethod === 'GET') {
      const month = (qs.month||'').trim(); // YYYY-MM
      let q = db.from('tests').select('id, name, date, class, created_at').order('created_at', { ascending:false }).limit(200);
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const start = month + '-01';
        const end = month + '-31';
        q = q.gte('date', start).lte('date', end);
      }
      const { data, error } = await q;
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true, tests: data });
    }

    if (action === 'get_test' && event.httpMethod === 'GET') {
      const id = (qs.test_id||'').trim();
      if (!id) return respond(event, 400, { success:false, error:'test_id required' });
      const { data: test, error } = await db.from('tests').select('*').eq('id', id).single();
      if (error || !test) return respond(event, 404, { success:false, error:'Not found' });
      const { data: entries } = await db.from('test_entries').select('user_id, data').eq('test_id', id);
      return respond(event, 200, { success:true, test, entries: entries||[] });
    }

    if (action === 'upsert_entries' && event.httpMethod === 'POST') {
      const body = getBody();
      const test_id = (body.test_id||'').trim();
      const entries = Array.isArray(body.entries) ? body.entries : [];
      if (!test_id || !entries.length) return respond(event, 400, { success:false, error:'test_id and entries required' });
      // Validate test exists
      const { data: test } = await db.from('tests').select('id').eq('id', test_id).single();
      if (!test) return respond(event, 404, { success:false, error:'Test not found' });

      let upserted = 0; let failed = 0;
      for (const e of entries) {
        const rec = { test_id, user_id: e.user_id, data: e.data, updated_at: new Date().toISOString() };
        const { error } = await db.from('test_entries').upsert(rec, { onConflict:'test_id,user_id' });
        if (error) failed++; else upserted++;
      }
      return respond(event, 200, { success:true, upserted, failed });
    }

    if (action === 'update_test' && event.httpMethod === 'POST') {
      const body = getBody();
      const id = (body.test_id||'').trim();
      if (!id) return respond(event, 400, { success:false, error:'test_id required' });
      const patch = {};
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
      if (body.date === null || (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date))) patch.date = body.date;
      if (typeof body.class === 'string') patch.class = body.class.trim() || null;
      if (Array.isArray(body.columns)) patch.columns = body.columns;
      if (!Object.keys(patch).length) return respond(event, 400, { success:false, error:'nothing to update' });
      const { data, error } = await db.from('tests').update(patch).eq('id', id).select('*').single();
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true, test: data });
    }

    if (action === 'delete_test' && event.httpMethod === 'POST') {
      if (!isAdmin) return respond(event, 403, { success:false, error:'Admins only' });
      const body = getBody();
      const id = (body.test_id||'').trim();
      if (!id) return respond(event, 400, { success:false, error:'test_id required' });
      const { error } = await db.from('tests').delete().eq('id', id);
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true });
    }

    return respond(event, 404, { success:false, error:'Action not found' });
  } catch (e) {
    return respond(event, 500, { success:false, error: e?.message || 'Internal error' });
  }
};
