import {showConfirmDialog} from './shared-confirm-dialog.js?v=1.0.2';

let enabled=false;
let pendingConfirmation=null;

export function setSessionProtection(active){
  enabled=!!active;
}

export async function confirmSessionExit(){
  if(!enabled)return true;
  if(pendingConfirmation)return pendingConfirmation;
  pendingConfirmation=(async()=>{
    const loader=document.createElement('div');
    loader.setAttribute('role','status');
    loader.setAttribute('aria-live','polite');
    loader.style.cssText='position:fixed;inset:0;z-index:2147482999;display:grid;place-items:center;background:rgba(28,45,52,.48);backdrop-filter:blur(3px)';
    loader.innerHTML='<div style="background:#fff;border:2px solid #10bfd0;border-radius:20px;padding:26px 30px;text-align:center;color:#203039;box-shadow:0 16px 45px #0002;font-weight:800"><span aria-hidden="true" style="display:block;width:34px;height:34px;margin:0 auto 14px;border:4px solid #10bfd0;border-right-color:transparent;border-radius:50%;animation:tpLeaveSpin .7s linear infinite"></span>종료 확인 창을 불러오는 중...</div>';
    if(!document.getElementById('tpLeaveSpinStyle')){
      const style=document.createElement('style');
      style.id='tpLeaveSpinStyle';
      style.textContent='@keyframes tpLeaveSpin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){[role="status"] span{animation:none!important}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(loader);
    try{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }finally{
      loader.remove();
    }
    return showConfirmDialog({
      title:'학습을 종료하시겠습니까?',
      cancelLabel:'계속하기',
      confirmLabel:'종료',
      tone:'danger'
    });
  })();
  try{return await pendingConfirmation}finally{pendingConfirmation=null}
}

export function hasProtectedSession(){return enabled}
export function clearSessionProtection(){enabled=false}
