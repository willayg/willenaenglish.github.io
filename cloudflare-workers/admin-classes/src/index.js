const ALLOWED_ORIGINS = new Set([
  'https://staging.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://willenaenglish.github.io',
  'http://localhost:8888',
]);

const LEVELS = new Set(['S1','S2','1','2','3','4','5','6','7','8','9','10','Mixed']);

function cors(origin='') {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://staging.willenaenglish.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

function json(origin, status, body) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

function bearer(req) {
  const value = req.headers.get('Authorization') || '';
  if (value.startsWith('Bearer ')) return value.slice(7).trim();
  const cookie = req.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)sb_access=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function supabaseFetch(base, key, path, init={}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.message || data?.error_description || data?.error || `Supabase ${res.status}`);
  return data;
}

async function supabaseFetchAll(base, key, path, init={}, pageSize=1000) {
  const method = String(init.method || 'GET').toUpperCase();
  if (method !== 'GET') return supabaseFetch(base, key, path, init);
  const separator = path.includes('?') ? '&' : '?';
  const out = [];
  let offset = 0;
  while (true) {
    const rows = await supabaseFetch(base, key, `${path}${separator}limit=${pageSize}&offset=${offset}`, init);
    if (!Array.isArray(rows)) throw new Error('Supabase paginated query returned invalid data');
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
    if (offset > 100000) throw new Error('Supabase pagination safety limit exceeded');
  }
  return out;
}

async function requireAdmin(req, env) {
  const token = bearer(req);
  if (!token) throw Object.assign(new Error('Not signed in'), { status: 401 });
  const userRes = await fetch(`${env.SCORES_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!userRes.ok) throw Object.assign(new Error('Invalid session'), { status: 401 });
  const user = await userRes.json();
  const rows = await supabaseFetch(
    env.SCORES_SUPABASE_URL,
    env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,approved&limit=1`
  );
  const profile = rows?.[0];
  if (!profile || String(profile.role).toLowerCase() !== 'admin' || profile.approved === false) {
    throw Object.assign(new Error('Admins only'), { status: 403 });
  }
  return user;
}

function cleanLevel(raw, hasBooks) {
  if (hasBooks) return null;
  const value = String(raw || '').trim();
  if (!value) return null;
  if (!LEVELS.has(value)) throw Object.assign(new Error('Invalid level'), { status: 400 });
  return value;
}

async function validateBooks(env, rawBooks) {
  const cleaned = (Array.isArray(rawBooks) ? rawBooks : []).slice(0, 3).map(raw => {
    const title = String(raw?.title || raw?.book_title || '').trim().replace(/\s+/g, ' ');
    if (!title) return null;
    const catalog = raw?.source_type === 'catalog' && raw?.book_id;
    return {
      requested_id: catalog ? String(raw.book_id) : null,
      book_title: title,
      source_type: catalog ? 'catalog' : 'manual',
    };
  }).filter(Boolean);

  const ids = cleaned.filter(b => b.requested_id).map(b => b.requested_id);
  let catalogMap = new Map();
  if (ids.length) {
    const filter = ids.map(encodeURIComponent).join(',');
    const rows = await supabaseFetch(
      env.CONTENT_SUPABASE_URL,
      env.CONTENT_SUPABASE_SERVICE_ROLE_KEY,
      `/rest/v1/content_books?id=in.(${filter})&select=id,title,public_level,internal_level_id,content_series(name,publisher)`
    );
    catalogMap = new Map((rows || []).map(row => [String(row.id), row]));
    if (catalogMap.size !== new Set(ids).size) {
      throw Object.assign(new Error('One or more curriculum books no longer exist'), { status: 400 });
    }
  }

  return cleaned.map(book => {
    if (book.source_type === 'manual') {
      return {
        book_id: null,
        book_title: book.book_title,
        source_type: 'manual',
        catalog_series: null,
        catalog_level: null,
        resolved_at: null,
      };
    }
    const row = catalogMap.get(book.requested_id);
    return {
      book_id: row.id,
      book_title: row.title,
      source_type: 'catalog',
      catalog_series: row.content_series?.name || null,
      catalog_level: row.public_level != null ? String(row.public_level) : row.internal_level_id != null ? String(row.internal_level_id) : null,
      resolved_at: new Date().toISOString(),
    };
  });
}

async function listClasses(env) {
  const classes = await supabaseFetch(
    env.SCORES_SUPABASE_URL,
    env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
    '/rest/v1/classes?status=eq.active&select=id,name,display_name,status,level,room,capacity,notes,created_at,updated_at&order=name.asc'
  );
  const ids = (classes || []).map(c => c.id);
  let assignments = [];
  if (ids.length) {
    assignments = await supabaseFetch(
      env.SCORES_SUPABASE_URL,
      env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
      `/rest/v1/class_book_assignments?class_id=in.(${ids.map(encodeURIComponent).join(',')})&status=eq.active&select=id,class_id,book_id,book_title,source_type,catalog_series,catalog_level,resolved_at,status,created_at&order=created_at.asc`
    );
  }
  const byClass = new Map();
  for (const item of assignments || []) {
    if (!byClass.has(item.class_id)) byClass.set(item.class_id, []);
    byClass.get(item.class_id).push(item);
  }
  return (classes || []).map(c => ({ ...c, books: (byClass.get(c.id) || []).slice(0, 3) }));
}

async function searchBooks(env, q) {
  const term = String(q || '').trim();
  if (term.length < 2) return [];
  const rows = await supabaseFetch(
    env.CONTENT_SUPABASE_URL,
    env.CONTENT_SUPABASE_SERVICE_ROLE_KEY,
    `/rest/v1/content_books?status=eq.active&title=ilike.*${encodeURIComponent(term)}*&select=id,title,book_number,public_level,internal_level_id,content_series(name,publisher)&order=title.asc&limit=12`
  );
  return (rows || []).map(b => ({
    book_id: b.id,
    title: b.title,
    series: b.content_series?.name || '',
    publisher: b.content_series?.publisher || '',
    level: b.public_level != null ? String(b.public_level) : b.internal_level_id != null ? String(b.internal_level_id) : '',
  }));
}

async function listLevelTests(env, archived=false) {
  const archiveFilter = archived ? 'not.is.null' : 'is.null';
  const internalRows = await supabaseFetch(
    env.SCORES_SUPABASE_URL,
    env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
    `/rest/v1/student_assessment_attempts?archived_at=${archiveFilter}&select=id,student_id,assessment_key,status,test_version,setup,total_questions,answered_count,correct_count,recommended_level,duration_seconds,started_at,completed_at,updated_at,admin_opened_at,archived_at,metadata&order=started_at.desc&limit=250`
  );
  const publicRows = await supabaseFetch(
    env.SCORES_SUPABASE_URL,
    env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
    `/rest/v1/prospective_level_test_attempts?archived_at=${archiveFilter}&select=id,candidate_id,status,test_version,setup,recommended_level,display_level,total_questions,correct_count,duration_seconds,started_at,completed_at,updated_at,admin_opened_at,archived_at,metadata&order=started_at.desc&limit=250`
  );
  const internalIds = (internalRows || []).map(row => row.id).filter(Boolean);
  const publicIds = (publicRows || []).map(row => row.id).filter(Boolean);
  const studentIds = [...new Set((internalRows || []).map(row => row.student_id).filter(Boolean))];
  const candidateIds = [...new Set((publicRows || []).map(row => row.candidate_id).filter(Boolean))];
  let profiles = [];
  let candidates = [];
  let skillRows = [];
  let publicResponses = [];

  if (studentIds.length) {
    profiles = await supabaseFetch(
      env.SCORES_SUPABASE_URL,
      env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
      `/rest/v1/profiles?id=in.(${studentIds.map(encodeURIComponent).join(',')})&select=id,name,korean_name,username,grade,school,class`
    );
  }
  if (candidateIds.length) {
    candidates = await supabaseFetch(
      env.SCORES_SUPABASE_URL,
      env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
      `/rest/v1/prospective_level_test_candidates?id=in.(${candidateIds.map(encodeURIComponent).join(',')})&select=id,student_name,school_name,school_grade`
    );
  }
  if (internalIds.length) {
    const rows = await supabaseFetchAll(
      env.SCORES_SUPABASE_URL,
      env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
      `/rest/v1/student_assessment_skill_results?attempt_id=in.(${internalIds.map(encodeURIComponent).join(',')})&select=attempt_id,skill_key,questions_seen,questions_correct,score_percent&order=attempt_id.asc,skill_key.asc`
    );
    skillRows.push(...rows);
  }
  if (publicIds.length) {
    const rows = await supabaseFetchAll(
      env.SCORES_SUPABASE_URL,
      env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
      `/rest/v1/prospective_level_test_skill_results?attempt_id=in.(${publicIds.map(encodeURIComponent).join(',')})&select=attempt_id,skill_key,questions_seen,questions_correct,score_percent&order=attempt_id.asc,skill_key.asc`
    );
    skillRows.push(...rows);
    publicResponses = await supabaseFetchAll(
      env.SCORES_SUPABASE_URL,
      env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
      `/rest/v1/prospective_level_test_responses?attempt_id=in.(${publicIds.map(encodeURIComponent).join(',')})&select=attempt_id,answer_index&order=attempt_id.asc,answer_index.asc`
    );
  }

  const profileById = new Map((profiles || []).map(row => [String(row.id), row]));
  const candidateById = new Map((candidates || []).map(row => [String(row.id), row]));
  const skillsByAttempt = new Map();
  const publicAnswerCounts = new Map();
  for (const row of skillRows || []) {
    const key = String(row.attempt_id);
    if (!skillsByAttempt.has(key)) skillsByAttempt.set(key, []);
    skillsByAttempt.get(key).push({
      skill: row.skill_key,
      questions_seen: Number(row.questions_seen) || 0,
      questions_correct: Number(row.questions_correct) || 0,
      score_percent: Number(row.score_percent) || 0,
    });
  }
  for (const row of publicResponses || []) {
    const key = String(row.attempt_id);
    publicAnswerCounts.set(key, (publicAnswerCounts.get(key) || 0) + 1);
  }

  const internal = (internalRows || []).map(row => {
    const profile = profileById.get(String(row.student_id)) || {};
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return {
      id: row.id,
      source: 'internal',
      assessment_key: row.assessment_key,
      student_id: row.student_id,
      student_name: profile.name || profile.korean_name || profile.username || 'Student',
      korean_name: profile.korean_name || null,
      username: profile.username || null,
      grade: profile.grade || null,
      school: profile.school || null,
      class_name: metadata.class_at_test || profile.class || null,
      status: row.status,
      test_version: row.test_version,
      total_questions: Number(row.total_questions) || 0,
      answered_count: Number(row.answered_count) || 0,
      correct_count: Number(row.correct_count) || 0,
      recommended_level: Number(row.recommended_level) || null,
      duration_seconds: Number(row.duration_seconds) || 0,
      started_at: row.started_at,
      completed_at: row.completed_at,
      updated_at: row.updated_at,
      archived_at: row.archived_at,
      setup: row.setup || {},
      is_new: !row.admin_opened_at,
      skills: skillsByAttempt.get(String(row.id)) || [],
    };
  });
  const prospective = (publicRows || []).map(row => {
    const candidate = candidateById.get(String(row.candidate_id)) || {};
    return {
      id: row.id,
      source: 'prospective',
      candidate_id: row.candidate_id,
      student_name: candidate.student_name || 'Prospective student',
      grade: candidate.school_grade || null,
      school: candidate.school_name || null,
      class_name: null,
      status: row.status,
      test_version: row.test_version,
      total_questions: Number(row.total_questions) || 0,
      answered_count: publicAnswerCounts.get(String(row.id)) || 0,
      correct_count: Number(row.correct_count) || 0,
      recommended_level: Number(row.recommended_level || row.display_level) || null,
      duration_seconds: Number(row.duration_seconds) || 0,
      started_at: row.started_at,
      completed_at: row.completed_at,
      updated_at: row.updated_at,
      archived_at: row.archived_at,
      setup: row.setup || {},
      is_new: !row.admin_opened_at,
      skills: skillsByAttempt.get(String(row.id)) || [],
    };
  });
  return [...internal, ...prospective]
    .sort((a, b) => new Date(b.started_at || b.updated_at || 0) - new Date(a.started_at || a.updated_at || 0))
    .slice(0, 250);
}

async function setLevelTestArchived(env, body) {
  const source = String(body?.source || '');
  const attemptId = String(body?.attempt_id || '').trim();
  if (!['internal', 'prospective'].includes(source) || !attemptId) {
    throw Object.assign(new Error('Invalid level test request'), { status: 400 });
  }
  const table = source === 'internal' ? 'student_assessment_attempts' : 'prospective_level_test_attempts';
  const archivedAt = body.archived ? new Date().toISOString() : null;
  const rows = await supabaseFetch(
    env.SCORES_SUPABASE_URL,
    env.SCORES_SUPABASE_SERVICE_ROLE_KEY,
    `/rest/v1/${table}?id=eq.${encodeURIComponent(attemptId)}&select=id`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ archived_at: archivedAt }),
    }
  );
  if (!rows?.length) throw Object.assign(new Error('Level test not found'), { status: 404 });
  return archivedAt;
}

function responseSkill(type, metadata={}) {
  const normalizedType = String(type || '').trim().toLowerCase();
  if (normalizedType.includes('unscramble') || normalizedType.includes('sentence_build') || normalizedType === 'sentence_making') {
    return 'sentence_building';
  }
  const inferred = ({
    vocabulary: 'vocabulary', grammar: 'grammar', grammar_error: 'grammar',
    question_response: 'grammar', listening: 'listening', reading: 'reading',
    speaking: 'speaking', writing: 'writing',
  })[normalizedType];
  if (inferred) return inferred;
  const stored = String(metadata?.skill || '').trim().toLowerCase();
  if (stored.includes('unscramble') || stored.includes('sentence_build') || stored === 'sentence_making') return 'sentence_building';
  return stored || 'other';
}

async function levelTestDetail(env, body) {
  const source = String(body?.source || '');
  const attemptId = String(body?.attempt_id || '').trim();
  if (!['internal', 'prospective'].includes(source) || !attemptId) {
    throw Object.assign(new Error('Invalid level test request'), { status: 400 });
  }
  const internal = source === 'internal';
  const attemptTable = internal ? 'student_assessment_attempts' : 'prospective_level_test_attempts';
  const responseTable = internal ? 'student_assessment_responses' : 'prospective_level_test_responses';
  const skillTable = internal ? 'student_assessment_skill_results' : 'prospective_level_test_skill_results';
  const attempts = await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/${attemptTable}?id=eq.${encodeURIComponent(attemptId)}&select=*&limit=1`);
  const attempt = attempts?.[0];
  if (!attempt) throw Object.assign(new Error('Level test not found'), { status: 404 });
  const responses = await supabaseFetchAll(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/${responseTable}?attempt_id=eq.${encodeURIComponent(attemptId)}&select=answer_index,assessment_item_id,assessment_source_key,question_level,item_type,prompt_snapshot,selected_answer,correct_answer,is_correct,response_time_ms,metadata&order=answer_index.asc`);
  const skills = await supabaseFetchAll(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/${skillTable}?attempt_id=eq.${encodeURIComponent(attemptId)}&select=skill_key,questions_seen,questions_correct,score_percent&order=skill_key.asc`);
  let person = {};
  if (internal) {
    const rows = await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/profiles?id=eq.${encodeURIComponent(attempt.student_id)}&select=id,name,korean_name,username,grade,school,class,phone,email&limit=1`);
    person = rows?.[0] || {};
  } else {
    const rows = await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/prospective_level_test_candidates?id=eq.${encodeURIComponent(attempt.candidate_id)}&select=id,student_name,school_name,school_grade,metadata&limit=1`);
    person = rows?.[0] || {};
  }
  if (!attempt.admin_opened_at) {
    await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/${attemptTable}?id=eq.${encodeURIComponent(attemptId)}`, {
      method: 'PATCH', body: JSON.stringify({ admin_opened_at: new Date().toISOString() }),
    });
  }
  const candidate = internal ? {
    student_name: person.name || person.korean_name || person.username || 'Student',
    korean_name: person.korean_name || null,
    username: person.username || null,
    school_name: person.school || null,
    school_grade: person.grade || null,
    class_name: attempt.metadata?.class_at_test || person.class || null,
    phone: person.phone || null,
    email: person.email || null,
    metadata: attempt.metadata || {},
  } : {
    student_name: person.student_name || 'Prospective student',
    korean_name: null, username: null,
    school_name: person.school_name || null,
    school_grade: person.school_grade || null,
    class_name: null, phone: null, email: null,
    metadata: person.metadata || {},
  };
  return {
    source,
    attempt: { ...attempt, display_level: attempt.display_level || attempt.recommended_level },
    candidate,
    responses: (responses || []).map(row => ({ ...row, question_id: row.assessment_item_id, question_type: row.item_type, skill: responseSkill(row.item_type, row.metadata) })),
    skills: (skills || []).map(row => ({ skill: row.skill_key, questions_seen: Number(row.questions_seen) || 0, questions_correct: Number(row.questions_correct) || 0, score_percent: Number(row.score_percent) || 0 })),
  };
}

async function createClass(env, body) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) throw Object.assign(new Error('Class name must be 2–80 characters'), { status: 400 });
  const books = await validateBooks(env, body.books);
  const level = cleanLevel(body.level, books.length > 0);
  const existing = await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/classes?name=ilike.${encodeURIComponent(name)}&select=id&limit=1`);
  if (existing?.length) throw Object.assign(new Error('Class name already exists'), { status: 409 });

  const created = await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, '/rest/v1/classes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{ name, display_name: name, legacy_class_name: name, status: 'active', level }]),
  });
  const row = created?.[0];
  if (books.length) {
    await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, '/rest/v1/class_book_assignments', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(books.map(book => ({ class_id: row.id, ...book, started_at: new Date().toISOString().slice(0,10), status: 'active', notes: book.source_type === 'manual' ? 'Unresolved manual book; link to curriculum catalog when available.' : null }))),
    });
  }
  return (await listClasses(env)).find(c => c.id === row.id);
}

async function updateClass(env, body) {
  const classId = String(body.class_id || '').trim();
  if (!classId) throw Object.assign(new Error('Missing class ID'), { status: 400 });
  const books = await validateBooks(env, body.books);
  const level = cleanLevel(body.level, books.length > 0);

  await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/classes?id=eq.${encodeURIComponent(classId)}`, {
    method: 'PATCH', body: JSON.stringify({ level, updated_at: new Date().toISOString() })
  });
  await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, `/rest/v1/class_book_assignments?class_id=eq.${encodeURIComponent(classId)}&status=eq.active`, {
    method: 'PATCH', body: JSON.stringify({ status: 'archived', finished_at: new Date().toISOString().slice(0,10) })
  });
  if (books.length) {
    await supabaseFetch(env.SCORES_SUPABASE_URL, env.SCORES_SUPABASE_SERVICE_ROLE_KEY, '/rest/v1/class_book_assignments', {
      method: 'POST',
      body: JSON.stringify(books.map(book => ({ class_id: classId, ...book, started_at: new Date().toISOString().slice(0,10), status: 'active', notes: book.source_type === 'manual' ? 'Unresolved manual book; link to curriculum catalog when available.' : null }))),
    });
  }
  const found = (await listClasses(env)).find(c => c.id === classId);
  if (!found) throw Object.assign(new Error('Class not found'), { status: 404 });
  return found;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    try {
      if (!env.SCORES_SUPABASE_SERVICE_ROLE_KEY || !env.CONTENT_SUPABASE_SERVICE_ROLE_KEY) {
        return json(origin, 503, { success: false, error: 'Worker secrets are not configured' });
      }
      await requireAdmin(req, env);
      const url = new URL(req.url);
      const action = url.searchParams.get('action') || '';
      if (req.method === 'GET' && action === 'search_books') return json(origin, 200, { success: true, books: await searchBooks(env, url.searchParams.get('q')) });
      if (req.method === 'GET' && action === 'list_level_tests') return json(origin, 200, { success: true, tests: await listLevelTests(env) });
      if (req.method === 'GET' && action === 'list_archived_level_tests') return json(origin, 200, { success: true, tests: await listLevelTests(env, true) });
      if (req.method === 'GET') return json(origin, 200, { success: true, classes: await listClasses(env) });
      if (req.method !== 'POST') return json(origin, 405, { success: false, error: 'Method not allowed' });
      const body = await req.json().catch(() => null);
      if (!body) return json(origin, 400, { success: false, error: 'Invalid JSON' });
      if (body.action === 'level_test_detail') return json(origin, 200, { success: true, ...await levelTestDetail(env, body) });
      if (body.action === 'set_level_test_archived') return json(origin, 200, { success: true, archived_at: await setLevelTestArchived(env, body) });
      if (action === 'update_class') return json(origin, 200, { success: true, class: await updateClass(env, body) });
      return json(origin, 201, { success: true, class: await createClass(env, body) });
    } catch (error) {
      return json(origin, error.status || 500, { success: false, error: error.message || 'Unexpected error' });
    }
  }
};
