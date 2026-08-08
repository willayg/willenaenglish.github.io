(function(){
'use strict';
var examples=[
 {label:'Vocabulary',title:'Meaning choice',activity:{id:'demo-vocab-1',skill:'vocabulary',usage:['practice','teacher_quiz'],stimulus:{type:'text',prompt:'promise',context:'Choose the Korean meaning.'},response:{type:'multiple_choice',choices:['약속하다','후회하다','사과하다','무서워하다']},answer:'약속하다'}},
 {label:'Typed answer',title:'Vocabulary recall',activity:{id:'demo-type-1',skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:'약속하다',context:'Type the English word.'},response:{type:'typed_answer'},answer:'promise'}},
 {label:'Sentence build',title:'Order the sentence',activity:{id:'demo-order-1',skill:'sentence_building',usage:['practice','level_test','teacher_quiz'],stimulus:{type:'text',prompt:'그녀는 간호사가 되고 싶어해요.'},response:{type:'sentence_unscramble',tokens:['She','wants','to','be','a','nurse.']},answer:'She wants to be a nurse.'}},
 {label:'Grammar',title:'Gap fill',activity:{id:'demo-gap-1',skill:'grammar',usage:['practice','teacher_quiz'],stimulus:{type:'text',prompt:'She ___ to be a doctor.',context:'Complete the sentence.'},response:{type:'gap_fill_text'},answer:'wants'}},
 {label:'Listening',title:'Listen and choose',activity:{id:'demo-listen-1',skill:'listening',usage:['practice','level_test'],stimulus:{type:'audio',prompt:'Choose what you hear.',text:'I am washing my hands.'},response:{type:'multiple_choice',choices:['I am washing my hands.','I am brushing my teeth.','I am opening the window.','I am making dinner.']},answer:'I am washing my hands.'}},
 {label:'Reading',title:'Read and answer',activity:{id:'demo-read-1',skill:'reading',usage:['practice','level_test'],stimulus:{type:'text',prompt:'Where does Mina go today?',context:'Mina usually walks to school, but today it is raining. Her father drives her to school.'},response:{type:'multiple_choice',choices:['To school','To the park','To a restaurant','To the library']},answer:'To school'}}
];
var index=0,correct=0,total=0;
var root=document.getElementById('activityRoot'),tabs=document.getElementById('skillTabs'),score=document.getElementById('scoreValue'),skillLabel=document.getElementById('skillLabel'),title=document.getElementById('activityTitle');
var engine=new WillenaActivityEngine(root,{onAnswer:function(payload){total++;if(payload.result.correct)correct++;score.textContent=correct+' / '+total;}});
function drawTabs(){tabs.innerHTML='';examples.forEach(function(example,i){var b=document.createElement('button');b.type='button';b.className='skill-tab'+(i===index?' is-active':'');b.textContent=example.label;b.addEventListener('click',function(){index=i;show();});tabs.appendChild(b);});}
function show(){var example=examples[index];skillLabel.textContent=example.activity.skill.replace(/_/g,' ');title.textContent=example.title;drawTabs();engine.setActivity(example.activity);}
document.getElementById('nextActivity').addEventListener('click',function(){index=(index+1)%examples.length;show();});
show();
})();