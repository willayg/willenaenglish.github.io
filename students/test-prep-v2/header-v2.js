import {startStudentHeaderData,subscribeStudentHeaderData} from '../shared/student-header-data.js?v=1.0.0';
import {logoutStudent,openStudentProfile} from '../shared/student-header-actions.js?v=1.0.1';

const header=document.querySelector('.student-header');
const nameEl=document.getElementById('user');
const pointsEl=document.getElementById('headerPoints');
const starsEl=document.getElementById('headerStars');
const avatarButton=document.getElementById('studentAvatar');
const menu=document.getElementById('studentProfileMenu');
const profileButton=document.getElementById('studentProfileOpen');
const dashboardButton=document.getElementById('studentDashboardOpen');
const testPrepAButton=document.getElementById('studentTestPrepA');
const testPrepBButton=document.getElementById('studentTestPrepB');
const logoutButton=document.getElementById('studentLogout');

function fallbackAvatar(name){
  const value=String(name||'Student').trim();
  return value.charAt(0).toUpperCase()||'S';
}

function renderStudentHeader(data){
  const name=data.name||'Student';
  if(nameEl)nameEl.textContent=name;
  if(pointsEl)pointsEl.textContent=typeof data.points==='number'?data.points.toLocaleString():'—';
  if(starsEl)starsEl.textContent=typeof data.stars==='number'?data.stars.toLocaleString():'—';
  if(avatarButton)avatarButton.textContent=data.avatar||fallbackAvatar(name);
  if(header){
    header.dataset.studentHeaderShared='1';
    if(data.userId)header.dataset.studentId=String(data.userId);
  }
}

function setMenu(open){
  if(!menu||!avatarButton)return;
  menu.hidden=!open;
  avatarButton.setAttribute('aria-expanded',open?'true':'false');
}

avatarButton?.addEventListener('click',event=>{
  event.stopPropagation();
  setMenu(menu?.hidden!==false);
});
menu?.addEventListener('click',event=>event.stopPropagation());
document.addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMenu(false)});
profileButton?.addEventListener('click',()=>openStudentProfile());
dashboardButton?.addEventListener('click',()=>{window.location.href='/students/dashboard-v2/'});
testPrepAButton?.addEventListener('click',()=>{window.location.href='../test-prep-app/'});
testPrepBButton?.addEventListener('click',()=>setMenu(false));
logoutButton?.addEventListener('click',()=>logoutStudent());

startStudentHeaderData();
subscribeStudentHeaderData(renderStudentHeader);
