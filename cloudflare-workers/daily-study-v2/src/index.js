const OP_URL='https://fiieuiktlsivwfgyivai.supabase.co';
const OP_ANON_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';

const ALLOWED_ORIGINS=new Set([
  'https://staging.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com'
]);

function cors(origin){
  const allow=ALLOWED_ORIGINS.has(origin)?origin:'https://students.willenaenglish.com';
  return {
    'Access-Control-Allow-Origin':allow,
    'Access-Control-Allow-Credentials':'true',
    'Access-Control-Allow-Headers':'Content-Type, Authorization',
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
    'Cache-Control':'no-store'
  };
}
function json(origin,status,body){return new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8'}});}
function cookies(header){const out={};String(header||'').split(/;\s*/).forEach(part=>{const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1));});return out;}
async function userFromRequest(request){
  const auth=request.headers.get('Authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):cookies(request.headers.get('Cookie')).sb_access;
  if(!token)return null;
  const r=await fetch(`${OP_URL}/auth/v1/user`,{headers:{apikey:OP_ANON_KEY,Authorization:`Bearer ${token}`}});
  if(!r.ok)return null;
  const user=await r.json().catch(()=>null);
  return user&&user.id?user:null;
}
async function rpc(env,name,args){
  if(!env.SUPABASE_SERVICE_KEY)throw new Error('Daily Study worker missing Supabase service key');
  const r=await fetch(`${OP_URL}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{apikey:env.SUPABASE_SERVICE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify(args)
  });
  const text=await r.text();
  let data={};try{data=text?JSON.parse(text):{};}catch(_){data={error:text};}
  if(!r.ok)throw new Error(data.message||data.error||`Supabase RPC ${r.status}`);
  return data;
}
function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''));}

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
    const user=await userFromRequest(request);
    if(!user)return json(origin,401,{success:false,error:'Not signed in'});
    const url=new URL(request.url),date=url.searchParams.get('date');
    if(!validDate(date))return json(origin,400,{success:false,error:'Invalid study date'});
    try{
      if(request.method==='GET'){
        const data=await rpc(env,'get_daily_study_v2',{p_student_id:user.id,p_study_date:date});
        return json(origin,200,data);
      }
      if(request.method==='POST'){
        const body=await request.json().catch(()=>null);
        if(!body||typeof body!=='object')return json(origin,400,{success:false,error:'Invalid JSON'});
        if(body.action==='create'){
          if(!Array.isArray(body.plan))return json(origin,400,{success:false,error:'Plan must be an array'});
          const data=await rpc(env,'create_daily_study_v2',{p_student_id:user.id,p_study_date:date,p_plan:body.plan});
          return json(origin,200,data);
        }
        if(body.action==='answer'){
          const key=String(body.daily_key||'').trim();
          if(!key)return json(origin,400,{success:false,error:'Missing daily key'});
          const data=await rpc(env,'answer_daily_study_v2',{p_student_id:user.id,p_study_date:date,p_daily_key:key,p_correct:!!body.correct});
          return json(origin,200,data);
        }
        return json(origin,400,{success:false,error:'Unknown action'});
      }
      return json(origin,405,{success:false,error:'Method not allowed'});
    }catch(error){
      console.error('[daily-study-v2]',error);
      return json(origin,500,{success:false,error:error.message||'Daily Study server error'});
    }
  }
};
