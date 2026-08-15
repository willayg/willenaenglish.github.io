(function(global){
'use strict';

var CACHE_PREFIX='willena-study-v2-home:v1:';
var RUNNABLE=['vocabulary','spelling','grammar','sentence_building','conversation','listening','reading'];
var KO={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
var EN={vocabulary:'Vocabulary',spelling:'Spelling',grammar:'Grammar',sentence_building:'Sentence Builder',conversation:'Conversation',listening:'Listening',reading:'Reading'};
var refreshTimer=0;
var refreshing=false;
var rendering=false;
var lastCandidates=[];
var lastSnapshot=null;
var observer=null;

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function labels(){return isKo()?KO:EN;}
function cache(){try{var id=uid();if(!id)return null;var o=JSON.parse(localStorage.getItem(CACHE_PREFIX+id)||'null');return o&&Array.isArray(o.books)?o:null;}catch(_){return null;}}
function nowMs(){return Date.now();}
function dateMs(v){var n=Date.parse(v||'');return Number.isFinite(n)?n:0;}
function unitNumber(unit){return Number(unit&&unit.unit_number)||0;}
function bookTitle(book){return text(book&&book.book_title||book&&book.title||'Book');}
function assignmentUnit(book){
  var units=arr(book&&book.units),hint=text(book&&book.current_unit||book&&book.starting_unit),num=(hint.match(/\d+/)||[])[0];
  return units.find(function(u){return String(u.id)===hint||(num&&String(u.unit_number)===String(num));})||book.currentUnit||units[0]||null;
}
function skillLabel(skill){return labels()[skill]||skill;}
function api(path){
  var fn=global.WillenaAPI&&typeof global.WillenaAPI.fetch==='function'?global.WillenaAPI.fetch.bind(global.WillenaAPI):fetch;
  return fn(path,{credentials:'include',cache:'no-store'}).then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok||d&&d.success===false)throw new Error(d&&d.error||('Request failed ('+r.status+')'));return d;});});
}
function fetchProgress(){return api('/.netlify/functions/progress_summary?section=study_progress&_='+Date.now());}
function fetchAdaptive(){return api('/.netlify/functions/progress_summary?section=adaptive_state&_='+Date.now());}

function liveDailyStates(){
  var out={};
  try{
    var daily=global.WillenaStudyV2Daily;
    if(!daily||typeof daily.getProgression!=='function')return out;
    if(typeof daily.isTestMode==='function'&&daily.isTestMode())return out;
    var p=daily.getProgression()||{};
    arr(p.bookStates).forEach(function(s){if(s&&s.book_id)out[String(s.book_id)]=s;});
  }catch(_){}
  return out;
}

function key(bookId,unitId,skill){return String(bookId)+'|'+String(unitId)+'|'+String(skill);}
function buildStats(records,adaptiveItems){
  var by={};
  function rowFor(bookId,unitId,skill){
    var k=key(bookId,unitId,skill);
    if(!by[k])by[k]={bookId:String(bookId),unitId:String(unitId),skill:String(skill),attempts:0,correct:0,unique:0,lapses:0,due:0,weightedMastery:0,weight:0,lastSeen:0,items:{}};
    return by[k];
  }
  arr(records).forEach(function(r){
    if(!r||!r.book_id||!r.unit_id||RUNNABLE.indexOf(String(r.skill))<0)return;
    var s=rowFor(r.book_id,r.unit_id,r.skill),itemKey=String(r.content_type||'')+':'+String(r.content_id||'');
    if(s.items[itemKey])return;
    s.items[itemKey]=true;s.unique++;
    var attempts=Math.max(0,Number(r.attempts)||0),correct=Math.max(0,Number(r.correct)||0),mastery=clamp(r.mastery_score,0,100),w=Math.max(1,attempts);
    s.attempts+=attempts;s.correct+=correct;s.lapses+=Math.max(0,Number(r.lapses)||0);s.weightedMastery+=mastery*w;s.weight+=w;s.lastSeen=Math.max(s.lastSeen,dateMs(r.last_seen_at));
    if(r.due===true||(r.next_due_at&&dateMs(r.next_due_at)<=nowMs()))s.due++;
  });
  arr(adaptiveItems).forEach(function(r){
    if(!r||!r.book_id||!r.unit_id||RUNNABLE.indexOf(String(r.skill))<0)return;
    var s=rowFor(r.book_id,r.unit_id,r.skill),itemKey=String(r.content_type||'')+':'+String(r.content_id||'');
    if(!s.items[itemKey]){
      s.items[itemKey]=true;s.unique++;
      var mastery=clamp(r.mastery_score,0,100);s.weightedMastery+=mastery;s.weight+=1;s.lapses+=Math.max(0,Number(r.lapses)||0);
    }
    if(r.due===true||(r.next_due_at&&dateMs(r.next_due_at)<=nowMs()))s.due=Math.max(s.due,1);
  });
  Object.keys(by).forEach(function(k){var s=by[k];s.mastery=s.weight?Math.round(s.weightedMastery/s.weight):0;s.accuracy=s.attempts?Math.round(s.correct/s.attempts*100):null;delete s.items;delete s.weightedMastery;delete s.weight;});
  return by;
}

function resolveDailyUnit(book,dailyStates){
  var state=dailyStates[String(book.book_id)]||null,units=arr(book.units),u=null;
  if(state&&state.current_unit_id)u=units.find(function(x){return String(x.id)===String(state.current_unit_id);})||null;
  return{state:state,unit:u||assignmentUnit(book)};
}
function unitSkillRows(stats,bookId,unitId){return Object.keys(stats).map(function(k){return stats[k];}).filter(function(s){return String(s.bookId)===String(bookId)&&String(s.unitId)===String(unitId);});}
function averageMastery(rows){if(!rows.length)return 0;var w=0,total=0;rows.forEach(function(s){var weight=Math.max(1,s.attempts||s.unique||1);total+=s.mastery*weight;w+=weight;});return w?Math.round(total/w):0;}
function daysSince(ms){return ms?Math.max(0,Math.floor((nowMs()-ms)/86400000)):999;}

function candidateCopy(c){
  var ko=isKo(),skill=skillLabel(c.skill),unit='Unit '+c.unitNumber;
  if(c.type==='weak'){
    if(ko)return{kick:c.bookTitle+' · '+unit+' · '+skill,title:skill+' 약한 부분 집중',copy:(c.lapses?c.lapses+'번 다시 틀린 항목이 있어요. ':'')+'현재 숙련도 '+c.mastery+'%'+(c.due?' · 복습할 항목 '+c.due+'개':'')+'.',action:'집중 연습 →'};
    return{kick:c.bookTitle+' · '+unit+' · '+skill,title:'Strengthen '+skill,copy:(c.lapses?c.lapses+' repeat miss'+(c.lapses===1?'':'es')+'. ':'')+'Current mastery '+c.mastery+'%'+(c.due?' · '+c.due+' review item'+(c.due===1?'':'s')+' due':'')+'.',action:'Targeted practice →'};
  }
  if(c.type==='due'){
    if(ko)return{kick:c.bookTitle+' · '+unit+' · '+skill,title:skill+' 복습할 시간',copy:'배운 내용 '+c.due+'개가 다시 확인할 때가 되었어요. 숙련도 '+c.mastery+'%.',action:'짧게 복습 →'};
    return{kick:c.bookTitle+' · '+unit+' · '+skill,title:'Review '+skill,copy:c.due+' learned item'+(c.due===1?' is':'s are')+' due for review. Mastery '+c.mastery+'%.',action:'Quick review →'};
  }
  if(c.type==='coverage'){
    if(ko)return{kick:c.bookTitle+' · '+unit+' · '+skill,title:skill+' 조금 더 확인',copy:'아직 연습 기록이 '+c.attempts+'회라 판단할 자료가 적어요. 조금 더 해보면 실력이 더 정확히 보여요.',action:'조금 더 연습 →'};
    return{kick:c.bookTitle+' · '+unit+' · '+skill,title:'Get a clearer '+skill+' picture',copy:'Only '+c.attempts+' practice attempt'+(c.attempts===1?' is':'s are')+' recorded here. A little more practice will make your level clearer.',action:'Practice a little more →'};
  }
  if(c.type==='near'){
    if(ko)return{kick:c.bookTitle+' · '+unit+' · '+skill,title:skill+' 거의 안정적이에요',copy:'숙련도 '+c.mastery+'%. 짧게 한 번 더 연습하면 안정권에 가까워져요.',action:'마무리 연습 →'};
    return{kick:c.bookTitle+' · '+unit+' · '+skill,title:'Nearly secure in '+skill,copy:'Mastery is '+c.mastery+'%. One focused round could push this into the secure range.',action:'Finish strong →'};
  }
  if(c.type==='preview'){
    if(ko)return{kick:c.bookTitle+' · Unit '+c.unitNumber,title:'다음 단원 살짝 보기',copy:'현재 단원이 안정적이에요. 다음 단원의 '+skill+'를 조금 미리 볼 수 있어요.',action:'미리보기 →'};
    return{kick:c.bookTitle+' · Unit '+c.unitNumber,title:'Take a small look ahead',copy:'Your current unit is secure enough for a little '+skill+' preview from the next unit.',action:'Preview →'};
  }
  if(ko)return{kick:c.bookTitle+' · '+unit,title:'이번 단원 한 번 더',copy:'뚜렷한 약점은 없어요. 현재 단원을 짧게 복습하면 기억을 유지하는 데 도움이 돼요.',action:'복습 시작 →'};
  return{kick:c.bookTitle+' · '+unit,title:'Keep this unit fresh',copy:'No strong weak point stands out right now. A short review will help this unit stick.',action:'Start review →'};
}

function makeCandidates(books,progress,adaptive){
  var records=arr(progress&&progress.records),adaptiveItems=arr(adaptive&&adaptive.items),stats=buildStats(records,adaptiveItems),dailyStates=liveDailyStates(),out=[];
  var bookSeen={};
  books.forEach(function(book){
    var bid=String(book.book_id),daily=resolveDailyUnit(book,dailyStates),current=daily.unit,state=daily.state||{},currentId=current&&String(current.id),available=arr(book.availableSkills).length?arr(book.availableSkills):RUNNABLE;
    var allRows=Object.keys(stats).map(function(k){return stats[k];}).filter(function(s){return String(s.bookId)===bid;});
    var latest=0;allRows.forEach(function(s){latest=Math.max(latest,s.lastSeen||0);});bookSeen[bid]=latest;
    arr(book.units).forEach(function(unit){
      var rows=unitSkillRows(stats,bid,unit.id),isCurrent=currentId===String(unit.id),attention=!!(isCurrent&&state.attention_needed);
      rows.forEach(function(s){
        if(RUNNABLE.indexOf(s.skill)<0)return;
        var gap=Math.max(0,80-s.mastery),currentBonus=isCurrent?8:0,attentionBonus=attention?8:0,ageBonus=Math.min(8,Math.max(0,daysSince(s.lastSeen)-3));
        if((s.lapses>0||s.mastery<75)&&s.attempts+s.unique>0){
          var score=72+Math.min(24,s.lapses*4)+Math.min(18,gap*.45)+Math.min(12,s.due*4)+currentBonus+attentionBonus+Math.min(5,ageBonus);
          if(s.mastery<60)score+=8;
          out.push({type:'weak',score:score,bookId:bid,bookTitle:bookTitle(book),unitId:String(unit.id),unitNumber:unitNumber(unit),skill:s.skill,mastery:s.mastery,attempts:s.attempts,unique:s.unique,lapses:s.lapses,due:s.due,lastSeen:s.lastSeen,current:isCurrent});
          return;
        }
        if(s.due>0){
          out.push({type:'due',score:62+Math.min(24,s.due*6)+currentBonus+Math.min(6,ageBonus),bookId:bid,bookTitle:bookTitle(book),unitId:String(unit.id),unitNumber:unitNumber(unit),skill:s.skill,mastery:s.mastery,attempts:s.attempts,unique:s.unique,lapses:s.lapses,due:s.due,lastSeen:s.lastSeen,current:isCurrent});
          return;
        }
        if(s.mastery>=75&&s.mastery<85&&s.attempts>=4){
          out.push({type:'near',score:50+(85-s.mastery)*.8+currentBonus,bookId:bid,bookTitle:bookTitle(book),unitId:String(unit.id),unitNumber:unitNumber(unit),skill:s.skill,mastery:s.mastery,attempts:s.attempts,unique:s.unique,lapses:s.lapses,due:s.due,lastSeen:s.lastSeen,current:isCurrent});
          return;
        }
        if(isCurrent&&s.attempts>0&&(s.attempts<4||s.unique<2)){
          out.push({type:'coverage',score:45+(4-Math.min(4,s.attempts))*3+currentBonus,bookId:bid,bookTitle:bookTitle(book),unitId:String(unit.id),unitNumber:unitNumber(unit),skill:s.skill,mastery:s.mastery,attempts:s.attempts,unique:s.unique,lapses:s.lapses,due:s.due,lastSeen:s.lastSeen,current:true});
        }
      });
    });
    if(current){
      var currentRows=unitSkillRows(stats,bid,current.id),avg=averageMastery(currentRows),majorWeak=currentRows.some(function(s){return s.mastery<65&&s.attempts+s.unique>0;});
      var units=arr(book.units).slice().sort(function(a,b){return unitNumber(a)-unitNumber(b);}),idx=units.findIndex(function(u){return String(u.id)===String(current.id);}),next=idx>=0&&idx<units.length-1?units[idx+1]:null;
      if(next&&avg>=82&&!majorWeak){
        var previewSkill=available.indexOf('vocabulary')>=0?'vocabulary':available[0]||'vocabulary';
        out.push({type:'preview',score:36+(avg>=90?5:0),bookId:bid,bookTitle:bookTitle(book),unitId:String(next.id),unitNumber:unitNumber(next),skill:previewSkill,mastery:avg,attempts:0,unique:0,lapses:0,due:0,lastSeen:0,current:false});
      }
      if(!currentRows.length){
        var freshSkill=available[0]||'vocabulary';
        out.push({type:'fresh',score:40,bookId:bid,bookTitle:bookTitle(book),unitId:String(current.id),unitNumber:unitNumber(current),skill:freshSkill,mastery:0,attempts:0,unique:0,lapses:0,due:0,lastSeen:0,current:true});
      }
    }
  });
  var newest=0;Object.keys(bookSeen).forEach(function(b){newest=Math.max(newest,bookSeen[b]||0);});
  if(books.length>1&&newest){out.forEach(function(c){var seen=bookSeen[c.bookId]||0,lag=(newest-seen)/86400000;if(lag>=2)c.score+=Math.min(8,Math.floor(lag));});}
  out.sort(function(a,b){return b.score-a.score||(b.current?1:0)-(a.current?1:0);});
  var chosen=[],bookCounts={},skills={};
  function add(c,strict){
    var exact=chosen.some(function(x){return x.bookId===c.bookId&&x.unitId===c.unitId&&x.skill===c.skill;});if(exact)return false;
    if((bookCounts[c.bookId]||0)>=2&&books.length>1)return false;
    if(strict&&skills[c.skill])return false;
    chosen.push(c);bookCounts[c.bookId]=(bookCounts[c.bookId]||0)+1;skills[c.skill]=true;return true;
  }
  out.forEach(function(c){if(chosen.length<3)add(c,true);});
  out.forEach(function(c){if(chosen.length<3)add(c,false);});
  if(!chosen.length&&books[0]){
    var d=resolveDailyUnit(books[0],dailyStates),u=d.unit||assignmentUnit(books[0]);if(u)chosen.push({type:'fresh',score:1,bookId:String(books[0].book_id),bookTitle:bookTitle(books[0]),unitId:String(u.id),unitNumber:unitNumber(u),skill:arr(books[0].availableSkills)[0]||'vocabulary',mastery:0,attempts:0,unique:0,lapses:0,due:0,current:true});
  }
  lastSnapshot={stats:stats,dailyStates:dailyStates,bookSeen:bookSeen};
  return chosen.slice(0,3);
}

function ensureHead(){
  var section=document.getElementById('aiRecommendations'),head=section&&section.querySelector('.study-coach-head');if(!head)return;
  var h=document.getElementById('aiHeading');if(h)h.textContent=isKo()?'AI 코치':'AI Coach';
  var note=head.querySelector('.study-coach-note');if(!note){note=document.createElement('span');note.className='study-coach-note';head.appendChild(note);}
  note.textContent=isKo()?'숙련도 · 실수 · 복습 시점으로 추천':'Based on mastery · mistakes · spaced review';
}
function render(candidates){
  var grid=document.getElementById('aiGrid');if(!grid)return;
  ensureHead();
  rendering=true;
  grid.setAttribute('data-smart-coach','1');
  grid.innerHTML=candidates.map(function(c,i){var copy=candidateCopy(c);return '<button class="study-coach-card" data-smart-coach-card="1" data-coach-index="'+i+'" type="button"><span class="coach-kicker">'+esc(copy.kick)+'</span><strong>'+esc(copy.title)+'</strong><small>'+esc(copy.copy)+'</small><span class="coach-action">'+esc(copy.action)+'</span></button>';}).join('');
  grid.querySelectorAll('[data-coach-index]').forEach(function(btn){btn.addEventListener('click',function(){var c=candidates[Number(btn.dataset.coachIndex)];if(c)openCandidate(c);});});
  lastCandidates=candidates.slice();
  setTimeout(function(){rendering=false;},0);
}

function waitFor(fn,timeout){return new Promise(function(resolve){var start=Date.now(),timer=setInterval(function(){var v=false;try{v=fn();}catch(_){}if(v||Date.now()-start>(timeout||4500)){clearInterval(timer);resolve(v||null);}},60);});}
function cacheBooks(){var c=cache();return c&&arr(c.books)||[];}
async function openCandidate(c){
  var books=cacheBooks(),index=books.findIndex(function(b){return String(b.book_id)===String(c.bookId);});
  if(index<0)return;
  var tabs=document.querySelectorAll('#bookTabs [data-book-index]'),activeTitle=text(document.getElementById('bookTitle')&&document.getElementById('bookTitle').textContent);
  if(bookTitle(books[index])!==activeTitle&&tabs[index]){
    tabs[index].click();
    await waitFor(function(){return text(document.getElementById('bookTitle')&&document.getElementById('bookTitle').textContent)===bookTitle(books[index]);},5000);
  }
  var unitBtn=await waitFor(function(){return document.querySelector('#unitStrip [data-unit-id="'+cssEscape(c.unitId)+'"]');},4000);
  if(unitBtn&&!unitBtn.classList.contains('is-current')){
    unitBtn.click();
    await waitFor(function(){var b=document.querySelector('#unitStrip [data-unit-id="'+cssEscape(c.unitId)+'"]');return b&&b.classList.contains('is-current');},5000);
  }
  var skillBtn=await waitFor(function(){return document.querySelector('#masteryGrid [data-skill="'+cssEscape(c.skill)+'"]');},3500);
  if(skillBtn)skillBtn.click();
}
function cssEscape(v){if(global.CSS&&typeof global.CSS.escape==='function')return global.CSS.escape(String(v));return String(v).replace(/(["\\])/g,'\\$1');}

async function refresh(){
  if(refreshing)return;
  var c=cache(),books=c&&arr(c.books);if(!books||!books.length)return;
  refreshing=true;
  try{
    var both=await Promise.all([fetchProgress().catch(function(){return{records:[]};}),fetchAdaptive().catch(function(){return{items:[]};})]);
    var progress=both[0]||{},adaptive=both[1]||{};
    if(!Array.isArray(progress.records)&&Array.isArray(adaptive.items))progress.records=[];
    render(makeCandidates(books,progress,adaptive));
  }catch(e){console.debug('[StudyV2 Coach]',e);}
  finally{refreshing=false;}
}
function schedule(ms){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,ms==null?120:ms);}
function observeGrid(){
  var grid=document.getElementById('aiGrid');if(!grid||observer)return;
  observer=new MutationObserver(function(){if(rendering)return;var smart=grid.querySelector('[data-smart-coach-card]');if(!smart)schedule(40);});
  observer.observe(grid,{childList:true,subtree:false});
}
function mount(){observeGrid();schedule(80);setTimeout(function(){if(!lastCandidates.length)schedule(0);},800);setTimeout(function(){if(!lastCandidates.length)schedule(0);},1800);}

global.addEventListener('willena:study-recording',function(e){var d=e&&e.detail||{};if(d.status!=='recorded'||d.metadata&&d.metadata.daily_test_mode===true)return;schedule(550);});
document.addEventListener('click',function(e){
  var target=e.target&&e.target.closest&&e.target.closest('#bookTabs [data-book-index],#unitStrip [data-unit-id],#languageBtn');
  if(target)schedule(target.id==='languageBtn'?80:650);
},true);
global.addEventListener('focus',function(){schedule(120);});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();

global.WillenaStudyV2Coach={refresh:refresh,getCandidates:function(){return lastCandidates.slice();},getSnapshot:function(){return lastSnapshot;}};
})(window);
