// Free Talking Genius voice preview. Each Realtime voice has its own verified R2 cache key.
// No browser-generated voice fallback: the text stays readable when audio is unavailable.
export function createFreeTalkingVoice({host,getToken}){
 const audio=new Audio();audio.preload='auto';
 let selected='',version=0,currentUrl='',playing=false,loadedVoice='';
 const stored=new Map();
 const inflight=new Map();
 let questionBank=[],preferredUnit=1,preloadEpoch=0,destroyed=false,voiceConfirmed=false;
 const button=host.querySelector('[data-ft-listen]');
 const voicePicker=host.querySelector('[data-ft-voice-picker]');
 const VOICES=new Set(['alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar','bunny','bunny-v3','bunny-multilingual-v2','jock','sgt-steve','lily']);
 const PREFERENCE_KEY='willena-free-talking-voice-v1';
 try{
  const saved=localStorage.getItem(PREFERENCE_KEY);
  if(voicePicker&&VOICES.has(saved))voicePicker.value=saved;
 }catch(_){}
 const activeVoice=()=>voicePicker&&VOICES.has(voicePicker.value)?voicePicker.value:'marin';
 let pickerVoice=activeVoice();
 const label=host.querySelector('[data-ft-voice-status]');
 const modelLabel=host.querySelector('[data-ft-voice-model]');
 const preloadLabel=host.querySelector('[data-ft-voice-preload]');
 const isElevenVoice=v=>['bunny','jock','sgt-steve','lily'].includes(v);
 function preloadingText(text){if(preloadLabel)preloadLabel.textContent=text||''}
 function showModel(file){
  if(!modelLabel)return;
  const model=String(file?.model||'');
  if(!model){modelLabel.textContent='Voice model: checking…';modelLabel.dataset.state='loading';return}
  const cached=/^r2/.test(String(file.source||''));
  const fallback=/fallback/.test(String(file.source||''))||model==='gpt-4o-mini-tts';
  const cacheState=cached?' · R2 cached':file.stored===true?' · Saved to R2':file.stored===false?' · R2 not saved':'';
  modelLabel.textContent='Voice: '+model+(file.voice?' · '+file.voice:'')+cacheState+(fallback?' · backup':'');
  modelLabel.dataset.state=fallback?'fallback':'ready';
 }
 const avatar=host.querySelector('[data-ft-avatar]');
 function status(value){if(label)label.textContent=value}
 function setPlaying(value){
  playing=!!value;
  avatar?.classList.toggle('is-talking',playing);
  button?.classList.toggle('is-playing',playing);
  if(button)button.setAttribute('aria-pressed',String(playing));
 }
 audio.addEventListener('play',()=>{setPlaying(true);status('AI Willi가 질문을 읽고 있어요…')});
 audio.addEventListener('pause',()=>{setPlaying(false);if(!audio.ended)status('다시 듣기를 눌러 주세요.')});
 audio.addEventListener('ended',()=>{setPlaying(false);status('다시 듣기를 누르면 질문을 또 들을 수 있어요.')});
 audio.addEventListener('error',()=>{setPlaying(false);status('음성을 불러오지 못했어요. 질문을 읽고 답해 주세요.')});
 async function fetchVoice(questionId,voice){
  const call=async access=>fetch('/api/free-talking-audio',{
   method:'POST',credentials:'include',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},
   body:JSON.stringify({question_id:questionId,voice}),signal:AbortSignal.timeout(70000)});
  let response=await call(await getToken());
  if(response.status===401)response=await call(await getToken(true));
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.success!==true)throw Error(data?.error||'Audio unavailable');
  const details={model:data.model||'',voice:data.voice||'',source:data.source||'',stored:data.stored===true};
  if(data.audio_url?.startsWith('https://'))return {url:data.audio_url,owned:false,...details};
  if(typeof data.audio!=='string'||!data.audio.length)throw Error('Missing generated audio');
  const binary=atob(data.audio),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return {url:URL.createObjectURL(new Blob([bytes],{type:data.content_type==='audio/wav'?'audio/wav':'audio/mpeg'})),owned:true,...details};
 }
 async function obtain(questionId,voice){
  const cacheId=questionId+'|'+voice;
  if(stored.has(cacheId))return stored.get(cacheId);
  if(inflight.has(cacheId))return inflight.get(cacheId);
  const work=fetchVoice(questionId,voice).then(file=>{
   if(destroyed){if(file.owned)URL.revokeObjectURL(file.url);return file}
   stored.set(cacheId,file);
   return file;
  }).finally(()=>inflight.delete(cacheId));
  inflight.set(cacheId,work);
  return work;
 }
 // Temporarily disabled: no batch MP3 fetch/generation, regardless of voice choice.
 // The current question still loads on demand through select().
 function preload(unit=preferredUnit){
  preferredUnit=Number(unit)||1;
  ++preloadEpoch;
  preloadingText('');
 }
 function setQuestionBank(questions,unit=1){questionBank=Array.isArray(questions)?questions:[];preload(unit)}
 async function play(){
  if(!currentUrl||!selected)return;
  try{
   audio.pause();audio.currentTime=0;
   audio.src=currentUrl;
   await audio.play();
  }catch(e){
   setPlaying(false);
   if(e?.name==='NotAllowedError')status('듣기 버튼을 눌러 질문을 들어 보세요.');
   else status('재생할 수 없어요. 듣기 버튼을 다시 눌러 주세요.');
  }
 }
 async function select(questionId,{autoplay=true}={}){
  version++;const v=version;
  audio.pause();audio.removeAttribute('src');audio.load();
  selected=String(questionId||'');currentUrl='';loadedVoice='';
  setPlaying(false);
  if(button)button.disabled=true;
  status('AI Willi 음성을 불러오는 중…');
  showModel(null);
  if(!selected)return;
  try{
   const requestedVoice=activeVoice();
   const file=await obtain(selected,requestedVoice);
   if(v!==version)return
   if(v!==version)return;
   // Never advertise or play a different voice than the one requested.
   if(String(file.voice||'').toLowerCase()!==requestedVoice)throw Error('Voice mismatch: selected '+requestedVoice+', received '+String(file.voice||'unknown'));
   currentUrl=file.url;
   loadedVoice=requestedVoice;
   showModel(file);
   if(button)button.disabled=false;
   status('AI 생성 음성 · 질문 듣기');
   if(autoplay)await play();
  }catch(e){
   if(v!==version)return;
   console.warn('[Free Talking] question voice',e?.message||'error');
   if(modelLabel){modelLabel.textContent='Voice: '+activeVoice()+' · unavailable';modelLabel.dataset.state='error'}
   const reason=String(e?.message||'');
   status(/로그인|401|인증|sign.in/i.test(reason)
    ?'음성 로그인 확인에 실패했어요. 새로고침 후 다시 들어 보세요.'
    :/configured|설정/i.test(reason)
     ?'AI 음성 설정을 확인해야 해요. 선생님에게 알려 주세요.'
     :'음성을 불러오지 못했어요. 다시 듣기를 눌러 재시도하세요.');
   if(button)button.disabled=false;
  }
 }
 function stop(){
  version++;selected='';currentUrl='';loadedVoice='';
  audio.pause();audio.removeAttribute('src');audio.load();setPlaying(false);
  showModel(null);
  if(button)button.disabled=true;
 }
 function changeVoice(){
  const chosen=activeVoice();
  if(chosen===pickerVoice&&voiceConfirmed)return;
  pickerVoice=chosen;
  voiceConfirmed=true;
  try{localStorage.setItem(PREFERENCE_KEY,chosen)}catch(_){}
  preload(preferredUnit);
  if(selected)void select(selected,{autoplay:true});
 }
 voicePicker?.addEventListener('input',changeVoice);
 voicePicker?.addEventListener('change',changeVoice);
 button?.addEventListener('click',async()=>{
  if(playing){audio.pause();return}
  if(selected&&loadedVoice!==activeVoice()){await select(selected,{autoplay:true});return}
  if(currentUrl){await play();return}
  if(selected){const id=selected;await select(id,{autoplay:true})}
 });
 function destroy(){
  destroyed=true;preloadEpoch++;
  stop();
  for(const file of stored.values())if(file.owned)URL.revokeObjectURL(file.url);
  stored.clear();
 }
 return {select,stop,destroy,preload,setQuestionBank};
}
