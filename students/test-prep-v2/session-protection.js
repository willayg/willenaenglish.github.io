import {showConfirmDialog} from './shared-confirm-dialog.js?v=1.0.0';

let enabled=false;

export function setSessionProtection(active){
  enabled=!!active;
}

export async function confirmSessionExit(){
  if(!enabled)return true;
  return showConfirmDialog({
    title:'학습을 종료하시겠습니까?',
    cancelLabel:'계속하기',
    confirmLabel:'종료',
    tone:'danger'
  });
}

export function hasProtectedSession(){return enabled}
export function clearSessionProtection(){enabled=false}
