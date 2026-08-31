(function(){
'use strict';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
async function unitWords(unitId){
 try{
  const occRes=await fetch(`${CONTENT}/rest/v1/source_content_occurrences?select=lexical_entry_id&unit_id=eq.${encodeURIComponent(unitId)}&occurrence_type=eq.lexical_entry&skill=eq.vocabulary`,{headers:HEAD,cache:'no-store'});
  if(!occRes.ok)return[];
  const occ=await occRes.json();
  const ids=[...new Set((occ||[]).map(x=>x.lexical_entry_id).filter(Boolean))];
  if(!ids.length)return[];
  const listRes=await fetch(`${CONTENT}/rest/v1/lexical_entries?select=id,canonical_text&id=in.${encodeURIComponent('('+ids.join(',')+')')}`,{headers:HEAD,cache:'no-store'});
  if(!listRes.ok)return[];
  const rows=await listRes.json();
  return [...new Set((rows||[]).map(x=>String(x.canonical_text||'').trim()).filter(Boolean))];
 }catch(e){console.warn('[test-prep] mock vocab fallback words unavailable',e);return[]}
}
function repairDefinitionMatch(q,words){
 if(q?.question_type!=='vocab_definition_match'||(q.choices||[]).length>=4)return q;
 const correct=String(q.metadata?.canonical_text||'').trim()||String((q.choices||[])[Number((q.correct_answer||[])[0])-1]||'').trim();
 const existing=[...new Set((q.choices||[]).map(x=>String(x||'').trim()).filter(Boolean))];
 const extras=shuffle(words.filter(w=>w!==correct&&!existing.includes(w))).slice(0,Math.max(0,4-existing.length));
 const choices=shuffle([...existing,...extras].slice(0,4));
 if(choices.length<4||!correct||!choices.includes(correct))return null;
 return {...q,choices,correct_answer:[String(choices.indexOf(correct)+1)],metadata:{...(q.metadata||{}),mock_choices_repaired:true}};
}
function install(){
 const api=window.WillenaVocabTestPractice;
 if(!api?.buildMockPool||api.__mockBlueprintWrapped)return false;
 const original=api.buildMockPool.bind(api);
 api.buildMockPool=async function(unitId,lessonLabel){
   const raw=await original(unitId,lessonLabel);
   const needsRepair=raw.some(q=>q?.question_type==='vocab_definition_match'&&(q.choices||[]).length<4);
   const words=needsRepair?await unitWords(unitId):[];
   const pool=raw.map(q=>repairDefinitionMatch(q,words)).filter(Boolean).filter(q=>q.answer_mode!=='single'||(q.choices||[]).length>=4);
   const groups={
     match:shuffle(pool.filter(q=>q.question_type==='vocab_definition_match')),
     falseDef:shuffle(pool.filter(q=>q.question_type==='vocab_false_definition_spot'||q.question_type==='vocab_definition_pair_mismatch')),
     correctDef:shuffle(pool.filter(q=>q.question_type==='vocab_correct_definition_spot'||q.question_type==='vocab_definition_pair_correct'))
   };
   const out=[];
   const take=(arr,n)=>{while(n-->0&&arr.length)out.push(arr.shift())};
   take(groups.match,2);
   take(groups.falseDef,2);
   take(groups.correctDef,1);
   if(out.length<5){const used=new Set(out.map(q=>String(q.id))),rest=shuffle(pool.filter(q=>!used.has(String(q.id))));while(out.length<5&&rest.length)out.push(rest.shift())}
   return out;
 };
 api.__mockBlueprintWrapped=true;
 return true;
}
let tries=0;const timer=setInterval(()=>{if(install()||++tries>120)clearInterval(timer)},100);install();
})();
