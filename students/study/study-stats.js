(function(global){
'use strict';
var SKILLS=[
 ['vocabulary','Vocabulary'],['spelling','Spelling'],['grammar','Grammar'],['sentence_building','Sentence Builder'],['conversation','Conversation'],['listening','Listening']
];
function pct(value){var n=Number(value);return Number.isFinite(n)?Math.round(n)+'%':'—';}
function accuracy(value){var n=Number(value);return Number.isFinite(n)?Math.round(n*100)+'%':'—';}
function num(value){var n=Number(value);return Number.isFinite(n)?String(n):'0';}
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function loadSmartStudy(){if(document.querySelector('script[data-smart-study-bootstrap]'))return;var s=document.createElement('script');s.src='./smart-study-bootstrap.js?v=20260809-2';s.dataset.smartStudyBootstrap='1';document.body.appendChild(s);}
function mount(){
 var hero=document.querySelector('.book-hero');if(!hero||document.getElementById('studyStats'))return;
 var section=el('section','study-stats');section.id='studyStats';
 var head=el('div','study-stats-head');var left=el('div');left.appendChild(el('span','eyebrow','YOUR PROGRESS'));left.appendChild(el('h2','', '학습 현황'));head.appendChild(left);head.appendChild(el('span','study-stats-note','Canonical study-v1'));
 section.appendChild(head);var body=el('div','study-stats-message','Loading progress…');body.id='studyStatsBody';section.appendChild(body);hero.insertAdjacentElement('afterend',section);
 refresh();loadSmartStudy();
}
function render(data){
 var body=document.getElementById('studyStatsBody');if(!body)return;
 if(!data||data.preview){body.className='study-stats-message';body.textContent='Preview mode · real progress is not changed.';return;}
 var s=data.summary||{},skills=Array.isArray(data.skill_summary)?data.skill_summary:[],by={};skills.forEach(function(x){by[x.skill]=x;});
 body.className='';body.innerHTML='';
 var kpis=el('div','study-stats-kpis');
 [['Mastery',pct(s.mastery_score)],['Accuracy',accuracy(s.accuracy)],['Attempts',num(s.attempts)],['Extra study',num(s.independent_attempts)]].forEach(function(row){var card=el('div','study-stat-kpi');card.appendChild(el('strong','',row[1]));card.appendChild(el('span','',row[0]));kpis.appendChild(card);});
 body.appendChild(kpis);
 var grid=el('div','study-skill-stats');SKILLS.forEach(function(def){var row=by[def[0]],card=el('div','study-skill-stat'+(row?'':' study-skill-empty')),top=el('div','study-skill-top');top.appendChild(el('span','',def[1]));top.appendChild(el('strong','',row?pct(row.mastery_score):'Not studied'));card.appendChild(top);var bar=el('div','study-skill-bar'),fill=el('i');fill.style.width=row&&Number.isFinite(Number(row.mastery_score))?Math.max(0,Math.min(100,Number(row.mastery_score)))+'%':'0%';bar.appendChild(fill);card.appendChild(bar);grid.appendChild(card);});body.appendChild(grid);
}
async function refresh(){var body=document.getElementById('studyStatsBody');try{if(!global.WillenaStudyProgress)throw new Error('Progress service unavailable');var data=await global.WillenaStudyProgress.getProgress();render(data);}catch(error){if(body){body.className='study-stats-message';body.textContent='Progress will appear after your next saved practice.';}}}
global.addEventListener('willena:study-recording',function(e){if(e&&e.detail&&e.detail.status==='recorded')setTimeout(refresh,150);});
global.addEventListener('auth:changed',function(){setTimeout(refresh,250);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);