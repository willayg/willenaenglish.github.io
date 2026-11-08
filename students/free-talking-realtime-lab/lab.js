// Separate AI Willi Realtime lab; NEVER imported by the live Free Talking app.
import {studentIdentity,signedInProfile,staffAccessToken,loadTeacherBookCatalog,loadUnits,assignedBooks} from '/students/sentence-genius/content.js?v=20261024-wg-auth1';
const $=id=>document.getElementById(id);
const state={identity:null,profile:null,books:[],units:[],peer:null,stream:null,channel:null,audio:null,endTimer:null,seconds:180,active:false,busy:false,muted:false,turns:0,lesson:null};
const params=new URLSearchParams(location.search);
function status(text,phase='ready'){ $('phase').textContent=text;$('orb').dataset.phase=phase; }
function fail(text){$('error').textContent=String(text||'Unexpected error');status('Not connected','ready');}
const choice=select=>select.options[select.selectedIndex]?.textContent||'';
function clear(el){el.replaceChildren();}
function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o}
function setAvailable(){ $('start').disabled=state.busy||state.active||!$('unit').value; $('stop').disabled=!state.active&&!state.busy;$('mute').disabled=!state.active;$('book').disabled=state.active||state.busy||!state.books.length;$('unit').disabled=state.active||state.busy||!state.units.length; }
function addLine(who,text){
 if(!String(text||'').trim())return;
 const host=$('history'),row=document.createElement('div'),title=document.createElement('b'),body=document.createElement('span');
 row.className='line'+(who==='You'?' me':'');
 title.textContent=who;body.textContent=String(text).trim();row.append(title,body);host.append(row);
 if(host.children.length>40)host.firstElementChild.remove();
 host.scrollTop=host.scrollHeight;
}
function stop(){
 clearInterval(state.endTimer);state.endTimer=null;state.active=false;state.busy=false;
 try{state.channel?.close()}catch{}
 try{state.peer?.close()}catch{}
 try{state.stream?.getTracks().forEach(track=>track.stop())}catch{}
 if(state.audio){state.audio.pause();state.audio.srcObject=null;state.audio.remove()}
 state.peer=null;state.stream=null;state.channel=null;state.audio=null;state.muted=false;state.turns=0;$('mute').textContent='Mute mic';$('timer').textContent='03:00 maximum';
 setAvailable();status('Session ended. Choose a lesson or start again.','ready');
}
function countdown(){
 clearInterval(state.endTimer);state.seconds=180;
 state.endTimer=setInterval(()=>{
  state.seconds=Math.max(0,state.seconds-1);
  $('timer').textContent=String(Math.floor(state.seconds/60)).padStart(2,'0')+':'+String(state.seconds%60).padStart(2,'0')+' remaining';
  if(!state.seconds)stop();
 },1000);
}
async function userToken(){
 return await staffAccessToken();
}
async function loadUnitsForBook(){
 state.units=[];clear($('unit'));$('start').disabled=true;
 const id=$('book').value;
 if(!id){setAvailable();return}
 status('Loading the lesson…');
 try{
  const rows=await loadUnits(id);
  state.units=rows.sort((a,b)=>Number(a.unit_number)-Number(b.unit_number));
  for(const u of state.units)$('unit').append(option(u.id,'Unit '+u.unit_number+' · '+u.title));
  const desired=Number(params.get('unit'));
  if(desired&&state.units.some(u=>Number(u.unit_number)===desired))$('unit').value=state.units.find(u=>Number(u.unit_number)===desired).id;
  showUnit();
  status('Ready! Press Start talking.');
 }catch(e){fail('Could not load units: '+e.message)}
 setAvailable();
}
function showUnit(){
 const u=state.units.find(x=>x.id===$('unit').value);
 state.lesson=null;
 $('focus').textContent=u?.metadata?.grammar||u?.metadata?.main_grammar_points||('Talk about '+(u?.title||'this unit')+' using simple English.');
 const chips=$('examples');clear(chips);
 const p=document.createElement('span');p.className='chip';p.textContent=u?.title||'Select a unit';chips.append(p);
}
async function init(){
 try{
  status('Checking your Willena login…');
  const identity=await studentIdentity();
  const profile=await signedInProfile(identity.id);
  if(!['student','teacher','admin','owner'].includes(profile.role)||!profile.approved)throw Error('An approved student or teacher login is required');
  state.identity=identity;state.profile=profile;
  const books=profile.role==='student'
   ?await assignedBooks(profile.className||identity.className)
   :await loadTeacherBookCatalog();
  state.books=books.sort((a,b)=>a.title.localeCompare(b.title));
  clear($('book'));
  for(const b of state.books)$('book').append(option(b.id,b.title));
  if(params.get('book_id')&&state.books.some(b=>b.id===params.get('book_id')))$('book').value=params.get('book_id');
  if(!state.books.length)throw Error('No textbook assignment found');
  $('book').addEventListener('change',()=>{params.delete('unit');void loadUnitsForBook()});
  $('unit').addEventListener('change',showUnit);
  await loadUnitsForBook();
 }catch(e){fail(e.message+' · Sign in at students.willenaenglish.com first.')}
}
function handleEvent(data){
 switch(data.type){
 case 'input_audio_buffer.speech_started':status('Listening to you…','listening');break;
 case 'input_audio_buffer.speech_stopped':status('Thinking…','ready');break;
 case 'response.created':status('AI Willi is answering…','speaking');break;
 case 'response.done':status('Your turn! Speak naturally.','listening');break;
 case 'response.audio_transcript.done':case 'response.output_audio_transcript.done':
  if(data.transcript)addLine('AI Willi',data.transcript);break;
 case 'conversation.item.input_audio_transcription.completed':
  if(data.transcript){addLine('You',data.transcript);state.turns++;if(state.turns>=16){status('Great work! Ending this practice session.');setTimeout(stop,2000)}}
  break;
 case 'error':{const msg=data.error?.message||'Realtime audio error';fail(msg.slice(0,220));break}
 }
}
async function start(){
 if(state.busy||state.active||!$('unit').value)return;
 state.busy=true;setAvailable();$('error').textContent='';
 status('Checking your lesson…');clear($('history'));
 try{
  const token=await userToken();
  const r=await fetch('/api/free-talking-realtime-lab',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({book_id:$('book').value,unit_id:$('unit').value})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.token)throw Error(data.error||'Could not start Realtime ('+r.status+')');
  state.lesson=data.lesson;
  $('focus').textContent=data.lesson.grammar||('Conversation about '+data.lesson.unit);
  clear($('examples'));
  for(const x of [...data.lesson.vocabulary.slice(0,12),...data.lesson.examples.slice(0,4)]){const el=document.createElement('span');el.className='chip';el.textContent=x;$('examples').append(el)}
  const peer=new RTCPeerConnection();state.peer=peer;
  const audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');state.audio=audio;document.body.append(audio);
  peer.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>{})};
  peer.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(peer.connectionState)&&state.active){fail('Voice connection disconnected');stop()}};
  status('Allow microphone access…');
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  state.stream=stream;peer.addTrack(stream.getAudioTracks()[0],stream);
  const channel=peer.createDataChannel('oai-events');state.channel=channel;
  channel.onmessage=e=>{try{handleEvent(JSON.parse(e.data))}catch{}};
  channel.onopen=()=>{
   status('Willi is starting the conversation…','speaking');
   channel.send(JSON.stringify({type:'response.create',response:{instructions:'Say hello briefly, mention the unit topic, and ask one easy, personal question. Keep your response under 30 words.'}}));
  };
  const offer=await peer.createOffer();await peer.setLocalDescription(offer);
  const connect=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:'Bearer '+data.token,'Content-Type':'application/sdp'},body:offer.sdp});
  if(!connect.ok)throw Error('Realtime audio negotiation failed ('+connect.status+')');
  await peer.setRemoteDescription({type:'answer',sdp:await connect.text()});
  state.busy=false;state.active=true;setAvailable();countdown();
 }catch(e){stop();fail(e.message)}
}
$('start').addEventListener('click',()=>void start());
$('stop').addEventListener('click',stop);
$('mute').addEventListener('click',()=>{
 state.muted=!state.muted;
 state.stream?.getAudioTracks().forEach(t=>{t.enabled=!state.muted});
 $('mute').textContent=state.muted?'Unmute mic':'Mute mic';
 status(state.muted?'Microphone muted':'Your turn! Speak naturally.',state.muted?'ready':'listening');
});
window.addEventListener('pagehide',stop);
void init();
