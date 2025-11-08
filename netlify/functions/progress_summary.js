// netlify/functions/progress_summary.js
// Secure version: NO ?user_id. Uses Supabase Auth token + RLS.
// Requires env: SUPABASE_URL, SUPABASE_ANON_KEY
const { createClient } = require('@supabase/supabase-js');

// Cookie helpers (same as supabase_proxy_fixed.js)
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(/;\s*/).forEach(kv => {
    const idx = kv.indexOf('=');
    if (idx > 0) {
      const k = kv.slice(0, idx).trim();
      const v = kv.slice(idx + 1).trim();
      if (k && !(k in out)) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function getAccessTokenFromCookie(event) {
  const cookieHeader = (event.headers && (event.headers.Cookie || event.headers.cookie)) || '';
  const cookies = parseCookies(cookieHeader);
  return cookies['sb_access'] || null;
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
// In local/dev, the anon key is commonly provided as SUPABASE_KEY. Fall back to that.
const ASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.supabase_anon_key;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role_key;
const ADMIN_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method Not Allowed' });
    }

    if (!SUPABASE_URL || !ADMIN_KEY) {
      console.error('[progress_summary] Missing SUPABASE_URL or admin key. URL present?', !!SUPABASE_URL, 'Admin/Anon present?', !!ADMIN_KEY);
      return json(500, { error: 'Server is misconfigured: missing Supabase env vars' });
    }

    // Try to get user from cookie
    const accessToken = getAccessTokenFromCookie(event);
    if (!accessToken) {
      return json(401, { error: 'Not signed in (cookie missing or invalid)' });
    }

  // Resolve the user id using admin client to be resilient
  const adminClient = createClient(SUPABASE_URL, ADMIN_KEY);
    const { data: userData, error: userErr } = await adminClient.auth.getUser(accessToken);
    if (userErr || !userData || !userData.user) {
      console.error('[progress_summary] getUser failed', userErr);
      return json(401, { error: 'Invalid or expired session' });
    }
    const userId = userData.user.id;

  // For consistency with the insert function (which uses service role), use admin client + explicit scoping.
  const supabase = adminClient;
  const scope = (query) => query.eq('user_id', userId);

  const section = ((event.queryStringParameters && event.queryStringParameters.section) || 'kpi').toLowerCase();

    // Helper to parse summary blobs safely
    const parseSummary = (s) => {
      try { if (!s) return null; if (typeof s === 'string') return JSON.parse(s); return s; }
      catch { return null; }
    };

    // ---------- CLASS LEADERBOARD ----------
    if (section === 'leaderboard_class') {
      try {
        const { data: meProf, error: meErr } = await adminClient.from('profiles').select('class').eq('id', userId).single();
        if (meErr || !meProf) return json(400, { success: false, error: 'Profile missing' });
        const className = meProf.class || null;
        if (!className) return json(200, { success: true, leaderboard: [], class: null });
        
        // Exclude single-letter class names (test profiles)
        if (className.length === 1) return json(200, { success: true, leaderboard: [], class: null });

        const { data: classmates, error: clsErr } = await adminClient
          .from('profiles')
          .select('id, name, username, avatar')
          .eq('role', 'student')
          .eq('class', className)
          .eq('approved', true)
          .limit(200);
        if (clsErr) return json(400, { success: false, error: clsErr.message });
        if (!classmates || !classmates.length) return json(200, { success: true, leaderboard: [], class: className });
        
        // Filter out test profiles (single-letter usernames)
        const filteredClassmates = classmates.filter(p => !p.username || p.username.length > 1);
        if (!filteredClassmates.length) return json(200, { success: true, leaderboard: [], class: className });

        // Fetch ALL attempts without limit for accurate totals
        const ids = filteredClassmates.map(p => p.id);
        let allAttempts = [];
        let offset = 0;
        const batchSize = 1000;
        while (true) {
          const { data: batch, error: attErr } = await adminClient
            .from('progress_attempts')
            .select('user_id, points')
            .in('user_id', ids)
            .not('points', 'is', null)
            .order('id', { ascending: true })
            .range(offset, offset + batchSize - 1);
          if (attErr) return json(400, { success: false, error: attErr.message });
          if (!batch || batch.length === 0) break;
          allAttempts = allAttempts.concat(batch);
          if (batch.length < batchSize) break;
          offset += batchSize;
        }

        const totals = new Map();
        allAttempts.forEach(a => { if (a.user_id) totals.set(a.user_id, (totals.get(a.user_id) || 0) + (Number(a.points) || 0)); });

  const entries = filteredClassmates.map(p => ({ user_id: p.id, name: p.name || p.username || 'Player', avatar: p.avatar || null, class: className, points: totals.get(p.id) || 0, self: p.id === userId }));
  entries.sort((a,b) => b.points - a.points || a.name.localeCompare(b.name));
  entries.forEach((e,i) => e.rank = i + 1);

  let top = entries.slice(0, 5);
  const me = entries.find(e => e.self);
  if (me && !top.some(e => e.user_id === me.user_id)) top = [...top, me];

  return json(200, { success: true, class: className, leaderboard: top });
      } catch (e) {
        console.error('[progress_summary] leaderboard_class error:', e);
        return json(500, { success: false, error: 'Internal error', details: e?.message });
      }
    }

    // ---------- STARS CLASS LEADERBOARD ----------
    // Computes total stars per student in the current class based on completed sessions.
    // Star logic mirrors the 'overview' section: best stars per (list_name, mode) pair.
    if (section === 'leaderboard_stars_class') {
      try {
        // Optional timeframe filter: all (default) | month (current calendar month)
        const timeframe = ((event.queryStringParameters && event.queryStringParameters.timeframe) || 'all').toLowerCase();
        let firstOfMonthIso = null;
        if (timeframe === 'month') {
          const now = new Date();
          const firstUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
          firstOfMonthIso = firstUtc.toISOString();
        }

        const { data: meProf, error: meErr } = await adminClient.from('profiles').select('class').eq('id', userId).single();
        if (meErr || !meProf) return json(400, { success: false, error: 'Profile missing' });
        const className = meProf.class || null;
        if (!className) return json(200, { success: true, leaderboard: [], class: null });
        
        // Exclude single-letter class names (test profiles)
        if (className.length === 1) return json(200, { success: true, leaderboard: [], class: null });

        // Fetch classmates (approved students in same class)
        const { data: classmates, error: clsErr } = await adminClient
          .from('profiles')
          .select('id, name, username, avatar')
          .eq('role', 'student')
          .eq('class', className)
          .eq('approved', true)
          .limit(200);
        if (clsErr) return json(400, { success: false, error: clsErr.message });
        if (!classmates || !classmates.length) return json(200, { success: true, leaderboard: [], class: className });
        
        // Filter out test profiles (single-letter usernames)
        const filteredClassmates = classmates.filter(p => !p.username || p.username.length > 1);
        if (!filteredClassmates.length) return json(200, { success: true, leaderboard: [], class: className });

        const ids = filteredClassmates.map(p => p.id);

        // Paginate through sessions and attempts in PARALLEL (faster)
        const batchSize = 800;
        
        // Helper: fetch a range of sessions with timeframe filter built-in (avoids extra queries)
        const fetchSessionBatch = (offset) => {
          let query = adminClient
            .from('progress_sessions')
            .select('user_id, list_name, mode, summary')
            .in('user_id', ids)
            .not('ended_at', 'is', null)
            .order('id', { ascending: true });
          if (firstOfMonthIso) query = query.gte('ended_at', firstOfMonthIso);
          return query.range(offset, offset + batchSize - 1);
        };
        
        // Helper: fetch a range of attempts with timeframe filter built-in
        const fetchAttemptBatch = (offset) => {
          let query = adminClient
            .from('progress_attempts')
            .select('user_id, points')
            .in('user_id', ids)
            .order('id', { ascending: true });
          if (firstOfMonthIso) query = query.gte('created_at', firstOfMonthIso);
          return query.range(offset, offset + batchSize - 1);
        };
        
        // Fetch first batch of sessions and attempts in parallel
        let { data: firstSess, error: sessErr1 } = await fetchSessionBatch(0);
        let { data: firstAtt, error: attErr1 } = await fetchAttemptBatch(0);
        
        if (sessErr1) return json(400, { success: false, error: sessErr1.message });
        if (attErr1) return json(400, { success: false, error: attErr1.message });
        
        let allSessions = firstSess || [];
        let allAttempts = firstAtt || [];
        
        // If data exactly fills batch, fetch more batches in parallel
        const sessPromises = [];
        const attPromises = [];
        
        if (firstSess && firstSess.length === batchSize) {
          let offset = batchSize;
          while (true) {
            sessPromises.push(
              fetchSessionBatch(offset).then(result => {
                if (result.error) throw result.error;
                return result.data || [];
              })
            );
            offset += batchSize;
            if (offset > 50000) break; // safety limit
          }
        }
        
        if (firstAtt && firstAtt.length === batchSize) {
          let offset = batchSize;
          while (true) {
            attPromises.push(
              fetchAttemptBatch(offset).then(result => {
                if (result.error) throw result.error;
                return result.data || [];
              })
            );
            offset += batchSize;
            if (offset > 50000) break; // safety limit
          }
        }
        
        // Execute all parallel requests
        try {
          const [sessResults, attResults] = await Promise.all([
            Promise.all(sessPromises),
            Promise.all(attPromises)
          ]);
          
          allSessions = allSessions.concat(sessResults.flat());
          allAttempts = allAttempts.concat(attResults.flat());
        } catch (err) {
          return json(400, { success: false, error: 'Parallel fetch error: ' + err.message });
        }

        // Helper: derive accuracy -> stars (0-5) identical to overview logic.
        function deriveStars(summ) {
          const s = summ || {};
          let acc = null;
            if (typeof s.accuracy === 'number') acc = s.accuracy;
            else if (typeof s.score === 'number' && typeof s.total === 'number' && s.total > 0) acc = s.score / s.total;
            else if (typeof s.score === 'number' && typeof s.max === 'number' && s.max > 0) acc = s.score / s.max;
          if (acc != null) {
            if (acc >= 1) return 5;
            if (acc >= 0.95) return 4;
            if (acc >= 0.90) return 3;
            if (acc >= 0.80) return 2;
            if (acc >= 0.60) return 1;
            return 0;
          }
          if (typeof s.stars === 'number') return s.stars; // fallback
          return 0;
        }

        // Aggregate best stars per (list_name, mode) per user
        const starsByUser = new Map(); // user_id -> Map(pairKey -> stars)
        allSessions.forEach(sess => {
          if (!sess || !sess.user_id) return;
          const list = (sess.list_name || '').trim();
          const mode = (sess.mode || '').trim();
          if (!list || !mode) return; // need both identifiers to form a pair
          const parsed = parseSummary(sess.summary);
          if (parsed && parsed.completed === false) return; // ignore incomplete
          const stars = deriveStars(parsed);
          if (stars <= 0) return; // skip zero-star sessions (no contribution)
          let userMap = starsByUser.get(sess.user_id);
          if (!userMap) { userMap = new Map(); starsByUser.set(sess.user_id, userMap); }
          const key = `${list}||${mode}`;
          const prev = userMap.get(key) || 0;
          if (stars > prev) userMap.set(key, stars); // keep best for pair
        });

        // Aggregate points per user
        const pointsByUser = new Map();
        allAttempts.forEach(att => {
          if (!att || !att.user_id) return;
          const current = pointsByUser.get(att.user_id) || 0;
          pointsByUser.set(att.user_id, current + (att.points || 0));
        });

        // Build leaderboard entries (only track top 5 + current user to avoid full sort overhead)
        const topPlayers = []; // will hold up to 6 entries (5 top + current user if not in top 5)
        const maxTop = 5;
        let myEntry = null;

        filteredClassmates.forEach(p => {
          const userMap = starsByUser.get(p.id) || new Map();
          let totalStars = 0; userMap.forEach(v => { totalStars += v; });
          const totalPoints = pointsByUser.get(p.id) || 0;
          const entry = {
            user_id: p.id,
            name: p.name || p.username || 'Player',
            avatar: p.avatar || null,
            class: className,
            stars: totalStars,
            points: totalPoints,
            self: p.id === userId
          };

          // Track current user separately
          if (entry.self) {
            myEntry = entry;
          }

          // Keep top 5: if less than 5, add it; if 5 or more, only add if better than lowest
          if (topPlayers.length < maxTop) {
            topPlayers.push(entry);
            topPlayers.sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
          } else {
            // Check if this entry beats the 5th place
            const lowestRanked = topPlayers[maxTop - 1];
            if (entry.stars > lowestRanked.stars || (entry.stars === lowestRanked.stars && entry.name < lowestRanked.name)) {
              topPlayers[maxTop - 1] = entry;
              topPlayers.sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
            }
          }
        });

        // Assign ranks
        topPlayers.forEach((e, i) => e.rank = i + 1);

        // Include current user if not in top 5
        let top = topPlayers;
        if (myEntry && !topPlayers.some(e => e.user_id === myEntry.user_id)) {
          top = [...topPlayers, myEntry];
        }

        return json(200, { success: true, class: className, leaderboard: top });
      } catch (e) {
        console.error('[progress_summary] leaderboard_stars_class error:', e);
        return json(500, { success: false, error: 'Internal error', details: e?.message });
      }
    }

    // ---------- STARS GLOBAL LEADERBOARD ----------
    // Computes total stars per student across all approved students globally.
    if (section === 'leaderboard_stars_global') {
      try {
        // Optional timeframe filter: all (default) | month (current calendar month)
        const timeframe = ((event.queryStringParameters && event.queryStringParameters.timeframe) || 'all').toLowerCase();
        let firstOfMonthIso = null;
        if (timeframe === 'month') {
          const now = new Date();
          // Use UTC month boundary to keep consistent ordering server-side
          const firstUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
          firstOfMonthIso = firstUtc.toISOString();
        }
        let students = [];
        let studentOffset = 0;
        const studentBatchSize = 500;
        while (true) {
          const { data: batch, error: stuErr } = await adminClient
            .from('profiles')
            .select('id, name, username, avatar, class')
            .eq('role', 'student')
            .eq('approved', true)
            .order('id', { ascending: true })
            .range(studentOffset, studentOffset + studentBatchSize - 1);
          if (stuErr) return json(400, { success: false, error: stuErr.message });
          if (!batch || batch.length === 0) break;
          students = students.concat(batch);
          if (batch.length < studentBatchSize) break;
          studentOffset += studentBatchSize;
        }

        if (!students.length) return json(200, { success: true, leaderboard: [] });
        
        // Filter out test profiles (single-letter usernames)
        const filteredStudents = students.filter(p => !p.username || p.username.length > 1);
        if (!filteredStudents.length) return json(200, { success: true, leaderboard: [] });

        const ids = filteredStudents.map(p => p.id);

        // Paginate through sessions and attempts in PARALLEL (faster)
        const batchSize = 800;
        
        // Helper: fetch a range of sessions with timeframe filter built-in (avoids extra queries)
        const fetchSessionBatch = (offset) => {
          let query = adminClient
            .from('progress_sessions')
            .select('user_id, list_name, mode, summary')
            .in('user_id', ids)
            .not('ended_at', 'is', null)
            .order('id', { ascending: true });
          if (firstOfMonthIso) query = query.gte('ended_at', firstOfMonthIso);
          return query.range(offset, offset + batchSize - 1);
        };
        
        // Helper: fetch a range of attempts with timeframe filter built-in
        const fetchAttemptBatch = (offset) => {
          let query = adminClient
            .from('progress_attempts')
            .select('user_id, points')
            .in('user_id', ids)
            .order('id', { ascending: true });
          if (firstOfMonthIso) query = query.gte('created_at', firstOfMonthIso);
          return query.range(offset, offset + batchSize - 1);
        };
        
        // Fetch first batch of sessions and attempts in parallel
        let { data: firstSess, error: sessErr1 } = await fetchSessionBatch(0);
        let { data: firstAtt, error: attErr1 } = await fetchAttemptBatch(0);
        
        if (sessErr1) return json(400, { success: false, error: sessErr1.message });
        if (attErr1) return json(400, { success: false, error: attErr1.message });
        
        let allSessions = firstSess || [];
        let allAttempts = firstAtt || [];
        
        // If data exactly fills batch, fetch more batches in parallel
        const sessPromises = [];
        const attPromises = [];
        
        if (firstSess && firstSess.length === batchSize) {
          let offset = batchSize;
          while (true) {
            sessPromises.push(
              fetchSessionBatch(offset).then(result => {
                if (result.error) throw result.error;
                return result.data || [];
              })
            );
            offset += batchSize;
            if (offset > 50000) break; // safety limit
          }
        }
        
        if (firstAtt && firstAtt.length === batchSize) {
          let offset = batchSize;
          while (true) {
            attPromises.push(
              fetchAttemptBatch(offset).then(result => {
                if (result.error) throw result.error;
                return result.data || [];
              })
            );
            offset += batchSize;
            if (offset > 50000) break; // safety limit
          }
        }
        
        // Execute all parallel requests
        try {
          const [sessResults, attResults] = await Promise.all([
            Promise.all(sessPromises),
            Promise.all(attPromises)
          ]);
          
          allSessions = allSessions.concat(sessResults.flat());
          allAttempts = allAttempts.concat(attResults.flat());
        } catch (err) {
          return json(400, { success: false, error: 'Parallel fetch error: ' + err.message });
        }

        // Helper: derive accuracy -> stars (0-5) identical to overview logic.
        function deriveStars(summ) {
          const s = summ || {};
          let acc = null;
            if (typeof s.accuracy === 'number') acc = s.accuracy;
            else if (typeof s.score === 'number' && typeof s.total === 'number' && s.total > 0) acc = s.score / s.total;
            else if (typeof s.score === 'number' && typeof s.max === 'number' && s.max > 0) acc = s.score / s.max;
          if (acc != null) {
            if (acc >= 1) return 5;
            if (acc >= 0.95) return 4;
            if (acc >= 0.90) return 3;
            if (acc >= 0.80) return 2;
            if (acc >= 0.60) return 1;
            return 0;
          }
          if (typeof s.stars === 'number') return s.stars; // fallback
          return 0;
        }

        // Aggregate best stars per (list_name, mode) per user
        const starsByUser = new Map(); // user_id -> Map(pairKey -> stars)
        allSessions.forEach(sess => {
          if (!sess || !sess.user_id) return;
          const list = (sess.list_name || '').trim();
          const mode = (sess.mode || '').trim();
          if (!list || !mode) return; // need both identifiers to form a pair
          const parsed = parseSummary(sess.summary);
          if (parsed && parsed.completed === false) return; // ignore incomplete
          const stars = deriveStars(parsed);
          if (stars <= 0) return; // skip zero-star sessions (no contribution)
          let userMap = starsByUser.get(sess.user_id);
          if (!userMap) { userMap = new Map(); starsByUser.set(sess.user_id, userMap); }
          const key = `${list}||${mode}`;
          const prev = userMap.get(key) || 0;
          if (stars > prev) userMap.set(key, stars); // keep best for pair
        });

        // Aggregate points per user
        const pointsByUser = new Map();
        allAttempts.forEach(att => {
          if (!att || !att.user_id) return;
          const current = pointsByUser.get(att.user_id) || 0;
          pointsByUser.set(att.user_id, current + (att.points || 0));
        });

        // Build leaderboard entries (only track top 10 + current user to avoid full sort overhead)
        const topPlayers = []; // will hold up to 11 entries (10 top + current user if not in top 10)
        const maxTop = 10;
        let myEntry = null;

        filteredStudents.forEach(p => {
          const userMap = starsByUser.get(p.id) || new Map();
          let totalStars = 0; userMap.forEach(v => { totalStars += v; });
          const totalPoints = pointsByUser.get(p.id) || 0;
          const entry = {
            user_id: p.id,
            name: p.name || p.username || 'Player',
            avatar: p.avatar || null,
            class: p.class || null,
            stars: totalStars,
            points: totalPoints,
            self: p.id === userId
          };

          // Track current user separately
          if (entry.self) {
            myEntry = entry;
          }

          // Keep top 10: if less than 10, add it; if 10 or more, only add if better than lowest
          if (topPlayers.length < maxTop) {
            topPlayers.push(entry);
            topPlayers.sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
          } else {
            // Check if this entry beats the 10th place
            const lowestRanked = topPlayers[maxTop - 1];
            if (entry.stars > lowestRanked.stars || (entry.stars === lowestRanked.stars && entry.name < lowestRanked.name)) {
              topPlayers[maxTop - 1] = entry;
              topPlayers.sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
            }
          }
        });

        // Assign ranks
        topPlayers.forEach((e, i) => e.rank = i + 1);

        // Include current user if not in top 10
        let top = topPlayers;
        if (myEntry && !topPlayers.some(e => e.user_id === myEntry.user_id)) {
          top = [...topPlayers, myEntry];
        }

        return json(200, { success: true, leaderboard: top });
      } catch (e) {
        console.error('[progress_summary] leaderboard_stars_global error:', e);
        return json(500, { success: false, error: 'Internal error', details: e?.message });
      }
    }

    // ---------- GLOBAL LEADERBOARD ----------
    if (section === 'leaderboard_global') {
      try {
        let students = [];
        let studentOffset = 0;
        const studentBatchSize = 500;
        while (true) {
          const { data: batch, error: stuErr } = await adminClient
            .from('profiles')
            .select('id, name, username, avatar, class')
            .eq('role', 'student')
            .eq('approved', true)
            .order('id', { ascending: true })
            .range(studentOffset, studentOffset + studentBatchSize - 1);
          if (stuErr) return json(400, { success: false, error: stuErr.message });
          if (!batch || batch.length === 0) break;
          students = students.concat(batch);
          if (batch.length < studentBatchSize) break;
          studentOffset += studentBatchSize;
        }

        if (!students.length) return json(200, { success: true, leaderboard: [] });
        
        // Filter out test profiles (single-letter usernames)
        const filteredStudents = students.filter(p => !p.username || p.username.length > 1);
        if (!filteredStudents.length) return json(200, { success: true, leaderboard: [] });

        // Fetch ALL attempts without limit for accurate totals
        const ids = filteredStudents.map(p => p.id);
        let allAttempts = [];
        let offset = 0;
        const batchSize = 1000;
        while (true) {
          const { data: batch, error: attErr } = await adminClient
            .from('progress_attempts')
            .select('user_id, points')
            .in('user_id', ids)
            .not('points', 'is', null)
            .order('id', { ascending: true })
            .range(offset, offset + batchSize - 1);
          if (attErr) return json(400, { success: false, error: attErr.message });
          if (!batch || batch.length === 0) break;
          allAttempts = allAttempts.concat(batch);
          if (batch.length < batchSize) break;
          offset += batchSize;
        }

        const totals = new Map();
        allAttempts.forEach(a => { if (a.user_id) totals.set(a.user_id, (totals.get(a.user_id) || 0) + (Number(a.points) || 0)); });

        const entries = filteredStudents.map(p => ({ user_id: p.id, name: p.name || p.username || 'Player', avatar: p.avatar || null, class: p.class || null, points: totals.get(p.id) || 0, self: p.id === userId }));
        entries.sort((a,b) => b.points - a.points || a.name.localeCompare(b.name));
        entries.forEach((e,i) => e.rank = i + 1);

        let top = entries.slice(0, 5);
        const me = entries.find(e => e.self);
        if (me && !top.some(e => e.user_id === me.user_id)) top = [...top, me];
        return json(200, { success: true, leaderboard: top });
      } catch (e) {
        console.error('[progress_summary] leaderboard_global error:', e);
        return json(500, { success: false, error: 'Internal error', details: e?.message });
      }
    }

    // ---------- KPI ----------
    if (section === 'kpi') {
      const { data: attempts, error: e1 } = await scope(
        supabase
          .from('progress_attempts')
          .select('is_correct')
      );

      if (e1) return json(400, { error: e1.message });

  const attemptsCount = attempts?.length || 0;
  const correct = attempts?.filter(a => a.is_correct)?.length || 0;

      const { data: ordered, error: e2 } = await scope(
        supabase
          .from('progress_attempts')
          .select('is_correct, created_at')
      )
        .order('created_at', { ascending: true });

      if (e2) return json(400, { error: e2.message });

      let best = 0, cur = 0;
      (ordered || []).forEach(a => { cur = a.is_correct ? cur + 1 : 0; best = Math.max(best, cur); });

      return json(200, {
        attempts: attemptsCount,
        accuracy: attemptsCount ? correct / attemptsCount : null,
        best_streak: best
      });
    }

    // ---------- MODES ----------
    if (section === 'modes') {
      const { data, error } = await scope(
        supabase
          .from('progress_attempts')
          .select('mode, is_correct')
      );

      if (error) return json(400, { error: error.message });

      const byMode = {};
      (data || []).forEach(r => {
        const m = (r.mode || 'unknown');
        byMode[m] ||= { mode: m, correct: 0, total: 0 };
        byMode[m].total += 1;
        if (r.is_correct) byMode[m].correct += 1;
      });
      return json(200, Object.values(byMode));
    }

    // ---------- SESSIONS ----------
    if (section === 'sessions') {
      const list_name = (event.queryStringParameters && event.queryStringParameters.list_name) || null;
      let query = scope(
        supabase
          .from('progress_sessions')
          .select('session_id, mode, list_name, started_at, ended_at, summary')
          .not('ended_at', 'is', null) // only completed sessions
      );

      if (list_name) query = query.eq('list_name', list_name);

      const { data, error } = await query
        .order('ended_at', { ascending: false })
        .limit(500);

      if (error) return json(400, { error: error.message });
      const sessions = data || [];
      // Identify sessions missing usable summary (null, empty object, or stringified empty {})
      const needs = sessions.filter(s => {
        const raw = s.summary;
        if (!raw) return true;
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!obj) return true;
          const keys = Object.keys(obj);
          if (!keys.length) return true;
          // If we already have score+total/accuracy keep it
          if (typeof obj.accuracy === 'number') return false;
          if (typeof obj.score === 'number' && typeof obj.total === 'number' && obj.total > 0) return false;
          if (typeof obj.score === 'number' && typeof obj.max === 'number' && obj.max > 0) return false;
          return true;
        } catch { return true; }
      }).map(s => s.session_id).filter(Boolean);

      if (needs.length) {
        // Fetch attempts for only these sessions to synthesize summaries.
        // Use larger chunks and add retry logic for reliability
        const CHUNK = 100; 
        const attemptMap = new Map(); // session_id -> { total, correct }
        console.log('[progress_summary] Synthesizing summaries for', needs.length, 'sessions');
        
        for (let i = 0; i < needs.length; i += CHUNK) {
          const slice = needs.slice(i, i + CHUNK);
          console.log('[progress_summary] Processing chunk', i/CHUNK + 1, 'of', Math.ceil(needs.length/CHUNK), '- session IDs:', slice.slice(0, 3));
          
          const { data: attempts, error: attErr } = await scope(
            supabase
              .from('progress_attempts')
              .select('session_id, is_correct')
              .in('session_id', slice)
          );
          
          if (attErr) {
            console.error('[progress_summary] Attempt fetch error for chunk:', attErr);
            continue;
          }
          
          console.log('[progress_summary] Found', (attempts || []).length, 'attempts for chunk');
          (attempts || []).forEach(a => {
            if (!a.session_id) return;
            const cur = attemptMap.get(a.session_id) || { total: 0, correct: 0 };
            cur.total += 1; 
            if (a.is_correct) cur.correct += 1; 
            attemptMap.set(a.session_id, cur);
          });
        }
        
        console.log('[progress_summary] Attempt map has', attemptMap.size, 'sessions with attempts');
        let synthesized = 0;
        sessions.forEach(s => {
          if (!needs.includes(s.session_id)) return;
          const agg = attemptMap.get(s.session_id);
          if (!agg || !agg.total) {
            console.log('[progress_summary] No attempts found for session:', s.session_id);
            return;
          }
          const accuracy = agg.total ? (agg.correct / agg.total) : null;
          s.summary = {
            score: agg.correct,
            total: agg.total,
            accuracy,
            derived: true
          };
          synthesized++;
          console.log('[progress_summary] Synthesized summary for', s.session_id, ':', s.summary);
        });
        console.log('[progress_summary] Successfully synthesized', synthesized, 'summaries');
      }
      return json(200, sessions);
    }

    // ---------- ATTEMPTS ----------
    if (section === 'attempts') {
      const { data, error } = await scope(
        supabase
          .from('progress_attempts')
          .select('created_at, mode, word, is_correct, points')
      )
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return json(400, { error: error.message });
      return json(200, data || []);
    }

    // ---------- BADGES ----------
    if (section === 'badges') {
      const [{ data: attempts, error: eA }, { data: sessions, error: eS }] = await Promise.all([
        scope(supabase.from('progress_attempts').select('is_correct, created_at')),
        scope(supabase.from('progress_sessions').select('summary'))
      ]);
      if (eA) return json(400, { error: eA.message });
      if (eS) return json(400, { error: eS.message });

  const totalCorrect = (attempts || []).filter(a => a.is_correct).length;

      let best = 0, cur = 0;
      (attempts || [])
        .slice()
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .forEach(a => { cur = a.is_correct ? cur + 1 : 0; best = Math.max(best, cur); });

      const badgeMap = new Map();
  if (totalCorrect >= 1) badgeMap.set('first_correct', { id: 'first_correct', name: 'First Steps', emoji: '🥇' });
  if (best >= 5) badgeMap.set('streak_5', { id: 'streak_5', name: 'Hot Streak', emoji: '🔥' });
  if (totalCorrect >= 100) badgeMap.set('hundred_correct', { id: 'hundred_correct', name: 'Century', emoji: '💯' });

      try {
        let perfectionistAwarded = false;
        (sessions || []).forEach(s => {
          if (perfectionistAwarded) return;
          const sum = parseSummary(s.summary);
          if (!sum) return;
          const acc =
            typeof sum.accuracy === 'number' ? sum.accuracy
              : (typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) ? sum.score / sum.total
              : (typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) ? sum.score / sum.max
              : null;
          if ((acc !== null && acc >= 1) || sum.perfect === true) {
            badgeMap.set('perfect_round', { id: 'perfect_round', name: 'Perfectionist', emoji: '🌟' });
            perfectionistAwarded = true;
          }
        });
      } catch {}

      return json(200, Array.from(badgeMap.values()));
    }

    // ---------- OVERVIEW ----------
    if (section === 'overview') {
      const debugFlag = (event.queryStringParameters && event.queryStringParameters.debug) ? true : false;
      // First get counts to know how many pages to fetch
      const PAGE = 1000;
      const [{ count: sessCount, error: sessCntErr }, { count: attCount, error: attCntErr }] = await Promise.all([
        scope(supabase.from('progress_sessions').select('*', { count: 'exact', head: true })),
        scope(supabase.from('progress_attempts').select('*', { count: 'exact', head: true }))
      ]);
      if (sessCntErr) return json(400, { error: sessCntErr.message });
      if (attCntErr) return json(400, { error: attCntErr.message });
      const sessions = [];
      const attempts = [];
      // Fetch session pages newest-first for determinism
      const sessPages = Math.ceil((sessCount || 0) / PAGE);
      for (let p = 0; p < sessPages; p++) {
        const from = p * PAGE;
        const to = Math.min(from + PAGE - 1, (sessCount || 0) - 1);
        if (to < from) break;
        const { data, error } = await scope(
          supabase
            .from('progress_sessions')
            .select('session_id, mode, list_name, summary, started_at, ended_at')
            .order('started_at', { ascending: false })
            .range(from, to)
        );
        if (error) return json(400, { error: error.message, page: p, domain: 'sessions' });
        if (Array.isArray(data)) sessions.push(...data);
      }
      // Fetch attempts pages (only fields needed). We'll need sequential ordering for streak calc later.
      const attPages = Math.ceil((attCount || 0) / PAGE);
      for (let p = 0; p < attPages; p++) {
        const from = p * PAGE;
        const to = Math.min(from + PAGE - 1, (attCount || 0) - 1);
        if (to < from) break;
        const { data, error } = await scope(
          supabase
            .from('progress_attempts')
            .select('word, is_correct, created_at, mode, points')
            .order('created_at', { ascending: false })
            .range(from, to)
        );
        if (error) return json(400, { error: error.message, page: p, domain: 'attempts' });
        if (Array.isArray(data)) attempts.push(...data);
      }
      // For logic that expects chronological order we can sort once (cost O(n log n)).
      attempts.sort((a,b)=> new Date(a.created_at) - new Date(b.created_at));
      // Authoritative total: sum of points via RPC (fast), with pagination fallback
      let total_points = 0;
      try {
        const { data: rpcVal, error: rpcErr } = await supabase.rpc('sum_points_for_user', { uid: userId });
        if (rpcErr) throw rpcErr;
        total_points = (typeof rpcVal === 'number') ? rpcVal : (rpcVal && typeof rpcVal.sum === 'number' ? rpcVal.sum : 0);
      } catch (e) {
        // Fallback: avoid row caps by paginating
        try {
          const { count: totalRows, error: cntErr } = await scope(
            supabase
              .from('progress_attempts')
              .select('*', { count: 'exact', head: true })
              .not('points', 'is', null)
          );
          if (cntErr) throw cntErr;
          const pageSize = 1000;
          const total = totalRows || 0;
          for (let from = 0; from < total; from += pageSize) {
            const to = Math.min(from + pageSize - 1, total - 1);
            const { data: rows, error: pageErr } = await scope(
              supabase
                .from('progress_attempts')
                .select('points')
                .not('points', 'is', null)
                .range(from, to)
            );
            if (pageErr) throw pageErr;
            if (Array.isArray(rows)) rows.forEach(r => { total_points += (Number(r.points) || 0); });
          }
        } catch {
          // Last fallback: sum from the already-fetched limited attempts
          total_points = attempts.reduce((sum, a) => sum + (Number(a.points) || 0), 0);
        }
      }

      const isPerfect = (sumRaw) => {
        const s = parseSummary(sumRaw) || {};
        if (s.completed === false) return false;
        if (s.accuracy === 1 || s.perfect === true) return true;
        if (typeof s.score === 'number' && typeof s.total === 'number') return s.score >= s.total;
        if (typeof s.score === 'number' && typeof s.max === 'number') return s.score >= s.max;
        return false;
      };

      const listNames = new Set(sessions.filter(s => s.list_name).map(s => s.list_name));
      const lists_explored = listNames.size;

      const perfect_runs = sessions.reduce((n, s) => n + (isPerfect(s.summary) ? 1 : 0), 0);

      const masteredPairs = new Set();
      sessions.forEach(s => {
        const ln = s.list_name || null;
        if (!ln) return;
        if (isPerfect(s.summary)) masteredPairs.add(`${ln}||${s.mode || 'unknown'}`);
      });
      const mastered = masteredPairs.size;
      const mastered_lists = mastered;

      let best = 0, cur = 0;
      attempts
        .slice()
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .forEach(a => { cur = a.is_correct ? cur + 1 : 0; best = Math.max(best, cur); });
      const best_streak = best;

      const words_discovered = new Set((attempts.map(a => a.word).filter(Boolean))).size;

      const perWord = new Map();
      attempts.forEach(a => {
        if (!a.word) return;
        const cur = perWord.get(a.word) || { total: 0, correct: 0 };
        cur.total += 1; if (a.is_correct) cur.correct += 1; perWord.set(a.word, cur);
      });
      let words_mastered = 0;
      perWord.forEach(({ total, correct }) => { if (total > 0 && (correct / total) >= 0.8) words_mastered += 1; });

      const sessions_played = sessions.length;

  // total_points computed above

      // Updated 0–5 star scale (previously 0–3). Thresholds:
      // 100% => 5, >=95% => 4, >=90% => 3, >=80% => 2, >=60% => 1, else 0
      function deriveStars(summ) {
        const s = summ || {};
        let acc = null;
        if (typeof s.accuracy === 'number') acc = s.accuracy;
        else if (typeof s.score === 'number' && typeof s.total === 'number' && s.total > 0) acc = s.score / s.total;
        else if (typeof s.score === 'number' && typeof s.max === 'number' && s.max > 0) acc = s.score / s.max;
        if (acc != null) {
          if (acc >= 1) return 5;
          if (acc >= 0.95) return 4;
          if (acc >= 0.90) return 3;
          if (acc >= 0.80) return 2;
          if (acc >= 0.60) return 1;
          return 0;
        }
        if (typeof s.stars === 'number') return s.stars; // fallback if pre-computed
        return 0;
      }
  // debugFlag already defined above
      // Track highest stars per (list_name, mode) plus raw breakdown for debug
      const starsByListMode = new Map();
      const stars_breakdown = [];
      let orderIdx = 0;
      sessions.forEach(s => {
        const list = s.list_name || '';
        const mode = s.mode || '';
        const key = `${list}||${mode}`;
        const parsed = parseSummary(s.summary);
        // Ignore incomplete sessions for stars
        if (parsed && parsed.completed === false) return;
        const stars = deriveStars(parsed);
        const prev = starsByListMode.get(key) || 0;
        const becameBest = stars > prev;
        if (becameBest) starsByListMode.set(key, stars);
        if (debugFlag) {
          let acc = null;
            if (parsed) {
              if (typeof parsed.accuracy === 'number') acc = parsed.accuracy;
              else if (typeof parsed.score === 'number' && typeof parsed.total === 'number' && parsed.total > 0) acc = parsed.score / parsed.total;
              else if (typeof parsed.score === 'number' && typeof parsed.max === 'number' && parsed.max > 0) acc = parsed.score / parsed.max;
            }
          const reason = becameBest
            ? (prev === 0 ? 'first_for_pair' : 'improved_best')
            : (stars === prev ? 'tied_existing_best' : (stars < prev ? 'lower_than_best' : 'unknown'));
          stars_breakdown.push({
            i: orderIdx++,
            session_id: s.session_id,
            list_name: list || null,
            mode: mode || null,
            stars,
            accuracy: acc,
            existing_best_before: prev,
            became_best: becameBest,
            best_for_pair: (becameBest ? stars : prev),
            reason
          });
        }
      });
      let stars_total = 0;
      starsByListMode.forEach(v => { stars_total += v; });

      let badges_count = 0;
      try {
        const totalCorrect = attempts.filter(a => a.is_correct).length;
        let localBest = 0, c = 0;
        attempts
          .slice()
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .forEach(a => { c = a.is_correct ? c + 1 : 0; localBest = Math.max(localBest, c); });
        const badges = [];
        if (totalCorrect >= 1) badges.push('first_correct');
        if (localBest >= 5) badges.push('streak_5');
        (sessions || []).forEach(s => {
          const sum = parseSummary(s.summary);
          if (!sum) return;
          const acc =
            typeof sum.accuracy === 'number' ? sum.accuracy
              : (typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) ? sum.score / sum.total
              : (typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) ? sum.score / sum.max
              : null;
          if ((acc !== null && acc >= 1) || sum.perfect === true) badges.push('perfect_round');
        });
        badges_count = badges.length;
      } catch {}

      const listCounts = new Map();
      sessions.forEach(s => { if (s.list_name) listCounts.set(s.list_name, (listCounts.get(s.list_name) || 0) + 1); });
      let favorite_list = null;
      if (listCounts.size) {
        let top = null; listCounts.forEach((cnt, name) => { if (!top || cnt > top.cnt) top = { name, cnt }; });
        favorite_list = top;
      }

      const wordStats = new Map();
      attempts.forEach(a => {
        if (!a.word) return;
        const s = wordStats.get(a.word) || { total: 0, correct: 0 };
        s.total += 1; if (a.is_correct) s.correct += 1; wordStats.set(a.word, s);
      });
      let hardest_word = null;
      wordStats.forEach((s, w) => {
        const incorrect = s.total - s.correct;
        if (s.total < 3 || incorrect <= s.correct) return;
        const acc = s.correct / s.total;
        if (!hardest_word) hardest_word = { word: w, misses: incorrect, attempts: s.total, accuracy: acc };
        else if (incorrect > hardest_word.misses || (incorrect === hardest_word.misses && acc < hardest_word.accuracy)) {
          hardest_word = { word: w, misses: incorrect, attempts: s.total, accuracy: acc };
        }
      });

      const overviewPayload = {
        stars: stars_total,
        lists_explored,
        perfect_runs,
        mastered,
        mastered_lists,
        best_streak,
        words_discovered,
        words_mastered,
        sessions_played,
        badges_count,
        favorite_list,
        hardest_word,
        points: total_points
      };
      if (debugFlag) {
        overviewPayload.stars_breakdown = stars_breakdown;
        overviewPayload.meta = {
          sessions_fetched: sessions.length,
          attempts_fetched: attempts.length,
          sessions_count: sessCount || sessions.length,
          attempts_count: attCount || attempts.length,
          pages_sessions: sessPages,
          pages_attempts: attPages,
          page_size: PAGE
        };
      }
      return json(200, overviewPayload);
    }

  // ---------- CHALLENGING ----------
    if (section === 'challenging') {
      const { data: attempts, error } = await scope(
        supabase
          .from('progress_attempts')
          .select('mode, word, is_correct, correct_answer, extra, created_at')
      );

      if (error) return json(400, { error: error.message });

      const normalize = (s) => (s && typeof s === 'string') ? s.trim().toLowerCase() : null;
      // Remove any bracketed "[picture]" tokens and adjacent dashes/punctuation anywhere, collapse whitespace, and trim.
      const sanitizeWord = (s) => {
        if (!s || typeof s !== 'string') return '';
        let t = s;
        // Remove bracketed picture placeholders like [picture], (picture), {picture}, with optional spaces and trailing dashes
        t = t.replace(/[\[\(\{]\s*picture\s*[\]\)\}]\s*[-–—_:]*\s*/gi, '');
        // If anything like "[ picture ]---" remains mid-string, remove globally
        t = t.replace(/\s*[\[\(\{]\s*picture\s*[\]\)\}]\s*/gi, ' ');
        // Strip leading/trailing punctuation/dashes left over
        t = t.replace(/^[\s\-–—_:,.;'"`~]+/, '').replace(/[\s\-–—_:,.;'"`~]+$/, '');
        // Collapse internal whitespace
        t = t.replace(/\s{2,}/g, ' ');
        return t.trim();
      };
      const isPicturePlaceholder = (s) => {
        if (!s || typeof s !== 'string') return false;
        const t = s.trim().toLowerCase();
        const core = t.replace(/^[\s\[\(\{]+|[\s\]\)\}]+$/g, '');
        return t === '[picture]' || core === 'picture';
      };
      const hasHangul = (s) => typeof s === 'string' && /[\u3131-\uD79D\uAC00-\uD7AF]/.test(s);
      const hasLatin = (s) => typeof s === 'string' && /[A-Za-z]/.test(s);
      const toObj = (x) => { try { return typeof x === 'string' ? JSON.parse(x) : (x || null); } catch { return null; } };
      const normMode = (m) => (m || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const skillOf = (mode) => {
        const m = normMode(mode);
        if (m.includes('spell')) return 'spelling';
        if (m.includes('listen')) return 'listening';
        if (m.includes('meaning')) return 'meaning';
        if (m.includes('multi') || m.includes('choice') || m.includes('picture') || m.includes('read')) return 'reading';
        return null;
      };

  const korLookup = new Map();
  // Track most frequent Korean per English to avoid mismatches from outliers
  const korFreq = new Map(); // engKey -> Map(kor -> count)
      (attempts || []).forEach(a => {
        const ex = toObj(a.extra) || {};
        let eng = null, kor = null;
        const dir = (ex.direction || ex.dir || '').toString().toLowerCase();
        if (dir === 'kor_to_eng' && hasLatin(a.correct_answer)) eng = a.correct_answer;
        if (dir === 'eng_to_kor' && hasLatin(a.word)) eng = a.word;
        const engCands = [eng, a.word, a.correct_answer, ex.word_en, ex.en, ex.eng, ex.english, ex.answer, ex.target, ex.prompt, ex.answer_text].filter(Boolean);
        for (const c of engCands) {
          if (!eng) {
            const c2 = sanitizeWord(c);
            if (c2 && hasLatin(c2)) { eng = c2; break; }
          }
        }
        const korCands = [ex.word_kr, ex.kr, ex.kor, ex.korean, ex.prompt, a.word, a.correct_answer, ex.question].filter(Boolean);
        for (const c of korCands) { if (!kor && hasHangul(c)) { kor = c; break; } }
        if (eng && kor) {
          const key = normalize(eng);
          if (key) {
            korLookup.set(key, kor);
            const inner = korFreq.get(key) || new Map();
            inner.set(kor, (inner.get(kor) || 0) + 1);
            korFreq.set(key, inner);
          }
        }
      });

      const byWord = new Map();
      (attempts || []).forEach(a => {
        const skill = skillOf(a.mode);
        const ex = toObj(a.extra) || {};
        let eng = null, kor = null;
        const dir = (ex.direction || ex.dir || '').toString().toLowerCase();
        if (dir === 'kor_to_eng' && hasLatin(a.correct_answer)) eng = a.correct_answer;
        if (dir === 'eng_to_kor' && hasLatin(a.word)) eng = a.word;
        const engCands = [eng, a.word, a.correct_answer, ex.word_en, ex.en, ex.eng, ex.english, ex.answer, ex.target, ex.prompt, ex.answer_text].filter(Boolean);
        for (const c of engCands) {
          if (!eng) {
            const c2 = sanitizeWord(c);
            if (c2 && hasLatin(c2)) { eng = c2; break; }
          }
        }
        const korCands = [ex.word_kr, ex.kr, ex.kor, ex.korean, ex.prompt, a.word, a.correct_answer, ex.question].filter(Boolean);
        for (const c of korCands) { if (!kor && hasHangul(c)) { kor = c; break; } }
        if (!eng) return;
        const engKey = normalize(eng);
        if (!engKey) return;
        if (isPicturePlaceholder(eng)) return;
        const arr = byWord.get(engKey) || [];
        arr.push({ created_at: a.created_at, is_correct: !!a.is_correct, skill, word_en: eng, word_kr: kor || null });
        if (kor) {
          const inner = korFreq.get(engKey) || new Map();
          inner.set(kor, (inner.get(kor) || 0) + 1);
          korFreq.set(engKey, inner);
        }
        byWord.set(engKey, arr);
      });

      const out = [];
      byWord.forEach((arr, engKey) => {
        arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const recent = arr.slice(-5);
        const total = recent.length;
        const correct = recent.reduce((n, r) => n + (r.is_correct ? 1 : 0), 0);
        const overallAcc = total ? (correct / total) : 0;
        // Total incorrect across all attempts for fixed-rule gating
        const incorrectTotal = arr.reduce((n, r) => n + (r.is_correct ? 0 : 1), 0);
        // If accuracy is decent, deprioritize; still might show if due and low attempts
        // We'll filter later using due schedule and also skip if quite good.

        const perSkill = new Map();
        recent.forEach(r => {
          const s = r.skill || 'any';
          const cur = perSkill.get(s) || { total: 0, correct: 0, word_en: r.word_en, word_kr: r.word_kr };
          cur.total += 1;
          cur.correct += (r.is_correct ? 1 : 0);
          if (!cur.word_en && r.word_en) cur.word_en = r.word_en;
          if (!cur.word_kr && r.word_kr) cur.word_kr = r.word_kr;
          perSkill.set(s, cur);
        });

        let worst = null;
        perSkill.forEach((v, s) => {
          const acc = v.total ? (v.correct / v.total) : 0;
          if (!worst || acc < worst.acc || (acc === worst.acc && v.total > worst.attempts)) {
            worst = { acc, attempts: v.total, skill: s, word_en: v.word_en, word_kr: v.word_kr };
          }
        });

        const skill = worst?.skill || 'any';
  let word_en = (recent[recent.length - 1] && recent[recent.length - 1].word_en) || (worst && worst.word_en) || null;
        let word_kr = (worst && worst.word_kr) || null;
        // Prefer consensus Korean (most frequent) to avoid mismatches
        const freqMap = korFreq.get(engKey);
        if (freqMap && freqMap.size) {
          let bestKor = null, bestCnt = -1;
          freqMap.forEach((cnt, k) => { if (cnt > bestCnt) { bestCnt = cnt; bestKor = k; } });
          if (bestKor) word_kr = bestKor;
        }
        // Fallback to simple backfill if no consensus
        if (!word_kr) {
          const backfill = korLookup.get(engKey);
          if (backfill) word_kr = backfill;
        }
  if (!word_en) word_en = engKey;
  // Final sanitize for output safety
  word_en = sanitizeWord(word_en);
  if (word_kr && isPicturePlaceholder(word_kr)) word_kr = null;

        // Spaced repetition scheduling (lightweight, no schema):
        // Compute last attempt time and trailing correct streak
        const last = arr[arr.length - 1];
        const lastTs = last ? new Date(last.created_at).getTime() : 0;
        let streak = 0; for (let i = arr.length - 1; i >= 0; i--) { if (arr[i].is_correct) streak++; else break; }
        const lastWasCorrect = !!(last && last.is_correct);
        // Interval days by streak (if last correct); if last incorrect, show sooner
        const mapDays = [0.5, 1, 3, 7, 14, 30];
        const idx = Math.min(streak, mapDays.length - 1);
        const intervalDays = lastWasCorrect ? mapDays[idx] : 0.5;
        const dueAt = lastTs ? (lastTs + intervalDays * 24 * 60 * 60 * 1000) : 0;

        out.push({ word: word_en, word_en, word_kr, skill, accuracy: overallAcc, attempts: total, last_ts: lastTs, due_at: dueAt, incorrect_total: incorrectTotal });
      });

      // Filter and rank:
      // - Remove picture placeholders
      // - Remove words with good accuracy (>= 70%) unless severely under-practiced
      // - Only include words that are due now (due_at <= now) or never seen (last_ts = 0)
      const now = Date.now();
      const cleaned = out.map(it => ({
        ...it,
        word: sanitizeWord(it.word_en || it.word || ''),
        word_en: sanitizeWord(it.word_en || it.word || ''),
        word_kr: it.word_kr
      })).filter(it => {
        // Drop empties/placeholders after sanitize
        if (!it.word_en || isPicturePlaceholder(it.word_en) || isPicturePlaceholder(it.word_kr)) return false;
        // Fixed rule: must have at least 2 incorrect attempts overall
        if (typeof it.incorrect_total === 'number' && it.incorrect_total < 2) return false;
        // Keep if never attempted; else must be due
        const due = (it.last_ts === 0) || (it.due_at <= now);
        // If accuracy good (>= 0.7) and not due, drop; if due, we can still show sometimes
        if (!due) return false;
        if (it.accuracy >= 0.7) {
          // Keep only if attempts are low to encourage some practice
          return (it.attempts < 3);
        }
        return true;
      });
      // Rank by lowest accuracy first, then earliest due, then most attempts (to break ties)
      cleaned.sort((a, b) => (a.accuracy - b.accuracy) || ((a.due_at || 0) - (b.due_at || 0)) || (b.attempts - a.attempts));
      return json(200, cleaned.slice(0, 20));
    }

    // ---------- CHALLENGING_V2 (last20 accuracy algorithm) ----------
    if (section === 'challenging_v2') {
      // New lightweight server-side logic delegates aggregation to SQL function challenging_words_v2
      // Falls back gracefully if RPC missing.
      try {
        const { data, error: rpcErr } = await supabase.rpc('challenging_words_v2', { p_user_id: userId, p_limit: 30 });
        if (rpcErr) {
          console.error('[progress_summary] challenging_v2 RPC error, falling back to empty list:', rpcErr);
          return json(200, []);
        }
        const sanitizeWord = (s) => {
          if (!s || typeof s !== 'string') return '';
          let t = s;
          t = t.replace(/\s{2,}/g, ' ').trim();
          return t;
        };
        const badSuffix = /_(sentence|broken|fillblank)\b/i;
        const out = (data || []).map(r => ({
          word: sanitizeWord(r.word_en || r.word || ''),
          word_en: sanitizeWord(r.word_en || r.word || ''),
          word_kr: sanitizeWord(r.word_kr || ''),
          attempts: r.attempts,
          correct: r.correct,
          incorrect: r.incorrect,
          accuracy: typeof r.accuracy === 'number' ? Number(r.accuracy) : (r.accuracy ? Number(r.accuracy) : null)
        }))
          .filter(r => r.word_en && r.word_kr)
          // Exclude sentence or meta entries (contain underscore or known suffix patterns)
          .filter(r => !r.word_en.includes('_') && !badSuffix.test(r.word_en));
        return json(200, out);
      } catch (e) {
        console.error('[progress_summary] challenging_v2 unexpected error', e);
        return json(200, []);
      }
    }

  return json(400, { error: 'Unknown section', section });
  } catch (e) {
  console.error('[progress_summary] ERROR:', e && e.stack || e);
  return json(500, { error: e.message || 'Internal error' });
  }
};
