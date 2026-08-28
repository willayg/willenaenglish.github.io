(async function(){
  'use strict';

  // Hide the staging-only V3 badge so it does not sit on top of the finished header.
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

  host.style.setProperty('--study-v3-page','#f4f7f8');

  const css=`
    :host{
      display:block;
      position:relative;
      z-index:30;
      width:100%;
      margin:0 0 22px;
      overflow:hidden;
      --study-v3-page:#f4f7f8;
    }
    header{
      position:relative !important;
      top:auto !important;
      width:100% !important;
      min-height:205px !important;
      padding:34px 42px 72px !important;
      margin:0 !important;
      border:0 !important;
      overflow:hidden !important;
      isolation:isolate;
      background:linear-gradient(112deg,#c7f8f8 0%,#72e1e6 53%,#3bc6cf 100%) !important;
      box-shadow:none !important;
    }
    header::before,
    header::after{
      content:'';
      position:absolute;
      pointer-events:none;
    }
    header::before{
      z-index:2;
      width:58%;
      height:58px;
      left:58%;
      bottom:-4px;
      background:#ffc5df;
      border-radius:76% 24% 0 0 / 100% 100% 0 0;
      transform:rotate(-3deg);
    }
    header::after{
      z-index:3;
      width:120%;
      height:112px;
      left:-10%;
      bottom:-59px;
      background:var(--study-v3-page,#f4f7f8);
      border-radius:61% 39% 0 0 / 100% 100% 0 0;
      transform:rotate(-1.1deg);
    }
    .top{
      position:relative;
      z-index:6;
      display:flex;
      align-items:flex-start;
      min-height:92px;
      gap:20px;
    }
    .top::before{
      content:'';
      position:absolute;
      z-index:-1;
      width:240px;
      height:240px;
      left:8px;
      top:-132px;
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
      row-gap:12px;
    }
    .title{
      grid-area:name;
      display:block;
      padding:0;
      min-height:0;
      border-radius:0;
      background:transparent;
      color:#0b555c !important;
      font-size:40px;
      font-weight:800;
      line-height:1;
      letter-spacing:-.04em;
    }
    .points-pill{grid-area:points;}
    .stars-pill{grid-area:stars;}
    .points-pill,
    .stars-pill{
      margin:0 !important;
      min-height:42px;
      padding:10px 16px;
      background:rgba(255,255,255,.82);
      backdrop-filter:blur(7px);
      border-width:1.5px;
      font-size:17px;
      line-height:1;
      box-shadow:none;
    }
    .points-pill svg,
    .stars-pill svg{
      width:18px;
      height:18px;
    }
    .points-pill{
      border-color:rgba(19,100,106,.48);
      color:#0b666c;
    }
    .stars-pill{
      border-color:#dfc976;
      color:#9a7410;
    }
    .spacer{flex:1;}
    .page-title{
      align-self:center;
      margin:12px 22px 0 auto;
      color:#0d5158 !important;
      font-size:40px;
      font-weight:800;
      line-height:1;
      letter-spacing:-.035em;
    }
    .page-title-text{color:#0d5158 !important;}
    .avatar{
      width:72px;
      height:72px;
      border-radius:22px;
      border:0;
      background:rgba(255,255,255,.96);
      font-size:38px;
      box-shadow:0 8px 22px rgba(20,78,83,.11);
    }
    .menu-anchor{
      align-self:center;
      z-index:8;
    }
    .dropdown{top:calc(100% + 9px);}
    .menu-row{display:none !important;}

    @media (max-width:700px){
      :host{margin-bottom:16px;}
      header{
        min-height:158px !important;
        padding:24px 20px 55px !important;
      }
      header::before{
        width:62%;
        left:55%;
        height:43px;
        bottom:-3px;
      }
      header::after{
        width:124%;
        left:-12%;
        height:84px;
        bottom:-45px;
      }
      .top::before{
        width:180px;
        height:180px;
        left:0;
        top:-102px;
      }
      .info{column-gap:8px;row-gap:9px;}
      .title{font-size:30px;}
      .points-pill,.stars-pill{
        min-height:34px;
        padding:8px 11px;
        font-size:14px;
      }
      .points-pill svg,.stars-pill svg{width:15px;height:15px;}
      .page-title{font-size:30px;margin-right:10px;}
      .avatar{width:56px;height:56px;border-radius:18px;font-size:30px;}
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
    if(!host.shadowRoot.getElementById('studyV3HeaderSwoop')) install();
  });
  observer.observe(host.shadowRoot,{childList:true});
})();
