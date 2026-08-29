(function(){
'use strict';
function installHiddenFix(){
  if(document.getElementById('tpHiddenEngineFix'))return;
  const style=document.createElement('style');
  style.id='tpHiddenEngineFix';
  style.textContent='.engine-shell[hidden]{display:none!important}';
  document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installHiddenFix,{once:true});
else installHiddenFix();
})();
