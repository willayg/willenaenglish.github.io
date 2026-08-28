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
      margin:0 0 18px;
      overflow:hidden;
      --study-v3-page:#f4f7f8;
    }
    header{
      position:relative !important;
      top:auto !important;
      width:100% !important;
      min-height:142px !important;
      padding:23px 34px 49px !important;
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
      height:43px;
      left:58%;
      bottom:-5px;
      background:#ffc5df;
      border-radius:76% 24% 0 0 / 100% 100% 0 0;
      transform:rotate(-3deg);
    }
    header::after{
      z-index:3;
      width:120%;
      height:82px;
      left:-10%;
      bottom:-43px;
      background:var(--study-v3-page,#f4f7f8);
      border-radius:61% 39% 0 0 / 100% 100% 0 0;
      transform:rotate(-1.1deg);
    }
    .top{
      position:relative;
      z-index:6;
      display:flex;
      align-items:flex-start;
      min-height:72px;
      gap:18px;
    }
    .top::before{
      content:'';
      position:absolute;
      z-index:-1;
      width:190px;
      height:190px;
      left:8px;
      top:-105px;
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
      row-gap:10px;
    }
    .title{
      grid-area:name;
      display:block;
      padding:0;
      min-height:0;
      border-radius:0;
      background:transparent;
      color:#0b555c !important;
      font-size:36px;
      font-weight:800;
      line-height:1;
      letter-spacing:-.04em;
    }
    .points-pill{grid-area:points;}
    .stars-pill{grid-area:stars;}
    .points-pill,
    .stars-pill{
      margin:0 !important;
      min-height:38px;
      padding:9px 14px;
      background:rgba(255,255,255,.82);
      backdrop-filter:blur(7px);
      border-width:1.5px;
      font-size:16px;
      line-height:1;
      box-shadow:none;
    }
    .points-pill svg,
    .stars-pill svg{
      width:17px;
      height:17px;
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
      margin:7px 18px 0 auto;
      color:#0d5158 !important;
      font-size:36px;
      font-weight:800;
      line-height:1;
      letter-spacing:-.035em;
    }
    .page-title-text{color:#0d5158 !important;}
    .avatar{
      width:64px;
      height:64px;
      border-radius:21px;
      border:0;
      background:rgba(255,255,255,.96);
      font-size:34px;
      box-shadow:0 8px 22px rgba(20,78,83,.11);
    }
    .menu-anchor{
      align-self:center;
      z-index:8;
    }
    .dropdown{top:calc(100% + 9px);}
    .menu-row{display:none !important;}

    @media (max-width:700px){
      :host{margin-bottom:14px;}
      header{
        min-height:126px !important;
        padding:18px 18px 43px !important;
      }
      header::before{
        width:62%;
        left:55%;
        height:36px;
        bottom:-3px;
      }
      header::after{
        width:124%;
        left:-12%;
        height:70px;
        bottom:-38px;
      }
      .top::before{
        width:155px;
        height:155px;
        left:0;
        top:-90px;
      }
      .info{column-gap:8px;row-gap:8px;}
      .title{font-size:28px;}
      .points-pill,.stars-pill{
        min-height:32px;
        padding:7px 10px;
        font-size:13px;
      }
      .points-pill svg,.stars-pill svg{width:14px;height:14px;}
      .page-title{font-size:28px;margin-right:8px;}
      .avatar{width:52px;height:52px;border-radius:18px;font-size:28px;}
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
