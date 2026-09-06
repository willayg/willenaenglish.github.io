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
async function contentPaged(path){const out=[];for(let start=0;start<10000;start+=1000){const rows=await contentGet(path,`${start}-${start+999}`);out.push(...rows);if(rows.length<1000)break}return out}
async function trackGet(path,range=''){
  const t=token();if(!t)throw new Error('AUTH_REQUIRED');const headers={apikey:TRACK_KEY,Authorization:`Bearer ${t}`};if(range)headers.Range=range;
  const r=await fetch(TRACK+path,{headers,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json();
}
async function trackPaged(path){const out=[];for(let start=0;start<10000;start+=1000){const rows=await trackGet(path,`${start}-${start+999}`);out.push(...rows);if(rows.length<1000)break}return out}

function scopeFor(plan){const rows=plan?.group?.scope?.lessons;if(Array.isArray(rows)&&rows.length)return rows.filter(x=>x?.lesson);return(plan?.units||[]).map(lesson=>({lesson,sections:plan?.practice_types||[]}))}
async function resolveUnits(plan){
  const scope=scopeFor(plan),map=new Map(scope.filter(x=>x.unit_id).map(x=>[String(x.lesson),String(x.unit_id)]));
  if(map.size===scope.length)return map;
  const books=await contentGet(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(plan?.book_label||'')}&limit=1`),bookId=books?.[0]?.id;if(!bookId)return map;
  const units=await contentPaged(`/rest/v1/content_units?select=id,title&book_id=eq.${encodeURIComponent(bookId)}`),byTitle=new Map(units.map(x=>[String(x.title),String(x.id)]));
  for(const row of scope)if(!map.has(String(row.lesson))&&byTitle.has(String(row.lesson)))map.set(String(row.lesson),byTitle.get(String(row.lesson)));return map;
}
function emptyAvailable(){return Object.fromEntries(ACTIVE.map(k=>[k,new Set()]))}
async function availableForUnit(unitId){
  const available=emptyAvailable();
  const rows=await contentPaged(`/rest/v1/test_prep_questions?select=${encodeURIComponent('id,section,answer_mode,choices,correct_answer,metadata,replacement_needed,student_usable')}&unit_id=eq.${encodeURIComponent(unitId)}&student_usable=eq.true`);
  for(const row of rows){
    if(row.replacement_needed===true)continue;const section=norm(row.section),form=detectForm(row),id=String(row.id||'');if(!id)continue;
    if(['communication','grammar','reading'].includes(section)&&[FORMS.choice,FORMS.multi].includes(form))available[section].add(id);
    if(isAuthoredWritten(row)&&[FORMS.write,FORMS.multipart,FORMS.correction].includes(form))available.constructed_response.add(id);
  }
  const occ=await contentPaged(`/rest/v1/source_content_occurrences?select=lexical_entry_id&unit_id=eq.${encodeURIComponent(unitId)}&occurrence_type=eq.lexical_entry&skill=eq.vocabulary`);
  for(const row of occ)if(row.lexical_entry_id)available.vocabulary.add(String(row.lexical_entry_id));
  return available;
}
function attemptLesson(a){return String(a?.unit_key||a?.metadata?.lesson||'')}
function attemptPractice(a){return norm(a?.practice_type||a?.metadata?.practice_type)}
function latestState(attempts,lesson,practice,available){
  const byQuestion=new Map();
  for(const a of attempts){if(attemptLesson(a)!==String(lesson)||attemptPractice(a)!==practice)continue;const id=String(a.question_id||'');if(!id||!available.has(id))continue;const prev=byQuestion.get(id),at=Date.parse(a.attempted_at||0)||0;if(!prev||at>=prev.at)byQuestion.set(id,{id,correct:!!a.is_correct,at})}
  return [...byQuestion.values()];
}
function summarize(states,total){
  const recent=[...states].sort((a,b)=>b.at-a.at).slice(0,40),correct=recent.filter(x=>x.correct).length,completed=states.length;
  return{completed,total,coverage:pct(completed,total),accuracy:recent.length?pct(correct,recent.length):0,accuracySample:recent.length,currentCorrect:correct};
}
function aggregate(stats){
  const total=stats.reduce((n,x)=>n+x.total,0),completed=stats.reduce((n,x)=>n+x.completed,0),states=stats.flatMap(x=>x._states||[]),recent=[...states].sort((a,b)=>b.at-a.at).slice(0,40),correct=recent.filter(x=>x.correct).length;
  return{completed,total,coverage:pct(completed,total),accuracy:recent.length?pct(correct,recent.length):0,accuracySample:recent.length,currentCorrect:correct};
}
export async function loadCardStats(plan,studentId,{force=false}={}){
  const key=String(plan?.id||'');if(!key)return{plan:summarize([],0),lessons:{}};if(!force&&cache.has(key))return cache.get(key);
  const promise=(async()=>{
    const scope=scopeFor(plan),unitMap=await resolveUnits(plan),attempts=studentId?await trackPaged(`/rest/v1/test_prep_attempts?select=${encodeURIComponent('question_id,practice_type,unit_key,is_correct,attempted_at,metadata')}&student_id=eq.${encodeURIComponent(studentId)}&plan_id=eq.${encodeURIComponent(plan.id)}&order=attempted_at.asc`):[];
    const lessons={};
    for(const row of scope){
      const lesson=String(row.lesson),unitId=unitMap.get(lesson),available=unitId?await availableForUnit(unitId):emptyAvailable(),sections=new Set((row.sections||[]).map(norm)),practices={};
      for(const practice of ACTIVE){
        const on=sections.has(practice),set=on?available[practice]:new Set(),states=latestState(attempts,lesson,practice,set),stat=summarize(states,set.size);practices[practice]={...stat,_states:states.map(x=>({...x,id:`${lesson}|${practice}|${x.id}`}))};
      }
      const activeStats=ACTIVE.filter(p=>sections.has(p)).map(p=>practices[p]);lessons[lesson]={summary:aggregate(activeStats),practices};
    }
    const result={plan:aggregate(Object.values(lessons).map(x=>({...x.summary,_states:ACTIVE.flatMap(p=>x.practices[p]?._states||[])}))),lessons};return result;
  })().catch(e=>{cache.delete(key);throw e});cache.set(key,promise);return promise;
}
export function invalidateCardStats(planId){if(planId)cache.delete(String(planId));else cache.clear()}
export function formatCardMetric(stat){if(!stat?.total)return'0 / 0 questions';return`${stat.completed} / ${stat.total} questions`}
export function formatAccuracy(stat){return stat?.accuracySample?`${stat.accuracy}% accuracy`:'— accuracy'}
export function reviewCounts(plan){const s=plan?.summary||{};return{now:number(s.wrong_now??s.review_now),later:number(s.wrong_later??s.review_later),cleared:number(s.cleared_wrong??s.review_cleared)}}

// V2.13a card-stat contract:
// coverage = unique current questions attempted / current available questions.
// accuracy = latest answer per unique question, using the 40 most recently active unique questions (or all if fewer than 40).
// A later right answer replaces an earlier wrong; a later wrong replaces an earlier right.
