// Shared student header actions. No visual assumptions.

export async function logoutStudent({redirect='/students/login.html'}={}){
  try{window.WillenaAPI?.clearLocalTokens?.()}catch{}
  try{
    if(window.WillenaAPI?.fetch){
      await window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=logout',{method:'POST'});
    }
  }catch(e){console.warn('[student-header-actions] logout request failed',e)}
  try{window.dispatchEvent(new CustomEvent('auth:changed',{detail:{loggedIn:false}}))}catch{}
  if(redirect)window.location.href=redirect;
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
