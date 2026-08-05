const { createClient } = require('@supabase/supabase-js');

const CONTENT_URL = process.env.CONTENT_SUPABASE_URL || 'https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY = process.env.CONTENT_SUPABASE_PUBLISHABLE_KEY || ['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const TEST_VERSION = '2026-08-v1';
const TEST_LENGTH = 30;

function headers(origin = '*') {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'cache-control': 'no-store'
  };
}
function reply(statusCode, body, origin) {
  return { statusCode, headers: headers(origin), body: JSON.stringify(body) };
}
function parseCookies(value = '') {
  return value.split(/;\s*/).reduce((out, part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
    return out;
  }, {});
}
function clean(value) { return String(value ?? '').trim(); }
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function levelForAbility(value) {
  return Math.max(1, Math.min(12, Math.round(Number(value) || 1)));
}
function skillFor(item) {
  const type = clean(item.item_type).toLowerCase();
  if (type.includes('listen')) return 'listening';
  if (type.includes('read')) return 'reading';
  if (type.includes('phon')) return 'phonics';
  if (type.includes('vocab') || type.includes('word')) return 'vocabulary';
  if (type.includes('writ') || type.includes('unscramble')) return 'writing';
  return 'grammar';
}
function optionsFor(item) {
  const related = Array.isArray(item.assessment_item_options) ? item.assessment_item_options : [];
  const options = related.length
    ? [...related].sort((a,b)=>(Number(a.display_order)||0)-(Number(b.display_order)||0)).map(o => clean(o.option_text))
    : (Array.isArray(item.choices) ? item.choices.map(clean) : []);
  return [...new Set(options.filter(Boolean))];
}
function publicQuestion(item, index, total) {
  const metadata = item.metadata || {};
  return {
    id: clean(item.source_key) || item.id,
    index,
    total,
    level: Number(item.level_id) || 1,
    type: clean(item.item_type) || 'question_response',
    prompt: clean(item.prompt_text),
    context: clean(item.context_text),
    options: shuffle(optionsFor(item)),
    transcript: clean(metadata.transcript) || (clean(item.item_type) === 'listening' ? clean(item.context_text) : ''),
    tokens: Array.isArray(metadata.tokens) ? metadata.tokens.map(clean).filter(Boolean) : []
  };
}
async function getStudent(event, game) {
  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || '');
  let access = cookies.sb_access || cookies['sb-access'] || cookies.sb_access_token || cookies['sb-access-token'];
  const authorization = event.headers?.authorization || event.headers?.Authorization || '';
  if (!access && authorization.startsWith('Bearer ')) access = authorization.slice(7);
  if (!access) return null;
  const { data: authData, error: authError } = await game.auth.getUser(access);
  if (authError || !authData?.user) return null;
  const { data: profile, error } = await game.from('profiles')
    .select('id,name,korean_name,username,class,role,approved')
    .eq('id', authData.user.id).single();
  if (error || !profile || clean(profile.role).toLowerCase() !== 'student' || profile.approved === false) return null;
  return profile;
}
async function loadBank(content) {
  const { data, error } = await content.from('assessment_items')
    .select('id,source_key,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,metadata,choices,assessment_item_options(option_text,is_correct,display_order)')
    .eq('status', 'published').eq('is_flagged', false)
    .order('level_id', { ascending: true }).order('difficulty_rating', { ascending: true });
  if (error) throw error;
  return (data || []).filter(item => {
    const options = optionsFor(item);
    return clean(item.prompt_text) && clean(item.correct_answer) && (options.length >= 2 || clean(item.item_type) === 'sentence_unscramble');
  });
}
function chooseTest(bank, count = TEST_LENGTH) {
  const grouped = new Map();
  bank.forEach(item => {
    const level = Number(item.level_id) || 1;
    if (!grouped.has(level)) grouped.set(level, []);
    grouped.get(level).push(item);
  });
  const levels = [...grouped.keys()].sort((a,b)=>a-b);
  const chosen = [];
  let cursor = 0;
  while (chosen.length < count && levels.length) {
    const level = levels[cursor % levels.length];
    const pool = grouped.get(level);
    if (pool?.length) chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (!pool?.length) levels.splice(levels.indexOf(level), 1);
    else cursor++;
  }
  return chosen;
}
async function fetchAttempt(game, attemptId, studentId) {
  const { data, error } = await game.from('student_assessment_attempts')
    .select('*').eq('id', attemptId).eq('student_id', studentId).single();
  if (error || !data) return null;
  return data;
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || '*';
  if (event.httpMethod === 'OPTIONS') return reply(200, { ok: true }, origin);
  if (!['GET','POST'].includes(event.httpMethod)) return reply(405, { success:false, error:'Method not allowed' }, origin);

  const gameUrl = process.env.SUPABASE_URL || process.env.supabase_url;
  const gameKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role_key || process.env.SUPABASE_KEY;
  if (!gameUrl || !gameKey) return reply(500, { success:false, error:'Game Scores database is not configured.' }, origin);

  const game = createClient(gameUrl, gameKey, { auth: { persistSession:false } });
  const content = createClient(CONTENT_URL, CONTENT_KEY, { auth: { persistSession:false } });
  const student = await getStudent(event, game);
  if (!student) return reply(401, { success:false, error:'Student login required.' }, origin);

  const params = event.queryStringParameters || {};
  const action = params.action || 'me';
  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); } catch { return reply(400, { success:false, error:'Invalid request body.' }, origin); }
  }

  try {
    if (action === 'me') {
      return reply(200, { success:true, student: { id:student.id, name:student.name || student.username, korean_name:student.korean_name, class:student.class } }, origin);
    }

    if (action === 'start' && event.httpMethod === 'POST') {
      const bank = await loadBank(content);
      const selected = chooseTest(bank, Math.min(TEST_LENGTH, bank.length));
      if (!selected.length) return reply(503, { success:false, error:'No published assessment questions are available.' }, origin);
      const itemIds = selected.map(item => clean(item.source_key) || item.id);
      const startAbility = 2;
      const { data: attempt, error } = await game.from('student_assessment_attempts').insert({
        student_id: student.id,
        assessment_key: 'willena-internal-level-test',
        status: 'in_progress',
        test_version: TEST_VERSION,
        setup: { item_ids:itemIds },
        starting_ability: startAbility,
        final_ability: startAbility,
        total_questions: itemIds.length,
        metadata: { class_at_test: student.class || null }
      }).select('id,total_questions,started_at').single();
      if (error) throw error;
      return reply(200, { success:true, attempt_id:attempt.id, question:publicQuestion(selected[0], 1, itemIds.length) }, origin);
    }

    if (action === 'resume' && event.httpMethod === 'GET') {
      const { data: attempt } = await game.from('student_assessment_attempts').select('*')
        .eq('student_id', student.id).eq('status','in_progress').order('started_at',{ascending:false}).limit(1).maybeSingle();
      if (!attempt) return reply(200, { success:true, attempt:null }, origin);
      const ids = attempt.setup?.item_ids || [];
      const nextIndex = Number(attempt.answered_count) || 0;
      if (nextIndex >= ids.length) return reply(200, { success:true, attempt:null }, origin);
      const bank = await loadBank(content);
      const item = bank.find(row => (clean(row.source_key) || row.id) === ids[nextIndex]);
      if (!item) return reply(409, { success:false, error:'The next question is no longer available.' }, origin);
      return reply(200, { success:true, attempt:{ id:attempt.id }, question:publicQuestion(item,nextIndex+1,ids.length) }, origin);
    }

    if (action === 'answer' && event.httpMethod === 'POST') {
      const attempt = await fetchAttempt(game, clean(body.attempt_id), student.id);
      if (!attempt || attempt.status !== 'in_progress') return reply(404, { success:false, error:'Active attempt not found.' }, origin);
      const ids = attempt.setup?.item_ids || [];
      const answerIndex = Number(attempt.answered_count) || 0;
      const expectedId = ids[answerIndex];
      if (!expectedId || clean(body.question_id) !== expectedId) return reply(409, { success:false, error:'Question order mismatch. Refresh and resume the test.' }, origin);

      const bank = await loadBank(content);
      const item = bank.find(row => (clean(row.source_key) || row.id) === expectedId);
      if (!item) return reply(409, { success:false, error:'This question is no longer available.' }, origin);
      const selected = clean(body.answer);
      const correct = clean(item.correct_answer);
      const isCorrect = selected.toLowerCase() === correct.toLowerCase();
      const abilityBefore = Number(attempt.final_ability ?? attempt.starting_ability ?? 2);
      const questionLevel = Number(item.level_id) || 1;
      const abilityAfter = Math.max(1, Math.min(12, abilityBefore + (isCorrect ? 0.35 : -0.25) + (questionLevel - abilityBefore) * 0.08));
      const skill = skillFor(item);

      const { error: responseError } = await game.from('student_assessment_responses').insert({
        attempt_id: attempt.id,
        student_id: student.id,
        answer_index: answerIndex,
        assessment_item_id: expectedId,
        assessment_source_key: clean(item.source_key) || null,
        question_level: questionLevel,
        item_type: clean(item.item_type),
        prompt_snapshot: [clean(item.context_text), clean(item.prompt_text)].filter(Boolean).join('\n'),
        options_snapshot: optionsFor(item),
        selected_answer: selected,
        correct_answer: correct,
        is_correct: isCorrect,
        ability_before: abilityBefore,
        ability_after: abilityAfter,
        response_time_ms: Number(body.response_time_ms) || null,
        metadata: { skill }
      });
      if (responseError) throw responseError;

      const answeredCount = answerIndex + 1;
      const correctCount = Number(attempt.correct_count || 0) + (isCorrect ? 1 : 0);
      const complete = answeredCount >= ids.length;
      const update = {
        answered_count: answeredCount,
        correct_count: correctCount,
        final_ability: abilityAfter,
        recommended_level: complete ? levelForAbility(abilityAfter) : null,
        status: complete ? 'completed' : 'in_progress',
        completed_at: complete ? new Date().toISOString() : null,
        duration_seconds: complete ? Math.max(0, Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000)) : null,
        updated_at: new Date().toISOString()
      };
      const { error:updateError } = await game.from('student_assessment_attempts').update(update).eq('id',attempt.id);
      if (updateError) throw updateError;

      const { data: existingSkill } = await game.from('student_assessment_skill_results').select('id,questions_seen,questions_correct')
        .eq('attempt_id',attempt.id).eq('skill_key',skill).maybeSingle();
      const seen = Number(existingSkill?.questions_seen || 0) + 1;
      const right = Number(existingSkill?.questions_correct || 0) + (isCorrect ? 1 : 0);
      await game.from('student_assessment_skill_results').upsert({
        attempt_id:attempt.id, student_id:student.id, skill_key:skill,
        questions_seen:seen, questions_correct:right, score_percent:Math.round((right/seen)*100), updated_at:new Date().toISOString()
      }, { onConflict:'attempt_id,skill_key' });

      if (complete) return reply(200, { success:true, complete:true }, origin);
      const nextItem = bank.find(row => (clean(row.source_key) || row.id) === ids[answeredCount]);
      if (!nextItem) return reply(409, { success:false, error:'The next question is unavailable.' }, origin);
      return reply(200, { success:true, complete:false, question:publicQuestion(nextItem,answeredCount+1,ids.length) }, origin);
    }

    if (action === 'restart' && event.httpMethod === 'POST') {
      const attempt = await fetchAttempt(game, clean(body.attempt_id), student.id);
      if (attempt?.status === 'in_progress') {
        await game.from('student_assessment_attempts').update({ status:'abandoned', updated_at:new Date().toISOString() }).eq('id',attempt.id);
      }
      return reply(200, { success:true }, origin);
    }

    return reply(404, { success:false, error:'Unknown action.' }, origin);
  } catch (error) {
    console.error('[student_level_test]', action, error);
    return reply(500, { success:false, error:error.message || 'Unexpected assessment error.' }, origin);
  }
};
