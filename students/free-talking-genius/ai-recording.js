// Free Talking alpha: explicit 30-second recording, no browser STT or live transcript.
// Cancel increments the run ID; stale async results are never added to a later question.
export function createFreeTalkingRecorder({getToken,onStatus,onTranscript,onState,onProgress,onQuiet}){
 const maxMs=30000;
 const silenceMs=3000;
 const startGraceMs=6500;
 let run=0,stream=null,recorder=null,stopTimer=null,request=null,starting=false,recording=false,processing=false;
 let audioContext=null,audioSource=null,analyser=null,voiceTimer=null,progressTimer=null;
 let preparing=null;
 const say=message=>onStatus?.(message);
 const status=()=>onState?.({recording,processing:starting||processing});
 const clearTimer=()=>{if(stopTimer!==null){clearTimeout(stopTimer);stopTimer=null}if(progressTimer!==null){clearInterval(progressTimer);progressTimer=null}};
 function stopVoiceMonitor(){
  if(voiceTimer!==null){clearInterval(voiceTimer);voiceTimer=null}
  try{audioSource?.disconnect()}catch{}
  audioSource=null;analyser=null;
  const old=audioContext;audioContext=null;
  if(old&&old.state!=='closed')void old.close().catch(()=>{});
 }
 function monitorVoice(id){
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass||!stream)return; // Manual Stop and 60s cap still work.
  try{
   audioContext=new AudioContextClass();
   audioSource=audioContext.createMediaStreamSource(stream);
   analyser=audioContext.createAnalyser();
   analyser.fftSize=2048;
   audioSource.connect(analyser);
   const samples=new Float32Array(analyser.fftSize);
   let startedAt=performance.now(),lastSpeechAt=startedAt,heardSpeech=false;
   let noiseFloor=0.003,aboveCount=0;
   if(audioContext.state==='suspended')void audioContext.resume().catch(()=>{});
   voiceTimer=setInterval(()=>{
    if(id!==run||!recording||!analyser)return;
    analyser.getFloatTimeDomainData(samples);
    let sum=0,peak=0;
    for(let i=0;i<samples.length;i++){
     const v=samples[i];sum+=v*v;peak=Math.max(peak,Math.abs(v));
    }
    const rms=Math.sqrt(sum/samples.length);
    // Calibrate to background hum, but keep a low absolute floor for quiet voices.
    const speech=rms>Math.max(0.010,noiseFloor*2.5)&&peak>0.026;
    if(!speech)noiseFloor=0.985*noiseFloor+0.015*Math.min(rms,0.02);
    if(speech){
     aboveCount++;
     if(aboveCount>=2){heardSpeech=true;lastSpeechAt=performance.now()}
    }else aboveCount=0;
    const now=performance.now();
    if(heardSpeech&&now-lastSpeechAt>=silenceMs){
     say('3초 동안 말소리가 없어 녹음을 마쳤어요. AI가 확인할게요.');
     stop();
    }else if(!heardSpeech&&now-startedAt>=startGraceMs){
     // Do not upload empty microphone recordings.
     cancel();say('목소리가 잘 안 들려요. 조금 더 크게 말해 볼까요?');onQuiet?.();
    }
   },120);
  }catch(error){
   console.warn('[Free Talking] Silence monitor unavailable, manual stop remains',error);
   stopVoiceMonitor();
  }
 }
 const release=()=>{if(stream){for(const track of stream.getTracks())try{track.stop()}catch{}stream=null}};
 function cancel(){
  ++run;clearTimer();stopVoiceMonitor();request?.abort();request=null;
  preparing=null;
  try{if(recorder?.state==='recording')recorder.stop()}catch{}
  recorder=null;starting=false;recording=false;processing=false;release();onProgress?.(0);status();
 }
 // Pre-arm the microphone when AI mode is selected, so the first spoken
 // syllable is not lost while Android opens a microphone on the actual Speak tap.
 // No audio is recorded or uploaded until start() is explicitly pressed.
 async function prepare(){
  if(recording||processing)return false;
  if(stream?.active&&stream.getAudioTracks().some(t=>t.readyState==='live'))return true;
  if(preparing)return preparing;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
   say('이 브라우저는 AI 녹음을 지원하지 않아요.');return false;
  }
  const id=run;
  say('마이크 준비 중…');
  preparing=(async()=>{
   try{
    const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
    if(id!==run){media.getTracks().forEach(t=>t.stop());return false}
    stream=media;
    say('마이크 준비 완료 · 원을 누르면 바로 녹음해요.');
    return true;
   }catch(e){
    if(id===run)say(e?.name==='NotAllowedError'?'마이크 권한을 허용해 주세요.':'마이크를 준비하지 못했어요.');
    return false;
   }finally{if(id===run)preparing=null}
  })();
  return preparing;
 }
 async function start(sessionId,questionId,purpose='answer'){
  if(starting||recording||processing)return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
   say('이 브라우저는 AI 녹음을 지원하지 않아요. 브라우저 방식을 사용해 주세요.');return;
  }
  const id=run;
  starting=true;status();
  if(!(stream?.active&&stream.getAudioTracks().some(t=>t.readyState==='live'))){
   // Only the first use should need this fallback. prepare() normally runs on toggle.
   if(!(await prepare())||id!==run){starting=false;status();return}
  }
  if(id!==run){starting=false;status();return}
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
    clearTimer();stopVoiceMonitor();recording=false;processing=true;release();status();
    const audio=new Blob(chunks,{type:mime});
    if(audio.size<600){processing=false;status();say('목소리가 잘 안 들려요. 조금 더 크게 말해 볼까요?');onQuiet?.();return}
    say('AI가 전체 답변을 받아쓰고 있어요…');
    const controller=new AbortController();
    request=controller;
    const timeout=setTimeout(()=>controller.abort(),65000);
    try{
     const data=new FormData();
     data.append('session_id',sessionId);data.append('question_id',questionId);
     data.append('purpose',purpose);
     data.append('audio',audio,'answer.'+(mime.includes('mp4')?'mp4':mime.includes('ogg')?'ogg':'webm'));
     const send=async token=>fetch('/api/free-talking-transcribe',{
      method:'POST',credentials:'include',
      headers:{Authorization:'Bearer '+token},
      body:data,signal:controller.signal,cache:'no-store'});
     let response=await send(await getToken());
     if(response.status===401)response=await send(await getToken(true));
     const payload=await response.json().catch(()=>null);
     if(!response.ok||payload?.success!==true){
      if(payload?.error_code==='QUIET_AUDIO'){
       if(id===run){say('목소리가 잘 안 들려요. 조금 더 크게 말해 볼까요?');onQuiet?.()}
       return;
      }
      throw Error(payload?.error||'AI 음성 인식에 실패했어요.');
     }
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
   starting=false;recording=true;processing=false;status();
   say('녹음 중 · 천천히 말하세요. 끝나면 원을 다시 누르세요. (최대 30초)');
   const recordStartedAt=performance.now();
   onProgress?.(0);
   progressTimer=setInterval(()=>onProgress?.(Math.min(1,(performance.now()-recordStartedAt)/maxMs)),100);
   stopTimer=setTimeout(()=>stop(),maxMs);
   monitorVoice(id);
  }catch(e){if(id===run){cancel();say(String(e?.message||'녹음을 시작하지 못했어요.'))}}
 }
 function stop(){
  if(!recording||!recorder)return;
  clearTimer();stopVoiceMonitor();
  recording=false;processing=true;status();
  try{recorder.stop()}catch{cancel();say('녹음을 완료하지 못했어요. 다시 시도해 주세요.')}
 }
 return {prepare,start,stop,cancel,isReady:()=>Boolean(stream?.active&&stream.getAudioTracks().some(t=>t.readyState==='live')),isRecording:()=>recording,isProcessing:()=>starting||processing};
}
