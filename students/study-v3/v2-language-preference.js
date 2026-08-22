(function(global){
'use strict';
var KEY='willena-study-v2-language',restored=false;
function text(v){return String(v==null?'':v).trim();}
function get(){try{var v=text(localStorage.getItem(KEY));return v==='en'||v==='ko'?v:'ko';}catch(_){return'ko';}}
function set(lang){if(lang!=='en'&&lang!=='ko')return;try{localStorage.setItem(KEY,lang);}catch(_){}}
function currentFromButton(){var b=document.getElementById('languageBtn');if(!b)return'';return text(b.textContent)==='한국어'?'en':'ko';}
function restore(){if(restored)return;var b=document.getElementById('languageBtn');if(!b)return;restored=true;var wanted=get(),current=currentFromButton();if(current&&current!==wanted)b.click();}
function bind(){var b=document.getElementById('languageBtn');if(b)b.addEventListener('click',function(){setTimeout(function(){var lang=currentFromButton();if(lang)set(lang);},0);});global.addEventListener('willena:study-v2-ready',restore,{once:true});}
global.WillenaStudyV2LanguagePreference={version:'language-v2',get:get,set:set,current:currentFromButton,restore:restore};
bind();
})(window);
