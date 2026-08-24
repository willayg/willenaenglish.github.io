(function(global){
'use strict';
var session=null;
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var POINTS_ENDPOINT='/.netlify/functions/log_word_attempt';
var COMPLETION_KEY='willena-ai-coach-completions:v1:';
function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function arr(v){return Array.isArray(v)?v:[];}
function valueText(v){if(Array.isArray(v))return v.join(' ');if(v&&typeof v==='object')try{return JSON.stringify(v);}catch(_){return String(v);}return String(v==null?'':v);}
function coachSessionId(){return'ai-coach-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function sourceId(activity){var m=activity&&activity.metadata||{};return text(activity&&activity.sourceId||activity&&activity.source_id||m.source_id||m.content_id);}
function targetFor(activity){var m=activity&&activity.metadata||{},explicit=text(m.stage5_target);if(explicit)return explicit;var code=text(m.concept_code);return code?'concept:'+code:'';}
function rememberCompletion(done){
  if(!done||!arr(done.answers).length)return;
  var groups={};arr(done.answers).forEach(function(a){var target=text(a&&a.target);if(!target)return;var g=groups[target]||(groups[target]={target:target,total:0,correct:0,itemIds:[]});g.total++;if(a.correct)g.correct++;var id=text(a.sourceId);if(id&&g.itemIds.indexOf(id)<0)g.itemIds.push(id);});
  var targets=Object.keys(groups);if(!targets.length)return;var best=groups[targets.sort(function(a,b){return groups[b].total-groups[a].total;})[0]];if(best.total<3)return;
  var accuracy=best.total?best.correct/best.total:0,cooldown=accuracy>=.8?12*60*60*1000:accuracy>=.6?2*60*60*1000:30*60*1000,id=uid();if(!id)return;
  try{var key=COMPLETION_KEY+id,store=JSON.parse(localStorage.getItem(key)||'{}')||{},now=Date.now();Object.keys(store).forEach(function(k){if(!store[k]||now-Number(store[k].at||0)>7*86400000)delete store[k];});store[best.target]={at:now,until:now+cooldown,correct:best.correct,total:best.total,accuracy:Math.round(accuracy*100),itemIds:best.itemIds.slice(0,20)};localStorage.setItem(key,JSON.stringify(store));}catch(_){ }
}
async function logCoachAttempt(detail){
  var result=detail&&detail.result||{},activity=detail&&detail.activity||{},sid=session&&session.pointsSessionId;if(!sid)return false;
  var m=activity&&activity.metadata&&typeof activity.metadata==='object'?activity.metadata:{},correct=!!result.correct,srcId=sourceId(activity),extra={
    source:'study_v2_ai_coach',skill:text(activity.skill),plan_type:session&&session.planType||null,activity_id:text(activity.id),source_id:srcId,
    book_id:text(m.book_id),unit_id:text(m.unit_id),content_type:text(activity.sourceType||m.content_type),content_id:text(m.content_id||srcId),
    mastery_content_type:text(m.mastery_content_type),mastery_content_id:text(m.mastery_content_id),concept_code:text(m.concept_code),pattern_id:text(m.pattern_id),
    stage5_target:text(m.stage5_target),stage5_target_type:text(m.stage5_target_type),stage5_target_label:text(m.stage5_target_label),stage5_review_key:text(m.stage5_review_key),
    diagnosis:m.diagnosis&&typeof m.diagnosis==='object'?m.diagnosis:null
  };
  var body={event_type:'attempt',session_id:sid,mode:'ai_coach',word:text(activity.id||srcId||'ai-coach-answer'),is_correct:correct,answer:valueText(result.selected),correct_answer:valueText(result.answer),points:correct?2:0,attempt_index:session?session.index:null,duration_ms:Number(detail&&detail.responseTimeMs||result.responseTimeMs)||null,extra:extra};
  try{
    var request=(global.WillenaAPI&&typeof global.WillenaAPI.fetch==='function')?global.WillenaAPI.fetch:fetch;
    var r=await request(POINTS_ENDPOINT,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var data=await r.json().catch(function(){return{};});
    if(!r.ok||data&&data.error)throw new Error((data&&data.error)||('attempt log '+r.status));
    if(correct)try{global.dispatchEvent(new CustomEvent('points:optimistic-bump',{detail:{delta:2,source:'ai_coach'}}));}catch(_){}
    return true;
  }catch(e){console.warn('[AI Coach] attempt log failed',e);return false;}
}
function keyboardFree(item){var response=item&&item.response||{},type=text(response.type||item&&item.type);return type!=='typed_answer'&&type!=='gap_fill_text';}
function currentLowLevelContext(){
  try{
    var id=uid();if(!id)return null;var cache=JSON.parse(localStorage.getItem('willena-study-v2-home:v1:'+id)||'null');var books=cache&&arr(cache.books)||[],wanted=cache&&cache.activeBookId;var book=books.find(function(b){return String(b.book_id)===String(wanted);})||books[0]||null;if(!book)return null;
    var unit=book.currentUnit||arr(book.units)[0]||null;if(!unit)return null;var internal=Number(book.internal_level_id||book.internalLevel)||null,pub=Number(book.public_level||book.publicLevel)||null,low=internal?internal<=2:(pub?pub<=2:false);return low?{bookId:String(book.book_id),unitId:String(unit.id),internal:internal,publicLevel:pub}:null;
  }catch(_){return null;}
}
function dedupe(items){var seen={},out=[];arr(items).forEach(function(item){var key=text(item&&item.id||item&&item.sourceId||item&&item.source_id);if(!key||seen[key])return;seen[key]=1;out.push(item);});return out;}
function focusLowLevelPlan(plan,items){var ctx=currentLowLevelContext();if(!ctx)return items;var type=text(plan&&plan.type);if(['challenge_harder','challenge_pattern','challenge_mixed','new'].indexOf(type)>=0)return items;var unitItems=items.filter(function(item){var m=item&&item.metadata||{};return String(m.book_id||'')===ctx.bookId&&String(m.unit_id||'')===ctx.unitId;});return unitItems.length?unitItems:items;}
async function repairConversationPrompt(item){
  if(!item||text(item.sourceType)!=='assessment_item'||text(item.skill)!=='conversation')return item;var srcId=text(item.sourceId||item.source_id);if(!srcId)return item;
  try{var url=CONTENT_URL+'/rest/v1/assessment_items?select=prompt_text,context_text,metadata&id=eq.'+encodeURIComponent(srcId)+'&limit=1';var r=await fetch(url,{headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store'});if(!r.ok)return item;var rows=await r.json(),row=arr(rows)[0];if(!row)return item;var meta=row.metadata||{},form=text(meta.conversation_form||meta.question_form),sourcePrompt=text(row.prompt_text),sourceContext=text(row.context_text);if(sourcePrompt&&['situation','matching_question','translation_en_ko','translation_ko_en'].indexOf(form)>=0){item.stimulus=item.stimulus||{};item.stimulus.prompt=sourcePrompt;if(sourceContext)item.stimulus.context=sourceContext;item.metadata=item.metadata||{};item.metadata.source_prompt_text=sourcePrompt;item.metadata.conversation_form=form;}}catch(e){console.debug('[AI Coach] prompt repair skipped',e);}return item;
}
function ensureOverlay(){var old=document.getElementById('aiCoachPracticeOverlay');if(old)old.remove();var overlay=document.createElement('section');overlay.id='aiCoachPracticeOverlay';overlay.className='ai-coach-practice-overlay';overlay.innerHTML='<div class="ai-coach-practice-shell"><header class="ai-coach-practice-head"><button id="aiCoachPracticeBack" class="ai-coach-practice-back" type="button" aria-label="Back">←</button><div class="ai-coach-practice-title"><h2 id="aiCoachPracticeTitle"></h2><div id="aiCoachPracticeProgress" class="ai-coach-practice-progress"></div></div></header><div class="ai-coach-practice-card"><div id="aiCoachActivityRoot"></div></div><button id="aiCoachPracticeNext" class="ai-coach-practice-next" type="button" disabled></button></div>';document.body.appendChild(overlay);overlay.querySelector('#aiCoachPracticeBack').addEventListener('click',function(){close(false);});overlay.querySelector('#aiCoachPracticeNext').addEventListener('click',advance);return overlay;}
function scrollActionIntoView(overlay,action){if(!overlay||!action)return;function place(smooth){if(!document.body.contains(overlay)||!document.body.contains(action))return;try{overlay.scrollTo({top:Math.max(0,overlay.scrollHeight-overlay.clientHeight),behavior:smooth?'smooth':'auto'});}catch(_){overlay.scrollTop=overlay.scrollHeight;}}requestAnimationFrame(function(){requestAnimationFrame(function(){place(true);});});setTimeout(function(){place(false);},90);setTimeout(function(){place(false);},220);}
function restoreHomeY(y){y=Math.max(0,Number(y)||0);function place(){try{global.scrollTo({top:y,left:0,behavior:'auto'});}catch(_){global.scrollTo(0,y);}}requestAnimationFrame(function(){requestAnimationFrame(place);});[60,160,320].forEach(function(ms){setTimeout(place,ms);});}
async function showItem(){if(!session)return;var item=session.items[session.index];if(!item){close(true);return;}var overlay=session.overlay,next=overlay.querySelector('#aiCoachPracticeNext');session.answered=false;next.disabled=true;next.textContent=isKo()?'다음':'Next';overlay.querySelector('#aiCoachPracticeProgress').textContent=(session.index+1)+' / '+session.items.length;item=await repairConversationPrompt(item);if(!session)return;session.items[session.index]=item;session.engine.setActivity(item);overlay.scrollTo({top:0,behavior:'auto'});}
function advance(){if(!session||!session.answered)return;if(session.index>=session.items.length-1){close(true);return;}session.index++;showItem();}
function open(plan){
  if(!plan||!arr(plan.items).length||!global.WillenaActivityEngine)return false;var safeItems=dedupe(arr(plan.items).filter(keyboardFree));safeItems=focusLowLevelPlan(plan,safeItems).slice(0,12);if(!safeItems.length){console.warn('[AI Coach] Practice plan contained no usable activities; refusing to open it.');return false;}
  var homeY=Math.max(0,Math.round(global.scrollY||global.pageYOffset||0)),overlay=ensureOverlay(),root=overlay.querySelector('#aiCoachActivityRoot'),next=overlay.querySelector('#aiCoachPracticeNext');session={items:safeItems,index:0,overlay:overlay,answered:false,engine:null,homeY:homeY,pointsSessionId:coachSessionId(),planType:text(plan.type),logJobs:[],answers:[]};
  session.engine=new global.WillenaActivityEngine(root,{onAnswer:function(detail){if(!session)return;var current=session,activity=detail&&detail.activity||{},result=detail&&detail.result||{};current.answers.push({correct:!!result.correct,target:targetFor(activity),sourceId:sourceId(activity)});var job=logCoachAttempt(detail);current.logJobs.push(job);current.answered=true;next.disabled=false;next.textContent=current.index>=current.items.length-1?(isKo()?'완료':'Finish'):(isKo()?'다음':'Next');scrollActionIntoView(overlay,next);}});
  overlay.querySelector('#aiCoachPracticeTitle').textContent=plan.title||(isKo()?'AI 코치 연습':'AI Coach Practice');document.documentElement.style.overflow='hidden';showItem();return true;
}
function refreshCoachAfterLogs(done){var jobs=arr(done&&done.logJobs);Promise.all(jobs.map(function(p){return Promise.resolve(p).catch(function(){return false;});})).then(function(){try{var h=global.WillenaCoachStage5TargetHistory;if(h&&typeof h.invalidate==='function')h.invalidate();global.dispatchEvent(new CustomEvent('willena:stage5-force-refresh',{detail:{source:'ai_coach_completion'}}));}catch(_){}});}
function close(completed){
  var done=session,homeY=done&&Number.isFinite(done.homeY)?done.homeY:(global.scrollY||0),overlay=document.getElementById('aiCoachPracticeOverlay');if(overlay)overlay.remove();document.documentElement.style.overflow='';session=null;
  if(completed&&done){rememberCompletion(done);refreshCoachAfterLogs(done);var t=document.getElementById('aiChatTranscript');if(t){var row=document.createElement('div');row.className='study-v2-ai-chat-row is-coach';var bubble=document.createElement('div');bubble.className='study-v2-ai-chat-bubble';bubble.textContent=isKo()?'잘했어요! 더 도전하거나 새로운 걸 골라도 좋아요.':'Nice work! You can challenge yourself again or try something new.';row.appendChild(bubble);t.appendChild(row);}}
  restoreHomeY(homeY);
}
document.addEventListener('click',function(e){var cta=e.target&&e.target.closest&&e.target.closest('#aiChatCta .study-v2-ai-chat-cta');if(!cta)return;var coach=global.WillenaStudyV2AIChat,plan=coach&&typeof coach.getLastPlan==='function'?coach.getLastPlan():null;if(!plan||!arr(plan.items).length)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();open(plan);},true);
global.WillenaStudyV2AIPractice={open:open,close:close};
})(window);
