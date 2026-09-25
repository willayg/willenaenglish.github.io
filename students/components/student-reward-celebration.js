class StudentRewardCelebration extends HTMLElement {
  static get observedAttributes(){return ['percent','stars','points','label','points-only'];}

  constructor(){
    super();
    this.attachShadow({mode:'open'});
    this._rendered=false;
    this._hasPlayed=false;
  }

  connectedCallback(){
    this.render();
    if(!this._hasPlayed){
      this._hasPlayed=true;
      requestAnimationFrame(()=>this.play());
    }
  }

  attributeChangedCallback(){
    if(this.isConnected)this.render();
  }

  numberAttr(name,min,max){
    const value=Number(this.getAttribute(name));
    if(!Number.isFinite(value))return min;
    return Math.max(min,Math.min(max,value));
  }

  render(){
    const percent=Math.round(this.numberAttr('percent',0,100));
    const stars=Math.round(this.numberAttr('stars',0,5));
    const points=Math.max(0,Math.round(this.numberAttr('points',0,1000000)));
    const label=this.getAttribute('label')||'SESSION REWARD';
    const pointsOnly=this.hasAttribute('points-only');
    const starHtml=Array.from({length:5},(_,i)=>
      '<span class="star '+(i<stars?'earned':'empty')+'" data-star="'+i+'" aria-hidden="true">'+(i<stars?'★':'☆')+'</span>'
    ).join('');

    this.shadowRoot.innerHTML=`
      <style>
        :host{display:block;margin-top:20px;font-family:Poppins,system-ui,sans-serif;color:var(--reward-text,#315e64)}
        .reward{border:2px solid var(--reward-border,#dff2f4);border-radius:22px;background:var(--reward-bg,#f9fcfc);padding:20px 18px;text-align:center;overflow:hidden}
        .label{font-size:.72rem;font-weight:900;letter-spacing:.12em;color:var(--reward-muted,#789095)}
        .percent{margin-top:4px;font-size:clamp(2.15rem,8vw,3.1rem);font-weight:900;line-height:1;color:var(--reward-text,#315e64)}
        .stars{display:flex;justify-content:center;gap:7px;margin:14px 0 16px;font-size:clamp(2rem,8vw,2.8rem);line-height:1}
        .star{display:inline-block;transform-origin:center}
        .star.earned{color:var(--reward-star,#f3b61f);text-shadow:0 2px 0 rgba(125,89,0,.09)}
        .star.empty{color:var(--reward-empty,#cbd6d8)}
        .star.pop{animation:star-pop .38s cubic-bezier(.2,.9,.35,1.35) both}
        .star.final-pop{animation:final-pop .5s cubic-bezier(.2,.9,.35,1.45) both}
        .awards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .awards.points-only{grid-template-columns:minmax(0,1fr);max-width:240px;margin:0 auto}
        .award{border:1px solid var(--reward-border,#dff2f4);border-radius:15px;background:#fff;padding:11px 8px}
        .award strong{display:block;font-size:1.35rem;font-weight:900;color:var(--reward-accent,#de5b94)}
        .award span{display:block;margin-top:1px;font-size:.72rem;font-weight:800;color:var(--reward-muted,#789095)}
        .none{font-size:.82rem;font-weight:800;color:var(--reward-muted,#789095)}
        @keyframes star-pop{0%{transform:scale(.25) rotate(-12deg);opacity:.15}65%{transform:scale(1.28) rotate(4deg);opacity:1}100%{transform:scale(1) rotate(0)}}
        @keyframes final-pop{0%{transform:scale(.25);opacity:.15}55%{transform:scale(1.42);opacity:1}75%{transform:scale(.92)}100%{transform:scale(1)}}
        @media(max-width:420px){.reward{padding:18px 12px}.stars{gap:4px}.awards{gap:7px}}
        @media(prefers-reduced-motion:reduce){.star.pop,.star.final-pop{animation:none}}
      </style>
      <section class="reward" aria-label="${pointsOnly?points+' points earned':stars+' stars and '+points+' points earned'}">
        <div class="label">${this.escape(label)}</div>
        ${pointsOnly?'':'<div class="percent">'+percent+'%</div><div class="stars" aria-hidden="true">'+starHtml+'</div>'}
        <div class="awards ${pointsOnly?'points-only':''}">
          ${pointsOnly?'':'<div class="award"><strong>+'+stars+'</strong><span>STARS</span></div>'}
          <div class="award"><strong>+${points}</strong><span>POINTS</span></div>
        </div>
        ${!pointsOnly&&stars===0?'<div class="none">60% 이상이면 별을 받을 수 있어요.</div>':''}
      </section>`;
    this._rendered=true;
  }

  escape(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  play(){
    if(!this._rendered||this.hasAttribute('points-only'))return;
    const earned=[...this.shadowRoot.querySelectorAll('.star.earned')];
    earned.forEach(star=>star.classList.remove('pop','final-pop'));
    void this.shadowRoot.host.offsetWidth;
    earned.forEach((star,index)=>{
      const delay=index*170;
      setTimeout(()=>{
        star.classList.add(index===earned.length-1&&earned.length===5?'final-pop':'pop');
      },delay);
    });
  }
}

if(!customElements.get('student-reward-celebration')){
  customElements.define('student-reward-celebration',StudentRewardCelebration);
}

export {StudentRewardCelebration};
