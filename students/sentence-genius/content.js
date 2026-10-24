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

/**
 * Staff simulation is read-only. Identity comes from the existing authenticated
 * cookie session. Never infer the user's role from a URL or a class selection.
 */
export async function signedInProfile(userId){
  if(!userId)throw Error('Sign in first');
  // Student WHOAMI has no role or class. Verify the signed-in user's actual
  // role through the existing role endpoint, instead of guessing from class.
  const resource='&user_id='+encodeURIComponent(userId)+'&_='+Date.now();
  const [profileResult,roleResult]=await Promise.allSettled([
    authenticated('/.netlify/functions/supabase_auth?action=get_profile'+resource),
    authenticated('/.netlify/functions/supabase_auth?action=get_role'+resource)
  ]);
  if(profileResult.status==='rejected'&&roleResult.status==='rejected'){
    throw Error('Could not verify account permissions. Please sign in again.');
  }
  const profile=profileResult.status==='fulfilled'?profileResult.value:{};
  const roleData=roleResult.status==='fulfilled'?roleResult.value:{};
  const confirmedRole=str(roleData.role||profile.role).toLowerCase();
  if(!confirmedRole)throw Error('Your account role could not be verified.');
  return {role:confirmedRole,approved:profile.approved!==false,
    className:str(profile.class),name:str(profile.name)};
}
async function staffAccessToken(){
  let token=window.WillenaAPI?.getLocalAccessToken?.();
  if(token&&token.split('.').length===3)return token;
  // Same existing auth refresh as Word Genius; no new credentials or cookies.
  const result=await authenticated('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
  token=result?.access_token||'';
  if(token&&token.split('.').length===3){
    window.WillenaAPI?.setLocalTokens?.(token,'');
    return token;
  }
  throw Error('Teacher session could not be refreshed. Sign in again.');
}
export async function loadTeacherClasses(){
  const token=await staffAccessToken();
  const endpoint='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/get_sentence_genius_teacher_classes';
  const response=await fetch(endpoint,{method:'POST',cache:'no-store',
    headers:{apikey:OP_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.success!==true)throw Error(data?.message||data?.error||
    'Could not load teacher classes ('+response.status+')');
  return Array.isArray(data.classes)?data.classes:[];
}
export async function loadTeacherBookCatalog(){
  const rows=await content('content_books?select=id,title,status&status='+available+'&order=title.asc');
  return rows.map(row=>({id:str(row.id),title:str(row.title)||'Untitled book'})).filter(row=>row.id);
}
export async function loadTeacherClassHomework(className){
  if(!className)return [];
  // This is a read-only list; viewing homework never creates a student run.
  const result=await authenticated('/.netlify/functions/homework_api?action=list_assignments&class='+
    encodeURIComponent(className)+'&_='+Date.now());
  const rows=Array.isArray(result.assignments)?result.assignments:[];
  return rows.filter(row=>row.active!==false&&!row.ended_at).map(row=>{
    let meta=row.list_meta||{};
    if(typeof meta==='string'){try{meta=JSON.parse(meta)}catch{meta={}}}
    if(!meta||typeof meta!=='object')meta={};
    return{id:str(row.id),title:str(row.title||row.list_title||'Homework'),
      dueAt:row.due_at||null,
      bookId:str(meta.source_book_id||meta.book_id||meta.bookId||''),
      unitId:str(meta.source_unit_id||meta.unit_id||meta.unitId||''),
      listKey:str(row.list_key),type:str(meta.app||meta.app_key||row.list_title||'')};
  });
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
  // Sentence Genius teaches textbook patterns, not arbitrary book sentences.
  // Keep only examples already connected to an explicit grammar/sentence pattern.
  const patternIds=new Set();
  for(let i=0;i<ids.length;i+=50){
    const group=ids.slice(i,i+50);
    const linked=await content('sentence_patterns?select=sentence_id&sentence_id=in.'+
      encodeURIComponent('('+group.join(',')+')'));
    linked.forEach(row=>patternIds.add(row.sentence_id));
  }
  const lookup=new Map(sentences.map(row=>[row.id,row]));
  const seen=new Set();
  // A unit's linked pattern examples are the core Sentence Genius content.
  // For older books without enough published mappings, use only genuine
  // translated sentences from their actual source occurrences as fallback.
  const linkedRows=rows.filter(row=>patternIds.has(row.sentence_id));
  const ordered=(linkedRows.length>=3?linkedRows:rows).slice().sort(
    (a,b)=>Number(patternIds.has(b.sentence_id))-Number(patternIds.has(a.sentence_id))
  );
  return ordered.flatMap(occurrence=>{
    const s=lookup.get(occurrence.sentence_id),en=str(s?.canonical_text||s?.text),ko=str(s?.translation_ko);
    if(!s||!en||!ko||seen.has(s.id))return [];
    // Single words and punctuation-only fragments are not sentences for this app.
    if(en.split(/\s+/).length<2||!/[a-z]/i.test(en))return [];
    seen.add(s.id);
    return [{id:s.id,occurrenceId:occurrence.id,en,ko,source:occurrence.source_text||'',page:occurrence.page_number}];
  });
}
