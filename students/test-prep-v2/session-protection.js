import {showConfirmDialog} from './shared-confirm-dialog.js?v=1.0.0';

let enabled=false;
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

export function setSessionProtection(active){
  ensureBeforeUnload();
  enabled=!!active;
}

export async function confirmSessionExit(){
  if(!enabled)return true;
  return showConfirmDialog({
    title:'Are you sure you want to exit?',
    cancelLabel:'Cancel',
    confirmLabel:'Exit',
    tone:'danger'
  });
}

export function hasProtectedSession(){return enabled}
export function clearSessionProtection(){enabled=false}
