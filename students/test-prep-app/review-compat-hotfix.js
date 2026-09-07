(function(){
'use strict';
if(window.__WillenaReviewCompatHotfix)return;
window.__WillenaReviewCompatHotfix=true;
const nativeFetch=window.fetch.bind(window);
const REVIEW_EDGE='test-prep-review-v48';
const CONTENT_Q='/rest/v1/test_prep_questions';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const CONTENT_HEADERS={apikey:CONTENT_KEY,Authorization:`Bearer ${CONTENT_KEY}`};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function stripConstructedFlags(o){if(!o||typeof o!=='object')return o;delete o.constructed_response;delete o.authored_constructed_response;delete o.constructed_response_authored;return o}
function choiceMode(row){const mode=String(row?.answer_mode||'').toLowerCase();return Array.isArray(row?.choices)&&row.choices.length>0&&(mode.includes('choice')||mode.includes('select')||mode==='single'||mode==='multi')}
function readableTable(t){
 if(!t||typeof t!=='object'||!Array.isArray(t.rows))return t;
 const cols=Array.isArray(t.columns)?t.columns:[];
 const lines=[];
 if(cols.length)lines.push(['항목',...cols].join(' | '));
 for(const row of t.rows){if(Array.isArray(row))lines.push(row.map(x=>String(x??'')).join(' | '));else lines.push(String(row??''))}
 return lines.join('\n');
}
function cleanQuestion(row){
 if(!row||typeof row!=='object')return row;
 if(choiceMode(row))row.metadata=stripConstructedFlags({...row.metadata});
 const c=row.context&&typeof row.context==='object'?{...row.context}:{};
 if(c.summary!=null&&c.summary!==''&&c.given_sentence==null)c.given_sentence=c.summary;
 if(c.provided_words!=null&&c.provided_words!==''&&c.bank==null)c.bank=c.provided_words;
 if(c.passage_start!=null&&c.passage_start!==''&&c.passage==null&&c.segments==null)c.passage=c.passage_start;
 if(c.table&&typeof c.table==='object')c.table=readableTable(c.table);
 row.context=c;
 return row;
}
function cleanReviewItem(item){
 if(!item||typeof item!=='object')return item;
 let a={...(item.attempt_metadata||{})},m={...(item.metadata||{})};
 if(a.source==='wrong-review')delete a.source;if(m.source==='wrong-review')delete m.source;
 const ko=a.context_translation_ko||m.context_translation_ko||a.translation_ko||m.translation_ko||a.korean||m.korean||null;
 if(ko){if(!a.translation_ko)a.translation_ko=ko;if(!m.translation_ko)m.translation_ko=ko;}
 const realQuestion=UUID.test(String(item.question_id||''));
 const explicitConstructed=String(item.practice_type||'').toLowerCase()==='constructed_response';
 if(realQuestion&&!explicitConstructed){a=stripConstructedFlags(a);m=stripConstructedFlags(m);}
 item.attempt_metadata=a;item.metadata=m;
 return item;
}
async function enrichVocab(items){
 const need=(items||[]).filter(x=>['vocabulary','vocab_test'].includes(String(x?.practice_type||'').toLowerCase())&&UUID.test(String(x?.question_id||''))).filter(x=>{const a=x.attempt_metadata||{},m=x.metadata||{};return !(a.canonical_text||m.canonical_text)&&!(a.translation_ko||m.translation_ko)});
 const ids=[...new Set(need.map(x=>String(x.question_id)))];if(!ids.length)return;
 try{
  const q=encodeURIComponent(`(${ids.join(',')})`);
  const r=await nativeFetch(`${CONTENT}/rest/v1/lexical_entries?select=id,canonical_text,translation_ko,definition_en&id=in.${q}`,{headers:CONTENT_HEADERS,cache:'no-store'});
  if(!r.ok)return;const rows=await r.json().catch(()=>[]),map=new Map(rows.map(x=>[String(x.id),x]));
  for(const item of need){const lex=map.get(String(item.question_id));if(!lex)continue;const a={...(item.attempt_metadata||{})},m={...(item.metadata||{})};for(const k of ['canonical_text','translation_ko','definition_en']){if(lex[k]!=null&&lex[k]!==''){if(!a[k])a[k]=lex[k];if(!m[k])m[k]=lex[k]}}item.attempt_metadata=a;item.metadata=m;}
 }catch(_){}
}
window.fetch=async function(input,init){
 const url=typeof input==='string'?input:String(input?.url||'');
 const res=await nativeFetch(input,init);
 const reviewEdge=url.includes(REVIEW_EDGE);
 const reviewContent=url.includes(CONTENT_Q)&&window.__WillenaReviewV49Active===true;
 if(!res.ok||(!reviewEdge&&!reviewContent))return res;
 try{
  const data=await res.clone().json();
  if(reviewContent){if(Array.isArray(data))data.forEach(cleanQuestion);else cleanQuestion(data)}
  else if(reviewEdge&&Array.isArray(data?.reviews)){data.reviews.forEach(cleanReviewItem);await enrichVocab(data.reviews)}
  const headers=new Headers(res.headers);headers.set('content-type','application/json');
  return new Response(JSON.stringify(data),{status:res.status,statusText:res.statusText,headers});
 }catch(_){return res}
};
console.log('[review-compat-hotfix] active');
})();
