(function(){
'use strict';
/*
 * Install BEFORE student-ux-v5.js.
 * The old student UX registers a popstate handler that can hydrate the full lesson
 * before Fix4 gets a chance to replace it. On low-memory tablets that render burst
 * can kill the tab. Intercept lesson history entries first and route them directly
 * to the lightweight lesson renderer once it is available.
 */
window.addEventListener('popstate',function(e){
  var s=history.state||{};
  if(s.tp!=='lesson'||!s.planId||!s.lesson)return;
  if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  try{window.WillenaVocabPractice&&window.WillenaVocabPractice.restore&&window.WillenaVocabPractice.restore();}catch(_){ }
  try{window.WillenaVocabTestPractice&&window.WillenaVocabTestPractice.restore&&window.WillenaVocabTestPractice.restore();}catch(_){ }
  try{window.WillenaSentencePractice&&window.WillenaSentencePractice.restore&&window.WillenaSentencePractice.restore();}catch(_){ }
  var tries=0;
  (function render(){
    var safe=window.WillenaLessonSafeFix4;
    if(safe&&safe.renderSafeLesson){
      safe.renderSafeLesson(s.planId,s.lesson,{replace:true,fromPopstate:true});
      return;
    }
    if(++tries<40)setTimeout(render,25);
  })();
});
console.log('[Test Prep] pre-navigation lesson history guard active');
})();