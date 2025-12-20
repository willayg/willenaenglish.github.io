/**
 * Cloudflare Worker: log-word-attempt
 * 
 * Full replacement for Netlify function log_word_attempt.js
 * Uses Supabase REST API directly (no SDK required)
 * 
 * API Events:
 *   - session_start: Create/update a progress session
 *   - session_end: End a progress session with summary
 *   - attempt: Log a single word attempt
 *   - attempts_batch: Log multiple attempts at once
 * 
 * Also supports GET for health checks and diagnostics.
 */

const ALLOWED_ORIGINS = [
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://staging.willenaenglish-github-io.pages.dev',
  'https://cf.willenaenglish.com',
  'https://api.willenaenglish.com',
  'https://api-cf.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:9000',
];

// Known class names for cache invalidation
const KNOWN_CLASSES = [
  'new york', 'chicago', 'boston', 'brown', 'berkeley', 'yale',
  'washington', 'manchester', 'los angeles', 'san francisco'
];

function getCorsHeaders(origin) {
  let allowed = ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin)) {
    allowed = origin;
  } else if (origin) {
    try {
      const u = new URL(origin);
      if (u.hostname.endsWith('.pages.dev') ||
          u.hostname.endsWith('.willenaenglish.com') ||
          u.hostname === 'willenaenglish.com') {
        allowed = origin;
      }
    } catch {}
  }
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
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
  cookieHeader.split(/;\s*/).forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}

function getAccessToken(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  
  // Try multiple cookie names for compatibility
  const token = cookies['sb_access'] || cookies['sb-access'] || 
                cookies['sb_access_token'] || cookies['sb-access-token'];
  if (token) return token;
  
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  
  return null;
}

// Supabase REST client
class SupabaseClient {
  constructor(url, serviceKey) {
    this.url = url;
    this.serviceKey = serviceKey;
  }

  async verifyToken(token) {
    if (!token) return null;
    try {
      const resp = await fetch(`${this.url}/auth/v1/user`, {
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  async upsertSession(data) {
    const resp = await fetch(`${this.url}/rest/v1/progress_sessions?on_conflict=session_id`, {
      method: 'POST',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([data]),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Upsert session error: ${text}`);
    }
    return true;
  }

  async getSession(sessionId) {
    const resp = await fetch(
      `${this.url}/rest/v1/progress_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=list_name,list_size&limit=1`,
      {
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
        },
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && data[0] ? data[0] : null;
  }

  async updateSession(sessionId, data) {
    const resp = await fetch(
      `${this.url}/rest/v1/progress_sessions?session_id=eq.${encodeURIComponent(sessionId)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(data),
      }
    );
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Update session error: ${text}`);
    }
    return true;
  }

  async insertAttempt(data) {
    const resp = await fetch(`${this.url}/rest/v1/progress_attempts`, {
      method: 'POST',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify([data]),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Insert attempt error: ${text}`);
    }
    return true;
  }

  async insertAttemptsBatch(rows) {
    const resp = await fetch(`${this.url}/rest/v1/progress_attempts`, {
      method: 'POST',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Batch insert error: ${text}`);
    }
    return true;
  }

  async sumPointsForUser(userId) {
    try {
      const resp = await fetch(`${this.url}/rest/v1/rpc/sum_points_for_user`, {
        method: 'POST',
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid: userId }),
      });
      if (!resp.ok) return 0;
      const result = await resp.json();
      return typeof result === 'number' ? result : (result?.sum || 0);
    } catch {
      return 0;
    }
  }

  async deleteLeaderboardCache(section) {
    await fetch(
      `${this.url}/rest/v1/leaderboard_cache?section=eq.${encodeURIComponent(section)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
        },
      }
    );
  }
}

// Invalidate leaderboard caches after writes
async function invalidateLeaderboardCache(client) {
  try {
    await Promise.all([
      client.deleteLeaderboardCache('leaderboard_stars_global'),
      client.deleteLeaderboardCache('leaderboard_stars_class'),
    ]);
  } catch (e) {
    console.warn('[log-word-attempt] Cache invalidation error:', e.message);
  }
}

// Main handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: getCorsHeaders(origin) });
    }

    // Health check / diagnostics for GET
    if (request.method === 'GET') {
      const selftest = url.searchParams.get('selftest');
      const envCheck = url.searchParams.get('env');

      if (envCheck) {
        return jsonResponse({
          ok: true,
          env: {
            hasUrl: !!env.SUPABASE_URL,
            hasServiceKey: !!env.SUPABASE_SERVICE_KEY,
            runtime: 'cloudflare-workers',
          },
        }, 200, origin);
      }

      if (selftest && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
        const client = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
        try {
          const sid = `selftest-cf-${Date.now()}`;
          await client.upsertSession({ session_id: sid });
          await client.insertAttempt({
            session_id: sid,
            mode: 'debug',
            word: 'ping',
            is_correct: true,
          });
          return jsonResponse({ ok: true, note: 'selftest wrote a row', session_id: sid }, 200, origin);
        } catch (e) {
          return jsonResponse({ ok: false, error: e.message }, 500, origin);
        }
      }

      return jsonResponse({ ok: true, note: 'log_word_attempt worker online' }, 200, origin);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405, origin);
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      return jsonResponse({ error: 'Server misconfigured' }, 500, origin);
    }

    const client = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Get and verify user
    const accessToken = getAccessToken(request);
    const userData = accessToken ? await client.verifyToken(accessToken) : null;
    const userId = userData?.id || null;

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, origin);
    }

    const { event_type } = body;
    if (!event_type) {
      return jsonResponse({ error: 'Missing event_type' }, 400, origin);
    }

    try {
      // ===== SESSION START =====
      if (event_type === 'session_start') {
        if (!userId) {
          return jsonResponse({ error: 'Not signed in. Please log in to start a session.' }, 401, origin);
        }

        const { session_id, mode, list_name, list_size, extra } = body;
        if (!session_id) {
          return jsonResponse({ error: 'Missing session_id' }, 400, origin);
        }

        await client.upsertSession({
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

        // Get existing session to preserve list_name/list_size
        const existing = await client.getSession(session_id);
        const prev = existing || {};
        
        const nextListName = (list_name !== undefined && list_name !== null && list_name !== '')
          ? list_name
          : (prev.list_name || null);
        const nextListSize = typeof list_size === 'number'
          ? list_size
          : (typeof prev.list_size === 'number' ? prev.list_size : null);

        await client.updateSession(session_id, {
          ended_at: new Date().toISOString(),
          summary: extra || null,
          mode: mode || null,
          user_id: userId,
          list_name: nextListName,
          list_size: nextListSize,
        });

        // Invalidate leaderboard cache
        await invalidateLeaderboardCache(client);

        return jsonResponse({ ok: true }, 200, origin);
      }

      // ===== SINGLE ATTEMPT =====
      if (event_type === 'attempt') {
        if (!userId) {
          return jsonResponse({ error: 'Not signed in. Please log in.' }, 401, origin);
        }

        const {
          session_id, mode, word, is_correct, answer, correct_answer,
          points, attempt_index, duration_ms, round, extra
        } = body;

        if (!word) {
          return jsonResponse({ error: 'Missing word' }, 400, origin);
        }

        // Ensure session exists
        if (session_id) {
          await client.upsertSession({
            session_id,
            user_id: userId,
            mode: mode || null,
          });
        }

        // Calculate points
        let safePoints = 0;
        if (points === 0 || points === null || points === undefined) {
          safePoints = is_correct ? 1 : 0;
        } else {
          const n = Number(points);
          safePoints = Number.isFinite(n) ? n : (is_correct ? 1 : 0);
        }

        await client.insertAttempt({
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
        });

        // Skip points total calculation for speed (env flag)
        const skipPoints = env.SKIP_POINTS_TOTAL_CALC === '1' || env.SKIP_POINTS_TOTAL_CALC === 'true';
        if (skipPoints) {
          return jsonResponse({ ok: true }, 200, origin);
        }

        // Get total points
        const points_total = await client.sumPointsForUser(userId);

        // Invalidate leaderboard cache
        await invalidateLeaderboardCache(client);

        return jsonResponse({ ok: true, points_total }, 200, origin);
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
          await client.upsertSession({
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

        await client.insertAttemptsBatch(rows);

        // Invalidate leaderboard cache
        await invalidateLeaderboardCache(client);

        return jsonResponse({ ok: true, inserted: rows.length }, 200, origin);
      }

      return jsonResponse({ error: 'Unknown event_type' }, 400, origin);

    } catch (e) {
      console.error('[log-word-attempt] Error:', e);
      return jsonResponse({ error: e.message }, 500, origin);
    }
  },
};
