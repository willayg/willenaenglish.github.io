(function(){
'use strict';
var lang='ko',selectedSkill='vocabulary',selectedIndex=0,engine=null;
var app=document.getElementById('app'),grid=document.getElementById('skillGrid'),panel=document.getElementById('practicePanel'),root=document.getElementById('activityRoot'),langBtn=document.getElementById('languageBtn'),skillLabel=document.getElementById('practiceSkill'),title=document.getElementById('practiceTitle');
var copy={
 ko:{continue:'이어하기',browse:'단원 보기',choose:'연습할 영역을 선택하세요',vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence:'문장 만들기',listening:'듣기',reading:'읽기',next:'다음',back:'뒤로'},
 en:{continue:'Continue practice',browse:'Browse units',choose:'Choose a skill',vocabulary:'Vocabulary',spelling:'Spelling',grammar:'Grammar',sentence:'Sentence Building',listening:'Listening',reading:'Reading',next:'Next',back:'Back'}
};
function t(k){return copy[lang][k]||k;}
var skills=[
 {id:'vocabulary',icon:'Aa',label:'vocabulary',desc:'Meaning and recall'},
 {id:'spelling',icon:'ABC',label:'spelling',desc:'Type and spell words'},
 {id:'grammar',icon:'✓',label:'grammar',desc:'Patterns and gap fill'},
 {id:'sentence',icon:'↔',label:'sentence',desc:'Build complete sentences'},
 {id:'listening',icon:'♪',label:'listening',desc:'Listen and choose'},
 {id:'reading',icon:'¶',label:'reading',desc:'Read and answer'}
];
var examples={
 vocabulary:[
  {title:'Meaning choice',activity:{id:'demo-vocab-choice',skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:'promise',context:'Choose the Korean meaning.'},response:{type:'multiple_choice',choices:['약속하다','후회하다','사과하다','무서워하다']},answer:'약속하다'}},
  {title:'Vocabulary recall',activity:{id:'demo-vocab-type',skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:'약속하다',context:'Type the English word.'},response:{type:'typed_answer'},answer:'promise'}}
 ],
 spelling:[{title:'Spelling',activity:{id:'demo-spelling',skill:'spelling',usage:['practice'],stimulus:{type:'text',prompt:'약속하다',context:'Spell the English word.'},response:{type:'typed_answer'},answer:'promise'}}],
 grammar:[
  {title:'Gap fill',activity:{id:'demo-gap',skill:'grammar',usage:['practice'],stimulus:{type:'text',prompt:'She ___ to be a doctor.',context:'Complete the sentence.'},response:{type:'gap_fill_text'},answer:'wants'}},
  {title:'Grammar choice',activity:{id:'demo-grammar-choice',skill:'grammar',usage:['practice','level_test'],stimulus:{type:'text',prompt:'She ___ to be a doctor.'},response:{type:'multiple_choice',choices:['want','wants','wanting','wanted']},answer:'wants'}}
 ],
 sentence:[{title:'Build the sentence',activity:{id:'demo-order',skill:'sentence_building',usage:['practice','level_test'],stimulus:{type:'text',prompt:'그녀는 간호사가 되고 싶어해요.'},response:{type:'sentence_unscramble',tokens:['She','wants','to','be','a','nurse.']},answer:'She wants to be a nurse.'}}],
 listening:[{title:'Listen and choose',activity:{id:'demo-listen',skill:'listening',usage:['practice','level_test'],stimulus:{type:'audio',prompt:'Choose what you hear.',text:'I am washing my hands.'},response:{type:'multiple_choice',choices:['I am washing my hands.','I am brushing my teeth.','I am opening the window.','I am making dinner.']},answer:'I am washing my hands.'}}],
 reading:[{title:'Read and answer',activity:{id:'demo-read',skill:'reading',usage:['practice','level_test'],stimulus:{type:'text',prompt:'Where does Mina go today?',context:'Mina usually walks to school, but today it is raining. Her father drives her to school.'},response:{type:'multiple_choice',choices:['To school','To the park','To a restaurant','To the library']},answer:'To school'}}]
};
function drawSkills(){grid.innerHTML='';skills.forEach(function(skill){var b=document.createElement('button');b.type='button';b.className='skill-card';b.dataset.skill=skill.id;b.innerHTML='<span class="skill-icon">'+skill.icon+'</span><span><strong>'+t(skill.label)+'</strong><small>'+skill.desc+'</small></span>';b.addEventListener('click',function(){openPractice(skill.id,0);});grid.appendChild(b);});}
function openPractice(skill,index){selectedSkill=skill;selectedIndex=Number(index)||0;var rows=examples[skill]||[];if(!rows.length)return;var row=rows[selectedIndex%rows.length];skillLabel.textContent=t(skill);title.textContent=row.title;panel.hidden=false;if(!window.WillenaActivityEngine){root.innerHTML='<p>Activity engine failed to load.</p>';return;}engine=new WillenaActivityEngine(root,{onAnswer:function(){}});engine.setActivity(row.activity);panel.scrollIntoView({behavior:'smooth',block:'start'});}
function next(){var rows=examples[selectedSkill]||[];if(!rows.length)return;selectedIndex=(selectedIndex+1)%rows.length;openPractice(selectedSkill,selectedIndex);}
document.getElementById('continueBtn').addEventListener('click',function(){openPractice('vocabulary',0);});
document.getElementById('changeUnitBtn').addEventListener('click',function(){document.querySelector('.section-block').scrollIntoView({behavior:'smooth'});});
document.getElementById('closePractice').addEventListener('click',function(){panel.hidden=true;document.querySelector('.section-block').scrollIntoView({behavior:'smooth'});});
document.getElementById('nextActivity').addEventListener('click',next);
document.querySelectorAll('.review-row').forEach(function(row){row.addEventListener('click',function(){openPractice(row.dataset.skill,0);});});
langBtn.addEventListener('click',function(){lang=lang==='ko'?'en':'ko';langBtn.textContent=lang==='ko'?'English':'한국어';drawSkills();document.getElementById('continueBtn').textContent=t('continue');document.getElementById('changeUnitBtn').textContent=t('browse');document.querySelector('.section-heading h2').textContent=t('choose');document.getElementById('nextActivity').textContent=t('next');document.getElementById('closePractice').textContent='← '+t('back');if(!panel.hidden)openPractice(selectedSkill,selectedIndex);});
drawSkills();
})();