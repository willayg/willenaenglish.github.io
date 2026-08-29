(async function(){
  'use strict';

  const BUILD='20260829-header-testprep-size1';
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
    if(w<=620) return 'phone';
    if(w<=860) return 'mid';
    return 'desktop';
  }

  function metrics(mode){
    if(mode==='phone') return {
      shell:148, host:96, pad:'19px 16px 8px', top:66, gap:10,
      name:21, page:22, pill:12, pillH:29, pillPad:'5px 9px', icon:16,
      avatar:48, avatarFont:26, radius:15, curve:70, curveBottom:-45, pink:34
    };
    if(mode==='mid') return {
      shell:170, host:108, pad:'24px 24px 8px', top:74, gap:14,
      name:26, page:28, pill:13, pillH:32, pillPad:'6px 10px', icon:17,
      avatar:56, avatarFont:31, radius:18, curve:86, curveBottom:-54, pink:40
    };
    return {
      shell:184, host:116, pad:'27px 30px 8px', top:78, gap:18,
      name:30, page:32, pill:14, pillH:34, pillPad:'7px 12px', icon:18,
      avatar:62, avatarFont:34, radius:20, curve:94, curveBottom:-59, pink:44
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
      'justify-items':'start','column-gap':mode==='phone'?'8px':'9px','row-gap':mode==='phone'?'5px':'7px',transform:'none'
    });
    setMany(name,{
      'grid-area':'name',display:'block',margin:'0',padding:'0','min-height':'0',border:'0','border-radius':'0',background:'transparent',
      color:'#0b555c','font-size':m.name+'px','font-weight':'800','line-height':'1','letter-spacing':'-.035em',transform:'none'
    });
    setMany(page,{
      'align-self':'flex-start',margin:(mode==='phone'?'2px 6px 0 auto':mode==='mid'?'4px 12px 0 auto':'5px 16px 0 auto'),
      color:'#0d5158','font-size':m.page+'px','font-weight':'800','line-height':'1','letter-spacing':'-.035em',transform:'none'
    });
    setMany(pageText,{color:'#0d5158','font-size':'inherit','font-weight':'inherit','line-height':'inherit'});

    [points,stars].forEach((pill,i)=>{
      setMany(pill,{
        margin:'0','min-height':m.pillH+'px',padding:m.pillPad,background:'rgba(255,255,255,.68)','border-width':'1.5px',
        'font-size':m.pill+'px','font-weight':'800','line-height':'1','box-shadow':'none',transform:'none','grid-area':i===0?'points':'stars'
      });
      const svg=pill&&pill.querySelector('svg');
      setMany(svg,{width:m.icon+'px',height:m.icon+'px'});
    });
    if(points){set(points,'border-color','rgba(19,100,106,.48)');set(points,'color','#0b666c');}
    if(stars){set(stars,'border-color','#dfc976');set(stars,'color','#9a7410');}

    setMany(avatar,{
      width:m.avatar+'px',height:m.avatar+'px','min-width':m.avatar+'px','min-height':m.avatar+'px','max-width':m.avatar+'px','max-height':m.avatar+'px',
      padding:'0','border-radius':m.radius+'px',border:'0',background:'rgba(255,255,255,.94)','font-size':m.avatarFont+'px',
      'box-shadow':'0 8px 24px rgba(15,80,90,.12)',transform:'none'
    });
    setMany(menuAnchor,{'align-self':'flex-start','z-index':'9'});
    setMany(dropdown,{top:'calc(100% + 9px)'});

    root.querySelectorAll('.menu-row').forEach(el=>set(el,'display','none'));
    host.dataset.headerDirect=BUILD+'-'+mode;
  }

  const curveStyle=document.createElement('style');
  curveStyle.id='studyV3HeaderCurveVars';
  curveStyle.textContent=`
    .study-v3-header-shell::before{height:var(--v3-pink-h,44px)!important;}
    .study-v3-header-shell::after{height:var(--v3-curve-h,94px)!important;bottom:var(--v3-curve-bottom,-59px)!important;}
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
