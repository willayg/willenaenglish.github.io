(function(){
'use strict';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const REGULAR=['communication','grammar','reading'];
const BLUEPRINT={vocab_test:5,communication:5,grammar:7,reading:8};
const FIELDS='id,source_id,source_question_number,source_page,section,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,difficulty,student_source_label,content_status,metadata,replacement_needed';
const RECENT_WINDOW=75;
const norm=v=>String(v||'').trim().toLowerCase();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const shuffle=a=>{const b=[...(a||[])];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};

async function get(path){const r=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
function id(){try{return crypto.randomUUID()}catch(_){return'exam-'+Date.now()+'-'+Math.random().toString(36).slice(2)}}
function runtime(){const r=window.WillenaQuestionRuntime;if(!r)throw new Error('QuestionRuntime is not ready.');return r}
function lessonsFor(plan){const rows=plan?.group?.scope?.lessons;if(Array.isArray(rows)&&rows.length)return rows.filter(x=>x?.lesson);return(plan?.units||[]).map(lesson=>({lesson,sections:plan.practice_types||[]}))}
function rowFor(plan,lesson){return lessonsFor(plan).find(x=>String(x.lesson)===String(lesson))||{lesson,sections:plan?.practice_types||[]}}
function sectionsFor(plan,row){const raw=Array.isArray(row?.sections)?row.sections:(plan?.practice_types||[]),allowed=raw.map(norm).filter(x=>REGULAR.includes(x));return allowed.length?[...new Set(allowed)]:REGULAR}
function vocabAllowed(plan,row){const raw=(Array.isArray(row?.sections)?row.sections:(plan?.practice_types||[])).map(norm);if(plan?.group?.scope?.scope_controls_v2===true)return raw.includes('vocabulary')||raw.includes('vocab_test');return true}
function practiceKey(q){const s=norm(q?.section);if(s==='vocab_test'||s==='vocabulary')return'vocab_test';const u=norm(q?.__sourceSection||q?.section);return u==='vocabulary'?'vocab_test':u}
function sourceBucket(q){const s=norm(q?.student_source_label);if(s.includes('willena'))return'W';if(s.includes('z reference')||s.includes('zocbo'))return'Z';if(s.includes('b reference'))return'B';return'O'}
function typeKey(q){return`${sourceBucket(q)}|${String(q?.question_type||'other')}`}
function allocate(total,n){if(!n)return[];const base=Math.floor(total/n),rem=total%n;return Array.from({length:n},(_,i)=>base+(i<rem?1:0))}
function vocabTargetKey(q){const m=q?.metadata||{},ids=Array.isArray(m.lexical_entry_ids)?m.lexical_entry_ids.filter(Boolean):[];if(m.lexical_entry_id)return`lex:${m.lexical_entry_id}`;if(ids.length===1)return`lex:${ids[0]}`;const canonical=String(m.canonical_text||q?.correct_text||'').trim();if(canonical)return`word:${norm(canonical)}`;if(norm(q?.answer_mode)==='text'){const a=Array.isArray(q?.correct_answer)?q.correct_answer:[q?.correct_answer].filter(x=>x!=null);if(a.length===1&&String(a[0]||'').trim())return`word:${norm(a[0])}`}return`q:${String(q?.id||'')}`}
function isVocabText(q){return norm(q?.answer_mode)==='text'}
function vocabFormat(q){
 const qt=norm(q?.question_type),text=isVocabText(q),answers=Array.isArray(q?.correct_answer)?q.correct_answer.filter(x=>x!=null&&String(x).trim()!==''):[q?.correct_answer].filter(x=>x!=null&&String(x).trim()!=='');
 if(text){
  if(answers.length>1||/(multi|word_bank|expression|phrase|family|form|particle|common_word|structured)/.test(qt))return'write-structured';
  return'write-spelling'
 }
 if(/(expression|collocation|phrasal|phrase|common_word|double_blank|triple_blank|shared_blank|preposition|pair)/.test(qt))return'choice-expression';
 if(/(usage|context|sentence|dialogue|completion|fit)/.test(qt))return'choice-context';
 return'choice-meaning'
}

async function resolveBook(plan){const books=await get(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(plan.book_label||'')}&limit=1`);if(!books[0])throw new Error('교재를 콘텐츠 DB에서 찾지 못했습니다.');const units=await get(`/rest/v1/content_units?select=id,title&book_id=eq.${encodeURIComponent(books[0].id)}`);return{bookId:String(books[0].id),unitMap:new Map((units||[]).map(x=>[String(x.title),String(x.id)]))}}
async function fetchSection(bookId,unitId,section,lesson){const qs=new URLSearchParams({select:FIELDS,student_usable:'eq.true',book_id:`eq.${bookId}`,unit_id:`eq.${unitId}`,section:`eq.${section}`});const rows=await get(`/rest/v1/test_prep_questions?${qs.toString()}`);return(rows||[]).filter(q=>q?.replacement_needed!==true).map(q=>({...q,__lesson:String(lesson),__unitId:String(unitId)}))}
async function generatedVocabPool(unitId,lesson){for(let i=0;i<100;i++){const api=window.WillenaVocabTestPractice;if(api?.buildMockPool){const rows=await api.buildMockPool(unitId,lesson);return(rows||[]).map(q=>({...q,__lesson:String(lesson),__unitId:String(unitId),__examVocabularyGenerated:true}))}await wait(30)}return[]}
async function vocabPool(bookId,unitId,lesson){const [generated,stored]=await Promise.all([generatedVocabPool(unitId,lesson),fetchSection(bookId,unitId,'vocabulary',lesson)]),storedForExam=stored.map(q=>({...q,__sourceSection:'vocabulary',section:'vocab_test'})),seenIds=new Set(),out=[];for(const q of [...generated,...storedForExam]){const k=String(q.id||'');if(!k||seenIds.has(k))continue;seenIds.add(k);out.push(q)}return out}

function splitSupported(rows,unsupported){const rt=runtime(),good=[];for(const q of rows||[]){if(rt.supports(q))good.push(q);else unsupported.push({id:q?.id||null,lesson:q?.__lesson||null,section:q?.section||null,question_type:q?.question_type||null,answer_mode:q?.answer_mode||null,reason:'no_registered_engine'})}return good}
async function loadQuestionHistory(planId){const api=window.WillenaTestPrepSession;if(!api?.history)return[];try{return await api.history(planId,null,null)}catch(e){console.warn('[REV46j] question history unavailable',e);return[]}}
function historyProfile(hist){const rows=[...(hist||[])].filter(x=>x?.question_id),byId=new Map(rows.map(x=>[String(x.question_id),x]));rows.sort((a,b)=>new Date(b.last_attempt_at||0)-new Date(a.last_attempt_at||0));const recent=new Set(rows.slice(0,RECENT_WINDOW).map(x=>String(x.question_id)));return{byId,recent,total:rows.length}}
function rank(q,hp){const h=hp.byId.get(String(q.id));if(!h)return 0;if(!hp.recent.has(String(q.id)))return 1;return 2}
function timeOf(q,hp){return new Date(hp.byId.get(String(q.id))?.last_attempt_at||0).getTime()||0}
function ranked(rows,hp){const buckets=[[],[],[]];for(const q of shuffle(rows||[]))buckets[rank(q,hp)].push(q);buckets[1].sort((a,b)=>timeOf(a,hp)-timeOf(b,hp));buckets[2].sort((a,b)=>timeOf(a,hp)-timeOf(b,hp));return buckets}
function balancedCore(rows,count,used,hp){const pool=(rows||[]).filter(q=>!used.has(String(q.id))),groups=new Map();for(const q of pool){const k=typeKey(q);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(q)}for(const [k,g] of groups){const tiers=ranked(g,hp);groups.set(k,[...tiers[0],...tiers[1],...tiers[2]])}const keys=shuffle([...groups.keys()]),out=[];let moved=true;while(out.length<count&&moved){moved=false;for(const k of keys){const g=groups.get(k);if(g?.length&&out.length<count){const q=g.shift();used.add(String(q.id));out.push(q);moved=true}}}return out}
function takeBalanced(rows,count,used,hp){const available=(rows||[]).filter(q=>!used.has(String(q.id))),fresh=available.filter(q=>!hp.recent.has(String(q.id))),out=[];if(fresh.length)out.push(...balancedCore(fresh,Math.min(count,fresh.length),used,hp));if(out.length<count)out.push(...balancedCore(available,count-out.length,used,hp));return out}
function takeAcrossLessons(rows,count,used,hp){const map=new Map();for(const q of rows||[]){const k=String(q.__lesson||'');if(!map.has(k))map.set(k,[]);map.get(k).push(q)}const groups=[...map.values()].filter(x=>x.length),quota=allocate(count,groups.length),out=[];groups.forEach((g,i)=>out.push(...takeBalanced(g,quota[i],used,hp)));if(out.length<count)out.push(...takeBalanced(rows,count-out.length,used,hp));return out}
function takeUniqueVocab(rows,count,used,hp,targetUsed,across=false){const out=[];for(let guard=0;guard<8&&out.length<count;guard++){const candidates=(rows||[]).filter(q=>!used.has(String(q.id))&&!targetUsed.has(vocabTargetKey(q)));if(!candidates.length)break;const raw=across?takeAcrossLessons(candidates,count-out.length,used,hp):takeBalanced(candidates,count-out.length,used,hp);if(!raw.length)break;for(const q of raw){const k=vocabTargetKey(q);if(targetUsed.has(k))continue;targetUsed.add(k);out.push(q);if(out.length>=count)break}}return out}
function takeVocab(rows,count,used,hp,across=false,seedTargets=new Set()){
 const targetUsed=new Set(seedTargets),out=[],families=['choice-meaning','choice-context','choice-expression','write-spelling','write-structured'];
 for(const family of families){
  if(out.length>=count)break;
  const candidates=(rows||[]).filter(q=>vocabFormat(q)===family);
  out.push(...takeUniqueVocab(candidates,1,used,hp,targetUsed,across))
 }
 if(out.length<count)out.push(...takeUniqueVocab(rows,count-out.length,used,hp,targetUsed,across));
 return out
}
function selectedVocabTargets(rows){return new Set((rows||[]).filter(q=>practiceKey(q)==='vocab_test').map(vocabTargetKey))}
function fillRemaining(picked,pools,used,hp,across){if(picked.length>=25)return;const regular=[...pools.communication,...pools.grammar,...pools.reading];picked.push(...(across?takeAcrossLessons(regular,25-picked.length,used,hp):takeBalanced(regular,25-picked.length,used,hp)));if(picked.length<25)picked.push(...takeVocab(pools.vocab_test,25-picked.length,used,hp,across,selectedVocabTargets(picked)))}
function finishManifest({plan,scope,lesson,items,unsupported,hp}){const rt=runtime(),recentUsed=items.filter(q=>hp.recent.has(String(q.id))).length,unseenUsed=items.filter(q=>!hp.byId.has(String(q.id))).length,vocab=items.filter(q=>practiceKey(q)==='vocab_test'),vocabWriting=vocab.filter(isVocabText).length;const manifest={id:id(),version:'46k',createdAt:new Date().toISOString(),planId:String(plan.id),bookLabel:plan.book_label||'',scope,lesson:lesson||null,total:items.length,replacedQuestionIds:[],items:items.map((q,i)=>({position:i+1,lesson:String(q.__lesson||lesson||''),unitId:String(q.__unitId||''),engine:rt.engineFor(q),question:q})),unsupported,selectionDiagnostics:{historyQuestions:hp.total,recentWindow:RECENT_WINDOW,recentReused:recentUsed,unseenSelected:unseenUsed,vocabQuestions:vocab.length,vocabWriting,vocabChoice:vocab.length-vocabWriting,vocabUniqueTargets:new Set(vocab.map(vocabTargetKey)).size,vocabFormats:vocab.reduce((m,q)=>(m[vocabFormat(q)]=(m[vocabFormat(q)]||0)+1,m),{})}};if(unsupported.length)console.warn('[REV46j] unsupported usable questions excluded',unsupported);console.info('[REV46k] manifest',{scope,lesson,total:manifest.total,history:hp.total,recentReused:recentUsed,unseenSelected:unseenUsed,vocab:{total:vocab.length,writing:vocabWriting,choice:vocab.length-vocabWriting,uniqueTargets:new Set(vocab.map(vocabTargetKey)).size},engines:manifest.items.reduce((m,x)=>(m[x.engine]=(m[x.engine]||0)+1,m),{})});return manifest}
function order(items){const sectionOrder=['vocab_test','communication','grammar','reading'],used=new Set(),out=[];for(const section of sectionOrder){const sectionRows=(items||[]).filter(q=>practiceKey(q)===section&&!used.has(String(q.id))),byLesson=new Map();for(const q of sectionRows){const lesson=String(q.__lesson||'');if(!byLesson.has(lesson))byLesson.set(lesson,[]);byLesson.get(lesson).push(q)}for(const lesson of shuffle([...byLesson.keys()])){for(const q of shuffle(byLesson.get(lesson)||[])){used.add(String(q.id));out.push(q)}}}out.push(...shuffle((items||[]).filter(q=>!used.has(String(q.id)))));return out}

async function buildLesson(plan,lesson){const [{bookId,unitMap},hist]=await Promise.all([resolveBook(plan),loadQuestionHistory(plan.id)]),hp=historyProfile(hist),unitId=unitMap.get(String(lesson));if(!unitId)throw new Error(`${lesson}을 콘텐츠 DB에서 찾지 못했습니다.`);const row=rowFor(plan,lesson),unsupported=[],pools={vocab_test:[],communication:[],grammar:[],reading:[]};if(vocabAllowed(plan,row))pools.vocab_test=splitSupported(await vocabPool(bookId,unitId,lesson),unsupported);for(const section of sectionsFor(plan,row))pools[section]=splitSupported(await fetchSection(bookId,unitId,section,lesson),unsupported);const used=new Set(),picked=[];if(pools.vocab_test.length)picked.push(...takeVocab(pools.vocab_test,BLUEPRINT.vocab_test,used,hp,false));for(const key of ['communication','grammar','reading'])if(pools[key].length)picked.push(...takeBalanced(pools[key],BLUEPRINT[key],used,hp));fillRemaining(picked,pools,used,hp,false);return finishManifest({plan,scope:'lesson',lesson:String(lesson),items:order(picked.slice(0,25)),unsupported,hp})}
async function buildAll(plan){const [{bookId,unitMap},hist]=await Promise.all([resolveBook(plan),loadQuestionHistory(plan.id)]),hp=historyProfile(hist),rows=lessonsFor(plan);if(!rows.length)throw new Error('시험 범위 Lesson이 없습니다.');const unsupported=[],pools={vocab_test:[],communication:[],grammar:[],reading:[]};for(const row of rows){const lesson=String(row.lesson),unitId=unitMap.get(lesson);if(!unitId)continue;if(vocabAllowed(plan,row))pools.vocab_test.push(...splitSupported(await vocabPool(bookId,unitId,lesson),unsupported));for(const section of sectionsFor(plan,row))pools[section].push(...splitSupported(await fetchSection(bookId,unitId,section,lesson),unsupported))}const used=new Set(),picked=[];if(pools.vocab_test.length)picked.push(...takeVocab(pools.vocab_test,BLUEPRINT.vocab_test,used,hp,true));for(const key of ['communication','grammar','reading'])if(pools[key].length)picked.push(...takeAcrossLessons(pools[key],BLUEPRINT[key],used,hp));fillRemaining(picked,pools,used,hp,true);return finishManifest({plan,scope:'all',lesson:null,items:order(picked.slice(0,25)),unsupported,hp})}

function difficultyDistance(a,b){const A=Number(a),B=Number(b);return Number.isFinite(A)&&Number.isFinite(B)?Math.abs(A-B):0}
async function replacementFor(plan,manifest,item){
 if(!plan||!manifest||!item?.question)throw new Error('교체할 문제 정보가 없습니다.');
 const q=item.question,lesson=String(item.lesson||q.__lesson||''),unitId=String(item.unitId||q.__unitId||''),under=norm(q.__sourceSection||q.section),isVocab=practiceKey(q)==='vocab_test';
 const {bookId}=await resolveBook(plan),unsupported=[],raw=isVocab?await vocabPool(bookId,unitId,lesson):await fetchSection(bookId,unitId,under,lesson),pool=splitSupported(raw,unsupported);
 const blocked=new Set([...(manifest.items||[]).map(x=>String(x?.question?.id||'')),...(manifest.replacedQuestionIds||[]).map(String),String(q.id||'')]);
 const targetBlocked=isVocab?new Set((manifest.items||[]).filter(x=>practiceKey(x.question)==='vocab_test').map(x=>vocabTargetKey(x.question))):new Set();
 let candidates=pool.filter(x=>!blocked.has(String(x.id))&&(!isVocab||!targetBlocked.has(vocabTargetKey(x))));
 if(!candidates.length)throw new Error('같은 범위에서 교체할 다른 문제가 없습니다.');
 const hist=await loadQuestionHistory(plan.id),hp=historyProfile(hist),mode=norm(q.answer_mode),type=String(q.question_type||''),family=isVocab?vocabFormat(q):null;
 candidates=shuffle(candidates).sort((a,b)=>{
  const sa=(family&&vocabFormat(a)!==family?3:0)+(String(a.question_type||'')===type?0:2)+(norm(a.answer_mode)===mode?0:1)+rank(a,hp)*4+difficultyDistance(a.difficulty,q.difficulty)*.1;
  const sb=(family&&vocabFormat(b)!==family?3:0)+(String(b.question_type||'')===type?0:2)+(norm(b.answer_mode)===mode?0:1)+rank(b,hp)*4+difficultyDistance(b.difficulty,q.difficulty)*.1;
  return sa-sb||timeOf(a,hp)-timeOf(b,hp)
 });
 const replacement=candidates[0];
 return{position:item.position,lesson,unitId,engine:runtime().engineFor(replacement),question:replacement}
}

window.WillenaExamBuilder={buildLesson,buildAll,replacementFor,resolveBook,lessonsFor,blueprint:{...BLUEPRINT},vocabTargetKey};
console.log('[REV46k] ExamBuilder vocab format-family mix ready');
})();