(function(){
  'use strict';
  const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
  const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
  const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let host=null,restore=[],items=[],index=0,score=0,attempted=false,startedAt=0,lesson='';

  async function get(path){const r=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
  function injectStyle(){if(document.getElementById('testPrepSentenceStyle'))return;const s=document.createElement('style');s.id='testPrepSentenceStyle';s.textContent=`
    .sp-wrap{background:#fff;border:1px solid #dde8eb;border-radius:24px;padding:20px;box-shadow:0 10px 28px rgba(42,70,80,.055)}
    .sp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.sp-title{font-size:20px;font-weight:800;color:#19777e}.sp-meta{font-size:12px;color:#74838a;font-weight:700;margin-top:3px}.sp-count{font-size:12px;color:#74838a;font-weight:700;white-space:nowrap}
    .sp-progress{height:7px;background:#edf1f2;border-radius:99px;overflow:hidden;margin-bottom:18px}.sp-progress i{display:block;height:100%;background:linear-gradient(90deg,#67d4da,#19777e);transition:width .2s ease}
    .sp-card{border:1px solid #e0e8ea;background:#fbfdfe;border-radius:20px;padding:20px}.sp-speaker{font-size:12px;font-weight:800;color:#cf477b;margin-bottom:8px}.sp-hint{font-size:13px;color:#7a888e;font-weight:650;margin-bottom:14px}
    .sp-answer,.sp-bank{min-height:64px;border:1.5px dashed #c9dadd;border-radius:15px;padding:10px;display:flex;gap:8px;flex-wrap:wrap;align-content:flex-start}.sp-answer{background:#fff;margin-bottom:14px}.sp-bank{background:#f4f9fa}.sp-word{border:1px solid #cadbdd;background:#fff;border-radius:11px;padding:9px 11px;font-weight:750;color:#31474f;cursor:pointer;box-shadow:0 1px 3px rgba(30,80,90,.04)}.sp-word:hover{border-color:#72cbd0;background:#eefafb}.sp-answer .sp-word{border-color:#a7dadd;background:#eefafb;color:#19777e}
    .sp-feedback{display:none;margin-top:12px;padding:11px 13px;border-radius:12px;font-size:13px;font-weight:800}.sp-feedback.ok{display:block;background:#effaf3;color:#176b35}.sp-feedback.bad{display:block;background:#fff1f1;color:#9b3035}
    .sp-actions{display:flex;gap:8px;margin-top:14px}.sp-btn{border:0;border-radius:13px;padding:12px 15px;font-weight:800;cursor:pointer}.sp-check{background:#19777e;color:#fff;flex:1}.sp-clear{background:#edf1f2;color:#43565d}.sp-btn[disabled]{opacity:.35;cursor:default}.sp-result{text-align:center;padding:32px 16px}.sp-score{font-size:48px;font-weight:900;color:#19777e}
    @media(max-width:540px){.sp-wrap{padding:15px}.sp-card{padding:15px}.sp-word{padding:8px 9px;font-size:13px}}
  `;document.head.appendChild(s)}
  function hideLegacy(quiz){restore=[];[...quiz.children].forEach(el=>{if(el.id==='assignedBackRow')return;restore.push([el,el.style.display]);el.style.display='none'})}
  function restoreLegacy(){restore.forEach(([el,d])=>{if(el?.isConnected)el.style.display=d});restore=[];host?.remove();host=null}
  function splitSentences(body,title,passageId){
    const out=[];
    const lines=String(body||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    for(let line of lines){
      if(/^(Situation\s+\d+|D-?\d+|D-Day)$/i.test(line))continue;
      if(/^(Dear\s+.+,|Hi\s+.+,|Love,?|Best,?|Your friend,?|Uncle Jay|Amy|Minji)$/i.test(line))continue;
      line=line.replace(/^(D-?\d+|D-Day)\s+/i,'');
      let speaker='';const m=line.match(/^([A-Za-z][A-Za-z .'-]{0,24}):\s*(.+)$/);if(m){speaker=m[1];line=m[2]}
      const parts=line.match(/[^.!?]+[.!?]+(?:["'”’])?|[^.!?]+$/g)||[];
      parts.map(x=>x.trim()).filter(x=>x&&/[A-Za-z]/.test(x)).forEach((text,i)=>out.push({text,speaker,passageTitle:title,passageId,partIndex:i}));
    }
    return out;
  }
  async function loadItems(unitId){
    const rows=await get(`/rest/v1/passages?select=id,title,body,source_key&status=eq.published&metadata-%3E%3Eunit_id=eq.${encodeURIComponent(unitId)}&order=source_key.asc`);
    return (rows||[]).flatMap(p=>splitSentences(p.body,p.title,p.id));
  }
  function shuffledIndexes(n){const a=[...Array(n).keys()];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}if(n>1&&a.every((v,i)=>v===i))[a[0],a[1]]=[a[1],a[0]];return a}
  function tokens(text){return String(text).trim().split(/\s+/).filter(Boolean)}
  function render(){
    if(!host)return;
    if(index>=items.length){host.innerHTML=`<div class="sp-wrap"><div class="sp-result"><div class="sp-score">${score}/${items.length}</div><h2>본문 문장 연습 완료</h2><p>모든 문장을 한 번씩 완성했어요.</p><button class="sp-btn sp-check" id="spAgain">다시 연습하기</button></div></div>`;host.querySelector('#spAgain').onclick=()=>{index=0;score=0;render()};return}
    const q=items[index],words=tokens(q.text),order=shuffledIndexes(words.length),bank=order.map(i=>({i,text:words[i]}));attempted=false;startedAt=Date.now();
    host.innerHTML=`<div class="sp-wrap"><div class="sp-head"><div><div class="sp-title">${esc(lesson)} 본문 문장</div><div class="sp-meta">${esc(q.passageTitle||'본문')} · 단어를 눌러 문장을 완성하세요</div></div><div class="sp-count">${index+1} / ${items.length}</div></div><div class="sp-progress"><i style="width:${index/items.length*100}%"></i></div><div class="sp-card">${q.speaker?`<div class="sp-speaker">${esc(q.speaker)}</div>`:''}<div class="sp-hint">문장 순서를 맞춰 보세요.</div><div class="sp-answer" id="spAnswer"></div><div class="sp-bank" id="spBank">${bank.map((w,k)=>`<button class="sp-word" data-key="${k}" data-token="${w.i}">${esc(w.text)}</button>`).join('')}</div><div class="sp-feedback" id="spFeedback"></div><div class="sp-actions"><button class="sp-btn sp-clear" id="spClear">다시 섞기</button><button class="sp-btn sp-check" id="spCheck" disabled>정답 확인</button></div></div></div>`;
    const answer=host.querySelector('#spAnswer'),bankEl=host.querySelector('#spBank'),check=host.querySelector('#spCheck'),feedback=host.querySelector('#spFeedback');
    function update(){check.disabled=!answer.children.length;}
    function wire(btn){btn.onclick=()=>{if(attempted)return;const from=btn.parentElement,to=from===bankEl?answer:bankEl;to.appendChild(btn);update()}}
    host.querySelectorAll('.sp-word').forEach(wire);
    host.querySelector('#spClear').onclick=()=>{if(attempted)return;const all=[...answer.children,...bankEl.children];const shuffled=[...all].sort(()=>Math.random()-.5);bankEl.innerHTML='';shuffled.forEach(b=>bankEl.appendChild(b));update()};
    check.onclick=()=>{
      if(attempted){index++;render();return}
      if(answer.children.length!==words.length){feedback.className='sp-feedback bad';feedback.textContent='아직 모든 단어를 사용하지 않았어요.';return}
      const built=[...answer.children].map(b=>b.textContent.trim()).join(' '),ok=built===q.text;
      window.dispatchEvent(new CustomEvent('testprep:sentence-attempt',{detail:{lesson,passage_id:q.passageId,passage_title:q.passageTitle,sentence:q.text,speaker:q.speaker||null,is_correct:ok,response_time_ms:Date.now()-startedAt}}));
      if(ok){attempted=true;score++;feedback.className='sp-feedback ok';feedback.textContent='정답입니다!';check.textContent=index===items.length-1?'끝내기':'다음 문장'}else{feedback.className='sp-feedback bad';feedback.textContent='순서가 달라요. 다시 만들어 보세요.';answer.querySelectorAll('.sp-word').forEach(b=>bankEl.appendChild(b));update()}
    };
  }
  async function start(opts){const quiz=opts?.quiz||document.getElementById('assignedQuizPane');if(!quiz||!opts?.unitId)throw new Error('Sentence practice could not start.');injectStyle();lesson=opts.lesson||'Lesson';hideLegacy(quiz);host=document.createElement('div');host.id='testPrepSentencePractice';quiz.appendChild(host);host.innerHTML='<div class="sp-wrap" style="text-align:center;padding:36px;color:#718188;font-weight:700">본문 문장을 불러오는 중...</div>';items=await loadItems(opts.unitId);index=0;score=0;if(!items.length){host.innerHTML='<div class="sp-wrap" style="text-align:center;padding:36px;color:#718188;font-weight:700">이 Lesson에 저장된 본문 문장이 없습니다.</div>';return}render()}
  window.WillenaSentencePractice={start,restore:restoreLegacy};
})();
