(function(global){
'use strict';
var banks={
 starterObject:[
  {assetKey:'cat'},{assetKey:'dog'},{assetKey:'tiger'},{assetKey:'pencil'},{assetKey:'book'},{assetKey:'apple'},{assetKey:'soccer-ball'},{assetKey:'car'},{assetKey:'rabbit'},{assetKey:'chair'}
 ],
 color:[
  {assetKey:'red-circle'},{assetKey:'blue-circle'},{assetKey:'green-circle'},{assetKey:'yellow-circle'},{assetKey:'purple-circle'},{assetKey:'orange-circle'},{assetKey:'brown-circle'},{assetKey:'black-circle'}
 ],
 pluralAnimals:[
  {assetKey:'frog',count:2},{assetKey:'cat',count:2},{assetKey:'dog',count:2},{assetKey:'rabbit',count:2},{assetKey:'fish',count:2},{assetKey:'bird',count:2}
 ],
 actions:[
  {assetKey:'running'},{assetKey:'swimming'},{assetKey:'reading'},{assetKey:'writing'},{assetKey:'dancing'},{assetKey:'microphone'},{assetKey:'bicycle'},{assetKey:'soccer-ball'}
 ],
 counting:[
  {assetKey:'apple',count:3},{assetKey:'cat',count:2},{assetKey:'soccer-ball',count:4},{assetKey:'pencil',count:5},{assetKey:'frog',count:3},{assetKey:'book',count:4}
 ]
};
var indexByRequest={};
var activeModal=null;
function assets(){return global.WillenaAssessmentAssets||null}
function resolve(key){var a=assets();return a&&typeof a.resolve==='function'?a.resolve(key):null}
function requestKey(detail){return String(detail&&detail.prompt_id||detail&&detail.visual_key||'visual')}
function installStyle(){
 if(document.getElementById('willenaSpeakingVisualStyle'))return;
 var style=document.createElement('style');style.id='willenaSpeakingVisualStyle';style.textContent='\
.willena-speaking-visual-overlay{position:fixed;inset:0;z-index:190000;display:grid;place-items:center;padding:20px;background:rgba(9,28,43,.9);backdrop-filter:blur(6px)}.willena-speaking-visual-card{width:min(760px,94vw);min-height:min(620px,82vh);display:grid;align-content:center;justify-items:center;gap:28px;padding:40px;border-radius:34px;background:#fff;box-shadow:0 28px 90px rgba(0,0,0,.32)}.willena-speaking-visual-images{width:100%;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:clamp(12px,3vw,28px)}.willena-speaking-visual-images img{width:clamp(120px,22vw,220px);height:clamp(120px,22vw,220px);object-fit:contain}.willena-speaking-visual-images.is-many img{width:clamp(72px,15vw,132px);height:clamp(72px,15vw,132px)}.willena-speaking-visual-close{position:fixed;right:22px;top:max(18px,env(safe-area-inset-top));width:56px;height:56px;border:0;border-radius:50%;background:#fff;color:#17243f;font:500 38px/1 system-ui;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.24)}.willena-speaking-visual-next{min-height:54px;border:1px solid #c9dadd;border-radius:16px;background:#f7fbfc;color:#17243f;padding:0 22px;font:800 15px Poppins,system-ui,sans-serif;cursor:pointer}.willena-speaking-visual-error{color:#6d7d96;font:700 15px Poppins,system-ui,sans-serif;text-align:center}@media(max-width:620px){.willena-speaking-visual-card{min-height:72vh;padding:24px 18px}.willena-speaking-visual-close{width:50px;height:50px;font-size:34px}.willena-speaking-visual-images{gap:12px}.willena-speaking-visual-images img{width:min(36vw,170px);height:min(36vw,170px)}.willena-speaking-visual-images.is-many img{width:min(24vw,105px);height:min(24vw,105px)}}';document.head.appendChild(style);
}
function close(){if(activeModal){activeModal.remove();activeModal=null}}
function renderImages(item){
 var src=resolve(item.assetKey),count=Math.max(1,Math.min(6,Number(item.count)||1));
 if(!src)return'<div class="willena-speaking-visual-error">Visual asset unavailable: '+String(item.assetKey)+'</div>';
 var html='';for(var i=0;i<count;i++)html+='<img src="'+src+'" alt="" aria-hidden="true">';
 return'<div class="willena-speaking-visual-images '+(count>=3?'is-many':'')+'">'+html+'</div>';
}
function open(detail){
 installStyle();close();detail=detail||{};var bank=banks[detail.visual_key]||[];
 if(!bank.length)return false;
 var key=requestKey(detail),index=Number(indexByRequest[key])||0,item=bank[index%bank.length],ko=(document.documentElement.lang||'ko').toLowerCase().indexOf('ko')===0;
 var overlay=document.createElement('div');overlay.className='willena-speaking-visual-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',ko?'말하기 그림':'Speaking visual');
 overlay.innerHTML='<button class="willena-speaking-visual-close" type="button" aria-label="Close">×</button><section class="willena-speaking-visual-card">'+renderImages(item)+'<button class="willena-speaking-visual-next" type="button">'+(ko?'다음 그림':'Next picture')+'</button></section>';
 document.body.appendChild(overlay);activeModal=overlay;
 overlay.querySelector('.willena-speaking-visual-close').onclick=close;
 overlay.onclick=function(event){if(event.target===overlay)close()};
 overlay.querySelector('.willena-speaking-visual-next').onclick=function(){indexByRequest[key]=(index+1)%bank.length;open(detail)};
 document.addEventListener('keydown',escapeOnce,{once:true});
 return true;
}
function escapeOnce(event){if(event.key==='Escape')close()}
window.addEventListener('willena:speaking-visual-request',function(event){open(event&&event.detail||{})});
global.WillenaSpeakingVisuals={banks:banks,open:open,close:close,resolve:resolve};
})(window);
