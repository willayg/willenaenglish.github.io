(function(){
  'use strict';
  const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
  const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
  const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
  let selection=null;

  function addScript(src,dataKey){
    if(document.querySelector(`script[${dataKey}]`)) return;
    const s=document.createElement('script');
    s.src=src; s.setAttribute(dataKey,'1'); document.head.appendChild(s);
  }
  if(!document.querySelector('script[data-testprep-student-header]')){
    const s=document.createElement('script');s.type='module';s.src='/students/components/student-header.js?v=20260826-testprep4';s.dataset.testprepStudentHeader='1';document.head.appendChild(s);
  }
  addScript('./tracking-phase1.js?v=20260826-phase4','data-testprep-phase1-tracking');
  addScript('./vocab-practice.js?v=20260826-vocab4','data-testprep-vocab-practice');
  addScript('./sentence-practice.js?v=20260826-sentence1','data-testprep-sentence-practice');
  if(!document.querySelector('student-header[data-testprep-header]')){
    const header=document.createElement('student-header');
    header.setAttribute('data-testprep-header','1');header.setAttribute('title','Test Prep');header.setAttribute('show-id','false');header.setAttribute('show-home','false');header.setAttribute('show-points','true');header.setAttribute('show-logout','true');document.body.insertBefore(header,document.body.firstChild);
  }

  const app=document.querySelector('.app');
  const home=document.createElement('div');home.id='assignmentHome';
  const quiz=document.createElement('div');quiz.id='assignedQuizPane';quiz.style.display='none';
  if(app){const nodes=[...app.childNodes];app.append(home,quiz);nodes.forEach(n=>quiz.appendChild(n));}

  const style=document.createElement('style');
  style.textContent=`
    html,body{font-family:'Poppins','Pretendard','Noto Sans KR',system-ui,sans-serif!important}
    body{background:linear-gradient(180deg,#f4f8fa 0,#f7f9fb 230px,#f6f7fb 100%)!important;color:#203039!important}
    .app{max-width:880px!important;padding:24px 18px 54px!important}#assignmentHome{padding:2px 0 24px}.ah-top{display:none!important}
    .ah-intro{position:relative;overflow:hidden;background:linear-gradient(135deg,#fff 0%,#f4fbfc 65%,#edf8f9 100%);border:1.5px solid #b8dde0;border-radius:26px;padding:24px 25px;margin-bottom:18px;box-shadow:0 12px 32px rgba(25,119,126,.07)}
    .ah-intro:after{content:'';position:absolute;width:150px;height:150px;border-radius:50%;right:-54px;top:-70px;background:rgba(103,226,230,.16)}.ah-intro h1{position:relative;margin:0 0 6px;font-size:25px;line-height:1.2;font-weight:800;color:#19777e;letter-spacing:-.02em;z-index:1}.ah-intro p{position:relative;margin:0;color:#73828a;font-size:13px;font-weight:600;z-index:1}
    .exam-card{background:#fff;border:1px solid #dde8eb;border-radius:24px;padding:20px 20px 18px;margin-bottom:15px;box-shadow:0 10px 28px rgba(42,70,80,.055)}.exam-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.exam-school{font-size:18px;font-weight:800;color:#24343c;letter-spacing:-.015em}.exam-meta{font-size:12px;color:#7a878e;margin-top:4px;font-weight:600}.exam-date{background:#fff2f7;color:#d14d7f;border:1px solid #ffd6e5;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:800;white-space:nowrap}
    .book-name{font-size:15px;font-weight:800;color:#19777e;margin:17px 0 10px}.lesson-card{border:1px solid #e2eaed;background:#fbfdfe;border-radius:17px;padding:14px;margin-top:9px}.lesson-title{font-size:13px;font-weight:800;color:#384a52;margin-bottom:10px}.section-row{display:flex;gap:8px;flex-wrap:wrap}.section-btn{border:1.5px solid #c9dadd;background:#fff;color:#315960;border-radius:13px;padding:10px 14px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 2px 5px rgba(25,119,126,.03);transition:transform .15s ease,border-color .15s ease,background .15s ease,color .15s ease}.section-btn:hover{transform:translateY(-1px);border-color:#67cfd5;background:#eefafb;color:#19777e}.section-btn:active{transform:translateY(0)}.section-btn.loading{opacity:.55;pointer-events:none}.section-btn.vocab{border-color:#ffd1e1;color:#c84375;background:#fff8fb}.section-btn.vocab:hover{border-color:#ff9fc2;background:#fff1f6;color:#bd3569}.section-btn.sentences{border-color:#c7dff7;color:#3b6f9f;background:#f7fbff}.section-btn.sentences:hover{border-color:#8fc0ed;background:#eef7ff;color:#2d6395}
    .empty-assign{background:#fff;border:1px solid #dde8eb;border-radius:24px;padding:46px 22px;text-align:center;color:#73828a;box-shadow:0 10px 28px rgba(42,70,80,.05)}
    #assignedQuizPane>.top{display:none!important}#assignedQuizPane .hero{background:linear-gradient(135deg,#fff,#f4fbfc)!important;border:1px solid #c7e4e6!important;border-radius:20px!important;box-shadow:0 8px 20px rgba(25,119,126,.045)}#assignedQuizPane .hero h1{color:#19777e!important;font-weight:800!important}#assignedQuizPane .progress i{background:linear-gradient(90deg,#67d4da,#19777e)!important}#assignedQuizPane .card{border:1px solid #dde8eb!important;border-radius:22px!important;box-shadow:0 10px 26px rgba(42,70,80,.055)!important}#assignedQuizPane .choice{border-color:#dce5e8!important;border-radius:14px!important}#assignedQuizPane .choice.selected{border-color:#67cfd5!important;background:#eefafb!important}#assignedQuizPane .primary{background:#19777e!important}#assignedQuizPane .source.w{background:#fff2f7!important;color:#cf477b!important}
    .quiz-top-back{display:flex;align-items:center;gap:9px;margin:0 0 12px}.back-assign{border:1px solid #cbdcdf;background:#fff;color:#315960;border-radius:12px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer}.back-assign:hover{background:#eefafb;border-color:#8acfd4;color:#19777e}.quiz-context{font-size:12px;color:#73828a;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #trackingDebug{position:fixed;right:12px;bottom:12px;z-index:99999;width:min(420px,calc(100vw - 24px));max-height:44vh;overflow:auto;background:#172127;color:#e9f5f6;border:1px solid #67d4da;border-radius:14px;padding:12px 14px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 12px 34px rgba(0,0,0,.24)}#trackingDebug strong{display:block;color:#67d4da;margin-bottom:6px;font-family:Poppins,system-ui,sans-serif}#trackingDebug pre{white-space:pre-wrap;word-break:break-word;margin:0}
    @media(max-width:540px){.app{padding:16px 11px 38px!important}.ah-intro{padding:19px 17px;border-radius:22px}.ah-intro h1{font-size:22px}.exam-card{padding:16px 14px;border-radius:20px}.exam-school{font-size:16px}.lesson-card{padding:12px}.section-btn{padding:9px 11px}}
  `;document.head.appendChild(style);

  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
  function examLabel(plan){const g=plan.group||{};const term=g.term?`${g.term}학기`:'';const type=g.exam_type==='final'?'기말고사':g.exam_type==='midterm'?'중간고사':(plan.exam_name||'시험 대비');return [term,type].filter(Boolean).join(' · ')}
  function scopeFor(plan){const lessons=plan.group?.scope?.lessons;if(Array.isArray(lessons)&&lessons.length)return lessons.filter(x=>x&&x.lesson&&Array.isArray(x.sections)&&x.sections.length);return(plan.units||[]).map(lesson=>({lesson,sections:plan.practice_types||[]}));}
  function installDebugPanel(){const qs=new URLSearchParams(location.search);if(qs.get('debug')!=='tracking'||document.getElementById('trackingDebug'))return;const panel=document.createElement('div');panel.id='trackingDebug';panel.innerHTML='<strong>Phase 1 tracking test</strong><pre>Answer a question to see the event here.</pre>';document.body.appendChild(panel);const show=(type,detail)=>{const pre=panel.querySelector('pre');if(pre)pre.textContent=JSON.stringify({type,...detail},null,2)};window.addEventListener('testprep:tracking',e=>show('tracking',e.detail));window.addEventListener('testprep:vocab-attempt',e=>show('vocab-attempt',e.detail));window.addEventListener('testprep:sentence-attempt',e=>show('sentence-attempt',e.detail));}
  function restorePractice(){window.WillenaVocabPractice?.restore?.();window.WillenaSentencePractice?.restore?.()}
  function renderHome(){
    restorePractice();selection=null;quiz.style.display='none';home.style.display='block';
    const state=window.WillenaTestPrepAuth.state,user=state.user||{},plans=state.plans||[];
    home.innerHTML=`<section class="ah-intro"><h1>시험 대비</h1><p>선생님이 지정한 시험 범위만 보여요.</p></section>${plans.length?plans.map(plan=>{const g=plan.group||{},school=g.school||user.school||'학교 시험',lessons=scopeFor(plan);return `<article class="exam-card"><div class="exam-top"><div><div class="exam-school">${esc(school)}</div><div class="exam-meta">${esc(examLabel(plan))}</div></div>${plan.exam_date?`<div class="exam-date">${esc(plan.exam_date)}</div>`:''}</div><div class="book-name">${esc(plan.book_label)}</div>${lessons.map(l=>{const sections=['vocabulary','sentences',...new Set((l.sections||[]).map(x=>String(x).toLowerCase()).filter(x=>!['vocabulary','sentences'].includes(x)))];return `<div class="lesson-card"><div class="lesson-title">${esc(l.lesson)}</div><div class="section-row">${sections.map(s=>`<button class="section-btn ${s==='vocabulary'?'vocab':s==='sentences'?'sentences':''}" data-plan="${esc(plan.id)}" data-lesson="${esc(l.lesson)}" data-section="${esc(s)}">${s==='vocabulary'?'Vocabulary':s==='sentences'?'Sentences':esc(s[0].toUpperCase()+s.slice(1))}</button>`).join('')}</div></div>`}).join('')}</article>`}).join(''):`<div class="empty-assign"><b>지정된 시험 대비가 없습니다.</b><div style="margin-top:7px;font-size:12px">선생님이 시험 범위를 지정하면 여기에 표시됩니다.</div></div>`}`;
    home.querySelectorAll('.section-btn').forEach(btn=>btn.addEventListener('click',()=>start(btn)));
  }
  async function contentGet(path){const r=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
  async function resolveIds(plan,lesson){const books=await contentGet(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(plan.book_label)}&limit=1`);if(!books[0])throw new Error('교재를 콘텐츠 DB에서 찾지 못했습니다.');const units=await contentGet(`/rest/v1/content_units?select=id,title&book_id=eq.${books[0].id}&title=eq.${encodeURIComponent(lesson)}&limit=1`);if(!units[0])throw new Error('Lesson을 콘텐츠 DB에서 찾지 못했습니다.');return{bookId:books[0].id,unitId:units[0].id}}
  function setLegacySection(value){try{(0,eval)(`section=${JSON.stringify(String(value||'communication').toLowerCase())}`);return true}catch(_){return false}}
  async function waitFor(name){for(let i=0;i<60;i++){if(window[name])return window[name];await new Promise(r=>setTimeout(r,50));}throw new Error('Practice module did not load.');}
  function showBack(plan){let back=document.getElementById('assignedBackRow');if(!back){back=document.createElement('div');back.id='assignedBackRow';back.className='quiz-top-back';quiz.insertBefore(back,quiz.firstChild)}back.innerHTML=`<button class="back-assign">← 시험 목록</button><span class="quiz-context">${esc(plan.book_label)} · ${esc(selection.lesson)}</span>`;return back;}
  async function start(btn){
    const state=window.WillenaTestPrepAuth.state,plan=state.plans.find(p=>String(p.id)===String(btn.dataset.plan));if(!plan)return;btn.classList.add('loading');
    try{
      const ids=await resolveIds(plan,btn.dataset.lesson);selection={plan,lesson:btn.dataset.lesson,section:btn.dataset.section,...ids};home.style.display='none';quiz.style.display='block';const back=showBack(plan);const pill=document.querySelector('.pill');if(pill)pill.textContent=`${plan.book_label} · ${selection.lesson}`;
      if(selection.section==='vocabulary'){
        window.WillenaSentencePractice?.restore?.();back.querySelector('button').onclick=()=>{restorePractice();renderHome()};const mod=await waitFor('WillenaVocabPractice');await mod.start({quiz,unitId:selection.unitId,lesson:selection.lesson,bookLabel:plan.book_label});return;
      }
      if(selection.section==='sentences'){
        window.WillenaVocabPractice?.restore?.();back.querySelector('button').onclick=()=>{restorePractice();renderHome()};const mod=await waitFor('WillenaSentencePractice');await mod.start({quiz,unitId:selection.unitId,lesson:selection.lesson,bookLabel:plan.book_label});return;
      }
      restorePractice();window.WillenaTestPrepAuth.setActivePlan(plan,selection.lesson);window.WillenaTestPrepAuth.beginStudyActivity?.();
      back.querySelector('button').onclick=async()=>{try{await window.WillenaTestPrepAuth.completeSession(0,0,[])}catch(_){}renderHome()};
      const target=quiz.querySelector(`.tab[data-section="${CSS.escape(selection.section)}"]`);if(target)target.click();else if(setLegacySection(selection.section)&&typeof load==='function')load();else if(typeof load==='function')load();
      quiz.querySelectorAll('.tabs,.filters').forEach(el=>el.remove());
    }catch(e){alert(e.message||'시험 범위를 불러오지 못했습니다.')}finally{btn.classList.remove('loading')}
  }
  function questionQuery(){return selection?`&book_id=eq.${encodeURIComponent(selection.bookId)}&unit_id=eq.${encodeURIComponent(selection.unitId)}`:''}
  function init(){installDebugPanel();renderHome()}
  window.WillenaAssignedTestPrep={init,renderHome,questionQuery,get selection(){return selection}};
})();
