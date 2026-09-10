import {contentDbRpc} from '../../test-prep-v2/content-source.js?v=2.24.1';

export const AI_WILLI_EXPLANATION_VERSION='v3';

function stable(v){
  if(v==null)return'';
  if(Array.isArray(v))return`[${v.map(stable).join(',')}]`;
  if(typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

export function answerFingerprint(response){
  if(Array.isArray(response)){
    return response
      .map(v=>String(v??'').trim())
      .filter(Boolean)
      .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}))
      .join(',');
  }
  if(response==null)return'';
  if(typeof response==='string'||typeof response==='number')return String(response).trim();
  return stable(response);
}

function voterKey(){
  const key='aiWilliVoterKey';
  try{
    let v=localStorage.getItem(key);
    if(!v){v=(crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`).slice(0,120);localStorage.setItem(key,v)}
    return v;
  }catch(_){return`session-${String(navigator?.userAgent||'browser').slice(0,80)}`}
}

function decorateRecord(record){
  if(!record)return null;
  return {...record,vocabulary:Array.isArray(record.vocabulary)?record.vocabulary:[]};
}

export async function getCachedAiWilliExplanation({questionId,mode,response,rootExplanationId=null,version=AI_WILLI_EXPLANATION_VERSION}={}){
  if(!questionId||!mode)return null;
  const isVocab=mode==='vocab';
  const rows=await contentDbRpc('get_test_prep_ai_explanation',{
    p_question_id:questionId,
    p_mode:mode,
    p_answer_fingerprint:isVocab?'':answerFingerprint(response),
    p_explanation_version:version,
    p_root_explanation_id:isVocab?null:rootExplanationId
  });
  return decorateRecord(Array.isArray(rows)?rows[0]||null:null);
}

export async function saveAiWilliExplanation({questionId,section,mode,response,text,vocabulary=[],rootExplanationId=null,version=AI_WILLI_EXPLANATION_VERSION}={}){
  if(!questionId||!mode||!String(text||'').trim())return null;
  const isVocab=mode==='vocab';
  const rows=await contentDbRpc('save_test_prep_ai_explanation',{
    p_question_id:questionId,
    p_section:String(section||''),
    p_mode:mode,
    p_answer_fingerprint:isVocab?'':answerFingerprint(response),
    p_explanation_version:version,
    p_explanation_text:String(text).trim(),
    p_root_explanation_id:isVocab?null:rootExplanationId,
    p_vocabulary:isVocab&&Array.isArray(vocabulary)?vocabulary:[]
  });
  return decorateRecord(Array.isArray(rows)?rows[0]||null:null);
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
