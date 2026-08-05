const { createClient } = require('@supabase/supabase-js');

function cors(event) {
  const allowed = new Set([
    'https://www.willenaenglish.com',
    'https://willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'https://cf.willenaenglish.com',
    'https://staging.willenaenglish.com',
    'https://students.willenaenglish.com',
    'http://localhost:9000',
    'http://localhost:8888'
  ]);
  const origin = String((event.headers && (event.headers.origin || event.headers.Origin)) || '').trim();
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://willenaenglish.netlify.app',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  };
}

function reply(event, statusCode, body) {
  return { statusCode, headers: cors(event), body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(event), body: '' };
  if (event.httpMethod !== 'GET') return reply(event, 405, { success: false, error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return reply(event, 500, { success: false, error: 'Server configuration error' });

  try {
    const cookieHeader = String((event.headers && (event.headers.cookie || event.headers.Cookie)) || '');
    const match = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
    if (!match) return reply(event, 401, { success: false, error: 'Not signed in' });

    const token = decodeURIComponent(match[1]);
    const supabase = createClient(url, serviceKey);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData && authData.user;
    if (authError || !user) return reply(event, 401, { success: false, error: 'Not signed in' });

    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,username,grade')
      .eq('id', user.id)
      .single();

    if (error || !data) return reply(event, 404, { success: false, error: 'Student profile not found' });

    return reply(event, 200, {
      success: true,
      student: {
        id: data.id,
        name: data.name,
        username: data.username,
        grade: data.grade
      }
    });
  } catch (error) {
    console.error('[student_profile_grade]', error);
    return reply(event, 500, { success: false, error: 'Could not load student grade' });
  }
};
