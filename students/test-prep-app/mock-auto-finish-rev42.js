(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function isMock(){return String(window.WillenaAssignedTestPrep?.selection?.section||'').toLowerCase()==='mock'}
function finished(){return !!$('#card .result')}
async function step(){
 const card=$('#card');if(!card||finished())return false;
 const check=card.querySelector('#mockCheck');if(!check)return false;
 const input=card.querySelector('#mockWrittenAnswer');
 if(input){
  if(!input.disabled&&check.textContent?.includes('정답 확인')){
   input.value='__REV42__';
   input.dispatchEvent(new Event('input',{bubbles:true}));
   await delay(15);
   if(!check.disabled)check.click();
   await delay(70);
  }
  const next=card.querySelector('#mockCheck');
  if(next&&!next.disabled&&/다음 문제|결과 보기/.test(next.textContent||''))next.click();
  await delay(120);
  return true;
 }
 const choice=card.querySelector('.choice');
 if(choice){
  if(!card.querySelector('.choice.selected')&&check.textContent?.includes('정답 확인'))choice.click();
  await delay(15);
  const first=card.querySelector('#mockCheck');
  if(first&&!first.disabled&&first.textContent?.includes('정답 확인'))first.click();
  await delay(70);
  const next=card.querySelector('#mockCheck');
  if(next&&!next.disabled&&/다음 문제|결과 보기/.test(next.textContent||''))next.click();
  await delay(120);
  return true;
 }
 return false;
}
async function run(button){
 if(button.disabled)return;
 button.disabled=true;const old=button.textContent;button.textContent='AUTO MOCK...';
 try{
  let misses=0;
  for(let i=0;i<160&&!finished();i++){
   if(await step()){misses=0;continue}
   misses++;await delay(160);if(misses>15)break;
  }
  if(!finished())alert('모의고사 자동 종료가 끝 화면까지 도달하지 못했습니다.');
 }finally{button.disabled=false;button.textContent=old}
}
document.addEventListener('click',e=>{
 const b=e.target instanceof Element?e.target.closest('#tpRev42AutoFinish'):null;
 if(!b||!isMock())return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 run(b);
},true);
})();
