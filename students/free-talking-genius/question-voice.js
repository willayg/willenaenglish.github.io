// Free Talking Genius voice preview. Each Realtime voice has its own verified R2 cache key.
// No browser-generated voice fallback: the text stays readable when audio is unavailable.
export function createFreeTalkingVoice({host,getToken}){
 const audio=new Audio();audio.preload='auto';
 let selected='',version=0,currentUrl='',playing=false,loadedVoice='';
 const stored=new Map();
 const inflight=new Map();
 const warming=new Map();
 let questionBank=[],preferredUnit=1,preloadEpoch=0,destroyed=false,voiceConfirmed=false;
 const button=host.querySelector('[data-ft-listen]');
 const voicePicker=host.querySelector('[data-ft-voice-picker]');
 const VOICES=new Set(['marin','bunny-v3']);
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
 const characterName=host.querySelector('[data-ft-character-name]');
 function updateCharacterName(){if(characterName)characterName.textContent=activeVoice()==='bunny-v3'?'AI Lili':'AI Willi'}
 updateCharacterName();
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
 const modelForVoice=voice=>voice==='bunny-v3'?'eleven_v3':null;
 async function fetchVoice(questionId,voice){
  const expectedModel=modelForVoice(voice);
  // Use the exact Bunny v3 protocol that worked in the comparison test.
  const requestedVoice=voice==='bunny-v3'?'bunny':voice;
  const requestBody={question_id:questionId,voice:requestedVoice,
   ...(voice==='bunny-v3'?{compare_model:'eleven_v3'}:{})};
  const call=async access=>fetch('/api/free-talking-audio',{
   method:'POST',credentials:'include',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},
   body:JSON.stringify(requestBody),signal:AbortSignal.timeout(70000)});
  let response=await call(await getToken());
  if(response.status===401)response=await call(await getToken(true));
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.success!==true)throw Error(data?.error||'Audio unavailable');
  // Never accept a cached Flash response as a comparison model.
  if(expectedModel&&data.model!==expectedModel)throw Error('Expected '+expectedModel+' but audio service returned '+(data.model||'unknown')+'. Backend deployment may be outdated.');
  if(data.voice!==requestedVoice)throw Error('Expected voice '+requestedVoice+' but service returned '+(data.voice||'unknown'));
  const details={model:data.model||'',voice:data.voice||'',source:data.source||'',stored:data.stored===true};
  if(data.audio_url?.startsWith('https://'))return {url:data.audio_url,owned:false,...details};
  if(typeof data.audio!=='string'||!data.audio.length)throw Error('Missing generated audio');
  const binary=atob(data.audio),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return {url:URL.createObjectURL(new Blob([bytes],{type:data.content_type==='audio/wav'?'audio/wav':'audio/mpeg'})),owned:true,...details};
 }
 // Authenticated, status-only R2 cache warmer. Does not download MP3 or WAV data.
 async function warm(questionId,voice){
  const key=questionId+'|'+voice;
  if(warming.has(key))return warming.get(key);
  const expectedModel=modelForVoice(voice);
  const requestedVoice=voice==='bunny-v3'?'bunny':voice;
  const requestBody={question_id:questionId,voice:requestedVoice,warm_only:true,
   ...(voice==='bunny-v3'?{compare_model:'eleven_v3'}:{})};
  const work=(async()=>{
   const call=async access=>fetch('/api/free-talking-audio',{
    method:'POST',credentials:'include',cache:'no-store',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},
    body:JSON.stringify(requestBody),signal:AbortSignal.timeout(70000)});
   let response=await call(await getToken());
   if(response.status===401)response=await call(await getToken(true));
   const data=await response.json().catch(()=>null);
   if(!response.ok||data?.success!==true){
    const reason=data?.code||data?.cache_status||('HTTP_'+response.status);
    throw Error(reason+': '+(data?.error||'R2 prewarm failed'));
   }
   if(data.voice!==requestedVoice)throw Error('Warm voice mismatch');
   if(expectedModel&&data.model!==expectedModel)throw Error('Warm model mismatch');
   if(!data.stored||!['hit','generated_saved'].includes(data.cache_status))
    throw Error('R2_WRITE_UNVERIFIED: generated clip was not saved; stopping automatic retries to prevent duplicate charges');
   return data.cache_status;
  })().finally(()=>warming.delete(key));
  warming.set(key,work);
  return work;
 }
 async function obtain(questionId,voice){
  const cacheId=questionId+'|'+voice+'|'+(modelForVoice(voice)||'standard');
  if(stored.has(cacheId))return stored.get(cacheId);
  if(inflight.has(cacheId))return inflight.get(cacheId);
  // A foreground playback waits for any ongoing write of the same clip.
  if(warming.has(questionId+'|'+voice))await warming.get(questionId+'|'+voice);
  const work=fetchVoice(questionId,voice).then(file=>{
   if(destroyed){if(file.owned)URL.revokeObjectURL(file.url);return file}
   stored.set(cacheId,file);
   return file;
  }).finally(()=>inflight.delete(cacheId));
  inflight.set(cacheId,work);
  return work;
 }
 // Serial cache warming avoids flooding ElevenLabs/R2 with new files.
 // Previously prepared clips are skipped by the server R2 lookup, even after reload.
 function preload(unit=preferredUnit){
  preferredUnit=Number(unit)||1;
  const epoch=++preloadEpoch;
  if(!questionBank.length||destroyed){preloadingText('');return}
  const selectedVoice=activeVoice(),otherVoice=selectedVoice==='marin'?'bunny-v3':'marin';
  const orderedQuestions=[...questionBank].sort((a,b)=>
   (Number(a.unit_number)===preferredUnit?0:1)-(Number(b.unit_number)===preferredUnit?0:1)
   ||Number(a.unit_number)-Number(b.unit_number)||Number(a.question_number)-Number(b.question_number));
  const current=orderedQuestions.filter(q=>Number(q.unit_number)===preferredUnit);
  const later=orderedQuestions.filter(q=>Number(q.unit_number)!==preferredUnit);
  const jobs=[
   ...current.flatMap(q=>[{id:String(q.id),voice:selectedVoice},{id:String(q.id),voice:otherVoice}]),
   ...later.flatMap(q=>[{id:String(q.id),voice:selectedVoice},{id:String(q.id),voice:otherVoice}])
  ].filter(job=>job.id);
  const total=orderedQuestions.length;
  const complete={'marin':0,'bunny-v3':0};
  const failures=[];
  let canceled=false;
  const render=()=>{
   if(epoch!==preloadEpoch||destroyed)return;
   const text='AI Willi '+complete.marin+'/'+total+
    ' · AI Lili '+complete['bunny-v3']+'/'+total+' R2 ready'+
    (failures.length?' · '+failures.length+' pending retry':'');
   preloadingText(text);
  };
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function run(){
   render();
   // One request at a time, and gentle backoff for temporary TTS/R2 failures.
   for(let pass=0;pass<3;pass++){
    const batch=pass===0?jobs:failures.splice(0);
    if(!batch.length)break;
    for(const job of batch){
     if(epoch!==preloadEpoch||destroyed)return;
     try{
      await warm(job.id,job.voice);
      complete[job.voice]++;
     }catch(e){
      const message=String(e?.message||e).slice(0,160);
      failures.push(job);
      console.warn('[Free Talking] cache preload',job.voice,'pass '+(pass+1),message);
      if(/R2 cache temporarily unavailable|R2_LOOKUP_UNAVAILABLE|R2_WRITE_UNVERIFIED|Student sign-in required|401|403/i.test(message)){
       preloadingText('R2/audio saving issue · preloading paused to prevent duplicate charges');
       return;
      }
     }
     render();
     // Allow the first unit to load comfortably; pause more on retries.
     // Extra breathing room helps avoid provider throttling during large batches.
     await sleep(pass===0?800:2000*pass);
    }
    if(failures.length&&pass<2)await sleep(3000*(pass+1));
   }
   if(epoch===preloadEpoch&&!destroyed){
    render();
    if(failures.length)preloadingText('AI Willi '+complete.marin+'/'+total+
     ' · AI Lili '+complete['bunny-v3']+'/'+total+
     ' R2 ready · '+failures.length+' not yet cached (retry on next opening)');
   }
  }
  void run().catch(e=>console.warn('[Free Talking] preloader stopped',e?.message||e));
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
   const actualVoice=requestedVoice==='bunny-v3'?'bunny':requestedVoice;
   if(String(file.voice||'').toLowerCase()!==actualVoice)throw Error('Voice mismatch: selected '+actualVoice+', received '+String(file.voice||'unknown'));
   if(modelForVoice(requestedVoice)&&file.model!==modelForVoice(requestedVoice))throw Error('Model mismatch: expected '+modelForVoice(requestedVoice));
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
   // Keep enough diagnostic information to distinguish a stale deployment from TTS failure.
   if(preloadLabel)preloadLabel.textContent=String(e?.message||'Audio request failed').slice(0,180);
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
  updateCharacterName();
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
