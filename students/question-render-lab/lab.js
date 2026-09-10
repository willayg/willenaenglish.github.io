// TEST HARNESS ONLY. Rendering and grading MUST come from the canonical modules below.
import {FORMS,adaptStored} from '../test-prep-v2/question-model.js';
import {QuestionRenderer} from '../test-prep-v2/question-renderer.js';
import {gradeQuestion} from '../shared/question-grader.js?v=2.0.0';
import {splitPassageSentences} from '../test-prep-v2/passage-utils.js';

const API='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”"]/g,'').replace(/[.!?,;:]+$/g,'').replace(/\s+/g,' ').trim();
const FORM_LABELS={choice:'Multiple choice',multi:'Multi-select',write:'Written answer',multipart:'Multi-part answer',correction:'Correction',identified_correction:'Identified correction',order:'Word order',chunks:'Chunk order',blanks:'Fill blanks with words',learn:'Learn / read only',unsupported:'Unsupported shape'};
const SKILLS=[['*','All subjects','all'],['communication','Communication','stored'],['grammar','Grammar','stored'],['reading','Reading','stored'],['vocabulary','Vocabulary','vocab'],['constructed','서술형','written'],['performance','수행평가','performance'],['sentences','본문','sentences']].map(([id,name,kind])=>({id,name,kind}));
let middleBooks=[],bookMap=new Map(),unitBookMap=new Map(),flaggedQuestionIds=new Set(),all=[],visible=[],index=0,renderer=null;

async function get(path,range=''){
  const headers={...HEAD};if(range)headers.Range=range;
  const r=await fetch(API+path,{headers,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json();
}
async function paged(path){const rows=[];for(let start=0;start<10000;start+=1000){const batch=await get(path,`${start}-${start+999}`);rows.push(...batch);if(batch.length<1000)break}return rows}
const selectedBookIds=()=>$('#book').value==='*'?middleBooks.map(x=>String(x.id)):[$('#book').value];
const inFilter=ids=>`in.(${ids.join(',')})`;
const selectedSkill=()=>SKILLS.find(x=>x.id===$('#skill').value);
const rowFields='id,book_id,unit_id,source_id,source_question_number,source_page,section,question_type,prompt_text,context,choices,correct_answer,answer_mode,student_source_label,content_status,metadata,targets,replacement_needed,created_at,updated_at';
async function loadOpenFlags(){
  const rows=await paged('/rest/v1/test_prep_question_flags?select=question_id&status=eq.open');
  flaggedQuestionIds=new Set(rows.map(r=>String(r.question_id||'')).filter(Boolean));
}
async function fetchRows(section='',answerMode=''){
  const ids=selectedBookIds(),sf=section?`&section=eq.${encodeURIComponent(section)}`:'',af=answerMode?`&answer_mode=eq.${encodeURIComponent(answerMode)}`:'';
  return (await paged(`/rest/v1/test_prep_questions?select=${encodeURIComponent(rowFields)}&student_usable=eq.true${sf}${af}&book_id=${inFilter(ids)}`)).filter(r=>r.replacement_needed!==true);
}
const adaptRows=rows=>rows.map(row=>({...adaptStored(row),_createdAt:row.created_at||null,_updatedAt:row.updated_at||row.created_at||null,_flagged:flaggedQuestionIds.has(String(row.id))}));
async function loadUnits(){const ids=selectedBookIds(),rows=await paged(`/rest/v1/content_units?select=id,book_id,title&book_id=${inFilter(ids)}`);unitBookMap=new Map(rows.map(r=>[String(r.id),String(r.book_id)]));return rows}

async function fetchLexical(ids){const out=[];for(let i=0;i<ids.length;i+=100)out.push(...await get(`/rest/v1/lexical_entries?select=id,canonical_text,translation_ko,definition_en,part_of_speech&id=${inFilter(ids.slice(i,i+100))}`));return out}
function distractorWords(entry,pool){const out=[],seen=new Set([norm(entry.canonical_text)]);for(const x of pool){const k=norm(x.canonical_text);if(x.id===entry.id||!k||seen.has(k))continue;seen.add(k);out.push(x.canonical_text);if(out.length===3)break}return out}
function generatedVocabRow(entry,bookId,pool,mode,write){
  const definition=mode==='definition',context=definition?{definition:entry.definition_en}:{korean:entry.translation_ko};
  if(write)return{id:`lab:vocab:${mode}:write:${entry.id}`,book_id:bookId,section:'vocabulary',question_type:`lab_vocab_${mode}_write`,prompt_text:definition?'다음 영어 정의에 해당하는 단어를 쓰세요.':'다음 우리말 뜻에 맞는 영어 단어 또는 표현을 쓰세요.',context,correct_answer:[entry.canonical_text],answer_mode:'text',student_source_label:'Book Reference'};
  const ds=distractorWords(entry,pool);if(ds.length<3)return null;const raw=[entry.canonical_text,...ds],shift=String(entry.id).split('').reduce((n,c)=>n+c.charCodeAt(0),0)%4,choices=raw.slice(shift).concat(raw.slice(0,shift));
  return{id:`lab:vocab:${mode}:choice:${entry.id}`,book_id:bookId,section:'vocabulary',question_type:`lab_vocab_${mode}_choice`,prompt_text:definition?'다음 영어 정의에 해당하는 단어를 고르세요.':'다음 우리말 뜻에 맞는 영어 단어 또는 표현을 고르세요.',context,choices,correct_answer:[String(choices.indexOf(entry.canonical_text)+1)],answer_mode:'single_select',student_source_label:'Book Reference'};
}
async function loadVocabulary(){
  const ids=selectedBookIds(),stored=await fetchRows('vocabulary'),occ=await paged(`/rest/v1/source_content_occurrences?select=book_id,lexical_entry_id&book_id=${inFilter(ids)}&occurrence_type=eq.lexical_entry&skill=eq.vocabulary`);
  const unique=[],seen=new Set();for(const o of occ){if(!o.lexical_entry_id)continue;const k=`${o.book_id}:${o.lexical_entry_id}`;if(!seen.has(k)){seen.add(k);unique.push(o)}}
  const entries=await fetchLexical([...new Set(unique.map(x=>String(x.lexical_entry_id)))]),byId=new Map(entries.map(x=>[String(x.id),x])),byBook=new Map();
  for(const p of unique){const e=byId.get(String(p.lexical_entry_id));if(!e?.canonical_text)continue;const b=String(p.book_id);if(!byBook.has(b))byBook.set(b,[]);byBook.get(b).push(e)}
  const generated=[];for(const [bookId,pool] of byBook)for(const e of pool){if(String(e.definition_en||'').trim()){generated.push(generatedVocabRow(e,bookId,pool,'definition',true),generatedVocabRow(e,bookId,pool,'definition',false))}if(String(e.translation_ko||'').trim()){generated.push(generatedVocabRow(e,bookId,pool,'korean',true),generatedVocabRow(e,bookId,pool,'korean',false))}}
  return adaptRows([...stored,...generated.filter(Boolean)]);
}

const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean);
function performanceVariants(row){
  const answers=(Array.isArray(row.correct_answer)?row.correct_answer:[row.correct_answer]).filter(Boolean).map(String),target=answers[0]||String(row.context?.target_en||'').trim();if(!target)return[];
  const ko=row.context?.prompt_ko||row.prompt_text||'',chunks=Array.isArray(row.context?.chunks)?row.context.chunks.filter(Boolean).map(String):[],base={...row,choices:[]},variants=[
    {...base,id:`${row.id}:learn`,form:FORMS.learn,prompt_text:'익히기',context:{korean:ko,chunks},correct_answer:[target]},
    {...base,id:`${row.id}:write`,form:FORMS.write,prompt_text:'직접쓰기',context:{korean:ko},correct_answer:[target],answer_mode:'text'},
    {...base,id:`${row.id}:order`,form:FORMS.order,prompt_text:'실전 배열',context:{korean:ko},correct_answer:[target],chips:words(target)}
  ];
  const ws=words(target);if(ws.length>=3){const picks=[Math.floor(ws.length/3),Math.floor(ws.length*2/3)].filter((x,i,a)=>x>=0&&x<ws.length&&a.indexOf(x)===i),missing=picks.map(i=>ws[i].replace(/^[“"'(]+|[”"'),.!?;:]+$/g,'')),masked=ws.map((w,i)=>picks.includes(i)?w.replace(/[A-Za-z][A-Za-z'-]*/,'_____'):w).join(' ');variants.push({...base,id:`${row.id}:blanks`,form:FORMS.blanks,prompt_text:'빈칸을 완성하세요.',context:{korean:ko,masked},correct_answer:missing,chips:[...missing].reverse()})}
  if(chunks.length>1)variants.push({...base,id:`${row.id}:chunks`,form:FORMS.chunks,prompt_text:'청크 배열',context:{korean:ko},correct_answer:[target],chips:chunks});
  return variants.map(v=>({...adaptStored(v),_createdAt:row.created_at||null,_updatedAt:row.updated_at||row.created_at||null,_flagged:flaggedQuestionIds.has(String(row.id))}));
}
async function loadPerformance(){return(await fetchRows('performance')).flatMap(performanceVariants)}
async function loadSentences(){
  const units=await loadUnits(),wanted=new Set(units.map(u=>String(u.id))),rows=await paged('/rest/v1/passages?select=id,title,body,source_key,metadata,created_at,updated_at&status=eq.published&order=source_key.asc'),out=[];
  for(const p of rows){const unitId=String(p.metadata?.unit_id||'');if(!wanted.has(unitId))continue;const bookId=unitBookMap.get(unitId)||null,translations=Array.isArray(p.metadata?.sentence_translations_ko)?p.metadata.sentence_translations_ko:[];for(const s of splitPassageSentences(p.body,p.title,p.id,translations))out.push({...adaptStored({id:`lab:sentence:${p.id}:${s.sentenceIndex}`,book_id:bookId,unit_id:unitId,section:'sentences',question_type:'sentence_unscramble',prompt_text:'다음 우리말 문장을 영어로 완성하세요.',context:{korean:s.ko||'',speaker:s.speaker||'',passage:s.passageTitle||''},correct_answer:[s.text],form:FORMS.order,chips:words(s.text),student_source_label:'Book Reference'}),_createdAt:p.created_at||null,_updatedAt:p.updated_at||p.created_at||null,_flagged:false})}
  return out;
}

function textTree(value){if(value==null)return'';if(typeof value==='string'||typeof value==='number')return String(value);if(Array.isArray(value))return value.map(textTree).join(' ');if(typeof value==='object')return Object.values(value).map(textTree).join(' ');return''}
function hasUnderline(q){const c=q?.context||{};return Boolean(String(c.underlined||'').trim()||(Array.isArray(c.underlined_spans)&&c.underlined_spans.length)||/밑줄|underlin/i.test(`${q?.prompt||''} ${q?.tracking?.questionType||''}`))}
function hasBlank(q){const hay=`${q?.prompt||''} ${q?.tracking?.questionType||''} ${textTree(q?.context||{})}`;return q?.form===FORMS.blanks||/빈칸|blank|cloze/i.test(hay)||/_{2,}/.test(hay)}
function featureMatch(q){const f=$('#feature').value;if(f==='underline')return hasUnderline(q);if(f==='blank')return hasBlank(q);return true}
function flagMatch(q){return ($('#flagged')?.value||'all')!=='flagged'||q?._flagged===true}
function selectedDateFilter(){
  const raw=$('#dateAdded')?.value||'all';if(raw==='all')return null;
  const [field,v]=raw.includes(':')?raw.split(':',2):['created',raw];
  const now=new Date();let cutoff=null;if(v==='today')cutoff=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  else{const days=v==='24h'?1:v==='3d'?3:v==='7d'?7:v==='30d'?30:0;cutoff=days?now.getTime()-days*86400000:null}
  return cutoff==null?null:{field,cutoff};
}
function dateMatch(q){const f=selectedDateFilter();if(!f)return true;const raw=f.field==='modified'?q?._updatedAt:q?._createdAt;const t=Date.parse(raw||'');return Number.isFinite(t)&&t>=f.cutoff}
function sortTime(q){const f=selectedDateFilter();const raw=f?.field==='modified'?q?._updatedAt:q?._createdAt;const t=Date.parse(raw||'');return Number.isFinite(t)?t:0}
function filteredPool(){return all.filter(q=>featureMatch(q)&&flagMatch(q)&&dateMatch(q))}
const dedupeQuestions=rows=>{const seen=new Set();return rows.filter(q=>{const k=String(q?.id??'');if(!k||seen.has(k))return false;seen.add(k);return true})};

async function loadSkill(){
  const s=selectedSkill();$('#card').innerHTML='<div class="empty">Loading…</div>';$('#book').disabled=false;
  if(s.kind==='all'){
    const groups=await Promise.all([
      fetchRows('communication').then(adaptRows),
      fetchRows('grammar').then(adaptRows),
      fetchRows('reading').then(adaptRows),
      loadVocabulary(),
      fetchRows('','text').then(adaptRows),
      loadPerformance(),
      loadSentences()
    ]);
    all=dedupeQuestions(groups.flat());
  }else if(s.kind==='stored')all=adaptRows(await fetchRows(s.id));else if(s.kind==='written')all=adaptRows(await fetchRows('','text'));else if(s.kind==='vocab')all=await loadVocabulary();else if(s.kind==='performance')all=await loadPerformance();else if(s.kind==='sentences')all=await loadSentences();else all=[];
  setForms();
}
function setForms(){
  const pool=filteredPool(),current=$('#form').value,counts=new Map();for(const q of pool)counts.set(q.form,(counts.get(q.form)||0)+1);
  $('#form').innerHTML=[...counts.entries()].map(([f,n])=>`<option value="${esc(f)}">${esc(FORM_LABELS[f]||f)} · ${n}</option>`).join('');if(current&&counts.has(current))$('#form').value=current;applyForm();
}
function applyForm(){visible=filteredPool().filter(q=>q.form===$('#form').value).sort((a,b)=>sortTime(b)-sortTime(a));index=0;render()}
function meta(q){const code=q?.source?.code||'',badge=$('#sourceBadge');badge.hidden=!code;badge.textContent=code;badge.title=code==='Z'?'Zocbo':code==='W'?'Willena authored':code==='B'?'Book reference':'';$('#bookTitle').textContent=q?.bookId?bookMap.get(String(q.bookId))||'':'';$('#count').textContent=`${visible.length} question${visible.length===1?'':'s'}`;$('#position').textContent=q?`Question ${index+1} of ${visible.length}`:'Question —'}
function render(){
  const q=visible[index];meta(q);$('#prev').disabled=index<=0;$('#next').disabled=!q||index>=visible.length-1;$('#check').disabled=!q||q.form===FORMS.learn||q.form===FORMS.unsupported;
  if(!q){$('#card').innerHTML='<div class="empty">No questions match these filters.</div>';renderer=null;return}
  renderer=new QuestionRenderer($('#card')).render(q,{onChange:(_,has)=>{if(q.form!==FORMS.learn)$('#check').disabled=!has}});
}
async function check(){const q=visible[index];if(!q||!renderer)return;$('#check').disabled=true;const result=await gradeQuestion(q,renderer.getResponse());renderer.showFeedback(result);$('#check').disabled=false}
async function boot(){
  try{
    [middleBooks]=await Promise.all([get('/rest/v1/content_books?select=id,title,school_grade&school_grade=in.(1,2,3)&order=school_grade.asc,title.asc'),loadOpenFlags()]);bookMap=new Map(middleBooks.map(b=>[String(b.id),b.title]));
    $('#skill').innerHTML=SKILLS.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');$('#book').innerHTML=`<option value="*">All middle school</option>${middleBooks.map(b=>`<option value="${esc(b.id)}">${esc(b.title)}</option>`).join('')}`;
    $('#skill').onchange=loadSkill;$('#book').onchange=loadSkill;$('#form').onchange=applyForm;$('#feature').onchange=setForms;$('#flagged').onchange=setForms;$('#dateAdded').onchange=setForms;$('#prev').onclick=()=>{if(index>0){index--;render()}};$('#next').onclick=()=>{if(index<visible.length-1){index++;render()}};$('#check').onclick=check;
    document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;if(e.key==='ArrowLeft')$('#prev').click();if(e.key==='ArrowRight')$('#next').click();if(e.key==='Enter'&&!$('#check').disabled)$('#check').click()});await loadSkill();
  }catch(e){console.error('[renderer lab]',e);$('#card').innerHTML=`<div class="empty">${esc(e.message||'Failed to load')}</div>`}
}
boot();