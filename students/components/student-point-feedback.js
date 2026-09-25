const STYLE_ID='willena-point-feedback-style-v2';

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    .willena-point-feedback-token{
      position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;
      min-width:44px;height:44px;padding:0 11px;border-radius:999px;
      display:flex;align-items:center;justify-content:center;
      background:linear-gradient(180deg,#fff8bf 0%,#ffd54f 100%);
      border:2px solid #e7ae18;color:#765500;
      box-shadow:0 8px 22px rgba(87,65,0,.24),inset 0 1px 0 rgba(255,255,255,.8);
      font:900 16px/1 Poppins,system-ui,sans-serif;
      transform:translate(-50%,-50%);
      will-change:transform,opacity;
    }
  `;
  (document.head||document.documentElement).appendChild(style);
}

export function capturePointOrigin(sourceElement){
  try{
    const rect=sourceElement?.getBoundingClientRect?.();
    if(rect&&(rect.width||rect.height)){
      return {
        x:rect.left+rect.width/2,
        y:rect.top+Math.min(rect.height*.52,110)
      };
    }
  }catch(_){}
  return {
    x:window.innerWidth/2,
    y:Math.min(window.innerHeight*.68,window.innerHeight-90)
  };
}

function reducedMotion(){
  try{return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}catch(_){return false;}
}

function applyPoints(value){
  window.dispatchEvent(new CustomEvent('points:optimistic-bump',{
    detail:{delta:value,source:'point-feedback'}
  }));
}

export function showPointAward({amount=0,origin=null}={}){
  const value=Math.max(0,Math.round(Number(amount)||0));
  if(!value)return Promise.resolve(false);

  const start=origin&&Number.isFinite(origin.x)&&Number.isFinite(origin.y)
    ? origin
    : capturePointOrigin(null);

  if(reducedMotion()||typeof Element.prototype.animate!=='function'){
    applyPoints(value);
    return Promise.resolve(true);
  }

  ensureStyles();
  const token=document.createElement('div');
  token.className='willena-point-feedback-token';
  token.textContent='+'+value;
  token.setAttribute('aria-hidden','true');
  token.style.left=start.x+'px';
  token.style.top=start.y+'px';
  document.body.appendChild(token);

  const animation=token.animate([
    {transform:'translate(-50%,-50%) translateY(8px) scale(.78)',opacity:0,offset:0},
    {transform:'translate(-50%,-50%) translateY(0) scale(1.06)',opacity:1,offset:.18},
    {transform:'translate(-50%,-50%) translateY(-32px) scale(1)',opacity:1,offset:.55},
    {transform:'translate(-50%,-50%) translateY(-72px) scale(.92)',opacity:0,offset:1}
  ],{
    duration:760,
    easing:'cubic-bezier(.2,.72,.25,1)',
    fill:'forwards'
  });

  return animation.finished.then(()=>{
    token.remove();
    applyPoints(value);
    return true;
  }).catch(()=>{
    token.remove();
    applyPoints(value);
    return false;
  });
}

window.WillenaPointFeedback=window.WillenaPointFeedback||{
  captureOrigin:capturePointOrigin,
  award:showPointAward
};
