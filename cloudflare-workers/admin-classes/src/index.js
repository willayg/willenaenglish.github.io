import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = new Set([
  'https://teachers.willenaenglish.com','https://students.willenaenglish.com','https://staging.willenaenglish.com',
  'https://www.willenaenglish.com','https://willenaenglish.com','https://willenaenglish.github.io',
  'https://willenaenglish.netlify.app','https://api.willenaenglish.com','http://localhost:8888','http://localhost:9000'
]);

const REPORT_MAX_LEVEL = 12;
const REPORT_ASSESSED_SKILLS = ['vocabulary','grammar','listening','reading','sentence_building'];

function reportSkillFor(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('unscramble') || normalized.includes('sentence_build') || normalized === 'sentence_making') return 'sentence_building';
  return ({
    vocabulary:'vocabulary',grammar:'grammar',grammar_error:'grammar',question_response:'grammar',
    listening:'listening',reading:'reading',speaking:'speaking',writing:'writing'
  })[normalized] || null;
}
function reportClampLevel(value, fallback) {
  let number = Number(value);
  if (!Number.isFinite(number) || number <= 0) number = Number(fallback) || 1;
  return Math.max(1, Math.min(REPORT_MAX_LEVEL, number));
}
function reportEvidenceFromResponses(responses) {
  return (Array.isArray(responses) ? responses : []).map(row => ({
    id: row.question_id || row.assessment_item_id || row.id,
    level: reportClampLevel(row.question_level || row.level, 1),
    type: row.question_type || row.item_type || row.type || row.skill,
    skill: reportSkillFor(row.skill) || reportSkillFor(row.question_type || row.item_type || row.type),
    correct: row.is_correct === true || row.correct === true
  }));
}
function reportProbabilities(rows, maxLevel) {
  if (!rows.length) return [];
  const ceiling = Math.max(1, Math.min(REPORT_MAX_LEVEL, Number(maxLevel) || REPORT_MAX_LEVEL));
  const scores = [];
  for (let level = 1; level <= ceiling; level++) {
    let log = 0;
    rows.forEach(row => {
      const p = 1 / (1 + Math.exp((Number(row.level) - level) * 1.12));
      log += Math.log(Math.max(.025, Math.min(.975, row.correct ? p : 1 - p)));
    });
    scores.push({ level, log });
  }
  const max = Math.max(...scores.map(row => row.log));
  const weighted = scores.map(row => ({ level:row.level, w:Math.exp(row.log - max) }));
  const total = weighted.reduce((sum,row) => sum + row.w, 0) || 1;
  return weighted.map(row => ({ level:row.level, pct:row.w / total * 100 })).sort((a,b) => b.pct - a.pct);
}
function reportOverallLevel(attempt, responses) {
  const evidence = reportEvidenceFromResponses(responses);
  function levelFromRows(rows) {
    if (!rows.length) return reportClampLevel(attempt?.recommended_level || attempt?.display_level, 1);
    const highest = Math.min(REPORT_MAX_LEVEL, Math.max(...rows.map(row => Number(row.level) || 1), 1));
    const result = reportProbabilities(rows, highest)[0];
    return result ? result.level : 1;
  }
  let scores = REPORT_ASSESSED_SKILLS.map(skill => {
    const rows = evidence.filter(row => (row.skill || reportSkillFor(row.type)) === skill);
    return rows.length >= 3 ? levelFromRows(rows) : null;
  }).filter(value => Number.isFinite(value)).sort((a,b) => a - b);
  if (scores.length >= 3) {
    if (scores.length >= 5) scores = scores.slice(1,-1);
    else if (scores.length === 4) scores = scores.slice(0,3);
    return reportClampLevel(Math.round(scores.reduce((sum,x) => sum + x, 0) / scores.length), 1);
  }
  const stored = Number(attempt?.recommended_level || attempt?.display_level);
  return Number.isFinite(stored) && stored > 0 ? reportClampLevel(stored, 1) : levelFromRows(evidence);
}

function cors(request) {
  const original = request.headers.get('X-Willena-Original-Origin') || request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(original) ? original : 'https://teachers.willenaenglish.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
}
function reply(request, status, body) { return new Response(JSON.stringify(body), { status, headers: cors(request) }); }
function accessToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  const cookie = request.headers.get('Cookie') || '';
  const match = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
}
function cleanBook(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || raw.book_title || '').trim().replace(/\s+/g, ' ');
  if (!title) return null;
  const sourceType = raw.source_type === 'catalog' && raw.book_id ? 'catalog' : 'manual';
  return {
    book_id: sourceType === 'catalog' ? String(raw.book_id) : null,
    book_title: title,
    source_type: sourceType,
    catalog_series: sourceType === 'catalog' ? (String(raw.series || raw.catalog_series || '').trim() || null) : null,
    catalog_level: sourceType === 'catalog' ? (String(raw.level || raw.catalog_level || '').trim() || null) : null,
    resolved_at: sourceType === 'catalog' ? new Date().toISOString() : null
  };
}
function cleanLevel(raw, hasBooks) {
  if (hasBooks) return null;
  const value = String(raw || '').trim();
  if (!value) return null;
  return new Set(['S1','S2','1','2','3','4','5','6','7','8','9','10','Mixed']).has(value) ? value : undefined;
}
async function getClassWithBooks(db, id) {
  const { data: row, error } = await db.from('classes').select('id,name,display_name,status,level,room,capacity,notes,created_at,updated_at').eq('id', id).single();
  if (error) throw error;
  const books = await db.from('class_book_assignments').select('id,class_id,book_id,book_title,source_type,catalog_series,catalog_level,resolved_at,status,created_at').eq('class_id', id).eq('status','active').order('created_at');
  if (books.error) throw books.error;
  return { ...row, books: (books.data || []).slice(0, 3) };
}
async function fetchByIds(db, table, select, column, ids) {
  const unique = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!unique.length) return [];
  const out = [];
  for (let i = 0; i < unique.length; i += 60) {
    const { data, error } = await db.from(table).select(select).in(column, unique.slice(i, i + 60));
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}
async function listLevelTests(db) {
  const internalResult = await db.from('student_assessment_attempts')
    .select('id,student_id,assessment_key,status,test_version,setup,total_questions,answered_count,correct_count,recommended_level,duration_seconds,started_at,completed_at,updated_at,metadata,admin_opened_at')
    .order('started_at',{ascending:false}).limit(250);
  if (internalResult.error) throw internalResult.error;
  const publicResult = await db.from('prospective_level_test_attempts')
    .select('id,candidate_id,status,test_version,setup,recommended_level,display_level,total_questions,correct_count,duration_seconds,started_at,completed_at,updated_at,metadata,admin_opened_at')
    .order('started_at',{ascending:false}).limit(250);
  if (publicResult.error) throw publicResult.error;

  const internalRows = internalResult.data || [];
  const publicRows = publicResult.data || [];
  const profiles = await fetchByIds(db,'profiles','id,name,korean_name,username,grade,school,class,phone,email','id',internalRows.map(r=>r.student_id));
  const candidates = await fetchByIds(db,'prospective_level_test_candidates','id,student_name,school_name,school_grade,metadata','id',publicRows.map(r=>r.candidate_id));
  const internalResponses = await fetchByIds(db,'student_assessment_responses','attempt_id,assessment_item_id,question_level,item_type,is_correct','attempt_id',internalRows.map(r=>r.id));
  const publicResponses = await fetchByIds(db,'prospective_level_test_responses','attempt_id,assessment_item_id,question_level,item_type,is_correct','attempt_id',publicRows.map(r=>r.id));
  const profileById = new Map(profiles.map(r=>[String(r.id),r]));
  const candidateById = new Map(candidates.map(r=>[String(r.id),r]));
  const internalResponsesByAttempt = new Map();
  const publicResponsesByAttempt = new Map();
  for (const response of internalResponses) {
    const key = String(response.attempt_id);
    if (!internalResponsesByAttempt.has(key)) internalResponsesByAttempt.set(key, []);
    internalResponsesByAttempt.get(key).push(response);
  }
  for (const response of publicResponses) {
    const key = String(response.attempt_id);
    if (!publicResponsesByAttempt.has(key)) publicResponsesByAttempt.set(key, []);
    publicResponsesByAttempt.get(key).push(response);
  }

  const internal = internalRows.map(row => {
    const profile = profileById.get(String(row.student_id)) || {};
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const calculatedLevel = reportOverallLevel(row, internalResponsesByAttempt.get(String(row.id)) || []);
    return {
      id:row.id,source:'internal',assessment_key:row.assessment_key,student_id:row.student_id,
      student_name:profile.name||profile.korean_name||profile.username||'Student',korean_name:profile.korean_name||null,
      username:profile.username||null,grade:profile.grade||null,school:profile.school||null,phone:profile.phone||null,
      class_name:metadata.class_at_test||profile.class||null,status:row.status,test_version:row.test_version,
      total_questions:Number(row.total_questions)||0,answered_count:Number(row.answered_count)||0,correct_count:Number(row.correct_count)||0,
      recommended_level:calculatedLevel,duration_seconds:Number(row.duration_seconds)||0,
      started_at:row.started_at,completed_at:row.completed_at,updated_at:row.updated_at,setup:row.setup||{},is_new:!row.admin_opened_at
    };
  });
  const prospective = publicRows.map(row => {
    const candidate = candidateById.get(String(row.candidate_id)) || {};
    const meta = candidate.metadata && typeof candidate.metadata === 'object' ? candidate.metadata : {};
    const calculatedLevel = reportOverallLevel(row, publicResponsesByAttempt.get(String(row.id)) || []);
    return {
      id:row.id,source:'prospective',candidate_id:row.candidate_id,student_name:candidate.student_name||'Prospective student',
      grade:candidate.school_grade||null,school:candidate.school_name||null,phone:meta.phone||null,class_name:null,status:row.status,
      test_version:row.test_version,total_questions:Number(row.total_questions)||0,answered_count:Number(row.total_questions)||0,
      correct_count:Number(row.correct_count)||0,recommended_level:calculatedLevel,
      duration_seconds:Number(row.duration_seconds)||0,started_at:row.started_at,completed_at:row.completed_at,updated_at:row.updated_at,
      setup:row.setup||{},is_new:!row.admin_opened_at
    };
  });
  return [...internal,...prospective]
    .sort((a,b)=>new Date(b.started_at||b.updated_at||0).getTime()-new Date(a.started_at||a.updated_at||0).getTime())
    .slice(0,250);
}
async function levelTestDetail(db, source, attemptId) {
  if (!attemptId) throw new Error('Missing attempt_id');
  const now = new Date().toISOString();
  if (source === 'internal') {
    const attemptResult = await db.from('student_assessment_attempts').select('*').eq('id',attemptId).maybeSingle();
    if (attemptResult.error) throw attemptResult.error;
    const attempt = attemptResult.data;
    if (!attempt) throw new Error('Level test not found');
    const profileResult = await db.from('profiles').select('id,name,korean_name,username,email,grade,school,class,phone').eq('id',attempt.student_id).maybeSingle();
    if (profileResult.error) throw profileResult.error;
    const responsesResult = await db.from('student_assessment_responses').select('id,attempt_id,answer_index,assessment_item_id,assessment_source_key,question_level,item_type,prompt_snapshot,selected_answer,correct_answer,is_correct,ability_before,ability_after,response_time_ms,created_at,metadata').eq('attempt_id',attemptId).order('answer_index');
    if (responsesResult.error) throw responsesResult.error;
    const skillsResult = await db.from('student_assessment_skill_results').select('attempt_id,skill_key,questions_seen,questions_correct,score_percent').eq('attempt_id',attemptId);
    if (skillsResult.error) throw skillsResult.error;
    await db.from('student_assessment_attempts').update({admin_opened_at:now}).eq('id',attemptId);
    const p = profileResult.data || {};
    const responses = responsesResult.data || [];
    const calculatedAttempt = { ...attempt, recommended_level:reportOverallLevel(attempt, responses) };
    return {source:'internal',candidate:{student_name:p.name||p.korean_name||p.username||'Student',korean_name:p.korean_name||null,username:p.username||null,email:p.email||null,grade:p.grade||null,school_name:p.school||null,class_name:(attempt.metadata||{}).class_at_test||p.class||null,phone:p.phone||null},attempt:calculatedAttempt,responses,skills:skillsResult.data||[]};
  }
  if (source === 'prospective') {
    const attemptResult = await db.from('prospective_level_test_attempts').select('*').eq('id',attemptId).maybeSingle();
    if (attemptResult.error) throw attemptResult.error;
    const attempt = attemptResult.data;
    if (!attempt) throw new Error('Level test not found');
    const candidateResult = await db.from('prospective_level_test_candidates').select('*').eq('id',attempt.candidate_id).maybeSingle();
    if (candidateResult.error) throw candidateResult.error;
    const responsesResult = await db.from('prospective_level_test_responses').select('id,attempt_id,answer_index,assessment_item_id,assessment_source_key,question_level,item_type,prompt_snapshot,selected_answer,correct_answer,is_correct,ability_before,ability_after,response_time_ms,created_at,metadata').eq('attempt_id',attemptId).order('answer_index');
    if (responsesResult.error) throw responsesResult.error;
    const skillsResult = await db.from('prospective_level_test_skill_results').select('attempt_id,skill_key,questions_seen,questions_correct,score_percent').eq('attempt_id',attemptId);
    if (skillsResult.error) throw skillsResult.error;
    await db.from('prospective_level_test_attempts').update({admin_opened_at:now}).eq('id',attemptId);
    const c = candidateResult.data || {};
    const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : {};
    const responses = responsesResult.data || [];
    const calculatedAttempt = { ...attempt, recommended_level:reportOverallLevel(attempt, responses), display_level:reportOverallLevel(attempt, responses) };
    return {source:'prospective',candidate:{student_name:c.student_name||'Prospective student',korean_name:meta.korean_name||null,username:null,email:meta.email||null,grade:c.school_grade||null,school_name:c.school_name||null,class_name:null,phone:meta.phone||null},attempt:calculatedAttempt,responses,skills:skillsResult.data||[]};
  }
  throw new Error('Unknown level test source');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    if (!['GET','POST'].includes(request.method)) return reply(request, 405, { success:false, error:'Method not allowed' });

    const supabaseUrl = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) return reply(request, 500, { success:false, error:'Missing server configuration' });
    const db = createClient(supabaseUrl, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } });
    const contentDb = env.CONTENT_SUPABASE_URL && env.CONTENT_SUPABASE_PUBLISHABLE_KEY
      ? createClient(env.CONTENT_SUPABASE_URL, env.CONTENT_SUPABASE_PUBLISHABLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } }) : null;

    const token = accessToken(request);
    if (!token) return reply(request, 401, { success:false, error:'Not signed in' });
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData?.user) return reply(request, 401, { success:false, error:'Not signed in' });
    const { data: actor, error: actorError } = await db.from('profiles').select('role,approved').eq('id', authData.user.id).single();
    if (actorError || !actor || String(actor.role).toLowerCase() !== 'admin' || actor.approved === false) return reply(request, 403, { success:false, error:'Admins only' });

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || '';

    if (request.method === 'GET' && action === 'list_level_tests') {
      try { return reply(request,200,{success:true,tests:await listLevelTests(db)}); }
      catch (e) { return reply(request,500,{success:false,error:e?.message||String(e)}); }
    }
    if (request.method === 'GET' && action === 'search_books') {
      const q = String(url.searchParams.get('q') || '').trim();
      if (q.length < 2) return reply(request, 200, { success:true, books:[] });
      if (!contentDb) return reply(request, 500, { success:false, error:'Content database not configured' });
      const { data, error } = await contentDb.from('content_books')
        .select('id,title,book_number,public_level,internal_level_id,series_id,content_series(name,publisher)')
        .ilike('title', `%${q}%`).eq('status','published').order('title').limit(12);
      if (error) return reply(request, 400, { success:false, error:error.message });
      return reply(request,200,{success:true,books:(data||[]).map(b=>({book_id:b.id,title:b.title,series:b.content_series?.name||'',publisher:b.content_series?.publisher||'',level:b.public_level!=null?String(b.public_level):b.internal_level_id!=null?String(b.internal_level_id):''}))});
    }
    if (request.method === 'GET') {
      const { data: classes, error } = await db.from('classes').select('id,name,display_name,status,level,room,capacity,notes,created_at,updated_at').eq('status','active').order('name');
      if (error) return reply(request,400,{success:false,error:error.message});
      const ids=(classes||[]).map(c=>c.id);let assignments=[];
      if(ids.length){const res=await db.from('class_book_assignments').select('id,class_id,book_id,book_title,source_type,catalog_series,catalog_level,resolved_at,status,created_at').in('class_id',ids).eq('status','active').order('created_at');if(res.error)return reply(request,400,{success:false,error:res.error.message});assignments=res.data||[];}
      const byClass=new Map();for(const a of assignments){if(!byClass.has(a.class_id))byClass.set(a.class_id,[]);byClass.get(a.class_id).push(a);}
      return reply(request,200,{success:true,classes:(classes||[]).map(c=>({...c,books:(byClass.get(c.id)||[]).slice(0,3)}))});
    }

    let body; try { body=await request.json(); } catch { return reply(request,400,{success:false,error:'Invalid JSON'}); }
    if (body.action === 'level_test_detail') {
      try { return reply(request,200,{success:true,...await levelTestDetail(db,String(body.source||''),String(body.attempt_id||''))}); }
      catch (e) { return reply(request,500,{success:false,error:e?.message||String(e)}); }
    }
    const books=(Array.isArray(body.books)?body.books:[]).map(cleanBook).filter(Boolean).slice(0,3);
    const level=cleanLevel(body.level,books.length>0);
    if(level===undefined)return reply(request,400,{success:false,error:'Invalid level'});

    if(action==='update_class'||body.action==='update_class'){
      const classId=String(body.class_id||'').trim();if(!classId)return reply(request,400,{success:false,error:'Missing class ID'});
      const existing=await db.from('classes').select('id').eq('id',classId).maybeSingle();if(existing.error)return reply(request,400,{success:false,error:existing.error.message});if(!existing.data)return reply(request,404,{success:false,error:'Class not found'});
      const oldAssignments=await db.from('class_book_assignments').select('*').eq('class_id',classId).eq('status','active');if(oldAssignments.error)return reply(request,400,{success:false,error:oldAssignments.error.message});
      const update=await db.from('classes').update({level,updated_at:new Date().toISOString()}).eq('id',classId);if(update.error)return reply(request,400,{success:false,error:update.error.message});
      const archive=await db.from('class_book_assignments').update({status:'archived',finished_at:new Date().toISOString().slice(0,10)}).eq('class_id',classId).eq('status','active');if(archive.error)return reply(request,400,{success:false,error:archive.error.message});
      if(books.length){const rows=books.map(book=>({class_id:classId,...book,subject:null,started_at:new Date().toISOString().slice(0,10),status:'active',notes:book.source_type==='manual'?'Unresolved manual book; link to curriculum catalog when available.':null}));const inserted=await db.from('class_book_assignments').insert(rows);if(inserted.error)return reply(request,400,{success:false,error:inserted.error.message});}
      try{return reply(request,200,{success:true,class:await getClassWithBooks(db,classId)});}catch(e){return reply(request,400,{success:false,error:e.message});}
    }

    const name=String(body.name||'').trim().replace(/\s+/g,' ');if(name.length<2||name.length>80)return reply(request,400,{success:false,error:'Class name must be 2–80 characters'});
    const {data:existing,error:existingError}=await db.from('classes').select('id').ilike('name',name).maybeSingle();if(existingError)return reply(request,400,{success:false,error:existingError.message});if(existing)return reply(request,409,{success:false,error:'Class name already exists'});
    const payload={name,display_name:name,legacy_class_name:name,status:'active',level,room:null,capacity:null,notes:null};const {data:created,error}=await db.from('classes').insert(payload).select('*').single();if(error)return reply(request,400,{success:false,error:error.message});
    let inserted=[];if(books.length){const rows=books.map(book=>({class_id:created.id,...book,subject:null,started_at:new Date().toISOString().slice(0,10),status:'active',notes:book.source_type==='manual'?'Unresolved manual book; link to curriculum catalog when available.':null}));const result=await db.from('class_book_assignments').insert(rows).select('id,class_id,book_id,book_title,source_type,catalog_series,catalog_level,resolved_at,status,created_at');if(result.error){await db.from('classes').delete().eq('id',created.id);return reply(request,400,{success:false,error:result.error.message});}inserted=result.data||[];}
    return reply(request,201,{success:true,class:{...created,books:inserted}});
  }
};
