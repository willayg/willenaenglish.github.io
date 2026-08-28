(function(){
'use strict';

const LEGACY_IDS=new Set([
  'studentUxV4Styles',
  'tpHomeHeaderTopStyles',
  'tpDisplayPolishStyle',
  'tp-inline-bank-style',
  'tpVocabCardControlsStyle',
  'tpMockStyle',
  'tpMockAllStyle',
  'tpMockTimerStyle',
  'mockReviewFinishStyles',
  'testPrepVocabStyle',
  'testPrepVocabTestStyle',
  'testPrepSentenceStyle'
]);

const SIGNATURES=[
  '.tp-shell-loading{',
  '#trackingDebug{',
  '.tp-task-shelf{display:flex',
  '.tp-source-pill{display:inline-grid',
  '.vp-mode{display:flex!important',
  '.tp-mock-card{width:100%',
  '.tp-mock-all-card{width:100%',
  '.tp-mock-timer{margin-left:auto',
  '.mock-finish-animation{position:relative',
  '.vp-wrap,.vp-wrap *{font-family',
  '.vt-wrap,.vt-wrap *{font-family',
  '.sp-wrap,.sp-wrap *{font-family',
  '.context .items.bank-inline{'
];

function isLegacyStyle(node){
  if(!(node instanceof HTMLStyleElement))return false;
  if(node.id==='tpThemeSystem')return false;
  if(LEGACY_IDS.has(node.id))return true;
  const text=node.textContent||'';
  return SIGNATURES.some(sig=>text.includes(sig));
}

function purge(root=document){
  const styles=root.querySelectorAll?root.querySelectorAll('style'):[];
  styles.forEach(style=>{if(isLegacyStyle(style))style.remove()});
}

function boot(){
  purge(document);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node.nodeType!==1)continue;
        if(isLegacyStyle(node))node.remove();
        else purge(node);
      }
    }
  });
  observer.observe(document.head,{childList:true,subtree:true});
  window.WillenaTestPrepStyleAudit={purge,legacyIds:[...LEGACY_IDS]};
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();