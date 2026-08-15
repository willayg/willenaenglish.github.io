(function(global){
'use strict';
if(!global.WillenaActivityEngine||!global.WillenaActivityEngine.prototype)return;
var proto=global.WillenaActivityEngine.prototype;
if(proto.__v2DeferredSetActivity)return;
var original=proto.setActivity;
var pending=new WeakMap();
proto.setActivity=function(raw){
  var engine=this;
  var old=pending.get(engine);
  if(old)clearTimeout(old);
  var token=setTimeout(function(){
    pending.delete(engine);
    var panel=document.getElementById('v2PracticePanel');
    var root=engine&&engine.root;
    var inAiCoach=!!(root&&root.closest&&root.closest('#aiCoachPracticeOverlay'));
    if(panel&&panel.hidden&&!inAiCoach)return;
    original.call(engine,raw);
  },32);
  pending.set(engine,token);
  return engine;
};
proto.__v2DeferredSetActivity=true;
})(window);
