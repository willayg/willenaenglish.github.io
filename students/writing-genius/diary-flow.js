import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20261023-speaking-ai1';
const $=id=>document.getElementById(id);
const norm=s=>String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9']/g,' ').replace(/\s+/g,' ').trim();
const split=s=>(String(s||'').match(/[^.!?\n]+[.!?]+(?=\s|$)/g)||[]).map(x=>x.trim()).filter(x=>/[a-z]/i.test(x));
const examples=[
 ['My School Day','I woke up early today. I ate breakfast with my family. I went to school with my friend. We played a game in English class. I had lunch with my classmates. I felt happy when I came home.'],
 ['A Rainy Day','It rained this morning. I took my umbrella to school. My shoes got a little wet. I read a book at lunchtime. My mother made soup for dinner. I hope tomorrow is sunny.'],
 ['My Weekend','I visited my grandmother on Saturday. We made pancakes together. My sister helped us in the kitchen. Then we went for a walk. We saw a small bird in the garden. I had a wonderful day.']
];
const el=(tag,cls='',value='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=value;return n};
export function createDiaryFlow({draft,review,speech,finish,onExit}){
 const root=$('wgDiaryFlow'),stage=$('dfStage'),actions=$('dfActions'),message=$('dfMessage'),progress=$('dfProgress');
 let current=null,step='topic',feedback=null,practice=[],index=0,mode='write',renderer=null,finalLines=[],spoken=[],busy=false,autosaveTimer=null;
 function button(label,fn,primary=false){const b=el('button','wg-button '+(primary?'wg-primary':'wg-secondary'),label);b.type='button';b.addEventListener('click',fn);actions.append(b);return b}
 function status(text='',error=false){message.textContent=text;message.classList.toggle('is-error',error)}
 function screen(name,label){step=name;stage.replaceChildren();actions.replaceChildren();status();progress.textContent=label;root.hidden=false;window.scrollTo({top:0,behavior:'auto'})}
 async function persist(){clearTimeout(autosaveTimer);await draft(current)}
 function close(){clearTimeout(autosaveTimer);root.hidden=true;current=null;onExit()}
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
  stage.append(el('h2','df-heading','일기 쓰기'));
  const count=el('span','df-count');const area=el('textarea','df-textarea');area.value=current.body||'';area.placeholder='Write 6–30 complete sentences.';area.maxLength=12000;
  function update(){current.body=area.value;count.textContent=split(area.value).length+' / 30 sentences'}
  area.addEventListener('input',()=>{update();clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{void persist().catch(e=>status(e.message,true))},1800)});update();stage.append(count,area);
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
  practice=[...corrections.map(x=>({target:x.better,meaning:x.why_ko||'',kind:'Correction',original:x.original})),...expressions.map(x=>({target:x.english,meaning:x.meaning_ko||'',kind:'New Expression'}))];
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
  button('이전',write);button('연습 시작',()=>{index=0;mode='write';if(practice.length)question();else{index=0;lineSpeech()}},true);
 }
 function rendererHost(q){
  const host=el('div','df-question-host sp-shared-question question-card');stage.append(host);renderer=new QuestionRenderer(host);renderer.render(q);
 }
 function question(){
  const p=practice[index];if(!p){index=0;lineSpeech();return}
  screen('question',(index+1)+' / '+practice.length+' · '+p.kind);
  stage.append(el('h2','df-heading',p.kind==='Correction'?'문장 고치기':'새로운 표현'));
  rendererHost({form:mode==='speaking'?'speaking':'write',prompt:mode==='speaking'?'말하기':'영어로 쓰기',context:{...(p.original?{original:p.original}:{}),...(p.meaning?{korean:p.meaning}:{}) ,sentence:p.target},input:{language:'en'},answer:[p.target]});
  button('쓰기',()=>{mode='write';question()});button('말하기',()=>{mode='speaking';question()});
  button('확인',()=>{
   if(norm(renderer.getResponse())!==norm(p.target)){status('다시 시도해 주세요.',true);return}
   index++;mode='write';question();
  },true);
 }
 function lineSpeech(){
  if(index>=finalLines.length){complete();return}
  screen('speech','Speak · '+(index+1)+' / '+finalLines.length);
  stage.append(el('h2','df-heading','한 문장씩 말하기'),el('p','df-target',finalLines[index]));
  rendererHost({form:'speaking',prompt:'',context:{},input:{language:'en'},answer:[finalLines[index]]});
  button('확인',()=>{
   const spokenLine=String(renderer.getResponse()||'').trim();
   if(norm(spokenLine)!==norm(finalLines[index])){status('다시 말해 주세요.',true);return}
   spoken.push(spokenLine);index++;lineSpeech();
  },true);
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
