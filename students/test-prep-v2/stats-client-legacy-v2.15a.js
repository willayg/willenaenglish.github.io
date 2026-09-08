import {detectForm,isAuthoredWritten,FORMS} from './question-model.js';
import {loadVocabularyTestAvailableIds} from './vocab-test-source.js?v=2.14.0';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const TRACK='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACK_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ACTIVE=['vocabulary','vocab_test','communication','grammar','reading','constructed_response'];
const UNIT_CACHE_PREFIX='willena_tp_v2_unit_available_v2:';
const UNIT_CACHE_TTL=15*60*1000;
const cache=new Map();
const unitCache=new Map();
const unitMapCache=new Map();
const diag={unitCacheHits:0,unitCacheMisses:0,unitLoads:0};

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
function sectionsFor(row){const sections=new Set((row?.sections||[]).map(norm));if(sections.has('vocabulary'))sections.add('vocab_test');return sections}
async function resolveUnits(plan){
  const scope=scopeFor(plan),map=new Map(scope.filter(x=>x.unit_id).map(x=>[String(x.lesson),String(x.unit_id)]));
  if(map.size===scope.length)return map;
  const bookKey=String(plan?.book_label||'');
  if(unitMapCache.has(bookKey)){
    const cached=unitMapCache.get(bookKey);for(const row of scope)if(!map.has(String(row.lesson))&&cached.has(String(row.lesson)))map.set(String(row.lesson),cached.get(String(row.lesson)));return map;
  }
  const books=await contentGet(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(bookKey)}&limit=1`),bookId=books?.[0]?.id;
  if(!bookId)return map;
  const units=await contentPaged(`/rest/v1/content_units?select=id,title&book_id=eq.${encodeURIComponent(bookId)}`),byTitle=new Map(units.map(x=>[String(x.title),String(x.id)]));
  unitMapCache.set(bookKey,byTitle);
  for(const row of scope)if(!map.has(String(row.lesson))&&byTitle.has(String(row.lesson)))map.set(String(row.lesson),byTitle.get(String(row.lesson)));
  return map;
}
function emptyAvailable(){return Object.fromEntries(ACTIVE.map(k=>[k,new Set()]));}
function serializeAvailable(available){return Object.fromEntries(ACTIVE.map(k=>[k,[...(available?.[k]||[])]]));}
function hydrateAvailable(raw){const out=emptyAvailable();for(const k of ACTIVE)out[k]=new Set(Array.isArray(raw?.[k])?raw[k].map(String):[]);return out}
function readUnitStorage(unitId){
  try{
    const raw=JSON.parse(localStorage.getItem(UNIT_CACHE_PREFIX+unitId)||'null');
    if(!raw||!raw.savedAt||Date.now()-Number(raw.savedAt)>UNIT_CACHE_TTL)return null;
    return hydrateAvailable(raw.available);
  }catch(_){return null}
}
function writeUnitStorage(unitId,available){try{localStorage.setItem(UNIT_CACHE_PREFIX+unitId,JSON.stringify({savedAt:Date.now(),available:serializeAvailable(available)}))}catch(_){}}
async function usableLexicalIds(unitId){
  const occ=await contentPaged(`/rest/v1/source_content_occurrences?select=lexical_entry_id&unit_id=eq.${encodeURIComponent(unitId)}&occurrence_type=eq.lexical_entry&skill=eq.vocabulary`);
  const ids=[...new Set(occ.map(x=>String(x.lexical_entry_id||'')).filter(Boolean))];if(!ids.length)return new Set();
  const rows=[];
  for(let i=0;i<ids.length;i+=100)rows.push(...await contentGet(`/rest/v1/lexical_entries?select=id,canonical_text,translation_ko&id=in.${encodeURIComponent('('+ids.slice(i,i+100).join(',')+')')}`));
  const seen=new Set(),usable=new Set();
  for(const row of rows){const word=norm(row.canonical_text);if(!word||!String(row.translation_ko||'').trim()||seen.has(word))continue;seen.add(word);usable.add(String(row.id))}
  return usable;
}
async function buildAvailableForUnit(unitId){
  diag.unitLoads++;
  const available=emptyAvailable();
  const [rows,vocabulary,vocabTestRaw]=await Promise.all([
    contentPaged(`/rest/v1/test_prep_questions?select=${encodeURIComponent('id,section,answer_mode,choices,correct_answer,metadata,replacement_needed,student_usable')}&unit_id=eq.${encodeURIComponent(unitId)}&student_usable=eq.true`),
    usableLexicalIds(unitId),
    loadVocabularyTestAvailableIds(unitId)
  ]);
  for(const row of rows){
    if(row.replacement_needed===true)continue;
    const section=norm(row.section),form=detectForm(row),id=String(row.id||'');if(!id)continue;
    if(['communication','grammar','reading'].includes(section)&&[FORMS.choice,FORMS.multi].includes(form))available[section].add(id);
    if(isAuthoredWritten(row)&&[FORMS.write,FORMS.multipart,FORMS.correction].includes(form))available.constructed_response.add(id);
  }
  available.vocabulary=vocabulary;
  available.vocab_test=vocabTestRaw instanceof Set?vocabTestRaw:new Set((vocabTestRaw||[]).map(String));
  writeUnitStorage(unitId,available);
  return available;
}
async function availableForUnit(unitId){
  const key=String(unitId||'');if(!key)return emptyAvailable();
  if(unitCache.has(key)){diag.unitCacheHits++;return unitCache.get(key)}
  const stored=readUnitStorage(key);
  if(stored){diag.unitCacheHits++;unitCache.set(key,Promise.resolve(stored));return stored}
  diag.unitCacheMisses++;
  const promise=buildAvailableForUnit(key).catch(e=>{unitCache.delete(key);throw e});
  unitCache.set(key,promise);return promise;
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
    const scope=scopeFor(plan);
    const [unitMap,rpcRows]=await Promise.all([resolveUnits(plan),cardStats(plan.id)]);
    const rpcByLesson=new Map(rpcRows.map(x=>[String(x.unit_key||''),x]));
    const lessonPairs=await Promise.all(scope.map(async row=>{
      const lesson=String(row.lesson),unitId=unitMap.get(lesson),available=unitId?await availableForUnit(unitId):emptyAvailable(),sections=sectionsFor(row),rpc=rpcByLesson.get(lesson)||null,payload=statPayload(rpc),practices={};
      for(const practice of ACTIVE){
        const set=sections.has(practice)?available[practice]:new Set(),ps=payload.byPractice?.[practice]||null,completed=currentCompleted(ps?.attempted_question_ids,set);
        practices[practice]=fromRpc(ps,set.size,completed);
      }
      const activeStats=ACTIVE.filter(p=>sections.has(p)).map(p=>practices[p]),total=activeStats.reduce((n,x)=>n+x.total,0),completed=activeStats.reduce((n,x)=>n+x.completed,0);
      return[lesson,{summary:fromRpc(rpc,total,completed),practices}];
    }));
    const lessons=Object.fromEntries(lessonPairs);
    return{plan:aggregatePlan(Object.values(lessons).map(x=>x.summary)),lessons};
  })().catch(e=>{cache.delete(key);throw e});
  cache.set(key,promise);return promise;
}
export function invalidateCardStats(planId){if(planId)cache.delete(String(planId));else cache.clear();}
export function getStatsDiagnostics(){return{...diag,unitCacheEntries:unitCache.size,planCacheEntries:cache.size};}
export function formatCardMetric(stat){return`${number(stat?.completed)} / ${number(stat?.total)} questions`;}
export function formatAccuracy(stat){return stat?.accuracySample?`${stat.accuracy}% accuracy`:'— accuracy';}
export function reviewCounts(plan){
  const s=plan?.summary||{},now=number(s.due_review_count??s.wrong_now??s.review_now),unresolved=number(s.unresolved_wrong);
  const later=unresolved?Math.max(0,unresolved-now):number(s.wrong_later??s.review_later);
  return{now,later,cleared:number(s.corrected??s.cleared_wrong??s.review_cleared)};
}

// Snapshot of the pre-canonical v2.15a stats client. Keep for rollback only.
