(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;
var levels=[
 ['S1','Starter 1','스타터 1','Can recognise some letters and sounds, understand a few familiar classroom words and give very short responses.','일부 알파벳과 소리를 알아보고 익숙한 교실 단어를 이해하며 매우 짧게 대답할 수 있습니다.'],
 ['S2','Starter 2','스타터 2','Can identify common objects, colours, numbers and actions, and use short memorised sentences.','익숙한 사물, 색깔, 숫자와 동작을 알아보고 짧게 외운 문장을 사용할 수 있습니다.'],
 ['1','Level 1','레벨 1','Can understand basic present-tense sentences and answer simple personal questions in short complete sentences.','기본적인 현재형 문장을 이해하고 간단한 개인 질문에 짧은 완전한 문장으로 답할 수 있습니다.'],
 ['2','Level 2','레벨 2','Can talk about routines, location, ability and simple personal information, and read short connected sentences.','일상 활동, 위치, 능력과 간단한 개인 정보를 말하고 짧게 연결된 문장을 읽을 수 있습니다.'],
 ['3','Level 3','레벨 3','Can describe past events and future plans and connect simple ideas using and, but and because.','과거의 일과 미래 계획을 설명하고 and, but, because를 사용해 간단한 생각을 연결할 수 있습니다.'],
 ['4','Level 4','레벨 4','Can use a broader range of tenses and explain experiences, preferences and simple reasons in greater detail.','더 다양한 시제를 사용하고 경험, 선호와 간단한 이유를 더 자세히 설명할 수 있습니다.'],
 ['5','Level 5','레벨 5','Can compare people and things, understand connected stories and factual texts, and communicate clearly about familiar everyday topics.','사람과 사물을 비교하고 연결된 이야기와 정보 글을 이해하며 익숙한 일상 주제에 대해 분명히 표현할 수 있습니다.'],
 ['6','Level 6','레벨 6','Can handle intermediate grammar and longer texts, compare ideas, explain causes and results, and produce connected responses with increasing independence.','중급 문법과 더 긴 글을 다루고 생각을 비교하며 원인과 결과를 설명하고 점점 더 독립적으로 연결된 답변을 만들 수 있습니다.'],
 ['7','Level 7','레벨 7','Can understand conditional meaning, present perfect forms, reported ideas and more complex relationships between events.','조건의 의미, 현재완료, 전달된 생각과 사건 사이의 더 복잡한 관계를 이해할 수 있습니다.'],
 ['8','Level 8','레벨 8','Can understand advanced middle-school grammar and follow detailed explanations with less support.','중학교 상위 문법을 이해하고 도움을 덜 받으면서 자세한 설명을 따라갈 수 있습니다.'],
 ['9','Level 9','레벨 9','Can analyse complex sentences and understand arguments, assumptions and speaker position.','복잡한 문장을 분석하고 주장, 가정과 화자의 입장을 이해할 수 있습니다.'],
 ['10','Level 10','레벨 10','Can handle high-school bridge English, abstract vocabulary, dense texts, implied conclusions and nuanced meaning.','고등학교 진입 수준의 영어, 추상 어휘, 밀도 높은 글, 함축된 결론과 미묘한 의미를 다룰 수 있습니다.']
];
function fallbackLevel(){
 var box=root.querySelector('.report-screen .report-level');
 if(!box)return 0;
 var prefix=(box.querySelector('span')||{}).textContent||'';
 var value=Number(((box.querySelector('strong')||{}).textContent||'').trim());
 if(!Number.isFinite(value))return 0;
 return Math.max(1,Math.min(12,/starter|스타터/i.test(prefix)?value:value+2));
}
function currentLevel(){
 var n=Number(window.WillenaStoredInternalLevel||window.WillenaInternalResultLevel);
 return Number.isFinite(n)&&n>0?Math.max(1,Math.min(12,n)):fallbackLevel();
}
function badge(stage,best,ko){
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
  var cls=stage===best?'is-current':Math.abs(stage-best)===1?'is-adjacent':stage<best?'is-complete':'';
  return '<article class="report-level-guide__row '+cls+'" data-guide-stage="'+stage+'"><div class="report-level-guide__circle">'+item[0]+'</div><div class="report-level-guide__description">'+badge(stage,best,ko)+'<h4>'+(ko?item[2]:item[1])+'</h4><p>'+(ko?item[4]:item[3])+'</p>'+note(stage,best,ko)+'</div></article>';
 }).join('');
 return '<section class="report-level-guide willena-full-level-guide" data-guide-best="'+best+'" data-guide-lang="'+(ko?'ko':'en')+'"><header class="report-level-guide__header"><span class="report-level-guide__eyebrow">'+(ko?'레벨 안내':'Level guide')+'</span><h3>Willena Level</h3></header><div class="report-level-guide__list">'+rows+'</div></section>';
}
function removeOtherGuides(screen){
 screen.querySelectorAll('.report-level-guide,.level-guide,.level-guide-section,[data-level-guide]').forEach(function(el){if(!el.classList.contains('willena-full-level-guide'))el.remove()});
}
function inject(force){
 var screen=root.querySelector('.report-screen');
 if(!screen)return;
 var best=currentLevel();
 if(!best)return;
 var ko=document.documentElement.lang==='ko';
 removeOtherGuides(screen);
 var existing=screen.querySelector('.willena-full-level-guide');
 if(!force&&existing&&Number(existing.dataset.guideBest)===best&&existing.dataset.guideLang===(ko?'ko':'en'))return;
 if(existing)existing.remove();
 var holder=document.createElement('div');holder.innerHTML=markup(best,ko);
 var actions=screen.querySelector('.report-actions');
 if(actions)screen.insertBefore(holder.firstElementChild,actions);else screen.appendChild(holder.firstElementChild);
}
var queued=false;
function schedule(force){if(queued&&!force)return;queued=true;requestAnimationFrame(function(){queued=false;inject(Boolean(force))})}
new MutationObserver(function(){schedule(false)}).observe(root,{childList:true,subtree:true});
new MutationObserver(function(){schedule(true)}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
window.addEventListener('willena:stored-level-ready',function(){schedule(true)});
schedule(true);
})();
