// Native Willena Staff Calendar — Supabase RLS is the authority.
// Authenticate with the same sb_access cookie used by the Teachers Dashboard.
// No Google OAuth, service-role secret, or extra API gateway dependency.
const SUPABASE='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ORIGIN='https://teachers.willenaenglish.com';
const TABLE='willena_staff_events';
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
function dateOk(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s}
function getTokens(req){
 const candidates=[],match=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)sb_access=([^;]+)/);
 if(match)try{candidates.push(decodeURIComponent(match[1]))}catch{}
 const bearer=(req.headers.get('Authorization')||'').match(/^Bearer\s+(\S+)$/i);
 if(bearer&&!candidates.includes(bearer[1]))candidates.push(bearer[1]);
 return candidates;
}
async function staffToken(req){
 const candidates=getTokens(req);
 for(const token of candidates){
  const res=await fetch(SUPABASE+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+token},cache:'no-store'});
  if(!res.ok)continue;
  const person=await res.json().catch(()=>({}));if(!person.id)continue;
  const check=await fetch(SUPABASE+'/rest/v1/rpc/willena_is_approved_staff',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
  if(!check.ok)throw new Error('Staff permissions check unavailable ('+check.status+')');
  const permitted=await check.json().catch(()=>false);
  if(permitted!==true)return {error:'Approved Willena teacher or admin access required',status:403};
  return {token,id:person.id};
 }
 return {error:'Dashboard session could not be verified. Refresh the Dashboard login.',status:401};
}
async function db(token,path,method='GET',body){
 const response=await fetch(SUPABASE+'/rest/v1/'+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const result=await response.json().catch(()=>null);
 if(!response.ok){
  if(response.status===401||response.status===403)throw Object.assign(new Error('Your teacher session cannot access the calendar'),{status:response.status});
  console.error('staff-calendar database',response.status,result?.code||'');
  throw Object.assign(new Error('Calendar database request failed ('+response.status+')'),{status:502});
 }
 return result;
}
function clean(body){
 const title=String(body.title||'').trim(),date=String(body.date||''),time=String(body.time||''),category=String(body.category||'events'),repeat=String(body.repeat||'none'),notes=String(body.notes||'').trim();
 if(!title||title.length>120||!dateOk(date)||(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))||!['events','staff','academic','deadline'].includes(category)||!['none','weekly','monthly'].includes(repeat)||notes.length>1200)throw Object.assign(new Error('Invalid event details'),{status:400});
 return {title,event_date:date,event_time:time||null,category,repeat_rule:repeat,notes,updated_at:new Date().toISOString()};
}
export async function onRequest({request}){
 try{
  const url=new URL(request.url);
  if(url.hostname!=='teachers.willenaenglish.com')return respond({error:'Host not permitted'},403);
  if(!['GET','POST','PATCH','DELETE'].includes(request.method))return respond({error:'Method not allowed'},405);
  if(request.method!=='GET'&&request.headers.get('Origin')!==ORIGIN)return respond({error:'Invalid request origin'},403);
  const staff=await staffToken(request);if(staff.error)return respond(staff,staff.status);
  if(request.method==='GET'){
   const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
   if(!dateOk(from)||!dateOk(to)||from>to)return respond({error:'Invalid date range'},400);
   const params=new URLSearchParams({select:'id,title,event_date,event_time,category,repeat_rule,notes,created_by,updated_at',event_date:'lte.'+to,order:'event_date.asc',limit:'2000'});
   const rows=await db(staff.token,TABLE+'?'+params);
   const events=rows.filter(e=>e.repeat_rule!=='none'||e.event_date>=from);
   return respond({success:true,events});
  }
  const body=await request.json().catch(()=>({}));
  if(request.method==='POST'){
   const rows=await db(staff.token,TABLE,'POST',{...clean(body),created_by:staff.id});
   return respond({success:true,event:rows[0]},201);
  }
  const id=String(body.id||'');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return respond({error:'Invalid event ID'},400);
  if(request.method==='DELETE'){
   const rows=await db(staff.token,TABLE+'?id=eq.'+encodeURIComponent(id),'DELETE');
   return respond({success:true,deleted:rows.length>0});
  }
  const rows=await db(staff.token,TABLE+'?id=eq.'+encodeURIComponent(id),'PATCH',clean(body));
  if(!rows.length)return respond({error:'Event not found; refresh the calendar'},404);
  return respond({success:true,event:rows[0]});
 }catch(err){console.error('native calendar',err.message);return respond({error:err.message||'Calendar service unavailable'},err.status||502)}
}
