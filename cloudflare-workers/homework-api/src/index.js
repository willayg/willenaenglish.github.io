/**
 * Cloudflare Worker: homework-api
 * 
 * Drop-in replacement for Netlify function homework_api.js
 * Handles homework assignment CRUD operations
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
  'https://staging.willenaenglish.com',
  // Student and Teacher subdomains
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000',
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

// Get user ID from cookie or Authorization header
async function getUserIdFromRequest(request, env) {
  // First try Authorization header (for local dev / API calls)
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await getUserFromToken(env, token);
    if (user?.id) return user.id;
  }
  
  // Fall back to cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['sb_access'];
  
  if (!token) return null;
  
  const user = await getUserFromToken(env, token);
  return user?.id || null;
}

// Fetch profile
async function fetchProfile(env, userId, fields = 'id,role,approved,class,name,korean_name') {
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=${fields}`,
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

function getAssignmentTargetStudentIds(assignment) {
  const ids = new Set();
  const meta = assignment?.list_meta || {};
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

// Generate run token
function generateRunToken(assignmentId) {
  const t = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run_${assignmentId}_${t}_${rand}`;
}

// Supabase REST helpers
async function supabaseSelect(env, table, query, options = {}) {
  let url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
  
  const resp = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      ...options.headers,
    },
  });
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error);
  }
  
  return resp.json();
}

async function supabaseInsert(env, table, data, options = {}) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.returning !== false ? 'return=representation' : 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error);
  }
  
  if (options.returning === false) return true;
  return resp.json();
}

async function supabaseUpdate(env, table, query, data) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error);
  }
  
  return resp.json();
}

async function supabaseDelete(env, table, query) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal',
    },
  });
  
  return resp.ok;
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
    
    const action = url.searchParams.get('action') || 'list_assignments';
    const mode = url.searchParams.get('mode') || 'teacher';
    
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      return jsonResponse({ success: false, error: 'Supabase environment variables missing' }, 500, origin);
    }
    
    try {
      // ===== CREATE ASSIGNMENT =====
      if (action === 'create_assignment') {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const prof = await fetchProfile(env, authUserId);
        if (!prof) {
          return jsonResponse({ success: false, error: 'Profile not found' }, 403, origin);
        }
        if (!['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
          return jsonResponse({ success: false, error: 'Only teachers can create assignments' }, 403, origin);
        }
        if (prof.approved === false) {
          return jsonResponse({ success: false, error: 'Teacher not approved' }, 403, origin);
        }
        
        const body = await request.json();
        const {
          class: className, title, description, list_key, list_title,
          list_meta, start_at, due_at, goal_type, goal_value,
        } = body;
        const sourceMeta = list_meta && typeof list_meta === 'object' ? { ...list_meta } : {};
        const isSavedGameAssignment = String(sourceMeta.source_type || '').toLowerCase() === 'saved_game' || !!sourceMeta.game_id;
        const effectiveListKey = list_key || (isSavedGameAssignment && sourceMeta.game_id ? `saved_game:${sourceMeta.game_id}` : '');

        if (isSavedGameAssignment && !sourceMeta.game_id) {
          return jsonResponse({ success: false, error: 'Custom saved-game homework requires list_meta.game_id' }, 400, origin);
        }

        if (!className || !title || !effectiveListKey || !due_at) {
          return jsonResponse({
            success: false,
            error: 'Missing required fields: class, title, list_key, due_at',
          }, 400, origin);
        }
        
        const insertData = {
          class: className,
          title,
          description: description || null,
          list_key: effectiveListKey,
          list_title: list_title || null,
          list_meta: sourceMeta,
          start_at: start_at || new Date().toISOString(),
          due_at,
          goal_type: goal_type || 'stars',
          goal_value: goal_value || 5,
          active: true,
          created_by: prof.id,
        };
        
        const data = await supabaseInsert(env, 'homework_assignments', insertData);
        let assignment = data[0];
        let runToken = null;

        const existingTokens = Array.isArray(assignment?.list_meta?.run_tokens)
          ? assignment.list_meta.run_tokens.map(entry => entry?.token).filter(Boolean)
          : [];

        if (!existingTokens.length && assignment?.id) {
          runToken = generateRunToken(assignment.id);
          const updatedMeta = {
            ...(assignment.list_meta || {}),
            run_tokens: [{ token: runToken, created_at: new Date().toISOString(), auto: true }],
          };
          const updatedRows = await supabaseUpdate(env, 'homework_assignments', `id=eq.${assignment.id}`, { list_meta: updatedMeta });
          if (Array.isArray(updatedRows) && updatedRows[0]) {
            assignment = updatedRows[0];
          } else {
            assignment = { ...assignment, list_meta: updatedMeta };
          }
        }

        return jsonResponse({ success: true, assignment, run_token: runToken }, 200, origin);
      }
      
      // ===== CREATE RUN TOKEN =====
      if (action === 'create_run') {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const prof = await fetchProfile(env, authUserId);
        if (!prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
          return jsonResponse({ success: false, error: 'Only teachers can create run tokens' }, 403, origin);
        }
        
        const assignmentId = url.searchParams.get('assignment_id') || url.searchParams.get('id');
        if (!assignmentId) {
          return jsonResponse({ success: false, error: 'Missing assignment_id' }, 400, origin);
        }
        
        // Get current assignment
        const assignments = await supabaseSelect(env, 'homework_assignments', `id=eq.${assignmentId}&select=id,list_meta`);
        if (!assignments || !assignments.length) {
          return jsonResponse({ success: false, error: 'Assignment not found' }, 404, origin);
        }
        
        const current = assignments[0];
        const token = generateRunToken(assignmentId);
        const list_meta = current.list_meta || {};
        const prev = Array.isArray(list_meta.run_tokens) ? list_meta.run_tokens : [];
        const updated = {
          ...list_meta,
          run_tokens: [...prev, { token, created_at: new Date().toISOString() }],
        };
        
        await supabaseUpdate(env, 'homework_assignments', `id=eq.${assignmentId}`, { list_meta: updated });
        
        return jsonResponse({ success: true, assignment_id: assignmentId, run_token: token }, 200, origin);
      }
      
      // ===== GET RUN TOKEN FOR STUDENT =====
      if (action === 'get_run_token') {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const prof = await fetchProfile(env, authUserId);
        if (!prof) {
          return jsonResponse({ success: false, error: 'Profile not found' }, 401, origin);
        }
        
        const assignmentId = url.searchParams.get('assignment_id') || url.searchParams.get('id');
        const listKey = url.searchParams.get('list_key') || url.searchParams.get('list_name');
        
        if (!assignmentId && !listKey) {
          return jsonResponse({ success: false, error: 'Missing assignment_id or list_key' }, 400, origin);
        }
        
        let assignment = null;
        
        if (assignmentId) {
          const data = await supabaseSelect(env, 'homework_assignments', `id=eq.${assignmentId}&select=*`);
          assignment = data && data[0];
        } else if (listKey) {
          const data = await supabaseSelect(
            env,
            'homework_assignments',
            `class=eq.${encodeURIComponent(prof.class)}&active=eq.true&list_key=ilike.*${encodeURIComponent(listKey)}*&order=created_at.desc&limit=1&select=*`
          );
          assignment = data && data[0];
        }
        
        if (!assignment) {
          return jsonResponse({ success: false, error: 'Assignment not found' }, 404, origin);
        }
        
        if (String(assignment.class || '') !== String(prof.class || '')) {
          return jsonResponse({ success: false, error: 'Not assigned to this class' }, 403, origin);
        }

        const targetStudentIds = getAssignmentTargetStudentIds(assignment);
        if (targetStudentIds.length && !targetStudentIds.includes(authUserId)) {
          return jsonResponse({ success: false, error: 'Not assigned to this student' }, 403, origin);
        }
        
        const tokens = Array.isArray(assignment.list_meta?.run_tokens)
          ? assignment.list_meta.run_tokens.map(r => r?.token).filter(Boolean)
          : [];
        
        return jsonResponse({ success: true, assignment_id: assignment.id, tokens }, 200, origin);
      }
      
      // ===== LIST ASSIGNMENTS =====
      if (action === 'list_assignments') {
        if (mode === 'student') {
          // Student mode
          const authUserId = await getUserIdFromRequest(request, env);
          if (!authUserId) {
            return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
          }
          
          const prof = await fetchProfile(env, authUserId);
          if (!prof) {
            return jsonResponse({ success: false, error: 'Profile not found' }, 401, origin);
          }
          if (!prof.class) {
            return jsonResponse({ success: false, error: 'No class set for this profile' }, 400, origin);
          }
          
          const nowIso = new Date().toISOString();
          const data = await supabaseSelect(
            env,
            'homework_assignments',
            `class=eq.${encodeURIComponent(prof.class)}&active=eq.true&start_at=lte.${nowIso}&order=due_at.asc&select=*`
          );
          const assignmentsForStudent = (data || []).filter((assignment) => {
            const targetStudentIds = getAssignmentTargetStudentIds(assignment);
            return !targetStudentIds.length || targetStudentIds.includes(authUserId);
          });
          
          return jsonResponse({
            success: true,
            class: prof.class,
            student_name: prof.name || prof.korean_name || null,
            assignments: assignmentsForStudent,
          }, 200, origin);
        }
        
        // Teacher mode
        const className = url.searchParams.get('class');
        let query = 'order=created_at.desc&select=*';
        if (className) {
          query = `class=eq.${encodeURIComponent(className)}&${query}`;
        }
        
        const data = await supabaseSelect(env, 'homework_assignments', query);
        return jsonResponse({ success: true, assignments: data || [] }, 200, origin);
      }
      
      // ===== END ASSIGNMENT =====
      if (action === 'end_assignment') {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const prof = await fetchProfile(env, authUserId);
        if (!prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
          return jsonResponse({ success: false, error: 'Only teachers can end assignments' }, 403, origin);
        }
        
        const body = await request.json();
        const assignmentId = body.id || body.assignment_id;
        
        if (!assignmentId) {
          return jsonResponse({ success: false, error: 'Missing assignment id' }, 400, origin);
        }
        
        const data = await supabaseUpdate(
          env,
          'homework_assignments',
          `id=eq.${assignmentId}`,
          { active: false, ended_at: new Date().toISOString() }
        );
        
        return jsonResponse({ success: true, assignment: data[0] }, 200, origin);
      }
      
      // ===== DELETE ASSIGNMENT =====
      if (action === 'delete_assignment') {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const prof = await fetchProfile(env, authUserId);
        if (!prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
          return jsonResponse({ success: false, error: 'Only teachers can delete assignments' }, 403, origin);
        }
        
        const assignmentId = url.searchParams.get('id') || url.searchParams.get('assignment_id');
        if (!assignmentId) {
          return jsonResponse({ success: false, error: 'Missing assignment id' }, 400, origin);
        }
        
        await supabaseDelete(env, 'homework_assignments', `id=eq.${assignmentId}`);
        return jsonResponse({ success: true }, 200, origin);
      }

      // ===== UPDATE ASSIGNMENT META =====
      if (action === 'update_assignment_meta') {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }

        const prof = await fetchProfile(env, authUserId);
        if (!prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
          return jsonResponse({ success: false, error: 'Only teachers can update assignments' }, 403, origin);
        }

        const body = await request.json();
        const uaId = body.assignment_id || url.searchParams.get('assignment_id');
        if (!uaId) {
          return jsonResponse({ success: false, error: 'Missing assignment_id' }, 400, origin);
        }

        const existing = await supabaseSelect(env, 'homework_assignments', `id=eq.${uaId}&select=*`);
        if (!existing || !existing.length) {
          return jsonResponse({ success: false, error: 'Assignment not found' }, 404, origin);
        }

        const existingMeta = existing[0].list_meta || {};
        const mergedMeta = { ...existingMeta, ...(body.list_meta || {}) };
        const updateFields = { list_meta: mergedMeta };
        if (body.goal_value !== undefined) updateFields.goal_value = body.goal_value;
        if (body.goal_type !== undefined) updateFields.goal_type = body.goal_type;

        const updated = await supabaseUpdate(env, 'homework_assignments', `id=eq.${uaId}`, updateFields);
        console.log(`[homework-api] Updated assignment ${uaId} meta:`, JSON.stringify(updateFields));
        return jsonResponse({ success: true, assignment: updated?.[0] || null }, 200, origin);
      }
      
      // ===== ASSIGNMENT PROGRESS =====
      if (action === 'assignment_progress') {
        const assignmentId = url.searchParams.get('assignment_id') || url.searchParams.get('id');
        const className = url.searchParams.get('class');
        
        if (!assignmentId) {
          return jsonResponse({ success: false, error: 'Missing assignment_id' }, 400, origin);
        }
        
        // Get the authenticated user
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const authProf = await fetchProfile(env, authUserId);
        if (!authProf) {
          return jsonResponse({ success: false, error: 'Profile not found' }, 403, origin);
        }
        
        // Fetch assignment
        const assignments = await supabaseSelect(env, 'homework_assignments', `id=eq.${assignmentId}&select=*`);
        if (!assignments || !assignments.length) {
          return jsonResponse({ success: false, error: 'Assignment not found' }, 404, origin);
        }
        
        const assignment = assignments[0];
        const targetClass = className || assignment.class;
        const targetStudentIds = getAssignmentTargetStudentIds(assignment);
        
        // Authorization: only teachers/admins can see all students, students only see their own
        const isTeacher = ['teacher', 'admin'].includes(String(authProf.role || '').toLowerCase());
        if (!isTeacher && String(authProf.class || '') !== String(targetClass || '')) {
          return jsonResponse({ success: false, error: 'Not authorized to view this assignment' }, 403, origin);
        }
        if (!isTeacher && targetStudentIds.length && !targetStudentIds.includes(authUserId)) {
          return jsonResponse({ success: false, error: 'Not authorized to view this assignment' }, 403, origin);
        }
        
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
        const students = await supabaseSelect(
          env,
          'profiles',
          targetStudentIds.length
            ? `class=eq.${encodeURIComponent(targetClass)}&id=in.(${targetStudentIds.join(',')})&select=id,name,korean_name`
            : `class=eq.${encodeURIComponent(targetClass)}&select=id,name,korean_name`
        );
        
        if (!students || !students.length) {
          return jsonResponse({
            success: true,
            assignment_id: assignment.id,
            class: targetClass,
            category,
            progress: [],
          }, 200, origin);
        }
        
        // Get student IDs for query
        const studentIds = students.map(s => s.id);
        
        // Load sessions for these students
        // Use a simpler query approach - just get all completed sessions
        const sessions = await supabaseSelect(
          env,
          'progress_sessions',
          `user_id=in.(${studentIds.join(',')})&ended_at=not.is.null&select=user_id,list_name,mode,summary,list_size`
        );
        
        // Build progress map
        const byStudent = new Map();
        students.forEach(st => {
          byStudent.set(st.id, {
            user_id: st.id,
            name: st.name,
            korean_name: st.korean_name,
            modes: {},
            list_size: null,
          });
        });
        
        // Parse summary and derive stars
        function parseSummary(summary) {
          if (!summary) return null;
          if (typeof summary === 'object') return summary;
          try { return JSON.parse(summary); } catch { return null; }
        }
        
        function deriveStars(summary, modeRaw) {
          const s = summary || {};
          let acc = null;
          if (typeof s.accuracy === 'number') acc = s.accuracy;
          else if (typeof s.score === 'number' && (typeof s.total === 'number' || typeof s.max === 'number') && (s.total || s.max) > 0) {
            acc = s.score / (s.total || s.max);
          }
          if (acc !== null) {
            if (acc >= 1) return 5;
            if (acc >= 0.95) return 4;
            if (acc >= 0.90) return 3;
            if (acc >= 0.80) return 2;
            if (acc >= 0.60) return 1;
            return 0;
          }
          if (typeof s.stars === 'number') return s.stars;
          // Fallback: some modes (e.g., level_up) record only raw score (points).
          const m = String(modeRaw || '').toLowerCase();
          if (typeof s.score === 'number' && !Number.isFinite(s.total) && !Number.isFinite(s.max)) {
            // Map points to stars with simple thresholds
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
        
        const requestRunToken = url.searchParams.get('run_token') || null;
        const assignmentRunTokens = Array.isArray(assignment.list_meta?.run_tokens)
          ? assignment.list_meta.run_tokens.map(entry => entry?.token).filter(Boolean)
          : [];
        const isSavedGameAssignment = String(assignment.list_meta?.source_type || '').toLowerCase() === 'saved_game'
          || !!assignment.list_meta?.game_id
          || /^saved_game:/i.test(String(assignment.list_key || ''));

        let filteredSessions = [];
        if (isSavedGameAssignment) {
          const validTokens = [requestRunToken, ...assignmentRunTokens].filter(Boolean);
          filteredSessions = (sessions || []).filter(sess => {
            const summary = parseSummary(sess.summary);
            const token = summary && summary.assignment_run;
            return !!token && validTokens.includes(token);
          });
        } else {
          // Filter sessions by list name matching.
          // The stored assignment list_key and the recorded session list_name are not always
          // formatted the same way, so match across path, title, and normalized token variants.
          const listKeyLast = (assignment.list_key || '').split('/').pop();
          const coreName = listKeyLast.replace(/\.json$/, '').toLowerCase();
          const coreNameSpaces = coreName.replace(/_/g, ' ');
          const assignmentTitle = (assignment.title || '').toLowerCase();
          const listTitle = (assignment.list_title || '').toLowerCase();
          const listKeyFull = (assignment.list_key || '').toLowerCase();
          const listKeyWithoutPrefix = listKeyFull.replace(/^games\/english_arcade\//i, '');
          const tokens = coreName.split(/[-_]+/).filter(t => t.length >= 2 && !/^(phonics|sample|wordlists|level\d?|grammar|data|games|english|arcade|json)$/.test(t));
          const normalize = (value) => String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
          const normalizedCoreName = normalize(coreName);
          const normalizedTitle = normalize(assignmentTitle);

          filteredSessions = (sessions || []).filter(sess => {
            const listName = (sess.list_name || '').toLowerCase();
            const normalizedListName = normalize(listName);

            if (listName.includes(coreName)) {
              return true;
            }
            if (listName.includes(listKeyFull) || listName.includes(listKeyWithoutPrefix)) {
              return true;
            }
            if (listKeyFull.includes(listName) || listKeyWithoutPrefix.includes(listName)) {
              return true;
            }
            if (listName.includes(coreNameSpaces)) {
              return true;
            }
            if (assignmentTitle && listName.includes(assignmentTitle)) {
              return true;
            }
            if (listTitle && listName.includes(listTitle)) {
              return true;
            }
            if (normalizedListName.includes(normalizedCoreName) || normalizedCoreName.includes(normalizedListName)) {
              return true;
            }
            if (normalizedTitle && normalizedListName.includes(normalizedTitle)) {
              return true;
            }
            if (tokens.length >= 2) {
              const rawTokenMatches = tokens.filter(t => listName.includes(t)).length;
              if (rawTokenMatches >= Math.ceil(tokens.length * 0.5)) {
                return true;
              }
              const normalizedTokenMatches = tokens.filter(t => normalizedListName.includes(t)).length;
              if (normalizedTokenMatches >= Math.ceil(tokens.length * 0.5)) {
                return true;
              }
            }
            return false;
          });
        }
        
        filteredSessions.forEach(sess => {
          const row = byStudent.get(sess.user_id);
          if (!row) return;
          
          if (Number.isFinite(sess.list_size) && sess.list_size > 0) {
            row.list_size = sess.list_size;
          }
          
          const summary = parseSummary(sess.summary);
          const stars = deriveStars(summary, sess.mode);
          const modeKey = sess.mode || 'unknown';
          
          const prev = row.modes[modeKey];
          if (prev) {
            if (stars > prev.stars) prev.stars = stars;
            prev.sessions += 1;
          } else {
            row.modes[modeKey] = { stars, sessions: 1 };
          }
        });
        
        // Determine total modes based on category and grammar level
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
          
          // Start with the base grammar mode count from the level.
          totalModes = grammarLevel === 1 ? 4 : 6;

          // Some grammar lists intentionally expose fewer modes than the default.
          const isPrepositionList = /prepositions_/i.test(listKeyPath);
          if (grammarLevel === 2 && isPrepositionList) {
            totalModes = 4;
          }

          const isWhMicroList = /wh_who_what|wh_where_when_whattime|wh_how_why_which/i.test(listKeyPath);
          if (isWhMicroList) {
            totalModes = 4;
          }

          const isWhQuestionsList = /present_simple_questions_wh/i.test(listKeyPath);
          if (isWhQuestionsList) {
            totalModes = 5;
          }
        } else {
          // Vocab: 6 modes
          totalModes = 6;
        }
        // Allow override from assignment meta if explicitly set
        const metaModesRaw = assignment.list_meta?.modes_total ?? assignment.list_meta?.total_modes ?? assignment.list_meta?.mode_count;
        const metaModes = Number(metaModesRaw);
        const difficultyMode = String(assignment.list_meta?.difficulty_mode || '').toLowerCase();
        const forcedMode = String(assignment.list_meta?.forced_mode || assignment.list_meta?.mode || assignment.list_meta?.difficulty_mode || '').toLowerCase();

        // Multi-signal spelling-only detection:
        // 1. Metadata: forced_mode/difficulty_mode === 'spelling' or modes_total === 1
        // 2. Goal value: goal_value === 1  (set by Game Builder for spelling-only)
        // 3. Client hint: frontend passes spelling_only=1 URL param
        // 4. Session inference: if ALL sessions are spelling/listen_and_spell modes
        const clientHintSpellingOnly = url.searchParams.get('spelling_only') === '1';
        const goalValueHint = Number(assignment.goal_value) === 1;
        let isSpellingOnlyAssignment = forcedMode === 'spelling' || difficultyMode === 'spelling' || metaModes === 1 || goalValueHint || clientHintSpellingOnly;

        // Session-based fallback: if metadata didn't flag it, check actual session data
        if (!isSpellingOnlyAssignment && filteredSessions.length > 0) {
          const allSpelling = filteredSessions.every(s => {
            const m = String(s.mode || '').toLowerCase();
            return m === 'spelling' || m === 'listen_and_spell' || m === 'spell';
          });
          if (allSpelling) {
            isSpellingOnlyAssignment = true;
            console.log(`[homework-api] Session-inferred spelling-only for assignment ${assignment.id}`);
          }
        }

        console.log(`[homework-api] spelling-only detection for ${assignment.id} (${assignment.title}):`, JSON.stringify({
          forcedMode, difficultyMode, metaModes, goalValueHint, clientHintSpellingOnly, isSpellingOnlyAssignment,
          goal_value: assignment.goal_value, goal_type: assignment.goal_type,
        }));

        if (isSpellingOnlyAssignment) {
          totalModes = 1;
          // Auto-heal: backfill forced_mode into list_meta so future calls work without hints
          if (!assignment.list_meta?.forced_mode || assignment.list_meta.forced_mode !== 'spelling') {
            try {
              const healedMeta = { ...(assignment.list_meta || {}), forced_mode: 'spelling', modes_total: 1, difficulty_mode: 'spelling' };
              await supabaseUpdate(env, 'homework_assignments', `id=eq.${assignment.id}`, { list_meta: healedMeta });
              console.log(`[homework-api] Auto-healed list_meta for assignment ${assignment.id}: added forced_mode:spelling`);
            } catch (e) { console.warn('[homework-api] Auto-heal failed:', e.message); }
          }
        } else if (Number.isFinite(metaModes) && metaModes > 0 && metaModes <= 10) {
          if (category === 'phonics' && metaModes <= 4) totalModes = metaModes;
          else if (category === 'grammar' && metaModes >= 4 && metaModes <= 6) totalModes = metaModes;
          else if (category === 'vocab' && metaModes >= 4 && metaModes <= 8) totalModes = metaModes;
        }
        
        const progress = Array.from(byStudent.values()).map(r => {
          const modesArr = Object.entries(r.modes).map(([mode, v]) => ({
            mode,
            bestStars: v.stars,
            sessions: v.sessions,
          }));
          
          const starsEarned = modesArr.reduce((sum, m) => sum + (m.bestStars || 0), 0);

          // For spelling-only: check if student completed any spelling mode with >=1 star
          let modesAttempted;
          if (isSpellingOnlyAssignment) {
            const spellingDone = modesArr.some(m => {
              const mn = String(m.mode || '').toLowerCase();
              return m.bestStars >= 1 && (mn === 'spelling' || mn === 'listen_and_spell' || mn === 'spell');
            });
            modesAttempted = spellingDone ? 1 : 0;
          } else {
            // Only count modes where student achieved at least 1 star toward homework completion
            modesAttempted = modesArr.filter(m => m.bestStars >= 1).length;
          }
          const completionPercent = totalModes > 0 ? Math.round((modesAttempted / totalModes) * 100) : 0;
          
          return {
            user_id: r.user_id,
            name: r.name,
            korean_name: r.korean_name,
            stars: starsEarned,
            completion: completionPercent,
            modes_attempted: modesAttempted,
            modes_total: totalModes,
            modes: modesArr,
            category,
            // A homework is considered completed only when every mode has at least 1 star
            status: assignment.active
              ? (completionPercent >= 100 ? 'Completed' : 'In Progress')
              : 'Ended',
          };
        });
        
        // Filter progress based on authorization: students only see their own data
        let filteredProgress = progress;
        if (!isTeacher) {
          filteredProgress = progress.filter(p => p.user_id === authUserId);
        }
        
        return jsonResponse({
          success: true,
          _v: 'cf-hw-api-v2-spelling-fix',
          assignment_id: assignment.id,
          class: targetClass,
          total_modes: totalModes,
          category,
          is_spelling_only: isSpellingOnlyAssignment,
          difficulty_mode: assignment.list_meta?.difficulty_mode || 'full',
          stars_required: assignment.list_meta?.stars_required || null,
          goal_type: assignment.goal_type || null,
          goal_value: assignment.goal_value || null,
          progress: filteredProgress,
        }, 200, origin);
      }
      
      return jsonResponse({ success: false, error: 'Invalid action' }, 400, origin);
      
    } catch (error) {
      console.error('[homework-api] Error:', error);
      return jsonResponse({ success: false, error: error.message || 'Server error' }, 500, origin);
    }
  },
};
