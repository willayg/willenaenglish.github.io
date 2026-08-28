(function(){
'use strict';
const DURATION_MS=45*60*1000;
let timer=null,deadline=0,expired=false,lastText='';
const $=(s,r=document)=>r.querySelector(s);
function isMockState(){const s=history.state||{};return s.tp==='practice'&&(s.skill==='mock'||s.skill==='mock_all')}
function timerEl(){return $('#tpMockTimer')}
function ensureTimerEl(){
 const row=$('#assignedBackRow');
 if(!row)return null;
 let el=timerEl();
 if(!el){el=document.createElement('span');el.id='tpMockTimer';el.className='tp-mock-timer';row.appendChild(el)}
 return el;
}
function format(ms){const total=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(total/60),s=total%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function tick(){
 if(!deadline||!isMockState()){stop(false);return}
 const el=ensureTimerEl();if(!el)return;
 const left=deadline-Date.now(),next=left>0?`남은 시간 ${format(left)}`:'시간 종료 00:00';
 if(next!==lastText){el.textContent=next;lastText=next}
 el.classList.toggle('expired',left<=0);
 if(left<=0&&!expired){expired=true;el.setAttribute('aria-live','assertive')}
}
function start(){
 stop(false);expired=false;lastText='';deadline=Date.now()+DURATION_MS;
 timer=setInterval(tick,250);tick();
}
function stop(remove=true){if(timer){clearInterval(timer);timer=null}deadline=0;expired=false;lastText='';if(remove)timerEl()?.remove()}
function maybeStartFromClick(e){
 const t=e.target instanceof Element?e.target:null;if(!t)return;
 if(t.closest('.tp-mock-card,.tp-mock-all-card'))setTimeout(start,0);
 if(t.closest('.back-assign'))stop();
}
function sync(){
 if(isMockState()&&deadline){tick();return}
 const done=$('.result h2');
 if(done&&/모의고사 완료/.test(done.textContent||''))stop();
 else if(!isMockState())stop();
}
function boot(){document.addEventListener('click',maybeStartFromClick,true);window.addEventListener('popstate',()=>setTimeout(sync,0));const app=document.querySelector('.app')||document.body;new MutationObserver(muts=>{if(muts.some(m=>[...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1)))queueMicrotask(sync)}).observe(app,{childList:true,subtree:true});sync()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();