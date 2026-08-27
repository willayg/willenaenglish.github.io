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
 #tpHomePlanTop .tp-dday{display:inline-flex;align-items:center;justify-content:center;padding:6px 9px;border:1px solid #cfe9eb;border-radius:999px;background:#f7fbfb;color:#19777e;font-size:9px;font-weight:800;white-space:nowrap}
 .tp-exam-section>.tp-exam-head,.tp-exam-section>.tp-book{display:none!important}
 `;
 document.head.appendChild(s);
}
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
   pill.textContent=label;
 });
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
 if(!top){top=document.createElement('div');top.id='tpHomePlanTop';home.insertBefore(top,home.firstChild)}
 const html=sections.map(section=>{
   const head=section.querySelector(':scope > .tp-exam-head');
   const book=section.querySelector(':scope > .tp-book');
   if(!head&&!book)return'';
   return `<div class="tp-home-plan-meta">${head?head.outerHTML:''}${book?book.outerHTML:''}</div>`;
 }).join('');
 if(top.innerHTML!==html)top.innerHTML=html;
 addDday(top);
 top.querySelectorAll('[data-records]').forEach(btn=>{btn.onclick=e=>{e.stopPropagation();const original=home.querySelector(`.tp-exam-section [data-records="${CSS.escape(btn.dataset.records||'')}"]`);original?.click();};});
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(place)}
function boot(){styles();schedule();new MutationObserver(schedule).observe(document.getElementById('assignmentHome')||document.body,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(schedule,0));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();