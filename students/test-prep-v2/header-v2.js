import {startStudentHeaderData,subscribeStudentHeaderData} from '../shared/student-header-data.js?v=1.0.0';

const header=document.querySelector('.student-header');
const nameEl=document.getElementById('user');

function renderStudentHeader(data){
  if(nameEl&&data.name)nameEl.textContent=data.name;
  if(header){
    header.dataset.studentHeaderShared='1';
    if(data.userId)header.dataset.studentId=String(data.userId);
    if(typeof data.points==='number')header.dataset.points=String(data.points);
    if(typeof data.stars==='number')header.dataset.stars=String(data.stars);
    if(data.avatar)header.dataset.avatar=String(data.avatar);
  }
}

startStudentHeaderData();
subscribeStudentHeaderData(renderStudentHeader);
