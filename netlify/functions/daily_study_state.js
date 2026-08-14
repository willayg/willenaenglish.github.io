const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function cors(event, extra = {}) {
  const origin = ((event.headers || {}).origin || '').trim();
  const allowed = new Set([
    'https://staging.willenaenglish.com','https://students.willenaenglish.com',
    'https://www.willenaenglish.com','https://willenaenglish.com','https://api.willenaenglish.com'
  ]);
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://staging.willenaenglish.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store',
    ...extra
  };
}
function respond(event,status,body){return{statusCode:status,headers:{...cors(event),'Content-Type':'application/json'},body:JSON.stringify(body)}}
function cookieValue(event,name){const h=((event.headers||{}).cookie||(event.headers||{}).Cookie||'');const m=new RegExp('(?:^|;\\s*)'+name+'=([^;]+)').exec(h);return m?decodeURIComponent(m[1]):null;}
async function userId(event,admin){
  let token=cookieValue(event,'sb_access');
  if(!token){const h=(event.headers||{}).authorization||'';if(h.startsWith('Bearer '))token=h.slice(7);}
  if(!token)return null;
  const {data,error}=await admin.auth.getUser(token);
  return error||!data||!data.user?null:data.user.id;
}
function resolvedCount(state){return Array.isArray(state&&state.completedIds)?state.completedIds.length:Number(state&&state.index||0);}
function stateRank(state){
  if(!state)return -1;
  const resolved=resolvedCount(state);
  const shown=Number(state.shownCount||0);
  const finished=state.finishedAt?1:0;
  return resolved*1000000 + finished*100000 + shown;
}
exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers:cors(event),body:''};
  if(!SUPABASE_URL||!SERVICE_KEY)return respond(event,500,{success:false,error:'Server misconfigured'});
  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});
  const uid=await userId(event,admin);
  if(!uid)return respond(event,401,{success:false,error:'Not signed in'});
  const qs=event.queryStringParameters||{};
  const date=String(qs.date||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return respond(event,400,{success:false,error:'Invalid date'});
  const sessionId=`study-v2-daily:${uid}:${date}`;
  if(event.httpMethod==='GET'){
    const {data,error}=await admin.from('progress_sessions').select('summary,started_at,ended_at').eq('session_id',sessionId).maybeSingle();
    if(error)return respond(event,500,{success:false,error:error.message});
    return respond(event,200,{success:true,session:data&&data.summary?data.summary:null});
  }
  if(event.httpMethod==='POST'){
    let body={};try{body=JSON.parse(event.body||'{}')}catch{return respond(event,400,{success:false,error:'Invalid JSON'})}
    const state=body&&body.session;
    if(!state||typeof state!=='object'||state.date!==date)return respond(event,400,{success:false,error:'Invalid session state'});

    /* Server state is authoritative. Never allow an older browser to reduce a student's progress. */
    const {data:existing,error:readError}=await admin.from('progress_sessions').select('summary').eq('session_id',sessionId).maybeSingle();
    if(readError)return respond(event,500,{success:false,error:readError.message});
    const current=existing&&existing.summary?existing.summary:null;
    if(current&&stateRank(state)<stateRank(current)){
      return respond(event,200,{success:true,accepted:false,reason:'stale_state',resolved_count:resolvedCount(current),session:current});
    }

    const resolved=resolvedCount(state);
    const ended=state.finishedAt?new Date(state.finishedAt).toISOString():null;
    const authoritative={...state,server_saved_at:new Date().toISOString(),resolved_count:resolved};
    const row={session_id:sessionId,user_id:uid,mode:'study-v2-daily',list_name:`daily-study:${date}`,list_size:Number(state.target||20),started_at:state.startedAt?new Date(state.startedAt).toISOString():new Date().toISOString(),ended_at:ended,summary:authoritative};
    const {error}=await admin.from('progress_sessions').upsert(row,{onConflict:'session_id'});
    if(error)return respond(event,500,{success:false,error:error.message});
    return respond(event,200,{success:true,accepted:true,resolved_count:resolved,session:authoritative});
  }
  return respond(event,405,{success:false,error:'Method not allowed'});
};
