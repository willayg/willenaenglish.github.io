// Lightweight Netlify function to return first page of unique (by lower(title)) game_data rows for the current user.
// ORIGINAL plan used raw SQL DISTINCT ON via a custom RPC (exec_sql) which is absent locally, causing 500s.
// This fallback implementation:
//   1. Pulls at most 250 recent rows for the user (cheap narrow index scan if index on created_by, created_at DESC).
//   2. Dedupes in memory keeping newest per lowercase title.
//   3. Returns the first requested page (limit/offset) of the deduped list (newest first).
// Response shape: { data:[...], unique_count, limit, offset, ms }

exports.handler = async (event) => {
  const startTs = Date.now();
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: cors(event), body: '' };
    }
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, headers: cors(event), body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const qs = event.queryStringParameters || {};
  const limit = Math.min(Number(qs.limit) > 0 ? Number(qs.limit) : 10, 50);
  const offset = Number(qs.offset) >= 0 ? Number(qs.offset) : 0; // For future paging (keyset later)
  const createdBy = (qs.created_by || '').trim();
  const listAll = String(qs.all || '0') === '1';
  const uniqueMode = String(qs.unique || '1') !== '0'; // default unique
    const includeNull = String(qs.include_null || '0') === '1';

    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return { statusCode: 500, headers: cors(event), body: JSON.stringify({ error: 'Server misconfigured' }) };
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch recent rows (cap 250) then dedupe newest per lowercase title.
    const PAGE_PULL = 250; // safety cap
    let rawRows = null; let rawErr = null;
    try {
      // Build base query
      const baseSelect = 'id, title, created_at, created_by, game_image, first_image_url:words->0->>image_url';
      let query = supabase.from('game_data').select(baseSelect).order('created_at', { ascending: false }).limit(PAGE_PULL);
      if (listAll) {
        // no filter; show all users (later we could restrict to admin)
      } else if (createdBy) {
        query = query.eq('created_by', createdBy);
      } else if (!createdBy && !includeNull) {
        // If no created_by provided and not explicitly including null, fallback to only NULL rows
        query = query.is('created_by', null);
      } else if (includeNull && createdBy) {
        // include both user rows and null rows: fetch separately then merge (Supabase OR on is() + eq() can be tricky)
        const userResp = await supabase.from('game_data').select(baseSelect).eq('created_by', createdBy).order('created_at', { ascending: false }).limit(PAGE_PULL);
        const nullResp = await supabase.from('game_data').select(baseSelect).is('created_by', null).order('created_at', { ascending: false }).limit(PAGE_PULL);
        rawRows = [...(userResp.data||[]), ...(nullResp.data||[])].sort((a,b)=> new Date(b.created_at)-new Date(a.created_at)).slice(0, PAGE_PULL);
        rawErr = userResp.error || nullResp.error;
      } else if (includeNull && !createdBy) {
        // Just include nulls (already handled by query.is above), keep as is
        query = query.is('created_by', null);
      }

      if (rawRows == null) {
        const resp = await query;
        rawRows = resp.data; rawErr = resp.error;
      }

      if (rawErr && (/column.*game_image/i.test(rawErr.message) || /words->0->>image_url/i.test(rawErr.message) || /syntax error/i.test(rawErr.message))) {
        // Retry with minimal select
        console.log('[list_game_data_unique] retrying with minimal select due to error:', rawErr.message);
        let q2 = supabase.from('game_data').select('id, title, created_at, created_by');
        if (createdBy) q2 = q2.eq('created_by', createdBy); else q2 = q2.is('created_by', null);
        const retry = await q2.order('created_at', { ascending: false }).limit(PAGE_PULL);
        rawRows = retry.data; rawErr = retry.error;
      }
    } catch (eFetch) {
      return { statusCode: 500, headers: cors(event), body: JSON.stringify({ error: 'Fetch failed', details: eFetch.message }) };
    }
    if (rawErr) {
      return { statusCode: 500, headers: cors(event), body: JSON.stringify({ error: rawErr.message }) };
    }
  console.log('[list_game_data_unique] pulled rows:', (rawRows||[]).length, 'user:', createdBy || '(none)', 'includeNull:', includeNull, 'all:', listAll);
    let working = rawRows || [];
    if (uniqueMode) {
      const byTitle = new Map();
      for (const r of working) {
        if (!r || !r.title) continue;
        const k = r.title.trim().toLowerCase();
        if (!k) continue;
        if (!byTitle.has(k)) byTitle.set(k, r);
      }
      working = Array.from(byTitle.values())
        .sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    }
    const total_count = working.length;
    const page = working.slice(offset, offset + limit);
    const rows = page.map(r => {
      // Prefer explicit game_image, then derived first_image_url
      const gameImg = r.game_image || r.first_image_url || null;
      return {
        id: r.id,
        title: r.title,
        creator_id: r.created_by || null,
        created_at: r.created_at,
        created_by: r.created_by,
        game_image: gameImg,
        first_image_url: r.first_image_url || null
      };
    });

    // Creator name resolution (single user -> skip extra query, but keep generic logic for future multi-user list)
    let creatorName = null;
    if (listAll) {
      // Batch fetch creator names
      const ids = [...new Set(rows.filter(r=>r.creator_id).map(r=>r.creator_id))];
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, username')
          .in('id', ids.slice(0,200));
        const nameMap = new Map();
        (profs||[]).forEach(p=> nameMap.set(p.id, p.name || p.username || p.id));
        rows.forEach(r => { r.creator_name = r.creator_id ? (nameMap.get(r.creator_id) || 'Unknown') : 'System'; });
      } else {
        rows.forEach(r => { r.creator_name = r.creator_id ? 'Unknown' : 'System'; });
      }
    } else if (createdBy && rows.length) {
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, name')
        .eq('id', createdBy)
        .single();
      if (!pErr && prof) creatorName = prof.name || prof.username || prof.id;
      rows.forEach(r => { r.creator_name = r.created_by ? (creatorName || 'Unknown') : 'System'; });
    } else {
      rows.forEach(r => { r.creator_name = r.created_by ? 'Unknown' : 'System'; });
    }

    return {
      statusCode: 200,
      headers: cors(event),
      body: JSON.stringify({ data: rows, unique: uniqueMode ? 1 : 0, unique_count: uniqueMode ? working.length : undefined, total_count, limit, offset, all: listAll, ms: Date.now() - startTs })
    };
  } catch (err) {
    return { statusCode: 500, headers: cors(event), body: JSON.stringify({ error: err.message }) };
  }
};

function cors(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS'
  };
}
