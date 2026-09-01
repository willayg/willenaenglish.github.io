import{loadQuestionBank}from'./assessment-loader.js?v=20260812-fullbank2';

const root=document.querySelector('#app');
const SUPABASE_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const SUPABASE_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
const evidence=[];
let bank=[];
let profiles=new Map();
const MAX_LEVEL=12;
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const normalToken=s=>clean(s).toLowerCase().replace(/^[\s“”"'‘’.,!?;:()]+|[\s“”"'‘’.,!?;:()]+$/g,'');
const multisetKey=items=>items.map(normalToken).filter(Boolean).sort().join('\u0001');
const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
const sameTokens=(a,b)=>a.length===b.length&&multisetKey(a)===multisetKey(b);
const levelNames={1:'Starter 1',2:'Starter 2',3:'Level 1',4:'Level 2',5:'Level 3',6:'Level 4',7:'Level 5',8:'Level 6',9:'Level 7',10:'Level 8',11:'Level 9',12:'Level 10'};
const levelNamesKo={1:'스타터 1',2:'스타터 2',3:'레벨 1',4:'레벨 2',5:'레벨 3',6:'레벨 4',7:'레벨 5',8:'레벨 6',9:'레벨 7',10:'레벨 8',11:'레벨 9',12:'레벨 10'};
const shortNames={1:'S1',2:'S2',3:'1',4:'2',5:'3',6:'4',7:'5',8:'6',9:'7',10:'8',11:'9',12:'10'};
const skillFor=type=>({vocabulary:'vocabulary',grammar:'grammar',grammar_error:'grammar',question_response:'grammar',listening:'listening',reading:'reading',sentence_unscramble:'sentence_building',speaking:'speaking',writing:'writing'}[type]||null);
const skillLabels={vocabulary:{en:'Vocabulary',ko:'어휘'},grammar:{en:'Grammar',ko:'문법'},listening:{en:'Listening',ko:'듣기'},reading:{en:'Reading',ko:'읽기'},sentence_building:{en:'Sentence structure',ko:'문장 구조 파악 능력'},speaking:{en:'Speaking',ko:'말하기'},writing:{en:'Writing',ko:'쓰기'}};
const assessedSkills=['vocabulary','grammar','listening','reading','sentence_building'];
const allSkills=[...assessedSkills,'speaking','writing'];

const bankReady=loadQuestionBank().then(items=>{bank=items;return items}).catch(error=>{console.warn('Could not load report question bank',error);return[]});
fetch(`${SUPABASE_URL}/rest/v1/assessment_report_profiles?select=level_id,skill,summary_en,summary_ko,next_step_en,next_step_ko&status=eq.published&order=level_id.asc,sort_order.asc`,{headers,cache:'no-store'})
 .then(r=>{if(!r.ok)throw new Error(`Report profiles ${r.status}`);return r.json()})
 .then(rows=>{profiles=new Map(rows.map(row=>[`${row.level_id}:${row.skill}`,row]));rerenderVisibleReport()})
 .catch(error=>console.warn('Could not load reviewed report profiles',error));

function snapshotAnswer(){
 const card=root?.querySelector('.question-card');
 if(!card)return null;
 const choices=[...card.querySelectorAll('.choice')].map(x=>clean(x.dataset.value||x.textContent));
 const selectedChoice=card.querySelector('.choice.selected');
 const selectedValue=selectedChoice?clean(selectedChoice.dataset.value||selectedChoice.textContent):null;
 const selectedTokens=[...card.querySelectorAll('.scramble-answer .scramble-token')].map(x=>clean(x.textContent));
 const allTokens=[...card.querySelectorAll('.scramble-token')].map(x=>clean(x.textContent));
 return{choices,selectedValue,selectedTokens,allTokens,text:clean(card.textContent)};
}
async function recordAnswer(snapshot){
 if(!snapshot)return;
 if(!bank.length)await bankReady;
 let q=null;
 if(snapshot.choices.length){
  const candidates=bank.filter(item=>item.type!=='sentence_unscramble'&&sameSet([...item.choices].map(clean),snapshot.choices));
  q=candidates.find(item=>snapshot.text.includes(clean(item.q)))||candidates[0]||null;
 }else if(snapshot.allTokens.length){
  const candidates=bank.filter(item=>item.type==='sentence_unscramble'&&sameTokens([...item.tokens],snapshot.allTokens));
  if(candidates.length===1)q=candidates[0];
  else q=candidates.find(item=>item.meaning&&snapshot.text.includes(clean(item.meaning)))||candidates[0]||null;
 }
 if(!q||evidence.some(x=>x.id===q.id))return;
 if(q.type==='sentence_unscramble'){
  if(!snapshot.selectedTokens.length)return;
  const correct=Array.isArray(q.tokens)&&snapshot.selectedTokens.length===q.tokens.length&&snapshot.selectedTokens.every((x,i)=>normalToken(x)===normalToken(q.tokens[i]));
  evidence.push({id:q.id,level:Number(q.level)||1,type:q.type,correct});
  return;
 }
 if(snapshot.selectedValue===null)return;
 evidence.push({id:q.id,level:Number(q.level)||1,type:q.type,correct:snapshot.selectedValue===clean(q.a)});
}
document.addEventListener('click',e=>{
 if(e.target.closest('#next'))recordAnswer(snapshotAnswer());
 if(e.target.closest('#retry,#home'))evidence.length=0;
 if(e.target.closest('#languageBtn'))setTimeout(()=>rerenderVisibleReport(true),0);
},true);

function probabilities(rows,maxLevel=MAX_LEVEL){
 if(!rows.length)return[];
 const ceiling=Math.max(1,Math.min(MAX_LEVEL,Number(maxLevel)||MAX_LEVEL));
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
 const total=weighted.reduce((sum,x)=>sum+x.w,0)||1;
 return weighted.map(x=>({level:x.level,pct:x.w/total*100})).sort((a,b)=>b.pct-a.pct);
}
function levelFromRows(rows){if(!rows.length)return 1;const highest=Math.min(MAX_LEVEL,Math.max(...rows.map(x=>Number(x.level)||1),1));return probabilities(rows,highest)[0]?.level||1}
const overallLevel=()=>levelFromRows(evidence);
function estimateSkill(skill){
 const rows=evidence.filter(x=>skillFor(x.type)===skill);
 if(rows.length<3)return{assessed:false,rows};
 const otherRows=evidence.filter(x=>skillFor(x.type)!==skill);
 const anchor=otherRows.length>=4?levelFromRows(otherRows):overallLevel();
 const highest=Math.min(MAX_LEVEL,Math.max(...rows.map(x=>x.level)));
 const prior=[{level:anchor,correct:true},{level:Math.min(MAX_LEVEL,anchor+1),correct:false}];
 const fit=probabilities(rows.concat(prior),Math.max(highest,anchor+1))[0]||{level:anchor,pct:0};
 const accuracy=rows.filter(x=>x.correct).length/rows.length;
 const evidenceCap=Math.min(MAX_LEVEL,anchor+(rows.length>=5?2:1));
 let level=Math.min(fit.level,highest,evidenceCap);
 if(accuracy<.5)level=Math.min(level,anchor);
 if(accuracy<.34)level=Math.min(level,Math.max(1,anchor-1));
 level=Math.max(1,level);
 const top=rows.filter(x=>x.level===highest);
 const plus=rows.length>=5&&top.length>=3&&top.every(x=>x.correct)&&level===highest;
 const confidence=Math.round(Math.min(92,42+rows.length*7+fit.pct*.15));
 return{assessed:true,rows,level,confidence,plus,accuracy,anchor};
}
function profile(level,skill){return profiles.get(`${level}:${skill}`)||null}
function txt(row,field,ko,fallback=''){return clean(row?.[`${field}_${ko?'ko':'en'}`])||fallback}
function labelLevel(level,ko,plus=false){return `${ko?levelNamesKo[level]:levelNames[level]}${plus?'+':''}`}
function fallbackSummary(level,skill,ko){
 const publicLevel=level<=2?level:level-2;
 if(level===11)return ko?'복잡한 문장 구조와 중학교 상위 문법을 이해하고 사용할 수 있습니다.':'Can understand and use complex sentence structures and advanced middle-school grammar.';
 if(level===12)return ko?'고등학교 진입 수준의 문법, 추론, 긴 글과 함축적 의미를 다룰 수 있습니다.':'Can handle high-school bridge grammar, inference, longer texts and implied meaning.';
 return ko?`레벨 ${publicLevel}에서 익숙한 ${skillLabels[skill]?.ko||'영어'}를 이해하고 사용할 수 있습니다.`:`Can understand and use familiar ${skillLabels[skill]?.en.toLowerCase()||'English'} at Level ${publicLevel}.`;
}
function skillRow(skill,ko){
 const result=estimateSkill(skill),name=skillLabels[skill][ko?'ko':'en'];
 if(!result.assessed){
  const note=skill==='speaking'||skill==='writing'?(ko?'현재 버전의 테스트에는 이 영역을 평가할 문항이 아직 충분하지 않습니다.':'This version does not yet include enough tasks to assess this skill.'):(ko?'이 영역은 최소 세 문항이 필요합니다.':'At least three questions are needed to estimate this skill.');
  return `<div class="report-skill is-unassessed"><div class="report-skill__head"><strong>${name}</strong><span class="report-skill__level">${ko?'평가되지 않음':'Not assessed'}</span></div><p class="report-skill__note">${note}</p></div>`;
 }
 const note=txt(profile(result.level,skill),'summary',ko,fallbackSummary(result.level,skill,ko));
 return `<div class="report-skill"><div class="report-skill__head"><strong>${name}</strong><span class="report-skill__level">${labelLevel(result.level,ko,result.plus)}</span></div><div class="report-skill__track"><i style="width:${result.confidence}%"></i></div><p class="report-skill__note">${note}</p></div>`;
}
function canDoItems(best,ko){
 const items=assessedSkills.map(skill=>({skill,result:estimateSkill(skill)})).filter(x=>x.result.assessed).slice(0,4).map(x=>txt(profile(x.result.level,x.skill),'summary',ko,fallbackSummary(x.result.level,x.skill,ko)));
 if(items.length<2)items.unshift(txt(profile(best,'overall'),'summary',ko,fallbackSummary(best,'grammar',ko)));
 return [...new Set(items)].slice(0,4).map(x=>`<li>${x}</li>`).join('');
}
function nextStep(best,ko){
 const weakest=assessedSkills.map(skill=>({skill,result:estimateSkill(skill)})).filter(x=>x.result.assessed).sort((a,b)=>a.result.level-b.result.level)[0];
 if(weakest){const text=txt(profile(weakest.result.level,weakest.skill),'next_step',ko,'');if(text)return text}
 if(best>=11)return ko?'복잡한 문법을 정확하게 적용하고 긴 듣기와 읽기에서 근거를 찾는 연습을 이어가세요.':'Keep practising accurate use of complex grammar and finding evidence in longer listening and reading.';
 return txt(profile(best,'overall'),'next_step',ko,ko?'다음 단계의 영어를 정확하게 사용할 수 있도록 꾸준히 연습해 주세요.':'Continue practising the next level with growing accuracy and independence.');
}
function compactSkillRow(skill,ko){
 const result=estimateSkill(skill),name=skillLabels[skill][ko?'ko':'en'];
 const value=result.assessed?labelLevel(result.level,ko,result.plus):(ko?'평가되지 않음':'Not assessed');
 return `<div class="report-skill ${result.assessed?'':'is-unassessed'}"><div class="report-skill__head"><strong>${name}</strong><span class="report-skill__level">${value}</span></div>${result.assessed?'<div class="report-skill__track"><i></i></div>':''}</div>`;
}
function reportMarkup(){
 const ko=document.documentElement.lang==='ko',best=overallLevel();
 return `<section class="report-hero"><span class="report-kicker">${ko?'추천 시작 레벨':'Estimated starting level'}</span><div class="report-level"><span>${ko?(best<=2?'스타터':'레벨'):(best<=2?'Starter':'Level')}</span><strong>${best<=2?best:best-2}</strong></div></section><section class="report-card"><h3>${ko?'영역별 레벨':'Level by skill'}</h3>${assessedSkills.map(skill=>compactSkillRow(skill,ko)).join('')}</section><div class="actions report-actions"><button class="btn btn-primary" id="retry">${ko?'다시 테스트하기':'Try again'}</button><button class="btn btn-ghost" id="home">${ko?'처음으로 돌아가기':'Back to start'}</button></div>`;
}
function renderReport(force=false){
 const screen=root?.querySelector('.screen');
 if(!screen||(!screen.querySelector('.result-title')&&!screen.classList.contains('report-screen')))return;
 if(screen.dataset.enhancedReport==='1'&&!force)return;
 screen.dataset.enhancedReport='1';screen.classList.add('report-screen');screen.innerHTML=reportMarkup();
}
function rerenderVisibleReport(){const screen=root?.querySelector('.report-screen');if(screen){screen.dataset.enhancedReport='';renderReport(true)}}
function polishContent(){root?.querySelectorAll('.reading-passage').forEach(box=>{const text=clean(box.textContent);if(text&&text.length<=8&&!/[A-Za-z0-9가-힣]/.test(text))box.classList.add('emoji-passage')});renderReport()}
new MutationObserver(polishContent).observe(root,{childList:true,subtree:true});
new MutationObserver(()=>rerenderVisibleReport()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
polishContent();
