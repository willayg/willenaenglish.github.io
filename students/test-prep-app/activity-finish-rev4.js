(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
function styles(){if($('#tpFinishRev4Styles'))return;const s=document.createElement('style');s.id='tpFinishRev4Styles';s.textContent=`
 #card.tp-skip-transition .choices,
 #card.tp-skip-transition .feedback,
 #card.tp-skip-transition .explanation,
 #card.tp-skip-transition .actions{visibility:hidden!important}
 #card.tp-skip-transition .tp-skip-wrap{visibility:visible!important}
 #card.tp-skip-transition .tp-skip{opacity:.45!important;pointer-events:none!important}
 #tpLegacyNotice{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,31,38,.56);font-family:Poppins,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
 #tpLegacyNotice[hidden]{display:none!important}
 #tpLegacyNotice .tp-legacy-box{width:min(440px,100%);box-sizing:border-box;padding:26px 24px 22px;border-radius:24px;background:#fff;color:#203039;box-shadow:0 22px 70px rgba(0,0,0,.25);text-align:center}
 #tpLegacyNotice h2{margin:0 0 10px;font-size:24px;line-height:1.3}
 #tpLegacyNotice p{margin:0;color:#5e6f76;font-size:14px;line-height:1.65}
 #tpLegacyNotice .tp-legacy-note{margin-top:10px;font-size:12px;color:#829097}
 #tpLegacyNotice .tp-legacy-actions{display:grid;gap:10px;margin-top:22px}
 #tpLegacyNotice button{width:100%;min-height:48px;border:0;border-radius:14px;font:800 14px/1.2 Poppins,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
 #tpLegacyNotice .tp-use-new{background:#19777e;color:#fff}
 #tpLegacyNotice .tp-continue-old{background:#eef3f4;color:#42545b}
 `;document.head.appendChild(s)}
function legacyNotice(){
  const KEY='willena_testprep_legacy_notice_until_v1';
  try{if(Number(localStorage.getItem(KEY)||0)>Date.now())return}catch(_){ }
  if($('#tpLegacyNotice'))return;
  const wrap=document.createElement('div');wrap.id='tpLegacyNotice';wrap.innerHTML=`<div class="tp-legacy-box" role="dialog" aria-modal="true" aria-labelledby="tpLegacyTitle"><h2 id="tpLegacyTitle">새 시험 대비 앱을 사용해 보세요</h2><p>현재 사용 중인 시험 대비 앱은 곧 지원이 종료될 예정입니다.<br>새 버전은 더 빠르고 안정적이며 학습 기록 기능도 개선되었습니다.</p><p class="tp-legacy-note">오래된 태블릿에서는 기존 버전을 계속 사용할 수 있습니다.</p><div class="tp-legacy-actions"><button type="button" class="tp-use-new">새 버전 사용하기</button><button type="button" class="tp-continue-old">이 버전 계속 사용하기</button></div></div>`;
  document.body.appendChild(wrap);
  $('.tp-use-new',wrap).onclick=()=>{location.href='/students/test-prep-v2/'};
  $('.tp-continue-old',wrap).onclick=()=>{try{localStorage.setItem(KEY,String(Date.now()+86400000))}catch(_){ }wrap.hidden=true};
}
function boot(){styles();legacyNotice()}
document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target:null;if(!t)return;const skip=t.closest('#tpSkipQuestion');if(!skip)return;const card=$('#card');card?.classList.add('tp-skip-transition');setTimeout(()=>card?.classList.remove('tp-skip-transition'),180)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();