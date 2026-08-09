(function(){
'use strict';
var KEY='willena-study-preview-book';
function active(){try{return !!sessionStorage.getItem(KEY);}catch(_){return false;}}
function mount(){
 if(!active())return;
 var main=document.getElementById('app');if(!main||document.getElementById('studyPreviewWarning'))return;
 var bar=document.createElement('div');bar.id='studyPreviewWarning';bar.className='study-preview-warning';
 var text=document.createElement('div');text.innerHTML='<strong>PREVIEW MODE</strong><span>Practice and mastery are recorded for this student. The assigned book is not changed.</span>';
 var reset=document.createElement('button');reset.type='button';reset.textContent='Return to assigned book';
 reset.addEventListener('click',function(){try{sessionStorage.removeItem(KEY);}catch(_){}location.reload();});
 bar.appendChild(text);bar.appendChild(reset);
 main.insertBefore(bar,main.firstChild);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
