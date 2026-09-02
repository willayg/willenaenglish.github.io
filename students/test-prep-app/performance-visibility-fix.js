(function(){
'use strict';

let timer=null;
let observer=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function addStyles(){
  if(document.getElementById('tpPerformanceVisibilityStyles'))return;
  const s=document.createElement('style');
  s.id='tpPerformanceVisibilityStyles';
  s.textContent=`
    .tp-performance-shortcuts{display:grid;gap:10px;margin:0 0 16px}
    .tp-performance-shortcut{width:100%;border:1px solid #f0d59d;background:linear-gradient(135deg,#fff9ec,#fff2e6);border-radius:20px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;box-shadow:0 8px 24px rgba(145,98,22,.10);cursor:pointer;color:#25383c}
    .tp-performance-shortcut .icon{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,#f3b64b,#f07f77);color:#fff;font-size:22px;flex:0 0 auto}
    .tp-performance-shortcut .copy{flex:1;min-width:0}.tp-performance-shortcut .copy b{display:block;font-size:17px}.tp-performance-shortcut .copy small{display:block;color:#7d6a51;margin-top:3px;font-weight:700}
    .tp-performance-shortcut .go{font-weight:900;color:#a5680e;white-space:nowrap}
  `;
  document.head.appendChild(s);
}

function api(){return window.WillenaPerformancePractice}
function rows(){return Array.isArray(api()?.assignments)?api().assignments:[]}
function statePlans(){return window.WillenaTestPrepAuth?.state?.plans||[]}

function visibleLessonAssignment(){
  const home=document.getElementById('assignmentHome');
  const subway=home?.querySelector('.tp-subway');
  const h1=home?.querySelector('.tp-lesson-head h1');
  if(!subway||!h1)return null;
  const lesson=String(h1.textContent||'').trim();
  let matches=rows().filter(a=>String(a.unit_key||'').trim()===lesson);
  if(matches.length<=1)return matches[0]||null;
  const bookText=String(home.querySelector('.tp-lesson-head p')?.textContent||'');
  return matches.find(a=>{
    const p=statePlans().find(x=>String(x.id)===String(a.plan_id));
    return p?.book_label&&bookText.includes(p.book_label);
  })||matches[0]||null;
}

function ensureLessonStop(){
  const home=document.getElementById('assignmentHome');
  const subway=home?.querySelector('.tp-subway');
  if(!subway||subway.querySelector('[data-skill="performance"]'))return;
  const a=visibleLessonAssignment();
  if(!a)return;
  const stop=document.createElement('div');
  stop.className='tp-stop tp-performance-stop';
  stop.dataset.skill='performance';
  stop.innerHTML=`<div class="tp-station">★</div><div class="tp-stop-copy"><b>수행평가</b><small>${esc(a.title||'문장 암기 수행평가')}</small><span class="tp-task-badge">추가 학습</span><div class="tp-mini"><i style="width:0%"></i></div></div><div class="tp-stop-pct">시작<small>${a.due_date?esc(a.due_date)+'까지':''}</small></div>`;
  stop.onclick=()=>api()?.start?.(a.plan_id,a.unit_key);
  subway.appendChild(stop);
}

function ensureHomeShortcut(){
  const home=document.getElementById('assignmentHome');
  if(!home||home.querySelector('.tp-subway')||home.querySelector('.tp-performance-shortcuts'))return;
  const list=rows();
  if(!list.length)return;
  const wrap=document.createElement('div');
  wrap.className='tp-performance-shortcuts';
  wrap.innerHTML=list.map((a,i)=>`<button class="tp-performance-shortcut" data-pa-shortcut="${i}"><span class="icon">★</span><span class="copy"><b>수행평가 준비</b><small>${esc(a.unit_key||'')} · ${esc(a.title||'문장 암기')}${a.due_date?' · '+esc(a.due_date):''}</small></span><span class="go">시작 →</span></button>`).join('');
  home.insertBefore(wrap,home.firstChild);
  wrap.querySelectorAll('[data-pa-shortcut]').forEach(b=>b.onclick=()=>{const a=list[Number(b.dataset.paShortcut)];if(a)api()?.start?.(a.plan_id,a.unit_key)});
}

function refresh(){
  addStyles();
  ensureLessonStop();
  ensureHomeShortcut();
}

function boot(){
  let tries=0;
  timer=setInterval(()=>{
    tries++;
    const mod=api(),home=document.getElementById('assignmentHome');
    if(mod&&home){
      refresh();
      if(!observer){
        observer=new MutationObserver(()=>setTimeout(refresh,0));
        observer.observe(home,{childList:true,subtree:true});
      }
      if(rows().length||tries>120)clearInterval(timer);
    }else if(tries>240)clearInterval(timer);
  },100);
  window.addEventListener('testprep:student-state-refresh',()=>setTimeout(refresh,50));
  window.addEventListener('pageshow',()=>setTimeout(refresh,50));
}

boot();
})();