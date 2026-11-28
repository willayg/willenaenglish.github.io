// Same-origin staff API, using the existing Supabase JWT and staff RLS.
const BASE='https://fiieuiktlsivwfgyivai.supabase.co',KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const dateOk=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const monthOk=s=>dateOk(s)&&s.endsWith('-01');
const str=(s,max)=>{if(typeof s!=='string'||s.length>max)fail('Invalid text field');return s.trim()};
const integer=(n,max=2147483647)=>{if(!Number.isSafeInteger(n)||n<0||n>max)fail('Invalid numeric field');return n};
async function auth(req){
 const tokens=[],cookie=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)sb_access=([^;]+)/);if(cookie)try{tokens.push(decodeURIComponent(cookie[1]))}catch{}
 const bearer=(req.headers.get('Authorization')||'').match(/^Bearer\s+(\S+)$/i);if(bearer&&!tokens.includes(bearer[1]))tokens.push(bearer[1]);
 for(const token of tokens){const headers={apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const u=await fetch(BASE+'/auth/v1/user',{headers,cache:'no-store'});if(!u.ok)continue;const user=await u.json();if(!uuid.test(user.id||''))continue;
 const check=await fetch(BASE+'/rest/v1/rpc/willena_is_approved_staff',{method:'POST',headers,body:'{}',cache:'no-store'});if(!check.ok)fail('Staff permission check unavailable',503);if(await check.json()!==true)fail('Approved staff only',403);return {headers,id:user.id}}
 fail('Teacher login required',401);
}
async function db(a,path,method='GET',body,merge=false){const r=await fetch(BASE+'/rest/v1/'+path,{method,headers:{...a.headers,Prefer:merge?'resolution=merge-duplicates,return=representation':'return=representation'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const data=await r.json().catch(()=>null);if(!r.ok){console.error('library',r.status,data?.code||'');fail(r.status===401||r.status===403?'Staff access denied':'Could not save or load library records ('+r.status+'). Check account links and retry.',r.status===401||r.status===403?r.status:502)}return data}
const path=(t,p)=>t+'?'+new URLSearchParams(p);
async function all(a,t,p){let out=[];for(let offset=0;offset<30000;offset+=500){const rows=await db(a,path(t,{...p,limit:'500',offset:String(offset)}));if(!Array.isArray(rows))fail('Invalid database response',502);out.push(...rows);if(rows.length<500)return out}fail('Too many records',400)}
const roster=a=>all(a,'profiles',{select:'id,name,korean_name,username,class,approved',role:'eq.student',approved:'eq.true',or:'(is_ghost.is.null,is_ghost.eq.false)',order:'class.asc,name.asc,id.asc'});

const TABLE='class_makeups_v1';
const cols='id,student_id,student_name,korean_name,class_name,missed_date,status,makeup_date,makeup_time,notes,completed_at,updated_at';
const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const timeOk=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t);
const statuses=['pending','scheduled','completed','waived'];
function fields(b,missed){
 if(!statuses.includes(b.status))fail('Invalid status');
 const x={status:b.status,notes:str(b.notes??'',1000),makeup_date:null,makeup_time:null,completed_at:null};
 if(['scheduled','completed'].includes(b.status)){
  if(!dateOk(b.makeup_date)||b.makeup_date<missed||!timeOk(b.makeup_time))fail('Choose a valid makeup date and time');
  if(b.status==='completed'&&b.makeup_date>today())fail('Cannot complete a future session');
  x.makeup_date=b.makeup_date;x.makeup_time=b.makeup_time;
  if(b.status==='completed')x.completed_at=new Date().toISOString();
 }
 return x;
}
export async function onRequest({request}){try{
 const u=new URL(request.url),action=u.searchParams.get('action')||'';
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==u.origin)return json({error:'Origin rejected'},403);
 const a=await auth(request);
 if(request.method==='GET'){
  if(action==='list'){const [students,records]=await Promise.all([roster(a),all(a,TABLE,{select:cols,order:'missed_date.desc,id.asc'})]);return json({students,records})}
  fail('Unknown action',404);
 }
 if(Number(request.headers.get('content-length')||0)>10000)fail('Request too large',413);
 const raw=await request.text();if(raw.length>10000)fail('Request too large',413);
 let b;try{b=JSON.parse(raw)}catch{fail('Invalid JSON')};if(!b||typeof b!=='object')fail('Invalid request');
 if(action==='create'){
  if(!uuid.test(b.student_id||'')||!dateOk(b.missed_date)||b.missed_date>today())fail('Choose a student and a valid missed date');
  const [s]=await db(a,path('profiles',{select:'id,name,korean_name,class',id:'eq.'+b.student_id,role:'eq.student',approved:'eq.true',or:'(is_ghost.is.null,is_ghost.eq.false)'}));
  if(!s||!s.class)fail('Student must belong to an active class');
  const same=await db(a,path(TABLE,{select:'id',student_id:'eq.'+s.id,missed_date:'eq.'+b.missed_date,class_name:'eq.'+s.class}));
  if(same.length)fail('This missed class is already recorded',409);
  const row={student_id:s.id,student_name:s.name||s.korean_name||'Unnamed',korean_name:s.korean_name||'',class_name:s.class,missed_date:b.missed_date,...fields(b,b.missed_date)};
  const rows=await db(a,path(TABLE,{select:cols}),'POST',row);return json({record:rows[0]});
 }
 if(action==='update'){
  if(!uuid.test(b.id||'')||typeof b.updated_at!=='string'||isNaN(Date.parse(b.updated_at)))fail('Invalid record');
  const [old]=await db(a,path(TABLE,{select:cols,id:'eq.'+b.id}));if(!old)fail('Record not found',404);
  const patch=fields(b,old.missed_date);if(old.status==='completed'&&patch.status==='completed')patch.completed_at=old.completed_at;
  const rows=await db(a,path(TABLE,{select:cols,id:'eq.'+b.id,updated_at:'eq.'+b.updated_at}),'PATCH',patch);
  if(!rows.length)fail('Changed by another staff member. Refresh and retry.',409);
  return json({record:rows[0]});
 }
 fail('Unknown action',404);
 }catch(e){return json({error:e.status?e.message:'Makeup service unavailable'},e.status||500)}}
