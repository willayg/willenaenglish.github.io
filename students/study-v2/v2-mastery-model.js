(function(global){
'use strict';

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
function ms(v){var n=Date.parse(v||'');return Number.isFinite(n)?n:0;}
function now(){return Date.now();}
function unwrap(d){if(Array.isArray(d))return d;if(!d||typeof d!=='object')return[];if(Array.isArray(d.items))return d.items;if(Array.isArray(d.rows))return d.rows;if(Array.isArray(d.records))return d.records;if(Array.isArray(d.data))return d.data;return[];}
function type(v){v=text(v).toLowerCase();if(v==='lexical'||v==='vocab'||v==='vocabulary')v='lexical_entry';if(v==='grammar_pattern')v='pattern';return v||'activity';}
function rowKey(r){if(!r)return'';return[String(r.book_id||''),String(r.unit_id||''),text(r.skill),type(r.content_type),String(r.content_id||'')].join('|');}
function activityIdentity(a){
  if(!a)return null;
  var m=a.metadata||{},bookId=m.book_id,unitId=m.unit_id,skill=text(a.skill),contentType=m.mastery_content_type||a.sourceType||'activity',contentId=m.mastery_content_id||a.sourceId||a.source_id||null;
  if(skill==='grammar'&&m.pattern_id){contentType='pattern';contentId=m.pattern_id;}
  if(!bookId||!unitId||!skill||!contentId)return null;
  return{book_id:String(bookId),unit_id:String(unitId),skill:skill,content_type:type(contentType),content_id:String(contentId)};
}
function activityKey(a){var x=activityIdentity(a);return x?rowKey(x):'';}
function scoreNeed(r,opts){
  opts=opts||{};
  var attempts=Math.max(0,Number(r&&r.attempts)||0);
  var correct=Math.max(0,Number(r&&r.correct_attempts!=null?r.correct_attempts:r&&r.correct)||0);
  var mastery=Number.isFinite(Number(r&&r.mastery_score))?clamp(Number(r.mastery_score),0,100):(attempts?clamp(correct/attempts*100,0,100):50);
  var rawAcc=Number(r&&r.accuracy);
  var accuracy=Number.isFinite(rawAcc)?(rawAcc<=1?rawAcc*100:rawAcc):(attempts?correct/attempts*100:null);
  if(accuracy!=null)accuracy=clamp(accuracy,0,100);
  var lapses=Math.max(0,Number(r&&r.lapses)||0);
  var lastSeen=ms(r&&(r.last_seen_at||r.updated_at));
  var nextReview=ms(r&&(r.next_review_at||r.next_due_at));
  var due=!!(r&&(r.due===true||(nextReview&&nextReview<=now())));
  var overdueDays=due&&nextReview?Math.max(0,Math.floor((now()-nextReview)/86400000)):0;
  var reviewState=text(r&&r.review_state).toLowerCase();
  var recentHours=lastSeen?Math.max(0,(now()-lastSeen)/3600000):9999;
  var perfect=attempts>=3&&correct===attempts;
  var current=!!opts.current;
  var parts={base:5,mastery_gap:Math.min(55,Math.max(0,85-mastery)*.65),accuracy_gap:accuracy!=null?Math.min(20,Math.max(0,80-accuracy)*.25):5,lapses:Math.min(24,lapses*7),due:due?18:0,overdue:due?Math.min(10,overdueDays):0,current:current?4:0,low_evidence:current&&attempts>0&&attempts<2?5:0,secure_state:/secure|master/.test(reviewState)?-20:0,high_mastery:mastery>=90&&accuracy!=null&&accuracy>=90?-25:0,recent_success:recentHours<=2&&mastery>=80&&accuracy!=null&&accuracy>=85?-15:0,perfect_history:perfect?-12:0};
  var score=Object.keys(parts).reduce(function(s,k){return s+(Number(parts[k])||0);},0);score=Math.round(clamp(score,0,100)*10)/10;
  var status='secure';if(score>=60)status='weak';else if(due&&score>=35)status='due';else if(score>=35)status='watch';
  var why=[];if(mastery<70)why.push('low mastery');if(accuracy!=null&&accuracy<75)why.push('low accuracy');if(lapses)why.push(lapses+' lapse'+(lapses===1?'':'s'));if(due)why.push(overdueDays?('overdue '+overdueDays+'d'):'due');if(current)why.push('current unit');if(parts.recent_success<0||parts.high_mastery<0||parts.perfect_history<0)why.push('recent/secure success suppressed');if(!why.length)why.push('stable');
  return{attempts:attempts,correct:correct,accuracy:accuracy==null?null:Math.round(accuracy),mastery:Math.round(mastery),lapses:lapses,lastSeen:lastSeen,nextReview:nextReview,due:due,overdueDays:overdueDays,reviewState:reviewState,parts:parts,score:score,status:status,why:why};
}
function indexRows(data){var out={};unwrap(data).forEach(function(r){var k=rowKey(r);if(k)out[k]=r;});return out;}
function dailyFactor(scored){if(!scored)return 1;if(scored.score<20)return .18;if(scored.score<35)return .35;if(scored.score<60)return .70;return 1;}

global.WillenaStudyV2Mastery={unwrap:unwrap,type:type,rowKey:rowKey,activityIdentity:activityIdentity,activityKey:activityKey,scoreNeed:scoreNeed,indexRows:indexRows,dailyFactor:dailyFactor};
})(window);
