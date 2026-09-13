import * as core from './mock-test.js?v=1.4.3-core';
import {mountMockTestHistory,saveMockTestSnapshot} from './mock-test-history.js?v=2.25.97';

let observer=null;
let trackingListener=null;
let saveTimer=null;
let activeContext=null;
const savedSeeds=new Set();
const inflightSeeds=new Map();

function clearWatchers(){
  observer?.disconnect();observer=null;
  if(trackingListener)window.removeEventListener('testprep:v2-tracking',trackingListener);
  trackingListener=null;
  if(saveTimer){clearTimeout(saveTimer);saveTimer=null}
  activeContext=null;
}
async function saveSubmissionWhenReady(plan,{attempts=30,delay=100}={}){
  if(!plan?.id)return null;
  for(let i=0;i<attempts;i++){
    const snapshot=core.getMockSubmission?.();
    if(snapshot?.seed&&Array.isArray(snapshot.items)&&snapshot.items.length){
      const seed=String(snapshot.seed);
      if(savedSeeds.has(seed))return snapshot;
      if(inflightSeeds.has(seed))return inflightSeeds.get(seed);
      const promise=saveMockTestSnapshot(plan.id,snapshot)
        .then(result=>{savedSeeds.add(seed);return result})
        .catch(e=>{console.warn('[mock-history] save failed',e);throw e})
        .finally(()=>inflightSeeds.delete(seed));
      inflightSeeds.set(seed,promise);
      return promise;
    }
    if(i<attempts-1)await new Promise(r=>setTimeout(r,delay));
  }
  console.warn('[mock-history] result screen appeared but submission snapshot was not ready');
  return null;
}
function queueSave(plan){
  if(saveTimer)clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{saveTimer=null;saveSubmissionWhenReady(plan).catch(()=>{})},0);
}
function watchForResults(host,plan){
  clearWatchers();activeContext={host,plan};
  observer=new MutationObserver(()=>{
    if(host?.querySelector('.mock-results'))queueSave(plan);
  });
  observer.observe(host,{childList:true,subtree:true});
  trackingListener=e=>{
    const d=e?.detail||{};
    if(d.type==='session_completed'&&d.practice_type==='mock_test')queueSave(plan);
  };
  window.addEventListener('testprep:v2-tracking',trackingListener);
}
export async function renderMockTestPreflight(args={}){
  const {host,plan}=args;
  watchForResults(host,plan);
  const paper=await core.renderMockTestPreflight(args);
  if(host?.querySelector('.mock-preflight')){
    await mountMockTestHistory({host,plan,onOpenHistory:()=>renderMockTestPreflight(args)});
  }
  return paper;
}
export const stopMockTest=(...a)=>{clearWatchers();return core.stopMockTest(...a)};
export const getMockPreviewPaper=core.getMockPreviewPaper;
export const getMockSubmission=core.getMockSubmission;
export const isMockTestActive=core.isMockTestActive;
