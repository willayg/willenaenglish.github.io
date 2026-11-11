// Website enquiry API. Public create only; every read/write requires a verified admin session.
const { createClient } = require('@supabase/supabase-js');
const ALLOWED = new Set(['https://www.willenaenglish.com','https://willenaenglish.com','https://teachers.willenaenglish.com','https://cf.willenaenglish.com','https://staging.willenaenglish.com','https://willenaenglish.netlify.app','http://localhost:8888']);
const STATUSES = new Set(['new','contacted','consultation','enrolled','closed']);
const TYPES = new Set(['level_test','tuition','classes','other']);
const reply = (event,statusCode,body) => {
 const origin=event.headers?.origin||event.headers?.Origin||'';
 return {statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(ALLOWED.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'}:{})},body:JSON.stringify(body)};
};
const clean=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max+1):'';
const tokenFrom=(event)=>{const raw=event.headers?.cookie||event.headers?.Cookie||'';const m=raw.match(/(?:^|;\s*)sb_access=([^;]+)/);try{return m?decodeURIComponent(m[1]):null}catch{return null}};
exports.handler=async(event)=>{
 const origin=event.headers?.origin||event.headers?.Origin||'';
 if(event.httpMethod==='OPTIONS')return {statusCode:ALLOWED.has(origin)?204:403,headers:{'Access-Control-Allow-Origin':ALLOWED.has(origin)?origin:'null','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'},body:''};
 if(origin&&!ALLOWED.has(origin))return reply(event,403,{success:false,error:'Origin not allowed'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply(event,503,{success:false,error:'Enquiries are temporarily unavailable'});
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
 const action=event.queryStringParameters?.action||'';
 if(action==='submit'&&event.httpMethod==='POST'){
  if((event.body||'').length>12000)return reply(event,413,{success:false,error:'Message is too long'});
  let b;try{b=JSON.parse(event.body||'{}')}catch{return reply(event,400,{success:false,error:'Invalid request'})}
  if(b.website)return reply(event,200,{success:true}); // Honeypot: harmless success.
  const parent_name=clean(b.parent_name,80),student_grade=clean(b.student_grade,40),phone=clean(b.phone,25).replace(/[\s()\-]/g,''),enquiry_type=clean(b.enquiry_type,30),message=clean(b.message,2000);
  if(parent_name.length<2||parent_name.length>80||!/^0\d{8,10}$/.test(phone)||!TYPES.has(enquiry_type)||!student_grade||student_grade.length>40||message.length<5||message.length>2000||b.privacy_consent!==true)
   return reply(event,400,{success:false,error:'Please complete all required fields and agree to privacy collection.'});
  const cutoff=new Date(Date.now()-60*60*1000).toISOString();
  const {count,error:rateErr}=await db.from('website_enquiries').select('id',{count:'exact',head:true}).eq('phone',phone).gte('created_at',cutoff);
  if(rateErr)return reply(event,503,{success:false,error:'Please try again shortly'});
  if(count>=3)return reply(event,429,{success:false,error:'Too many enquiries from this number. Please call the academy.'});
  const {error}=await db.from('website_enquiries').insert({parent_name,student_grade,phone,enquiry_type,message,privacy_consent:true});
  return error?reply(event,503,{success:false,error:'Could not submit. Please call the academy.'}):reply(event,201,{success:true});
 }
 // Admin actions use the academy's existing HttpOnly sb_access cookie.
 const access=tokenFrom(event);
 if(!access)return reply(event,401,{success:false,error:'Admin login required'});
 const {data:who,error:authError}=await db.auth.getUser(access);
 if(authError||!who?.user)return reply(event,401,{success:false,error:'Session expired'});
 const {data:profile,error:roleErr}=await db.from('profiles').select('role').eq('id',who.user.id).single();
 if(roleErr||String(profile?.role||'').toLowerCase()!=='admin')return reply(event,403,{success:false,error:'Admin access only'});
 if(action==='list'&&event.httpMethod==='GET'){
  const status=clean(event.queryStringParameters?.status,30);
  let q=db.from('website_enquiries').select('id,created_at,parent_name,student_grade,phone,enquiry_type,message,status,admin_notes,contacted_at,updated_at').order('created_at',{ascending:false}).limit(300);
  if(STATUSES.has(status))q=q.eq('status',status);
  const {data,error}=await q;
  return error?reply(event,500,{success:false,error:'Could not load enquiries'}):reply(event,200,{success:true,enquiries:data||[]});
 }
 if(action==='update'&&event.httpMethod==='POST'){
  let b;try{b=JSON.parse(event.body||'{}')}catch{return reply(event,400,{success:false,error:'Invalid JSON'})}
  if(!/^[0-9a-f-]{36}$/i.test(String(b.id||'')))return reply(event,400,{success:false,error:'Invalid enquiry'});
  if(!STATUSES.has(b.status)||typeof b.admin_notes!=='string'||b.admin_notes.length>6000)return reply(event,400,{success:false,error:'Invalid status or notes'});
  const changes={status:b.status,admin_notes:b.admin_notes.trim(),updated_at:new Date().toISOString(),updated_by:who.user.id};
  if(b.status==='contacted'||b.status==='consultation')changes.contacted_at=new Date().toISOString();
  const {error}=await db.from('website_enquiries').update(changes).eq('id',b.id);
  return error?reply(event,500,{success:false,error:'Could not save enquiry'}):reply(event,200,{success:true});
 }
 return reply(event,404,{success:false,error:'Unknown action'});
};