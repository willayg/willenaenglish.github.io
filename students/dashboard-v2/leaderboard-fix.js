(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let scope='class';
  let userId='';
  let refreshTimer=0;

  async function fetchJson(url, opts={}) {
    const r=await window.WillenaAPI.fetch(url, opts);
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }

  function render(raw, which, className='') {
    const rows=$('#leaderRows');
    if(!rows) return;
    const list=(Array.isArray(raw)?raw:[]).map(e=>({
      ...e,
      name:e.name||'Student',
      stars:Number(e.stars)||0,
      points:Number(e.points)||0,
      superScore:Number.isFinite(Number(e.superScore)) ? Number(e.superScore) : Math.round(((Number(e.stars)||0)*(Number(e.points)||0))/1000)
    })).sort((a,b)=>b.superScore-a.superScore||b.stars-a.stars||b.points-a.points||String(a.name).localeCompare(String(b.name)));

    const label=$('#leaderClass');
    if(label) label.textContent=which==='class' ? `${className||'MY CLASS'} · THIS MONTH` : 'EVERYBODY · THIS MONTH';

    if(!list.length){
      rows.innerHTML=`<div class="loading">No ${which==='class'?'class ':''}leaderboard data yet.</div>`;
      return;
    }
    rows.innerHTML=list.slice(0,10).map((e,i)=>`<div class="row${e.self?' self':''}"><div class="rank">${i+1}</div><div class="name">${e.name}${e.self?' · You':''}</div><div class="score">${e.superScore.toLocaleString()} ⚡</div></div>`).join('');
  }

  async function load(which=scope, quiet=false) {
    scope=which;
    $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.scope===which));
    const rows=$('#leaderRows');
    if(!rows) return;
    if(!quiet) rows.innerHTML='<div class="loading">Loading leaderboard…</div>';
    try {
      const section=which==='global'?'leaderboard_stars_global':'leaderboard_stars_class';
      const data=await fetchJson(`/.netlify/functions/progress_summary?section=${section}&timeframe=month&_=${Date.now()}`, {cache:'no-store'});
      if(!data.success) throw new Error(data.error||'Leaderboard unavailable');
      render(data.leaderboard,which,data.class||'');
    } catch(err) {
      console.error('[dashboard leaderboard fix]',err);
      if(!quiet) rows.innerHTML='<div class="loading">Could not load the leaderboard.</div>';
    }
  }

  async function boot(){
    if(!window.WillenaAPI) return;
    try{
      const who=await fetchJson(`/.netlify/functions/supabase_auth?action=whoami&_=${Date.now()}`,{cache:'no-store'});
      if(!who.success) return;
      userId=who.user_id||who.id||'';
    }catch{return;}

    $$('.tab').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        load(btn.dataset.scope||'class');
      },true);
    });

    await load('class');
    clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>load(scope,true),60000);
  }

  window.addEventListener('focus',()=>{ if(userId) load(scope,true); });
  window.addEventListener('stars:refresh',()=>{ if(userId) setTimeout(()=>load(scope,true),800); });
  window.addEventListener('session:ended',()=>{ if(userId) setTimeout(()=>load(scope,true),800); });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();