(function(global){
'use strict';

function text(value){return String(value==null?'':value).trim();}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function visualFor(label,metadata){
  metadata=metadata||{};
  var visuals=metadata.choice_visuals||metadata.choice_assets||metadata.option_visuals||{};
  if(Array.isArray(visuals)){
    for(var i=0;i<visuals.length;i++){
      var item=visuals[i]||{};
      if(text(item.value||item.label||item.text)===label)return item;
    }
    return null;
  }
  return visuals&&typeof visuals==='object'?visuals[label]||null:null;
}

function normalizeOption(raw,index,metadata){
  var value,label,kind='text',assetKey=null,src=null,alt=null;
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    value=text(raw.value!==undefined?raw.value:(raw.label!==undefined?raw.label:raw.text));
    label=text(raw.label!==undefined?raw.label:(raw.text!==undefined?raw.text:value));
    kind=text(raw.kind||raw.choice_type||raw.type||'text').toLowerCase()||'text';
    assetKey=text(raw.assetKey||raw.asset_key||'')||null;
    src=text(raw.src||raw.image_src||raw.url||'')||null;
    alt=text(raw.alt||label)||label;
  }else{
    value=text(raw);label=value;alt=label;
  }
  var visual=visualFor(value,metadata)||visualFor(label,metadata);
  if(visual){
    if(typeof visual==='string')assetKey=text(visual)||assetKey;
    else if(typeof visual==='object'){
      kind=text(visual.kind||visual.choice_type||visual.type||kind).toLowerCase()||kind;
      assetKey=text(visual.assetKey||visual.asset_key||assetKey||'')||null;
      src=text(visual.src||visual.image_src||visual.url||src||'')||null;
      alt=text(visual.alt||alt||label)||label;
    }
    if((assetKey||src)&&kind==='text')kind='image';
  }
  return{index:index,value:value,label:label||value,kind:kind,assetKey:assetKey,src:src,alt:alt||label||value};
}

function responseKind(activity,options){
  var type=text(activity&&activity.type||activity&&activity.response&&activity.response.type).toLowerCase();
  if(type==='sentence_unscramble')return'sentence_unscramble';
  if(type==='listening')return'listening_choice';
  if(type==='reading')return'reading_choice';
  if(options.some(function(option){return option.kind==='image'||option.assetKey||option.src;}))return'image_choice';
  return'choice';
}

function fromActivity(activity){
  if(!activity||typeof activity!=='object')throw new Error('Canonical question model requires an activity object.');
  var metadata=clone(activity.metadata||{})||{};
  var rawChoices=Array.isArray(activity.choices)?activity.choices:(activity.response&&Array.isArray(activity.response.choices)?activity.response.choices:[]);
  var options=rawChoices.map(function(choice,index){return normalizeOption(choice,index,metadata);});
  var prompt=text(activity.q||activity.prompt||activity.stimulus&&activity.stimulus.prompt);
  var context=text(activity.meaning||activity.context||activity.stimulus&&activity.stimulus.context);
  var answer=activity.a!==undefined?clone(activity.a):clone(activity.answer);
  var question=Object.assign({},activity,{
    id:text(activity.id),
    prompt:prompt,
    context:context,
    answerValue:answer,
    options:options,
    renderKind:responseKind(activity,options),
    metadata:metadata
  });
  // Keep the legacy aliases while the classic engine is still being refactored.
  question.q=prompt;
  question.meaning=context;
  question.a=clone(answer);
  question.choices=options.map(function(option){return option.value;});
  question.tokens=Array.isArray(activity.tokens)?activity.tokens.slice():(activity.response&&Array.isArray(activity.response.tokens)?activity.response.tokens.slice():[]);
  return question;
}

function validate(question){
  var errors=[];
  if(!question||typeof question!=='object')return['question must be an object'];
  if(!text(question.id))errors.push('id is required');
  if(!text(question.prompt||question.q))errors.push('prompt is required');
  if(question.answerValue===undefined&&question.a===undefined)errors.push('answer is required');
  if(question.renderKind!=='sentence_unscramble'&&(!Array.isArray(question.options)||!question.options.length))errors.push('options are required');
  return errors;
}

global.WillenaAssessmentQuestionModel={fromActivity:fromActivity,normalizeOption:normalizeOption,validate:validate};
})(window);
