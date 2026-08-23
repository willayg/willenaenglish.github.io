(function(global){
'use strict';
var VERSION='coach-stage5-grammar-integration-v1.0';
var coach=global.WillenaAICoach,cap=global.WillenaCoachStage5Capability;
if(!coach||typeof coach.registerCapability!=='function'||!cap)return;
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function ko(){var p=global.WillenaStudyV2LanguagePreference,v=p&&typeof p.get==='function'?p.get():'';if(v)return v==='ko';var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function history(){var h=global.WillenaCoachHistory;return h&&typeof h.getSnapshot==='function'?h.getSnapshot():null;}
function grammarEvidence(ctx){return typeof cap.grammarEvidence==='function'?arr(cap.grammarEvidence(ctx)):[];}
function skillName(lang,s){var K={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'},E={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};return(lang==='ko'?K:E)[s]||s;}
function fallbackWeak(){var h=history(),rows=arr(h&&h.skillMastery),misses={};arr(h&&h.recentAttempts).slice(0,120).forEach(function(a){var s=text(a&&a.skill);if(s&&!a.correct)misses[s]=(misses[s]||0)+1;});var xs=rows.map(function(x){var s=text(x&&x.skill),pct=Math.max(0,Math.min(100,Number(x&&x.mastery)||0)),attempts=Math.max(0,Number(x&&x.attempts)||0),m=Number(misses[s])||0;return{skill:s,pct:pct,attempts:attempts,misses:m,effective:Math.min(pct,m>=2?Math.max(20,90-m*10):pct)};}).filter(function(x){return x.skill&&((x.attempts>0&&x.pct<80)||x.misses>=2);}).sort(function(a,b){return a.effective-b.effective||b.misses-a.misses;});return xs.slice(0,5);}
function conceptLabel(x){return text(x&&x.targetKey||x&&x.conceptCode||'grammar').replace(/_/g,' ');}
coach.registerCapability({id:'stage5_concept_weakness',available:false,score:0,label:{ko:'',en:''}});
coach.registerCapability({
 id:'weakness',
 available:function(ctx){return grammarEvidence(ctx).length>0||fallbackWeak().length>0;},
 score:function(ctx){var g=grammarEvidence(ctx)[0];if(g)return 350+Math.min(120,Number(g.score)||0);var x=fallbackWeak()[0];return x?Math.max(70,120-(Number(x.effective)||x.pct)):0;},
 label:function(ctx){var g=grammarEvidence(ctx)[0];if(g)return g.state==='recall_weakness'?{ko:'문장 만들기 다시 연습',en:'Practise producing the sentence'}:{ko:'헷갈린 문법 다시 잡기',en:'Fix a recurring grammar point'};var xs=fallbackWeak();if(!xs.length)return{ko:'약한 부분 연습',en:'Practice weak areas'};return{ko:skillName('ko',xs[0].skill)+'을 더 연습할래요',en:'More '+skillName('en',xs[0].skill)+' practice'};},
 response:function(ctx){var g=grammarEvidence(ctx)[0];if(g){var c=conceptLabel(g);return g.state==='recall_weakness'?(ko()?'규칙은 알고 있지만 직접 문장을 만들 때 조금 더 연습이 필요해 보여요. '+c+'를 문장으로 연습해 볼게요.':'You seem to know the rule, but producing it still needs practice. Let’s work on '+c+' in sentences.'):(ko()?'같은 문법 포인트에서 반복해서 막힌 흔적이 있어요. '+c+'를 다른 문제로 다시 확인해 볼게요.':'I found repeated trouble with the same grammar point. Let’s check '+c+' with different questions.');}var x=fallbackWeak()[0];return x?(ko()?skillName('ko',x.skill)+'이 지금 가장 먼저 챙기기 좋은 영역이에요.':'Your '+skillName('en',x.skill)+' looks like the best place to focus right now.'):'';},
 actions:function(ctx){var gs=grammarEvidence(ctx).slice(0,3);if(gs.length)return gs.map(function(g){return{label:{ko:conceptLabel(g)+' 연습하기',en:'Practise '+conceptLabel(g)},run:function(liveCtx){return cap.buildPlan(g,liveCtx||ctx);}};});var x=fallbackWeak()[0];return x?[{label:{ko:skillName('ko',x.skill)+' 집중 연습',en:'Practice '+skillName('en',x.skill)},provider:'unit',args:{skill:x.skill,count:10}}]:[];}
});
global.WillenaCoachStage5GrammarIntegration={version:VERSION};
})(window);