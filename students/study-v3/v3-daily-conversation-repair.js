(function(global){
'use strict';
var patched=false;
function text(v){return String(v==null?'':v).trim();}
function shouldRepair(a){
  if(!a||a.skill!=='conversation')return false;
  var m=a.metadata||{},form=text(m.conversation_form||m.question_form).toLowerCase();
  if(['missing_line','situation','matching_question','translation_en_ko','translation_ko_en'].indexOf(form)<0)return false;
  return !!text(m.source_prompt_text);
}
function repair(a){
  if(!shouldRepair(a))return a;
  var m=a.metadata||{},source=text(m.source_prompt_text);
  if(!source)return a;
  a.stimulus=a.stimulus||{};
  var current=text(a.stimulus.prompt);
  var generic=/빈칸에 들어갈|가장 자연스러운|choose the line|choose the most natural|complete the dialogue/i.test(current);
  if(generic||!/\n|____|A:|B:/i.test(current))a.stimulus.prompt=source;
  return a;
}
function patch(){
  if(patched||!global.WillenaActivityEngine||!global.WillenaActivityEngine.prototype)return false;
  var proto=global.WillenaActivityEngine.prototype,orig=proto.setActivity;
  if(typeof orig!=='function')return false;
  proto.setActivity=function(raw){
    try{
      if(document.body.classList.contains('study-v2-daily-mode'))raw=repair(raw);
    }catch(e){console.debug('[V3 Daily Conversation Repair]',e);}
    return orig.call(this,raw);
  };
  patched=true;
  return true;
}
if(!patch()){
  var tries=0,t=setInterval(function(){tries++;if(patch()||tries>100)clearInterval(t);},50);
}
})(window);
