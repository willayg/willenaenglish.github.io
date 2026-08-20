(function(global){
'use strict';

var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

async function level(){
  var side=global.WillenaMorphologySidecar;
  if(side&&typeof side.resolveLevel==='function'){
    try{return Number(await side.resolveLevel())||0;}catch(_){}
  }
  return 0;
}

coach.registerCapability({
  id:'third_person',
  score:async function(){return (await level())>=2?95:0;},
  available:async function(){return (await level())>=2;},
  label:{ko:'3인칭 단수 연습',en:'Third-person verb practice'},
  response:{
    ko:'3인칭 단수는 동사 형태 자체를 연습하거나, 실제 문장 속 문법 문제로 연습할 수 있어요.',
    en:'You can practice third-person verb forms directly or use them in full grammar questions.'
  },
  actions:[
    {label:{ko:'동사 형태 연습',en:'Practice verb forms'},provider:'morphology',args:{type:'third_person',count:10}},
    {label:{ko:'3인칭 단수 문법 문제',en:'Third-person grammar questions'},provider:'grammarConcept',args:{codes:['third_person','does_questions','does_not_negative'],count:10,title:{ko:'3인칭 단수 문법 연습',en:'Third-person grammar practice'}}}
  ]
});

coach.registerCapability({
  id:'past',
  score:async function(){return (await level())>=4?93:0;},
  available:async function(){return (await level())>=4;},
  label:{ko:'과거형 연습',en:'Past-tense practice'},
  response:{
    ko:'과거형은 동사 형태를 외우는 연습과 실제 문장 속 과거 시제 문법 연습을 같이 하면 좋아요.',
    en:'Past tense is useful to practice both as verb forms and inside full grammar questions.'
  },
  actions:[
    {label:{ko:'과거형 동사 연습',en:'Practice past-tense verbs'},provider:'morphology',args:{type:'past',count:10}},
    {label:{ko:'과거 시제 문법 문제',en:'Past-tense grammar questions'},provider:'grammarConcept',args:{codes:['past_simple','did_questions','past_be'],count:10,title:{ko:'과거 시제 문법 연습',en:'Past-tense grammar practice'}}}
  ]
});

coach.registerCapability({
  id:'past_participle',
  score:async function(){return (await level())>=5?92:0;},
  available:async function(){return (await level())>=5;},
  label:{ko:'과거분사 연습',en:'Past participle practice'},
  response:{
    ko:'과거분사는 규칙형과 불규칙형을 따로 반복해서 익히는 게 좋아요.',
    en:'Past participles are worth practicing as their own verb forms, especially the irregular ones.'
  },
  actions:[
    {label:{ko:'과거분사 동사 연습',en:'Practice participle forms'},provider:'morphology',args:{type:'past_participle',count:10}}
  ]
});

coach.refresh();
})(window);
