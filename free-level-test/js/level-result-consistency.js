(function(){
'use strict';
const ENDPOINT_PART='/functions/v1/prospective-level-test';
const seenAnswers=new Set();
const clampLevel=value=>Math.max(1,Math.min(12,Number(value)||1));
const publicNumber=internal=>internal<=2?internal:internal-2;
const originalFetch=window.fetch.bind(window);

function extractInternalLevel(){
  const screen=document.querySelector('#app .screen');
  if(!screen||!screen.querySelector('.result-title'))return null;
  const candidates=[
    screen.querySelector('[data-internal-level]')?.getAttribute('data-internal-level'),
    screen.querySelector('.result-level')?.textContent,
    screen.querySelector('.result-title')?.textContent,
    screen.textContent
  ].filter(Boolean);
  for(const value of candidates){
    const match=String(value).match(/(?:internal\s*)?(?:level|레벨|단계)\s*(\d{1,2})/i);
    if(match)return clampLevel(match[1]);
  }
  return null;
}

function rememberInternalLevel(){
  const level=extractInternalLevel();
  if(level){
    window.WillenaInternalResultLevel=level;
    sessionStorage.setItem('willena_internal_result_level',String(level));
  }
}

function authoritativeLevel(){
  return clampLevel(window.WillenaInternalResultLevel||sessionStorage.getItem('willena_internal_result_level')||1);
}

function correctRenderedReport(){
  const internal=authoritativeLevel();
  if(!internal)return;
  const levelBox=document.querySelector('.report-level');
  if(levelBox){
    const label=levelBox.querySelector('span');
    const number=levelBox.querySelector('strong');
    if(label)label.textContent=document.documentElement.lang==='ko'?(internal<=2?'스타터':'레벨'):(internal<=2?'Starter':'Level');
    if(number)number.textContent=String(publicNumber(internal));
  }
  document.querySelectorAll('.level-node').forEach((node,index)=>{
    node.classList.toggle('is-complete',index+1<internal);
    node.classList.toggle('is-current',index+1===internal);
  });
  document.querySelectorAll('.a4-level-orbit strong').forEach(el=>el.textContent=String(publicNumber(internal)));
}

window.fetch=async function(input,init){
  let nextInit=init;
  const url=typeof input==='string'?input:input?.url||'';
  if(url.includes(ENDPOINT_PART)&&init?.method?.toUpperCase()==='POST'&&typeof init.body==='string'){
    try{
      const body=JSON.parse(init.body);
      if(body.action==='answer'){
        const key=[body.attempt_id,body.assessment_item_id].join(':');
        if(seenAnswers.has(key))return new Response(JSON.stringify({success:true,duplicate_ignored:true}),{status:200,headers:{'content-type':'application/json'}});
        seenAnswers.add(key);
      }
      if(body.action==='finish'){
        const internal=authoritativeLevel();
        const unique=[];
        const ids=new Set();
        for(const row of Array.isArray(body.answers)?body.answers:[]){
          const key=String(row.assessment_item_id||row.assessment_source_key||row.answer_index);
          if(ids.has(key))continue;
          ids.add(key);
          unique.push({...row,answer_index:unique.length+1});
        }
        body.answers=unique;
        body.recommended_level=internal;
        body.display_level=internal;
        nextInit={...init,body:JSON.stringify(body)};
      }
    }catch(_){ }
  }
  return originalFetch(input,nextInit);
};

const observer=new MutationObserver(()=>{
  rememberInternalLevel();
  queueMicrotask(correctRenderedReport);
});
observer.observe(document.documentElement,{subtree:true,childList:true});
rememberInternalLevel();
correctRenderedReport();
})();