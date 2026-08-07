(function(){
'use strict';
function install(){
 var recorder=window.WillenaLevelTestRecorder;
 if(!recorder||recorder.__beginGuardInstalled)return false;
 var original=recorder.begin||recorder.start;
 if(typeof original!=='function')return false;
 var active=null;
 recorder.begin=function(){
  if(active)return active;
  active=Promise.resolve().then(function(){return original.call(recorder)});
  active.finally(function(){setTimeout(function(){active=null},1200)});
  return active;
 };
 recorder.__beginGuardInstalled=true;
 return true;
}
if(!install()){
 var tries=0;
 var timer=setInterval(function(){
  tries+=1;
  if(install()||tries>40)clearInterval(timer);
 },50);
}
})();
