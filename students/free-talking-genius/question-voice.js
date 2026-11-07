// Free Talking Genius voice preview. Each Realtime voice has its own verified R2 cache key.
// No browser-generated voice fallback: the text stays readable when audio is unavailable.
export function createFreeTalkingVoice({host,getToken}){
 const audio=new Audio();audio.preload='auto';
 let selected='',version=0,currentUrl='',playing=false,loadedVoice='';
 const stored=new Map();
 const inflight=new Map();
 const warming=new Map();
 let questionBank=[],preferredUnit=1,preloadEpoch=0,destroyed=false,voiceConfirmed=false;
 // Exactly one background preload at a time, even after switching units or voices.
 let preloadTail=Promise.resolve();
 const PRELOAD_CACHE_GAP_MS=120;
 const PRELOAD_CACHE_CONCURRENCY=3;
 const PRELOAD_GENERATION_GAP_MS=300;
 const button=host.querySelector('[data-ft-listen]');
 const voicePicker=host.querySelector('[data-ft-voice-picker]');
 const VOICES=new Set(['marin','bunny-v3','pigfish']);
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
 function updateCharacterName(){if(characterName)characterName.textContent=activeVoice()==='pigfish'?'Pigfish':activeVoice()==='bunny-v3'?'Bunny Fox':'AI Willi'}
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
  host.dispatchEvent(new CustomEvent('ft:voice-playing',{detail:{playing}}));
  button?.classList.toggle('is-playing',playing);
  if(button)button.setAttribute('aria-pressed',String(playing));
 }
 audio.addEventListener('play',()=>{setPlaying(true);status('AI Willi가 질문을 읽고 있어요…')});
 audio.addEventListener('pause',()=>{setPlaying(false);if(!audio.ended)status('다시 듣기를 눌러 주세요.')});
 audio.addEventListener('ended',()=>{setPlaying(false);status('다시 듣기를 누르면 질문을 또 들을 수 있어요.')});
 audio.addEventListener('error',()=>{setPlaying(false);status('음성을 불러오지 못했어요. 질문을 읽고 답해 주세요.')});
 const modelForVoice=voice=>['bunny-v3','pigfish'].includes(voice)?'eleven_v3':null;
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
  if(warming.has(questionId+'|'+voice)){
   // A preloader failure should not conceal an existing R2 recording from playback.
   try{await warming.get(questionId+'|'+voice)}catch(e){
    console.warn('[Free Talking] background warm failed, checking playback cache',String(e?.message||e).slice(0,90));
   }
  }
  const work=fetchVoice(questionId,voice).then(file=>{
   if(destroyed){if(file.owned)URL.revokeObjectURL(file.url);return file}
   stored.set(cacheId,file);
   return file;
  }).finally(()=>inflight.delete(cacheId));
  inflight.set(cacheId,work);
  return work;
 }
 // Inventory-first preload: R2 HEAD checks for every question/voice precede
 // any paid generation. Existing R2 URLs are reused directly on the phone.
 async function fetchInventory(bookId){
  const call=async access=>fetch('/api/free-talking-audio',{
   method:'POST',credentials:'include',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},
   body:JSON.stringify({inventory_book_id:bookId}),signal:AbortSignal.timeout(50000)});
  let r=await call(await getToken());
  if(r.status===401)r=await call(await getToken(true));
  const data=await r.json().catch(()=>null);
  if(!r.ok||data?.success!==true||!Array.isArray(data.questions))
   throw Error(data?.error||'Cannot confirm R2 inventory');
  return data.questions;
 }
 async function confirmStorageWritable(){
  const call=async access=>fetch('/api/free-talking-audio',{
   method:'POST',credentials:'include',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},
   body:JSON.stringify({storage_probe:true}),signal:AbortSignal.timeout(30000)});
  let response=await call(await getToken());
  if(response.status===401)response=await call(await getToken(true));
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.storage_ready!==true)throw Error(data?.detail||data?.code||'R2_WRITE_FAILED');
  return true;
 }
 function preload(unit=preferredUnit){
  preferredUnit=Number(unit)||1;
  const epoch=++preloadEpoch;
  if(!questionBank.length||destroyed){preloadingText('');return}
  const selectedVoice=activeVoice(),otherVoice=selectedVoice==='marin'?'bunny-v3':'marin';
  const orderedQuestions=[...questionBank].sort((a,b)=>
   (Number(a.unit_number)===preferredUnit?0:1)-(Number(b.unit_number)===preferredUnit?0:1)
   ||Number(a.unit_number)-Number(b.unit_number)||Number(a.question_number)-Number(b.question_number));
  const total=orderedQuestions.length;
  const complete={'marin':0,'bunny-v3':0,pigfish:0};
  const current=()=>epoch===preloadEpoch&&!destroyed;
  // Short sleeps make cancellations responsive: a unit switch never spawns
  // another concurrent batch of R2 downloads or paid TTS requests.
  async function gap(ms){
   let remaining=ms;
   while(remaining>0&&current()){
    const part=Math.min(150,remaining);
    await new Promise(resolve=>setTimeout(resolve,part));
    remaining-=part;
   }
   return current();
  }
  function render(message=''){
   if(!current())return;
   preloadingText(selectedVoice+' '+complete[selectedVoice]+'/'+total+' R2 ready'+message);
  }
  async function run(){
   if(!current())return;
   preloadingText('Checking R2 inventory for both voices…');
   const bookId=orderedQuestions[0]?.book_id;
   if(!bookId){preloadingText('Cannot check R2: missing textbook ID');return}
   let inventory;
   try{inventory=await fetchInventory(bookId)}
   catch(e){
    if(current())preloadingText('R2 inventory failed — generation paused: '+String(e?.message||e).slice(0,100));
    return;
   }
   if(!current())return;
   const byId=new Map(inventory.map(item=>[String(item.id),item]));
   if(orderedQuestions.some(q=>!byId.has(String(q.id)))){
    preloadingText('R2 inventory incomplete — no new audio generated');
    return;
   }
   const cachedJobs=[],missingJobs=[];
   for(const voice of [selectedVoice,otherVoice]){
    for(const q of orderedQuestions){
     const clip=byId.get(String(q.id))?.[voice];
     if(!clip||typeof clip.cached!=='boolean'){
      preloadingText('R2 inventory invalid — no new audio generated');
      return;
     }
     const id=String(q.id);
     const cacheId=id+'|'+voice+'|'+(modelForVoice(voice)||'standard');
     if(clip.cached){
      complete[voice]++;
      // Only use a URL when the inventory actually supplied a valid one.
      if(clip.url?.startsWith('https://')&&!stored.has(cacheId))
       stored.set(cacheId,{url:clip.url,owned:false,model:clip.model,
        voice:clip.voice,source:clip.source||'r2_shared',stored:true});
      if(!stored.has(cacheId))cachedJobs.push({id,voice});
     }else missingJobs.push({id,voice});
    }
   }
   render(' · '+cachedJobs.length+' to load · '+missingJobs.length+' missing');
   // Stage 1: existing R2 recordings are safe to download in a small
   // parallel pool. Keep the selected unit at the front; never use paid TTS here.
   let loaded=0,loadFailures=0,cacheCursor=0;
   async function loadCachedWorker(){
    while(current()&&cacheCursor<cachedJobs.length){
     const job=cachedJobs[cacheCursor++];
     try{await obtain(job.id,job.voice);loaded++}
     catch(e){
      loadFailures++;
      console.warn('[Free Talking] cached clip preload',job.voice,String(e?.message||e).slice(0,120));
     }
     render(' · loading saved audio '+loaded+'/'+cachedJobs.length+
      (loadFailures?' · '+loadFailures+' errors':''));
     if(!await gap(PRELOAD_CACHE_GAP_MS))return;
    }
   }
   await Promise.all(Array.from(
    {length:Math.min(PRELOAD_CACHE_CONCURRENCY,cachedJobs.length)},
    ()=>loadCachedWorker()));
   if(!current())return;
   if(!missingJobs.length){
    render(' · '+loaded+' saved clips loaded'+(loadFailures?' · '+loadFailures+' load errors':''));
    return;
   }
   // Stage 2: verify storage, then generate one missing voice clip at a time.
   // Never re-run a missing clip while a previous TTS request is outstanding.
   try{await confirmStorageWritable()}
   catch(e){
    if(current())render(' · generation paused: storage unavailable ('+String(e?.message||e).slice(0,55)+')');
    return;
   }
   if(!current())return;
   let generated=0,failed=0,liliUnavailable=false;
   for(const job of missingJobs){
    if(!current())return;
    if(job.voice==='bunny-v3'&&liliUnavailable)continue;
    try{
     const outcome=await warm(job.id,job.voice);
     if(outcome==='hit'||outcome==='generated_saved'){complete[job.voice]++;generated++}
    }catch(e){
     failed++;
     const message=String(e?.message||e);
     console.warn('[Free Talking] paced missing-clip generation',job.voice,message.slice(0,150));
     if(job.voice==='bunny-v3'&&/ELEVENLABS_KEY_NOT_CONFIGURED|ELEVENLABS_KEY_NOT_AVAILABLE|ELEVENLABS_PROXY_UNAVAILABLE/i.test(message)){
      liliUnavailable=true;
      render(' · AI Lili unavailable; continuing AI Willi');
      continue;
     }
     if(/R2|INVENTORY|401|403|sign.in|AUTH/i.test(message)){
      render(' · paused: '+message.slice(0,85));
      return;
     }
    }
    render(' · generating missing audio '+generated+'/'+missingJobs.length+
     (failed?' · '+failed+' failed':''));
    if(!await gap(PRELOAD_GENERATION_GAP_MS))return;
   }
   render((failed?' · '+failed+' failed':'')+
    (liliUnavailable?' · AI Lili unavailable':'')+
    (loaded?' · '+loaded+' saved clips loaded':''));
  }
  // A new request supersedes the old one, but starts only after its active
  // network operation finishes. Prevents races between textbook/unit changes.
  preloadTail=preloadTail.catch(()=>{}).then(run).catch(e=>{
   if(current())preloadingText('Preload stopped: '+String(e?.message||e).slice(0,110));
  });
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
 // Explicit student-initiated playback; selecting a question only prepares audio.
 async function start(){
  if(!selected)return;
  if(currentUrl&&loadedVoice===activeVoice())return play();
  return select(selected,{autoplay:true});
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
  if(selected)void select(selected,{autoplay:false});
 }
 function setVoice(nextVoice){
  if(!VOICES.has(nextVoice)||!voicePicker)return false;
  voicePicker.value=nextVoice;
  changeVoice();
  return activeVoice()===nextVoice;
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
 return {select,start,stop,destroy,preload,setQuestionBank,setVoice,getVoice:activeVoice};
}
