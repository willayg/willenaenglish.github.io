// list_game_data_unique.js
// Enhanced lightweight listing endpoint with performance & flexibility controls.
// Features:
//  - Unique-by-lower(title) dedupe (default) or raw rows (unique=0)
//  - Client-tunable page pull size via ?page_pull= (cap enforced)
//  - Optional HEAD (metadata-only) mode via ?head=1 (skips image & profile resolution fields)
//  - Optional creator name hydration only when ?names=1 (avoids extra profile queries by default)
//  - Normalized thumbnail URL (thumb_url) so client needn't re-normalize / proxy-convert
//  - Supports mixing user-owned rows and system (NULL created_by) via include_null=1
// Response shape: { data:[...], unique_count, total_count, limit, offset, ms }

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
    const headOnly = String(qs.head || '0') === '1'; // metadata only
    const wantNames = String(qs.names || '0') === '1'; // fetch profile names
    // Adjustable page pull (how many recent rows we scan before dedupe). Clamp to protect DB.
    const reqPagePull = Number(qs.page_pull);
    const PAGE_PULL = Math.min(Math.max(isFinite(reqPagePull) && reqPagePull > 0 ? reqPagePull : 90, 20), 200);

    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return { statusCode: 500, headers: cors(event), body: JSON.stringify({ error: 'Server misconfigured' }) };
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch recent rows (cap PAGE_PULL) then dedupe newest per lowercase title.
    let rawRows = null; let rawErr = null;
    try {
      // Build base query
      // When headOnly, we do not need image fields (saves JSON path extraction cost)
      const baseSelect = headOnly
        ? 'id, title, created_at, created_by'
        : 'id, title, created_at, created_by, game_image, first_image_url:words->0->>image_url';
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

      if (!headOnly && rawErr && (/column.*game_image/i.test(rawErr.message) || /words->0->>image_url/i.test(rawErr.message) || /syntax error/i.test(rawErr.message))) {
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
    // Normalize thumbnail URL so client doesn't redo logic.
    function buildThumbUrl(row){
      if(headOnly) return null;
      const base = process.env.R2_PUBLIC_BASE ? String(process.env.R2_PUBLIC_BASE).replace(/\/$/, '') : '';
      let img = row.game_image || row.first_image_url || null;
      if(!img) return null;
      try {
        // If legacy direct r2 cloudflarestorage domain, convert to proxy (safer) unless client domain already uses mapped public base
        if(/^[a-z]+:\/\/[^/]+\.r2\.cloudflarestorage\.com\//i.test(img)){
          const m = img.match(/^[a-z]+:\/\/[^/]+\.r2\.cloudflarestorage\.com\/([^/]+)\/(.+)$/i);
          if(m){
            const key = m[2];
            if(/^(words|cover)\//.test(key)){
              img = '/.netlify/functions/image_proxy?key=' + encodeURIComponent(key);
            }
          }
        }
        if(base && img.startsWith(base + '/images/words/')){
          img = base + '/' + img.substring((base + '/images/').length);
        } else if(base && img.startsWith(base + '/images/cover/')){
          img = base + '/' + img.substring((base + '/images/').length);
        }
      } catch(_) {}
      return img;
    }
    const rows = page.map(r => ({
      id: r.id,
      title: r.title,
      creator_id: r.created_by || null,
      created_at: r.created_at,
      created_by: r.created_by,
      // Only include raw image fields when not headOnly (avoid payload bloat in head mode)
      game_image: headOnly ? undefined : (r.game_image || null),
      first_image_url: headOnly ? undefined : (r.first_image_url || null),
      thumb_url: headOnly ? undefined : buildThumbUrl(r)
    }));

    // Creator name resolution (single user -> skip extra query, but keep generic logic for future multi-user list)
    if(!headOnly && wantNames){
      // Conditional creator name resolution.
      if(listAll){
        const ids = [...new Set(rows.filter(r=>r.creator_id).map(r=>r.creator_id))];
        if(ids.length){
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
      } else if(createdBy && rows.length){
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, username, name')
          .eq('id', createdBy)
          .single();
        const display = prof ? (prof.name || prof.username || prof.id) : null;
        rows.forEach(r => { r.creator_name = r.created_by ? (display || 'Unknown') : 'System'; });
      } else {
        rows.forEach(r => { r.creator_name = r.created_by ? 'Unknown' : 'System'; });
      }
    }

    return {
      statusCode: 200,
      headers: cors(event),
      body: JSON.stringify({
        data: rows,
        unique: uniqueMode ? 1 : 0,
        unique_count: uniqueMode ? working.length : undefined,
        total_count,
        limit,
        offset,
        all: listAll,
        head: headOnly ? 1 : 0,
        names: wantNames ? 1 : 0,
        page_pull: PAGE_PULL,
        ms: Date.now() - startTs
      })
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
