import '../test-prep-v2/grammar-guide-extra.js?v=1.0.0';
import '../test-prep-v2/grammar-guide-single.js?v=1.2.1';
import {GUIDES,resolveGuideKeys,openGuide} from '../test-prep-v2/grammar-guide.js?v=2.1.0';

const root=document.getElementById('screen');

const FALLBACK_KEYS={
  be_present:'be-present',
  simple_present:'simple-present',
  imperatives:'imperatives',
  questions:'questions',
  modal_can_will:'modals',
  present_progressive:'present-progressive',
  simple_past:'simple-past',
  there_is_are:'there-be',
  dummy_it:'dummy-it',
  to_infinitive_object:'to-infinitive',
  gerund:'gerund',
  sensory_linking_verbs:'linking-verbs',
  comparatives:'comparatives',
  when_clause:'time-clauses',
  ditransitive_verbs:'ditransitive',
  that_clause:'that-clauses',
  pronouns_possessives:'pronouns',
  articles:'articles',
  countable_uncountable:'countability',
  prepositions_time_place:'prepositions',
  adjectives_adverbs:'adjective-adverb',
  to_infinitive_adverbial:'to-infinitive-purpose',
  basic_conjunctions:'conjunctions',
  modals_obligation_advice:'modals',
  present_perfect:'present-perfect',
  passive_voice:'passive',
  relative_pronouns:'relative-pronouns',
  too_enough:'too-enough',
  if_clauses:'conditionals',
  indirect_questions:'indirect-questions',
  participle_adjectives:'participle-adjectives',
  causative_basics:'causative-verbs',
  superlatives:'superlatives',
  as_as:'as-as',
  infinitive_vs_gerund:'to-infinitive-vs-gerund',
  verb_object_to_infinitive:'verb-object-to-infinitive',
  relative_adverbs:'relative-adverbs',
  present_perfect_vs_past:'present-perfect-vs-past',
  advanced_passive:'passive',
  participle_clauses:'participle-clauses',
  second_conditional:'conditionals',
  reported_speech:'reported-speech',
  noun_clauses:'noun-clauses',
  wish_clauses:'wish-clauses',
  advanced_modals:'modals',
  used_to_forms:'used-to',
  causative_perception:'perception-verbs',
  mixed_transformations:'sentence-transformation'
};

function guideKeyFor(moduleId){
  const id=String(moduleId||'').trim();
  if(!id)return null;
  const resolved=resolveGuideKeys([id]);
  for(const key of resolved){if(GUIDES[key])return key}
  const fallback=FALLBACK_KEYS[id];
  if(fallback&&GUIDES[fallback])return fallback;
  const hyphen=id.replaceAll('_','-');
  if(GUIDES[hyphen])return hyphen;
  return null;
}

function moduleIdFromPage(){
  return root?.querySelector('[data-stage][data-module]')?.dataset.module||history.state?.route?.moduleId||'';
}

function installExplainerButton(){
  const overview=root?.querySelector('.gf-module-overview');
  if(!overview||root.querySelector('.gf-lesson-explainer'))return;
  const moduleId=moduleIdFromPage();
  if(!moduleId)return;
  const key=guideKeyFor(moduleId);
  const guide=key?GUIDES[key]:null;
  const button=document.createElement('button');
  button.type='button';
  button.className='gf-lesson-explainer';
  button.innerHTML=`<span class="gf-explainer-icon" aria-hidden="true">Aa</span><span class="gf-explainer-copy"><small>LESSON GUIDE</small><b>문법 설명 보기</b><span>${guide?.title||'이 문법의 핵심 설명'}</span></span><span class="gf-explainer-arrow" aria-hidden="true">→</span>`;
  if(guide){
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openGuide(key)});
  }else{
    button.disabled=true;
    button.title='이 문법 설명은 아직 Test Prep 설명 목록에 없습니다.';
    button.querySelector('.gf-explainer-copy span').textContent='설명 준비 중';
  }
  overview.insertAdjacentElement('afterend',button);
}

function journeyMarkup(card,index){
  const passed=card.classList.contains('passed');
  const locked=card.hasAttribute('disabled')||card.classList.contains('locked');
  const level=card.querySelector('.gf-stage-label')?.textContent?.replace(/LEVEL\s*/i,'')?.trim()||String(index+1);
  const title=card.querySelector('h3')?.textContent?.trim()||`Level ${level}`;
  const smalls=[...card.querySelectorAll('.gf-stage-card-copy small')].map(el=>el.textContent.trim()).filter(Boolean);
  const english=smalls[0]||'';
  const status=card.querySelector('.metric')?.textContent?.trim()||(locked?'Locked':passed?'Passed':'Ready');
  const attempts=smalls[1]||'';
  const pct=card.querySelector('.gf-stage-ring b')?.textContent?.trim()||'';
  card.classList.add('journey-stop','gf-journey-stop');
  card.classList.remove('tile');
  card.innerHTML=`<span class="station">${passed?'✓':locked?'🔒':level}</span><span class="stop-copy"><b>${title}</b>${english?`<small>${english}</small>`:''}<span class="mini"><i style="width:${passed?'100':pct.replace('%','')||'0'}%"></i></span></span><span class="stop-stat"><b>${status}</b>${attempts?`<small>${attempts}</small>`:''}</span>`;
}

function installJourney(){
  const grid=root?.querySelector('.gf-stage-grid');
  if(!grid||grid.dataset.gfJourney==='1')return;
  const cards=[...grid.querySelectorAll('.gf-stage-card[data-stage]')];
  if(!cards.length)return;
  grid.dataset.gfJourney='1';
  grid.classList.add('journey','gf-foundation-journey');
  cards.forEach(journeyMarkup);
  const heading=grid.previousElementSibling;
  if(heading?.classList.contains('gf-level-heading')){
    heading.querySelector('h2')?.replaceChildren(document.createTextNode('Your journey'));
    const kicker=heading.querySelector('.gf-kicker');if(kicker)kicker.textContent='LESSON JOURNEY';
  }
}

function navigation(){return window.__willenaGrammarFoundationsNavigation||null}

function skipLegacyGuide(){
  const route=history.state?.route;
  if(history.state?.app!=='willena-grammar-foundations'||route?.view!=='guide'||!route.moduleId||!route.stageId||!root?.querySelector('.gf-guide'))return;
  navigation()?.replace({view:'practice',moduleId:route.moduleId,stageId:route.stageId});
}

function enhance(){
  installExplainerButton();
  installJourney();
  skipLegacyGuide();
}

document.addEventListener('click',event=>{
  const card=event.target.closest?.('.gf-stage-card[data-stage][data-module],.gf-journey-stop[data-stage][data-module]');
  if(!card||card.hasAttribute('disabled'))return;
  const nav=navigation();
  if(!nav)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  nav.navigate({view:'practice',moduleId:card.dataset.module,stageId:card.dataset.stage});
},true);

const observer=new MutationObserver(enhance);
observer.observe(root||document.documentElement,{childList:true,subtree:true});
enhance();
