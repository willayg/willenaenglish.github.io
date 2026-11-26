import {mountStudentInbox} from '/students/components/student-inbox.js?v=20261101-menu-prominent1';
function setupInbox(){
 if(document.documentElement.classList.contains('leaderboard-only'))return;
 const isProfile=location.pathname.endsWith('/profile.html');
 const user=isProfile?document.querySelector('.profile-intro'):document.querySelector('#settingsModal .settings-dialog');
 if(!user||document.querySelector('.dashboard-teacher-message'))return;
 const host=document.createElement('div');host.style.display='contents';
 const shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML='<div class="menu-anchor" style="display:none" aria-hidden="true"><button id="avatarBtn" hidden type="button"></button><div id="avatarMenu"></div></div>';
 document.body.append(host);
 mountStudentInbox({shadowRoot:shadow,isConnected:true,_inboxTimer:0});
 const button=document.createElement('button');
 button.type='button';button.className='dashboard-teacher-message';
 button.textContent='✉ 선생님 메시지';button.setAttribute('aria-label','선생님 메시지');button.title='선생님 메시지';
 if(isProfile){const heading=user.querySelector('h1');heading?.insertAdjacentElement('afterend',button)}else{const group=user.querySelector('.settings-group');if(group)group.insertAdjacentElement('beforebegin',button);else user.append(button)}
 const badge=shadow.querySelector('.inbox-header-badge');
 const notice=isProfile?null:document.getElementById('dashboardTeacherNotice');
 const count=notice?.querySelector('[data-inbox-count]');
 const update=()=>{
  const n=badge&&!badge.hidden?String(badge.textContent||'').trim():'';
  button.textContent=n?'✉ 선생님 메시지 · '+n:'✉ 선생님 메시지';
  button.classList.toggle('has-messages',!!n);
  if(notice){
   notice.hidden=!n;
   if(count)count.textContent=n;
   notice.setAttribute('aria-label',n?'선생님 메시지 '+n+'개':'선생님 메시지');
  }
 };
 if(notice)notice.onclick=()=>shadow.querySelector('.inbox-prominent')?.click();
 if(badge)new MutationObserver(update).observe(badge,{attributes:true,childList:true,characterData:true,subtree:true});
 button.onclick=()=>shadow.querySelector('.inbox-prominent')?.click();update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupInbox,{once:true});else setupInbox();