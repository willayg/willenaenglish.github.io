(function(global){
'use strict';
var VERSION='coach-review-policy-v1.0',coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;
function arr(v){return Array.isArray(v)?v:[];}
function ko(){var p=global.WillenaStudyV2LanguagePreference,v=p&&typeof p.get==='function'?p.get():'';if(v)return v==='ko';var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function vocabDue(ctx){var r=global.WillenaCoachStage5MissedReview;if(!r||typeof r.queue!=='function')return[];return arr(r.queue(ctx)).filter(function(x){return x&&x.domain==='vocabulary';});}
coach.registerCapability({
 id:'stage5_vocabulary_weakness',
 available:function(ctx){return vocabDue(ctx).length>0;},
 score:function(ctx){var q=vocabDue(ctx);return q.length?430+Math.min(80,q.length*10):0;},
 label:{ko:'틀린 단어 다시 확인',en:'Review wrong words'},
 response:function(ctx){var n=vocabDue(ctx).length;return ko()?('오늘 다시 볼 단어는 '+n+'개예요. 짧게 확인해 볼게요.'):('I picked '+n+' words worth checking today. We’ll keep it short.');},
 actions:function(ctx){return[{label:{ko:'단어 복습 시작',en:'Start word review'},run:function(liveCtx){var r=global.WillenaCoachStage5MissedReview;return r&&typeof r.build==='function'?r.build(liveCtx||ctx):null;}}];}
});
global.WillenaCoachReviewPolicy={version:VERSION,vocabDue:vocabDue};
})(window);