(function(){
'use strict';
function styles(){if(document.getElementById('tpHomeHeaderTopStyles'))return;const s=document.createElement('style');s.id='tpHomeHeaderTopStyles';s.textContent=`
#tpHomePlanTop{margin:0 0 16px}#tpHomePlanTop .tp-home-plan-meta{margin:0 0 10px}#tpHomePlanTop .tp-exam-head{margin:0 2px 10px}#tpHomePlanTop .tp-book{margin:0 2px}.tp-exam-section>.tp-exam-head,.tp-exam-section>.tp-book{display:none!important}
`;document.head.appendChild(s)}
function move(){
 styles();
 const home=document.getElementById('assignmentHome');if(!home||home.style.display==='none')return;
 const sections=[...home.querySelectorAll(':scope > .tp-exam-section')];if(!sections.length)return;
 let top=document.getElementById('tpHomePlanTop');if(!top){top=document.createElement('div');top.id='tpHomePlanTop';home.insertBefore(top,home.firstChild)}
 const wanted=[];
 sections.forEach((section,i)=>{
   const head=section.querySelector(':scope > .tp-exam-head');
   const book=section.querySelector(':scope > .tp-book');
   if(!head&&!book)return;
   let wrap=top.querySelector(`[data-plan-top-index="${i}"]`);
   if(!wrap){wrap=document.createElement('div');wrap.className='tp-home-plan-meta';wrap.dataset.planTopIndex=String(i);top.appendChild(wrap)}
   if(head&&!wrap.contains(head)){head.style.display='';wrap.appendChild(head)}
   if(book&&!wrap.contains(book)){book.style.display='';wrap.appendChild(book)}
   wanted.push(wrap);
 });
 [...top.children].forEach(x=>{if(!wanted.includes(x))x.remove()});
 if(!top.children.length)top.remove();
}
function boot(){styles();move();new MutationObserver(()=>requestAnimationFrame(move)).observe(document.body,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(move,0));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
