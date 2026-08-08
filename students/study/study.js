(function(){
'use strict';
var root=document.getElementById('app'),langBtn=document.getElementById('languageBtn'),brandSubtitle=document.getElementById('brandSubtitle'),footerText=document.getElementById('footerText');
var lang='ko',view='welcome',selectedSkill=null,selectedIndex=0,correct=0,total=0;
var T={
 en:{brand:'Study',footer:'Willena English · Study',welcome:'Study',start:'Start studying',intro:'Practice the English you are learning at Willena.',current:'Current book',book:'English Bus 4',unit:'Unit 3',chooseSkill:'What do you want to practice?',chooseActivity:'Choose an activity',back:'Back',vocabulary:'Vocabulary',spelling:'Spelling',grammar:'Grammar',sentence:'Sentence Building',listening:'Listening',reading:'Reading',typed:'Type the answer',choice:'Choose the answer',gap:'Fill the gap',order:'Build the sentence',listen:'Listen and choose',read:'Read and answer',question:'Question',finish:'Practice complete',again:'Practice again',score:'Correct'},
 ko:{brand:'학습',footer:'Willena English · 학습',welcome:'영어 학습',start:'학습 시작',intro:'윌레나에서 배우고 있는 내용을 연습해 보세요.',current:'현재 교재',book:'English Bus 4',unit:'Unit 3',chooseSkill:'무엇을 연습할까요?',chooseActivity:'연습 방법을 선택하세요',back:'뒤로',vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence:'문장 만들기',listening:'듣기',reading:'읽기',typed:'직접 입력하기',choice:'정답 고르기',gap:'빈칸 채우기',order:'문장 만들기',listen:'듣고 고르기',read:'읽고 답하기',question:'문제',finish:'연습 완료',again:'다시 연습',score:'정답'}
};
function tx(k){return T[lang][k]||k;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function chrome(){document.documentElement.lang=lang;langBtn.textContent=lang==='ko'?'English':'한국어';brandSubtitle.textContent=tx('brand');footerText.textContent=tx('footer');}
function screen(html,dir){
 dir=dir||'forward';
 root.innerHTML='<section class="screen screen-in '+(dir==='back'?'from-left':'from-right')+'">'+html+'</section>';
 var next=root.querySelector('.screen');
 requestAnimationFrame(function(){requestAnimationFrame(function(){if(next)next.classList.add('screen-ready');});});
 setTimeout(function(){if(next)next.classList.add('screen-ready');},450);
}
function optionButtons(items){return '<div class="setup-options">'+items.map(function(item){return '<button class="setup-option" type="button" data-value="'+esc(item.value)+'">'+esc(item.label)+'<span>→</span></button>';}).join('')+'</div>';}
function welcome(){document.body.classList.add('welcome-mode');screen('<div class="welcome-layout"><img class="welcome-logo" src="/Assets/Images/Logo.png?v=20260730-3" alt="Willena English Academy"><div class="welcome-panel"><h1>'+tx('welcome')+'</h1><p class="study-menu-copy">'+tx('intro')+'</p><div class="study-chip">'+tx('current')+' · '+tx('book')+' · '+tx('unit')+'</div><button class="welcome-start" id="studyStart" type="button">'+tx('start')+'</button><p class="study-demo-note">Prototype: the book and unit are placeholders until the student curriculum API is connected.</p></div></div>');}
var skills=[
 {value:'vocabulary',labelKey:'vocabulary'},
 {value:'spelling',labelKey:'spelling'},
 {value:'grammar',labelKey:'grammar'},
 {value:'sentence',labelKey:'sentence'},
 {value:'listening',labelKey:'listening'},
 {value:'reading',labelKey:'reading'}
];
function skillMenu(dir){document.body.classList.remove('welcome-mode');view='skills';screen('<div class="setup-progress"><span>'+tx('book')+' · '+tx('unit')+'</span><div><i style="width:33%"></i></div></div><h2>'+tx('chooseSkill')+'</h2><p class="study-subtitle">'+tx('current')+': <strong>'+tx('book')+' · '+tx('unit')+'</strong></p>'+optionButtons(skills.map(function(s){return{value:s.value,label:tx(s.labelKey)};}))+'<div class="study-back-row"><button class="btn btn-ghost" id="backToWelcome">'+tx('back')+'</button></div>',dir);}
var examples={
 vocabulary:[
  {label:'choice',activity:{id:'demo-vocab-choice',skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:'promise',context:'Choose the Korean meaning.'},response:{type:'multiple_choice',choices:['약속하다','후회하다','사과하다','무서워하다']},answer:'약속하다'}},
  {label:'typed',activity:{id:'demo-vocab-type',skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:'약속하다',context:'Type the English word.'},response:{type:'typed_answer'},answer:'promise'}}
 ],
 spelling:[
  {label:'typed',activity:{id:'demo-spelling',skill:'spelling',usage:['practice'],stimulus:{type:'text',prompt:'약속하다',context:'Spell the English word.'},response:{type:'typed_answer'},answer:'promise'}}
 ],
 grammar:[
  {label:'gap',activity:{id:'demo-gap',skill:'grammar',usage:['practice'],stimulus:{type:'text',prompt:'She ___ to be a doctor.',context:'Complete the sentence.'},response:{type:'gap_fill_text'},answer:'wants'}},
  {label:'choice',activity:{id:'demo-grammar-choice',skill:'grammar',usage:['practice','level_test'],stimulus:{type:'text',prompt:'She ___ to be a doctor.'},response:{type:'multiple_choice',choices:['want','wants','wanting','wanted']},answer:'wants'}}
 ],
 sentence:[
  {label:'order',activity:{id:'demo-order',skill:'sentence_building',usage:['practice','level_test'],stimulus:{type:'text',prompt:'그녀는 간호사가 되고 싶어해요.'},response:{type:'sentence_unscramble',tokens:['She','wants','to','be','a','nurse.']},answer:'She wants to be a nurse.'}}
 ],
 listening:[
  {label:'listen',activity:{id:'demo-listen',skill:'listening',usage:['practice','level_test'],stimulus:{type:'audio',prompt:'Choose what you hear.',text:'I am washing my hands.'},response:{type:'multiple_choice',choices:['I am washing my hands.','I am brushing my teeth.','I am opening the window.','I am making dinner.']},answer:'I am washing my hands.'}}
 ],
 reading:[
  {label:'read',activity:{id:'demo-read',skill:'reading',usage:['practice','level_test'],stimulus:{type:'text',prompt:'Where does Mina go today?',context:'Mina usually walks to school, but today it is raining. Her father drives her to school.'},response:{type:'multiple_choice',choices:['To school','To the park','To a restaurant','To the library']},answer:'To school'}}
 ]
};
function activityMenu(skill,dir){document.body.classList.remove('welcome-mode');view='activity-menu';selectedSkill=skill;var rows=examples[skill]||[];screen('<div class="setup-progress"><span>'+tx('book')+' · '+tx('unit')+'</span><div><i style="width:66%"></i></div></div><h2>'+tx('chooseActivity')+'</h2><p class="study-subtitle">'+tx(skills.find(function(s){return s.value===skill;}).labelKey)+'</p>'+optionButtons(rows.map(function(row,i){return{value:String(i),label:tx(row.label)};}))+'<div class="study-back-row"><button class="btn btn-ghost" id="backToSkills">'+tx('back')+'</button></div>',dir);}
var engine=null;
function practice(index,dir){document.body.classList.remove('welcome-mode');view='practice';selectedIndex=Number(index)||0;var rows=examples[selectedSkill]||[],row=rows[selectedIndex]||rows[0];if(!row){skillMenu('back');return;}screen('<div class="question-meta"><span>'+tx('question')+'</span><span>'+tx(skills.find(function(s){return s.value===selectedSkill;}).labelKey)+'</span></div><div class="progress"><i style="width:100%"></i></div><div class="activity-host" id="activityHost"></div><div class="study-back-row"><button class="btn btn-ghost" id="backToActivityMenu">'+tx('back')+'</button></div>',dir);var host=document.getElementById('activityHost');if(!window.WillenaActivityEngine){host.innerHTML='<p class="error">Activity engine failed to load.</p>';return;}engine=new WillenaActivityEngine(host,{onAnswer:function(payload){total++;if(payload.result.correct)correct++;setTimeout(finish,650);}});engine.setActivity(row.activity);}
function finish(){view='finish';screen('<div class="study-finish"><span class="study-chip">'+tx('finish')+'</span><strong>'+correct+' / '+total+'</strong><p>'+tx('score')+'</p><button class="welcome-start" id="practiceAgain" type="button">'+tx('again')+'</button><div class="study-back-row"><button class="btn btn-ghost" id="finishBack">'+tx('back')+'</button></div></div>');}
root.addEventListener('click',function(e){
 if(e.target.closest('#studyStart')){skillMenu();return;}
 if(e.target.closest('#backToWelcome')){view='welcome';welcome();return;}
 if(e.target.closest('#backToSkills')){skillMenu('back');return;}
 if(e.target.closest('#backToActivityMenu')){activityMenu(selectedSkill,'back');return;}
 if(e.target.closest('#finishBack')){activityMenu(selectedSkill,'back');return;}
 if(e.target.closest('#practiceAgain')){practice(selectedIndex);return;}
 var option=e.target.closest('.setup-option');if(!option)return;
 if(view==='skills'){activityMenu(option.getAttribute('data-value'));return;}
 if(view==='activity-menu'){practice(option.getAttribute('data-value'));return;}
});
langBtn.addEventListener('click',function(){lang=lang==='ko'?'en':'ko';chrome();if(view==='welcome')welcome();else if(view==='skills')skillMenu();else if(view==='activity-menu')activityMenu(selectedSkill);else if(view==='practice')practice(selectedIndex);else finish();});
chrome();welcome();
})();