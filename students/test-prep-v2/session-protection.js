const DEFAULT_MESSAGE='학습을 종료하시겠습니까?\n완료한 답변과 학습 기록은 저장되어 있지만, 현재 진행 중인 활동은 종료됩니다.';

let active=null;
let beforeUnloadInstalled=false;

function beforeUnload(event){
  if(!active?.isProtected?.())return;
  event.preventDefault();
  event.returnValue='';
}

function ensureBeforeUnload(){
  if(beforeUnloadInstalled)return;
  window.addEventListener('beforeunload',beforeUnload);
  beforeUnloadInstalled=true;
}

export function protectSession({isProtected=()=>true,message=DEFAULT_MESSAGE,onConfirm=()=>{}}={}){
  ensureBeforeUnload();
  const token=Symbol('session-protection');
  active={token,isProtected,message,onConfirm};
  return()=>{if(active?.token===token)active=null};
}

export function confirmSessionExit(){
  if(!active?.isProtected?.())return true;
  const ok=window.confirm(active.message||DEFAULT_MESSAGE);
  if(ok){try{active.onConfirm?.()}catch(e){console.warn('[test-prep-v2] session exit confirmation hook failed',e)}}
  return ok;
}

export function hasProtectedSession(){return !!active?.isProtected?.()}

export function clearSessionProtection(){active=null}
