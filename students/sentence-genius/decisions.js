// Sentence Genius Phase 4: one operational DB source for staff decisions.
// Operational Supabase authenticates teachers; students get read-only decisions.
import {staffAccessToken} from './content.js?v=sg-decisions-v4';
const REST='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const MAX_IDS=80;
export const DECISION_REVISION='4.0.0';

async function requestRpc(name,payload,{staff=false}={}){
  const invoke=token=>fetch(REST+name,{method:'POST',cache:'no-store',
    headers:{apikey:KEY,Authorization:'Bearer '+(token||KEY),
      'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let result=await invoke(staff?await staffAccessToken():KEY);
  if(staff&&result.status===401)result=await invoke(await staffAccessToken(true));
  let data=await result.json().catch(()=>({}));
  if(!result.ok||!data?.success)throw Error(String(data?.message||data?.error||
    'Sentence Genius decision service unavailable ('+result.status+')'));
  return data;
}
export async function readSentenceDecisions(occurrenceIds){
  const ids=[...new Set((occurrenceIds||[]).filter(Boolean))];
  const all=[];
  for(let n=0;n<ids.length;n+=MAX_IDS){
    const response=await requestRpc('get_sentence_genius_decisions_v1',{
      p_occurrence_ids:ids.slice(n,n+MAX_IDS)
    });
    all.push(...(Array.isArray(response.decisions)?response.decisions:[]));
  }
  return all;
}
export async function loadReviewCandidates(){
  const data=await requestRpc('get_sentence_genius_review_queue_v1',{p_limit:60},{staff:true});
  return Array.isArray(data.candidates)?data.candidates:[];
}
export async function reviewSentenceResponse({
  occurrenceId,sentenceId,bookId,unitId,canonicalText,responseText,policyVersion=0,decision
}){
  return requestRpc('review_sentence_genius_response_v1',{
    p_occurrence_id:occurrenceId,p_sentence_id:sentenceId,
    p_book_id:bookId,p_unit_id:unitId,p_canonical_text:canonicalText,
    p_response_text:responseText,p_policy_version:policyVersion,
    p_decision:decision
  },{staff:true});
}
