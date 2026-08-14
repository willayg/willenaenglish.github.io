(function(){
'use strict';
var mq=window.matchMedia('(orientation: landscape) and (min-width:700px) and (max-height:760px)');
var headerStyleId='studyV2ShortLandscapeHeader';
function compactHeader(){
  var header=document.querySelector('student-header');
  if(!header||!header.shadowRoot)return;
  var old=header.shadowRoot.getElementById(headerStyleId);
  if(!mq.matches){if(old)old.remove();return;}
  if(old)return;
  var s=document.createElement('style');
  s.id=headerStyleId;
  s.textContent='header{padding:4px 10px!important;min-height:44px!important} .top{min-height:36px!important;gap:8px!important;justify-content:space-between!important} .info{flex-direction:row!important;gap:5px!important;align-items:center!important} .points-pill,.stars-pill{padding:2px 6px!important;font-size:10px!important;gap:4px!important} .points-pill svg,.stars-pill svg{width:11px!important;height:11px!important} .page-title,.title{font-size:15px!important;line-height:1!important} .avatar{width:32px!important;height:32px!important;font-size:17px!important;border-width:1.5px!important} .btn{padding:5px 8px!important;font-size:11px!important;border-radius:8px!important} .mut{display:none!important}';
  header.shadowRoot.appendChild(s);
}
function deviceLang(){var l=String((navigator.languages&&navigator.languages[0])||navigator.language||'en').toLowerCase();return l.indexOf('ko')===0?'ko':'en';}
function applyDeviceLanguage(){
  var btn=document.getElementById('languageBtn');
  if(!btn||btn.dataset.deviceDefaultApplied==='1')return;
  btn.dataset.deviceDefaultApplied='1';
  var target=deviceLang();
  document.documentElement.dataset.studyDeviceLang=target;
  /* V2 starts in Korean and labels the toggle "English". Ask the existing controller to switch once on non-Korean devices. */
  if(target==='en'&&/^english$/i.test(String(btn.textContent||'').trim())){
    setTimeout(function(){btn.click();},0);
  }
}
function ready(){compactHeader();applyDeviceLanguage();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
if(mq.addEventListener)mq.addEventListener('change',compactHeader);else mq.addListener(compactHeader);
window.addEventListener('resize',compactHeader);
window.addEventListener('orientationchange',function(){setTimeout(compactHeader,100);});
customElements.whenDefined('student-header').then(function(){setTimeout(compactHeader,0);});
})();
