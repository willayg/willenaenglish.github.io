// Free Talking Genius question voice. Reuses a cached OpenAI MP3 per published question.
// No browser-generated voice fallback: the text stays readable when audio is unavailable.
export function createFreeTalkingVoice({host,getToken}){
 const audio=new Audio();audio.preload='auto';
 let selected='',version=0,currentUrl='',objectUrl='',playing=false;
 const stored=new Map();
 const button=host.querySelector('[data-ft-listen]');
 const label=host.querySelector('[data-ft-voice-status]');
 const modelLabel=host.querySelector('[data-ft-voice-model]');
 function showModel(file){
  if(!modelLabel)return;
  const model=String(file?.model||'');
  if(!model){modelLabel.textContent='Voice model: checking…';modelLabel.dataset.state='loading';return}
  const cached=/^r2/.test(String(file.source||''));
  const fallback=/fallback/.test(String(file.source||''))||model==='gpt-4o-mini-tts';
  modelLabel.textContent='Voice: '+model+(file.voice?' · '+file.voice:'')+(cached?' · R2 cached':'')+(fallback?' · backup':'');
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
 async function fetchVoice(questionId){
  const call=async access=>fetch('/api/free-talking-audio',{
   method:'POST',credentials:'include',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},
   body:JSON.stringify({question_id:questionId}),signal:AbortSignal.timeout(45000)});
  let response=await call(await getToken());
  if(response.status===401)response=await call(await getToken(true));
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.success!==true)throw Error(data?.error||'Audio unavailable');
  const details={model:data.model||'',voice:data.voice||'',source:data.source||''};
  if(data.audio_url?.startsWith('https://'))return {url:data.audio_url,owned:false,...details};
  if(typeof data.audio!=='string'||!data.audio.length)throw Error('Missing generated audio');
  const binary=atob(data.audio),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return {url:URL.createObjectURL(new Blob([bytes],{type:data.content_type==='audio/wav'?'audio/wav':'audio/mpeg'})),owned:true,...details};
 }
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
  selected=String(questionId||'');currentUrl='';
  setPlaying(false);
  if(button)button.disabled=true;
  status('AI Willi 음성을 불러오는 중…');
  showModel(null);
  if(!selected)return;
  try{
   let file=stored.get(selected);
   if(!file){file=await fetchVoice(selected);if(v!==version){if(file.owned)URL.revokeObjectURL(file.url);return}stored.set(selected,file)}
   if(v!==version)return;
   currentUrl=file.url;
   showModel(file);
   if(button)button.disabled=false;
   status('AI 생성 음성 · 질문 듣기');
   if(autoplay)await play();
  }catch(e){
   if(v!==version)return;
   console.warn('[Free Talking] question voice',e?.message||'error');
   if(modelLabel){modelLabel.textContent='Voice model: unavailable';modelLabel.dataset.state='error'}
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
  version++;selected='';currentUrl='';
  audio.pause();audio.removeAttribute('src');audio.load();setPlaying(false);
  showModel(null);
  if(button)button.disabled=true;
 }
 button?.addEventListener('click',async()=>{
  if(playing){audio.pause();return}
  if(currentUrl){await play();return}
  if(selected){const id=selected;await select(id,{autoplay:true})}
 });
 function destroy(){
  stop();
  for(const file of stored.values())if(file.owned)URL.revokeObjectURL(file.url);
  stored.clear();
 }
 return {select,stop,destroy};
}
