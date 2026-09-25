const STYLE_ID='willena-point-feedback-style-v1';

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
    .willena-point-feedback-spark{
      position:fixed;left:0;top:0;z-index:2147482999;pointer-events:none;
      width:7px;height:7px;border-radius:50%;background:#ffd54f;
      box-shadow:0 0 0 1px rgba(126,88,0,.1);
      will-change:transform,opacity;
    }
  `;
  (document.head||document.documentElement).appendChild(style);
}

function pointsPill(){
  try{
    const header=document.querySelector('student-header');
    const pill=header?.shadowRoot?.querySelector('.points-pill');
    if(!pill)return null;
    const rect=pill.getBoundingClientRect();
    if(!rect.width&&!rect.height)return null;
    return {pill,x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  }catch(_){
    return null;
  }
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

function burst(x,y,count=4,radius=26){
  if(reducedMotion()||typeof Element.prototype.animate!=='function')return;
  ensureStyles();
  for(let i=0;i<count;i++){
    const spark=document.createElement('i');
    spark.className='willena-point-feedback-spark';
    spark.style.left=x+'px';
    spark.style.top=y+'px';
    document.body.appendChild(spark);
    const angle=(Math.PI*2*i/count)-Math.PI/2;
    const dx=Math.cos(angle)*radius;
    const dy=Math.sin(angle)*radius;
    const animation=spark.animate([
      {transform:'translate(-50%,-50%) scale(.35)',opacity:0},
      {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.22},
      {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.25)`,opacity:0}
    ],{duration:420,delay:i*18,easing:'cubic-bezier(.2,.8,.3,1)'});
    animation.finished.finally(()=>spark.remove());
  }
}

function landPoints(value){
  window.dispatchEvent(new CustomEvent('points:optimistic-bump',{
    detail:{delta:value,source:'point-feedback'}
  }));
  requestAnimationFrame(()=>{
    const current=pointsPill();
    if(!current?.pill||typeof current.pill.animate!=='function')return;
    current.pill.animate([
      {transform:'scale(1)'},
      {transform:'scale(1.24)',offset:.38},
      {transform:'scale(.95)',offset:.68},
      {transform:'scale(1)'}
    ],{duration:410,easing:'cubic-bezier(.2,.9,.35,1.25)'});
    burst(current.x,current.y,3,18);
  });
}

export function showPointAward({amount=0,origin=null}={}){
  const value=Math.max(0,Math.round(Number(amount)||0));
  if(!value)return Promise.resolve(false);

  const target=pointsPill();
  if(!target){
    landPoints(value);
    return Promise.resolve(false);
  }

  const start=origin&&Number.isFinite(origin.x)&&Number.isFinite(origin.y)
    ? origin
    : capturePointOrigin(null);

  if(reducedMotion()||typeof Element.prototype.animate!=='function'){
    landPoints(value);
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

  burst(start.x,start.y,4,24);

  const dx=target.x-start.x;
  const dy=target.y-start.y;
  const lift=Math.min(92,Math.max(42,Math.abs(dy)*.18));

  const animation=token.animate([
    {transform:'translate(-50%,-50%) scale(.58)',opacity:0,offset:0},
    {transform:'translate(-50%,-50%) scale(1.18)',opacity:1,offset:.16},
    {transform:`translate(calc(-50% + ${dx*.42}px),calc(-50% + ${dy*.34-lift}px)) scale(1.05)`,opacity:1,offset:.52},
    {transform:`translate(calc(-50% + ${dx*.78}px),calc(-50% + ${dy*.74-lift*.28}px)) scale(.82)`,opacity:.95,offset:.79},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.38)`,opacity:.08,offset:1}
  ],{
    duration:820,
    easing:'cubic-bezier(.2,.72,.25,1)',
    fill:'forwards'
  });

  return animation.finished.then(()=>{
    token.remove();
    landPoints(value);
    return true;
  }).catch(()=>{
    token.remove();
    landPoints(value);
    return false;
  });
}

window.WillenaPointFeedback=window.WillenaPointFeedback||{
  captureOrigin:capturePointOrigin,
  award:showPointAward
};
