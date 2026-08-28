(function(){
'use strict';

function boot(){
  if(document.getElementById('tpVisualShell'))return;
  const app=document.querySelector('.app');
  const home=document.getElementById('assignmentHome');
  const quiz=document.getElementById('assignedQuizPane');
  if(!app||!home||!quiz)return;

  const shell=document.createElement('div');
  shell.id='tpVisualShell';
  shell.className='tp-visual-shell';
  app.insertBefore(shell,home);
  shell.append(home,quiz);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();