(()=>{
'use strict';
if(!window.WillenaAPI||window.__willenaLeaderboardDetails)return;
window.__willenaLeaderboardDetails=true;
const store=Object.create(null);
window.addEventListener('willena:leaderboard-data',e=>{const {scope,metric,data}=e.detail||{};if(scope&&metric&&Array.isArray(data?.leaderboard)){store[scope+'|'+metric]=data;queueMicrotask(decorate)}});
function maskKorean(value){
  const s=String(value||'').trim();
  if(!s)return'';
  const chars=Array.from(s);
  if(chars.length===1)return chars[0];
  if(chars.length===2)return chars[0]+'*';
  return chars[0]+'*'.repeat(chars.length-2)+chars[chars.length-1];
}
function sorted(data,metric){return [...(data?.leaderboard||[])].sort((a,b)=>a.rank-b.rank)}
function decorate(){
  const root=document.querySelector('#leaderRows');
  if(!root)return;
  const scope=document.querySelector('.scope-tabs .tab.active')?.dataset.scope||'global';
  const metric=document.querySelector('.metric-tab.active')?.dataset.metric||'super';
  const data=store[scope+'|'+metric];
  if(!data)return;
  const entries=sorted(data,metric);
  const rows=[...root.querySelectorAll('.row')];
  rows.forEach((row,i)=>{
    const e=entries[i];
    if(!e)return;
    row.dataset.studentId=e.user_id||'';
    row.removeAttribute('role');
    row.removeAttribute('tabindex');
    row.removeAttribute('aria-expanded');
    row.classList.remove('show-private');
    const name=row.querySelector('.name');
    if(name&&!name.querySelector('.student-meta')){
      const meta=document.createElement('span');
      meta.className='student-meta';
      const cls=document.createElement('span');
      cls.className='student-class';
      cls.textContent=e.class||'No class';
      meta.appendChild(cls);
      const masked=maskKorean(e.korean_name);
      if(masked){
        const ko=document.createElement('span');
        ko.className='student-korean always-visible';
        ko.textContent=masked;
        meta.appendChild(ko);
      }
      name.appendChild(meta);
    }
  });
}
const observer=new MutationObserver(decorate);
const start=()=>{const root=document.querySelector('#leaderRows');if(root){observer.observe(root,{childList:true,subtree:true});decorate()}else setTimeout(start,80)};
start();
document.querySelectorAll('.metric-tab,.scope-tabs .tab').forEach(btn=>btn.addEventListener('click',()=>setTimeout(decorate,0)));
})();
