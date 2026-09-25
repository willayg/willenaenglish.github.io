class StudentPointTokens {
  constructor(){
    this.styleId='willena-point-token-style';
    this.active=0;
  }

  ensureStyles(){
    if(document.getElementById(this.styleId))return;
    const style=document.createElement('style');
    style.id=this.styleId;
    style.textContent=`
      .willena-point-token{
        position:fixed;left:0;top:0;z-index:2147483000;
        min-width:46px;height:46px;padding:0 12px;border-radius:999px;
        display:flex;align-items:center;justify-content:center;
        background:linear-gradient(180deg,#fff9cc,#ffd75a);
        border:2px solid #f1b91d;color:#7c5a00;
        font:900 16px/1 Poppins,system-ui,sans-serif;
        box-shadow:0 8px 20px rgba(112,83,0,.22);
        pointer-events:none;transform:translate(-50%,-50%) scale(.72);
        opacity:0;will-change:transform,opacity,left,top;
      }
      .willena-point-token.pop{
        animation:willena-point-pop .2s cubic-bezier(.2,.9,.35,1.35) forwards;
      }
      .willena-point-spark{
        position:fixed;z-index:2147482999;width:7px;height:7px;border-radius:50%;
        background:#ffd75a;pointer-events:none;opacity:0;
      }
      @keyframes willena-point-pop{
        0%{transform:translate(-50%,-50%) scale(.6);opacity:0}
        70%{transform:translate(-50%,-50%) scale(1.12);opacity:1}
        100%{transform:translate(-50%,-50%) scale(1);opacity:1}
      }
      @keyframes willena-point-target-bump{
        0%{transform:scale(1)}
        45%{transform:scale(1.2)}
        70%{transform:scale(.96)}
        100%{transform:scale(1)}
      }
      @media(prefers-reduced-motion:reduce){
        .willena-point-token{transition:none!important;animation:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  sourceRect(sourceElement){
    const el=sourceElement&&typeof sourceElement.getBoundingClientRect==='function'?sourceElement:null;
    if(el){
      const r=el.getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+Math.min(r.height*.45,90)};
    }
    return {x:window.innerWidth/2,y:Math.min(window.innerHeight*.72,window.innerHeight-90)};
  }

  target(){
    const header=document.querySelector('student-header');
    const pill=header?.shadowRoot?.querySelector('.points-pill');
    if(!pill)return null;
    const r=pill.getBoundingClientRect();
    return {header,pill,x:r.left+r.width/2,y:r.top+r.height/2};
  }

  bumpTarget(target){
    if(!target?.pill)return;
    const pill=target.pill;
    pill.style.animation='none';
    void pill.offsetWidth;
    pill.style.animation='willena-point-target-bump .38s cubic-bezier(.2,.9,.35,1.3)';
    setTimeout(()=>{if(pill)pill.style.animation='';},420);
  }

  spark(x,y,dx,dy,delay){
    const s=document.createElement('i');
    s.className='willena-point-spark';
    s.style.left=x+'px';s.style.top=y+'px';
    document.body.appendChild(s);
    s.animate([
      {transform:'translate(-50%,-50%) scale(.4)',opacity:0},
      {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.25},
      {transform:'translate('+(dx-3)+'px,'+(dy-3)+'px) scale(.35)',opacity:0}
    ],{duration:420,delay,easing:'cubic-bezier(.2,.8,.3,1)'});
    setTimeout(()=>s.remove(),900);
  }

  award({amount=0,sourceElement=null}={}){
    const value=Math.max(0,Math.round(Number(amount)||0));
    if(!value)return;
    this.ensureStyles();

    const start=this.sourceRect(sourceElement);
    const target=this.target();
    const end=target||{x:window.innerWidth-32,y:28};
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    const token=document.createElement('div');
    token.className='willena-point-token';
    token.textContent='+'+value;
    token.setAttribute('aria-hidden','true');
    token.style.left=start.x+'px';
    token.style.top=start.y+'px';
    document.body.appendChild(token);

    if(reduced){
      token.style.opacity='1';
      token.style.transform='translate(-50%,-50%) scale(1)';
      setTimeout(()=>{
        window.dispatchEvent(new CustomEvent('points:optimistic-bump',{detail:{delta:value,source:'point-token'}}));
        this.bumpTarget(target);
        token.remove();
      },180);
      return;
    }

    requestAnimationFrame(()=>{
      token.classList.add('pop');
      for(let i=0;i<4;i++){
        const a=(Math.PI*2*i/4)+.35;
        this.spark(start.x,start.y,Math.cos(a)*28,Math.sin(a)*28,i*20);
      }
    });

    const dx=end.x-start.x;
    const dy=end.y-start.y;
    const midX=start.x+dx*.55;
    const midY=Math.min(start.y,end.y)-Math.min(90,Math.abs(dy)*.2+32);

    const flight=token.animate([
      {left:start.x+'px',top:start.y+'px',transform:'translate(-50%,-50%) scale(1)',opacity:1},
      {left:midX+'px',top:midY+'px',transform:'translate(-50%,-50%) scale(1.08)',opacity:1,offset:.55},
      {left:end.x+'px',top:end.y+'px',transform:'translate(-50%,-50%) scale(.52)',opacity:.25}
    ],{duration:680,delay:180,easing:'cubic-bezier(.22,.72,.28,1)'});

    flight.onfinish=()=>{
      window.dispatchEvent(new CustomEvent('points:optimistic-bump',{detail:{delta:value,source:'point-token'}}));
      this.bumpTarget(target);
      for(let i=0;i<3;i++){
        const a=(Math.PI*2*i/3)-1.1;
        this.spark(end.x,end.y,Math.cos(a)*20,Math.sin(a)*20,i*18);
      }
      token.remove();
    };
  }
}

window.WillenaPointTokens=window.WillenaPointTokens||new StudentPointTokens();
export {StudentPointTokens};
