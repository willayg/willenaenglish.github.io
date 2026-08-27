(function(){
'use strict';
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
function install(){
 const api=window.WillenaVocabTestPractice;
 if(!api?.buildMockPool||api.__mockBlueprintWrapped)return false;
 const original=api.buildMockPool.bind(api);
 api.buildMockPool=async function(unitId,lessonLabel){
   const pool=await original(unitId,lessonLabel);
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
