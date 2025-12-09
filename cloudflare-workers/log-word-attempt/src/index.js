/**
 * Cloudflare Worker: log-word-attempt
 * 
 * Drop-in replacement for Netlify function log_word_attempt.js
 * Uses direct REST calls to Supabase and KV for cache invalidation
 */

const ALLOWED_ORIGINS = [
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  // GitHub Pages preview (pages.dev) used for branch previews
  'https://willenaenglish-github-io.pages.dev',
  // Cloudflare Pages deployment
  'https://cf.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000',
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
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

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(rest.join('='));
    }
  });
  
  return cookies;
}

// Verify access token and get user
async function getUserFromToken(env, token) {
  if (!token) return null;
  
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// Invalidate leaderboard cache using KV
async function invalidateLeaderboardCache(env) {
  if (!env.LEADERBOARD_CACHE) {
    console.log('[log-word-attempt] No KV namespace bound, skipping cache invalidation');
    return;
  }
  
  try {
    // Set invalidation timestamp - readers will check this and refresh if stale
    await env.LEADERBOARD_CACHE.put('invalidate_ts', Date.now().toString(), { expirationTtl: 3600 });
    console.log('[log-word-attempt] Cache invalidation timestamp set');
  } catch (e) {
    console.warn('[log-word-attempt] Cache invalidation error:', e.message);
  }
}

// Insert rows into Supabase table
async function insertRows(env, table, rows) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Insert failed: ${error}`);
  }
  
  return true;
}

// Upsert session row
async function upsertSession(env, sessionData) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/progress_sessions`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(sessionData),
  });
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Upsert failed: ${error}`);
  }
  
  return true;
}

// Update session row
async function updateSession(env, sessionId, updates) {
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/progress_sessions?session_id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updates),
    }
  );
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Update failed: ${error}`);
  }
  
  return true;
}

// Fetch session by ID
async function fetchSession(env, sessionId) {
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/progress_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=list_name,list_size&limit=1`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  
  if (!resp.ok) return null;
  const data = await resp.json();
  return data && data[0] ? data[0] : null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    // ===== GET: Health check and diagnostics =====
    if (request.method === 'GET') {
      const selftest = url.searchParams.get('selftest');
      const envCheck = url.searchParams.get('env');
      
      if (envCheck) {
        return jsonResponse({
          ok: true,
          env: {
            hasUrl: !!env.SUPABASE_URL,
            hasServiceKey: !!env.SUPABASE_SERVICE_KEY,
            hasKV: !!env.LEADERBOARD_CACHE,
            runtime: 'cloudflare-workers',
          },
        }, 200, origin);
      }
      
      if (selftest) {
        try {
          const sid = `selftest-cf-${Date.now()}`;
          await upsertSession(env, { session_id: sid });
          await insertRows(env, 'progress_attempts', [{
            session_id: sid,
            mode: 'debug',
            word: 'ping',
            is_correct: true,
          }]);
          return jsonResponse({ ok: true, note: 'selftest wrote a row', session_id: sid }, 200, origin);
        } catch (e) {
          return jsonResponse({ ok: false, error: e.message }, 500, origin);
        }
      }
      
      return jsonResponse({ ok: true, note: 'log_word_attempt online (CF Worker)' }, 200, origin);
    }
    
    // ===== POST: Handle events =====
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405, origin);
    }
    
    // Get user from cookie
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookies(cookieHeader);
    const accessToken = cookies['sb_access'] || cookies['sb-access'] || null;
    const user = await getUserFromToken(env, accessToken);
    const userId = user?.id || null;
    
    try {
      const body = await request.json();
      const { event_type } = body;
      
      if (!event_type) {
        return jsonResponse({ error: 'Missing event_type' }, 400, origin);
      }
      
      // ===== SESSION START =====
      if (event_type === 'session_start') {
        if (!userId) {
          return jsonResponse({ error: 'Not signed in. Please log in to start a session.' }, 401, origin);
        }
        
        const { session_id, mode, list_name, list_size, extra } = body;
        if (!session_id) {
          return jsonResponse({ error: 'Missing session_id' }, 400, origin);
        }
        
        await upsertSession(env, {
          session_id,
          user_id: userId,
          mode: mode || null,
          list_name: list_name || null,
          list_size: typeof list_size === 'number' ? list_size : null,
          summary: extra || null,
        });
        
        return jsonResponse({ ok: true }, 200, origin);
      }
      
      // ===== SESSION END =====
      if (event_type === 'session_end') {
        if (!userId) {
          return jsonResponse({ error: 'Not signed in. Please log in to end a session.' }, 401, origin);
        }
        
        const { session_id, mode, extra, list_name, list_size } = body;
        if (!session_id) {
          return jsonResponse({ error: 'Missing session_id' }, 400, origin);
        }
        
        // Fetch existing to avoid overwriting
        const existing = await fetchSession(env, session_id) || {};
        
        const updates = {
          ended_at: new Date().toISOString(),
          summary: extra || null,
          mode: mode || null,
          user_id: userId,
          list_name: list_name || existing.list_name || null,
          list_size: typeof list_size === 'number' ? list_size : existing.list_size || null,
        };
        
        await updateSession(env, session_id, updates);
        await invalidateLeaderboardCache(env);
        
        return jsonResponse({ ok: true }, 200, origin);
      }
      
      // ===== SINGLE ATTEMPT =====
      if (event_type === 'attempt') {
        if (!userId) {
          return jsonResponse({ error: 'Not signed in. Please log in.' }, 401, origin);
        }
        
        const {
          session_id, mode, word, is_correct, answer, correct_answer,
          points, attempt_index, duration_ms, round, extra,
        } = body;
        
        if (!word) {
          return jsonResponse({ error: 'Missing word' }, 400, origin);
        }
        
        // Ensure session exists
        if (session_id) {
          await upsertSession(env, {
            session_id,
            user_id: userId,
            mode: mode || null,
          });
        }
        
        // Calculate safe points
        let safePoints = 0;
        if (points === 0 || points === null || points === undefined) {
          safePoints = is_correct ? 1 : 0;
        } else {
          const n = Number(points);
          safePoints = Number.isFinite(n) ? n : (is_correct ? 1 : 0);
        }
        
        const row = {
          user_id: userId,
          session_id: session_id || null,
          mode: mode || null,
          word,
          is_correct: !!is_correct,
          answer: answer ?? null,
          correct_answer: correct_answer ?? null,
          points: safePoints,
          attempt_index: attempt_index ?? null,
          duration_ms: duration_ms ?? null,
          round: round ?? null,
          extra: extra || null,
        };
        
        await insertRows(env, 'progress_attempts', [row]);
        await invalidateLeaderboardCache(env);
        
        return jsonResponse({ ok: true }, 200, origin);
      }
      
      // ===== BATCH ATTEMPTS =====
      if (event_type === 'attempts_batch') {
        if (!userId) {
          return jsonResponse({ error: 'Not signed in. Please log in.' }, 401, origin);
        }
        
        const { attempts, session_id, mode } = body;
        
        if (!Array.isArray(attempts) || !attempts.length) {
          return jsonResponse({ error: 'Missing or empty attempts array' }, 400, origin);
        }
        
        // Ensure session exists
        if (session_id) {
          await upsertSession(env, {
            session_id,
            user_id: userId,
            mode: mode || null,
          });
        }
        
        // Build rows
        const rows = attempts.map(a => {
          let safePoints = 0;
          if (a.points === 0 || a.points === null || a.points === undefined) {
            safePoints = a.is_correct ? 1 : 0;
          } else {
            const n = Number(a.points);
            safePoints = Number.isFinite(n) ? n : (a.is_correct ? 1 : 0);
          }
          
          return {
            user_id: userId,
            session_id: session_id || a.session_id || null,
            mode: mode || a.mode || null,
            word: a.word || null,
            is_correct: !!a.is_correct,
            answer: a.answer ?? null,
            correct_answer: a.correct_answer ?? null,
            points: safePoints,
            attempt_index: a.attempt_index ?? null,
            duration_ms: a.duration_ms ?? null,
            round: a.round ?? null,
            extra: a.extra || null,
          };
        }).filter(r => r.word);
        
        if (!rows.length) {
          return jsonResponse({ error: 'No valid attempts in batch' }, 400, origin);
        }
        
        await insertRows(env, 'progress_attempts', rows);
        await invalidateLeaderboardCache(env);
        
        return jsonResponse({ ok: true, inserted: rows.length }, 200, origin);
      }
      
      return jsonResponse({ error: 'Unknown event_type' }, 400, origin);
      
    } catch (error) {
      console.error('[log-word-attempt] Error:', error);
      return jsonResponse({ error: error.message }, 500, origin);
    }
  },
};
