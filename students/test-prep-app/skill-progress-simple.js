(function(){
'use strict';
function install(){
 if(document.getElementById('tpSimpleSkillProgressStyle'))return;
 const s=document.createElement('style');
 s.id='tpSimpleSkillProgressStyle';
 s.textContent=`
 #assignmentHome .tp-stop-pct small{display:none!important}
 #assignmentHome .tp-mastery-note,
 #assignmentHome .tp-seosul-mastery-explain,
 #assignmentHome .seosul-progress-detail{display:none!important}
 `;
 document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
