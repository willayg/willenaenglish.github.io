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
function card({className,task,dueAt,teacher,progressLabel='Progress',progressPercent=null,body='',action='',id='',createdBy='',qrUrl='' }){
 const pct=Number(progressPercent),valid=progressPercent!==null&&progressPercent!==undefined&&Number.isFinite(pct);
 return '<article class="genius-homework-card" data-genius-card="'+esc(id)+'">'+
 '<div class="ghc-top"><strong class="ghc-class">'+esc(className||'Class unavailable')+'</strong><span class="ghc-day">'+esc(dday(dueAt))+'</span>'+(qrUrl?'<button type="button" class="ghc-qr-trigger" data-ghc-qr="'+esc(qrUrl)+'" data-ghc-qr-title="'+esc(className||'Homework')+'" data-ghc-qr-task="'+esc(task||'Homework')+'" aria-label="Show homework QR code" title="Show homework QR code"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="8" height="8"/><rect x="14" y="2" width="8" height="8"/><rect x="2" y="14" width="8" height="8"/><path d="M14 14h3v3h-3zM21 14v4h-3M14 21h4m3 0v-2"/></svg></button>':'')+'</div>'+
 '<div class="ghc-task">'+esc(task||'Homework')+'</div>'+
 '<div class="ghc-teacher" data-ghc-teacher="'+esc(createdBy)+'">'+esc(teacher||'Teacher')+'</div>'+ 
 '<div class="ghc-ring" data-ghc-ring="'+esc(id)+'" role="img" aria-label="Class progress not available"><span>—</span></div>'+
 (valid?'<div class="ghc-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.max(0,Math.min(100,pct))+'"><span style="width:'+Math.max(0,Math.min(100,pct))+'%"></span></div>':'')+
 '<details class="ghc-details"><summary><span>'+esc(progressLabel)+'</span><span class="ghc-chevron">▾</span></summary><div class="ghc-content">'+body+action+'</div></details></article>';
}
// Date-grouped assignment cards. Uses the teacher's Korean calendar date, not due dates.
function dateKey(value){
 if(!value)return 'undated';
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))return 'undated';
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function groupByDate(rows,render,options={}){
 const groups=new Map();
 (rows||[]).forEach(row=>{
  const key=dateKey(row.created_at||row.assigned_at);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
 });
 const dates=[...groups.keys()].sort((a,b)=>b.localeCompare(a));
 return dates.map((date,i)=>{
  const items=groups.get(date);
  const label=date==='undated'?'Date unavailable':new Intl.DateTimeFormat('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric',weekday:'short'}).format(new Date(date+'T12:00:00Z'));
  return '<details class="ghc-date-group" '+(i===0?'open':'')+'><summary><span class="ghc-date-label">'+esc(label)+'</span><small>'+items.length+' assignment'+(items.length===1?'':'s')+'</small><span class="ghc-date-chevron">▾</span></summary><div class="ghc-date-items">'+items.map(render).join('')+'</div></details>';
 }).join('');
}
const dateStyle=document.createElement('style');
dateStyle.textContent='.ghc-date-group{margin:0 0 16px;border:1.5px solid #d6e9eb;background:#fff;border-radius:18px;overflow:hidden}.ghc-date-group>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:15px 18px;background:#f6fcfc;color:#266f78;font-weight:850}.ghc-date-group>summary::-webkit-details-marker{display:none}.ghc-date-group>summary small{font-size:.72rem;color:#799197;font-weight:700}.ghc-date-chevron{margin-left:auto;transition:transform .2s}.ghc-date-group[open] .ghc-date-chevron{transform:rotate(180deg)}.ghc-date-items{display:grid;gap:16px;padding:16px}.ghc-date-items>.genius-homework-card{margin:0!important}.ghc-date-group:focus-within{border-color:#9cdde1}@media(max-width:600px){.ghc-date-items{padding:10px;gap:12px}.ghc-date-group>summary{padding:12px}}';
document.head.appendChild(dateStyle);

function classReadiness(host,rows=[],subtitle='Prior assignment results for the selected content'){
 if(!host)return;
 const safe=(rows||[]).filter(x=>x&&String(x.name||'').trim()).map(x=>({
   name:String(x.name),pct:x.percent!==null&&x.percent!==undefined&&x.percent!==''&&Number.isFinite(Number(x.percent))?Math.max(0,Math.min(100,Math.round(Number(x.percent)))):null
 })).sort((a,b)=>a.name.localeCompare(b.name,'en'));
 host.innerHTML='<section class="ghc-readiness"><h4>Class progress before assigning</h4>'+
 '<p>'+esc(subtitle)+'</p>'+
 (safe.length?safe.map(x=>'<div class="ghc-readiness-row"><span>'+esc(x.name)+'</span><div class="ghc-readiness-track"><i style="width:'+(x.pct===null?0:x.pct)+'%"></i></div><strong>'+(x.pct===null?'—':x.pct+'%')+'</strong></div>').join(''):'<div class="ghc-readiness-empty">No previous results for this selection. This does not mean 0% mastery.</div>')+
 '</section>';
}
dateStyle.textContent+='.ghc-readiness{border:1.5px solid #b9e2e7;border-radius:17px;padding:18px;margin:22px 0;background:#fff}.ghc-readiness h4{font-size:1.05rem;margin:0 0 6px;color:#303442}.ghc-readiness p{font-size:.77rem;color:#6a7c84;margin:0 0 13px}.ghc-readiness-row{display:grid;grid-template-columns:minmax(80px,125px) minmax(100px,1fr) 46px;align-items:center;gap:12px;margin:9px 0;font-size:.83rem}.ghc-readiness-row strong{text-align:right;font-variant-numeric:tabular-nums}.ghc-readiness-track{height:10px;background:#e9eff1;border-radius:999px;overflow:hidden}.ghc-readiness-track i{display:block;height:100%;border-radius:999px;background:#ea69a8}.ghc-readiness-empty{padding:10px 0;color:#758890;font-size:.78rem;font-weight:650}@media(max-width:600px){.ghc-readiness-row{grid-template-columns:minmax(65px,95px) 1fr 40px;gap:8px}}';
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

// The QR encodes only a normal assignment URL; student authentication and
// assignment eligibility are enforced by the existing student homework API.
const qrStyle=document.createElement('style');
qrStyle.textContent='.ghc-qr-trigger{flex:0 0 auto;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;background:#fff;color:#247c83;border:1.5px solid #e5a2c4;border-radius:10px;cursor:pointer}.ghc-qr-trigger:focus-visible{outline:3px solid #247c83;outline-offset:2px}.ghc-qr-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(22,35,44,.7);display:flex;align-items:center;justify-content:center;padding:16px}.ghc-qr-dialog{width:min(92vw,430px);max-height:90vh;overflow:auto;background:white;border-radius:20px;padding:22px;color:#263a40;text-align:center;box-shadow:0 20px 65px #0005}.ghc-qr-dialog h2{font-size:21px;margin:0 34px 5px}.ghc-qr-dialog p{margin:6px 0 15px;color:#62737a}.ghc-qr-image{background:white;border:10px solid white;border-radius:12px;display:block;width:min(100%,320px);height:auto;aspect-ratio:1;margin:10px auto}.ghc-qr-actions{display:flex;gap:10px;justify-content:center;margin-top:16px}.ghc-qr-actions button,.ghc-qr-close{border:1px solid #d2e3e5;background:white;border-radius:9px;padding:10px 14px;cursor:pointer}.ghc-qr-close{float:right;padding:3px 9px;font-size:24px}.ghc-qr-dialog.is-enlarged{width:min(96vw,680px)}.ghc-qr-dialog.is-enlarged .ghc-qr-image{width:min(100%,570px)}';
document.head.appendChild(qrStyle);
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-ghc-qr]');
 if(!button)return;
 event.preventDefault();event.stopPropagation();
 const raw=button.dataset.ghcQr;
 let link;
 try{link=new URL(raw,location.origin);if(link.protocol!=='https:'||link.hostname!=='students.willenaenglish.com')return}catch(_){return}
 document.querySelector('.ghc-qr-overlay')?.remove();
 const overlay=document.createElement('div');overlay.className='ghc-qr-overlay';
 overlay.innerHTML='<section role="dialog" aria-modal="true" aria-label="Homework QR code" class="ghc-qr-dialog"><button type="button" class="ghc-qr-close" aria-label="Close">×</button><h2></h2><p></p><img class="ghc-qr-image" alt="Scannable homework QR code"><div>Scan to open this assignment</div><div class="ghc-qr-actions"><button type="button" data-ghc-copy>Copy link</button><button type="button" data-ghc-enlarge>Enlarge</button></div></section>';
 overlay.querySelector('h2').textContent=button.dataset.ghcQrTitle||'Homework';
 overlay.querySelector('p').textContent=button.dataset.ghcQrTask||'';
 overlay.querySelector('img').src='https://quickchart.io/qr?size=600&margin=2&text='+encodeURIComponent(link.href);
 const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey)};
 const onKey=e=>{if(e.key==='Escape')close()};
 overlay.querySelector('.ghc-qr-close').onclick=close;
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 overlay.querySelector('[data-ghc-copy]').onclick=async e=>{try{await navigator.clipboard.writeText(link.href);e.currentTarget.textContent='Copied!'}catch(_){prompt('Copy assignment link',link.href)}};
 overlay.querySelector('[data-ghc-enlarge]').onclick=e=>{const enlarged=overlay.querySelector('.ghc-qr-dialog').classList.toggle('is-enlarged');e.currentTarget.textContent=enlarged?'Smaller':'Enlarge'};
 document.addEventListener('keydown',onKey);
 document.body.appendChild(overlay);
 overlay.querySelector('.ghc-qr-close').focus();
});

window.WillenaGeniusHomeworkCard={card,dday,escape:esc,hydrateTeachers,updateRing,groupByDate,classReadiness};

})();