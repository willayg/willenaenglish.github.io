(function(){
'use strict';
var ENDPOINT='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/prospective-level-test';
var ATTEMPT_KEY='willena_prospective_level_test_attempt_v1';
var answers=[],answerIds=new Set(),bankMap=new Map(),attempt=null,startAt=0,finalized=false,lastQuestionAt=0;
function candidate(){return window.WillenaProspectiveCandidate||null}
function post(body){return fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok||!j.success)throw new Error(j.error||'Save failed');return j})})}
function loadSaved(){try{return JSON.parse(sessionStorage.getItem(ATTEMPT_KEY)||'null')}catch(_){return null}}
function saveAttempt(x){attempt=x;sessionStorage.setItem(ATTEMPT_KEY,JSON.stringify(x))}
function clearAttempt(){attempt=null;sessionStorage.removeItem(ATTEMPT_KEY)}
function ensureBank(){var loadBank=window.loadCompleteQuestionBank||window.loadQuestionBank;if(typeof loadBank!=='function')return Promise.resolve();return Promise.resolve(loadBank()).then(function(rows){rows.forEach(function(q){bankMap.set(String(q.id),q)})}).catch(function(){})}
function setupGuess(){var text=document.body.innerText||'';return{source:'adaptive-ui',language:document.documentElement.lang||'ko',page_text:text.slice(0,500)}}
function ensureAttempt(){if(attempt)return Promise.resolve(attempt);var saved=loadSaved();if(saved&&saved.id&&saved.session_token){attempt=saved;return Promise.resolve(attempt)}var c=candidate();if(!c||!c.id||!c.registration_token)return Promise.reject(new Error('Candidate session missing'));startAt=Date.now();return post({action:'start',candidate_id:c.id,registration_token:c.registration_token,setup:setupGuess(),language:document.documentElement.lang||'ko'}).then(function(j){saveAttempt(j.attempt);return attempt})}
function selectedValue(card,q){if(q&&q.type==='sentence_unscramble')return Array.from(card.querySelectorAll('.scramble-token.chosen')).map(function(x){return x.textContent.trim()});var s=card.querySelector('.choice.selected');return s?s.getAttribute('data-value'):null}
function correctValue(q){return q&&q.type==='sentence_unscramble'?q.tokens:q?q.a:null}
function same(type,a,b){var scoring=window.WillenaLevelTestScoring;return scoring?scoring.isCorrect(type,a,b):JSON.stringify(a)===JSON.stringify(b)}
function captureAnswer(){
 var card=document.querySelector('.question-card');if(!card)return false;
 var id=card.getAttribute('data-question-id');if(!id||answerIds.has(String(id)))return false;
 var q=bankMap.get(String(id));if(!q)return false;
 var selected=selectedValue(card,q);if(selected==null)return false;
 var row={answer_index:answers.length+1,assessment_item_id:String(q.id),assessment_source_key:q.metadata&&q.metadata.source_key||null,question_level:Number(q.level)||null,item_type:q.type||null,prompt_snapshot:q.q||q.meaning||'',selected_answer:selected,correct_answer:correctValue(q),is_correct:same(q.type,selected,correctValue(q)),response_time_ms:lastQuestionAt?Date.now()-lastQuestionAt:null,metadata:{translation:Boolean(q.translation)}};
 answerIds.add(String(id));answers.push(row);
 ensureAttempt().then(function(a){return post(Object.assign({action:'answer',attempt_id:a.id,session_token:a.session_token},row))}).catch(function(e){console.warn('[level-test-recording] answer save failed',e)});
 return true;
}
function parseInternalLevel(){
 var explicit=Number(window.WillenaInternalResultLevel||sessionStorage.getItem('willena_internal_result_level'));
 if(Number.isFinite(explicit)&&explicit>0)return Math.max(1,Math.min(12,explicit));
 var box=document.querySelector('.report-level,.result-level');
 if(box){
  var prefix=(box.querySelector('span')||{}).textContent||'';
  var value=Number(((box.querySelector('strong')||{}).textContent||'').trim());
  if(Number.isFinite(value))return Math.max(1,Math.min(12,/starter|스타터/i.test(prefix)?value:value+2));
 }
 var text=document.body.innerText||'',m=text.match(/(?:Level|레벨|단계)\s*(\d{1,2})/i);
 return m?Math.max(1,Math.min(12,Number(m[1])+2)):null;
}
function finishIfReady(){
 if(finalized||!attempt||!answers.length)return;
 var retry=document.querySelector('#retry'),home=document.querySelector('#home');
 if(!retry&&!home)return;
 captureAnswer();
 finalized=true;
 var level=parseInternalLevel();
 post({action:'finish',attempt_id:attempt.id,session_token:attempt.session_token,answers:answers,recommended_level:level,display_level:level,duration_seconds:startAt?Math.round((Date.now()-startAt)/1000):null,metadata:{completed_from:'browser-recorder',page_language:document.documentElement.lang||'ko'}}).then(function(){clearAttempt()}).catch(function(e){finalized=false;console.warn('[level-test-recording] finish save failed',e)})
}
document.addEventListener('click',function(e){
 if(e.target.closest('#next,#finish,#submit,[data-finish-test]'))captureAnswer();
 if(e.target.closest('#retry')||e.target.closest('#home')){answers=[];answerIds.clear();finalized=false;clearAttempt()}
},true);
var observer=new MutationObserver(function(){var card=document.querySelector('.question-card');if(card)lastQuestionAt=Date.now();finishIfReady()});
observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('willena:candidate-ready',function(){ensureBank()});
ensureBank();
})();
