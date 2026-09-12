import {startStudentHeaderData,subscribeStudentHeaderData} from '../shared/student-header-data.js?v=1.0.0';
import {logoutStudent,openStudentProfile} from '../shared/student-header-actions.js?v=1.0.1';

const BIG_TEXT_KEY='willena-testprep-big-text';
const BIG_TEXT_EVENT='willena:test-prep-big-text';
const header=document.querySelector('.student-header');
const nameEl=document.getElementById('user');
const pointsEl=document.getElementById('headerPoints');
const starsEl=document.getElementById('headerStars');
const avatarButton=document.getElementById('studentAvatar');
const menu=document.getElementById('studentProfileMenu');
const profileButton=document.getElementById('studentProfileOpen');
const dashboardButton=document.getElementById('studentDashboardOpen');
const bigTextButton=document.getElementById('studentBigTextToggle');
const bigTextLabel=document.getElementById('studentBigTextLabel');
const testPrepAButton=document.getElementById('studentTestPrepA');
const testPrepBButton=document.getElementById('studentTestPrepB');
const logoutButton=document.getElementById('studentLogout');

function fallbackAvatar(name){
  const value=String(name||'Student').trim();
  return value.charAt(0).toUpperCase()||'S';
}
function bigTextEnabled(){try{return localStorage.getItem(BIG_TEXT_KEY)==='1'}catch{return false}}
function renderBigTextSetting(){
  const on=bigTextEnabled();
  if(bigTextButton)bigTextButton.setAttribute('aria-pressed',String(on));
  if(bigTextLabel)bigTextLabel.textContent=`큰 글자 ${on?'켜짐':'꺼짐'}`;
}
function setBigText(enabled){
  try{localStorage.setItem(BIG_TEXT_KEY,enabled?'1':'0')}catch{}
  renderBigTextSetting();
  window.dispatchEvent(new CustomEvent(BIG_TEXT_EVENT,{detail:{enabled:!!enabled}}));
}
function renderStudentHeader(data){
  const name=data.name||'Student';
  if(nameEl)nameEl.textContent=name;
  if(pointsEl)pointsEl.textContent=typeof data.points==='number'?data.points.toLocaleString():'—';
  if(starsEl)starsEl.textContent=typeof data.stars==='number'?data.stars.toLocaleString():'—';
  if(avatarButton)avatarButton.textContent=data.avatar||fallbackAvatar(name);
  if(header){header.dataset.studentHeaderShared='1';if(data.userId)header.dataset.studentId=String(data.userId)}
}
function setMenu(open){
  if(!menu||!avatarButton)return;
  menu.hidden=!open;
  avatarButton.setAttribute('aria-expanded',open?'true':'false');
}

avatarButton?.addEventListener('click',event=>{event.stopPropagation();setMenu(menu?.hidden!==false)});
menu?.addEventListener('click',event=>event.stopPropagation());
document.addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMenu(false)});
profileButton?.addEventListener('click',()=>openStudentProfile());
dashboardButton?.addEventListener('click',()=>{window.location.href='/students/dashboard-v2/'});
bigTextButton?.addEventListener('click',()=>{setBigText(!bigTextEnabled());setMenu(false)});
testPrepAButton?.addEventListener('click',()=>{window.location.href='../test-prep-app/'});
testPrepBButton?.addEventListener('click',()=>setMenu(false));
logoutButton?.addEventListener('click',()=>logoutStudent());

renderBigTextSetting();
startStudentHeaderData();
subscribeStudentHeaderData(renderStudentHeader);
