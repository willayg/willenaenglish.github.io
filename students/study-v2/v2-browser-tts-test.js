(function(){
'use strict';
var host=String(location.hostname||'').toLowerCase();
if(host!=='staging.willenaenglish.com'&&!host.endsWith('.pages.dev'))return;

var wrap=document.createElement('div');
wrap.id='browserTtsTest';
wrap.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99999;display:flex;flex-direction:column;gap:6px;align-items:flex-start;max-width:min(92vw,430px);font-family:Poppins,system-ui,sans-serif';

function makeBtn(label){
  var b=document.createElement('button');
  b.type='button';b.textContent=label;
  b.style.cssText='border:2px solid #173f46;border-radius:999px;background:#fff;padding:9px 14px;font:700 12px/1 Poppins,system-ui,sans-serif;color:#173f46;box-shadow:0 5px 18px rgba(0,0,0,.12)';
  return b;
}
var bareBtn=makeBtn('1. Bare TTS');
var noCancelBtn=makeBtn('2. en-US · no cancel');
var oldBtn=makeBtn('3. Yesterday exact');
var pickedBtn=makeBtn('4. Picked voice · no cancel');
var status=document.createElement('div');
status.textContent='staging only';
status.style.cssText='display:none;background:#173f46;color:#fff;border-radius:10px;padding:7px 9px;font:600 11px/1.35 Poppins,system-ui,sans-serif;word-break:break-word';
wrap.appendChild(bareBtn);wrap.appendChild(noCancelBtn);wrap.appendChild(oldBtn);wrap.appendChild(pickedBtn);wrap.appendChild(status);document.body.appendChild(wrap);

function show(msg){status.textContent=msg;status.style.display='block';}
function getVoices(){try{return window.speechSynthesis?window.speechSynthesis.getVoices()||[]:[];}catch(_){return[];}}
function pick(list){
  return list.find(function(v){return !!v.default&&/^en/i.test(v.lang||'');})||
         list.find(function(v){return /^en-US$/i.test(v.lang||'');})||
         list.find(function(v){return /^en/i.test(v.lang||'');})||list[0]||null;
}
function state(synth){
  try{return 'speaking='+!!synth.speaking+' · pending='+!!synth.pending+' · paused='+!!synth.paused;}catch(_){return 'state unavailable';}
}
function run(label,build,start){
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){show('NOT SUPPORTED: speechSynthesis unavailable');return;}
  var synth=window.speechSynthesis,list=getVoices(),u=build(list);
  var defaultVoice=list.find(function(v){return !!v.default;})||null;
  var meta='voices='+list.length+(defaultVoice?' · default='+defaultVoice.name+' ('+defaultVoice.lang+')':' · no default voice');
  show('REQUESTED · '+label+' · '+meta+' · '+state(synth));
  var finished=false;
  u.onstart=function(){finished=true;show('STARTED · '+label+' · '+meta+' · '+state(synth));};
  u.onend=function(){finished=true;show('FINISHED · '+label+' · '+meta+' · '+state(synth));};
  u.onerror=function(e){finished=true;show('ERROR: '+String(e&&e.error||'unknown')+' · '+label+' · '+meta+' · '+state(synth));};
  try{start(synth,u);}catch(e){finished=true;show('THREW: '+String(e&&e.message||e)+' · '+label+' · '+meta);}
  setTimeout(function(){if(!finished)show('NO EVENT · '+label+' · '+meta+' · '+state(synth));},2000);
}

/* Absolute minimum Web Speech call. No cancel, voice, lang, rate, resume, or other state changes. */
bareBtn.addEventListener('click',function(){
  run('BARE',function(){return new SpeechSynthesisUtterance('Hello. This is a test.');},function(synth,u){synth.speak(u);});
});

/* Same basic utterance settings as Study, but deliberately does NOT call cancel(). */
noCancelBtn.addEventListener('click',function(){
  run('EN-US NO CANCEL',function(){var u=new SpeechSynthesisUtterance('This is the browser text to speech test.');u.lang='en-US';u.rate=.9;return u;},function(synth,u){synth.speak(u);});
});

/* Exact audio click code from the Aug 14 shared Study engine that was working before the compatibility layer. */
oldBtn.addEventListener('click',function(){
  run('YESTERDAY EXACT',function(){var u=new SpeechSynthesisUtterance('This is the browser text to speech test.');u.lang='en-US';u.rate=.9;return u;},function(synth,u){synth.cancel();synth.speak(u);});
});

/* Explicit English voice, but no cancel/resume. This isolates voice selection from queue cancellation. */
pickedBtn.addEventListener('click',function(){
  run('PICKED NO CANCEL',function(list){var u=new SpeechSynthesisUtterance('This is the browser text to speech test.');var voice=pick(list);if(voice)u.voice=voice;u.lang=voice&&voice.lang?voice.lang:'en-US';u.rate=.9;return u;},function(synth,u){synth.speak(u);});
});
})();
