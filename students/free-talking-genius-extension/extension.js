// Demo overlay. The ORIGINAL Free Talking Genius runs unchanged inside the same-origin iframe.
// Everything here is additive; no production app source is patched.
import {BUNNY_FOX_ART,PIGFISH_ART} from '/students/free-talking-genius/character-art.js?v=20261107-pig-original4';
import {contentDbGet} from '/students/shared/content-db.js?v=1.0.0';
import {staffAccessToken} from '/students/sentence-genius/content.js?v=20261024-wg-auth1';
const $=id=>document.getElementById(id);
const frame=$('original'),veil=$('demo'),choices=[...document.querySelectorAll('.character')];
const state={book:null,unit:null,character:'willi',peer:null,channel:null,stream:null,remote:null,speaker:null,mediaURL:null,playing:null,controller:null,seconds:180,timer:null,active:false,starting:false,turnText:'',pendingText:false,alreadySpoken:false,generation:0,voiceMode:'audio'};
const NAMES={willi:'AI Willi',bunny:'Bunny Fox',pigfish:'Pigfish'};
const fixArt=(art,key)=>art.replaceAll('id="pigBody"','id="pigBody-'+key+'"').replaceAll('url(#pigBody)','url(#pigBody-'+key+')').replaceAll('id="pigBelly"','id="pigBelly-'+key+'"').replaceAll('url(#pigBelly)','url(#pigBelly-'+key+')');
$('bunnyPortrait').innerHTML=BUNNY_FOX_ART;
$('pigfishPortrait').innerHTML=fixArt(PIGFISH_ART,'demo-portrait');
function message(s){$('status').textContent=s}
function error(s){$('error').textContent=String(s||'Unknown error')}
function buttonState(c){state.character=c;for(const b of choices)b.setAttribute('aria-pressed',String(b.dataset.character===c));}
choices.forEach(b=>b.addEventListener('click',()=>buttonState(b.dataset.character)));
function appDocument(){try{return frame.contentDocument}catch{return null}}
function prepareCard(){
 const d=appDocument(),card=d?.getElementById('ftFreeTalkingCard');if(!card)return;
 if(card.dataset.extension==='ready')return;
 card.dataset.extension='ready';card.disabled=false;card.removeAttribute('aria-disabled');card.classList.remove('ft-coming-soon-card');
 card.setAttribute('aria-label','Free Talking · 3-minute conversation');
 card.style.cssText+=';opacity:1!important;filter:none!important;cursor:pointer;pointer-events:auto;';
 const step=card.querySelector('.vocab-skill-step');if(step)step.textContent='STEP 2';
 const detail=card.querySelector('.vocab-card-stars');if(detail)detail.textContent='3분 자유 대화 · 골든 유닛 조건 아님';
 const ring=card.querySelector('.vocab-skill-ring span');if(ring)ring.textContent='3m';
}
function bindOriginalFrame(){
 const d=appDocument();if(!d||d.documentElement.dataset.ftRealtimeExtensionBound==='1')return;
 d.documentElement.dataset.ftRealtimeExtensionBound='1';
 prepareCard();
 const observer=new MutationObserver(()=>prepareCard());
 observer.observe(d.body,{childList:true,subtree:true});
 d.addEventListener('click',event=>{
  if(!event.target.closest('#ftFreeTalkingCard'))return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  void openDemo();
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
 error('');state.book=null;state.unit=null;state.seconds=180;state.character='willi';buttonState('willi');
 $('heading').textContent='Choose your conversation friend';
 $('lesson').textContent=title+' · Unit '+unitMatch[1];
 $('choose').classList.remove('is-hidden');$('talk').classList.remove('is-visible');
 $('start').disabled=true;veil.hidden=false;
 try{
  const books=await contentDbGet('/rest/v1/content_books?select=id,title&title=eq.'+encodeURIComponent(title)+'&limit=2');
  const book=books.find(x=>x.title===title);if(!book)throw Error('Textbook not found in Content Database');
  const units=await contentDbGet('/rest/v1/content_units?select=id,title,unit_number&book_id=eq.'+book.id+'&unit_number=eq.'+unitMatch[1]+'&limit=2');
  if(!units.length)throw Error('Unit not found in Content Database');
  state.book=book;state.unit=units[0];
  $('lesson').textContent=book.title+' · Unit '+state.unit.unit_number+' · '+state.unit.title;
  $('start').disabled=false;
 }catch(e){error('Could not load the selected lesson: '+e.message)}
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
function actorPhase(phase){$('actorStage').dataset.phase=phase;const a=$('demoActor');if(a)a.dataset.state=phase==='speaking'?'speaking':phase==='listening'?'listening':'idle'}
function showActor(){
 $('actorStage').replaceChildren();
 if(state.character==='willi'){const orb=document.createElement('div');orb.className='willi-stage';orb.innerHTML='<i></i>';$('actorStage').append(orb)}
 else{const div=document.createElement('div');div.id='demoActor';div.className='demo-actor bf-actor';div.dataset.state='idle';div.innerHTML=state.character==='bunny'?BUNNY_FOX_ART:fixArt(PIGFISH_ART,'demo-stage');$('actorStage').append(div)}
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
 stopSpeech();
 try{state.channel?.close()}catch{};try{state.peer?.close()}catch{};
 try{state.stream?.getTracks().forEach(t=>t.stop())}catch{}
 if(state.remote){state.remote.pause();state.remote.srcObject=null;state.remote.remove()}
 state.peer=null;state.channel=null;state.stream=null;state.remote=null;state.active=false;state.starting=false;
 message(reason);actorPhase('ready');
 $('mute').disabled=true;$('end').disabled=true;
}
function back(){endSession('Finished.');veil.hidden=true}
$('back').addEventListener('click',back);$('end').addEventListener('click',()=>endSession('Conversation ended.'));
window.addEventListener('pagehide',()=>endSession());
$('mute').addEventListener('click',()=>{
 const track=state.stream?.getAudioTracks()[0];if(!track)return;
 track.enabled=!track.enabled;$('mute').textContent=track.enabled?'Mute microphone':'Unmute microphone';
 message(track.enabled?'Listening…':'Microphone muted');
});
$('volume').addEventListener('input',()=>{
 const v=Number($('volume').value)/100;$('volumeNumber').textContent=Math.round(v*100)+'%';
 if(state.remote)state.remote.volume=v;
 if(state.speaker)state.speaker.volume=v;
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
function handleRealtime(data){
 if(!state.active&&!state.starting)return;
 switch(data.type){
 case 'session.updated':
  if(state.voiceMode==='eleven'&&!state.alreadySpoken){state.alreadySpoken=true;
   state.channel.send(JSON.stringify({type:'response.create',response:{output_modalities:['text'],instructions:'Greet the child in under 5 words, then ask one easy question from this unit. MAXIMUM 15 words.'}}));
  }break;
 case 'input_audio_buffer.speech_started':
  if(state.voiceMode==='eleven'&&state.playing)stopSpeech();
  actorPhase('listening');message('Listening…');break;
 case 'input_audio_buffer.speech_stopped':actorPhase('ready');message('Thinking…');break;
 case 'response.created':message('Thinking…');break;
 case 'response.output_text.delta':case 'response.text.delta':
  state.turnText+=data.delta||'';break;
 case 'response.output_text.done':case 'response.text.done':{
  const text=String(data.text||state.turnText).trim();state.turnText='';
  if(text&&!state.pendingText){state.pendingText=true;void speakEleven(text).finally(()=>{state.pendingText=false})}
  break;
 }
 case 'response.audio_transcript.done':case 'response.output_audio_transcript.done':
  if(state.voiceMode==='audio'&&data.transcript)appendLine('AI Willi',data.transcript);break;
 case 'conversation.item.input_audio_transcription.completed':
  if(data.transcript)appendLine('You',data.transcript);break;
 case 'response.done':
  if(state.voiceMode==='eleven'){
   if(state.turnText.trim()&&!state.pendingText){const text=state.turnText.trim();state.turnText='';state.pendingText=true;void speakEleven(text).finally(()=>{state.pendingText=false})}
  }else{actorPhase('listening');message('Your turn.')}
  break;
 case 'error':error('Realtime: '+String(data.error?.message||'Unknown error').slice(0,180));break;
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
  const token=await staffAccessToken();
  if(!state.active||current!==state.generation)return;
  const response=await fetch('/api/free-talking-realtime-eleven',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({character:state.character,text}),signal:control.signal});
  if(!response.ok){const e=await response.json().catch(()=>({}));throw Error(e.error||'ElevenLabs unavailable ('+response.status+')')}
  if(current!==state.generation||!state.active)return;
  const audio=new Audio();audio.volume=Number($('volume').value)/100;state.speaker=audio;state.playing=audio;actorPhase('speaking');
  if(window.MediaSource?.isTypeSupported?.('audio/mpeg')&&response.body){
   const media=new MediaSource();state.mediaURL=URL.createObjectURL(media);audio.src=state.mediaURL;
   await new Promise((resolve,reject)=>{media.addEventListener('sourceopen',resolve,{once:true});media.addEventListener('error',reject,{once:true})});
   if(control.signal.aborted)return;
   const buffer=media.addSourceBuffer('audio/mpeg');
   const reader=response.body.getReader();let began=false;
   while(true){
    const next=await reader.read();if(next.done)break;
    if(control.signal.aborted||current!==state.generation){await reader.cancel().catch(()=>{});return}
    await new Promise((resolve,reject)=>{
     buffer.addEventListener('updateend',resolve,{once:true});buffer.addEventListener('error',reject,{once:true});buffer.appendBuffer(next.value);
    });
    if(!began){began=true;void audio.play().catch(err=>{if(!control.signal.aborted)error('Speaker blocked: '+err.message)})}
   }
   if(media.readyState==='open'&&!buffer.updating)media.endOfStream();
  }else{
   const blob=await response.blob();if(control.signal.aborted||current!==state.generation)return;
   state.mediaURL=URL.createObjectURL(blob);audio.src=state.mediaURL;await audio.play();
  }
  await new Promise(resolve=>{if(audio.ended){resolve();return}audio.onended=resolve;audio.onerror=resolve;control.signal.addEventListener('abort',resolve,{once:true})});
  if(state.active&&current===state.generation){actorPhase('listening');message('Your turn.')}
 }catch(e){if(e.name!=='AbortError'&&state.active)error('ElevenLabs audio: '+e.message)}
}
async function startConversation(){
 if(state.starting||state.active||!state.unit||!state.book)return;
 state.starting=true;error('');state.alreadySpoken=false;state.turnText='';state.pendingText=false;
 $('choose').classList.add('is-hidden');$('talk').classList.add('is-visible');
 $('heading').textContent='Talk with '+NAMES[state.character];
 $('log').replaceChildren();showActor();message('Connecting…');
 $('mute').disabled=false;$('end').disabled=false;$('mute').textContent='Mute microphone';
 const character=state.character;state.voiceMode=character==='willi'?'audio':'eleven';
 try{
  const token=await staffAccessToken();
  const res=await fetch('/api/free-talking-realtime-lab',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({book_id:state.book.id,unit_id:state.unit.id})});
  const session=await res.json().catch(()=>({}));if(!res.ok||!session.token)throw Error(session.error||'Realtime connection failed');
  const peer=new RTCPeerConnection();state.peer=peer;
  if(state.voiceMode==='audio'){
   const audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;audio.volume=Number($('volume').value)/100;
   state.remote=audio;document.body.append(audio);
   peer.ontrack=e=>{audio.srcObject=e.streams[0];void audio.play().catch(()=>{});actorPhase('speaking')};
  }
  const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  state.stream=mic;peer.addTrack(mic.getAudioTracks()[0],mic);
  const channel=peer.createDataChannel('oai-events');state.channel=channel;
  channel.onmessage=e=>{try{handleRealtime(JSON.parse(e.data))}catch(err){console.warn(err)}};
  channel.onopen=()=>{
   if(state.voiceMode==='eleven'){
    channel.send(JSON.stringify({type:'session.update',session:{type:'realtime',output_modalities:['text'],audio:{input:{turn_detection:{type:'semantic_vad',eagerness:'medium',create_response:true,interrupt_response:true}}}}}));
   }else{state.alreadySpoken=true;channel.send(JSON.stringify({type:'response.create',response:{instructions:'Say a brief greeting and ONE easy question about the selected unit. Under 15 words.'}}))}
  };
  const offer=await peer.createOffer();await peer.setLocalDescription(offer);
  const answer=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/sdp'},body:offer.sdp});
  if(!answer.ok)throw Error('Realtime negotiation failed ('+answer.status+')');
  await peer.setRemoteDescription({type:'answer',sdp:await answer.text()});
  state.active=true;state.starting=false;message('Connected. Say hello!');actorPhase('listening');ticking();
 }catch(e){error(e.message);endSession('Could not connect.');$('choose').classList.remove('is-hidden');$('talk').classList.remove('is-visible');$('heading').textContent='Choose your conversation friend'}
}
$('start').addEventListener('click',()=>void startConversation());
