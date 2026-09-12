(function(global){
'use strict';

function text(value){return String(value==null?'':value).trim();}

function choiceView(option){
  option=option||{};
  return{
    value:text(option.value),
    label:text(option.label||option.value),
    kind:text(option.kind||'text').toLowerCase()||'text',
    assetKey:text(option.assetKey||option.asset_key||'')||null,
    src:text(option.src||'')||null,
    alt:text(option.alt||option.label||option.value)
  };
}

function questionView(question){
  if(!question||typeof question!=='object')throw new Error('Renderer contract requires a canonical question.');
  var options=Array.isArray(question.options)?question.options.map(choiceView):[];
  return{
    id:text(question.id),
    level:Number(question.level)||1,
    type:text(question.type),
    renderKind:text(question.renderKind||'choice'),
    prompt:text(question.prompt||question.q),
    context:text(question.context||question.meaning),
    options:options,
    tokens:Array.isArray(question.tokens)?question.tokens.slice():[],
    metadata:question.metadata||{},
    stimulus:question.stimulus||null
  };
}

function supports(kind){
  return['choice','reading_choice','listening_choice','image_choice','sentence_unscramble'].indexOf(text(kind))>=0;
}

function hasVisualChoices(view){
  return Boolean(view&&Array.isArray(view.options)&&view.options.some(function(option){return option.kind==='image'||option.assetKey||option.src;}));
}

global.WillenaAssessmentRendererContract={questionView:questionView,choiceView:choiceView,supports:supports,hasVisualChoices:hasVisualChoices};
})(window);
