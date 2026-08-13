const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cors(event) {
  const origin = event.headers.origin || '';
  const allowed = /(^https:\/\/(?:staging|students|cf)\.willenaenglish\.com$)|(^https:\/\/[^/]+\.pages\.dev$)/i.test(origin)
    ? origin
    : 'https://students.willenaenglish.com';
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': allowed,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET,OPTIONS',
    'vary': 'Origin'
  };
}

function cookieValue(cookieHeader, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(cookieHeader || '').match(new RegExp('(?:^|;\\s*)' + escaped + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : '';
}

function accessToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const cookies = event.headers.cookie || event.headers.Cookie || '';
  return cookieValue(cookies, 'sb_access') || cookieValue(cookies, 'sb-access') || cookieValue(cookies, 'sb_access_token') || cookieValue(cookies, 'sb-access-token');
}

function chooseCourseAssignment(rows) {
  const assignments = Array.isArray(rows) ? rows : [];
  if (!assignments.length) return null;
  return assignments.find(row => {
    const series = String(row.catalog_series || '').toLowerCase();
    const title = String(row.book_title || '').toLowerCase();
    return !series.includes('reading') && !title.includes('reading lab');
  }) || assignments[0];
}

exports.handler = async (event) => {
  const headers = cors(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const token = accessToken(event);
    if (!token) throw new Error('Missing student session');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user?.id) throw new Error('Invalid student session');
    const userId = authData.user.id;
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id,name,username,class,grade').eq('id', userId).single();
    if (profileError || !profile) throw new Error('Student profile not found');
    let classRow = null;
    const { data: enrollment } = await supabase.from('class_enrollments').select('class_id,started_at').eq('student_id', userId).eq('status', 'active').order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (enrollment?.class_id) {
      const { data } = await supabase.from('classes').select('id,name,display_name,legacy_class_name').eq('id', enrollment.class_id).maybeSingle();
      classRow = data || null;
    }
    if (!classRow && profile.class) {
      const className = String(profile.class).trim();
      const { data } = await supabase.from('classes').select('id,name,display_name,legacy_class_name').or(`name.eq.${className},display_name.eq.${className},legacy_class_name.eq.${className}`).eq('status', 'active').limit(1).maybeSingle();
      classRow = data || null;
    }
    if (!classRow) return { statusCode: 200, headers, body: JSON.stringify({ success: true, student: { id: profile.id, name: profile.name || profile.username || 'Student', grade: profile.grade || null }, class: null, assignment: null }) };
    const { data: assignments, error: assignmentError } = await supabase.from('class_book_assignments').select('id,book_id,book_title,subject,starting_unit,current_unit,status,catalog_series,catalog_level,started_at,created_at').eq('class_id', classRow.id).eq('status', 'active').order('started_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    if (assignmentError) throw assignmentError;
    const assignment = chooseCourseAssignment(assignments);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, student: { id: profile.id, name: profile.name || profile.username || 'Student', grade: profile.grade || null }, class: classRow, assignment: assignment || null }) };
  } catch (error) {
    const statusCode = /token|auth|session|Missing student/i.test(error.message || '') ? 401 : 500;
    return { statusCode, headers, body: JSON.stringify({ success: false, error: error.message || 'Study lookup failed' }) };
  }
};
