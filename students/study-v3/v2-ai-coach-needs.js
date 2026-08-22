(function(global){
'use strict';

var CACHE='willena-study-v2-home:v1:';
var RUN=['vocabulary','spelling','grammar','sentence_building','conversation','listening','reading'];
var KO={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
var EN={vocabulary:'Vocabulary',spelling:'Spelling',grammar:'Grammar',sentence_building:'Sentence Builder',conversation:'Conversation',listening:'Listening',reading:'Reading'};
var timer=0,busy=false,rendering=false,observer=null,lastCandidates=[],lastNeeds=[],lastSnapshot=null;

function t(v){return String(v==null?'':v).trim();}
function a(v){return Array.isArray(v)?v:[];}
function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
function esc(v){return t(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uid(){try{return t(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function isKo(){var b=document.getElementById('languageBtn');return !b||t(b.textContent)==='English';}
function lab(sk){return(isKo()?KO:EN)[sk]||sk;}
function now(){return Date.now();}
function ms(v){var n=Date.parse(v||'');return Number.isFinite(n)?n:0;}
function cache(){try{var o=JSON.parse(localStorage.getItem(CACHE+uid())||'null');return o&&a(o.books).length?o:null;}catch(_){return null;}}
function title(b){return t(b&&b.book_title||b&&b.title||'Book');}
function un(u){return Number(u&&u.unit_number)||0;}
function assigned(b){var us=a(b&&b.units),h=t(b&&b.current_unit||b&&b.starting_unit),n=(h.match(/\d+/)||[])[0];return us.find(function(u){return String(u.id)===h||(n&&String(u.unit_number)===String(n));})||b.currentUnit||us[0]||null;}
function liveDaily(){var out={};try{var d=global.WillenaStudyV2Daily,p=d&&d.getProgression&&d.getProgression();a(p&&p.bookStates).forEach(function(s){if(s&&s.book_id)out[String(s.book_id)]=s;});}catch(_){}return out;}
function currentUnit(b,ds){var st=ds[String(b.book_id)]||{},us=a(b.units);return st.current_unit_id?us.find(function(u){return String(u.id)===String(st.current_unit_id);})||assigned(b):assigned(b);}
function typ(r){var v=t(r&&r.content_type).toLowerCase();if(v==='lexical'||v==='vocab'||v==='vocabulary')v='lexical_entry';if(v==='grammar_pattern')v='pattern';return v||'activity';}
function unwrap(d){if(Array.isArray(d))return d;if(!d||typeof d!=='object')return[];if(Array.isArray(d.items))return d.items;if(Array.isArray(d.rows))return d.rows;if(Array.isArray(d.records))return d.records;if(Array.isArray(d.data))return d.data;return[];}

function api(path,options){
  var fn=global.WillenaAPI&&typeof global.WillenaAPI.fetch==='function'?global.WillenaAPI.fetch.bind(global.WillenaAPI):fetch;
  var opts=Object.assign({credentials:'include',cache:'no-store'},options||{});
  return fn(path,opts).then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok||(d&&d.success===false))throw new Error(d&&d.error||('Request failed ('+r.status+')'));return d;});});
}
function fetchMastery(){return api('/.netlify/functions/progress_summary?section=study_content_mastery&_='+now()).then(unwrap);}

function needScore(r,b,current){
  var attempts=Math.max(0,Number(r.attempts)||0);
  var correct=Math.max(0,Number(r.correct_attempts!=null?r.correct_attempts:r.correct)||0);
  var mastery=Number.isFinite(Number(r.mastery_score))?clamp(Number(r.mastery_score),0,100):(attempts?clamp(correct/attempts*100,0,100):50);
  var rawAcc=Number(r.accuracy);
  var accuracy=Number.isFinite(rawAcc)?(rawAcc<=1?rawAcc*100:rawAcc):(attempts?correct/attempts*100:null);
  if(accuracy!=null)accuracy=clamp(accuracy,0,100);
  var lapses=Math.max(0,Number(r.lapses)||0);
  var lastSeen=ms(r.last_seen_at||r.updated_at);
  var nextReview=ms(r.next_review_at||r.next_due_at);
  var due=!!(r.due===true||(nextReview&&nextReview<=now()));
  var overdueDays=due&&nextReview?Math.max(0,Math.floor((now()-nextReview)/86400000)):0;
  var reviewState=t(r.review_state).toLowerCase();
  var recentHours=lastSeen?Math.max(0,(now()-lastSeen)/3600000):9999;
  var perfect=attempts>=3&&correct===attempts;

  var parts={
    base:5,
    mastery_gap:Math.min(55,Math.max(0,85-mastery)*.65),
    accuracy_gap:accuracy!=null?Math.min(20,Math.max(0,80-accuracy)*.25):5,
    lapses:Math.min(24,lapses*7),
    due:due?18:0,
    overdue:due?Math.min(10,overdueDays):0,
    current:current?4:0,
    low_evidence:current&&attempts>0&&attempts<2?5:0,
    secure_state:/secure|master/.test(reviewState)?-20:0,
    high_mastery:mastery>=90&&accuracy!=null&&accuracy>=90?-25:0,
    recent_success:recentHours<=2&&mastery>=80&&accuracy!=null&&accuracy>=85?-15:0,
    perfect_history:perfect?-12:0
  };
  var score=Object.keys(parts).reduce(function(s,k){return s+(Number(parts[k])||0);},0);
  score=Math.round(clamp(score,0,100)*10)/10;

  var status='secure';
  if(score>=60)status='weak';
  else if(due&&score>=35)status='due';
  else if(score>=35)status='watch';

  var why=[];
  if(mastery<70)why.push('low mastery');
  if(accuracy!=null&&accuracy<75)why.push('low accuracy');
  if(lapses)why.push(lapses+' lapse'+(lapses===1?'':'s'));
  if(due)why.push(overdueDays?('overdue '+overdueDays+'d'):'due');
  if(current)why.push('current unit');
  if(parts.recent_success<0||parts.high_mastery<0||parts.perfect_history<0)why.push('recent/secure success suppressed');
  if(!why.length)why.push('stable');

  return{attempts:attempts,correct:correct,accuracy:accuracy==null?null:Math.round(accuracy),mastery:Math.round(mastery),lapses:lapses,lastSeen:lastSeen,nextReview:nextReview,due:due,overdueDays:overdueDays,reviewState:reviewState,parts:parts,score:score,status:status,why:why};
}

function makeNeeds(rows,books,ds){
  var bm={};a(books).forEach(function(b){bm[String(b.book_id)]=b;});
  var out=a(rows).filter(function(r){return r&&r.book_id&&r.unit_id&&r.content_id&&RUN.indexOf(t(r.skill))>=0&&bm[String(r.book_id)];}).map(function(r){
    var bid=String(r.book_id),unitId=String(r.unit_id),skill=t(r.skill),b=bm[bid],cu=currentUnit(b,ds),current=!!(cu&&String(cu.id)===unitId),u=b&&a(b.units).find(function(x){return String(x.id)===unitId;}),s=needScore(r,b,current);
    return Object.assign({
      key:[bid,unitId,skill,typ(r),String(r.content_id)].join('|'),
      bookId:bid,bookTitle:title(b),unitId:unitId,unitNumber:un(u),skill:skill,
      contentType:typ(r),contentId:String(r.content_id),current:current
    },s);
  });
  out.sort(function(x,y){return y.score-x.score||y.lapses-x.lapses||x.mastery-y.mastery||y.lastSeen-x.lastSeen;});
  return out;
}

function candidateFromGroup(b,u,sk,g,cu){
  var actionable=g.filter(function(n){return n.status!=='secure';});
  if(!actionable.length)return null;
  var ranked=actionable.slice().sort(function(x,y){return y.score-x.score;});
  var top=ranked[0],second=ranked[1],third=ranked[2];
  var weighted=top.score*.70+(second?second.score*.20:0)+(third?third.score*.10:0);
  if(!second)weighted+=top.score*.20;
  if(!third)weighted+=top.score*.10;
  var extraCount=Math.max(0,ranked.length-3);
  var score=clamp(weighted+Math.min(8,extraCount*1.5),0,100);
  var weightTotal=ranked.reduce(function(s,n){return s+Math.max(1,n.attempts);},0)||1;
  var mastery=Math.round(ranked.reduce(function(s,n){return s+n.mastery*Math.max(1,n.attempts);},0)/weightTotal);
  var type=top.status==='weak'?'weak':top.status==='due'?'due':'near';
  return{
    bookId:String(b.book_id),bookTitle:title(b),unitId:String(u.id),unitNumber:un(u),skill:sk,type:type,
    score:Math.round(score*10)/10,mastery:mastery,
    attempts:ranked.reduce(function(s,n){return s+n.attempts;},0),
    lapses:ranked.reduce(function(s,n){return s+n.lapses;},0),
    due:ranked.filter(function(n){return n.due;}).length,
    current:!!(cu&&String(cu.id)===String(u.id)),needCount:ranked.length,
    primaryNeed:top,needs:ranked.slice(0,8)
  };
}

function buildAllCandidates(books,needs,ds){
  var out=[];
  a(books).forEach(function(b){
    var bid=String(b.book_id),cu=currentUnit(b,ds),available=a(b.availableSkills).length?a(b.availableSkills):RUN;
    a(b.units).forEach(function(u){
      RUN.forEach(function(sk){
        var g=needs.filter(function(n){return n.bookId===bid&&n.unitId===String(u.id)&&n.skill===sk;});
        var c=candidateFromGroup(b,u,sk,g,cu);if(c)out.push(c);
      });
    });
    var currentHasAction=cu&&out.some(function(c){return c.bookId===bid&&c.current;});
    if(cu&&!currentHasAction){
      out.push({bookId:bid,bookTitle:title(b),unitId:String(cu.id),unitNumber:un(cu),skill:available[0]||'vocabulary',type:'fresh',score:28,mastery:100,attempts:0,lapses:0,due:0,current:true,needCount:0,primaryNeed:null,needs:[]});
    }
  });
  out.sort(function(x,y){return y.score-x.score||(y.current?1:0)-(x.current?1:0)||y.needCount-x.needCount;});
  return out;
}

function chooseCandidates(all,bookCount){
  var chosen=[],bc={},skills={};
  function add(c,strict){
    if(!c||chosen.length>=3)return;
    if(chosen.some(function(x){return x.bookId===c.bookId&&x.unitId===c.unitId&&x.skill===c.skill;}))return;
    if((bc[c.bookId]||0)>=2&&bookCount>1)return;
    if(strict&&skills[c.skill])return;
    chosen.push(c);bc[c.bookId]=(bc[c.bookId]||0)+1;skills[c.skill]=1;
  }
  all.forEach(function(c){add(c,true);});
  all.forEach(function(c){add(c,false);});
  return chosen;
}

function copy(c){
  var ko=isKo(),s=lab(c.skill),u='Unit '+c.unitNumber,need=c.needCount?c.needCount+(ko?'개 집중 항목':' targeted item'+(c.needCount===1?'':'s')):'';
  if(ko){
    if(c.type==='weak')return{kick:c.bookTitle+' · '+u+' · '+s,title:s+' 약한 부분 집중',body:need+' · 숙련도 '+c.mastery+'%'+(c.lapses?' · 반복 실수 '+c.lapses+'회':''),act:'집중 연습 →'};
    if(c.type==='due')return{kick:c.bookTitle+' · '+u+' · '+s,title:s+' 복습할 시간',body:need+' · 지금 다시 보면 좋아요.',act:'짧게 복습 →'};
    if(c.type==='near')return{kick:c.bookTitle+' · '+u+' · '+s,title:s+' 거의 안정적이에요',body:need+' · 짧게 한 번 더 확인해요.',act:'연습 시작 →'};
    return{kick:c.bookTitle+' · '+u,title:'현재 단원 계속하기',body:'지금은 강한 약점이 없어요. 현재 단원을 이어가 볼까요?',act:'계속하기 →'};
  }
  if(c.type==='weak')return{kick:c.bookTitle+' · '+u+' · '+s,title:'Target '+s,body:need+' · mastery '+c.mastery+'%'+(c.lapses?' · '+c.lapses+' repeat misses':''),act:'Targeted practice →'};
  if(c.type==='due')return{kick:c.bookTitle+' · '+u+' · '+s,title:'Review '+s,body:need+' are due for review.',act:'Quick review →'};
  if(c.type==='near')return{kick:c.bookTitle+' · '+u+' · '+s,title:'Nearly secure in '+s,body:need+' need one more short pass.',act:'Start practice →'};
  return{kick:c.bookTitle+' · '+u,title:'Keep this unit moving',body:'No strong weak point stands out right now.',act:'Continue →'};
}

function render(cs){
  var g=document.getElementById('aiGrid');if(!g)return;
  rendering=true;g.setAttribute('data-smart-coach','1');
  g.innerHTML=cs.map(function(c,i){var x=copy(c);return'<button class="study-coach-card" data-smart-coach-card="1" data-coach-index="'+i+'" type="button"><span class="coach-kicker">'+esc(x.kick)+'</span><strong>'+esc(x.title)+'</strong><small>'+esc(x.body)+'</small><span class="coach-action">'+esc(x.act)+'</span></button>';}).join('');
  g.querySelectorAll('[data-coach-index]').forEach(function(b){b.onclick=function(){openCandidate(cs[Number(b.dataset.coachIndex)]);};});
  lastCandidates=cs.slice();setTimeout(function(){rendering=false;},0);
}
function wait(fn,timeout){return new Promise(function(res){var st=now(),iv=setInterval(function(){var v=false;try{v=fn();}catch(_){}if(v||now()-st>(timeout||4500)){clearInterval(iv);res(v||null);}},60);});}
function css(v){return global.CSS&&CSS.escape?CSS.escape(String(v)):String(v).replace(/(["\\])/g,'\\$1');}
async function openCandidate(c){
  if(!c)return;
  var cc=cache(),books=a(cc&&cc.books),i=books.findIndex(function(b){return String(b.book_id)===c.bookId;}),tabs=document.querySelectorAll('#bookTabs [data-book-index]');
  if(i>=0&&tabs[i]){var bt=t(document.getElementById('bookTitle')&&document.getElementById('bookTitle').textContent);if(title(books[i])!==bt){tabs[i].click();await wait(function(){return t(document.getElementById('bookTitle')&&document.getElementById('bookTitle').textContent)===title(books[i]);},5000);}}
  var ub=await wait(function(){return document.querySelector('#unitStrip [data-unit-id="'+css(c.unitId)+'"]');},4000);
  if(ub&&!ub.classList.contains('is-current')){ub.click();await wait(function(){var x=document.querySelector('#unitStrip [data-unit-id="'+css(c.unitId)+'"]');return x&&x.classList.contains('is-current');},5000);}
  var sb=await wait(function(){return document.querySelector('#masteryGrid [data-skill="'+css(c.skill)+'"]');},3500);if(sb)sb.click();
}

async function refresh(){
  if(busy)return;
  var cc=cache(),books=cc&&a(cc.books);if(!books||!books.length)return;
  busy=true;
  try{
    var rows=await fetchMastery(),ds=liveDaily(),needs=makeNeeds(rows,books,ds),all=buildAllCandidates(books,needs,ds),chosen=chooseCandidates(all,books.length);
    lastNeeds=needs.slice();
    lastSnapshot={
      source:'Cloudflare progress-summary → get_study_content_mastery_v1',
      masteryRows:rows.length,
      needs:needs.slice(),
      allCandidates:all.slice(),
      chosenCandidates:chosen.slice(),
      generatedAt:new Date().toISOString()
    };
    render(chosen);
  }catch(e){
    lastSnapshot={source:'Cloudflare progress-summary → get_study_content_mastery_v1',error:String(e&&e.message||e),masteryRows:0,needs:[],allCandidates:[],chosenCandidates:[]};
    console.warn('[StudyV2 Coach needs]',e);
  }finally{busy=false;}
}
function schedule(delay){clearTimeout(timer);timer=setTimeout(refresh,delay==null?120:delay);}
function mount(){var g=document.getElementById('aiGrid');if(g&&!observer){observer=new MutationObserver(function(){if(!rendering&&!g.querySelector('[data-smart-coach-card]'))schedule(40);});observer.observe(g,{childList:true});}schedule(80);}

global.addEventListener('willena:study-recording',function(e){var d=e&&e.detail||{};if(d.status==='recorded')schedule(350);});
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#languageBtn'))schedule(80);},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();

global.WillenaStudyV2Coach={
  refresh:refresh,
  getCandidates:function(){return lastCandidates.slice();},
  getNeeds:function(){return lastNeeds.slice();},
  getSnapshot:function(){return lastSnapshot;}
};
})(window);
