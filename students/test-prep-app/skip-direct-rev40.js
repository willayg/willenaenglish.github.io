(function(){
'use strict';
// REV40: normal MC skip must never synthesize a delayed click.
function isMcSkip(target){return !!target?.closest?.('#tpSkipQuestion')&&!!document.querySelector('#card #check')}
function directSkip(){
 const engine=window.WillenaTestPrepQuestionEngine,q=engine?.currentQuestion,checkBtn=document.getElementById('check');
 if(!q||!checkBtn||document.querySelector('#card .result'))return false;
 const ans=new Set((q.correct_answer||[]).map(String)),choices=[...document.querySelectorAll('#card .choice[data-i]')],wrong=choices.find(b=>!ans.has(String(b.dataset.i)))||choices[0];
 if(!wrong)return false;
 wrong.click();
 if(typeof window.check==='function'){
  window.check(q);
  window.check(q);
  return true;
 }
 checkBtn.click();
 const next=document.getElementById('check');
 if(next&&next.isConnected)next.click();
 return true;
}
document.addEventListener('click',e=>{
 const target=e.target instanceof Element?e.target:null;if(!isMcSkip(target))return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 const btn=target.closest('#tpSkipQuestion');if(btn)btn.disabled=true;
 directSkip();
},true);
window.WillenaTestPrepDirectSkip={skipMc:directSkip};
console.info('[Test Prep REV40] delayed MC skip clicks removed');
})();
