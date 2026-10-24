// Sentence Genius Phase 3: selective semantic evaluation through existing AI Willi.
// No Word Genius or shared QuestionRenderer grading behavior is changed.
import {gradeWithAiWilli} from '/students/shared/ai-willi.js?v=1.0.3';
import {normalizeFlexibleText} from './flexibility.js?v=sg-flex-v2.2';

export const AI_GRADING_REVISION='3.0.0';
const CACHE_KEY='willena-sentence-genius-ai-decisions-v3';
const BUDGET_KEY='willena-sentence-genius-ai-budget-v3';
const CACHE_TTL=30*24*60*60*1000;
const MAX_CACHE=200;
const MAX_CALLS_PER_HOUR=25;
const MAX_CALLS_PER_SESSION=10;
let sessionCalls=0;
const pending=new Map();

function safeLocalGet(key){
  try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
}
function safeLocalSet(key,value){
  try{localStorage.setItem(key,JSON.stringify(value))}catch{}
}
function normalize(value){return normalizeFlexibleText(value)}
function isRepetitive(phrase,target){
  if(phrase===normalize(target))return false;
  const words=phrase.split(' ').filter(Boolean);
  return words.length>=3&&new Set(words).size===1;
}
// "Unusable" is a very narrow gate, never a semantic judgment.
// A real short or wrong English sentence must still reach the grader.
export function unusableTranscript(transcript,target=''){
  const text=normalize(transcript);
  if(!text||text.length>240||!/[a-z]/.test(text))return true;
  if(/^(?:um|uh|er|erm|hmm|blah|la|ah|eh|okay|noise)(?:\s+(?:um|uh|er|erm|hmm|blah|la|ah|eh|okay|noise))*$/.test(text))return true;
  if(isRepetitive(text,target))return true;
  return false;
}
export function usableAlternatives(transcripts,target){
  const options=(Array.isArray(transcripts)?transcripts:[transcripts])
    .map(x=>String(x??'').trim()).filter(Boolean);
  return options.filter(option=>!unusableTranscript(option,target));
}
function scope(item){
  const p=item?.gradingContext||{};
  return JSON.stringify([
    AI_GRADING_REVISION,p.bookId||'',p.unitId||'',p.occurrenceId||item?.occurrenceId||'',
    p.policyVersion||0,p.mode||'flexible',p.requiredPatternId||'',
    p.contractionPolicy||'',(p.unitGrammar||[]).slice(0,20),
    String(item?.ko||''),normalize(item?.en||'')
  ]);
}
async function fingerprint(value){
  if(!globalThis.crypto?.subtle)return null;
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
function cached(key){
  if(!key)return null;
  const rows=safeLocalGet(CACHE_KEY);
  const row=rows&&typeof rows==='object'&&!Array.isArray(rows)?rows[key]:null;
  if(!row||typeof row.correct!=='boolean'||!Number.isFinite(row.at)||Date.now()-row.at>CACHE_TTL)return null;
  return {correct:row.correct,matchedBy:'ai_cached',reason:row.reason||'',reasonCode:row.reasonCode||'',
    explanationKo:row.explanationKo||'',aiSource:'cached'};
}
function putCache(key,result){
  if(!key)return;
  const old=safeLocalGet(CACHE_KEY);
  const rows=old&&typeof old==='object'&&!Array.isArray(old)?old:{};
  rows[key]={correct:!!result.correct,reason:String(result.reason||'').slice(0,160),
    reasonCode:String(result.reasonCode||'').slice(0,80),
    explanationKo:String(result.explanationKo||'').slice(0,240),at:Date.now()};
  const valid=Object.entries(rows).filter(([,row])=>row&&Number.isFinite(row.at)
    &&Date.now()-row.at<CACHE_TTL).sort((a,b)=>b[1].at-a[1].at).slice(0,MAX_CACHE);
  safeLocalSet(CACHE_KEY,Object.fromEntries(valid));
}
function reserveCall(){
  if(sessionCalls>=MAX_CALLS_PER_SESSION)return false;
  const now=Date.now(),past=safeLocalGet(BUDGET_KEY);
  const ticks=(Array.isArray(past)?past:[]).filter(t=>Number.isFinite(t)&&now-t<3600000);
  if(ticks.length>=MAX_CALLS_PER_HOUR)return false;
  ticks.push(now);safeLocalSet(BUDGET_KEY,ticks);sessionCalls++;
  return true;
}
function gradingPolicy(item,subjectClue){
  const p=item?.gradingContext||{};
  const strict=p.mode==='require_pattern';
  const required=String(p.requiredPatternName||p.requiredPatternId||'').slice(0,130);
  const targetSubject=subjectClue&&subjectClue.source==='omitted_first_person_subject'
    ?String(subjectClue.word||'').toLowerCase():'';
  const semanticRule=[
    'Evaluate an English sentence spoken in response to the Korean prompt.',
    'The model sentence is a reference for the intended meaning, not required wording.',
    'Accept fully grammatical natural alternatives with the same intent, tense, polarity, question/statement function and factual meaning.',
    'Do not allow missing articles, plural agreement, wrong verb forms, incomplete or nonsensical utterances.',
    'If the Korean prompt omits its subject but the app provides an explicit first-person subject clue, require that subject and reject I/we substitutions.',
    'Respect textbook grammar requirements if a published policy declares them.',
    'Never accept a change in who is performing the action when a subject is specified.',
    strict?('Required textbook pattern: '+required+'. The student MUST demonstrate this grammar structure.'):'',
    p.contractionPolicy==='exact_only'?'Preserve any required exact contraction form.':'',
    targetSubject?('Visible student clue requires the subject "'+targetSubject+'".'):'',
    'If the student response is understandable but ungrammatical, mark incorrect; deterministic Almost Right classification happens separately.'
  ].filter(Boolean).join(' ');
  return {version:'sg-semantic-v3',family:'translation',semanticRule,
    constraints:{requiredExpressions:[],requiredWords:[],noContractions:p.contractionPolicy==='exact_only'}};
}
export async function gradeUnfamiliarSentence(item,transcript,{subjectClue=null}={}){
  const p=item?.gradingContext||{};
  if(!String(item?.en||'').trim()||!String(item?.ko||'').trim())
    return{unavailable:true,reasonCode:'missing_context'};
  if(p.mode==='exact_text')return{correct:false,matchedBy:'strict_exact'};
  if(unusableTranscript(transcript,item.en))return{unusable:true,correct:false,matchedBy:'unusable_stt'};
  const response=String(transcript).trim(),scopeData=scope(item);
  const key=await fingerprint(scopeData+'|'+normalize(response)+
    '|'+(subjectClue?.word||''));
  const fromCache=cached(key);
  if(fromCache)return fromCache;
  if(key&&pending.has(key))return pending.get(key);
  if(!reserveCall())return{unavailable:true,reasonCode:'ai_budget_exhausted'};
  const job=(async()=>{
    try{
      const question={
        id:'sg-'+String(item.id||item.occurrenceId||''),
        form:'write',prompt:String(item.ko||''),
        answer:[String(item.en||'')],
        tracking:{questionType:'translation'},
        context:{
          reference_english:String(item.en||''),
          textbook_grammar:(p.unitGrammar||[]).slice(0,16),
          required_pattern:p.mode==='require_pattern'?p.requiredPatternName||p.requiredPatternId:null,
          shown_subject_clue:subjectClue?.source==='omitted_first_person_subject'?subjectClue.word:null
        }
      };
      const verdict=await gradeWithAiWilli(question,response,gradingPolicy(item,subjectClue));
      const result={correct:verdict.correct===true,matchedBy:'ai',
        reason:verdict.reason||'',reasonCode:verdict.reasonCode||'',
        explanationKo:verdict.explanationKo||'',aiSource:'live'};
      putCache(key,result);
      return result;
    }catch(error){
      console.warn('[Sentence Genius] AI Willi unavailable',error?.message||error);
      return{unavailable:true,reasonCode:'ai_service_unavailable'};
    }finally{if(key)pending.delete(key)}
  })();
  if(key)pending.set(key,job);
  return job;
}
export function aiUsageDiagnostics(){
  const now=Date.now(),prev=safeLocalGet(BUDGET_KEY);
  return{sessionCalls,hourCalls:(Array.isArray(prev)?prev:[])
    .filter(t=>Number.isFinite(t)&&now-t<3600000).length,
    maxSession:MAX_CALLS_PER_SESSION,maxHour:MAX_CALLS_PER_HOUR};
}
