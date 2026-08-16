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
var API_BASE='https://api.willenaenglish.com/.netlify/functions/';
var AUDIO_LOOKUP=API_BASE+'get_audio_urls';
var TTS_GENERATE=API_BASE+'eleven_labs_proxy';
var AUDIO_UPLOAD=API_BASE+'upload_audio';

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
async function playStored(url,ctx,myRun,button){
  if(!url||!ctx||myRun!==runId)return false;
  try{
    var r=await fetch(url,{cache:'force-cache'});
    if(!r.ok)return false;
    return await playDecodedBuffer(await r.arrayBuffer(),ctx,myRun,button);
  }catch(_){return false;}
}
function pickVoice(synth,lang){
  var voices=[];try{voices=synth.getVoices()||[];}catch(_){}
  if(!voices.length)return null;
  var wanted=text(lang||'en-US').toLowerCase();
  var exact=voices.find(function(v){return text(v.lang).toLowerCase()===wanted;});
  if(exact)return exact;
  var preferred=voices.find(function(v){return /^en-us/i.test(text(v.lang))&&/(female|zira|aria|jenny|samantha|allison|emily|lisa|michelle|google us english)/i.test(text(v.name));});
  if(preferred)return preferred;
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
    var finished=false,voiceListener=null,voiceTimer=null,startTimer=null;
    function cleanup(){
      if(voiceListener)try{synth.removeEventListener('voiceschanged',voiceListener);}catch(_){}
      if(voiceTimer)clearTimeout(voiceTimer);
      if(startTimer)clearTimeout(startTimer);
    }
    function finish(ok){if(finished)return;finished=true;cleanup();resolve(ok);}
    function launch(voice){
      if(finished||myRun!==runId)return;
      var u=new Utterance(spoken);currentUtterance=u;
      if(voice)u.voice=voice;
      u.lang=text(voice&&voice.lang||stimulus.lang)||'en-US';
      var rate=Number(stimulus.rate);u.rate=Number.isFinite(rate)&&rate>0?rate:.9;
      u.pitch=1;u.volume=1;
      u.onstart=function(){if(myRun!==runId)return;button.classList.add('is-playing','has-played');finish(true);};
      u.onend=function(){if(myRun!==runId)return;button.classList.remove('is-playing');button.classList.add('has-played');};
      u.onerror=function(){if(myRun!==runId)return;button.classList.remove('is-playing');finish(false);};
      try{synth.resume();synth.speak(u);}catch(_){finish(false);return;}
      /* Only onstart counts as success. Some Android builds sit in pending forever
         without producing sound; treat that as a failure and use real MP3 audio. */
      startTimer=setTimeout(function(){
        if(finished||myRun!==runId)return;
        try{synth.cancel();}catch(_){}
        button.classList.remove('is-playing');
        finish(false);
      },1500);
    }
    var voice=pickVoice(synth,stimulus.lang);
    if(voice){launch(voice);return;}
    voiceListener=function(){var loaded=pickVoice(synth,stimulus.lang);if(loaded)launch(loaded);};
    try{synth.addEventListener('voiceschanged',voiceListener);}catch(_){}
    try{synth.getVoices();}catch(_){}
    voiceTimer=setTimeout(function(){if(!finished&&myRun===runId)launch(pickVoice(synth,stimulus.lang));},500);
  });
}
function base64Buffer(b64){
  try{
    var raw=global.atob(String(b64||'')),out=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
    return out.buffer;
  }catch(_){return null;}
}
async function generateAndPlay(activity,ctx,myRun,button){
  var spoken=spokenText(activity);
  if(!spoken||spoken.length>400||!ctx||myRun!==runId)return false;
  try{
    var r=await fetch(TTS_GENERATE,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify({text:spoken})});
    if(!r.ok)return false;
    var d=await r.json().catch(function(){return{};});
    if(!d||!d.audio)return false;
    var buffer=base64Buffer(d.audio);
    if(!buffer||myRun!==runId)return false;
    var played=await playDecodedBuffer(buffer,ctx,myRun,button);
    if(played){
      /* Cache the generated listening clip globally so the next student gets the R2
         version instead of generating it again. Upload is best-effort and non-blocking. */
      fetch(AUDIO_UPLOAD,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({word:spoken,fileDataBase64:d.audio})}).catch(function(){});
    }
    return played;
  }catch(_){return false;}
}
async function playAudio(button,activity){
  var myRun=++runId;
  stopCurrent();
  button.classList.remove('has-played');
  button.classList.add('is-playing');

  /* Unlock WebAudio from the actual tap. This keeps later network-fetched MP3 playback
     legal on Android even though the fetch itself is asynchronous. */
  var ctx=getAudioContext();
  var stored=await findStoredAudio(audioCandidates(activity));
  if(myRun!==runId)return;
  if(stored&&ctx){
    var storedOk=await playStored(stored,ctx,myRun,button);
    if(storedOk)return;
  }

  var speechOk=await speakWithVoice(button,activity,myRun);
  if(myRun!==runId||speechOk)return;

  /* Final fallback: create one real MP3 through the existing Willena TTS service,
     play it through the already-unlocked AudioContext, and cache it to R2. */
  var generated=await generateAndPlay(activity,ctx,myRun,button);
  if(myRun!==runId)return;
  if(!generated){button.classList.remove('is-playing','has-played');}
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
