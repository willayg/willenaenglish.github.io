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

(function(){
'use strict';
if(location.hostname!=='staging.willenaenglish.com')return;
if(document.querySelector('script[data-v3-question-flagger]'))return;
var s=document.createElement('script');
s.src='./v3-question-flagger.js?v=20260823-flagger1';
s.async=false;
s.dataset.v3QuestionFlagger='1';
document.head.appendChild(s);
})();
