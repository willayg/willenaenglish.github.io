import './grammar-guide-lessons.js?v=1.0.0';
import './grammar-guide-deep.js?v=1.0.0';
import {GUIDES,resolveGuideKeys,openGuide} from './grammar-guide.js?v=2.1.0';

let activeKeys=[];
let activeIndex=0;

function availableKeysFromPanel(panel){
  const title=String(panel?.title||'');
  const marker='Lesson grammar targets: ';
  if(!title.startsWith(marker))return [];
  const targets=title.slice(marker.length).split(',').map(v=>v.trim()).filter(Boolean);
  return resolveGuideKeys(targets).filter(key=>GUIDES[key]);
}

function decorateOverlay(){
  const overlay=document.querySelector('.grammar-guide-overlay');
  const sheet=overlay?.querySelector('.gg-sheet');
  if(!overlay||!sheet||!activeKeys.length)return;
  overlay.querySelector('.gg-lesson-nav')?.remove();
  const current=GUIDES[activeKeys[activeIndex]];
  const nav=document.createElement('div');
  nav.className='gg-lesson-nav';
  nav.innerHTML=`
    <button type="button" class="gg-nav-btn" data-gg-prev ${activeIndex===0?'disabled':''} aria-label="이전 문법">←</button>
    <div class="gg-nav-center"><small>이 Lesson 문법</small><strong>${activeIndex+1} / ${activeKeys.length}</strong><span>${current?.title||''}</span></div>
    <button type="button" class="gg-nav-btn" data-gg-next ${activeIndex===activeKeys.length-1?'disabled':''} aria-label="다음 문법">→</button>`;
  sheet.appendChild(nav);
  nav.querySelector('[data-gg-prev]')?.addEventListener('click',()=>showAt(activeIndex-1));
  nav.querySelector('[data-gg-next]')?.addEventListener('click',()=>showAt(activeIndex+1));
}

function showAt(index){
  if(index<0||index>=activeKeys.length)return;
  activeIndex=index;
  openGuide(activeKeys[activeIndex]);
  decorateOverlay();
}

function simplifyPanel(panel){
  if(!panel||panel.dataset.ggSingleReady==='1')return;
  const keys=availableKeysFromPanel(panel);
  if(!keys.length)return;
  panel.dataset.ggSingleReady='1';
  panel.innerHTML='<button type="button" class="grammar-guide-single" data-gg-open-lesson><b>문법 설명</b></button>';
  panel.querySelector('[data-gg-open-lesson]')?.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    activeKeys=keys;
    activeIndex=0;
    showAt(0);
  });
}

function scan(){
  document.querySelectorAll('.grammar-guide-panel').forEach(panel=>{
    if(panel.title?.startsWith('Lesson grammar targets: '))simplifyPanel(panel);
  });
}

const observer=new MutationObserver(scan);
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['title']});
scan();

window.addEventListener('keydown',event=>{
  if(!document.querySelector('.grammar-guide-overlay')||activeKeys.length<2)return;
  if(event.key==='ArrowLeft')showAt(activeIndex-1);
  if(event.key==='ArrowRight')showAt(activeIndex+1);
});
