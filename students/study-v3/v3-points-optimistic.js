(function(global){
'use strict';
var seen=new Set();
function onRecorded(e){
  try{
    var d=e&&e.detail||{};
    if(d.status!=='recorded')return;
    var result=d.result||{},payload=d.payload||{};
    var id=String(payload.client_attempt_id||result.attempt_id||'');
    if(!id||seen.has(id))return;
    var delta=Number(result.points_awarded);
    if(!Number.isFinite(delta)||delta<=0)return;
    seen.add(id);
    global.dispatchEvent(new CustomEvent('points:optimistic-bump',{detail:{delta:delta,source:'study-v3',client_attempt_id:id}}));
  }catch(_){}
}
global.addEventListener('willena:study-recording',onRecorded);
})(window);
