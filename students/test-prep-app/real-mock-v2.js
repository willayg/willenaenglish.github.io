import {resolveContentIds,loadStoredSkill,loadStoredWritten,shuffle} from '../test-prep-v2/content-source.js';
import {adaptStored,FORMS} from '../test-prep-v2/question-model.js';

const BLUEPRINT={vocabulary:4,communication:5,grammar:6,reading:6,constructed_response:4};
const STORAGE_KEY='willena-real-mock-v2-manifest';
const RESET_KEY='willena-real-mock-v2-reset-request';
const RECENT_LIMIT=100;
const API='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const VOCAB_FIELDS='id,source_id,source_question_number,source_page,section,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,context_type,difficulty,student_source_label,content_status,metadata,book_id,unit_id,replacement_needed';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=v=>String(v||'').trim().toLowerCase();

function revBadge(){const old=document.querySelector('[id^="tp-rev52"]');if(old)old.remove();const b=document.createElement('div');b.id='tp-rev52j-badge';b.textContent='REV 52j';b.style.cssText='position:fixed;right:10px;bottom:10px;z-index:2147483647;padding:4px 8px;border-radius:999px;background:#203039;color:#fff;font:800 10px/1.2 Poppins,sans-serif;letter-spacing:.04em;opacity:.82;pointer-events:none';document.body.appendChild(b)}
function plans(){return window.WillenaTestPrepAuth?.state?.plans||[]}
function planById(id){return plans().find(p=>String(p.id)===String(id))||null}
function scopeFor(plan){const rows=plan?.group?.scope?.lessons;return Array.isArray(rows)?rows.filter(x=>x?.lesson):[]}
function sectionAllowed(plan,row,section){const raw=(row?.sections||[]).map(norm),strict=plan?.group?.scope?.scope_controls_v2===true;if(!strict)return section==='vocabulary'||raw.includes(section)||section==='constructed_response';if(section==='vocabulary')return raw.includes('vocabulary')||raw.includes('vocab_test');return raw.includes(section)}
function idOf(q){return String(q?.id||q?.masteryKey||'')}
function decorate(q,lesson,unitId,section){return {...q,__lesson:String(lesson),__unitId:String(unitId),__realMockSection:section}}
function recentKey(planId){return`willena-real-mock-v2-recent:${String(planId)}`}
function loadRecent(planId){try{const a=JSON.parse(localStorage.getItem(recentKey(planId))||'[]');return Array.isArray(a)?a.map(String).filter(Boolean).slice(-RECENT_LIMIT):[]}catch(_){return[]}}
function saveRecent(planId,ids){const merged=[...loadRecent(planId),...(ids||[]).map(String).filter(Boolean)],out=[];for(const id of merged)if(!out.includes(id))out.push(id);localStorage.setItem(recentKey(planId),JSON.stringify(out.slice(-RECENT_LIMIT)))}
function parseReset(){try{const r=JSON.parse(localStorage.getItem(RESET_KEY)||'null');return r&&r.planId?r:null}catch(_){return null}}
function clearReset(){localStorage.removeItem(RESET_KEY)}
function preferredRows(rows,recentSet,hardAvoid){const allowed=(rows||[]).filter(q=>!hardAvoid.has(idOf(q))),fresh=allowed.filter(q=>!recentSet.has(idOf(q))),old=allowed.filter(q=>recentSet.has(idOf(q)));return[shuffle(fresh),shuffle(old)]}
function qType(q){return norm(q?.tracking?.questionType)||norm(q?.metadata?.question_type)||norm(q?.form)||'other'}

function sectionArchetype(section,q){
  const t=qType(q),f=norm(q?.form);
  if(section==='communication'){
    if(/(response|reply|answer|appropriate_response|best_response)/.test(t))return'response-choice';
    if(/(situation|function|purpose|intent|intention|speech_act)/.test(t))return'situation-function';
    if(/(blank|completion|complete|missing|insert)/.test(t))return'dialogue-completion';
    if(/(order|sequence|arrange)/.test(t)||f==='order'||f==='chunks')return'dialogue-order';
    if(/(meaning|expression|phrase|match|equivalent)/.test(t))return'expression-meaning';
    return f==='write'?'written-communication':'other-communication';
  }
  if(section==='grammar'){
    if(/(error|incorrect|correction|correct_error|find_error)/.test(t)||f==='correction')return'error-correction';
    if(/(correct_sentence|incorrect_sentence|acceptable|usage|judgment|judgement)/.test(t))return'sentence-judgment';
    if(/(blank|completion|form|conjug|inflect|particle|preposition|choice)/.test(t))return'form-completion';
    if(/(transform|rewrite|change|paraphrase|combine)/.test(t)||f==='write')return'transformation';
    if(/(order|sequence|arrange|unscramble)/.test(t)||f==='order'||f==='chunks')return'word-order';
    if(/(match|relation|pair|meaning)/.test(t))return'relation-match';
    return'other-grammar';
  }
  if(section==='reading'){
    if(/(main_idea|main idea|title|theme|topic|purpose|gist)/.test(t))return'main-idea-title';
    if(/(detail|true|false|not_true|not true|content_match|information)/.test(t))return'detail-check';
    if(/(infer|inference|imply|suggest)/.test(t))return'inference';
    if(/(reference|referent|pronoun|refers)/.test(t))return'reference';
    if(/(blank|insert|context|completion|cloze)/.test(t))return'context-blank';
    if(/(order|sequence|arrange|flow)/.test(t)||f==='order'||f==='chunks')return'sequence-order';
    if(/(vocab|word|meaning|synonym)/.test(t))return'vocabulary-in-context';
    if(/(summary|summarize)/.test(t))return'summary';
    return'other-reading';
  }
  if(section==='constructed_response'){
    if(f==='correction'||/(correct|correction|error|fix)/.test(t))return'written-correction';
    if(f==='multipart'||/(multipart|multi_part|multiple_blank|multi_blank)/.test(t))return'multipart-writing';
    if(f==='order'||f==='chunks'||/(order|arrange|unscramble|sentence_build)/.test(t))return'sentence-building';
    if(/(transform|rewrite|change|combine)/.test(t))return'written-transformation';
    if(/(translation|korean_to_english|eng_write|write_sentence)/.test(t))return'translation-writing';
    if(/(dialogue|response|conversation)/.test(t))return'dialogue-writing';
    if(/(blank|completion|complete)/.test(t))return'written-completion';
    return'free-writing';
  }
  return'other';
}

function pickSkillVaried(section,rows,count,recentSet=new Set(),hardAvoid=new Set()){
  const [fresh,old]=preferredRows(rows,recentSet,hardAvoid),ordered=[...fresh,...old],unique=[],seen=new Set();
  for(const q of ordered){const id=idOf(q);if(!id||seen.has(id))continue;seen.add(id);unique.push(q)}
  const out=[],usedIds=new Set(),usedTypes=new Set(),usedArchetypes=new Set(),usedLessons=new Set();
  const take=q=>{if(!q||usedIds.has(idOf(q)))return false;out.push(q);usedIds.add(idOf(q));usedTypes.add(qType(q));usedArchetypes.add(sectionArchetype(section,q));usedLessons.add(String(q.__lesson||''));return true};
  const archetypes=shuffle([...new Set(unique.map(q=>sectionArchetype(section,q)))]);
  for(const a of archetypes){if(out.length>=count)break;const pool=unique.filter(q=>sectionArchetype(section,q)===a&&!usedIds.has(idOf(q)));const q=pool.find(x=>!recentSet.has(idOf(x))&&!usedLessons.has(String(x.__lesson||''))&&!usedTypes.has(qType(x)))||pool.find(x=>!recentSet.has(idOf(x))&&!usedTypes.has(qType(x)))||pool.find(x=>!recentSet.has(idOf(x)))||pool[0];take(q)}
  if(out.length<count){for(const q of unique){if(out.length>=count)break;if(usedIds.has(idOf(q))||usedTypes.has(qType(q)))continue;const same=out.filter(x=>sectionArchetype(section,x)===sectionArchetype(section,q)).length;if(same>=2)continue;take(q)}}
  if(out.length<count){for(const q of unique){if(out.length>=count)break;if(usedIds.has(idOf(q)))continue;const same=out.filter(x=>sectionArchetype(section,x)===sectionArchetype(section,q)).length;if(same>=2)continue;take(q)}}
  if(out.length<count){for(const q of unique){if(out.length>=count)break;take(q)}}
  return{items:out.slice(0,count),archetypes:out.slice(0,count).map(q=>sectionArchetype(section,q)),types:out.slice(0,count).map(qType)}
}

async function rawVocab(unitId,section='vocabulary'){const qs=new URLSearchParams({select:VOCAB_FIELDS,student_usable:'eq.true',unit_id:`eq.${unitId}`,section:`eq.${section}`,limit:'10000'});const r=await fetch(`${API}/rest/v1/test_prep_questions?${qs.toString()}`,{headers:HEAD,cache:'no-store'});if(!r.ok)throw new Error(await r.text());const rows=await r.json();return(rows||[]).filter(x=>x.replacement_needed!==true).map(adaptStored).filter(q=>q.form!==FORMS.unsupported)}
async function loadVocabAll(unitId){const rows=await rawVocab(unitId,'vocabulary');const out=[],seen=new Set();for(const q of rows){const id=idOf(q);if(!id||seen.has(id))continue;seen.add(id);out.push(q)}return out}
function vocabTarget(q){const m=q?.metadata||{},ids=Array.isArray(m.lexical_entry_ids)?m.lexical_entry_ids.filter(Boolean):[];if(m.lexical_entry_id)return`lex:${m.lexical_entry_id}`;if(ids.length===1)return`lex:${ids[0]}`;if(m.canonical_text)return`word:${norm(m.canonical_text)}`;const a=Array.isArray(q?.answer)?q.answer:[];if(a.length===1&&String(a[0]||'').trim())return`word:${norm(a[0])}`;return`q:${idOf(q)}`}
function vocabType(q){return qType(q)}
function isWrittenVocab(q){return q?.form===FORMS.write||q?.form===FORMS.multipart||q?.form===FORMS.correction}
function vocabArchetype(q){const t=vocabType(q);if(isWrittenVocab(q)){if(/(relation|relationship|family|synonym|analogy)/.test(t))return'written-relation';if(/(definition)/.test(t))return'written-definition';if(/(expression|phrase|particle|common_word|word_bank|multi_blank)/.test(t))return'written-expression';return'written-completion'}if(/(incorrect_usage|usage_mismatch|usage_different|word_usage_different|correct_usage|part_of_speech_usage|incorrect_word_usage|vocab_incorrect_usage)/.test(t))return'usage-judgment';if(/(relation|relationship|family|synonym|analogy|odd_one_out|definition_matching|definition_pair|pair_mismatch|meaning_mismatch|definition_incorrect|sense_classification)/.test(t))return'relation-definition';if(/(expression|phrase|phrasal|common_word|preposition|shared_blank|double_blank|triple_blank|word_bank|multi_blank)/.test(t))return'expression-pattern';if(/(context|dialogue|sentence|translation|completion|meaning_in_context)/.test(t))return'context-completion';return'meaning-definition'}
function pickVocabVaried(rows,count,recentSet=new Set(),hardAvoid=new Set()){
  const [fresh,old]=preferredRows(rows,recentSet,hardAvoid),unique=[],ids=new Set(),targets=new Set();for(const q of [...fresh,...old]){const id=idOf(q),target=vocabTarget(q);if(!id||ids.has(id)||targets.has(target))continue;ids.add(id);targets.add(target);unique.push(q)}
  const out=[],usedIds=new Set(),usedTypes=new Set(),usedArchetypes=new Set(),usedLessons=new Set();const take=q=>{if(!q||usedIds.has(idOf(q))||usedTypes.has(vocabType(q)))return false;out.push(q);usedIds.add(idOf(q));usedTypes.add(vocabType(q));usedArchetypes.add(vocabArchetype(q));usedLessons.add(String(q.__lesson||''));return true};
  const written=[...unique.filter(q=>isWrittenVocab(q)&&!recentSet.has(idOf(q))),...unique.filter(q=>isWrittenVocab(q)&&recentSet.has(idOf(q)))];if(written.length){const nonBlankish=written.filter(q=>!/(blank|completion)/.test(vocabType(q)));take(nonBlankish.find(q=>!usedLessons.has(String(q.__lesson||'')))||nonBlankish[0]||written.find(q=>!usedLessons.has(String(q.__lesson||'')))||written[0])}
  const archetypePriority=shuffle(['relation-definition','expression-pattern','context-completion','meaning-definition','usage-judgment','written-relation','written-definition','written-expression','written-completion']);for(const a of archetypePriority){if(out.length>=count)break;if(usedArchetypes.has(a))continue;const pool=[...unique.filter(q=>vocabArchetype(q)===a&&!usedIds.has(idOf(q))&&!usedTypes.has(vocabType(q))&&!recentSet.has(idOf(q))),...unique.filter(q=>vocabArchetype(q)===a&&!usedIds.has(idOf(q))&&!usedTypes.has(vocabType(q))&&recentSet.has(idOf(q)))],q=pool.find(x=>!usedLessons.has(String(x.__lesson||'')))||pool[0];take(q)}
  if(out.length<count){const fallback=unique.filter(q=>!usedIds.has(idOf(q))&&!usedTypes.has(vocabType(q)));for(const q of fallback){if(out.length>=count)break;const a=vocabArchetype(q),sameCount=out.filter(x=>vocabArchetype(x)===a).length;if(sameCount>=2)continue;take(q)}}if(out.length<count){for(const q of unique){if(out.length>=count)break;take(q)}}
  if(out.length<count)return{items:out,error:`저장된 어휘 문제가 부족합니다: ${out.length}/${count}`};return{items:shuffle(out.slice(0,count)),error:null,archetypes:out.slice(0,count).map(vocabArchetype),types:out.slice(0,count).map(vocabType)}
}

async function buildPool(plan){const pools={vocabulary:[],communication:[],grammar:[],reading:[],constructed_response:[]},resolved=[];for(const row of scopeFor(plan)){const lesson=String(row.lesson),ids=await resolveContentIds(plan,lesson);resolved.push({lesson,unitId:String(ids.unitId)});if(sectionAllowed(plan,row,'vocabulary')){const vocab=await loadVocabAll(ids.unitId);pools.vocabulary.push(...vocab.map(q=>decorate(q,lesson,ids.unitId,'vocabulary')))}for(const section of ['communication','grammar','reading'])if(sectionAllowed(plan,row,section)){const rows=await loadStoredSkill(ids.unitId,section);pools[section].push(...rows.map(q=>decorate(q,lesson,ids.unitId,section)))}if(sectionAllowed(plan,row,'constructed_response')){const rows=await loadStoredWritten(ids.unitId);pools.constructed_response.push(...rows.map(q=>decorate(q,lesson,ids.unitId,'constructed_response')))}}return{pools,resolved}}

async function buildManifest(plan,{hardAvoidIds=[]}={}){
  const recentSet=new Set(loadRecent(plan.id)),hardAvoid=new Set((hardAvoidIds||[]).map(String)),{pools,resolved}=await buildPool(plan),picked={},short=[],structures={};
  const vocabPick=pickVocabVaried(pools.vocabulary,BLUEPRINT.vocabulary,recentSet,hardAvoid);picked.vocabulary=vocabPick.items;structures.vocabulary={archetypes:vocabPick.archetypes||[],types:vocabPick.types||[]};if(vocabPick.error)short.push(vocabPick.error);
  for(const section of ['communication','grammar','reading','constructed_response']){const count=BLUEPRINT[section],result=pickSkillVaried(section,pools[section],count,recentSet,hardAvoid);picked[section]=result.items;structures[section]={archetypes:result.archetypes,types:result.types};if(picked[section].length<count)short.push(`${section}: ${picked[section].length}/${count}`)}
  if(short.length)throw new Error(`이 시험 범위에는 반복 없이 새 실전모의고사를 만들 문제가 부족합니다.\n${short.join('\n')}`);
  const order=['vocabulary','communication','grammar','reading','constructed_response'],questions=order.flatMap(section=>shuffle(picked[section])),ids=questions.map(idOf);saveRecent(plan.id,ids);
  return{id:`real-mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,version:'experiment-7',createdAt:new Date().toISOString(),planId:String(plan.id),bookLabel:plan.book_label||'',examName:plan.exam_name||'',blueprint:BLUEPRINT,resolved,structures,antiRepeat:{recentWindow:RECENT_LIMIT,hardAvoided:hardAvoid.size},questions}
}

function styles(){if($('#realMockV2Styles'))return;const s=document.createElement('style');s.id='realMockV2Styles';s.textContent=`.tp-real-mock-v2{width:100%;box-sizing:border-box;display:flex;align-items:center;gap:14px;border:2px solid #07888d;background:#fff;border-radius:20px;padding:16px 18px;margin:10px 0 18px;cursor:pointer;text-align:left;box-shadow:0 7px 20px rgba(32,48,57,.10);font-family:Poppins,'Noto Sans KR',sans-serif;color:#203039}.tp-real-mock-v2:hover{transform:translateY(-1px)}.tp-real-mock-v2:disabled{opacity:.55;cursor:wait;transform:none}.tp-real-mock-v2-icon{display:grid;place-items:center;flex:0 0 50px;width:50px;height:50px;border-radius:16px;background:#e8fafb;color:#07888d;font-weight:900;font-size:15px}.tp-real-mock-v2-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.tp-real-mock-v2-copy b{font-size:16px}.tp-real-mock-v2-copy small{font-size:11px;color:#6b7e87;font-weight:600}.tp-real-mock-v2-go{margin-left:auto;font-size:11px;font-weight:900;color:#d54685}@media(max-width:560px){.tp-real-mock-v2{padding:14px}.tp-real-mock-v2-icon{width:44px;height:44px;flex-basis:44px}.tp-real-mock-v2-copy b{font-size:14px}.tp-real-mock-v2-go{display:none}}`;document.head.appendChild(s)}
function button(planId){const b=document.createElement('button');b.type='button';b.className='tp-real-mock-v2';b.dataset.realMockPlan=planId;b.innerHTML=`<span class="tp-real-mock-v2-icon">25</span><span class="tp-real-mock-v2-copy"><b>실전모의고사</b><small>4 저장 어휘 · 5 의사소통 · 6 문법 · 6 독해 · 4 서술형 · 구조 다양성 + 최근 문제 회피</small></span><span class="tp-real-mock-v2-go">EXPERIMENT →</span>`;return b}
async function launch(btn,planId,opts={}){if(btn?.disabled)return;const plan=planById(planId);if(!plan)throw new Error('시험 범위를 찾지 못했습니다.');if(btn)btn.disabled=true;const go=btn?$('.tp-real-mock-v2-go',btn):null,old=go?.textContent;if(go)go.textContent='BUILDING';try{const manifest=await buildManifest(plan,opts);sessionStorage.setItem(STORAGE_KEY,JSON.stringify(manifest));location.href='./real-mock-v2-52g.html'}catch(e){console.error('[real mock v2] build failed',e);if(btn){alert(e?.message||'실전모의고사를 만들지 못했습니다.');btn.disabled=false;if(go)go.textContent=old||'EXPERIMENT →'}else throw e}}
async function maybeAutoReset(){const req=parseReset();if(!req)return false;const plan=planById(req.planId);if(!plan)return false;clearReset();try{await launch(null,req.planId,{hardAvoidIds:Array.isArray(req.currentIds)?req.currentIds:[]});return true}catch(e){console.error('[REV52j] reset build failed',e);alert(e?.message||'새 실전모의고사를 만들지 못했습니다.');return false}}
function inject(){styles();const home=$('#assignmentHome');if(!home)return;for(const current of $$('.tp-exam46-all',home)){if(current.nextElementSibling?.classList?.contains('tp-real-mock-v2'))continue;const section=current.closest('.tp-exam-section'),first=section?.querySelector('.tp-lesson-card[data-lesson-plan]'),planId=first?.dataset.lessonPlan;if(!planId||!planById(planId))continue;const b=button(planId);b.onclick=()=>launch(b,planId);current.insertAdjacentElement('afterend',b)}}
async function boot(){revBadge();const ready=window.WillenaTestPrepAuth?.ready;try{if(ready)await ready}catch(_){ }if(await maybeAutoReset())return;inject();const root=$('#assignmentHome')||document.body;new MutationObserver(()=>queueMicrotask(inject)).observe(root,{childList:true,subtree:true});window.addEventListener('testprep:student-state-refresh',()=>setTimeout(inject,0));window.addEventListener('popstate',()=>setTimeout(inject,0))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[REV52j] REAL MOCK V2 EXPERIMENT structure-balanced + anti-repeat ready');