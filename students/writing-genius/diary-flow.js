import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20261023-speaking-ai1';
const $=id=>document.getElementById(id);
const norm=s=>String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9']/g,' ').replace(/\s+/g,' ').trim();
const split=s=>(String(s||'').match(/[^.!?\n]+[.!?]+(?=\s|$)/g)||[]).map(x=>x.trim()).filter(x=>/[a-z]/i.test(x));
// Speech transcripts write times differently from lesson text (11am vs 11:00 a.m.).
// Canonicalize common clock readings before word-level edit-distance scoring.
function speechWords(value){
 let s=String(value||'').toLowerCase().replace(/[’‘]/g,"'");
 s=s.replace(/\b(\d{1,2})(?::(00))?\s*(a\s*\.?\s*m\.?|p\s*\.?\s*m\.?)\b/g,(_,hour,_zero,period)=>hour+' '+period.replace(/[^apm]/g,''));
 s=s.replace(/\b(\d{1,2}):00\b/g,'$1');
 s=s.replace(/\b(\d{1,2})\s*o['’]?clock\b/g,'$1');
 const numbers={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12'};
 s=s.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,word=>numbers[word]);
 return s.replace(/\b([ap])\s+m\b/g,'$1m').replace(/\b(\d{1,2})(am|pm)\b/g,'$1 $2').replace(/[^a-z0-9']/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
}
// Classroom speaking judge, not a verbatim spelling test.
// Soft costs allow minor grammar/STT differences while preserving word order and meaning.
function spokenAccuracy(expected,heard){
 const a=speechWords(expected),b=speechWords(heard);
 if(!a.length||!b.length)return 0;
 const critical=w=>/^[0-9]+$/.test(w)||/^(am|pm|not|never|no)$/.test(w);
 const soft=w=>/^(a|an|the|to|of|at|in|on|and|is|are|was|were|it|i)$/.test(w);
 const match=(x,y)=>{
  if(x===y)return 0;
  if(critical(x)||critical(y))return 1;
  const stem=w=>w.replace(/(ing|ed|es|s)$/,'');
  if(x.length>=4&&y.length>=4&&stem(x)===stem(y))return .14;
  // A single transcription-letter error should not count like a different word.
  if(x.length>=5&&y.length>=5&&Math.abs(x.length-y.length)<=1){
   let i=0,j=0,d=0;
   while(i<x.length&&j<y.length&&d<2){
    if(x[i]===y[j]){i++;j++;continue}
    d++;
    if(x.length>y.length)i++;else if(y.length>x.length)j++;else{i++;j++}
   }
   if(d+Math.max(x.length-i,y.length-j)<=1)return .22;
  }
  return soft(x)||soft(y)?.38:.65;
 };
 const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=1;i<=a.length;i++)dp[i][0]=dp[i-1][0]+(critical(a[i-1])?1:soft(a[i-1])?.3:.65);
 for(let j=1;j<=b.length;j++)dp[0][j]=dp[0][j-1]+(critical(b[j-1])?1:soft(b[j-1])?.25:.45);
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  dp[i][j]=Math.min(
   dp[i-1][j]+(critical(a[i-1])?1:soft(a[i-1])?.3:.65),
   dp[i][j-1]+(critical(b[j-1])?1:soft(b[j-1])?.25:.45),
   dp[i-1][j-1]+match(a[i-1],b[j-1])
  );
 }
 // Short or unrelated responses cannot pass through lenient scoring.
 const coverage=Math.min(1,b.length/a.length);
 if(coverage<.65)return Math.min(.7,coverage);
 return Math.max(0,1-dp[a.length][b.length]/Math.max(a.length,b.length));
}
const examples=[
 ['My School Day','I woke up early today. I ate breakfast with my family. I went to school with my friend. We played a game in English class. I had lunch with my classmates. I felt happy when I came home.'],
 ['A Rainy Day','It rained this morning. I took my umbrella to school. My shoes got a little wet. I read a book at lunchtime. My mother made soup for dinner. I hope tomorrow is sunny.'],
 ['My Weekend','I visited my grandmother on Saturday. We made pancakes together. My sister helped us in the kitchen. Then we went for a walk. We saw a small bird in the garden. I had a wonderful day.']
];
const el=(tag,cls='',value='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=value;return n};
export function createDiaryFlow({draft,review,speech,finish,onExit}){
 const root=$('wgDiaryFlow'),stage=$('dfStage'),actions=$('dfActions'),message=$('dfMessage'),progress=$('dfProgress');
 let current=null,step='topic',feedback=null,practice=[],index=0,mode='write',renderer=null,finalLines=[],spoken=[],busy=false,autosaveTimer=null,transitionTimer=null;
 function button(label,fn,primary=false){const b=el('button','wg-button '+(primary?'wg-primary':'wg-secondary'),label);b.type='button';b.addEventListener('click',fn);actions.append(b);return b}
 function status(text='',error=false){message.textContent=text;message.classList.toggle('is-error',error)}
 function screen(name,label){clearTimeout(transitionTimer);step=name;stage.replaceChildren();actions.replaceChildren();status();progress.textContent=label;root.hidden=false}
 async function persist(){clearTimeout(autosaveTimer);await draft(current)}
 function close(){clearTimeout(transitionTimer);clearTimeout(autosaveTimer);root.hidden=true;current=null;onExit()}
 $('dfExit').addEventListener('click',close);
 function topic(){
  screen('topic','1 · Topic');
  stage.append(el('h2','df-heading','오늘의 일기'));
  const input=el('input','df-input');input.type='text';input.maxLength=120;input.value=current.title||'';input.placeholder='Diary title';input.setAttribute('aria-label','Diary title');
  input.addEventListener('input',()=>{current.title=input.value});
  stage.append(input,el('p','df-muted','What happened today? Who were you with? How did you feel?'));
  const examplesBtn=el('button','wg-button wg-secondary','예시 일기 보기');examplesBtn.type='button';stage.append(examplesBtn);
  examplesBtn.addEventListener('click',()=>{
   let box=stage.querySelector('.df-examples');
   if(box){box.remove();return}
   box=el('div','df-examples');for(const [title,body] of examples){const c=el('article','df-example');c.append(el('strong','',title),el('p','',body));box.append(c)}stage.append(box);
  });
  button('다음',async()=>{if(!current.title.trim()){status('제목을 써 주세요.',true);return}try{await persist();write()}catch(e){status(e.message,true)}},true);
 }
 function write(){
  screen('write','2 · Write');
  const count=el('span','df-count');const area=el('textarea','df-textarea');area.value=current.body||'';area.placeholder='Write 6–30 complete sentences.';area.maxLength=12000;
  function update(){current.body=area.value;const n=split(area.value).length;count.textContent=n+' sentences';count.classList.toggle('is-invalid',n<6||n>30)}
  area.addEventListener('input',()=>{update();clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{void persist().catch(e=>status(e.message,true))},1800)});update();stage.append(area,count);
  button('이전',topic);
  button('저장',async()=>{try{await persist();status('저장됨')}catch(e){status(e.message,true)}});
  button('AI Willi 확인',async()=>{
   const count=split(current.body).length;if(count<6||count>30){status('완성된 영어 문장을 6–30개 작성해 주세요.',true);return}
   if(busy)return;busy=true;status('AI Willi가 검토 중이에요.');
   try{await persist();feedback=await review(current);summary()}catch(e){status(e.message,true)}finally{busy=false}
  },true);
 }
 function construct(){
  const corrections=(feedback?.improvements||[]).filter(x=>x.original&&x.better);
  const expressions=(feedback?.expressions||[]).filter(x=>x.english);
  practice=[...corrections.map(x=>({target:x.better,meaning:x.translation_ko||x.meaning_ko||'',kind:'Correction',original:x.original})),...expressions.map(x=>({target:x.english,meaning:x.meaning_ko||'',kind:'New Expression'}))];
  const original=split(current.body);
  finalLines=original.map(line=>{
   let result=line;for(const x of corrections){if(norm(line)===norm(x.original)||line.toLowerCase().includes(String(x.original).trim().toLowerCase())){result=x.better;break}}
   return result;
  });
 }
 function summary(){
  construct();screen('review','3 · Review');
  stage.append(el('h2','df-heading','AI Willi'),el('p','df-praise',feedback?.praise_ko||''));
  const improvements=Array.isArray(feedback?.improvements)?feedback.improvements:[];
  const expressions=Array.isArray(feedback?.expressions)?feedback.expressions:[];
  const section=(heading)=>{const box=el('section','df-review-group');box.append(el('h3','df-review-heading',heading));stage.append(box);return box};
  const fixes=section('Sentence Review · 문장 확인');
  if(!improvements.length)fixes.append(el('p','df-muted','잘 쓴 문장은 그대로 유지해요.'));
  for(const change of improvements){
   const card=el('article','df-review-item');
   card.append(el('small','df-review-label','STUDENT · 내가 쓴 문장'),el('p','df-review-original',change.original||''));
   card.append(el('small','df-review-label','AI WILLI · 더 좋은 문장'),el('p','df-review-better',change.better||''));
   card.append(el('p','df-review-korean',change.translation_ko||change.why_ko||''));
   if(change.why_ko)card.append(el('p','df-review-explanation',change.why_ko));
   fixes.append(card);
  }
  const phrases=section('New Expressions · 새로운 표현');
  if(!expressions.length)phrases.append(el('p','df-muted','추가 표현이 없어요.'));
  for(const phrase of expressions){
   const card=el('article','df-review-item');
   card.append(el('p','df-review-better',phrase.english||''));
   card.append(el('p','df-review-korean',phrase.meaning_ko||''));
   phrases.append(card);
  }
  if(feedback?.tip_ko)stage.append(el('p','df-review-tip',feedback.tip_ko));
  stage.append(el('strong','df-summary-count',practice.length+' sentences to practise'));
  button('이전',write);button('연습 시작',()=>{index=0;mode='speaking';if(practice.length)question();else{index=0;speakingTransition()}},true);
 }
 function rendererHost(q){
  const host=el('div','df-question-host sp-shared-question question-card');stage.append(host);renderer=new QuestionRenderer(host);renderer.render(q);
 }
 async function playTarget(text,control){
  if(control.disabled)return;
  control.disabled=true;control.classList.add('is-loading');control.setAttribute('aria-busy','true');status('음성을 불러오고 있어요.');
  try{
   const headers={'Content-Type':'application/json'};
   const token=window.WillenaAPI?.getLocalAccessToken?.();
   if(token)headers.Authorization='Bearer '+token;
   const response=await fetch('/api/vocab-ai-speech',{method:'POST',headers,credentials:'include',cache:'no-store',body:JSON.stringify({action:'listen',text}),signal:AbortSignal.timeout(35000)});
   if(!response.ok)throw Error('듣기 음성을 불러오지 못했어요.');
   const result=await response.json();
   let url=result.audio_url;
   let objectUrl=null;
   if(!url&&result.audio){const bytes=Uint8Array.from(atob(result.audio),c=>c.charCodeAt(0));url=objectUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}))}
   if(!url)throw Error('듣기 음성이 없어요.');
   const audio=new Audio(url);
   try{await audio.play();await new Promise((resolve,reject)=>{audio.onended=resolve;audio.onerror=()=>reject(Error('재생할 수 없어요.'))})}
   finally{if(objectUrl)URL.revokeObjectURL(objectUrl)}
   status('');
  }catch(e){status(e.message,true)}
  finally{control.disabled=false;control.classList.remove('is-loading');control.removeAttribute('aria-busy')}
 }
 function question(){
  const p=practice[index];if(!p){index=0;speakingTransition();return}
  screen('question',(index+1)+' / '+practice.length);
  stage.append(el('p','df-target',p.target));
   if(p.meaning)stage.append(el('p','df-target-korean',p.meaning));
  const listen=el('button','wg-button df-listen');listen.append(el('img','df-headphones'));listen.querySelector('img').src='/shared/svgs/headphones.svg';listen.querySelector('img').alt='';listen.setAttribute('aria-label','듣기');listen.title='듣기';listen.type='button';listen.addEventListener('click',()=>void playTarget(p.target,listen));stage.append(listen);
  const modes=el('div','df-mode-buttons');
  const toggle=el('button','df-mode-toggle');
  toggle.type='button';
  toggle.setAttribute('role','switch');
  toggle.setAttribute('aria-label','말하기 또는 쓰기 선택');
  toggle.setAttribute('aria-checked',String(mode==='speaking'));
  const speak=el('span','df-toggle-speak','말하기');
  const write=el('span','df-toggle-write','쓰기');
  toggle.append(speak,write);
  toggle.classList.toggle('is-speaking',mode==='speaking');
  toggle.classList.toggle('is-writing',mode==='write');
  toggle.addEventListener('click',()=>{mode=mode==='speaking'?'write':'speaking';question()});
  modes.append(toggle);stage.append(modes);
  rendererHost({form:mode==='speaking'?'speaking':'write',prompt:'',context:{},input:{language:'en'},answer:[p.target]});
  button('확인',()=>{
   if(norm(renderer.getResponse())!==norm(p.target)){status('다시 시도해 주세요.',true);return}
   index++;mode='speaking';question();
  },true);
  button('건너뛰기 · Skip',()=>{index++;mode='speaking';question()});
 }
 async function aiSpeechTranscribe(blob){
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob)});
  const token=window.WillenaAPI?.getLocalAccessToken?.();
  const response=await fetch('/api/vocab-ai-speech',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},credentials:'include',cache:'no-store',body:JSON.stringify({action:'transcribe',audio_base64:base64,mime_type:blob.type}),signal:AbortSignal.timeout(35000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success)throw Error(data.error||'음성 확인에 실패했어요.');
  return data.transcript||'';
 }
 async function fallbackRecord(target,control,onSuccess){
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status('이 브라우저는 마이크 녹음을 지원하지 않아요.',true);return}
  const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus','audio/ogg'].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime){status('오디오 형식을 지원하지 않아요.',true);return}
  let stream,recorder;
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:true});
   recorder=new MediaRecorder(stream,{mimeType:mime});const chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   const ended=new Promise(resolve=>{recorder.onstop=resolve});
   recorder.start();control.classList.add('is-recording');if(!control.querySelector('.speaking-mic-icon'))control.textContent='녹음 중지';status('말해 주세요.');
   await new Promise(resolve=>{const stop=()=>{control.removeEventListener('click',stop);resolve()};control.addEventListener('click',stop,{once:true});setTimeout(()=>{control.removeEventListener('click',stop);resolve()},12000)});
   if(recorder.state==='recording')recorder.stop();await ended;
   control.classList.remove('is-recording');if(!control.querySelector('.speaking-mic-icon'))control.textContent='다시 말하기';status('음성을 확인하고 있어요.');
   const transcript=await aiSpeechTranscribe(new Blob(chunks,{type:mime}));
   status('');onSuccess(transcript);
  }catch(error){status(error.message||'마이크 오류',true)}
  finally{stream?.getTracks().forEach(t=>t.stop());control.classList.remove('is-recording');if(!control.querySelector('.speaking-mic-icon'))control.textContent='말하기'}
 }
 function speakingTransition(){
  screen('speak-transition','4 · Speak');
  const splash=el('div','df-speak-splash');
  const icon=el('div','df-splash-icon');const iconImg=el('img','df-splash-mic');iconImg.src='/shared/svgs/mic.svg';iconImg.alt='';icon.append(iconImg);
  splash.append(icon,el('h2','','Review complete!'),el('p','','이제 내 글을 소리 내어 읽어 봐요.'),el('small','','Speak each sentence to continue.'));
  stage.append(splash);
  let started=false;
  const start=()=>{if(started||step!=='speak-transition')return;started=true;index=0;lineSpeech()};
  button('말하기 시작',start,true);
  transitionTimer=setTimeout(start,2200);
 }
 function lineSpeech(){
  if(index>=finalLines.length){complete();return}
  screen('speech','Speak · '+(index+1)+' / '+finalLines.length);
  const flow=el('div','df-teleprompter');
  flow.setAttribute('aria-label','Speaking teleprompter');
  if(index>0)flow.append(el('p','df-tele-line df-tele-done',finalLines[index-1]));
  for(let offset=0;offset<5&&index+offset<finalLines.length;offset++){
   const line=el('p','df-tele-line '+(offset===0?'df-tele-active':'df-tele-next df-tele-next-'+offset),finalLines[index+offset]);
   flow.append(line);
  }
  stage.append(flow);
  const target=finalLines[index];
  // Use the exact shared QuestionRenderer microphone from the review activity.
  rendererHost({form:'speaking',prompt:'',context:{},input:{language:'en'},answer:[target]});
  const mic=stage.querySelector('[data-speaking-mic]');
  const speechStatus=stage.querySelector('[data-speaking-status]');
  if(!mic)return;
  mic.classList.add('df-tele-mic');
  let accepted=false;
  const judge=answer=>{
   if(accepted||step!=='speech')return;
   const score=spokenAccuracy(target,answer);
   if(score<.75){
    status('다시 한번 말해 보세요.',true);
    return;
   }
   accepted=true;
   spoken.push(answer);
   mic.disabled=true;
   status('✓ 잘했어요!');
   flow.classList.add('df-tele-advance');
   setTimeout(()=>{if(step==='speech'){index++;lineSpeech()}},480);
  };
  if(window.SpeechRecognition||window.webkitSpeechRecognition){
   renderer.onSpeechResult=alternatives=>{
    const candidates=Array.isArray(alternatives)?alternatives:[alternatives];
    const best=candidates.map(answer=>({answer,score:spokenAccuracy(target,answer)})).sort((a,b)=>b.score-a.score)[0];
    if(best)judge(best.answer);
   };
  }else{
   mic.disabled=false;
   if(speechStatus)speechStatus.textContent='마이크를 눌러 말해 보세요.';
   let processing=false;
   mic.addEventListener('click',()=>{
    if(processing||mic.classList.contains('is-recording'))return;
    processing=true;
    void fallbackRecord(target,mic,judge).finally(()=>{processing=false});
   });
  }
 }
 async function complete(){
  screen('finish','Complete');stage.append(el('h2','df-heading','일기 완료'));
  if(busy)return;busy=true;status('저장 중…');
  try{await speech(current,spoken.join(' '));await finish(current);status('완료했습니다.');button('글쓰기 메뉴',close,true)}
  catch(e){status(e.message,true);button('다시 저장',complete,true)}
  finally{busy=false}
 }
 return {open(entry,saved){clearTimeout(autosaveTimer);current={...entry};feedback=saved?.original_body===entry.body?saved.feedback:null;spoken=[];index=0;root.hidden=false;if(entry.status==='submitted'){screen('finish','Complete');stage.append(el('h2','df-heading','오늘의 일기 완료'));button('글쓰기 메뉴',close,true)}else if(feedback)summary();else topic()},close};
}
