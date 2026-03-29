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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_API_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE;

// DEBUG: Log environment check (without exposing actual keys)
console.log('[homework_api] Environment check:', {
  hasUrl: !!SUPABASE_URL,
  urlPrefix: SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : '(missing)',
  hasServiceKey: !!SUPABASE_SERVICE_KEY,
  keyPrefix: SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.substring(0, 15) + '...' : '(missing)',
  keySource: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE_KEY' 
    : process.env.SUPABASE_SERVICE_KEY ? 'SERVICE_KEY'
    : process.env.SUPABASE_KEY ? 'KEY'
    : process.env.SUPABASE_SERVICE_ROLE ? 'SERVICE_ROLE'
    : '(NONE - CRITICAL ERROR)'
});

// Create a new supabase client for every invocation in dev mode so schema/cache changes are picked up quickly
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

exports.handler = async (event) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightIfNeeded(event);
  if (preflightResponse) return preflightResponse;
  
  // Store event for CORS headers in helper functions
  currentEvent = event;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return _json(500, { success: false, error: 'Supabase environment variables missing (SUPABASE_URL / SERVICE KEY).' });
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
    if (action === 'update_assignment_meta') {
      return await updateAssignmentMeta(event);
    }
    if (action === 'link_sessions') {
      return await linkSessionsToAssignment(event);
    }
    if (action === 'teacher_notifications') {
      return await teacherNotifications(event);
    }
    if (action === 'teacher_homework_status') {
      return await teacherHomeworkStatus(event);
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
  const { data: prof, error: profErr } = await supabase
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
  const { data: current, error: getErr } = await supabase
    .from('homework_assignments')
    .select('id, list_meta')
    .eq('id', assignmentId)
    .single();
  if (getErr || !current) return _json(404, { success: false, error: 'Assignment not found' });
  const list_meta = current.list_meta || {};
  const prev = Array.isArray(list_meta.run_tokens) ? list_meta.run_tokens : [];
  const updated = { ...list_meta, run_tokens: [...prev, { token, created_at: new Date().toISOString() }] };
  const { data: upd, error: updErr } = await supabase
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
  let token = null;
  
  // DEBUG: Log all headers to diagnose cookie extraction issues
  console.log('[homework_api] All headers:', JSON.stringify({
    cookie: hdrs.cookie ? '(present)' : '(missing)',
    Cookie: hdrs.Cookie ? '(present)' : '(missing)',
    authorization: hdrs.authorization ? hdrs.authorization.substring(0, 20) + '...' : '(missing)',
    Authorization: hdrs.Authorization ? hdrs.Authorization.substring(0, 20) + '...' : '(missing)',
    host: hdrs.host || hdrs.Host,
    origin: hdrs.origin || hdrs.Origin
  }));
  
  // Method 1: Check Cookie header (primary - set by login response)
  // Cookies are preferred because they're automatically sent by browsers
  const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
  console.log('[homework_api] Cookie header length:', cookieHeader.length, 'sample:', cookieHeader.substring(0, 100));
  
  const cookieMatch = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
  if (cookieMatch) {
    token = decodeURIComponent(cookieMatch[1]);
    console.log('[homework_api] ✓ Token from cookie, length:', token.length);
  } else {
    console.log('[homework_api] ✗ No sb_access cookie found in header');
  }
  
  // Method 2: Check Authorization header only if no cookie found (fallback for localStorage tokens)
  // This helps when cookies fail (e.g., incognito, cross-origin on some browsers)
  if (!token) {
    const authHeader = hdrs.authorization || hdrs.Authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
      console.log('[homework_api] ✓ Token from Authorization header, length:', token.length);
    } else if (authHeader) {
      console.log('[homework_api] ✗ Authorization header present but invalid format:', authHeader.substring(0, 20));
    }
  }
  
  if (!token) {
    console.log('[homework_api] ✗ FAIL: No valid token found in cookies or Authorization header');
    return null;
  }
  
  // Use REST endpoint as a compatibility fallback for different key formats
  // This avoids SDK key-format mismatches: call /auth/v1/user with service key
  console.log('[homework_api] Calling REST /auth/v1/user with service key...');
  try {
    const url = (SUPABASE_URL || '').replace(/\/$/, '') + '/auth/v1/user';
    const userResp = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const userJson = await userResp.json().catch(() => null);
    console.log('[homework_api] REST /auth/v1/user status:', userResp.status, 'bodySample:', userJson ? JSON.stringify(userJson).substring(0,200) : '(no body)');

    if (!userResp.ok || !userJson) {
      console.log('[homework_api] ✗ FAIL: REST auth validation failed');
      return null;
    }

    const userId = userJson?.id || userJson?.user?.id || null;
    if (!userId) {
      console.log('[homework_api] ✗ FAIL: Could not find user id in REST response');
      return null;
    }
    console.log('[homework_api] ✓ SUCCESS: Authenticated as user', userId);
    return userId;
  } catch (e) {
    console.log('[homework_api] ✗ FAIL: Exception calling REST auth:', e && e.message);
    return null;
  }
}

async function createAssignment(event) {
  // Get auth user id from cookie and ensure they have a profile
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) {
    return _json(401, { success: false, error: 'Not signed in' });
  }

  const { data: prof, error: profErr } = await supabase
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

  const { data, error } = await supabase
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

// Allow teachers to update an existing assignment's list_meta (e.g. set forced_mode)
async function updateAssignmentMeta(event) {
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) return _json(401, { success: false, error: 'Not signed in' });

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, role, approved, class')
    .eq('id', authUserId)
    .single();

  if (!prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return _json(403, { success: false, error: 'Only teachers can update assignments' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return _json(400, { success: false, error: 'Invalid JSON body' }); }

  const assignmentId = body.assignment_id || event.queryStringParameters?.assignment_id;
  if (!assignmentId) return _json(400, { success: false, error: 'Missing assignment_id' });

  const { data: assignment, error: aErr } = await supabase.from('homework_assignments').select('*').eq('id', assignmentId).single();
  if (aErr || !assignment) return _json(404, { success: false, error: 'Assignment not found' });

  // Merge new meta fields into existing list_meta
  const existingMeta = parseAssignmentMeta(assignment.list_meta);
  const mergedMeta = { ...existingMeta, ...(body.list_meta || {}) };

  // Also allow updating goal_value directly
  const updateFields = { list_meta: mergedMeta };
  if (body.goal_value !== undefined) updateFields.goal_value = body.goal_value;
  if (body.goal_type !== undefined) updateFields.goal_type = body.goal_type;

  const { data: updated, error: uErr } = await supabase
    .from('homework_assignments')
    .update(updateFields)
    .eq('id', assignmentId)
    .select()
    .single();

  if (uErr) return _json(500, { success: false, error: 'Update failed: ' + (uErr.message || uErr.code) });

  console.log(`[updateAssignmentMeta] Updated assignment ${assignmentId}:`, JSON.stringify(updateFields));
  return _json(200, { success: true, assignment: updated });
}

async function autoExpireAssignmentsPastGrace({ className = null } = {}) {
  const now = new Date();
  const nowMs = now.getTime();
  const graceMs = 2 * 24 * 60 * 60 * 1000;
  let query = supabase
    .from('homework_assignments')
    .eq('active', true)
    .select('id, due_at');

  if (className) {
    query = query.eq('class', className);
  }

  const { data, error } = await query;
  if (error) {
    console.error('autoExpireAssignmentsPastGrace error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    return { expiredCount: 0, error };
  }

  const overdueIds = (Array.isArray(data) ? data : [])
    .filter((row) => {
      const dueMs = Date.parse(String(row?.due_at || ''));
      if (!Number.isFinite(dueMs)) return false;
      return (nowMs - dueMs) > graceMs;
    })
    .map((row) => row.id)
    .filter(Boolean);

  if (!overdueIds.length) {
    return { expiredCount: 0, error: null };
  }

  const { data: updated, error: updateErr } = await supabase
    .from('homework_assignments')
    .update({ active: false })
    .in('id', overdueIds)
    .select('id');

  if (updateErr) {
    console.error('autoExpireAssignmentsPastGrace update error:', {
      message: updateErr.message,
      details: updateErr.details,
      hint: updateErr.hint,
      code: updateErr.code
    });
    return { expiredCount: 0, error: updateErr };
  }

  return { expiredCount: Array.isArray(updated) ? updated.length : overdueIds.length, error: null };
}

async function listAssignments(event) {
  const className = event.queryStringParameters?.class || null;

  await autoExpireAssignmentsPastGrace({ className });

  let query = supabase
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
  const { data: prof, error: profErr } = await supabase.from('profiles').select('id, role').eq('id', authUserId).single();
  if (profErr || !prof || !['teacher','admin'].includes(String(prof.role||'').toLowerCase())) {
    return _json(403,{ success:false, error:'Only teachers can end assignments'});
  }
  const { data, error } = await supabase.from('homework_assignments').update({ active:false, ended_at:new Date().toISOString() }).eq('id', assignmentId).select().single();
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

function parseAssignmentMeta(rawMeta) {
  if (!rawMeta) return {};
  if (typeof rawMeta === 'string') {
    try {
      const parsed = JSON.parse(rawMeta);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return (rawMeta && typeof rawMeta === 'object') ? rawMeta : {};
}

function getAssignmentTargetStudentIds(rawMeta) {
  const meta = parseAssignmentMeta(rawMeta);
  const ids = new Set();
  if (Array.isArray(meta.target_student_ids)) {
    meta.target_student_ids.forEach((value) => {
      const id = String(value || '').trim();
      if (id) ids.add(id);
    });
  }
  if (Array.isArray(meta.target_students)) {
    meta.target_students.forEach((entry) => {
      const id = String(entry?.id || '').trim();
      if (id) ids.add(id);
    });
  }
  return Array.from(ids);
}

function getAssignmentModeMeta(rawMeta) {
  const meta = parseAssignmentMeta(rawMeta);
  const numberOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    difficulty_mode: meta.difficulty_mode || null,
    forced_mode: meta.forced_mode || meta.mode || null,
    modes_total: numberOrNull(meta.modes_total ?? meta.total_modes ?? meta.mode_count),
    modes_required: numberOrNull(meta.difficulty_modes_required ?? meta.modes_required),
    required_stars: numberOrNull(meta.difficulty_required_stars ?? meta.required_stars),
    max_stars: numberOrNull(meta.max_stars),
  };
}

function inferAssignmentCategory(assignment) {
  const listKey = String(assignment?.list_key || '').toLowerCase();
  if (listKey.includes('/phonics/') || listKey.includes('phonics')) return 'phonics';
  if (listKey.includes('/grammar/') || listKey.includes('grammar')) return 'grammar';
  return 'vocab';
}

function isSentenceMode(mode) {
  const name = String(mode || '').toLowerCase();
  if (!name) return false;
  return name === 'full_sentence_mode'
    || name === 'word_sentence_mode'
    || name === 'sentence'
    || name === 'sentence_unscramble'
    || name === 'fill_blank_sentence_mode'
    || name === 'broken_sentence_mode'
    || name === 'grammar_sentence_unscramble'
    || name.includes('sentence');
}

function isSpellingMode(mode) {
  const name = String(mode || '').toLowerCase();
  return name === 'spelling' || name === 'listen_and_spell' || name === 'spell';
}

function getHomeworkCompletionConfig(assignment, sessions = []) {
  const meta = parseAssignmentMeta(assignment?.list_meta);
  const modeMeta = getAssignmentModeMeta(meta);
  const category = inferAssignmentCategory(assignment);
  const difficultyMode = String(modeMeta.difficulty_mode || '').toLowerCase();
  const forcedMode = String(modeMeta.forced_mode || '').toLowerCase();
  const goalValueHint = Number(assignment?.goal_value) === 1;

  let totalModes;
  if (category === 'phonics') {
    totalModes = 4;
  } else if (category === 'grammar') {
    const listKeyPath = String(assignment?.list_key || '').toLowerCase();
    let grammarLevel = 2;
    const levelMatch = listKeyPath.match(/\/grammar\/level(\d)/);
    if (levelMatch) grammarLevel = parseInt(levelMatch[1], 10);
    totalModes = grammarLevel === 1 ? 4 : 6;
    if (grammarLevel === 2 && /prepositions_/i.test(listKeyPath)) totalModes = 4;
    if (/wh_who_what|wh_where_when_whattime|wh_how_why_which/i.test(listKeyPath)) totalModes = 4;
    if (/present_simple_questions_wh/i.test(listKeyPath)) totalModes = 5;
  } else {
    totalModes = 6;
  }

  if (Number.isFinite(modeMeta.modes_total) && modeMeta.modes_total > 0 && modeMeta.modes_total <= 10) {
    totalModes = modeMeta.modes_total;
  }

  const isSentenceOnlyAssignment = forcedMode === 'full_sentence_mode'
    || forcedMode === 'sentence_unscramble'
    || difficultyMode === 'sentence_unscramble'
    || sessions.some((sess) => isSentenceMode(sess.mode));

  let isSpellingOnlyAssignment = !isSentenceOnlyAssignment && (
    forcedMode === 'spelling'
    || difficultyMode === 'spelling'
    || modeMeta.modes_total === 1
    || goalValueHint
  );

  if (!isSpellingOnlyAssignment && sessions.length > 0) {
    isSpellingOnlyAssignment = sessions.every((sess) => isSpellingMode(sess.mode));
  }

  const requiredModeCount = Number.isFinite(modeMeta.modes_required) && modeMeta.modes_required > 0
    ? modeMeta.modes_required
    : totalModes;
  const requiredStars = Number.isFinite(modeMeta.required_stars) && modeMeta.required_stars > 0
    ? modeMeta.required_stars
    : null;

  return {
    category,
    difficultyMode,
    forcedMode,
    totalModes,
    requiredModeCount,
    requiredStars,
    isSentenceOnlyAssignment,
    isSpellingOnlyAssignment,
  };
}

function evaluateHomeworkCompletion(assignment, sessions = []) {
  const config = getHomeworkCompletionConfig(assignment, sessions);
  const byMode = new Map();
  let latestCompletedAt = null;
  let latestMode = null;

  sessions.forEach((session) => {
    const mode = String(session.mode || 'unknown');
    const previous = byMode.get(mode);
    const stars = Math.max(0, Number(session.stars) || 0);
    if (!previous || stars > previous.stars) {
      byMode.set(mode, { stars, completed_at: session.completed_at || null });
    }
    const completedAt = session.completed_at ? new Date(session.completed_at) : null;
    if (completedAt && !Number.isNaN(completedAt.getTime()) && (!latestCompletedAt || completedAt > new Date(latestCompletedAt))) {
      latestCompletedAt = session.completed_at;
      latestMode = mode;
    }
  });

  const modesArr = Array.from(byMode.entries()).map(([mode, value]) => ({ mode, bestStars: value.stars }));
  const starsEarned = modesArr.reduce((sum, mode) => sum + (mode.bestStars || 0), 0);
  const spellingDone = modesArr.some((mode) => mode.bestStars >= 1 && isSpellingMode(mode.mode));
  const sentenceDone = sessions.some((session) => isSentenceMode(session.mode));
  const countedModes = modesArr.filter((mode) => mode.bestStars >= 1).length;

  let completed = false;
  let completion = 0;
  if (config.isSentenceOnlyAssignment) {
    completed = sentenceDone;
    completion = completed ? 100 : 0;
  } else if (config.isSpellingOnlyAssignment) {
    completed = spellingDone;
    completion = completed ? 100 : 0;
  } else if (config.requiredStars) {
    completed = starsEarned >= config.requiredStars;
    completion = Math.max(0, Math.min(100, Math.round((starsEarned / config.requiredStars) * 100)));
  } else {
    completed = config.requiredModeCount > 0 ? countedModes >= config.requiredModeCount : false;
    completion = config.requiredModeCount > 0 ? Math.max(0, Math.min(100, Math.round((countedModes / config.requiredModeCount) * 100))) : 0;
  }

  return {
    completed,
    completion,
    completed_at: completed ? latestCompletedAt : null,
    mode: completed ? latestMode : null,
    stars: starsEarned,
  };
}

async function assignmentProgress(event) {
  // Returns per-student progress for a given assignment id
  const assignmentId = event.queryStringParameters?.assignment_id || event.queryStringParameters?.id || null;
  const className = event.queryStringParameters?.class || null;
  if (!assignmentId) return _json(400,{ success:false, error:'Missing assignment_id' });
  // Fetch assignment
  let { data: assignment, error: aErr } = await supabase.from('homework_assignments').select('*').eq('id', assignmentId).single();
  if (aErr || !assignment) return _json(404,{ success:false, error:'Assignment not found' });
  assignment.list_meta = parseAssignmentMeta(assignment.list_meta);

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
    const { data: updatedAssignment, error: updErr } = await supabase
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
  // Phonics detection: check for phonics indicators in list_key, title, or list_title
  // Also detect "blend", "sound", or specific phonics patterns
  if (assignLower.includes('phonics') || assignLower.includes('sound') || /\bblend\b/.test(assignLower)) {
    category = 'phonics';
  } else if (assignLower.includes('grammar') || assignLower.includes('/grammar/')) {
    category = 'grammar';
  }
  // Load students in class
  const { data: students, error: sErr } = await supabase.from('profiles').select('id, name, korean_name').eq('class', targetClass);
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
      // Also include variants that include the legacy project prefix
      try {
        const gaPrefixed = `Games/english_arcade/${eq1}`;
        orFilters.push(`list_name.ilike.%${gaPrefixed}%`);
        const gaCorePref = `Games/english_arcade/${coreName}`;
        orFilters.push(`list_name.ilike.%${gaCorePref}%`);
      } catch (e) { /* ignore */ }
      normalizedTokens.forEach(token => {
        const safeToken = token.replace(/\s+/g, '%');
        orFilters.push(`list_name.ilike.%${safeToken}%`);
      });
      const { data: sessData, error: sessErr } = await supabase
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
        const broadLikeGa = `%Games/english_arcade/${assignment.list_key}%`;
        const { data: broadSess, error: broadErr } = await supabase
          .from('progress_sessions')
          .select('user_id, list_name, mode, summary, list_size')
          .in('user_id', students.map(s=>s.id))
          .or(`list_name.ilike.${broadLike},list_name.ilike.${broadLikeGa}`)
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
        const { data: normSess, error: normErr } = await supabase
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
          const { data: fallbackSess, error: fbErr } = await supabase
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

      // 5) Display-name fallback: match sessions where list_name might be a friendly display name
      // E.g., list_key="phonics-blends-dr-fl-fr.json" but session list_name="Blend Dr Fl Fr"
      if ((!sessions || sessions.length === 0) && coreName) {
        // Extract significant tokens from filename (e.g., "phonics-blends-dr-fl-fr" -> ["blends", "dr", "fl", "fr"])
        const tokens = coreName.toLowerCase().split(/[-_]+/).filter(t => t.length >= 2 && !/^(phonics|sample|wordlists|level\d?)$/.test(t));
        if (tokens.length >= 2) {
          // Build a flexible pattern that matches if all significant tokens appear in list_name (any order)
          // For Supabase ilike, we need a single pattern. Use a minimal approach: match first meaningful token
          const keyToken = tokens.find(t => t.length >= 2 && !/^(and|the|is|vs)$/.test(t)) || tokens[0];
          if (keyToken) {
            const displayLike = `%${keyToken}%`;
            const { data: displaySess, error: dispErr } = await supabase
              .from('progress_sessions')
              .select('user_id, list_name, mode, summary, list_size')
              .in('user_id', students.map(s=>s.id))
              .ilike('list_name', displayLike)
              .not('ended_at', 'is', null);
            if (!dispErr && Array.isArray(displaySess) && displaySess.length) {
              // Filter to require at least 2 tokens present in list_name (reduces false positives)
              const filtered = displaySess.filter(s => {
                if (!s.list_name) return false;
                const ln = s.list_name.toLowerCase();
                const matchCount = tokens.filter(t => ln.includes(t)).length;
                return matchCount >= Math.min(2, tokens.length);
              });
              if (filtered.length) {
                sessions = filtered;
                console.log(`assignmentProgress: matched sessions via display-name token fallback (${sessions.length}) for assignment ${assignment.id}, tokens: [${tokens.join(', ')}]`);
              }
            }
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
    const { data: attemptsData, error: attErr } = await supabase
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
  function deriveStars(summary, modeRaw) {
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
    // Fallback for point-only modes (e.g., level_up)
    const m = String(modeRaw || '').toLowerCase();
    if (typeof s.score === 'number' && !Number.isFinite(s.total) && !Number.isFinite(s.max)) {
      const pts = Math.max(0, Math.floor(s.score));
      if (m.includes('level_up')) {
        if (pts >= 20) return 5;
        if (pts >= 15) return 4;
        if (pts >= 10) return 3;
        if (pts >= 5) return 2;
        if (pts >= 1) return 1;
        return 0;
      }
    }
    return 0;
  }
  const byStudent = new Map();
  students.forEach(st => byStudent.set(st.id, { user_id: st.id, name: st.name, korean_name: st.korean_name, modes: {}, list_size: null, words_attempted: new Set() }));
  sessions.forEach(sess => {
    const row = byStudent.get(sess.user_id); if (!row) return;
    if (Number.isFinite(sess.list_size) && sess.list_size > 0) row.list_size = sess.list_size;
    const summary = parseSummary(sess.summary);
    const stars = deriveStars(summary, sess.mode);
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
  
  // Determine total modes possible for this list based on category and grammar level
  // Phonics: always 4 modes (listen, read, spell, test)
  // Vocab: always 6 modes (match, listen, read, spell, test, level_up)
  // Grammar Level 1: 4 modes (lesson, choose, fill, unscramble)
  // Grammar Level 2+: 6 modes (sorting, choose, fill, unscramble, find_mistake, translation)
  let totalModes;
  if (category === 'phonics') {
    totalModes = 4;
  } else if (category === 'grammar') {
    // Detect grammar level from list_key path
    // e.g., "data/grammar/level1/..." or "Games/english_arcade/data/grammar/level2/..."
    const listKeyPath = (assignment.list_key || '').toLowerCase();
    let grammarLevel = 2; // Default to level 2 (6 modes)
    
    // Check for level indicator in path
    const levelMatch = listKeyPath.match(/\/grammar\/level(\d)/);
    if (levelMatch) {
      grammarLevel = parseInt(levelMatch[1], 10);
    }
    
    // Level 1 grammar has 4 modes; Level 2+ has 6 modes
    totalModes = grammarLevel === 1 ? 4 : 6;
  } else {
    // Vocab: 6 modes
    totalModes = 6;
  }
  // Allow override from assignment meta if explicitly set
  const metaModesRaw = assignment.list_meta?.modes_total ?? assignment.list_meta?.total_modes ?? assignment.list_meta?.mode_count;
  const metaModes = Number(metaModesRaw);
  const difficultyMode = String(assignment.list_meta?.difficulty_mode || '').toLowerCase();
  const forcedMode = String(assignment.list_meta?.forced_mode || assignment.list_meta?.mode || assignment.list_meta?.difficulty_mode || '').toLowerCase();

  // Multiple-signal spelling-only detection:
  // 1. Metadata: forced_mode/difficulty_mode === 'spelling' or modes_total === 1
  // 2. Goal value: goal_value === 1 strongly indicates spelling-only (new assignments)
  // 3. Client hint: frontend passes spelling_only=1 when it detects spelling-only locally
  // 4. Session-based: if ALL sessions for this assignment are spelling/listen_and_spell only
  const clientHintSpellingOnly = String(event.queryStringParameters?.spelling_only || '').trim() === '1';
  const goalValueHint = Number(assignment.goal_value) === 1;
  let isSpellingOnlyAssignment = forcedMode === 'spelling' || difficultyMode === 'spelling' || metaModes === 1 || goalValueHint || clientHintSpellingOnly;

  // Session-based fallback: if no metadata signals fired, check actual session data
  // If every session mode is spelling/listen_and_spell, infer spelling-only
  if (!isSpellingOnlyAssignment && sessions.length > 0) {
    const allSpelling = sessions.every(s => {
      const m = String(s.mode || '').toLowerCase();
      return m === 'spelling' || m === 'listen_and_spell' || m === 'spell';
    });
    if (allSpelling) {
      isSpellingOnlyAssignment = true;
      console.log(`[assignmentProgress] Session-inferred spelling-only for assignment ${assignment.id} (all ${sessions.length} sessions are spelling)`);
    }
  }

  // Diagnostic logging — shows exactly what the detection sees
  console.log(`[assignmentProgress] spelling-only detection for assignment ${assignment.id} (${assignment.title}):`, JSON.stringify({
    forcedMode, difficultyMode, metaModes, goalValueHint, clientHintSpellingOnly, isSpellingOnlyAssignment,
    raw_list_meta: assignment.list_meta,
    goal_type: assignment.goal_type,
    goal_value: assignment.goal_value,
  }));

  if (isSpellingOnlyAssignment) {
    totalModes = 1;
    // Auto-heal: backfill forced_mode into list_meta if missing, so future calls work without hints
    if (!assignment.list_meta?.forced_mode || assignment.list_meta.forced_mode !== 'spelling') {
      try {
        const healedMeta = { ...(assignment.list_meta || {}), forced_mode: 'spelling', modes_total: 1, difficulty_mode: 'spelling' };
        await supabase.from('homework_assignments').update({ list_meta: healedMeta }).eq('id', assignment.id);
        assignment.list_meta = healedMeta;
        console.log(`[assignmentProgress] Auto-healed list_meta for assignment ${assignment.id}: added forced_mode:spelling`);
      } catch (e) { console.warn('[assignmentProgress] Auto-heal failed:', e.message); }
    }
  } else if (Number.isFinite(metaModes) && metaModes > 0 && metaModes <= 10) {
    // Only override if category matches expected range
    if (category === 'phonics' && metaModes <= 4) totalModes = metaModes;
    else if (category === 'grammar' && metaModes >= 4 && metaModes <= 6) totalModes = metaModes;
    else if (category === 'vocab' && (metaModes >= 4 && metaModes <= 8)) totalModes = metaModes;
  }
  console.log(`[assignmentProgress] category=${category}, totalModes=${totalModes} for assignment ${assignment.id} (${assignment.title})`);
  
  const progress = Array.from(byStudent.values()).map(r => {
    const rawModesArr = Object.entries(r.modes).map(([mode,v]) => ({ mode, bestStars: v.stars, bestAccuracy: v.accuracy, sessions: v.sessions }));
    const starsEarned = rawModesArr.reduce((sum,m)=> sum + (m.bestStars||0), 0);
    const bestAccuracy = rawModesArr.reduce((best,m)=> Math.max(best, m.bestAccuracy||0), 0);
    const overallAccuracy = (r._total && r._total > 0) ? Math.round((r._score / r._total) * 100) : 0;
    // Only count modes where the student achieved at least 1 star toward homework completion
    // Requirement: a level is complete when the student has earned >=1 star in every required mode
    const spellingModeMatched = rawModesArr.some(m => {
      const modeName = String(m.mode || '').toLowerCase();
      return m.bestStars >= 1 && (modeName === 'spelling' || modeName === 'listen_and_spell');
    });
    const countedModesArr = isSpellingOnlyAssignment
      ? (spellingModeMatched ? [{ mode: 'spelling', bestStars: 1 }] : [])
      : rawModesArr.filter(m => m.bestStars >= 1);
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
      // A homework is considered completed only when every mode has at least 1 star
      status: assignment.active ? (completionPercent >= 100 ? 'Completed' : 'In Progress') : 'Ended',
      category
    };
  });
  return _json(200,{
    success:true,
    _v: 'hw-api-v4-spelling-fix',
    assignment_id: assignment.id,
    class: targetClass,
    total_modes: totalModes,
    category,
    is_spelling_only: isSpellingOnlyAssignment,
    goal_type: assignment.goal_type || null,
    goal_value: assignment.goal_value || null,
    _debug_meta: { forcedMode, difficultyMode, metaModes, goalValueHint, clientHintSpellingOnly },
    progress
  });
}

async function getProfileForEvent(event) {
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) return null;

  const { data, error } = await supabase
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

  await autoExpireAssignmentsPastGrace({ className: prof.class });

  const { data, error } = await supabase
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
      teacher_name: a.profiles?.name || null,
      list_meta: parseAssignmentMeta(a.list_meta),
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
      const { data, error } = await supabase.from('homework_assignments').select('*').eq('id', assignmentId).single();
      if (error || !data) return _json(404, { success: false, error: 'Assignment not found' });
      assignment = data;
    } else if (listKey) {
      // Try to find an active assignment for this student's class matching the list_key
      const { data, error } = await supabase.from('homework_assignments')
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

  const listMeta = parseAssignmentMeta(assignment.list_meta);
  let tokens = Array.isArray(listMeta?.run_tokens) ? listMeta.run_tokens.map(r => r?.token).filter(Boolean) : [];

  // Backfill token here as well so student session_start can always get a token
  // before assignment_progress is requested.
  if (!tokens.length) {
    const autoToken = `run_student_${assignment.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const updatedMeta = {
      ...listMeta,
      run_tokens: [{ token: autoToken, created_at: new Date().toISOString(), auto: true, backfilled: true }]
    };
    const { data: upd, error: updErr } = await supabase
      .from('homework_assignments')
      .update({ list_meta: updatedMeta })
      .eq('id', assignment.id)
      .select('id, list_meta')
      .single();
    if (!updErr && upd) {
      tokens = [autoToken];
      console.log(`[getRunTokenForStudent] Backfilled run_token for assignment ${assignment.id}: ${autoToken}`);
    }
  }

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
  const { data: prof, error: profErr } = await supabase
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
  const { data: assignment, error: aErr } = await supabase
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
    await supabase
      .from('homework_assignments')
      .update({ list_meta: updatedMeta })
      .eq('id', assignmentId);
    console.log(`[link_sessions] Created new run_token for assignment ${assignmentId}: ${runToken}`);
  }

  // Get students in the class
  const { data: students, error: sErr } = await supabase
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

  const { data: sessions, error: sessErr } = await supabase
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

      const { error: updateErr } = await supabase
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

// ─────────────────────────────────────────────────
// TEACHER NOTIFICATIONS
// Returns recent homework completions for all active assignments created by this teacher.
// ?action=teacher_notifications            → full list + count
// ?action=teacher_notifications&mode=count → just count (lightweight, polled every 60s)
// ?since=<ISO>                             → only completions after this timestamp
// ─────────────────────────────────────────────────
async function teacherNotifications(event) {
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) return _json(401, { success: false, error: 'Not signed in' });

  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('id, role, approved')
    .eq('id', authUserId)
    .single();
  if (profErr || !prof) return _json(403, { success: false, error: 'Profile not found' });
  if (!['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return _json(403, { success: false, error: 'Only teachers can view notifications' });
  }

  const isCountOnly = (event.queryStringParameters?.mode || '') === 'count';

  // Default window: 48 hours of completions
  const defaultSince = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const rawSince = event.queryStringParameters?.since || '';
  const since = rawSince && !isNaN(Date.parse(rawSince)) ? rawSince : defaultSince;

  // Step 1: Get teacher's active assignments (created by them)
  const { data: assignments, error: aErr } = await supabase
    .from('homework_assignments')
    .select('id, title, class, due_at, list_meta, active')
    .eq('created_by', authUserId)
    .eq('active', true);

  if (aErr) {
    console.error('[teacher_notifications] assignments fetch error:', aErr.message);
    return _json(500, { success: false, error: 'Failed to fetch assignments' });
  }

  if (!assignments || !assignments.length) {
    return _json(200, { success: true, count: 0, notifications: [], since });
  }

  // Collect all valid run tokens across assignments, mapped back to assignment
  const tokenToAssignment = new Map();
  assignments.forEach(a => {
    const meta = parseAssignmentMeta(a.list_meta);
    const tokens = Array.isArray(meta.run_tokens)
      ? meta.run_tokens.map(r => r?.token).filter(Boolean)
      : [];
    tokens.forEach(tok => tokenToAssignment.set(tok, a));
  });

  if (!tokenToAssignment.size) {
    return _json(200, { success: true, count: 0, notifications: [], since });
  }

  // Step 2: Fetch recent completed sessions in the time window
  const { data: sessions, error: sErr } = await supabase
    .from('progress_sessions')
    .select('user_id, mode, summary, ended_at')
    .gte('ended_at', since)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(500);

  if (sErr) {
    console.error('[teacher_notifications] sessions fetch error:', sErr.message);
    return _json(500, { success: false, error: 'Failed to fetch sessions' });
  }

  // Step 3: Filter sessions by run token, derive stars, deduplicate per student+assignment
  // We keep the best (highest stars) completion per student per assignment
  const completionKey = (userId, assignmentId) => `${userId}__${assignmentId}`;
  const bestCompletion = new Map(); // completionKey → { ...data }

  (sessions || []).forEach(sess => {
    let summary = sess.summary;
    if (typeof summary === 'string') { try { summary = JSON.parse(summary); } catch { summary = {}; } }
    summary = summary || {};

    const token = summary.assignment_run;
    if (!token) return;

    const assignment = tokenToAssignment.get(token);
    if (!assignment) return;

    // Derive stars from accuracy
    let stars = 0;
    if (typeof summary.stars === 'number') {
      stars = summary.stars;
    } else {
      let acc = null;
      if (typeof summary.accuracy === 'number') acc = summary.accuracy;
      else if (typeof summary.score === 'number' && typeof summary.total === 'number' && summary.total > 0) acc = summary.score / summary.total;
      if (acc !== null) {
        if (acc >= 1) stars = 5;
        else if (acc >= 0.95) stars = 4;
        else if (acc >= 0.90) stars = 3;
        else if (acc >= 0.80) stars = 2;
        else if (acc >= 0.60) stars = 1;
      }
    }

    // Only count meaningful completions (at least 1 star)
    if (stars < 1) return;

    const key = completionKey(sess.user_id, assignment.id);
    const existing = bestCompletion.get(key);
    if (!existing || stars > existing.stars) {
      bestCompletion.set(key, {
        user_id: sess.user_id,
        assignment_id: assignment.id,
        assignment_title: assignment.title,
        class: assignment.class,
        due_at: assignment.due_at,
        stars,
        mode: sess.mode,
        completed_at: sess.ended_at,
      });
    }
  });

  if (isCountOnly) {
    return _json(200, { success: true, count: bestCompletion.size, since });
  }

  // Step 4: Enrich with student names via a single bulk profile fetch
  const userIds = [...new Set([...bestCompletion.values()].map(c => c.user_id))];
  let nameMap = new Map();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, korean_name')
      .in('id', userIds);
    (profiles || []).forEach(p => nameMap.set(p.id, { name: p.name, korean_name: p.korean_name }));
  }

  // Step 5: Group by assignment for the panel UI
  const byAssignment = new Map();
  for (const c of bestCompletion.values()) {
    const profile = nameMap.get(c.user_id) || {};
    const entry = {
      user_id: c.user_id,
      name: profile.name || null,
      korean_name: profile.korean_name || null,
      stars: c.stars,
      mode: c.mode,
      completed_at: c.completed_at,
    };
    if (!byAssignment.has(c.assignment_id)) {
      byAssignment.set(c.assignment_id, {
        assignment_id: c.assignment_id,
        assignment_title: c.assignment_title,
        class: c.class,
        due_at: c.due_at,
        completions: [],
      });
    }
    byAssignment.get(c.assignment_id).completions.push(entry);
  }

  // Sort each assignment's completions newest first
  const notifications = [...byAssignment.values()].map(a => ({
    ...a,
    completions: a.completions.sort((x, y) => new Date(y.completed_at) - new Date(x.completed_at)),
  }));

  return _json(200, {
    success: true,
    count: bestCompletion.size,
    since,
    notifications,
  });
}

async function teacherHomeworkStatus(event) {
  const authUserId = await getUserIdFromCookie(event);
  if (!authUserId) return _json(401, { success: false, error: 'Not signed in' });

  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('id, role, approved')
    .eq('id', authUserId)
    .single();
  if (profErr || !prof) return _json(403, { success: false, error: 'Profile not found' });
  if (!['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return _json(403, { success: false, error: 'Only teachers can view homework status' });
  }

  const { data: assignments, error: aErr } = await supabase
    .from('homework_assignments')
    .select('id, title, class, due_at, list_key, list_meta, goal_type, goal_value, active, created_at')
    .eq('created_by', authUserId)
    .eq('active', true)
    .order('due_at', { ascending: true });

  if (aErr) {
    console.error('[teacher_homework_status] assignments fetch error:', aErr.message);
    return _json(500, { success: false, error: 'Failed to fetch assignments' });
  }

  if (!assignments || !assignments.length) {
    return _json(200, { success: true, assignments: [] });
  }

  const classes = [...new Set(assignments.map((a) => String(a.class || '').trim()).filter(Boolean))];
  const { data: classProfiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, name, korean_name, class, role')
    .in('class', classes)
    .in('role', ['student', 'Student']);

  if (pErr) {
    console.error('[teacher_homework_status] profiles fetch error:', pErr.message);
    return _json(500, { success: false, error: 'Failed to fetch student roster' });
  }

  const studentsByClass = new Map();
  const studentsById = new Map();
  (classProfiles || []).forEach((student) => {
    if (!studentsByClass.has(student.class)) studentsByClass.set(student.class, []);
    studentsByClass.get(student.class).push(student);
    studentsById.set(student.id, student);
  });

  const allStudentIds = [...studentsById.keys()];
  const tokenToAssignment = new Map();
  assignments.forEach((assignment) => {
    const meta = parseAssignmentMeta(assignment.list_meta);
    const tokens = Array.isArray(meta.run_tokens)
      ? meta.run_tokens.map((entry) => entry?.token).filter(Boolean)
      : [];
    tokens.forEach((token) => tokenToAssignment.set(token, assignment));
  });

  const sessionsByAssignmentStudent = new Map();
  if (allStudentIds.length && tokenToAssignment.size) {
    const { data: sessions, error: sErr } = await supabase
      .from('progress_sessions')
      .select('user_id, mode, summary, ended_at')
      .in('user_id', allStudentIds)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(2000);

    if (sErr) {
      console.error('[teacher_homework_status] sessions fetch error:', sErr.message);
      return _json(500, { success: false, error: 'Failed to fetch homework completion status' });
    }

    (sessions || []).forEach((sess) => {
      let summary = sess.summary;
      if (typeof summary === 'string') {
        try { summary = JSON.parse(summary); } catch { summary = {}; }
      }
      summary = summary || {};
      const token = summary.assignment_run;
      if (!token) return;

      const assignment = tokenToAssignment.get(token);
      if (!assignment) return;

      let stars = 0;
      if (typeof summary.stars === 'number') {
        stars = summary.stars;
      } else {
        let acc = null;
        if (typeof summary.accuracy === 'number') acc = summary.accuracy;
        else if (typeof summary.score === 'number' && typeof summary.total === 'number' && summary.total > 0) acc = summary.score / summary.total;
        if (acc !== null) {
          if (acc >= 1) stars = 5;
          else if (acc >= 0.95) stars = 4;
          else if (acc >= 0.90) stars = 3;
          else if (acc >= 0.80) stars = 2;
          else if (acc >= 0.60) stars = 1;
        }
      }
      const key = `${assignment.id}__${sess.user_id}`;
      if (!sessionsByAssignmentStudent.has(key)) sessionsByAssignmentStudent.set(key, []);
      sessionsByAssignmentStudent.get(key).push({
        mode: sess.mode,
        completed_at: sess.ended_at,
        stars,
      });
    });
  }

  const assignmentStatus = assignments.map((assignment) => {
    const meta = parseAssignmentMeta(assignment.list_meta);
    const modeMeta = getAssignmentModeMeta(meta);
    const targetIds = getAssignmentTargetStudentIds(assignment.list_meta);
    let roster = (studentsByClass.get(assignment.class) || []).slice();
    if (targetIds.length) {
      roster = targetIds
        .map((id) => studentsById.get(id) || roster.find((student) => student.id === id))
        .filter(Boolean);
    }

    const done = [];
    const pending = [];
    roster.forEach((student) => {
      const entry = {
        user_id: student.id,
        name: student.name || null,
        korean_name: student.korean_name || null,
      };
      const studentSessions = sessionsByAssignmentStudent.get(`${assignment.id}__${student.id}`) || [];
      const status = evaluateHomeworkCompletion(assignment, studentSessions);
      if (status.completed) {
        done.push({ ...entry, completed_at: status.completed_at, stars: status.stars, mode: status.mode, completion: status.completion });
      } else {
        pending.push({ ...entry, completion: status.completion });
      }
    });

    done.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
    pending.sort((a, b) => String(a.name || a.korean_name || '').localeCompare(String(b.name || b.korean_name || '')));

    return {
      assignment_id: assignment.id,
      assignment_title: assignment.title,
      class: assignment.class,
      due_at: assignment.due_at,
      created_at: assignment.created_at,
      ...modeMeta,
      goal_type: assignment.goal_type || null,
      goal_value: assignment.goal_value || null,
      completed_count: done.length,
      pending_count: pending.length,
      total_count: roster.length,
      done,
      pending,
    };
  });

  return _json(200, { success: true, assignments: assignmentStatus });
}
