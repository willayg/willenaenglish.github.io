(function(){
'use strict';

const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const REGULAR=['communication','grammar','reading'];
const BLUEPRINT={vocab_test:5,communication:5,grammar:7,reading:8};
const FIELDS='id,source_id,source_question_number,source_page,section,question_type,prompt_text,context,choices,correct_answer,targets,answer_mode,difficulty,student_source_label,content_status,metadata,replacement_needed';
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
function sourceBucket(q){const s=norm(q?.student_source_label);if(s.includes('willena'))return'W';if(s.includes('z reference')||s.includes('zocbo'))return'Z';if(s.includes('b reference'))return'B';return'O'}
function typeKey(q){return`${sourceBucket(q)}|${String(q?.question_type||'other')}`}
function allocate(total,n){if(!n)return[];const base=Math.floor(total/n),rem=total%n;return Array.from({length:n},(_,i)=>base+(i<rem?1:0))}

async function resolveBook(plan){const books=await get(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(plan.book_label||'')}&limit=1`);if(!books[0])throw new Error('교재를 콘텐츠 DB에서 찾지 못했습니다.');const units=await get(`/rest/v1/content_units?select=id,title&book_id=eq.${encodeURIComponent(books[0].id)}`);return{bookId:String(books[0].id),unitMap:new Map((units||[]).map(x=>[String(x.title),String(x.id)]))}}
async function fetchSection(bookId,unitId,section,lesson){const qs=new URLSearchParams({select:FIELDS,student_usable:'eq.true',book_id:`eq.${bookId}`,unit_id:`eq.${unitId}`,section:`eq.${section}`});const rows=await get(`/rest/v1/test_prep_questions?${qs.toString()}`);return(rows||[]).filter(q=>q?.replacement_needed!==true).map(q=>({...q,__lesson:String(lesson),__unitId:String(unitId)}))}
async function vocabPool(unitId,lesson){for(let i=0;i<100;i++){const api=window.WillenaVocabTestPractice;if(api?.buildMockPool){const rows=await api.buildMockPool(unitId,lesson);return(rows||[]).map(q=>({...q,__lesson:String(lesson),__unitId:String(unitId)}))}await wait(30)}return[]}

function splitSupported(rows,unsupported){const rt=runtime(),good=[];for(const q of rows||[]){if(rt.supports(q))good.push(q);else unsupported.push({id:q?.id||null,lesson:q?.__lesson||null,section:q?.section||null,question_type:q?.question_type||null,answer_mode:q?.answer_mode||null,reason:'no_registered_engine'})}return good}
function takeBalanced(rows,count,used){const pool=shuffle((rows||[]).filter(q=>!used.has(String(q.id)))),groups=new Map();for(const q of pool){const k=typeKey(q);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(q)}const keys=shuffle([...groups.keys()]),out=[];let moved=true;while(out.length<count&&moved){moved=false;for(const k of keys){const g=groups.get(k);if(g?.length&&out.length<count){const q=g.shift();used.add(String(q.id));out.push(q);moved=true}}}return out}
function takeAcrossLessons(rows,count,used){const map=new Map();for(const q of rows||[]){const k=String(q.__lesson||'');if(!map.has(k))map.set(k,[]);map.get(k).push(q)}const groups=[...map.values()].filter(x=>x.length),quota=allocate(count,groups.length),out=[];groups.forEach((g,i)=>out.push(...takeBalanced(g,quota[i],used)));if(out.length<count)out.push(...takeBalanced(rows,count-out.length,used));return out}
function finishManifest({plan,scope,lesson,items,unsupported}){const rt=runtime();const manifest={id:id(),version:'45c',createdAt:new Date().toISOString(),planId:String(plan.id),bookLabel:plan.book_label||'',scope,lesson:lesson||null,total:items.length,items:items.map((q,i)=>({position:i+1,lesson:String(q.__lesson||lesson||''),unitId:String(q.__unitId||''),engine:rt.engineFor(q),question:q})),unsupported};if(unsupported.length)console.warn('[REV45c] unsupported usable questions excluded',unsupported);console.info('[REV45c] manifest',{scope,lesson,total:manifest.total,engines:manifest.items.reduce((m,x)=>(m[x.engine]=(m[x.engine]||0)+1,m),{}),unsupported:unsupported.length});return manifest}
function order(items){const vocab=items.filter(q=>norm(q.section)==='vocab_test'),rest=items.filter(q=>norm(q.section)!=='vocab_test');return[...shuffle(vocab),...shuffle(rest)]}

async function buildLesson(plan,lesson){
 const {bookId,unitMap}=await resolveBook(plan),unitId=unitMap.get(String(lesson));if(!unitId)throw new Error(`${lesson}을 콘텐츠 DB에서 찾지 못했습니다.`);
 const row=rowFor(plan,lesson),unsupported=[],pools={vocab_test:[],communication:[],grammar:[],reading:[]};
 if(vocabAllowed(plan,row))pools.vocab_test=splitSupported(await vocabPool(unitId,lesson),unsupported);
 for(const section of sectionsFor(plan,row))pools[section]=splitSupported(await fetchSection(bookId,unitId,section,lesson),unsupported);
 const used=new Set(),picked=[];for(const key of ['vocab_test','communication','grammar','reading'])if(pools[key].length)picked.push(...takeBalanced(pools[key],BLUEPRINT[key],used));
 if(picked.length<25)picked.push(...takeBalanced(Object.values(pools).flat(),25-picked.length,used));
 return finishManifest({plan,scope:'lesson',lesson:String(lesson),items:order(picked.slice(0,25)),unsupported});
}

async function buildAll(plan){
 const {bookId,unitMap}=await resolveBook(plan),rows=lessonsFor(plan);if(!rows.length)throw new Error('시험 범위 Lesson이 없습니다.');
 const unsupported=[],pools={vocab_test:[],communication:[],grammar:[],reading:[]};
 for(const row of rows){const lesson=String(row.lesson),unitId=unitMap.get(lesson);if(!unitId)continue;if(vocabAllowed(plan,row))pools.vocab_test.push(...splitSupported(await vocabPool(unitId,lesson),unsupported));for(const section of sectionsFor(plan,row))pools[section].push(...splitSupported(await fetchSection(bookId,unitId,section,lesson),unsupported))}
 const used=new Set(),picked=[];for(const key of ['vocab_test','communication','grammar','reading'])if(pools[key].length)picked.push(...takeAcrossLessons(pools[key],BLUEPRINT[key],used));
 if(picked.length<25)picked.push(...takeAcrossLessons(Object.values(pools).flat(),25-picked.length,used));
 return finishManifest({plan,scope:'all',lesson:null,items:order(picked.slice(0,25)),unsupported});
}

window.WillenaExamBuilder={buildLesson,buildAll,resolveBook,lessonsFor,blueprint:{...BLUEPRINT}};
console.log('[REV45c] ExamBuilder ready');
})();
