// Staff calendar backend for the existing Teachers Dashboard. Google OAuth is not required.
// Uses the SAME Supabase-auth whoami endpoint the dashboard uses.
// Events stay in the Willena Game Scores database, private to approved staff.
const SUPABASE='https://fiieuiktlsivwfgyivai.supabase.co';
const AUTH='https://api.willenaenglish.com/.netlify/functions/supabase_auth';
const ORIGIN='https://teachers.willenaenglish.com';
const TABLE='willena_staff_events';
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
function dateOk(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s}
async function db(env,path,method='GET',body){const key=env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error('SUPABASE_SERVICE_ROLE_KEY missing in deployment');
 const response=await fetch(SUPABASE+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const result=await response.json().catch(()=>null);if(!response.ok)throw Error('Calendar database request failed ('+response.status+')');return result}
async function authorize(request,env){
 const cookie=request.headers.get('Cookie')||'';
 if(!/(?:^|;\s*)sb_access=/.test(cookie))return {error:'Your Dashboard session cookie is missing. Open the Teachers Dashboard and refresh your login.',status:401};
 // Auth gateway is the same source as the Dashboard, not a separate session system.
 const response=await fetch(AUTH+'?action=whoami',{headers:{Cookie:cookie,Origin:ORIGIN,Accept:'application/json'},redirect:'manual',cache:'no-store'});
 const who=await response.json().catch(()=>({}));
 if(!response.ok||!who.success||!who.user_id)return {error:'Dashboard login could not be verified. Open the Dashboard and retry.',status:401};
 const profile=await db(env,'profiles?select=role,approved&id=eq.'+encodeURIComponent(who.user_id)+'&limit=1');
 const p=profile?.[0];if(p?.approved!==true||!['admin','teacher'].includes(String(p.role||'').toLowerCase()))return {error:'Approved teacher or admin account required',status:403};
 return {id:who.user_id,role:p.role};
}
function clean(body){const title=String(body.title||'').trim(),date=String(body.date||''),time=String(body.time||''),category=String(body.category||'events'),repeat=String(body.repeat||'none'),notes=String(body.notes||'').trim();
 if(!title||title.length>120||!dateOk(date)||(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))||!['events','staff','academic','deadline'].includes(category)||!['none','weekly','monthly'].includes(repeat)||notes.length>1200)throw Error('Invalid event details');
 return {title,event_date:date,event_time:time||null,category,repeat_rule:repeat,notes,updated_at:new Date().toISOString()};
}
export async function onRequest({request,env}){
 try{
  if(new URL(request.url).hostname!=='teachers.willenaenglish.com')return respond({error:'Host not permitted'},403);
  if(!['GET','POST','PATCH','DELETE'].includes(request.method))return respond({error:'Method not allowed'},405);
  if(request.method!=='GET'&&request.headers.get('Origin')!==ORIGIN)return respond({error:'Invalid request origin'},403);
  const user=await authorize(request,env);if(user.error)return respond(user,user.status);
  const url=new URL(request.url);
  if(request.method==='GET'){
   const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
   if(!dateOk(from)||!dateOk(to)||from>to)return respond({error:'Invalid date range'},400);
   // Single events within range plus earlier recurring series.
   const params=new URLSearchParams({select:'id,title,event_date,event_time,category,repeat_rule,notes,created_by,updated_at',event_date:'lte.'+to,order:'event_date.asc',limit:'2000'});
   const rows=await db(env,TABLE+'?'+params);
   const events=rows.filter(e=>(e.repeat_rule!=='none'||e.event_date>=from));
   return respond({success:true,events});
  }
  const body=await request.json().catch(()=>({}));
  if(request.method==='POST'){
   const record={...clean(body),created_by:user.id};
   const rows=await db(env,TABLE,'POST',record);return respond({success:true,event:rows[0]},201);
  }
  const id=String(body.id||'');if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return respond({error:'Invalid event ID'},400);
  if(request.method==='DELETE'){
   const rows=await db(env,TABLE+'?id=eq.'+encodeURIComponent(id),'DELETE');return respond({success:true,deleted:rows.length>0});
  }
  const rows=await db(env,TABLE+'?id=eq.'+encodeURIComponent(id),'PATCH',clean(body));
  if(!rows.length)return respond({error:'Event was deleted; refresh the calendar'},404);
  return respond({success:true,event:rows[0]});
 }catch(error){console.error('native staff calendar',error.message);return respond({error:error.message||'Calendar service unavailable'},502)}
}
