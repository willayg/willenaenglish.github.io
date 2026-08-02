(function(){
'use strict';
var legacy=document.querySelector('#languageBtn');
var buttons=[].slice.call(document.querySelectorAll('[data-language-choice]'));
if(!legacy||!buttons.length)return;
function current(){return document.documentElement.lang==='ko'?'ko':'en'}
function sync(){var lang=current();buttons.forEach(function(button){var active=button.dataset.languageChoice===lang;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))})}
buttons.forEach(function(button){button.addEventListener('click',function(){var target=button.dataset.languageChoice;if(target===current())return;legacy.click();setTimeout(sync,0)})});
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
sync();
})();
