(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;

var levels=[
 {short:'S1',en:'Starter 1',ko:'스타터 1',enText:'Can recognise some letters and sounds, understand a few familiar classroom words and give very short responses.',koText:'일부 알파벳과 소리를 알아보고 익숙한 교실 단어를 이해하며 매우 짧게 대답할 수 있습니다.'},
 {short:'S2',en:'Starter 2',ko:'스타터 2',enText:'Can identify common objects, colours, numbers and actions, and use short memorised sentences.',koText:'익숙한 사물, 색깔, 숫자와 동작을 알아보고 짧게 외운 문장을 사용할 수 있습니다.'},
 {short:'1',en:'Level 1',ko:'레벨 1',enText:'Can understand basic present-tense sentences and answer simple personal questions in short complete sentences.',koText:'기본적인 현재형 문장을 이해하고 간단한 개인 질문에 짧은 완전한 문장으로 답할 수 있습니다.'},
 {short:'2',en:'Level 2',ko:'레벨 2',enText:'Can talk about routines, location, ability and simple personal information, and read short connected sentences.',koText:'일상 활동, 위치, 능력과 간단한 개인 정보를 말하고 짧게 연결된 문장을 읽을 수 있습니다.'},
 {short:'3',en:'Level 3',ko:'레벨 3',enText:'Can describe past events and future plans and connect simple ideas using and, but and because.',koText:'과거의 일과 미래 계획을 설명하고 and, but, because를 사용해 간단한 생각을 연결할 수 있습니다.'},
 {short:'4',en:'Level 4',ko:'레벨 4',enText:'Can use a broader range of tenses and explain experiences, preferences and simple reasons in greater detail.',koText:'더 다양한 시제를 사용하고 경험, 선호와 간단한 이유를 더 자세히 설명할 수 있습니다.'},
 {short:'5',en:'Level 5',ko:'레벨 5',enText:'Can compare people and things, understand connected stories and factual texts, and communicate clearly about familiar everyday topics.',koText:'사람과 사물을 비교하고 연결된 이야기와 정보 글을 이해하며 익숙한 일상 주제에 대해 분명히 표현할 수 있습니다.'},
 {short:'6',en:'Level 6',ko:'레벨 6',enText:'Can handle intermediate grammar and longer texts, compare ideas, explain causes and results, and produce connected responses with increasing independence.',koText:'중급 문법과 더 긴 글을 다루고 생각을 비교하며 원인과 결과를 설명하고 점점 더 독립적으로 연결된 답변을 만들 수 있습니다.'},
 {short:'7',en:'Level 7',ko:'레벨 7',enText:'Can understand conditional meaning, present perfect forms, reported ideas and more complex relationships between events.',koText:'조건의 의미, 현재완료, 전달된 생각과 사건 사이의 더 복잡한 관계를 이해할 수 있습니다.'},
 {short:'8',en:'Level 8',ko:'레벨 8',enText:'Can understand advanced middle-school grammar and follow detailed explanations with less support.',koText:'중학교 상위 문법을 이해하고 도움을 덜 받으면서 자세한 설명을 따라갈 수 있습니다.'},
 {short:'9',en:'Level 9',ko:'레벨 9',enText:'Can analyse complex sentences and understand arguments, assumptions and speaker position.',koText:'복잡한 문장을 분석하고 주장, 가정과 화자의 입장을 이해할 수 있습니다.'},
 {short:'10',en:'Level 10',ko:'레벨 10',enText:'Can handle high-school bridge English, abstract vocabulary, dense texts, implied conclusions and nuanced meaning.',koText:'고등학교 진입 수준의 영어, 추상 어휘, 밀도 높은 글, 함축된 결론과 미묘한 의미를 다룰 수 있습니다.'}
];

function internalLevel(){
 var box=root.querySelector('.report-screen .report-level');
 if(!box)return null;
 var prefix=(box.querySelector('span')||{}).textContent||'';
 var value=Number(((box.querySelector('strong')||{}).textContent||'').trim());
 if(!Number.isFinite(value))return null;
 return /starter|스타터/i.test(prefix)?value:value+2;
}
function recommendation(stage,best,ko){
 if(stage===best)return '<span class="report-level-guide__recommendation is-main">'+(ko?'추천 시작 레벨':'Recommended starting level')+'</span>';
 if(stage===best-1)return '<span class="report-level-guide__recommendation is-soft">'+(ko?'편안한 대안':'Comfortable alternative')+'</span>';
 if(stage===best+1)return '<span class="report-level-guide__recommendation is-soft">'+(ko?'도전 가능한 레벨':'Possible stretch level')+'</span>';
 return '';
}
function note(stage,best,ko){
 if(stage===best-1)return '<p class="report-level-guide__note">'+(ko?'학생이 자신감을 더 쌓거나 배운 내용을 정리할 필요가 있다면 더 편안한 시작점이 될 수 있습니다.':'This may be a better starting point when the student needs more confidence or consolidation.')+'</p>';
 if(stage===best+1)return '<p class="report-level-guide__note">'+(ko?'자신감이 높고 초반에 교사의 추가 도움을 받을 수 있는 학생에게 도전 가능한 시작점입니다.':'This may suit a confident student who can receive some additional teacher support at the beginning.')+'</p>';
 return '';
}
function markup(best,ko){
 var rows=levels.map(function(item,index){
  var stage=index+1;
  var cls=stage===best?'is-current':Math.abs(stage-best)===1?'is-adjacent':stage<best-1?'is-complete':'';
  return '<article class="report-level-guide__row '+cls+'"><div class="report-level-guide__circle" data-guide-stage="'+stage+'">'+item.short+'</div><div class="report-level-guide__description">'+recommendation(stage,best,ko)+'<h4>'+(ko?item.ko:item.en)+'</h4><p>'+(ko?item.koText:item.enText)+'</p>'+note(stage,best,ko)+'</div></article>';
 }).join('');
 return '<section class="report-level-guide" data-guide-best="'+best+'"><header class="report-level-guide__header"><span class="report-level-guide__eyebrow">'+(ko?'레벨 안내':'Level guide')+'</span><h3>'+(ko?'각 레벨에서 할 수 있는 것':'What students can do at each level')+'</h3><p>'+(ko?'추천 레벨과 가까운 두 단계는 가능한 대안으로 부드럽게 표시됩니다.':'The recommended level and its two nearest alternatives are highlighted to show the realistic placement range.')+'</p></header><div class="report-level-guide__list"><svg class="report-level-guide__svg" aria-hidden="true"><line class="is-complete"></line><line class="is-near"></line><line class="is-future"></line></svg>'+rows+'</div></section>';
}
function centre(list,stage){
 var el=list.querySelector('[data-guide-stage="'+stage+'"]');
 if(!el)return null;
 var a=list.getBoundingClientRect(),b=el.getBoundingClientRect();
 return{x:b.left-a.left+b.width/2,y:b.top-a.top+b.height/2};
}
function setLine(line,a,b){if(!line||!a||!b)return;line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y)}
function draw(section){
 if(!section)return;
 var list=section.querySelector('.report-level-guide__list');
 var svg=section.querySelector('svg');
 var best=Number(section.dataset.guideBest)||1;
 var low=Math.max(1,best-1),high=Math.min(12,best+1);
 if(!list||!svg)return;
 svg.setAttribute('viewBox','0 0 '+list.clientWidth+' '+list.clientHeight);
 setLine(svg.querySelector('.is-complete'),centre(list,1),centre(list,low));
 setLine(svg.querySelector('.is-near'),centre(list,low),centre(list,high));
 setLine(svg.querySelector('.is-future'),centre(list,high),centre(list,12));
}
function inject(){
 var screen=root.querySelector('.report-screen');
 if(!screen)return;
 var best=internalLevel();
 if(!best)return;
 var ko=document.documentElement.lang==='ko';
 var existing=screen.querySelector('.report-level-guide');
 if(existing&&Number(existing.dataset.guideBest)===best&&existing.dataset.guideLang===(ko?'ko':'en')){draw(existing);return}
 if(existing)existing.remove();
 var actions=screen.querySelector('.report-actions');
 var holder=document.createElement('div');
 holder.innerHTML=markup(best,ko);
 var section=holder.firstElementChild;
 section.dataset.guideLang=ko?'ko':'en';
 if(actions)screen.insertBefore(section,actions);else screen.appendChild(section);
 requestAnimationFrame(function(){draw(section)});
}
var scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;inject()})}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
window.addEventListener('resize',schedule);
if(window.ResizeObserver)new ResizeObserver(schedule).observe(root);
schedule();
})();
