(function(){
'use strict';
let scheduled=false;
function place(){
  scheduled=false;
  const home=document.getElementById('assignmentHome');
  if(!home||home.style.display==='none')return;
  if(home.querySelector('.tp-lesson-head,.tp-wrong-page-head'))return;
  let top=home.querySelector(':scope > .tp-home-exam-meta');
  const sections=[...home.querySelectorAll(':scope > .tp-exam-section')];
  if(!sections.length)return;
  if(!top){
    top=document.createElement('div');
    top.className='tp-home-exam-meta';
    home.insertBefore(top,home.firstChild);
  }
  for(const section of sections){
    const head=section.querySelector(':scope > .tp-exam-head');
    const book=section.querySelector(':scope > .tp-book');
    if(head)top.appendChild(head);
    if(book)top.appendChild(book);
  }
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(place)}
function styles(){
  if(document.getElementById('tpHomeExamMetaTopStyle'))return;
  const s=document.createElement('style');
  s.id='tpHomeExamMetaTopStyle';
  s.textContent='.tp-home-exam-meta{margin:0 0 16px}.tp-home-exam-meta .tp-exam-head{margin-top:0}.tp-home-exam-meta .tp-book{margin-bottom:0}.tp-home-exam-meta .tp-exam-head+.tp-book{margin-top:-2px}.tp-home-exam-meta .tp-book+.tp-exam-head{margin-top:18px}';
  document.head.appendChild(s);
}
function boot(){styles();schedule();new MutationObserver(schedule).observe(document.getElementById('assignmentHome')||document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
