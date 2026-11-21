// Read-only Genius Apps usage analytics. Teacher/admin session required.
// All aggregation is performed in the Game Scores DB. No student rows are exposed
// until the Supabase Auth token and staff profile have been verified.
const { createClient } = require('@supabase/supabase-js');
const { corsJsonResponse, handleCorsPreflightIfNeeded } = require('./lib/cors');

const response = (event, status, body) =>
  corsJsonResponse(event, status, body, { 'Cache-Control': 'private, no-store, max-age=0' });

function accessToken(event) {
  const headers = event.headers || {};
  const cookie = headers.cookie || headers.Cookie || '';
  const pair = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('sb_access='));
  if (pair) {
    try { return decodeURIComponent(pair.slice('sb_access='.length)); } catch { return null; }
  }
  const auth = headers.authorization || headers.Authorization || '';
  return /^Bearer\s+\S+/i.test(auth) ? auth.replace(/^Bearer\s+/i,'') : null;
}
function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

exports.handler = async (event) => {
  const preflight = handleCorsPreflightIfNeeded(event);
  if (preflight) return preflight;
  if (event.httpMethod !== 'GET') return response(event,405,{success:false,error:'GET required'});
  const token = accessToken(event);
  if (!token) return response(event,401,{success:false,error:'Teacher login required'});

  const params = event.queryStringParameters || {};
  const days = Number(params.days || 30);
  const chosenClass = String(params.class || '').trim().slice(0,100) || null;
  const app = String(params.app || '').trim().toLowerCase() || null;
  if (![7,30,90].includes(days)) return response(event,400,{success:false,error:'Choose 7, 30 or 90 days'});
  if (app && !['word','sentence','grammar','talking','writing','puzzles'].includes(app)) {
    return response(event,400,{success:false,error:'Unknown app'});
  }
  const wantsCustom = params.start !== undefined || params.end !== undefined;
  const start = wantsCustom ? validDay(params.start) : null;
  const end = wantsCustom ? validDay(params.end) : null;
  if (wantsCustom && (!start || !end || end < start || ((new Date(end)-new Date(start))/86400000) > 89)) {
    return response(event,400,{success:false,error:'Select 1–90 valid days'});
  }
  const url = process.env.SUPABASE_URL || process.env.supabase_url;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role_key;
  if (!url || !key) return response(event,503,{success:false,error:'Analytics backend unavailable'});

  try {
    const db = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:auth,error:authError} = await db.auth.getUser(token);
    if (authError || !auth?.user?.id) return response(event,401,{success:false,error:'Teacher session expired'});
    const {data:staff,error:profileError} = await db.from('profiles')
      .select('role,approved').eq('id',auth.user.id).single();
    if (profileError || !staff || !['teacher','admin'].includes(String(staff.role||'').toLowerCase()) || staff.approved===false) {
      return response(event,403,{success:false,error:'Approved teacher access required'});
    }
    const {data,error} = await db.rpc('teacher_genius_usage_analytics_v1',{
      p_days:days,p_class:chosenClass,p_app:app,p_start:start,p_end:end
    });
    if (error) {
      console.error('[genius_usage_analytics] RPC failed',error.message);
      return response(event,503,{success:false,error:'Could not load usage analytics'});
    }
    return response(event,200,{success:true,...data});
  } catch (error) {
    console.error('[genius_usage_analytics] request error',error?.message);
    return response(event,503,{success:false,error:'Usage analytics temporarily unavailable'});
  }
};
