(function(){
'use strict';
var PUBLIC_ENDPOINT='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/prospective-level-test';
var INTERNAL_ENDPOINT='https://willena-proxy.willena.workers.dev/.netlify/functions/student_level_test';
var PUBLIC_ATTEMPT_KEY='willena_prospective_level_test_attempt_v1';
var INTERNAL_ATTEMPT_KEY='willena_internal_level_test_attempt_v2';
var STATE_SUFFIX='_offline_state';
var answers=[],answerIds=new Set(),bankMap=new Map(),attempt=null,startAt=0,finalized=false,lastQuestionAt=0,finishPromise=null,finishRequested=false;
function context(){return window.WillenaLevelTestContext||{}}
function internal(){return context().mode==='student'}
function attemptKey(){return internal()?INTERNAL_ATTEMPT_KEY:PUBLIC_ATTEMPT_KEY}
function stateKey(){return attemptKey()+STATE_SUFFIX}
function candidate(){return window.WillenaProspectiveCandidate||null}
function parseResponse(response){return response.json().catch(function(){return{}}).then(function(data){if(!response.ok||!data.success)throw new Error(data.error||'Save failed');return data})}
function post(body){
 if(!internal())return fetch(PUBLIC_ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(parseResponse);
 var action={start:'capture_start',answer:'capture_answer',finish:'capture_finish'}[body.action];
 if(!action)return Promise.reject(new Error('Unsupported recording action'));
 var payload=Object.assign({},body);delete payload.action;delete payload.session_token;delete payload.candidate_id;delete payload.registration_token;
 return WillenaAPI.fetch(INTERNAL_ENDPOINT+'?action='+encodeURIComponent(action),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).then(parseResponse);
}
function loadSaved(){try{return JSON.parse(localStorage.getItem(attemptKey())||sessionStorage.getItem(attemptKey())||'null')}catch(_){return null}}
function persistState(){try{localStorage.setItem(stateKey(),JSON.stringify({answers:answers,startAt:startAt||Date.now()}))}catch(_){}}
function restoreState(){try{var saved=JSON.parse(localStorage.getItem(stateKey())||'null');if(!saved||!Array.isArray(saved.answers))return;answers=saved.answers;answerIds=new Set(answers.map(function(row){return String(row.assessment_item_id)}));startAt=Number(saved.startAt)||Date.now()}catch(_){}}
function saveAttempt(x){attempt=x;sessionStorage.setItem(attemptKey(),JSON.stringify(x));try{localStorage.setItem(attemptKey(),JSON.stringify(x))}catch(_){}}
function clearAttempt(){attempt=null;sessionStorage.removeItem(attemptKey());try{localStorage.removeItem(attemptKey());localStorage.removeItem(stateKey())}catch(_){}}
function ensureBank(){var loadBank=window.loadCompleteQuestionBank||window.loadQuestionBank;if(typeof loadBank!=='function')return Promise.resolve();return Promise.resolve(loadBank()).then(function(rows){rows.forEach(function(q){bankMap.set(String(q.id),q)})}).catch(function(){})}
function setupGuess(){
 var text=document.body.innerText||'',ctx=context(),setup=ctx.setup&&typeof ctx.setup==='object'?Object.assign({},ctx.setup):{};
 return Object.assign(setup,{source:internal()?'students/level-test':'adaptive-ui',language:document.documentElement.lang||'ko',page_text:text.slice(0,500)});
}
function ensureAttempt(){
 if(attempt)return Promise.resolve(attempt);
 var saved=loadSaved();
 if(saved&&saved.id&&(internal()||saved.session_token)){attempt=saved;return Promise.resolve(attempt)}
 var c=candidate();
 if(!internal()&&(!c||!c.id||!c.registration_token))return Promise.reject(new Error('Candidate session missing'));
 startAt=Date.now();
 var body={action:'start',setup:setupGuess(),language:document.documentElement.lang||'ko'};
 if(internal()){body.test_version='2026-08-v1';body.total_questions=Number(context().setup&&context().setup.length)||null}
 else{body.candidate_id=c.id;body.registration_token=c.registration_token}
 return post(body).then(function(j){saveAttempt(j.attempt||{id:j.attempt_id});return attempt});
}
function selectedValue(card,q){if(q&&q.type==='sentence_unscramble')return Array.from(card.querySelectorAll('.scramble-token.chosen')).map(function(x){return x.textContent.trim()});var s=card.querySelector('.choice.selected');return s?s.getAttribute('data-value'):null}
function correctValue(q){return q&&q.type==='sentence_unscramble'?q.tokens:q?q.a:null}
function same(type,a,b){var scoring=window.WillenaLevelTestScoring;return scoring?scoring.isCorrect(type,a,b):JSON.stringify(a)===JSON.stringify(b)}
function skillFor(q){var type=String(q&&q.type||'').toLowerCase();if(type.indexOf('listen')>=0)return'listening';if(type.indexOf('read')>=0)return'reading';if(type.indexOf('phon')>=0)return'phonics';if(type.indexOf('vocab')>=0||type.indexOf('word')>=0)return'vocabulary';if(type.indexOf('unscramble')>=0)return'sentence_building';if(type.indexOf('writ')>=0)return'writing';return'grammar'}
function captureAnswer(){
 var card=document.querySelector('.question-card');if(!card)return false;
 var id=card.getAttribute('data-question-id');if(!id||answerIds.has(String(id)))return false;
 var q=bankMap.get(String(id));if(!q)return false;
 var selected=selectedValue(card,q);if(selected==null)return false;
 var row={answer_index:answers.length+1,assessment_item_id:String(q.id),assessment_source_key:q.metadata&&q.metadata.source_key||null,question_level:Number(q.level)||null,item_type:q.type||null,prompt_snapshot:q.q||q.meaning||'',selected_answer:selected,correct_answer:correctValue(q),is_correct:same(q.type,selected,correctValue(q)),response_time_ms:lastQuestionAt?Date.now()-lastQuestionAt:null,metadata:{translation:Boolean(q.translation),skill:skillFor(q)}};
 answerIds.add(String(id));answers.push(row);persistState();
 ensureAttempt().then(function(a){return post(Object.assign({action:'answer',attempt_id:a.id,session_token:a.session_token},row))}).catch(function(e){console.warn('[level-test-recording] answer save failed',e)});
 return true;
}
function parseInternalLevel(){
 var explicit=Number(window.WillenaInternalResultLevel||sessionStorage.getItem('willena_internal_result_level'));
 if(Number.isFinite(explicit)&&explicit>0)return Math.max(1,Math.min(12,explicit));
 var box=document.querySelector('.report-level,.result-level');
 if(box){var prefix=(box.querySelector('span')||{}).textContent||'';var value=Number(((box.querySelector('strong')||{}).textContent||'').trim());if(Number.isFinite(value))return Math.max(1,Math.min(12,/starter|스타터/i.test(prefix)?value:value+2))}
 var text=document.body.innerText||'',m=text.match(/(?:Level|레벨|단계)\s*(\d{1,2})/i);
 return m?Math.max(1,Math.min(12,Number(m[1])+2)):null;
}
function emit(name,detail){window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}))}
function syncCapturedAnswers(){
 if(!answers.length)return Promise.resolve();
 return ensureAttempt().then(function(a){return Promise.all(answers.map(function(row){return post(Object.assign({action:'answer',attempt_id:a.id,session_token:a.session_token},row))}))});
}
function finishIfReady(){
 if(finalized)return finishPromise||Promise.resolve();
 var retry=document.querySelector('#retry'),home=document.querySelector('#home');
 if(!retry&&!home)return Promise.resolve();
 finishRequested=true;
 captureAnswer();
 finalized=true;
 finishPromise=ensureAttempt().then(function(a){
  var level=parseInternalLevel();
  return post({action:'finish',attempt_id:a.id,session_token:a.session_token,answers:answers,recommended_level:level,display_level:level,duration_seconds:startAt?Math.round((Date.now()-startAt)/1000):null,total_questions:Number(context().setup&&context().setup.length)||answers.length,metadata:{completed_from:'shared-browser-recorder',page_language:document.documentElement.lang||'ko'}});
 }).then(function(result){finishRequested=false;clearAttempt();emit('willena:recording-finished',{success:true,result:result,answered_count:answers.length});return result}).catch(function(error){finalized=false;finishPromise=null;persistState();emit('willena:recording-failed',{success:false,error:error,offline:navigator.onLine===false});console.warn('[level-test-recording] finish save failed',error);throw error});
 return finishPromise;
}
document.addEventListener('click',function(e){
 if(e.target.closest('#next,#finish,#submit,[data-finish-test]'))captureAnswer();
 if(e.target.closest('#retry')||e.target.closest('#home')){answers=[];answerIds.clear();finalized=false;finishPromise=null;finishRequested=false;clearAttempt()}
},true);
var observer=new MutationObserver(function(){var card=document.querySelector('.question-card');if(card)lastQuestionAt=Date.now();finishIfReady()});
observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('willena:candidate-ready',function(){ensureBank()});
window.addEventListener('online',function(){
 if(finishRequested){finishIfReady().catch(function(){})}
 else{syncCapturedAnswers().catch(function(error){console.warn('[level-test-recording] reconnect sync failed',error)})}
});
window.WillenaLevelTestRecorder={start:ensureAttempt,finish:finishIfReady,getAnswers:function(){return answers.slice()}};
restoreState();
ensureBank();
})();
