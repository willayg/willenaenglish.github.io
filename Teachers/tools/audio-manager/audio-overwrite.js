(function(){
'use strict';

function $(id){return document.getElementById(id);}
function text(v){return String(v==null?'':v).trim();}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function apiFetch(path,opts){
  if(window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function')return window.WillenaAPI.fetch(path,opts);
  return fetch(path,opts);
}
function toast(message,bad){
  var el=$('toast');
  if(!el)return;
  el.textContent=message;
  el.style.background=bad?'#912018':'#101828';
  el.style.display='block';
  clearTimeout(el._overwriteTimer);
  el._overwriteTimer=setTimeout(function(){el.style.display='none';},3600);
}
function spokenFromRow(row){
  var main=row.querySelector('td.main');
  if(!main)return'';
  var clone=main.cloneNode(true);
  clone.querySelectorAll('.sub').forEach(function(n){n.remove();});
  return text(clone.textContent).replace(/_/g,' ').replace(/\s+/g,' ');
}
function keyFromRow(row){
  var code=row.querySelector('code');
  return text(code&&code.textContent).replace(/\.mp3$/i,'');
}
function typeFromRow(row){
  var cells=row.querySelectorAll('td');
  return text(cells[2]&&cells[2].textContent).toLowerCase();
}
async function retryFetch(path,opts,label){
  var last;
  for(var attempt=1;attempt<=4;attempt++){
    try{
      var r=await apiFetch(path,opts);
      if(r.ok||!(r.status===429||r.status>=500))return r;
      last=new Error(label+' '+r.status);
    }catch(e){last=e;}
    if(attempt<4)await sleep(700*Math.pow(2,attempt-1));
  }
  throw last||new Error(label+' failed');
}
async function makeAudio(spoken,type){
  spoken=text(spoken).replace(/_/g,' ').replace(/\s+/g,' ');
  if(!spoken)throw new Error('No spoken text found');
  var voice=text($('voiceId')&&$('voiceId').value);
  var payload={
    text:spoken,
    model_id:type==='vocabulary'?'eleven_turbo_v2_5':'eleven_turbo_v2_5'
  };
  if(voice)payload.voice_id=voice;
  var r=await retryFetch('/.netlify/functions/eleven_labs_proxy',{
    method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify(payload)
  },'ElevenLabs');
  var d=await r.json().catch(function(){return{};});
  if(!r.ok||!d.audio)throw new Error(d.error||d.details||'ElevenLabs failed ('+r.status+')');
  return d.audio;
}
async function overwriteFile(key,spoken,type){
  var audio=await makeAudio(spoken,type);
  var r=await retryFetch('/.netlify/functions/upload_audio',{
    method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',
    body:JSON.stringify({word:key,fileDataBase64:audio})
  },'R2 overwrite');
  var d=await r.json().catch(function(){return{};});
  if(!r.ok)throw new Error(d.error||d.message||'R2 overwrite failed ('+r.status+')');
  return d;
}
async function overwriteRow(row,button,skipConfirm){
  var key=keyFromRow(row),spoken=spokenFromRow(row),type=typeFromRow(row);
  if(!key||!spoken){toast('Could not read this audio row.',true);return false;}
  if(!skipConfirm&&!confirm('Replace '+key+'.mp3 with a new ElevenLabs recording of:\n\n“'+spoken+'” ?'))return false;
  var old=button?button.textContent:'';
  if(button){button.disabled=true;button.textContent='Recording…';}
  try{
    await overwriteFile(key,spoken,type);
    if(button){button.textContent='✓ Re-recorded';setTimeout(function(){button.textContent='↻ Re-record';button.disabled=false;},1400);}
    toast('Re-recorded '+key+'.mp3');
    var play=row.querySelector('[data-play]');
    if(play){
      var url=play.getAttribute('data-play')||'';
      play.setAttribute('data-play',url.split('?')[0]+'?_='+Date.now());
    }
    return true;
  }catch(e){
    if(button){button.disabled=false;button.textContent=old||'↻ Re-record';}
    toast((e&&e.message)||String(e),true);
    return false;
  }
}
function selectedRows(){
  return Array.from(document.querySelectorAll('#tbody tr')).filter(function(row){
    var cb=row.querySelector('.row-check');
    return cb&&cb.checked;
  });
}
async function overwriteSelected(){
  var rows=selectedRows();
  if(!rows.length){toast('Select at least one audio file first.',true);return;}
  if(!confirm('Re-record and overwrite '+rows.length+' selected MP3 file'+(rows.length===1?'':'s')+'?\n\nOnly the selected R2 files will be replaced.'))return;
  var button=$('overwriteSelectedBtn');
  button.disabled=true;
  var ok=0,failed=0;
  for(var i=0;i<rows.length;i++){
    button.textContent='Overwriting '+(i+1)+' / '+rows.length+'…';
    var row=rows[i],key=keyFromRow(row),spoken=spokenFromRow(row),type=typeFromRow(row);
    try{await overwriteFile(key,spoken,type);ok++;}
    catch(e){failed++;console.error('[Audio overwrite]',key,e);}
    if(i<rows.length-1)await sleep(300);
  }
  button.disabled=false;
  button.textContent='Overwrite selected';
  toast('Overwrite finished: '+ok+' replaced'+(failed?', '+failed+' failed':''),!!failed);
  var scan=$('scanBtn');
  if(scan&&!scan.disabled)setTimeout(function(){scan.click();},500);
}
function decorateRows(){
  document.querySelectorAll('#tbody tr').forEach(function(row){
    var cb=row.querySelector('.row-check');
    if(cb){
      cb.disabled=false;
      cb.title='Select this audio file for overwrite or generation';
    }
    var last=row.lastElementChild;
    if(!last||last.querySelector('.overwrite-one'))return;
    var btn=document.createElement('button');
    btn.type='button';btn.className='play overwrite-one';btn.textContent='↻ Re-record';btn.style.marginLeft='6px';
    btn.addEventListener('click',function(){overwriteRow(row,btn,false);});
    last.appendChild(btn);
  });
}
function addBatchButton(){
  if($('overwriteSelectedBtn'))return;
  var generate=$('generateBtn');
  if(!generate||!generate.parentNode)return;
  var btn=document.createElement('button');
  btn.type='button';btn.id='overwriteSelectedBtn';btn.className='btn';btn.textContent='Overwrite selected';
  btn.style.background='#b42318';btn.style.color='#fff';
  btn.addEventListener('click',overwriteSelected);
  generate.parentNode.insertBefore(btn,generate.nextSibling);
}
function updateNote(){
  var note=document.querySelector('.note');
  if(note)note.innerHTML='<b>Normal generation never overwrites:</b> Create missing MP3s only fills gaps. Use <b>Re-record</b> on one row, or select rows and use <b>Overwrite selected</b>, when you deliberately want to replace existing audio.';
}
function start(){
  addBatchButton();updateNote();decorateRows();
  var tbody=$('tbody');
  if(tbody)new MutationObserver(function(){decorateRows();}).observe(tbody,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
