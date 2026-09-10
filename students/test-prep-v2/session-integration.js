import {saveActivitySnapshot,loadActivitySnapshot,clearActivitySnapshotFor} from './activity-session-store.js?v=1.0.0';

export function restorePracticeSession(route){return loadActivitySnapshot(route)}

export function savePracticeSession({route,state,queue,response=null}={}){
  return saveActivitySnapshot({route,queue,index:state?.index,score:state?.score,wrongIds:state?.wrongIds,checked:state?.checked,response,startedAt:state?.startedAt});
}

export function clearPracticeSession(route){clearActivitySnapshotFor(route)}
