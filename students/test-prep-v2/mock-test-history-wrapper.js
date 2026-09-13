import * as core from './mock-test.js?v=1.4.3-core';
import {mountMockTestHistory,saveMockTestSnapshot} from './mock-test-history.js?v=2.25.97';

let observer=null;
function watchForResults(host,plan,onBack){
  observer?.disconnect();
  observer=new MutationObserver(()=>{
    if(!host?.querySelector('.mock-results'))return;
    const snapshot=core.getMockSubmission?.();
    if(snapshot?.seed&&plan?.id){
      saveMockTestSnapshot(plan.id,snapshot).catch(e=>console.warn('[mock-history] save failed',e));
    }
  });
  observer.observe(host,{childList:true,subtree:true});
}
export async function renderMockTestPreflight(args={}){
  const {host,plan}=args;
  watchForResults(host,plan,args.onBack);
  const paper=await core.renderMockTestPreflight(args);
  if(host?.querySelector('.mock-preflight')){
    await mountMockTestHistory({host,plan,onOpenHistory:()=>renderMockTestPreflight(args)});
  }
  return paper;
}
export const stopMockTest=(...a)=>{observer?.disconnect();observer=null;return core.stopMockTest(...a)};
export const getMockPreviewPaper=core.getMockPreviewPaper;
export const getMockSubmission=core.getMockSubmission;
export const isMockTestActive=core.isMockTestActive;
