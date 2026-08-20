(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.refresh!=='function')return;

var root=document.documentElement;
root.classList.add('willena-coach-booting');
var style=document.createElement('style');
style.textContent='.willena-coach-booting #aiChat{visibility:hidden!important;}';
document.head.appendChild(style);

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function home(){try{return JSON.parse(localStorage.getItem('willena-study-v2-home:v1:'+uid())||'null');}catch(_){return null;}}
function studyLevel(){
  var h=home(),books=arr(h&&h.books),wanted=text(h&&h.activeBookId),book=books.find(function(b){return String(b.book_id)===wanted;})||books[0]||null;
  if(!book)return 0;
  var direct=Number(book.public_level||book.publicLevel)||0;
  if(direct>=1&&direct<=10)return direct;
  var internal=Number(book.internal_level_id)||0;
  return internal>2&&internal<=12?internal-2:0;
}
function masteryReady(){
  var cards=Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]'));
  if(!cards.length)return false;
  return cards.some(function(card){
    var pct=card.querySelector('.header-skill-master-pct');
    return !!text(pct&&pct.textContent);
  });
}

async function boot(){
  var started=Date.now(),level=0;
  while(Date.now()-started<3500){
    level=studyLevel();
    if(level>0&&masteryReady())break;
    if(level>0&&Date.now()-started>1800)break;
    await sleep(100);
  }
  global.dispatchEvent(new CustomEvent('willena:coach-bootstrap-ready',{detail:{publicLevel:level,masteryReady:masteryReady()}}));
  await sleep(60);
  await coach.refresh();
  root.classList.remove('willena-coach-booting');
}

boot().catch(function(){root.classList.remove('willena-coach-booting');coach.refresh();});
})(window);
