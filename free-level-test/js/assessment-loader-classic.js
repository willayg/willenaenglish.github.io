(function(){
'use strict';
var SUPABASE_URL="https://gxwfsqxyuufqtitspfqg.supabase.co";
var SUPABASE_KEY=["sb_publishable_","G-FYhHfDL4OGdL892gY1Zg_","epdbEeqO"].join("");
var headers={apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY};
var PAGE_SIZE=1000;
function shuffle(items){return items.slice().sort(function(){return Math.random()-.5});}
function isExcludedFromLevelTest(row){
 var metadata=row&&row.metadata||{};
 var value=metadata.exclude_level_test;
 if(value==null)value=metadata.exclude_from_level_test;
 return value===true||String(value).toLowerCase()==='true';
}
function normalizeSentenceTokens(item){
 if(item&&item.type==='sentence_unscramble'&&Array.isArray(item.tokens)){
  item.tokens=item.tokens.map(function(token){return String(token==null?'':token).trim().toLocaleLowerCase('en-US');}).filter(Boolean);
 }
 return item;
}
function fetchAssessmentPage(select,offset){
 var url=SUPABASE_URL+"/rest/v1/assessment_items?select="+encodeURIComponent(select)+"&status=eq.published&is_flagged=eq.false&order=level_id.asc,difficulty_rating.asc,source_key.asc,id.asc&limit="+PAGE_SIZE+"&offset="+offset;
 return fetch(url,{headers:headers,cache:"no-store"}).then(function(response){
  if(!response.ok)throw new Error("Could not load the authored assessment bank ("+response.status+").");
  return response.json();
 });
}
function fetchAllAssessmentRows(select){
 var all=[];
 function next(offset){
  return fetchAssessmentPage(select,offset).then(function(rows){
   if(!Array.isArray(rows))throw new Error("Assessment bank returned invalid data.");
   all=all.concat(rows);
   if(rows.length===PAGE_SIZE)return next(offset+PAGE_SIZE);
   return all;
  });
 }
 return next(0);
}
function loadQuestionBank(){
 var adapter=window.WillenaAssessmentAdapter;
 if(!adapter||typeof adapter.fromAssessmentItem!=="function")return Promise.reject(new Error('Shared assessment adapter is not loaded.'));
 var select="id,source_key,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,metadata,choices,assessment_item_options(option_text,is_correct,display_order)";
 return fetchAllAssessmentRows(select).then(function(rows){
  if(!rows.length)throw new Error("No published authored assessment questions are available yet.");
  var adapted=[];
  var rejected=0;
  var excluded=0;
  rows.forEach(function(row){
   if(isExcludedFromLevelTest(row)){excluded++;return;}
   try{adapted.push(normalizeSentenceTokens(adapter.fromAssessmentItem(row)));}
   catch(error){rejected++;console.warn('[LevelTest] Skipping invalid assessment item',row&&row.source_key||row&&row.id,error);}
  });
  if(!adapted.length)throw new Error("No usable authored assessment questions are available yet.");
  var levels={};
  adapted.forEach(function(item){levels[item.level]=(levels[item.level]||0)+1;});
  console.info('[LevelTest] Loaded complete assessment bank',{rows:rows.length,usable:adapted.length,excluded:excluded,rejected:rejected,levels:levels});
  return shuffle(adapted);
 });
}
window.loadQuestionBank=loadQuestionBank;
})();
