const STORAGE_KEY='willena_level_test_v2_session';
const VERSION=1;

export const SESSION_STATUS=Object.freeze({
  CREATED:'created',
  SPEAKING_IN_PROGRESS:'speaking_in_progress',
  SPEAKING_COMPLETE:'speaking_complete',
  STUDENT_TEST_IN_PROGRESS:'student_test_in_progress',
  COMPLETE:'complete',
  ABANDONED:'abandoned'
});

export const SESSION_PHASE=Object.freeze({
  INTAKE:'intake',
  SPEAKING_HANDOFF:'speaking_handoff',
  SPEAKING:'speaking',
  STUDENT_HANDOFF:'student_handoff',
  STUDENT_TEST:'student_test',
  RESULTS:'results'
});

function now(){return new Date().toISOString();}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function uid(){
  if(globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `ltv2-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

export function createEmptySession(){
  const stamp=now();
  return {
    version:VERSION,
    id:uid(),
    mode:'face_to_face',
    status:SESSION_STATUS.CREATED,
    phase:SESSION_PHASE.INTAKE,
    actor:'teacher',
    visitor:null,
    speaking:{
      evidence:[],
      app_recommendation:null,
      app_confidence:null,
      teacher_level:null,
      teacher_level_cap:null,
      teacher_notes:null,
      recordings:[]
    },
    calibration:{
      recommended_start_level:null,
      teacher_selected_start_level:null,
      teacher_level_cap:null
    },
    computerized:{
      current_skill:null,
      current_item_id:null,
      attempts:[],
      skill_state:{},
      started_at:null,
      completed_at:null
    },
    results:{
      skill_levels:{},
      overall_level:null
    },
    handoff:{
      teacher_ready:false,
      student_ready:false,
      handed_off_at:null
    },
    created_at:stamp,
    updated_at:stamp,
    completed_at:null,
    abandoned_at:null
  };
}

function sanitize(raw){
  if(!raw||typeof raw!=='object'||raw.version!==VERSION||!raw.id) return null;
  const base=createEmptySession();
  return {
    ...base,
    ...raw,
    speaking:{...base.speaking,...(raw.speaking||{})},
    calibration:{...base.calibration,...(raw.calibration||{})},
    computerized:{...base.computerized,...(raw.computerized||{}),skill_state:{...(raw.computerized?.skill_state||{})},attempts:Array.isArray(raw.computerized?.attempts)?raw.computerized.attempts:[]},
    results:{...base.results,...(raw.results||{}),skill_levels:{...(raw.results?.skill_levels||{})}},
    handoff:{...base.handoff,...(raw.handoff||{})}
  };
}

export function loadAssessmentSession(){
  try{return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY)));}
  catch{return null;}
}

export function saveAssessmentSession(session){
  const clean=sanitize({...session,updated_at:now()});
  if(!clean) throw new Error('Invalid Level Test v2 session');
  localStorage.setItem(STORAGE_KEY,JSON.stringify(clean));
  return clone(clean);
}

export function clearAssessmentSession(){localStorage.removeItem(STORAGE_KEY);}

export function createAssessmentSession(visitor){
  const session=createEmptySession();
  session.visitor=clone(visitor);
  session.status=SESSION_STATUS.SPEAKING_IN_PROGRESS;
  session.phase=SESSION_PHASE.SPEAKING_HANDOFF;
  session.actor='teacher';
  return saveAssessmentSession(session);
}

export function updateAssessmentSession(session,patch={}){
  return saveAssessmentSession({...session,...clone(patch)});
}

export function setSessionPhase(session,{phase,status=session.status,actor=session.actor}={}){
  return saveAssessmentSession({...session,phase,status,actor});
}

export function beginSpeaking(session){
  return setSessionPhase(session,{phase:SESSION_PHASE.SPEAKING,status:SESSION_STATUS.SPEAKING_IN_PROGRESS,actor:'teacher'});
}

export function markSpeakingComplete(session){
  return setSessionPhase(session,{phase:SESSION_PHASE.STUDENT_HANDOFF,status:SESSION_STATUS.SPEAKING_COMPLETE,actor:'teacher'});
}

export function handoffToStudent(session){
  return saveAssessmentSession({
    ...session,
    phase:SESSION_PHASE.STUDENT_TEST,
    status:SESSION_STATUS.STUDENT_TEST_IN_PROGRESS,
    actor:'student',
    handoff:{...(session.handoff||{}),teacher_ready:true,student_ready:true,handed_off_at:now()},
    computerized:{...(session.computerized||{}),started_at:session.computerized?.started_at||now()}
  });
}

export function completeAssessmentSession(session){
  const stamp=now();
  return saveAssessmentSession({...session,phase:SESSION_PHASE.RESULTS,status:SESSION_STATUS.COMPLETE,actor:'teacher',completed_at:stamp,computerized:{...(session.computerized||{}),completed_at:session.computerized?.completed_at||stamp}});
}

export function abandonAssessmentSession(session){
  return saveAssessmentSession({...session,status:SESSION_STATUS.ABANDONED,abandoned_at:now()});
}

export function isResumableSession(session){
  return Boolean(session&&session.status!==SESSION_STATUS.COMPLETE&&session.status!==SESSION_STATUS.ABANDONED);
}

export function getSessionStorageKey(){return STORAGE_KEY;}
