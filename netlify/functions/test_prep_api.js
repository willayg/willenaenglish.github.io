const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }) : null;

function cors(event) {
  const allow = new Set([
    'https://www.willenaenglish.com','https://willenaenglish.com','https://staging.willenaenglish.com',
    'https://students.willenaenglish.com','https://api.willenaenglish.com','https://willenaenglish.netlify.app',
    'http://localhost:8888','http://localhost:9000'
  ]);
  const origin = String(event?.headers?.origin || event?.headers?.Origin || '').trim();
  return {
    'Access-Control-Allow-Origin': allow.has(origin) ? origin : 'https://willenaenglish.netlify.app',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
}
function out(event,status,body){ return { statusCode:status, headers:cors(event), body:JSON.stringify(body) }; }
function parseCookie(event,name){
  const raw=event?.headers?.cookie || event?.headers?.Cookie || '';
  const m=new RegExp('(?:^|;\\s*)'+name+'=([^;]+)').exec(raw);
  return m ? decodeURIComponent(m[1]) : null;
}
async function currentUser(event){
  if(!supabase) return null;
  const token=parseCookie(event,'sb_access');
  if(!token) return null;
  const {data,error}=await supabase.auth.getUser(token);
  if(error || !data?.user) return null;
  const {data:profile}=await supabase.from('profiles').select('id,role,approved,name,korean_name,username,class,grade,school').eq('id',data.user.id).maybeSingle();
  if(!profile?.approved) return null;
  return profile;
}
function bodyOf(event){ try{return JSON.parse(event.body||'{}')}catch{return{}} }
function isTeacher(u){ return ['teacher','admin'].includes(String(u?.role||'').toLowerCase()); }

async function studentDashboard(user){
  const {data:plans,error}=await supabase.from('test_prep_plans').select('*').eq('student_id',user.id).eq('active',true).order('exam_date',{ascending:true,nullsFirst:false});
  if(error) throw error;
  const planIds=(plans||[]).map(x=>x.id);
  let sessions=[];
  if(planIds.length){
    const r=await supabase.from('test_prep_sessions').select('*').eq('student_id',user.id).in('plan_id',planIds).order('started_at',{ascending:false}).limit(100);
    if(r.error) throw r.error; sessions=r.data||[];
  }
  return {plans:plans||[],sessions};
}

async function teacherRoster(){
  const {data:plans,error}=await supabase.from('test_prep_plans').select('*').eq('active',true).order('exam_date',{ascending:true,nullsFirst:false});
  if(error) throw error;
  const studentIds=[...new Set((plans||[]).map(x=>x.student_id))];
  let profiles=[];
  if(studentIds.length){
    const p=await supabase.from('profiles').select('id,name,korean_name,username,class,grade,school').in('id',studentIds);
    if(p.error) throw p.error; profiles=p.data||[];
  }
  let sessions=[];
  if(studentIds.length){
    const s=await supabase.from('test_prep_sessions').select('id,student_id,plan_id,practice_type,started_at,completed_at,question_count,correct_count').in('student_id',studentIds).order('started_at',{ascending:false}).limit(1500);
    if(s.error) throw s.error; sessions=s.data||[];
  }
  const byProfile=new Map(profiles.map(p=>[p.id,p]));
  const rows=(plans||[]).map(plan=>{
    const ss=sessions.filter(s=>s.plan_id===plan.id);
    const attempted=ss.reduce((n,s)=>n+(Number(s.question_count)||0),0);
    const correct=ss.reduce((n,s)=>n+(Number(s.correct_count)||0),0);
    const completedSessions=ss.filter(s=>s.completed_at).length;
    const target=Math.max(1,Number(plan.question_target)||30);
    return {
      plan,
      student:byProfile.get(plan.student_id)||{id:plan.student_id},
      stats:{
        sessions:ss.length,completed_sessions:completedSessions,questions:attempted,correct,
        accuracy:attempted?Math.round(correct/attempted*100):null,
        progress:Math.min(100,Math.round(attempted/target*100)),
        last_study:ss[0]?.started_at||null
      }
    };
  });
  return rows;
}

exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers:cors(event),body:''};
  if(!supabase) return out(event,500,{success:false,error:'Missing Supabase server configuration'});
  try{
    const user=await currentUser(event);
    if(!user) return out(event,401,{success:false,error:'Not signed in'});
    const qs=event.queryStringParameters||{};
    const action=qs.action||'';

    if(action==='me') return out(event,200,{success:true,user,...await studentDashboard(user)});

    if(action==='teacher_roster'){
      if(!isTeacher(user)) return out(event,403,{success:false,error:'Teacher access required'});
      return out(event,200,{success:true,rows:await teacherRoster()});
    }

    if(action==='students'){
      if(!isTeacher(user)) return out(event,403,{success:false,error:'Teacher access required'});
      const {data,error}=await supabase.from('profiles').select('id,name,korean_name,username,class,grade,school').eq('role','student').eq('approved',true).order('class').order('korean_name');
      if(error) throw error;
      return out(event,200,{success:true,students:data||[]});
    }

    if(action==='create_plans' && event.httpMethod==='POST'){
      if(!isTeacher(user)) return out(event,403,{success:false,error:'Teacher access required'});
      const b=bodyOf(event);
      const ids=Array.isArray(b.student_ids)?[...new Set(b.student_ids.filter(Boolean))]:[];
      if(!ids.length) return out(event,400,{success:false,error:'Choose at least one student'});
      if(!b.book_key || !b.book_label) return out(event,400,{success:false,error:'Book is required'});
      const rows=ids.map(student_id=>({
        student_id,created_by:user.id,book_key:String(b.book_key),book_label:String(b.book_label),
        units:Array.isArray(b.units)?b.units.map(String):[],
        practice_types:Array.isArray(b.practice_types)&&b.practice_types.length?b.practice_types.map(String):['communication','grammar','reading'],
        start_date:b.start_date||new Date().toISOString().slice(0,10),exam_date:b.exam_date||null,
        exam_name:b.exam_name?String(b.exam_name):null,question_target:Math.max(1,Math.min(500,Number(b.question_target)||30)),active:true
      }));
      const {data,error}=await supabase.from('test_prep_plans').insert(rows).select();
      if(error) throw error;
      return out(event,200,{success:true,plans:data||[]});
    }

    if(action==='set_plan_active' && event.httpMethod==='POST'){
      if(!isTeacher(user)) return out(event,403,{success:false,error:'Teacher access required'});
      const b=bodyOf(event); if(!b.plan_id) return out(event,400,{success:false,error:'plan_id required'});
      const {error}=await supabase.from('test_prep_plans').update({active:!!b.active,updated_at:new Date().toISOString()}).eq('id',b.plan_id);
      if(error) throw error;
      return out(event,200,{success:true});
    }

    if(action==='start_session' && event.httpMethod==='POST'){
      const b=bodyOf(event);
      let plan=null;
      if(b.plan_id){
        const r=await supabase.from('test_prep_plans').select('*').eq('id',b.plan_id).eq('student_id',user.id).eq('active',true).maybeSingle();
        if(r.error) throw r.error; plan=r.data;
      }
      if(!plan){
        const r=await supabase.from('test_prep_plans').select('*').eq('student_id',user.id).eq('active',true).order('exam_date',{ascending:true,nullsFirst:false}).limit(1).maybeSingle();
        if(r.error) throw r.error; plan=r.data;
      }
      if(!plan) return out(event,403,{success:false,error:'No active 내신 plan'});
      const practice=String(b.practice_type||'reading').toLowerCase();
      if(Array.isArray(plan.practice_types)&&plan.practice_types.length&&!plan.practice_types.includes(practice)) return out(event,403,{success:false,error:'Practice type is not assigned'});
      const {data,error}=await supabase.from('test_prep_sessions').insert({student_id:user.id,plan_id:plan.id,book_key:plan.book_key,unit_key:b.unit_key||plan.units?.[0]||null,practice_type:practice,metadata:{source:'test-prep-web'}}).select().single();
      if(error) throw error;
      return out(event,200,{success:true,session:data,plan});
    }

    if(action==='attempt' && event.httpMethod==='POST'){
      const b=bodyOf(event); if(!b.session_id||!b.question_id) return out(event,400,{success:false,error:'Missing session/question'});
      const {data:s,error:se}=await supabase.from('test_prep_sessions').select('id,student_id,practice_type').eq('id',b.session_id).eq('student_id',user.id).maybeSingle();
      if(se) throw se; if(!s) return out(event,403,{success:false,error:'Session not owned by student'});
      const {error}=await supabase.from('test_prep_attempts').insert({session_id:s.id,student_id:user.id,question_id:b.question_id,practice_type:s.practice_type,selected_answer:b.selected_answer??null,correct_answer_snapshot:b.correct_answer??null,is_correct:!!b.is_correct,metadata:b.metadata&&typeof b.metadata==='object'?b.metadata:{}});
      if(error) throw error;
      return out(event,200,{success:true});
    }

    if(action==='complete_session' && event.httpMethod==='POST'){
      const b=bodyOf(event); if(!b.session_id) return out(event,400,{success:false,error:'session_id required'});
      const {error}=await supabase.from('test_prep_sessions').update({completed_at:new Date().toISOString(),question_count:Math.max(0,Number(b.question_count)||0),correct_count:Math.max(0,Number(b.correct_count)||0),metadata:{source:'test-prep-web',wrong_ids:Array.isArray(b.wrong_ids)?b.wrong_ids:[]}}).eq('id',b.session_id).eq('student_id',user.id);
      if(error) throw error;
      return out(event,200,{success:true});
    }

    return out(event,404,{success:false,error:'Unknown action'});
  }catch(e){
    console.error('[test_prep_api]',e);
    return out(event,500,{success:false,error:e?.message||'Server error'});
  }
};
