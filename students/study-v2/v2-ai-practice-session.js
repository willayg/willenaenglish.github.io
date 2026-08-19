(function(global){
'use strict';
var session=null;
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var POINTS_ENDPOINT='/.netlify/functions/log_word_attempt';
function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function arr(v){return Array.isArray(v)?v:[];}
function valueText(v){if(Array.isArray(v))return v.join(' ');if(v&&typeof v==='object')try{return JSON.stringify(v);}catch(_){return String(v);}return String(v==null?'':v);}
function coachSessionId(){return'ai-coach-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);}
async function awardCoachPoints(detail){
  var result=detail&&detail.result||{};if(!result.correct)return false;
  var activity=detail&&detail.activity||{},sid=session&&session.pointsSessionId;if(!sid)return false;
  var body={
    event_type:'attempt',session_id:sid,mode:'ai_coach',word:text(activity.id||activity.sourceId||'ai-coach-answer'),
    is_correct:true,answer:valueText(result.selected),correct_answer:valueText(result.answer),points:2,
    attempt_index:session?session.index:null,duration_ms:Number(detail&&detail.responseTimeMs||result.responseTimeMs)||null,
    extra:{source:'study_v2_ai_coach',skill:text(activity.skill),plan_type:session&&session.planType||null,activity_id:text(activity.id)}
  };
  try{
    var request=(global.WillenaAPI&&typeof global.WillenaAPI.fetch==='function')?global.WillenaAPI.fetch:fetch;
    var r=await request(POINTS_ENDPOINT,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var data=await r.json().catch(function(){return{};});
    if(!r.ok||data&&data.error)throw new Error((data&&data.error)||('points '+r.status));
    try{global.dispatchEvent(new CustomEvent('points:optimistic-bump',{detail:{delta:2,source:'ai_coach'}}));}catch(_){}
    return true;
  }catch(e){console.warn('[AI Coach] points award failed',e);return false;}
}
function keyboardFree(item){
  var response=item&&item.response||{};
  var type=text(response.type||item&&item.type);
  return type!=='typed_answer'&&type!=='gap_fill_text';
}
function currentLowLevelContext(){
  try{
    var uid=text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));
    if(!uid)return null;
    var cache=JSON.parse(localStorage.getItem('willena-study-v2-home:v1:'+uid)||'null');
    var books=cache&&arr(cache.books)||[],wanted=cache&&cache.activeBookId;
    var book=books.find(function(b){return String(b.book_id)===String(wanted);})||books[0]||null;
    if(!book)return null;
    var unit=book.currentUnit||arr(book.units)[0]||null;if(!unit)return null;
    var internal=Number(book.internal_level_id||book.internalLevel)||null;
    var pub=Number(book.public_level||book.publicLevel)||null;
    var low=internal?internal<=2:(pub?pub<=2:false);
    return low?{bookId:String(book.book_id),unitId:String(unit.id),internal:internal,publicLevel:pub}:null;
  }catch(_){return null;}
}
function dedupe(items){var seen={},out=[];arr(items).forEach(function(item){var key=text(item&&item.id||item&&item.sourceId||item&&item.source_id);if(!key||seen[key])return;seen[key]=1;out.push(item);});return out;}
function focusLowLevelPlan(plan,items){
  var ctx=currentLowLevelContext();if(!ctx)return items;
  var type=text(plan&&plan.type);
  if(['challenge_harder','challenge_pattern','challenge_mixed','new'].indexOf(type)>=0)return items;
  var unitItems=items.filter(function(item){var m=item&&item.metadata||{};return String(m.book_id||'')===ctx.bookId&&String(m.unit_id||'')===ctx.unitId;});
  return unitItems.length?unitItems:items;
}
async function repairConversationPrompt(item){
  if(!item||text(item.sourceType)!=='assessment_item'||text(item.skill)!=='conversation')return item;
  var sourceId=text(item.sourceId||item.source_id);if(!sourceId)return item;
  try{
    var url=CONTENT_URL+'/rest/v1/assessment_items?select=prompt_text,context_text,metadata&id=eq.'+encodeURIComponent(sourceId)+'&limit=1';
    var r=await fetch(url,{headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store'});if(!r.ok)return item;
    var rows=await r.json(),row=arr(rows)[0];if(!row)return item;
    var meta=row.metadata||{},form=text(meta.conversation_form||meta.question_form),sourcePrompt=text(row.prompt_text),sourceContext=text(row.context_text);
    if(sourcePrompt&&['situation','matching_question','translation_en_ko','translation_ko_en'].indexOf(form)>=0){
      item.stimulus=item.stimulus||{};
      item.stimulus.prompt=sourcePrompt;
      if(sourceContext)item.stimulus.context=sourceContext;
      item.metadata=item.metadata||{};
      item.metadata.source_prompt_text=sourcePrompt;
      item.metadata.conversation_form=form;
    }
  }catch(e){console.debug('[AI Coach] prompt repair skipped',e);}
  return item;
}
function ensureOverlay(){
  var old=document.getElementById('aiCoachPracticeOverlay');
  if(old)old.remove();
  var overlay=document.createElement('section');
  overlay.id='aiCoachPracticeOverlay';
  overlay.className='ai-coach-practice-overlay';
  overlay.innerHTML='<div class="ai-coach-practice-shell"><header class="ai-coach-practice-head"><button id="aiCoachPracticeBack" class="ai-coach-practice-back" type="button" aria-label="Back">←</button><div class="ai-coach-practice-title"><span>AI COACH</span><h2 id="aiCoachPracticeTitle"></h2><div id="aiCoachPracticeProgress" class="ai-coach-practice-progress"></div></div></header><div class="ai-coach-practice-card"><div id="aiCoachActivityRoot"></div></div><button id="aiCoachPracticeNext" class="ai-coach-practice-next" type="button" disabled></button></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#aiCoachPracticeBack').addEventListener('click',function(){close(false);});
  overlay.querySelector('#aiCoachPracticeNext').addEventListener('click',advance);
  return overlay;
}
function scrollActionIntoView(overlay,action){
  if(!overlay||!action)return;
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    try{action.scrollIntoView({behavior:'smooth',block:'end'});}catch(_){}
  });});
}
function restoreHomeY(y){
  y=Math.max(0,Number(y)||0);
  function place(){
    try{global.scrollTo({top:y,left:0,behavior:'auto'});}catch(_){global.scrollTo(0,y);}
  }
  requestAnimationFrame(function(){requestAnimationFrame(place);});
  [60,160,320].forEach(function(ms){setTimeout(place,ms);});
}
async function showItem(){
  if(!session)return;
  var item=session.items[session.index];
  if(!item){close(true);return;}
  var overlay=session.overlay;
  var next=overlay.querySelector('#aiCoachPracticeNext');
  session.answered=false;
  next.disabled=true;
  next.textContent=isKo()?'다음':'Next';
  overlay.querySelector('#aiCoachPracticeProgress').textContent=(session.index+1)+' / '+session.items.length;
  item=await repairConversationPrompt(item);
  if(!session)return;
  session.items[session.index]=item;
  session.engine.setActivity(item);
  overlay.scrollTo({top:0,behavior:'auto'});
}
function advance(){
  if(!session||!session.answered)return;
  if(session.index>=session.items.length-1){close(true);return;}
  session.index++;
  showItem();
}
function open(plan){
  if(!plan||!arr(plan.items).length||!global.WillenaActivityEngine)return false;
  var safeItems=dedupe(arr(plan.items).filter(keyboardFree));
  safeItems=focusLowLevelPlan(plan,safeItems).slice(0,12);
  if(!safeItems.length){
    console.warn('[AI Coach] Practice plan contained no usable activities; refusing to open it.');
    return false;
  }
  var homeY=Math.max(0,Math.round(global.scrollY||global.pageYOffset||0));
  var overlay=ensureOverlay();
  var root=overlay.querySelector('#aiCoachActivityRoot');
  var next=overlay.querySelector('#aiCoachPracticeNext');
  session={items:safeItems,index:0,overlay:overlay,answered:false,engine:null,homeY:homeY,pointsSessionId:coachSessionId(),planType:text(plan.type)};
  session.engine=new global.WillenaActivityEngine(root,{onAnswer:function(detail){
    if(!session)return;
    awardCoachPoints(detail);
    session.answered=true;
    next.disabled=false;
    next.textContent=session.index>=session.items.length-1?(isKo()?'완료':'Finish'):(isKo()?'다음':'Next');
    scrollActionIntoView(overlay,next);
  }});
  overlay.querySelector('#aiCoachPracticeTitle').textContent=plan.title||(isKo()?'AI 코치 연습':'AI Coach Practice');
  document.documentElement.style.overflow='hidden';
  showItem();
  return true;
}
function close(completed){
  var homeY=session&&Number.isFinite(session.homeY)?session.homeY:(global.scrollY||0);
  var overlay=document.getElementById('aiCoachPracticeOverlay');if(overlay)overlay.remove();
  document.documentElement.style.overflow='';
  session=null;
  if(completed){
    var t=document.getElementById('aiChatTranscript');
    if(t){var row=document.createElement('div');row.className='study-v2-ai-chat-row is-coach';var bubble=document.createElement('div');bubble.className='study-v2-ai-chat-bubble';bubble.textContent=isKo()?'잘했어요! 더 도전하거나 새로운 걸 골라도 좋아요.':'Nice work! You can challenge yourself again or try something new.';row.appendChild(bubble);t.appendChild(row);}
  }
  restoreHomeY(homeY);
}
document.addEventListener('click',function(e){
  var cta=e.target&&e.target.closest&&e.target.closest('#aiChatCta .study-v2-ai-chat-cta');
  if(!cta)return;
  var coach=global.WillenaStudyV2AIChat,plan=coach&&typeof coach.getLastPlan==='function'?coach.getLastPlan():null;
  if(!plan||!arr(plan.items).length)return;
  e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  open(plan);
},true);
global.WillenaStudyV2AIPractice={open:open,close:close};
})(window);
