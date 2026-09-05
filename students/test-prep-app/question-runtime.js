(function(){
'use strict';

const handlers=[];
let active=null;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>String(v||'').trim().toLowerCase();

function emit(type,detail={}){try{window.dispatchEvent(new CustomEvent(`questionruntime:${type}`,{detail}))}catch(_){}}
async function waitFor(fn,label){for(let i=0;i<120;i++){const v=fn();if(v)return v;await wait(25)}throw new Error(`${label||'Question engine'} is not ready.`)}
function selection(){return window.WillenaAssignedTestPrep?.selection||null}
function suppressResultOwner(fn){const sel=selection();if(!sel)return fn();const old=sel.section;sel.section='__question_runtime__';try{return fn()}finally{sel.section=old}}
function metadataFor(ctx,q){return{exam_runtime:true,exam_session_id:ctx.examSessionId||null,exam_scope:ctx.scope||null,exam_position:Number(ctx.position)||null,exam_total:Number(ctx.total)||null,exam_correction:!!ctx.correction,underlying_section:q.__sourceSection||q.section||null,lesson:ctx.lesson||null}}

function register(handler){if(!handler?.id||typeof handler.canHandle!=='function'||typeof handler.start!=='function')throw new Error('Invalid question runtime handler.');const i=handlers.findIndex(x=>x.id===handler.id);if(i>=0)handlers.splice(i,1);handlers.push(handler);return handler}
function resolve(question){return handlers.find(h=>{try{return h.canHandle(question)}catch(_){return false}})||null}
function supports(question){return !!resolve(question)}
function engineFor(question){return resolve(question)?.id||null}
async function closePreviousSession(){const auth=window.WillenaTestPrepAuth;if(auth?.state?.session)await auth.completeSession?.(0,0,[])}
function prepareTracking(auth,ctx){const plan=auth?.state?.plans?.find(p=>String(p.id)===String(ctx.planId));if(plan&&(String(auth.state?.plan?.id||'')!==String(plan.id)||String(auth.state?.lesson||'')!==String(ctx.lesson||'')))auth.setActivePlan?.(plan,ctx.lesson);auth.beginStudyActivity?.()}

async function run(question,ctx={}){
 if(active)throw new Error('A question is already running.');const handler=resolve(question);if(!handler)throw new Error(`Unsupported question type: ${question?.question_type||question?.answer_mode||'unknown'}`);
 const auth=await waitFor(()=>window.WillenaTestPrepAuth,'Tracking');await closePreviousSession();prepareTracking(auth,ctx);
 const originalComplete=auth.completeSession.bind(auth),originalRecord=auth.recordAttempt.bind(auth);let resolvePromise,rejectPromise,done=false,lastAttempt=null;const promise=new Promise((resolve,reject)=>{resolvePromise=resolve;rejectPromise=reject});const token={question,ctx,handler,originalComplete,originalRecord,promise,get done(){return done}};active=token;
 function restore(){if(auth.completeSession===completeWrapper)auth.completeSession=originalComplete;if(auth.recordAttempt===recordWrapper)auth.recordAttempt=originalRecord;if(active===token)active=null}
 function resultFrom(counts={},extra={}){const total=Math.max(1,Number(counts.questionCount)||1),correctCount=Math.max(0,Number(counts.correctCount)||0),wrongIds=Array.isArray(counts.wrongIds)?counts.wrongIds.map(String):[];const attempt=lastAttempt||{};const correct=typeof attempt.is_correct==='boolean'?attempt.is_correct:(correctCount>=total&&!wrongIds.includes(String(question.id)));return{questionId:String(question.id||attempt.question_id||''),engine:handler.id,correct,skipped:!!extra.skipped||attempt?.metadata?.skipped===true,selectedAnswer:attempt.selected_answer??null,correctAnswer:attempt.correct_answer??question.correct_answer??question.correct_text??null,responseTimeMs:Number(attempt.response_time_ms)||0,lesson:ctx.lesson||null,section:question.__sourceSection||question.section||null,questionType:question.question_type||null,...extra}}
 async function finish(counts,extra={}){if(done)return;done=true;try{const save=suppressResultOwner(()=>originalComplete(counts.correctCount,counts.questionCount,counts.wrongIds));await Promise.resolve(save);const result=resultFrom(counts,extra);restore();emit('complete',{question,result,context:ctx});resolvePromise(result)}catch(e){restore();rejectPromise(e)}}
 function recordWrapper(payload){const p={...(payload||{}),metadata:{...(payload?.metadata||{}),...metadataFor(ctx,question)}};lastAttempt=p;return originalRecord(p)}
 function completeWrapper(correctCount,questionCount,wrongIds){finish({correctCount,questionCount,wrongIds});return Promise.resolve({question_runtime:true})}
 auth.recordAttempt=recordWrapper;auth.completeSession=completeWrapper;token.finish=finish;token.restore=restore;token.setAttempt=p=>{lastAttempt=p};
 try{emit('start',{question,engine:handler.id,context:ctx});await handler.start(question,ctx)}catch(e){done=true;restore();rejectPromise(e)}return promise;
}

async function skip(){
 const token=active;if(!token||token.done)return false;const q=token.question,ctx=token.ctx,handler=token.handler;if(typeof handler.skip==='function'){const handled=await handler.skip(q,ctx,token);if(handled)return true}
 const api=window.WillenaVocabTestPractice,vocab=handler.id==='vocab',questionId=vocab?(api?.targetKey?.(q)||q.id):q.id,practice=vocab?'vocab_test':String(q.section||'constructed_response'),correct=q.correct_text??q.correct_answer??[];
 const payload={practice_type:practice,question_id:String(questionId||''),selected_answer:[],correct_answer:correct,is_correct:false,source_question_number:q.source_question_number,question_type:q.question_type,source_label:q.student_source_label,targets:Array.isArray(q.targets)?q.targets:[],metadata:{...metadataFor(ctx,q),skipped:true,skip_source:'question_runtime'}};token.setAttempt(payload);try{await Promise.resolve(token.originalRecord(payload))}catch(_){}await token.finish({correctCount:0,questionCount:1,wrongIds:[String(questionId||q.id||'')]},{skipped:true});return true;
}
function cancel(){const token=active;if(!token)return;try{token.restore?.()}catch(_){}active=null;emit('cancel',{question:token.question,context:token.ctx})}

register({
 id:'text',
 canHandle:q=>norm(q?.answer_mode)==='text',
 async start(q){const engine=await waitFor(()=>window.WillenaTextQuestionEngine,'Text question engine');if(!engine.canHandle?.(q))throw new Error(`Text engine rejected ${q?.question_type||'question'}`);return engine.runQuestion(q)}
});
register({
 id:'vocab',
 canHandle:q=>norm(q?.answer_mode)!=='text'&&(norm(q?.section)==='vocab_test'||/^vocab_/i.test(String(q?.question_type||''))),
 async start(q,ctx){const api=await waitFor(()=>window.WillenaVocabTestPractice,'Vocabulary test');if(typeof api.runQuestion==='function')return api.runQuestion(q,{quiz:document.getElementById('assignedQuizPane'),lesson:ctx.lesson});const shell=await waitFor(()=>window.WillenaAssignedTestPrep,'Assigned Test Prep');const ids=[String(q.id||''),String(api.targetKey?.(q)||'')].filter(Boolean);return shell.startSelection(ctx.planId,ctx.lesson,'vocab_test',{reviewMode:true,reviewIds:ids})}
});
register({
 id:'choice',
 canHandle:q=>Array.isArray(q?.choices)&&q.choices.length>0&&['single_choice','single_select','multi_select'].includes(norm(q?.answer_mode)),
 async start(q){const engine=await waitFor(()=>window.WillenaTestPrepQuestionEngine,'Choice question engine');if(!engine.canHandle?.(q))throw new Error(`Choice engine rejected ${q?.question_type||'question'}`);return engine.runQuestion(q)}
});

window.WillenaQuestionRuntime={register,resolve,supports,engineFor,run,skip,cancel,get current(){return active?{question:active.question,context:active.ctx,engine:active.handler.id}:null},get handlers(){return handlers.map(x=>x.id)}};
console.log('[REV45g] QuestionRuntime handlers ready',handlers.map(x=>x.id));
})();
