// Uses the exact student book assignment and textbook-content services Word Genius uses.
// Never invent textbook sentences or replace a missing translation with AI text.
const CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const OP_URL='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/get_study_assignment_for_class';
const OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const available='in.(review,published)';
const str=value=>String(value??'').trim();

async function content(path){
  const result=[];
  for(let offset=0;offset<=100000;offset+=800){
    const sep=path.includes('?')?'&':'?';
    const response=await fetch(CONTENT_URL+path+sep+'limit=800&offset='+offset,{
      headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store'
    });
    if(!response.ok)throw Error('Content DB request failed ('+response.status+')');
    const rows=await response.json();
    if(!Array.isArray(rows))throw Error('Unexpected textbook data');
    result.push(...rows);
    if(rows.length<800)return result;
  }
  throw Error('Textbook pagination limit reached');
}
async function authenticated(path){
  const fn=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
  const response=await fn(path,{credentials:'include',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data?.success)throw Error(data?.error||'Student session expired');
  return data;
}
export async function studentIdentity(){
  let data;
  try{data=await authenticated('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now())}
  catch(error){
    // Reuse the existing gateway refresh, as Word Genius does.
    const refresh=await authenticated('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
    if(refresh.access_token)window.WillenaAPI?.setLocalTokens?.(refresh.access_token,'');
    data=await authenticated('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
  }
  return {id:str(data.user_id||data.id),className:str(data.class),data};
}
export async function assignedBooks(className){
  if(!className)throw Error('No class assigned to this student.');
  const response=await fetch(OP_URL,{
    method:'POST',headers:{apikey:OP_KEY,Authorization:'Bearer '+OP_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_class_name:className}),cache:'no-store'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success)throw Error(data.error||'Could not load assigned books');
  const rows=Array.isArray(data.assignments)&&data.assignments.length?data.assignments:(data.assignment?[data.assignment]:[]);
  const unique=new Map(rows.filter(x=>x?.book_id).map(x=>[x.book_id,{id:x.book_id,title:str(x.book_title||x.title)||'Textbook'}]));
  return [...unique.values()];
}
export async function loadUnits(bookId){
  return content('content_units?select=id,title,unit_number,book_id&book_id=eq.'+encodeURIComponent(bookId)+'&status='+available+'&order=unit_number.asc');
}
export async function loadSentences(bookId,unitId){
  // Restrict rows to this book AND unit. Only sourced sentence links are eligible.
  const rows=await content('source_content_occurrences?select=id,sentence_id,source_text,page_number&book_id=eq.'+encodeURIComponent(bookId)+'&unit_id=eq.'+encodeURIComponent(unitId)+'&sentence_id=not.is.null&status='+available+'&order=page_number.asc');
  const ids=[...new Set(rows.map(row=>str(row.sentence_id)).filter(Boolean))];
  if(!ids.length)return [];
  const sentences=[];
  for(let i=0;i<ids.length;i+=50){
    const list=ids.slice(i,i+50);
    sentences.push(...await content('sentences?select=id,text,canonical_text,translation_ko,status&status='+available+'&id=in.'+encodeURIComponent('('+list.join(',')+')')));
  }
  const lookup=new Map(sentences.map(row=>[row.id,row]));
  const seen=new Set();
  return rows.flatMap(occurrence=>{
    const s=lookup.get(occurrence.sentence_id),en=str(s?.canonical_text||s?.text),ko=str(s?.translation_ko);
    if(!s||!en||!ko||seen.has(s.id))return [];
    // Single words and punctuation-only fragments are not sentences for this app.
    if(en.split(/\s+/).length<3||!/[a-z]/i.test(en))return [];
    seen.add(s.id);
    return [{id:s.id,occurrenceId:occurrence.id,en,ko,source:occurrence.source_text||'',page:occurrence.page_number}];
  });
}
