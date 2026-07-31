import{loadQuestionBank}from'./assessment-loader.js?v=20260730-12';

const root=document.querySelector('#app');
const SUPABASE_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const SUPABASE_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
const evidence=[];
let bank=[];
let profiles=new Map();
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
const levelNames={1:'Starter 1',2:'Starter 2',3:'Level 1',4:'Level 2',5:'Level 3',6:'Level 4',7:'Level 5',8:'Level 6',9:'Level 7',10:'Level 8'};
const levelNamesKo={1:'스타터 1',2:'스타터 2',3:'레벨 1',4:'레벨 2',5:'레벨 3',6:'레벨 4',7:'레벨 5',8:'레벨 6',9:'레벨 7',10:'레벨 8'};
const skillFor=type=>({vocabulary:'vocabulary',grammar:'grammar',grammar_error:'grammar',question_response:'grammar',listening:'listening',reading:'reading',sentence_unscramble:'sentence_building',speaking:'speaking',writing:'writing'}[type]||null);
const skillLabels={
 vocabulary:{en:'Vocabulary',ko:'어휘'},grammar:{en:'Grammar',ko:'문법'},listening:{en:'Listening',ko:'듣기'},
 reading:{en:'Reading',ko:'읽기'},sentence_building:{en:'Sentence building',ko:'문장 만들기'},
 speaking:{en:'Speaking',ko:'말하기'},writing:{en:'Writing',ko:'쓰기'}
};
const assessedSkills=['vocabulary','grammar','listening','reading','sentence_building'];
const allSkills=[...assessedSkills,'speaking','writing'];

loadQuestionBank().then(items=>bank=items).catch(()=>{});
fetch(`${SUPABASE_URL}/rest/v1/assessment_report_profiles?select=level_id,skill,summary_en,summary_ko,next_step_en,next_step_ko&status=eq.published&order=level_id.asc,sort_order.asc`,{headers,cache:'no-store'})
 .then(r=>{if(!r.ok)throw new Error(`Report profiles ${r.status}`);return r.json()})
 .then(rows=>{profiles=new Map(rows.map(row=>[`${row.level_id}:${row.skill}`,row]));rerenderVisibleReport()})
 .catch(error=>console.warn('Could not load reviewed report profiles',error));

function visibleQuestion(){
 const card=root?.querySelector('.question-card');
 if(!card)return null;
 const direct=card.getAttribute('data-question-id');
 if(direct){const found=bank.find(q=>q.id===direct);if(found)return found}
 const choices=[...card.querySelectorAll('.choice')].map(x=>clean(x.dataset.value||x.textContent));
 if(choices.length){
  const text=clean(card.textContent);
  const candidates=bank.filter(q=>q.type!=='sentence_unscramble'&&sameSet([...q.choices].map(clean),choices));
  return candidates.find(q=>text.includes(clean(q.q)))||candidates[0]||null;
 }
 const tokens=[...card.querySelectorAll('.scramble-token')].map(x=>clean(x.textContent));
 return tokens.length?bank.find(q=>q.type==='sentence_unscramble'&&sameSet([...q.tokens].map(clean),tokens))||null:null;
}
function recordAnswer(){
 const q=visibleQuestion();
 if(!q||evidence.some(x=>x.id===q.id))return;
 if(q.type==='sentence_unscramble'){
  const selected=[...root.querySelectorAll('.scramble-answer .scramble-token')].map(x=>clean(x.textContent));
  if(!selected.length)return;
  evidence.push({id:q.id,level:Number(q.level)||1,type:q.type,correct:selected.length===q.tokens.length&&selected.every((x,i)=>x===clean(q.tokens[i]))});
  return;
 }
 const selected=root.querySelector('.choice.selected');
 if(!selected)return;
 evidence.push({id:q.id,level:Number(q.level)||1,type:q.type,correct:clean(selected.dataset.value||selected.textContent)===clean(q.a)});
}
document.addEventListener('click',e=>{
 if(e.target.closest('#next'))recordAnswer();
 if(e.target.closest('#retry,#home'))evidence.length=0;
 if(e.target.closest('#languageBtn'))setTimeout(()=>rerenderVisibleReport(true),0);
},true);

function probabilities(rows,maxLevel=10){
 if(!rows.length)return[];
 const ceiling=Math.max(1,Math.min(10,Number(maxLevel)||10));
 const scores=[];
 for(let level=1;level<=ceiling;level++){
  let log=0;
  for(const row of rows){
   const p=1/(1+Math.exp((row.level-level)*1.12));
   log+=Math.log(Math.max(.025,Math.min(.975,row.correct?p:1-p)));
  }
  scores.push({level,log});
 }
 const max=Math.max(...scores.map(x=>x.log));
 const weighted=scores.map(x=>({...x,w:Math.exp(x.log-max)}));
 const total=weighted.reduce((s,x)=>s+x.w,0)||1;
 return weighted.map(x=>({level:x.level,pct:x.w/total*100})).sort((a,b)=>b.pct-a.pct);
}
function overallLevel(){
 if(!evidence.length)return 1;
 const max=Math.max(...evidence.map(x=>x.level),1);
 return probabilities(evidence,max)[0]?.level||1;
}
function estimateSkill(skill){
 const rows=evidence.filter(x=>skillFor(x.type)===skill);
 if(rows.length<2)return{assessed:false,rows};
 const highest=Math.max(...rows.map(x=>x.level));
 const fit=probabilities(rows,highest)[0]||{level:1,pct:0};
 const top=rows.filter(x=>x.level===highest);
 return{assessed:true,rows,level:fit.level,confidence:Math.round(Math.min(96,50+rows.length*6+fit.pct*.22)),plus:fit.level===highest&&top.length&&top.every(x=>x.correct)};
}
function profile(level,skill){return profiles.get(`${level}:${skill}`)||null}
function txt(row,field,ko,fallback=''){return clean(row?.[`${field}_${ko?'ko':'en'}`])||fallback}
function labelLevel(level,ko,plus=false){return `${ko?levelNamesKo[level]:levelNames[level]}${plus?'+':''}`}

function journey(best,ko){
 const short={1:'S1',2:'S2',3:'1',4:'2',5:'3',6:'4',7:'5',8:'6',9:'7',10:'8'};
 const nodes=Array.from({length:10},(_,i)=>{
  const level=i+1,cls=level<best?'is-complete':level===best?'is-current':'';
  return `<div class="level-node ${cls}"><div class="level-node__marker">${short[level]}</div><span class="level-node__label">${ko?levelNamesKo[level]:levelNames[level]}</span></div>`;
 }).join('');
 const left=((best-.5)/10)*100;
 const width=Math.max(0,Math.min(100,((best-.5)/10)*100));
 return `<div class="level-journey"><div class="level-journey__here" style="left:${left}%">${ko?'현재 레벨':'You are here'}</div><div class="level-journey__track"><div class="level-journey__fill" style="width:${width}%"></div></div><div class="level-journey__nodes">${nodes}</div></div>`;
}
function skillRow(skill,best,ko){
 const result=estimateSkill(skill);
 const name=skillLabels[skill][ko?'ko':'en'];
 if(!result.assessed){
  const note=skill==='speaking'||skill==='writing'
   ?(ko?'현재 버전의 테스트에는 이 영역을 평가할 문항이 아직 포함되어 있지 않습니다.':'This version of the test does not yet include enough tasks to assess this skill.')
   :(ko?'이 영역의 레벨을 신뢰성 있게 판단할 만큼 충분한 문항이 출제되지 않았습니다.':'Not enough questions were included to estimate this skill reliably.');
  return `<div class="report-skill is-unassessed"><div class="report-skill__head"><strong>${name}</strong><span class="report-skill__level">${ko?'평가되지 않음':'Not assessed'}</span></div><p class="report-skill__note">${note}</p></div>`;
 }
 const p=profile(result.level,skill);
 const note=txt(p,'summary',ko,ko?'이 영역의 결과 설명을 준비 중입니다.':'A reviewed description for this result is being prepared.');
 return `<div class="report-skill"><div class="report-skill__head"><strong>${name}</strong><span class="report-skill__level">${labelLevel(result.level,ko,result.plus)}</span></div><div class="report-skill__track"><i style="width:${result.confidence}%"></i></div><p class="report-skill__note">${note}</p></div>`;
}
function canDoItems(best,ko){
 const assessed=assessedSkills.map(skill=>({skill,result:estimateSkill(skill)})).filter(x=>x.result.assessed);
 const items=assessed.slice(0,4).map(x=>txt(profile(x.result.level,x.skill),'summary',ko,'')).filter(Boolean);
 if(items.length<2){
  const overall=txt(profile(best,'overall'),'summary',ko,ko?'현재 수준에서 익숙한 영어를 이해하고 사용할 수 있습니다.':'Can understand and use familiar English at this level.');
  items.unshift(overall);
 }
 return [...new Set(items)].slice(0,4).map(x=>`<li>${x}</li>`).join('');
}
function nextStep(best,ko){
 const assessed=assessedSkills.map(skill=>({skill,result:estimateSkill(skill)})).filter(x=>x.result.assessed);
 const weakest=assessed.sort((a,b)=>a.result.level-b.result.level)[0];
 if(weakest){
  const row=profile(weakest.result.level,weakest.skill);
  const text=txt(row,'next_step',ko,'');
  if(text)return text;
 }
 return txt(profile(best,'overall'),'next_step',ko,ko?'다음 단계의 영어를 정확하게 사용할 수 있도록 꾸준히 연습해 주세요.':'Continue practising the next level of English with growing accuracy and independence.');
}
function reportMarkup(){
 const ko=document.documentElement.lang==='ko';
 const best=overallLevel();
 const overall=profile(best,'overall');
 const summary=txt(overall,'summary',ko,ko?'현재 실력으로 무리 없이 시작하면서도 충분히 도전할 수 있는 단계입니다.':'This is a comfortable but challenging starting point.');
 return `<section class="report-hero">
   <span class="report-kicker">${ko?'추천 시작 레벨':'Estimated starting level'}</span>
   <div class="report-level"><span>${ko?(best<=2?'스타터':'레벨'):(best<=2?'Starter':'Level')}</span><strong>${best<=2?best:best-2}</strong></div>
   <p class="report-summary">${summary}</p>
   ${journey(best,ko)}
  </section>
  <section class="report-card"><h3>${ko?'현재 할 수 있는 것':'What your child can do'}</h3><ul class="report-can-do">${canDoItems(best,ko)}</ul></section>
  <section class="report-card is-next"><h3>${ko?'앞으로 연습하면 좋은 것':'Ready to work on'}</h3><p>${nextStep(best,ko)}</p></section>
  <section class="report-card"><h3>${ko?'영역별 예상 레벨':'Estimated level by skill'}</h3>${allSkills.map(s=>skillRow(s,best,ko)).join('')}</section>
  <section class="report-card"><h3>${ko?'이 결과는 무엇을 의미하나요?':'What does this result mean?'}</h3><p>${ko?'이 결과는 합격이나 불합격을 판단하는 점수가 아닙니다. 자녀가 어느 단계에서 가장 편안하게 학습을 시작할 수 있는지 보여주는 참고 자료입니다.':'This is not a pass-or-fail score. It is a guide to the level where your child is most likely to begin learning comfortably and successfully.'}</p></section>
  <p class="report-method">${ko?'영역별 레벨은 해당 유형의 문항이 두 개 이상 출제된 경우에만 표시되며, 실제로 출제된 최고 레벨을 넘지 않습니다. +는 최고 출제 레벨의 문항을 모두 맞혔다는 뜻입니다.':'A skill estimate appears only after at least two questions and never exceeds the highest level actually tested. A + means all questions at that top tested level were answered correctly.'}</p>
  <div class="actions report-actions"><button class="btn btn-primary" id="retry">${ko?'다시 테스트하기':'Try again'}</button><button class="btn btn-ghost" id="home">${ko?'처음으로 돌아가기':'Back to start'}</button></div>`;
}
function renderReport(force=false){
 const screen=root?.querySelector('.screen');
 if(!screen||!screen.querySelector('.result-title')&&!screen.classList.contains('report-screen'))return;
 if(screen.dataset.enhancedReport==='1'&&!force)return;
 screen.dataset.enhancedReport='1';
 screen.classList.add('report-screen');
 screen.innerHTML=reportMarkup();
}
function rerenderVisibleReport(){
 const screen=root?.querySelector('.report-screen');
 if(screen){screen.dataset.enhancedReport='';renderReport(true)}
}
function polishContent(){
 root?.querySelectorAll('.reading-passage').forEach(box=>{
  const text=clean(box.textContent);
  if(text&&text.length<=8&&!/[A-Za-z0-9가-힣]/.test(text))box.classList.add('emoji-passage');
 });
 renderReport();
}
new MutationObserver(polishContent).observe(root,{childList:true,subtree:true});
new MutationObserver(()=>rerenderVisibleReport()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
polishContent();
