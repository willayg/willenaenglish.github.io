(function(global){
'use strict';

var VERSION='coach-diagnosis-v1';
function text(v){return String(v==null?'':v).trim();}
function lower(v){return text(v).toLowerCase();}
function words(v){if(Array.isArray(v))return v.map(function(x){return lower(x);}).filter(Boolean);return lower(v).replace(/[“”"'.,!?;:()[\]{}]/g,' ').split(/\s+/).filter(Boolean);}
function sameBag(a,b){a=words(a).slice().sort();b=words(b).slice().sort();return a.length===b.length&&a.every(function(x,i){return x===b[i];});}
function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
function levenshtein(a,b){a=lower(a);b=lower(b);if(a===b)return 0;if(!a)return b.length;if(!b)return a.length;var prev=new Array(b.length+1),cur=new Array(b.length+1),i,j;for(j=0;j<=b.length;j++)prev[j]=j;for(i=1;i<=a.length;i++){cur[0]=i;for(j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));var t=prev;prev=cur;cur=t;}return prev[b.length];}
function resultValue(result,key){var v=result&&result[key];return v==null?'':v;}
function activityMeta(activity){return activity&&activity.metadata&&typeof activity.metadata==='object'?activity.metadata:{};}
function skillOf(activity){return lower(activity&&activity.skill||activityMeta(activity).skill);}
function conceptText(activity){var m=activityMeta(activity);return lower([m.concept_code,m.concept_name,m.grammar_concept,m.ai_coach_strict_concept,m.target_form_type,m.morphology_target,m.source_label].filter(Boolean).join(' '));}
function payload(base,over){return Object.assign({version:VERSION,domain:'general',category:'general_mistake',subtype:'unknown',label:'General mistake',confidence:.35,specificity:'generic',recurring:false,evidenceCount:1,possibleSlip:false},base||{},over||{});}
function exact(domain,category,subtype,label,confidence){return payload({domain:domain,category:category,subtype:subtype,label:label,confidence:confidence==null?.9:confidence,specificity:'specific'});}
function broad(domain,category,label,confidence){return payload({domain:domain,category:category,subtype:category,label:label,confidence:confidence==null?.65:confidence,specificity:'category'});}
function hasAny(xs,list){return list.some(function(x){return xs.indexOf(x)>=0;});}
function tokenAfter(tokens,needle){var i=tokens.indexOf(needle);return i>=0&&i<tokens.length-1?tokens[i+1]:'';}
function stripThirdPerson(v){v=lower(v);if(/ies$/.test(v))return v.slice(0,-3)+'y';if(/(ches|shes|sses|xes|zes|oes)$/.test(v))return v.slice(0,-2);if(/s$/.test(v)&&!/ss$/.test(v))return v.slice(0,-1);return v;}
function oneTokenDifference(aw,sw){var at=-1;if(aw.length!==sw.length)return-1;for(var i=0;i<aw.length;i++){if(aw[i]===sw[i])continue;if(at>=0)return-1;at=i;}return at;}
function structural(activity,result){
  var selected=resultValue(result,'selected'),answer=resultValue(result,'answer');
  var sw=words(selected),aw=words(answer),skill=skillOf(activity),concept=conceptText(activity);
  var s=lower(Array.isArray(selected)?selected.join(' '):selected),a=lower(Array.isArray(answer)?answer.join(' '):answer);
  if(!a)return payload();

  if((Array.isArray(selected)||/sentence|order|build/.test(skill+' '+concept))&&sameBag(selected,answer)&&s!==a)return exact('grammar','word_order','word_order','Sentence word order',.96);

  var auxHit=null;
  ['does','do','did'].some(function(aux){
    if(aw.indexOf(aux)<0||sw.indexOf(aux)<0)return false;
    var expected=tokenAfter(aw,aux),got=tokenAfter(sw,aux);if(!expected||!got||expected===got)return false;
    if(stripThirdPerson(got)===expected||(/ed$/.test(got)&&!/ed$/.test(expected))){auxHit=exact('grammar','auxiliary',aux+'_base_verb',aux.charAt(0).toUpperCase()+aux.slice(1)+' + base verb',.97);return true;}
    return false;
  });
  if(auxHit)return auxHit;

  var diff=oneTokenDifference(aw,sw);
  if(diff>=0&&stripThirdPerson(aw[diff])===sw[diff]&&aw[diff]!==sw[diff]&&(/third|person|he|she|it/.test(concept+' '+a)||hasAny(aw,['he','she','it'])))return exact('grammar','verb_form','third_person_s','Third-person -s / -es',.96);

  if(diff>=0&&/ed$/.test(sw[diff])&&!/ed$/.test(aw[diff])&&(/participle|perfect/.test(concept)))return exact('grammar','verb_form','irregular_participle','Irregular past participle',.92);
  if(diff>=0&&/ed$/.test(sw[diff])&&!/ed$/.test(aw[diff])&&(/past|irregular/.test(concept)||/past/.test(skill)))return exact('grammar','verb_form','irregular_past','Irregular past form',.9);

  if(aw.some(function(x){return /ing$/.test(x);})&&hasAny(aw,['am','is','are','was','were'])&&!hasAny(sw,['am','is','are','was','were']))return exact('grammar','verb_form','be_progressive','Be + -ing',.91);

  var articles=['a','an','the'];
  if(aw.length===sw.length+1&&aw.some(function(x){return articles.indexOf(x)>=0;})&&sw.every(function(x){return aw.indexOf(x)>=0;}))return exact('grammar','determiner','missing_article','Missing article',.88);

  if(aw.length===1&&sw.length===1&&aw[0]!==sw[0]&&((aw[0]===sw[0]+'s')||(aw[0]===sw[0]+'es')))return exact('grammar','noun_form','plural_s','Plural form',.9);

  if(aw.length===1&&sw.length===1){var d=levenshtein(aw[0],sw[0]),limit=aw[0].length>=8?2:1;if(d>0&&d<=limit&&(skill.indexOf('spell')>=0||concept.indexOf('spell')>=0))return exact('spelling','spelling','near_miss','Spelling',.97);if(d>0&&d<=limit)return broad('spelling','spelling','Spelling',.72);}

  if(skill.indexOf('spell')>=0)return broad('spelling','spelling','Spelling',.82);
  if(skill.indexOf('listen')>=0)return broad('listening','listening_discrimination','Listening discrimination',.68);
  if(skill.indexOf('vocab')>=0||skill.indexOf('word')>=0)return broad('vocabulary','word_choice','Vocabulary choice',.74);
  if(skill.indexOf('grammar')>=0)return broad('grammar','grammar_form','Grammar form',.58);
  if(skill.indexOf('sentence')>=0)return broad('grammar','sentence_structure','Sentence structure',.62);
  if(skill.indexOf('reading')>=0)return broad('reading','comprehension','Reading comprehension',.58);
  if(skill.indexOf('conversation')>=0)return broad('conversation','response_choice','Conversation response',.56);
  return payload();
}
function diagnosisKey(d){return d&&text(d.subtype||d.category);}
function conceptHasWeakEvidence(d,history){
  var c=lower(d&&d.concept);if(!c||!history)return false;
  var rows=[];
  if(history.grammar&&Array.isArray(history.grammar.weak))rows=rows.concat(history.grammar.weak);
  if(history.morphology&&Array.isArray(history.morphology.weak))rows=rows.concat(history.morphology.weak);
  return rows.some(function(r){var key=lower(r&&r.key),name=lower(r&&r.name);return (key&&c.indexOf(key)>=0)||(name&&c.indexOf(name)>=0);});
}
function historyEvidence(d,history){
  if(!history||!d)return d;
  var key=diagnosisKey(d),prior=[];
  if(Array.isArray(history.recentAttempts))prior=history.recentAttempts.filter(function(r){var x=r&&r.diagnosis;return x&&diagnosisKey(x)===key&&!r.correct;});
  var aggregate=Array.isArray(history.recurringDiagnoses)?history.recurringDiagnoses.find(function(x){return text(x.key)===key;}):null;
  var weakConcept=conceptHasWeakEvidence(d,history);
  var count=Math.max(1,prior.length+(aggregate&&Number(aggregate.misses||aggregate.attempts)||0));
  var recurring=count>=2||!!aggregate||weakConcept;
  var confidence=d.confidence;
  if(recurring)confidence=Math.min(.99,confidence+(count>=4?.08:.05));
  var sameSkillCorrect=Array.isArray(history.recentAttempts)?history.recentAttempts.filter(function(r){return r&&r.correct&&lower(r.skill)===lower(d.skill);}).slice(0,12).length:0;
  var possibleSlip=!recurring&&sameSkillCorrect>=6&&confidence<.9;
  if(possibleSlip)confidence=Math.max(.4,confidence-.08);
  return Object.assign({},d,{confidence:Math.round(clamp(confidence,.01,.99)*100)/100,recurring:recurring,evidenceCount:Math.max(count,weakConcept?2:1),possibleSlip:possibleSlip});
}
function diagnose(input){input=input||{};var activity=input.activity||{},result=input.result||{};var d=structural(activity,result);d.skill=skillOf(activity);d.activityType=text(activity.type||activity.kind||activityMeta(activity).activity_type);d.concept=text(activityMeta(activity).concept_code||activityMeta(activity).ai_coach_strict_concept||activityMeta(activity).target_form_type||'');return historyEvidence(d,input.history||null);}
function humanLabel(d){return d&&text(d.label)||'General mistake';}
function selfTest(){
  var cases=[
    ['third_person_s',{skill:'grammar',metadata:{concept_code:'third_person'}},{selected:'He go to school.',answer:'He goes to school.'},'third_person_s'],
    ['third_person_es',{skill:'grammar',metadata:{concept_code:'third_person'}},{selected:'She watch TV.',answer:'She watches TV.'},'third_person_s'],
    ['third_person_ies',{skill:'grammar',metadata:{concept_code:'third_person'}},{selected:'He study English.',answer:'He studies English.'},'third_person_s'],
    ['does_base',{skill:'grammar'},{selected:'Does she likes pizza?',answer:'Does she like pizza?'},'does_base_verb'],
    ['did_base',{skill:'grammar'},{selected:'Did he went home?',answer:'Did he go home?'},'did_base_verb'],
    ['irregular_past',{skill:'past grammar',metadata:{concept_code:'irregular_past'}},{selected:'He goed home.',answer:'He went home.'},'irregular_past'],
    ['irregular_participle',{skill:'grammar',metadata:{concept_code:'past_participle'}},{selected:'He has goed home.',answer:'He has gone home.'},'irregular_participle'],
    ['word_order',{skill:'sentence_building'},{selected:['She','playing','is','tennis'],answer:['She','is','playing','tennis']},'word_order'],
    ['spelling',{skill:'spelling'},{selected:'beautifull',answer:'beautiful'},'near_miss'],
    ['listening',{skill:'listening'},{selected:'ship',answer:'sheep'},'listening_discrimination']
  ];
  var results=cases.map(function(c){var got=diagnose({activity:c[1],result:c[2]});return{name:c[0],expected:c[3],actual:got.subtype,pass:got.subtype===c[3],confidence:got.confidence};});
  return{version:VERSION,passed:results.filter(function(x){return x.pass;}).length,total:results.length,results:results};
}

global.WillenaAICoachDiagnosis={version:VERSION,diagnose:diagnose,key:diagnosisKey,humanLabel:humanLabel,selfTest:selfTest};
})(window);
