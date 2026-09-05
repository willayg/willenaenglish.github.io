(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
let skipActive=false,patchedAuth=false,lastCard='';

function styles(){
 if($('#tpSkipStyles'))return;
 const s=document.createElement('style');
 s.id='tpSkipStyles';
 s.textContent=`
 .tp-skip-wrap{display:flex;justify-content:center;margin:18px 0 2px;padding-top:8px}
 .tp-skip{appearance:none;border:0;background:transparent;color:#8b969d;font:700 12px/1.2 inherit;padding:8px 10px;border-radius:9px;cursor:pointer;opacity:.82}
 .tp-skip:hover{background:#f5f7f8;color:#67737a;opacity:1}
 .tp-skip:disabled{opacity:.35;cursor:default}
 `;
 document.head.appendChild(s);
}

function patchAuth(){
 const a=window.WillenaTestPrepAuth;
 if(patchedAuth||!a||typeof a.recordAttempt!=='function')return;
 const original=a.recordAttempt.bind(a);
 a.recordAttempt=function(payload){
  if(skipActive&&payload){
   payload={...payload,selected_answer:[],is_correct:false,metadata:{...(payload.metadata||{}),skipped:true,skip_source:'student_skip_button'}};
  }
  return original(payload);
 };
 patchedAuth=true;
}

function currentIndex(){
 const t=$('#card .qnum')?.textContent||'';
 const n=parseInt(t,10);
 return Number.isFinite(n)&&n>0?n-1:0;
}

function isEligibleCard(){
 const card=$('#card');
 if(!card||card.querySelector('.result,.empty,.loading'))return false;
 if(card.querySelector('#check')){
  const sec=String(window.WillenaTestPrepQuestionEngine?.section||'').toLowerCase();
  return ['communication','grammar','reading'].includes(sec);
 }
 return !!card.querySelector('#seosulCheck');
}

function inject(){
 patchAuth();styles();
 const card=$('#card');
 if(!card||!isEligibleCard()||card.querySelector('.tp-skip-wrap'))return;
 const body=card.querySelector('.body')||card;
 body.insertAdjacentHTML('beforeend','<div class="tp-skip-wrap"><button type="button" class="tp-skip" id="tpSkipQuestion">건너뛰기 →</button></div>');
 $('#tpSkipQuestion')?.addEventListener('click',skipCurrent);
}

function advanceSoon(){
 setTimeout(()=>{
  const mc=$('#check');
  if(mc&&!mc.disabled&&/다음 문제|결과 보기/.test(mc.textContent||''))mc.click();
  const seo=$('#seosulCheck');
  if(seo&&!seo.disabled&&/다음 문제|결과 보기/.test(seo.textContent||''))seo.click();
  skipActive=false;
 },90);
 setTimeout(()=>{skipActive=false;inject()},400);
}

function skipMc(){
 const q=window.WillenaTestPrepQuestionEngine?.currentQuestion;
 const check=$('#check');
 if(!q||!check)return false;
 const ans=new Set((q.correct_answer||[]).map(String));
 const choices=[...document.querySelectorAll('#card .choice[data-i]')];
 const wrong=choices.find(b=>!ans.has(String(b.dataset.i)))||choices[0];
 if(!wrong)return false;
 skipActive=true;
 wrong.click();
 check.click();
 advanceSoon();
 return true;
}

function skipSeosul(){
 const check=$('#seosulCheck');
 if(!check)return false;
 const engine=window.WillenaSeosulEngine;
 const idx=currentIndex();
 const q=engine?.questions?.[idx]||null;
 let restoreAi=null,restoreType=null;
 if(q&&Object.prototype.hasOwnProperty.call(q,'aiAllowed')){
  restoreAi=q.aiAllowed;
  q.aiAllowed=false;
 }
 if(q&&['dialogue_completion','constrained_translation','given_words_grammar'].includes(String(q.type||''))){
  restoreType=q.type;
  q.type='student_skipped';
 }
 const input=$('#seosulAnswer');
 if(input){
  input.value='__SKIPPED__';
  input.dispatchEvent(new Event('input',{bubbles:true}));
 }
 check.disabled=false;
 skipActive=true;
 check.click();
 setTimeout(()=>{
  if(q&&restoreAi!==null)q.aiAllowed=restoreAi;
  if(q&&restoreType!==null)q.type=restoreType;
 },20);
 advanceSoon();
 return true;
}

function skipCurrent(e){
 e?.preventDefault?.();
 const btn=e?.currentTarget||$('#tpSkipQuestion');
 if(btn)btn.disabled=true;
 patchAuth();
 if($('#card #check')){if(!skipMc()&&btn)btn.disabled=false;return;}
 if($('#card #seosulCheck')){if(!skipSeosul()&&btn)btn.disabled=false;return;}
 if(btn)btn.disabled=false;
}

function poll(){
 patchAuth();
 const card=$('#card');
 const sig=card?`${card.querySelector('.qnum')?.textContent||''}|${!!card.querySelector('#check')}|${!!card.querySelector('#seosulCheck')}|${card.querySelector('.result')?'r':''}`:'';
 if(sig!==lastCard){lastCard=sig;inject();}
 else if(card&&isEligibleCard()&&!card.querySelector('.tp-skip-wrap'))inject();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{styles();setInterval(poll,250)},{once:true});
else{styles();setInterval(poll,250)}
})();
