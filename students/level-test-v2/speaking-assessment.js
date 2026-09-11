const DEFAULT_PROMPTS={
  1:[
    'What is your name?',
    'How old are you?',
    'What color do you like?',
    'Do you like cats?',
    'What is this? (point to an object)',
    'Who is in your family?'
  ],
  2:[
    'What do you like to eat?',
    'What do you do after school?',
    'Tell me about your family.',
    'What is your favorite game?',
    'What do you do on Sunday?',
    'What can you do well?'
  ],
  3:[
    'Tell me about your classroom.',
    'What time do you get up?',
    'What did you do yesterday?',
    'What are you going to do this weekend?',
    'Tell me about your best friend.',
    'What do you like doing with your family?'
  ],
  4:[
    'Tell me about your school day.',
    'What did you eat for dinner yesterday?',
    'Tell me about a fun weekend.',
    'What do you want to do during vacation?',
    'Describe your room at home.',
    'Which school subject do you like best? Why?'
  ],
  5:[
    'Tell me about a movie or cartoon you like.',
    'Describe a place you like to visit.',
    'What happened the last time you met your friends?',
    'What are you planning to do next weekend?',
    'Which is better, summer or winter? Why?',
    'What makes a good friend?'
  ],
  6:[
    'Tell me about something you learned recently.',
    'Describe a trip or day out you remember well.',
    'What do you do when you have a lot of homework?',
    'If a friend feels sad, what can you do?',
    'Which is better, studying at home or at school? Why?',
    'What is something you want to get better at?'
  ],
  7:[
    'Tell me about a time something did not go as planned.',
    'Describe a goal you have and how you can reach it.',
    'What makes a class interesting?',
    'Do you prefer working alone or in a group? Why?',
    'Tell me about a useful app or device you use.',
    'What would you change about your school day?'
  ],
  8:[
    'Tell me about a decision you made recently.',
    'What are the good and bad things about using smartphones?',
    'How can students help a new student feel comfortable?',
    'Do students need homework every day? Why or why not?',
    'Describe a skill you would like to learn in the future.',
    'What can people do to stay healthy?'
  ],
  9:[
    'Tell me about a time you changed your mind about something.',
    'What are the advantages and disadvantages of studying online?',
    'Should students be allowed to use phones in class? Explain.',
    'What makes someone a good team member?',
    'What is one problem young people have today?',
    'Would you rather live in a big city or a small town? Why?'
  ],
  10:[
    'Describe a challenge you faced and how you dealt with it.',
    'Do you think school prepares students well for adult life? Why or why not?',
    'What are some good and bad effects of social media?',
    'Should students have more choice in what they study?',
    'What is one thing you would improve in your community?',
    'Is it better to be very talented or very hardworking? Explain.'
  ],
  11:[
    'Tell me about an experience that taught you an important lesson.',
    'How has technology changed the way students learn?',
    'What makes information online trustworthy?',
    'Should schools focus more on practical skills? Why or why not?',
    'What are some benefits and problems of competition?',
    'When people disagree, what helps them communicate well?'
  ],
  12:[
    'Describe an issue that matters to young people and explain your view.',
    'How should people balance personal goals with responsibilities to others?',
    'What are the benefits and risks of depending heavily on technology?',
    'Should schools treat all students the same, or adapt more to individual needs?',
    'What makes a strong argument when people have different opinions?',
    'What is one change you think would improve education, and why?'
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
