(function(){
'use strict';
var SUPABASE_URL="https://gxwfsqxyuufqtitspfqg.supabase.co";
var SUPABASE_KEY=["sb_publishable_","G-FYhHfDL4OGdL892gY1Zg_","epdbEeqO"].join("");
var headers={apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY};
function clean(value){return String(value==null?"":value).trim()}
function shuffle(items){return items.slice().sort(function(){return Math.random()-.5})}
function unique(items){var out=[];items.map(clean).filter(Boolean).forEach(function(x){if(out.indexOf(x)<0)out.push(x)});return out}
function optionRows(row){
 var related=Array.isArray(row.assessment_item_options)?row.assessment_item_options:[];
 if(related.length){return related.slice().sort(function(a,b){return (Number(a.display_order)||0)-(Number(b.display_order)||0)}).map(function(option){return{text:clean(option.option_text),correct:option.is_correct===true}})}
 var stored=Array.isArray(row.choices)?row.choices:[];
 return stored.map(function(text){return{text:clean(text),correct:clean(text)===clean(row.correct_answer)}})
}
function mapItem(row){
 var answer=clean(row.correct_answer),type=clean(row.item_type)||"question_response",metadata=row.metadata||{},context=clean(row.context_text),prompt=clean(row.prompt_text);
 if(!prompt)throw new Error("Assessment item "+(row.source_key||row.id)+" has no prompt.");
 if(!answer)throw new Error("Assessment item "+(row.source_key||row.id)+" has no correct answer.");
 if(type==="sentence_unscramble"){
  var tokens=Array.isArray(metadata.tokens)?metadata.tokens.map(clean).filter(Boolean):[];
  if(tokens.length<2)throw new Error("Unscramble item "+(row.source_key||row.id)+" has no usable tokens.");
  return{id:clean(row.source_key)||row.id,type:type,q:prompt,meaning:context,a:answer,choices:[],tokens:tokens,level:Number(row.level_id)||1,difficulty:Number(row.difficulty_rating)||Number(row.level_id)*20,sourceTable:"assessment_items",translation:false,metadata:metadata};
 }
 var options=optionRows(row),choices=unique(options.map(function(option){return option.text})),markedCorrect=options.filter(function(option){return option.correct}).map(function(option){return option.text});
 if(choices.length!==4)throw new Error("Assessment item "+(row.source_key||row.id)+" must have exactly four unique choices.");
 if(choices.indexOf(answer)<0)throw new Error("Assessment item "+(row.source_key||row.id)+" does not include its correct answer among the choices.");
 if(markedCorrect.length&&!(markedCorrect.length===1&&markedCorrect[0]===answer))throw new Error("Assessment item "+(row.source_key||row.id)+" has inconsistent correct-option data.");
 if(type==="listening"){
  var transcript=clean(metadata.transcript)||context;
  if(!transcript)throw new Error("Listening item "+(row.source_key||row.id)+" has no transcript.");
  var listeningMetadata={};Object.keys(metadata).forEach(function(k){listeningMetadata[k]=metadata[k]});listeningMetadata.transcript=transcript;
  return{id:clean(row.source_key)||row.id,type:type,q:prompt,a:answer,choices:choices,level:Number(row.level_id)||1,difficulty:Number(row.difficulty_rating)||Number(row.level_id)*20,sourceTable:"assessment_items",translation:false,metadata:listeningMetadata};
 }
 return{id:clean(row.source_key)||row.id,type:type,q:context?context+"\n"+prompt:prompt,a:answer,choices:choices,level:Number(row.level_id)||1,difficulty:Number(row.difficulty_rating)||Number(row.level_id)*20,sourceTable:"assessment_items",translation:false,metadata:metadata};
}
function loadQuestionBank(){
 var select="id,source_key,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,metadata,choices,assessment_item_options(option_text,is_correct,display_order)";
 var url=SUPABASE_URL+"/rest/v1/assessment_items?select="+encodeURIComponent(select)+"&status=eq.published&order=level_id.asc,difficulty_rating.asc,source_key.asc";
 return fetch(url,{headers:headers,cache:"no-store"}).then(function(response){if(!response.ok)throw new Error("Could not load the authored assessment bank ("+response.status+").");return response.json()}).then(function(rows){if(!Array.isArray(rows)||!rows.length)throw new Error("No published authored assessment questions are available yet.");return shuffle(rows.map(mapItem))});
}
window.loadQuestionBank=loadQuestionBank;
})();