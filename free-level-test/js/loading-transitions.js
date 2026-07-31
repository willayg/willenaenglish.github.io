(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;
var bypass=false;
function isKorean(){return document.documentElement.lang==='ko'||(document.querySelector('#languageBtn')&&document.querySelector('#languageBtn').textContent.trim()==='English')}
function loadingText(kind){if(isKorean())return kind==='results'?'결과를 준비하고 있습니다':'테스트를 준비하고 있습니다';return kind==='results'?'Preparing your results':'Preparing your test'}
function showLoading(kind,callback){var text=loadingText(kind);root.classList.remove('is-swapping');root.innerHTML='<section class="screen prep-screen screen-safe-ready"><div class="prep-loader" aria-hidden="true"></div><h2>'+text+'</h2></section>';setTimeout(function(){bypass=true;callback();setTimeout(function(){bypass=false},0)},900)}
function setupLengthButton(target){var button=target.closest&&target.closest('.setup-option');if(!button)return null;var holder=button.closest('.setup-options');return holder&&holder.getAttribute('data-key')==='length'?button:null}
function finalNextButton(target){var button=target.closest&&target.closest('#next');if(!button)return null;var meta=root.querySelector('.question-meta');if(!meta)return null;var spans=meta.querySelectorAll('span');if(spans.length<2)return null;var match=(spans[1].textContent||'').match(/(\d+)\s*\/\s*(\d+)/);return match&&Number(match[1])===Number(match[2])?button:null}
root.addEventListener('click',function(event){if(bypass)return;var lengthButton=setupLengthButton(event.target);if(lengthButton){event.preventDefault();event.stopImmediatePropagation();showLoading('test',function(){lengthButton.click()});return}var finalButton=finalNextButton(event.target);if(finalButton&&!finalButton.disabled){event.preventDefault();event.stopImmediatePropagation();showLoading('results',function(){finalButton.click()})}},true);
})();