(function(global){
'use strict';
var TARGET=20;
var CACHE_PREFIX='willena-study-v2-home:v1:';
var SESSION_PREFIX='willena-study-v2-daily:v1:';
var panel=document.getElementById('v2PracticePanel');
var root=document.getElementById('v2ActivityRoot');
var countEl=document.getElementById('practicePerf');
var titleEl=document.getElementById('v2PracticeTitle');
var skillEl=document.getElementById('v2PracticeSkill');
var card=document.getElementById('dailyWorkoutCard');
var engine=null,pools=[],poolById={},plan=[],session=null,current=null,currentOriginId=null,currentIsRetry=false,answerLocked=false,loading=false;

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function dateKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function cacheKey(){return CACHE_PREFIX+uid();}
function sessionKey(){return SESSION_PREFIX+uid()+':'+dateKey();}
function langKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function shuffle(a){return(a||[]).slice().sort(function(){return Math.random()-.5;});}
function home(){try{var o=JSON.parse(localStorage.getItem(cacheKey())||'null');return o&&Array.isArray(o.books)?o:null;}catch(_){return null;}}
function readSession(){try{var o=JSON.parse(localStorage.getItem(sessionKey())||'null');return o&&o.date===dateKey()?o:null;}catch(_){return null;}}
function saveSession(){try{if(session)localStorage.setItem(sessionKey(),JSON.stringify(session));}catch(_){}}
function api(url){return (global.WillenaAPI?WillenaAPI.fetch:fetch)(url,{credentials:'include',cache:'no-store'}).then(function(r){return r.json().then(function(d){if(!r.ok||d&&d.success===false)throw new Error(d.error||'Request failed');return d;});});}
function adaptive(){return api('/.netlify/functions/progress_summary?section=adaptive_state&_='+Date.now()).catch(function(){return{items:[]};});}
function contextFor(book,unit){return{bookId:book.book_id,bookTitle:book.book_title,unitId:unit&&unit.id,unitNumber:Number(unit&&unit.unit_number)};}
function validActivity(a){return a&&a.id&&['vocabulary','spelling','grammar','sentence_building','conversation','listening','reading'].indexOf(a.skill)>=0;}
async function loadUnitPool(book,unit,kind){if(!book||!unit||!global.WillenaStudyQuestionBank)return[];var rows=await global.WillenaStudyQuestionBank.loadUnit(null,contextFor(book,unit)).catch(function(){return[];});return arr(rows).filter(validActivity).map(function(a){a.metadata=Object.assign({},a.metadata||{},{book_id:book.book_id,unit_id:unit.id,daily_book_title:book.book_title,daily_unit_number:Number(unit.unit_number),daily_source:kind||'current'});if(kind==='review')a.metadata.adaptive_review=true;else a.metadata.current_curriculum=true;return a;});}
async function loadBookPool(book,state){if(!book||!book.currentUnit)return[];var items=arr(state&&state.items),dueIds=[],seen={};items.filter(function(x){return String(x.book_id)===String(book.book_id)&&String(x.unit_id)!==String(book.currentUnit.id)&&(x.due||Number(x.lapses||0)>0);}).sort(function(a,b){var al=Number(a.lapses||0),bl=Number(b.lapses||0);if(al!==bl)return bl-al;return Number(a.mastery_score||0)-Number(b.mastery_score||0);}).forEach(function(x){var id=String(x.unit_id||'');if(id&&!seen[id]&&dueIds.length<3){seen[id]=true;dueIds.push(id);}});var units=arr(book.units),reviewUnits=dueIds.map(function(id){return units.find(function(u){return String(u.id)===id;});}).filter(Boolean),jobs=[loadUnitPool(book,book.currentUnit,'current')].concat(reviewUnits.map(function(u){return loadUnitPool(book,u,'review');})),parts=await Promise.all(jobs);return [].concat.apply([],parts);}
function masteryKey(a){var m=a&&a.metadata||{},skill=text(a&&a.skill);if(m.mastery_content_id)return text(m.mastery_content_type||a.sourceType||'activity')+'|'+text(m.mastery_content_id)+'|'+skill;if(skill==='grammar'&&m.pattern_id)return'pattern|'+text(m.pattern_id)+'|grammar';return text(a&&a.sourceType||'activity')+'|'+text(a&&a.sourceId||a&&a.id)+'|'+skill;}
function quotas(n){var out=[],base=Math.floor(TARGET/n),rem=TARGET%n;for(var i=0;i<n;i++)out.push(base+(i<rem?1:0));return out;}
function chooseForBook(rows,state,target,book){if(global.WillenaAdaptiveStudy&&global.WillenaAdaptiveStudy.chooseSession){return global.WillenaAdaptiveStudy.chooseSession(rows,state,{target:target,currentBookId:book.book_id,currentUnitId:book.currentUnit.id});}return shuffle(rows).slice(0,target);}
function interleave(groups){var out=[],work=groups.map(function(g){return g.slice();}),progress=true;while(out.length<TARGET&&progress){progress=false;for(var i=0;i<work.length&&out.length<TARGET;i++){if(work[i].length){out.push(work[i].shift());progress=true;}}}return out;}
function hydratePlan(ids){var seen={};return arr(ids).map(function(id){var a=poolById[id];if(!a||seen[id])return null;seen[id]=true;return a;}).filter(Boolean);}
function fillPlan(existing){var used={};existing.forEach(function(a){used[a.id]=true;});var extras=shuffle(pools.filter(function(a){return !used[a.id];}));while(existing.length<TARGET&&extras.length)existing.push(extras.shift());return existing.slice(0,TARGET);}
function migrateSession(saved){
  saved.version=2;
  saved.cursor=Math.min(TARGET,Number(saved.cursor!=null?saved.cursor:saved.index)||0);
  saved.completedIds=arr(saved.completedIds);
  if(!saved.completedIds.length&&saved.cursor>0){for(var i=0;i<Math.min(saved.cursor,plan.length);i++)saved.completedIds.push(plan[i].id);}
  saved.retryQueue=arr(saved.retryQueue);
  saved.shownCount=Number(saved.shownCount)||saved.cursor;
  saved.mistakes=saved.mistakes||{};
  saved.attempts=saved.attempts||{};
  saved.active=saved.active||null;
  saved.index=saved.completedIds.length;
  return saved;
}
async function prepare(){var h=home();if(!h||!h.books.length)throw new Error('Assigned books are still loading.');var books=h.books.filter(function(b){return b&&b.book_id&&b.currentUnit&&b.currentUnit.id;}).slice(0,3);if(!books.length)throw new Error('No study books are ready.');var state=await adaptive(),groups=await Promise.all(books.map(function(b){return loadBookPool(b,state);}));pools=[].concat.apply([],groups);poolById={};pools.forEach(function(a){poolById[a.id]=a;});var usable=[],usableBooks=[];groups.forEach(function(g,i){if(g.length){usable.push(g);usableBooks.push(books[i]);}});if(!usable.length)throw new Error('No Daily Study questions are available yet.');var saved=readSession();if(saved&&Array.isArray(saved.planIds)){plan=fillPlan(hydratePlan(saved.planIds));session=migrateSession(saved);session.planIds=plan.map(function(a){return a.id;});saveSession();return;}
 var qs=quotas(usable.length),chosenGroups=[];usable.forEach(function(g,i){chosenGroups.push(chooseForBook(g,state,qs[i],usableBooks[i]));});plan=interleave(chosenGroups);plan=fillPlan(plan);session={version:2,date:dateKey(),target:TARGET,index:0,cursor:0,planIds:plan.map(function(a){return a.id;}),attempts:{},completedIds:[],retryQueue:[],shownCount:0,mistakes:{},active:null,startedAt:Date.now(),finishedAt:null};saveSession();}
function resolvedCount(){return Math.min(TARGET,arr(session&&session.completedIds).length);}
function paint(){var s=readSession(),done=s?Math.min(TARGET,arr(s.completedIds).length||Number(s.index)||0):0,pct=Math.round(done/TARGET*100),ring=document.querySelector('#dailyWorkoutCard .progress-ring'),num=document.getElementById('smartDailyPct'),copy=document.getElementById('smartProgressCopy'),title=document.getElementById('smartProgressTitle');if(ring)ring.style.setProperty('--progress',pct);if(num)num.textContent=done>=TARGET?'✓':done+'/'+TARGET;if(title)title.textContent=langKo()?'오늘의 학습':'Daily Workout';if(copy)copy.textContent=done>=TARGET?(langKo()?'오늘 목표 완료 ✓':'Goal complete ✓'):(langKo()?'오늘의 맞춤 학습 · '+done+'/'+TARGET:'Adaptive daily study · '+done+'/'+TARGET);}
function sourceBadge(a){if(!root)return;var c=root.querySelector('.activity-card');if(!c)return;var old=c.querySelector('.activity-source-badge');if(old)old.remove();var b=document.createElement('div');b.className='activity-source-badge';var m=a.metadata||{};b.textContent=(m.daily_book_title||'Study')+' · Unit '+(m.daily_unit_number||'')+(currentIsRetry?(langKo()?' · 다시 연습':' · Retry'):(m.daily_source==='review'?(langKo()?' · 복습':' · Review'):''));c.insertBefore(b,c.firstChild);}
function setHeader(){if(skillEl)skillEl.textContent=langKo()?'오늘의 학습':'DAILY STUDY';if(titleEl)titleEl.textContent=langKo()?'맞춤 Daily Study':'Adaptive Daily Study';if(countEl)countEl.textContent=resolvedCount()+' / '+TARGET;}
function alternateFor(origin,excludeId){var key=masteryKey(origin),candidates=pools.filter(function(x){return x.id!==excludeId&&masteryKey(x)===key;});return shuffle(candidates)[0]||origin;}
function spacing(){return 3+Math.floor(Math.random()*3);}
function queueRetry(originId,shownFrom,excludeId){var origin=poolById[originId]||plan.find(function(x){return x.id===originId;});if(!origin)return;session.retryQueue=session.retryQueue.filter(function(q){return q.originId!==originId;});var retry=alternateFor(origin,excludeId||'');session.retryQueue.push({originId:originId,activityId:retry.id,dueAt:Number(shownFrom||session.shownCount)+spacing()});saveSession();}
function takeDueRetry(){if(!session.retryQueue.length)return null;var idx=session.retryQueue.findIndex(function(q){return Number(q.dueAt)<=Number(session.shownCount);});if(idx<0&&session.cursor>=plan.length)idx=0;if(idx<0)return null;return session.retryQueue.splice(idx,1)[0];}
function nextActivity(){
  if(session.active){var aa=poolById[session.active.activityId];if(aa)return{activity:aa,originId:session.active.originId,isRetry:!!session.active.isRetry};session.active=null;}
  var q=takeDueRetry();
  if(q){var qa=poolById[q.activityId]||poolById[q.originId];if(qa){session.active={activityId:qa.id,originId:q.originId,isRetry:true};saveSession();return{activity:qa,originId:q.originId,isRetry:true};}}
  if(session.cursor<plan.length){var a=plan[session.cursor];session.active={activityId:a.id,originId:a.id,isRetry:false};saveSession();return{activity:a,originId:a.id,isRetry:false};}
  if(session.retryQueue.length){var last=session.retryQueue.shift(),la=poolById[last.activityId]||poolById[last.originId];if(la){session.active={activityId:la.id,originId:last.originId,isRetry:true};saveSession();return{activity:la,originId:last.originId,isRetry:true};}}
  return null;
}
function show(){if(resolvedCount()>=TARGET&&!session.retryQueue.length&&!session.active){finish();return;}var next=nextActivity();if(!next){finish();return;}current=next.activity;currentOriginId=next.originId;currentIsRetry=next.isRetry;answerLocked=false;session.shownCount=Number(session.shownCount||0)+1;saveSession();document.body.classList.add('study-v2-practice-mode','study-v2-daily-mode');if(panel)panel.hidden=false;setHeader();if(!engine)engine=new global.WillenaActivityEngine(root,{onAnswer:function(){}});engine.setActivity(current);sourceBadge(current);if(panel)panel.scrollTop=0;}
function replaceCheck(label,handler){var check=root&&root.querySelector('.activity-check');if(!check)return;var b=check.cloneNode(true);b.disabled=false;b.textContent=label;check.replaceWith(b);b.addEventListener('click',handler,{once:true});}
function markResolved(originId){if(session.completedIds.indexOf(originId)<0)session.completedIds.push(originId);session.index=session.completedIds.length;}
function recordMistake(originId){session.mistakes[originId]=Number(session.mistakes[originId]||0)+1;}
function advanceAfterAnswer(correct){
  if(!currentIsRetry)session.cursor=Math.min(plan.length,Number(session.cursor||0)+1);
  if(correct){markResolved(currentOriginId);}else{recordMistake(currentOriginId);queueRetry(currentOriginId,session.shownCount,current.id);}
  session.active=null;
  session.attempts[current.id]=0;
  if(resolvedCount()>=TARGET&&!session.retryQueue.length){session.finishedAt=Date.now();saveSession();paint();finish();return;}
  saveSession();paint();show();
}
function onAnswer(e){if(!document.body.classList.contains('study-v2-daily-mode')||!current||answerLocked)return;var d=e.detail||{},a=d.activity||{},r=d.result||{};if(a.id!==current.id)return;answerLocked=true;session.attempts[current.id]=Number(session.attempts[current.id]||0)+1;saveSession();if(r.correct){replaceCheck(langKo()?'계속':'Continue',function(){advanceAfterAnswer(true);});return;}replaceCheck(langKo()?'계속':'Continue',function(){advanceAfterAnswer(false);});}
function finish(){document.body.classList.add('study-v2-practice-mode','study-v2-daily-mode');if(panel)panel.hidden=false;if(countEl)countEl.textContent=langKo()?'완료':'Done';if(skillEl)skillEl.textContent=langKo()?'오늘의 학습':'DAILY STUDY';if(titleEl)titleEl.textContent=langKo()?'오늘 목표 완료':'Daily goal complete';if(root)root.innerHTML='<div class="smart-finish"><div class="smart-confetti">✓</div><h2>'+(langKo()?'잘했어요!':'Great work!')+'</h2><p>'+(langKo()?'오늘의 20개 학습 목표를 모두 맞혔어요.':'You correctly resolved all 20 learning targets.')+'</p><button id="v2DailyHome" class="primary-button smart-home-button" type="button">'+(langKo()?'돌아가기':'Back to Study')+'</button></div>';var homeBtn=document.getElementById('v2DailyHome');if(homeBtn)homeBtn.addEventListener('click',close);paint();}
function close(){document.body.classList.remove('study-v2-practice-mode','study-v2-daily-mode');if(panel)panel.hidden=true;if(root)root.innerHTML='';current=null;currentOriginId=null;currentIsRetry=false;engine=null;paint();window.scrollTo({top:0,behavior:'auto'});}
async function open(){if(loading)return;loading=true;try{await prepare();if(resolvedCount()>=TARGET&&!session.retryQueue.length){finish();}else show();}catch(e){console.warn('[StudyV2 Daily]',e);if(countEl)countEl.textContent=langKo()?'잠시 후 다시 시도하세요.':'Please try again shortly.';}finally{loading=false;}}
function bind(){if(card){card.addEventListener('click',open);card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});}document.addEventListener('click',function(e){var closeBtn=e.target&&e.target.closest&&e.target.closest('#v2PracticeClose');if(closeBtn&&document.body.classList.contains('study-v2-daily-mode')){e.preventDefault();e.stopImmediatePropagation();close();}},true);global.addEventListener('willena:activity-answer',onAnswer);global.addEventListener('willena:study-progress-updated',function(){setTimeout(paint,40);});[0,400,1200,2800].forEach(function(ms){setTimeout(paint,ms);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
global.WillenaStudyV2Daily={open:open,close:close,paint:paint,getSession:readSession};
})(window);
