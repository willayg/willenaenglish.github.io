const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': event.headers.origin || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const auth = String(event.headers.authorization || event.headers.Authorization || '');
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ success:false, error:'Missing token' }) };

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !serviceKey) return { statusCode: 500, headers, body: JSON.stringify({ success:false, error:'Server auth is not configured' }) };

    const admin = createClient(url, serviceKey);
    const { data:userData, error:userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return { statusCode: 401, headers, body: JSON.stringify({ success:false, error:'Invalid session' }) };

    const { data:profile, error:profileError } = await admin.from('profiles').select('role,approved,email').eq('id', user.id).single();
    if (profileError || !profile || profile.approved === false) return { statusCode: 403, headers, body: JSON.stringify({ success:false, error:'Profile not approved' }) };

    const role = String(profile.role || '').toLowerCase();
    const allowed = ['teacher','admin','owner','director','manager','instructor'];
    if (!allowed.includes(role)) return { statusCode: 403, headers, body: JSON.stringify({ success:false, error:'Teacher role required', role }) };

    return { statusCode: 200, headers, body: JSON.stringify({ success:true, user_id:user.id, email:user.email || profile.email || '', role:profile.role }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ success:false, error:String(e?.message || e) }) };
  }
};
