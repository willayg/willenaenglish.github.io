import {saveActivitySnapshot,loadActivitySnapshot,clearActivitySnapshotFor} from './activity-session-store.js?v=1.0.0';

export function createActivityResume({getRoute,getState,setState,getQueue,setQueue,getResponse=()=>null,restoreResponse=()=>{}}={}){
  function save(){
    const route=getRoute?.();const state=getState?.()||{};const queue=getQueue?.()||[];
    return saveActivitySnapshot({route,queue,index:state.index,score:state.score,wrongIds:state.wrongIds,checked:state.checked,response:getResponse?.(),startedAt:state.startedAt});
  }
  function restore(route){
    const snapshot=loadActivitySnapshot(route);if(!snapshot)return false;
    setQueue?.(snapshot.queue||[]);
    setState?.({index:snapshot.index||0,score:snapshot.score||0,wrongIds:Array.isArray(snapshot.wrongIds)?snapshot.wrongIds:[],checked:!!snapshot.checked,startedAt:snapshot.startedAt||0});
    if(snapshot.response!=null)restoreResponse?.(snapshot.response,snapshot.checked);
    return true;
  }
  function clear(route=getRoute?.()){clearActivitySnapshotFor(route)}
  return{save,restore,clear};
}
