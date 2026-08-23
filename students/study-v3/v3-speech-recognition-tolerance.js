(function(global){
'use strict';
var Native=global.SpeechRecognition||global.webkitSpeechRecognition;
if(!Native||global.__willenaV3SpeechToleranceInstalled)return;
global.__willenaV3SpeechToleranceInstalled=true;

function text(v){return String(v==null?'':v).trim();}
function basic(v){
  return text(v).toLowerCase()
    .replace(/[’]/g,"'")
    .replace(/\bwe're\b/g,'were')
    .replace(/\byou're\b/g,'your')
    .replace(/\bthey're\b/g,'their')
    .replace(/[^a-z0-9' ]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function compactKnown(v){
  return (' '+v+' ')
    .replace(/\bhot\s+dog\b/g,'hotdog')
    .replace(/\bice\s+cream\b/g,'icecream')
    .replace(/\bbase\s+ball\b/g,'baseball')
    .replace(/\bbasket\s+ball\b/g,'basketball')
    .replace(/\bfoot\s+ball\b/g,'football')
    .replace(/\bclass\s+room\b/g,'classroom')
    .replace(/\bplay\s+ground\b/g,'playground')
    .replace(/\bweek\s+end\b/g,'weekend')
    .replace(/\s+/g,' ')
    .trim();
}
var GROUPS=[
  ['were','where'],['your','youre'],['there','their','theyre'],
  ['to','too','two'],['for','four'],['hear','here'],['no','know'],
  ['right','write'],['one','won'],['ate','eight'],['by','buy','bye']
];
function sameSound(a,b){
  if(a===b)return true;
  for(var i=0;i<GROUPS.length;i++)if(GROUPS[i].indexOf(a)>=0&&GROUPS[i].indexOf(b)>=0)return true;
  return false;
}
function recognitionEquivalent(raw,target){
  var r=compactKnown(basic(raw)),t=compactKnown(basic(target));
  if(!r||!t)return false;
  if(r===t)return true;
  if(/^were you\b/.test(t)&&/^where are you\b/.test(r))r=r.replace(/^where are you\b/,'were you');
  if(/^where are you\b/.test(t)&&/^were you\b/.test(r))r=r.replace(/^were you\b/,'where are you');
  if(r===t)return true;
  var R=r.split(' '),T=t.split(' ');
  if(R.length!==T.length)return false;
  for(var i=0;i<T.length;i++)if(!sameSound(R[i],T[i]))return false;
  return true;
}
async function currentTarget(){
  var card=document.querySelector('#v2ActivityRoot .v3-speaking-card,#aiCoachActivityRoot .v3-speaking-card');
  if(!card)return'';
  var listen=card.querySelector('.v3-speaking-listen[data-target]');
  if(listen&&text(listen.dataset.target))return text(listen.dataset.target);
  var mode=text(card.querySelector('.v3-speaking-mode')&&card.querySelector('.v3-speaking-mode').textContent).toUpperCase();
  var prompt=card.querySelector('.v3-speaking-prompt');
  if(mode==='LISTEN & REPEAT'&&prompt)return text(prompt.textContent);
  var ko=text(prompt&&prompt.textContent),ctx=text(card.querySelector('.v3-speaking-context')&&card.querySelector('.v3-speaking-context').textContent);
  if(!ko)return'';
  try{
    var state=global.WillenaStudyV3SpeakingRecall&&global.WillenaStudyV3SpeakingRecall.getState&&global.WillenaStudyV3SpeakingRecall.getState();
    var unitId=state&&state.unitId;
    var api=global.WillenaV3SpeakingIntegration;
    if(!unitId||!api||typeof api.rowsForUnit!=='function')return'';
    var rows=await api.rowsForUnit(unitId),matches=rows.filter(function(r){return text(r.ko)===ko;});
    if(ctx){var contextual=matches.filter(function(r){return text(r.contextEn)===ctx;});if(contextual.length)matches=contextual;}
    return matches.length?text(matches[0].en):'';
  }catch(_){return'';}
}
function adjustedEvent(e,target){
  if(!target||!e||!e.results)return e;
  var results=[];
  for(var i=0;i<e.results.length;i++){
    var src=e.results[i],row=[];
    for(var j=0;j<src.length;j++){
      var alt=src[j],raw=text(alt&&alt.transcript),confidence=typeof alt.confidence==='number'?alt.confidence:0;
      row.push({transcript:raw,confidence:confidence});
      if(raw&&recognitionEquivalent(raw,target)&&basic(raw)!==basic(target))row.push({transcript:target,confidence:confidence});
    }
    row.isFinal=src.isFinal;
    row.item=function(n){return this[n];};
    results.push(row);
  }
  results.item=function(n){return this[n];};
  var out=Object.create(e);
  try{Object.defineProperty(out,'results',{value:results,enumerable:true});}catch(_){return e;}
  return out;
}
function Wrapped(){
  var self=this;
  this._native=new Native();
  this._onresult=null;
  this._native.onresult=function(e){
    if(!self._onresult)return;
    Promise.resolve(currentTarget()).then(function(target){self._onresult.call(self,adjustedEvent(e,target));}).catch(function(){self._onresult.call(self,e);});
  };
}
['lang','interimResults','continuous','maxAlternatives'].forEach(function(k){Object.defineProperty(Wrapped.prototype,k,{get:function(){return this._native[k];},set:function(v){this._native[k]=v;}});});
['onerror','onend','onnomatch','onspeechstart','onspeechend','onsoundstart','onsoundend','onaudiostart','onaudioend','onstart'].forEach(function(k){Object.defineProperty(Wrapped.prototype,k,{get:function(){return this._native[k];},set:function(v){this._native[k]=v;}});});
Object.defineProperty(Wrapped.prototype,'onresult',{get:function(){return this._onresult;},set:function(v){this._onresult=v;}});
['start','stop','abort'].forEach(function(k){Wrapped.prototype[k]=function(){return this._native[k].apply(this._native,arguments);};});
Wrapped.prototype.addEventListener=function(){return this._native.addEventListener.apply(this._native,arguments);};
Wrapped.prototype.removeEventListener=function(){return this._native.removeEventListener.apply(this._native,arguments);};

global.SpeechRecognition=Wrapped;
global.webkitSpeechRecognition=Wrapped;
})(window);
