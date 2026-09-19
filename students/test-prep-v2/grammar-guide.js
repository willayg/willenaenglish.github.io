import {currentRoute} from './navigation.js?v=2.21.3';
import {trackingState} from './tracking-client.js?v=2.17t';
import {resolveContentIds} from './content-source.js?v=2.24.4';
import {contentDbGet} from '../shared/content-db.js?v=1.0.0';

const CATALOG=[
  {key:'to-infinitive',title:'to부정사',aliases:['to_infinitive','to_infinitives','to_infinitive_nominal','to_infinitive_object','verb_to_infinitive','infinitive_to','infinitive','infinitive_roles','negative_infinitive','want_to','want to','would_like_to','ask_to','decide_to']},
  {key:'gerund',title:'동명사',aliases:['gerund','gerunds','gerund_subject','preposition_gerund','enjoy','enjoy gerund','stop_gerund','look_forward_to','look forward to + 동명사','be_good_at','be good at']},
  {key:'to-infinitive-vs-gerund',title:'to부정사 vs 동명사',aliases:['gerund_vs_infinitive','verb_complements']},
  {key:'to-infinitive-purpose',title:'목적을 나타내는 to부정사',aliases:['to_infinitive_purpose','purpose_infinitive','adverbial_purpose','purpose','infinitive_usage']},
  {key:'dummy-it',title:'가주어 it',aliases:['dummy_it','dummy_it_to_infinitive','it_to_infinitive','pronoun_it','weather_expressions']},
  {key:'comparatives',title:'비교급',aliases:['comparative','comparatives','comparative_forms','more_comparative','comparison','comparative_adverb','adverb_comparative','comparative_intensifier','comparative_paraphrase']},
  {key:'superlatives',title:'최상급',aliases:['superlative','superlatives','superlative_forms','superlative_adverb','best','biggest','shortest','smallest']},
  {key:'as-as',title:'as ... as 비교',aliases:['as_as_comparison','not_as_as','comparison_equivalence','as_as_possible']},
  {key:'comparative-correlative',title:'비교급 특수 표현',aliases:['comparative_correlative','comparative_and_comparative','progressive_comparative']},
  {key:'be-present',title:'현재형 be동사',aliases:['be_present']},
  {key:'simple-present',title:'현재시제',aliases:['simple_present','third_person_s','do_does','do_does_questions','do_questions','do_does_negatives','how_often']},
  {key:'questions',title:'의문문',aliases:['questions','be_questions','short_answers']},
  {key:'present-progressive',title:'현재진행형',aliases:['present_progressive','present_participle']},
  {key:'simple-past',title:'과거시제',aliases:['simple_past','past_tense','past','irregular_past','irregular_verbs','be_verb_past','ago']},
  {key:'past-progressive',title:'과거진행형',aliases:['past_progressive']},
  {key:'future',title:'미래 표현',aliases:['future','be_going_to','modal_will','future_time_expressions']},
  {key:'time-clauses',title:'시간 부사절',aliases:['when_clause','when_time_clause','when_future','time_clauses','present_in_time_clause','when_question','when']},
  {key:'modals',title:'조동사',aliases:['modal_can_will','modal_can','can_meanings','should','modal_should','should_not','should_question','have_to','be_able_to']},
  {key:'imperatives',title:'명령문',aliases:['imperatives']},
  {key:'there-be',title:'There is / There are',aliases:['there_is_are','there_be']},
  {key:'ditransitive',title:'4형식',aliases:['ditransitive_verbs','ditransitive','ditransitive_context','4형식','dative_prepositions','buy_for','buy for','give to']},
  {key:'linking-verbs',title:'감각·연결동사 + 형용사',aliases:['linking_verb_adjective','sensory_linking_verbs','linking_verbs','adjective_complements','become']},
  {key:'perception-verbs',title:'지각동사',aliases:['perception_verb','perception_verbs']},
  {key:'that-clauses',title:'that절',aliases:['that_clause','that_clauses','that_usage','that_omission','demonstrative_that']},
  {key:'passive',title:'수동태',aliases:['passive_voice']},
  {key:'agreement',title:'주어-동사 수일치',aliases:['subject_verb_agreement','agreement','plural_subjects']},
  {key:'reflexive',title:'재귀대명사',aliases:['reflexive_pronouns','reflexive_pronoun','emphatic_reflexive','reflexive_usage','reflexive_omission','herself','himself','yourself','yourselves','by_myself']},
  {key:'each-every',title:'each / every / all',aliases:['each','every','each_every','all','everyone']},
  {key:'pronouns',title:'대명사',aliases:['pronouns','object_pronouns','one_pronoun','one_usage']},
  {key:'adjective-adverb',title:'형용사와 부사',aliases:['adverbs','adjective_adverb','adjectives_adverbs','adverb','adverb_position']},
  {key:'prepositions',title:'전치사',aliases:['prepositions','by train','by_bicycle','for']},
  {key:'conjunctions',title:'접속사',aliases:['conjunctions','conjunction_but','although','although_but','contrast']},
  {key:'indirect-questions',title:'간접의문문',aliases:['indirect_questions']},
  {key:'countability',title:'셀 수 있는·없는 명사',aliases:['countability','countable_nouns','countable_uncountable','advice_uncountable']},
  {key:'sentence-patterns',title:'문장 형식과 어순',aliases:['word_order','sentence_roles','3형식','4형식','base_verb']},
  {key:'parallel-structure',title:'병렬구조',aliases:['parallel_structure']},
  {key:'sentence-transformation',title:'문장 전환',aliases:['sentence_transformation','paraphrase','sentence_combination']},
  {key:'conditionals',title:'조건문',aliases:['conditional']}
];

const GUIDES={
  'to-infinitive':{
    title:'to부정사',summary:'to + 동사원형이 문장에서 명사처럼 쓰이거나 동사의 목적어가 되는 패턴을 익혀요.',formula:'to + 동사원형',
    sections:[
      {title:'핵심 형태',pattern:'want / hope / plan / decide + to V',examples:[['want to','I want to be a chef.','나는 요리사가 되고 싶다.'],['plan to','We plan to visit Jeju.','우리는 제주도를 방문할 계획이다.'],['decide to','She decided to study harder.','그녀는 더 열심히 공부하기로 결정했다.']]},
      {title:'문장에서 하는 일',table:[['주어','To exercise is good for you.'],['목적어','I want to exercise.'],['보어','My dream is to travel.']]},
      {title:'자주 틀리는 점',note:'to 뒤에는 동사원형이 와요. to studying, to went처럼 쓰지 않아요. 부정형은 not to + 동사원형이에요.'}
    ],
    exam:{prompt:'다음 중 어법상 옳은 것은?',choices:['① She wants becoming a vet.','② She wants to be a vet.','③ She wants be a vet.'],answer:'② She wants to be a vet.',explanation:'want 뒤에는 보통 to + 동사원형을 사용해요.'},
    memory:[['형태','to + 동사원형'],['자주 나오는 동사','want · hope · plan · decide'],['부정','not to + V']]
  },
  'gerund':{
    title:'동명사',summary:'동사에 -ing를 붙여 명사처럼 쓰는 형태예요. 주어·목적어가 될 수 있고 특정 동사나 전치사 뒤에서 자주 나와요.',formula:'V-ing',
    sections:[
      {title:'동사 뒤 동명사',pattern:'enjoy / finish / avoid / suggest + V-ing',examples:[['enjoy','I enjoy reading books.','나는 책 읽는 것을 즐긴다.'],['finish','He finished doing his homework.','그는 숙제를 끝냈다.'],['avoid','She avoids eating late.','그녀는 늦게 먹는 것을 피한다.']]},
      {title:'전치사 뒤',pattern:'전치사 + V-ing',examples:[['be good at','She is good at drawing.','그녀는 그림을 잘 그린다.'],['look forward to','I look forward to meeting you.','나는 너를 만나기를 기대한다.']]},
      {title:'문장 속 역할',examples:[['주어','Reading every day helps me.','매일 읽는 것은 나에게 도움이 된다.'],['목적어','He enjoys cooking.','그는 요리하는 것을 즐긴다.']]},
      {title:'주의',note:'전치사 뒤의 to는 to부정사의 to와 달라요. look forward to, be used to 등의 to 뒤에는 V-ing가 와요.'}
    ],
    exam:{prompt:'빈칸에 알맞은 말을 고르세요. She is good at ___ pictures.',choices:['① draw','② to draw','③ drawing'],answer:'③ drawing',explanation:'at은 전치사이므로 뒤에 동명사 drawing이 와요.'},
    memory:[['동사 뒤','enjoy · finish · avoid · suggest + -ing'],['전치사 뒤','at / in / for / to(전치사) + -ing'],['역할','명사처럼 주어·목적어']]
  },
  'to-infinitive-vs-gerund':{
    title:'to부정사 vs 동명사',summary:'동사 뒤에 to + 동사원형이 오는지, 동사-ing가 오는지 구별해요.',formula:'동사에 따라 to V 또는 V-ing',
    sections:[
      {title:'to V를 쓰는 동사',pattern:'want / hope / plan / decide + to V',examples:[['want','I want to be a chef.','나는 요리사가 되고 싶다.'],['plan','We plan to travel.','우리는 여행할 계획이다.']]},
      {title:'V-ing를 쓰는 동사',pattern:'enjoy / finish / avoid / suggest + V-ing',examples:[['enjoy','I enjoy watching movies.','나는 영화 보는 것을 즐긴다.'],['finish','She finished cleaning.','그녀는 청소를 끝냈다.']]},
      {title:'둘 다 가능한 동사',pattern:'like / love / start / begin',note:'중학교 단계에서는 둘 다 가능한 형태로 먼저 기억하면 충분해요.'},
      {title:'시험 포인트',note:'보기에서 동사만 보지 말고 바로 앞 동사가 무엇인지 먼저 확인하세요. plan joining, enjoy to watch 같은 조합이 대표적인 함정이에요.'}
    ],
    exam:{prompt:'다음 중 어법상 틀린 것은?',choices:['① I decided to study harder.','② We enjoy watching movies.','③ Mina plans joining the club.'],answer:'③ Mina plans joining the club.',explanation:'plan 뒤에는 to + 동사원형이 와서 plans to join이 맞아요.'},
    memory:[['to V','want · hope · plan · decide'],['V-ing','enjoy · finish · avoid · suggest']]
  },
  'comparatives':{
    title:'비교급',summary:'두 사람이나 사물을 비교할 때 형용사·부사의 비교급을 사용해요. 형태 변화와 than, 강조 표현을 함께 봐야 해요.',formula:'A + be + 비교급 + than + B',
    sections:[
      {title:'기본 변화',pattern:'-er / more',table:[['tall','taller'],['busy','busier'],['big','bigger'],['beautiful','more beautiful'],['good','better']]},
      {title:'문장 속 비교',examples:[['than','Tom is taller than Jake.','Tom은 Jake보다 키가 크다.'],['more','This book is more interesting than that one.','이 책이 저 책보다 더 흥미롭다.']]},
      {title:'비교급 강조',table:[['much / far','훨씬'],['a lot','훨씬'],['a little','조금']]},
      {title:'주의',note:'비교급 앞에 very를 쓰지 않아요. than 뒤의 비교 대상이 문맥상 같은 종류인지도 확인하세요.'}
    ],
    exam:{prompt:'빈칸에 알맞은 말을 고르세요. My bag is ___ than yours.',choices:['① heavy','② heavier','③ heaviest'],answer:'② heavier',explanation:'than이 있고 두 대상을 비교하므로 비교급 heavier가 필요해요.'},
    memory:[['두 대상 비교','비교급 + than'],['긴 형용사','more + 형용사'],['강조','much · far · a lot · a little'],['불규칙','good → better']]
  },
  'be-present':{
    title:'현재형 be동사',summary:'주어의 상태·신분·위치 등을 말할 때 am, is, are를 써요. 주어에 따라 형태가 달라져요.',formula:'I am · he/she/it is · you/we/they are',
    sections:[
      {title:'주어에 맞는 be동사',table:[['I','am'],['he / she / it / 단수','is'],['you / we / they / 복수','are']]},
      {title:'부정문',examples:[['am not','I am not tired.','나는 피곤하지 않다.'],['is not','She is not at home.','그녀는 집에 있지 않다.'],['are not','They are not busy.','그들은 바쁘지 않다.']]},
      {title:'의문문',pattern:'Be + 주어 ...?',examples:[['Is','Is he your brother?','그는 네 남동생이니?'],['Are','Are they ready?','그들은 준비됐니?']]},
      {title:'시험 함정',note:'be동사가 있는 문장에 do/does를 또 넣지 않아요. Is she happy?가 맞고 Does she is happy?는 틀려요.'}
    ],
    exam:{prompt:'다음 중 어법상 옳은 것은?',choices:['① She are kind.','② She is kind.','③ She do kind.'],answer:'② She is kind.',explanation:'she는 3인칭 단수이므로 현재형 be동사 is를 써요.'},
    memory:[['I','am'],['단수','is'],['복수 / you','are'],['의문문','be동사를 앞으로']]
  },
  'simple-present':{
    title:'현재시제',summary:'반복되는 습관, 일반적인 사실, 현재의 상태를 말할 때 현재시제를 써요.',formula:'주어 + 동사원형 / 3인칭 단수는 V-s',
    sections:[
      {title:'언제 쓰나요?',examples:[['습관','I walk to school every day.','나는 매일 걸어서 학교에 간다.'],['사실','Water boils at 100°C.','물은 100도에서 끓는다.']]},
      {title:'3인칭 단수',table:[['play','plays'],['study','studies'],['go','goes'],['have','has']]},
      {title:'부정문·의문문',table:[['I/you/we/they','do / do not'],['he/she/it','does / does not']]},
      {title:'주의',note:'does가 나오면 뒤 동사는 원형이에요. He does not likes가 아니라 He does not like예요.'}
    ],
    exam:{prompt:'Mina ___ English every evening.',choices:['① study','② studies','③ studying'],answer:'② studies',explanation:'Mina는 3인칭 단수이고 반복되는 습관이므로 studies를 써요.'},
    memory:[['3인칭 단수','V-s / V-es'],['does 뒤','동사원형'],['신호','every day · usually · often']]
  },
  'questions':{
    title:'의문문',summary:'be동사 문장인지 일반동사 문장인지 먼저 보고 질문 형태를 결정해요.',formula:'Be + S ...? / Do·Does + S + V ...?',
    sections:[
      {title:'be동사 의문문',examples:[['Is','Is Mina at home?','미나는 집에 있니?'],['Are','Are you ready?','너는 준비됐니?']]},
      {title:'일반동사 의문문',examples:[['Do','Do they play soccer?','그들은 축구를 하니?'],['Does','Does he like music?','그는 음악을 좋아하니?']]},
      {title:'의문사',pattern:'의문사 + 의문문 어순',examples:[['What','What do you want?','너는 무엇을 원하니?'],['Where','Where does she live?','그녀는 어디에 사니?']]},
      {title:'주의',note:'Does 뒤에서는 동사가 원형으로 돌아가요. Does he likes가 아니라 Does he like예요.'}
    ],
    exam:{prompt:'다음 중 올바른 의문문은?',choices:['① Does he likes soccer?','② Does he like soccer?','③ Is he like soccer?'],answer:'② Does he like soccer?',explanation:'일반동사 like의 의문문은 Does + 주어 + 동사원형이에요.'},
    memory:[['be동사','be를 앞으로'],['일반동사','Do/Does + S + V'],['Does 뒤','동사원형']]
  },
  'present-progressive':{
    title:'현재진행형',summary:'지금 하고 있는 동작이나 현재 진행 중인 상황을 말할 때 be동사 + 동사-ing를 사용해요.',formula:'am / is / are + V-ing',
    sections:[
      {title:'형태',examples:[['I','I am studying now.','나는 지금 공부하고 있다.'],['She','She is reading a book.','그녀는 책을 읽고 있다.'],['They','They are playing soccer.','그들은 축구를 하고 있다.']]},
      {title:'철자 변화',table:[['make','making'],['run','running'],['lie','lying']]},
      {title:'부정문·의문문',table:[['부정','be + not + V-ing'],['의문','Be + 주어 + V-ing?']]},
      {title:'현재시제와 구별',note:'usually, every day처럼 반복되는 습관은 현재시제, now, right now처럼 지금 진행 중이면 현재진행형이 자주 와요.'}
    ],
    exam:{prompt:'Look! The boy ___ across the street now.',choices:['① runs','② is running','③ ran'],answer:'② is running',explanation:'Look!과 now가 현재 진행 중인 동작을 나타내므로 is running이 맞아요.'},
    memory:[['형태','be + V-ing'],['부정','be + not + V-ing'],['신호','now · right now · Look!']]
  },
  'ditransitive':{
    title:'4형식',summary:'누구에게 무엇을 주거나 보여 주는 문장에서 사람 목적어와 사물 목적어가 함께 나와요. 3형식 전환이 시험에 자주 나와요.',formula:'주어 + 동사 + 사람 + 사물',
    sections:[
      {title:'4형식 기본',examples:[['give','She gave me a gift.','그녀는 나에게 선물을 주었다.'],['show','He showed us the picture.','그는 우리에게 사진을 보여 주었다.']]},
      {title:'3형식으로 바꾸기',table:[['give me a gift','give a gift to me'],['show us the picture','show the picture to us'],['buy me a bag','buy a bag for me']]},
      {title:'to를 쓰는 동사',pattern:'give / show / send / tell',note:'사물 + to + 사람의 형태로 바꿔요.'},
      {title:'for를 쓰는 동사',pattern:'buy / make / get / cook',note:'사물 + for + 사람의 형태로 바꿔요.'},
      {title:'시험 함정',note:'동사마다 to와 for가 정해져 있어요. 뜻만 보고 고르지 말고 동사와 전치사를 묶어서 기억하세요.'}
    ],
    exam:{prompt:'다음 두 문장이 같은 뜻이 되도록 고르세요. Dad bought me a bike. = Dad bought a bike ___ me.',choices:['① to','② for','③ at'],answer:'② for',explanation:'buy는 4형식을 3형식으로 바꿀 때 보통 for를 사용해요.'},
    memory:[['4형식','동사 + 사람 + 사물'],['give/show/send','사물 + to + 사람'],['buy/make','사물 + for + 사람']]
  }
};

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm=value=>String(value??'').trim().toLowerCase().replace(/[\s-]+/g,'_');
const aliasMap=new Map();
CATALOG.forEach(item=>item.aliases.forEach(alias=>aliasMap.set(norm(alias),item.key)));
const catalogMap=new Map(CATALOG.map(item=>[item.key,item]));
let overlay=null,installToken=0;

function resolveGuideKeys(targets){
  const raw=[...new Set((targets||[]).map(norm).filter(Boolean))];
  const found=[];
  raw.forEach(target=>{const key=aliasMap.get(target);if(key&&!found.includes(key))found.push(key)});
  if(found.includes('to-infinitive-vs-gerund'))return ['to-infinitive-vs-gerund',...found.filter(k=>!['to-infinitive','gerund','to-infinitive-vs-gerund'].includes(k))];
  return found;
}

function sectionMarkup(section){
  const examples=(section.examples||[]).length?`<div class="gg-example-list">${section.examples.map(([label,en,ko])=>`<div class="gg-example"><b>${esc(label)}</b><div><span>${esc(en)}</span>${ko?`<small>${esc(ko)}</small>`:''}</div></div>`).join('')}</div>`:'';
  const table=(section.table||[]).length?`<div class="gg-table">${section.table.map(([a,b])=>`<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div>`:'';
  return `<section class="gg-section"><div class="gg-section-head"><span>${esc(section.title)}</span>${section.pattern?`<strong>${esc(section.pattern)}</strong>`:''}</div>${examples}${table}${section.note?`<div class="gg-tip">💡 ${esc(section.note)}</div>`:''}</section>`;
}

function guideMarkup(guide){
  const exam=guide.exam?`<details class="gg-exam"><summary><span>시험에서는 이렇게 나와요</span><b>문제 보기 +</b></summary><div class="gg-exam-body"><p class="gg-exam-prompt">${esc(guide.exam.prompt)}</p><div class="gg-exam-choices">${guide.exam.choices.map(choice=>`<span>${esc(choice)}</span>`).join('')}</div><div class="gg-answer"><b>정답</b><span>${esc(guide.exam.answer)}</span><small>${esc(guide.exam.explanation)}</small></div></div></details>`:'';
  return `<div class="gg-sheet" role="dialog" aria-modal="true" aria-labelledby="ggTitle"><div class="gg-topbar"><button type="button" class="gg-back" data-gg-close aria-label="문법 설명 닫기">←</button><div><small>문법 핵심 정리</small><strong>Willena Grammar</strong></div></div><header class="gg-hero"><span class="gg-kicker">GRAMMAR</span><h1 id="ggTitle">${esc(guide.title)}</h1><p>${esc(guide.summary)}</p><div class="gg-formula">${esc(guide.formula)}</div></header>${guide.sections.map(sectionMarkup).join('')}${exam}<section class="gg-memory"><h2>시험 직전 이것만 기억!</h2>${guide.memory.map(([left,right])=>`<div><b>${esc(left)}</b><span>${esc(right)}</span></div>`).join('')}</section><button type="button" class="gg-done" data-gg-close>확인했어요</button></div>`;
}

function closeGuide(){if(!overlay)return;overlay.remove();overlay=null;document.body.classList.remove('grammar-guide-open')}
function openGuide(key){const guide=GUIDES[key];if(!guide)return;closeGuide();overlay=document.createElement('div');overlay.className='grammar-guide-overlay';overlay.innerHTML=guideMarkup(guide);overlay.addEventListener('click',event=>{if(event.target===overlay||event.target.closest('[data-gg-close]'))closeGuide()});document.body.appendChild(overlay);document.body.classList.add('grammar-guide-open');overlay.querySelector('.gg-back')?.focus()}

async function lessonTargets(){
  const route=currentRoute?.()||{};
  if(route.view!=='lesson'||!route.planId||!route.lesson)return null;
  const plan=(trackingState().plans||[]).find(p=>String(p.id)===String(route.planId));
  if(!plan)return null;
  const ids=await resolveContentIds(plan,route.lesson);
  if(!ids?.unitId)return {route,plan,ids,targets:[]};
  const rows=await contentDbGet(`/rest/v1/content_units?select=metadata&id=eq.${encodeURIComponent(ids.unitId)}&limit=1`);
  const stated=Array.isArray(rows?.[0]?.metadata?.main_grammar_points)?rows[0].metadata.main_grammar_points:[];
  return {route,plan,ids,targets:[...new Set(stated.map(String))]};
}

function renderLauncher(panel,keys,rawTargets){
  const available=keys.filter(key=>GUIDES[key]);
  const pending=keys.filter(key=>!GUIDES[key]);
  if(!keys.length){panel.innerHTML='<div class="gg-launch-empty"><b>문법 설명</b><small>이 Lesson의 문법 목표가 아직 등록되지 않았어요.</small></div>';panel.title='Lesson grammar targets: ';return}
  panel.innerHTML=`<div class="gg-launch-head"><b>문법 설명</b><small>${keys.length}개 문법 포인트</small></div><div class="gg-launch-list">${available.map(key=>{const item=catalogMap.get(key),guide=GUIDES[key];return `<button type="button" class="grammar-guide-launch" data-grammar-guide="${esc(key)}"><span>${esc(item?.title||guide.title)}</span><small>${esc(guide.formula)}</small><b>보기 →</b></button>`}).join('')}</div>${pending.length?`<div class="gg-pending"><span>설명 준비 중</span>${pending.slice(0,4).map(key=>`<small>${esc(catalogMap.get(key)?.title||key)}</small>`).join('')}${pending.length>4?`<small>+${pending.length-4}</small>`:''}</div>`:''}`;
  panel.querySelectorAll('[data-grammar-guide]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openGuide(button.dataset.grammarGuide)}));
  panel.title=`Lesson grammar targets: ${rawTargets.join(', ')}`;
}

async function hydratePanel(stop,panel,token,attempt=0){
  try{
    const context=await lessonTargets();
    if(token!==installToken||!stop.isConnected)return;
    if(!context){
      if(attempt<1){
        setTimeout(()=>hydratePanel(stop,panel,token,attempt+1),180);
      }else if(panel.isConnected){
        panel.innerHTML='<div class="gg-launch-empty"><b>문법 설명</b><small>문법 정보를 불러오지 못했습니다.</small></div>';
      }
      return;
    }
    const route=currentRoute?.()||{};
    if(route.view!=='lesson'||String(route.planId)!==String(context.route.planId)||String(route.lesson)!==String(context.route.lesson))return;
    const keys=resolveGuideKeys(context.targets);
    renderLauncher(panel,keys,context.targets);
  }catch(error){
    console.warn('[grammar-guide] stated-target resolver failed',error);
    if(token===installToken&&panel.isConnected)panel.innerHTML='<div class="gg-launch-empty"><b>문법 설명</b><small>문법 정보를 불러오지 못했습니다.</small></div>';
  }
}

function installGuidePanel(){
  const stop=document.querySelector('.journey-stop[data-practice="grammar"]');
  if(!stop||stop.dataset.grammarGuideInstalled==='1')return;
  stop.dataset.grammarGuideInstalled='1';
  const copy=stop.querySelector('.stop-copy');if(!copy)return;
  const panel=document.createElement('div');panel.className='grammar-guide-panel';panel.innerHTML='<div class="gg-launch-empty"><b>문법 설명</b><small>문법 포인트 찾는 중…</small></div>';
  panel.addEventListener('click',event=>event.stopPropagation());copy.appendChild(panel);
  const token=++installToken;hydratePanel(stop,panel,token);
}

const observer=new MutationObserver(installGuidePanel);
observer.observe(document.documentElement,{childList:true,subtree:true});
installGuidePanel();
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&overlay)closeGuide()});

export {CATALOG,GUIDES,resolveGuideKeys,openGuide,closeGuide};