const STYLE_ID='willena-point-feedback-style-v3';

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    .willena-point-feedback-text{
      position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;
      font:900 28px/1 Poppins,system-ui,sans-serif;
      letter-spacing:-.02em;
      text-shadow:0 2px 8px rgba(0,0,0,.12);
      transform:translate(-50%,-50%);
      will-change:transform,opacity;
    }
    .willena-point-feedback-text.is-cyan{color:#22d3ee}
    .willena-point-feedback-text.is-pink{color:#f472b6}
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

  applyPoints(value);

  if(reducedMotion()||typeof Element.prototype.animate!=='function'){
    return Promise.resolve(true);
  }

  ensureStyles();
  const token=document.createElement('span');
  token.className='willena-point-feedback-text '+(value>=3?'is-pink':'is-cyan');
  token.textContent='+'+value;
  token.setAttribute('aria-hidden','true');
  token.style.left=start.x+'px';
  token.style.top=start.y+'px';
  document.body.appendChild(token);

  const animation=token.animate([
    {transform:'translate(-50%,-50%) translateY(0) scale(.96)',opacity:0,offset:0},
    {transform:'translate(-50%,-50%) translateY(-8px) scale(1)',opacity:1,offset:.12},
    {transform:'translate(-50%,-50%) translateY(-42px) scale(1)',opacity:1,offset:.62},
    {transform:'translate(-50%,-50%) translateY(-82px) scale(.96)',opacity:0,offset:1}
  ],{
    duration:1400,
    easing:'cubic-bezier(.22,.65,.3,1)',
    fill:'forwards'
  });

  return animation.finished.then(()=>{
    token.remove();
    return true;
  }).catch(()=>{
    token.remove();
    return false;
  });
}

window.WillenaPointFeedback=window.WillenaPointFeedback||{
  captureOrigin:capturePointOrigin,
  award:showPointAward
};
