// Demo overlay. The ORIGINAL Free Talking Genius runs unchanged inside the same-origin iframe.
// Everything here is additive; no production app source is patched.
import {contentDbGet} from '/students/shared/content-db.js?v=1.0.0';
import {createFreeTalkingCharacters} from '/students/free-talking-genius/character-actor.js?v=20261108-original-animation1';
const $=id=>document.getElementById(id);
const frame=$('original'),veil=$('demo');
const state={actor:null,book:null,unit:null,character:'willi',peer:null,channel:null,stream:null,remote:null,speaker:null,mediaURL:null,playing:null,controller:null,seconds:180,timer:null,active:false,starting:false,turnText:'',pendingText:false,alreadySpoken:false,generation:0,voiceMode:'audio',audioContext:null,audioGain:null,quietMode:true,remoteStream:null,linkedSources:new WeakSet(),micAnalyzer:null,micSource:null,micContext:null,micRaf:null,micNoiseSeen:false,serverHeard:false,micUserMuted:false,ttsPlaying:false,guided:true,anchors:[],anchorIndex:0,anchorPhase:'idle',anchorResponding:false,anchorClipCache:new Map(),anchorClipPromises:new Map(),anchorTimer:null,anchorResponseText:'',anchorToken:0,guidedSessionReady:false};
const NAMES={willi:'AI Willi',bunny:'Bunny Fox',pigfish:'Pigfish'};
// Reuse the EXACT token mechanism of Free Talking Genius (app.js token()).
// The extension's previous staffAccessToken() path was inappropriate for students.
function validJwt(token){
 if(!token||token.split('.').length!==3)return false;
 try{
  const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  return Number(claims.exp)*1000>Date.now()+30000;
 }catch{return false}
}
async function originalStudentToken(force=false){
 const original=frame.contentWindow;
 const gateway=original?.WillenaAPI||window.WillenaAPI;
 const cached=gateway?.getLocalAccessToken?.();
 if(!force&&validJwt(cached))return cached;
 const fn=gateway?.fetch?gateway.fetch.bind(gateway):fetch;
 const res=await fn('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{credentials:'include',cache:'no-store'});
 const data=await res.json().catch(()=>null);
 if(!res.ok||!validJwt(data?.access_token))throw Error('Willena login needs refreshing. Sign in and reopen the demo.');
 gateway?.setLocalTokens?.(data.access_token,data.refresh_token||'');
 return data.access_token;
}
async function authorizedDemoFetch(path,body,signal){
 const call=async token=>fetch(path,{method:'POST',credentials:'same-origin',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal,cache:'no-store'});
 let response=await call(await originalStudentToken());
 if(response.status===401)response=await call(await originalStudentToken(true));
 return response;
}

const EXT_NAV_KEY='willenaFtRealtimeExtensionV1';
let activeStartId=0;
let startAbort=null;
function hasActivityHistory(){return history.state?.[EXT_NAV_KEY]==='activity'}
function closeActivity(){
 activeStartId++;
 try{startAbort?.abort()}catch{}
 startAbort=null;
 endSession('Conversation ended.');
 veil.hidden=true;
 $('talk').classList.remove('is-visible');
 // Preserve the original app's character selector and its own history entry.
 // Do NOT click its Back button: that would skip character selection.
}
function navigateBack(){
 const hadEntry=hasActivityHistory();
 closeActivity();
 if(hadEntry)history.back();
}
window.addEventListener('popstate',()=>{
 // Android/browser Back consumes our top-level activity entry. The underlying
 // iframe owns the preceding character and book history entries.
 if(!hasActivityHistory()&&!veil.hidden)closeActivity();
});

function volumeFraction(){
 const x=Math.max(0,Math.min(150,Number($('volume').value)||0))/100;
 // Linear gain; 100% is normal, 101–150% is an optional Web Audio boost.
 return x;
}
function setAudioLevels(){
 const level=volumeFraction();
 if(state.audioGain)state.audioGain.gain.setTargetAtTime(level,state.audioContext.currentTime,.012);
 for(const a of [state.remote,state.speaker].filter(Boolean)){
  a.muted=level===0;
  a.volume=state.linkedSources.has(a)?1:Math.min(1,level);
 }
 $('volumeNumber').textContent=Math.round(Number($('volume').value))+'%';
}
function createAudioMixer(){
 if(!state.quietMode||state.audioContext)return;
 const AudioContextClass=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextClass){state.quietMode=false;return}
 try{
  const ctx=new AudioContextClass({latencyHint:'interactive'});
  const gain=ctx.createGain();
  gain.gain.value=volumeFraction();
  gain.connect(ctx.destination);
  state.audioContext=ctx;state.audioGain=gain;
  // This is created on the Start button's user gesture, before network waits.
  void ctx.resume().catch(e=>console.warn('Realtime audio context needs resuming',e));
 }catch(e){console.warn('Audio mixer unavailable',e);state.quietMode=false}
}
function routeAudio(audio){
 if(!audio)return;
 if(state.quietMode&&state.audioContext&&state.audioGain&&state.audioContext.state==='running'){
  try{
   const source=state.audioContext.createMediaElementSource(audio);
   source.connect(state.audioGain);
   state.linkedSources.add(audio);
   void state.audioContext.resume().catch(()=>{});
  }catch(e){console.warn('Audio routing failed, reverting to browser playback',e)}
 }
 setAudioLevels();
}
function resumeMixer(){
 if(state.audioContext?.state==='suspended')void state.audioContext.resume().catch(()=>{});
}


function stopMicMonitor(){
 if(state.micRaf)cancelAnimationFrame(state.micRaf);
 state.micRaf=null;
 try{state.micSource?.disconnect()}catch{}
 state.micSource=null;state.micAnalyzer=null;
 if(state.micContext&&state.micContext!==state.audioContext)void state.micContext.close().catch(()=>{});
 state.micContext=null;state.micNoiseSeen=false;state.serverHeard=false;
}
function monitorMicrophone(stream){
 stopMicMonitor();
 const track=stream.getAudioTracks()[0];
 if(!track){$('listenCheck').textContent='No microphone track was found';return}
 $('listenCheck').textContent='Microphone permission granted · checking audio';
 track.addEventListener('ended',()=>{$('listenCheck').textContent='Microphone disconnected'});
 track.addEventListener('mute',()=>{$('listenCheck').textContent='Microphone paused by phone or browser'});
 track.addEventListener('unmute',()=>{$('listenCheck').textContent='Microphone active'});
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx){$('micLevel').textContent='Mic: connected';return}
 try{
  const context=state.audioContext||new Ctx({latencyHint:'interactive'});
  state.micContext=context;
  const analyser=context.createAnalyser();analyser.fftSize=512;
  const source=context.createMediaStreamSource(stream);source.connect(analyser);
  state.micSource=source;state.micAnalyzer=analyser;
  void context.resume().catch(()=>{});
  const sample=new Uint8Array(analyser.fftSize);let tick=0;
  const frame=()=>{
   if(!state.stream||state.stream!==stream)return;
   state.micRaf=requestAnimationFrame(frame);
   if(++tick%6)return;
   analyser.getByteTimeDomainData(sample);
   let sum=0;for(let i=0;i<sample.length;i++){const d=(sample[i]-128)/128;sum+=d*d}
   const rms=Math.sqrt(sum/sample.length);
   const level=Math.min(100,Math.round(rms*550));
   $('micLevel').textContent='Mic level: '+level+'%';
   if(level>=5){state.micNoiseSeen=true;if(!state.serverHeard)$('listenCheck').textContent='Microphone picking up sound · waiting for AI';}
  };
  frame();
 }catch(ex){console.warn('Mic level monitor unavailable',ex);$('micLevel').textContent='Mic: connected'}
}

function message(s){$('status').textContent=s}
function error(s){$('error').textContent=String(s||'Unknown error')}
function buttonState(c){
 state.character=c;
 const doc=appDocument();
 for(const [id,key] of [['ftChooseWilli','willi'],['ftChooseLili','bunny'],['ftChoosePigfish','pigfish']]){
  doc?.getElementById(id)?.setAttribute('aria-pressed',String(key===c));
 }
 const go=doc?.getElementById('ftCharacterContinue');if(go)go.disabled=false;
}
function appDocument(){try{return frame.contentDocument}catch{return null}}
function prepareCard(){
 const d=appDocument(),card=d?.getElementById('ftFreeTalkingCard');if(!card)return;
 if(card.dataset.extension==='ready')return;
 card.dataset.extension='ready';card.disabled=false;card.removeAttribute('aria-disabled');card.classList.remove('ft-coming-soon-card');
 card.setAttribute('aria-label','Free Talking · 8 textbook questions');
 card.style.cssText+=';opacity:1!important;filter:none!important;cursor:pointer;pointer-events:auto;';
 const step=card.querySelector('.vocab-skill-step');if(step)step.textContent='STEP 2';
 const detail=card.querySelector('.vocab-card-stars');if(detail)detail.textContent='8개 질문으로 대화 · 골든 유닛 조건 아님';
 const ring=card.querySelector('.vocab-skill-ring span');if(ring)ring.textContent='8Q';
}
function bindOriginalFrame(){
 const d=appDocument();if(!d||d.documentElement.dataset.ftRealtimeExtensionBound==='1')return;
 d.documentElement.dataset.ftRealtimeExtensionBound='1';
 const characterBack=d.getElementById('ftCharacterBack');
 if(characterBack){
  characterBack.hidden=false;
  characterBack.textContent='← 교재로 돌아가기';
 }
 prepareCard();
 const observer=new MutationObserver(()=>prepareCard());
 observer.observe(d.body,{childList:true,subtree:true});
 d.addEventListener('click',event=>{
  const card=event.target.closest('#ftFreeTalkingCard');
  if(card){
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   // Let the ORIGINAL application open its existing character selector.
   d.getElementById('ftSpeakingCard')?.click();
   void openDemo();
   return;
  }
  const character=event.target.closest('#ftChooseWilli,#ftChooseLili,#ftChoosePigfish');
  if(character&&!d.getElementById('ftCharacter').hidden){
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   const type=character.id==='ftChooseLili'?'bunny':character.id==='ftChoosePigfish'?'pigfish':'willi';
   buttonState(type);
   return;
  }
  const characterBack=event.target.closest('#ftCharacterBack');
  if(characterBack&&!d.getElementById('ftCharacter').hidden){
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   frame.contentWindow.history.back();
   return;
  }
  const go=event.target.closest('#ftCharacterContinue');
  if(go&&!d.getElementById('ftCharacter').hidden){
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   if(!state.book||!state.unit){
    const label=d.getElementById('ftCharacterRound');
    if(label){label.hidden=false;label.textContent='교재를 확인하는 중입니다. 다시 눌러 주세요.';}
    return;
   }
   void startConversation();
  }
 },true);
}
frame.addEventListener('load',bindOriginalFrame);
// Module imports can finish after the iframe's load event, especially on fast networks.
if(frame.contentDocument?.readyState==='complete')bindOriginalFrame();
async function openDemo(){
 const d=appDocument();if(!d)return;
 const title=d.querySelector('#ftBookTabs .is-active')?.textContent?.trim();
 const unitMatch=(d.querySelector('#ftUnitTitle')?.textContent||'').match(/Unit\s+(\d+)/i);
 if(!title||!unitMatch){error('Choose a book and unit first.');return}
 error('');state.book=null;state.unit=null;state.seconds=180;state.character='willi';
 $('heading').textContent='Free Talking · 8 Questions';
 $('lesson').textContent=title+' · Unit '+unitMatch[1];
 // Stay on the ORIGINAL in-app friend-selection screen, not a duplicate overlay.
 const note=d.getElementById('ftCharacterRound');
 if(note){note.hidden=false;note.textContent='자유 대화 · 교재 질문 8개 · AI Willi / Bunny Fox / Pigfish';}
 const characterBack=d.getElementById('ftCharacterBack');
 if(characterBack)characterBack.hidden=false;

 try{
  const books=await contentDbGet('/rest/v1/content_books?select=id,title&title=eq.'+encodeURIComponent(title)+'&limit=2');
  const book=books.find(x=>x.title===title);if(!book)throw Error('Textbook not found in Content Database');
  const units=await contentDbGet('/rest/v1/content_units?select=id,title,unit_number&book_id=eq.'+book.id+'&unit_number=eq.'+unitMatch[1]+'&limit=2');
  if(!units.length)throw Error('Unit not found in Content Database');
  state.book=book;state.unit=units[0];
  $('lesson').textContent=book.title+' · Unit '+state.unit.unit_number+' · '+state.unit.title;
 }catch(e){
  const note=d.getElementById('ftCharacterRound');
  if(note){note.hidden=false;note.textContent='교재 정보를 불러오지 못했어요: '+e.message;}
  error('Could not load the selected lesson: '+e.message);
 }
}
function appendLine(who,text){
 if(!String(text||'').trim())return;
 const row=document.createElement('div');row.className='entry'+(who==='You'?' me':'');
 const heading=document.createElement('b');heading.textContent=who;
 const detail=document.createElement('span');detail.textContent=String(text).trim();
 row.append(heading,detail);$('log').append(row);
 if($('log').children.length>30)$('log').firstElementChild.remove();
 $('log').scrollTop=$('log').scrollHeight;
}
function actorPhase(phase){
 $('actorStage').dataset.phase=phase;
 const circle=$('ftTurnCircle');
 if(circle){
  circle.dataset.phase=phase==='speaking'?'ai':phase==='listening'?'student':phase==='thinking'?'thinking':'ready';
  circle.dataset.listening=phase==='listening'?'true':'false';
 }
 state.actor?.setSpeaking(phase==='speaking');
}
function showActor(){
 const originalCircle=appDocument()?.getElementById('ftTurnCircle');
 if(!originalCircle)throw Error('Original Free Talking character animation is unavailable');
 const host=$('actorStage');host.replaceChildren();
 // Clone the live app's REAL circle + original SVG and orbit markup.
 // The existing character-actor module adds the exact Bunny/Pigfish drawings,
 // same speaking-mouth animation and same character switching.
 const shell=document.createElement('div');
 shell.className='free-talking-genius';shell.id='ftExtensionOriginalShell';
 const session=document.createElement('section');
 session.id='ftSession';session.className='ft-conversation';
 session.hidden=false;
 const voice=document.createElement('section');
 voice.id='ftWilliVoice';voice.className='ft-willi-voice';
 const circle=originalCircle.cloneNode(true);
 circle.id='ftTurnCircle';circle.removeAttribute('aria-label');
 circle.type='button';circle.disabled=true;
 // Remove the original app's record button handler by cloning just the DOM.
 voice.append(circle);session.append(voice);shell.append(session);host.append(shell);
 state.actor=createFreeTalkingCharacters({circle,session,voiceHost:voice,choices:{}});
 state.actor.select(state.character==='bunny'?'bunny-v3':state.character==='pigfish'?'pigfish':'marin');
 actorPhase('ready');
}
function stopSpeech(){
 state.generation++;
 try{state.controller?.abort()}catch{}
 state.controller=null;
 if(state.speaker){try{state.speaker.pause();state.speaker.src='';state.speaker.load()}catch{}}
 if(state.mediaURL){URL.revokeObjectURL(state.mediaURL);state.mediaURL=null}
 state.speaker=null;state.playing=null;
}
function endSession(reason='Conversation finished.'){
 clearInterval(state.timer);state.timer=null;
 clearTimeout(state.anchorTimer);state.anchorTimer=null;state.anchorToken++;
 for(const entry of state.anchorClipCache.values())if(entry?.owned)URL.revokeObjectURL(entry.url);
 state.anchorClipCache.clear();state.anchorClipPromises.clear();state.anchors=[];state.anchorPhase='idle';state.anchorResponding=false;state.guidedSessionReady=false;
 stopMicMonitor();
 state.actor?.setSpeaking(false);state.actor=null;
 stopSpeech();
 try{state.channel?.close()}catch{};try{state.peer?.close()}catch{};
 try{state.stream?.getTracks().forEach(t=>t.stop())}catch{}
 if(state.remote){state.remote.pause();state.remote.srcObject=null;state.remote.remove()}
 state.peer=null;state.channel=null;state.stream=null;state.remote=null;state.remoteStream=null;state.active=false;state.starting=false;state.ttsPlaying=false;
 if(state.audioContext){const context=state.audioContext;state.audioContext=null;state.audioGain=null;void context.close().catch(()=>{})}
 message(reason);actorPhase('ready');
 $('mute').disabled=true;$('end').disabled=true;
 $('restart').disabled=state.seconds===0;
}
$('back').addEventListener('click',navigateBack);
$('end').addEventListener('click',navigateBack);
window.addEventListener('pagehide',()=>{activeStartId++;try{startAbort?.abort()}catch{}endSession()});
$('mute').addEventListener('click',()=>{
 const track=state.stream?.getAudioTracks()[0];if(!track)return;
 state.micUserMuted=!state.micUserMuted;
 track.enabled=!state.micUserMuted&&!state.ttsPlaying;
 $('mute').textContent=state.micUserMuted?'Unmute microphone':'Mute microphone';
 message(state.micUserMuted?'Microphone muted':state.ttsPlaying?'AI is speaking':'Listening…');
});
$('restart').addEventListener('click',()=>{
 if(state.starting)return;
 if(state.active){
  // A reconnect replaces the current connection and retains the selected character.
  endSession('Reconnecting…');
 }
 void startConversation();
});
$('volume').addEventListener('input',()=>{resumeMixer();setAudioLevels()});
$('testVoice').addEventListener('click',()=>{
 if(state.voiceMode!=='eleven'||!state.active)return;
 error('');
 // This bypasses OpenAI response-generation: it verifies voice, proxy and MP3 playback.
 void speakEleven('Hello! Let us talk about your lesson.');
});
$('soundFallback').addEventListener('click',()=>{
 // Retain a reliable browser speaker path, with a choice to switch it back.
 state.quietMode=!state.quietMode;
 $('soundFallback').textContent=state.quietMode?'Use phone speaker':'Use adjustable quiet sound';
 if(state.active||state.starting){
  message('Sound mode changed. End and restart to apply the new audio route.');
 }else setAudioLevels();
});
function ticking(){
 clearInterval(state.timer);state.seconds=180;
 const render=()=>{$('clock').textContent=String(Math.floor(state.seconds/60)).padStart(2,'0')+':'+String(state.seconds%60).padStart(2,'0')};
 render();
 state.timer=setInterval(()=>{
  state.seconds=Math.max(0,state.seconds-1);render();
  if(!state.seconds)endSession('Three minutes finished. Great talking!');
 },1000);
}

// The published question IDs are the conversation track. Reactions and
// follow-ups are the only generated speech; question playback reuses Willena R2.
function guidedCharacterVoice(){
 return state.character==='bunny'?'bunny':state.character==='pigfish'?'pigfish':'marin';
}
function sendRealtime(item){
 if(state.channel?.readyState!=='open')return false;
 state.channel.send(JSON.stringify(item));return true;
}
function setMicEnabled(enabled){
 const mic=state.stream?.getAudioTracks()[0];
 if(mic)mic.enabled=Boolean(enabled)&&!state.micUserMuted;
}
async function getAnchorClip(anchor){
 const key=guidedCharacterVoice()+':'+anchor.id;
 if(state.anchorClipCache.has(key))return state.anchorClipCache.get(key);
 if(state.anchorClipPromises.has(key))return state.anchorClipPromises.get(key);
 const job=(async()=>{
  const call=async token=>fetch('/api/free-talking-audio',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({question_id:anchor.id,voice:guidedCharacterVoice(),
    ...(state.character==='bunny'?{compare_model:'eleven_v3'}:{})}),
   signal:AbortSignal.timeout(11000)
  });
  let r=await call(await originalStudentToken());
  if(r.status===401)r=await call(await originalStudentToken(true));
  const file=await r.json().catch(()=>null);
  if(!r.ok||file?.success!==true)throw Error(file?.error||('Question audio unavailable: '+r.status));
  let clip;
  if(typeof file.audio==='string'&&file.audio.length){
   const binary=atob(file.audio),bytes=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   clip={url:URL.createObjectURL(new Blob([bytes],{type:file.content_type==='audio/wav'?'audio/wav':'audio/mpeg'})),owned:true};
  }else if(file.audio_url?.startsWith('https://')){
   // A cross-origin media element routed into Web Audio can be silent unless
   // the host grants CORS. Prefer a same-origin Blob when possible.
   try{
    const cached=await fetch(file.audio_url,{signal:AbortSignal.timeout(18000)});
    if(!cached.ok)throw Error('Cached audio download failed');
    const blob=await cached.blob();
    if(blob.size<500)throw Error('Cached audio file is empty');
    clip={url:URL.createObjectURL(blob),owned:true};
   }catch{
    clip={url:file.audio_url,owned:false,direct:true};
   }
  }else throw Error('Cached question audio was empty');
  state.anchorClipCache.set(key,clip);
  return clip;
 })().finally(()=>state.anchorClipPromises.delete(key));
 state.anchorClipPromises.set(key,job);return job;
}
function playLocalClip(url,direct=false){
 return new Promise((resolve,reject)=>{
  const audio=new Audio();state.speaker=audio;state.playing=audio;
  audio.preload='auto';audio.setAttribute('playsinline','');
  if(direct){audio.volume=Math.min(1,volumeFraction())}else routeAudio(audio);
  audio.src=url;
  state.ttsPlaying=true;setMicEnabled(false);actorPhase('speaking');
  let settled=false;
  const finish=error=>{
   if(settled)return;settled=true;
   audio.onended=null;audio.onerror=null;
   if(error)reject(error);else resolve();
  };
  audio.onended=()=>finish();
  audio.onerror=()=>finish(Error('Audio playback failed'));
  audio.play().catch(finish);
 });
}
async function playAnchor(index){
 if(!state.active||index>=state.anchors.length)return;
 const anchor=state.anchors[index];
 const run=++state.anchorToken;
 state.anchorIndex=index;state.anchorPhase='playingAnchor';state.anchorResponding=false;
 $('clock').textContent='Question '+(index+1)+' / '+state.anchors.length;
 $('anchorText').textContent=anchor.text;
 message('Playing textbook question '+(index+1));
 setMicEnabled(false);
 // OpenAI must see what the cached voice asked, or it can hallucinate the
 // context of a short student answer like "Pizza!".
 sendRealtime({type:'conversation.item.create',item:{type:'message',role:'assistant',
  content:[{type:'output_text',text:anchor.text}]}});
 appendLine(NAMES[state.character],anchor.text);
 try{
  const clip=await getAnchorClip(anchor);
  if(!state.active||run!==state.anchorToken)return;
  await playLocalClip(clip.url,clip.direct===true);
 }catch(e){
  if(!state.active||run!==state.anchorToken)return;
  console.warn('[Guided Free Talking] cached anchor unavailable',e);
  message('Using voice fallback for this textbook question');
  try{
   const r=await authorizedDemoFetch('/api/free-talking-realtime-eleven',
    {character:state.character,text:anchor.text});
   if(!r.ok)throw Error('Voice fallback failed ('+r.status+')');
   const blob=await r.blob();
   const url=URL.createObjectURL(blob);
   try{await playLocalClip(url)}finally{URL.revokeObjectURL(url)}
  }catch(ex){error('Question audio: '+ex.message)}
 }
 if(!state.active||run!==state.anchorToken)return;
 state.ttsPlaying=false;setMicEnabled(true);state.playing=null;
 state.anchorPhase='awaitingFirst';actorPhase('listening');
 message('Your turn. Answer the question!');
 $('listenCheck').textContent='Listening for your answer';
 // Preload just the next anchor while the student answers this one.
 if(index+1<state.anchors.length)void getAnchorClip(state.anchors[index+1]).catch(()=>{});
}
function requestGuidedReply(){
 if(!state.active||state.anchorResponding)return;
 const phase=state.anchorPhase;
 if(phase!=='awaitingFirst'&&phase!=='awaitingSecond')return;
 const anchor=state.anchors[state.anchorIndex];if(!anchor)return;
 state.anchorResponding=true;
 state.anchorPhase=phase==='awaitingFirst'?'respondingFirst':'respondingSecond';
 state.anchorResponseText='';
 const directive=phase==='awaitingFirst'
  ?'FOLLOW-UP TURN. The student just answered this anchor: "'+anchor.text+'". Respond naturally in 2–6 words, then ask ONE short level-appropriate follow-up about the SAME answer and topic. Never ask the next textbook question. Do not invent facts.'
  :'REACTION ONLY TURN. The student just answered a follow-up to "'+anchor.text+'". React to what they ACTUALLY said in 2–8 words. Do NOT ask a question. The app plays the NEXT cached textbook question. Never invent facts.';
 sendRealtime({type:'conversation.item.create',item:{type:'message',role:'system',
  content:[{type:'input_text',text:directive}]}});
 if(!sendRealtime({type:'response.create',response:{output_modalities:['text']}})){
  state.anchorResponding=false;state.anchorPhase=phase;
  error('Conversation connection closed. Please retry.');
 }else{actorPhase('thinking');message('Thinking about your answer…')}
}
async function finishGuidedReply(data){
 const phase=state.anchorPhase;
 if(phase!=='respondingFirst'&&phase!=='respondingSecond')return;
 state.anchorResponding=false;
 const text=String(data.response?.output?.flatMap(x=>x.content||[])
  .map(x=>x.text||x.transcript||'').filter(Boolean).join(' ')||state.anchorResponseText||'').trim();
 state.anchorResponseText='';
 const run=state.anchorToken,index=state.anchorIndex;
 state.anchorPhase='playingReply';
 setMicEnabled(false);
 if(text){
  await speakEleven(text);
 }else{
  error('No response text was returned. Advancing the lesson.');
 }
 if(!state.active||run!==state.anchorToken)return;
 if(phase==='respondingFirst'){
  state.anchorPhase='awaitingSecond';setMicEnabled(true);actorPhase('listening');
  message('Your turn. Answer the follow-up question!');
  $('listenCheck').textContent='Listening for your follow-up answer';
 }else if(index+1>=state.anchors.length){
  state.anchorPhase='finished';endSession('All '+state.anchors.length+' questions finished. Great talking!');
  $('clock').textContent=state.anchors.length+' / '+state.anchors.length+' complete';
  $('anchorText').textContent='Excellent! You finished your conversation.';
 }else{
  state.anchorPhase='betweenAnchors';
  void playAnchor(index+1);
 }
}
function handleRealtime(data){
 if(!state.active&&!state.starting)return;
 switch(data.type){
  case 'session.updated':
   state.guidedSessionReady=true;
   if(state.active&&state.anchorPhase==='ready')void playAnchor(0);
   break;
  case 'input_audio_buffer.speech_started':
   if(state.ttsPlaying||state.anchorPhase==='playingAnchor'||state.anchorPhase==='playingReply')break;
   state.serverHeard=true;$('listenCheck').textContent='AI heard your voice';
   actorPhase('listening');message('Listening…');break;
  case 'input_audio_buffer.speech_stopped':
   if(state.ttsPlaying)break;
   state.serverHeard=true;$('listenCheck').textContent='Speech received';
   actorPhase('thinking');message('Checking your answer…');break;
  case 'input_audio_buffer.committed':
   // VAD auto-commits student audio, but never automatically generates replies.
   // We request the appropriate reaction/follow-up deterministically.
   if(!state.ttsPlaying)requestGuidedReply();
   break;
  case 'response.output_text.delta':case 'response.text.delta':
   state.anchorResponseText+=data.delta||'';break;
  case 'conversation.item.input_audio_transcription.completed':
   if(data.transcript){state.serverHeard=true;appendLine('You',data.transcript)}
   break;
  case 'response.done':
   void finishGuidedReply(data).catch(e=>error('Conversation response: '+e.message));break;
  case 'error':error('Realtime: '+String(data.error?.message||'Unknown error').slice(0,160));break;
 }
}
async function speakEleven(text){
 if(!state.active||!text)return;
 stopSpeech(); // abort any previous utterance before starting this reply
 const current=state.generation;
 appendLine(NAMES[state.character],text);
 actorPhase('ready');message(NAMES[state.character]+' is speaking…');
 const control=new AbortController();state.controller=control;
 try{
  if(!state.active||current!==state.generation)return;
  const response=await authorizedDemoFetch('/api/free-talking-realtime-eleven',{character:state.character,text},control.signal);
  if(!response.ok){const e=await response.json().catch(()=>({}));throw Error(e.error||'ElevenLabs unavailable ('+response.status+')')}
  if(current!==state.generation||!state.active)return;
  // Android: avoid MediaSource audio/mpeg support differences. The server
  // requests ElevenLabs Flash streaming, then the browser plays its short MP3.
  const blob=await response.blob();
  if(control.signal.aborted||current!==state.generation||!state.active)return;
  if(blob.size<500)throw Error('ElevenLabs returned an empty recording');
  const audio=new Audio();state.speaker=audio;state.playing=audio;
  routeAudio(audio);actorPhase('speaking');
  state.mediaURL=URL.createObjectURL(blob);
  audio.src=state.mediaURL;
  message(NAMES[state.character]+' is speaking…');
  // Half-duplex while ElevenLabs speaks. Without this, the phone's own
  // speaker audio trips server VAD and immediately aborts the TTS playback.
  state.ttsPlaying=true;
  const mic=state.stream?.getAudioTracks()[0];
  if(mic)mic.enabled=false;
  await audio.play();
  await new Promise(resolve=>{
   if(audio.ended){resolve();return}
   audio.onended=resolve;audio.onerror=resolve;
   control.signal.addEventListener('abort',resolve,{once:true});
  });
  if(state.active&&current===state.generation){actorPhase('listening');message('Your turn.');state.playing=null}
 }catch(e){if(e.name!=='AbortError'&&state.active){error('ElevenLabs audio: '+e.message);message('Voice playback failed — see the error below')}}
 finally{
  if(current===state.generation){
   state.ttsPlaying=false;
   const mic=state.stream?.getAudioTracks()[0];
   if(mic&&state.active)mic.enabled=!state.micUserMuted;
  }
 }
}
async function startConversation(){
 if(state.starting||state.active||!state.unit||!state.book)return;
 state.starting=true;error('');state.alreadySpoken=false;state.turnText='';state.pendingText=false;
 createAudioMixer();
 const startId=++activeStartId;
 startAbort=new AbortController();
 // Add a real top-level history entry AFTER the original app's character
 // screen, so native Back visits character selection before the unit screen.
 if(!hasActivityHistory())history.pushState({...history.state,[EXT_NAV_KEY]:'activity'},'');
 veil.hidden=false;$('talk').classList.add('is-visible');
 $('heading').textContent='Talk with '+NAMES[state.character];
 $('log').replaceChildren();message('Connecting…');
 $('mute').disabled=false;$('end').disabled=false;$('mute').textContent='Mute microphone';
 const character=state.character;state.voiceMode='eleven'; // guided text responses use controlled TTS for ALL three voices
 $('testVoice').hidden=state.character==='willi';
 try{
  showActor();
  const res=await authorizedDemoFetch('/api/free-talking-realtime-lab',{book_id:state.book.id,unit_id:state.unit.id,guided:true},startAbort.signal);
  if(startId!==activeStartId)return;
  const session=await res.json().catch(()=>({}));
  if(startId!==activeStartId)return;
  if(session.lesson){
   const l=session.lesson;
   $('lesson').textContent=(l.book||state.book.title)+' · Unit '+(l.unit_number||state.unit.unit_number)+' · '+(l.unit||state.unit.title);
   $('lessonFocus').textContent='Lesson focus: '+(l.grammar||l.prompts?.[0]||l.unit||'Current unit');
  }
  if(!res.ok||!session.token)throw Error(session.error||'Realtime connection failed');
  state.anchors=Array.isArray(session.lesson?.anchors)?session.lesson.anchors.filter(x=>x.id&&x.text).slice(0,8):[];
  if(!state.anchors.length)throw Error('This unit has no published question anchors');
  state.anchorIndex=0;state.anchorPhase='ready';state.anchorResponding=false;state.anchorResponseText='';state.guidedSessionReady=false;
  $('clock').textContent='Question 1 / '+state.anchors.length;
  $('anchorText').textContent=state.anchors[0].text;
  const peer=new RTCPeerConnection();state.peer=peer;
  if(state.voiceMode==='audio'){
   const audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;
   state.remote=audio;document.body.append(audio);
   routeAudio(audio);
   peer.ontrack=e=>{
    state.remoteStream=e.streams?.[0]||new MediaStream([e.track]);
    audio.srcObject=state.remoteStream;
    resumeMixer();
    void audio.play().catch(ex=>error('Speaker could not play: '+ex.message));
    actorPhase('speaking');
   };
  }
  const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  state.stream=mic;
  if(startId!==activeStartId){mic.getTracks().forEach(t=>t.stop());return}
  monitorMicrophone(mic);
  peer.addTrack(mic.getAudioTracks()[0],mic);
  const channel=peer.createDataChannel('oai-events');state.channel=channel;
  channel.onclose=()=>{if(state.active)$('listenCheck').textContent='AI data connection closed'};
  peer.onconnectionstatechange=()=>{
   if(peer.connectionState==='failed'||peer.connectionState==='disconnected'){
    $('listenCheck').textContent='Voice connection '+peer.connectionState;
    if(state.active)error('Voice connection interrupted. Press Retry connection.');
   }
  };
  channel.onmessage=e=>{try{handleRealtime(JSON.parse(e.data))}catch(err){console.warn(err)}};
  channel.onopen=()=>{
   // Start as soon as the data channel connects; no need to wait for
   // session.updated, which can be absent after negotiating a Realtime call.
   state.guidedSessionReady=true;
   channel.send(JSON.stringify({type:'session.update',session:{type:'realtime',output_modalities:['text'],audio:{input:{turn_detection:{type:'semantic_vad',eagerness:'medium',create_response:false,interrupt_response:false}}}}}));
   if(state.active&&state.anchorPhase==='ready')void playAnchor(0);
  };
  const offer=await peer.createOffer();await peer.setLocalDescription(offer);
  const answer=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/sdp'},body:offer.sdp,signal:AbortSignal.timeout(18000)});
  if(startId!==activeStartId)return;
  if(!answer.ok)throw Error('Realtime negotiation failed ('+answer.status+')');
  await peer.setRemoteDescription({type:'answer',sdp:await answer.text()});
  if(startId!==activeStartId)return;
  startAbort=null;
  state.micUserMuted=false;state.ttsPlaying=false;
  state.active=true;state.starting=false;message('Connected · starting cached textbook question');actorPhase('ready');
  if(state.guidedSessionReady&&state.anchorPhase==='ready')void playAnchor(0);
  setTimeout(()=>{
   if(state.active&&state.anchorPhase==='ready'&&state.channel?.readyState==='open')void playAnchor(0);
  },900);
  $('listenCheck').textContent='Listen to the question, then answer';$('restart').disabled=true;
 }catch(e){
  if(startId!==activeStartId)return;
  console.error('[Free Talking Realtime demo] failed to start',e);
  // Never kick the student out on an error. Keep the session screen and actionable message.
  endSession('Connection failed. Use Back to return to your lesson.');
  error('Could not start: '+(e?.message||'Unknown connection error'));
  $('restart').disabled=false;
  $('listenCheck').textContent='Connection failed · retry available';
 }
}
