(function(global){
'use strict';
var SKILLS=[['vocabulary','Vocabulary'],['spelling','Spelling'],['grammar','Grammar'],['sentence_building','Sentence Builder'],['conversation','Conversation'],['listening','Listening']];
var seq=0;
function el(tag,cls,txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;}
function runtime(){return global.WillenaStudyRuntime&&global.WillenaStudyRuntime.getContext?global.WillenaStudyRuntime.getContext():null;}
function ensureHost(){var units=document.getElementById('studyHomeUnits');if(!units)return null;var old=document.getElementById('headerSkillMastery');if(old)return old;var box=el('div','header-skill-mastery');box.id='headerSkillMastery';var head=el('div','header-skill-mastery-head');head.appendChild(el('strong','','Unit mastery'));head.appendChild(el('span','','Tap a skill to practice'));box.appendChild(head);box.appendChild(el('div','header-skill-mastery-grid'));units.appendChild(box);return box;}
function pct(v){var n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):0;}
function launch(skill,label){var c=runtime();if(!c||!c.bookId||!c.unitId)return;global.dispatchEvent(new CustomEvent('willena:smart-study-focus',{detail:{bookId:c.bookId,unitId:c.unitId,skill:skill,skillLabel:label}}));}
function render(data,unitId){var c=runtime();if(!c||String(c.unitId)!==String(unitId))return;var box=ensureHost();if(!box)return;var rows=Array.isArray(data&&data.skill_summary)?data.skill_summary:(Array.isArray(data&&data.unit_skills)?data.unit_skills:[]),by={};rows.forEach(function(r){by[r.skill]=r;});var grid=box.querySelector('.header-skill-mastery-grid');grid.innerHTML='';SKILLS.forEach(function(def){var value=pct(by[def[0]]&&by[def[0]].mastery_score),b=el('button','header-skill-master');b.type='button';var top=el('div','header-skill-master-top');top.appendChild(el('strong','',def[1]));top.appendChild(el('span','',value+'%'));b.appendChild(top);var track=el('div','header-skill-master-track'),fill=el('i');fill.style.width=value+'%';track.appendChild(fill);b.appendChild(track);b.addEventListener('click',function(){launch(def[0],def[1]);});grid.appendChild(b);});}
async function refresh(){var c=runtime();if(!c||!c.bookId||!c.unitId||!global.WillenaStudyProgress)return;var my=++seq,box=ensureHost();if(box){var grid=box.querySelector('.header-skill-mastery-grid');if(!grid.children.length)grid.textContent='Loading mastery…';}try{var data=await global.WillenaStudyProgress.getProgress(c.bookId,c.unitId);if(my!==seq)return;render(data,c.unitId);}catch(e){console.debug('[HeaderSkillMastery]',e);}}
global.addEventListener('willena:study-unit-changing',function(){seq++;setTimeout(refresh,0);});
global.addEventListener('willena:study-unit-changed',function(){refresh();});
global.addEventListener('willena:study-recording',function(e){if(e&&e.detail&&e.detail.status==='recorded')setTimeout(refresh,180);});
global.addEventListener('willena:study-progress-updated',function(){setTimeout(refresh,120);});
function wait(){var tries=0,t=setInterval(function(){tries++;if(runtime()&&document.getElementById('studyHomeUnits')){clearInterval(t);refresh();}else if(tries>40)clearInterval(t);},250);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wait,{once:true});else wait();
})(window);
