// Dedicated Render Lab data source for Grammar Foundations.
// It is intentionally opt-in: the normal "All middle school" source never includes it.

export const GRAMMAR_FOUNDATIONS_BOOK_VALUE='__grammar_foundations__';

const API='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const nativeFetch=window.fetch.bind(window);
let cache=null;
let loading=null;

const book=()=>document.getElementById('book');
const selectedValue=()=>String(book()?.value||'');
const isSelected=()=>{
  const v=selectedValue();
  return v===GRAMMAR_FOUNDATIONS_BOOK_VALUE||v==='--grammar-foundations--'||v==='grammar-foundations';
};

async function get(path,range=''){
  const headers={...HEAD};if(range)headers.Range=range;
  const r=await nativeFetch(API+path,{headers,cache:'no-store'});
  if(!r.ok)throw new Error(`Grammar Foundations source ${r.status}: ${await r.text()}`);
  return r.json();
}
async function paged(path){
  const rows=[];
  for(let start=0;start<10000;start+=1000){
    const batch=await get(path,`${start}-${start+999}`);
    rows.push(...batch);
    if(batch.length<1000)break;
  }
  return rows;
}
function answerMode(form){
  if(form==='write')return'text';
  if(form==='multi')return'multi_select';
  return'single_select';
}

export async function loadGrammarFoundationRows(){
  if(cache)return cache;
  if(loading)return loading;
  loading=(async()=>{
    const [sets,stages,questions]=await Promise.all([
      get('/rest/v1/grammar_foundation_sets?select=id,code,title_en,title_ko,group_number,group_order&frontend_visible=eq.true&status=eq.published&order=group_number.asc,group_order.asc'),
      get('/rest/v1/grammar_foundation_stages?select=id,set_id,code,stage_number,title_en,title_ko&frontend_visible=eq.true&status=eq.published&order=set_id.asc,stage_number.asc'),
      paged('/rest/v1/grammar_foundation_questions?select=id,stage_id,source_key,form,prompt_text,context,choices,correct_answer,input,grading,tracking,metadata,sort_order,status,created_at,updated_at&status=eq.published&order=stage_id.asc,sort_order.asc')
    ]);
    const setById=new Map(sets.map(x=>[String(x.id),x]));
    const stageById=new Map(stages.map(x=>[String(x.id),x]));
    cache=questions.map(q=>{
      const stage=stageById.get(String(q.stage_id));
      const set=stage&&setById.get(String(stage.set_id));
      if(!stage||!set)return null;
      return {
        id:q.id,book_id:null,unit_id:null,source_id:null,
        source_question_number:q.sort_order,source_page:null,section:'grammar',
        question_type:`grammar_foundations_${q.form}`,form:q.form,prompt_text:q.prompt_text,
        context:{...(q.context||{}),grammarFoundation:{step:set.group_number,setCode:set.code,setTitleKo:set.title_ko,setTitleEn:set.title_en,level:stage.stage_number,stageCode:stage.code,stageTitleKo:stage.title_ko,stageTitleEn:stage.title_en}},
        choices:Array.isArray(q.choices)?q.choices:[],
        correct_answer:Array.isArray(q.correct_answer)?q.correct_answer:[],
        answer_mode:answerMode(q.form),
        student_source_label:`Grammar Foundations · Step ${set.group_number} · ${set.title_ko||set.title_en} · Level ${stage.stage_number}`,
        content_status:'published',
        metadata:{...(q.metadata||{}),sourceKey:q.source_key,grammarFoundation:true,step:set.group_number,setCode:set.code,stageCode:stage.code,input:q.input||{},grading:q.grading||{},tracking:q.tracking||{}},
        targets:q.tracking?.targets||[set.code],replacement_needed:false,
        created_at:q.created_at||null,updated_at:q.updated_at||q.created_at||null
      };
    }).filter(Boolean);
    loading=null;
    return cache;
  })().catch(e=>{loading=null;throw e});
  return loading;
}

// Render Lab was originally written around textbook UUIDs. Grammar Foundations is
// a virtual book, so protect every textbook-only loader from receiving its sentinel.
// The normal All Middle School path is untouched and therefore never includes GF.
window.fetch=async function(input,init){
  const url=typeof input==='string'?input:input?.url||'';
  if(!isSelected())return nativeFetch(input,init);
  if(url.includes('/rest/v1/test_prep_questions')){
    const rows=await loadGrammarFoundationRows();
    return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(url.includes('/rest/v1/source_content_occurrences')||url.includes('/rest/v1/lexical_entries')||url.includes('/rest/v1/content_units')||url.includes('/rest/v1/passages')){
    return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
  }
  return nativeFetch(input,init);
};

function ensureOption(){
  const el=book();if(!el||el.querySelector(`option[value="${GRAMMAR_FOUNDATIONS_BOOK_VALUE}"]`))return;
  // Remove any older temporary option so there is only one dedicated GF filter.
  [...el.options].filter(o=>/grammar foundations/i.test(o.textContent||'')).forEach(o=>o.remove());
  const option=document.createElement('option');option.value=GRAMMAR_FOUNDATIONS_BOOK_VALUE;option.textContent='Grammar Foundations';
  const first=el.querySelector('option[value="*"]');
  if(first)first.insertAdjacentElement('afterend',option);else el.prepend(option);
}

const bookEl=book();
if(bookEl){
  const observer=new MutationObserver(ensureOption);observer.observe(bookEl,{childList:true});ensureOption();
  bookEl.addEventListener('change',()=>{
    if(isSelected()){
      const skill=document.getElementById('skill');
      if(skill&&[...skill.options].some(o=>o.value==='grammar'))skill.value='grammar';
    }
  },true);
}
