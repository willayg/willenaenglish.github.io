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
const diaryTopics=[
 {title:'오늘의 일기',en:'My Day',guide:'What happened today? Who were you with? How did you feel?',example:'Today was a busy day. I went to school in the morning. I studied English with my friends. We ate lunch together. After school I played outside. I felt tired but happy.'},
 {title:'주말 계획',en:'Weekend Plans',guide:'Where will you go? Who will you meet? What do you want to do?',example:'This weekend I want to visit a park. I will go there with my family. We might ride our bikes. I want to have a picnic. I hope the weather is sunny. I think it will be fun.'},
 {title:'학교 생활',en:'School Life',guide:'What classes did you have? What happened at school? What did you enjoy?',example:'I went to school early today. My first class was math. I asked my teacher a question. At lunch I talked with my friends. We played soccer after class. I had a good day at school.'},
 {title:'나의 가족',en:'My Family',guide:'Who is in your family? What do you do together? What makes them special?',example:'I live with my family. We like eating dinner together. My sister makes me laugh. My dad helps me with homework. On Sundays we go for a walk. I love spending time with them.'},
 {title:'내가 좋아하는 음식',en:'My Favorite Food',guide:'What food do you like? What does it taste like? When do you eat it?',example:'My favorite food is pizza. I love cheese and tomatoes. My family orders pizza on Fridays. I usually eat two slices. Sometimes I make pizza at home. I want to try a new topping next time.'},
 {title:'친구와의 하루',en:'A Day With Friends',guide:'Who did you meet? What did you do together? How did you feel?',example:'I met my friend after school. We went to the playground. First we played basketball. Then we bought a snack. We talked about our favorite games. I had a great time with my friend.'},
 {title:'나의 취미',en:'My Hobbies',guide:'What do you enjoy doing? When do you do it? Why do you like it?',example:'I like drawing pictures. I usually draw after dinner. My favorite thing to draw is animals. Sometimes I watch drawing videos. I want to get better at coloring. Drawing helps me relax.'},
 {title:'특별했던 날',en:'A Special Day',guide:'What made the day special? Who was there? What happened first and next?',example:'Yesterday was my birthday. My friends came to my house. We played games together. My mom made a cake. Everyone sang a birthday song. It was a day I will remember.'},
 {title:'가고 싶은 곳',en:'A Place I Want to Visit',guide:'Where do you want to go? Why? What would you do there?',example:'I want to visit Jeju Island. I would like to see the sea. I want to walk on the beach. I hope to try delicious food. I would take lots of pictures. I think the trip would be exciting.'},
 {title:'나의 꿈',en:'My Dream',guide:'What do you want to be or do? Why? How can you work toward it?',example:'I want to become a scientist. I enjoy learning about space. I read books about planets. I want to build a robot one day. I will study hard at school. I hope my dream comes true.'}
];
const el=(tag,cls='',value='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=value;return n};
export function createDiaryFlow({draft,review,clarify,speech,finish,teacherFeedback,onExit}){
 const root=$('wgDiaryFlow'),stage=$('dfStage'),actions=$('dfActions'),message=$('dfMessage'),progress=$('dfProgress');
 let current=null,step='topic',feedback=null,practice=[],index=0,mode='write',renderer=null,finalLines=[],spoken=[],busy=false,autosaveTimer=null,transitionTimer=null,choices={};
 function button(label,fn,primary=false){const b=el('button','wg-button '+(primary?'wg-primary':'wg-secondary'),label);b.type='button';b.addEventListener('click',fn);actions.append(b);return b}
 function status(text='',error=false){message.textContent=text;message.classList.toggle('is-error',error)}
 function screen(name,label){clearTimeout(transitionTimer);step=name;stage.replaceChildren();actions.replaceChildren();status();progress.textContent=label;root.hidden=false}
 async function persist(){clearTimeout(autosaveTimer);await draft(current)}
 function close(){clearTimeout(transitionTimer);clearTimeout(autosaveTimer);root.hidden=true;current=null;onExit()}
 $('dfExit').addEventListener('click',close);
 function topic(){
  screen('topic','1 · Topic');
  const heading=el('h2','df-heading','오늘의 일기');stage.append(heading);
  const selected=diaryTopics.find(t=>t.title===current.title||t.en===current.title);
  const picker=el('div','df-topic-picker');
  const choose=el('button','df-topic-trigger');choose.type='button';choose.setAttribute('aria-expanded','false');
  const menu=el('div','df-topic-menu');menu.hidden=true;
  const titleInput=el('input','df-input');titleInput.type='text';titleInput.maxLength=120;titleInput.placeholder='My own title';titleInput.setAttribute('aria-label','My own diary title');
  const guide=el('p','df-muted df-topic-guide');
  const examplesBtn=el('button','wg-button wg-secondary','예시 일기 보기');examplesBtn.type='button';
  const exampleBox=el('article','df-example df-topic-example');exampleBox.hidden=true;
  const exampleTitle=el('strong',''),exampleText=el('p','');exampleBox.append(exampleTitle,exampleText);
  let active=selected||null;
  function render(){
   choose.textContent=active?(active.title+' · '+active.en):'직접 제목 쓰기';
   titleInput.hidden=!!active;
   if(active)current.title=active.title;
   else titleInput.value=current.title||'';
   guide.textContent=active?active.guide:'Write about anything you like. What happened? How did you feel?';
   const example=active||diaryTopics[0];
   exampleTitle.textContent=example.en;exampleText.textContent=example.example;
   [...menu.querySelectorAll('[data-topic-index]')].forEach(btn=>btn.classList.toggle('is-selected',btn.dataset.topicIndex===String(active?diaryTopics.indexOf(active):-1)));
  }
  const closeMenu=()=>{menu.hidden=true;choose.setAttribute('aria-expanded','false')};
  choose.addEventListener('click',()=>{menu.hidden=!menu.hidden;choose.setAttribute('aria-expanded',String(!menu.hidden))});
  diaryTopics.forEach((item,i)=>{
   const option=el('button','df-topic-option',item.title+' · '+item.en);option.type='button';option.dataset.topicIndex=String(i);
   option.addEventListener('click',()=>{active=item;render();closeMenu()});menu.append(option);
  });
  const custom=el('button','df-topic-option','✎ 직접 제목 쓰기 · My Own Topic');custom.type='button';custom.dataset.topicIndex='-1';
  custom.addEventListener('click',()=>{active=null;current.title='';render();closeMenu();titleInput.focus()});menu.append(custom);
  titleInput.addEventListener('input',()=>{current.title=titleInput.value});
  picker.append(choose,menu);
  stage.append(picker,titleInput,guide,examplesBtn,exampleBox);
  examplesBtn.addEventListener('click',()=>{exampleBox.hidden=!exampleBox.hidden;examplesBtn.setAttribute('aria-expanded',String(!exampleBox.hidden))});
  render();
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
   if(busy)return;busy=true;
   reviewLoading();
   try{await persist();feedback=await review(current);summary()}
   catch(e){write();status(e.message||'AI Willi 오류가 발생했어요.',true)}
   finally{busy=false}
  },true);
 }
 function reviewLoading(){
  screen('review-loading','AI Willi');
  const splash=el('section','df-ai-loading');
  splash.setAttribute('role','status');splash.setAttribute('aria-live','polite');
  splash.innerHTML=`
   <div class="df-ai-orbit" aria-hidden="true">
    <svg viewBox="0 0 180 180" fill="none" role="presentation">
      <circle cx="90" cy="90" r="73" class="df-ai-ring"/>
      <circle cx="90" cy="90" r="73" class="df-ai-ring-active"/>
      <g class="df-ai-robot">
        <path d="M90 33v13" stroke="#249aa5" stroke-width="5" stroke-linecap="round"/>
        <circle cx="90" cy="29" r="6" fill="#e75c9d"/>
        <rect x="49" y="47" width="82" height="83" rx="23" fill="#fff" stroke="#249aa5" stroke-width="5"/>
        <rect x="61" y="65" width="58" height="42" rx="13" fill="#e8fbfc" stroke="#8adce2" stroke-width="3"/>
        <g class="df-ai-robot-eyes"><rect x="70" y="79" width="10" height="14" rx="5" fill="#e75c9d"/><rect x="100" y="79" width="10" height="14" rx="5" fill="#e75c9d"/></g>
        <path d="M84 99q6 6 12 0" stroke="#249aa5" stroke-width="3" stroke-linecap="round"/>
        <path d="M49 79H39v24h10M131 79h10v24h-10" stroke="#249aa5" stroke-width="5" stroke-linejoin="round"/>
        <path d="M70 130v10m40-10v10" stroke="#249aa5" stroke-width="5" stroke-linecap="round"/>
      </g>
    </svg>
   </div>
   <h2>AI Willi</h2>
   <p>글을 읽고 있어요</p>
   <div class="df-ai-loading-dots" aria-hidden="true"><i></i><i></i><i></i></div>
  `;
  stage.append(splash);
 }
 function showTeacherFeedback(){
  if(!current?.id||!teacherFeedback)return;
  const id=current.id;
  void teacherFeedback(current).then(data=>{
   if(!data||id!==current?.id||step!=='finish')return;
   stage.querySelector('.df-teacher-feedback')?.remove();
   if(!data.feedback&&!data.bonus_points)return;
   const box=el('section','df-teacher-feedback');
   box.append(el('h3','','Teacher feedback · 선생님 코멘트'));
   if(data.feedback)box.append(el('p','',data.feedback));
   if(data.bonus_points)box.append(el('strong','','+'+data.bonus_points+' bonus points'));
   stage.append(box);
  }).catch(()=>{});
 }
 function choiceKey(){return 'willena-diary-choices:'+current.id+':'+current.body.length+':'+current.body.slice(0,32)}
 function saveChoices(){try{localStorage.setItem(choiceKey(),JSON.stringify(choices))}catch{}}
 function loadChoices(){try{const stored=JSON.parse(localStorage.getItem(choiceKey())||'{}');choices=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{}}catch{choices={}}}
 function selectedText(change,i){
  const choice=choices[i]||'first';
  return choice==='original'?change.original:choice==='last'&&change.clarified_better?change.clarified_better:change.better;
 }
 function construct(){
  const corrections=(feedback?.improvements||[]).filter(x=>x.original&&x.better);
  const expressions=(feedback?.expressions||[]).filter(x=>x.english);
  practice=[...corrections.map((x,i)=>({target:selectedText(x,i),meaning:(choices[i]==='last'?x.clarified_translation_ko:x.translation_ko)||'',kind:'Correction',original:x.original})),...expressions.map(x=>({target:x.english,meaning:x.meaning_ko||'',kind:'New Expression'}))];
  const original=split(current.body);
  finalLines=original.map(line=>{
   for(let i=0;i<corrections.length;i++){
    const x=corrections[i];
    if(norm(line)===norm(x.original)||line.toLowerCase().includes(String(x.original).trim().toLowerCase()))return selectedText(x,i);
   }
   return line;
  });
 }
 function correctionType(change){
  const a=norm(change.original),b=norm(change.better);
  if(a===b)return 'Punctuation';
  const x=a.split(' '),y=b.split(' ');
  if(Math.abs(x.length-y.length)<=1&&x.filter(w=>!y.includes(w)).length<=1)return 'Grammar';
  return 'Better Expression';
 }
 function changedText(original,better,container){
  const a=String(original).split(/(\s+)/),b=String(better).split(/(\s+)/);
  let i=0,j=0;
  while(i<a.length&&j<b.length&&a[i]===b[j]){container.append(document.createTextNode(b[j]));i++;j++}
  let ai=a.length-1,bj=b.length-1;
  while(ai>=i&&bj>=j&&a[ai]===b[bj]){ai--;bj--}
  const changed=b.slice(j,bj+1).join('');
  if(changed)container.append(el('mark','df-diff',changed));
  container.append(document.createTextNode(b.slice(bj+1).join('')));
 }
 function summary(){
  construct();screen('review','3 · Review');
  if(feedback?.praise_ko)stage.append(el('p','df-review-praise',feedback.praise_ko));
  const improvements=Array.isArray(feedback?.improvements)?feedback.improvements:[];
  const expressions=Array.isArray(feedback?.expressions)?feedback.expressions:[];
  const heading=el('div','df-review-top');
  heading.append(el('h3','','Sentence Review'),el('span','df-review-progress'));
  stage.append(heading);
  const progressLabel=heading.querySelector('.df-review-progress');
  const refreshProgress=()=>{const n=improvements.filter((_,i)=>choices[i]).length;progressLabel.textContent=n+' / '+improvements.length+' reviewed'};
  if(!improvements.length)stage.append(el('p','df-muted','수정할 문장이 없어요.'));
  improvements.forEach((change,i)=>{
   const card=el('article','df-review-item df-review-compact');
   const header=el('div','df-review-card-head');
   header.append(el('span','df-review-number',(i+1)+' / '+improvements.length),el('span','df-review-kind',correctionType(change)));
   card.append(header);
   if(correctionType(change)!=='Punctuation')card.append(el('p','df-review-original',change.original||''));
   const suggestion=el('p','df-review-better');changedText(change.original,change.better,suggestion);
   if(correctionType(change)==='Punctuation')suggestion.append(el('small','df-inline-note',change.better.includes(',')&&!change.original.includes(',')?' · comma':' · punctuation'));
   card.append(suggestion);
   if(change.translation_ko)card.append(el('p','df-review-korean',change.translation_ko));
   if(change.why_ko&&correctionType(change)!=='Punctuation')card.append(el('p','df-review-explanation',change.why_ko));
   const row=el('div','df-choice-row');
   const options=[['original','Original'],['first','AI correction'],['last','Revised']];
   const controls=[];
   const refresh=()=>{controls.forEach(([key,btn])=>{btn.classList.toggle('is-chosen',(choices[i]||'first')===key);btn.setAttribute('aria-pressed',String((choices[i]||'first')===key))});refreshProgress()};
   for(const [key,label] of options){
    if(key==='last'&&!change.clarified_better)continue;
    const btn=el('button','df-choice-button',label);btn.type='button';
    btn.addEventListener('click',()=>{choices[i]=key;saveChoices();refresh();construct()});
    controls.push([key,btn]);row.append(btn);
   }
   card.append(row);
   if(change.clarified_better){
    const revised=el('p','df-review-revised',change.clarified_better);
    card.append(revised);
   }else{
    const changeBtn=el('button','df-change-button','Change · 뜻 설명하기');changeBtn.type='button';card.append(changeBtn);
    changeBtn.addEventListener('click',()=>{
     if(card.querySelector('.df-clarify-box'))return;
     const box=el('div','df-clarify-box');
     const input=el('textarea','df-clarify-input');input.placeholder='What did you mean? 영어 또는 한국어';input.maxLength=600;input.setAttribute('aria-label','Clarify your meaning in Korean or English');
     const send=el('button','wg-button wg-primary','다시 제안받기');send.type='button';
     box.append(input,send);card.append(box);input.focus();
     send.addEventListener('click',async()=>{
      if(input.value.trim().length<2){status('뜻을 설명해 주세요.',true);return}
      send.disabled=true;send.textContent='확인 중…';
      try{
       const result=await clarify(current,i,input.value.trim());
       change.clarified_better=result.better;change.clarified_translation_ko=result.translation_ko||'';
       choices[i]='last';saveChoices();construct();
       // Refresh cards without losing the student's review decisions.
       const top=window.scrollY;summary();window.scrollTo({top});
      }catch(e){status(e.message||'다시 시도해 주세요.',true);send.disabled=false;send.textContent='다시 제안받기'}
     });
    });
   }
   stage.append(card);refresh();
  });
  if(expressions.length){
   const section=el('section','df-review-group');
   section.append(el('h3','df-review-heading','New Expressions'));
   expressions.forEach(x=>{const line=el('div','df-expression-line');line.append(el('strong','',x.english||''),el('span','',x.meaning_ko||''));section.append(line)});
   stage.append(section);
  }
  refreshProgress();
  button('이전',write);
  button('Finish Review · 연습 시작',()=>{construct();index=0;mode='speaking';if(practice.length)question();else speakingTransition()},true);
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
  try{
   await speech(current,spoken.join(' '),finalLines);
   const reward=await finish(current);
   const award=document.createElement('student-reward-celebration');
   award.setAttribute('label','DAILY DIARY COMPLETE');
   award.setAttribute('percent','100');award.setAttribute('star-max','5');
   award.setAttribute('stars',String(reward.stars));award.setAttribute('points',String(reward.points));
   stage.append(award);
   stage.append(el('p','df-reward-breakdown',reward.sentences+' sentences × 5 points'));
   status('완료했습니다!');
   showTeacherFeedback();
   button('글쓰기 메뉴',close,true);
  }
  catch(e){status(e.message,true);button('다시 저장',complete,true)}
  finally{busy=false}
 }
 return {open(entry,saved){clearTimeout(autosaveTimer);current={...entry};feedback=saved?.original_body===entry.body&&saved?.feedback?.review_version===2?saved.feedback:null;choices={};loadChoices();spoken=[];index=0;root.hidden=false;if(entry.status==='submitted'){screen('finish','Complete');stage.append(el('h2','df-heading','오늘의 일기 완료'));showTeacherFeedback();button('글쓰기 메뉴',close,true)}else if(feedback)summary();else topic()},close};
}
