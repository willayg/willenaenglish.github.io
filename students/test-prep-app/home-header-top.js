(function(){
'use strict';
let scheduled=false;
function styles(){
 if(document.getElementById('tpHomeHeaderTopStyles'))return;
 const s=document.createElement('style');
 s.id='tpHomeHeaderTopStyles';
 s.textContent=`
 #tpHomePlanTop{margin:0 0 16px}
 #tpHomePlanTop .tp-home-plan-meta{margin:0 0 12px}
 #tpHomePlanTop .tp-home-plan-meta:last-child{margin-bottom:0}
 #tpHomePlanTop .tp-exam-head{margin:0 2px 9px}
 #tpHomePlanTop .tp-book{margin:0 2px}
 .tp-exam-section>.tp-exam-head,.tp-exam-section>.tp-book{display:none!important}
 `;
 document.head.appendChild(s);
}
function place(){
 scheduled=false;
 styles();
 const home=document.getElementById('assignmentHome');
 if(!home||home.style.display==='none')return;
 if(home.querySelector('.tp-lesson-head,.tp-wrong-page-head'))return;
 const sections=[...home.querySelectorAll(':scope > .tp-exam-section')];
 if(!sections.length)return;
 let top=document.getElementById('tpHomePlanTop');
 if(!top){
   top=document.createElement('div');
   top.id='tpHomePlanTop';
   home.insertBefore(top,home.firstChild);
 }
 const html=sections.map(section=>{
   const head=section.querySelector(':scope > .tp-exam-head');
   const book=section.querySelector(':scope > .tp-book');
   if(!head&&!book)return'';
   return `<div class="tp-home-plan-meta">${head?head.outerHTML:''}${book?book.outerHTML:''}</div>`;
 }).join('');
 if(top.innerHTML!==html)top.innerHTML=html;
 top.querySelectorAll('[data-records]').forEach(btn=>{
   btn.onclick=e=>{
     e.stopPropagation();
     const original=home.querySelector(`.tp-exam-section [data-records="${CSS.escape(btn.dataset.records||'')}"]`);
     original?.click();
   };
 });
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(place)}
function boot(){styles();schedule();new MutationObserver(schedule).observe(document.getElementById('assignmentHome')||document.body,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(schedule,0));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
