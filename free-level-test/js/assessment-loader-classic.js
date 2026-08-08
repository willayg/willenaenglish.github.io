(function(){
'use strict';
var SUPABASE_URL="https://gxwfsqxyuufqtitspfqg.supabase.co";
var SUPABASE_KEY=["sb_publishable_","G-FYhHfDL4OGdL892gY1Zg_","epdbEeqO"].join("");
var headers={apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY};
function shuffle(items){return items.slice().sort(function(){return Math.random()-.5});}
function loadQuestionBank(){
 var adapter=window.WillenaAssessmentAdapter;
 if(!adapter||typeof adapter.fromAssessmentItem!=='function')return Promise.reject(new Error('Shared assessment adapter is not loaded.'));
 var select="id,source_key,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,metadata,choices,assessment_item_options(option_text,is_correct,display_order)";
 var url=SUPABASE_URL+"/rest/v1/assessment_items?select="+encodeURIComponent(select)+"&status=eq.published&is_flagged=eq.false&order=level_id.asc,difficulty_rating.asc,source_key.asc";
 return fetch(url,{headers:headers,cache:"no-store"}).then(function(response){if(!response.ok)throw new Error("Could not load the authored assessment bank ("+response.status+").");return response.json();}).then(function(rows){
  if(!Array.isArray(rows)||!rows.length)throw new Error("No published authored assessment questions are available yet.");
  return shuffle(rows.map(adapter.fromAssessmentItem));
 });
}
window.loadQuestionBank=loadQuestionBank;
})();