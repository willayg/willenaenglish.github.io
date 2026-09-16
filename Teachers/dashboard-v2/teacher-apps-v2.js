(()=>{
'use strict';
const APPS=[
  {title:'Text Capture',href:'/Teachers/tools/vision_ai/vision.html',desc:'Capture text from images using your mobile device.',mobileOnly:true},
  {title:'Word Builder',href:'/Teachers/tools/wordtest/wordtest2.html',icon:'/Teachers/tools/assets/icons/wordtest.png',desc:'Create custom vocabulary worksheets with images and more.'},
  {title:'Flashcard Builder',href:'/Teachers/tools/flashcard/flashcard.html',icon:'/Teachers/tools/assets/icons/flashcard.png',desc:'Design and print flashcards for any word list.'},
  {title:'Lesson Planner',href:'/Teachers/tools/planner/planner.html',icon:'/Teachers/tools/assets/icons/lesson.png',desc:'Plan and organize your ESL lessons with AI help.'},
  {title:'Grammar Tool',href:'/Teachers/tools/Grammar/grammar2.html',icon:'/Teachers/tools/assets/icons/grammar.png',desc:'Create and print custom grammar worksheets.'},
  {title:'Survey Builder',href:'/Teachers/tools/survey_builder/survey_builder.html',icon:'/Teachers/tools/assets/icons/survey.png',desc:'Create printable and customizable classroom surveys.'},
  {title:'Reading Builder',href:'/Teachers/tools/reading/reading.html',icon:'/Teachers/tools/assets/icons/reading.png',desc:'Generate and customize reading passages and questions.'},
  {title:'Wordsearch Builder',href:'/Teachers/tools/puzzles/wordsearch.html',icon:'/Teachers/tools/assets/icons/wordsearch.png',desc:'Create printable wordsearch puzzles for your students.'},
  {title:'Grid Game',href:'/Teachers/tools/grid_game/grid_game.html',icon:'/Teachers/tools/assets/icons/grid.png',desc:'Interactive classroom grid game for vocabulary and review.'},
  {title:'Student Tracker',href:'/Teachers/tools/student_tracker/student_tracker.html',icon:'/Teachers/tools/assets/icons/lesson.png',desc:'View class leaderboards, monthly filters, and English Arcade stats.'},
  {title:'Manage Students',href:'/Teachers/tools/manage_students.html',icon:'/Teachers/tools/assets/icons/lesson.png',desc:'Create, reset, or remove student accounts and approvals.'},
  {title:'Word Game Builder',href:'/Teachers/tools/game-builder/index.html',icon:'/Teachers/tools/assets/icons/grid.png',desc:'Create custom word games for your students to play online.'}
];
function mountStyle(){
  if(document.getElementById('teacherAppsV2Style'))return;
  const style=document.createElement('style');
  style.id='teacherAppsV2Style';
  style.textContent=`
    #view-apps .app-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
    #view-apps .teacher-tool-card{display:flex;flex-direction:column;min-height:210px;text-decoration:none;color:inherit;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;overflow:hidden}
    #view-apps .teacher-tool-card:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(40,40,60,.11);border-color:#9fdce3}
    #view-apps .teacher-tool-icon{height:92px;display:flex;align-items:center;justify-content:center;margin:-2px 0 6px}
    #view-apps .teacher-tool-icon img{max-height:78px;max-width:110px;object-fit:contain}
    #view-apps .teacher-tool-placeholder{width:70px;height:70px;border-radius:18px;display:grid;place-items:center;background:#eef9fb;color:#287b85;font-size:1.8rem;font-weight:800}
    #view-apps .teacher-tool-card h3{margin:6px 0 5px;font-size:.95rem}
    #view-apps .teacher-tool-card p{margin:0;font-size:.72rem;line-height:1.45}
    #view-apps .teacher-tool-open{margin-top:auto;padding-top:12px;font-size:.66rem;font-weight:800;color:#287b85}
    #view-apps .teacher-tool-mobile{display:none}
    @media(max-width:1180px){#view-apps .app-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:850px){#view-apps .app-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:700px){#view-apps .app-grid{grid-template-columns:1fr}#view-apps .teacher-tool-card{min-height:160px}#view-apps .teacher-tool-mobile{display:flex}}
  `;
  document.head.appendChild(style);
}
function card(app){
  const icon=app.icon?`<div class="teacher-tool-icon"><img src="${app.icon}" alt=""></div>`:`<div class="teacher-tool-icon"><div class="teacher-tool-placeholder">⌁</div></div>`;
  return `<a class="app-card teacher-tool-card${app.mobileOnly?' teacher-tool-mobile':''}" href="${app.href}">${icon}<h3>${app.title}</h3><p>${app.desc}</p><span class="teacher-tool-open">Open tool →</span></a>`;
}
function mount(){
  const grid=document.querySelector('#view-apps .app-grid');
  if(!grid)return false;
  mountStyle();
  grid.innerHTML=APPS.map(card).join('');
  const rev=document.getElementById('teacherDashboardRev');
  if(rev)rev.textContent='REV r13.08';
  return true;
}
function boot(){
  if(mount())return;
  let tries=0;
  const timer=setInterval(()=>{if(mount()||++tries>40)clearInterval(timer)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
