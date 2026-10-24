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
function validJwt(token){
  if(!token||token.split('.').length!==3)return false;
  try{
    const raw=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const claims=JSON.parse(atob(raw));
    return Number(claims.exp)*1000>Date.now()+30000;
  }catch{return false}
}
export async function staffAccessToken(forceRefresh=false){
  const token=window.WillenaAPI?.getLocalAccessToken?.();
  if(!forceRefresh&&validJwt(token))return token;
  // Respect the current signed-in user: do not open a guest or student
  // session to bypass permission checks.
  const data=await authenticated('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now());
  const refreshed=data?.access_token||'';
  if(!validJwt(refreshed)){
    if(validJwt(token)&&!forceRefresh)return token;
    throw Error('Teacher session could not be refreshed. Sign in again.');
  }
  window.WillenaAPI?.setLocalTokens?.(refreshed,'');
  return refreshed;
}
export async function loadTeacherClasses(){
  const endpoint='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/get_sentence_genius_teacher_classes';
  const request=token=>fetch(endpoint,{method:'POST',cache:'no-store',
    headers:{apikey:OP_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
  let response=await request(await staffAccessToken());
  if(response.status===401)response=await request(await staffAccessToken(true));
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
// Grading context is sourced dynamically from the current textbook and unit.
// Links to grammar patterns are informative, not automatically strict targets.
// Only a published per-occurrence override can require a specific structure.
export async function loadUnits(bookId){
  return content('content_units?select=id,title,unit_number,book_id,metadata&book_id=eq.'+
    encodeURIComponent(bookId)+'&status='+available+'&order=unit_number.asc');
}
const chunks=(items,size=50)=>Array.from({length:Math.ceil(items.length/size)},
  (_,i)=>items.slice(i*size,(i+1)*size));
const idList=ids=>encodeURIComponent('('+ids.join(',')+')');
const topics=value=>{
  if(Array.isArray(value))return value.map(str).filter(Boolean);
  const text=str(value);return text?[text]:[];
};
// Published operational decisions are read-only for students and verified
// against the exact textbook target and published policy version below.
async function sharedDecisions(occurrenceIds){
  const all=[];
  for(const part of chunks(occurrenceIds,80)){
    const response=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/get_sentence_genius_decisions_v1',{
      method:'POST',cache:'no-store',
      headers:{apikey:OP_KEY,Authorization:'Bearer '+OP_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_occurrence_ids:part})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data?.success)throw Error('Shared grading decisions unavailable');
    all.push(...(Array.isArray(data.decisions)?data.decisions:[]));
  }
  return all;
}
export async function loadSentences(bookId,unitId,unit={}){
  const rows=await content('source_content_occurrences?select=id,sentence_id,source_text,page_number'+
    '&book_id=eq.'+encodeURIComponent(bookId)+'&unit_id=eq.'+encodeURIComponent(unitId)+
    '&sentence_id=not.is.null&status='+available+'&order=page_number.asc');
  const ids=[...new Set(rows.map(row=>str(row.sentence_id)).filter(Boolean))];
  if(!ids.length)return [];

  // These requests are parallel; there are no per-book hardcoded cases.
  const [sentenceChunks,linkChunks,policyChunks,moderated]=await Promise.all([
    Promise.all(chunks(ids).map(part=>content('sentences?select=id,text,canonical_text,'+
      'translation_ko,contraction_policy,grammar_notes,metadata,status&status='+available+
      '&id=in.'+idList(part)))),
    Promise.all(chunks(ids).map(part=>content('sentence_patterns?select=sentence_id,'+
      'pattern_id,relationship,is_primary&sentence_id=in.'+idList(part)))),
    Promise.all(chunks(rows.map(row=>row.id)).map(part=>content(
      'sentence_genius_policies?select=occurrence_id,grading_mode,required_pattern_id,'+
      'accepted_alternatives,policy_version,status&status=eq.published&occurrence_id=in.'+
      idList(part)))),
    sharedDecisions(rows.map(row=>row.id)).catch(error=>{
      console.warn('[Sentence Genius] shared decisions unavailable',error);
      return [];
    })
  ]);
  const sentenceMap=new Map(sentenceChunks.flat().map(row=>[row.id,row]));
  const linksBySentence=new Map();
  const linkedIds=new Set();
  const patternIds=new Set();
  for(const link of linkChunks.flat()){
    linkedIds.add(link.sentence_id);
    if(!linksBySentence.has(link.sentence_id))linksBySentence.set(link.sentence_id,[]);
    linksBySentence.get(link.sentence_id).push(link);
    if(link.pattern_id)patternIds.add(link.pattern_id);
  }
  const decisionsByOccurrence=new Map();
  for(const decision of moderated){
    const key=str(decision.occurrence_id);
    if(!decisionsByOccurrence.has(key))decisionsByOccurrence.set(key,[]);
    decisionsByOccurrence.get(key).push(decision);
  }
  const policyByOccurrence=new Map(policyChunks.flat().map(row=>[row.occurrence_id,row]));
  for(const row of policyByOccurrence.values())if(row.required_pattern_id)patternIds.add(row.required_pattern_id);
  const patternChunks=await Promise.all(chunks([...patternIds]).map(part=>content(
    'patterns?select=id,code,name,grammar_category,language_function,response_pattern,'+
    'accepted_patterns,status&status='+available+'&id=in.'+idList(part))));
  const patterns=new Map(patternChunks.flat().map(row=>[row.id,row]));
  const metadata=unit?.metadata&&typeof unit.metadata==='object'?unit.metadata:{};
  const unitGrammar=[...new Set([
    ...topics(metadata.main_grammar_points),...topics(metadata.grammar)
  ])];
  // For older books, prioritize linked examples but retain real sourced
  // sentence occurrences as fallback. This does not enforce a grammar target.
  const linked=rows.filter(row=>linkedIds.has(row.sentence_id));
  const ordered=(linked.length>=3?linked:rows).slice().sort(
    (a,b)=>Number(linkedIds.has(b.sentence_id))-Number(linkedIds.has(a.sentence_id)));
  const seen=new Set();
  return ordered.flatMap(occurrence=>{
    const s=sentenceMap.get(occurrence.sentence_id);
    const en=str(s?.canonical_text||s?.text),ko=str(s?.translation_ko);
    if(!s||!en||!ko||seen.has(s.id))return [];
    if(en.split(/\s+/).length<2||!/[a-z]/i.test(en))return [];
    seen.add(s.id);
    const override=policyByOccurrence.get(occurrence.id);
    const version=Number(override?.policy_version)||0;
    const reviewed=(decisionsByOccurrence.get(str(occurrence.id))||[]).filter(row=>
      String(row.sentence_id)===String(s.id)&&
      String(row.canonical_text).trim()===en&&
      Number(row.policy_version)===version);
    const sharedApproved=reviewed.filter(row=>row.decision==='approved')
      .map(row=>str(row.response_text));
    const sharedRejected=reviewed.filter(row=>row.decision==='rejected')
      .map(row=>str(row.response_text));
    const linkedPatterns=(linksBySentence.get(s.id)||[]).flatMap(link=>{
      const pattern=patterns.get(link.pattern_id);
      if(!pattern)return [];
      return [{id:pattern.id,code:str(pattern.code),name:str(pattern.name),
        category:str(pattern.grammar_category),function:str(pattern.language_function),
        relationship:str(link.relationship),responsePattern:str(pattern.response_pattern),
        // Reference templates may mix questions and answers. Never auto-accept.
        exampleTemplates:Array.isArray(pattern.accepted_patterns)?pattern.accepted_patterns:[]}];
    });
    const requiredPattern=override?.required_pattern_id?
      patterns.get(override.required_pattern_id):null;
    const sentenceMetadata=s.metadata&&typeof s.metadata==='object'?s.metadata:{};
    return [{
      id:s.id,occurrenceId:occurrence.id,en,ko,source:occurrence.source_text||'',
      page:occurrence.page_number,
      gradingContext:{
        bookId,unitId,occurrenceId:occurrence.id,sentenceId:s.id,
        mode:override?.grading_mode||'flexible',
        policySource:override?'published_override':'default_flexible',
        policyVersion:version,
        requiredPatternId:override?.required_pattern_id||null,
        requiredPatternName:str(requiredPattern?.name),
        approvedAlternatives:Array.isArray(override?.accepted_alternatives)?
          override.accepted_alternatives:[],
        sharedApproved,sharedRejected,
        contractionPolicy:str(s.contraction_policy)||'allow_equivalent',
        grammarNotes:str(s.grammar_notes),
        patternCode:str(sentenceMetadata.pattern_code),
        unitGrammar,linkedPatterns
      }
    }];
  });
}
