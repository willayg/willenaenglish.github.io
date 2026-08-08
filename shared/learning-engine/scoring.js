(function(global){
'use strict';
function cleanText(value){return String(value==null?'':value).normalize('NFKC').replace(/\s+/g,' ').trim();}
function sentenceText(value){
 if(typeof value==='string'){
  var encoded=value.trim();
  if(encoded.charAt(0)==='['&&encoded.charAt(encoded.length-1)===']'){
   try{var decoded=JSON.parse(encoded);if(Array.isArray(decoded))value=decoded;}catch(_){}
  }
 }
 var out=Array.isArray(value)?value.map(cleanText).join(' '):cleanText(value);
 return out.toLocaleLowerCase('en-US').replace(/[.,!?;:。！？、，；：]+$/gu,'').replace(/\s+/g,' ').trim();
}
function letterText(value){
 var out=Array.isArray(value)?value.map(cleanText).join(''):cleanText(value);
 return out.toLocaleLowerCase('en-US').replace(/[\s\-']/g,'').normalize('NFKC');
}
function exactComparable(value){return Array.isArray(value)?value.map(cleanText):cleanText(value);}
function looseText(value){return sentenceText(value).replace(/[’]/g,"'");}
function isCorrect(type,selected,correct,accepted){
 type=String(type||'');
 var candidates=[correct].concat(Array.isArray(accepted)?accepted:[]);
 if(type==='letter_order')return candidates.some(function(candidate){return letterText(selected)===letterText(candidate);});
 if(type==='sentence_unscramble'||type==='token_order'||type==='typed_answer'||type==='gap_fill_text'){
  return candidates.some(function(candidate){return looseText(selected)===looseText(candidate);});
 }
 return candidates.some(function(candidate){return JSON.stringify(exactComparable(selected))===JSON.stringify(exactComparable(candidate));});
}
function score(activity,selected){
 var type=activity&&activity.response&&activity.response.type||activity&&activity.type;
 var correct=activity&&activity.answer!==undefined?activity.answer:activity&&activity.a;
 var accepted=activity&&activity.acceptedAnswers||[];
 return{correct:isCorrect(type,selected,correct,accepted),selected:selected,answer:correct};
}
global.WillenaActivityScoring={cleanText:cleanText,sentenceText:sentenceText,letterText:letterText,isCorrect:isCorrect,score:score};
})(window);
