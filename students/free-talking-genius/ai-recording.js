// Free Talking alpha: explicit 60-second recording, no browser STT or live transcript.
// Cancel increments the run ID; stale async results are never added to a later question.
export function createFreeTalkingRecorder({getToken,onStatus,onTranscript,onState}){
 const maxMs=60000;
 let run=0,stream=null,recorder=null,stopTimer=null,request=null,recording=false,processing=false;
 const say=message=>onStatus?.(message);
 const status=()=>onState?.({recording,processing});
 const clearTimer=()=>{if(stopTimer!==null){clearTimeout(stopTimer);stopTimer=null}};
 const release=()=>{if(stream){for(const track of stream.getTracks())try{track.stop()}catch{}stream=null}};
 function cancel(){
  ++run;clearTimer();request?.abort();request=null;
  try{if(recorder?.state==='recording')recorder.stop()}catch{}
  recorder=null;recording=false;processing=false;release();status();
 }
 async function start(sessionId,questionId){
  if(recording||processing)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
   say('이 브라우저는 AI 녹음을 지원하지 않아요. 브라우저 방식을 사용해 주세요.');return;
  }
  cancel();
  const id=run;
  let media;
  try{media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}})}
  catch(e){if(id===run)say(e?.name==='NotAllowedError'?'마이크 권한을 허용해 주세요.':'마이크를 시작하지 못했어요.');return}
  if(id!==run){media.getTracks().forEach(t=>t.stop());return}
  stream=media;
  try{
   const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus','audio/ogg']
    .find(t=>MediaRecorder.isTypeSupported(t));
   if(!mime)throw Error('지원되는 녹음 형식이 없어요.');
   recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:48000});
   const chunks=[];
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
   recorder.onerror=()=>{if(id!==run)return;cancel();say('녹음 중 문제가 발생했어요. 다시 시도해 주세요.')};
   recorder.onstop=async()=>{
    if(id!==run)return;
    clearTimer();recording=false;processing=true;release();status();
    const audio=new Blob(chunks,{type:mime});
    if(audio.size<600){processing=false;status();say('녹음된 음성이 없어요. 다시 말해 보세요.');return}
    say('AI가 전체 답변을 받아쓰고 있어요…');
    const controller=new AbortController();
    request=controller;
    const timeout=setTimeout(()=>controller.abort(),65000);
    try{
     const data=new FormData();
     data.append('session_id',sessionId);data.append('question_id',questionId);
     data.append('audio',audio,'answer.'+(mime.includes('mp4')?'mp4':mime.includes('ogg')?'ogg':'webm'));
     const send=async token=>fetch('/api/free-talking-transcribe',{
      method:'POST',credentials:'include',
      headers:{Authorization:'Bearer '+token},
      body:data,signal:controller.signal,cache:'no-store'});
     let response=await send(await getToken());
     if(response.status===401)response=await send(await getToken(true));
     const payload=await response.json().catch(()=>null);
     if(!response.ok||payload?.success!==true)throw Error(payload?.error||'AI 음성 인식에 실패했어요.');
     const transcript=String(payload.transcript||'').trim();
     if(!transcript)throw Error('영어가 들리지 않았어요. 다시 시도해 주세요.');
     if(id!==run)return;
     onTranscript?.(transcript);
     say('받아쓰기가 끝났어요. 답변을 확인해 보세요.');
    }catch(e){
     if(id===run)say(e?.name==='AbortError'?'음성 확인 시간이 초과됐어요. 다시 시도해 주세요.':String(e?.message||e));
    }finally{
     clearTimeout(timeout);
     if(id===run){request=null;processing=false;status()}
    }
   };
   recorder.start(250);
   recording=true;processing=false;status();
   say('녹음 중 · 천천히 말하세요. 끝나면 원을 다시 누르세요. (최대 60초)');
   stopTimer=setTimeout(()=>stop(),maxMs);
  }catch(e){if(id===run){cancel();say(String(e?.message||'녹음을 시작하지 못했어요.'))}}
 }
 function stop(){
  if(!recording||!recorder)return;
  clearTimer();
  try{recorder.stop()}catch{cancel();say('녹음을 완료하지 못했어요. 다시 시도해 주세요.')}
 }
 return {start,stop,cancel,isRecording:()=>recording,isProcessing:()=>processing};
}
