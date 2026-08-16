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
var localBtn=makeBtn('5. Local English voice');
var networkBtn=makeBtn('6. Network English voice');
var status=document.createElement('div');
status.textContent='staging only';
status.style.cssText='display:none;background:#173f46;color:#fff;border-radius:10px;padding:7px 9px;font:600 11px/1.35 Poppins,system-ui,sans-serif;word-break:break-word';
[bareBtn,noCancelBtn,oldBtn,pickedBtn,localBtn,networkBtn,status].forEach(function(x){wrap.appendChild(x);});
document.body.appendChild(wrap);

function show(msg){status.textContent=msg;status.style.display='block';}
function getVoices(){try{return window.speechSynthesis?window.speechSynthesis.getVoices()||[]:[];}catch(_){return[];}}
function english(list){return list.filter(function(v){return /^en/i.test(String(v&&v.lang||''));});}
function voiceText(v){return v?(String(v.name||'?')+' ('+String(v.lang||'?')+') · local='+!!v.localService+' · default='+!!v.default):'none';}
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
  if(!u)return;
  var defaultVoice=list.find(function(v){return !!v.default;})||null;
  var en=english(list),localEn=en.filter(function(v){return !!v.localService;}),networkEn=en.filter(function(v){return !v.localService;});
  var meta='voices='+list.length+' · English='+en.length+' · local English='+localEn.length+' · network English='+networkEn.length+(defaultVoice?' · default='+voiceText(defaultVoice):' · no default voice');
  if(u.__diagVoice)meta+=' · chosen='+voiceText(u.__diagVoice);
  show('REQUESTED · '+label+' · '+meta+' · '+state(synth));
  var finished=false;
  u.onstart=function(){finished=true;show('STARTED · '+label+' · '+meta+' · '+state(synth));};
  u.onend=function(){finished=true;show('FINISHED · '+label+' · '+meta+' · '+state(synth));};
  u.onerror=function(e){finished=true;show('ERROR: '+String(e&&e.error||'unknown')+' · '+label+' · '+meta+' · '+state(synth));};
  try{start(synth,u);}catch(e){finished=true;show('THREW: '+String(e&&e.message||e)+' · '+label+' · '+meta);}
  setTimeout(function(){if(!finished)show('NO EVENT · '+label+' · '+meta+' · '+state(synth));},2000);
}

bareBtn.addEventListener('click',function(){
  run('BARE',function(){return new SpeechSynthesisUtterance('Hello. This is a test.');},function(synth,u){synth.speak(u);});
});

noCancelBtn.addEventListener('click',function(){
  run('EN-US NO CANCEL',function(){var u=new SpeechSynthesisUtterance('This is the browser text to speech test.');u.lang='en-US';u.rate=.9;return u;},function(synth,u){synth.speak(u);});
});

oldBtn.addEventListener('click',function(){
  run('YESTERDAY EXACT',function(){var u=new SpeechSynthesisUtterance('This is the browser text to speech test.');u.lang='en-US';u.rate=.9;return u;},function(synth,u){synth.cancel();synth.speak(u);});
});

pickedBtn.addEventListener('click',function(){
  run('PICKED NO CANCEL',function(list){var u=new SpeechSynthesisUtterance('This is the browser text to speech test.');var voice=pick(list);if(voice){u.voice=voice;u.__diagVoice=voice;}u.lang=voice&&voice.lang?voice.lang:'en-US';u.rate=.9;return u;},function(synth,u){synth.speak(u);});
});

localBtn.addEventListener('click',function(){
  run('LOCAL ENGLISH',function(list){var en=english(list),voice=en.find(function(v){return !!v.localService&&/^en-US$/i.test(v.lang||'');})||en.find(function(v){return !!v.localService;});if(!voice){show('NO LOCAL ENGLISH VOICE · voices='+list.length+' · English='+en.length);return null;}var u=new SpeechSynthesisUtterance('This is the local English voice test.');u.voice=voice;u.__diagVoice=voice;u.lang=voice.lang||'en-US';u.rate=.9;return u;},function(synth,u){synth.speak(u);});
});

networkBtn.addEventListener('click',function(){
  run('NETWORK ENGLISH',function(list){var en=english(list),voice=en.find(function(v){return !v.localService&&/^en-US$/i.test(v.lang||'');})||en.find(function(v){return !v.localService;});if(!voice){show('NO NETWORK ENGLISH VOICE · voices='+list.length+' · English='+en.length);return null;}var u=new SpeechSynthesisUtterance('This is the network English voice test.');u.voice=voice;u.__diagVoice=voice;u.lang=voice.lang||'en-US';u.rate=.9;return u;},function(synth,u){synth.speak(u);});
});
})();
