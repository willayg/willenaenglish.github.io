const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders, handleCorsPreflightIfNeeded } = require('./lib/cors');

function json(statusCode, obj, event) {
  return {
    statusCode,
    headers: {
      ...getCorsHeaders(event || {}),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(obj)
  };
}

// Store event reference for json helper
let currentEvent = null;
function _json(statusCode, obj) {
  return json(statusCode, obj, currentEvent);
}

// Create supabase client lazily inside handler to pick up fresh env vars after rotation
let supabase = null;
function getSupabase() {
  if (!supabase) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_API_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase environment variables missing');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return supabase;
}

exports.handler = async (event) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightIfNeeded(event);
  if (preflightResponse) return preflightResponse;
  
  // Store event for CORS headers in helper functions
  currentEvent = event;

  // Initialize supabase client (lazy, picks up current env vars)
  try {
    getSupabase();
  } catch (err) {
    return _json(500, { success: false, error: err.message });
  }

    const action = event.queryStringParameters?.action || 'list_assignments';
  const mode = event.queryStringParameters?.mode || 'teacher';

  try {
    if (action === 'create_assignment') {
      return await createAssignment(event);
    }
    if (action === 'create_run') {
      return await createAssignmentRun(event);
    }
    if (action === 'get_run_token') {
      return await getRunTokenForStudent(event);
    }
    if (action === 'list_assignments') {
      if (mode === 'student') {
        return await listAssignmentsForStudent(event);
      }
      return await listAssignments(event);
    }
    if (action === 'end_assignment') {
      return await endAssignment(event);
    }
    if (action === 'assignment_progress') {
      return await assignmentProgress(event);
    }
    if (action === 'delete_assignment') {
      return await deleteAssignment(event);
    }
    if (action === 'link_sessions') {
      return await linkSessionsToAssignment(event);
    }
    return _json(400, { success: false, error: 'Invalid action' });
  } catch (err) {
    console.error('homework_api error:', err);
    return _json(500, { success: false, error: err.message || 'Server error' });
  }
};

function generateRunToken(assignmentId) {
  const t = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run_${assignmentId}_${t}_${rand}`;
}

async function createAssignmentRun(event) {
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) {
    return _json(401, { success: false, error: 'Not signed in' });
  }
  const { data: prof, error: profErr } = await getSupabase()
    .from('profiles')
    .select('id, role, approved')
    .eq('id', authUserId)
    .single();
  if (profErr || !prof) {
    return _json(403, { success: false, error: 'Profile not found' });
  }
  if (!['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return _json(403, { success: false, error: 'Only teachers can create run tokens' });
  }
  const assignmentId = event.queryStringParameters?.assignment_id || event.queryStringParameters?.id || null;
  if (!assignmentId) return _json(400, { success: false, error: 'Missing assignment_id' });
  const token = generateRunToken(assignmentId);
  // Persist inside list_meta.run_tokens array
  const { data: current, error: getErr } = await getSupabase()
    .from('homework_assignments')
    .select('id, list_meta')
    .eq('id', assignmentId)
    .single();
  if (getErr || !current) return _json(404, { success: false, error: 'Assignment not found' });
  const list_meta = current.list_meta || {};
  const prev = Array.isArray(list_meta.run_tokens) ? list_meta.run_tokens : [];
  const updated = { ...list_meta, run_tokens: [...prev, { token, created_at: new Date().toISOString() }] };
  const { data: upd, error: updErr } = await getSupabase()
    .from('homework_assignments')
    .update({ list_meta: updated })
    .eq('id', assignmentId)
    .select('id, list_meta')
    .single();
  if (updErr) return _json(500, { success: false, error: 'Failed to persist run token: ' + (updErr.message || updErr.code) });
  return _json(200, { success: true, assignment_id: assignmentId, run_token: token });
}

async function getUserIdFromCookie(event) {
  const hdrs = event.headers || {};
  const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
  const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
  if (!m) return null;
  const token = decodeURIComponent(m[1]);
  const { data, error } = await getSupabase().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

async function createAssignment(event) {
  // Get auth user id from cookie and ensure they have a profile
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) {
    return _json(401, { success: false, error: 'Not signed in' });
  }

  const { data: prof, error: profErr } = await getSupabase()
    .from('profiles')
    .select('id, role, approved, class')
    .eq('id', authUserId)
    .single();

  if (profErr || !prof) {
    return _json(403, { success: false, error: 'Profile not found' });
  }
  if (!['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return _json(403, { success: false, error: 'Only teachers can create assignments' });
  }
  if (prof.approved === false) {
    return _json(403, { success: false, error: 'Teacher not approved' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    console.error('create_assignment JSON parse error:', {
      rawBody: event.body,
      message: err.message
    });
    return _json(400, { success: false, error: 'Invalid JSON body' });
  }

  const {
    class: className,
    title,
    description,
    list_key,
    list_title,
    list_meta,
    start_at,
    due_at,
    goal_type,
    goal_value
  } = body;

  if (!className || !title || !list_key || !due_at) {
    return _json(400, { success: false, error: 'Missing required fields: class, title, list_key, due_at' });
  }

  // Auto-generate a run token for the new assignment
  // This ensures teachers don't need to manually create run tokens
  const autoToken = `run_auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const initialMeta = {
    ...(list_meta || {}),
    run_tokens: [{ token: autoToken, created_at: new Date().toISOString(), auto: true }]
  };

  const { data, error } = await getSupabase()
    .from('homework_assignments')
    .insert({
      class: className,
      title,
      description: description || null,
      list_key,
      list_title,
      list_meta: initialMeta,
      start_at: start_at || new Date().toISOString(),
      due_at,
      goal_type: goal_type || 'stars',
      goal_value: goal_value || 5,
      active: true,
      created_by: prof.id   // <--- set from profiles.id
    })
    .select()
    .single();

  if (error) {
    console.error('create_assignment error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    return _json(500, { success: false, error: `Failed to create assignment: ${error.message || error.code || 'unknown error'}` });
  }

  console.log(`[homework_api] Created assignment ${data.id} with auto run_token: ${autoToken}`);
  return _json(200, { success: true, assignment: data, run_token: autoToken });
}

async function listAssignments(event) {
  const className = event.queryStringParameters?.class || null;

  let query = getSupabase()
    .from('homework_assignments')
    .select('*')
    .order('created_at', { ascending: false });

  if (className) {
    query = query.eq('class', className);
  }

  const { data, error } = await query;

  if (error) {
    console.error('list_assignments error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    return _json(500, { success: false, error: `Failed to fetch assignments: ${error.message || error.code || 'unknown error'}` });
  }

  return _json(200, { success: true, assignments: data || [] });
}

async function endAssignment(event) {
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) return _json(401, { success:false, error:'Not signed in' });
  let body; try { body = JSON.parse(event.body||'{}'); } catch { return _json(400,{ success:false, error:'Bad JSON'}); }
  const assignmentId = body.id || body.assignment_id || null;
  if (!assignmentId) return _json(400,{ success:false, error:'Missing assignment id'});
  // Verify teacher role
  const { data: prof, error: profErr } = await getSupabase().from('profiles').select('id, role').eq('id', authUserId).single();
  if (profErr || !prof || !['teacher','admin'].includes(String(prof.role||'').toLowerCase())) {
    return _json(403,{ success:false, error:'Only teachers can end assignments'});
  }
  const { data, error } = await getSupabase().from('homework_assignments').update({ active:false, ended_at:new Date().toISOString() }).eq('id', assignmentId).select().single();
  if (error) return _json(500,{ success:false, error:'Failed to end assignment: '+(error.message||error.code)});
  return _json(200,{ success:true, assignment:data });
}

function normalizeListIdentifier(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

async function assignmentProgress(event) {
  // Returns per-student progress for a given assignment id
  const assignmentId = event.queryStringParameters?.assignment_id || event.queryStringParameters?.id || null;
  const className = event.queryStringParameters?.class || null;
  if (!assignmentId) return _json(400,{ success:false, error:'Missing assignment_id' });
  // Fetch assignment
  let { data: assignment, error: aErr } = await getSupabase().from('homework_assignments').select('*').eq('id', assignmentId).single();
  if (aErr || !assignment) return _json(404,{ success:false, error:'Assignment not found' });

  // Auto-create run token if assignment has none (backfill for older assignments)
  let assignmentRunTokens = Array.isArray(assignment.list_meta?.run_tokens)
    ? assignment.list_meta.run_tokens.map(r => r?.token).filter(Boolean)
    : [];
  if (assignmentRunTokens.length === 0) {
    const autoToken = `run_backfill_${assignmentId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const updatedMeta = {
      ...(assignment.list_meta || {}),
      run_tokens: [{ token: autoToken, created_at: new Date().toISOString(), auto: true, backfilled: true }]
    };
    const { data: updatedAssignment, error: updErr } = await getSupabase()
      .from('homework_assignments')
      .update({ list_meta: updatedMeta })
      .eq('id', assignmentId)
      .select()
      .single();
    if (!updErr && updatedAssignment) {
      assignment = updatedAssignment;
      assignmentRunTokens = [autoToken];
      console.log(`[assignmentProgress] Backfilled run_token for assignment ${assignmentId}: ${autoToken}`);
    }
  }

  const targetClass = className || assignment.class;
  // Determine category heuristically for expected mode counts
  const assignLower = `${assignment.list_key||''} ${assignment.title||''} ${assignment.list_title||''}`.toLowerCase();
  let category = 'vocab';
  if (assignLower.includes('phonics')) category = 'phonics';
  else if (assignLower.includes('grammar')) category = 'grammar';
  // Load students in class
  const { data: students, error: sErr } = await getSupabase().from('profiles').select('id, name, korean_name').eq('class', targetClass);
  if (sErr) return _json(500,{ success:false, error:'Failed to load students: '+(sErr.message||sErr.code)});
  // Load progress_sessions for these students matching this assignment list
  // New logic: derive stars_earned (sum of best stars per mode) and list_completion_percent (distinct words attempted / list_size)
  const listKeyLast = assignment.list_key.split('/').pop();
  let sessions = [];
  const requestRunToken = event.queryStringParameters?.run_token || null;
  // Build tighter matching candidates to avoid cross-list overcounting
  const eq1 = listKeyLast;                   // exact filename
  const like1 = `%/${listKeyLast}`;          // path-anchored filename
  const like2 = `%/${listKeyLast}.json`;     // filename with .json suffix in paths
  // Additional fuzzy patterns (help phonics/grammar lists whose stored list_name differs)
  const coreName = listKeyLast.replace(/\.json$/,'');
  const fuzzy1 = `%${coreName}%`;
  const fuzzy2 = assignment.list_title ? `%${assignment.list_title.toLowerCase().replace(/\s+/g,'_')}%` : null;
  const normalizedFilename = normalizeListIdentifier(coreName);
  const normalizedListKey = normalizeListIdentifier(assignment.list_key);
  const normalizedTitle = normalizeListIdentifier(`${assignment.title||''} ${assignment.list_title||''}`);
  const normalizedTokens = Array.from(new Set([normalizedFilename, normalizedListKey, normalizedTitle].filter(Boolean))).filter(token => token.length >= 3);
    try {
      // 1) Primary attempt: tighten matching by filename/path variants
      let orFilters = [`list_name.eq.${eq1}`, `list_name.ilike.${like1}`, `list_name.ilike.${like2}`, `list_name.ilike.${fuzzy1}`];
      if (fuzzy2) orFilters.push(`list_name.ilike.${fuzzy2}`);
      normalizedTokens.forEach(token => {
        const safeToken = token.replace(/\s+/g, '%');
        orFilters.push(`list_name.ilike.%${safeToken}%`);
      });
      const { data: sessData, error: sessErr } = await getSupabase()
        .from('progress_sessions')
        .select('user_id, list_name, mode, summary, list_size')
        .in('user_id', students.map(s=>s.id))
        // Broader matching set to catch phonics/grammar variant naming
        .or(orFilters.join(','))
        .not('ended_at', 'is', null);
      if (!sessErr && Array.isArray(sessData)) {
          console.log('assignmentProgress primary candidate list_name samples', sessData.slice(0,10).map(s => s.list_name));
        const all = sessData;
        const runTokens = [requestRunToken, ...assignmentRunTokens].filter(Boolean);
        if (runTokens.length) {
          const withToken = all.filter(s => {
            try {
              const sum = typeof s.summary === 'string' ? JSON.parse(s.summary) : s.summary;
              const tok = sum && sum.assignment_run;
              return tok && runTokens.includes(tok);
            } catch { return false; }
          });
          if (withToken.length) {
            sessions = withToken;
            console.log(`assignmentProgress: prefer ${withToken.length} run-linked sessions for assignment ${assignment.id}`);
          } else {
            sessions = all;
            console.log(`assignmentProgress: matched sessions via primary orFilters (${sessions.length}) for assignment ${assignment.id}`);
          }
        } else {
          sessions = all;
          console.log(`assignmentProgress: matched sessions via primary orFilters (${sessions.length}) for assignment ${assignment.id}`);
        }
      }

      // 2) Conservative fallback: look for the assignment list key anywhere in list_name
      if ((!sessions || sessions.length === 0) && assignment.list_key) {
        const broadLike = `%${assignment.list_key}%`;
        const { data: broadSess, error: broadErr } = await getSupabase()
          .from('progress_sessions')
          .select('user_id, list_name, mode, summary, list_size')
          .in('user_id', students.map(s=>s.id))
          .ilike('list_name', broadLike)
          .not('ended_at', 'is', null);
        if (!broadErr && Array.isArray(broadSess) && broadSess.length) {
          console.log('assignmentProgress fallback candidate list_name samples', broadSess.slice(0,10).map(s => s.list_name));
          const all = broadSess;
          const runTokens = [requestRunToken, ...assignmentRunTokens].filter(Boolean);
          if (runTokens.length) {
            const withToken = all.filter(s => {
              try {
                const sum = typeof s.summary === 'string' ? JSON.parse(s.summary) : s.summary;
                const tok = sum && sum.assignment_run;
                return tok && runTokens.includes(tok);
              } catch { return false; }
            });
            if (withToken.length) {
              sessions = withToken;
              console.log(`assignmentProgress: prefer ${withToken.length} run-linked sessions (broad) for assignment ${assignment.id}`);
            } else {
              sessions = all;
              console.log(`assignmentProgress: matched sessions via broad ilike(list_key) (${sessions.length}) for assignment ${assignment.id}`);
            }
          } else {
            sessions = all;
            console.log(`assignmentProgress: matched sessions via broad ilike(list_key) (${sessions.length}) for assignment ${assignment.id}`);
          }
        }
      }

      // 3) Normalized fallback: try matching on a normalized core name (strip .json and folder prefixes)
      if ((!sessions || sessions.length === 0) && coreName) {
        const normalized = coreName.replace(/[^a-z0-9]+/g, '%');
        const normLike = `%${normalized}%`;
        const { data: normSess, error: normErr } = await getSupabase()
          .from('progress_sessions')
          .select('user_id, list_name, mode, summary, list_size')
          .in('user_id', students.map(s=>s.id))
          .ilike('list_name', normLike)
          .not('ended_at', 'is', null);
        if (!normErr && Array.isArray(normSess) && normSess.length) {
          sessions = normSess;
          console.log(`assignmentProgress: matched sessions via normalized coreName (${sessions.length}) for assignment ${assignment.id}`);
        }
      }

      // 4) Last-resort fuzzy by assignment title (previous behavior)
      if ((!sessions || sessions.length === 0) && assignment.title) {
        const titleCore = assignment.title.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
        if (titleCore) {
          const fallbackLike = `%${titleCore}%`;
          const { data: fallbackSess, error: fbErr } = await getSupabase()
            .from('progress_sessions')
            .select('user_id, list_name, mode, summary, list_size')
            .in('user_id', students.map(s=>s.id))
            .ilike('list_name', fallbackLike)
            .not('ended_at', 'is', null);
          if (!fbErr && Array.isArray(fallbackSess) && fallbackSess.length) {
            sessions = fallbackSess;
            console.log(`assignmentProgress: matched sessions via title fallback (${sessions.length}) for assignment ${assignment.id}`);
          }
        }
      }
    } catch (e) {
      console.warn('assignmentProgress progress_sessions fetch error (non-fatal):', e.message);
    }
    // Temporary logging: report detail per-session to help tune matching (can be removed after verification)
    try {
      if (sessions && sessions.length) {
        const sample = sessions.slice(0,20).map(s => ({ user_id: s.user_id, list_name: s.list_name }));
        console.log(`assignmentProgress: sample matched sessions for assignment ${assignment.id}:`, sample);
      } else {
        console.log(`assignmentProgress: no sessions matched for assignment ${assignment.id} (class ${targetClass})`);
      }
    } catch (e) { /* non-fatal */ }
  // Map attempts for word coverage from progress_attempts table (distinct words attempted) referencing sessions list_name
  let attempts = [];
  try {
    const { data: attemptsData, error: attErr } = await getSupabase()
      .from('progress_attempts')
      .select('user_id, word')
      .in('user_id', students.map(s=>s.id))
      .ilike('word', '%'); // placeholder to force index usage; we'll filter words later only by presence
    if (!attErr && Array.isArray(attemptsData)) attempts = attemptsData;
  } catch (e) { console.warn('assignmentProgress attempts fetch error (non-fatal):', e.message); }

  // Utility to parse summary JSON
  function parseSummary(summary) {
    try { if (!summary) return null; if (typeof summary === 'string') return JSON.parse(summary); return summary; } catch { return null; }
  }
  function deriveStars(summary) {
    const s = summary || {};
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
    if (typeof s.stars === 'number') return s.stars;
    return 0;
  }
  const byStudent = new Map();
  students.forEach(st => byStudent.set(st.id, { user_id: st.id, name: st.name, korean_name: st.korean_name, modes: {}, list_size: null, words_attempted: new Set() }));
  sessions.forEach(sess => {
    const row = byStudent.get(sess.user_id); if (!row) return;
    if (Number.isFinite(sess.list_size) && sess.list_size > 0) row.list_size = sess.list_size;
    const summary = parseSummary(sess.summary);
    const stars = deriveStars(summary);
    const modeKey = sess.mode || 'unknown';
    // Track overall accuracy components
    if (summary && typeof summary.score === 'number' && typeof summary.total === 'number' && summary.total > 0) {
      row._score = (row._score || 0) + summary.score;
      row._total = (row._total || 0) + summary.total;
    } else if (summary && typeof summary.correct === 'number' && typeof summary.total === 'number' && summary.total > 0) {
      row._score = (row._score || 0) + summary.correct;
      row._total = (row._total || 0) + summary.total;
    }
    const prev = row.modes[modeKey];
    if (prev) {
      // keep best stars
      if (stars > prev.stars) prev.stars = stars;
      // keep best accuracy
      const acc = summary && typeof summary.accuracy === 'number' ? Math.round(summary.accuracy * 100) : (summary && typeof summary.score === 'number' && typeof summary.total === 'number' && summary.total > 0 ? Math.round((summary.score/summary.total)*100) : 0);
      if (acc > prev.accuracy) prev.accuracy = acc;
      prev.sessions += 1;
    } else {
      const acc = summary && typeof summary.accuracy === 'number' ? Math.round(summary.accuracy * 100) : (summary && typeof summary.score === 'number' && typeof summary.total === 'number' && summary.total > 0 ? Math.round((summary.score/summary.total)*100) : 0);
      row.modes[modeKey] = { stars, accuracy: acc, sessions: 1 };
    }
  });
  // Word coverage: attempt words - we can't easily filter by list_name here without list_name on attempts; assume attempts for this list contain the listKey fragment inside word? Out of scope; treat distinct words attempted as coverage if any sessions exist.
  attempts.forEach(att => { const row = byStudent.get(att.user_id); if (!row) return; row.words_attempted.add(att.word); });
  // Determine total modes possible for this list; fallback to 6 if not specified
  let totalModes = assignment.list_meta?.modes_total || assignment.list_meta?.total_modes || assignment.list_meta?.mode_count || null;
  if (category === 'phonics' && Number(totalModes) > 4) {
    // Phonics lists are fixed at 4 modes.
    totalModes = 4;
  }
  // Determine encountered grammar advanced mode count for heuristic
  const encountered = new Set(sessions.map(s => (s.mode||'').toLowerCase()));
  if (category === 'grammar') {
    const advancedFlags = ['grammar_sorting','grammar_find_mistake','grammar_translation_choice'];
    let advancedCount = 0; advancedFlags.forEach(flag => { if ([...encountered].some(m => m.includes(flag))) advancedCount++; });
    const heuristicTotal = advancedCount >= 2 ? 6 : 4;
    // If meta total provided but conflicts with heuristic, override with heuristic.
    if (!Number.isFinite(totalModes) || totalModes <= 0 || Number(totalModes) !== heuristicTotal) {
      totalModes = heuristicTotal;
    }
  }
  if (!Number.isFinite(totalModes) || totalModes <= 0) {
    if (category === 'phonics') totalModes = 4; else if (category === 'grammar') {
      const advancedFlags = ['grammar_sorting','grammar_find_mistake','grammar_translation_choice'];
      let advancedCount = 0; advancedFlags.forEach(flag => { if ([...encountered].some(m => m.includes(flag))) advancedCount++; });
      totalModes = advancedCount >= 2 ? 6 : 4;
    } else totalModes = 6;
  }
  const progress = Array.from(byStudent.values()).map(r => {
    const rawModesArr = Object.entries(r.modes).map(([mode,v]) => ({ mode, bestStars: v.stars, bestAccuracy: v.accuracy, sessions: v.sessions }));
    const starsEarned = rawModesArr.reduce((sum,m)=> sum + (m.bestStars||0), 0);
    const bestAccuracy = rawModesArr.reduce((best,m)=> Math.max(best, m.bestAccuracy||0), 0);
    const overallAccuracy = (r._total && r._total > 0) ? Math.round((r._score / r._total) * 100) : 0;
    // Only count modes where student achieved at least 1 star (or lesson modes) toward completion
    const countedModesArr = rawModesArr.filter(m => (m.bestStars >= 1) || /grammar_lesson|lesson/i.test(m.mode));
    const distinctModesAttempted = countedModesArr.length;
    const completionPercent = totalModes > 0 ? Math.round((distinctModesAttempted / totalModes) * 100) : 0;
    return {
      user_id: r.user_id,
      name: r.name,
      korean_name: r.korean_name,
      stars: starsEarned,
      accuracy_best: bestAccuracy,
      accuracy_overall: overallAccuracy,
      completion: completionPercent,
      modes_attempted: distinctModesAttempted,
      modes_total: totalModes,
      modes: rawModesArr,
      status: assignment.active ? (completionPercent >= 100 || starsEarned >= (assignment.goal_value||5) ? 'Completed' : 'In Progress') : 'Ended',
      category
    };
  });
  return _json(200,{ success:true, assignment_id: assignment.id, class: targetClass, total_modes: totalModes, category, progress });
}

async function getProfileForEvent(event) {
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) return null;

  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, role, approved, class, name, korean_name')
    .eq('id', authUserId)
    .single();

  if (error || !data) return null;
  return data;
}

async function listAssignmentsForStudent(event) {
  const prof = await getProfileForEvent(event);
  if (!prof) {
    return _json(401, { success: false, error: 'Not signed in' });
  }
  if (!prof.class) {
    return _json(400, { success: false, error: 'No class set for this profile' });
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await getSupabase()
    .from('homework_assignments')
    .select('*, profiles!homework_assignments_created_by_fkey(name)')
    .eq('class', prof.class)
    .eq('active', true)
    .lte('start_at', nowIso)
    .order('due_at', { ascending: true });

  if (error) {
    console.error('listAssignmentsForStudent error:', error);
    return _json(500, { success: false, error: 'Failed to fetch student homework' });
  }

  // Map teacher name for convenience on each assignment
  const assignments = (data || []).map(a => ({
    ...a,
    teacher_name: a.profiles?.name || null
  }));

  return _json(200, {
    success: true,
    class: prof.class,
    student_name: prof.name || prof.korean_name || null,
    assignments
  });
}

// Return run tokens for a given assignment (by id or list_key) only if the
// requesting student belongs to the assignment's class and the assignment is active.
async function getRunTokenForStudent(event) {
  const prof = await getProfileForEvent(event);
  if (!prof) return _json(401, { success: false, error: 'Not signed in' });

  const assignmentId = event.queryStringParameters?.assignment_id || event.queryStringParameters?.id || null;
  const listKey = event.queryStringParameters?.list_key || event.queryStringParameters?.listName || event.queryStringParameters?.list_name || null;

  if (!assignmentId && !listKey) return _json(400, { success: false, error: 'Missing assignment_id or list_key' });

  let assignment = null;
  try {
    if (assignmentId) {
      const { data, error } = await getSupabase().from('homework_assignments').select('*').eq('id', assignmentId).single();
      if (error || !data) return _json(404, { success: false, error: 'Assignment not found' });
      assignment = data;
    } else if (listKey) {
      // Try to find an active assignment for this student's class matching the list_key
      const { data, error } = await getSupabase().from('homework_assignments')
        .select('*')
        .eq('class', prof.class)
        .eq('active', true)
        .ilike('list_key', `%${listKey}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !data || !data.length) return _json(404, { success: false, error: 'Assignment not found' });
      assignment = data[0];
    }
  } catch (e) {
    console.error('getRunTokenForStudent fetch error:', e.message);
    return _json(500, { success: false, error: 'Server error' });
  }

  // Verify student belongs to the assignment class
  if (!assignment || String(assignment.class || '') !== String(prof.class || '')) {
    return _json(403, { success: false, error: 'Not assigned to this class' });
  }

  const tokens = Array.isArray(assignment.list_meta?.run_tokens) ? assignment.list_meta.run_tokens.map(r => r?.token).filter(Boolean) : [];
  return _json(200, { success: true, assignment_id: assignment.id, tokens });
}

// Retroactively link existing sessions to an assignment by updating their summary.assignment_run field
// This fixes cases where students played games but the token wasn't attached
async function linkSessionsToAssignment(event) {
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) {
    return _json(401, { success: false, error: 'Not signed in' });
  }

  // Verify teacher/admin role
  const { data: prof, error: profErr } = await getSupabase()
    .from('profiles')
    .select('id, role, approved')
    .eq('id', authUserId)
    .single();

  if (profErr || !prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return _json(403, { success: false, error: 'Only teachers can link sessions' });
  }

  const assignmentId = event.queryStringParameters?.assignment_id || event.queryStringParameters?.id || null;
  if (!assignmentId) {
    return _json(400, { success: false, error: 'Missing assignment_id' });
  }

  // Fetch the assignment
  const { data: assignment, error: aErr } = await getSupabase()
    .from('homework_assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();

  if (aErr || !assignment) {
    return _json(404, { success: false, error: 'Assignment not found' });
  }

  // Get or create a run token for this assignment
  let runToken = null;
  const existingTokens = Array.isArray(assignment.list_meta?.run_tokens)
    ? assignment.list_meta.run_tokens.map(r => r?.token).filter(Boolean)
    : [];
  
  if (existingTokens.length > 0) {
    runToken = existingTokens[0]; // Use the first existing token
  } else {
    // Create a new token
    runToken = `run_link_${assignmentId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const updatedMeta = {
      ...(assignment.list_meta || {}),
      run_tokens: [{ token: runToken, created_at: new Date().toISOString(), auto: true }]
    };
    await getSupabase()
      .from('homework_assignments')
      .update({ list_meta: updatedMeta })
      .eq('id', assignmentId);
    console.log(`[link_sessions] Created new run_token for assignment ${assignmentId}: ${runToken}`);
  }

  // Get students in the class
  const { data: students, error: sErr } = await getSupabase()
    .from('profiles')
    .select('id')
    .eq('class', assignment.class);

  if (sErr || !students || !students.length) {
    return _json(400, { success: false, error: 'No students found in class' });
  }

  const studentIds = students.map(s => s.id);

  // Build matching patterns from the assignment list_key
  const listKeyLast = assignment.list_key.split('/').pop();
  const coreName = listKeyLast.replace(/\.json$/, '');
  const normalizedCoreName = normalizeListIdentifier(coreName);
  const normalizedListKey = normalizeListIdentifier(assignment.list_key);
  const normalizedTitle = normalizeListIdentifier(`${assignment.title || ''} ${assignment.list_title || ''}`);

  // Find all sessions for these students that might match this assignment
  // but don't already have an assignment_run token
  const orFilters = [
    `list_name.eq.${listKeyLast}`,
    `list_name.ilike.%/${listKeyLast}`,
    `list_name.ilike.%/${listKeyLast}.json`,
    `list_name.ilike.%${coreName}%`
  ];

  // Add normalized pattern matching
  const normalizedPatterns = [normalizedCoreName, normalizedListKey, normalizedTitle].filter(Boolean);
  normalizedPatterns.forEach(pat => {
    if (pat.length >= 3) {
      const safePattern = pat.replace(/\s+/g, '%');
      orFilters.push(`list_name.ilike.%${safePattern}%`);
    }
  });

  const { data: sessions, error: sessErr } = await getSupabase()
    .from('progress_sessions')
    .select('id, session_id, user_id, list_name, mode, summary, started_at')
    .in('user_id', studentIds)
    .or(orFilters.join(','))
    .not('ended_at', 'is', null);

  if (sessErr) {
    console.error('[link_sessions] Error fetching sessions:', sessErr);
    return _json(500, { success: false, error: 'Failed to fetch sessions' });
  }

  if (!sessions || !sessions.length) {
    return _json(200, { success: true, message: 'No matching sessions found', linked: 0 });
  }

  // Filter to only sessions that don't already have an assignment_run
  const sessionsToLink = sessions.filter(s => {
    try {
      const sum = typeof s.summary === 'string' ? JSON.parse(s.summary) : s.summary;
      return !sum || !sum.assignment_run;
    } catch {
      return true; // If we can't parse, assume it needs linking
    }
  });

  if (!sessionsToLink.length) {
    return _json(200, { success: true, message: 'All matching sessions already linked', linked: 0, total_found: sessions.length });
  }

  // Update each session to add the assignment_run token
  let linkedCount = 0;
  const errors = [];

  for (const sess of sessionsToLink) {
    try {
      let existingSummary = {};
      try {
        existingSummary = typeof sess.summary === 'string' ? JSON.parse(sess.summary) : (sess.summary || {});
      } catch {
        existingSummary = {};
      }

      const updatedSummary = {
        ...existingSummary,
        assignment_run: runToken,
        linked_at: new Date().toISOString(),
        linked_by: 'teacher_action'
      };

      const { error: updateErr } = await getSupabase()
        .from('progress_sessions')
        .update({ summary: updatedSummary })
        .eq('id', sess.id);

      if (updateErr) {
        errors.push({ session_id: sess.session_id, error: updateErr.message });
      } else {
        linkedCount++;
      }
    } catch (e) {
      errors.push({ session_id: sess.session_id, error: e.message });
    }
  }

  console.log(`[link_sessions] Linked ${linkedCount}/${sessionsToLink.length} sessions to assignment ${assignmentId} with token ${runToken}`);

  return _json(200, {
    success: true,
    message: `Linked ${linkedCount} sessions to assignment`,
    linked: linkedCount,
    total_found: sessions.length,
    already_linked: sessions.length - sessionsToLink.length,
    errors: errors.length > 0 ? errors : undefined,
    run_token: runToken
  });
}
