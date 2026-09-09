import {contentDbRpc} from '../../test-prep-v2/content-source.js?v=2.24.1';

export const AI_WILLI_EXPLANATION_VERSION='v1';

function stable(v){
  if(v==null)return'';
  if(Array.isArray(v))return`[${v.map(stable).join(',')}]`;
  if(typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
function fnv1a(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)}return(h>>>0).toString(36)}
export function answerFingerprint(response){return fnv1a(stable(response)).slice(0,24)}

function voterKey(){
  const key='aiWilliVoterKey';
  try{
    let v=localStorage.getItem(key);
    if(!v){v=(crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`).slice(0,120);localStorage.setItem(key,v)}
    return v;
  }catch(_){return`session-${fnv1a(String(navigator?.userAgent||'browser'))}`}
}

export async function getCachedAiWilliExplanation({questionId,mode,response,rootExplanationId=null,version=AI_WILLI_EXPLANATION_VERSION}={}){
  if(!questionId||!mode)return null;
  const rows=await contentDbRpc('get_test_prep_ai_explanation',{
    p_question_id:questionId,
    p_mode:mode,
    p_answer_fingerprint:answerFingerprint(response),
    p_explanation_version:version,
    p_root_explanation_id:rootExplanationId
  });
  return Array.isArray(rows)?rows[0]||null:null;
}

export async function saveAiWilliExplanation({questionId,section,mode,response,text,rootExplanationId=null,version=AI_WILLI_EXPLANATION_VERSION}={}){
  if(!questionId||!mode||!String(text||'').trim())return null;
  const rows=await contentDbRpc('save_test_prep_ai_explanation',{
    p_question_id:questionId,
    p_section:String(section||''),
    p_mode:mode,
    p_answer_fingerprint:answerFingerprint(response),
    p_explanation_version:version,
    p_explanation_text:String(text).trim(),
    p_root_explanation_id:rootExplanationId
  });
  return Array.isArray(rows)?rows[0]||null:null;
}

export async function rateAiWilliExplanation(explanationId,helpful){
  if(!explanationId)return null;
  const rows=await contentDbRpc('rate_test_prep_ai_explanation',{
    p_explanation_id:explanationId,
    p_helpful:!!helpful,
    p_voter_key:voterKey()
  });
  return Array.isArray(rows)?rows[0]||null:null;
}
