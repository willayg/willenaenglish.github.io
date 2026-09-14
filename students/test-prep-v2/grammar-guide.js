const cssHref='./grammar-guide.css?v=1.0.0';
if(!document.querySelector('link[data-grammar-guide-style]')){
  const link=document.createElement('link');
  link.rel='stylesheet';link.href=cssHref;link.dataset.grammarGuideStyle='1';document.head.appendChild(link);
}

const GUIDES={
  'to-infinitive-vs-gerund':{
    eyebrow:'문법 핵심 정리',
    title:'to부정사 vs 동명사',
    summary:'동사 뒤에 to + 동사원형이 오는지, 동사-ing가 오는지 구별해요.',
    rules:[
      {title:'to + 동사원형',tone:'to',pattern:'want / hope / plan / decide + to V',items:[
        ['want to','I want to be a chef.','나는 요리사가 되고 싶다.'],
        ['hope to','I hope to travel someday.','나는 언젠가 여행하기를 바란다.'],
        ['plan to','We plan to visit Jeju.','우리는 제주도를 방문할 계획이다.'],
        ['decide to','She decided to study harder.','그녀는 더 열심히 공부하기로 결정했다.']
      ]},
      {title:'동명사 (-ing)',tone:'ing',pattern:'enjoy / finish / avoid / suggest + V-ing',items:[
        ['enjoy ~ing','I enjoy reading books.','나는 책 읽는 것을 즐긴다.'],
        ['finish ~ing','He finished doing his homework.','그는 숙제하는 것을 끝냈다.'],
        ['avoid ~ing','She avoids eating late.','그녀는 늦게 먹는 것을 피한다.'],
        ['suggest ~ing','Mina suggested going together.','미나는 함께 가자고 제안했다.']
      ]}
    ],
    preposition:{title:'전치사 뒤에는 동명사',pattern:'전치사 + V-ing',examples:[
      ['be good at + V-ing','She is good at drawing.'],
      ['look forward to + V-ing','I look forward to meeting you.'],
      ['Thank you for + V-ing','Thank you for helping me.'],
      ['be interested in + V-ing','He is interested in making movies.']
    ],note:'look forward to의 to는 to부정사의 to가 아니라 전치사예요.'},
    both:{title:'둘 다 가능한 동사',verbs:['like','love','start','begin'],examples:['I like to read.','I like reading.'],note:'이 단계에서는 둘 다 가능한 형태로 기억하면 됩니다.'},
    caution:{title:'뜻이 달라질 수 있어요',rows:[
      ['remember to V','앞으로 할 것을 기억하다'],['remember V-ing','이미 한 것을 기억하다'],
      ['stop to V','~하기 위해 멈추다'],['stop V-ing','~하는 것을 그만두다'],
      ['try to V','~하려고 노력하다'],['try V-ing','시험 삼아 ~해 보다']
    ]},
    memory:[['to V','want · hope · plan · decide'],['V-ing','enjoy · finish · avoid · suggest'],['전치사 + V-ing','good at · look forward to · for · in']]
  }
};

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let overlay=null;

function guideMarkup(guide){
  const rules=guide.rules.map(rule=>`<section class="gg-section gg-rule gg-${esc(rule.tone)}"><div class="gg-section-head"><span>${esc(rule.title)}</span><strong>${esc(rule.pattern)}</strong></div><div class="gg-example-list">${rule.items.map(([label,en,ko])=>`<div class="gg-example"><b>${esc(label)}</b><div><span>${esc(en)}</span><small>${esc(ko)}</small></div></div>`).join('')}</div></section>`).join('');
  return `<div class="gg-sheet" role="dialog" aria-modal="true" aria-labelledby="ggTitle"><div class="gg-topbar"><button type="button" class="gg-back" data-gg-close aria-label="문법 설명 닫기">←</button><div><small>${esc(guide.eyebrow)}</small><strong>Willena Grammar</strong></div></div><header class="gg-hero"><span class="gg-kicker">GRAMMAR</span><h1 id="ggTitle">${esc(guide.title)}</h1><p>${esc(guide.summary)}</p></header>${rules}<section class="gg-section gg-preposition"><div class="gg-section-head"><span>${esc(guide.preposition.title)}</span><strong>${esc(guide.preposition.pattern)}</strong></div><div class="gg-chip-grid">${guide.preposition.examples.map(([label,en])=>`<div class="gg-chip"><b>${esc(label)}</b><span>${esc(en)}</span></div>`).join('')}</div><div class="gg-tip">💡 ${esc(guide.preposition.note)}</div></section><section class="gg-section"><div class="gg-section-head"><span>${esc(guide.both.title)}</span><strong>${guide.both.verbs.map(esc).join(' · ')}</strong></div><div class="gg-pair"><span>${esc(guide.both.examples[0])}</span><span>${esc(guide.both.examples[1])}</span></div><p class="gg-note">${esc(guide.both.note)}</p></section><section class="gg-section gg-caution"><div class="gg-section-head"><span>주의</span><strong>${esc(guide.caution.title)}</strong></div><div class="gg-meaning-table">${guide.caution.rows.map(([form,meaning])=>`<div><b>${esc(form)}</b><span>${esc(meaning)}</span></div>`).join('')}</div></section><section class="gg-memory"><h2>시험 직전 이것만 기억!</h2>${guide.memory.map(([left,right])=>`<div><b>${esc(left)}</b><span>${esc(right)}</span></div>`).join('')}</section><button type="button" class="gg-done" data-gg-close>확인했어요</button></div>`;
}

function closeGuide(){if(!overlay)return;overlay.remove();overlay=null;document.body.classList.remove('grammar-guide-open')}
function openGuide(key='to-infinitive-vs-gerund'){
  const guide=GUIDES[key];if(!guide)return;closeGuide();overlay=document.createElement('div');overlay.className='grammar-guide-overlay';overlay.innerHTML=guideMarkup(guide);overlay.addEventListener('click',event=>{if(event.target===overlay||event.target.closest('[data-gg-close]'))closeGuide()});document.body.appendChild(overlay);document.body.classList.add('grammar-guide-open');overlay.querySelector('.gg-back')?.focus();
}
function installGuideButton(){
  document.querySelectorAll('.journey-stop[data-practice="grammar"]').forEach(stop=>{
    if(stop.querySelector('[data-grammar-guide]'))return;const copy=stop.querySelector('.stop-copy');if(!copy)return;
    const button=document.createElement('button');button.type='button';button.className='grammar-guide-launch';button.dataset.grammarGuide='to-infinitive-vs-gerund';button.innerHTML='<span>문법 설명</span><small>to부정사 vs 동명사</small><b>보기 →</b>';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openGuide(button.dataset.grammarGuide)});copy.appendChild(button);
  });
}
const observer=new MutationObserver(installGuideButton);observer.observe(document.documentElement,{childList:true,subtree:true});installGuideButton();
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&overlay)closeGuide()});
export {GUIDES,openGuide,closeGuide};
