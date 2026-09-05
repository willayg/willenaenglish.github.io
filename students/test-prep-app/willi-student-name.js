(function(){
'use strict';
function studentName(){const u=window.WillenaTestPrepAuth?.state?.user||{};return String(u.korean_name||u.name||u.username||'').trim()}
window.WillenaWilliStudentName=studentName;
function injectGrammarContext(){const section=String(window.WillenaTestPrepQuestionEngine?.section||'').toLowerCase();if(!['grammar','reading'].includes(section)||!document.querySelector('#card .feedback.bad'))return;const name=studentName(),e=document.querySelector('#card #explanation');if(!name||!e||e.querySelector('.tp-willi-student-name-context'))return;const s=document.createElement('span');s.className='tp-willi-student-name-context';s.style.display='none';s.setAttribute('aria-hidden','true');s.textContent=`학생 이름: ${name}. 이름은 설명에서 자연스러울 때 최대 한 번만 사용하고, 이름에 임의의 호칭이나 성별 표현을 붙이지 마세요.`;e.appendChild(s)}
document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('#check'))setTimeout(injectGrammarContext,0)},false);
})();