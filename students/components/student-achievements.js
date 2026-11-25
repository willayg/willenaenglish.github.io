/* Shared, student-wide achievements. Does not mutate awards or assignment records. */
(()=>{'use strict';
const endpoint='/.netlify/functions/progress_summary?section=vocab_motivation&_='; 
const api=(url)=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{cache:'no-store'}):fetch(url,{credentials:'include',cache:'no-store'});
let current=null, busy=null, lastLoadAt=0, goldDirty=false;
const CACHE_MS=60000;
const icons=['streak.svg','best-streak.svg','golden-unit.svg'];
function draw(host){
 host.hidden=false;
 host.classList.add('willena-shared-achievements');
 const cells=[...host.querySelectorAll('strong')];
 if(cells.length>=3){
   cells.slice(0,3).forEach((cell,i)=>cell.dataset.achievementIndex=String(i));
 }else{
   host.innerHTML=['연속 학습','최고 연속','gold units'].map((label,i)=>'<div class="vocab-motivation-stat'+(i===2?' vocab-motivation-gold':'')+'"><img class="vocab-motivation-icon" alt="" src="/shared/svgs/'+icons[i]+'?v=20260927-icons1"><div><strong data-achievement-index="'+i+'">–</strong><small>'+label+'</small></div></div>').join('');
 }
}
function update(){if(!current)return;document.querySelectorAll('[data-achievement-index]').forEach(el=>{const n=+el.dataset.achievementIndex;el.textContent=String([current.current,current.best,current.gold][n]);});}
async function sentenceGoldUnits(){
 const [{studentIdentity,signedInProfile,assignedBooks,loadUnits,loadSentences},{getSentenceMastery},{openUnit}]=await Promise.all([
 import('/students/sentence-genius/content.js?v=sg-no-approval-v4.1'),
 import('/students/sentence-genius/tracking.js'),
 import('/students/sentence-genius/scoring.js?v=sg-coach-gold-v3')
 ]);
 const student=await studentIdentity();
 const profile=await signedInProfile(student.id);
 const books=await assignedBooks(profile.className);
 const keys=new Set();
 for(const book of books){
   const units=await loadUnits(book.id);
   for(const unit of units){
     try{
       const [items,rows]=await Promise.all([loadSentences(book.id,unit.id,unit),getSentenceMastery(book.id,unit.id)]);
       const mastery=openUnit(student.id,unit.id);
       mastery.hydrateServer(rows);
       if(items.length&&mastery.gold(items))keys.add('sentence:'+String(book.id)+'|'+String(unit.id));
     }catch(error){console.warn('[achievements] Sentence unit skipped',unit.id,error);}
   }
 }
 return [...keys];
}
function streakFromDays(values){
 const valid=[...new Set(values.filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)))].sort();
 let best=0,run=0,previous=null;
 for(const day of valid){
  const stamp=Date.parse(day+'T12:00:00Z');
  run=previous!==null&&stamp-previous===86400000?run+1:1;
  best=Math.max(best,run);previous=stamp;
 }
 const todayParts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const today=todayParts.year+'-'+todayParts.month+'-'+todayParts.day;
 const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 let last=valid.at(-1),current=0;
 if(last===today||last===yesterday){
  for(let i=valid.length-1;i>=0;i--){
   if(i<valid.length-1&&Date.parse(valid[i+1]+'T12:00:00Z')-Date.parse(valid[i]+'T12:00:00Z')!==86400000)break;
   current++;
  }
 }
 return {current,best};
}
async function load(force=false){
 if(busy)return busy;
 if(!force&&current&&Date.now()-lastLoadAt<CACHE_MS){update();return current;}
 busy=(async()=>{
  let d={};
  try{
   const response=await api(endpoint+Date.now());
   if(response.ok)d=await response.json();
   else console.warn('[achievements] legacy motivation source unavailable',response.status);
  }catch(error){console.warn('[achievements] legacy motivation source unavailable',error)}

  const missions=window.WillenaMissionBasket;
  let goldTotal=null;
  if(!goldDirty){
   try{const saved=await missions?.getGoldSnapshot?.();if(saved)goldTotal=saved.total}
   catch(error){console.warn('[achievements] Gold snapshot read unavailable',error)}
  }
  const results=await Promise.allSettled([
   goldTotal===null?(async()=>{
    const units=new Set((d.golden_units||[]).map(x=>'word:'+String(x.unit_id)).filter(x=>!x.endsWith('undefined')));
    const [hw,writing,sentence]=await Promise.allSettled([
     missions?.getAchievementMissions?.()||Promise.resolve([]),
     missions?.getWritingGoldUnits?.()||Promise.resolve([]),
     sentenceGoldUnits()
    ]);
    const counts={word:units.size,sentence:0,writing:0,homework:0};
    if(hw.status==='fulfilled')counts.homework=new Set((hw.value||[]).filter(x=>x.done===true).map(x=>String(x.id))).size;
    if(writing.status==='fulfilled')counts.writing=new Set(writing.value||[]).size;
    if(sentence.status==='fulfilled')counts.sentence=new Set(sentence.value||[]).size;
    if([hw,writing,sentence].every(x=>x.status==='fulfilled')){
      void missions?.saveGoldSnapshot?.(counts).catch(error=>console.warn('[achievements] Gold cache save unavailable',error));
      goldDirty=false;
    }else console.warn('[achievements] Incomplete Gold source; refusing to overwrite cache');
    return counts.word+counts.sentence+counts.writing+counts.homework;
   })():Promise.resolve(goldTotal),
   (async()=>{const cached=await missions?.getStreakSnapshot?.();return cached||await missions?.refreshStreakSnapshot?.()||null})()
  ]);
  if(results[0].status==='rejected')console.warn('[achievements] Gold calculation failed',results[0].reason);
  goldTotal=results[0].status==='fulfilled'?results[0].value:(current?.gold??0);
  // Grammar Books is a separate persisted mastery source. Do not add it to
  // the existing four-field gold snapshot or overwrite legacy award counts.
  try{
   const grammarRows=await missions?.getGrammarBookProgress?.()||[];
   const grouped=new Map();
   for(const row of grammarRows){
    if(!grouped.has(row.chapter_number))grouped.set(row.chapter_number,new Set());
    if(Number(row.best_correct)===8)grouped.get(row.chapter_number).add(row.mode);
   }
   goldTotal+=[...grouped.values()].filter(modes=>['choose','check','hunt'].every(mode=>modes.has(mode))).length;
  }catch(error){console.warn('[achievements] Grammar chapter gold unavailable',error)}

  let verified=results[1]?.status==='fulfilled'?results[1].value:null;
  if(!verified){try{verified=streakFromDays(await missions?.getCompletedActivityDays?.()||[])}catch(e){console.warn('[achievements] historical streak fallback failed',e)}}
  current={current:verified?Math.max(verified.current,Math.max(0,+d.current_streak||0)):Math.max(0,+d.current_streak||0),best:verified?Math.max(verified.best,Math.max(0,+d.best_streak||0)):Math.max(0,+d.best_streak||0),gold:goldTotal};
  lastLoadAt=Date.now();update();return current;
 })().finally(()=>{busy=null});
 return busy;
}
function mount(host){if(!host)return;draw(host);load().catch(e=>console.warn('[achievements]',e));}
function mountAll(){document.querySelectorAll('[data-shared-achievements]').forEach(mount);}
window.WillenaAchievements={mount,mountAll,refresh:()=>load(true),invalidateGold:()=>{goldDirty=true;return load(true)}};
document.addEventListener('DOMContentLoaded',mountAll);
window.addEventListener('focus',()=>{if(document.querySelector('[data-shared-achievements]'))load().catch(()=>{});});
})();