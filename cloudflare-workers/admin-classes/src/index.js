const ALLOWED_ORIGINS = new Set([
  'https://staging.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://willenaenglish.github.io',
  'http://localhost:8888',
]);

const LEVELS = new Set(['S1','S2','1','2','3','4','5','6','7','8','9','10','Mixed']);

function cors(origin='') {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://staging.willenaenglish.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

function json(origin, status, body) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

function bearer(req) {
  const value = req.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function supabaseFetch(base, key, path, init={}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.message || data?.error_description || data?.error || `Supabase ${res.status}`);
  return data;
}

async function requireAdmin(req, env) {
  const token = bearer(req);
  if (!token) throw Object.assign(new Error('Not signed in'), { status: 401 });
  const userRes = await fetch(`${env.SCORES_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!userRes.ok) throw Object.assign(new Error('Invalid session'), { status: 401 });
  const user = await userRes.json();
  const rows = await supabaseFetch(
    env.SCORES_SUPABASE_URL,
    env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,approved&limit=1`
  );
  const profile = rows?.[0];
  if (!profile || String(profile.role).toLowerCase() !== 'admin' || profile.approved === false) {
    throw Object.assign(new Error('Admins only'), { status: 403 });
  }
  return user;
}

function cleanLevel(raw, hasBooks) {
  if (hasBooks) return null;
  const value = String(raw || '').trim();
  if (!value) return null;
  if (!LEVELS.has(value)) throw Object.assign(new Error('Invalid level'), { status: 400 });
  return value;
}

async function validateBooks(env, rawBooks) {
  const cleaned = (Array.isArray(rawBooks) ? rawBooks : []).slice(0, 3).map(raw => {
    const title = String(raw?.title || raw?.book_title || '').trim().replace(/\s+/g, ' ');
    if (!title) return null;
    const catalog = raw?.source_type === 'catalog' && raw?.book_id;
    return {
      requested_id: catalog ? String(raw.book_id) : null,
      book_title: title,
      source_type: catalog ? 'catalog' : 'manual',
    };
  }).filter(Boolean);

  const ids = cleaned.filter(b => b.requested_id).map(b => b.requested_id);
  let catalogMap = new Map();
  if (ids.length) {
    const filter = ids.map(encodeURIComponent).join(',');
    const rows = await supabaseFetch(
      env.CONTENT_SUPABASE_URL,
      env.CONTENT_SUPABASE_SERVICE_ROLE_KEY,
      `/rest/v1/content_books?id=in.(${filter})&select=id,title,public_level,internal_level_id,content_series(name,publisher)`
    );
    catalogMap = new Map((rows || []).map(row => [String(row.id), row]));
    if (catalogMap.size !== new Set(ids).size) {
      throw Object.assign(new Error('One or more curriculum books no longer exist'), { status: 400 });
    }
  }

  return cleaned.map(book => {
    if (book.source_type === 'manual') {
      return {
        book_id: null,
        book_title: book.book_title,
        source_type: 'manual',
        catalog_series: null,
        catalog_level: null,
        resolved_at: null,
      };
    }
    const row = catalogMap.get(book.requested_id);
    return {
      book_id: row.id,
      book_title: row.title,
      source_type: 'catalog',
      catalog_series: row.content_series?.name || null,
      catalog_level: row.public_level != null ? String(row.public_level) : row.internal_level_id != null ? String(row.internal_level_id) : null,
      resolved_at: new Date().toISOString(),
    };
  });
}

async function listClasses(env) {
  const classes = await supabaseFetch(
    env.SCORES_SUPABASE_URL,
    env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
    '/rest/v1/classes?status=eq.active&select=id,name,display_name,status,level,room,capacity,notes,created_at,updated_at&order=name.asc'
  );
  const ids = (classes || []).map(c => c.id);
  let assignments = [];
  if (ids.length) {
    assignments = await supabaseFetch(
      env.SCORES_SUPABASE_URL,
      env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
      `/rest/v1/class_book_assignments?class_id=in.(${ids.map(encodeURIComponent).join(',')})&status=eq.active&select=id,class_id,book_id,book_title,source_type,catalog_series,catalog_level,resolved_at,status,created_at&order=created_at.asc`
    );
  }
  const byClass = new Map();
  for (const item of assignments || []) {
    if (!byClass.has(item.class_id)) byClass.set(item.class_id, []);
    byClass.get(item.class_id).push(item);
  }
  return (classes || []).map(c => ({ ...c, books: (byClass.get(c.id) || []).slice(0, 3) }));
}

async function searchBooks(env, q) {
  const term = String(q || '').trim();
  if (term.length < 2) return [];
  const rows = await supabaseFetch(
    env.CONTENT_SUPABASE_URL,
    env.CONTENT_SUPABASE_SERVICE_ROLE_KEY,
    `/rest/v1/content_books?status=eq.active&title=ilike.*${encodeURIComponent(term)}*&select=id,title,book_number,public_level,internal_level_id,content_series(name,publisher)&order=title.asc&limit=12`
  );
  return (rows || []).map(b => ({
    book_id: b.id,
    title: b.title,
    series: b.content_series?.name || '',
    publisher: b.content_series?.publisher || '',
    level: b.public_level != null ? String(b.public_level) : b.internal_level_id != null ? String(b.internal_level_id) : '',
  }));
}

async function createClass(env, body) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) throw Object.assign(new Error('Class name must be 2–80 characters'), { status: 400 });
  const books = await validateBooks(env, body.books);
  const level = cleanLevel(body.level, books.length > 0);
  const existing = await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/classes?name=ilike.${encodeURIComponent(name)}&select=id&limit=1`);
  if (existing?.length) throw Object.assign(new Error('Class name already exists'), { status: 409 });

  const created = await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, '/rest/v1/classes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{ name, display_name: name, legacy_class_name: name, status: 'active', level }]),
  });
  const row = created?.[0];
  if (books.length) {
    await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, '/rest/v1/class_book_assignments', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(books.map(book => ({ class_id: row.id, ...book, started_at: new Date().toISOString().slice(0,10), status: 'active', notes: book.source_type === 'manual' ? 'Unresolved manual book; link to curriculum catalog when available.' : null }))),
    });
  }
  return (await listClasses(env)).find(c => c.id === row.id);
}

async function updateClass(env, body) {
  const classId = String(body.class_id || '').trim();
  if (!classId) throw Object.assign(new Error('Missing class ID'), { status: 400 });
  const books = await validateBooks(env, body.books);
  const level = cleanLevel(body.level, books.length > 0);

  await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/classes?id=eq.${encodeURIComponent(classId)}`, {
    method: 'PATCH', body: JSON.stringify({ level, updated_at: new Date().toISOString() })
  });
  await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/class_book_assignments?class_id=eq.${encodeURIComponent(classId)}&status=eq.active`, {
    method: 'PATCH', body: JSON.stringify({ status: 'archived', finished_at: new Date().toISOString().slice(0,10) })
  });
  if (books.length) {
    await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, '/rest/v1/class_book_assignments', {
      method: 'POST',
      body: JSON.stringify(books.map(book => ({ class_id: classId, ...book, started_at: new Date().toISOString().slice(0,10), status: 'active', notes: book.source_type === 'manual' ? 'Unresolved manual book; link to curriculum catalog when available.' : null }))),
    });
  }
  const found = (await listClasses(env)).find(c => c.id === classId);
  if (!found) throw Object.assign(new Error('Class not found'), { status: 404 });
  return found;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    try {
      if (!env.SCORES_SUPABASE_SERVICE_ROLE_KEY || !env.CONTENT_SUPABASE_SERVICE_ROLE_KEY) {
        return json(origin, 503, { success: false, error: 'Worker secrets are not configured' });
      }
      await requireAdmin(req, env);
      const url = new URL(req.url);
      const action = url.searchParams.get('action') || '';
      if (req.method === 'GET' && action === 'search_books') return json(origin, 200, { success: true, books: await searchBooks(env, url.searchParams.get('q')) });
      if (req.method === 'GET') return json(origin, 200, { success: true, classes: await listClasses(env) });
      if (req.method !== 'POST') return json(origin, 405, { success: false, error: 'Method not allowed' });
      const body = await req.json().catch(() => null);
      if (!body) return json(origin, 400, { success: false, error: 'Invalid JSON' });
      if (action === 'update_class') return json(origin, 200, { success: true, class: await updateClass(env, body) });
      return json(origin, 201, { success: true, class: await createClass(env, body) });
    } catch (error) {
      return json(origin, error.status || 500, { success: false, error: error.message || 'Unexpected error' });
    }
  }
};
