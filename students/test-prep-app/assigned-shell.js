(function(){
  'use strict';
  const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
  const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
  const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
  let selection=null;

  const app=document.querySelector('.app');
  const home=document.createElement('div'); home.id='assignmentHome';
  const quiz=document.createElement('div'); quiz.id='assignedQuizPane'; quiz.style.display='none';
  if(app){ const nodes=[...app.childNodes]; app.append(home,quiz); nodes.forEach(n=>quiz.appendChild(n)); }

  const style=document.createElement('style');
  style.textContent=`
    #assignmentHome{padding:2px 0 24px}.ah-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.ah-brand{font-size:22px;font-weight:950}.ah-brand b{color:var(--pink)}.ah-user{font-size:12px;font-weight:800;color:#666;background:#fff;border:1px solid var(--line);padding:8px 11px;border-radius:999px}.ah-intro{background:linear-gradient(135deg,#fff,#fff7fa);border:1px solid #ffd4e2;border-radius:22px;padding:19px;margin-bottom:14px}.ah-intro h1{margin:0 0 5px;font-size:22px}.ah-intro p{margin:0;color:var(--muted);font-size:13px}.exam-card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:17px;margin-bottom:13px;box-shadow:0 8px 22px rgba(30,35,55,.04)}.exam-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.exam-school{font-size:17px;font-weight:950}.exam-meta{font-size:12px;color:var(--muted);margin-top:3px}.exam-date{background:#fff0f5;color:#b52e61;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;white-space:nowrap}.book-name{font-weight:900;margin:15px 0 8px}.lesson-card{border:1px solid #e7e8ee;border-radius:15px;padding:12px;margin-top:8px}.lesson-title{font-size:13px;font-weight:900;margin-bottom:9px}.section-row{display:flex;gap:7px;flex-wrap:wrap}.section-btn{border:1px solid #dfe1e8;background:#fafbfc;border-radius:11px;padding:9px 11px;font-size:12px;font-weight:900;cursor:pointer}.section-btn:hover{border-color:#ffb8cf;background:var(--soft);color:#b52e61}.empty-assign{background:#fff;border:1px solid var(--line);border-radius:22px;padding:42px 20px;text-align:center;color:var(--muted)}.back-assign{border:1px solid var(--line);background:#fff;border-radius:11px;padding:8px 11px;font-size:12px;font-weight:900;cursor:pointer;margin-right:8px}.quiz-top-back{display:flex;align-items:center;margin-bottom:10px}.quiz-context{font-size:12px;color:var(--muted);font-weight:800}.section-btn.loading{opacity:.55;pointer-events:none}@media(max-width:540px){.ah-intro{padding:16px}.exam-card{padding:14px}.exam-school{font-size:15px}}
  `; document.head.appendChild(style);

  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function examLabel(plan){const g=plan.group||{};const term=g.term?`${g.term}학기`:'';const type=g.exam_type==='final'?'기말고사':g.exam_type==='midterm'?'중간고사':(plan.exam_name||'시험 대비');return [term,type].filter(Boolean).join(' · ')}
  function scopeFor(plan){
    const lessons=plan.group?.scope?.lessons;
    if(Array.isArray(lessons)&&lessons.length) return lessons.filter(x=>x&&x.lesson&&Array.isArray(x.sections)&&x.sections.length);
    return (plan.units||[]).map(lesson=>({lesson,sections:plan.practice_types||[]}));
  }
  function renderHome(){
    selection=null; quiz.style.display='none'; home.style.display='block';
    const state=window.WillenaTestPrepAuth.state, user=state.user||{}, plans=state.plans||[];
    home.innerHTML=`<div class="ah-top"><div class="ah-brand">Willena <b>Test Prep</b></div><div class="ah-user">${esc(user.korean_name||user.name||user.username||'Student')}</div></div><section class="ah-intro"><h1>시험 대비</h1><p>선생님이 지정한 시험 범위만 보여요.</p></section>${plans.length?plans.map(plan=>{const g=plan.group||{};const school=g.school||user.school||'학교 시험';const lessons=scopeFor(plan);return `<article class="exam-card"><div class="exam-top"><div><div class="exam-school">${esc(school)}</div><div class="exam-meta">${esc(examLabel(plan))}</div></div>${plan.exam_date?`<div class="exam-date">${esc(plan.exam_date)}</div>`:''}</div><div class="book-name">${esc(plan.book_label)}</div>${lessons.map(l=>`<div class="lesson-card"><div class="lesson-title">${esc(l.lesson)}</div><div class="section-row">${l.sections.map(s=>`<button class="section-btn" data-plan="${esc(plan.id)}" data-lesson="${esc(l.lesson)}" data-section="${esc(String(s).toLowerCase())}">${esc(String(s)[0].toUpperCase()+String(s).slice(1))}</button>`).join('')}</div></div>`).join('')}</article>`}).join(''):`<div class="empty-assign"><b>지정된 시험 대비가 없습니다.</b><div style="margin-top:7px;font-size:12px">선생님이 시험 범위를 지정하면 여기에 표시됩니다.</div></div>`}`;
    home.querySelectorAll('.section-btn').forEach(btn=>btn.addEventListener('click',()=>start(btn)));
  }
  async function contentGet(path){const r=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
  async function resolveIds(plan,lesson){
    const books=await contentGet(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(plan.book_label)}&limit=1`);
    if(!books[0]) throw new Error('교재를 콘텐츠 DB에서 찾지 못했습니다.');
    const units=await contentGet(`/rest/v1/content_units?select=id,title&book_id=eq.${books[0].id}&title=eq.${encodeURIComponent(lesson)}&limit=1`);
    if(!units[0]) throw new Error('Lesson을 콘텐츠 DB에서 찾지 못했습니다.');
    return {bookId:books[0].id,unitId:units[0].id};
  }
  async function start(btn){
    const state=window.WillenaTestPrepAuth.state;
    const plan=state.plans.find(p=>String(p.id)===String(btn.dataset.plan)); if(!plan)return;
    btn.classList.add('loading');
    try{
      const ids=await resolveIds(plan,btn.dataset.lesson);
      selection={plan,lesson:btn.dataset.lesson,section:btn.dataset.section,...ids};
      window.WillenaTestPrepAuth.setActivePlan(plan,selection.lesson);
      home.style.display='none'; quiz.style.display='block';
      let back=document.getElementById('assignedBackRow');
      if(!back){back=document.createElement('div');back.id='assignedBackRow';back.className='quiz-top-back';quiz.insertBefore(back,quiz.firstChild)}
      back.innerHTML=`<button class="back-assign">← 시험 목록</button><span class="quiz-context">${esc(plan.book_label)} · ${esc(selection.lesson)}</span>`;
      back.querySelector('button').onclick=async()=>{try{await window.WillenaTestPrepAuth.completeSession(0,0,[])}catch(_){} renderHome()};
      const allowed=new Set((scopeFor(plan).find(x=>x.lesson===selection.lesson)?.sections||[]).map(x=>String(x).toLowerCase()));
      document.querySelectorAll('.tab[data-section]').forEach(t=>{const ok=allowed.has(String(t.dataset.section).toLowerCase());t.style.display=ok?'':'none';t.classList.toggle('active',String(t.dataset.section).toLowerCase()===selection.section)});
      const pill=document.querySelector('.pill'); if(pill)pill.textContent=`${plan.book_label} · ${selection.lesson}`;
      const target=document.querySelector(`.tab[data-section="${CSS.escape(selection.section)}"]`); if(target)target.click(); else if(typeof load==='function')load();
    }catch(e){alert(e.message||'시험 범위를 불러오지 못했습니다.')}finally{btn.classList.remove('loading')}
  }
  function questionQuery(){return selection?`&book_id=eq.${encodeURIComponent(selection.bookId)}&unit_id=eq.${encodeURIComponent(selection.unitId)}`:''}
  function init(){renderHome()}
  window.WillenaAssignedTestPrep={init,renderHome,questionQuery,get selection(){return selection}};
})();
