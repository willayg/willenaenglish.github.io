// Demo overlay. The ORIGINAL Free Talking Genius runs unchanged inside the same-origin iframe.
// Everything here is additive; no production app source is patched.
import {contentDbGet} from '/students/shared/content-db.js?v=1.0.0';
import {createFreeTalkingCharacters} from '/students/free-talking-genius/character-actor.js?v=20261108-original-animation1';
const $=id=>document.getElementById(id);
const frame=$('original'),veil=$('demo');
const state={actor:null,book:null,unit:null,character:'willi',peer:null,channel:null,stream:null,remote:null,speaker:null,mediaURL:null,playing:null,controller:null,seconds:180,timer:null,active:false,starting:false,turnText:'',pendingText:false,alreadySpoken:false,generation:0,voiceMode:'audio',audioContext:null,audioGain:null,quietMode:true,remoteStream:null,linkedSources:new WeakSet(),micAnalyzer:null,micSource:null,micContext:null,micRaf:null,micNoiseSeen:false,serverHeard:false,micUserMuted:false,ttsPlaying:false,guided:true,anchors:[],anchorIndex:0,anchorPhase:'idle',anchorResponding:false,anchorClipCache:new Map(),anchorClipPromises:new Map(),anchorTimer:null,anchorResponseText:'',anchorToken:0,guidedSessionReady:false,lessonLevel:2,speechStartedAt:0,speechPeak:0,lastSpeechDuration:0,pendingSpeech:new Map(),verifiedAnswer:'',paused:false,resumeIndex:0,resumePhase:null,resumeLog:null,lastChoice:null,replyWasSecond:false,emotionTimer:null,idleTimer:null,sessionDeadline:null};
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
let lessonLoad=null;
function hasActivityHistory(){return history.state?.[EXT_NAV_KEY]==='activity'}
function closeActivity(){
 activeStartId++;
 try{startAbort?.abort()}catch{}
 startAbort=null;
 state.paused=false;state.resumeIndex=0;state.resumePhase=null;state.resumeLog=null;state.lastChoice=null;
 endSession('Conversation ended.');
 veil.hidden=true;
 $('talk').classList.remove('is-visible');
 $('volumeBox').hidden=true;$('volumeToggle').setAttribute('aria-expanded','false');
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
   if(state.speechStartedAt&&state.active&&
      (state.anchorPhase==='awaitingFirst'||state.anchorPhase==='awaitingSecond'))
     state.speechPeak=Math.max(state.speechPeak,level);
   $('micLevel').textContent='Mic level: '+level+'%';
   if(level>=5){state.micNoiseSeen=true;if(!state.serverHeard)$('listenCheck').textContent='Microphone picking up sound · waiting for AI';}
  };
  frame();
 }catch(ex){console.warn('Mic level monitor unavailable',ex);$('micLevel').textContent='Mic: connected'}
}

function message(s){$('status').textContent=s}
function error(s){$('error').textContent=s==null?'':String(s)}
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
   lessonLoad=openDemo();
   void lessonLoad.catch(e=>console.warn('[Guided Free Talking] initial lesson lookup failed',e));
   return;
  }
  const character=event.target.closest('#ftChooseWilli,#ftChooseLili,#ftChoosePigfish');
  if(character&&!d.getElementById('ftCharacter').hidden){
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   const type=character.id==='ftChooseLili'?'bunny':character.id==='ftChoosePigfish'?'pigfish':'willi';
   const secondTap=state.lastChoice===type;
   buttonState(type);state.lastChoice=type;
   if(secondTap)d.getElementById('ftCharacterContinue')?.click();
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
   void (async()=>{
    const goButton=d.getElementById('ftCharacterContinue');
    if(goButton)goButton.disabled=true;
    try{
     if(lessonLoad)await lessonLoad.catch(()=>{});
     if(!state.book||!state.unit){
      lessonLoad=openDemo({preserveCharacter:true});
      await lessonLoad;
     }
     if(!state.book||!state.unit)throw Error('Book or unit could not be loaded. Please choose the lesson again.');
     await startConversation();
    }catch(e){
     const label=d.getElementById('ftCharacterRound');
     if(label){label.hidden=false;label.textContent='시작할 수 없어요: '+(e?.message||'Please choose the unit again.');}
     console.error('[Guided Free Talking] start from character screen',e);
    }finally{
     if(goButton&&!state.starting&&!state.active)goButton.disabled=false;
    }
   })();
  }
 },true);
}
frame.addEventListener('load',bindOriginalFrame);
// Module imports can finish after the iframe's load event, especially on fast networks.
if(frame.contentDocument?.readyState==='complete')bindOriginalFrame();
async function openDemo({preserveCharacter=false}={}){
 const d=appDocument();if(!d)return;
 if(!preserveCharacter)state.lastChoice=null;
 const title=d.querySelector('#ftBookTabs .is-active')?.textContent?.trim();
 const unitMatch=(d.querySelector('#ftUnitTitle')?.textContent||'').match(/Unit\s+(\d+)/i);
 if(!title||!unitMatch){error('Choose a book and unit first.');throw Error('Choose a book and unit first.')}
 error('');state.book=null;state.unit=null;state.seconds=180;if(!preserveCharacter)state.character='willi';
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
  throw e;
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

function expressionFromText(text){
 const t=String(text||'').toLowerCase();
 if(/oh no|i'm sorry|that's sad|feel sad|poor you|too bad|unfortunately|miss you/.test(t))return 'sad';
 if(/watch out|that's dangerous|stop that|not okay|don't do|be careful|hey!/.test(t))return 'angry';
 if(/no way|whoa|wow|seriously|unbelievable|shocked/.test(t))return 'shocked';
 if(/really\?|huh\?|wait|oh\?|surpris/.test(t))return 'surprised';
 if(/hmm|i wonder|how come|why do|tell me/.test(t))return 'curious';
 if(/haha|ha!|great|awesome|cool|nice|fun|love|yes!|yay/.test(t))return 'happy';
 return 'neutral';
}
function setExpression(expression='neutral',duration=0){
 const actor=state.actor?.actor;if(!actor)return;
 const moods=['neutral','happy','sad','angry','surprised','shocked','curious'];
 const mood=moods.includes(expression)?expression:'neutral';
 clearTimeout(state.emotionTimer);state.emotionTimer=null;
 actor.dataset.expression=mood;
 const svg=actor.querySelector('svg.bf-svg');if(!svg)return;
 svg.querySelector('[data-extension-expression]')?.remove();
 if(mood==='neutral')return;
 const pig=state.character==='pigfish',stroke=pig?'#211715':'#211a15';
 const coords=pig?[[108,393,38,54],[319,412,39,54]]:[[218,330,39,47],[388,332,39,47]];
 let markup='';
 for(const [x,y,rx,ry] of coords){
  if(mood==='happy')markup+='<path d="M'+(x-rx)+' '+y+' Q'+x+' '+(y-ry*.86)+' '+(x+rx)+' '+y+'" fill="none" stroke="'+stroke+'" stroke-width="13" stroke-linecap="round"/>';
  else if(mood==='sad')markup+='<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx*.7+'" ry="'+ry*.8+'" fill="'+stroke+'"/><path d="M'+(x-rx)+' '+(y-ry)+' Q'+x+' '+(y-ry*.3)+' '+(x+rx)+' '+(y-ry*.7)+'" fill="none" stroke="'+stroke+'" stroke-width="10"/>';
  else{
   const wide=mood==='shocked'?1.13:mood==='surprised'?1:.78;
   markup+='<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx*wide+'" ry="'+ry*(mood==='shocked'?1.16:1)+'" fill="'+stroke+'"/>';
   if(mood==='angry')markup+='<path d="M'+(x-rx)+' '+(y-ry*1.2)+' L'+(x+rx)+' '+(y-ry*.62)+'" stroke="'+stroke+'" stroke-width="13" stroke-linecap="round"/>';
   if(mood==='curious')markup+='<path d="M'+(x-rx)+' '+(y-ry*1.3)+' Q'+x+' '+(y-ry*1.7)+' '+(x+rx)+' '+(y-ry*1.25)+'" fill="none" stroke="'+stroke+'" stroke-width="9"/>';
  }
 }
 const cx=pig?175:301,cy=pig?649:424;
 let mouth;
 if(mood==='surprised'||mood==='shocked')mouth='<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+(pig?27:16)+'" ry="'+(mood==='shocked'?(pig?37:27):(pig?23:18))+'" fill="#6e3443" stroke="'+stroke+'" stroke-width="6"/>';
 else if(mood==='sad')mouth='<path d="M'+(cx-36)+' '+(cy+20)+' Q'+cx+' '+(cy-20)+' '+(cx+36)+' '+(cy+20)+'" fill="none" stroke="'+stroke+'" stroke-width="9" stroke-linecap="round"/>';
 else if(mood==='angry')mouth='<path d="M'+(cx-36)+' '+(cy+7)+' Q'+cx+' '+(cy-16)+' '+(cx+36)+' '+(cy+7)+'" fill="none" stroke="'+stroke+'" stroke-width="9" stroke-linecap="round"/>';
 else mouth='<path d="M'+(cx-38)+' '+(cy-8)+' Q'+cx+' '+(cy+43)+' '+(cx+38)+' '+(cy-8)+'" fill="none" stroke="'+stroke+'" stroke-width="9" stroke-linecap="round"/>';
 const g=document.createElementNS('http://www.w3.org/2000/svg','g');
 g.setAttribute('data-extension-expression',mood);
 g.innerHTML=markup+'<g class="extension-expression-mouth">'+mouth+'</g>';
 svg.appendChild(g);
 if(duration)state.emotionTimer=setTimeout(()=>setExpression('neutral'),duration);
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
 const host=$('actorStage');host.replaceChildren();
 // Build the experimental actor locally. Do not clone, mutate or restyle
 // the original Speaking track's controls or transcript interface.
 const shell=document.createElement('div');shell.className='free-talking-genius';shell.id='ftExtensionOriginalShell';
 const session=document.createElement('section');session.id='ftSession';session.className='ft-conversation';session.hidden=false;
 const voice=document.createElement('section');voice.id='ftWilliVoice';voice.className='ft-willi-voice';
 const circle=document.createElement('button');
 circle.id='ftTurnCircle';circle.type='button';circle.disabled=true;circle.className='ft-turn-circle ft-extension-avatar';
 circle.setAttribute('aria-label','Conversation character');
 circle.innerHTML='<span class="ft-circle-glow"></span>'+
  '<span class="ft-circle-ai" aria-hidden="true"><span class="ft-circle-bars"><i></i><i></i><i></i><i></i><i></i></span></span>'+
  '<span class="ft-circle-mic" aria-hidden="true"><svg viewBox="0 0 48 48" width="72" height="72"><rect x="17" y="5" width="14" height="26" rx="7" fill="currentColor"/><path d="M11 22a13 13 0 0 0 26 0M24 35v8M16 43h16" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg></span>'+
  '<span class="ft-circle-thinking" aria-hidden="true"><span class="ft-thinking-swirl"></span></span>';
 voice.append(circle);session.append(voice);shell.append(session);host.append(shell);
 state.actor=createFreeTalkingCharacters({circle,session,voiceHost:voice,choices:{}});
 state.actor.select(state.character==='bunny'?'bunny-v3':state.character==='pigfish'?'pigfish':'marin');
 actorPhase('ready');setExpression('happy',1300);
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
 clearTimeout(state.idleTimer);state.idleTimer=null;
 clearTimeout(state.sessionDeadline);state.sessionDeadline=null;
 clearTimeout(state.anchorTimer);state.anchorTimer=null;state.anchorToken++;
 clearPendingSpeech();clearTimeout(state.emotionTimer);state.emotionTimer=null;
 state.speechStartedAt=0;state.speechPeak=0;state.lastSpeechDuration=0;state.verifiedAnswer='';
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
 $('pauseResume').disabled=!state.paused;
}
// Disconnect entirely during pause so silent WebRTC traffic cannot consume
// Realtime usage. Resume reconnects to the selected textbook question.
function setPauseButton(paused){
 const button=$('pauseResume');
 button.setAttribute('aria-pressed',String(paused));
 button.setAttribute('aria-label',paused?'Resume conversation':'Pause conversation');
 button.title=paused?'Resume conversation':'Pause conversation';
}
function pauseConversation(reason='Paused. Tap play to continue.'){
 if(state.paused||(!state.active&&!state.starting))return;
 const index=state.anchorIndex;
 const phase=state.anchorPhase;
 // Preserve where we are in the actual exchange, not just the question number.
 state.resumePhase=phase==='awaitingFirst'||phase==='awaitingSecond'?phase:
  phase==='respondingFirst'?'awaitingFirst':
  phase==='respondingSecond'?'awaitingSecond':
  phase==='playingReply'?(state.replyWasSecond?'awaitingSecond':'awaitingFirst'):null;
 state.resumeLog=[...$('log').querySelectorAll('.entry')].map(row=>({
  role:row.classList.contains('me')?'user':'assistant',
  text:row.querySelector('span')?.textContent||''
 })).filter(row=>row.text.trim()).slice(-12);
 activeStartId++;
 try{startAbort?.abort()}catch{}
 startAbort=null;
 state.paused=true;state.resumeIndex=index;
 endSession(reason);
 setPauseButton(true);
 $('listenCheck').textContent=reason;
 $('mute').disabled=true;
}
function armIdleTimeout(){
 clearTimeout(state.idleTimer);
 if(!state.active||state.paused)return;
 state.idleTimer=setTimeout(()=>{
  if(state.active&&!state.paused)pauseConversation('Paused after 60 seconds without an answer. Tap play to continue.');
 },60000);
}
$('pauseResume').addEventListener('click',()=>{
 if(state.paused){
  state.paused=false;setPauseButton(false);
  void startConversation().catch(e=>{
   error('Could not resume: '+(e?.message||'connection unavailable'));
   state.paused=true;setPauseButton(true);
  });
 }else pauseConversation();
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&(state.active||state.starting))pauseConversation('Paused in background. Tap play to continue.');
});
$('back').addEventListener('click',navigateBack);
$('end').addEventListener('click',navigateBack);
window.addEventListener('pagehide',()=>{activeStartId++;try{startAbort?.abort()}catch{}endSession()});
$('mute').addEventListener('click',()=>{
 const track=state.stream?.getAudioTracks()[0];if(!track)return;
 state.micUserMuted=!state.micUserMuted;
 track.enabled=!state.micUserMuted&&!state.ttsPlaying;
 $('mute').setAttribute('aria-pressed',String(state.micUserMuted));
 $('mute').setAttribute('aria-label',state.micUserMuted?'Unmute microphone':'Mute microphone');
 $('mute').title=state.micUserMuted?'Unmute microphone':'Mute microphone';
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
const volumeToggle=$('volumeToggle'),volumeBox=$('volumeBox');
function closeVolume(){
 volumeBox.hidden=true;
 volumeToggle.setAttribute('aria-expanded','false');
}
volumeToggle.addEventListener('click',event=>{
 event.stopPropagation();
 const opening=volumeBox.hidden;
 volumeBox.hidden=!opening;
 volumeToggle.setAttribute('aria-expanded',String(opening));
});
volumeBox.addEventListener('click',event=>event.stopPropagation());
volumeBox.addEventListener('pointerdown',event=>event.stopPropagation());
document.addEventListener('pointerdown',event=>{
 if(!volumeBox.hidden&&!volumeBox.contains(event.target)&&!volumeToggle.contains(event.target))closeVolume();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeVolume()});
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
function restoreAfterPause(){
 if(!state.active||!state.resumePhase||state.anchorPhase!=='ready')return false;
 const phase=state.resumePhase;state.resumePhase=null;
 const saved=state.resumeLog||[];state.resumeLog=null;
 const relevant=saved.slice(-8);
 for(const turn of relevant){
  sendRealtime({type:'conversation.item.create',item:{
   type:'message',role:turn.role,
   content:[{type:turn.role==='user'?'input_text':'output_text',text:turn.text}]
  }});
 }
 if(!relevant.length){
  const anchor=state.anchors[state.anchorIndex];
  if(anchor)sendRealtime({type:'conversation.item.create',item:{type:'message',role:'assistant',content:[{type:'output_text',text:anchor.text}]}});
 }
 state.anchorPhase=phase;
 state.ttsPlaying=false;setMicEnabled(true);actorPhase('listening');armIdleTimeout();
 message('Ready. Continue speaking.');$('listenCheck').textContent='Listening for your answer';
 return true;
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
 clearTimeout(state.idleTimer);state.idleTimer=null;
 state.anchorIndex=index;state.anchorPhase='playingAnchor';state.anchorResponding=false;
 state.speechStartedAt=0;state.speechPeak=0;state.lastSpeechDuration=0;clearPendingSpeech();
 $('clock').textContent='Question '+(index+1)+' / '+state.anchors.length;
 $('anchorText').textContent=anchor.text;
 message('Playing textbook question '+(index+1));
 setMicEnabled(false);
 // OpenAI must see what the cached voice asked, or it can hallucinate the
 // context of a short student answer like "Pizza!".
 sendRealtime({type:'conversation.item.create',item:{type:'message',role:'assistant',
  content:[{type:'output_text',text:anchor.text}]}});
 appendLine(NAMES[state.character],anchor.text);
 setExpression('curious',2200);
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
 armIdleTimeout();
 message('Your turn. Answer the question!');
 $('listenCheck').textContent='Listening for your answer';
 // Preload just the next anchor while the student answers this one.
 if(index+1<state.anchors.length)void getAnchorClip(state.anchors[index+1]).catch(()=>{});
}
function replyWordCap(level){return [6,8,9,10,11,12,13,14,15,16,17][Math.max(0,Math.min(10,Number(level)||0))]}
function reactionWordCap(level){return [3,4,5,6,7,7,8,8,9,9,10][Math.max(0,Math.min(10,Number(level)||0))]}
function shortenGuidedResponse(text,second,level){
 let value=String(text||'').replace(/\s+/g,' ').trim();
 value=value.replace(/\b(?:thanks for sharing|thanks for telling me(?: that)?|i appreciate you sharing|that's interesting to hear)\b[.!?, ]*/gi,'').trim();
 if(!value)return '';
 if(second){
  // A rhetorical interjection ("Really?") is fine, but not another
  // information-seeking follow-up after the child's second answer.
  value=value.replace(/\b(?:who|what|where|when|why|how|do|does|did|can|could|will|would|are|is|have|has)\b[^.!?]*\?/gi,'').replace(/\s+/g,' ').trim();
 }
 else{const q=value.indexOf('?');if(q>=0)value=value.slice(0,q+1);}
 const max=second?reactionWordCap(level):replyWordCap(level), words=value.split(/\s+/).filter(Boolean);
 if(words.length<=max)return value;
 if(!second&&value.includes('?')){
  // Save a short follow-up question rather than rambling introductory praise.
  const q=value.indexOf('?'),prior=value.slice(0,q+1);
  const boundary=Math.max(prior.lastIndexOf('.'),prior.lastIndexOf('!'));
  const question=prior.slice(boundary+1).trim();
  if(question.split(/\s+/).length<=max)return question;
 }
 const cut=words.slice(0,max).join(' ');
 const complete=cut.match(/^(.*[.!?])(?:\s|$)/);
 return complete?complete[1]:second?cut.replace(/[,:;.!?]+$/,'')+'.':cut;
}

function clearPendingSpeech(){
 for(const pending of state.pendingSpeech.values())clearTimeout(pending.timeout);
 state.pendingSpeech.clear();
}
function voiceTurnValid(text,pending){
 const transcript=String(text||'').replace(/\s+/g,' ').trim();
 const clean=transcript.replace(/[\p{P}\p{S}\s]/gu,'');
 const nonSpeech=/^(?:\[?silence\]?|\[?inaudible\]?|\[?noise\]?|\[?music\]?|\[?applause\]?|\[?background noise\]?|thank you for watching|thanks for watching|subtitles by.*)$/i;
 if(!clean||nonSpeech.test(transcript)||clean.length>400)return false;
 if(pending.duration<280)return false;
 // Allow very quiet, longer answers, but reject brief microphone glitches.
 if(pending.peak<5&&pending.duration<550)return false;
 return /[\p{L}\p{N}]/u.test(transcript);
}
function resolveCommittedSpeech(itemId,transcript,failed=false){
 const pending=state.pendingSpeech.get(itemId);
 if(!pending)return;
 clearTimeout(pending.timeout);state.pendingSpeech.delete(itemId);
 if(!state.active||pending.anchorToken!==state.anchorToken||pending.phase!==state.anchorPhase)return;
 if(failed||!voiceTurnValid(transcript,pending)){
  message('I could not hear an answer. Please speak again.');
  $('listenCheck').textContent='Listening for your answer';
  actorPhase('listening');
  // Remove unverified audio from conversation context.
  sendRealtime({type:'conversation.item.delete',item_id:itemId});
  return;
 }
 clearTimeout(state.idleTimer);state.idleTimer=null;
 state.serverHeard=true;
 appendLine('You',String(transcript||'').trim());
 state.verifiedAnswer=String(transcript||'').trim();
 requestGuidedReply();
}
function requestGuidedReply(){
 if(!state.active||state.anchorResponding)return;
 const phase=state.anchorPhase;
 if(phase!=='awaitingFirst'&&phase!=='awaitingSecond')return;
 const anchor=state.anchors[state.anchorIndex];if(!anchor)return;
 const second=phase==='awaitingSecond';
 state.anchorResponding=true;state.anchorResponseText='';
 state.anchorPhase=second?'respondingSecond':'respondingFirst';
 const cap=second?reactionWordCap(state.lessonLevel):replyWordCap(state.lessonLevel);
 const verified=String(state.verifiedAnswer||'').slice(0,350);state.verifiedAnswer='';
 const directive=[
  'Verified latest student speech: "'+verified+'". Base your answer ONLY on these actual words; do not invent student responses.',
  'Current textbook question: "'+anchor.text+'". React to the STUDENT\'S MOST RECENT ANSWER, not an earlier answer.',
  second
   ?'SECOND ANSWER. Make one short and genuinely relevant reaction or playful observation about what the student just said. NO QUESTION. Do NOT introduce the next topic, because the app will play the next cached question. You may occasionally finish with a tiny segue like "So..." or "Anyway...".'
   :'FIRST ANSWER. If appropriate, start with a tiny natural reaction, then ask exactly ONE follow-up QUESTION tied to a detail of the student\'s specific answer. End with that question. Do not ask the next textbook question.',
  'ABSOLUTE MAXIMUM '+cap+' SPOKEN WORDS. Prefer fewer. Never give a paragraph or list. Let the child do most of the talking.',
  'Use a little natural humour, everyday slang, interjections and linking words if they fit. Avoid robotic praise, thanks for sharing, thanks for telling me, and repetitive compliments.',
  'Stay within the selected Willena level and unit grammar. Do not invent details or claim to know how strangers really feel. A playful observation like "Ha! The other passengers must love that." can be fine if clearly teasing.',
  'If the child mentions a dangerous action, give a short appropriate safety boundary, not an extended lecture. If you cannot understand the answer, ask to repeat instead of guessing.'
 ].join(' ');
 if(!sendRealtime({type:'response.create',response:{output_modalities:['text'],instructions:directive}})){
  state.anchorResponding=false;state.anchorPhase=phase;error('Conversation connection closed. Please retry.');
 }else{actorPhase('thinking');message('Thinking about your answer…')}
}
async function finishConversation(){
 if(!state.active||state.anchorPhase==='finished'||state.anchorPhase==='goodbye')return;
 const run=state.anchorToken,count=state.anchors.length;
 state.anchorPhase='goodbye';setMicEnabled(false);
 $('listenCheck').textContent='Conversation complete';message('Finishing your conversation…');
 const goodbye=state.character==='pigfish'?'That was fun! Catch you later!':'That was fun! See you next time!';
 try{await speakEleven(goodbye)}catch(e){console.warn('Guided goodbye',e)}
 if(!state.active||run!==state.anchorToken)return;
 state.anchorPhase='finished';endSession('Conversation complete. See you next time!');
 $('clock').textContent=count+' / '+count+' complete';
 $('anchorText').textContent='Great talking! See you next time!';
 $('listenCheck').textContent='Finished';
}
async function finishGuidedReply(data){
 const phase=state.anchorPhase;
 if(phase!=='respondingFirst'&&phase!=='respondingSecond')return;
 const second=phase==='respondingSecond';
 state.anchorResponding=false;
 let responseText=String(data.response?.output?.flatMap(x=>x.content||[])
  .map(x=>x.text||x.transcript||'').filter(Boolean).join(' ')||state.anchorResponseText||'').trim();
 state.anchorResponseText='';
 responseText=shortenGuidedResponse(responseText,second,state.lessonLevel);
 setExpression(expressionFromText(responseText),4000);
 const run=state.anchorToken;state.replyWasSecond=second;state.anchorPhase='playingReply';setMicEnabled(false);
 if(responseText)await speakEleven(responseText);
 else if(!second)error('No follow-up returned. Please try again.');
 if(!state.active||run!==state.anchorToken)return;
 if(second){
  // Play next cached anchor only after the short reaction finishes speaking.
  state.anchorPhase='betweenAnchors';
  if(state.anchorIndex+1>=state.anchors.length)void finishConversation();
  else void playAnchor(state.anchorIndex+1);
 }else{
  state.anchorPhase='awaitingSecond';setMicEnabled(true);actorPhase('listening');
  armIdleTimeout();
  message('Your turn. Answer the follow-up question!');
  $('listenCheck').textContent='Listening for your follow-up answer';
 }
}
function handleRealtime(data){
 if(!state.active&&!state.starting)return;
 switch(data.type){
  case 'session.updated':
   state.guidedSessionReady=true;
   if(state.active&&state.anchorPhase==='ready'&&!restoreAfterPause())void playAnchor(state.anchorIndex);
   break;
  case 'input_audio_buffer.speech_started':
   if(state.ttsPlaying||!['awaitingFirst','awaitingSecond'].includes(state.anchorPhase))break;
   state.speechStartedAt=performance.now();state.speechPeak=0;
   $('listenCheck').textContent='Listening to your speech';actorPhase('listening');message('Listening…');break;
  case 'input_audio_buffer.speech_stopped':
   if(state.ttsPlaying||!state.speechStartedAt)break;
   state.lastSpeechDuration=Math.max(0,performance.now()-state.speechStartedAt);
   state.speechStartedAt=0;message('Checking your answer…');break;
  case 'input_audio_buffer.committed':{
   // VAD has committed audio, but that does NOT prove the child spoke.
   // Wait for an item-matched transcript, and reject silence/noise.
   if(state.ttsPlaying||!['awaitingFirst','awaitingSecond'].includes(state.anchorPhase))break;
   const id=String(data.item_id||'');if(!id||state.pendingSpeech.has(id))break;
   const record={phase:state.anchorPhase,anchorToken:state.anchorToken,
    duration:Number(state.lastSpeechDuration)||0,peak:state.speechPeak,timeout:null};
   record.timeout=setTimeout(()=>resolveCommittedSpeech(id,'',true),7500);
   state.pendingSpeech.set(id,record);state.lastSpeechDuration=0;state.speechPeak=0;
   break;
  }
  case 'response.output_text.delta':case 'response.text.delta':
   state.anchorResponseText+=data.delta||'';break;
  case 'conversation.item.input_audio_transcription.completed':
   resolveCommittedSpeech(String(data.item_id||''),data.transcript);
   break;
  case 'conversation.item.input_audio_transcription.failed':
   resolveCommittedSpeech(String(data.item_id||''),'',true);
   break;
  case 'response.done':
   void finishGuidedReply(data).catch(e=>error('Conversation response: '+e.message));break;
  case 'error':{
   const details=data.error||{};
   const reason=String(details.message||details.code||details.type||'Audio connection error');
   console.warn('[Free Talking] Realtime event error',details);
   error('Realtime: '+reason.slice(0,160));
   break;
  }
 }
}
async function speakEleven(text){
 if(!state.active||!text)return;
 stopSpeech(); // abort any previous utterance before starting this reply
 const current=state.generation;
 appendLine(NAMES[state.character],text);
 setExpression(expressionFromText(text),4000);
 actorPhase('ready');message(NAMES[state.character]+' is speaking…');
 const control=new AbortController();state.controller=control;
 try{
  if(!state.active||current!==state.generation)return;
  const response=await authorizedDemoFetch('/api/free-talking-realtime-eleven',{character:state.character,text},control.signal);
  if(!response.ok){const e=await response.json().catch(()=>({}));throw Error(e.error||'ElevenLabs unavailable ('+response.status+')')}
  if(current!==state.generation||!state.active)return;
  // Android: avoid MediaSource audio/mpeg support differences. The server
  // requests ElevenLabs v3 Conversational audio, then the browser plays its short MP3.
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
 if(state.starting||state.active)return;
 if(!state.unit||!state.book)throw Error('No lesson loaded. Select a book and unit first.');
 const continuing=Boolean(state.resumePhase);
 state.starting=true;state.paused=false;setPauseButton(false);
 $('pauseResume').disabled=false;
 error('');state.alreadySpoken=false;state.turnText='';state.pendingText=false;
 createAudioMixer();
 const startId=++activeStartId;
 startAbort=new AbortController();
 // Add a real top-level history entry AFTER the original app's character
 // screen, so native Back visits character selection before the unit screen.
 if(!hasActivityHistory())history.pushState({...history.state,[EXT_NAV_KEY]:'activity'},'');
 veil.hidden=false;$('talk').classList.add('is-visible');
 $('heading').textContent='Talk with '+NAMES[state.character];
 if(!continuing)$('log').replaceChildren();message('Connecting…');
 $('mute').disabled=false;$('end').disabled=false;
 $('mute').setAttribute('aria-pressed','false');
 $('mute').setAttribute('aria-label','Mute microphone');
 $('mute').title='Mute microphone';
 $('volumeBox').hidden=true;$('volumeToggle').setAttribute('aria-expanded','false');
 const character=state.character;state.voiceMode='eleven'; // guided text responses use controlled TTS for ALL three voices

 try{
  showActor();
  const res=await authorizedDemoFetch('/api/free-talking-realtime-lab',{book_id:state.book.id,unit_id:state.unit.id,guided:true},startAbort.signal);
  if(startId!==activeStartId)return;
  const session=await res.json().catch(()=>({}));
  if(startId!==activeStartId)return;
  if(session.lesson){
   const l=session.lesson;
   state.lessonLevel=Number.isInteger(l.level)?Math.max(0,Math.min(10,l.level)):2;
   $('lesson').textContent=(l.book||state.book.title)+' · Unit '+(l.unit_number||state.unit.unit_number)+' · '+(l.unit||state.unit.title);
   $('lessonFocus').textContent='Lesson focus: '+(l.grammar||l.prompts?.[0]||l.unit||'Current unit');
  }
  if(!res.ok||!session.token)throw Error(session.error||'Realtime connection failed');
  state.anchors=Array.isArray(session.lesson?.anchors)?session.lesson.anchors.filter(x=>x.id&&x.text).slice(0,8):[];
  if(!state.anchors.length)throw Error('This unit has no published question anchors');
  state.anchorIndex=Math.min(Math.max(0,state.resumeIndex||0),Math.max(0,state.anchors.length-1));state.anchorPhase='ready';state.anchorResponding=false;state.anchorResponseText='';state.guidedSessionReady=false;
  $('clock').textContent='Question '+(state.anchorIndex+1)+' / '+state.anchors.length;
  $('anchorText').textContent=state.anchors[state.anchorIndex].text;
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
   channel.send(JSON.stringify({type:'session.update',session:{type:'realtime',output_modalities:['text'],audio:{input:{
    transcription:{model:'gpt-4o-mini-transcribe',language:'en'},
    turn_detection:{type:'semantic_vad',eagerness:'medium',create_response:false,interrupt_response:false}
   }}}}));
   if(state.active&&state.anchorPhase==='ready'&&!restoreAfterPause())void playAnchor(state.anchorIndex);
  };
  const offer=await peer.createOffer();await peer.setLocalDescription(offer);
  const answer=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/sdp'},body:offer.sdp,signal:AbortSignal.timeout(18000)});
  if(startId!==activeStartId)return;
  if(!answer.ok)throw Error('Realtime negotiation failed ('+answer.status+')');
  await peer.setRemoteDescription({type:'answer',sdp:await answer.text()});
  if(startId!==activeStartId)return;
  startAbort=null;
  state.micUserMuted=false;state.ttsPlaying=false;
  state.active=true;state.starting=false;state.resumeIndex=0;
  message('Connected · starting cached textbook question');actorPhase('ready');
  clearTimeout(state.sessionDeadline);
  state.sessionDeadline=setTimeout(()=>{if(state.active)pauseConversation('Paused after 12 minutes. Tap play to continue.');},12*60*1000);
  if(state.guidedSessionReady&&state.anchorPhase==='ready'&&!restoreAfterPause())void playAnchor(state.anchorIndex);
  setTimeout(()=>{
   if(state.active&&state.anchorPhase==='ready'&&state.channel?.readyState==='open'&&!restoreAfterPause())void playAnchor(state.anchorIndex);
  },900);
  $('listenCheck').textContent='Listen to the question, then answer';$('restart').disabled=true;
 }catch(e){
  if(startId!==activeStartId)return;
  console.error('[Free Talking Realtime demo] failed to start',e);
  // Never kick the student out on an error. Keep the session screen and actionable message.
  endSession('Connection failed. Tap play to retry or go back.');
  state.paused=true;setPauseButton(true);
  error('Could not start: '+(e?.message||'Connection unavailable'));
  $('restart').disabled=false;
  $('listenCheck').textContent='Connection failed · retry available';
 }
}
