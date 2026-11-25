import {getCharacter} from '/shared/free-talking-character-catalog.js?v=20261115-p2-b';
import {createCharacterCelebration} from '/students/characters-v2/celebration-card.js?v=20261116-p4-visible-scenery2';
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
  const queue=(Array.isArray(status?.pending)?status.pending:[]).filter(id=>getCharacter(id)?.unlockPoints>0);
  if(!queue.length)return;
  // Prevent a second async menu reopen from displaying duplicate dialogs.
  if(root.querySelector('.ft-character-unlock-celebration'))return;
  // One milestone per menu visit: don't barrage existing students with multiple dialogs.
  for(const character of queue.slice(0,1)){
    if(!menu.isConnected||!active())break;
    await showOne(character);
  }
  async function showOne(character){
    const config=getCharacter(character);
    if(!config)return;
    const {root:dialog,voiceLine:text}=createCharacterCelebration(character);
    root.append(dialog);
    const listen=dialog.querySelector('.ft-milestone-listen');
    const next=dialog.querySelector('.ft-milestone-continue');
    const message=dialog.querySelector('.ft-milestone-status');
    let audio=null,disposed=false,busy=false;
    const stop=()=>{if(audio){try{audio.pause();URL.revokeObjectURL(audio.src)}catch{}audio=null}};
    const play=async()=>{
      if(disposed||busy||!active())return;
      busy=true;listen.disabled=true;listen.textContent='준비 중…';message.textContent='';
      try{
        stop();
        const res=await request('/api/free-talking-realtime-eleven',{character,text});
        if(!res.ok)throw Error('Voice unavailable');
        const blob=await res.blob();
        if(disposed)return;
        if(blob.size<500)throw Error('Voice unavailable');
        audio=new Audio();audio.src=URL.createObjectURL(blob);
        audio.onended=()=>{listen.textContent='다시 듣기'};
        await audio.play();
        listen.textContent='다시 듣기';
      }catch(e){if(!disposed){message.textContent='음성을 재생할 수 없어요. 다시 눌러 주세요.';listen.textContent='다시 듣기'}}
      finally{busy=false;if(!disposed)listen.disabled=false}
    };
    listen.addEventListener('click',()=>void play());
    // The first attempt may be blocked by mobile autoplay; the listen button is
    // an explicit user-gesture fallback and remains available.
    // No paid TTS request until the student explicitly taps Listen.
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
