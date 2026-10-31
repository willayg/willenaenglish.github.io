/* Shared, student-wide achievements. Does not mutate awards or assignment records. */
(()=>{'use strict';
const endpoint='/.netlify/functions/progress_summary?section=vocab_motivation&_='; 
const api=(url)=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{cache:'no-store'}):fetch(url,{credentials:'include',cache:'no-store'});
let current=null, busy=null;
const icons=['streak.svg','best-streak.svg','golden-unit.svg'];
function draw(host){host.className='vocab-motivation vocab-achievements willena-shared-achievements';host.hidden=false;host.innerHTML=['연속 학습','최고 연속','gold units'].map((label,i)=>'<div class="vocab-motivation-stat'+(i===2?' vocab-motivation-gold':'')+'"><img class="vocab-motivation-icon" alt="" src="/shared/svgs/'+icons[i]+'?v=20260927-icons1"><div><strong data-achievement-index="'+i+'">–</strong><small>'+label+'</small></div></div>').join('');}
function update(){if(!current)return;document.querySelectorAll('[data-achievement-index]').forEach(el=>{const n=+el.dataset.achievementIndex;el.textContent=String([current.current,current.best,current.gold][n]);});}
async function load(){if(busy)return busy;busy=(async()=>{const response=await api(endpoint+Date.now());if(!response.ok)throw Error('Achievements unavailable');const d=await response.json();const units=new Set((d.golden_units||[]).map(x=>'word:'+String(x.unit_id)).filter(x=>!x.endsWith('undefined')));const awarded=new Set();const missions=window.WillenaMissionBasket;try{const rows=await missions?.getAchievementMissions?.();if(Array.isArray(rows))for(const x of rows){if(x.done===true){const key=String(x.id);if(!awarded.has(key))awarded.add(key);}}}catch(e){console.warn('[achievements] homework records unavailable',e)}
// Student-wide word records and unique completed homework awards. Never count archived copies twice.
current={current:Math.max(0,+d.current_streak||0),best:Math.max(0,+d.best_streak||0),gold:units.size+awarded.size};update();return current;})().finally(()=>{busy=null});return busy;}
function mount(host){if(!host)return;draw(host);load().catch(e=>console.warn('[achievements]',e));}
function mountAll(){document.querySelectorAll('[data-shared-achievements]').forEach(mount);}
window.WillenaAchievements={mount,mountAll,refresh:load};
document.addEventListener('DOMContentLoaded',mountAll);
window.addEventListener('focus',()=>{if(document.querySelector('[data-shared-achievements]'))load().catch(()=>{});});
})();