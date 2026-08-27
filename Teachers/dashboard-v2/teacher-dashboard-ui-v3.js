(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
function addStyles(){
 if($('#teacherDashboardUiV3Styles'))return;
 const s=document.createElement('style');s.id='teacherDashboardUiV3Styles';s.textContent=`
body.teacher-ui-v3{background:#f5f6f8}
.teacher-ui-v3 .workspace{max-width:1180px;width:100%;margin:0 auto}
.teacher-ui-v3 #view-classes .page-head,.teacher-ui-v3 #view-students .page-head{background:#fff;border:1px solid var(--line);border-radius:22px;padding:18px 20px;box-shadow:var(--shadow);align-items:center}
.teacher-ui-v3 #view-classes .page-head h1,.teacher-ui-v3 #view-students .page-head h1{font-size:1.38rem}
.teacher-ui-v3 .class-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.teacher-ui-v3 .class-card{position:relative;min-height:205px;border:1.5px solid #e1e4ea;border-radius:22px;padding:19px;background:linear-gradient(180deg,#fff 0%,#fbfcfd 100%);box-shadow:0 8px 24px rgba(40,40,60,.055);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;outline:none}
.teacher-ui-v3 .class-card:hover,.teacher-ui-v3 .class-card:focus-visible{transform:translateY(-2px);box-shadow:0 15px 34px rgba(40,40,60,.11);border-color:#b9e5ea}
.teacher-ui-v3 .class-card:after{content:'›';position:absolute;right:18px;bottom:15px;width:30px;height:30px;border-radius:10px;background:#edf9fb;color:#318c97;display:grid;place-items:center;font-size:22px;font-weight:500}
.teacher-ui-v3 .class-name{font-size:1.08rem}.teacher-ui-v3 .class-count{background:#eef9fb;color:#347d86}
.teacher-ui-v3 .class-stats{gap:8px;margin-top:16px}.teacher-ui-v3 .class-stat{background:#f4f6f8;border:1px solid #edf0f3;border-radius:14px;padding:11px}.teacher-ui-v3 .class-stat b{font-size:1.08rem}.teacher-ui-v3 .class-link{margin-top:14px;color:#5b6570;font-size:.7rem;padding-right:38px}
.teacher-ui-v3 #view-students .panel{border-radius:22px;box-shadow:var(--shadow);background:transparent;border:0;overflow:visible}
.teacher-ui-v3 #view-students .panel-head{background:#fff;border:1px solid var(--line);border-radius:18px;margin-bottom:11px;padding:13px 16px}
.teacher-ui-v3 .student-list{max-height:none;overflow:visible;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
.teacher-ui-v3 .student-row{position:relative;display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:12px;background:#fff;border:1px solid #e5e8ed;border-radius:18px;padding:15px 16px;box-shadow:0 5px 16px rgba(40,40,60,.045);transition:.15s;outline:none}
.teacher-ui-v3 .student-row:hover,.teacher-ui-v3 .student-row:focus-visible{background:#fff;border-color:#bfe5e9;box-shadow:0 10px 24px rgba(40,40,60,.08);transform:translateY(-1px)}
.teacher-ui-v3 .student-row:after{content:'›';position:absolute;right:12px;top:12px;color:#a4adb4;font-size:20px}
.teacher-ui-v3 .student-name{font-size:.9rem;color:#2f3540;padding-right:18px}.teacher-ui-v3 .student-name:after{content:'  View activity';display:block;color:#4599a3;font-size:.6rem;font-weight:700;margin-top:4px}
.teacher-ui-v3 .student-row .metric strong{font-size:.88rem}.teacher-ui-v3 .student-row .metric span{font-size:.62rem}.teacher-ui-v3 .student-row .hide-mid{display:none}.teacher-ui-v3 .student-row .hide-mobile{display:block}
.teacher-ui-v3 .drawer{width:min(900px,98vw);background:#f5f6f8}.teacher-ui-v3 .drawer-head{padding:20px 24px}.teacher-ui-v3 .drawer-name{font-size:1.3rem}.teacher-ui-v3 .drawer-body{padding:18px}
.teacher-ui-v3 .rating-grid{grid-template-columns:1fr 1fr;gap:12px}.teacher-ui-v3 .big-card{padding:17px;border-radius:19px;box-shadow:0 4px 14px rgba(40,40,60,.035)}.teacher-ui-v3 .big-card h3{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:#7d8390}.teacher-ui-v3 .big-rating{font-size:1.36rem}
.teacher-ui-v3 .statline{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:13px}.teacher-ui-v3 .statline span{margin:0;background:#f4f6f8;border:1px solid #edf0f3;border-radius:11px;padding:9px 10px;font-size:.66rem;line-height:1.35}
.teacher-ui-v3 .detail{border-radius:19px;padding:17px;box-shadow:0 4px 14px rgba(40,40,60,.03)}.teacher-ui-v3 .detail h3{font-size:.84rem;margin-bottom:12px}.teacher-ui-v3 .skill{padding:11px 0}.teacher-ui-v3 .proof-row{padding:10px 0}
.teacher-ui-v3 .teacher-drilldown-note{display:flex;align-items:center;gap:8px;color:#66727b;font-size:.7rem;font-weight:600;margin:0 0 12px;padding:0 3px}.teacher-ui-v3 .teacher-drilldown-note b{color:#318c97}
@media(max-width:1050px){.teacher-ui-v3 .student-list{grid-template-columns:1fr}.teacher-ui-v3 .class-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.teacher-ui-v3 .class-grid{grid-template-columns:1fr}.teacher-ui-v3 .student-row{grid-template-columns:1.35fr 1fr 1fr}.teacher-ui-v3 .rating-grid{grid-template-columns:1fr}.teacher-ui-v3 .statline{grid-template-columns:repeat(2,minmax(0,1fr))}.teacher-ui-v3 #view-classes .page-head,.teacher-ui-v3 #view-students .page-head{padding:15px}}
`;
 document.head.appendChild(s);document.body.classList.add('teacher-ui-v3');
}
function enhanceClassCards(){
 $$('.class-card').forEach(card=>{if(card.dataset.ui3)return;card.dataset.ui3='1';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`${card.dataset.class||'Class'} students`);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}});});
}
function enhanceStudentRows(){
 const list=$('#studentList');if(!list)return;
 if(!$('#teacherDrilldownNote')&&list.querySelector('.student-row')){const n=document.createElement('div');n.id='teacherDrilldownNote';n.className='teacher-drilldown-note';n.innerHTML='<b>Student activity</b><span>Choose a student to open their full learning and study record.</span>';list.parentElement?.insertBefore(n,list);}
 $$('.student-row',list).forEach(row=>{if(row.dataset.ui3)return;row.dataset.ui3='1';row.tabIndex=0;row.setAttribute('role','button');row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click();}});});
}
function enhanceDrawer(){
 const bg=$('#drawerBg');if(!bg?.classList.contains('open'))return;
 const body=$('#drawerBody');if(!body||body.dataset.ui3==='1'||body.querySelector('.empty'))return;body.dataset.ui3='1';
 const skills=[...body.querySelectorAll('.detail h3')].find(x=>x.textContent.trim()==='Skills');if(skills)skills.textContent='Skill performance';
 const mistakes=[...body.querySelectorAll('.detail h3')].find(x=>x.textContent.trim()==='Recent mistakes');if(mistakes)mistakes.textContent='Recent wrong answers';
 const proof=[...body.querySelectorAll('.detail h3')].find(x=>x.textContent.trim()==='Proof of work');if(proof)proof.textContent='Activity by day';
}
let firstLandingDone=false;
function makeClassesLanding(){if(firstLandingDone)return;const classes=$('[data-view="classes"]');const students=$('#studentList');if(!classes||!students)return;firstLandingDone=true;setTimeout(()=>{if(!location.hash&&!document.querySelector('#drawerBg.open'))classes.click();},120);}
function scan(){addStyles();enhanceClassCards();enhanceStudentRows();enhanceDrawer();makeClassesLanding();}
function boot(){scan();new MutationObserver(()=>requestAnimationFrame(scan)).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();