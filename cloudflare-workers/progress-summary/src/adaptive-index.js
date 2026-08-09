import baseWorker from './refresh-index.js';

const COOKIE_DOMAIN = '.willenaenglish.com';

function parseCookies(header=''){
  const out={};
  for(const part of header.split(';')){
    const i=part.indexOf('='); if(i<1) continue;
    out[part.slice(0,i).trim()]=part.slice(i+1).trim();
  }
  return out;
}
function cors(origin=''){
  return {
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':origin||'https://students.willenaenglish.com',
    'Access-Control-Allow-Credentials':'true',
    'Access-Control-Allow-Methods':'GET,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, Authorization',
    'Cache-Control':'private, no-store'
  };
}
function json(data,status,origin){ return new Response(JSON.stringify(data),{status,headers:cors(origin)}); }
function authCookie(name,value,maxAge){ return `${name}=${value}; Domain=${COOKIE_DOMAIN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
async function userFromAccess(env,token){
  if(!token) return null;
  const apiKey=env.SUPABASE_ANON_KEY||env.SUPABASE_SERVICE_KEY;
  const r=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:apiKey,Authorization:`Bearer ${decodeURIComponent(token)}`}});
  if(!r.ok) return null;
  return r.json().catch(()=>null);
}
async function refreshTokens(env,refreshToken){
  if(!refreshToken) return null;
  const apiKey=env.SUPABASE_ANON_KEY||env.SUPABASE_SERVICE_KEY;
  const r=await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:apiKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:decodeURIComponent(refreshToken)})});
  if(!r.ok) return null;
  const d=await r.json().catch(()=>null);
  return d?.access_token&&d?.refresh_token?d:null;
}
async function rpc(env,name,args){
  const r=await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d?.message||d?.error||`${name} failed (${r.status})`);
  return d;
}
async function handleAdaptive(request,env){
  const url=new URL(request.url);
  const section=String(url.searchParams.get('section')||'').toLowerCase();
  if(section!=='adaptive_state'&&section!=='study_content_mastery') return null;
  const origin=request.headers.get('Origin')||'';
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=='GET') return json({success:false,error:'Method Not Allowed'},405,origin);

  const cookies=parseCookies(request.headers.get('Cookie')||'');
  let user=await userFromAccess(env,cookies.sb_access).catch(()=>null);
  let refreshed=null;
  if(!user?.id){
    refreshed=await refreshTokens(env,cookies.sb_refresh||cookies['sb-refresh']).catch(()=>null);
    if(refreshed) user=await userFromAccess(env,refreshed.access_token).catch(()=>null);
  }
  if(!user?.id) return json({success:false,error:'Not signed in'},401,origin);

  try{
    let result;
    if(section==='adaptive_state'){
      result=await rpc(env,'get_adaptive_study_state_v1',{p_student_id:user.id});
    }else{
      result=await rpc(env,'get_study_content_mastery_v1',{
        p_student_id:user.id,
        p_book_id:url.searchParams.get('book_id')||null,
        p_unit_id:url.searchParams.get('unit_id')||null
      });
    }
    const response=json(result,200,origin);
    if(!refreshed) return response;
    const headers=new Headers(response.headers);
    headers.append('Set-Cookie',authCookie('sb_access',encodeURIComponent(refreshed.access_token),Number(refreshed.expires_in)||3600));
    headers.append('Set-Cookie',authCookie('sb_refresh',encodeURIComponent(refreshed.refresh_token),60*60*24*30));
    return new Response(response.body,{status:200,headers});
  }catch(error){
    return json({success:false,error:String(error?.message||error)},500,origin);
  }
}

export default {
  async fetch(request,env,ctx){
    const adaptive=await handleAdaptive(request,env);
    if(adaptive) return adaptive;
    return baseWorker.fetch(request,env,ctx);
  }
};
