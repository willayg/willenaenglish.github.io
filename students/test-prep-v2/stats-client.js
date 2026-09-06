import {detectForm,isAuthoredWritten,FORMS} from './question-model.js';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const ACTIVE=['vocabulary','communication','grammar','reading','constructed_response'];
const cache=new Map();

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
function backendLatest(plan,lesson,practice){
  const raw=plan?.summary?.by_lesson_practice?.[`${lesson}||${practice}`]?.latest_results;
  return Array.isArray(raw)?raw:[];
}
function currentStates(plan,lesson,practice,available){
  return backendLatest(plan,lesson,practice)
    .filter(x=>available.has(String(x?.question_id||'')))
    .map(x=>({id:String(x.question_id),correct:!!x.is_correct,at:Date.parse(x.attempted_at||0)||0}));
}
function summarize(states,total){
  const recent=[...states].sort((a,b)=>b.at-a.at).slice(0,40),correct=recent.filter(x=>x.correct).length,completed=states.length;
  return{completed,total,coverage:pct(completed,total),accuracy:recent.length?pct(correct,recent.length):0,accuracySample:recent.length,currentCorrect:correct};
}
function aggregate(stats){
  const total=stats.reduce((n,x)=>n+x.total,0),completed=stats.reduce((n,x)=>n+x.completed,0),states=stats.flatMap(x=>x._states||[]),recent=[...states].sort((a,b)=>b.at-a.at).slice(0,40),correct=recent.filter(x=>x.correct).length;
  return{completed,total,coverage:pct(completed,total),accuracy:recent.length?pct(correct,recent.length):0,accuracySample:recent.length,currentCorrect:correct};
}
export async function loadCardStats(plan,_studentId,{force=false}={}){
  const key=String(plan?.id||'');if(!key)return{plan:summarize([],0),lessons:{}};
  if(!force&&cache.has(key))return cache.get(key);
  const promise=(async()=>{
    const scope=scopeFor(plan),unitMap=await resolveUnits(plan),lessons={};
    for(const row of scope){
      const lesson=String(row.lesson),unitId=unitMap.get(lesson),available=unitId?await availableForUnit(unitId):emptyAvailable(),sections=new Set((row.sections||[]).map(norm)),practices={};
      for(const practice of ACTIVE){
        const on=sections.has(practice),set=on?available[practice]:new Set(),states=currentStates(plan,lesson,practice,set),stat=summarize(states,set.size);
        practices[practice]={...stat,_states:states.map(x=>({...x,id:`${lesson}|${practice}|${x.id}`}))};
      }
      const activeStats=ACTIVE.filter(p=>sections.has(p)).map(p=>practices[p]);
      lessons[lesson]={summary:aggregate(activeStats),practices};
    }
    return{plan:aggregate(Object.values(lessons).map(x=>({...x.summary,_states:ACTIVE.flatMap(p=>x.practices[p]?._states||[])}))),lessons};
  })().catch(e=>{cache.delete(key);throw e});
  cache.set(key,promise);return promise;
}
export function invalidateCardStats(planId){if(planId)cache.delete(String(planId));else cache.clear();}
export function formatCardMetric(stat){return`${number(stat?.completed)} / ${number(stat?.total)} questions`;}
export function formatAccuracy(stat){return stat?.accuracySample?`${stat.accuracy}% accuracy`:'— accuracy';}
export function reviewCounts(plan){
  const s=plan?.summary||{},now=number(s.due_review_count),unresolved=number(s.unresolved_wrong);
  return{now,later:Math.max(0,unresolved-now),cleared:number(s.corrected)};
}

// V2.13b card-stat contract:
// - content DB owns the current available question pool / denominator.
// - the existing Test Prep student backend owns student attempt history.
// - stats-client never reads test_prep_attempts directly.
// - coverage = current unique questions with a latest result / current available questions.
// - accuracy = latest result for each of the 40 most recently active current unique questions (or all if fewer than 40).
// - a later right replaces an earlier wrong; a later wrong replaces an earlier right.
