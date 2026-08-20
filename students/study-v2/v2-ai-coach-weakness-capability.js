(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

function text(v){return String(v==null?'':v).trim();}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function skillNameFor(lang,s){
  var K={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
  var E={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};
  return (lang==='ko'?K:E)[s]||s;
}
function skillName(s){return skillNameFor(ko()?'ko':'en',s);}
function history(){var h=global.WillenaCoachHistory;return h&&typeof h.getSnapshot==='function'?h.getSnapshot():null;}
function masteryRows(){
  var h=history(),current=h&&h.currentUnit&&h.currentUnit.skillMastery;
  if(Array.isArray(current)&&current.length)return current.map(function(x){return{skill:text(x.skill),pct:Math.max(0,Math.min(100,Number(x.mastery)||0))};});
  var overall=h&&h.skillMastery;
  return (Array.isArray(overall)?overall:[]).map(function(x){return{skill:text(x.skill),pct:Math.max(0,Math.min(100,Number(x.mastery)||0))};});
}
function recentMisses(){
  var h=history(),counts={};
  (Array.isArray(h&&h.recentAttempts)?h.recentAttempts:[]).slice(0,60).forEach(function(a){
    var skill=text(a&&a.skill);if(!skill||a.correct)return;
    counts[skill]=(counts[skill]||0)+1;
  });
  return counts;
}
function locationForSkill(skill,ctx){
  var h=history(),rows=(Array.isArray(h&&h.skillLocations)?h.skillLocations:[]).filter(function(x){return text(x&&x.skill)===skill&&text(x&&x.bookId)&&text(x&&x.unitId);});
  rows.sort(function(a,b){return(Number(a.mastery)||0)-(Number(b.mastery)||0)||(Number(b.lapses)||0)-(Number(a.lapses)||0)||(Number(b.attempts)||0)-(Number(a.attempts)||0);});
  var loc=rows[0]||null;if(!loc)return null;
  var books=ctx&&Array.isArray(ctx.books)?ctx.books:[],book=books.find(function(b){return String(b&&b.book_id)===String(loc.bookId);})||null;
  if(!book)return null;
  var units=Array.isArray(book.units)?book.units:[],unit=units.find(function(u){return String(u&&u.id)===String(loc.unitId);})||null;
  if(!unit)return null;
  return{bookId:String(loc.bookId),unitId:String(loc.unitId),bookTitle:text(book.book_title||book.title)||'Book',unitNumber:Number(unit.unit_number)||0,unitTitle:text(unit.title),mastery:Number(loc.mastery)||0,lapses:Number(loc.lapses)||0,attempts:Number(loc.attempts)||0};
}
function locationLabel(loc){if(!loc)return'';return loc.bookTitle+' · Unit '+loc.unitNumber;}
function weakSkills(ctx){
  var base=masteryRows(),misses=recentMisses(),by={};
  base.forEach(function(x){if(x.skill)by[x.skill]={skill:x.skill,pct:x.pct,misses:Number(misses[x.skill])||0};});
  Object.keys(misses).forEach(function(skill){if(!by[skill])by[skill]={skill:skill,pct:100,misses:Number(misses[skill])||0};});
  var ranked=Object.keys(by).map(function(k){var x=by[k];x.effective=Math.min(x.pct,x.misses>=2?Math.max(25,90-x.misses*10):x.pct);x.location=locationForSkill(x.skill,ctx);return x;})
    .filter(function(x){return x.skill&&((x.pct>0&&x.pct<80)||x.misses>=2);})
    .sort(function(a,b){return(a.effective-b.effective)||(b.misses-a.misses)||a.skill.localeCompare(b.skill);});
  if(ranked.length)return ranked.slice(0,3);
  var fallback=base.filter(function(x){return x.skill&&x.pct>0;}).sort(function(a,b){return(a.pct-b.pct)||a.skill.localeCompare(b.skill);});
  if(!fallback.length||fallback[0].pct>=90)return[];
  return[{skill:fallback[0].skill,pct:fallback[0].pct,misses:0,effective:fallback[0].pct,location:locationForSkill(fallback[0].skill,ctx)}];
}
function names(xs,lang){return xs.map(function(x){return skillNameFor(lang,x.skill);});}
function joinNames(xs,lang){
  var ns=names(xs,lang);
  if(ns.length<=1)return ns[0]||'';
  if(lang==='ko')return ns.join(' · ');
  if(ns.length===2)return ns[0]+' and '+ns[1];
  return ns[0]+', '+ns[1]+' and '+ns[2];
}

coach.registerCapability({
  id:'weakness',
  available:function(ctx){return weakSkills(ctx).length>0;},
  score:function(ctx){var xs=weakSkills(ctx),x=xs[0];return x?Math.max(70,120-(Number(x.effective)||x.pct))+Math.min(2,xs.length)*0.01:0;},
  label:function(ctx){
    var xs=weakSkills(ctx);
    if(!xs.length)return{ko:'약한 부분 연습',en:'Practice weak areas'};
    if(xs.length===1)return{ko:skillNameFor('ko',xs[0].skill)+'을 더 연습할래요',en:'More '+skillNameFor('en',xs[0].skill)+' practice'};
    return{ko:'약한 영역 '+xs.length+'개 연습하기',en:'Practice '+xs.length+' weak areas'};
  },
  response:function(ctx){
    var xs=weakSkills(ctx);
    if(!xs.length)return'';
    if(xs.length===1){var x=xs[0],where=locationLabel(x.location);if(where)return ko()?where+'에서 '+skillName(x.skill)+'이 가장 먼저 챙기기 좋은 영역이에요. 공부 내용을 먼저 확인하거나 바로 연습할 수 있어요.':skillNameFor('en',x.skill)+' needs the most attention in '+where+'. You can study that unit first or go straight to practice.';return ko()?skillName(x.skill)+'이 지금 가장 먼저 챙기기 좋은 영역이에요. 공부 내용을 먼저 확인하거나 바로 연습할 수 있어요.':'Your '+skillName(x.skill)+' looks like the best place to focus right now. You can study it first or go straight to practice.';}
    var located=xs.filter(function(x){return x.location;});
    if(located.length){var details=located.map(function(x){return locationLabel(x.location)+' · '+skillNameFor(ko()?'ko':'en',x.skill);}).join(ko()?' / ':'; ');return ko()?joinNames(xs,'ko')+'에서 도움이 필요한 부분을 찾았어요. '+details+' 순서로 확인해 볼 수 있어요.':'I found useful work in '+joinNames(xs,'en')+'. The evidence points to '+details+'.';}
    return ko()?joinNames(xs,'ko')+'에서 도움이 될 만한 부분을 찾았어요. 공부 내용을 먼저 보거나 바로 연습해도 돼요.':'I found useful work in '+joinNames(xs,'en')+'. You can study one first or go straight to practice.';
  },
  actions:function(ctx){
    var out=[];
    weakSkills(ctx).forEach(function(x){
      var loc=x.location,where=locationLabel(loc),bookId=loc&&loc.bookId||ctx&&ctx.bookId,unitId=loc&&loc.unitId||ctx&&ctx.unitId;
      out.push({label:{ko:(where?where+' · ':'')+skillNameFor('ko',x.skill)+' 공부하기',en:'Study '+skillNameFor('en',x.skill)+(where?' · '+where:'')},provider:'studyNavigation',args:{bookId:bookId,unitId:unitId,skill:x.skill}});
      out.push({label:{ko:skillNameFor('ko',x.skill)+' 집중 연습',en:'Practice '+skillNameFor('en',x.skill)},provider:'unit',args:{skill:x.skill,count:10}});
    });
    return out;
  }
});
})(window);
