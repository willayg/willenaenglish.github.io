(async function(){
  'use strict';

  const BUILD='20260829-headerresponsive3';
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
  const outerStyle=document.createElement('style');
  outerStyle.id='studyV3HeaderShellStyle';
  outerStyle.dataset.headerBuild=BUILD;
  outerStyle.textContent=`
    .study-v3-header-shell{
      position:relative!important;isolation:isolate!important;display:block!important;width:100%!important;max-width:none!important;
      height:170px!important;min-height:170px!important;max-height:170px!important;margin:0 0 20px!important;padding:0!important;
      overflow:hidden!important;transform:none!important;zoom:1!important;
      background:linear-gradient(112deg,#c7f8f8 0%,#72e1e6 53%,#3bc6cf 100%)!important;
    }
    .study-v3-header-shell::before,.study-v3-header-shell::after{content:''!important;display:block!important;position:absolute!important;pointer-events:none!important;}
    .study-v3-header-shell::before{z-index:1!important;width:58%!important;height:50px!important;left:57%!important;bottom:0!important;background:#ffc5df!important;border-radius:76% 24% 0 0 / 100% 100% 0 0!important;transform:rotate(-3deg)!important;}
    .study-v3-header-shell::after{z-index:2!important;width:116%!important;height:84px!important;left:-8%!important;bottom:-46px!important;background:#f2f3f5!important;border-radius:61% 39% 0 0 / 100% 100% 0 0!important;transform:rotate(-1.1deg)!important;}
    .study-v3-header-shell>student-header{position:relative!important;z-index:6!important;display:block!important;width:100%!important;height:132px!important;min-height:132px!important;max-height:132px!important;margin:0!important;padding:0!important;transform:none!important;zoom:1!important;}

    @media(max-width:480px){
      .study-v3-header-shell{height:88px!important;min-height:88px!important;max-height:88px!important;margin-bottom:12px!important;}
      .study-v3-header-shell::before{width:64%!important;left:53%!important;height:25px!important;}
      .study-v3-header-shell::after{width:122%!important;left:-11%!important;height:43px!important;bottom:-25px!important;}
      .study-v3-header-shell>student-header{height:70px!important;min-height:70px!important;max-height:70px!important;}
    }

    /* Tablet: shallower band, stronger content. */
    @media(min-width:900px){
      .study-v3-header-shell{height:148px!important;min-height:148px!important;max-height:148px!important;margin-bottom:18px!important;}
      .study-v3-header-shell::before{height:42px!important;}
      .study-v3-header-shell::after{height:70px!important;bottom:-39px!important;}
      .study-v3-header-shell>student-header{height:116px!important;min-height:116px!important;max-height:116px!important;}
    }
  `;
  document.head.appendChild(outerStyle);

  host.style.setProperty('--study-v3-page','#f2f3f5');

  const shadowCss=`
    :host{display:block!important;position:relative!important;z-index:6!important;width:100%!important;height:132px!important;min-height:132px!important;max-height:132px!important;margin:0!important;padding:0!important;overflow:visible!important;transform:none!important;zoom:1!important;background:transparent!important;}
    header{position:relative!important;inset:auto!important;width:100%!important;height:132px!important;min-height:132px!important;max-height:132px!important;box-sizing:border-box!important;padding:24px 38px 12px!important;margin:0!important;border:0!important;overflow:visible!important;transform:none!important;background:transparent!important;box-shadow:none!important;}
    header::before,header::after{content:none!important;display:none!important;}
    .top{position:relative!important;z-index:7!important;display:flex!important;align-items:flex-start!important;min-height:94px!important;gap:20px!important;transform:none!important;}
    .top::before{content:''!important;position:absolute!important;z-index:-1!important;display:block!important;width:220px!important;height:220px!important;left:0!important;top:-126px!important;border-radius:50%!important;background:rgba(255,255,255,.27)!important;pointer-events:none!important;}
    .info{display:grid!important;grid-template-columns:auto auto!important;grid-template-areas:'name name' 'points stars'!important;align-items:center!important;justify-items:start!important;column-gap:14px!important;row-gap:9px!important;transform:none!important;}
    .title{grid-area:name!important;display:block!important;margin:0!important;padding:0!important;min-height:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#0b555c!important;font-size:56px!important;font-weight:800!important;line-height:.95!important;letter-spacing:-.04em!important;transform:none!important;}
    .points-pill{grid-area:points!important}.stars-pill{grid-area:stars!important}
    .points-pill,.stars-pill{margin:0!important;min-height:42px!important;padding:9px 16px!important;background:rgba(255,255,255,.86)!important;backdrop-filter:blur(7px)!important;border-width:1.5px!important;font-size:20px!important;font-weight:700!important;line-height:1!important;box-shadow:none!important;transform:none!important;}
    .points-pill svg,.stars-pill svg{width:21px!important;height:21px!important}.points-pill{border-color:rgba(19,100,106,.48)!important;color:#0b666c!important}.stars-pill{border-color:#dfc976!important;color:#9a7410!important}.spacer{flex:1!important}
    .page-title{align-self:flex-start!important;margin:7px 20px 0 auto!important;color:#0d5158!important;font-size:56px!important;font-weight:800!important;line-height:.95!important;letter-spacing:-.035em!important;transform:none!important;}
    .page-title-text{color:#0d5158!important;font:inherit!important}
    .avatar{width:78px!important;height:78px!important;min-width:78px!important;min-height:78px!important;border-radius:24px!important;border:0!important;background:rgba(255,255,255,.96)!important;font-size:42px!important;box-shadow:0 8px 22px rgba(20,78,83,.11)!important;transform:none!important;}
    .menu-anchor{align-self:flex-start!important;z-index:9!important}.dropdown{top:calc(100% + 9px)!important}.menu-row{display:none!important}

    @media(max-width:480px){
      :host{height:70px!important;min-height:70px!important;max-height:70px!important}
      header{height:70px!important;min-height:70px!important;max-height:70px!important;padding:10px 12px 6px!important}
      .top{min-height:52px!important;gap:7px!important}.top::before{width:112px!important;height:112px!important;left:-4px!important;top:-67px!important}
      .info{column-gap:6px!important;row-gap:4px!important}.title{font-size:22px!important}
      .points-pill,.stars-pill{min-height:25px!important;padding:5px 8px!important;font-size:12px!important}.points-pill svg,.stars-pill svg{width:12px!important;height:12px!important}
      .page-title{font-size:24px!important;margin:2px 6px 0 auto!important}
      .avatar{width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;border-radius:14px!important;font-size:23px!important}
    }

    @media(min-width:900px){
      :host{height:116px!important;min-height:116px!important;max-height:116px!important}
      header{height:116px!important;min-height:116px!important;max-height:116px!important;padding:18px 38px 8px!important}
      .top{min-height:94px!important;gap:22px!important}
      .top::before{width:210px!important;height:210px!important;top:-123px!important}
      .info{column-gap:14px!important;row-gap:7px!important}
      .title{font-size:76px!important}
      .points-pill,.stars-pill{min-height:44px!important;padding:9px 16px!important;font-size:24px!important}
      .points-pill svg,.stars-pill svg{width:23px!important;height:23px!important}
      .page-title{font-size:76px!important;margin:4px 20px 0 auto!important}
      .avatar{width:88px!important;height:88px!important;min-width:88px!important;min-height:88px!important;border-radius:25px!important;font-size:48px!important}
    }
  `;

  const installShadow=()=>{
    const root=host.shadowRoot;
    if(!root)return;
    root.getElementById('studyV3HeaderSwoop')?.remove();
    const style=document.createElement('style');
    style.id='studyV3HeaderSwoop';
    style.dataset.headerBuild=BUILD;
    style.textContent=shadowCss;
    root.appendChild(style);
  };

  installShadow();
  const observer=new MutationObserver(()=>{
    const current=host.shadowRoot?.getElementById('studyV3HeaderSwoop');
    if(!current||current.dataset.headerBuild!==BUILD)installShadow();
  });
  observer.observe(host.shadowRoot,{childList:true});
})();
