import { createClient } from '@supabase/supabase-js';

const TEST_VERSION = '2026-08-v1';
const TEST_LENGTH = 30;
const ALLOWED_ORIGINS = new Set([
  'https://students.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'http://localhost:8788',
]);

const clean = value => String(value ?? '').trim();

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://students.willenaenglish.com';
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': allowed,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'cache-control': 'no-store',
  };
}

function json(status, body, origin = '') {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

function parseCookies(value = '') {
  return value.split(/;\s*/).reduce((out, part) => {
    const index = part.indexOf('=');
    if (index > 0) out[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
    return out;
  }, {});
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function optionsFor(item) {
  const related = Array.isArray(item.assessment_item_options) ? item.assessment_item_options : [];
  const options = related.length
    ? [...related]
      .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0))
      .map(option => clean(option.option_text))
    : (Array.isArray(item.choices) ? item.choices.map(clean) : []);
  return [...new Set(options.filter(Boolean))];
}

function isExcludedFromLevelTest(item) {
  const metadata = item?.metadata || {};
  const value = metadata.exclude_level_test ?? metadata.exclude_from_level_test;
  return value === true || String(value).toLowerCase() === 'true';
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

function publicQuestion(item, index, total) {
  const metadata = item.metadata || {};
  const type = clean(item.item_type) || 'question_response';
  return {
    id: clean(item.source_key) || item.id,
    index,
    total,
    level: Number(item.level_id) || 1,
    type,
    prompt: clean(item.prompt_text),
    context: clean(item.context_text),
    options: shuffle(optionsFor(item)),
    transcript: clean(metadata.transcript) || (type === 'listening' ? clean(item.context_text) : ''),
    tokens: Array.isArray(metadata.tokens) ? metadata.tokens.map(clean).filter(Boolean) : [],
  };
}

function chooseTest(bank, count = TEST_LENGTH) {
  const groups = new Map();
  bank.forEach(item => {
    const level = Number(item.level_id) || 1;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(item);
  });
  const levels = [...groups.keys()].sort((a, b) => a - b);
  const chosen = [];
  let cursor = 0;
  while (chosen.length < count && levels.length) {
    const level = levels[cursor % levels.length];
    const pool = groups.get(level);
    if (pool?.length) chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (!pool?.length) levels.splice(levels.indexOf(level), 1);
    else cursor += 1;
  }
  return chosen;
}

async function getStudent(request, game) {
  const cookies = parseCookies(request.headers.get('cookie') || '');
  let token = cookies.sb_access || cookies['sb-access'] || cookies.sb_access_token || cookies['sb-access-token'];
  const authorization = request.headers.get('authorization') || '';
  if (!token && authorization.startsWith('Bearer ')) token = authorization.slice(7);
  if (!token) return null;

  const { data: authData, error: authError } = await game.auth.getUser(token);
  if (authError || !authData?.user) return null;

  const { data: profile, error } = await game
    .from('profiles')
    .select('id,name,korean_name,username,class,role,approved')
    .eq('id', authData.user.id)
    .single();

  if (error || !profile || clean(profile.role).toLowerCase() !== 'student' || profile.approved === false) return null;
  return profile;
}

async function loadBank(content) {
  const { data, error } = await content
    .from('assessment_items')
    .select('id,source_key,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,metadata,choices,assessment_item_options(option_text,is_correct,display_order)')
    .eq('status', 'published')
    .eq('is_flagged', false)
    .order('level_id', { ascending: true })
    .order('difficulty_rating', { ascending: true });

  if (error) throw error;
  return (data || []).filter(item => {
    if (isExcludedFromLevelTest(item)) return false;
    const options = optionsFor(item);
    const type = clean(item.item_type);
    const supported = type !== 'sentence_unscramble' || Array.isArray(item.metadata?.tokens);
    return supported && clean(item.prompt_text) && clean(item.correct_answer) && (options.length >= 2 || type === 'sentence_unscramble');
  });
}

async function findAttempt(game, attemptId, studentId) {
  const { data, error } = await game
    .from('student_assessment_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('student_id', studentId)
    .single();
  return error ? null : data;
}

function levelForAbility(value) {
  return Math.max(1, Math.min(12, Math.round(Number(value) || 1)));
}

function capturedSkill(row) {
  const explicit = clean(row?.metadata?.skill).toLowerCase();
  if (explicit) return explicit;
  return skillFor({ item_type: row?.item_type });
}

function capturedResponse(row, attempt, studentId) {
  return {
    attempt_id: attempt.id,
    student_id: studentId,
    answer_index: Math.round(Number(row.answer_index) || 0),
    assessment_item_id: clean(row.assessment_item_id),
    assessment_source_key: clean(row.assessment_source_key) || null,
    question_level: Number(row.question_level) || null,
    item_type: clean(row.item_type) || null,
    prompt_snapshot: clean(row.prompt_snapshot),
    options_snapshot: Array.isArray(row.options_snapshot) ? row.options_snapshot : null,
    selected_answer: row.selected_answer ?? null,
    correct_answer: row.correct_answer ?? null,
    is_correct: row.is_correct === true,
    response_time_ms: Number(row.response_time_ms) || null,
    metadata: { ...(row.metadata || {}), skill: capturedSkill(row) },
  };
}

function validCapturedResponse(row) {
  return Number.isInteger(row.answer_index) && row.answer_index > 0 && Boolean(row.assessment_item_id);
}

async function saveCapturedResponses(game, attempt, studentId, rows) {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map(row => capturedResponse(row, attempt, studentId))
    .filter(validCapturedResponse);
  if (!normalized.length) return;

  const { error } = await game
    .from('student_assessment_responses')
    .upsert(normalized, { onConflict: 'attempt_id,answer_index' });
  if (error) throw error;
}

async function summarizeCapturedAttempt(game, attempt, studentId) {
  const { data: rows, error } = await game
    .from('student_assessment_responses')
    .select('answer_index,is_correct,item_type,metadata')
    .eq('attempt_id', attempt.id)
    .eq('student_id', studentId)
    .order('answer_index', { ascending: true });
  if (error) throw error;

  const responses = rows || [];
  const correctCount = responses.filter(row => row.is_correct === true).length;
  const skills = new Map();
  responses.forEach(row => {
    const skill = capturedSkill(row);
    const current = skills.get(skill) || { seen: 0, correct: 0 };
    current.seen += 1;
    if (row.is_correct === true) current.correct += 1;
    skills.set(skill, current);
  });

  for (const [skill, result] of skills) {
    const { error: skillError } = await game.from('student_assessment_skill_results').upsert({
      attempt_id: attempt.id,
      student_id: studentId,
      skill_key: skill,
      questions_seen: result.seen,
      questions_correct: result.correct,
      score_percent: Math.round((result.correct / result.seen) * 100),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'attempt_id,skill_key' });
    if (skillError) throw skillError;
  }

  return {
    answeredCount: responses.length,
    correctCount,
    answerIndexes: responses.map(row => Number(row.answer_index)).filter(Number.isInteger),
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (!['GET', 'POST'].includes(request.method)) return json(405, { success: false, error: 'Method not allowed.' }, origin);

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { success: false, error: 'Game Scores database is not configured.' }, origin);
    }
    if (!env.CONTENT_SUPABASE_URL || !env.CONTENT_SUPABASE_PUBLISHABLE_KEY) {
      return json(500, { success: false, error: 'Content database is not configured.' }, origin);
    }

    const game = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const content = createClient(env.CONTENT_SUPABASE_URL, env.CONTENT_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const student = await getStudent(request, game);
    if (!student) return json(401, { success: false, error: 'Student login required.' }, origin);

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'me';
    let body = {};
    if (request.method === 'POST') {
      try { body = await request.json(); }
      catch { return json(400, { success: false, error: 'Invalid request body.' }, origin); }
    }

    try {
      if (action === 'me') {
        return json(200, {
          success: true,
          student: {
            id: student.id,
            name: student.name || student.username,
            korean_name: student.korean_name,
            class: student.class,
          },
        }, origin);
      }

      // The internal student page uses the same adaptive browser engine and
      // recorder as the public test. These capture actions provide its
      // authenticated transport while keeping every response row recoverable.
      if (action === 'capture_start' && request.method === 'POST') {
        const totalQuestions = Math.max(0, Math.round(Number(body.total_questions) || Number(body.setup?.length) || 0));
        const { data: attempt, error } = await game
          .from('student_assessment_attempts')
          .insert({
            student_id: student.id,
            assessment_key: 'willena-internal-level-test',
            status: 'in_progress',
            test_version: clean(body.test_version) || TEST_VERSION,
            setup: body.setup && typeof body.setup === 'object' ? body.setup : {},
            total_questions: totalQuestions,
            metadata: {
              source: 'students/level-test',
              recording_engine: 'shared-browser-recorder-v1',
              class_at_test: student.class || null,
            },
          })
          .select('id,total_questions,started_at')
          .single();
        if (error) throw error;

        return json(200, { success: true, attempt_id: attempt.id }, origin);
      }

      if (action === 'capture_answer' && request.method === 'POST') {
        const attempt = await findAttempt(game, clean(body.attempt_id), student.id);
        if (!attempt || attempt.status !== 'in_progress') return json(404, { success: false, error: 'Active attempt not found.' }, origin);

        const row = capturedResponse(body, attempt, student.id);
        if (!validCapturedResponse(row)) return json(400, { success: false, error: 'Invalid recorded answer.' }, origin);
        if (attempt.total_questions > 0 && row.answer_index > attempt.total_questions) {
          return json(409, { success: false, error: 'Answer index exceeds the selected test length.' }, origin);
        }

        await saveCapturedResponses(game, attempt, student.id, [body]);
        const summary = await summarizeCapturedAttempt(game, attempt, student.id);
        const { error: updateError } = await game
          .from('student_assessment_attempts')
          .update({
            answered_count: summary.answeredCount,
            correct_count: summary.correctCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', attempt.id)
          .eq('student_id', student.id);
        if (updateError) throw updateError;

        return json(200, { success: true, answered_count: summary.answeredCount }, origin);
      }

      if (action === 'capture_finish' && request.method === 'POST') {
        const attempt = await findAttempt(game, clean(body.attempt_id), student.id);
        if (!attempt || attempt.status !== 'in_progress') return json(404, { success: false, error: 'Active attempt not found.' }, origin);

        // Replay the complete browser answer set so a late or dropped
        // per-question request cannot leave the report at 19/20.
        await saveCapturedResponses(game, attempt, student.id, body.answers);
        const summary = await summarizeCapturedAttempt(game, attempt, student.id);
        const totalQuestions = Math.max(0, Number(attempt.total_questions) || Math.round(Number(body.total_questions) || 0) || summary.answeredCount);
        const hasEveryAnswer = summary.answeredCount === totalQuestions
          && summary.answerIndexes.every((answerIndex, index) => answerIndex === index + 1);
        if (!hasEveryAnswer) {
          return json(409, {
            success: false,
            error: `Recorded ${summary.answeredCount} of ${totalQuestions} answers. Please try saving again.`,
            answered_count: summary.answeredCount,
            total_questions: totalQuestions,
          }, origin);
        }

        const recommendedLevel = Number(body.recommended_level) || null;
        const completedAt = new Date().toISOString();
        const { data: completed, error: updateError } = await game
          .from('student_assessment_attempts')
          .update({
            status: 'completed',
            answered_count: summary.answeredCount,
            correct_count: summary.correctCount,
            total_questions: totalQuestions,
            recommended_level: recommendedLevel,
            final_ability: recommendedLevel,
            duration_seconds: Math.max(0, Math.round(Number(body.duration_seconds) || 0)),
            completed_at: completedAt,
            updated_at: completedAt,
            metadata: {
              ...(attempt.metadata || {}),
              ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
              source: 'students/level-test',
              recording_engine: 'shared-browser-recorder-v1',
            },
          })
          .eq('id', attempt.id)
          .eq('student_id', student.id)
          .select('id,answered_count,total_questions,correct_count,recommended_level')
          .single();
        if (updateError) throw updateError;

        return json(200, { success: true, attempt: completed }, origin);
      }

      if (action === 'start' && request.method === 'POST') {
        const bank = await loadBank(content);
        const selected = chooseTest(bank, Math.min(TEST_LENGTH, bank.length));
        if (!selected.length) return json(503, { success: false, error: 'No published assessment questions are available.' }, origin);

        const itemIds = selected.map(item => clean(item.source_key) || item.id);
        const { data: attempt, error } = await game
          .from('student_assessment_attempts')
          .insert({
            student_id: student.id,
            assessment_key: 'willena-internal-level-test',
            status: 'in_progress',
            test_version: TEST_VERSION,
            setup: { item_ids: itemIds },
            starting_ability: 2,
            final_ability: 2,
            total_questions: itemIds.length,
            metadata: { class_at_test: student.class || null },
          })
          .select('id,total_questions,started_at')
          .single();
        if (error) throw error;

        return json(200, {
          success: true,
          attempt_id: attempt.id,
          question: publicQuestion(selected[0], 1, itemIds.length),
        }, origin);
      }

      if (action === 'resume' && request.method === 'GET') {
        const { data: attempt } = await game
          .from('student_assessment_attempts')
          .select('*')
          .eq('student_id', student.id)
          .eq('status', 'in_progress')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!attempt) return json(200, { success: true, attempt: null }, origin);
        const ids = attempt.setup?.item_ids || [];
        const nextIndex = Number(attempt.answered_count) || 0;
        if (nextIndex >= ids.length) return json(200, { success: true, attempt: null }, origin);

        const bank = await loadBank(content);
        const item = bank.find(row => (clean(row.source_key) || row.id) === ids[nextIndex]);
        if (!item) return json(409, { success: false, error: 'The next question is no longer available.' }, origin);

        return json(200, {
          success: true,
          attempt: { id: attempt.id },
          question: publicQuestion(item, nextIndex + 1, ids.length),
        }, origin);
      }

      if (action === 'answer' && request.method === 'POST') {
        const attempt = await findAttempt(game, clean(body.attempt_id), student.id);
        if (!attempt || attempt.status !== 'in_progress') return json(404, { success: false, error: 'Active attempt not found.' }, origin);

        const ids = attempt.setup?.item_ids || [];
        const answerIndex = Number(attempt.answered_count) || 0;
        const expectedId = ids[answerIndex];
        if (!expectedId || clean(body.question_id) !== expectedId) {
          return json(409, { success: false, error: 'Question order mismatch. Refresh and resume the test.' }, origin);
        }

        const bank = await loadBank(content);
        const item = bank.find(row => (clean(row.source_key) || row.id) === expectedId);
        if (!item) return json(409, { success: false, error: 'This question is no longer available.' }, origin);

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
          metadata: { skill },
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
          updated_at: new Date().toISOString(),
        };
        const { error: updateError } = await game.from('student_assessment_attempts').update(update).eq('id', attempt.id);
        if (updateError) throw updateError;

        const { data: existingSkill } = await game
          .from('student_assessment_skill_results')
          .select('id,questions_seen,questions_correct')
          .eq('attempt_id', attempt.id)
          .eq('skill_key', skill)
          .maybeSingle();
        const seen = Number(existingSkill?.questions_seen || 0) + 1;
        const right = Number(existingSkill?.questions_correct || 0) + (isCorrect ? 1 : 0);
        const { error: skillError } = await game.from('student_assessment_skill_results').upsert({
          attempt_id: attempt.id,
          student_id: student.id,
          skill_key: skill,
          questions_seen: seen,
          questions_correct: right,
          score_percent: Math.round((right / seen) * 100),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'attempt_id,skill_key' });
        if (skillError) throw skillError;

        if (complete) return json(200, { success: true, complete: true }, origin);
        const nextItem = bank.find(row => (clean(row.source_key) || row.id) === ids[answeredCount]);
        if (!nextItem) return json(409, { success: false, error: 'The next question is unavailable.' }, origin);

        return json(200, {
          success: true,
          complete: false,
          question: publicQuestion(nextItem, answeredCount + 1, ids.length),
        }, origin);
      }

      if (action === 'restart' && request.method === 'POST') {
        const attempt = await findAttempt(game, clean(body.attempt_id), student.id);
        if (attempt?.status === 'in_progress') {
          await game
            .from('student_assessment_attempts')
            .update({ status: 'abandoned', updated_at: new Date().toISOString() })
            .eq('id', attempt.id);
        }
        return json(200, { success: true }, origin);
      }

      return json(404, { success: false, error: 'Unknown action.' }, origin);
    } catch (error) {
      console.error('[student-level-test]', action, error);
      return json(500, { success: false, error: error?.message || 'Unexpected assessment error.' }, origin);
    }
  },
};
