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

function vocabularyFromText(text){
  const src=String(text||''),marker='### 핵심 단어',i=src.indexOf(marker);
  if(i<0)return[];
  const rows=src.slice(i+marker.length).split('\n').map(x=>x.trim()).filter(x=>x.startsWith('- '));
  const out=[];
  for(const row of rows){
    const body=row.slice(2),parts=body.split(' — ');if(parts.length<2)continue;
    const term=String(parts.shift()||'').trim(),rest=parts.join(' — '),bits=rest.split(' · ');
    const meaning=String(bits.shift()||'').trim(),note=bits.join(' · ').trim();
    if(term&&meaning)out.push({term,meaning_ko:meaning,note_ko:note});
    if(out.length>=6)break;
  }
  return out;
}

function textWithVocabulary(text,vocabulary,mode){
  const src=String(text||'').trim();
  if(mode!=='vocab'||src.includes('### 핵심 단어')||!Array.isArray(vocabulary)||!vocabulary.length)return src;
  const lines=vocabulary.slice(0,6).map(v=>`- ${String(v?.term||'').trim()} — ${String(v?.meaning_ko||'').trim()}${String(v?.note_ko||'').trim()?` · ${String(v.note_ko).trim()}`:''}`).filter(x=>!/^\-\s+—/.test(x));
  return lines.length?`### 핵심 단어\n${lines.join('\n')}`:src;
}

function decorateRecord(record,mode){
  if(!record)return null;
  const vocabulary=Array.isArray(record.vocabulary)?record.vocabulary:[];
  return {...record,vocabulary,explanation_text:textWithVocabulary(record.explanation_text,vocabulary,mode)};
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
  return decorateRecord(Array.isArray(rows)?rows[0]||null:null,mode);
}

export async function saveAiWilliExplanation({questionId,section,mode,response,text,vocabulary=[],rootExplanationId=null,version=AI_WILLI_EXPLANATION_VERSION}={}){
  if(!questionId||!mode||!String(text||'').trim())return null;
  const vocab=Array.isArray(vocabulary)&&vocabulary.length?vocabulary:vocabularyFromText(text);
  const rows=await contentDbRpc('save_test_prep_ai_explanation',{
    p_question_id:questionId,
    p_section:String(section||''),
    p_mode:mode,
    p_answer_fingerprint:answerFingerprint(response),
    p_explanation_version:version,
    p_explanation_text:String(text).trim(),
    p_root_explanation_id:rootExplanationId,
    p_vocabulary:mode==='vocab'?vocab:[]
  });
  return decorateRecord(Array.isArray(rows)?rows[0]||null:null,mode);
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
