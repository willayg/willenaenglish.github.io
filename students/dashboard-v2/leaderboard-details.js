(()=>{
'use strict';
if(!window.WillenaAPI||window.__willenaLeaderboardDetails)return;
window.__willenaLeaderboardDetails=true;
const store={global:null,class:null};
const originalFetch=WillenaAPI.fetch.bind(WillenaAPI);
WillenaAPI.fetch=async function(url,opts){
  const response=await originalFetch(url,opts);
  try{
    const u=String(url||'');
    let scope=null;
    if(u.includes('section=leaderboard_stars_global'))scope='global';
    else if(u.includes('section=leaderboard_stars_class'))scope='class';
    if(scope){
      const clone=response.clone();
      clone.json().then(data=>{if(data&&Array.isArray(data.leaderboard)){store[scope]=data;queueMicrotask(decorate)}}).catch(()=>{});
    }
  }catch{}
  return response;
};
function maskKorean(value){
  const s=String(value||'').trim();
  if(!s)return'';
  const chars=Array.from(s);
  if(chars.length===1)return chars[0];
  if(chars.length===2)return chars[0]+'*';
  return chars[0]+'*'.repeat(chars.length-2)+chars[chars.length-1];
}
function sorted(data,metric){
  const list=(data?.leaderboard||[]).map(e=>({...e,stars:Number(e.stars)||0,points:Number(e.points)||0,superScore:Number.isFinite(Number(e.superScore))?Number(e.superScore):Math.round(((Number(e.stars)||0)*(Number(e.points)||0))/1000)}));
  return list.sort((a,b)=>{
    if(metric==='points')return b.points-a.points||b.stars-a.stars||String(a.name||'').localeCompare(String(b.name||''));
    if(metric==='stars')return b.stars-a.stars||b.points-a.points||String(a.name||'').localeCompare(String(b.name||''));
    return b.superScore-a.superScore||b.stars-a.stars||b.points-a.points||String(a.name||'').localeCompare(String(b.name||''));
  });
}
function decorate(){
  const root=document.querySelector('#leaderRows');
  if(!root)return;
  const scope=document.querySelector('.scope-tabs .tab.active')?.dataset.scope||'global';
  const metric=document.querySelector('.metric-tab.active')?.dataset.metric||'super';
  const data=store[scope];
  if(!data)return;
  const entries=sorted(data,metric);
  const rows=[...root.querySelectorAll('.row')];
  rows.forEach((row,i)=>{
    const e=entries[i];
    if(!e)return;
    row.dataset.studentId=e.user_id||'';
    row.setAttribute('role','button');
    row.setAttribute('tabindex','0');
    row.setAttribute('aria-expanded',row.classList.contains('show-private')?'true':'false');
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
        ko.className='student-korean';
        ko.textContent=masked;
        meta.appendChild(ko);
      }
      name.appendChild(meta);
    }
  });
}
function toggleRow(row){
  if(!row||!row.classList.contains('row'))return;
  const next=!row.classList.contains('show-private');
  row.classList.toggle('show-private',next);
  row.setAttribute('aria-expanded',next?'true':'false');
}
document.addEventListener('click',e=>{
  const row=e.target.closest?.('#leaderRows .row');
  if(row)toggleRow(row);
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const row=e.target.closest?.('#leaderRows .row');
  if(!row)return;
  e.preventDefault();
  toggleRow(row);
});
const observer=new MutationObserver(decorate);
const start=()=>{const root=document.querySelector('#leaderRows');if(root){observer.observe(root,{childList:true,subtree:true});decorate()}else setTimeout(start,80)};
start();
document.querySelectorAll('.metric-tab,.scope-tabs .tab').forEach(btn=>btn.addEventListener('click',()=>setTimeout(decorate,0)));
})();
