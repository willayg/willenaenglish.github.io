(function(global){
'use strict';
if(!global.WillenaActivityEngine||!global.WillenaActivityEngine.prototype)return;
var proto=global.WillenaActivityEngine.prototype;
if(proto.__willenaAudioPlayback)return;
var originalRender=proto.render;
var currentUtterance=null;
var currentSource=null;
var audioContext=null;
var runId=0;
var API_ORIGIN='https://api.willenaenglish.com';
var API_BASE=API_ORIGIN+'/.netlify/functions/';
var AUDIO_LOOKUP=API_BASE+'get_audio_urls';
var TTS_GENERATE=API_BASE+'eleven_labs_proxy';
var AUDIO_UPLOAD=API_BASE+'upload_audio';
var generatedBuffers=new Map();
var generationLocks=new Map();

function text(v){return String(v==null?'':v).replace(/\\n/g,'\n').trim();}
function unique(items){var out=[];items.forEach(function(v){v=text(v);if(v&&out.indexOf(v)<0)out.push(v);});return out;}
function spokenText(activity){var s=activity&&activity.stimulus||{};return text(s.text||s.transcript||s.prompt);}
function audioCandidates(activity){
  var a=activity||{},s=a.stimulus||{},m=a.metadata||{},spoken=spokenText(a);
  return unique([
    s.audioKey,s.audio_key,s.ttsKey,s.tts_key,
    m.audioKey,m.audio_key,m.ttsKey,m.tts_key,
    spoken
  ]);
}
function r2Key(value){
  return text(value).toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'');
}
function directR2Url(value){
  var key=r2Key(value);
  return key?API_ORIGIN+'/audio/'+encodeURIComponent(key+'.mp3'):'';
}
function getAudioContext(){
  var AC=global.AudioContext||global.webkitAudioContext;
  if(!AC)return null;
  try{
    if(!audioContext)audioContext=new AC();
    if(audioContext.state==='suspended')audioContext.resume().catch(function(){});
    return audioContext;
  }catch(_){return null;}
}
function stopCurrent(){
  try{if(currentSource)currentSource.stop(0);}catch(_){}
  currentSource=null;
  try{if(global.speechSynthesis)global.speechSynthesis.cancel();}catch(_){}
  currentUtterance=null;
}
async function findStoredAudio(candidates){
  if(!candidates.length)return'';
  try{
    var r=await fetch(AUDIO_LOOKUP,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify({words:candidates})});
    if(!r.ok)return'';
    var d=await r.json().catch(function(){return{};});
    var results=d&&d.results||{};
    for(var i=0;i<candidates.length;i++){
      var key=candidates[i],info=results[key];
      if(info&&info.exists&&info.url)return text(info.url);
    }
  }catch(_){}
  return'';
}
async function playDecodedBuffer(buffer,ctx,myRun,button){
  if(!buffer||!ctx||myRun!==runId)return false;
  try{
    var decoded=await ctx.decodeAudioData(buffer.slice(0));
    if(myRun!==runId)return false;
    var source=ctx.createBufferSource();
    source.buffer=decoded;
    source.connect(ctx.destination);
    currentSource=source;
    source.onended=function(){
      if(myRun!==runId)return;
      if(currentSource===source)currentSource=null;
      button.classList.remove('is-playing');
      button.classList.add('has-played');
    };
    source.start(0);
    button.classList.add('is-playing','has-played');
    return true;
  }catch(_){return false;}
}
async function playStored(url,ctx,myRun,button,noCache){
  if(!url||!ctx||myRun!==runId)return false;
  try{
    var r=await fetch(url,{cache:noCache?'no-store':'force-cache'});
    if(!r.ok)return false;
    return await playDecodedBuffer(await r.arrayBuffer(),ctx,myRun,button);
  }catch(_){return false;}
}
async function playDirectR2(spoken,ctx,myRun,button){
  var url=directR2Url(spoken);
  if(!url)return false;
  return playStored(url,ctx,myRun,button,true);
}
function pickVoice(synth,lang){
  var voices=[];try{voices=synth.getVoices()||[];}catch(_){}
  if(!voices.length)return null;
  var wanted=text(lang||'en-US').toLowerCase();
  var exact=voices.find(function(v){return text(v.lang).toLowerCase()===wanted;});
  if(exact)return exact;
  var us=voices.find(function(v){return /^en-us/i.test(text(v.lang));});
  if(us)return us;
  var en=voices.find(function(v){return /^en/i.test(text(v.lang));});
  return en||voices[0]||null;
}
function speakWithVoice(button,activity,myRun){
  return new Promise(function(resolve){
    var synth=global.speechSynthesis,Utterance=global.SpeechSynthesisUtterance;
    var spoken=spokenText(activity),stimulus=activity&&activity.stimulus||{};
    if(!spoken||!synth||!Utterance||myRun!==runId){resolve(false);return;}
    var finished=false,startTimer=null;
    function finish(ok){if(finished)return;finished=true;if(startTimer)clearTimeout(startTimer);resolve(ok);}
    var u=new Utterance(spoken);currentUtterance=u;
    var voice=pickVoice(synth,stimulus.lang);
    if(voice)u.voice=voice;
    u.lang=text(voice&&voice.lang||stimulus.lang)||'en-US';
    var rate=Number(stimulus.rate);u.rate=Number.isFinite(rate)&&rate>0?rate:.9;
    u.pitch=1;u.volume=1;
    u.onstart=function(){if(myRun!==runId)return;button.classList.add('is-playing','has-played');finish(true);};
    u.onend=function(){if(myRun!==runId)return;button.classList.remove('is-playing');button.classList.add('has-played');};
    u.onerror=function(){if(myRun!==runId)return;button.classList.remove('is-playing');finish(false);};
    try{synth.cancel();synth.resume();synth.speak(u);}catch(_){finish(false);return;}
    startTimer=setTimeout(function(){
      if(finished||myRun!==runId)return;
      try{synth.cancel();}catch(_){}
      button.classList.remove('is-playing');
      finish(false);
    },1800);
  });
}
function base64Buffer(b64){
  try{
    var raw=global.atob(String(b64||'')),out=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
    return out.buffer;
  }catch(_){return null;}
}
function getGeneratedBuffer(spoken){
  var key=r2Key(spoken);
  return key&&generatedBuffers.has(key)?generatedBuffers.get(key):null;
}
async function generateBufferOnce(spoken){
  var key=r2Key(spoken);
  if(!key||!spoken||spoken.length>400)return null;
  if(generatedBuffers.has(key))return generatedBuffers.get(key);
  if(generationLocks.has(key))return generationLocks.get(key);

  var job=(async function(){
    try{
      var r=await fetch(TTS_GENERATE,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify({text:spoken})});
      if(!r.ok)return null;
      var d=await r.json().catch(function(){return{};});
      if(!d||!d.audio)return null;
      var buffer=base64Buffer(d.audio);
      if(!buffer)return null;

      /* Cache immediately so one page session cannot spend ElevenLabs credits twice
         for the same sentence even if the R2 write is still settling. */
      generatedBuffers.set(key,buffer.slice(0));

      /* Save before we move on to the browser-TTS fallback. A failed upload does not
         discard usable generated audio, but it is no longer a fire-and-forget write. */
      try{
        await fetch(AUDIO_UPLOAD,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify({word:spoken,fileDataBase64:d.audio})});
      }catch(_){}
      return buffer;
    }catch(_){return null;}
    finally{generationLocks.delete(key);}
  })();
  generationLocks.set(key,job);
  return job;
}
async function generateAndPlay(activity,ctx,myRun,button){
  var spoken=spokenText(activity);
  if(!spoken||!ctx||myRun!==runId)return false;
  var buffer=await generateBufferOnce(spoken);
  if(!buffer||myRun!==runId)return false;
  return playDecodedBuffer(buffer,ctx,myRun,button);
}
async function playAudio(button,activity){
  var myRun=++runId;
  stopCurrent();
  button.classList.remove('has-played');
  button.classList.add('is-playing');

  var ctx=getAudioContext();
  var spoken=spokenText(activity);

  /* 1. R2 first. Probe the deterministic sentence filename directly, then the
     broader lookup path for older/curriculum-specific audio keys. */
  if(spoken&&ctx){
    var directOk=await playDirectR2(spoken,ctx,myRun,button);
    if(myRun!==runId)return;
    if(directOk)return;
  }
  var stored=await findStoredAudio(audioCandidates(activity));
  if(myRun!==runId)return;
  if(stored&&ctx){
    var storedOk=await playStored(stored,ctx,myRun,button,false);
    if(storedOk)return;
  }

  /* Same-page replay guard. This sits between the R2 miss and any paid generation,
     so a just-generated sentence cannot burn credits twice. */
  var memory=getGeneratedBuffer(spoken);
  if(memory&&ctx){
    var memoryOk=await playDecodedBuffer(memory,ctx,myRun,button);
    if(memoryOk)return;
  }

  /* 2. ElevenLabs second: generate once, save to R2, then play the real MP3. */
  var generated=await generateAndPlay(activity,ctx,myRun,button);
  if(myRun!==runId)return;
  if(generated)return;

  /* 3. Browser TTS is now the last fallback only. */
  var speechOk=await speakWithVoice(button,activity,myRun);
  if(myRun!==runId)return;
  if(!speechOk)button.classList.remove('is-playing','has-played');
}

proto.render=function(){
  var result=originalRender.apply(this,arguments);
  var engine=this,a=engine.current;
  var old=engine.root&&engine.root.querySelector&&engine.root.querySelector('.activity-audio');
  if(!old||!a||!a.stimulus||a.stimulus.type!=='audio')return result;
  var button=old.cloneNode(true);
  old.replaceWith(button);
  button.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    playAudio(button,a);
  });
  return result;
};
proto.__willenaAudioPlayback=true;
})(window);
