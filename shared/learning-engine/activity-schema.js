(function(global){
'use strict';
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function arr(value){return Array.isArray(value)?value:[];}
function text(value){return String(value==null?'':value).trim();}
function usage(value){var items=arr(value).map(text).filter(Boolean);return items.length?items:['practice'];}
function normalize(raw){
 raw=raw||{};
 var stimulus=raw.stimulus||{};
 var response=raw.response||{};
 var type=text(raw.type||response.type||'multiple_choice');
 var prompt=text(raw.prompt||raw.q||stimulus.prompt||stimulus.text);
 var context=text(raw.context||raw.meaning||stimulus.context);
 var choices=arr(response.choices&&response.choices.length?response.choices:raw.choices).slice();
 var tokens=arr(response.tokens&&response.tokens.length?response.tokens:raw.tokens).slice();
 var wordLengths=arr(response.wordLengths&&response.wordLengths.length?response.wordLengths:raw.wordLengths).map(function(n){return Number(n)||0;}).filter(Boolean);
 var answer=raw.answer!==undefined?raw.answer:raw.a;
 var activity={
  id:text(raw.id||raw.sourceId||raw.source_id),
  sourceType:text(raw.sourceType||raw.source_type||raw.sourceTable||'activity'),
  sourceId:text(raw.sourceId||raw.source_id||raw.id),
  bookId:raw.bookId||raw.book_id||null,
  unitId:raw.unitId||raw.unit_id||null,
  sectionId:raw.sectionId||raw.section_id||null,
  skill:text(raw.skill||raw.metadata&&raw.metadata.skill||''),
  usage:usage(raw.usage),
  stimulus:{
   type:text(stimulus.type||((raw.metadata&&raw.metadata.transcript)?'audio':'text')),
   prompt:prompt,
   context:context,
   text:text(stimulus.text||raw.metadata&&raw.metadata.transcript||''),
   audio:clone(stimulus.audio||raw.audio||null),
   image:clone(stimulus.image||raw.image||null)
  },
  response:{
   type:type,
   choices:choices,
   tokens:tokens,
   wordLengths:wordLengths,
   inputMode:text(response.inputMode||response.input_mode||'')
  },
  answer:clone(answer),
  acceptedAnswers:arr(raw.acceptedAnswers||raw.accepted_answers).slice(),
  feedback:clone(raw.feedback||null),
  level:Number(raw.level||raw.level_id)||null,
  difficulty:Number(raw.difficulty||raw.difficulty_rating)||null,
  metadata:clone(raw.metadata||{})||{}
 };
 activity.type=activity.response.type;
 activity.q=activity.stimulus.prompt;
 activity.meaning=activity.stimulus.context;
 activity.choices=activity.response.choices;
 activity.tokens=activity.response.tokens;
 activity.wordLengths=activity.response.wordLengths;
 activity.a=clone(activity.answer);
 activity.sourceTable=activity.sourceType;
 activity.translation=Boolean(raw.translation);
 return activity;
}
function validate(activity){
 var errors=[];
 if(!activity||typeof activity!=='object')return['activity must be an object'];
 if(!text(activity.id))errors.push('id is required');
 if(!text(activity.response&&activity.response.type||activity.type))errors.push('response type is required');
 if(!text(activity.stimulus&&activity.stimulus.prompt||activity.q))errors.push('prompt is required');
 if(activity.answer===undefined&&activity.a===undefined)errors.push('answer is required');
 return errors;
}
global.WillenaActivitySchema={normalize:normalize,validate:validate};
})(window);
