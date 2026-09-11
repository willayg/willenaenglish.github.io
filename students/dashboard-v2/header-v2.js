import {startStudentHeaderData,subscribeStudentHeaderData} from '../shared/student-header-data.js?v=1.0.0';

const $=s=>document.querySelector(s);

function initials(name){
  const value=String(name||'Student').trim();
  return value.charAt(0).toUpperCase()||'S';
}

function renderHeader(data){
  const avatar=$('.header .avatar');
  const points=$('#headerPoints');
  const profileAvatar=$('#profileAvatar');
  const profileName=$('#profileName');

  const name=data.name||'Student';
  const avatarValue=data.avatar||initials(name);

  if(avatar)avatar.textContent=avatarValue;
  if(profileAvatar)profileAvatar.textContent=avatarValue;
  if(profileName)profileName.textContent=name;

  // Dashboard V2 currently presents the student's star total in this pill.
  // Keep that visual contract while sourcing the value from the shared service.
  if(points&&typeof data.stars==='number')points.textContent=`⭐ ${data.stars.toLocaleString()}`;
}

startStudentHeaderData();
subscribeStudentHeaderData(renderHeader);
