(function(global){
'use strict';
function clean(value){return String(value==null?'':value).replace(/\\n/g,'\n').replace(/\\r/g,'').trim();}
function unique(items){var out=[];items.map(clean).filter(Boolean).forEach(function(x){if(out.indexOf(x)<0)out.push(x);});return out;}
function optionRows(row){
 var related=Array.isArray(row.assessment_item_options)?row.assessment_item_options:[];
 if(related.length){return related.slice().sort(function(a,b){return(Number(a.display_order)||0)-(Number(b.display_order)||0);}).map(function(option){return{text:clean(option.option_text),correct:option.is_correct===true};});}
 var stored=Array.isArray(row.choices)?row.choices:[];
 return stored.map(function(value){return{text:clean(value),correct:clean(value)===clean(row.correct_answer)};});
}
function skillFor(type){
 type=String(type||'').toLowerCase();
 if(type.indexOf('listen')>=0)return'listening';
 if(type.indexOf('read')>=0)return'reading';
 if(type.indexOf('phon')>=0)return'phonics';
 if(type.indexOf('vocab')>=0||type.indexOf('word')>=0)return'vocabulary';
 if(type.indexOf('unscramble')>=0)return'sentence_building';
 if(type.indexOf('writ')>=0)return'writing';
 return'grammar';
}
function fromAssessmentItem(row){
 var schema=global.WillenaActivitySchema;if(!schema)throw new Error('WillenaActivitySchema must load before assessment-adapter.js');
 var answer=clean(row.correct_answer),type=clean(row.item_type)||'question_response',metadata=row.metadata||{},context=clean(row.context_text),prompt=clean(row.prompt_text);
 if(!prompt)throw new Error('Assessment item '+(row.source_key||row.id)+' has no prompt.');
 if(!answer)throw new Error('Assessment item '+(row.source_key||row.id)+' has no correct answer.');
 var response={type:type,choices:[],tokens:[]};
 if(type==='sentence_unscramble'){
  response.tokens=Array.isArray(metadata.tokens)?metadata.tokens.map(clean).filter(Boolean):[];
  if(response.tokens.length<2)throw new Error('Unscramble item '+(row.source_key||row.id)+' has no usable tokens.');
 }else{
  var options=optionRows(row),choices=unique(options.map(function(option){return option.text;})),markedCorrect=options.filter(function(option){return option.correct;}).map(function(option){return option.text;});
  if(choices.length!==4)throw new Error('Assessment item '+(row.source_key||row.id)+' must have exactly four unique choices.');
  if(choices.indexOf(answer)<0)throw new Error('Assessment item '+(row.source_key||row.id)+' does not include its correct answer among the choices.');
  if(markedCorrect.length&&!(markedCorrect.length===1&&markedCorrect[0]===answer))throw new Error('Assessment item '+(row.source_key||row.id)+' has inconsistent correct-option data.');
  response.choices=choices;
 }
 var visiblePrompt=prompt,visibleContext='';
 if(type==='sentence_unscramble')visibleContext=context;
 else if(type!=='listening'&&context)visiblePrompt=context+'\n'+prompt;
 var stimulus={type:type==='listening'?'audio':'text',prompt:visiblePrompt,context:visibleContext,text:''};
 if(type==='listening'){
  var transcript=clean(metadata.transcript)||context;
  if(!transcript)throw new Error('Listening item '+(row.source_key||row.id)+' has no transcript.');
  stimulus.text=transcript;
 }
 var activity=schema.normalize({
  id:clean(row.source_key)||String(row.id),sourceType:'assessment_items',sourceId:String(row.id),skill:skillFor(type),usage:['level_test'],
  stimulus:stimulus,response:response,answer:answer,level:Number(row.level_id)||1,difficulty:Number(row.difficulty_rating)||Number(row.level_id)*20,
  metadata:Object.assign({},metadata,{source_key:clean(row.source_key)||null,database_item_type:type})
 });
 return activity;
}
global.WillenaAssessmentAdapter={fromAssessmentItem:fromAssessmentItem,skillFor:skillFor};
})(window);
