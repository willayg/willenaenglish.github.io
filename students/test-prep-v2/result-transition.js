const STYLE_ID='willena-result-transition-style';
const OVERLAY_ID='willena-result-calculating';
const MIN_VISIBLE_MS=900;

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    .result-transition-hidden{visibility:hidden!important}
    #${OVERLAY_ID}{display:flex;align-items:center;justify-content:center;min-height:280px;padding:32px 20px;text-align:center;color:inherit}
    #${OVERLAY_ID} .result-calc-inner{display:flex;flex-direction:column;align-items:center;gap:16px}
    #${OVERLAY_ID} .result-calc-spinner{width:52px;height:52px;border-radius:50%;border:5px solid color-mix(in srgb,currentColor 18%,transparent);border-top-color:currentColor;animation:willenaResultSpin .8s linear infinite}
    #${OVERLAY_ID} strong{font:800 22px/1.25 Poppins,sans-serif}
    #${OVERLAY_ID} span{opacity:.7;font:600 14px/1.4 Poppins,sans-serif}
    @keyframes willenaResultSpin{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){#${OVERLAY_ID} .result-calc-spinner{animation:none;border-top-color:inherit}}
  `;
  document.head.appendChild(style);
}

function showTransition(result){
  if(!result||result.dataset.resultTransitionDone==='1')return;
  result.dataset.resultTransitionDone='1';
  result.classList.add('result-transition-hidden');

  const overlay=document.createElement('div');
  overlay.id=OVERLAY_ID;
  overlay.setAttribute('role','status');
  overlay.setAttribute('aria-live','polite');
  overlay.innerHTML='<div class="result-calc-inner"><div class="result-calc-spinner" aria-hidden="true"></div><strong>점수를 계산하는 중...</strong><span>잠시만 기다려 주세요.</span></div>';
  result.before(overlay);

  window.setTimeout(()=>{
    overlay.remove();
    result.classList.remove('result-transition-hidden');
  },MIN_VISIBLE_MS);
}

installStyles();

const screen=document.getElementById('screen');
if(screen){
  const observer=new MutationObserver(()=>{
    const result=screen.querySelector('.card.result');
    if(result)showTransition(result);
  });
  observer.observe(screen,{childList:true,subtree:true});
  const initial=screen.querySelector('.card.result');
  if(initial)showTransition(initial);
}
