/* Shared, student-wide achievements. Does not mutate awards or assignment records. */
(()=>{'use strict';
const endpoint='/.netlify/functions/progress_summary?section=vocab_motivation&_='; 
const api=(url)=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{cache:'no-store'}):fetch(url,{credentials:'include',cache:'no-store'});
let current=null, busy=null;
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
async function load(){
 if(busy)return busy;
 busy=(async()=>{
  const response=await api(endpoint+Date.now());
  if(!response.ok)throw Error('Achievements unavailable');
  const d=await response.json();
  const units=new Set((d.golden_units||[]).map(x=>'word:'+String(x.unit_id)).filter(x=>!x.endsWith('undefined')));
  const missions=window.WillenaMissionBasket;
  const results=await Promise.allSettled([
   missions?.getAchievementMissions?.()||Promise.resolve([]),
   missions?.getWritingGoldUnits?.()||Promise.resolve([]),
   sentenceGoldUnits(),
   missions?.getCompletedActivityDays?.()||Promise.resolve([])
  ]);
  if(results[0].status==='fulfilled')for(const x of results[0].value||[])if(x.done===true)units.add('homework:'+String(x.id));
  if(results[1].status==='fulfilled')for(const key of results[1].value||[])units.add(key);
  if(results[2].status==='fulfilled')for(const key of results[2].value||[])units.add(key);
  results.forEach((result,index)=>{if(result.status==='rejected')console.warn('[achievements] source '+index+' unavailable',result.reason)});
  const verified=results[3]?.status==='fulfilled'?streakFromDays(results[3].value||[]):null;
  current={current:verified?Math.max(verified.current,Math.max(0,+d.current_streak||0)):Math.max(0,+d.current_streak||0),best:verified?Math.max(verified.best,Math.max(0,+d.best_streak||0)):Math.max(0,+d.best_streak||0),gold:units.size};
  update();return current;
 })().finally(()=>{busy=null});
 return busy;
}
function mount(host){if(!host)return;draw(host);load().catch(e=>console.warn('[achievements]',e));}
function mountAll(){document.querySelectorAll('[data-shared-achievements]').forEach(mount);}
window.WillenaAchievements={mount,mountAll,refresh:load};
document.addEventListener('DOMContentLoaded',mountAll);
window.addEventListener('focus',()=>{if(document.querySelector('[data-shared-achievements]'))load().catch(()=>{});});
})();