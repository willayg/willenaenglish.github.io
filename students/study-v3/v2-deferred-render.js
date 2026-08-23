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
if(!document.querySelector('script[data-v3-question-flagger]')){
  var s=document.createElement('script');
  s.src='./v3-question-flagger.js?v=20260823-flagger1';
  s.async=false;
  s.dataset.v3QuestionFlagger='1';
  document.head.appendChild(s);
}
if(!document.querySelector('link[data-v3-coach-travelling-spark]')){
  var l=document.createElement('link');
  l.rel='stylesheet';
  l.href='./v3-coach-travelling-spark.css?v=20260824-1';
  l.dataset.v3CoachTravellingSpark='1';
  document.head.appendChild(l);
}
if(!document.querySelector('script[data-v3-coach-travelling-spark]')){
  var c=document.createElement('script');
  c.src='./v3-coach-travelling-spark.js?v=20260824-1';
  c.async=false;
  c.dataset.v3CoachTravellingSpark='1';
  document.head.appendChild(c);
}
})();
