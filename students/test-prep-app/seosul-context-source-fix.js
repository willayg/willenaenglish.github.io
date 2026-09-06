(function(){
'use strict';
if(window.__willenaSeosulContextSourceFix)return;
window.__willenaSeosulContextSourceFix=true;

const clean=v=>String(v??'').replace(/\\\\n/g,'\n').replace(/\\n/g,'\n').trim();
const textItem=v=>{
  if(v==null)return '';
  if(typeof v==='string'||typeof v==='number')return clean(v);
  if(Array.isArray(v))return v.map(textItem).filter(Boolean).join(' / ');
  if(typeof v==='object'){
    const bits=[];
    if(v.korean)bits.push(clean(v.korean));
    if(v.definition)bits.push(clean(v.definition));
    if(v.sentence)bits.push(clean(v.sentence));
    if(v.question)bits.push(clean(v.question));
    if(v.label)bits.push(clean(v.label));
    if(bits.length)return bits.join(' → ');
    return Object.entries(v).map(([k,val])=>`${k}: ${textItem(val)}`).join(' / ');
  }
  return clean(v);
};
const arr=v=>Array.isArray(v)?v.map(textItem).filter(Boolean):v==null?[]:[textItem(v)].filter(Boolean);

function normalizeContext(raw){
  const c=raw&&typeof raw==='object'&&!Array.isArray(raw)?{...raw}:{};
  if(!c.provided_words){
    if(Array.isArray(c.word_bank))c.provided_words=c.word_bank;
    else if(Array.isArray(c.bank))c.provided_words=c.bank;
    else if(Array.isArray(c.given))c.provided_words=c.given;
    else if(typeof c.given==='string')c.provided_words=[c.given];
    else if(c.base_word)c.provided_words=[c.base_word];
  }
  if(!c.options&&c.choices&&typeof c.choices==='object'&&!Array.isArray(c.choices))c.options=Object.entries(c.choices).map(([k,v])=>`${k} ${textItem(v)}`);
  if(!c.options&&Array.isArray(c.choices))c.options=c.choices;

  const sourceLines=[];
  if(c.setup)sourceLines.push(textItem(c.setup));
  if(c.relation)sourceLines.push(textItem(c.relation));
  if(c.source)sourceLines.push(textItem(c.source));
  if(c.start)sourceLines.push(textItem(c.start));
  if(c.summary)sourceLines.push(textItem(c.summary));
  if(c.phrase)sourceLines.push(textItem(c.phrase));
  if(Array.isArray(c.rules))sourceLines.push(...arr(c.rules));
  if(Array.isArray(c.segments))sourceLines.push(...arr(c.segments));
  if(Array.isArray(c.items))sourceLines.push(...arr(c.items));
  if(sourceLines.length){
    const existing=arr(c.sentences);
    const combined=[...existing,...sourceLines].filter((v,i,a)=>v&&a.indexOf(v)===i);
    if(combined.length)c.sentences=combined;
  }
  if(Array.isArray(c.questions)&&c.questions.length){
    const qs=arr(c.questions);
    if(!c.question)c.question=qs;
    else c.question=[...arr(c.question),...qs];
  }
  if(c.word_count){
    const rule=`${c.word_count}단어`,conditions=arr(c.conditions);
    if(!conditions.includes(rule))c.conditions=[...conditions,rule];
  }
  if(Array.isArray(c.sentences))c.sentences=c.sentences.map(textItem).filter(Boolean);
  if(Array.isArray(c.conditions))c.conditions=c.conditions.map(textItem).filter(Boolean);
  if(Array.isArray(c.provided_words))c.provided_words=c.provided_words.map(textItem).filter(Boolean);
  if(Array.isArray(c.options))c.options=c.options.map(textItem).filter(Boolean);
  if(Array.isArray(c.question))c.question=c.question.map(textItem).filter(Boolean);
  return c;
}

window.WillenaNormalizeAuthoredContext=normalizeContext;

// Legacy authored practice still expects the normalized aliases, but this must
// NEVER alter general Test Prep, mock, or REV49 review question fetches.
const originalFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const response=await originalFetch(input,init);
  try{
    const url=typeof input==='string'?input:String(input?.url||'');
    const authoredBank=url.includes('/rest/v1/test_prep_questions')
      &&url.includes('source_id,source_question_number,source_page')
      &&url.includes('replacement_needed')
      &&url.includes('unit_id=eq.');
    if(!authoredBank)return response;
    const json=await response.clone().json();
    if(!Array.isArray(json))return response;
    const rows=json.map(row=>{
      if(!row||typeof row!=='object'||!row.context)return row;
      const m=row.metadata||{};
      const authored=m.constructed_response_authored===true||m.authored_constructed_response===true;
      return authored?{...row,context:normalizeContext(row.context)}:row;
    });
    return new Response(JSON.stringify(rows),{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(_){return response}
};
console.log('[REV49d] context normalization scoped to legacy authored bank only');
})();