const DEFAULT_PROMPTS={
  1:[
    'What is your name?',
    'How old are you?',
    'What color do you like?',
    'Do you like pizza?',
    'What animal do you like?',
    'Who is in your family?'
  ],
  2:[
    'Tell me about your family.',
    'What do you do after school?',
    'What food do you like and why?',
    'What is your favorite game?',
    'Tell me about your best friend.',
    'What do you usually do on weekends?'
  ],
  3:[
    'Tell me about your school day.',
    'What did you do yesterday?',
    'What are you good at?',
    'What do you want to do this weekend?',
    'Describe your classroom.',
    'Tell me about a time you were very happy.'
  ],
  4:[
    'Describe a fun weekend.',
    'What makes a good friend?',
    'What would you like to learn?',
    'Tell me about a movie, book, or show you like.',
    'What is something difficult for you at school?',
    'If you could have any pet, what would you choose and why?'
  ],
  5:[
    'Tell me about a problem you solved.',
    'Which is better: studying alone or with friends? Why?',
    'Describe a place you would like to visit.',
    'What is one rule at school you think is important?',
    'Tell me about something you are proud of.',
    'If you could change one thing about your daily routine, what would it be?'
  ],
  6:[
    'Tell me about something you recently learned.',
    'What makes a class interesting?',
    'Explain a rule you think is important.',
    'Describe a person who has taught you something important.',
    'What are the advantages of having a hobby?',
    'If you had an extra hour every day, how would you use it?'
  ],
  7:[
    'Describe a difficult decision you made.',
    'How has technology changed learning?',
    'What is one thing you would improve about your town?',
    'Tell me about a time your plan did not work and what you did next.',
    'Do students learn more from success or failure? Explain.',
    'What qualities make someone a good leader?'
  ],
  8:[
    'Do schools give students enough independence? Explain.',
    'Describe an experience that changed your opinion.',
    'What makes communication effective?',
    'Should students have more choice about what they study?',
    'How can people solve conflicts fairly?',
    'What is one modern convenience people rely on too much?'
  ],
  9:[
    'Should success be measured by results or effort?',
    'Explain a social issue young people face.',
    'How can people disagree productively?',
    'Do social media platforms help or harm communication overall?',
    'When should people follow rules, and when is it reasonable to challenge them?',
    'What is more important for learning: curiosity, discipline, or talent? Why?'
  ],
  10:[
    'Discuss a change in society that has both benefits and drawbacks.',
    'What responsibilities come with freedom?',
    'Explain how context can change the meaning of a message.',
    'Should schools prioritize practical skills or academic knowledge?',
    'How should people balance personal goals with responsibilities to others?',
    'Can technology solve most environmental problems, or are lifestyle changes more important?'
  ],
  11:[
    'Evaluate whether competition generally improves performance.',
    'Discuss a situation where the obvious solution may not be the best one.',
    'How should we judge the reliability of information?',
    'To what extent should governments limit individual choice for the public good?',
    'Is it possible to be truly objective when making important decisions?',
    'What makes an argument persuasive rather than merely confident?'
  ],
  12:[
    'Defend a nuanced position on whether technological progress necessarily improves quality of life.',
    'Explain how assumptions can distort decision-making.',
    'Discuss the trade-offs involved in standardizing education.',
    'To what extent should societies preserve traditions that conflict with changing social values?',
    'Is equality of opportunity enough to create a fair society? Why or why not?',
    'Discuss whether uncertainty should make decision-makers more cautious or more adaptable.'
  ]
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
      <div class="speaking-topline"><div><div class="eyebrow">${tx('선생님 말하기 평가','Teacher Speaking Assessment')}</div><h2>${tx('말하기 레벨 확인','Speaking level check')}</h2></div><select class="speaking-jump" aria-label="Level">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===level?'selected':''}>Level ${i+1}</option>`).join('')}</select></div>
      <div class="speaking-level-bar"><button type="button" class="btn btn-ghost" data-level-prev ${level===1?'disabled':''}>← ${tx('이전 레벨','Previous')}</button><div class="speaking-level">Level ${level}</div><button type="button" class="btn btn-ghost" data-level-next ${level===12?'disabled':''}>${tx('다음 레벨','Next')} →</button></div>
      <p class="speaking-help">${tx('필요한 질문만 사용하세요. 질문을 건너뛰어도 불이익이 없습니다.','Use as many or as few prompts as useful. Skipped prompts are neutral.')}</p>
      <div class="speaking-prompts">${list.map((prompt,i)=>`<article class="speaking-prompt-card"><div class="speaking-prompt-text">${prompt}</div><div class="speaking-rubric" aria-label="Score">${SPEAKING_RUBRIC.map(r=>`<button type="button" data-prompt="${i}" data-score="${r.score}" class="${selectedScore(i)===r.score?'is-selected':''}" title="${r.detail}">${r.label}</button>`).join('')}</div><div class="speaking-prompt-actions"><button type="button" class="record-hook" data-record="${i}">● ${tx('녹음','Record')}</button><span>${tx('선택 사항','Optional')}</span></div></article>`).join('')}</div>
      <div class="speaking-teacher-panel"><label>${tx('선생님 전체 말하기 판단','Teacher overall speaking impression')}<select id="teacherSpeakingLevel"><option value="">—</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${Number(teacherLevel)===i+1?'selected':''}>Level ${i+1}</option>`).join('')}</select></label><label>${tx('메모','Notes')}<textarea id="speakingNotes" rows="3" placeholder="${tx('선택 사항','Optional')}">${notes||''}</textarea></label></div>
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
