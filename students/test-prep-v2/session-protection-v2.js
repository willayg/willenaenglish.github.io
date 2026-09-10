const DEFAULT_MESSAGE='학습을 종료하시겠습니까?\n완료한 답변과 현재 진행 상황은 저장됩니다. 나중에 같은 활동을 열면 이어서 할 수 있습니다.';

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
