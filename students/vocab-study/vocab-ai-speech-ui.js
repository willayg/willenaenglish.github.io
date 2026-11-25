// Word Genius optional AI speaking check. Browser STT remains the default.
// A failed network/microphone attempt never consumes one of the two AI checks.
const MAX_SECONDS=5;
const MAX_AI_CHECKS=2;
function chooseMime(){
  if(!window.MediaRecorder)return '';
  return ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus','audio/ogg'].find(type=>MediaRecorder.isTypeSupported(type))||'';
}
function toBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Could not read recording'));
    reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
    reader.readAsDataURL(blob);
  });
}
function el(tag,className,content){
  const node=document.createElement(tag);if(className)node.className=className;
  if(content!=null)node.textContent=content;return node;
}
function errorMessage(error){
  const m=String(error?.message||error||'Unknown error');
  if(/notallowed|not-allowed|permission|denied/i.test(m))return '마이크 권한을 확인해 주세요.';
  if(/notfound|not-found|device/i.test(m))return '마이크를 찾을 수 없어요.';
  if(/401|unauthorized|sign.in|session_invalid|missing_session/i.test(m))return 'AI 연결 인증 오류예요. 선생님에게 알려 주세요.';
  if(/404|not found|non-JSON/i.test(m))return 'AI 서버에 연결할 수 없어요.';
  if(/429|rate limit/i.test(m))return 'AI 요청이 너무 많아요. 잠시 후 다시 해 주세요.';
  if(/AI POST connection failed|probe_failed|offline/i.test(m))return 'AI 연결이 끊겼어요. 다시 눌러 주세요.';
  if(/502|503|500|server|network|fetch/i.test(m))return 'AI 서버 연결에 문제가 있어요.';
  if(/No audio|empty|recording failed/i.test(m))return '소리가 녹음되지 않았어요.';
  return 'AI 확인 중 문제가 생겼어요.';
}
export function attachAISpeakingFallback({host,target,isCurrent,onAccepted,match,callApi,stopBrowserSpeech}){
  if(!host?.querySelector('.speaking-control'))return{observe(){},dispose(){}};
  let misses=0,remaining=MAX_AI_CHECKS,disposed=false,declined=false,busy=false;
  let stream=null,recorder=null,timer=null,modal=null,recordButton=null,remainingLabel=null,status=null,errorDetails=null;
  let lastFocus=null;
  const alive=()=>!disposed&&isCurrent();
  function cleanup(){
    if(timer){clearTimeout(timer);timer=null}
    if(recorder?.state==='recording'){try{recorder.stop()}catch(_){}}
    recorder=null;
    if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}
  }
  function dismiss(){
    cleanup();
    modal?.remove();modal=null;recordButton=null;remainingLabel=null;status=null;errorDetails=null;
    if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
    lastFocus=null;
  }
  function dispose(){disposed=true;declined=true;dismiss()}
  function showError(error){
    const technical=String(error?.message||error||'Unknown error');
    if(status)status.textContent=errorMessage(error)+' 횟수는 줄어들지 않아요.';
    if(errorDetails){
      errorDetails.hidden=false;
      const code=/HTTP\s*\d+/i.exec(technical)?.[0]||error?.name||'AI check error';
      errorDetails.querySelector('summary').textContent='오류 정보 보기 · '+code;
      errorDetails.querySelector('code').textContent=technical.slice(0,480);
    }
    console.warn('[Word Genius] AI speaking error',technical);
  }
  function clearError(){if(errorDetails){errorDetails.hidden=true;errorDetails.open=false;errorDetails.querySelector('code').textContent=''}}
  // Match the normal QuestionRenderer round mic visually and accessibly.
  // Keep the SVG icon mounted while its recording state changes.
  function setRecordState(label,{recording=false,disabled=false}={}){
    if(!recordButton)return;
    recordButton.classList.toggle('is-listening',recording);
    recordButton.disabled=disabled;
    recordButton.setAttribute('aria-label',label);
    recordButton.title=label;
  }
  function baseModal(){
    lastFocus=document.activeElement;
    const overlay=el('div','vocab-ai-modal-backdrop');
    overlay.setAttribute('role','presentation');
    const dialog=el('section','vocab-ai-modal');
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-label','AI 윌리 발음 확인');
    const header=el('div','vocab-ai-modal-head');
    const title=el('h2','vocab-ai-modal-title','AI 윌리가 네 답을 확인해 줄까요?');
    header.append(title);dialog.append(header);
    overlay.append(dialog);document.body.append(overlay);
    modal=overlay;
    const onKey=e=>{
      if(e.key==='Escape'&&!busy){declined=true;dismiss()}
      // Keep focus inside the modal while it is visible.
      if(e.key==='Tab'&&modal){
        const focusable=[...dialog.querySelectorAll('button:not([disabled]),summary')].filter(x=>!x.hidden&&!x.closest('[hidden]'));
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    };
    overlay.addEventListener('keydown',onKey);
    return dialog;
  }
  function showRecording(){
    if(!alive()||!modal)return;
    const dialog=modal.querySelector('.vocab-ai-modal');
    dialog.replaceChildren();
    const title=el('h2','vocab-ai-modal-title','영어로 말해 보세요!');
    remainingLabel=el('p','vocab-ai-modal-remaining','AI 확인 기회 '+remaining+'번');
    recordButton=el('button','vocab-ai-record-button speaking-mic');
    recordButton.type='button';
    recordButton.append(el('span','speaking-mic-icon'));
    setRecordState('녹음 시작');
    status=el('p','vocab-ai-modal-status','녹음은 최대 5초예요.');
    errorDetails=el('details','vocab-ai-debug');
    errorDetails.hidden=true;
    errorDetails.append(el('summary','','오류 정보 보기'),el('code','',''));
    const close=el('button','vocab-ai-modal-secondary','일반 말하기로 돌아가기');
    close.type='button';
    close.addEventListener('click',()=>{if(!busy){declined=true;dismiss()}});
    recordButton.addEventListener('click',handleRecording);
    dialog.append(title,remainingLabel,recordButton,status,errorDetails,close);
    recordButton.focus();
  }
  function prompt(){
    if(!alive()||declined||modal||busy||remaining<=0)return;
    const dialog=baseModal();
    const actions=el('div','vocab-ai-modal-actions');
    const yes=el('button','vocab-ai-modal-yes','네!');
    const no=el('button','vocab-ai-modal-secondary','아니요');
    yes.type=no.type='button';
    yes.addEventListener('click',showRecording);
    no.addEventListener('click',()=>{declined=true;dismiss()});
    actions.append(yes,no);dialog.append(actions);
    yes.focus();
  }
  async function handleRecording(){
    if(!alive()||remaining<=0||!recordButton)return;
    if(recorder?.state==='recording'){try{recorder.stop()}catch(e){showError(e)}return}
    if(busy)return;
    if(!navigator.mediaDevices?.getUserMedia){showError(new Error('MediaDevices getUserMedia not supported'));return}
    const mime=chooseMime();
    if(!mime){showError(new Error('MediaRecorder MIME type not supported'));return}
    busy=true;setRecordState('마이크 연결 중',{disabled:true});clearError();
    if(status)status.textContent='마이크 연결 중…';
    try{
      stopBrowserSpeech?.();
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
      if(!alive()||!modal){cleanup();return}
      recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:32000});
      const parts=[];
      const finished=new Promise((resolve,reject)=>{
        recorder.onerror=e=>reject(new Error(e?.error?.message||'Recording failed'));
        recorder.ondataavailable=e=>{if(e.data?.size)parts.push(e.data)};
        recorder.onstop=()=>resolve(new Blob(parts,{type:mime}));
      });
      recorder.start(200);
      setRecordState('녹음 완료',{recording:true});
      if(status)status.textContent='지금 말하세요!';
      timer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},MAX_SECONDS*1000);
      const blob=await finished;
      cleanup();
      if(!alive()||!modal)return;
      setRecordState('AI 확인 중…',{disabled:true});
      if(status)status.textContent='확인하고 있어요…';
      if(blob.size<400)throw new Error('No audio detected');
      const audio_base64=await toBase64(blob);
      if(!audio_base64)throw new Error('No audio detected');
      const reply=await callApi({action:'transcribe',audio_base64,mime_type:mime});
      if(!alive()||!modal)return;
      if(reply?.success!==true||typeof reply?.transcript!=='string')throw new Error('Invalid AI response');
      const transcript=reply.transcript.trim();
      if(!transcript){if(status)status.textContent='잘 듣지 못했어요. 다시 녹음해 주세요.';return}
      // Only usable AI transcriptions consume a check.
      remaining-=1;
      const assessment=match(target,[transcript]);
      if(assessment.correct&&['exact','spacing','homophone','in_sentence','in_sentence_homophone'].includes(assessment.matchedBy)){
        if(status)status.textContent='잘했어요! ✅';
        dispose();
        onAccepted(transcript);
        return;
      }
      if(remainingLabel)remainingLabel.textContent='AI 확인 기회 '+remaining+'번';
      if(remaining>0){
        if(status)status.textContent='AI가 들은 말: “'+transcript+'” · 한 번 더!';
      }else{
        if(status)status.textContent='AI 확인 2번을 마쳤어요. 일반 말하기로 계속하세요.';
        setRecordState('AI 확인 완료',{disabled:true});
      }
    }catch(error){if(alive()&&modal)showError(error)}
    finally{
      cleanup();busy=false;
      if(alive()&&modal&&recordButton&&remaining>0){
        setRecordState('다시 녹음');
      }
    }
  }
  function observe(alternatives){
    if(!alive()||declined||remaining<=0)return;
    if(match(target,alternatives).correct){misses=0;dismiss();return}
    misses++;
    if(misses>=3)prompt();
  }
  return {observe,dispose};
}


// Third-try assistance: same mic, no modal, no background recording.
// One assisted recording per question visit; normal browser speech resumes afterward.
export function attachSilentAISpeaking({host,target,keywords,isCurrent,shouldAssist,onStart,onReady,onResult,onDiagnostic,callApi}){
  const mic=host?.querySelector('[data-speaking-mic]');
  const status=host?.querySelector('[data-speaking-status]');
  if(!mic)return {dispose(){}};
  let used=false,busy=false,disposed=false,stream=null,recorder=null,timer=null,started=0;
  const alive=()=>!disposed&&isCurrent();
  const message=(text,phase='idle')=>{if(alive()&&status){status.textContent=text;status.dataset.speechPhase=phase;}};
  function cleanup(){
    if(timer){clearTimeout(timer);timer=null;}
    if(recorder?.state==='recording'){try{recorder.stop()}catch{}}
    recorder=null;
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  }
  async function capture(){
    let context=null,analyser=null,levelTimer=null,voiced=false,lastVoice=0,peakRms=0;
    busy=true;used=true;started=Date.now();onStart?.();
    const mime=chooseMime();
    mic.disabled=true;mic.classList.add('is-starting');mic.setAttribute('aria-busy','true');
    message('잠시만요! AI 윌리가 마이크를 연결하고 있어요…','starting');
    let outcome='error',transcript='';
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
      if(!alive()){cleanup();return;}
      recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:32000});
      const parts=[];
      let readyAt=0;
      const finished=new Promise((resolve,reject)=>{
        recorder.onstart=()=>{
          if(!alive())return;
          readyAt=Date.now();
          if(timer)clearTimeout(timer);
          mic.disabled=false;mic.classList.remove('is-starting');mic.classList.add('is-listening');mic.removeAttribute('aria-busy');
          message('지금 말하세요!','listening');
          try{onReady?.({duration_ms:Math.max(0,readyAt-started),source:'recorder_start'})}catch{}
          timer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},MAX_SECONDS*1000);
        };
        recorder.ondataavailable=e=>{if(e.data?.size)parts.push(e.data)};
        recorder.onerror=e=>reject(e.error||new Error('Recording failed'));
        recorder.onstop=()=>resolve(new Blob(parts,{type:mime}));
      });
      recorder.start(100);
      // Bound startup if the recorder never emits its actual start event.
      timer=setTimeout(()=>{if(!readyAt&&recorder?.state==='recording')recorder.stop()},8000);
      // Use an available analyser to end a short utterance naturally and avoid
      // passing pure silence to a context-biased recognizer. Manual stop remains available.
      try{
        const AudioCtx=window.AudioContext||window.webkitAudioContext;
        if(AudioCtx){
          context=new AudioCtx();
          void context.resume().catch(()=>{});
          analyser=context.createAnalyser();analyser.fftSize=1024;
          context.createMediaStreamSource(stream).connect(analyser);
          const samples=new Float32Array(analyser.fftSize);
          levelTimer=setInterval(()=>{
            if(!readyAt||Date.now()-readyAt<250||context?.state!=='running'||recorder?.state!=='recording')return;
            analyser.getFloatTimeDomainData(samples);
            let power=0;for(const v of samples)power+=v*v;
            const rms=Math.sqrt(power/samples.length),now=Date.now();
            peakRms=Math.max(peakRms,rms);
            if(rms>0.004){voiced=true;lastVoice=now}
            if(voiced&&now-lastVoice>1100&&now-readyAt>1300)recorder.stop();
          },100);
        }
      }catch{}
      const blob=await finished;
      if(!readyAt){outcome='recorder_start_timeout';message('마이크를 시작하지 못했어요. 다시 시도해 주세요.');return;}
      // The analyser is a timing aid, not a reliable voice detector. Quiet
      // children and mobile audio routing can produce very low levels.
      const silence=!!analyser&&context?.state==='running'&&peakRms<0.0001;
      cleanup();
      if(!alive())return;
      mic.disabled=true;mic.classList.remove('is-listening');mic.setAttribute('aria-busy','true');
      message('AI 윌리가 확인하고 있어요…','checking');
      if(blob.size<400||silence){outcome=blob.size<400?'recording_too_small':'recording_silent';message('AI 윌리가 소리를 듣지 못했어요. 다시 말해 보세요.');return}
      const audio_base64=await toBase64(blob);
      if(!alive())return;
      const reply=await callApi({action:'transcribe',audio_base64,mime_type:mime,assisted:true,keywords:[target,...keywords]});
      if(!alive())return;
      if(reply?.success!==true||typeof reply.transcript!=='string')throw new Error('Invalid AI response');
      transcript=reply.transcript.trim();
      outcome=transcript?'result':'empty_ai_transcript';
      if(!transcript){message('AI 윌리가 잘 듣지 못했어요. 다시 말해 보세요.');return}
      message('AI 윌리가 들은 말: “'+transcript+'”');
    }catch(e){
      outcome='error';
      message(errorMessage(e)+' 일반 말하기로 다시 시도해 주세요.');
      console.warn('[Word Genius] assisted retry unavailable',e?.name||'error');
    }finally{
      if(levelTimer)clearInterval(levelTimer);
      if(context)void context.close().catch(()=>{});
      cleanup();busy=false;
      onDiagnostic?.({outcome,transcript,duration_ms:Math.min(180000,Date.now()-started)});
      if(alive()){
        mic.disabled=false;mic.classList.remove('is-starting','is-listening');mic.removeAttribute('aria-busy');
        if(transcript)onResult?.(transcript);
      }
    }
  }
  const tap=e=>{
    if(!alive())return;
    if(busy){
      e.preventDefault();e.stopImmediatePropagation();
      if(recorder?.state==='recording')try{recorder.stop()}catch{}
      return;
    }
    if(used||!shouldAssist()||!navigator.mediaDevices?.getUserMedia||!chooseMime())return;
    e.preventDefault();e.stopImmediatePropagation();
    void capture();
  };
  mic.addEventListener('click',tap,{capture:true});
  return {dispose(){disposed=true;mic.removeEventListener('click',tap,true);cleanup();}};
}
