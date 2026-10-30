// Test Admin API: create/list tests and upsert entries
// Tables (create these in Supabase):
// create table if not exists tests (
//   id uuid primary key default gen_random_uuid(),
//   name text not null,
//   date date,
//   columns jsonb not null,
//   class text,
//   created_by uuid,
//   created_at timestamptz default now()
// );
// create table if not exists test_entries (
//   id uuid primary key default gen_random_uuid(),
//   test_id uuid references tests(id) on delete cascade,
//   user_id uuid references profiles(id) on delete cascade,
//   data jsonb not null,
//   updated_at timestamptz default now(),
//   unique(test_id, user_id)
// );

function makeCorsHeaders(event, extra = {}) {
  const ALLOWLIST = new Set([
    'https://www.willenaenglish.com',
    'https://willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'http://localhost:9000',
    'http://localhost:8888',
  ]);
  const hdrs = event.headers || {};
  const origin = (hdrs.origin || hdrs.Origin || '').trim();
  const allow = ALLOWLIST.has(origin) ? origin : 'https://willenaenglish.netlify.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    ...extra,
  };
}

function respond(event, statusCode, bodyObj, extraHeaders = {}) {
  return { statusCode, headers: { ...makeCorsHeaders(event), 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(bodyObj) };
}

function cookieToken(event) {
  const hdrs = event.headers || {};
  const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
  const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
  return m ? decodeURIComponent(m[1]) : null;
}


// Assessment Period builder. The server owns matching and persists complete
// period snapshots; uploaded spreadsheet data never supplies trusted user IDs.
const ASSESSMENT_SCORE_KEYS=['phonics','listening','vocab','grammar','gw','write','reading','speaking'];
const ASSESSMENT_GRADE_KEYS=['lib_reading','lib_raz','lib_punctuality'];
const ASSESSMENT_LABELS={phonics:'Phonics',listening:'Listening',vocab:'Vocab',grammar:'Grammar',
 gw:'Grammar Writing',write:'Writing',reading:'Reading',speaking:'Speaking'};
function validAssessmentMonth(v){return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v||''));}
function assessmentLabel(v){
 const [year,month]=v.split('-').map(Number);
 const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
 return names[month-1]+' '+year;
}
function assessmentMonthEnd(month){
 const [year,mon]=month.split('-').map(Number);
 return (mon===12?year+1:year)+'-'+String(mon===12?1:mon+1).padStart(2,'0')+'-01';
}
function assessmentKey(s){return String(s||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase();}
function cleanAssessmentMaxima(raw){
 const m={};
 for(const key of ASSESSMENT_SCORE_KEYS){
  const n=raw?.[key];
  if(n===null||n===undefined||String(n).trim()===''){m[key]=null;continue;}
  const value=Number(n);
  if(!Number.isFinite(value)||value<=0||value>10000)throw Error('Invalid maximum for '+key);
  m[key]=value;
 }
 return m;
}
function cleanAssessmentRow(raw,className,rowIndex,mode){
 const englishName=String(raw?.englishName||'').trim().slice(0,120);
 const koreanName=String(raw?.koreanName||'').trim().slice(0,120);
 if(!englishName||!koreanName)throw Error('Missing student name in '+className+' row '+(rowIndex+1));
 const data={};
 for(const key of ASSESSMENT_SCORE_KEYS){
  const v=mode==='copy'?null:raw?.data?.[key];
  if(v===null||v===undefined||String(v).trim()===''){data[key]=null;continue;}
  const value=Number(v);
  if(!Number.isFinite(value)||value<0||value>10000)throw Error('Invalid '+key+' score for '+englishName);
  data[key]=value;
 }
 for(const key of ASSESSMENT_GRADE_KEYS){
  const v=mode==='copy'?null:raw?.data?.[key];
  data[key]=v===null||v===undefined||String(v).trim()===''?null:String(v).trim().slice(0,30);
 }
 return {sheetRow:rowIndex+2,englishName,koreanName,className,
  nextClass:String(raw.nextClass||'').trim().slice(0,100),data,userId:null,matchStatus:'unmatched'};
}
async function prepareAssessmentPeriod(db,body){
 const month=String(body.period||'');
 if(!validAssessmentMonth(month))throw Error('Choose a valid year and month');
 const mode=body.mode;
 if(mode!=='copy'&&mode!=='import')throw Error('Select copy or import');
 const prefix='Assessment Grid | '+assessmentLabel(month)+' | ';
 const existing=await db.from('tests').select('id').gte('date',month+'-01')
  .lt('date',assessmentMonthEnd(month)).like('name',prefix+'%').limit(1);
 if(existing.error)throw Error('Cannot check existing period: '+existing.error.message);
 if(existing.data?.length){const err=Error('Assessment period already exists: '+assessmentLabel(month));err.status=409;throw err;}
 let source;
 if(mode==='copy'){
  const from=String(body.fromPeriod||'');
  if(!validAssessmentMonth(from)||from===month)throw Error('Choose another existing source period');
  const fetched=await db.from('tests').select('id,name,class,columns,date')
   .gte('date',from+'-01').lt('date',assessmentMonthEnd(from)).limit(80);
  if(fetched.error)throw Error('Source period unavailable: '+fetched.error.message);
  const sourcePrefix='Assessment Grid | '+assessmentLabel(from)+' | ';
  source=(fetched.data||[]).filter(t=>t.name?.startsWith(sourcePrefix)).map(t=>{
   const meta=t.columns?.find(c=>c.key==='_source_sheet');
   if(!Array.isArray(meta?.rows))throw Error('Missing source roster for '+t.class);
   const maxima=Object.fromEntries(ASSESSMENT_SCORE_KEYS.map(key=>[key,t.columns?.find(c=>c.key===key)?.max??null]));
   return {className:t.class||t.name.slice(sourcePrefix.length),maxima,rows:meta.rows};
  });
  if(!source.length)throw Error('No classes found in source period');
 }else{
  source=body.classes;
  if(!Array.isArray(source)||!source.length)throw Error('Upload or paste a spreadsheet first');
 }
 if(source.length>40)throw Error('Too many classes (maximum 40)');
 const classes=[],seenNames=new Set();let totalRows=0;
 for(const src of source){
  const className=String(src?.className||'').trim().slice(0,100);
  if(!className||className.includes('|'))throw Error('Invalid class name');
  const classKey=assessmentKey(className);
  if(seenNames.has(classKey))throw Error('Duplicate class: '+className);
  seenNames.add(classKey);
  if(!Array.isArray(src.rows)||src.rows.length<1||src.rows.length>160)throw Error('Invalid roster size in '+className);
  totalRows+=src.rows.length;
  if(totalRows>1500)throw Error('Too many students (maximum 1500)');
  const maxima=cleanAssessmentMaxima(src.maxima);
  const rows=src.rows.map((raw,i)=>cleanAssessmentRow(raw,className,i,mode));
  classes.push({className,maxima,rows});
 }
 const {data:profiles,error:profileError}=await db.from('profiles')
  .select('id,name,korean_name,role').eq('role','student').limit(5000);
 if(profileError)throw Error('Student matching unavailable: '+profileError.message);
 const byKorean=new Map();
 for(const profile of profiles||[]){
  const korean=assessmentKey(profile.korean_name);
  if(!korean)continue;
  if(!byKorean.has(korean))byKorean.set(korean,[]);
  byKorean.get(korean).push(profile);
 }
 const used=new Map(),warnings=[];
 for(const cl of classes)for(const row of cl.rows){
  const candidates=byKorean.get(assessmentKey(row.koreanName))||[];
  const exact=candidates.filter(p=>assessmentKey(p.name)===assessmentKey(row.englishName));
  const match=exact.length===1?exact[0]:candidates.length===1?candidates[0]:null;
  if(match){
   row.userId=match.id;row.matchStatus='matched';
   if(!used.has(match.id))used.set(match.id,[]);
   used.get(match.id).push(row);
  }else if(candidates.length>1){row.matchStatus='ambiguous';}
 }
 for(const hits of used.values())if(hits.length>1){
  for(const row of hits){row.userId=null;row.matchStatus='ambiguous';}
 }
 let matched=0,unmatched=0;
 for(const cl of classes)for(const row of cl.rows){
  if(row.userId)matched++;else unmatched++;
  for(const key of ASSESSMENT_SCORE_KEYS){
   if(row.data[key]!==null&&cl.maxima[key]===null){
    const label=cl.className+' · '+ASSESSMENT_LABELS[key];
    if(!warnings.includes(label))warnings.push(label);
   }
  }
 }
 if(warnings.length)throw Error('Missing maximum marks for: '+warnings.slice(0,12).join(', ')+(warnings.length>12?'…':''));
 return {month,label:assessmentLabel(month),mode,classes,totalRows,matched,unmatched};
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };

  const qs = event.queryStringParameters || {};
  const action = qs.action;

  let createClient;
  try { ({ createClient } = await import('@supabase/supabase-js')); }
  catch { ({ createClient } = require('@supabase/supabase-js')); }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return respond(event, 500, { success:false, error:'Missing env' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const db = admin;

  // Auth
  const access = cookieToken(event);
  if (!access) return respond(event, 401, { success:false, error:'Not signed in' });
  let actorId = null, role = null; let isTeacher=false, isAdmin=false;
  try {
    const { data, error } = await admin.auth.getUser(access);
    if (error || !data?.user) return respond(event, 401, { success:false, error:'Not signed in' });
    actorId = data.user.id;
    const { data: prof } = await db.from('profiles').select('role').eq('id', actorId).single();
    role = String(prof?.role||'').toLowerCase();
    isAdmin = role==='admin'; isTeacher = role==='teacher';
    if (!isAdmin && !isTeacher) return respond(event, 403, { success:false, error:'Forbidden' });
  } catch {
    return respond(event, 401, { success:false, error:'Not signed in' });
  }

  // Helpers to parse body
  function getBody() { try { return JSON.parse(event.body||'{}'); } catch { return {}; } }

  try {
    if (action === 'list_assessment_periods' && event.httpMethod === 'GET') {
      const {data,error}=await db.from('tests').select('date,name')
       .like('name','Assessment Grid | %').order('date',{ascending:false}).limit(1000);
      if(error)return respond(event,400,{success:false,error:error.message});
      const periods=new Map();
      for(const t of data||[]){
        const month=String(t.date||'').slice(0,7);
        if(!validAssessmentMonth(month)||!t.name?.startsWith('Assessment Grid | '+assessmentLabel(month)+' | '))continue;
        if(!periods.has(month))periods.set(month,{value:month,label:assessmentLabel(month),classes:0});
        periods.get(month).classes++;
      }
      return respond(event,200,{success:true,periods:[...periods.values()].sort((a,b)=>b.value.localeCompare(a.value))});
    }

    if ((action === 'preview_assessment_period'||action === 'create_assessment_period') && event.httpMethod === 'POST') {
      // Teacher/admin authorization was already enforced before reaching this action.
      const body=getBody();
      let prepared;
      try{prepared=await prepareAssessmentPeriod(db,body);}
      catch(e){return respond(event,e.status||400,{success:false,error:e.message});}
      if(action==='preview_assessment_period')
        return respond(event,200,{success:true,preview:prepared});
      const date=prepared.month+'-01';
      const records=prepared.classes.map(cl=>({
       name:'Assessment Grid | '+prepared.label+' | '+cl.className,
       date,class:cl.className,created_by:actorId,
       columns:[
        ...ASSESSMENT_SCORE_KEYS.map(key=>({key,label:ASSESSMENT_LABELS[key],type:'number',max:cl.maxima[key]})),
        {key:'_source_sheet',label:'Assessment Grid source',type:'internal_metadata',
         rows:cl.rows.map(({matchStatus,...row})=>row)}
       ]
      }));
      // One multirow INSERT is atomic, backed by a unique (date,name) index.
      const created=await db.from('tests').insert(records).select('id,name,class');
      if(created.error){
        const duplicate=created.error.code==='23505';
        return respond(event,duplicate?409:400,{success:false,error:duplicate?'That assessment period already exists':created.error.message});
      }
      const newTests=created.data||[];
      if(newTests.length!==records.length){
        if(newTests.length)await db.from('tests').delete().in('id',newTests.map(t=>t.id));
        return respond(event,500,{success:false,error:'Could not verify all classes were created. No period was confirmed.'});
      }
      const byClass=new Map(newTests.map(t=>[t.class,t.id]));
      const entries=[];
      for(const cl of prepared.classes)for(const row of cl.rows){
       if(row.userId)entries.push({test_id:byClass.get(cl.className),user_id:row.userId,data:row.data});
      }
      if(entries.length){
       const persisted=await db.from('test_entries').upsert(entries,{onConflict:'test_id,user_id'});
       if(persisted.error){
        const rollback=await db.from('tests').delete().in('id',newTests.map(t=>t.id));
        return respond(event,500,{success:false,error:'Scores could not be saved; '+(rollback.error?'automatic rollback failed. Contact an administrator.':'the new period was rolled back.')});
       }
      }
      return respond(event,200,{success:true,period:prepared.month,
       classes:newTests.length,students:prepared.totalRows,matched:prepared.matched,unmatched:prepared.unmatched});
    }

    if (action === 'create_test' && event.httpMethod === 'POST') {
      const body = getBody();
      const name = (body.name||'').trim();
      const date = body.date || null;
      const columns = Array.isArray(body.columns) ? body.columns : [];
      const klass = (body.class||'').trim() || null;
      if (!name || !columns.length) return respond(event, 400, { success:false, error:'name and columns required' });
      const insert = { name, date, columns, class: klass, created_by: actorId };
      const { data, error } = await db.from('tests').insert(insert).select('*').single();
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true, test: data });
    }

    if (action === 'list_tests' && event.httpMethod === 'GET') {
      const month = (qs.month||'').trim(); // YYYY-MM
      let q = db.from('tests').select('id, name, date, class, created_at').order('created_at', { ascending:false }).limit(200);
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [year, mon] = month.split('-').map(Number);
        if (mon < 1 || mon > 12) return respond(event, 400, { success:false, error:'Invalid month' });
        // Half-open [start, next month) range works for February, June and leap years.
        const start = month + '-01';
        const nextYear = mon === 12 ? year + 1 : year;
        const nextMonth = mon === 12 ? 1 : mon + 1;
        const endExclusive = nextYear + '-' + String(nextMonth).padStart(2, '0') + '-01';
        q = q.gte('date', start).lt('date', endExclusive);
      }
      const { data, error } = await q;
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true, tests: data });
    }

    if (action === 'get_test' && event.httpMethod === 'GET') {
      const id = (qs.test_id||'').trim();
      if (!id) return respond(event, 400, { success:false, error:'test_id required' });
      const { data: test, error } = await db.from('tests').select('*').eq('id', id).single();
      if (error || !test) return respond(event, 404, { success:false, error:'Not found' });
      const { data: entries } = await db.from('test_entries').select('user_id, data').eq('test_id', id);
      return respond(event, 200, { success:true, test, entries: entries||[] });
    }

    if (action === 'upsert_entries' && event.httpMethod === 'POST') {
      const body = getBody();
      const test_id = (body.test_id||'').trim();
      const entries = Array.isArray(body.entries) ? body.entries : [];
      if (!test_id || !entries.length) return respond(event, 400, { success:false, error:'test_id and entries required' });
      // Validate test exists
      const { data: test } = await db.from('tests').select('id').eq('id', test_id).single();
      if (!test) return respond(event, 404, { success:false, error:'Test not found' });

      let upserted = 0; let failed = 0;
      for (const e of entries) {
        const rec = { test_id, user_id: e.user_id, data: e.data, updated_at: new Date().toISOString() };
        const { error } = await db.from('test_entries').upsert(rec, { onConflict:'test_id,user_id' });
        if (error) failed++; else upserted++;
      }
      return respond(event, 200, { success:true, upserted, failed });
    }

    if (action === 'set_assessment_max' && event.httpMethod === 'POST') {
      const body=getBody();
      const id=String(body.test_id||'').trim();
      const key=String(body.skill||'').trim();
      const allowed=['phonics','listening','vocab','grammar','gw','write','reading','speaking'];
      if(!/^[0-9a-f-]{36}$/i.test(id)||!allowed.includes(key))
        return respond(event,400,{success:false,error:'Invalid assessment class or skill'});
      function numericOrNull(value){
        if(value===null)return null;
        if(typeof value!=='number'||!Number.isFinite(value))throw Error('Maximum must be a number or blank');
        return value;
      }
      let next,expected;
      try {
        if(!Object.prototype.hasOwnProperty.call(body,'max')||
           !Object.prototype.hasOwnProperty.call(body,'expected'))
          throw Error('Current and new maxima are required');
        next=numericOrNull(body.max);
        expected=numericOrNull(body.expected);
        if(next!==null&&(next<=0||next>10000))throw Error('Maximum must be between 0 and 10000, or blank');
      }catch(e){return respond(event,400,{success:false,error:e.message});}
      const {data,error}=await db.rpc('assessment_set_skill_max',{
        p_test_id:id,p_skill:key,p_max:next,p_expected:expected
      });
      if(error){
        const conflict=/changed by another teacher/i.test(error.message||'');
        return respond(event,conflict?409:400,{success:false,error:error.message});
      }
      return respond(event,200,{success:true,skill:key,max:data?.max??null,test_id:id});
    }

    if (action === 'update_test' && event.httpMethod === 'POST') {
      const body = getBody();
      const id = (body.test_id||'').trim();
      if (!id) return respond(event, 400, { success:false, error:'test_id required' });
      const patch = {};
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
      if (body.date === null || (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date))) patch.date = body.date;
      if (typeof body.class === 'string') patch.class = body.class.trim() || null;
      if (Array.isArray(body.columns)) patch.columns = body.columns;
      if (!Object.keys(patch).length) return respond(event, 400, { success:false, error:'nothing to update' });
      const { data, error } = await db.from('tests').update(patch).eq('id', id).select('*').single();
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true, test: data });
    }

    if (action === 'delete_test' && event.httpMethod === 'POST') {
      if (!isAdmin) return respond(event, 403, { success:false, error:'Admins only' });
      const body = getBody();
      const id = (body.test_id||'').trim();
      if (!id) return respond(event, 400, { success:false, error:'test_id required' });
      const { error } = await db.from('tests').delete().eq('id', id);
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true });
    }

    return respond(event, 404, { success:false, error:'Action not found' });
  } catch (e) {
    return respond(event, 500, { success:false, error: e?.message || 'Internal error' });
  }
};
