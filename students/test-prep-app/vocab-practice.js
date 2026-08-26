(function(){
  'use strict';
  const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
  const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
  const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
  const shuffle=a=>[...a].sort(()=>Math.random()-.5);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
  let host=null,restore=[],items=[],mode='cards',queue=[],index=0,score=0,answered=false,lesson='';

  async function get(path){const r=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json();}
  async function loadItems(unitId){
    const occ=await get(`/rest/v1/source_content_occurrences?select=lexical_entry_id,source_text,metadata&unit_id=eq.${encodeURIComponent(unitId)}&occurrence_type=eq.lexical_entry&skill=eq.vocabulary&order=source_text.asc`);
    const ids=[...new Set((occ||[]).map(x=>x.lexical_entry_id).filter(Boolean))];if(!ids.length)return[];
    const lex=await get(`/rest/v1/lexical_entries?select=id,canonical_text,translation_ko,entry_type,part_of_speech&id=in.${encodeURIComponent('('+ids.join(',')+')')}`);
    const byId=new Map((lex||[]).map(x=>[x.id,x]));
    return(occ||[]).map(o=>byId.get(o.lexical_entry_id)).filter(x=>x?.canonical_text&&x?.translation_ko).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i);
  }
  function injectStyle(){
    if(document.getElementById('testPrepVocabStyle'))return;
    const s=document.createElement('style');s.id='testPrepVocabStyle';s.textContent=`
      .vp-wrap{background:#fff;border:1px solid #dde8eb;border-radius:24px;padding:20px;box-shadow:0 10px 28px rgba(42,70,80,.055)}
      .vp-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}.vp-title{font-size:20px;font-weight:800;color:#19777e}.vp-count{font-size:12px;color:#74838a;font-weight:700}
      .vp-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px}.vp-mode{border:1.5px solid #d6e4e6;background:#fff;color:#52666d;border-radius:13px;padding:10px 8px;font-weight:800;cursor:pointer}.vp-mode.active{background:#eaf8f9;border-color:#7fd2d7;color:#19777e}
      .vp-progress{height:7px;background:#edf1f2;border-radius:99px;overflow:hidden;margin-bottom:18px}.vp-progress i{display:block;height:100%;background:linear-gradient(90deg,#67d4da,#19777e);width:0;transition:width .2s ease}
      .vp-card{border:1px solid #e0e8ea;background:#fbfdfe;border-radius:20px;padding:28px 22px;text-align:center;min-height:190px;display:flex;flex-direction:column;justify-content:center}.vp-prompt{font-size:28px;font-weight:800;color:#24343c;line-height:1.3}.vp-sub{font-size:12px;color:#8a979d;margin-top:7px}
      .vp-choices{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}.vp-choice{border:1.5px solid #dbe5e7;background:#fff;border-radius:14px;padding:13px 12px;font-weight:750;color:#344950;cursor:pointer;min-height:52px}.vp-choice:hover{border-color:#8bcfd4;background:#f2fbfb}.vp-choice.correct{border-color:#66bd80;background:#effaf3;color:#176b35}.vp-choice.wrong{border-color:#e79a9d;background:#fff1f1;color:#9b3035}
      .vp-next{margin-top:14px;width:100%;border:0;border-radius:14px;background:#19777e;color:#fff;padding:13px 16px;font-weight:800;cursor:pointer}.vp-next[disabled]{opacity:.35;cursor:default}
      .vp-flash-answer{font-size:20px;font-weight:800;color:#cf477b;margin-top:14px;display:none}.vp-flash-answer.show{display:block}.vp-reveal{margin-top:18px;border:1.5px solid #a8dadd;background:#eefafb;color:#19777e;border-radius:14px;padding:12px 18px;font-weight:800;cursor:pointer}
      .vp-spell{margin-top:18px;width:100%;border:1.5px solid #cbdcdf;border-radius:14px;padding:14px 15px;font:700 18px/1.3 Poppins,'Pretendard',sans-serif;text-align:center;color:#24343c;outline:none}.vp-spell:focus{border-color:#67cfd5;box-shadow:0 0 0 3px rgba(103,207,213,.14)}.vp-spell-feedback{min-height:22px;margin-top:10px;font-size:13px;font-weight:800}.vp-spell-feedback.ok{color:#176b35}.vp-spell-feedback.bad{color:#a13a40}
      .vp-result{text-align:center;padding:30px 16px}.vp-score{font-size:48px;font-weight:900;color:#19777e}.vp-result p{color:#718188;font-weight:650}
      @media(max-width:540px){.vp-wrap{padding:15px}.vp-prompt{font-size:23px}.vp-choices{grid-template-columns:1fr}.vp-modes{grid-template-columns:1fr 1fr;gap:5px}.vp-mode{font-size:11px;padding:9px 5px}}
    `;document.head.appendChild(s);
  }
  function hideLegacy(quiz){restore=[];[...quiz.children].forEach(el=>{if(el.id==='assignedBackRow')return;restore.push([el,el.style.display]);el.style.display='none';});}
  function restoreLegacy(){restore.forEach(([el,d])=>{if(el?.isConnected)el.style.display=d});restore=[];host?.remove();host=null;}
  function startMode(nextMode){mode=nextMode;queue=shuffle(items);index=0;score=0;answered=false;render();}
  function distractors(correct,field){const pool=shuffle(items.filter(x=>x.id!==correct.id).map(x=>x[field]).filter(Boolean));return shuffle([correct[field],...pool.slice(0,3)]);}
  function emitAttempt(q,ok,extra={}){window.dispatchEvent(new CustomEvent('testprep:vocab-attempt',{detail:{lesson,mode,lexical_entry_id:q.id,canonical_text:q.canonical_text,is_correct:ok,...extra}}));}
  function render(){
    if(!host)return;
    if(index>=queue.length){host.innerHTML=`<div class="vp-wrap"><div class="vp-result"><div class="vp-score">${score}/${queue.length}</div><h2>Vocabulary practice complete</h2><p>${queue.length?Math.round(score/queue.length*100):0}% correct</p><button class="vp-next" id="vpAgain">다시 연습하기</button></div></div>`;host.querySelector('#vpAgain').onclick=()=>startMode(mode);return;}
    const q=queue[index],isFlash=mode==='cards',isSpelling=mode==='spelling';
    const prompt=mode==='ko-en'||isSpelling?q.translation_ko:q.canonical_text;
    const answer=mode==='ko-en'||isSpelling?q.canonical_text:q.translation_ko;
    const field=mode==='ko-en'?'canonical_text':'translation_ko';
    const choices=(isFlash||isSpelling)?[]:distractors(q,field);
    host.innerHTML=`<div class="vp-wrap">
      <div class="vp-head"><div><div class="vp-title">${esc(lesson)} Vocabulary</div><div class="vp-count">${items.length} lexical items</div></div><div class="vp-count">${index+1} / ${queue.length}</div></div>
      <div class="vp-modes"><button class="vp-mode ${mode==='cards'?'active':''}" data-mode="cards">카드</button><button class="vp-mode ${mode==='en-ko'?'active':''}" data-mode="en-ko">영어 → 한국어</button><button class="vp-mode ${mode==='ko-en'?'active':''}" data-mode="ko-en">한국어 → 영어</button><button class="vp-mode ${mode==='spelling'?'active':''}" data-mode="spelling">Spelling</button></div>
      <div class="vp-progress"><i style="width:${(index/queue.length)*100}%"></i></div>
      <div class="vp-card"><div class="vp-prompt">${esc(prompt)}</div><div class="vp-sub">${esc(q.part_of_speech||q.entry_type||'')}</div>
        ${isFlash?`<div class="vp-flash-answer" id="vpFlashAnswer">${esc(answer)}</div><button class="vp-reveal" id="vpReveal">뜻 보기</button>`:''}
        ${isSpelling?`<input class="vp-spell" id="vpSpell" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="영어로 입력하세요"><div class="vp-spell-feedback" id="vpSpellFeedback"></div>`:''}
        ${(!isFlash&&!isSpelling)?`<div class="vp-choices">${choices.map(c=>`<button class="vp-choice" data-value="${esc(c)}">${esc(c)}</button>`).join('')}</div>`:''}
      </div>
      <button class="vp-next" id="vpNext" ${(isFlash||isSpelling)?'':'disabled'}>${isSpelling?'정답 확인':(index===queue.length-1?'끝내기':'다음')}</button>
    </div>`;
    host.querySelectorAll('.vp-mode').forEach(b=>b.onclick=()=>startMode(b.dataset.mode));
    const next=host.querySelector('#vpNext');
    if(isFlash){
      next.disabled=true;host.querySelector('#vpReveal').onclick=()=>{host.querySelector('#vpFlashAnswer').classList.add('show');host.querySelector('#vpReveal').style.display='none';next.disabled=false};next.onclick=()=>{index++;render()};
    }else if(isSpelling){
      const input=host.querySelector('#vpSpell'),feedback=host.querySelector('#vpSpellFeedback');input.focus();
      const check=()=>{if(answered){index++;answered=false;render();return;}const typed=input.value.trim();if(!typed)return;answered=true;const ok=norm(typed)===norm(answer);if(ok)score++;feedback.className='vp-spell-feedback '+(ok?'ok':'bad');feedback.textContent=ok?'정답입니다!':`정답: ${answer}`;input.disabled=true;next.textContent=index===queue.length-1?'끝내기':'다음';emitAttempt(q,ok,{typed_answer:typed});};
      next.onclick=check;input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();check();}});
    }else{
      next.onclick=()=>{if(!answered)return;index++;answered=false;render()};
      host.querySelectorAll('.vp-choice').forEach(b=>b.onclick=()=>{if(answered)return;answered=true;const ok=b.dataset.value===answer;if(ok)score++;host.querySelectorAll('.vp-choice').forEach(x=>{if(x.dataset.value===answer)x.classList.add('correct');else if(x===b)x.classList.add('wrong')});next.disabled=false;emitAttempt(q,ok,{selected_answer:b.dataset.value});});
    }
  }
  async function start(opts){
    const quiz=opts?.quiz||document.getElementById('assignedQuizPane');if(!quiz||!opts?.unitId)throw new Error('Vocabulary practice could not start.');injectStyle();lesson=opts.lesson||'Lesson';hideLegacy(quiz);host=document.createElement('div');host.id='testPrepVocabPractice';quiz.appendChild(host);host.innerHTML='<div class="vp-wrap" style="text-align:center;padding:36px;color:#718188;font-weight:700">단어를 불러오는 중...</div>';items=await loadItems(opts.unitId);if(!items.length){host.innerHTML='<div class="vp-wrap" style="text-align:center;padding:36px;color:#718188;font-weight:700">이 Lesson에 저장된 Vocabulary가 없습니다.</div>';return;}startMode('cards');
  }
  window.WillenaVocabPractice={start,restore:restoreLegacy};
})();
