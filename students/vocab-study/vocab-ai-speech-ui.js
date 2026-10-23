// Optional AI check for difficult speaking words. Never uploads during ordinary browser STT.
const MAX_SECONDS=5;
function chooseMime(){
  if(!window.MediaRecorder)return'';
  return ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus','audio/ogg'].find(t=>MediaRecorder.isTypeSupported(t))||'';
}
function toBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Could not read recording'));
    reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
    reader.readAsDataURL(blob);
  });
}
export function attachAISpeakingFallback({host,target,isCurrent,onAccepted,match,callApi}){
  const control=host?.querySelector('.speaking-control');
  if(!control)return{observe(){},dispose(){}};
  const btn=document.createElement('button');
  btn.type='button';btn.className='vocab-ai-check-button';btn.hidden=true;
  btn.textContent='✨ AI Check · AI 발음 확인';
  const panel=document.createElement('div');panel.className='vocab-ai-check-panel';panel.hidden=true;
  const info=document.createElement('div');info.className='vocab-ai-check-text';
  info.textContent='짧게 녹음해 AI로 확인해요. 선택 사항이며 학원 서버에 녹음 파일을 저장하지 않습니다.';
  const record=document.createElement('button');record.type='button';
  record.className='vocab-ai-record-button';record.textContent='🎙️ Record · 녹음 시작';
  const note=document.createElement('div');note.className='vocab-ai-check-note';note.setAttribute('role','status');
  const close=document.createElement('button');close.type='button';close.className='vocab-ai-close';close.textContent='취소 / Cancel';
  panel.append(info,record,note,close);
  control.append(btn,panel);
  let misses=0,recorder=null,stream=null,timer=null,busy=false,disposed=false,remaining=2;
  const alive=()=>!disposed&&isCurrent();
  function cleanup(){
    if(timer){clearTimeout(timer);timer=null}
    if(recorder&&recorder.state==='recording'){try{recorder.stop()}catch(_){}}
    recorder=null;
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  }
  function dispose(){disposed=true;cleanup();panel.hidden=true;btn.hidden=true}
  function observe(alternatives){
    if(!alive())return;
    if(match(target,alternatives).correct){misses=0;btn.hidden=true;panel.hidden=true;return}
    misses+=1;
    if(misses>=3&&!busy&&remaining>0)btn.hidden=false;
  }
  btn.addEventListener('click',()=>{
    if(!alive()||busy)return;
    panel.hidden=!panel.hidden;
    btn.setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden)note.textContent='마이크를 누르고 단어를 말해 주세요. 최대 5초.';
  });
  close.addEventListener('click',()=>{if(!busy){panel.hidden=true;btn.setAttribute('aria-expanded','false')}});
  record.addEventListener('click',async()=>{
    if(!alive()||remaining<=0)return;
    if(recorder?.state==='recording'){recorder.stop();return}
    if(busy||!navigator.mediaDevices?.getUserMedia)return;
    if(!chooseMime()){note.textContent='이 브라우저에서는 녹음을 지원하지 않습니다.';return}
    busy=true;btn.hidden=true;record.disabled=true;
    note.textContent='마이크 연결 중…';
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
      if(!alive()){cleanup();return}
      const mime=chooseMime();
      recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:32000});
      const parts=[];
      const finished=new Promise((resolve,reject)=>{
        recorder.onerror=()=>reject(new Error('Recording failed'));
        recorder.ondataavailable=e=>{if(e.data?.size)parts.push(e.data)};
        recorder.onstop=()=>resolve(new Blob(parts,{type:mime}));
      });
      recorder.start(200);
      record.textContent='■ Stop & check · 녹음 완료';
      record.disabled=false;
      note.textContent='말하세요! 녹음 후 AI로 확인합니다.';
      timer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},MAX_SECONDS*1000);
      const blob=await finished;
      cleanup();
      if(!alive())return;
      record.disabled=true;
      record.textContent='AI 확인 중…';
      note.textContent='음성을 분석하고 있어요…';
      remaining-=1;
      const audio_base64=await toBase64(blob);
      if(!audio_base64||blob.size<400)throw new Error('No audio detected');
      const reply=await callApi({action:'transcribe',audio_base64,mime_type:mime});
      if(!alive())return;
      const transcript=String(reply?.transcript||'').trim();
      if(transcript && match(target,[transcript]).correct){
        note.textContent='AI가 발음을 확인했어요! ✅';
        dispose();onAccepted(transcript);
        return;
      }
      const heard=transcript?'AI가 들은 말: “'+transcript+'”':'AI가 음성을 정확히 듣지 못했어요.';
      note.textContent=heard+' 다시 연습하거나 녹음해 보세요.';
      record.textContent='🎙️ Record again · 다시 녹음';
    }catch(error){
      if(alive())note.textContent='AI 확인을 사용할 수 없어요. 일반 말하기를 계속하세요.';
      console.warn('[Vocab Study] optional AI speaking check failed',error?.message||error);
    }finally{
      cleanup();busy=false;
      if(alive()){
        record.disabled=remaining<=0;
        if(record.textContent==='AI 확인 중…'||record.textContent==='■ Stop & check · 녹음 완료')record.textContent='🎙️ Record again · 다시 녹음';
        if(remaining<=0){record.textContent='AI 재확인 횟수 완료';btn.hidden=true}
        else if(misses>=3)btn.hidden=false;
      }
    }
  });
  return{observe,dispose};
}
