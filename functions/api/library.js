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
const cleanFile=f=>{
 const source=str(f.source,160),filename=str(f.filename,300),month=f.month,through=f.through;
 if(!source||!filename||!monthOk(month)||!dateOk(through)||through.slice(0,7)!==month.slice(0,7)||through<month||!Array.isArray(f.rows)||!f.rows.length||f.rows.length>500)fail('Use a report starting on the first of the month and ending within that month.');
 const keys=new Set();const rows=f.rows.map(r=>{const account_key=str(r.account_key,400);if(!account_key||keys.has(account_key)||!uuid.test(r.student_id||''))fail('Duplicate or unmatched account');keys.add(account_key);
 const row={account_key,student_id:r.student_id,account_name:str(r.account_name,300),screen_name:str(r.screen_name,200),login_time:str(r.login_time,100),incentive_time:str(r.incentive_time,100)};for(const k of ['listens','reads','recordings','quiz','interactivity','logins','stars'])row[k]=integer(r[k]);return row});
 return {source,filename,month,through,rows};
};
export async function onRequest({request}){try{
 const url=new URL(request.url),action=url.searchParams.get('action')||'';
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return json({error:'Origin rejected'},403);
 const a=await auth(request);
 if(request.method==='GET'){
 if(action==='setup'){const [students,accounts,hints]=await Promise.all([roster(a),all(a,'library_raz_accounts_v2',{select:'id,source_account,account_key,account_name,screen_name,student_id',order:'id.asc'}),all(a,'library_raz_roster_hints_v2',{select:'student_id,source_account,english_alias',order:'student_id.asc'})]);return json({students,accounts,hints})}
 if(action==='month'){const month=url.searchParams.get('month');if(!monthOk(month))fail('Invalid month');const [results,awards]=await Promise.all([all(a,'library_raz_monthly_v2',{select:'*,library_raz_accounts_v2(student_id,source_account,screen_name,account_name)',month:'eq.'+month,order:'account_id.asc'}),db(a,path('library_reading_awards_v2',{select:'*',month:'eq.'+month}))]);return json({results,awards:awards[0]||null})}
 fail('Unknown action',404);
 }
 if(Number(request.headers.get('Content-Length')||0)>2000000)fail('Upload too large',413);const raw=await request.text();if(raw.length>2000000)fail('Upload too large',413);let b;try{b=JSON.parse(raw)}catch{fail('Invalid JSON')}
 if(action==='import'){if(!Array.isArray(b.files)||!b.files.length||b.files.length>30)fail('Select up to 30 CSV files');const files=b.files.map(cleanFile);return json(await db(a,'rpc/library_import_raz_v2','POST',{p_files:files}))}
 if(action==='awards'){
 if(!monthOk(b.month)||!Array.isArray(b.recipients)||b.recipients.length>500)fail('Invalid award list');
 const rules={gold:integer(b.rules?.gold,1000000),silver:integer(b.rules?.silver,1000000),promote:b.rules?.promote===true};if(rules.gold<rules.silver||rules.silver<1)fail('Gold minimum must be at least Silver; Silver must be positive');
 const [students,results]=await Promise.all([roster(a),all(a,'library_raz_monthly_v2',{select:'account_id,class_name,listens,reads,recordings,library_raz_accounts_v2(student_id)',month:'eq.'+b.month,order:'account_id.asc'})]);
 const people=new Map(students.map(s=>[s.id,s])),byId=new Map();for(const r of results){const id=r.library_raz_accounts_v2?.student_id;if(!id)continue;const list=byId.get(id)||[];list.push(r);byId.set(id,list)}
 const seen=new Set();const recipients=b.recipients.map(r=>{if(!uuid.test(r.student_id||'')||seen.has(r.student_id)||!['Gold','Silver'].includes(r.award))fail('Invalid or duplicate recipient');seen.add(r.student_id);
 const s=people.get(r.student_id);if(!s)fail('Recipient is no longer an active student');const rows=byId.get(s.id)||[];const result=rows.length===1?rows[0]:null;
 return {student_id:s.id,name:s.name||s.korean_name||'Student',korean_name:s.korean_name||'',class_name:result?.class_name||s.class||'',award:r.award,points:result?result.listens+result.reads+3*result.recordings:null}});
 const saved=await db(a,'library_reading_awards_v2?on_conflict=month','POST',{month:b.month,rules,recipients,updated_by:a.id,updated_at:new Date().toISOString()},true);return json({awards:saved[0]});
 }
 fail('Unknown action',404);
 }catch(e){return json({error:e.status?e.message:'Library service unavailable'},e.status||502)}}
