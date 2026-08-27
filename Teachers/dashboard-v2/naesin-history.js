(function(){
'use strict';
const MARK='willenaNaesin';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
function state(kind,view){return{[MARK]:true,kind,view:view||null}}
function current(){return history.state&&history.state[MARK]?history.state:null}
function diagOpen(){return $('#naFreshDiagBg')?.classList.contains('open')}
function showOverview(){const body=$('#naDiagBody');if(!body)return;$$('.na-diag-view',body).forEach(x=>x.classList.toggle('active',x.dataset.view==='overview'));body.scrollTop=0}
function showDetail(view){const body=$('#naDiagBody');if(!body)return;$$('.na-diag-view',body).forEach(x=>x.classList.toggle('active',x.dataset.view===view));body.scrollTop=0}
function closeDiag(){$('#naFreshDiagBg')?.classList.remove('open')}
function ensureMainState(){const c=current();if(c?.kind==='main')return;history.pushState(state('main'),'')}
function pushStudent(){const c=current();if(!c)ensureMainState();if(current()?.kind!=='student')history.pushState(state('student'),'')}
function pushDetail(view){const c=current();if(c?.kind!=='student'&&c?.kind!=='detail')pushStudent();if(current()?.kind!=='detail'||current()?.view!==view)history.pushState(state('detail',view),'')}
window.addEventListener('popstate',e=>{
  const s=e.state;
  if(s&&s[MARK]){
    if(s.kind==='detail'){
      if(diagOpen())showDetail(s.view||'accuracy');
      return;
    }
    if(s.kind==='student'){
      if(diagOpen())showOverview();
      return;
    }
    if(s.kind==='main'){
      closeDiag();
      return;
    }
  }
  closeDiag();
});
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-view="naesin"]');
  if(nav){queueMicrotask(ensureMainState);return}
  const member=e.target.closest('.na-member');
  if(member){queueMicrotask(pushStudent);return}
  const detail=e.target.closest('[data-local]');
  if(detail){queueMicrotask(()=>pushDetail(detail.dataset.local));return}
  const back=e.target.closest('[data-diag-back]');
  if(back){
    const c=current();
    if(c?.kind==='detail'){
      e.preventDefault();
      queueMicrotask(()=>history.back());
    }
    return;
  }
  const close=e.target.closest('#naDiagClose');
  if(close){
    const c=current();
    if(c?.kind==='detail'){
      e.preventDefault();
      history.go(-2);
    }else if(c?.kind==='student'){
      e.preventDefault();
      history.back();
    }
  }
},false);
})();