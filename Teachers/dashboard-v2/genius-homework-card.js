/* Compact shared Genius homework management card. Does not modify Grammar or 내신. */
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dday(value){
 if(!value)return 'No deadline';
 const due=new Date(value);if(Number.isNaN(due.getTime()))return 'No deadline';
 const now=new Date(),at=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
 const diff=Math.round((at(due)-at(now))/86400000);
 return diff===0?'D-Day':diff>0?'D-'+diff:'D+'+Math.abs(diff);
}
function card({className,task,dueAt,teacher,progressLabel='Progress',progressPercent=null,body='',action='',id='',createdBy='' }){
 const pct=Number(progressPercent),valid=progressPercent!==null&&progressPercent!==undefined&&Number.isFinite(pct);
 return '<article class="genius-homework-card" data-genius-card="'+esc(id)+'">'+
 '<div class="ghc-top"><strong class="ghc-class">'+esc(className||'Class unavailable')+'</strong><span class="ghc-day">'+esc(dday(dueAt))+'</span></div>'+
 '<div class="ghc-task">'+esc(task||'Homework')+'</div>'+
 '<div class="ghc-teacher" data-ghc-teacher="'+esc(createdBy)+'">'+esc(teacher||'Teacher')+'</div>'+ 
 '<div class="ghc-ring" data-ghc-ring="'+esc(id)+'" role="img" aria-label="Class progress not available"><span>—</span></div>'+
 (valid?'<div class="ghc-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.max(0,Math.min(100,pct))+'"><span style="width:'+Math.max(0,Math.min(100,pct))+'%"></span></div>':'')+
 '<details class="ghc-details"><summary><span>'+esc(progressLabel)+'</span><span class="ghc-chevron">▾</span></summary><div class="ghc-content">'+body+action+'</div></details></article>';
}
document.addEventListener('toggle',event=>{
 const details=event.target;
 if(!(details instanceof HTMLDetailsElement)||!details.matches('.ghc-details')||!details.open)return;
 const content=details.querySelector('.ghc-content');
 if(!content||content.dataset.loaded==='true')return;
 const trigger=content.querySelector('[data-sg-progress],[data-creative-progress]');
 if(trigger){content.dataset.loaded='true';trigger.click()}
},true);
let cachedNames=null,loading=null;
async function loadTeacherNames(){
 if(cachedNames)return cachedNames;
 if(loading)return loading;
 loading=(async()=>{
  const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
  if(!token)return new Map();
  const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/teacher_homework_staff_names_v1',{method:'POST',headers:{apikey:'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
  if(!response.ok)throw Error('Teacher name lookup failed');
  const rows=await response.json();
  return new Map((Array.isArray(rows)?rows:[]).map(x=>[String(x.id),x.name]));
 })();
 try{cachedNames=await loading;return cachedNames}finally{loading=null}
}
async function hydrateTeachers(scope=document){
 const nodes=[...scope.querySelectorAll('[data-ghc-teacher]')].filter(n=>n.dataset.ghcTeacher);
 if(!nodes.length)return;
 try{
  const names=await loadTeacherNames();
  for(const node of nodes){const name=names.get(node.dataset.ghcTeacher);if(name)node.textContent=name+' Teacher'}
 }catch(e){console.warn('[Genius cards] teacher names',e)}
}
function updateRing(id,value,root=document){
 const node=[...root.querySelectorAll('[data-ghc-ring]')].find(n=>n.dataset.ghcRing===String(id));
 if(!node)return;
 const pct=Number(value),valid=value!==null&&value!==undefined&&Number.isFinite(pct);
 if(!valid){node.classList.remove('has-data');node.style.removeProperty('--ghc-pct');node.querySelector('span').textContent='—';node.setAttribute('aria-label','Class progress not available');return}
 const bounded=Math.max(0,Math.min(100,Math.round(pct)));
 node.classList.add('has-data');node.style.setProperty('--ghc-pct',bounded+'%');node.querySelector('span').textContent=bounded+'%';node.setAttribute('aria-label','Class progress '+bounded+'%');
}
window.WillenaGeniusHomeworkCard={card,dday,escape:esc,hydrateTeachers,updateRing};

})();