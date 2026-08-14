(function(global){
'use strict';

var TARGET=20;
var MAX_CANDIDATES=80;
var ENDPOINT='https://api.willenaenglish.com/api/daily-study';
var CACHE_PREFIX='willena-study-v2-home:v1:';
var SKILLS=['vocabulary','spelling','grammar','sentence_building','conversation','listening','reading'];

var panel=document.getElementById('v2PracticePanel');
var root=document.getElementById('v2ActivityRoot');
var countEl=document.getElementById('practicePerf');
var titleEl=document.getElementById('v2PracticeTitle');
var skillEl=document.getElementById('v2PracticeSkill');
var card=document.getElementById('dailyWorkoutCard');

var engine=null;
var session=null;
var current=null;
var loading=false;
var answerLocked=false;
var syncing=false;

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function cacheKey(){return CACHE_PREFIX+uid();}
function home(){try{var o=JSON.parse(localStorage.getItem(cacheKey())||'null');return o&&Array.isArray(o.books)?o:null;}catch(_){return null;}}
function langKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function shuffle(items){return arr(items).slice().sort(function(){return Math.random()-.5;});}
function clone(value){return JSON.parse(JSON.stringify(value));}
function dateKey(){
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  catch(_){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
}
function resolvedCount(){return Math.min(TARGET,arr(session&&session.resolved_keys).length);}
function validActivity(a){return a&&a.id&&SKILLS.indexOf(a.skill)>=0&&a.response&&a.stimulus;}
function dailyKey(a){return text(a&&a.daily_key||a&&a.id);}

async function request(method,body){
  try{if(global.WillenaStudyV2AuthReady)await global.WillenaStudyV2AuthReady;}catch(_){}
  var url=ENDPOINT+'?date='+encodeURIComponent(dateKey())+'&_='+Date.now();
  var opts={method:method,credentials:'include',cache:'no-store',headers:{Accept:'application/json'}};
  if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
  var r=await fetch(url,opts),d=await r.json().catch(function(){return{};});
  if(!r.ok)throw new Error(d.error||('Daily Study request failed ('+r.status+')'));
  return d;
}

function paint(){
  var done=resolvedCount(),pct=Math.round(done/TARGET*100);
  var ring=document.querySelector('#dailyWorkoutCard .progress-ring');
  var num=document.getElementById('smartDailyPct');
  var title=document.getElementById('smartProgressTitle');
  var copy=document.getElementById('smartProgressCopy');
  if(ring)ring.style.setProperty('--progress',pct);
  if(num)num.textContent=done>=TARGET?'✓':done+'/'+TARGET;
  if(title)title.textContent=langKo()?'오늘의 학습':'Daily Study';
  if(copy)copy.textContent=done>=TARGET?(langKo()?'오늘 목표 완료 ✓':'Daily goal complete ✓'):(langKo()?'오늘 목표 · '+done+'/'+TARGET:'Today · '+done+'/'+TARGET);
}
function setCardLoading(on,message){
  if(!card)return;
  card.classList.toggle('is-loading',!!on);
  card.setAttribute('aria-busy',on?'true':'false');
  var copy=document.getElementById('smartProgressCopy');
  if(copy&&message)copy.textContent=message;
}
function setCardError(error){
  setCardLoading(false);
  var copy=document.getElementById('smartProgressCopy');
  if(copy)copy.textContent=langKo()?'Daily Study를 불러오지 못했습니다. 다시 눌러 주세요.':'Could not load Daily Study. Tap to retry.';
  console.warn('[Daily Study]',error);
}

function sessionFrom(data){if(data&&data.session){session=data.session;paint();return session;}return null;}
async function syncCard(){
  if(syncing)return syncing;
  syncing=(async function(){try{var data=await request('GET');if(data&&data.session)sessionFrom(data);else{session=null;paint();}return data;}catch(e){console.warn('[Daily Study] sync',e);return null;}finally{syncing=false;}})();
  return syncing;
}

function contextFor(book,unit){return{bookId:book.book_id,bookTitle:book.book_title,unitId:unit.id,unitNumber:Number(unit.unit_number)};}
async function adaptive(){try{if(global.WillenaStudyProgress&&typeof global.WillenaStudyProgress.getAdaptiveState==='function')return await global.WillenaStudyProgress.getAdaptiveState();}catch(e){console.warn('[Daily Study] adaptive state unavailable',e);}return{items:[]};}
async function loadUnitPool(book,unit,kind){
  if(!book||!unit||!global.WillenaStudyQuestionBank)return[];
  var rows=await global.WillenaStudyQuestionBank.loadUnit(null,contextFor(book,unit)).catch(function(){return[];});
  return arr(rows).filter(validActivity).map(function(source){
    var a=clone(source),key=text(a.id);a.daily_key=key;
    a.metadata=Object.assign({},a.metadata||{},{book_id:book.book_id,unit_id:unit.id,daily_mode:true,daily_key:key,daily_origin_id:key,daily_book_title:book.book_title,daily_unit_number:Number(unit.unit_number),daily_source:kind||'current',current_curriculum:kind!=='review',adaptive_review:kind==='review'});
    return a;
  });
}
async function loadBookPool(book,state){
  if(!book||!book.currentUnit)return[];
  var dueIds=[],seen={};
  arr(state&&state.items).filter(function(x){return String(x.book_id)===String(book.book_id)&&String(x.unit_id)!==String(book.currentUnit.id)&&(x.due||Number(x.lapses||0)>0);}).sort(function(a,b){var al=Number(a.lapses||0),bl=Number(b.lapses||0);if(al!==bl)return bl-al;return Number(a.mastery_score||0)-Number(b.mastery_score||0);}).forEach(function(x){var id=String(x.unit_id||'');if(id&&!seen[id]&&dueIds.length<2){seen[id]=true;dueIds.push(id);}});
  var units=arr(book.units),reviewUnits=dueIds.map(function(id){return units.find(function(u){return String(u.id)===id;});}).filter(Boolean);
  var jobs=[loadUnitPool(book,book.currentUnit,'current')].concat(reviewUnits.map(function(u){return loadUnitPool(book,u,'review');}));
  var parts=await Promise.all(jobs);return [].concat.apply([],parts);
}
function balancedCandidates(groups){
  var books=groups.map(function(rows){var by={};SKILLS.forEach(function(s){by[s]=[];});shuffle(rows).forEach(function(a){if(validActivity(a))by[a.skill].push(a);});SKILLS.forEach(function(s){by[s]=shuffle(by[s]);});return by;});
  var out=[],used={},progress=true;
  while(out.length<MAX_CANDIDATES&&progress){progress=false;for(var s=0;s<SKILLS.length&&out.length<MAX_CANDIDATES;s++){for(var b=0;b<books.length&&out.length<MAX_CANDIDATES;b++){var bucket=books[b][SKILLS[s]];while(bucket.length){var a=bucket.shift(),k=dailyKey(a);if(!k||used[k])continue;used[k]=true;out.push(a);progress=true;break;}}}}
  return out;
}
async function buildPlan(){
  var h=home();if(!h||!h.books.length)throw new Error('Assigned books are still loading.');
  var books=h.books.filter(function(b){return b&&b.book_id&&b.currentUnit&&b.currentUnit.id;});if(!books.length)throw new Error('No study books are ready.');
  var state=await adaptive(),groups=await Promise.all(books.map(function(b){return loadBookPool(b,state);}));groups=groups.filter(function(g){return g.length;});if(!groups.length)throw new Error('No Daily Study questions are available.');
  var plan=balancedCandidates(groups);if(plan.length<TARGET)throw new Error('Daily Study needs at least 20 unique questions.');return plan;
}
async function ensureSession(){
  var data=await request('GET');if(data&&data.session)return sessionFrom(data);if(!data||!data.needs_plan)throw new Error('Daily Study session could not be loaded.');
  var plan=await buildPlan(),created=await request('POST',{action:'create',plan:plan});if(!created||!created.session)throw new Error(created&&created.error||'Daily Study session could not be created.');return sessionFrom(created);
}
function currentItem(){if(!session||session.status==='completed')return null;var cursor=Number(session.cursor)||0,plan=arr(session.plan);return cursor>=0&&cursor<plan.length?clone(plan[cursor]):null;}
function setHeader(){if(skillEl)skillEl.textContent=langKo()?'오늘의 학습':'DAILY STUDY';if(titleEl)titleEl.textContent=langKo()?'오늘의 Daily Study':'Daily Study';if(countEl)countEl.textContent=resolvedCount()+' / '+TARGET;}
function sourceBadge(a){if(!root)return;var c=root.querySelector('.activity-card');if(!c)return;var old=c.querySelector('.activity-source-badge');if(old)old.remove();var m=a.metadata||{},b=document.createElement('div');b.className='activity-source-badge';b.textContent=(m.daily_book_title||'Study')+' · Unit '+(m.daily_unit_number||'');c.insertBefore(b,c.firstChild);}
function prepareActivity(item){var a=clone(item),key=dailyKey(a);a.daily_key=key;a.metadata=Object.assign({},a.metadata||{},{daily_mode:true,daily_date:dateKey(),daily_key:key,daily_origin_id:key,daily_target:TARGET});return a;}
function showCurrent(){
  paint();setHeader();if(!session)return;if(session.status==='completed'||resolvedCount()>=TARGET){finish();return;}
  var item=currentItem();if(!item){if(root)root.innerHTML='<div class="smart-finish"><h2>'+(langKo()?'오늘의 문제를 모두 사용했어요.':'Daily question pool exhausted.')+'</h2><p>'+(langKo()?'담당 선생님에게 알려 주세요.':'Please tell your teacher.')+'</p></div>';return;}
  current=prepareActivity(item);answerLocked=false;document.body.classList.add('study-v2-practice-mode','study-v2-daily-mode');if(panel)panel.hidden=false;
  if(!global.WillenaActivityEngine)throw new Error('Activity engine is not ready.');
  if(!engine)engine=new global.WillenaActivityEngine(root,{onAnswer:function(){}});engine.setActivity(current);sourceBadge(current);if(panel)panel.scrollTop=0;
}
function replaceCheck(label,handler){var check=root&&root.querySelector('.activity-check');if(!check)return;var b=check.cloneNode(true);b.disabled=false;b.textContent=label;check.replaceWith(b);b.addEventListener('click',handler,{once:true});}
async function submitAnswer(correct){var key=dailyKey(current),data=await request('POST',{action:'answer',daily_key:key,correct:!!correct});if(data&&data.stale){sessionFrom(data);showCurrent();return;}if(!data||data.success===false)throw new Error(data&&data.error||'Daily answer was not saved.');sessionFrom(data);}
async function onAnswer(e){
  if(!document.body.classList.contains('study-v2-daily-mode')||!current||answerLocked)return;var d=e.detail||{},a=d.activity||{},r=d.result||{};if(String(a.id)!==String(current.id))return;answerLocked=true;
  try{await submitAnswer(!!r.correct);if(session&&session.status==='completed'){replaceCheck(langKo()?'완료':'Done',finish);return;}replaceCheck(langKo()?'계속':'Continue',showCurrent);}catch(error){console.warn('[Daily Study] answer save',error);answerLocked=false;var check=root&&root.querySelector('.activity-check');if(check){check.disabled=false;check.textContent=langKo()?'저장 다시 시도':'Retry save';}}
}
function finish(){if(session)session.status='completed';paint();document.body.classList.add('study-v2-practice-mode','study-v2-daily-mode');if(panel)panel.hidden=false;if(countEl)countEl.textContent=langKo()?'완료':'Done';if(skillEl)skillEl.textContent=langKo()?'오늘의 학습':'DAILY STUDY';if(titleEl)titleEl.textContent=langKo()?'오늘 목표 완료':'Daily goal complete';if(root)root.innerHTML='<div class="smart-finish"><div class="smart-confetti">✓</div><h2>'+(langKo()?'잘했어요!':'Great work!')+'</h2><p>'+(langKo()?'오늘의 20개 학습 목표를 모두 맞혔어요.':'You got all 20 Daily Study targets correct.')+'</p><button id="v2DailyHome" class="primary-button smart-home-button" type="button">'+(langKo()?'돌아가기':'Back to Study')+'</button></div>';var b=document.getElementById('v2DailyHome');if(b)b.addEventListener('click',close,{once:true});}
function close(){document.body.classList.remove('study-v2-practice-mode','study-v2-daily-mode');if(panel)panel.hidden=true;if(root)root.innerHTML='';current=null;engine=null;paint();window.scrollTo({top:0,behavior:'auto'});}
async function open(){
  if(loading)return;loading=true;setCardLoading(true,langKo()?'Daily Study 불러오는 중…':'Loading Daily Study…');
  try{await ensureSession();setCardLoading(false);showCurrent();}
  catch(e){setCardError(e);}
  finally{loading=false;}
}
function bind(){
  if(card){card.addEventListener('click',open);card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});}
  global.addEventListener('willena:activity-answer',onAnswer);
  global.addEventListener('focus',syncCard);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)syncCard();});
  var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(paint,0);});
  document.addEventListener('click',function(e){var x=e.target&&e.target.closest&&e.target.closest('#v2PracticeClose');if(x&&document.body.classList.contains('study-v2-daily-mode')){e.preventDefault();e.stopImmediatePropagation();close();}},true);
  paint();syncCard();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
global.WillenaStudyV2Daily={open:open,close:close,paint:paint,sync:syncCard,getSession:function(){return session;}};
})(window);