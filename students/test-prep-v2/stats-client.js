import {detectForm,isAuthoredWritten,FORMS} from './question-model.js';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const TRACK='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACK_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ACTIVE=['vocabulary','communication','grammar','reading','constructed_response'];
const cache=new Map();

const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
const pct=(n,d)=>d?Math.max(0,Math.min(100,Math.round((Number(n)||0)/(Number(d)||1)*100))):0;
const norm=s=>String(s??'').trim().toLowerCase();
const number=v=>Number.isFinite(Number(v))?Number(v):0;

async function contentGet(path,range=''){
  const headers={apikey:CONTENT_KEY,Authorization:`Bearer ${CONTENT_KEY}`};if(range)headers.Range=range;
  const r=await fetch(CONTENT+path,{headers,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json();
}
async function contentPaged(path){
  const out=[];
  for(let start=0;start<10000;start+=1000){const rows=await contentGet(path,`${start}-${start+999}`);out.push(...rows);if(rows.length<1000)break}
  return out;
}
async function cardStats(planId){
  const t=token();if(!t)return[];
  const r=await fetch(`${TRACK}/rest/v1/rpc/test_prep_card_stats`,{
    method:'POST',headers:{apikey:TRACK_KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json'},
    body:JSON.stringify({p_plan_id:String(planId)}),cache:'no-store'
  });
  if(!r.ok)throw new Error(await r.text());
  const rows=await r.json();return Array.isArray(rows)?rows:[];
}
function statPayload(stat){
  const raw=stat?.attempted_question_ids;
  if(raw&&typeof raw==='object'&&!Array.isArray(raw))return{all:Array.isArray(raw.all)?raw.all:[],byPractice:raw.by_practice&&typeof raw.by_practice==='object'?raw.by_practice:{}};
  return{all:Array.isArray(raw)?raw:[],byPractice:{}};
}
function scopeFor(plan){
  const rows=plan?.group?.scope?.lessons;
  if(Array.isArray(rows)&&rows.length)return rows.filter(x=>x?.lesson);
  return(plan?.units||[]).map(lesson=>({lesson,sections:plan?.practice_types||[]}));
}
async function resolveUnits(plan){
  const scope=scopeFor(plan),map=new Map(scope.filter(x=>x.unit_id).map(x=>[String(x.lesson),String(x.unit_id)]));
  if(map.size===scope.length)return map;
  const books=await contentGet(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(plan?.book_label||'')}&limit=1`),bookId=books?.[0]?.id;
  if(!bookId)return map;
  const units=await contentPaged(`/rest/v1/content_units?select=id,title&book_id=eq.${encodeURIComponent(bookId)}`),byTitle=new Map(units.map(x=>[String(x.title),String(x.id)]));
  for(const row of scope)if(!map.has(String(row.lesson))&&byTitle.has(String(row.lesson)))map.set(String(row.lesson),byTitle.get(String(row.lesson)));
  return map;
}
function emptyAvailable(){return Object.fromEntries(ACTIVE.map(k=>[k,new Set()]));}
async function usableLexicalIds(unitId){
  const occ=await contentPaged(`/rest/v1/source_content_occurrences?select=lexical_entry_id&unit_id=eq.${encodeURIComponent(unitId)}&occurrence_type=eq.lexical_entry&skill=eq.vocabulary`);
  const ids=[...new Set(occ.map(x=>String(x.lexical_entry_id||'')).filter(Boolean))];if(!ids.length)return new Set();
  const rows=[];
  for(let i=0;i<ids.length;i+=100)rows.push(...await contentGet(`/rest/v1/lexical_entries?select=id,canonical_text,translation_ko&id=in.${encodeURIComponent('('+ids.slice(i,i+100).join(',')+')')}`));
  const seen=new Set(),usable=new Set();
  for(const row of rows){const word=norm(row.canonical_text);if(!word||!String(row.translation_ko||'').trim()||seen.has(word))continue;seen.add(word);usable.add(String(row.id))}
  return usable;
}
async function availableForUnit(unitId){
  const available=emptyAvailable();
  const rows=await contentPaged(`/rest/v1/test_prep_questions?select=${encodeURIComponent('id,section,answer_mode,choices,correct_answer,metadata,replacement_needed,student_usable')}&unit_id=eq.${encodeURIComponent(unitId)}&student_usable=eq.true`);
  for(const row of rows){
    if(row.replacement_needed===true)continue;
    const section=norm(row.section),form=detectForm(row),id=String(row.id||'');if(!id)continue;
    if(['communication','grammar','reading'].includes(section)&&[FORMS.choice,FORMS.multi].includes(form))available[section].add(id);
    if(isAuthoredWritten(row)&&[FORMS.write,FORMS.multipart,FORMS.correction].includes(form))available.constructed_response.add(id);
  }
  available.vocabulary=await usableLexicalIds(unitId);
  return available;
}
function currentCompleted(ids,available){
  const unique=new Set((Array.isArray(ids)?ids:[]).map(String));let n=0;
  for(const id of unique)if(available.has(id))n++;
  return n;
}
function fromRpc(stat,total,completed){
  const sample=Math.max(0,number(stat?.recent_count));
  const hasAccuracy=sample>0&&stat?.recent_accuracy!=null;
  return{completed,total,coverage:pct(completed,total),accuracy:hasAccuracy?Math.round(number(stat.recent_accuracy)):0,accuracySample:sample};
}
function aggregatePlan(lessonStats){
  const total=lessonStats.reduce((n,x)=>n+x.total,0),completed=lessonStats.reduce((n,x)=>n+x.completed,0);
  const weighted=lessonStats.filter(x=>x.accuracySample>0),sample=weighted.reduce((n,x)=>n+x.accuracySample,0);
  const accuracy=sample?Math.round(weighted.reduce((n,x)=>n+x.accuracy*x.accuracySample,0)/sample):0;
  return{completed,total,coverage:pct(completed,total),accuracy,accuracySample:sample};
}
export async function loadCardStats(plan,_studentId,{force=false}={}){
  const key=String(plan?.id||'');if(!key)return{plan:fromRpc(null,0,0),lessons:{}};
  if(!force&&cache.has(key))return cache.get(key);
  const promise=(async()=>{
    const scope=scopeFor(plan),unitMap=await resolveUnits(plan),rpcRows=await cardStats(plan.id),rpcByLesson=new Map(rpcRows.map(x=>[String(x.unit_key||''),x])),lessons={};
    for(const row of scope){
      const lesson=String(row.lesson),unitId=unitMap.get(lesson),available=unitId?await availableForUnit(unitId):emptyAvailable(),sections=new Set((row.sections||[]).map(norm)),rpc=rpcByLesson.get(lesson)||null,payload=statPayload(rpc),practices={};
      for(const practice of ACTIVE){
        const set=sections.has(practice)?available[practice]:new Set(),ps=payload.byPractice?.[practice]||null,completed=currentCompleted(ps?.attempted_question_ids,set);
        practices[practice]=fromRpc(ps,set.size,completed);
      }
      const activeStats=ACTIVE.filter(p=>sections.has(p)).map(p=>practices[p]),total=activeStats.reduce((n,x)=>n+x.total,0),completed=activeStats.reduce((n,x)=>n+x.completed,0);
      lessons[lesson]={summary:fromRpc(rpc,total,completed),practices};
    }
    return{plan:aggregatePlan(Object.values(lessons).map(x=>x.summary)),lessons};
  })().catch(e=>{cache.delete(key);throw e});
  cache.set(key,promise);return promise;
}
export function invalidateCardStats(planId){if(planId)cache.delete(String(planId));else cache.clear();}
export function formatCardMetric(stat){return`${number(stat?.completed)} / ${number(stat?.total)} questions`;}
export function formatAccuracy(stat){return stat?.accuracySample?`${stat.accuracy}% accuracy`:'— accuracy';}
export function reviewCounts(plan){
  const s=plan?.summary||{},now=number(s.due_review_count??s.wrong_now??s.review_now),unresolved=number(s.unresolved_wrong);
  const later=unresolved?Math.max(0,unresolved-now):number(s.wrong_later??s.review_later);
  return{now,later,cleared:number(s.corrected??s.cleared_wrong??s.review_cleared)};
}

// Card history uses the same authenticated test_prep_card_stats RPC as v1.
// No browser read of test_prep_attempts exists here.
// Coverage intersects RPC attempted IDs with the current usable content pool.
// Accuracy currently inherits v1's RPC recent window (latest 50 unique questions).
