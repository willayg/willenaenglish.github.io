(async function(){
  'use strict';

  const BUILD='20260829-header-direct2';
  window.__WILLENA_STUDY_V3_HEADER_BUILD=BUILD;

  const hideBadge=()=>{
    const badge=document.querySelector('.study-v3-badge');
    if(badge) badge.style.display='none';
  };
  hideBadge();
  const badgeObserver=new MutationObserver(hideBadge);
  badgeObserver.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>badgeObserver.disconnect(),5000);

  await customElements.whenDefined('student-header');
  const host=document.querySelector('student-header');
  if(!host||!host.shadowRoot)return;

  let shell=host.parentElement&&host.parentElement.classList.contains('study-v3-header-shell')
    ? host.parentElement
    : null;
  if(!shell){
    shell=document.createElement('div');
    shell.className='study-v3-header-shell';
    host.parentNode.insertBefore(shell,host);
    shell.appendChild(host);
  }
  shell.dataset.headerBuild=BUILD;

  document.getElementById('studyV3HeaderShellStyle')?.remove();
  const shellStyle=document.createElement('style');
  shellStyle.id='studyV3HeaderShellStyle';
  shellStyle.textContent=`
    .study-v3-header-shell{
      position:relative!important;isolation:isolate!important;display:block!important;width:100%!important;max-width:none!important;
      margin:0 0 16px!important;padding:0!important;overflow:hidden!important;transform:none!important;zoom:1!important;
      background:linear-gradient(112deg,#c7f8f8 0%,#72e1e6 53%,#3bc6cf 100%)!important;
    }
    .study-v3-header-shell::before,.study-v3-header-shell::after{
      content:''!important;display:block!important;position:absolute!important;pointer-events:none!important;
    }
    .study-v3-header-shell::before{
      z-index:1!important;width:58%!important;left:57%!important;bottom:0!important;background:#ffc5df!important;
      border-radius:76% 24% 0 0 / 100% 100% 0 0!important;transform:rotate(-3deg)!important;
    }
    .study-v3-header-shell::after{
      z-index:2!important;width:116%!important;left:-8%!important;background:#f2f3f5!important;
      border-radius:61% 39% 0 0 / 100% 100% 0 0!important;transform:rotate(-1.1deg)!important;
    }
  `;
  document.head.appendChild(shellStyle);

  const set=(el,prop,value)=>{ if(el) el.style.setProperty(prop,value,'important'); };
  const setMany=(el,map)=>{ if(!el)return; Object.entries(map).forEach(([k,v])=>set(el,k,v)); };

  function getMode(){
    const w=window.innerWidth||document.documentElement.clientWidth||0;
    if(w<=480) return 'phone';
    if(w<900) return 'wide';
    return 'tablet';
  }

  function metrics(mode){
    if(mode==='phone') return {
      shell:88, host:70, pad:'10px 12px 6px', top:52, gap:7,
      name:22, page:24, pill:12, pillH:25, pillPad:'5px 8px', icon:12,
      avatar:42, avatarFont:23, radius:14, curve:43, curveBottom:-25, pink:25
    };
    if(mode==='tablet') return {
      shell:100, host:82, pad:'11px 30px 6px', top:62, gap:15,
      name:42, page:42, pill:16, pillH:31, pillPad:'6px 11px', icon:16,
      avatar:56, avatarFont:30, radius:18, curve:46, curveBottom:-27, pink:29
    };
    return {
      shell:142, host:112, pad:'18px 28px 9px', top:86, gap:16,
      name:46, page:46, pill:17, pillH:36, pillPad:'8px 13px', icon:18,
      avatar:66, avatarFont:36, radius:21, curve:68, curveBottom:-38, pink:40
    };
  }

  function apply(){
    const root=host.shadowRoot;
    if(!root)return;
    const mode=getMode();
    const m=metrics(mode);
    shell.dataset.headerMode=mode;

    setMany(shell,{
      height:m.shell+'px','min-height':m.shell+'px','max-height':m.shell+'px'
    });
    shell.style.setProperty('--v3-curve-h',m.curve+'px');
    shell.style.setProperty('--v3-curve-bottom',m.curveBottom+'px');
    shell.style.setProperty('--v3-pink-h',m.pink+'px');

    setMany(host,{
      display:'block',position:'relative','z-index':'6',width:'100%',height:m.host+'px','min-height':m.host+'px','max-height':m.host+'px',
      margin:'0',padding:'0',overflow:'visible',transform:'none',zoom:'1',background:'transparent'
    });

    const header=root.querySelector('header');
    const top=root.querySelector('.top');
    const info=root.querySelector('.info');
    const name=root.querySelector('.title');
    const page=root.querySelector('.page-title');
    const pageText=root.querySelector('.page-title-text');
    const points=root.querySelector('.points-pill');
    const stars=root.querySelector('.stars-pill');
    const avatar=root.querySelector('.avatar');
    const menuAnchor=root.querySelector('.menu-anchor');
    const dropdown=root.querySelector('.dropdown');

    setMany(header,{
      position:'relative',top:'auto',left:'auto',right:'auto',width:'100%',height:m.host+'px','min-height':m.host+'px','max-height':m.host+'px',
      'box-sizing':'border-box',padding:m.pad,margin:'0',border:'0',overflow:'visible',transform:'none',background:'transparent','box-shadow':'none'
    });
    setMany(top,{
      position:'relative','z-index':'7',display:'flex','flex-direction':'row','align-items':'flex-start','justify-content':'center',
      'min-height':m.top+'px',gap:m.gap+'px',transform:'none'
    });
    setMany(info,{
      display:'grid','grid-template-columns':'auto auto','grid-template-areas':'"name name" "points stars"','align-items':'center',
      'justify-items':'start','column-gap':mode==='phone'?'6px':'10px','row-gap':mode==='phone'?'4px':'6px',transform:'none'
    });
    setMany(name,{
      'grid-area':'name',display:'block',margin:'0',padding:'0','min-height':'0',border:'0','border-radius':'0',background:'transparent',
      color:'#0b555c','font-size':m.name+'px','font-weight':'800','line-height':'.95','letter-spacing':'-.04em',transform:'none'
    });
    setMany(page,{
      'align-self':'flex-start',margin:(mode==='phone'?'2px 6px 0 auto':mode==='tablet'?'2px 14px 0 auto':'5px 16px 0 auto'),
      color:'#0d5158','font-size':m.page+'px','font-weight':'800','line-height':'.95','letter-spacing':'-.035em',transform:'none'
    });
    setMany(pageText,{color:'#0d5158','font-size':'inherit','font-weight':'inherit','line-height':'inherit'});

    [points,stars].forEach((pill,i)=>{
      setMany(pill,{
        margin:'0','min-height':m.pillH+'px',padding:m.pillPad,background:'rgba(255,255,255,.88)','border-width':'1.5px',
        'font-size':m.pill+'px','font-weight':'700','line-height':'1','box-shadow':'none',transform:'none','grid-area':i===0?'points':'stars'
      });
      const svg=pill&&pill.querySelector('svg');
      setMany(svg,{width:m.icon+'px',height:m.icon+'px'});
    });
    if(points){set(points,'border-color','rgba(19,100,106,.48)');set(points,'color','#0b666c');}
    if(stars){set(stars,'border-color','#dfc976');set(stars,'color','#9a7410');}

    setMany(avatar,{
      width:m.avatar+'px',height:m.avatar+'px','min-width':m.avatar+'px','min-height':m.avatar+'px','max-width':m.avatar+'px','max-height':m.avatar+'px',
      padding:'0','border-radius':m.radius+'px',border:'0',background:'rgba(255,255,255,.96)','font-size':m.avatarFont+'px',
      'box-shadow':'0 8px 22px rgba(20,78,83,.11)',transform:'none'
    });
    setMany(menuAnchor,{'align-self':'flex-start','z-index':'9'});
    setMany(dropdown,{top:'calc(100% + 9px)'});

    root.querySelectorAll('.menu-row').forEach(el=>set(el,'display','none'));
    host.dataset.headerDirect=BUILD+'-'+mode;
  }

  const curveStyle=document.createElement('style');
  curveStyle.id='studyV3HeaderCurveVars';
  curveStyle.textContent=`
    .study-v3-header-shell::before{height:var(--v3-pink-h,40px)!important;}
    .study-v3-header-shell::after{height:var(--v3-curve-h,68px)!important;bottom:var(--v3-curve-bottom,-38px)!important;}
  `;
  document.head.appendChild(curveStyle);

  let queued=false;
  const queueApply=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;apply();});
  };

  apply();
  new MutationObserver(queueApply).observe(host.shadowRoot,{childList:true,subtree:true});
  window.addEventListener('resize',queueApply,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(queueApply,80),{passive:true});
})();
