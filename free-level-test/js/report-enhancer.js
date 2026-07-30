import{loadQuestionBank}from'./assessment-loader.js?v=20260730-12';

const root=document.querySelector('#app');
let bank=[];
const evidence=[];
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
const skillFor=type=>({vocabulary:'Vocabulary',grammar:'Grammar',grammar_error:'Grammar',question_response:'Grammar',listening:'Listening',reading:'Reading',sentence_unscramble:'Sentence building'}[type]||null);

loadQuestionBank().then(items=>bank=items).catch(()=>{});

function visibleQuestion(){
 const card=root?.querySelector('.question-card');
 if(!card)return null;
 const choices=[...card.querySelectorAll('.choice')].map(x=>clean(x.dataset.value||x.textContent));
 const text=clean(card.textContent);
 const candidates=bank.filter(q=>q.type!=='sentence_unscramble'&&sameSet([...q.choices].map(clean),choices));
 return candidates.find(q=>text.includes(clean(q.q)))||candidates[0]||null;
}

function recordAnswer(){
 const q=visibleQuestion();
 if(!q||evidence.some(x=>x.id===q.id))return;
 const selected=root.querySelector('.choice.selected');
 if(!selected)return;
 const answer=clean(selected.dataset.value||selected.textContent);
 evidence.push({id:q.id,level:Number(q.level)||1,type:q.type,correct:answer===clean(q.a)});
}

document.addEventListener('click',e=>{
 if(e.target.closest('#next'))recordAnswer();
 if(e.target.closest('#retry,#home'))evidence.length=0;
},true);

function probabilities(rows){
 if(!rows.length)return[];
 const scores=[];
 for(let level=1;level<=10;level++){
  let log=0;
  for(const row of rows){
   const p=1/(1+Math.exp((row.level-level)*1.12));
   const observed=row.correct?p:1-p;
   log+=Math.log(Math.max(.025,Math.min(.975,observed)));
  }
  scores.push({level,log});
 }
 const max=Math.max(...scores.map(x=>x.log));
 const weighted=scores.map(x=>({...x,w:Math.exp(x.log-max)}));
 const total=weighted.reduce((s,x)=>s+x.w,0)||1;
 return weighted.map(x=>({level:x.level,pct:x.w/total*100})).sort((a,b)=>b.pct-a.pct);
}

function nearestFit(rows,count=4){
 const probs=probabilities(rows);
 const peak=probs[0]?.level||1;
 return probs.filter(x=>Math.abs(x.level-peak)<=2).sort((a,b)=>b.pct-a.pct).slice(0,count);
}

function barRows(fits){
 const total=fits.reduce((s,x)=>s+x.pct,0)||1;
 return fits.map((x,i)=>{
  const pct=Math.round(x.pct/total*100);
  return `<div class="fit-row ${i===0?'best':''}"><div class="fit-label"><span>Level ${x.level}</span><strong>${pct}%</strong></div><div class="fit-track"><i style="width:${pct}%"></i></div></div>`;
 }).join('');
}

function skillRows(){
 const order=['Vocabulary','Grammar','Listening','Reading','Sentence building'];
 return order.map(name=>{
  const rows=evidence.filter(x=>skillFor(x.type)===name);
  if(rows.length<2)return `<div class="skill-row insufficient"><div><strong>${name}</strong><small>${document.documentElement.lang==='ko'?'근거 부족':'Not enough evidence'}</small></div><span>—</span></div>`;
  const fit=probabilities(rows)[0];
  const confidence=Math.round(Math.min(96,50+rows.length*6+fit.pct*.22));
  return `<div class="skill-row"><div class="skill-heading"><strong>${name}</strong><span>Level ${fit.level}</span></div><div class="skill-track"><i style="width:${confidence}%"></i></div><small>${rows.length} questions</small></div>`;
 }).join('');
}

function renderReport(){
 const screen=root?.querySelector('.screen');
 if(!screen||!screen.querySelector('.result-title')||screen.dataset.enhancedReport==='1')return;
 screen.dataset.enhancedReport='1';
 const fits=nearestFit(evidence);
 const best=fits[0]?.level||1;
 const ko=document.documentElement.lang==='ko';
 screen.classList.add('report-screen');
 screen.innerHTML=`
  <section class="report-hero">
   <span class="eyebrow">${ko?'예상 시작 레벨':'Estimated starting level'}</span>
   <div class="report-level"><span>${ko?'레벨':'Level'}</span><strong>${best}</strong></div>
   <p>${ko?'가장 가까운 레벨과 영역별 결과를 함께 보여드립니다.':'Your closest overall level and skill-specific estimates.'}</p>
  </section>
  <section class="report-section">
   <h3>${ko?'전체 레벨 적합도':'Overall level fit'}</h3>
   <div class="fit-list">${barRows(fits)}</div>
  </section>
  <section class="report-section">
   <h3>${ko?'영역별 예상 레벨':'Estimated level by skill'}</h3>
   <div class="skill-list">${skillRows()}</div>
  </section>
  <p class="report-note">${ko?'영역별 레벨은 해당 유형의 문제가 두 개 이상 출제된 경우에만 표시됩니다.':'A skill estimate is shown only when at least two questions from that skill were answered.'}</p>
  <div class="actions report-actions"><button class="btn btn-primary" id="retry">${ko?'다시 하기':'Try again'}</button><button class="btn btn-ghost" id="home">${ko?'처음으로':'Back to start'}</button></div>`;
}

function polishContent(){
 root?.querySelectorAll('.reading-passage').forEach(box=>{
  const text=clean(box.textContent);
  if(text&&text.length<=8&&!/[A-Za-z0-9가-힣]/.test(text))box.classList.add('emoji-passage');
 });
 renderReport();
}

new MutationObserver(polishContent).observe(root,{childList:true,subtree:true});
polishContent();
