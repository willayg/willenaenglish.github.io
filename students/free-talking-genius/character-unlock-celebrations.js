// Free Talking-only milestone cards. Uses the existing student token and one-time server record.
// Never interrupts an active conversation, never changes points or student assignments.
export async function showCharacterUnlockCelebrations({
  root,menu,request,scopedCharacterArt,duskArt,active=()=>true,
  onPoints=()=>{}
}){
  if(!root||!menu?.isConnected||!active())return;
  let status;
  try{
    const res=await request('/api/free-talking-character-unlocks',{action:'status'});
    if(!res.ok)return;status=await res.json();
  }catch(error){console.warn('[FT unlock] status',error);return}
  if(!menu.isConnected||!active())return;
  if(Number.isFinite(Number(status?.points)))onPoints(Number(status.points));
  const queue=(Array.isArray(status?.pending)?status.pending:[]).filter(x=>x==='dusk'||x==='steve');
  if(!queue.length)return;
  // Prevent a second async menu reopen from displaying duplicate dialogs.
  if(root.querySelector('.ft-character-unlock-celebration'))return;
  for(const character of queue){
    if(!menu.isConnected||!active())break;
    await showOne(character);
  }
  async function showOne(character){
    const isSteve=character==='steve';
    const text=isSteve
      ? 'WHAT?! EIGHT THOUSAND POINTS?! YOU HAVE EARNED MY RESPECT, RECRUIT!'
      : 'Well, well... Five thousand points. You found me. Welcome to the shadows!';
    const portrait=isSteve
      ? '<img class="ft-milestone-steve" alt="" src="/students/free-talking-genius/steve-portrait.svg?v=20261115-steve-portrait1">'
      : '<span class="ft-milestone-dusk">'+scopedCharacterArt(duskArt,'unlock-dusk')+'</span>';
    const dialog=document.createElement('section');
    dialog.className='ft-character-unlock-celebration'+(isSteve?' is-steve':' is-dusk');
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-label',(isSteve?'Sergeant Steve':'Dusk')+' unlocked');
    dialog.innerHTML='<div class="ft-milestone-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'+
      '<div class="ft-milestone-card"><div class="ft-milestone-eyebrow">NEW CHARACTER UNLOCKED!</div>'+
      '<div class="ft-milestone-art">'+portrait+'</div>'+
      '<h2>'+(isSteve?'SERGEANT STEVE':'DUSK')+'</h2>'+
      '<p class="ft-milestone-points">'+(isSteve?'8,000':'5,000')+' POINTS</p>'+
      '<p class="ft-milestone-quote">'+text+'</p>'+
      '<p class="ft-milestone-korean">새로운 대화 친구가 열렸어요!</p>'+
      '<div class="ft-milestone-actions"><button type="button" class="ft-milestone-listen">🔊 목소리 듣기</button>'+
      '<button type="button" class="ft-milestone-continue">친구 만나기</button></div>'+
      '<p class="ft-milestone-status" role="status" aria-live="polite"></p></div>';
    root.append(dialog);
    const listen=dialog.querySelector('.ft-milestone-listen');
    const next=dialog.querySelector('.ft-milestone-continue');
    const message=dialog.querySelector('.ft-milestone-status');
    let audio=null,disposed=false,busy=false;
    const stop=()=>{if(audio){try{audio.pause();URL.revokeObjectURL(audio.src)}catch{}audio=null}};
    const play=async()=>{
      if(disposed||busy||!active())return;
      busy=true;listen.disabled=true;listen.textContent='🔊 준비 중…';message.textContent='';
      try{
        stop();
        const res=await request('/api/free-talking-realtime-eleven',{character,text});
        if(!res.ok)throw Error('Voice unavailable');
        const blob=await res.blob();
        if(disposed)return;
        if(blob.size<500)throw Error('Voice unavailable');
        audio=new Audio();audio.src=URL.createObjectURL(blob);
        audio.onended=()=>{listen.textContent='🔊 다시 듣기'};
        await audio.play();
        listen.textContent='🔊 다시 듣기';
      }catch(e){if(!disposed){message.textContent='음성을 재생할 수 없어요. 다시 눌러 주세요.';listen.textContent='🔊 다시 듣기'}}
      finally{busy=false;if(!disposed)listen.disabled=false}
    };
    listen.addEventListener('click',()=>void play());
    // The first attempt may be blocked by mobile autoplay; the listen button is
    // an explicit user-gesture fallback and remains available.
    void play();
    await new Promise(resolve=>{
      let closing=false;
      next.addEventListener('click',async()=>{
        if(closing)return;closing=true;next.disabled=true;next.textContent='저장 중…';
        try{
          const res=await request('/api/free-talking-character-unlocks',{action:'claim',character});
          if(!res.ok)throw Error('Save failed');
        }catch(e){
          if(!disposed){message.textContent='잠금 해제 기록을 저장하지 못했어요. 다시 시도해 주세요.';next.disabled=false;next.textContent='다시 시도';closing=false}
          return;
        }
        disposed=true;stop();dialog.remove();observer.disconnect();resolve();
      });
      // A removed parent menu or exited workspace must never leave a modal
      // attached; the next visit will retry because nothing was claimed.
      const observer=new MutationObserver(()=>{
        if(!menu.isConnected||!active()){disposed=true;stop();dialog.remove();observer.disconnect();resolve()}
      });
      observer.observe(root,{childList:true,subtree:true});
    });
  }
}
