// Free Talking V2 is a native mounting component, not a second conversation engine.
// The V1-derived engine owns prompts, turn decisions, silence, inactivity,
// pause/resume, Android audio and server-verified review in separate files.
import {openV1NativeConversation,closeV1NativeConversation,isV1NativeConversationOpen} from './free-talking-v2-host.js?v=20261114-dusk-db-grid3';

export function createFreeTalkingV2({host,onBack,onProgress}){
 let active=false;
 function finished(){
  active=false;
  host.hidden=true;
  onProgress?.();
  onBack?.();
 }
 return {
  async open({bookId,unitId}){
   if(active)return;
   await openV1NativeConversation({
    bookId,unitId,
    header:document.querySelector('student-header'),
    onExit:finished
   });
   active=true;
  },
  close({notify=false}={}){
   if(!active&&!isV1NativeConversationOpen())return;
   active=false;
   closeV1NativeConversation({notify});
   host.hidden=true;
  },
  isOpen(){return active&&isV1NativeConversationOpen()}
 };
}
