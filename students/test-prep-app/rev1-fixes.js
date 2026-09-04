(function(){
'use strict';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const cache=new Map();
let busy=false;

const norm=v=>String(v||'').trim().toLowerCase();
async function get(path){
  const r=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});
  if(!r.ok)throw new Error(`Content ${r.status}`);
  return r.json();
}

function addBadge(){
  document.getElementById('tp-students-rev1')?.remove();
  const b=document.createElement('div');
  b.id='tp-students-rev1';
  b.textContent='REV1';
  Object.assign(b.style,{
    position:'fixed',right:'8px',bottom:'8px',zIndex:'2147483647',
    padding:'4px 8px',borderRadius:'999px',background:'rgba(20,20,24,.82)',
    color:'#fff',font:'700 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    boxShadow:'0 2px 8px rgba(0,0,0,.18)',pointerEvents:'none',opacity:'.9'
  });
  document.body.appendChild(b);
}

const DOT='\uE000';
function protectSentenceDots(value){
  let s=String(value||'');
  s=s.replace(/\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr)\./gi,(_,a)=>`${a}${DOT}`);
  s=s.replace(/\b(e\.g|i\.e|a\.m|p\.m|U\.S|U\.K)\./gi,m=>m.replace(/\./g,DOT));
  s=s.replace(/(\d)\.(\d)/g,`$1${DOT}$2`);
  return s;
}
function restoreSentenceDots(value){return String(value||'').split(DOT).join('.')}
function countPassageSentences(body){
  let count=0;
  for(let line of String(body||'').split(/\n+/).map(x=>x.trim()).filter(Boolean)){
    if(/^(Situation\s+\d+|D-?\d+|D-Day)$/i.test(line)||/^What will happen next\?/i.test(line)||/^(Dear\s+.+,|Hi\s+.+,|Love,?|Best,?|Your friend,?|Uncle Jay|Amy|Minji)$/i.test(line))continue;
    line=line.replace(/^(D-?\d+|D-Day)\s+/i,'');
    const speaker=line.match(/^([A-Za-z][A-Za-z .'-]{0,24}):\s*(.+)$/);
    if(speaker)line=speaker[2];
    const safe=protectSentenceDots(line);
    const parts=safe.match(/[^.!?]+[.!?]+(?:["'”’])?|[^.!?]+$/g)||[];
    count+=parts.map(x=>restoreSentenceDots(x.trim())).filter(x=>x&&/[A-Za-z]/.test(x)).length;
  }
  return count;
}

function scopeFor(plan){
  const lessons=plan?.group?.scope?.lessons;
  if(Array.isArray(lessons)&&lessons.length)return lessons.filter(x=>x?.lesson);
  return (plan?.units||[]).map(lesson=>({lesson,sections:plan.practice_types||[]}));
}
async function unitIdFor(plan,l){
  if(l?.unit_id)return String(l.unit_id);
  const key=`unit|${plan?.book_label||''}|${l?.lesson||''}`;
  if(cache.has(key))return cache.get(key);
  let id='';
  try{
    const books=await get(`/rest/v1/content_books?select=id&title=eq.${encodeURIComponent(plan.book_label||'')}&limit=1`);
    const book=books?.[0];
    if(book){
      const m=String(l?.lesson||'').match(/Lesson\s*(\d+)/i);
      let units=[];
      if(m)units=await get(`/rest/v1/content_units?select=id,unit_number,title&book_id=eq.${encodeURIComponent(book.id)}&unit_number=eq.${encodeURIComponent(m[1])}&limit=1`);
      if(!units?.length)units=await get(`/rest/v1/content_units?select=id,unit_number,title&book_id=eq.${encodeURIComponent(book.id)}&title=ilike.${encodeURIComponent(String(l?.lesson||'')+'%')}&limit=1`);
      id=String(units?.[0]?.id||'');
    }
  }catch(e){console.warn('[REV1] unit lookup failed',e)}
  cache.set(key,id);
  return id;
}
async function totalsFor(plan,l){
  const unitId=await unitIdFor(plan,l);
  if(!unitId)return null;
  const key=`totals|${unitId}`;
  if(cache.has(key))return cache.get(key);
  try{
    const [passages,reading]=await Promise.all([
      get(`/rest/v1/passages?select=id,body&status=eq.published&metadata-%3E%3Eunit_id=eq.${encodeURIComponent(unitId)}&limit=1000`),
      get(`/rest/v1/test_prep_questions?select=id&unit_id=eq.${encodeURIComponent(unitId)}&section=eq.reading&student_usable=eq.true&replacement_needed=eq.false&limit=10000`)
    ]);
    const totals={
      sentences:(passages||[]).reduce((n,p)=>n+countPassageSentences(p.body),0),
      reading:(reading||[]).length
    };
    cache.set(key,totals);
    return totals;
  }catch(e){console.warn('[REV1] total lookup failed',e);return null}
}
function progress(plan,lesson,practice,total){
  const v=plan?.summary?.by_lesson_practice?.[`${lesson}||${practice}`]||{};
  const done=Math.max(0,Number(v.unique)||0);
  const accuracy=done?Math.max(0,Math.min(100,Number(v.accuracy)||0)):0;
  const coverage=total?Math.min(100,done/total*100):0;
  return {done,total,mastery:total?Math.round(coverage*accuracy/100):0};
}
function patchRow(home,practice,v){
  const row=home?.querySelector(`.tp-stop[data-skill="${practice}"],.tp-r6-stop[data-r6-skill="${practice}"],.tp-r7-stop[data-r7-skill="${practice}"]`);
  if(!row||!v?.total)return;
  const pct=row.querySelector('.tp-stop-pct,.tp-r6-pct,.tp-r7-pct');
  const bar=row.querySelector('.tp-mini i,.tp-r7-bar i');
  if(pct){
    if(pct.classList.contains('tp-stop-pct'))pct.innerHTML=`${v.mastery}%<small>${v.done}/${v.total}</small>`;
    else pct.textContent=`${v.mastery}%`;
  }
  if(bar)bar.style.width=`${v.mastery}%`;
}
async function patch(){
  if(busy)return;
  busy=true;
  try{
    addBadge();
    const home=document.getElementById('assignmentHome');
    const plans=window.WillenaTestPrepAuth?.state?.plans||[];
    if(!home||!plans.length)return;
    const heading=home.querySelector('.tp-lesson-head h1,.tp-r6-head h1,.tp-r7-head h1');
    if(!heading)return;
    const lesson=String(heading.textContent||'').trim();
    for(const plan of plans){
      const l=scopeFor(plan).find(x=>String(x.lesson).trim()===lesson);
      if(!l)continue;
      const totals=await totalsFor(plan,l);
      if(!totals)continue;
      patchRow(home,'sentences',progress(plan,l.lesson,'sentences',totals.sentences));
      patchRow(home,'reading',progress(plan,l.lesson,'reading',totals.reading));
      break;
    }
  }finally{busy=false}
}
function boot(){
  addBadge();
  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(patch,80)};
  const home=document.getElementById('assignmentHome');
  if(home)new MutationObserver(muts=>{if(muts.some(m=>m.addedNodes.length))schedule()}).observe(home,{childList:true,subtree:true});
  window.addEventListener('testprep:student-state-refresh',schedule);
  window.addEventListener('testprep:tracking',e=>{if(['attempt_saved','session_completed'].includes(e.detail?.type))setTimeout(patch,220)});
  setTimeout(patch,180);
  console.info('[Test Prep] REV1 active: badge + passage completion progress');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
