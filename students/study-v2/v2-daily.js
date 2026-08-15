(function(global){
'use strict';

var TARGET=20;
var MAX_CANDIDATES=80;
// Daily Study talks directly to the deployed proxy Worker. The api subdomain
// currently lands on an older router for this path and returns "Invalid API path".
var ENDPOINT='https://willena-proxy.willena.workers.dev/api/daily-study';
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
var progression={bookStates:[],unitProgress:[]};

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function cacheKey(){return CACHE_PREFIX+uid();}
function home(){try{var o=JSON.parse(localStorage.getItem(cacheKey())||'null');return o&&Array.isArray(o.books)?o:null;}catch(_){return null;}}
function langKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function shuffle(items){return arr(items).slice().sort(function(){return Math.random()-.5;});}
function clone(value){return JSON.parse(JSON.stringify(value));}
function dateKey(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(_){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}}
function resolvedCount(){return Math.min(TARGET,arr(session&&session.resolved_keys).length);}
function validActivity(a){return a&&a.id&&SKILLS.indexOf(a.skill)>=0&&a.response&&a.stimulus;}
function dailyKey(a){return text(a&&a.daily_key||a&&a.id);}

function ingestProgress(data){
  if(!data||typeof data!=='object')return;
  if(Array.isArray(data.book_states))progression.bookStates=data.book_states;
  if(Array.isArray(data.unit_progress))progression.unitProgress=data.unit_progress;
}
function bookState(book){return progression.bookStates.find(function(s){return String(s.book_id)===String(book.book_id);})||null;}
function unitProgress(bookId,unitId){return progression.unitProgress.find(function(p){return String(p.book_id)===String(bookId)&&String(p.unit_id)===String(unitId);})||null;}
function unitByHint(book,hint){
  var units=arr(book&&book.units);if(!units.length||hint==null||hint==='')return null;
  var raw=String(hint),n=(raw.match(/\d+/)||[])[0];
  return units.find(function(u){return String(u.id)===raw||(n&&String(u.unit_number)===String(n));})||null;
}
function assignmentUnit(book){
  return unitByHint(book,book&&book.current_unit)||unitByHint(book,book&&book.starting_unit)||arr(book&&book.units)[0]||book.currentUnit||null;
}
function dailyCursor(book){
  var units=arr(book&&book.units).slice().sort(function(a,b){return Number(a.unit_number)-Number(b.unit_number);});
  var assigned=assignmentUnit(book);if(!assigned)return null;
  var state=bookState(book),sameAssignment=state&&(!state.assignment_unit_id||String(state.assignment_unit_id)===String(assigned.id));
  var currentUnit=sameAssignment?units.find(function(u){return String(u.id)===String(state.current_unit_id);}):null;
  if(!currentUnit)currentUnit=assigned;
  var idx=units.findIndex(function(u){return String(u.id)===String(currentUnit.id);});
  var previousUnit=null;
  if(sameAssignment&&state.previous_unit_id)previousUnit=units.find(function(u){return String(u.id)===String(state.previous_unit_id);})||null;
  if(!previousUnit&&idx>0&&sameAssignment&&state&&state.previous_unit_id)previousUnit=units[idx-1];
  var nextUnit=idx>=0&&idx<units.length-1?units[idx+1]:null;
  return{assigned:assigned,current:currentUnit,previous:previousUnit,next:nextUnit,state:state};
}
function recentAccuracy(progress){
  if(!progress)return{attempts:0,count:0,accuracy:0};
  var recent=arr(progress.recent_results),count=recent.length,correct=recent.filter(function(v){return v===true;}).length;
  var attempts=Number(progress.attempts)||0;
  if(!count&&attempts>0){count=attempts;correct=Number(progress.correct)||0;}
  return{attempts:attempts,count:count,accuracy:count?correct/count:0};
}
function previewRatio(progress){
  var p=recentAccuracy(progress);
  if(p.attempts>=15&&p.count>=10&&p.accuracy>=0.85)return 0.40;
  if(p.attempts>=10&&p.count>=10&&p.accuracy>=0.70)return 0.20;
  return 0;
}

async function dailyAccessToken(){
  var api=global.WillenaAPI,token='';
  try{token=text(api&&api.getLocalAccessToken?api.getLocalAccessToken():localStorage.getItem('sb_access_token'));}catch(_){token='';}
  if(token)return token;
  if(api&&typeof api.fetch==='function'){
    try{
      var r=await api.fetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{cache:'no-store'});
      var d=await r.json().catch(function(){return{};});
      if(r.ok&&d&&d.success&&d.access_token){
        if(api.setLocalTokens)api.setLocalTokens(d.access_token,d.refresh_token||'');
        return text(d.access_token);
      }
    }catch(_){}
  }
  return '';
}

async function request(method,body){
  try{if(global.WillenaStudyV2AuthReady)await global.WillenaStudyV2AuthReady;}catch(_){}
  var token=await dailyAccessToken();
  var url=ENDPOINT+'?date='+encodeURIComponent(dateKey())+'&_='+Date.now();
  var opts={method:method,credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}};
  if(token)opts.headers.Authorization='Bearer '+token;
  if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
  var r=await fetch(url,opts),d=await r.json().catch(function(){return{};});
  if(!r.ok)throw new Error(d.error||('Daily Study request failed ('+r.status+')'));
  ingestProgress(d);
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
function sessionFrom(data){ingestProgress(data);if(data&&data.session){session=data.session;paint();return session;}return null;}
async function syncCard(){
  if(syncing)return syncing;
  syncing=(async function(){try{var data=await request('GET');if(data&&data.session)sessionFrom(data);else{session=null;paint();}return data;}catch(e){console.warn('[Daily Study] sync',e);return null;}finally{syncing=false;}})();
  return syncing;
}

function contextFor(book,unit){return{bookId:book.book_id,bookTitle:book.book_title,unitId:unit.id,unitNumber:Number(unit.unit_number)};}
async function loadUnitPool(book,unit,role,cursor){
  if(!book||!unit||!global.WillenaStudyQuestionBank)return[];
  var rows=await global.WillenaStudyQuestionBank.loadUnit(null,contextFor(book,unit)).catch(function(){return[];});
  return arr(rows).filter(validActivity).map(function(source){
    var a=clone(source),key=text(a.id),assigned=cursor.assigned,next=cursor.next,previous=cursor.previous;
    a.daily_key=key;
    a.metadata=Object.assign({},a.metadata||{}, {
      book_id:book.book_id,
      unit_id:unit.id,
      daily_mode:true,
      daily_key:key,
      daily_origin_id:key,
      daily_book_title:book.book_title,
      daily_unit_number:Number(unit.unit_number),
      daily_role:role,
      daily_source:role,
      daily_assignment_unit_id:assigned&&assigned.id||null,
      daily_assignment_unit_number:assigned?Number(assigned.unit_number):null,
      daily_cursor_unit_id:cursor.current.id,
      daily_cursor_unit_number:Number(cursor.current.unit_number),
      daily_previous_unit_id:previous&&previous.id||null,
      daily_previous_unit_number:previous?Number(previous.unit_number):null,
      daily_next_unit_id:next&&next.id||null,
      daily_next_unit_number:next?Number(next.unit_number):null,
      current_curriculum:role==='current'
    });
    return a;
  });
}
function skillBalancedQueue(rows){
  var by={};SKILLS.forEach(function(s){by[s]=[];});
  shuffle(rows).forEach(function(a){if(validActivity(a))by[a.skill].push(a);});
  SKILLS.forEach(function(s){by[s]=shuffle(by[s]);});
  var out=[],progress=true;
  while(progress){
    progress=false;
    SKILLS.forEach(function(s){if(by[s].length){out.push(by[s].shift());progress=true;}});
  }
  return out;
}
function weightedUnitQueue(currentRows,nextRows,previousRows,ratio){
  var queues={current:skillBalancedQueue(currentRows),next:skillBalancedQueue(nextRows),previous:skillBalancedQueue(previousRows)};
  var hasNext=queues.next.length>0&&ratio>0,hasPrevious=queues.previous.length>0,pattern;
  if(hasPrevious&&hasNext){pattern=ratio>=0.40?['current','next','current','next','previous']:['current','current','current','next','previous'];}
  else if(hasPrevious){pattern=['current','current','current','current','previous'];}
  else if(hasNext){pattern=ratio>=0.40?['current','next','current','next','current']:['current','current','current','current','next'];}
  else pattern=['current'];
  var out=[],used={},alive=true,step=0;
  while(alive&&out.length<MAX_CANDIDATES){
    alive=queues.current.length||queues.next.length||queues.previous.length;
    if(!alive)break;
    var role=pattern[step%pattern.length],item=null;
    step++;
    while(queues[role]&&queues[role].length&&!item){var candidate=queues[role].shift(),k=dailyKey(candidate);if(k&&!used[k])item=candidate;}
    if(!item){
      ['current','next','previous'].some(function(fallback){
        while(queues[fallback].length&&!item){var candidate=queues[fallback].shift(),k=dailyKey(candidate);if(k&&!used[k])item=candidate;}
        return !!item;
      });
    }
    if(item){used[dailyKey(item)]=true;out.push(item);}
  }
  return out;
}
async function loadDailyBookGroup(book){
  var cursor=dailyCursor(book);if(!cursor||!cursor.current)return{book:book,rows:[]};
  var progress=unitProgress(book.book_id,cursor.current.id),ratio=previewRatio(progress);
  var pools=await Promise.all([
    loadUnitPool(book,cursor.current,'current',cursor),
    cursor.next&&ratio>0?loadUnitPool(book,cursor.next,'next',cursor):Promise.resolve([]),
    cursor.previous?loadUnitPool(book,cursor.previous,'previous',cursor):Promise.resolve([])
  ]);
  var rows=weightedUnitQueue(pools[0],pools[1],pools[2],ratio);
  return{book:book,rows:rows,cursor:cursor,previewRatio:ratio};
}
function balancedCandidates(groups){
  var queues=groups.map(function(g){return arr(g.rows).slice();}),out=[],used={},progress=true;
  while(out.length<MAX_CANDIDATES&&progress){
    progress=false;
    for(var b=0;b<queues.length&&out.length<MAX_CANDIDATES;b++){
      var q=queues[b],item=null;
      while(q.length&&!item){var candidate=q.shift(),k=dailyKey(candidate);if(k&&!used[k])item=candidate;}
      if(item){used[dailyKey(item)]=true;out.push(item);progress=true;}
    }
  }
  return out;
}

async function buildPlan(){
  var h=home();
  if(!h||!h.books.length)throw new Error('Assigned books are still loading.');
  var books=h.books.filter(function(b){return b&&b.book_id&&arr(b.units).length;});
  if(!books.length)throw new Error('No study books are ready.');

  var groups=await Promise.all(books.map(loadDailyBookGroup));
  groups=groups.filter(function(g){return g.rows.length;});
  if(!groups.length)throw new Error('No Daily Study questions are available for the assigned learning path.');

  var plan=balancedCandidates(groups);
  if(plan.length<TARGET)throw new Error('Daily Study needs at least 20 unique questions across the assigned books.');
  return plan;
}

async function ensureSession(){
  var data=await request('GET');
  if(data&&data.session)return sessionFrom(data);
  if(!data||!data.needs_plan)throw new Error('Daily Study session could not be loaded.');
  var plan=await buildPlan(),created=await request('POST',{action:'create',plan:plan});
  if(!created||!created.session)throw new Error(created&&created.error||'Daily Study session could not be created.');
  return sessionFrom(created);
}
function currentItem(){if(!session||session.status==='completed')return null;var cursor=Number(session.cursor)||0,plan=arr(session.plan);return cursor>=0&&cursor<plan.length?clone(plan[cursor]):null;}
function setHeader(){if(skillEl)skillEl.textContent=langKo()?'오늘의 학습':'DAILY STUDY';if(titleEl)titleEl.textContent=langKo()?'오늘의 Daily Study':'Daily Study';if(countEl)countEl.textContent=resolvedCount()+' / '+TARGET;}
function sourceBadge(a){if(!root)return;var c=root.querySelector('.activity-card');if(!c)return;var old=c.querySelector('.activity-source-badge');if(old)old.remove();var m=a.metadata||{},b=document.createElement('div');b.className='activity-source-badge';b.textContent=(m.daily_book_title||'Study')+' · Unit '+(m.daily_unit_number||'');c.insertBefore(b,c.firstChild);}
function prepareActivity(item){var a=clone(item),key=dailyKey(a);a.daily_key=key;a.metadata=Object.assign({},a.metadata||{},{daily_mode:true,daily_date:dateKey(),daily_key:key,daily_origin_id:key,daily_target:TARGET});return a;}
function openShell(message){
  document.body.classList.add('study-v2-practice-mode','study-v2-daily-mode');
  if(panel)panel.hidden=false;
  if(skillEl)skillEl.textContent=langKo()?'오늘의 학습':'DAILY STUDY';
  if(titleEl)titleEl.textContent=langKo()?'오늘의 Daily Study':'Daily Study';
  if(countEl)countEl.textContent=resolvedCount()+' / '+TARGET;
  if(root)root.innerHTML='<div class="smart-finish"><h2>'+message+'</h2></div>';
  if(panel)panel.scrollTop=0;
}
function showError(error){
  console.warn('[Daily Study] open',error);
  openShell(langKo()?'Daily Study를 불러오지 못했습니다.':'Could not load Daily Study.');
  if(root)root.innerHTML='<div class="smart-finish"><h2>'+(langKo()?'Daily Study를 불러오지 못했습니다.':'Could not load Daily Study.')+'</h2><p>'+text(error&&error.message||error)+'</p><button id="v2DailyRetry" class="primary-button smart-home-button" type="button">'+(langKo()?'다시 시도':'Try again')+'</button></div>';
  var retry=document.getElementById('v2DailyRetry');if(retry)retry.addEventListener('click',open,{once:true});
}
function showCurrent(){
  paint();setHeader();
  if(!session)return;
  if(session.status==='completed'||resolvedCount()>=TARGET){finish();return;}
  var item=currentItem();
  if(!item){if(root)root.innerHTML='<div class="smart-finish"><h2>'+(langKo()?'오늘의 문제를 모두 사용했어요.':'Daily question pool exhausted.')+'</h2><p>'+(langKo()?'담당 선생님에게 알려 주세요.':'Please tell your teacher.')+'</p></div>';return;}
  current=prepareActivity(item);answerLocked=false;
  if(!global.WillenaActivityEngine)throw new Error('Activity engine is not ready.');
  if(!engine)engine=new global.WillenaActivityEngine(root,{onAnswer:function(){}});
  engine.setActivity(current);sourceBadge(current);if(panel)panel.scrollTop=0;
}
function replaceCheck(label,handler){var check=root&&root.querySelector('.activity-check');if(!check)return;var b=check.cloneNode(true);b.disabled=false;b.textContent=label;check.replaceWith(b);b.addEventListener('click',handler,{once:true});}
async function submitAnswer(correct){var key=dailyKey(current),data=await request('POST',{action:'answer',daily_key:key,correct:!!correct});if(data&&data.stale){sessionFrom(data);showCurrent();return;}if(!data||data.success===false)throw new Error(data&&data.error||'Daily answer was not saved.');sessionFrom(data);}
async function onAnswer(e){
  if(!document.body.classList.contains('study-v2-daily-mode')||!current||answerLocked)return;
  var d=e.detail||{},a=d.activity||{},r=d.result||{};
  if(String(a.id)!==String(current.id))return;
  answerLocked=true;
  try{
    await submitAnswer(!!r.correct);
    if(session&&session.status==='completed'){replaceCheck(langKo()?'완료':'Done',finish);return;}
    replaceCheck(langKo()?'계속':'Continue',showCurrent);
  }catch(error){
    console.warn('[Daily Study] answer save',error);answerLocked=false;
    var check=root&&root.querySelector('.activity-check');
    if(check){check.disabled=false;check.textContent=langKo()?'저장 다시 시도':'Retry save';}
  }
}
function finish(){if(session)session.status='completed';paint();openShell(langKo()?'잘했어요!':'Great work!');if(countEl)countEl.textContent=langKo()?'완료':'Done';if(titleEl)titleEl.textContent=langKo()?'오늘 목표 완료':'Daily goal complete';if(root)root.innerHTML='<div class="smart-finish"><div class="smart-confetti">✓</div><h2>'+(langKo()?'잘했어요!':'Great work!')+'</h2><p>'+(langKo()?'오늘의 20개 학습 목표를 모두 맞혔어요.':'You got all 20 Daily Study targets correct.')+'</p><button id="v2DailyHome" class="primary-button smart-home-button" type="button">'+(langKo()?'돌아가기':'Back to Study')+'</button></div>';var b=document.getElementById('v2DailyHome');if(b)b.addEventListener('click',close,{once:true});}
function close(){document.body.classList.remove('study-v2-practice-mode','study-v2-daily-mode');if(panel)panel.hidden=true;if(root)root.innerHTML='';current=null;engine=null;paint();window.scrollTo({top:0,behavior:'auto'});}
async function open(){
  if(loading)return;
  loading=true;
  openShell(langKo()?'Daily Study 불러오는 중…':'Loading Daily Study…');
  try{await ensureSession();showCurrent();}
  catch(e){showError(e);}
  finally{loading=false;}
}
function bind(){
  global.addEventListener('willena:activity-answer',onAnswer);
  global.addEventListener('focus',syncCard);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)syncCard();});
  var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(paint,0);});
  document.addEventListener('click',function(e){var x=e.target&&e.target.closest&&e.target.closest('#v2PracticeClose');if(x&&document.body.classList.contains('study-v2-daily-mode')){e.preventDefault();e.stopImmediatePropagation();close();}},true);
  paint();syncCard();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
global.WillenaStudyV2Daily={open:open,close:close,paint:paint,sync:syncCard,getSession:function(){return session;},getProgression:function(){return clone(progression);}};
})(window);