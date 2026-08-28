(async function(){
  'use strict';

  const BUILD='20260829-headercontrol1';
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

  // One page-level shell owns the visible cyan/pink band. The shared
  // student-header keeps all identity, points, avatar, menu and auth behavior.
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

  const outerId='studyV3HeaderShellStyle';
  document.getElementById(outerId)?.remove();
  const outerStyle=document.createElement('style');
  outerStyle.id=outerId;
  outerStyle.dataset.headerBuild=BUILD;
  outerStyle.textContent=`
    .study-v3-header-shell{
      position:relative !important;
      isolation:isolate !important;
      display:block !important;
      width:100% !important;
      max-width:none !important;
      height:142px !important;
      min-height:142px !important;
      max-height:142px !important;
      margin:0 0 20px !important;
      padding:0 !important;
      overflow:hidden !important;
      transform:none !important;
      zoom:1 !important;
      background:linear-gradient(112deg,#c7f8f8 0%,#72e1e6 53%,#3bc6cf 100%) !important;
    }
    .study-v3-header-shell::before,
    .study-v3-header-shell::after{
      content:'' !important;
      display:block !important;
      position:absolute !important;
      pointer-events:none !important;
    }
    .study-v3-header-shell::before{
      z-index:1 !important;
      width:58% !important;
      height:42px !important;
      left:57% !important;
      bottom:0 !important;
      background:#ffc5df !important;
      border-radius:76% 24% 0 0 / 100% 100% 0 0 !important;
      transform:rotate(-3deg) !important;
    }
    .study-v3-header-shell::after{
      z-index:2 !important;
      width:116% !important;
      height:72px !important;
      left:-8% !important;
      bottom:-40px !important;
      background:#f2f3f5 !important;
      border-radius:61% 39% 0 0 / 100% 100% 0 0 !important;
      transform:rotate(-1.1deg) !important;
    }
    .study-v3-header-shell > student-header{
      position:relative !important;
      z-index:6 !important;
      display:block !important;
      width:100% !important;
      height:112px !important;
      min-height:112px !important;
      max-height:112px !important;
      margin:0 !important;
      padding:0 !important;
      transform:none !important;
      zoom:1 !important;
    }
    @media(max-width:700px){
      .study-v3-header-shell{
        height:126px !important;
        min-height:126px !important;
        max-height:126px !important;
        margin-bottom:16px !important;
      }
      .study-v3-header-shell::before{width:62% !important;left:55% !important;height:36px !important;}
      .study-v3-header-shell::after{width:120% !important;left:-10% !important;height:64px !important;bottom:-36px !important;}
      .study-v3-header-shell > student-header{
        height:98px !important;
        min-height:98px !important;
        max-height:98px !important;
      }
    }
  `;
  document.head.appendChild(outerStyle);

  host.style.setProperty('--study-v3-page','#f2f3f5');

  const shadowCss=`
    :host{
      display:block !important;
      position:relative !important;
      z-index:6 !important;
      width:100% !important;
      height:112px !important;
      min-height:112px !important;
      max-height:112px !important;
      margin:0 !important;
      padding:0 !important;
      overflow:visible !important;
      transform:none !important;
      zoom:1 !important;
      background:transparent !important;
    }
    header{
      position:relative !important;
      inset:auto !important;
      width:100% !important;
      height:112px !important;
      min-height:112px !important;
      max-height:112px !important;
      box-sizing:border-box !important;
      padding:20px 34px 12px !important;
      margin:0 !important;
      border:0 !important;
      overflow:visible !important;
      transform:none !important;
      background:transparent !important;
      box-shadow:none !important;
    }
    header::before,header::after{content:none !important;display:none !important;}
    .top{
      position:relative !important;
      z-index:7 !important;
      display:flex !important;
      align-items:flex-start !important;
      min-height:82px !important;
      gap:18px !important;
      transform:none !important;
    }
    .top::before{
      content:'' !important;
      position:absolute !important;
      z-index:-1 !important;
      display:block !important;
      width:190px !important;
      height:190px !important;
      left:0 !important;
      top:-111px !important;
      border-radius:50% !important;
      background:rgba(255,255,255,.27) !important;
      pointer-events:none !important;
    }
    .info{
      display:grid !important;
      grid-template-columns:auto auto !important;
      grid-template-areas:'name name' 'points stars' !important;
      align-items:center !important;
      justify-items:start !important;
      column-gap:12px !important;
      row-gap:8px !important;
      transform:none !important;
    }
    .title{
      grid-area:name !important;
      display:block !important;
      margin:0 !important;
      padding:0 !important;
      min-height:0 !important;
      border:0 !important;
      border-radius:0 !important;
      background:transparent !important;
      color:#0b555c !important;
      font-size:48px !important;
      font-weight:800 !important;
      line-height:.95 !important;
      letter-spacing:-.04em !important;
      transform:none !important;
    }
    .points-pill{grid-area:points !important;}
    .stars-pill{grid-area:stars !important;}
    .points-pill,.stars-pill{
      margin:0 !important;
      min-height:38px !important;
      padding:8px 14px !important;
      background:rgba(255,255,255,.86) !important;
      backdrop-filter:blur(7px) !important;
      border-width:1.5px !important;
      font-size:18px !important;
      font-weight:700 !important;
      line-height:1 !important;
      box-shadow:none !important;
      transform:none !important;
    }
    .points-pill svg,.stars-pill svg{width:19px !important;height:19px !important;}
    .points-pill{border-color:rgba(19,100,106,.48) !important;color:#0b666c !important;}
    .stars-pill{border-color:#dfc976 !important;color:#9a7410 !important;}
    .spacer{flex:1 !important;}
    .page-title{
      align-self:flex-start !important;
      margin:7px 20px 0 auto !important;
      color:#0d5158 !important;
      font-size:48px !important;
      font-weight:800 !important;
      line-height:.95 !important;
      letter-spacing:-.035em !important;
      transform:none !important;
    }
    .page-title-text{color:#0d5158 !important;font:inherit !important;}
    .avatar{
      width:70px !important;
      height:70px !important;
      min-width:70px !important;
      min-height:70px !important;
      border-radius:22px !important;
      border:0 !important;
      background:rgba(255,255,255,.96) !important;
      font-size:38px !important;
      box-shadow:0 8px 22px rgba(20,78,83,.11) !important;
      transform:none !important;
    }
    .menu-anchor{align-self:flex-start !important;z-index:9 !important;}
    .dropdown{top:calc(100% + 9px) !important;}
    .menu-row{display:none !important;}

    @media(max-width:700px){
      :host{height:98px !important;min-height:98px !important;max-height:98px !important;}
      header{height:98px !important;min-height:98px !important;max-height:98px !important;padding:17px 16px 10px !important;}
      .top{min-height:72px !important;gap:10px !important;}
      .top::before{width:150px !important;height:150px !important;left:0 !important;top:-88px !important;}
      .info{column-gap:7px !important;row-gap:7px !important;}
      .title{font-size:36px !important;}
      .points-pill,.stars-pill{min-height:31px !important;padding:6px 9px !important;font-size:15px !important;}
      .points-pill svg,.stars-pill svg{width:16px !important;height:16px !important;}
      .page-title{font-size:36px !important;margin-right:7px !important;}
      .avatar{width:56px !important;height:56px !important;min-width:56px !important;min-height:56px !important;border-radius:18px !important;font-size:30px !important;}
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
    if(!current||current.dataset.headerBuild!==BUILD) installShadow();
  });
  observer.observe(host.shadowRoot,{childList:true});
})();
