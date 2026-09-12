import {recommendSpeaking} from './speaking-recommendation.js?v=rev2.1-rec1';

const LEVEL_LABELS={1:'Starter 1',2:'Starter 2',3:'Level 1',4:'Level 2',5:'Level 3',6:'Level 4',7:'Level 5',8:'Level 6',9:'Level 7',10:'Level 8',11:'Level 9',12:'Level 10'};

const VISUAL_BANKS={
  starterObject:[['🐱','cat'],['🐶','dog'],['🐯','tiger'],['✏️','pencil'],['📘','book'],['🍎','apple'],['⚽','ball'],['🚗','car'],['🐰','rabbit'],['🪑','chair']],
  color:[['🔴','red'],['🔵','blue'],['🟢','green'],['🟡','yellow'],['🟣','purple'],['🟠','orange'],['🟤','brown'],['⚫','black']],
  pluralAnimals:[['🐸🐸','frogs'],['🐱🐱','cats'],['🐶🐶','dogs'],['🐰🐰','rabbits'],['🐟🐟','fish'],['🐦🐦','birds']],
  actions:[['🏃‍♂️','running'],['🏊‍♀️','swimming'],['📖','reading'],['✍️','writing'],['💃','dancing'],['🎤','singing'],['🚲','riding a bike'],['⚽','playing soccer']],
  counting:[['🍎🍎🍎','3 apples'],['🐱🐱','2 cats'],['⚽⚽⚽⚽','4 balls'],['✏️✏️✏️✏️✏️','5 pencils'],['🐸🐸🐸','3 frogs'],['📘📘📘📘','4 books']]
};

const DEFAULT_PROMPTS={
  1:[{text:'Hello. How are you?'},{text:'What is it?',visual:'starterObject'},{text:'What color is it?',visual:'color'}],
  2:[{text:'How old are you?'},{text:'Do you like {food}?',variants:{food:['bananas','pizza','ice cream','apples','chicken','cookies']}},{text:'Can you {action}?',variants:{action:['swim','ride a bike','dance','sing','run fast','play soccer']}}],
  3:[{text:"What's your favorite {thing}?",variants:{thing:['food','animal','color','game','school subject']}},{text:'What are they?',visual:'pluralAnimals'},{text:'Do you have {thing}?',variants:{thing:['a cat','a dog','a bike','a computer','a brother or sister']}},{text:'What do you want?',variants:{thing:['some water','a snack','a new toy','a pencil','some juice']}},{text:"What's the weather like today?"}],
  4:[{text:'What {food} do you like?',variants:{food:['fruit','food','drink','snack']}},{text:'What is she/he doing?',visual:'actions'},{text:'How many are there?',visual:'counting'},{text:'Where is the pencil? Put a pencil on / under / next to something.'},{text:'What are you doing now?'}],
  5:[{text:'What does your {person} like?',variants:{person:['mom','dad','friend','teacher']}},{text:'What does your {person} do after school/work?',variants:{person:['friend','brother','sister','dad']}},{text:'Are there any {things} in your bag?',variants:{things:['pencils','books','snacks','toys']}},{text:'Tell me where the pencil is. Put it under / behind / between / next to something.'},{text:'What does your best friend look like?'}],
  6:[{text:'What do you want to do this weekend?'},{text:'What did you do yesterday?'},{text:'What are you going to do after school?'},{text:'Which is bigger, a {a} or a {b}?',variants:{a:['dog','bus','elephant'],b:['cat','car','horse']}},{text:'What should you do if you have a headache?'},{text:'Tell me how to get from here to the door / bathroom / office.'}],
  7:[{text:'What were you doing at {time} yesterday?',variants:{time:['7 p.m.','8 p.m.','lunchtime','after school']}},{text:'What is the past tense of {verb}?',variants:{verb:['buy','bring','catch','teach','think','take','wear','leave']}},{text:'Have you ever been to {place}?',variants:{place:['Jeju','Seoul','another country','an amusement park','a zoo']}},{text:'Put on / take off / pick up / turn on — use one in a sentence.'},{text:'Tell me something fun that happened last weekend.'},{text:'What were you doing when you got home yesterday?'}],
  8:[{text:'How long have you studied English?'},{text:'Tell me about something you have done this week.'},{text:'If it rains this weekend, what will you do?'},{text:'What do you have to do before school?'},{text:'What is something you do not have to do on weekends?'},{text:'Tell me about a goal you want to achieve and how you can do it.'}],
  9:[{text:'Tell me about a time you changed your mind about something.'},{text:'If you could change one rule at school, what would you change and why?'},{text:'Which is better for learning: books or videos? Why?'},{text:'Tell me about a mistake that taught you something.'},{text:'What makes someone a good friend?'},{text:'Should students have homework every day? Why or why not?'}],
  10:[{text:'Do phones help students learn, or distract them? Explain.'},{text:'What would you do if you had one completely free day?'},{text:'Tell me about something you wish you had done differently.'},{text:'What is one problem at school that could be improved?'},{text:'Is it better to be very good at one thing or pretty good at many things? Why?'},{text:'Tell me about a time someone gave you useful advice.'}],
  11:[{text:'Should students be allowed to use AI for schoolwork? Explain your rules.'},{text:'What is something people your age worry about too much?'},{text:'If you could redesign the school day, what would you change?'},{text:'Tell me about an opinion you have that other people may disagree with.'},{text:'What makes information online trustworthy or untrustworthy?'},{text:'Which matters more: talent or practice? Defend your answer.'}],
  12:[{text:'What is one change technology may bring to schools in the next ten years?'},{text:'Should schools focus more on exams or practical skills? Why?'},{text:'Describe a difficult decision and the factors you would consider.'},{text:'How can people disagree without becoming hostile?'},{text:'What responsibility do social-media companies have for false information?'},{text:'Choose a rule or policy you disagree with and make the strongest case for changing it.'}]
};

export const SPEAKING_RUBRIC=[
  {score:1,label:'1',detail:'Cannot understand / answer'},
  {score:2,label:'2',detail:'Needs substantial help'},
  {score:3,label:'3',detail:'Basic understandable answer'},
  {score:4,label:'4',detail:'Clear complete answer'},
  {score:5,label:'5',detail:'Natural extended answer'}
];

function asPrompt(value){return typeof value==='string'?{text:value}:value;}
function options(selected,blank='—'){return `<option value="">${blank}</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${Number(selected)===i+1?'selected':''}>${LEVEL_LABELS[i+1]}</option>`).join('')}`;}

export function createSpeakingAssessment({host,session,lang='ko',prompts=DEFAULT_PROMPTS,onChange,onBack,onComplete}={}){
  let level=Math.max(1,Math.min(12,Number(session?.speaking?.current_level||3)));
  let evidence=Array.isArray(session?.speaking?.evidence)?[...session.speaking.evidence]:[];
  let teacherLevel=session?.speaking?.teacher_level||null;
  let startLevel=session?.speaking?.teacher_selected_start_level||session?.calibration?.teacher_selected_start_level||null;
  let startOverridden=Boolean(session?.speaking?.teacher_start_overridden);
  let notes=session?.speaking?.teacher_notes||'';
  const variantIndex={};
  const visualIndex={};
  const tx=(ko,en)=>lang==='ko'?ko:en;

  function recommendation(){return recommendSpeaking(evidence);}
  function syncRecommendedStart(){const rec=recommendation();if(!startOverridden&&rec.recommended_level)startLevel=rec.recommended_level;return rec;}
  syncRecommendedStart();

  function selectedScore(promptIndex){return evidence.find(x=>x.level===level&&x.prompt_index===promptIndex)?.score||null;}
  function state(){
    const rec=recommendation();
    return {current_level:level,evidence:[...evidence],teacher_level:teacherLevel,speaking_recommendation:rec,teacher_selected_start_level:startLevel,teacher_start_overridden:startOverridden,teacher_level_cap:null,teacher_notes:notes};
  }
  function save(){onChange?.(state());}
  function scorePrompt(promptIndex,score){evidence=evidence.filter(x=>!(x.level===level&&x.prompt_index===promptIndex));evidence.push({level,prompt_index:promptIndex,score,scored_at:new Date().toISOString()});syncRecommendedStart();save();render();}
  function move(delta){level=Math.max(1,Math.min(12,level+delta));save();render();}
  function keyFor(index){return `${level}:${index}`;}
  function resolvedText(prompt,index){let text=prompt.text;Object.entries(prompt.variants||{}).forEach(([key,values])=>{const idx=(variantIndex[`${keyFor(index)}:${key}`]||0)%values.length;text=text.replace(`{${key}}`,values[idx]);});return text;}
  function cycleVariants(prompt,index){Object.entries(prompt.variants||{}).forEach(([key,values])=>{const k=`${keyFor(index)}:${key}`;variantIndex[k]=((variantIndex[k]||0)+1)%values.length;});render();}
  function openVisual(prompt,index){
    const bank=VISUAL_BANKS[prompt.visual]||[];if(!bank.length)return;const k=keyFor(index);
    const show=()=>{const idx=(visualIndex[k]||0)%bank.length;const [emoji,label]=bank[idx];const modal=document.createElement('div');modal.className='speaking-visual-modal';modal.innerHTML=`<button class="speaking-visual-close" type="button" aria-label="Close">×</button><div class="speaking-visual-card"><div class="speaking-visual-emoji">${emoji}</div><div class="speaking-visual-label">${label}</div><button class="btn btn-ghost speaking-visual-next" type="button">${tx('다음 그림','Next picture')}</button></div>`;document.body.appendChild(modal);modal.querySelector('.speaking-visual-close').addEventListener('click',()=>modal.remove());modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});modal.querySelector('.speaking-visual-next').addEventListener('click',()=>{visualIndex[k]=(idx+1)%bank.length;modal.remove();show();});};show();
  }
  function promptCard(raw,index){const prompt=asPrompt(raw);return `<article class="speaking-prompt-card"><div class="speaking-prompt-row"><div class="speaking-prompt-text">${resolvedText(prompt,index)}</div><div class="speaking-prompt-tools">${prompt.variants?`<button type="button" class="prompt-tool" data-change-prompt="${index}">↻ ${tx('바꾸기','Change')}</button>`:''}${prompt.visual?`<button type="button" class="prompt-tool prompt-visual" data-visual-prompt="${index}">▣ ${tx('그림 보기','Show picture')}</button>`:''}</div></div><div class="speaking-rubric" aria-label="Score">${SPEAKING_RUBRIC.map(r=>`<button type="button" data-prompt="${index}" data-score="${r.score}" class="${selectedScore(index)===r.score?'is-selected':''}" title="${r.detail}">${r.label}</button>`).join('')}</div><div class="speaking-prompt-actions"><button type="button" class="record-hook" data-record="${index}">● ${tx('녹음','Record')}</button><span>${tx('선택 사항','Optional')}</span></div></article>`;}

  function render(){
    const list=prompts[level]||[];
    const rec=recommendation();
    const recLabel=rec.recommended_level?LEVEL_LABELS[rec.recommended_level]:tx('아직 없음','Not enough evidence');
    const confidence=rec.confidence==='high'?tx('높은 신뢰도','High confidence'):rec.confidence==='medium'?tx('중간 신뢰도','Medium confidence'):rec.confidence==='low'?tx('낮은 신뢰도','Low confidence'):tx('채점 필요','Score some answers');
    host.innerHTML=`<section class="speaking-workspace">
      <div class="speaking-topline"><div><div class="eyebrow">${tx('선생님 말하기 평가','Teacher Speaking Assessment')}</div><h2>${tx('말하기 레벨 확인','Speaking level check')}</h2></div><select class="speaking-jump" aria-label="Level">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===level?'selected':''}>${LEVEL_LABELS[i+1]}</option>`).join('')}</select></div>
      <div class="speaking-level-bar"><button type="button" class="btn btn-ghost" data-level-prev ${level===1?'disabled':''}>← ${tx('이전','Previous')}</button><div class="speaking-level">${LEVEL_LABELS[level]}</div><button type="button" class="btn btn-ghost" data-level-next ${level===12?'disabled':''}>${tx('다음','Next')} →</button></div>
      <p class="speaking-help">${tx('필요한 질문만 사용하세요. 채점한 답변만 추천 레벨 계산에 사용됩니다.','Use only the prompts you need. Only scored answers affect the recommendation.')}</p>
      <div class="speaking-prompts">${list.map(promptCard).join('')}</div>
      <div class="speaking-teacher-panel speaking-decision-panel">
        <div class="speaking-recommendation-card"><span>${tx('앱 추천 시작 레벨','App recommended start')}</span><strong>${recLabel}</strong><small>${confidence}${rec.evidence_count?` · ${rec.evidence_count} ${tx('개 답변','scored')}`:''}</small></div>
        <label>${tx('선생님 말하기 판단','Teacher speaking level')}<select id="teacherSpeakingLevel">${options(teacherLevel)}</select><small>${tx('말하기 자체에 대한 선생님 판단','Your own judgment of speaking ability')}</small></label>
        <label class="speaking-start-label">${tx('컴퓨터 테스트 시작 레벨','Computer test start level')}<select id="teacherStartLevel">${options(startLevel,tx('추천 사용','Use recommendation'))}</select><small>${startOverridden?tx('선생님이 추천을 재정의함','Teacher override active'):tx('앱 추천을 자동으로 따라갑니다','Following app recommendation automatically')}</small></label>
        <label>${tx('메모','Notes')}<textarea id="speakingNotes" rows="3" placeholder="${tx('선택 사항','Optional')}">${notes||''}</textarea></label>
      </div>
      <div class="actions"><button type="button" class="btn btn-ghost" data-speaking-back>${tx('뒤로','Back')}</button><button type="button" class="btn btn-primary" data-speaking-complete ${!startLevel?'disabled':''}>${tx('말하기 평가 완료','Complete speaking')}</button></div>
    </section>`;
    bind();
  }

  function bind(){
    host.querySelector('[data-level-prev]')?.addEventListener('click',()=>move(-1));
    host.querySelector('[data-level-next]')?.addEventListener('click',()=>move(1));
    host.querySelector('.speaking-jump')?.addEventListener('change',e=>{level=Number(e.target.value);save();render();});
    host.querySelectorAll('[data-score]').forEach(btn=>btn.addEventListener('click',()=>scorePrompt(Number(btn.dataset.prompt),Number(btn.dataset.score))));
    host.querySelectorAll('[data-change-prompt]').forEach(btn=>btn.addEventListener('click',()=>cycleVariants(asPrompt((prompts[level]||[])[Number(btn.dataset.changePrompt)]),Number(btn.dataset.changePrompt))));
    host.querySelectorAll('[data-visual-prompt]').forEach(btn=>btn.addEventListener('click',()=>openVisual(asPrompt((prompts[level]||[])[Number(btn.dataset.visualPrompt)]),Number(btn.dataset.visualPrompt))));
    host.querySelector('#teacherSpeakingLevel')?.addEventListener('change',e=>{teacherLevel=e.target.value?Number(e.target.value):null;save();});
    host.querySelector('#teacherStartLevel')?.addEventListener('change',e=>{if(e.target.value){startLevel=Number(e.target.value);startOverridden=true;}else{startOverridden=false;syncRecommendedStart();}save();render();});
    host.querySelector('#speakingNotes')?.addEventListener('input',e=>{notes=e.target.value;save();});
    host.querySelectorAll('[data-record]').forEach(btn=>btn.addEventListener('click',()=>{btn.textContent=tx('녹음 연결 준비됨','Recording hook ready');btn.disabled=true;}));
    host.querySelector('[data-speaking-back]')?.addEventListener('click',()=>onBack?.());
    host.querySelector('[data-speaking-complete]')?.addEventListener('click',()=>onComplete?.(state()));
    let x0=null;host.addEventListener('touchstart',e=>{x0=e.touches?.[0]?.clientX??null;},{passive:true,once:true});host.addEventListener('touchend',e=>{if(x0==null)return;const dx=(e.changedTouches?.[0]?.clientX??x0)-x0;if(Math.abs(dx)>70)move(dx<0?1:-1);},{passive:true,once:true});
  }

  render();
  return {getState:state,destroy:()=>{document.querySelectorAll('.speaking-visual-modal').forEach(x=>x.remove());host.innerHTML='';}};
}
