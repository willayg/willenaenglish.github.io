(()=>{
'use strict';
let restoring=false;
let ready=false;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function activeView(){
  const view=$('.view.active');
  return view?.id?.startsWith('view-')?view.id.slice(5):'students';
}
function baseState(){
  return {teacherDashboard:true,view:activeView(),drawer:null};
}
function sameDrawer(a,b){
  if(!a&&!b)return true;
  if(!a||!b||a.type!==b.type)return false;
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  for(const k of keys){if(String(a[k]??'')!==String(b[k]??''))return false}
  return true;
}
function pushState(next){
  const cur=history.state&&history.state.teacherDashboard?history.state:baseState();
  if(cur.view===next.view&&sameDrawer(cur.drawer,next.drawer))return;
  history.pushState(next,'',location.href);
}
function pushView(view){
  if(restoring||!view)return;
  pushState({teacherDashboard:true,view,drawer:null});
}
function pushDrawer(type,payload={}){
  if(restoring||!type)return;
  pushState({teacherDashboard:true,view:activeView(),drawer:{type,...payload}});
}
function replaceDrawer(type,payload={}){
  if(restoring||!type)return;
  const cur=history.state&&history.state.teacherDashboard?history.state:baseState();
  const next={teacherDashboard:true,view:activeView(),drawer:{type,...payload}};
  if(cur.view===next.view&&sameDrawer(cur.drawer,next.drawer))return;
  if(cur.drawer?.type===type)history.replaceState(next,'',location.href);
  else pushState(next);
}
function closeStudentDirect(){window.TeacherStudentDrawer?.close?.()}
function closeGrammarDirect(){window.GrammarFoundationTeacher?.close?.()}
function closeNaesinDirect(){window.NaesinV2StudentDetail?.closeImmediate?.()}
function closeAllExcept(type){
  if(type!=='student')closeStudentDirect();
  if(type!=='grammar')closeGrammarDirect();
  if(type!=='naesin')closeNaesinDirect();
}
function requestClose(type){
  if(restoring)return false;
  const cur=history.state;
  if(cur?.teacherDashboard&&cur.drawer?.type===type){history.back();return true}
  if(type==='student')closeStudentDirect();
  if(type==='grammar')closeGrammarDirect();
  if(type==='naesin')closeNaesinDirect();
  return true;
}
function openView(view){
  const target=$(`#view-${CSS.escape(view||'students')}`);
  if(!target)return;
  if(target.classList.contains('active'))return;
  const btn=$(`[data-view="${CSS.escape(view||'students')}"]`);
  if(btn)btn.click();
  else{
    $$('.view').forEach(x=>x.classList.toggle('active',x===target));
    $$('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  }
}
async function restore(state){
  const next=state?.teacherDashboard?state:baseState();
  restoring=true;
  try{
    openView(next.view||'students');
    const d=next.drawer||null;
    closeAllExcept(d?.type);
    if(!d)return;
    if(d.type==='student'&&d.studentId)await window.TeacherStudentDrawer?.open?.(d.studentId);
    else if(d.type==='grammar'&&d.studentId){
      window.GrammarFoundationTeacher?.openView?.();
      await window.GrammarFoundationTeacher?.openStudent?.(d.studentId);
    }else if(d.type==='naesin'&&d.studentId&&d.planId){
      await window.NaesinV2StudentDetail?.open?.(d.studentId,d.planId,d.groupId||null);
    }
  }finally{
    setTimeout(()=>{restoring=false},0);
  }
}
function init(){
  if(ready)return;ready=true;
  history.replaceState({teacherDashboard:true,view:activeView(),drawer:null},'',location.href);
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-view]');
    if(!b)return;
    setTimeout(()=>{const v=activeView();if(v)pushView(v)},0);
  });
  window.addEventListener('popstate',e=>{void restore(e.state)});
}
window.TeacherHistory={pushDrawer,replaceDrawer,requestClose,isRestoring:()=>restoring,restore};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();