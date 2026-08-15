(function(global){
'use strict';

var TARGET=20;
var MAX_CANDIDATES=80;
var ENDPOINT='https://willena-proxy.willena.workers.dev/api/daily-study';
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var CACHE_PREFIX='willena-study-v2-home:v1:';
var SKILLS=['vocabulary','spelling','grammar','sentence_building','conversation','listening','reading'];
var IS_STAGING=typeof location!=='undefined'&&location.hostname==='staging.willenaenglish.com';
var TEST_MODE_KEY='willena-study-v2-daily-test-mode:v1';
var TEST_DAY_KEY='willena-study-v2-daily-test-day:v1';
var TEST_WEAK_KEY='willena-study-v2-daily-test-weak:v1';
var TEST_BASE_UTC=Date.UTC(2030,0,7);

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
var progression={bookStates:[],unitProgress:[],reviewItems:[]};
var bookMetaPromises={};
var lastPlanDiagnostics=[];
var testMode=IS_STAGING&&readBool(TEST_MODE_KEY,false);
var testDay=Math.max(1,readNumber(TEST_DAY_KEY,1));
var testDetailsOpen=false;
var testBusy=false;
var testMessage='';
var weakTargets=readWeakTargets();

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function clone(v){return JSON.parse(JSON.stringify(v));}
function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function cacheKey(){return CACHE_PREFIX+uid();}
function home(){try{var o=JSON.parse(localStorage.getItem(cacheKey())||'null');return o&&Array.isArray(o.books)?o:null;}catch(_){return null;}}
function langKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function shuffle(items){return arr(items).slice().sort(function(){return Math.random()-.5;});}
function readBool(key,fallback){try{var v=localStorage.getItem(key);return v==null?fallback:v==='1';}catch(_){return fallback;}}
function readNumber(key,fallback){try{var n=Number(localStorage.getItem(key));return Number.isFinite(n)&&n>0?n:fallback;}catch(_){return fallback;}}
function readWeakTargets(){try{var o=JSON.parse(localStorage.getItem(TEST_WEAK_KEY)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}catch(_){return{};}}
function persistTest(){try{localStorage.setItem(TEST_MODE_KEY,testMode?'1':'0');localStorage.setItem(TEST_DAY_KEY,String(testDay));localStorage.setItem(TEST_WEAK_KEY,JSON.stringify(weakTargets));}catch(_){}}
function realDateKey(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(_){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}}
function testDateKey(){return new Date(TEST_BASE_UTC+(testDay-1)*86400000).toISOString().slice(0,10);}
function activeDate(){return testMode?testDateKey():realDateKey();}
function activeTrack(){return testMode?'test':'live';}
function resolvedCount(){return Math.min(TARGET,arr(session&&session.resolved_keys).length);}
function validActivity(a){return a&&a.id&&SKILLS.indexOf(a.skill)>=0&&a.response&&a.stimulus;}
function dailyKey(a){return text(a&&a.daily_key||a&&a.id);}
function hashString(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

function emptyProgression(){progression={bookStates:[],unitProgress:[],reviewItems:[]};}
function ingestProgress(data){
  if(!data||typeof data!=='object')return;
  if(Array.isArray(data.book_states))progression.bookStates=data.book_states;
  if(Array.isArray(data.unit_progress))progression.unitProgress=data.unit_progress;
  if(Array.isArray(data.review_items))progression.reviewItems=data.review_items;
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
  if(sameAssignment&&state&&state.previous_unit_id)previousUnit=units.find(function(u){return String(u.id)===String(state.previous_unit_id);})||null;
  var nextUnit=idx>=0&&idx<units.length-1?units[idx+1]:null;
  return{assigned:assigned,current:currentUnit,previous:previousUnit,next:nextUnit,state:state,units:units,index:idx};
}
function recentAccuracy(progress){
  if(!progress)return{attempts:0,count:0,correct:0,accuracy:0,unique:0,studyDays:0};
  var recent=arr(progress.recent_results),count=recent.length,correct=recent.filter(function(v){return v===true;}).length;
  var attempts=Number(progress.attempts)||0;
  if(!count&&attempts>0){count=attempts;correct=Number(progress.correct)||0;}
  return{attempts:attempts,count:count,correct:correct,accuracy:count?correct/count:0,unique:arr(progress.seen_keys).length,studyDays:Number(progress.study_days)||0};
}
function paceConfig(type){
  if(type==='reading')return{type:'reading',label:'Reading',minDays:3,normalDays:5};
  if(type==='supplementary')return{type:'supplementary',label:'Supplementary',minDays:4,normalDays:7};
  return{type:'course',label:'Course',minDays:5,normalDays:10};
}
async function fetchBookMeta(book){
  var id=text(book&&book.book_id);if(!id)return{};
  if(bookMetaPromises[id])return bookMetaPromises[id];
  bookMetaPromises[id]=(async function(){
    try{
      var url=CONTENT_URL+'/rest/v1/content_books?id=eq.'+encodeURIComponent(id)+'&select=id,title,metadata&limit=1';
      var r=await fetch(url,{headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store'});
      if(!r.ok)return{};
      var rows=await r.json();return rows&&rows[0]||{};
    }catch(_){return{};}
  })();
  return bookMetaPromises[id];
}
async function resolvePace(book){
  var local=book&&book.metadata||{},raw=text(book&&book.daily_pace_type||book&&book.book_type||local.daily_study_pace||local.book_type).toLowerCase();
  if(!raw){var meta=await fetchBookMeta(book);var m=meta&&meta.metadata||{};raw=text(m.daily_study_pace||m.book_type).toLowerCase();}
  var type=raw==='reading'?'reading':raw==='supplementary'?'supplementary':'course';
  try{book._dailyPaceType=type;}catch(_){}
  return paceConfig(type);
}

async function dailyAccessToken(){
  var api=global.WillenaAPI,token='';
  try{token=text(api&&api.getLocalAccessToken?api.getLocalAccessToken():localStorage.getItem('sb_access_token'));}catch(_){token='';}
  if(token)return token;
  if(api&&typeof api.fetch==='function'){
    try{
      var r=await api.fetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{cache:'no-store'});
      var d=await r.json().catch(function(){return{};});
      if(r.ok&&d&&d.success&&d.access_token){if(api.setLocalTokens)api.setLocalTokens(d.access_token,d.refresh_token||'');return text(d.access_token);}
    }catch(_){}
  }
  return '';
}
async function request(method,body){
  try{if(global.WillenaStudyV2AuthReady)await global.WillenaStudyV2AuthReady;}catch(_){}
  var token=await dailyAccessToken();
  var url=ENDPOINT+'?date='+encodeURIComponent(activeDate())+'&track='+encodeURIComponent(activeTrack())+'&_='+Date.now();
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
  if(title)title.textContent=testMode?'TEST · Daily Study':(langKo()?'오늘의 학습':'Daily Study');
  if(copy){
    if(testMode)copy.textContent='Test Day '+testDay+' · '+done+'/'+TARGET;
    else copy.textContent=done>=TARGET?(langKo()?'오늘 목표 완료 ✓':'Daily goal complete ✓'):(langKo()?'오늘 목표 · '+done+'/'+TARGET:'Today · '+done+'/'+TARGET);
  }
}
function sessionFrom(data){ingestProgress(data);if(data&&data.session){session=data.session;paint();return session;}return null;}
async function syncCard(){
  if(syncing)return syncing;
  syncing=(async function(){
    try{var data=await request('GET');if(data&&data.session)sessionFrom(data);else{session=null;paint();}if(IS_STAGING)renderTestPanel();return data;}
    catch(e){console.warn('[Daily Study] sync',e);if(IS_STAGING){testMessage=e.message;renderTestPanel();}return null;}
    finally{syncing=false;}
  })();
  return syncing;
}

function contextFor(book,unit){return{bookId:book.book_id,bookTitle:book.book_title,unitId:unit.id,unitNumber:Number(unit.unit_number)};}
function metadataBase(book,unit,role,cursor,pace,mix){
  return{
    book_id:book.book_id,
    unit_id:unit.id,
    daily_mode:true,
    daily_book_title:book.book_title,
    daily_unit_number:Number(unit.unit_number),
    daily_role:role,
    daily_source:role,
    daily_assignment_unit_id:cursor.assigned&&cursor.assigned.id||null,
    daily_assignment_unit_number:cursor.assigned?Number(cursor.assigned.unit_number):null,
    daily_cursor_unit_id:cursor.current.id,
    daily_cursor_unit_number:Number(cursor.current.unit_number),
    daily_previous_unit_id:cursor.previous&&cursor.previous.id||null,
    daily_previous_unit_number:cursor.previous?Number(cursor.previous.unit_number):null,
    daily_next_unit_id:cursor.next&&cursor.next.id||null,
    daily_next_unit_number:cursor.next?Number(cursor.next.unit_number):null,
    daily_pace_type:pace.type,
    daily_pace_min_days:pace.minDays,
    daily_pace_normal_days:pace.normalDays,
    daily_unit_day:mix.unitDay,
    daily_book_day:mix.bookDay,
    daily_review_day:!!mix.reviewDay,
    daily_mix_current:mix.current,
    daily_mix_review:mix.review,
    daily_mix_preview:mix.next,
    current_curriculum:role==='current'
  };
}
async function loadUnitPool(book,unit,role,cursor,pace,mix){
  if(!book||!unit||!global.WillenaStudyQuestionBank)return[];
  var rows=await global.WillenaStudyQuestionBank.loadUnit(null,contextFor(book,unit)).catch(function(){return[];});
  return arr(rows).filter(validActivity).map(function(source){
    var a=clone(source),key=text(a.id);
    a.daily_key=key;
    a.metadata=Object.assign({},a.metadata||{},metadataBase(book,unit,role,cursor,pace,mix),{
      daily_key:key,
      daily_origin_id:key,
      daily_reason:role==='next'?'next-unit preview':role==='review'?'spaced review':'current unit'
    });
    return a;
  });
}
function candidateScore(info,nextBookDay){
  if(!info)return 0;
  var due=Number(info.next_due_study_day)||0,lapses=Number(info.lapses)||0,attempts=Number(info.attempts)||0,correct=Number(info.correct)||0;
  var misses=Math.max(0,attempts-correct),overdue=Math.max(0,nextBookDay-due);
  return lapses*100+misses*25+overdue*10-Math.min(20,Number(info.streak)||0);
}
function pastUnitSet(cursor){var out={};for(var i=0;i<cursor.index;i++)out[String(cursor.units[i].id)]=true;return out;}
function historicalReviewRecords(book,cursor,nextBookDay){
  var past=pastUnitSet(cursor);
  return progression.reviewItems.filter(function(x){return String(x.book_id)===String(book.book_id)&&past[String(x.unit_id)];}).sort(function(a,b){
    return candidateScore(b,nextBookDay)-candidateScore(a,nextBookDay);
  }).slice(0,48);
}
function currentPriorityMap(book,cursor,nextBookDay){
  var map={};progression.reviewItems.forEach(function(x){
    if(String(x.book_id)===String(book.book_id)&&String(x.unit_id)===String(cursor.current.id))map[String(x.daily_key)]=candidateScore(x,nextBookDay);
  });return map;
}
async function loadHistoricalReviewPool(book,cursor,pace,mix,records){
  if(!records.length)return[];
  var unitsById={},chosen=[];
  records.forEach(function(r){
    var id=String(r.unit_id);if(unitsById[id])return;
    var unit=cursor.units.find(function(u){return String(u.id)===id;});
    if(unit&&chosen.length<6){unitsById[id]=unit;chosen.push(unit);}
  });
  var pools=await Promise.all(chosen.map(function(unit){return loadUnitPool(book,unit,'review',cursor,pace,mix);}));
  var activityByKey={};pools.forEach(function(rows){rows.forEach(function(a){activityByKey[dailyKey(a)]=a;});});
  var out=[];
  records.forEach(function(info){
    var a=activityByKey[String(info.daily_key)];if(!a)return;
    a=clone(a);a.metadata=Object.assign({},a.metadata||{}, {
      daily_reason:Number(info.lapses)>0?'weak-point review':'spaced review',
      daily_review_lapses:Number(info.lapses)||0,
      daily_review_streak:Number(info.streak)||0,
      daily_review_due_day:Number(info.next_due_study_day)||0,
      daily_review_last_seen_day:Number(info.last_seen_study_day)||0
    });
    out.push(a);
  });
  return out;
}
function mixForBook(cursor,pace,progress,hasReview){
  var state=cursor.state,p=recentAccuracy(progress);
  var unitDay=(state?Number(state.current_unit_study_days)||0:0)+1;
  var bookDay=(state?Number(state.total_study_days)||0:0)+1;
  var reviewDay=bookDay>1&&bookDay%5===0&&hasReview;
  var review=hasReview?0.25:0,next=0,currentPct=0;
  if(reviewDay){review=0.60;next=0;currentPct=0.40;}
  else if(p.count>=10&&p.accuracy<0.72){review=hasReview?0.25:0;next=0;currentPct=1-review;}
  else{
    var previewStart=Math.max(2,pace.minDays-1);
    if(cursor.next&&p.count>=10){
      if(unitDay>=pace.normalDays-1&&p.accuracy>=0.90)next=0.25;
      else if(unitDay>=pace.minDays&&p.accuracy>=0.90)next=0.20;
      else if(unitDay>=previewStart&&p.accuracy>=0.85)next=0.10;
    }
    currentPct=Math.max(0.40,1-review-next);
    var total=currentPct+review+next;if(total!==1&&total>0){currentPct/=total;review/=total;next/=total;}
  }
  return{current:currentPct,review:review,next:next,unitDay:unitDay,bookDay:bookDay,reviewDay:reviewDay,performance:p};
}
function skillBalancedQueue(rows,priorityMap){
  var by={};SKILLS.forEach(function(s){by[s]=[];});
  rows.slice().sort(function(a,b){return (priorityMap[dailyKey(b)]||0)-(priorityMap[dailyKey(a)]||0)||Math.random()-.5;}).forEach(function(a){if(validActivity(a))by[a.skill].push(a);});
  var out=[],progress=true;
  while(progress){progress=false;SKILLS.forEach(function(s){if(by[s].length){out.push(by[s].shift());progress=true;}});}
  return out;
}
function rolePattern(mix){
  var roles=['current','review','next'],weights={current:mix.current,review:mix.review,next:mix.next},counts={current:0,review:0,next:0},out=[];
  for(var i=0;i<40;i++){
    var best=null,bestNeed=-Infinity;
    roles.forEach(function(role){if(weights[role]<=0)return;var need=weights[role]*(i+1)-counts[role];if(need>bestNeed){bestNeed=need;best=role;}});
    if(!best)best='current';counts[best]++;out.push(best);
  }
  return out;
}
function weightedBookQueue(currentRows,reviewRows,nextRows,mix,priorityMap){
  var queues={current:skillBalancedQueue(currentRows,priorityMap),review:reviewRows.slice(),next:skillBalancedQueue(nextRows,{})};
  var pattern=rolePattern(mix),out=[],used={},step=0,alive=true;
  while(alive&&out.length<MAX_CANDIDATES){
    alive=queues.current.length||queues.review.length||queues.next.length;if(!alive)break;
    var role=pattern[step%pattern.length],item=null;step++;
    while(queues[role]&&queues[role].length&&!item){var c=queues[role].shift(),k=dailyKey(c);if(k&&!used[k])item=c;}
    if(!item){['current','review','next'].some(function(fallback){while(queues[fallback].length&&!item){var c=queues[fallback].shift(),k=dailyKey(c);if(k&&!used[k])item=c;}return !!item;});}
    if(item){used[dailyKey(item)]=true;out.push(item);}
  }
  return out;
}
async function loadDailyBookGroup(book){
  var cursor=dailyCursor(book);if(!cursor||!cursor.current)return{book:book,rows:[]};
  var pace=await resolvePace(book),state=cursor.state;
  var nextBookDay=(state?Number(state.total_study_days)||0:0)+1;
  var records=historicalReviewRecords(book,cursor,nextBookDay);
  var progress=unitProgress(book.book_id,cursor.current.id);
  var mix=mixForBook(cursor,pace,progress,records.length>0);
  var pools=await Promise.all([
    loadUnitPool(book,cursor.current,'current',cursor,pace,mix),
    cursor.next&&mix.next>0?loadUnitPool(book,cursor.next,'next',cursor,pace,mix):Promise.resolve([]),
    loadHistoricalReviewPool(book,cursor,pace,mix,records)
  ]);
  var priority=currentPriorityMap(book,cursor,mix.bookDay);
  var rows=weightedBookQueue(pools[0],pools[2],pools[1],mix,priority);
  return{book:book,rows:rows,cursor:cursor,pace:pace,mix:mix,reviewCount:pools[2].length};
}
function balancedCandidates(groups){
  var queues=groups.map(function(g){return arr(g.rows).slice();}),out=[],used={},progress=true;
  while(out.length<MAX_CANDIDATES&&progress){
    progress=false;
    for(var b=0;b<queues.length&&out.length<MAX_CANDIDATES;b++){
      var q=queues[b],item=null;
      while(q.length&&!item){var c=q.shift(),k=dailyKey(c);if(k&&!used[k])item=c;}
      if(item){used[dailyKey(item)]=true;out.push(item);progress=true;}
    }
  }
  return out;
}
async function buildPlan(){
  var h=home();if(!h||!h.books.length)throw new Error('Assigned books are still loading.');
  var books=h.books.filter(function(b){return b&&b.book_id&&arr(b.units).length;});if(!books.length)throw new Error('No study books are ready.');
  var groups=await Promise.all(books.map(loadDailyBookGroup));groups=groups.filter(function(g){return g.rows.length;});
  if(!groups.length)throw new Error('No Daily Study questions are available for the assigned learning path.');
  lastPlanDiagnostics=groups.map(function(g){return{bookId:g.book.book_id,title:g.book.book_title,cursor:g.cursor,pace:g.pace,mix:g.mix,reviewCount:g.reviewCount};});
  var plan=balancedCandidates(groups);if(plan.length<TARGET)throw new Error('Daily Study needs at least 20 unique questions across the assigned books.');
  return plan;
}
async function ensureSession(){
  var data=await request('GET');
  if(data&&data.session)return sessionFrom(data);
  if(!data||!data.needs_plan)throw new Error('Daily Study session could not be loaded.');
  var plan=await buildPlan(),created=await request('POST',{action:'create',plan:plan});
  if(!created||!created.session)throw new Error(created&&created.error||'Daily Study session could not be created.');
  var result=sessionFrom(created);if(IS_STAGING)renderTestPanel();return result;
}
function currentItem(){if(!session||session.status==='completed')return null;var cursor=Number(session.cursor)||0,plan=arr(session.plan);return cursor>=0&&cursor<plan.length?clone(plan[cursor]):null;}

function setHeader(){if(skillEl)skillEl.textContent=testMode?'TEST DAILY STUDY':(langKo()?'오늘의 학습':'DAILY STUDY');if(titleEl)titleEl.textContent=testMode?'Daily Study Test · Day '+testDay:(langKo()?'오늘의 Daily Study':'Daily Study');if(countEl)countEl.textContent=resolvedCount()+' / '+TARGET;}
function roleLabel(m){var role=m.daily_role||'current';if(role==='review')return Number(m.daily_review_lapses)>0?'WEAK-POINT REVIEW':'SPACED REVIEW';if(role==='next')return'NEXT-UNIT PREVIEW';return'CURRENT';}
function sourceBadge(a){
  if(!root)return;var c=root.querySelector('.activity-card');if(!c)return;var old=c.querySelector('.activity-source-badge');if(old)old.remove();var oldWeak=c.querySelector('.v2-daily-test-weak');if(oldWeak)oldWeak.remove();
  var m=a.metadata||{},b=document.createElement('div');b.className='activity-source-badge';
  if(testMode){
    var extra=roleLabel(m)+' · '+(m.daily_pace_type||'course')+' · unit day '+(m.daily_unit_day||'?');
    if(m.daily_role==='review'&&m.daily_review_lapses)extra+=' · missed '+m.daily_review_lapses+'x';
    b.textContent=(m.daily_book_title||'Study')+' · Unit '+(m.daily_unit_number||'')+' · '+extra;
  }else b.textContent=(m.daily_book_title||'Study')+' · Unit '+(m.daily_unit_number||'');
  c.insertBefore(b,c.firstChild);
  if(testMode&&IS_STAGING){
    var key=dailyKey(a),w=document.createElement('button');w.type='button';w.className='v2-daily-test-weak';w.textContent=weakTargets[key]?'Weak target ✓':'Make this weak';
    w.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(weakTargets[key])delete weakTargets[key];else weakTargets[key]=true;persistTest();sourceBadge(a);renderTestPanel();});
    c.insertBefore(w,b.nextSibling);
  }
}
function prepareActivity(item){var a=clone(item),key=dailyKey(a);a.daily_key=key;a.metadata=Object.assign({},a.metadata||{},{daily_mode:true,daily_date:activeDate(),daily_track:activeTrack(),daily_test_mode:!!testMode,daily_key:key,daily_origin_id:key,daily_target:TARGET});return a;}
function openShell(message){document.body.classList.add('study-v2-practice-mode','study-v2-daily-mode');if(panel)panel.hidden=false;setHeader();if(root)root.innerHTML='<div class="smart-finish"><h2>'+message+'</h2></div>';if(panel)panel.scrollTop=0;}
function showError(error){console.warn('[Daily Study] open',error);openShell(langKo()?'Daily Study를 불러오지 못했습니다.':'Could not load Daily Study.');if(root)root.innerHTML='<div class="smart-finish"><h2>'+(langKo()?'Daily Study를 불러오지 못했습니다.':'Could not load Daily Study.')+'</h2><p>'+text(error&&error.message||error)+'</p><button id="v2DailyRetry" class="primary-button smart-home-button" type="button">'+(langKo()?'다시 시도':'Try again')+'</button></div>';var retry=document.getElementById('v2DailyRetry');if(retry)retry.addEventListener('click',open,{once:true});}
function showCurrent(){
  paint();setHeader();if(!session)return;if(session.status==='completed'||resolvedCount()>=TARGET){finish();return;}
  var item=currentItem();if(!item){if(root)root.innerHTML='<div class="smart-finish"><h2>'+(langKo()?'오늘의 문제를 모두 사용했어요.':'Daily question pool exhausted.')+'</h2><p>'+(langKo()?'담당 선생님에게 알려 주세요.':'Please tell your teacher.')+'</p></div>';return;}
  current=prepareActivity(item);answerLocked=false;if(!global.WillenaActivityEngine)throw new Error('Activity engine is not ready.');if(!engine)engine=new global.WillenaActivityEngine(root,{onAnswer:function(){}});engine.setActivity(current);sourceBadge(current);if(panel)panel.scrollTop=0;
}
function replaceCheck(label,handler){var check=root&&root.querySelector('.activity-check');if(!check)return;var b=check.cloneNode(true);b.disabled=false;b.textContent=label;check.replaceWith(b);b.addEventListener('click',handler,{once:true});}
async function submitAnswer(correct){var key=dailyKey(current),data=await request('POST',{action:'answer',daily_key:key,correct:!!correct});if(data&&data.stale){sessionFrom(data);showCurrent();return;}if(!data||data.success===false)throw new Error(data&&data.error||'Daily answer was not saved.');sessionFrom(data);if(IS_STAGING)renderTestPanel();}
async function onAnswer(e){
  if(!document.body.classList.contains('study-v2-daily-mode')||!current||answerLocked)return;
  var d=e.detail||{},a=d.activity||{},r=d.result||{};if(String(a.id)!==String(current.id))return;answerLocked=true;
  try{await submitAnswer(!!r.correct);if(session&&session.status==='completed'){replaceCheck(langKo()?'완료':'Done',finish);return;}replaceCheck(langKo()?'계속':'Continue',showCurrent);}
  catch(error){console.warn('[Daily Study] answer save',error);answerLocked=false;var check=root&&root.querySelector('.activity-check');if(check){check.disabled=false;check.textContent=langKo()?'저장 다시 시도':'Retry save';}}
}
function finish(){if(session)session.status='completed';paint();openShell(testMode?'Test day complete ✓':(langKo()?'잘했어요!':'Great work!'));if(countEl)countEl.textContent=testMode?'Test Day '+testDay+' complete':(langKo()?'완료':'Done');if(titleEl)titleEl.textContent=testMode?'Daily Study Test':(langKo()?'오늘 목표 완료':'Daily goal complete');if(root)root.innerHTML='<div class="smart-finish"><div class="smart-confetti">✓</div><h2>'+(testMode?'Test day complete!':(langKo()?'잘했어요!':'Great work!'))+'</h2><p>'+(testMode?'Use the staging test panel to inspect the state or move to the next study day.':(langKo()?'오늘의 20개 학습 목표를 모두 맞혔어요.':'You got all 20 Daily Study targets correct.'))+'</p><button id="v2DailyHome" class="primary-button smart-home-button" type="button">'+(langKo()?'돌아가기':'Back to Study')+'</button></div>';var b=document.getElementById('v2DailyHome');if(b)b.addEventListener('click',close,{once:true});if(IS_STAGING)renderTestPanel();}
function close(){document.body.classList.remove('study-v2-practice-mode','study-v2-daily-mode');if(panel)panel.hidden=true;if(root)root.innerHTML='';current=null;engine=null;paint();if(IS_STAGING)renderTestPanel();window.scrollTo({top:0,behavior:'auto'});}
async function open(){if(loading)return;loading=true;openShell(testMode?'Loading test Daily Study…':(langKo()?'Daily Study 불러오는 중…':'Loading Daily Study…'));try{await ensureSession();showCurrent();}catch(e){showError(e);}finally{loading=false;}}

function planStats(){
  var rows=arr(session&&session.plan).slice(0,TARGET),by={};
  rows.forEach(function(a){var m=a.metadata||{},id=String(m.book_id||'unknown'),role=m.daily_role||'current';if(!by[id])by[id]={title:m.daily_book_title||'Study',current:0,review:0,next:0,total:0};if(role==='review')by[id].review++;else if(role==='next')by[id].next++;else by[id].current++;by[id].total++;});
  return by;
}
function testStateRows(){
  var h=home(),books=h&&h.books||[],stats=planStats();
  return books.map(function(book){
    var cursor=dailyCursor(book);if(!cursor||!cursor.current)return null;var state=cursor.state||{},pace=paceConfig(state.pace_type||book._dailyPaceType||'course'),p=recentAccuracy(unitProgress(book.book_id,cursor.current.id));
    return{book:book,cursor:cursor,state:state,pace:pace,p:p,stats:stats[String(book.book_id)]||null};
  }).filter(Boolean);
}
function testPanelHtml(){
  var mode=testMode?'ON':'OFF',disabled=testMode?'':' disabled',rows=testStateRows(),weakCount=Object.keys(weakTargets).length;
  var cards=rows.length?rows.map(function(r){
    var unitDay=Number(r.state.current_unit_study_days)||0,acc=r.p.count?Math.round(r.p.accuracy*100)+'%':'—',s=r.stats;
    var mix=s?('Today: '+s.current+' current · '+s.review+' review · '+s.next+' preview'):'Plan not generated yet';
    var flag=r.state.attention_needed?' · ⚠ support flag':'';
    return '<div class="v2-daily-test-state"><strong>'+escapeHtml(r.book.book_title||'Book')+'</strong><span>'+escapeHtml(r.pace.label)+' · Current Unit '+escapeHtml(r.cursor.current.unit_number)+' · unit day '+unitDay+'</span><span>Recent accuracy '+acc+' · earliest '+r.pace.minDays+' days · normal '+r.pace.normalDays+' days'+flag+'</span><span>'+escapeHtml(mix)+'</span></div>';
  }).join(''):'<div class="v2-daily-test-state"><span>Daily Study books are still loading.</span></div>';
  var details='';
  if(testDetailsOpen){
    details='<div class="v2-daily-test-details">'+rows.map(function(r){
      var review=historicalReviewRecords(r.book,r.cursor,(Number(r.state.total_study_days)||0)+1).slice(0,8);
      return '<div><strong>'+escapeHtml(r.book.book_title||'Book')+'</strong><br>book study days: '+(Number(r.state.total_study_days)||0)+' · unit attempts: '+r.p.attempts+' · unique items: '+r.p.unique+' · due/weak historical items: '+review.length+'<br>cursor: Unit '+escapeHtml(r.cursor.current.unit_number)+(r.cursor.next?' → preview Unit '+escapeHtml(r.cursor.next.unit_number):'')+'</div>';
    }).join('')+'</div>';
  }
  return '<div class="v2-daily-test-head"><div><strong>Daily Study algorithm tester</strong><small>Isolated test data · simulated study days</small></div><button data-test-action="toggle" type="button">Test mode '+mode+'</button></div>'+
    '<div class="v2-daily-test-controls">'+
      '<button data-test-action="reset" type="button"'+disabled+'>Reset</button>'+
      '<button data-test-action="next" type="button"'+disabled+'>Next study day</button>'+
      '<button data-test-action="strong" type="button"'+disabled+'>Run strong day · 95%</button>'+
      '<button data-test-action="average" type="button"'+disabled+'>Run average day · 84%</button>'+
      '<button data-test-action="slow" type="button"'+disabled+'>Run slow day · 65%</button>'+
      '<button data-test-action="details" type="button"'+disabled+'>'+(testDetailsOpen?'Hide':'Show')+' algorithm state</button>'+
      '<button data-test-action="clearweak" type="button"'+disabled+'>Clear weak targets ('+weakCount+')</button>'+
    '</div>'+
    '<div class="v2-daily-test-meta"><span>Simulated day <strong>'+testDay+'</strong></span><span>Date '+testDateKey()+'</span><span>'+escapeHtml(testMessage|| (testBusy?'Working…':'Ready'))+'</span></div>'+cards+details;
}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function ensureTestPanel(){
  if(!IS_STAGING)return null;var el=document.getElementById('v2DailyTestPanel');if(el)return el;var app=document.getElementById('app');if(!app)return null;el=document.createElement('section');el.id='v2DailyTestPanel';el.className='v2-daily-test-panel';app.insertBefore(el,app.firstChild);return el;
}
function renderTestPanel(){
  if(!IS_STAGING)return;var el=ensureTestPanel();if(!el)return;el.innerHTML=testPanelHtml();el.querySelectorAll('[data-test-action]').forEach(function(btn){btn.addEventListener('click',function(){handleTestAction(btn.dataset.testAction);});});
}
async function setTestMode(on){
  if(!IS_STAGING)return;testMode=!!on;session=null;current=null;engine=null;emptyProgression();testMessage=testMode?'Test track active':'Live Daily Study active';persistTest();paint();renderTestPanel();await syncCard();
}
async function resetTest(){
  if(!testMode||testBusy)return;testBusy=true;testMessage='Resetting isolated test data…';renderTestPanel();
  try{await request('POST',{action:'test_reset'});testDay=1;session=null;emptyProgression();weakTargets={};persistTest();testMessage='Reset complete · generating Day 1';await ensureSession();testMessage='Day 1 ready';}
  catch(e){testMessage=e.message;}finally{testBusy=false;paint();renderTestPanel();}
}
async function nextTestDay(){
  if(!testMode||testBusy)return;if(session&&session.status!=='completed'){testMessage='Finish or simulate the current test day first.';renderTestPanel();return;}
  testBusy=true;testDay++;session=null;current=null;engine=null;persistTest();testMessage='Generating test Day '+testDay+'…';renderTestPanel();
  try{await syncCard();await ensureSession();testMessage='Test Day '+testDay+' ready';}catch(e){testMessage=e.message;}finally{testBusy=false;paint();renderTestPanel();}
}
function simulatedCorrect(profile,item,index){
  var key=dailyKey(item);if(weakTargets[key])return false;var rate=profile==='strong'?95:profile==='average'?84:65;var seed=hashString(key+'|'+testDay+'|'+index+'|'+profile)%100;return seed<rate;
}
async function simulateTestDay(profile){
  if(!testMode||testBusy)return;testBusy=true;testMessage='Running '+profile+' student simulation…';renderTestPanel();
  try{
    await ensureSession();var guard=0;
    while(session&&session.status!=='completed'&&guard<MAX_CANDIDATES){
      var item=currentItem();if(!item)break;var correct=simulatedCorrect(profile,item,guard);var data=await request('POST',{action:'answer',daily_key:dailyKey(item),correct:correct});sessionFrom(data);guard++;
    }
    if(!session||session.status!=='completed')throw new Error('Simulation exhausted the candidate pool before 20 correct answers.');
    testMessage=profile+' simulation complete · '+guard+' questions used';paint();if(document.body.classList.contains('study-v2-daily-mode'))finish();
  }catch(e){testMessage=e.message;}finally{testBusy=false;renderTestPanel();}
}
async function handleTestAction(action){
  if(testBusy&&action!=='details')return;
  if(action==='toggle'){await setTestMode(!testMode);return;}
  if(action==='reset'){await resetTest();return;}
  if(action==='next'){await nextTestDay();return;}
  if(action==='strong'||action==='average'||action==='slow'){await simulateTestDay(action);return;}
  if(action==='details'){testDetailsOpen=!testDetailsOpen;renderTestPanel();return;}
  if(action==='clearweak'){weakTargets={};persistTest();testMessage='Weak targets cleared';renderTestPanel();return;}
}

function bind(){
  global.addEventListener('willena:activity-answer',onAnswer);
  global.addEventListener('focus',syncCard);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)syncCard();});
  var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(paint,0);});
  document.addEventListener('click',function(e){var x=e.target&&e.target.closest&&e.target.closest('#v2PracticeClose');if(x&&document.body.classList.contains('study-v2-daily-mode')){e.preventDefault();e.stopImmediatePropagation();close();}},true);
  paint();if(IS_STAGING)renderTestPanel();syncCard();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
global.WillenaStudyV2Daily={
  open:open,close:close,paint:paint,sync:syncCard,getSession:function(){return session;},getProgression:function(){return clone(progression);},
  isTestMode:function(){return testMode;},testDay:function(){return testDay;},resetTest:resetTest,nextTestDay:nextTestDay,simulateTestDay:simulateTestDay
};
})(window);
