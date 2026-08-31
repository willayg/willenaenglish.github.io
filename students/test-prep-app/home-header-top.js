(function(){
'use strict';
let scheduled=false,bound=false;
function makeDday(dateText){
 const m=String(dateText||'').match(/(\d{4})-(\d{2})-(\d{2})/);
 if(!m)return'';
 const now=new Date();
 const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
 const exam=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
 const days=Math.round((exam-today)/86400000);
 return days===0?'D-DAY':days>0?`D-${days}`:`D+${Math.abs(days)}`;
}
function addDday(top){
 top.querySelectorAll('.tp-exam-head').forEach(head=>{
   const actions=head.querySelector('.tp-exam-actions');
   const date=head.querySelector('.tp-exam-date');
   if(!actions||!date)return;
   const label=makeDday(date.textContent);
   if(!label)return;
   let pill=actions.querySelector('.tp-dday');
   if(!pill){pill=document.createElement('span');pill.className='tp-dday';actions.insertBefore(pill,date)}
   if(pill.textContent!==label)pill.textContent=label;
 });
}
function bindClicks(){
 if(bound)return;bound=true;
 document.addEventListener('click',e=>{
   const btn=e.target.closest?.('#tpHomePlanTop [data-records]');
   if(!btn)return;
   e.preventDefault();
   e.stopPropagation();
   const id=btn.dataset.records||'';
   if(window.WillenaStudentDisplay?.showStatsByPlanId){
     window.WillenaStudentDisplay.showStatsByPlanId(id);
     return;
   }
   const home=document.getElementById('assignmentHome');
   const original=[...(home?.querySelectorAll('.tp-exam-section [data-records]')||[])].find(x=>String(x.dataset.records)===String(id));
   original?.click();
 },true);
}
function place(){
 scheduled=false;
 bindClicks();
 const home=document.getElementById('assignmentHome');
 if(!home||home.style.display==='none')return;
 if(home.querySelector('.tp-lesson-head,.tp-wrong-page-head'))return;
 const sections=[...home.querySelectorAll(':scope > .tp-exam-section')];
 if(!sections.length)return;
 let top=document.getElementById('tpHomePlanTop');
 if(!top){top=document.createElement('div');top.id='tpHomePlanTop';home.insertBefore(top,home.firstChild)}
 const html=sections.map(section=>{
   const head=section.querySelector(':scope > .tp-exam-head');
   const book=section.querySelector(':scope > .tp-book');
   if(!head&&!book)return'';
   return `<div class="tp-home-plan-meta">${head?head.outerHTML:''}${book?book.outerHTML:''}</div>`;
 }).join('');
 const signature=sections.map(section=>{
   const btn=section.querySelector(':scope > .tp-exam-head [data-records]');
   const school=section.querySelector(':scope > .tp-exam-head h2')?.textContent||'';
   const exam=section.querySelector(':scope > .tp-exam-head p')?.textContent||'';
   const date=section.querySelector(':scope > .tp-exam-head .tp-exam-date')?.textContent||'';
   const book=section.querySelector(':scope > .tp-book')?.textContent||'';
   return [btn?.dataset.records||'',school,exam,date,book].join('|');
 }).join('||');
 if(top.dataset.signature!==signature){
   top.innerHTML=html;
   top.dataset.signature=signature;
 }
 addDday(top);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(place)}
function boot(){bindClicks();schedule();new MutationObserver(schedule).observe(document.getElementById('assignmentHome')||document.body,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(schedule,0));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();