(function(){
'use strict';
function text(v){return String(v==null?'':v).trim();}
function clearRetry(shell){
  if(!shell)return;
  var mic=shell.querySelector('.v3-speaking-mic');
  var row=shell.querySelector('.v3-speaking-microw');
  var old=row&&row.querySelector('.v3-speaking-retry-arrow');
  if(mic)mic.classList.remove('is-retry-cue');
  if(row)row.classList.remove('is-retry-cue');
  if(old)old.remove();
}
function scan(){
  var root=document.getElementById('v2ActivityRoot');
  if(!root)return;
  var shell=root.querySelector('.v3-speaking-shell');
  if(!shell)return;
  var feedback=shell.querySelector('.v3-speaking-feedback');
  var mic=shell.querySelector('.v3-speaking-mic');
  var row=shell.querySelector('.v3-speaking-microw');
  var status=shell.querySelector('.v3-speaking-status');
  if(!mic||!row)return;
  var listening=mic.classList.contains('is-listening');
  var retry=!listening&&feedback&&!feedback.hidden&&/try once more/i.test(text(feedback.textContent));
  mic.classList.toggle('is-retry-cue',!!retry);
  row.classList.toggle('is-retry-cue',!!retry);
  var old=row.querySelector('.v3-speaking-retry-arrow');
  if(retry){
    if(!old){
      old=document.createElement('div');
      old.className='v3-speaking-retry-arrow';
      old.setAttribute('aria-hidden','true');
      old.innerHTML='<svg viewBox="0 0 44 44" focusable="false"><path d="M11 9c13 1 21 8 21 20"/><path d="M25 23l7 7 7-7"/></svg><span>Tap again</span>';
      row.insertBefore(old,mic);
    }
    if(status&&text(status.textContent)!=='Tap the mic to try again')status.textContent='Tap the mic to try again';
  }else if(old){
    old.remove();
  }
}
function start(){
  scan();
  document.addEventListener('click',function(e){
    var mic=e.target&&e.target.closest&&e.target.closest('.v3-speaking-mic.is-retry-cue');
    if(!mic)return;
    var shell=mic.closest('.v3-speaking-shell');
    clearRetry(shell);
  },true);
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
