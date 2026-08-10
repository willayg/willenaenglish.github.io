(function(){
'use strict';
if(!/^\/students\/study\/?(?:index\.html)?$/i.test(location.pathname))return;
try{
 var uid=String(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId')||'').trim();
 var prefix=uid?'willena-study-cache:v1:'+uid+':':'',maxAge=7*24*60*60*1000;
 function read(k){if(!prefix)return null;var raw=localStorage.getItem(prefix+k);if(!raw)return null;var o=JSON.parse(raw);if(!o||!o.t||Date.now()-o.t>maxAge)return null;return o.v||null;}
 function by(id){return document.getElementById(id);}
 function txt(id,v){var e=by(id);if(e&&v!=null&&v!=='')e.textContent=v;}
 var summary=read('summary');if(summary){txt('bookTitle',summary.bookTitle);txt('unitTitle',summary.unitText);}
 var map=by('learningMap');if(map)map.innerHTML='<div class="study-sk-unit"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line"></div><div class="study-sk study-sk-line short"></div></div><div class="study-sk-unit"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line"></div><div class="study-sk study-sk-line short"></div></div><div class="study-sk-unit"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line"></div><div class="study-sk study-sk-line short"></div></div>';
 var grid=by('skillGrid');if(grid){var cards='';for(var i=0;i<6;i++)cards+='<div class="study-sk-card" aria-hidden="true"><div class="study-sk study-sk-icon"></div><div class="study-sk-lines"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line short"></div></div></div>';grid.innerHTML=cards;}
 var vocab=by('vocabPreview');if(vocab){var rows='';for(var j=0;j<5;j++)rows+='<div class="study-sk-vrow" aria-hidden="true"><div class="study-sk study-sk-vicon"></div><div class="study-sk-lines"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line short"></div></div></div>';vocab.innerHTML=rows;}
 var status=by('contentStatus');if(status)status.textContent='';
}catch(_){ }
if(!document.querySelector('script[data-study-home-polish]')){var s=document.createElement('script');s.src='./study-home-polish.js?v=20260810-home2';s.dataset.studyHomePolish='1';s.defer=true;document.head.appendChild(s);}
})();