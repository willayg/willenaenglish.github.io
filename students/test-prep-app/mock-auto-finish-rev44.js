(function(){
'use strict';
function isMock(){const s=history.state||{};return s.tp==='practice'&&(s.skill==='mock'||s.skill==='mock_all')}
document.addEventListener('click',async e=>{
 const b=e.target instanceof Element?e.target.closest('#tpRev42AutoFinish'):null;
 if(!b||!isMock())return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 if(b.disabled)return;
 const old=b.textContent;b.disabled=true;b.textContent='AUTO MOCK...';
 try{const ok=await window.WillenaMockController?.autoFinish?.();if(!ok)alert('모의고사 자동 종료가 끝 화면까지 도달하지 못했습니다. 현재 화면을 확인해 주세요.')}catch(err){console.error('[REV44 mock auto]',err);alert('모의고사 자동 종료 중 오류가 발생했습니다.')}finally{b.disabled=false;b.textContent=old}
},true);
})();
