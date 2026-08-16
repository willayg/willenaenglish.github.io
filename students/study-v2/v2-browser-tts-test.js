(function(){
'use strict';
var host=String(location.hostname||'').toLowerCase();
if(host!=='staging.willenaenglish.com'&&!host.endsWith('.pages.dev'))return;

var wrap=document.createElement('div');
wrap.id='browserTtsTest';
wrap.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99999;display:flex;flex-direction:column;gap:6px;align-items:flex-start;max-width:min(90vw,390px);font-family:Poppins,system-ui,sans-serif';

function makeBtn(label){
  var b=document.createElement('button');
  b.type='button';b.textContent=label;
  b.style.cssText='border:2px solid #173f46;border-radius:999px;background:#fff;padding:9px 14px;font:700 12px/1 Poppins,system-ui,sans-serif;color:#173f46;box-shadow:0 5px 18px rgba(0,0,0,.12)';
  return b;
}
var oldBtn=makeBtn('Yesterday-style TTS');
var pickedBtn=makeBtn('Picked-voice TTS');
var status=document.createElement('div');
status.textContent='staging only';
status.style.cssText='display:none;background:#173f46;color:#fff;border-radius:10px;padding:7px 9px;font:600 11px/1.35 Poppins,system-ui,sans-serif;word-break:break-word';
wrap.appendChild(oldBtn);wrap.appendChild(pickedBtn);wrap.appendChild(status);document.body.appendChild(wrap);

function show(msg){status.textContent=msg;status.style.display='block';}
function getVoices(){try{return window.speechSynthesis?window.speechSynthesis.getVoices()||[]:[];}catch(_){return[];}}
function pick(list){return list.find(function(v){return /^en-US$/i.test(v.lang);})||list.find(function(v){return /^en/i.test(v.lang);})||list[0]||null;}
function monitor(u,label){
  u.onstart=function(){show('STARTED · '+label);};
  u.onend=function(){show('FINISHED · '+label);};
  u.onerror=function(e){show('ERROR: '+String(e&&e.error||'unknown')+' · '+label);};
  setTimeout(function(){
    if(status.textContent.indexOf('REQUESTED')!==0)return;
    var synth=window.speechSynthesis,speaking=false,pending=false;
    try{speaking=!!synth.speaking;pending=!!synth.pending;}catch(_){}
    show('NO START EVENT · speaking='+speaking+' · pending='+pending+' · '+label);
  },1800);
}
function supported(){
  if(window.speechSynthesis&&window.SpeechSynthesisUtterance)return true;
  show('NOT SUPPORTED: speechSynthesis is unavailable');return false;
}

/* This deliberately matches the Study engine that was working before the new
   compatibility layer: no explicit voice object and no resume() call. */
oldBtn.addEventListener('click',function(){
  if(!supported())return;
  var synth=window.speechSynthesis,list=getVoices();
  var u=new SpeechSynthesisUtterance('This is the browser text to speech test.');
  u.lang='en-US';u.rate=.9;
  var label='OLD PATH · voices='+list.length+' · no explicit voice · lang=en-US';
  show('REQUESTED · '+label);monitor(u,label);
  try{synth.cancel();synth.speak(u);}catch(e){show('THREW: '+String(e&&e.message||e)+' · '+label);}
});

pickedBtn.addEventListener('click',function(){
  if(!supported())return;
  var synth=window.speechSynthesis,list=getVoices(),voice=pick(list);
  var u=new SpeechSynthesisUtterance('This is the browser text to speech test.');
  if(voice)u.voice=voice;
  u.lang=voice&&voice.lang?voice.lang:'en-US';u.rate=.9;u.pitch=1;u.volume=1;
  var label='PICKED PATH · voices='+list.length+(voice?' · '+voice.name+' · '+voice.lang:' · no loaded voice');
  show('REQUESTED · '+label);monitor(u,label);
  try{synth.cancel();synth.resume();synth.speak(u);}catch(e){show('THREW: '+String(e&&e.message||e)+' · '+label);}
});
})();
