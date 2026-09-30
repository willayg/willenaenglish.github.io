(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;
function isKorean(){return document.documentElement.lang==='ko'}
function loadingText(kind){if(isKorean())return kind==='results'?'결과를 준비하고 있습니다':'테스트를 준비하고 있습니다';return kind==='results'?'Preparing your results':'Preparing your test'}
function removeOverlay(overlay){if(overlay&&overlay.parentNode)overlay.parentNode.removeChild(overlay)}
function showLoading(kind){
  var overlay=document.createElement('div');
  overlay.className='prep-overlay';
  overlay.setAttribute('role','status');
  overlay.setAttribute('aria-live','polite');
  overlay.innerHTML='<div class="prep-ring"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="prep-ring-track" cx="110" cy="110" r="100"></circle><circle class="prep-ring-progress" cx="110" cy="110" r="100"></circle></svg><div class="prep-ring-content"><h2>'+loadingText(kind)+'</h2></div></div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(function(){overlay.classList.add('is-visible')});
  setTimeout(function(){overlay.classList.add('is-leaving');setTimeout(function(){removeOverlay(overlay)},220)},1800);
  setTimeout(function(){removeOverlay(overlay)},2600);
}
function setupLengthButton(target){var button=target.closest&&target.closest('.setup-option');if(!button)return null;var holder=button.closest('.setup-options');return holder&&holder.getAttribute('data-key')==='length'?button:null}
function finalNextButton(target){var button=target.closest&&target.closest('#next');if(!button)return null;var meta=root.querySelector('.question-meta');if(!meta)return null;var spans=meta.querySelectorAll('span');if(spans.length<2)return null;var match=(spans[1].textContent||'').match(/(\d+)\s*\/\s*(\d+)/);return match&&Number(match[1])===Number(match[2])?button:null}
root.addEventListener('click',function(event){
  var lengthButton=setupLengthButton(event.target);
  // Let the original click reach the engine. Re-clicking the same button here
  // is suppressed when the visitor handoff initiated it with button.click().
  if(lengthButton){showLoading('test');return}
  var finalButton=finalNextButton(event.target);
  if(finalButton&&!finalButton.disabled)showLoading('results');
},true);
})();
