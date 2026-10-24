// Reuse Word Genius's mic renderer (in app), recognition matcher, optional
// AI second opinion and the identical audio prefetch/cache implementation.
import {createSpeakingAudioCache} from '/students/vocab-study/vocab-listening-cache.js';
import {attachAISpeakingFallback} from '/students/vocab-study/vocab-ai-speech-ui.js';
import {matchSpeakingTarget} from '/students/vocab-study/speaking-match.js';
import {matchFlexibleSentence,detectAlmostRight} from './flexibility.js?v=sg-flex-v2c';
const endpoint='/api/vocab-ai-speech';
async function api(body){
  const headers={'Content-Type':'application/json'};
  const token=window.WillenaAPI?.getLocalAccessToken?.();
  if(token?.length>40)headers.Authorization='Bearer '+token;
  let response=await fetch(endpoint,{method:'POST',credentials:'include',cache:'no-store',
    headers,body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
  if(response.status===401){
    const refresh=await (window.WillenaAPI?.fetch
      ?window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include'})
      :fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include'}));
    const result=await refresh.json().catch(()=>({}));
    if(refresh.ok&&result?.access_token)window.WillenaAPI?.setLocalTokens?.(result.access_token,result.refresh_token||'');
    if(refresh.ok&&result?.success){
      const token2=window.WillenaAPI?.getLocalAccessToken?.();
      if(token2?.length>40)headers.Authorization='Bearer '+token2;
      response=await fetch(endpoint,{method:'POST',credentials:'include',cache:'no-store',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
    }
  }
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.success!==true)throw Error(data.error||('Speech API HTTP '+response.status));
  return data;
}
const cache=createSpeakingAudioCache(text=>api({action:'listen',text}));
let currentAudio=null,request=0;
export function stopAudio(){
  request++;
  if(currentAudio){try{currentAudio.pause();currentAudio.currentTime=0}catch{}currentAudio=null}
  try{window.speechSynthesis?.cancel()}catch{}
}
export function prefetchAudio(sentences){cache.prefetch(sentences.map(x=>x?.en).filter(Boolean))}
export async function playModel(text){
  stopAudio();const id=request;
  try{
    const ready=await cache.get(text);if(id!==request)return;
    const audio=new Audio(ready.url);currentAudio=audio;audio.playbackRate=1;
    await audio.play();return true;
  }catch(error){
    console.warn('[Sentence Genius] Model audio unavailable; using browser TTS',error);
    if(id!==request||!window.speechSynthesis)return false;
    const voice=new SpeechSynthesisUtterance(text);
    voice.lang='en-US';voice.rate=1;voice.pitch=1;
    const voices=speechSynthesis.getVoices();
    voice.voice=voices.find(v=>/en-US/i.test(v.lang)&&/david|guy|matthew|justin|male/i.test(v.name))||null;
    try{speechSynthesis.speak(voice);return true}
    catch(error){
      console.warn('[Sentence Genius] Browser speech unavailable',error);
      return false;
    }
  }
}
// No approximate phonetic/loose plural matching for whole sentences: that
// could mark a grammatically wrong verb form correct.
export function matchSentence(target,alternatives,gradingContext={}){
  const match=matchSpeakingTarget(target,alternatives);
  if(match.correct&&['exact','spacing','homophone'].includes(match.matchedBy))return match;
  const equivalent=matchFlexibleSentence(target,alternatives,gradingContext);
  if(equivalent)return equivalent;
  const partial=detectAlmostRight(target,alternatives,gradingContext);
  return partial||{...match,correct:false};
}
export function connectSpeechSupport({host,renderer,item,isCurrent,onAccepted,onListeningAvailable}){
  let micStarts=0;
  const fallback=attachAISpeakingFallback({
    host,target:item.en,isCurrent,
    // Word Genius's shared fallback only accepts exact/spacing/homophone
    // verdict names. Adapt an accepted Sentence Genius equivalent locally;
    // never change Word Genius's global speaking match behavior.
    match:(target,transcripts)=>{
      const result=matchSentence(target,transcripts,item.gradingContext);
      return result.correct&&!['exact','spacing','homophone'].includes(result.matchedBy)
        ?{...result,matchedBy:'exact'}:result;
    },
    callApi:api,
    stopBrowserSpeech:()=>{try{renderer.speechRecognition?.stop()}catch{}},
    onAccepted:transcript=>{
      if(!isCurrent())return;
      renderer.state.speakingTranscript=transcript;
      renderer.state.speakingAlternatives=[transcript];
      renderer.emit();
      onAccepted(transcript);
    }
  });
  renderer.onSpeechResult=alternatives=>fallback.observe(alternatives);
  // Do not reveal the correct answer on the first attempted spoken response.
  const mic=host.querySelector('[data-speaking-mic]');
  mic?.addEventListener('click',()=>{stopAudio()},{capture:true});
  // Same deliberate Word Genius rule: model listening appears after two
  // genuine microphone starts, not before the student first tries speaking.
  const recognition=renderer.speechRecognition;
  recognition?.addEventListener?.('start',()=>{micStarts++});
  recognition?.addEventListener?.('end',()=>{
    if(micStarts>=2&&isCurrent())onListeningAvailable?.();
  });
  return {dispose:()=>{fallback.dispose();try{renderer.speechRecognition?.stop()}catch{}},stopAudio};
}
