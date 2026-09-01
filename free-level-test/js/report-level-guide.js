(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;
var levels=[
 ['S1','Starter 1','스타터 1','Beginning English. Students learn letters and sounds together with very familiar words for colours, numbers, objects, names and age, using short patterns such as What is it?, What color is it?, How are you?, I like…, I have… and I can….','기초 영어의 시작 단계입니다. 알파벳과 소리를 익히면서 색깔, 숫자, 사물, 이름, 나이처럼 매우 익숙한 주제의 단어와 짧은 표현을 배웁니다. What is it?, What color is it?, How are you?, I like…, I have…, I can… 같은 기본 질문과 대답을 중심으로 학습합니다.'],
 ['S2','Starter 2','스타터 2','Students begin expressing people, objects, location, weather, wants and ability in basic sentences, using patterns such as This/That, There is/are, in/on/under, I want…, Can you…?, Who’s this? and Where is…?.','기초 문장으로 사람과 사물, 위치, 날씨, 원하는 것과 할 수 있는 것을 표현하는 단계입니다. This/That, There is/are, in/on/under, I want…, Can you…?, Who’s this?, Where is…? 같은 표현을 익힙니다.'],
 ['1','Level 1','레벨 1','Students work with a wider range of basic sentences, using this/that/these/those, there is/are, in/on/under, have/has, can, like and want to describe people, objects, location, possession, ability and preference.','기초 영어 문장을 폭넓게 다루기 시작하는 단계입니다. 사물과 사람을 this/that/these/those로 구별하고, there is/are와 in/on/under로 위치를 말하며, have/has, can, like, want를 사용해 소유·능력·선호를 표현합니다. 이름, 나이, 가족, 색깔, 수량, 사물에 관한 기본 질문과 대답도 다룹니다.'],
 ['2','Level 2','레벨 2','Students describe actions happening now, time, jobs, possession, routines and location. They begin using the present continuous, third-person forms, whose, what time, there is/are and a wider range of location expressions.','현재 일어나고 있는 행동, 시간, 직업, 소유, 일상 습관과 위치를 표현하는 단계입니다. 현재진행형, 3인칭 단수, whose, what time, there is/are와 다양한 위치 표현을 사용하며 문장이 조금 더 길어집니다.'],
 ['3','Level 3','레벨 3','Students work with routines and schedules, jobs, places, possession, past states and near-future plans, using some/any, whose, time and place prepositions, frequency expressions, third-person routines, was/were and be going to.','일과와 일정, 직업, 장소, 소유, 과거의 상태와 가까운 미래 계획을 다루는 단계입니다. some/any, whose, 시간·장소 전치사, 빈도 표현, 3인칭 습관, was/were, be going to 등을 사용합니다.'],
 ['4','Level 4','레벨 4','Students describe past actions and experiences, future plans, comparisons, health, advice, obligation and reasons, using the simple past, be going to, should, have to, comparatives, because and date/time expressions.','과거의 행동과 경험, 미래 계획, 비교, 건강과 조언, 의무와 이유를 표현하는 단계입니다. 단순과거, be going to, should, have to, 비교급, because와 날짜·시간 표현을 본격적으로 다룹니다.'],
 ['5','Level 5','레벨 5','Students describe past experience in more detail and work with experience, prediction, comparison, superlatives, quantity, senses and manner, including irregular past forms, present perfect, will, past continuous and a few/a little/a lot of.','과거 경험을 더 자세히 설명하고, 경험 여부, 미래 예측, 비교·최상급, 수량, 감각과 행동 방식을 표현하는 단계입니다. 불규칙 과거, 현재완료, will, 과거진행형, 비교급·최상급, a few/a little/a lot of 등을 다룹니다.'],
 ['6','Level 6','레벨 6','Students connect multiple time frames and express experience, duration, conditions and reported ideas. They work with present perfect already/yet/for/since, past continuous with when, would, wish, reported speech, have to and comparatives/superlatives.','여러 시제를 연결하고 가정·경험·기간·간접 전달을 표현하는 상위 초등 과정 단계입니다. 현재완료의 already/yet/for/since, 과거진행형과 when, would 가정, wish, reported speech, have to, 비교급·최상급 등을 다룹니다.'],
 ['7','Level 7','레벨 7','Students move from advanced elementary English toward middle-school structures, working with reported statements, questions and commands, unreal conditions, contrast with however and verb patterns such as stop doing / stop to do.','초등 고급 과정에서 중등 영어로 넘어가는 단계입니다. 직접화법을 간접화법으로 바꾸고, 명령·질문을 전달하며, unreal condition, however 같은 대조 연결, stop doing / stop to do처럼 의미가 달라지는 동사 패턴을 다룹니다.'],
 ['8','Level 8','레벨 8','Students work with key advanced middle-school structures including unless, third conditionals, should/must/might have + past participle, present wish, non-defining which clauses and expressions of likelihood.','중등 문법의 핵심 고급 구조를 다루는 단계입니다. unless, 3rd conditional, should/must/might have + p.p., 현재에 대한 wish, 비제한적 which절과 likely 같은 가능성 표현을 다룹니다.'],
 ['9','Level 9','레벨 9','Students handle upper middle-school sentence structures and logical connections, including mixed conditionals, past wish, formal passive reporting, reduced relative clauses, have something done, despite/whereas, concession and counterargument.','중등 상위 수준의 문장 구조와 논리 연결을 다루는 단계입니다. mixed conditional, 과거에 대한 wish, formal passive reporting, reduced relative clauses, have something done, despite/whereas, 양보와 반론 표현 등을 다룹니다.'],
 ['10','Level 10','레벨 10','Students work at the bridge from top-level middle-school English into high-school preparation, using inversion, what-clefts, emphatic do, formal passive reporting, needn’t have and other structures that control emphasis, formality and nuance. At this level, a student has enough English to begin English-medium or overseas study successfully, while continuing to develop academic vocabulary, speed and precision.','중등 최상위에서 고등 예비 수준으로 넘어가는 문장 구조를 다루는 단계입니다. 도치(never/rarely), what-cleft, emphatic do, formal passive reporting, needn’t have와 가능성 표현처럼 강조·격식·뉘앙스를 조절하는 구조를 다룹니다. 이 정도 수준이면 영어권 또는 영어로 수업하는 환경에서 학업을 시작할 수 있는 기반이 있으며, 학술 어휘와 처리 속도, 표현의 정확성은 이후 학습을 통해 계속 발전시켜 나가게 됩니다.']
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