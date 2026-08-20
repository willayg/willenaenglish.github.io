const OP_URL='https://fiieuiktlsivwfgyivai.supabase.co';

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
function validTrack(v){return v==='test'?'test':'live';}
function normalizeReward(reward){
  if(!reward||typeof reward!=='object'||!reward.completed||reward.track!=='live')return reward;
  const bonusStars=Math.max(0,Number(reward.streak_bonus_stars)||0);
  const ratingStars=Math.max(3,Number(reward.daily_rating_stars)||0);
  const totalStars=Math.max(ratingStars+bonusStars,Number(reward.today_stars)||0);
  return Object.assign({},reward,{
    minimum_completion_stars:3,
    daily_rating_stars:ratingStars,
    today_stars:totalStars
  });
}
async function attachReward(env,userId,date,track,data){
  try{
    const reward=normalizeReward(await rpc(env,'daily_study_reward_snapshot',{p_student_id:userId,p_study_date:date,p_track:track}));
    return Object.assign({},data||{},{reward});
  }catch(error){
    // Rewards must never make the core Daily Study fail to load or save.
    console.warn('[daily-study-v2] reward snapshot',error&&error.message||error);
    return Object.assign({},data||{},{reward:null});
  }
}

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});

    // Internal-only: the proxy authenticates the real Willena user and supplies
    // this trusted header. The database RPCs themselves are no longer public.
    const userId=String(request.headers.get('X-Willena-Authenticated-User')||'').trim();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)){
      return json(origin,401,{success:false,error:'Not signed in'});
    }

    const url=new URL(request.url);
    const date=url.searchParams.get('date');
    const track=validTrack(url.searchParams.get('track'));
    if(!validDate(date))return json(origin,400,{success:false,error:'Invalid study date'});
    if(track==='test'&&origin!=='https://staging.willenaenglish.com'){
      return json(origin,403,{success:false,error:'Daily Study test mode is staging only'});
    }

    try{
      if(request.method==='GET'){
        const data=await rpc(env,'daily_study_v3_get',{p_student_id:userId,p_study_date:date,p_track:track});
        return json(origin,200,await attachReward(env,userId,date,track,data));
      }
      if(request.method==='POST'){
        const body=await request.json().catch(()=>null);
        if(!body||typeof body!=='object')return json(origin,400,{success:false,error:'Invalid JSON'});

        if(body.action==='test_reset'){
          if(track!=='test'||origin!=='https://staging.willenaenglish.com'){
            return json(origin,403,{success:false,error:'Test reset is staging only'});
          }
          const data=await rpc(env,'reset_daily_study_v3_test',{p_student_id:userId});
          return json(origin,200,await attachReward(env,userId,date,track,data));
        }
        if(body.action==='create'){
          if(!Array.isArray(body.plan))return json(origin,400,{success:false,error:'Plan must be an array'});
          const data=await rpc(env,'daily_study_v3_create',{p_student_id:userId,p_study_date:date,p_plan:body.plan,p_track:track});
          return json(origin,200,await attachReward(env,userId,date,track,data));
        }
        if(body.action==='answer'){
          const key=String(body.daily_key||'').trim();
          if(!key)return json(origin,400,{success:false,error:'Missing daily key'});
          const data=await rpc(env,'daily_study_v3_answer',{p_student_id:userId,p_study_date:date,p_daily_key:key,p_correct:!!body.correct,p_track:track});
          return json(origin,200,await attachReward(env,userId,date,track,data));
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
