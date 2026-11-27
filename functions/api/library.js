// Library dashboard: authenticated same-origin Pages API. All writes use the staff JWT and RLS.
const BASE='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const str=(x,max=1000)=>{if(typeof x!=='string'||x.length>max)fail('Invalid text field');return x.trim()};
async function authenticate(req){
 const tokens=[];const m=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)sb_access=([^;]+)/);if(m)try{tokens.push(decodeURIComponent(m[1]))}catch{}
 const b=(req.headers.get('Authorization')||'').match(/^Bearer\s+(\S+)$/i);if(b&&!tokens.includes(b[1]))tokens.push(b[1]);
 for(const token of tokens){const headers={apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const u=await fetch(BASE+'/auth/v1/user',{headers,cache:'no-store'});if(!u.ok)continue;const person=await u.json();if(!uuid.test(person.id||''))continue;
 const check=await fetch(BASE+'/rest/v1/rpc/willena_is_approved_staff',{method:'POST',headers,body:'{}',cache:'no-store'});if(!check.ok)fail('Staff permission check unavailable',503);if(await check.json()!==true)fail('Approved staff only',403);return {headers,id:person.id}}
 fail('Teacher login required',401);
}
async function db(auth,path,method='GET',body,merge=false){
 const r=await fetch(BASE+'/rest/v1/'+path,{method,headers:{...auth.headers,Prefer:merge?'resolution=merge-duplicates,return=representation':'return=representation'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await r.json().catch(()=>null);if(!r.ok){console.error('library db',r.status,data?.code||'');fail(r.status===409?'Record conflict; refresh and review':r.status===401||r.status===403?'Staff access denied':'Library database request failed ('+r.status+')',r.status===401||r.status===403? r.status : 502)}return data;
}
const path=(table,params)=>table+'?'+new URLSearchParams(params);
async function all(auth,table,params){const out=[];for(let offset=0;offset<30000;offset+=500){const rows=await db(auth,path(table,{...params,limit:'500',offset:String(offset)}));if(!Array.isArray(rows))fail('Invalid database response',502);out.push(...rows);if(rows.length<500)return out}fail('Too many records; narrow the period',400)}
async function roster(auth){return all(auth,'profiles',{select:'id,name,korean_name,username,class,grade,approved',role:'eq.student',or:'(is_ghost.is.null,is_ghost.eq.false)',order:'class.asc,name.asc,id.asc'})}
const checkStudent=async(auth,id)=>{if(!uuid.test(id||''))fail('Invalid student');const rows=await db(auth,path('profiles',{select:'id,class',id:'eq.'+id,role:'eq.student',or:'(is_ghost.is.null,is_ghost.eq.false)'}));if(!rows.length)fail('Student not found');return rows[0]};
export async function onRequest({request}){
 try{
 const url=new URL(request.url),action=url.searchParams.get('action')||'';
 if(!['GET','POST'].includes(request.method))return response({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return response({error:'Origin rejected'},403);
 const auth=await authenticate(request);
 if(request.method==='GET'){
 if(action==='roster')return response({students:await roster(auth)});
 if(action==='accounts')return response({accounts:await all(auth,'library_raz_accounts_v1',{select:'id,source_account,account_key,account_name,screen_name,student_id',order:'id.asc'})});
 if(action==='resources')return response({resources:await all(auth,'library_resources_v1',{select:'*',order:'kind.asc,title.asc,id.asc'})});
 if(action==='period'){
 const from=url.searchParams.get('from'),to=url.searchParams.get('to');
 if(!validDate(from)||!validDate(to)||to<from||(Date.parse(to)-Date.parse(from))/86400000>366)fail('Invalid date range');
 const [daily,usage,prizes]=await Promise.all([
 all(auth,'library_daily_v1',{select:'*',day:'gte.'+from,and:'(day.lte.'+to+')',order:'day.asc,student_id.asc'}),
 all(auth,'library_raz_usage_v1',{select:'*,library_raz_accounts_v1(student_id,source_account,screen_name)',date_from:'gte.'+from,date_to:'lte.'+to,order:'date_from.asc,date_to.asc,account_id.asc'}),
 all(auth,'library_prizes_v1',{select:'*',month:'gte.'+from.slice(0,7)+'-01',and:'(month.lte.'+to.slice(0,7)+'-01)',order:'month.asc,class_name.asc,award.asc'})
 ]);return response({daily,usage,prizes});
 }fail('Unknown action',404);
 }
 if(Number(request.headers.get('Content-Length')||0)>2000000)fail('Request too large',413);
 const raw=await request.text();if(raw.length>2000000)fail('Request too large',413);let b;try{b=JSON.parse(raw)}catch{fail('Invalid JSON')}
 const audit={updated_by:auth.id,updated_at:new Date().toISOString()};
 if(action==='daily'){
 const st=await checkStudent(auth,b.student_id);if(!validDate(b.day))fail('Invalid date');
 const attendance=str(b.attendance,20);if(!['unmarked','present','L','LL','LLL','absent','exception','other'].includes(attendance))fail('Invalid attendance');
 const row={student_id:st.id,day:b.day,class_name:str(b.class_name||st.class||'',100),attendance,attendance_note:str(b.attendance_note||'',1000),books:str(b.books||'',2000),journal:str(b.journal||'',1000),...audit};
 return response({record:(await db(auth,'library_daily_v1?on_conflict=student_id,day','POST',row,true))[0]});
 }
 if(action==='import'){
 if(!validDate(b.from)||!validDate(b.to)||b.to<b.from||(Date.parse(b.to)-Date.parse(b.from))/86400000>366)fail('Invalid import dates');
 const source=str(b.source,160),filename=str(b.filename,300);if(!source||!Array.isArray(b.rows)||!b.rows.length||b.rows.length>500)fail('Select a source account and matched rows');
 const seen=new Set();const rows=b.rows.map(r=>{if(!uuid.test(r.student_id||''))fail('Unmatched student');const key=str(r.account_key,400);if(!key||seen.has(key))fail('Duplicate account in file');seen.add(key);
 const out={student_id:r.student_id,account_key:key,account_name:str(r.account_name,300),screen_name:str(r.screen_name,200),login_time:str(r.login_time,100),incentive_time:str(r.incentive_time,100)};
 for(const k of ['listens','reads','quiz','interactivity','recordings','logins','stars']){if(!Number.isSafeInteger(r[k])||r[k]<0||r[k]>2147483647)fail('Invalid metric');out[k]=r[k]}return out});
 const count=await db(auth,'rpc/library_import_raz_v1','POST',{p_source:source,p_from:b.from,p_to:b.to,p_filename:filename,p_rows:rows});return response({imported:count});
 }
 if(action==='resource'){
 const title=str(b.title,300),kind=str(b.kind,30),link=str(b.url||'',2000);if(!title||!['catalogue','cinema'].includes(kind)||b.day&&!validDate(b.day)||link&&!/^https?:\/\//i.test(link))fail('Invalid resource');
 const row={title,kind,series:str(b.series||'',300),level:str(b.level||'',100),url:link,day:b.day||null,notes:str(b.notes||'',2000),...audit};
 if(b.id){if(!uuid.test(b.id))fail('Invalid resource ID');return response({resource:(await db(auth,path('library_resources_v1',{id:'eq.'+b.id}),'PATCH',row))[0]})}
 return response({resource:(await db(auth,'library_resources_v1','POST',row))[0]});
 }
 if(action==='prize'){
 const st=await checkStudent(auth,b.student_id);if(!validDate(b.month)||!b.month.endsWith('-01')||!['Gold','Silver'].includes(b.award))fail('Invalid prize');
 const row={month:b.month,class_name:str(b.class_name||st.class||'',100),award:b.award,student_id:st.id,notes:str(b.notes||'',1000),...audit};
 return response({prize:(await db(auth,'library_prizes_v1?on_conflict=month,class_name,award','POST',row,true))[0]});
 }fail('Unknown action',404);
 }catch(e){return response({error:e.status?e.message:'Library service unavailable'},e.status||502)}
}
