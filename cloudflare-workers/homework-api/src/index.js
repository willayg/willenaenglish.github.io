/**
 * Cloudflare Worker: homework-api
 * 
 * Drop-in replacement for Netlify function homework_api.js
 * Uses Supabase REST API directly (no SDK required for Workers)
 * 
 * IMPROVED MODE MATCHING:
 * - Handles spelling modes: spelling, spelling_test, spelling_practice, etc.
 * - Handles all vocab modes: flashcard, match, listen, unscramble, etc.
 * - Proper normalization of mode names for consistent counting
 * 
 * API Actions:
 *   - create_assignment
 *   - create_run
 *   - get_run_token
 *   - list_assignments
 *   - end_assignment
 *   - assignment_progress
 *   - delete_assignment
 *   - link_sessions
 */

const ALLOWED_ORIGINS = [
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://cf.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'http://localhost:8888',
  'http://localhost:9000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:9000',
];

// Known game modes - used to detect and normalize mode names
const VOCAB_MODES = [
  'flashcard', 'match', 'listen', 'unscramble', 
  'spelling', 'spelling_test', 'spelling_practice', 'spell',
  'translation', 'translation_choice', 'reverse_translation',
  'typing', 'dictation', 'audio_match'
];

const PHONICS_MODES = [
  'phonics_listen', 'phonics_match', 'phonics_spell', 'phonics_unscramble'
];

const GRAMMAR_MODES = [
  'grammar_lesson', 'grammar_sorting', 'grammar_find_mistake', 
  'grammar_translation_choice', 'grammar_fill_blank', 'grammar_reorder'
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  };
}

function jsonResponse(status, body, origin) {
  return new Response(JSON.stringify(body), {
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

function generateRunToken(assignmentId) {
  const t = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run_${assignmentId}_${t}_${rand}`;
}

function normalizeListIdentifier(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalize mode name for consistent counting
 * Maps variations like 'spelling_test', 'spell', 'spelling_practice' -> 'spelling'
 */
function normalizeModeName(mode) {
  if (!mode) return 'unknown';
  const m = String(mode).toLowerCase().trim();
  
  // Spelling variants
  if (m.includes('spell') || m === 'spelling_test' || m === 'spelling_practice') {
    return 'spelling';
  }
  
  // Translation variants (including grammar_translation_choice)  
  if (m.includes('translation')) {
    return 'grammar_translation';
  }
  
  // Typing/dictation
  if (m === 'typing' || m === 'dictation') {
    return 'typing';
  }
  
  // Return as-is for other modes
  return m;
}

/**
 * Determine category from assignment info
 */
function determineCategory(assignment) {
  const text = `${assignment.list_key || ''} ${assignment.title || ''} ${assignment.list_title || ''}`.toLowerCase();
  if (text.includes('phonics')) return 'phonics';
  if (text.includes('grammar')) return 'grammar';
  return 'vocab';
}

/**
 * Determine grammar level (1, 2, or 3) from list_key path
 */
function determineGrammarLevel(listKey) {
  if (!listKey) return 1;
  const lk = listKey.toLowerCase();
  if (lk.includes('/level3/') || lk.includes('level3')) return 3;
  if (lk.includes('/level2/') || lk.includes('level2')) return 2;
  return 1;
}

/**
 * Get total expected modes for grammar based on level and specific list
 * 
 * Grammar Level 1 modes (4-5 modes depending on list):
 *   - lesson (How To Win)
 *   - choose (Choose)
 *   - fill_gap (Fill the Gap)
 *   - unscramble (Unscramble)
 *   Note: Some L1 lists may have fewer modes
 * 
 * Grammar Level 2 modes (5 modes):
 *   - sorting (Sorting) - most lists
 *   - choose (Choose) - most lists
 *   - fill_gap (Fill the Gap)
 *   - unscramble (Unscramble)
 *   - find_mistake (Find the Mistake)
 *   - translation (Translation)
 *   Note: Preposition lists and WH lists have fewer modes (no sorting/choose)
 * 
 * Grammar Level 3 modes (6 modes):
 *   - choose (Choose)
 *   - fill_gap (Fill the Gap)
 *   - unscramble (Unscramble)
 *   - sentence_order (Sentence Order)
 *   - find_mistake (Find the Mistake)
 *   - translation (Translation)
 */
function getGrammarModeCount(listKey) {
  if (!listKey) return 5;
  const lk = listKey.toLowerCase();
  const level = determineGrammarLevel(listKey);
  
  if (level === 3) {
    // Level 3: 6 modes (choose, fill_gap, unscramble, sentence_order, find_mistake, translation)
    return 6;
  }
  
  if (level === 2) {
    // Level 2: Check for special lists with fewer modes
    // Preposition lists: no sorting, no choose → 4 modes (fill_gap, unscramble, find_mistake, translation)
    if (lk.includes('prepositions_')) return 4;
    // WH lists: no sorting, no choose → 4 modes
    if (lk.includes('wh_who_what') || lk.includes('wh_where_when') || lk.includes('wh_how_why')) return 4;
    // Present Simple WH Questions: no sorting → 5 modes
    if (lk.includes('present_simple_questions_wh')) return 5;
    // Most L2 lists: 5 modes (sorting, choose, fill_gap, unscramble, find_mistake, translation)
    // Actually many L2 don't have all - typically: sorting, choose, fill_gap, unscramble, find_mistake = 5
    return 5;
  }
  
  // Level 1: 4 modes (lesson, choose, fill_gap, unscramble)
  // Some lists might not have all modes compatible
  return 4;
}

/**
 * Get total expected modes for a category
 */
function getExpectedModes(category, listKey, encounteredModes) {
  if (category === 'phonics') return 4;
  
  if (category === 'grammar') {
    return getGrammarModeCount(listKey);
  }
  
  // Vocab: 6 modes (flashcard, match, listen, unscramble, spelling, translation)
  return 6;
}

/**
 * Supabase REST API helper
 */
class SupabaseClient {
  constructor(url, serviceKey) {
    this.url = url;
    this.serviceKey = serviceKey;
  }

  async query(table, options = {}) {
    const { select = '*', filters = [], single = false, order, limit, method = 'GET', body } = options;
    
    let url = `${this.url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    
    filters.forEach(f => {
      url += `&${f.column}=${f.op}.${encodeURIComponent(f.value)}`;
    });
    
    if (order) {
      url += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`;
    }
    
    if (limit) {
      url += `&limit=${limit}`;
    }

    const headers = {
      'apikey': this.serviceKey,
      'Authorization': `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': single ? 'return=representation' : 'return=representation',
    };

    if (single) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    const fetchOptions = { method, headers };
    if (body && (method === 'POST' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(body);
    }

    const resp = await fetch(url, fetchOptions);
    
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Supabase error ${resp.status}: ${errText}`);
    }
    
    return resp.json();
  }

  async insert(table, data) {
    const url = `${this.url}/rest/v1/${table}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    });
    
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Insert error ${resp.status}: ${errText}`);
    }
    
    const result = await resp.json();
    return Array.isArray(result) ? result[0] : result;
  }

  async update(table, filters, data) {
    let url = `${this.url}/rest/v1/${table}?`;
    filters.forEach((f, i) => {
      if (i > 0) url += '&';
      url += `${f.column}=${f.op}.${encodeURIComponent(f.value)}`;
    });
    
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    });
    
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Update error ${resp.status}: ${errText}`);
    }
    
    const result = await resp.json();
    return Array.isArray(result) ? result[0] : result;
  }

  async getUserFromToken(token) {
    const url = `${this.url}/auth/v1/user`;
    const resp = await fetch(url, {
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!resp.ok) return null;
    return resp.json();
  }
}

// ============================================================
// ACTION HANDLERS
// ============================================================

async function getUserIdFromCookie(request, supabase) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['sb_access'] || cookies['sb-access-token'] || cookies['sb_access_token'];
  if (!token) return null;
  
  try {
    const user = await supabase.getUserFromToken(token);
    return user?.id || null;
  } catch {
    return null;
  }
}

async function getProfile(supabase, userId) {
  try {
    return await supabase.query('profiles', {
      select: 'id,role,approved,class,name,korean_name',
      filters: [{ column: 'id', op: 'eq', value: userId }],
      single: true,
    });
  } catch {
    return null;
  }
}

async function handleCreateAssignment(request, supabase, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: 'Not signed in' }, origin);
  }

  const prof = await getProfile(supabase, userId);
  if (!prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return jsonResponse(403, { success: false, error: 'Only teachers can create assignments' }, origin);
  }
  if (prof.approved === false) {
    return jsonResponse(403, { success: false, error: 'Teacher not approved' }, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON body' }, origin);
  }

  const { class: className, title, description, list_key, list_title, list_meta, start_at, due_at, goal_type, goal_value } = body;

  if (!className || !title || !list_key || !due_at) {
    return jsonResponse(400, { success: false, error: 'Missing required fields: class, title, list_key, due_at' }, origin);
  }

  const autoToken = `run_auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const initialMeta = {
    ...(list_meta || {}),
    run_tokens: [{ token: autoToken, created_at: new Date().toISOString(), auto: true }],
  };

  try {
    const data = await supabase.insert('homework_assignments', {
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
      created_by: prof.id,
    });

    console.log(`[homework_api] Created assignment ${data.id} with auto run_token: ${autoToken}`);
    return jsonResponse(200, { success: true, assignment: data, run_token: autoToken }, origin);
  } catch (err) {
    console.error('create_assignment error:', err);
    return jsonResponse(500, { success: false, error: `Failed to create assignment: ${err.message}` }, origin);
  }
}

async function handleCreateRun(request, supabase, params, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: 'Not signed in' }, origin);
  }

  const prof = await getProfile(supabase, userId);
  if (!prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return jsonResponse(403, { success: false, error: 'Only teachers can create run tokens' }, origin);
  }

  const assignmentId = params.get('assignment_id') || params.get('id');
  if (!assignmentId) {
    return jsonResponse(400, { success: false, error: 'Missing assignment_id' }, origin);
  }

  try {
    const assignment = await supabase.query('homework_assignments', {
      select: 'id,list_meta',
      filters: [{ column: 'id', op: 'eq', value: assignmentId }],
      single: true,
    });

    const list_meta = assignment.list_meta || {};
    const prev = Array.isArray(list_meta.run_tokens) ? list_meta.run_tokens : [];
    const token = generateRunToken(assignmentId);
    const updated = { ...list_meta, run_tokens: [...prev, { token, created_at: new Date().toISOString() }] };

    await supabase.update('homework_assignments', [{ column: 'id', op: 'eq', value: assignmentId }], { list_meta: updated });

    return jsonResponse(200, { success: true, assignment_id: assignmentId, run_token: token }, origin);
  } catch (err) {
    return jsonResponse(500, { success: false, error: `Failed to persist run token: ${err.message}` }, origin);
  }
}

async function handleListAssignments(request, supabase, params, origin) {
  const mode = params.get('mode') || 'teacher';
  
  if (mode === 'student') {
    const userId = await getUserIdFromCookie(request, supabase);
    if (!userId) {
      return jsonResponse(401, { success: false, error: 'Not signed in' }, origin);
    }
    
    const prof = await getProfile(supabase, userId);
    if (!prof || !prof.class) {
      return jsonResponse(400, { success: false, error: 'No class set for this profile' }, origin);
    }

    try {
      // For students, get active assignments for their class
      const url = `${supabase.url}/rest/v1/homework_assignments?select=*,profiles!homework_assignments_created_by_fkey(name)&class=eq.${encodeURIComponent(prof.class)}&active=eq.true&start_at=lte.${new Date().toISOString()}&order=due_at.asc`;
      
      const resp = await fetch(url, {
        headers: {
          'apikey': supabase.serviceKey,
          'Authorization': `Bearer ${supabase.serviceKey}`,
        },
      });
      
      const data = await resp.json();
      const assignments = (data || []).map(a => ({
        ...a,
        teacher_name: a.profiles?.name || null,
      }));

      return jsonResponse(200, {
        success: true,
        class: prof.class,
        student_name: prof.name || prof.korean_name || null,
        assignments,
      }, origin);
    } catch (err) {
      return jsonResponse(500, { success: false, error: `Failed to fetch student homework: ${err.message}` }, origin);
    }
  }

  // Teacher mode - list all or by class
  const className = params.get('class');
  
  try {
    let url = `${supabase.url}/rest/v1/homework_assignments?select=*&order=created_at.desc`;
    if (className) {
      url += `&class=eq.${encodeURIComponent(className)}`;
    }
    
    const resp = await fetch(url, {
      headers: {
        'apikey': supabase.serviceKey,
        'Authorization': `Bearer ${supabase.serviceKey}`,
      },
    });
    
    const data = await resp.json();
    return jsonResponse(200, { success: true, assignments: data || [] }, origin);
  } catch (err) {
    return jsonResponse(500, { success: false, error: `Failed to fetch assignments: ${err.message}` }, origin);
  }
}

async function handleEndAssignment(request, supabase, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: 'Not signed in' }, origin);
  }

  const prof = await getProfile(supabase, userId);
  if (!prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return jsonResponse(403, { success: false, error: 'Only teachers can end assignments' }, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Bad JSON' }, origin);
  }

  const assignmentId = body.id || body.assignment_id;
  if (!assignmentId) {
    return jsonResponse(400, { success: false, error: 'Missing assignment id' }, origin);
  }

  try {
    const data = await supabase.update(
      'homework_assignments',
      [{ column: 'id', op: 'eq', value: assignmentId }],
      { active: false, ended_at: new Date().toISOString() }
    );
    return jsonResponse(200, { success: true, assignment: data }, origin);
  } catch (err) {
    return jsonResponse(500, { success: false, error: `Failed to end assignment: ${err.message}` }, origin);
  }
}

async function handleAssignmentProgress(request, supabase, params, origin) {
  const assignmentId = params.get('assignment_id') || params.get('id');
  const className = params.get('class');
  const requestRunToken = params.get('run_token');

  if (!assignmentId) {
    return jsonResponse(400, { success: false, error: 'Missing assignment_id' }, origin);
  }

  try {
    // Fetch assignment
    let assignment = await supabase.query('homework_assignments', {
      select: '*',
      filters: [{ column: 'id', op: 'eq', value: assignmentId }],
      single: true,
    });

    if (!assignment) {
      return jsonResponse(404, { success: false, error: 'Assignment not found' }, origin);
    }

    // Auto-create run token if assignment has none
    let assignmentRunTokens = Array.isArray(assignment.list_meta?.run_tokens)
      ? assignment.list_meta.run_tokens.map(r => r?.token).filter(Boolean)
      : [];

    if (assignmentRunTokens.length === 0) {
      const autoToken = `run_backfill_${assignmentId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const updatedMeta = {
        ...(assignment.list_meta || {}),
        run_tokens: [{ token: autoToken, created_at: new Date().toISOString(), auto: true, backfilled: true }],
      };
      
      await supabase.update(
        'homework_assignments',
        [{ column: 'id', op: 'eq', value: assignmentId }],
        { list_meta: updatedMeta }
      );
      
      assignment.list_meta = updatedMeta;
      assignmentRunTokens = [autoToken];
      console.log(`[assignmentProgress] Backfilled run_token for assignment ${assignmentId}: ${autoToken}`);
    }

    const targetClass = className || assignment.class;
    const category = determineCategory(assignment);

    // Load students in class
    const studentsUrl = `${supabase.url}/rest/v1/profiles?select=id,name,korean_name&class=eq.${encodeURIComponent(targetClass)}`;
    const studentsResp = await fetch(studentsUrl, {
      headers: {
        'apikey': supabase.serviceKey,
        'Authorization': `Bearer ${supabase.serviceKey}`,
      },
    });
    const students = await studentsResp.json();

    if (!students || !students.length) {
      return jsonResponse(200, { 
        success: true, 
        assignment_id: assignment.id, 
        class: targetClass, 
        total_modes: getExpectedModes(category, assignment.list_key, new Set()), 
        category, 
        progress: [] 
      }, origin);
    }

    // Build list matching patterns (same logic as Netlify function)
    const listKeyLast = assignment.list_key.split('/').pop();
    const coreName = listKeyLast.replace(/\.json$/, '');
    const studentIds = students.map(s => s.id);

    // Helper to fetch sessions with a given filter
    async function fetchSessions(orFilter) {
      // PostgREST requires proper encoding for `or` and `in` filters
      const url = new URL(`${supabase.url}/rest/v1/progress_sessions`);
      url.searchParams.set('select', 'user_id,list_name,mode,summary,list_size');
      url.searchParams.set('user_id', `in.(${studentIds.join(',')})`);
      url.searchParams.set('ended_at', 'not.is.null');
      url.searchParams.set('or', orFilter);
      
      const resp = await fetch(url.toString(), {
        headers: {
          'apikey': supabase.serviceKey,
          'Authorization': `Bearer ${supabase.serviceKey}`,
        },
      });
      
      if (!resp.ok) {
        console.error(`[fetchSessions] Error ${resp.status}: ${await resp.text()}`);
        return [];
      }
      return resp.json();
    }

    let sessions = [];

    // 1) Primary attempt: tight matching by filename/path variants (same as Netlify)
    const eq1 = listKeyLast;
    const like1 = `%/${listKeyLast}`;
    const like2 = `%/${listKeyLast}.json`;
    const fuzzy1 = `%${coreName}%`;
    const fuzzy2 = assignment.list_title 
      ? `%${assignment.list_title.toLowerCase().replace(/\s+/g, '_')}%` 
      : null;

    let orFilters = [
      `list_name.eq.${eq1}`,
      `list_name.ilike.${like1}`,
      `list_name.ilike.${like2}`,
      `list_name.ilike.${fuzzy1}`,
    ];
    if (fuzzy2) orFilters.push(`list_name.ilike.${fuzzy2}`);

    // Add normalized token patterns (same as Netlify)
    const normalizedFilename = normalizeListIdentifier(coreName);
    const normalizedListKey = normalizeListIdentifier(assignment.list_key);
    const normalizedTitle = normalizeListIdentifier(`${assignment.title || ''} ${assignment.list_title || ''}`);
    const normalizedTokens = Array.from(new Set([normalizedFilename, normalizedListKey, normalizedTitle].filter(Boolean)))
      .filter(token => token.length >= 3);
    normalizedTokens.forEach(token => {
      const safeToken = token.replace(/\s+/g, '%');
      orFilters.push(`list_name.ilike.%${safeToken}%`);
    });

    const primaryOrFilter = `(${orFilters.join(',')})`;
    sessions = await fetchSessions(primaryOrFilter);
    console.log(`[assignmentProgress] Primary query found ${sessions.length} sessions`);
    if (sessions.length) {
      console.log(`[assignmentProgress] Sample list_names:`, sessions.slice(0, 5).map(s => s.list_name));
    }

    // 2) Fallback: broad ilike on full list_key
    if (sessions.length === 0 && assignment.list_key) {
      const broadLike = `%${assignment.list_key}%`;
      const broadFilter = `(list_name.ilike.${broadLike})`;
      sessions = await fetchSessions(broadFilter);
      console.log(`[assignmentProgress] Broad list_key fallback found ${sessions.length} sessions`);
    }

    // 3) Fallback: normalized coreName with wildcards
    if (sessions.length === 0 && coreName) {
      const normalized = coreName.replace(/[^a-z0-9]+/gi, '%');
      const normFilter = `(list_name.ilike.%${normalized}%)`;
      sessions = await fetchSessions(normFilter);
      console.log(`[assignmentProgress] Normalized coreName fallback found ${sessions.length} sessions`);
    }

    // 4) Last resort: match by assignment title
    if (sessions.length === 0 && assignment.title) {
      const titleCore = assignment.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (titleCore) {
        const titleFilter = `(list_name.ilike.%${titleCore}%)`;
        sessions = await fetchSessions(titleFilter);
        console.log(`[assignmentProgress] Title fallback found ${sessions.length} sessions`);
      }
    }

    // Debug: log unique modes found
    if (sessions.length) {
      const uniqueModes = [...new Set(sessions.map(s => s.mode))];
      console.log(`[assignmentProgress] Unique modes found: ${uniqueModes.join(', ')}`);
    }

    // Filter by run token if provided
    const runTokens = [requestRunToken, ...assignmentRunTokens].filter(Boolean);
    if (runTokens.length && sessions.length) {
      const withToken = sessions.filter(s => {
        try {
          const sum = typeof s.summary === 'string' ? JSON.parse(s.summary) : s.summary;
          const tok = sum?.assignment_run;
          return tok && runTokens.includes(tok);
        } catch {
          return false;
        }
      });
      
      if (withToken.length) {
        sessions = withToken;
        console.log(`[assignmentProgress] Using ${withToken.length} run-linked sessions`);
      }
    }

    // Parse summary helper
    function parseSummary(summary) {
      if (!summary) return null;
      if (typeof summary === 'string') {
        try { return JSON.parse(summary); } catch { return null; }
      }
      return summary;
    }

    // Derive stars from accuracy
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

    // Build student progress map
    const byStudent = new Map();
    students.forEach(st => byStudent.set(st.id, {
      user_id: st.id,
      name: st.name,
      korean_name: st.korean_name,
      modes: {},
      _score: 0,
      _total: 0,
    }));

    // Process sessions - IMPROVED mode normalization
    const encounteredModes = new Set();
    
    sessions.forEach(sess => {
      const row = byStudent.get(sess.user_id);
      if (!row) return;

      const summary = parseSummary(sess.summary);
      const stars = deriveStars(summary);
      
      // IMPORTANT: Normalize mode name to handle variations
      const rawMode = sess.mode || 'unknown';
      const modeKey = normalizeModeName(rawMode);
      encounteredModes.add(modeKey);

      // Track overall accuracy components
      if (summary && typeof summary.score === 'number' && typeof summary.total === 'number' && summary.total > 0) {
        row._score += summary.score;
        row._total += summary.total;
      } else if (summary && typeof summary.correct === 'number' && typeof summary.total === 'number' && summary.total > 0) {
        row._score += summary.correct;
        row._total += summary.total;
      }

      const prev = row.modes[modeKey];
      const acc = summary && typeof summary.accuracy === 'number' 
        ? Math.round(summary.accuracy * 100) 
        : (summary && typeof summary.score === 'number' && typeof summary.total === 'number' && summary.total > 0 
           ? Math.round((summary.score / summary.total) * 100) 
           : 0);

      if (prev) {
        if (stars > prev.stars) prev.stars = stars;
        if (acc > prev.accuracy) prev.accuracy = acc;
        prev.sessions += 1;
      } else {
        row.modes[modeKey] = { stars, accuracy: acc, sessions: 1 };
      }
    });

    // Get expected total modes for this category
    const totalModes = assignment.list_meta?.modes_total || 
                       assignment.list_meta?.total_modes || 
                       getExpectedModes(category, assignment.list_key, encounteredModes);

    console.log(`[assignmentProgress] Category: ${category}, Total modes: ${totalModes}, Encountered: ${[...encounteredModes].join(', ')}`);

    // Build final progress array
    const progress = Array.from(byStudent.values()).map(r => {
      const rawModesArr = Object.entries(r.modes).map(([mode, v]) => ({
        mode,
        bestStars: v.stars,
        bestAccuracy: v.accuracy,
        sessions: v.sessions,
      }));

      const starsEarned = rawModesArr.reduce((sum, m) => sum + (m.bestStars || 0), 0);
      const bestAccuracy = rawModesArr.reduce((best, m) => Math.max(best, m.bestAccuracy || 0), 0);
      const overallAccuracy = r._total > 0 ? Math.round((r._score / r._total) * 100) : 0;

      // Count modes where student achieved at least 1 star (or lesson modes)
      const countedModesArr = rawModesArr.filter(m => 
        (m.bestStars >= 1) || /grammar_lesson|lesson/i.test(m.mode)
      );
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
        status: assignment.active 
          ? (completionPercent >= 100 || starsEarned >= (assignment.goal_value || 5) ? 'Completed' : 'In Progress') 
          : 'Ended',
        category,
      };
    });

    return jsonResponse(200, {
      success: true,
      assignment_id: assignment.id,
      class: targetClass,
      total_modes: totalModes,
      category,
      progress,
      debug: {
        encountered_modes: [...encounteredModes],
        sessions_count: sessions.length,
      },
    }, origin);

  } catch (err) {
    console.error('[assignmentProgress] Error:', err);
    return jsonResponse(500, { success: false, error: err.message }, origin);
  }
}

async function handleGetRunToken(request, supabase, params, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: 'Not signed in' }, origin);
  }

  const prof = await getProfile(supabase, userId);
  if (!prof) {
    return jsonResponse(401, { success: false, error: 'Profile not found' }, origin);
  }

  const assignmentId = params.get('assignment_id') || params.get('id');
  const listKey = params.get('list_key') || params.get('listName') || params.get('list_name');

  if (!assignmentId && !listKey) {
    return jsonResponse(400, { success: false, error: 'Missing assignment_id or list_key' }, origin);
  }

  try {
    let assignment;
    
    if (assignmentId) {
      assignment = await supabase.query('homework_assignments', {
        select: '*',
        filters: [{ column: 'id', op: 'eq', value: assignmentId }],
        single: true,
      });
    } else {
      const url = `${supabase.url}/rest/v1/homework_assignments?select=*&class=eq.${encodeURIComponent(prof.class)}&active=eq.true&list_key=ilike.%${encodeURIComponent(listKey)}%&order=created_at.desc&limit=1`;
      const resp = await fetch(url, {
        headers: {
          'apikey': supabase.serviceKey,
          'Authorization': `Bearer ${supabase.serviceKey}`,
        },
      });
      const data = await resp.json();
      assignment = data?.[0];
    }

    if (!assignment || String(assignment.class) !== String(prof.class)) {
      return jsonResponse(403, { success: false, error: 'Not assigned to this class' }, origin);
    }

    const tokens = Array.isArray(assignment.list_meta?.run_tokens)
      ? assignment.list_meta.run_tokens.map(r => r?.token).filter(Boolean)
      : [];

    return jsonResponse(200, { success: true, assignment_id: assignment.id, tokens }, origin);
  } catch (err) {
    return jsonResponse(500, { success: false, error: err.message }, origin);
  }
}

async function handleLinkSessions(request, supabase, params, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: 'Not signed in' }, origin);
  }

  const prof = await getProfile(supabase, userId);
  if (!prof || !['teacher', 'admin'].includes(String(prof.role || '').toLowerCase())) {
    return jsonResponse(403, { success: false, error: 'Only teachers can link sessions' }, origin);
  }

  const assignmentId = params.get('assignment_id') || params.get('id');
  if (!assignmentId) {
    return jsonResponse(400, { success: false, error: 'Missing assignment_id' }, origin);
  }

  try {
    const assignment = await supabase.query('homework_assignments', {
      select: '*',
      filters: [{ column: 'id', op: 'eq', value: assignmentId }],
      single: true,
    });

    if (!assignment) {
      return jsonResponse(404, { success: false, error: 'Assignment not found' }, origin);
    }

    // Get or create run token
    let runToken;
    const existingTokens = Array.isArray(assignment.list_meta?.run_tokens)
      ? assignment.list_meta.run_tokens.map(r => r?.token).filter(Boolean)
      : [];

    if (existingTokens.length > 0) {
      runToken = existingTokens[0];
    } else {
      runToken = `run_link_${assignmentId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const updatedMeta = {
        ...(assignment.list_meta || {}),
        run_tokens: [{ token: runToken, created_at: new Date().toISOString(), auto: true }],
      };
      await supabase.update(
        'homework_assignments',
        [{ column: 'id', op: 'eq', value: assignmentId }],
        { list_meta: updatedMeta }
      );
    }

    // Get students in class
    const studentsUrl = `${supabase.url}/rest/v1/profiles?select=id&class=eq.${encodeURIComponent(assignment.class)}`;
    const studentsResp = await fetch(studentsUrl, {
      headers: {
        'apikey': supabase.serviceKey,
        'Authorization': `Bearer ${supabase.serviceKey}`,
      },
    });
    const students = await studentsResp.json();

    if (!students || !students.length) {
      return jsonResponse(400, { success: false, error: 'No students found in class' }, origin);
    }

    const studentIds = students.map(s => s.id);
    const listKeyLast = assignment.list_key.split('/').pop();
    const coreName = listKeyLast.replace(/\.json$/, '');

    // Fetch matching sessions
    const orConditions = [
      `list_name.eq.${listKeyLast}`,
      `list_name.ilike.%/${listKeyLast}`,
      `list_name.ilike.%${coreName}%`,
    ];

    const sessionsUrl = `${supabase.url}/rest/v1/progress_sessions?select=id,session_id,user_id,list_name,mode,summary&user_id=in.(${studentIds.join(',')})&ended_at=not.is.null&or=(${orConditions.join(',')})`;
    const sessionsResp = await fetch(sessionsUrl, {
      headers: {
        'apikey': supabase.serviceKey,
        'Authorization': `Bearer ${supabase.serviceKey}`,
      },
    });
    const sessions = await sessionsResp.json();

    if (!sessions || !sessions.length) {
      return jsonResponse(200, { success: true, message: 'No matching sessions found', linked: 0 }, origin);
    }

    // Filter sessions without assignment_run
    const sessionsToLink = sessions.filter(s => {
      try {
        const sum = typeof s.summary === 'string' ? JSON.parse(s.summary) : s.summary;
        return !sum || !sum.assignment_run;
      } catch {
        return true;
      }
    });

    if (!sessionsToLink.length) {
      return jsonResponse(200, {
        success: true,
        message: 'All matching sessions already linked',
        linked: 0,
        total_found: sessions.length,
      }, origin);
    }

    // Link sessions
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
          linked_by: 'teacher_action',
        };

        await supabase.update(
          'progress_sessions',
          [{ column: 'id', op: 'eq', value: sess.id }],
          { summary: updatedSummary }
        );
        linkedCount++;
      } catch (e) {
        errors.push({ session_id: sess.session_id, error: e.message });
      }
    }

    console.log(`[link_sessions] Linked ${linkedCount}/${sessionsToLink.length} sessions to assignment ${assignmentId}`);

    return jsonResponse(200, {
      success: true,
      message: `Linked ${linkedCount} sessions to assignment`,
      linked: linkedCount,
      total_found: sessions.length,
      already_linked: sessions.length - sessionsToLink.length,
      errors: errors.length > 0 ? errors : undefined,
      run_token: runToken,
    }, origin);

  } catch (err) {
    console.error('[link_sessions] Error:', err);
    return jsonResponse(500, { success: false, error: err.message }, origin);
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Check for required env vars
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return jsonResponse(500, { 
        success: false, 
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables' 
      }, origin);
    }

    const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const url = new URL(request.url);
    const params = url.searchParams;
    const action = params.get('action') || 'list_assignments';

    try {
      switch (action) {
        case 'create_assignment':
          return await handleCreateAssignment(request, supabase, origin);

        case 'create_run':
          return await handleCreateRun(request, supabase, params, origin);

        case 'get_run_token':
          return await handleGetRunToken(request, supabase, params, origin);

        case 'list_assignments':
          return await handleListAssignments(request, supabase, params, origin);

        case 'end_assignment':
          return await handleEndAssignment(request, supabase, origin);

        case 'assignment_progress':
          return await handleAssignmentProgress(request, supabase, params, origin);

        case 'link_sessions':
          return await handleLinkSessions(request, supabase, params, origin);

        case 'delete_assignment':
          // TODO: Implement delete if needed
          return jsonResponse(501, { success: false, error: 'delete_assignment not yet implemented' }, origin);

        default:
          return jsonResponse(400, { success: false, error: `Unknown action: ${action}` }, origin);
      }
    } catch (err) {
      console.error('[homework_api] Unhandled error:', err);
      return jsonResponse(500, { success: false, error: err.message || 'Server error' }, origin);
    }
  },
};
