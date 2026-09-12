(function(){
'use strict';
var VERSION=1;
var BASE_KEY='willena_level_test_session_v1';
var memory=null;

function now(){return new Date().toISOString()}
function clone(value){try{return JSON.parse(JSON.stringify(value))}catch(_){return null}}
function mode(){
 var ctx=window.WillenaLevelTestContext||{};
 if(ctx.mode==='student'||/\/students\/level-test\/?$/.test(location.pathname))return'student';
 if(ctx.mode==='visitor'||window.WillenaProspectiveCandidate)return'visitor';
 return'prospective';
}
function key(){return BASE_KEY+':'+mode()}
function empty(){return{version:VERSION,mode:mode(),status:'created',phase:'setup',person:null,setup:{grade:null,years:null,listening:null,length:null},test:{current_item_id:null,current_level:null,current_type:null,question_index:0,total_questions:null,answers:[],started_at:null,completed_at:null},result:{recommended_level:null},created_at:now(),updated_at:now()}}
function sanitize(raw){if(!raw||raw.version!==VERSION)return null;var base=empty();return Object.assign(base,raw,{mode:mode(),setup:Object.assign(base.setup,raw.setup||{}),test:Object.assign(base.test,raw.test||{},{answers:Array.isArray(raw.test&&raw.test.answers)?raw.test.answers:[]}),result:Object.assign(base.result,raw.result||{})})}
function load(){try{return sanitize(JSON.parse(localStorage.getItem(key())||'null'))}catch(_){return null}}
function save(next){memory=sanitize(Object.assign({},next,{updated_at:now()}))||empty();try{localStorage.setItem(key(),JSON.stringify(memory))}catch(_){}window.WillenaAssessmentSession=memory;window.dispatchEvent(new CustomEvent('willena:session-changed',{detail:{session:clone(memory)}}));return memory}
function ensure(){if(memory&&memory.mode===mode())return memory;memory=null;return save(load()||empty())}
function patch(data){var current=ensure(),next=Object.assign({},current,data||{});if(data&&data.setup)next.setup=Object.assign({},current.setup,data.setup);if(data&&data.test)next.test=Object.assign({},current.test,data.test);if(data&&data.result)next.result=Object.assign({},current.result,data.result);return save(next)}
function reset(){try{localStorage.removeItem(key())}catch(_){}memory=null;return save(empty())}
function personFromCandidate(candidate){if(!candidate)return null;return{id:candidate.id||null,name:candidate.student_name||candidate.name||null,school:candidate.school_name||null,grade:candidate.school_grade||null,kind:'prospective'}}
function personFromStudent(detail){var student=detail&&detail.student||detail;if(!student)return null;return{id:student.id||null,name:student.name||null,school:student.profile&&student.profile.school||null,grade:student.profile&&student.profile.grade||student.grade||null,kind:'student'}}
function begin(){var s=ensure();return patch({status:'in_progress',phase:'test',test:{started_at:s.test.started_at||now(),completed_at:null,total_questions:Number(s.setup.length)||s.test.total_questions||null}})}
function complete(result){return patch({status:'complete',phase:'results',test:{completed_at:now()},result:result||{}})}
function setSetup(name,value){if(!name)return ensure();var p={};p[name]=value;return patch({setup:p})}
function questionIndex(){var span=document.querySelector('.question-meta span:first-child'),m=span&&String(span.textContent||'').match(/(\d+)/);return m?Number(m[1])||0:0}
function setCurrent(card){if(!card)return ensure();var s=ensure(),id=card.getAttribute('data-question-id')||null,level=Number(card.getAttribute('data-question-level'))||null,index=questionIndex()||s.test.question_index||0,type=null;if(id&&window.WillenaAssessmentQuestionRegistry&&typeof window.WillenaAssessmentQuestionRegistry.get==='function'){var q=window.WillenaAssessmentQuestionRegistry.get(id);type=q&&q.type||null}return patch({status:'in_progress',phase:'test',test:{current_item_id:id,current_level:level,current_type:type,question_index:index,started_at:s.test.started_at||now(),total_questions:Number(s.setup.length)||s.test.total_questions||null}})}
function recordAnswer(row){if(!row)return ensure();var s=ensure(),answers=s.test.answers.slice(),id=String(row.assessment_item_id||row.id||'');if(id&&answers.some(function(x){return String(x.assessment_item_id||x.id||'')===id}))return s;answers.push(clone(row));return patch({test:{answers:answers}})}
function visibleAnswer(){
 var card=document.querySelector('.question-card');if(!card)return null;
 var id=card.getAttribute('data-question-id');if(!id)return null;
 var q=window.WillenaAssessmentQuestionRegistry&&typeof window.WillenaAssessmentQuestionRegistry.get==='function'?window.WillenaAssessmentQuestionRegistry.get(id):null;
 var type=q&&q.type||null,selected=null;
 if(type==='sentence_unscramble')selected=Array.from(card.querySelectorAll('.scramble-token.chosen')).map(function(x){return x.textContent.trim()});
 else{var choice=card.querySelector('.choice.selected');if(choice)selected=choice.getAttribute('data-value')}
 if(selected==null)return null;
 return{assessment_item_id:String(id),question_level:Number(card.getAttribute('data-question-level'))||q&&Number(q.level)||null,item_type:type,selected_answer:selected,captured_at:now()};
}

window.WillenaAssessmentSessionStore={get:function(){return clone(ensure())},patch:patch,reset:reset,begin:begin,complete:complete,setSetup:setSetup,setCurrent:setCurrent,recordAnswer:recordAnswer,storageKey:key};

window.addEventListener('willena:candidate-ready',function(event){memory=null;var candidate=event&&event.detail||window.WillenaProspectiveCandidate;patch({person:personFromCandidate(candidate),status:'registered',phase:'setup'})});
window.addEventListener('willena:student-ready',function(event){memory=null;patch({person:personFromStudent(event&&event.detail),status:'registered',phase:'setup'})});
window.addEventListener('willena:recording-finished',function(event){var result=event&&event.detail&&event.detail.result||{},attempt=result.attempt||{};complete({recommended_level:Number(attempt.recommended_level)||Number(window.WillenaInternalResultLevel)||null})});

document.addEventListener('click',function(event){var target=event.target;if(!target||!target.closest)return;var option=target.closest('.setup-option');if(option){var holder=option.closest('.setup-options'),name=holder&&holder.getAttribute('data-key');if(name){setSetup(name,Number(option.getAttribute('data-value')));if(name==='length')setTimeout(begin,0)}}var retry=target.closest('#retry,#home');if(retry){reset();return}var next=target.closest('#next,#finish,#submit,[data-finish-test]');if(next){var row=visibleAnswer();if(row)recordAnswer(row);var card=document.querySelector('.question-card');if(card)setCurrent(card)}},true);

var lastCardId=null;
var observer=new MutationObserver(function(){var card=document.querySelector('.question-card');if(card){var id=card.getAttribute('data-question-id')||String(questionIndex());if(id!==lastCardId){lastCardId=id;setCurrent(card)}return}lastCardId=null;if(document.querySelector('#retry,#home,.report-card,.result-layout,.reward-screen,.student-complete')){var s=ensure();if(s.status!=='complete')patch({phase:'results'})}});
observer.observe(document.documentElement,{subtree:true,childList:true});

ensure();
})();
