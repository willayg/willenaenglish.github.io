// Canonical cross-app student accessibility settings.
// New student apps should use these helpers instead of app-specific localStorage keys/events.

export const STUDENT_BIG_TEXT_KEY='willena-student-big-text';
export const STUDENT_BIG_TEXT_EVENT='willena:student-big-text';
const LEGACY_TEST_PREP_BIG_TEXT_KEY='willena-testprep-big-text';

export function bigTextEnabled(){
  try{
    const shared=localStorage.getItem(STUDENT_BIG_TEXT_KEY);
    if(shared!=null)return shared==='1';
    const legacy=localStorage.getItem(LEGACY_TEST_PREP_BIG_TEXT_KEY);
    if(legacy!=null){
      localStorage.setItem(STUDENT_BIG_TEXT_KEY,legacy);
      return legacy==='1';
    }
  }catch{}
  return false;
}

export function setBigTextEnabled(enabled){
  const on=!!enabled;
  try{
    localStorage.setItem(STUDENT_BIG_TEXT_KEY,on?'1':'0');
    // Keep the old Test Prep key mirrored during migration so older pages remain compatible.
    localStorage.setItem(LEGACY_TEST_PREP_BIG_TEXT_KEY,on?'1':'0');
  }catch{}
  window.dispatchEvent(new CustomEvent(STUDENT_BIG_TEXT_EVENT,{detail:{enabled:on}}));
  return on;
}

export function subscribeBigText(listener,{immediate=false}={}){
  if(typeof listener!=='function')return()=>{};
  const handler=event=>listener(!!event?.detail?.enabled,event);
  window.addEventListener(STUDENT_BIG_TEXT_EVENT,handler);
  if(immediate)listener(bigTextEnabled(),null);
  return()=>window.removeEventListener(STUDENT_BIG_TEXT_EVENT,handler);
}
