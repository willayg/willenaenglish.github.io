(function(){
'use strict';
var strip=document.getElementById('unitStrip');
var root=document.getElementById('bookStudyContent');
if(!strip||!root)return;
var timer=0;
var changing=false;
function begin(){
  var h=Math.max(260,Math.round(root.getBoundingClientRect().height||0));
  root.style.minHeight=h+'px';
  root.classList.remove('is-unit-entering');
  root.classList.add('is-unit-switching');
  changing=true;
  clearTimeout(timer);
  timer=setTimeout(finish,2200);
}
function finish(){
  if(!changing)return;
  changing=false;
  clearTimeout(timer);
  root.classList.remove('is-unit-switching');
  root.classList.add('is-unit-entering');
  setTimeout(function(){
    root.classList.remove('is-unit-entering');
    root.style.minHeight='';
  },260);
}
strip.addEventListener('click',function(e){
  var b=e.target&&e.target.closest?e.target.closest('[data-unit-id]'):null;
  if(!b)return;
  var current=strip.querySelector('.is-current');
  if(current===b)return;
  begin();
},true);
if(window.MutationObserver){
  new MutationObserver(function(mutations){
    if(!changing)return;
    var ready=mutations.some(function(m){
      return m.type==='childList'&&root.querySelector('.book-study-content-top,.book-study-section');
    });
    if(ready)requestAnimationFrame(function(){requestAnimationFrame(finish);});
  }).observe(root,{childList:true,subtree:true});
}
})();
