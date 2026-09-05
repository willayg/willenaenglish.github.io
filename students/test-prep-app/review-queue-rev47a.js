(function(){
'use strict';
const HOUR=60*60*1000,KEY='willena:testprep:review:v47a',now=()=>Date.now();
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{"items":{}}')}catch(_){return{items:{}}}}
function due(x,t=now()){return x&&x.status!=='cleared'&&Number(x.nextAt||0)<=t}
function summary(s=load()){const a=Object.values(s.items||{}),t=now(),later=a.filter(x=>x.status!=='cleared'&&!due(x,t));return{ready:a.filter(x=>due(x,t)).length,later:later.length,cleared:a.filter(x=>x.status==='cleared').length,total:a.length,nextAt:later.length?Math.min(...later.map(x=>Number(x.nextAt)||Infinity)):null}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('review47a:change',{detail:summary(s)}));return s}
function qid(q){return String(q?.id||q?.question_id||'')}
function addWrong(q,meta={}){const k=qid(q);if(!k)return null;const s=load(),old=s.items[k]||{};s.items[k]={...old,id:k,question:q,meta:{...(old.meta||{}),...meta},status:'wrong',nextAt:Math.max(Number(old.nextAt)||0,now()),clearedAt:null,updatedAt:now()};save(s);return s.items[k]}
function ready(){return Object.values(load().items||{}).filter(x=>due(x)).sort((a,b)=>(a.nextAt||0)-(b.nextAt||0))}
function result(questionId,correct){const s=load(),x=s.items[String(questionId)];if(!x)return null;const t=now();x.attempts=(Number(x.attempts)||0)+1;x.lastAttemptAt=t;x.updatedAt=t;if(!correct){x.status='wrong';x.nextAt=t+HOUR}else if(x.status==='wrong'){x.status='review';x.nextAt=t+HOUR}else{x.status='cleared';x.nextAt=null;x.clearedAt=t}save(s);return x}
async function runNext(ctx={}){const x=ready()[0];if(!x)return null;const rt=window.WillenaQuestionRuntime;if(!rt?.run)throw new Error('QuestionRuntime is not ready.');const r=await rt.run(x.question,{...ctx,mode:'review47a',correction:true});if(!r?.cancelled)result(x.id,!!r.correct);return r}
window.WillenaReviewQueue47a={HOUR,load,addWrong,result,summary,ready,runNext};
})();
