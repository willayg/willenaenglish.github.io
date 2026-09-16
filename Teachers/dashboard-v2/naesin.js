(function(){
'use strict';
// Legacy 내신 V1 loader intentionally disabled.
// 내신 V2 is the only 내신 experience shown in Teacher Dashboard V2.
console.info('[naesin-v1] legacy loader disabled');

// Teacher Dashboard extension loader. Keep feature pages out of the large
// inline dashboard script so they can evolve independently.
if(!document.getElementById('grammarFoundationsTeacherScript')){
  const s=document.createElement('script');
  s.id='grammarFoundationsTeacherScript';
  s.src='./grammar-foundations-teacher.js?v=1.2.0';
  s.defer=true;
  document.head.appendChild(s);
}
})();
