const LEVEL_LABELS={1:'Starter 1',2:'Starter 2',3:'Level 1',4:'Level 2',5:'Level 3',6:'Level 4',7:'Level 5',8:'Level 6',9:'Level 7',10:'Level 8',11:'Level 9',12:'Level 10'};

const DEFAULT_PROMPTS={
  1:['What is your name?','How old are you?','What color do you like?'],
  2:['Do you like pizza?','What food do you like?','Can you ride a bike?'],
  3:['Where is your pencil?','Is there a computer in your classroom?','Can your friend swim?'],
  4:['What are you doing now?','What is your teacher doing?','What does your friend have?'],
  5:['What do you do after school?','How do you go to school?','What school subject do you like?'],
  6:['What did you do yesterday?','What are you going to do this weekend?','What should you do when you have a headache?'],
  7:['Have you ever ridden a horse?','What do you want to be when you grow up?','If it rains tomorrow, what will you do?'],
  8:['How long have you studied English?','Tell me about something you have already finished today.','What is something you do not have to do on weekends?'],
  9:['Tell me something your teacher said recently.','Tell me about something you should have done differently.','Describe something you own that is very useful.'],
  10:['What will happen unless you study for a test?','Tell me about a rule that students are expected to follow.','Tell me about something you were asked to do recently.'],
  11:['What did you use to do when you were younger?','What are you used to doing every day now?','Tell me about something you find difficult to do.'],
  12:['Tell me about something you could have done differently this week.','Tell me about something you needn’t have worried about.','What must have happened if a student arrived with no books or bag?']
};

export const SPEAKING_RUBRIC=[
  {score:1,label:'1',detail:'Cannot understand / answer'},
  {score:2,label:'2',detail:'Needs substantial help'},
  {score:3,label:'3',detail:'Basic understandable answer'},
  {score:4,label:'4',detail:'Clear complete answer'},
  {score:5,label:'5',detail:'Natural extended answer'}
];

export function createSpeakingAssessment({host,session,lang='ko',prompts=DEFAULT_PROMPTS,onChange,onBack,onComplete}={}){
  let level=Math.max(1,Math.min(12,Number(session?.speaking?.current_level||3)));
  let evidence=Array.isArray(session?.speaking?.evidence)?[...session.speaking.evidence]:[];
  let teacherLevel=session?.speaking?.teacher_level||null;
  let notes=session?.speaking?.teacher_notes||'';
  const tx=(ko,en)=>lang==='ko'?ko:en;

  function selectedScore(promptIndex){return evidence.find(x=>x.level===level&&x.prompt_index===promptIndex)?.score||null;}
  function save(){onChange?.({current_level:level,evidence:[...evidence],teacher_level:teacherLevel,teacher_notes:notes});}
  function scorePrompt(promptIndex,score){
    evidence=evidence.filter(x=>!(x.level===level&&x.prompt_index===promptIndex));
    evidence.push({level,prompt_index:promptIndex,score,scored_at:new Date().toISOString()});
    save();render();
  }
  function move(delta){level=Math.max(1,Math.min(12,level+delta));save();render();}

  function render(){
    const list=prompts[level]||[];
    host.innerHTML=`<section class="speaking-workspace">
      <div class="speaking-topline"><div><div class="eyebrow">${tx('선생님 말하기 평가','Teacher Speaking Assessment')}</div><h2>${tx('말하기 레벨 확인','Speaking level check')}</h2></div><select class="speaking-jump" aria-label="Level">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===level?'selected':''}>${LEVEL_LABELS[i+1]}</option>`).join('')}</select></div>
      <div class="speaking-level-bar"><button type="button" class="btn btn-ghost" data-level-prev ${level===1?'disabled':''}>← ${tx('이전','Previous')}</button><div class="speaking-level">${LEVEL_LABELS[level]}</div><button type="button" class="btn btn-ghost" data-level-next ${level===12?'disabled':''}>${tx('다음','Next')} →</button></div>
      <p class="speaking-help">${tx('필요한 질문만 사용하세요. 질문을 건너뛰어도 불이익이 없습니다.','Use as many or as few prompts as useful. Skipped prompts are neutral.')}</p>
      <div class="speaking-prompts">${list.map((prompt,i)=>`<article class="speaking-prompt-card"><div class="speaking-prompt-text">${prompt}</div><div class="speaking-rubric" aria-label="Score">${SPEAKING_RUBRIC.map(r=>`<button type="button" data-prompt="${i}" data-score="${r.score}" class="${selectedScore(i)===r.score?'is-selected':''}" title="${r.detail}">${r.label}</button>`).join('')}</div><div class="speaking-prompt-actions"><button type="button" class="record-hook" data-record="${i}">● ${tx('녹음','Record')}</button><span>${tx('선택 사항','Optional')}</span></div></article>`).join('')}</div>
      <div class="speaking-teacher-panel"><label>${tx('선생님 전체 말하기 판단','Teacher overall speaking impression')}<select id="teacherSpeakingLevel"><option value="">—</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${Number(teacherLevel)===i+1?'selected':''}>${LEVEL_LABELS[i+1]}</option>`).join('')}</select></label><label>${tx('메모','Notes')}<textarea id="speakingNotes" rows="3" placeholder="${tx('선택 사항','Optional')}">${notes||''}</textarea></label></div>
      <div class="actions"><button type="button" class="btn btn-ghost" data-speaking-back>${tx('뒤로','Back')}</button><button type="button" class="btn btn-primary" data-speaking-complete>${tx('말하기 평가 완료','Complete speaking')}</button></div>
    </section>`;
    bind();
  }

  function bind(){
    host.querySelector('[data-level-prev]')?.addEventListener('click',()=>move(-1));
    host.querySelector('[data-level-next]')?.addEventListener('click',()=>move(1));
    host.querySelector('.speaking-jump')?.addEventListener('change',e=>{level=Number(e.target.value);save();render();});
    host.querySelectorAll('[data-score]').forEach(btn=>btn.addEventListener('click',()=>scorePrompt(Number(btn.dataset.prompt),Number(btn.dataset.score))));
    host.querySelector('#teacherSpeakingLevel')?.addEventListener('change',e=>{teacherLevel=e.target.value?Number(e.target.value):null;save();});
    host.querySelector('#speakingNotes')?.addEventListener('input',e=>{notes=e.target.value;save();});
    host.querySelectorAll('[data-record]').forEach(btn=>btn.addEventListener('click',()=>{btn.textContent=tx('녹음 연결 준비됨','Recording hook ready');btn.disabled=true;}));
    host.querySelector('[data-speaking-back]')?.addEventListener('click',()=>onBack?.());
    host.querySelector('[data-speaking-complete]')?.addEventListener('click',()=>onComplete?.({current_level:level,evidence:[...evidence],teacher_level:teacherLevel,teacher_notes:notes}));
    let x0=null;
    host.addEventListener('touchstart',e=>{x0=e.touches?.[0]?.clientX??null;},{passive:true,once:true});
    host.addEventListener('touchend',e=>{if(x0==null)return;const dx=(e.changedTouches?.[0]?.clientX??x0)-x0;if(Math.abs(dx)>70)move(dx<0?1:-1);},{passive:true,once:true});
  }

  render();
  return {getState:()=>({current_level:level,evidence:[...evidence],teacher_level:teacherLevel,teacher_notes:notes}),destroy:()=>{host.innerHTML='';}};
}
