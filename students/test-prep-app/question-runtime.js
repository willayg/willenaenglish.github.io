(function(){
'use strict';

const handlers=[];
let active=null;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>String(v||'').trim().toLowerCase();

function emit(type,detail={}){try{window.dispatchEvent(new CustomEvent(`questionruntime:${type}`,{detail}))}catch(_){}}
async function waitFor(fn,label){for(let i=0;i<120;i++){const v=fn();if(v)return v;await wait(25)}throw new Error(`${label||'Question engine'} is not ready.`)}
function qSection(q){return String(q?.__sourceSection||q?.section||'unknown').toLowerCase()}
function trackingPractice(q,payloadType){const section=norm(q?.section);if(section==='vocab_test')return'vocab_test';const supplied=norm(payloadType);if(supplied&&supplied!=='mock')return supplied;const underlying=norm(q?.__sourceSection||q?.section);return underlying==='vocabulary'?'vocab_test':(underlying||'reading')}
function metadataFor(ctx,q){return{exam_runtime:true,exam_session_id:ctx.examSessionId||null,exam_scope:ctx.scope||null,exam_position:Number(ctx.position)||null,exam_total:Number(ctx.total)||null,exam_correction:!!ctx.correction,underlying_section:qSection(q),exam_lesson:ctx.lesson||null}}
function hasBlank(v){return /_{3,}|\([A-D]\)|[ⓐⓑⓒⓓ]|<\s*blank\s*>/i.test(String(v||''))}
function choiceText(q){const raw=Array.isArray(q?.correct_answer)?q.correct_answer[0]:q?.correct_answer,n=Number(raw)-1;if(!Array.isArray(q?.choices)||!Number.isInteger(n)||n<0||n>=q.choices.length)return'';const x=q.choices[n];return typeof x==='string'?x:String(x?.text??x?.label??'').trim()}
function answerList(q){const a=Array.isArray(q?.correct_answer)?q.correct_answer:[q?.correct_answer];return a.filter(v=>v!=null&&String(v).trim()!=='').map(v=>String(v).trim())}
function spellingPattern(value){let wordStart=true;return [...String(value||'')].map(ch=>{if(/[A-Za-z]/.test(ch)){const out=wordStart?ch.toLowerCase():'_';wordStart=false;return out}wordStart=/\s/.test(ch);return ch}).join(' ')}
function isChoiceMode(q){return['single','single_choice','single_select','multi_select'].includes(norm(q?.answer_mode))}
function isVocabText(q){const s=norm(q?.__sourceSection||q?.section);return norm(q?.answer_mode)==='text'&&(s==='vocabulary'||s==='vocab_test')}
function singleWordishAnswer(q){const a=answerList(q);if(a.length!==1)return'';const v=a[0];if(v.length>40||/[.!?]\s*$/.test(v))return'';return /[A-Za-z]/.test(v)?v:''}
function valueList(v){
 if(Array.isArray(v))return v.map(x=>typeof x==='string'?x:JSON.stringify(x)).filter(Boolean);
 if(v&&typeof v==='object')return Object.entries(v).map(([k,x])=>`${k} ${typeof x==='string'?x:JSON.stringify(x)}`);
 return[]
}
function normalizeChoiceContext(q){
 if(!isChoiceMode(q)||!q?.context||typeof q.context!=='object'||Array.isArray(q.context))return q;
 const c=q.context;let context=c,changed=false;
 const set=(key,value)=>{if(value==null||value===''||context[key]!=null)return;context={...context,[key]:value};changed=true};
 if(typeof c.summary==='string'&&c.summary.trim())set('sentence',c.summary);
 if(typeof c.insert_sentence==='string'&&c.insert_sentence.trim())set('given_sentence',c.insert_sentence);
 if(typeof c.sentence_to_insert==='string'&&c.sentence_to_insert.trim())set('given_sentence',c.sentence_to_insert);
 if(typeof c.source_dialogue==='string'&&c.source_dialogue.trim())set('dialogue',c.source_dialogue);
 if(typeof c.question==='string'&&c.question.trim()&&!c.sentence&&!c.dialogue&&!c.passage)set('sentence',c.question);
 if(typeof c.given==='string'&&c.given.trim()&&!c.sentence&&!c.dialogue&&!c.passage)set('sentence',c.given);
 if(typeof c.initial==='string'&&c.initial.trim())set('pattern',c.initial);
 if(Array.isArray(c.sentences)&&c.sentences.length&&!c.items)set('items',c.sentences);
 if(Array.isArray(c.view)&&c.view.length&&!c.items)set('items',c.view);
 if(Array.isArray(c.words)&&c.words.length&&!c.bank)set('bank',c.words);
 if(Array.isArray(c.provided_words)&&c.provided_words.length&&!c.bank)set('bank',c.provided_words);
 if(Array.isArray(c.word_bank)&&c.word_bank.length&&!c.bank)set('bank',c.word_bank);
 if(c.definitions&&!c.items){const a=valueList(c.definitions);if(a.length)set('items',a)}
 if((c.sentence1||c.sentence2)&&!c.items)set('items',[c.sentence1,c.sentence2].filter(Boolean));
 if((c.A_base||c.B_base)&&!c.items)set('items',[c.A_base?`(A) ${c.A_base}`:'',c.B_base?`(B) ${c.B_base}`:''].filter(Boolean));
 if(c.segments&&typeof c.segments==='object'&&!Array.isArray(c.segments)&&!c.items&&!c.dialogue_start&&!c.passage_start){
  const items=Object.entries(c.segments).map(([k,v])=>{const s=String(v??'').trim();return /^\s*(?:\([A-D]\)|[A-D][.)])/i.test(s)?s:`(${k}) ${s}`}).filter(Boolean);
  if(items.length)set('items',items)
 }
 return changed?{...q,context,metadata:{...(q.metadata||{}),runtime_context_normalized:true}}:q
}
function addSpellingCue(q){if(!isVocabText(q)||!q?.context||typeof q.context!=='object'||Array.isArray(q.context)||q.context.pattern)return q;const answer=singleWordishAnswer(q);if(!answer)return q;return{...q,context:{...q.context,pattern:spellingPattern(answer)},metadata:{...(q.metadata||{}),runtime_spelling_pattern:true}}}
function repairBlankQuestion(q){
 if(!q||typeof q!=='object')return q;
 const qt=String(q.question_type||''),prompt=String(q.prompt_text||'');
 if(!/blank/i.test(qt)&&!/빈칸/.test(prompt))return q;
 const c=q.context&&typeof q.context==='object'&&!Array.isArray(q.context)?q.context:null;if(!c)return q;
 if(Object.values(c).some(v=>typeof v==='string'&&hasBlank(v)))return q;
 const answer=choiceText(q);if(!answer)return q;
 const keys=['passage','dialogue','sentence','text','source_passage','source','source_sentence','example'];
 for(const key of keys){const src=c[key];if(typeof src!=='string'||!src.includes(answer))continue;const marker=/\(A\)/.test(prompt)?'(A) ________':'________';const context={...c,[key]:src.replace(answer,marker)};return{...q,context,metadata:{...(q.metadata||{}),runtime_blank_repaired:true}}}
 return q
}
function prepareQuestion(q){return repairBlankQuestion(addSpellingCue(normalizeChoiceContext(q)))}

function register(handler){if(!handler?.id||typeof handler.canHandle!=='function'||typeof handler.start!=='function')throw new Error('Invalid question runtime handler.');const i=handlers.findIndex(x=>x.id===handler.id);if(i>=0)handlers.splice(i,1);handlers.push(handler);return handler}
function resolve(question){return handlers.find(h=>{try{return h.canHandle(question)}catch(_){return false}})||null}
function supports(question){return !!resolve(question)}
function engineFor(question){return resolve(question)?.id||null}

async function run(sourceQuestion,ctx={}){
 if(active)throw new Error('A question is already running.');
 const question=prepareQuestion(sourceQuestion),handler=resolve(question);if(!handler)throw new Error(`Unsupported question type: ${question?.question_type||question?.answer_mode||'unknown'}`);
 const auth=await waitFor(()=>window.WillenaTestPrepAuth,'Tracking');
 const originalComplete=auth.completeSession.bind(auth),originalRecord=auth.recordAttempt.bind(auth);
 let resolvePromise,rejectPromise,done=false,lastAttempt=null;
 const promise=new Promise((resolve,reject)=>{resolvePromise=resolve;rejectPromise=reject});
 const token={question,sourceQuestion,ctx,handler,originalComplete,originalRecord,promise,get done(){return done}};active=token;
 token.cancel=()=>{if(done)return;done=true;restore();resolvePromise({cancelled:true,questionId:String(question.id||''),engine:handler.id,lesson:ctx.lesson||null,section:qSection(question),questionType:question.question_type||null})};
 function restore(){if(auth.completeSession===completeWrapper)auth.completeSession=originalComplete;if(auth.recordAttempt===recordWrapper)auth.recordAttempt=originalRecord;if(active===token)active=null}
 function resultFrom(counts={},extra={}){const total=Math.max(1,Number(counts.questionCount)||1),correctCount=Math.max(0,Number(counts.correctCount)||0),wrongIds=Array.isArray(counts.wrongIds)?counts.wrongIds.map(String):[];const attempt=lastAttempt||{};const correct=typeof attempt.is_correct==='boolean'?attempt.is_correct:(correctCount>=total&&!wrongIds.includes(String(question.id)));return{questionId:String(question.id||attempt.question_id||''),engine:handler.id,correct,skipped:!!extra.skipped||attempt?.metadata?.skipped===true,selectedAnswer:attempt.selected_answer??null,correctAnswer:attempt.correct_answer??question.correct_answer??question.correct_text??null,responseTimeMs:Number(attempt.response_time_ms)||0,lesson:ctx.lesson||null,section:qSection(question),questionType:question.question_type||null,...extra}}
 function finish(counts,extra={}){if(done)return;done=true;const result=resultFrom(counts,extra);restore();emit('complete',{question,result,context:ctx});resolvePromise(result)}
 function recordWrapper(payload){const practice=trackingPractice(question,payload?.practice_type),p={...(payload||{}),practice_type:practice,metadata:{...(payload?.metadata||{}),...metadataFor(ctx,question),underlying_practice_type:practice}};lastAttempt=p;return originalRecord(p)}
 function completeWrapper(correctCount,questionCount,wrongIds){finish({correctCount,questionCount,wrongIds});return Promise.resolve({question_runtime:true})}
 auth.recordAttempt=recordWrapper;auth.completeSession=completeWrapper;token.finish=finish;token.restore=restore;token.setAttempt=p=>{lastAttempt=p};
 try{emit('start',{question,engine:handler.id,context:ctx});await handler.start(question,ctx);if(handler.id==='text')document.querySelector('#card .tqt-kind')?.remove()}catch(e){done=true;restore();rejectPromise(e)}
 return promise;
}

async function skip(){
 const token=active;if(!token||token.done)return false;const q=token.question,ctx=token.ctx,handler=token.handler;
 if(typeof handler.skip==='function'){const handled=await handler.skip(q,ctx,token);if(handled)return true}
 const practice=trackingPractice(q,null),payload={practice_type:practice,question_id:String(q.id||''),selected_answer:[],correct_answer:q.correct_text??q.correct_answer??[],is_correct:false,source_question_number:q.source_question_number,question_type:q.question_type,source_label:q.student_source_label,targets:Array.isArray(q.targets)?q.targets:[],metadata:{...metadataFor(ctx,q),underlying_practice_type:practice,skipped:true,skip_source:'question_runtime'}};
 token.setAttempt(payload);try{await Promise.resolve(token.originalRecord(payload))}catch(_){}
 token.finish({correctCount:0,questionCount:1,wrongIds:[String(q.id||'')]},{skipped:true});return true;
}
function cancel(){const token=active;if(!token)return;try{token.cancel?.()}catch(_){try{token.restore?.()}catch(__){}}if(active===token)active=null;emit('cancel',{question:token.question,context:token.ctx})}

register({id:'text',canHandle:q=>norm(q?.answer_mode)==='text',async start(q){const engine=await waitFor(()=>window.WillenaTextQuestionEngine,'Text question engine');if(!engine.canHandle?.(q))throw new Error(`Text engine rejected ${q?.question_type||'question'}`);return engine.runQuestion(q,{runtime:true})}});
register({id:'choice',canHandle:q=>Array.isArray(q?.choices)&&q.choices.length>0&&['single','single_choice','single_select','multi_select'].includes(norm(q?.answer_mode)),async start(q){const engine=await waitFor(()=>window.WillenaTestPrepQuestionEngine,'Choice question engine');const item=norm(q?.answer_mode)==='single'?{...q,answer_mode:'single_select'}:q;if(!engine.canHandle?.(item))throw new Error(`Choice engine rejected ${q?.question_type||'question'}`);return engine.runQuestion(item,{runtime:true})}});
register({id:'vocab',canHandle:q=>norm(q?.answer_mode)!=='text'&&(norm(q?.section)==='vocab_test'||/^vocab_/i.test(String(q?.question_type||'')))&&typeof window.WillenaVocabTestPractice?.runQuestion==='function',async start(q,ctx){const api=await waitFor(()=>window.WillenaVocabTestPractice,'Vocabulary test');if(typeof api.runQuestion!=='function')throw new Error('Vocabulary engine has no native single-question contract.');return api.runQuestion(q,{quiz:document.getElementById('assignedQuizPane'),lesson:ctx.lesson,runtime:true})}});

window.WillenaQuestionRuntime={register,resolve,supports,engineFor,run,skip,cancel,trackingPractice,repairBlankQuestion,prepareQuestion,get current(){return active?{question:active.question,context:active.ctx,engine:active.handler.id}:null},get handlers(){return handlers.map(x=>x.id)}};
})();