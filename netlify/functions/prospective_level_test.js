const { createClient } = require('@supabase/supabase-js');

const ALLOWED_ORIGINS = new Set([
  'https://staging.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io'
]);

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) || /\.pages\.dev$/.test(origin || '');
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': allowed ? origin : 'https://staging.willenaenglish.com',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin'
  };
}

function clean(value, maxLength) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const studentName = clean(body.student_name, 80);
    const schoolName = clean(body.school_name, 120);
    const schoolGrade = clean(body.school_grade, 30);

    if (studentName.length < 2) throw new Error('학생 이름을 입력하세요.');
    if (schoolName.length < 2) throw new Error('학교 이름을 입력하세요.');
    if (!schoolGrade) throw new Error('학년을 선택하세요.');

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error('Server database configuration is missing.');

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data, error } = await supabase
      .from('prospective_level_test_candidates')
      .insert({
        student_name: studentName,
        school_name: schoolName,
        school_grade: schoolGrade,
        status: 'started',
        source: 'free-level-test',
        metadata: {
          language: clean(body.language, 10) || 'ko',
          user_agent: clean(event.headers['user-agent'], 300)
        }
      })
      .select('id,student_name,school_name,school_grade,started_at')
      .single();

    if (error) throw error;

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ success: true, candidate: data })
    };
  } catch (error) {
    console.error('[prospective-level-test]', error);
    const message = error && error.message ? error.message : '등록할 수 없습니다.';
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: message }) };
  }
};
