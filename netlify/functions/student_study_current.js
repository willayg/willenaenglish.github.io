const { createClient } = require('@supabase/supabase-js');
const { jwtVerify, createRemoteJWKSet } = require('jose');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT = SUPABASE_URL.replace('https://', '').split('.')[0];
const JWKS = createRemoteJWKSet(new URL(`https://${PROJECT}.supabase.co/auth/v1/keys`));

function cors(event) {
  const origin = event.headers.origin || '';
  const allowed = /(^https:\/\/(?:staging|students|cf)\.willenaenglish\.com$)|(^https:\/\/[^/]+\.pages\.dev$)/i.test(origin)
    ? origin
    : 'https://students.willenaenglish.com';
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': allowed,
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET,OPTIONS',
    'vary': 'Origin'
  };
}

async function verifyUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) throw new Error('Missing bearer token');
  const token = authHeader.slice(7);
  const { payload } = await jwtVerify(token, JWKS);
  if (!payload.sub) throw new Error('Invalid user token');
  return payload.sub;
}

exports.handler = async (event) => {
  const headers = cors(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const userId = await verifyUser(event);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,name,username,class,grade')
      .eq('id', userId)
      .single();
    if (profileError || !profile) throw new Error('Student profile not found');

    let classRow = null;
    const { data: enrollment } = await supabase
      .from('class_enrollments')
      .select('class_id,started_at')
      .eq('student_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollment && enrollment.class_id) {
      const { data } = await supabase
        .from('classes')
        .select('id,name,display_name,legacy_class_name')
        .eq('id', enrollment.class_id)
        .maybeSingle();
      classRow = data || null;
    }

    if (!classRow && profile.class) {
      const className = String(profile.class).trim();
      const { data } = await supabase
        .from('classes')
        .select('id,name,display_name,legacy_class_name')
        .or(`name.eq.${className},display_name.eq.${className},legacy_class_name.eq.${className}`)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      classRow = data || null;
    }

    if (!classRow) {
      return { statusCode: 200, headers, body: JSON.stringify({
        success: true,
        student: { id: profile.id, name: profile.name || profile.username || 'Student', grade: profile.grade || null },
        class: null,
        assignment: null
      }) };
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('class_book_assignments')
      .select('id,book_id,book_title,subject,starting_unit,current_unit,status,catalog_series,catalog_level')
      .eq('class_id', classRow.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (assignmentError) throw assignmentError;

    return { statusCode: 200, headers, body: JSON.stringify({
      success: true,
      student: { id: profile.id, name: profile.name || profile.username || 'Student', grade: profile.grade || null },
      class: classRow,
      assignment: assignment || null
    }) };
  } catch (error) {
    const statusCode = /token|auth|Missing bearer/i.test(error.message || '') ? 401 : 500;
    return { statusCode, headers, body: JSON.stringify({ success: false, error: error.message || 'Study lookup failed' }) };
  }
};
