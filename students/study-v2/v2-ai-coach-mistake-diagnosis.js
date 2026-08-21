(function(global){
'use strict';

var VERSION='coach-diagnosis-v1.1';
function text(v){return String(v==null?'':v).trim();}
function lower(v){return text(v).toLowerCase();}
function expandContractions(v){return lower(v).replace(/\bwhat's\b/g,'what is').replace(/\bwho's\b/g,'who is').replace(/\bwhere's\b/g,'where is').replace(/\bthere's\b/g,'there is').replace(/\bit's\b/g,'it is').replace(/\bhe's\b/g,'he is').replace(/\bshe's\b/g,'she is').replace(/\bcan't\b/g,'can not').replace(/\bwon't\b/g,'will not').replace(/\bdon't\b/g,'do not').replace(/\bdoesn't\b/g,'does not').replace(/\bdidn't\b/g,'did not');}
function words(v){if(Array.isArray(v))return v.map(function(x){return lower(x);}).filter(Boolean);return expandContractions(v).replace(/[“”"'.,!?;:()[\]{}]/g,' ').split(/\s+/).filter(Boolean);}
function sameBag(a,b){a=words(a).slice().sort();b=words(b).slice().sort();return a.length===b.length&&a.every(function(x,i){return x===b[i];});}
function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
function levenshtein(a,b){a=lower(a);b=lower(b);if(a===b)return 0;if(!a)return b.length;if(!b)return a.length;var prev=new Array(b.length+1),cur=new Array(b.length+1),i,j;for(j=0;j<=b.length;j++)prev[j]=j;for(i=1;i<=a.length;i++){cur[0]=i;for(j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));var t=prev;prev=cur;cur=t;}return prev[b.length];}
function resultValue(result,key){var v=result&&result[key];return v==null?'':v;}
function activityMeta(activity){return activity&&activity.metadata&&typeof activity.metadata==='object'?activity.metadata:{};}
function skillOf(activity){return lower(activity&&activity.skill||activityMeta(activity).skill);}
function promptText(activity){var s=activity&&activity.stimulus||{},m=activityMeta(activity);return lower([s.prompt,s.text,s.context,m.source_prompt_text,m.context_text].filter(Boolean).join(' '));}
function conceptText(activity){var m=activityMeta(activity);return lower([m.concept_code,m.concept_name,m.grammar_concept,m.ai_coach_strict_concept,m.target_form_type,m.morphology_target,m.pattern_code,m.source_label].filter(Boolean).join(' '));}
function payload(base,over){return Object.assign({version:VERSION,domain:'general',category:'general_mistake',subtype:'unknown',label:'General mistake',confidence:.35,specificity:'generic',recurring:false,evidenceCount:1,possibleSlip:false},base||{},over||{});}
function exact(domain,category,subtype,label,confidence){return payload({domain:domain,category:category,subtype:subtype,label:label,confidence:confidence==null?.9:confidence,specificity:'specific'});}
function broad(domain,category,label,confidence){return payload({domain:domain,category:category,subtype:category,label:label,confidence:confidence==null?.65:confidence,specificity:'category'});}
function hasAny(xs,list){return list.some(function(x){return xs.indexOf(x)>=0;});}
function stripThirdPerson(v){v=lower(v);if(/ies$/.test(v))return v.slice(0,-3)+'y';if(/(ches|shes|sses|xes|zes|oes)$/.test(v))return v.slice(0,-2);if(/s$/.test(v)&&!/ss$/.test(v))return v.slice(0,-1);return v;}
function oneTokenDifference(aw,sw){var at=-1;if(aw.length!==sw.length)return-1;for(var i=0;i<aw.length;i++){if(aw[i]===sw[i])continue;if(at>=0)return-1;at=i;}return at;}
function isOneExtraToken(shorter,longer,allowed){if(longer.length!==shorter.length+1)return false;for(var i=0;i<longer.length;i++){if(allowed.indexOf(longer[i])<0)continue;var copy=longer.slice();copy.splice(i,1);if(copy.length===shorter.length&&copy.every(function(x,j){return x===shorter[j];}))return true;}return false;}
function subjectHint(activity,answerWords){var p=promptText(activity),joined=' '+answerWords.join(' ')+' '+p+' ';if(/\b(i|you|we|they)\b/.test(joined))return'plural';if(/\b(he|she|it)\b/.test(joined))return'third';return'';}
function structural(activity,result){
  var selected=resultValue(result,'selected'),answer=resultValue(result,'answer');
  var sw=words(selected),aw=words(answer),skill=skillOf(activity),concept=conceptText(activity),prompt=promptText(activity);
  var s=expandContractions(Array.isArray(selected)?selected.join(' '):selected),a=expandContractions(Array.isArray(answer)?answer.join(' '):answer);
  if(!a)return payload();

  if((Array.isArray(selected)||/sentence|order|build/.test(skill+' '+concept))&&sameBag(selected,answer)&&s!==a)return exact('grammar','word_order','word_order','Sentence word order',.96);

  var modals=['can','could','will','would','shall','should','may','might','must'];
  if(isOneExtraToken(aw,sw,['to'])&&sw.some(function(x,i){return modals.indexOf(x)>=0&&sw[i+1]==='to';}))return exact('grammar','auxiliary','modal_base_verb','Modal + base verb',.98);

  if(isOneExtraToken(aw,sw,['am','is','are','was','were'])&&sw.some(function(x,i){return ['am','is','are','was','were'].indexOf(x)>=0&&i<sw.length-1;}))return exact('grammar','verb_structure','unnecessary_be','Unnecessary be verb',.94);

  var diff=oneTokenDifference(aw,sw);
  if(diff>=0){
    var aux=null;
    ['does','do','did'].some(function(x){if(aw.indexOf(x)>=0&&sw.indexOf(x)>=0&&diff>aw.indexOf(x)){aux=x;return true;}return false;});
    if(aux){var expected=aw[diff],got=sw[diff];if(stripThirdPerson(got)===expected||(/ed$/.test(got)&&!/ed$/.test(expected))||(aux==='did'&&got!==expected))return exact('grammar','auxiliary',aux+'_base_verb',aux.charAt(0).toUpperCase()+aux.slice(1)+' + base verb',.97);}
  }

  if(diff>=0&&((aw[diff]==='have'&&sw[diff]==='has')||(aw[diff]==='has'&&sw[diff]==='have'))){var hint=subjectHint(activity,aw);return exact('grammar','verb_form','have_has_agreement','Have / has agreement',hint?.96:.9);}
  if(diff>=0&&((aw[diff]==='has'&&sw[diff]==='had')||(aw[diff]==='have'&&sw[diff]==='had')||(aw[diff]==='had'&&(sw[diff]==='has'||sw[diff]==='have'))))return exact('grammar','verb_form','have_tense_form','Have / has / had form',.92);
  if(diff>=0&&['am','is','are','was','were'].indexOf(aw[diff])>=0&&['am','is','are','was','were'].indexOf(sw[diff])>=0)return exact('grammar','verb_form','be_agreement','Be-verb agreement',.94);

  if(diff>=0&&stripThirdPerson(aw[diff])===sw[diff]&&aw[diff]!==sw[diff]&&(/third|person|he|she|it/.test(concept+' '+a+' '+prompt)||hasAny(aw,['he','she','it'])))return exact('grammar','verb_form','third_person_s','Third-person -s / -es',.96);
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
function conceptHasWeakEvidence(d,history){var c=lower(d&&d.concept);if(!c||!history)return false;var rows=[];if(history.grammar&&Array.isArray(history.grammar.weak))rows=rows.concat(history.grammar.weak);if(history.morphology&&Array.isArray(history.morphology.weak))rows=rows.concat(history.morphology.weak);return rows.some(function(r){var key=lower(r&&r.key),name=lower(r&&r.name);return (key&&c.indexOf(key)>=0)||(name&&c.indexOf(name)>=0);});}
function historyEvidence(d,history){if(!history||!d)return d;var key=diagnosisKey(d),prior=[];if(Array.isArray(history.recentAttempts))prior=history.recentAttempts.filter(function(r){var x=r&&r.diagnosis;return x&&diagnosisKey(x)===key&&!r.correct;});var aggregate=Array.isArray(history.recurringDiagnoses)?history.recurringDiagnoses.find(function(x){return text(x.key)===key;}):null;var weakConcept=conceptHasWeakEvidence(d,history);var count=Math.max(1,prior.length+(aggregate&&Number(aggregate.misses||aggregate.attempts)||0));var recurring=count>=2||!!aggregate||weakConcept;var confidence=d.confidence;if(recurring)confidence=Math.min(.99,confidence+(count>=4?.08:.05));var sameSkillCorrect=Array.isArray(history.recentAttempts)?history.recentAttempts.filter(function(r){return r&&r.correct&&lower(r.skill)===lower(d.skill);}).slice(0,12).length:0;var possibleSlip=!recurring&&sameSkillCorrect>=6&&confidence<.9;if(possibleSlip)confidence=Math.max(.4,confidence-.08);return Object.assign({},d,{confidence:Math.round(clamp(confidence,.01,.99)*100)/100,recurring:recurring,evidenceCount:Math.max(count,weakConcept?2:1),possibleSlip:possibleSlip});}
function diagnose(input){input=input||{};var activity=input.activity||{},result=input.result||{};var d=structural(activity,result);d.skill=skillOf(activity);d.activityType=text(activity.type||activity.kind||activityMeta(activity).activity_type);d.concept=text(activityMeta(activity).concept_code||activityMeta(activity).ai_coach_strict_concept||activityMeta(activity).target_form_type||activityMeta(activity).pattern_code||'');return historyEvidence(d,input.history||null);}
function humanLabel(d){return d&&text(d.label)||'General mistake';}
function selfTest(){var cases=[['third_person_s',{skill:'grammar',metadata:{concept_code:'third_person'}},{selected:'He go to school.',answer:'He goes to school.'},'third_person_s'],['third_person_es',{skill:'grammar',metadata:{concept_code:'third_person'}},{selected:'She watch TV.',answer:'She watches TV.'},'third_person_s'],['third_person_ies',{skill:'grammar',metadata:{concept_code:'third_person'}},{selected:'He study English.',answer:'He studies English.'},'third_person_s'],['does_base',{skill:'grammar'},{selected:'Does she likes pizza?',answer:'Does she like pizza?'},'does_base_verb'],['did_base',{skill:'grammar'},{selected:'Did he went home?',answer:'Did he go home?'},'did_base_verb'],['modal_base',{skill:'grammar'},{selected:'You should to take some medicine.',answer:'You should take some medicine.'},'modal_base_verb'],['unnecessary_be',{skill:'grammar'},{selected:'I am have a fever.',answer:'I have a fever.'},'unnecessary_be'],['have_has',{skill:'grammar',stimulus:{prompt:'I ___ a headache.'}},{selected:'has',answer:'have'},'have_has_agreement'],['have_tense',{skill:'grammar',stimulus:{prompt:'She ___ a stomachache.'}},{selected:'had',answer:'has'},'have_tense_form'],['be_agreement',{skill:'grammar'},{selected:'What are the matter?',answer:"What's the matter?"},'be_agreement'],['irregular_past',{skill:'past grammar',metadata:{concept_code:'irregular_past'}},{selected:'He goed home.',answer:'He went home.'},'irregular_past'],['irregular_participle',{skill:'grammar',metadata:{concept_code:'past_participle'}},{selected:'He has goed home.',answer:'He has gone home.'},'irregular_participle'],['word_order',{skill:'sentence_building'},{selected:['She','playing','is','tennis'],answer:['She','is','playing','tennis']},'word_order'],['spelling',{skill:'spelling'},{selected:'beautifull',answer:'beautiful'},'near_miss'],['listening',{skill:'listening'},{selected:'ship',answer:'sheep'},'listening_discrimination']];var results=cases.map(function(c){var got=diagnose({activity:c[1],result:c[2]});return{name:c[0],expected:c[3],actual:got.subtype,pass:got.subtype===c[3],confidence:got.confidence};});return{version:VERSION,passed:results.filter(function(x){return x.pass;}).length,total:results.length,results:results};}

global.WillenaAICoachDiagnosis={version:VERSION,diagnose:diagnose,key:diagnosisKey,humanLabel:humanLabel,selfTest:selfTest};
})(window);
