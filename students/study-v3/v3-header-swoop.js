(async function(){
  'use strict';

  await customElements.whenDefined('student-header');
  const host=document.querySelector('student-header');
  if(!host||!host.shadowRoot)return;

  host.style.setProperty('--study-v3-page','#f4f6f7');

  const css=`
    :host{
      display:block;
      position:relative;
      z-index:30;
      margin-bottom:24px;
      --study-v3-page:#f4f6f7;
    }
    header{
      position:relative !important;
      top:auto !important;
      overflow:visible !important;
      isolation:isolate;
      min-height:108px !important;
      padding:18px 26px 34px !important;
      margin:0 !important;
      border:0 !important;
      background:linear-gradient(112deg,#bff7f8 0%,#66dce2 57%,#43c6cf 100%) !important;
      box-shadow:none !important;
    }
    header::before,
    header::after{
      content:'';
      position:absolute;
      pointer-events:none;
    }
    header::before{
      z-index:1;
      width:96%;
      height:34px;
      left:36%;
      bottom:-14px;
      background:#ffc5df;
      border-radius:78% 22% 0 0 / 100% 100% 0 0;
      transform:rotate(-3deg);
      opacity:.68;
    }
    header::after{
      z-index:2;
      width:142%;
      height:70px;
      left:-18%;
      bottom:-48px;
      background:var(--study-v3-page,#f4f6f7);
      border-radius:57% 43% 0 0 / 100% 100% 0 0;
      transform:rotate(1.5deg);
    }
    .top{
      position:relative;
      z-index:5;
      min-height:54px;
      align-items:center;
      gap:12px;
    }
    .info{
      flex-direction:row;
      align-items:center;
      gap:8px;
    }
    .title{
      display:inline-flex;
      align-items:center;
      min-height:32px;
      padding:6px 12px;
      border-radius:999px;
      background:#174c50;
      color:#fff !important;
      font-size:14px;
      line-height:1;
      white-space:nowrap;
    }
    .points-pill,
    .stars-pill{
      margin:0 !important;
      min-height:32px;
      padding:6px 10px;
      background:rgba(255,255,255,.90);
      backdrop-filter:blur(7px);
      font-size:12px;
    }
    .points-pill{
      border-color:rgba(22,108,114,.36);
      color:#176d73;
    }
    .stars-pill{
      border-color:#e7cf7d;
      color:#9c7510;
    }
    .page-title{
      margin:0 8px 0 auto;
      color:#154f54 !important;
      font-size:23px;
      line-height:1;
    }
    .page-title-text{color:#154f54 !important;}
    .spacer{flex:1;}
    .avatar{
      width:48px;
      height:48px;
      border-radius:50%;
      border:2px solid #17868c;
      background:rgba(255,255,255,.96);
      font-size:26px;
      box-shadow:0 7px 20px rgba(20,78,83,.11);
    }
    .menu-anchor{z-index:8;}
    .dropdown{top:calc(100% + 9px);}
    .menu-row{display:none !important;}

    @media (max-width:700px){
      :host{margin-bottom:20px;}
      header{
        min-height:100px !important;
        padding:16px 15px 31px !important;
      }
      header::before{
        left:31%;
        width:105%;
        height:30px;
        bottom:-12px;
      }
      header::after{
        width:150%;
        left:-24%;
        height:62px;
        bottom:-43px;
      }
      .top{gap:8px;}
      .info{gap:6px;}
      .title{
        min-height:29px;
        padding:5px 10px;
        font-size:12px;
      }
      .points-pill,.stars-pill{
        min-height:29px;
        padding:5px 8px;
        font-size:11px;
      }
      .points-pill svg,.stars-pill svg{width:12px;height:12px;}
      .page-title{font-size:20px;margin-right:4px;}
      .avatar{width:43px;height:43px;font-size:23px;}
    }
  `;

  try{
    const sheet=new CSSStyleSheet();
    sheet.replaceSync(css);
    host.shadowRoot.adoptedStyleSheets=[...host.shadowRoot.adoptedStyleSheets,sheet];
  }catch(_){
    const style=document.createElement('style');
    style.id='studyV3HeaderSwoop';
    style.textContent=css;
    host.shadowRoot.appendChild(style);
  }
})();
