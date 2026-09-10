const DEFAULT_MESSAGE='학습을 종료하시겠습니까?\n완료한 답변과 학습 기록은 저장되어 있지만, 현재 진행 중인 활동은 종료됩니다.';

let enabled=false;
let message=DEFAULT_MESSAGE;
let beforeUnloadInstalled=false;

function beforeUnload(event){
  if(!enabled)return;
  event.preventDefault();
  event.returnValue='';
}
function ensureBeforeUnload(){
  if(beforeUnloadInstalled)return;
  window.addEventListener('beforeunload',beforeUnload);
  beforeUnloadInstalled=true;
}

export function setSessionProtection(active,{exitMessage=DEFAULT_MESSAGE}={}){
  ensureBeforeUnload();
  enabled=!!active;
  message=exitMessage||DEFAULT_MESSAGE;
}

export function confirmSessionExit(){
  if(!enabled)return true;
  return window.confirm(message);
}

export function hasProtectedSession(){return enabled}
export function clearSessionProtection(){enabled=false}
