(function(){
'use strict';
if(window.__WillenaReviewCompatHotfix)return;
window.__WillenaReviewCompatHotfix=true;
const nativeFetch=window.fetch.bind(window);
const REVIEW_EDGE='test-prep-review-v48';
const CONTENT_Q='/rest/v1/test_prep_questions';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function stripConstructedFlags(o){
 if(!o||typeof o!=='object')return o;
 delete o.constructed_response;
 delete o.authored_constructed_response;
 delete o.constructed_response_authored;
 return o;
}
function choiceMode(row){
 const mode=String(row?.answer_mode||'').toLowerCase();
 return Array.isArray(row?.choices)&&row.choices.length>0&&(mode.includes('choice')||mode.includes('select')||mode==='single'||mode==='multi');
}
function cleanQuestion(row){
 if(!row||typeof row!=='object')return row;
 if(choiceMode(row))row.metadata=stripConstructedFlags({...row.metadata});
 const c=row.context&&typeof row.context==='object'?{...row.context}:{};
 if(c.summary!=null&&c.summary!==''&&c.given_sentence==null)c.given_sentence=c.summary;
 if(c.provided_words!=null&&c.provided_words!==''&&c.bank==null)c.bank=c.provided_words;
 if(c.passage_start!=null&&c.passage_start!==''&&c.passage==null&&c.segments==null)c.passage=c.passage_start;
 row.context=c;
 return row;
}
function cleanReviewItem(item){
 if(!item||typeof item!=='object')return item;
 let a={...(item.attempt_metadata||{})},m={...(item.metadata||{})};
 const ko=a.context_translation_ko||m.context_translation_ko||a.translation_ko||m.translation_ko||a.korean||m.korean||null;
 if(ko){if(!a.translation_ko)a.translation_ko=ko;if(!m.translation_ko)m.translation_ko=ko;}
 const realQuestion=UUID.test(String(item.question_id||''));
 const explicitConstructed=String(item.practice_type||'').toLowerCase()==='constructed_response';
 if(realQuestion&&!explicitConstructed){a=stripConstructedFlags(a);m=stripConstructedFlags(m);}
 item.attempt_metadata=a;item.metadata=m;
 return item;
}
window.fetch=async function(input,init){
 const url=typeof input==='string'?input:String(input?.url||'');
 const res=await nativeFetch(input,init);
 const reviewEdge=url.includes(REVIEW_EDGE);
 const reviewContent=url.includes(CONTENT_Q)&&window.__WillenaReviewV49Active===true;
 if(!res.ok||(!reviewEdge&&!reviewContent))return res;
 try{
  const data=await res.clone().json();
  if(reviewContent){
   if(Array.isArray(data))data.forEach(cleanQuestion);else cleanQuestion(data);
  }else if(reviewEdge&&Array.isArray(data?.reviews)){
   data.reviews.forEach(cleanReviewItem);
  }
  const headers=new Headers(res.headers);headers.set('content-type','application/json');
  return new Response(JSON.stringify(data),{status:res.status,statusText:res.statusText,headers});
 }catch(_){return res}
};
console.log('[review-compat-hotfix] active');
})();
