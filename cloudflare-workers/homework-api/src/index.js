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
        
        if (!className || !title || !list_key || !due_at) {
          return jsonResponse({
            success: false,
            error: 'Missing required fields: class, title, list_key, due_at',
          }, 400, origin);
        }
        
        const insertData = {
          class: className,
          title,
          description: description || null,
          list_key,
          list_title: list_title || null,
          list_meta: list_meta || {},
          start_at: start_at || new Date().toISOString(),
          due_at,
          goal_type: goal_type || 'stars',
          goal_value: goal_value || 5,
          active: true,
          created_by: prof.id,
        };
        
        const data = await supabaseInsert(env, 'homework_assignments', insertData);
        return jsonResponse({ success: true, assignment: data[0] }, 200, origin);
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
          
          return jsonResponse({
            success: true,
            class: prof.class,
            student_name: prof.name || prof.korean_name || null,
            assignments: data || [],
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
      
      // ===== ASSIGNMENT PROGRESS =====
      if (action === 'assignment_progress') {
        const assignmentId = url.searchParams.get('assignment_id') || url.searchParams.get('id');
        const className = url.searchParams.get('class');
        
        if (!assignmentId) {
          return jsonResponse({ success: false, error: 'Missing assignment_id' }, 400, origin);
        }
        
        // Fetch assignment
        const assignments = await supabaseSelect(env, 'homework_assignments', `id=eq.${assignmentId}&select=*`);
        if (!assignments || !assignments.length) {
          return jsonResponse({ success: false, error: 'Assignment not found' }, 404, origin);
        }
        
        const assignment = assignments[0];
        const targetClass = className || assignment.class;
        
        // Load students in class
        const students = await supabaseSelect(
          env,
          'profiles',
          `class=eq.${encodeURIComponent(targetClass)}&select=id,name,korean_name`
        );
        
        if (!students || !students.length) {
          return jsonResponse({
            success: true,
            assignment_id: assignment.id,
            class: targetClass,
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
        
        function deriveStars(summary) {
          const s = summary || {};
          let acc = null;
          if (typeof s.accuracy === 'number') acc = s.accuracy;
          else if (typeof s.score === 'number' && typeof s.total === 'number' && s.total > 0) {
            acc = s.score / s.total;
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
          return 0;
        }
        
        // Filter sessions by list name matching (simplified)
        const listKeyLower = (assignment.list_key || '').toLowerCase();
        const filteredSessions = (sessions || []).filter(sess => {
          const listName = (sess.list_name || '').toLowerCase();
          return listName.includes(listKeyLower) || listKeyLower.includes(listName.split('/').pop());
        });
        
        filteredSessions.forEach(sess => {
          const row = byStudent.get(sess.user_id);
          if (!row) return;
          
          if (Number.isFinite(sess.list_size) && sess.list_size > 0) {
            row.list_size = sess.list_size;
          }
          
          const summary = parseSummary(sess.summary);
          const stars = deriveStars(summary);
          const modeKey = sess.mode || 'unknown';
          
          const prev = row.modes[modeKey];
          if (prev) {
            if (stars > prev.stars) prev.stars = stars;
            prev.sessions += 1;
          } else {
            row.modes[modeKey] = { stars, sessions: 1 };
          }
        });
        
        // Calculate progress
        const totalModes = assignment.list_meta?.modes_total || 6;
        
        const progress = Array.from(byStudent.values()).map(r => {
          const modesArr = Object.entries(r.modes).map(([mode, v]) => ({
            mode,
            bestStars: v.stars,
            sessions: v.sessions,
          }));
          
          const starsEarned = modesArr.reduce((sum, m) => sum + (m.bestStars || 0), 0);
          const modesAttempted = modesArr.filter(m => m.bestStars >= 1).length;
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
            status: assignment.active
              ? (completionPercent >= 100 || starsEarned >= (assignment.goal_value || 5) ? 'Completed' : 'In Progress')
              : 'Ended',
          };
        });
        
        return jsonResponse({
          success: true,
          assignment_id: assignment.id,
          class: targetClass,
          total_modes: totalModes,
          progress,
        }, 200, origin);
      }
      
      return jsonResponse({ success: false, error: 'Invalid action' }, 400, origin);
      
    } catch (error) {
      console.error('[homework-api] Error:', error);
      return jsonResponse({ success: false, error: error.message || 'Server error' }, 500, origin);
    }
  },
};
