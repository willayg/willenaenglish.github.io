const STYLE_ID='willena-point-award-style-v1';

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    .willena-point-token{
      position:fixed;left:0;top:0;z-index:20050;pointer-events:none;
      min-width:42px;height:42px;padding:0 11px;border-radius:999px;
      display:flex;align-items:center;justify-content:center;
      background:linear-gradient(145deg,#fff8c7,#ffd45f);
      border:2px solid #e2ad28;color:#8a6500;
      box-shadow:0 8px 20px rgba(97,76,0,.22),inset 0 1px 0 rgba(255,255,255,.75);
      font:900 15px/1 Poppins,system-ui,sans-serif;
      transform:translate(-50%,-50%);
      will-change:transform,opacity;
    }
    .willena-point-token::before{
      content:'+';margin-right:1px;font-size:.9em
    }
    .willena-point-spark{
      position:fixed;z-index:20049;pointer-events:none;width:7px;height:7px;border-radius:50%;
      background:#ffd45f;box-shadow:0 0 0 1px rgba(184,128,0,.12);
      will-change:transform,opacity;
    }
    @media(prefers-reduced-motion:reduce){
      .willena-point-token,.willena-point-spark{animation:none!important}
    }
  `;
  (document.head||document.documentElement).appendChild(style);
}

function centerOfRect(rect){
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
}

function rectForSource(sourceElement){
  try{
    if(sourceElement&&typeof sourceElement.getBoundingClientRect==='function'){
      const r=sourceElement.getBoundingClientRect();
      if(r.width||r.height)return r;
    }
  }catch(_){}
  return {left:innerWidth/2-1,top:innerHeight*.58-1,width:2,height:2};
}

function pointsTarget(){
  try{
    const header=document.querySelector('student-header');
    const pill=header?.shadowRoot?.querySelector('.points-pill');
    if(pill)return pill;
  }catch(_){}
  return null;
}

function bumpHeader(amount){
  try{
    window.dispatchEvent(new CustomEvent('points:optimistic-bump',{detail:{delta:amount,source:'point-award-animation'}}));
  }catch(_){}
}

function makeSparks(x,y,dx,dy){
  if(matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
  const count=3;
  for(let i=0;i<count;i++){
    const spark=document.createElement('span');
    spark.className='willena-point-spark';
    spark.style.left=x+'px';
    spark.style.top=y+'px';
    document.body.appendChild(spark);
    const spread=(i-1)*18;
    const anim=spark.animate([
      {transform:'translate(-50%,-50%) scale(.5)',opacity:0},
      {transform:`translate(calc(-50% + ${spread}px),calc(-50% - ${18+Math.abs(spread)/3}px)) scale(1)`,opacity:.9,offset:.35},
      {transform:`translate(calc(-50% + ${dx*.62+spread*.3}px),calc(-50% + ${dy*.62-16}px)) scale(.25)`,opacity:0}
    ],{duration:560+i*45,easing:'cubic-bezier(.2,.75,.25,1)'});
    anim.finished.finally(()=>spark.remove());
  }
}

export function awardStudentPoints({amount,sourceElement,bump=true}={}){
  const points=Math.max(0,Math.round(Number(amount)||0));
  if(!points)return Promise.resolve(false);

  ensureStyle();
  const target=pointsTarget();
  if(!target){
    if(bump)bumpHeader(points);
    return Promise.resolve(false);
  }

  const sourceRect=rectForSource(sourceElement);
  const targetRect=target.getBoundingClientRect();
  const start=centerOfRect(sourceRect);
  const end=centerOfRect(targetRect);
  const dx=end.x-start.x;
  const dy=end.y-start.y;

  if(matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
    if(bump)bumpHeader(points);
    return Promise.resolve(true);
  }

  const token=document.createElement('span');
  token.className='willena-point-token';
  token.textContent=String(points);
  token.setAttribute('aria-hidden','true');
  token.style.left=start.x+'px';
  token.style.top=start.y+'px';
  document.body.appendChild(token);

  makeSparks(start.x,start.y,dx,dy);

  const arcLift=Math.min(78,Math.max(34,Math.abs(dy)*.16));
  const anim=token.animate([
    {transform:'translate(-50%,-50%) scale(.55)',opacity:0,offset:0},
    {transform:'translate(-50%,-50%) scale(1.18)',opacity:1,offset:.16},
    {transform:`translate(calc(-50% + ${dx*.22}px),calc(-50% + ${dy*.22-arcLift}px)) scale(1.03)`,opacity:1,offset:.42},
    {transform:`translate(calc(-50% + ${dx*.70}px),calc(-50% + ${dy*.68-arcLift*.35}px)) scale(.82)`,opacity:.95,offset:.78},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.42)`,opacity:.15,offset:1}
  ],{duration:720,easing:'cubic-bezier(.2,.72,.25,1)',fill:'forwards'});

  return anim.finished.then(()=>{
    token.remove();
    if(bump)bumpHeader(points);
    return true;
  }).catch(()=>{
    token.remove();
    if(bump)bumpHeader(points);
    return false;
  });
}

window.WillenaPointAward=window.WillenaPointAward||{award:awardStudentPoints};
