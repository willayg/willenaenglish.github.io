(function(){
'use strict';
var host=String(location.hostname||'').toLowerCase();
if(host!=='staging.willenaenglish.com'&&!host.endsWith('.pages.dev'))return;

var wrap=document.createElement('div');
wrap.id='browserTtsTest';
wrap.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99999;display:flex;flex-direction:column;gap:6px;align-items:flex-start;max-width:min(88vw,360px);font-family:Poppins,system-ui,sans-serif';

var btn=document.createElement('button');
btn.type='button';
btn.textContent='Browser TTS test';
btn.style.cssText='border:2px solid #173f46;border-radius:999px;background:#fff;padding:9px 14px;font:700 12px/1 Poppins,system-ui,sans-serif;color:#173f46;box-shadow:0 5px 18px rgba(0,0,0,.12)';

var status=document.createElement('div');
status.textContent='staging only';
status.style.cssText='display:none;background:#173f46;color:#fff;border-radius:10px;padding:7px 9px;font:600 11px/1.35 Poppins,system-ui,sans-serif;word-break:break-word';

wrap.appendChild(btn);wrap.appendChild(status);document.body.appendChild(wrap);

function show(msg){status.textContent=msg;status.style.display='block';}
function voices(){try{return window.speechSynthesis?window.speechSynthesis.getVoices()||[]:[];}catch(_){return[];}}
function pick(list){
  return list.find(function(v){return /^en-US$/i.test(v.lang);})||
         list.find(function(v){return /^en/i.test(v.lang);})||list[0]||null;
}

btn.addEventListener('click',function(){
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){show('NOT SUPPORTED: speechSynthesis is unavailable');return;}
  var synth=window.speechSynthesis;
  var list=voices();
  var voice=pick(list);
  var u=new SpeechSynthesisUtterance('This is the browser text to speech test.');
  if(voice)u.voice=voice;
  u.lang=voice&&voice.lang?voice.lang:'en-US';
  u.rate=.9;u.pitch=1;u.volume=1;
  var label='voices='+list.length+(voice?' · '+voice.name+' · '+voice.lang:' · no loaded voice');
  show('REQUESTED · '+label);
  u.onstart=function(){show('STARTED · '+label);};
  u.onend=function(){show('FINISHED · '+label);};
  u.onerror=function(e){show('ERROR: '+String(e&&e.error||'unknown')+' · '+label);};
  try{
    synth.cancel();
    synth.resume();
    synth.speak(u);
  }catch(e){show('THREW: '+String(e&&e.message||e)+' · '+label);}
  setTimeout(function(){
    var speaking=false,pending=false;
    try{speaking=!!synth.speaking;pending=!!synth.pending;}catch(_){}
    if(status.textContent.indexOf('REQUESTED')===0)show('NO START EVENT · speaking='+speaking+' · pending='+pending+' · '+label);
  },1800);
});
})();
