(function(){
'use strict';
var mq=window.matchMedia('(orientation: landscape) and (min-width:700px) and (max-width:1366px)');
var headerStyleId='studyV2ShortLandscapeHeader';
function isTabletLandscape(){
  var touch=false;
  try{touch=Number(navigator.maxTouchPoints||0)>0||('ontouchstart' in window);}catch(_){}
  return mq.matches&&touch;
}
function compactHeader(){
  var header=document.querySelector('student-header');
  if(!header||!header.shadowRoot)return;
  var old=header.shadowRoot.getElementById(headerStyleId);
  if(!isTabletLandscape()){if(old)old.remove();return;}
  if(old)old.remove();
  var s=document.createElement('style');
  s.id=headerStyleId;
  s.textContent=[
    'header{padding:3px 10px!important;min-height:42px!important;height:42px!important;display:flex!important;align-items:center!important}',
    '.top{width:100%!important;height:36px!important;min-height:36px!important;display:grid!important;grid-template-columns:auto minmax(80px,1fr) auto!important;align-items:center!important;gap:10px!important;justify-content:initial!important}',
    '.info{grid-column:1!important;grid-row:1!important;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;gap:5px!important;align-items:center!important;justify-content:flex-start!important;min-width:0!important;white-space:nowrap!important}',
    '.info>.title,.info>.points-pill,.info>.stars-pill{display:inline-flex!important;flex:0 0 auto!important;margin:0!important}',
    '.page-title{grid-column:2!important;grid-row:1!important;justify-self:center!important;align-self:center!important;margin:0!important;font-size:14px!important;line-height:1!important;white-space:nowrap!important}',
    '.menu-anchor{grid-column:3!important;grid-row:1!important;justify-self:end!important;align-self:center!important;display:flex!important;align-items:center!important}',
    '.spacer{display:none!important}',
    '.points-pill,.stars-pill{padding:2px 6px!important;font-size:10px!important;gap:4px!important;line-height:1!important;min-height:22px!important}',
    '.points-pill svg,.stars-pill svg{width:11px!important;height:11px!important}',
    '.title{font-size:13px!important;line-height:1!important;margin:0!important;max-width:120px!important;overflow:hidden!important;text-overflow:ellipsis!important}',
    '.avatar{width:30px!important;height:30px!important;font-size:16px!important;border-width:1.5px!important}',
    '.btn{padding:4px 7px!important;font-size:10px!important;border-radius:8px!important;min-height:28px!important}',
    '.mut{display:none!important}',
    '.dropdown{top:calc(100% + 4px)!important}'
  ].join(' ');
  header.shadowRoot.appendChild(s);
}
function deviceLang(){var l=String((navigator.languages&&navigator.languages[0])||navigator.language||'en').toLowerCase();return l.indexOf('ko')===0?'ko':'en';}
function applyDeviceLanguage(){
  var btn=document.getElementById('languageBtn');
  if(!btn||btn.dataset.deviceDefaultApplied==='1')return;
  btn.dataset.deviceDefaultApplied='1';
  var target=deviceLang();
  document.documentElement.dataset.studyDeviceLang=target;
  if(target==='en'&&/^english$/i.test(String(btn.textContent||'').trim()))setTimeout(function(){btn.click();},0);
}
function ready(){compactHeader();applyDeviceLanguage();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
if(mq.addEventListener)mq.addEventListener('change',compactHeader);else mq.addListener(compactHeader);
window.addEventListener('resize',compactHeader);
window.addEventListener('orientationchange',function(){setTimeout(compactHeader,100);});
customElements.whenDefined('student-header').then(function(){setTimeout(compactHeader,0);});
})();
