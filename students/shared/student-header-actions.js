// Shared student header actions. No visual assumptions.

function currentStudentReturnPath(){
  try{
    const path=`${window.location.pathname||''}${window.location.search||''}${window.location.hash||''}`;
    if(path.startsWith('/'))return path;
  }catch{}
  return '/students/dashboard-v2/';
}

export async function logoutStudent({redirect=null}={}){
  const returnPath=currentStudentReturnPath();
  try{localStorage.setItem('student_return_after_login',returnPath)}catch{}
  try{window.WillenaAPI?.clearLocalTokens?.()}catch{}
  try{
    if(window.WillenaAPI?.fetch){
      await window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=logout',{method:'POST'});
    }
  }catch(e){console.warn('[student-header-actions] logout request failed',e)}
  try{window.dispatchEvent(new CustomEvent('auth:changed',{detail:{loggedIn:false}}))}catch{}
  const destination=redirect||`/students/signin.html?next=${encodeURIComponent(returnPath)}`;
  if(destination)window.location.href=destination;
}

export function openStudentProfile(){window.location.href='/students/profile.html'}

export function setStudentMusicEnabled(enabled){
  try{
    localStorage.setItem('wa.audio.music.enabled',enabled?'1':'0');
    window.dispatchEvent(new CustomEvent('wa:audio-settings-changed',{detail:{music:!!enabled}}));
  }catch{}
}

export function getStudentMusicEnabled(){
  try{return localStorage.getItem('wa.audio.music.enabled')==='1'}catch{return false}
}
