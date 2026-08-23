(function(global){
'use strict';
var VERSION='coach-conversation-safety-v1.0';
var coach=global.WillenaAICoach;
if(!coach)return;
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function ko(){var p=global.WillenaStudyV2LanguagePreference,v=p&&typeof p.get==='function'?p.get():'';if(v)return v==='ko';var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function root(){return document.getElementById('aiChatTranscript');}
function ctx(){return coach.context&&coach.context();}
function bubble(kind,msg){var r=root();if(!r||!text(msg))return null;var row=document.createElement('div');row.className='study-v2-ai-chat-row is-'+kind;var b=document.createElement('div');b.className='study-v2-ai-chat-bubble';b.textContent=msg;row.appendChild(b);r.appendChild(row);return row;}
function action(label,fn){var r=root();if(!r)return;var row=document.createElement('div');row.className='study-v2-ai-chat-row is-actions coach-inline-actions';var wrap=document.createElement('div');wrap.className='coach-inline-action-wrap';var b=document.createElement('button');b.type='button';b.className='study-v2-ai-prompt is-launch';b.textContent=label;b.onclick=function(){b.disabled=true;Promise.resolve(fn()).catch(function(e){console.warn('[Coach safety]',e);bubble('coach',ko()?'연습을 불러오지 못했어요. 한 번 더 눌러 주세요.':'I could not load the review. Please try once more.');b.disabled=false;});};wrap.appendChild(b);row.appendChild(wrap);r.appendChild(row);}
function dueQueue(){var review=global.WillenaCoachStage5MissedReview;try{return review&&typeof review.queue==='function'?arr(review.queue(ctx())):[];}catch(e){console.warn('[Coach safety queue]',e);return[];}}
async function launchReview(){var review=global.WillenaCoachStage5MissedReview,c=ctx();if(!review||typeof review.build!=='function')throw new Error('review builder unavailable');bubble('user',ko()?'복습 시작':'Start review');var result=await review.build(c);if(!result||!arr(result.items).length){bubble('coach',ko()?'복습할 문제를 찾지 못했어요. 기록을 다시 확인할게요.':'I could not find the review items. I’ll check your records again.');return false;}if(result.message)bubble('coach',typeof result.message==='string'?result.message:(ko()?result.message.ko:result.message.en));var plan={type:result.type||'coach_stage5_exact_review',title:typeof result.title==='string'?result.title:(ko()?result.title.ko:result.title.en),items:result.items};return coach.launch&&coach.launch(plan);}
var originalHome=coach.home;
async function safeHome(reset){var r=root();if(!r)return false;if(reset||!r.children.length)r.innerHTML='';var due=dueQueue();if(due.length){r.innerHTML='';bubble('coach',ko()?('먼저 틀린 것부터 고치자. 지금 복습할 항목이 '+due.length+'개 있어. 이걸 끝내고 다음 걸 하자.'):('First, let’s fix what you missed. You have '+due.length+' items due for review. Clear these and then we’ll choose what comes next.'));action(ko()?'복습 시작':'Start review',launchReview);return true;}
 if(typeof originalHome!=='function'){bubble('coach',ko()?'코치가 잠깐 멈췄어요. 페이지를 새로고침해 주세요.':'Coach paused for a moment. Please refresh the page.');return false;}
 var finished=false;var work=Promise.resolve().then(function(){return originalHome(reset);}).then(function(v){finished=true;return v;}).catch(function(e){finished=true;console.warn('[Coach safety home]',e);return false;});
 await Promise.race([work,new Promise(function(resolve){setTimeout(resolve,3500);})]);
 if(!finished&&!text(r.textContent)){bubble('coach',ko()?'학습 기록을 확인하고 있어요. 잠시만 기다려 주세요.':'I’m checking your study history. Give me a moment.');}
 setTimeout(function(){if(!text(r.textContent)){bubble('coach',ko()?'코치 추천을 불러오지 못했어요. 새로고침하면 다시 시도할게요.':'I could not load the Coach recommendation. Refresh and I’ll try again.');}},5000);
 return work;
}
coach.home=safeHome;
coach.refresh=function(){return safeHome(false);};
coach.conversationSafetyVersion=VERSION;
global.WillenaCoachConversationSafety={version:VERSION,home:safeHome,dueQueue:dueQueue};
})(window);