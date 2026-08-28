(async function(){
  'use strict';

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

  /*
   * The shared header remains responsible for identity, points, stars,
   * avatar, menu and logout. The page-level shell owns only the visual
   * background/curve. Keep auth and menu behaviour entirely inside the
   * existing student-header component.
   */
  let shell=host.parentElement&&host.parentElement.classList.contains('study-v3-header-shell')
    ? host.parentElement
    : null;
  if(!shell){
    shell=document.createElement('div');
    shell.className='study-v3-header-shell';
    host.parentNode.insertBefore(shell,host);
    shell.appendChild(host);
  }

  if(!document.getElementById('studyV3HeaderShellStyle')){
    const outerStyle=document.createElement('style');
    outerStyle.id='studyV3HeaderShellStyle';
    outerStyle.textContent=`
      .study-v3-header-shell{
        position:relative;
        isolation:isolate;
        width:100%;
        height:142px;
        min-height:142px;
        margin:0 0 20px;
        overflow:hidden;
        background:linear-gradient(112deg,#c7f8f8 0%,#72e1e6 53%,#3bc6cf 100%);
      }
      .study-v3-header-shell::before,
      .study-v3-header-shell::after{
        content:'';
        position:absolute;
        pointer-events:none;
      }
      .study-v3-header-shell::before{
        z-index:1;
        width:58%;
        height:42px;
        left:57%;
        bottom:0;
        background:#ffc5df;
        border-radius:76% 24% 0 0 / 100% 100% 0 0;
        transform:rotate(-3deg);
      }
      .study-v3-header-shell::after{
        z-index:2;
        width:116%;
        height:72px;
        left:-8%;
        bottom:-40px;
        background:#f2f3f5;
        border-radius:61% 39% 0 0 / 100% 100% 0 0;
        transform:rotate(-1.1deg);
      }
      @media(max-width:700px){
        .study-v3-header-shell{
          height:126px;
          min-height:126px;
          margin-bottom:16px;
        }
        .study-v3-header-shell::before{
          width:62%;
          left:55%;
          height:36px;
        }
        .study-v3-header-shell::after{
          width:120%;
          left:-10%;
          height:64px;
          bottom:-36px;
        }
      }
    `;
    document.head.appendChild(outerStyle);
  }

  host.style.setProperty('--study-v3-page','#f2f3f5');

  const css=`
    :host{
      display:block !important;
      position:relative !important;
      z-index:6 !important;
      width:100% !important;
      height:auto !important;
      min-height:0 !important;
      margin:0 !important;
      overflow:visible !important;
      background:transparent !important;
    }
    header{
      position:relative !important;
      top:auto !important;
      left:auto !important;
      right:auto !important;
      width:100% !important;
      min-height:112px !important;
      height:auto !important;
      box-sizing:border-box !important;
      padding:20px 34px 12px !important;
      margin:0 !important;
      border:0 !important;
      overflow:visible !important;
      background:transparent !important;
      box-shadow:none !important;
    }
    header::before,
    header::after{content:none !important;display:none !important;}
    .top{
      position:relative;
      z-index:7;
      display:flex;
      align-items:flex-start;
      min-height:82px;
      gap:18px;
    }
    .top::before{
      content:'';
      position:absolute;
      z-index:-1;
      width:190px;
      height:190px;
      left:0;
      top:-111px;
      border-radius:50%;
      background:rgba(255,255,255,.27);
      pointer-events:none;
    }
    .info{
      display:grid;
      grid-template-columns:auto auto;
      grid-template-areas:'name name' 'points stars';
      align-items:center;
      justify-items:start;
      column-gap:12px;
      row-gap:8px;
    }
    .title{
      grid-area:name;
      display:block;
      padding:0;
      min-height:0;
      border-radius:0;
      background:transparent;
      color:#0b555c !important;
      font-size:48px !important;
      font-weight:800;
      line-height:.95;
      letter-spacing:-.04em;
    }
    .points-pill{grid-area:points;}
    .stars-pill{grid-area:stars;}
    .points-pill,
    .stars-pill{
      margin:0 !important;
      min-height:38px !important;
      padding:8px 14px !important;
      background:rgba(255,255,255,.86) !important;
      backdrop-filter:blur(7px);
      border-width:1.5px !important;
      font-size:18px !important;
      font-weight:700 !important;
      line-height:1 !important;
      box-shadow:none !important;
    }
    .points-pill svg,.stars-pill svg{width:19px !important;height:19px !important;}
    .points-pill{border-color:rgba(19,100,106,.48) !important;color:#0b666c !important;}
    .stars-pill{border-color:#dfc976 !important;color:#9a7410 !important;}
    .spacer{flex:1;}
    .page-title{
      align-self:flex-start;
      margin:7px 20px 0 auto !important;
      color:#0d5158 !important;
      font-size:48px !important;
      font-weight:800;
      line-height:.95;
      letter-spacing:-.035em;
    }
    .page-title-text{color:#0d5158 !important;}
    .avatar{
      width:70px !important;
      height:70px !important;
      border-radius:22px !important;
      border:0 !important;
      background:rgba(255,255,255,.96) !important;
      font-size:38px !important;
      box-shadow:0 8px 22px rgba(20,78,83,.11) !important;
    }
    .menu-anchor{align-self:flex-start;z-index:9;}
    .dropdown{top:calc(100% + 9px);}
    .menu-row{display:none !important;}

    @media(max-width:700px){
      header{
        min-height:98px !important;
        padding:17px 16px 10px !important;
      }
      .top{min-height:72px;gap:10px;}
      .top::before{width:150px;height:150px;left:0;top:-88px;}
      .info{column-gap:7px;row-gap:7px;}
      .title{font-size:36px !important;}
      .points-pill,.stars-pill{
        min-height:31px !important;
        padding:6px 9px !important;
        font-size:15px !important;
      }
      .points-pill svg,.stars-pill svg{width:16px !important;height:16px !important;}
      .page-title{font-size:36px !important;margin-right:7px !important;}
      .avatar{width:56px !important;height:56px !important;border-radius:18px !important;font-size:30px !important;}
    }
  `;

  const install=()=>{
    const root=host.shadowRoot;
    if(!root)return;
    const old=root.getElementById('studyV3HeaderSwoop');
    if(old)old.remove();
    const style=document.createElement('style');
    style.id='studyV3HeaderSwoop';
    style.textContent=css;
    root.appendChild(style);
  };

  install();
  const observer=new MutationObserver(()=>{
    if(!host.shadowRoot.getElementById('studyV3HeaderSwoop'))install();
  });
  observer.observe(host.shadowRoot,{childList:true});
})();
