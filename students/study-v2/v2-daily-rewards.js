(function(global){
'use strict';

var lastReward=null;
var busy=false;
var timer=0;
var pendingAnnounce=false;

function num(v){var n=Number(v);return Number.isFinite(n)?n:0;}
function ko(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function daily(){return global.WillenaStudyV2Daily||null;}
function testMode(){var d=daily();try{return !!(d&&d.isTestMode&&d.isTestMode());}catch(_){return false;}}
function rewardOf(data){return data&&data.reward&&typeof data.reward==='object'?data.reward:null;}

var COMPLETE_MESSAGES=[
  {title:'VICTORY',subtitle:'Come back tomorrow'},
  {title:'MISSION ACCOMPLISHED',subtitle:'Come back tomorrow'},
  {title:'VICTORY',subtitle:'See you tomorrow'},
  {title:'MISSION ACCOMPLISHED',subtitle:'See you tomorrow'},
  {title:'MISSION COMPLETE',subtitle:'Come back tomorrow'},
  {title:'ALL CLEAR',subtitle:'You\'re done for today'},
  {title:'DAY COMPLETE',subtitle:'Come back tomorrow'},
  {title:'오늘 미션 완료',subtitle:'내일 다시 만나요'},
  {title:'오늘도 성공!',subtitle:'내일 또 도전해요'},
  {title:'목표 달성!',subtitle:'오늘은 여기까지!'},
  {title:'오늘도 해냈어요!',subtitle:'내일 다시 만나요'},
  {title:'오늘 학습 끝!',subtitle:'내일 또 도전해요'}
];

function daySeed(dateText){
  var s=String(dateText||'');
  var n=0;
  for(var i=0;i<s.length;i++)n=((n*31)+s.charCodeAt(i))>>>0;
  return n;
}
function completionMessage(r){
  return COMPLETE_MESSAGES[daySeed(r&&r.study_date)%COMPLETE_MESSAGES.length];
}

function ensureStyles(){
  if(document.getElementById('v2DailyRewardStyles'))return;
  var s=document.createElement('style');
  s.id='v2DailyRewardStyles';
  s.textContent='\
#dailyWorkoutCard .daily-streak-status{display:block;margin-top:4px;font-size:12px;font-weight:800;opacity:.82}\
#dailyWorkoutCard.is-complete{min-height:138px!important;border-width:4px!important;background:#fff!important;box-shadow:0 10px 24px rgba(255,111,176,.08)!important;overflow:hidden!important}\
#dailyWorkoutCard.is-complete:after{content:none!important;display:none!important;background:none!important}\
#dailyWorkoutCard.is-complete #smartProgressTitle{font-size:1.42rem!important;line-height:1.02!important;font-weight:900!important;letter-spacing:-.02em!important;color:#ea4d96!important;position:relative;z-index:2}\
#dailyWorkoutCard.is-complete #smartProgressCopy{display:block!important;margin-top:8px!important;font-size:.82rem!important;line-height:1.25!important;font-weight:800!important;color:#7c8c91!important;opacity:1!important;position:relative;z-index:2}\
#dailyWorkoutCard.is-complete .daily-streak-status{margin-top:9px!important;position:relative;z-index:2}\
#dailyWorkoutCard.is-complete .progress-ring{box-shadow:none!important;z-index:2}\
#dailyWorkoutCard.is-complete:before{z-index:2}\
.daily-reward-summary{margin:16px auto 4px;padding:16px 18px;border-radius:18px;background:rgba(255,255,255,.72);max-width:360px;text-align:center;box-shadow:0 8px 24px rgba(23,63,70,.08)}\
.daily-reward-points{font-size:22px;font-weight:900;line-height:1.25}\
.daily-reward-stars{font-size:25px;letter-spacing:2px;margin:7px 0 4px}\
.daily-reward-streak{font-size:14px;font-weight:800;margin-top:5px}\
.daily-reward-bonus{font-size:12px;font-weight:800;opacity:.78;margin-top:7px}\
.daily-reward-toast{position:fixed;left:50%;top:88px;transform:translateX(-50%);z-index:10050;padding:10px 16px;border-radius:999px;background:#173f46;color:#fff;font:800 14px Poppins,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);pointer-events:none;animation:dailyRewardToast 1.8s ease forwards}\
@keyframes dailyRewardToast{0%{opacity:0;transform:translate(-50%,-8px) scale(.96)}15%,75%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-5px) scale(.98)}}\
@media(max-width:560px){#dailyWorkoutCard.is-complete #smartProgressTitle{font-size:1.18rem!important}#dailyWorkoutCard.is-complete #smartProgressCopy{font-size:.75rem!important}}';
  document.head.appendChild(s);
}

function renderCard(r){
  var card=document.getElementById('dailyWorkoutCard');if(!card)return;
  var complete=!!(r&&r.completed)&&!testMode();
  card.classList.toggle('is-complete',complete);
  var title=document.getElementById('smartProgressTitle');
  var copy=document.getElementById('smartProgressCopy');
  if(complete){
    var msg=completionMessage(r);
    if(title)title.textContent=msg.title;
    if(copy)copy.textContent=msg.subtitle;
    card.setAttribute('aria-label',msg.title+'. '+msg.subtitle);
  }else{
    if(title)title.textContent='데일리 스터디';
    card.setAttribute('aria-label','Start Daily Study');
  }

  var host=card.children&&card.children[1];if(!host)return;
  var el=card.querySelector('.daily-streak-status');
  if(!el){el=document.createElement('small');el.className='daily-streak-status';host.appendChild(el);}
  var streak=num(r&&r.current_streak);
  if(testMode()||streak<=0){el.hidden=true;return;}
  el.hidden=false;
  el.textContent=ko()?streak+'일 연속 학습':streak+' day streak';
}

function renderFinish(r){
  if(testMode()||!r||!r.completed)return;
  var root=document.getElementById('v2ActivityRoot');if(!root)return;
  var finish=root.querySelector('.smart-finish');if(!finish)return;
  var points=num(r.today_points),rating=num(r.daily_rating_stars),bonusPts=num(r.streak_bonus_points),bonusStars=num(r.streak_bonus_stars),streak=num(r.current_streak);
  if(points<=0&&rating<=0)return;
  var block=finish.querySelector('.daily-reward-summary');
  if(!block){
    block=document.createElement('div');block.className='daily-reward-summary';
    var back=finish.querySelector('#v2DailyHome');if(back)finish.insertBefore(block,back);else finish.appendChild(block);
  }
  var stars='';for(var i=0;i<rating;i++)stars+='⭐';
  var bonus=[];
  if(bonusPts>0)bonus.push('+'+bonusPts+' pts');
  if(bonusStars>0)bonus.push('+'+'⭐'.repeat(bonusStars));
  block.innerHTML='<div class="daily-reward-points">+'+points+' points</div>'+ 
    '<div class="daily-reward-stars">'+stars+'</div>'+ 
    '<div class="daily-reward-streak">🔥 '+streak+(ko()?'일 연속 학습':' day streak')+'</div>'+ 
    (bonus.length?'<div class="daily-reward-bonus">'+(ko()?'연속 학습 보너스 · ':'Streak bonus · ')+bonus.join(' · ')+'</div>':'');
}

function toast(points,stars){
  if(points<=0&&stars<=0)return;
  var old=document.querySelector('.daily-reward-toast');if(old)old.remove();
  var el=document.createElement('div');el.className='daily-reward-toast';
  var bits=[];if(points>0)bits.push('+'+points+' points');if(stars>0)bits.push('+'+'⭐'.repeat(stars));
  el.textContent=bits.join(' · ');document.body.appendChild(el);setTimeout(function(){if(el&&el.parentNode)el.remove();},1900);
}

function refreshHeader(){
  try{
    var h=document.querySelector('student-header');
    if(h&&typeof h._fetchOverview==='function')setTimeout(function(){try{h._fetchOverview();}catch(_){}},350);
  }catch(_){}
}

function announceDelta(prev,next){
  if(testMode()||!prev||!next)return;
  var dp=Math.max(0,num(next.today_points)-num(prev.today_points));
  var ds=Math.max(0,num(next.today_stars)-num(prev.today_stars));
  if(dp>0){try{global.dispatchEvent(new CustomEvent('points:optimistic-bump',{detail:{delta:dp,source:'daily-study'}}));}catch(_){}}
  if(ds>0){try{global.dispatchEvent(new CustomEvent('stars:optimistic-bump',{detail:{delta:ds,source:'daily-study'}}));}catch(_){}try{global.dispatchEvent(new CustomEvent('stars:refresh',{detail:{source:'daily-study'}}));}catch(_){}}
  if(dp>0||ds>0){toast(dp,ds);refreshHeader();}
}

async function syncReward(announce){
  var d=daily();if(!d||typeof d.sync!=='function'||busy)return;
  busy=true;
  try{
    var data=await d.sync();
    var r=rewardOf(data);if(!r)return;
    if(announce&&lastReward&&String(lastReward.study_date||'')===String(r.study_date||''))announceDelta(lastReward,r);
    lastReward=JSON.parse(JSON.stringify(r));
    renderCard(r);renderFinish(r);
  }catch(error){console.warn('[Daily Study rewards]',error);}
  finally{busy=false;}
}

function schedule(announce,delay){
  pendingAnnounce=pendingAnnounce||!!announce;
  try{clearTimeout(timer);}catch(_){}
  timer=setTimeout(function(){var a=pendingAnnounce;pendingAnnounce=false;syncReward(a);},delay==null?140:delay);
}

function savedAnswerVisible(root){
  if(!document.body.classList.contains('study-v2-daily-mode'))return false;
  if(root.querySelector('.smart-finish'))return true;
  var check=root.querySelector('.activity-check');if(!check)return false;
  var label=String(check.textContent||'').trim().toLowerCase();
  return label==='continue'||label==='계속'||label==='done'||label==='완료';
}

function bind(){
  ensureStyles();
  schedule(false,120);
  var root=document.getElementById('v2ActivityRoot');
  if(root&&global.MutationObserver){
    new MutationObserver(function(){if(savedAnswerVisible(root))schedule(true,90);}).observe(root,{childList:true,characterData:true,subtree:true});
  }
  var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(function(){if(lastReward)renderCard(lastReward);},0);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)schedule(false,80);});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);