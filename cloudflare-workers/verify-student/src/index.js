/**
 * Cloudflare Worker: verify-student
 *
 * Replacement for Netlify function verify_student.js.
 * Validates student identity via Supabase using REST APIs.
 */

const ALLOWED_ORIGINS = [
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://cf.willenaenglish.com',
  'https://staging.willenaenglish.com',
  // Student and Teacher subdomains
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:9000'
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-store',
  };
}

function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

// Single database transaction verifies identity and serializes attempts by
// canonical student identity across all Cloudflare locations.
async function verifyIdentity(env, korean, english, code, ip) {
  const r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/easy_login_verify_v1',{
    method:'POST',headers:{apikey:env.SUPABASE_SERVICE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_korean:korean,p_english:english,p_code:code,p_ip:ip}),
    signal:AbortSignal.timeout(10000)
  });
  if(!r.ok)throw Error('Identity verification unavailable');
  return await r.json();
}
async function recordSessionOutcome(env,id,success) {
  try {
    const r=await fetch(env.SUPABASE_URL+'/rest/v1/auth_password_audit',{
      method:'POST',headers:{apikey:env.SUPABASE_SERVICE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify({student_id:id,source:'verify_student',action:'easy_login_session',success,note:success?'session_issued':'session_failed',timestamp:new Date().toISOString()})
    });
    if(!r.ok)console.warn('Easy Login session audit failed',r.status);
  } catch { console.warn('Easy Login session audit unavailable'); }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: getCorsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405, origin);
    }

    // Parse body safely
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, origin);
    }

    if (!body || typeof body !== 'object') {
      return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, origin);
    }

    const { korean_name, name, auth_code } = body;
    if (!korean_name || !name || !auth_code) {
      return jsonResponse({ success: false, error: 'Missing required fields' }, 400, origin);
    }

    const koreanNameValue=String(korean_name).trim();
    const englishNameValue=String(name).trim();
    const code=String(auth_code).replace(/\D/g,'');
    if(code.length!==4 || !koreanNameValue || !englishNameValue || koreanNameValue.length>100 || englishNameValue.length>100)
      return jsonResponse({success:false,error:'Authentication code must be 4 digits.'},400,origin);
    let result;
    try {
      result=await verifyIdentity(env,koreanNameValue,englishNameValue,code,request.headers.get('CF-Connecting-IP')||null);
    } catch {
      return jsonResponse({success:false,error:'로그인 서비스를 잠시 사용할 수 없습니다. 다시 시도해 주세요.'},503,origin);
    }
    if(result?.status==='locked'){
      const seconds=Math.max(1,Math.min(300,Number(result.retry_after_seconds)||300));
      const response=jsonResponse({success:false,error:'로그인 시도가 너무 많습니다. '+Math.ceil(seconds/60)+'분 후 다시 시도해 주세요.',retry_after_seconds:seconds},429,origin);
      response.headers.set('Retry-After',String(seconds));
      return response;
    }
    if(result?.status!=='ok'||!result.student?.id)
      return jsonResponse({success:false,error:'Student not found. Please check your information.'},404,origin);
    const match=result.student;

    // Passwordless easy login: issue a real Supabase session without changing
    // the student's password. A password change invalidates other devices.
    if (body.login === true) {
      if (!match.email) { await recordSessionOutcome(env,match.id,false); return jsonResponse({ success: false, error: 'Student email is missing.' }, 400, origin); }
      try {
        const generated = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
          method: 'POST',
          headers: {'Content-Type':'application/json',apikey:env.SUPABASE_SERVICE_KEY,
            Authorization:`Bearer ${env.SUPABASE_SERVICE_KEY}`},
          body: JSON.stringify({type:'magiclink',email:match.email})
        });
        const link = await generated.json();
        if (!generated.ok || !link.hashed_token) throw Error('Could not create sign-in token');
        const verified = await fetch(`${env.SUPABASE_URL}/auth/v1/verify`, {
          method:'POST',
          headers:{'Content-Type':'application/json',apikey:env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY},
          body:JSON.stringify({type:'magiclink',token_hash:link.hashed_token})
        });
        const session=await verified.json();
        if(!verified.ok || !session.access_token || !session.refresh_token || session.user?.id!==match.id)
          throw Error('Could not establish student session');
        await recordSessionOutcome(env,match.id,true);
        return jsonResponse({success:true,student:{id:match.id,username:match.username,email:match.email,
          name:match.name,korean_name:match.korean_name},session:{access_token:session.access_token,refresh_token:session.refresh_token}},200,origin);
      } catch (e) {
        await recordSessionOutcome(env,match.id,false);
        console.error('[verify-student] passwordless login failed');
        return jsonResponse({success:false,error:'Could not establish student session'},502,origin);
      }
    }

    return jsonResponse({
      success: true,
      student: {
        id: match.id,
        username: match.username,
        email: match.email,
        name: match.name,
        korean_name: match.korean_name
      }
    }, 200, origin);
  }
};
