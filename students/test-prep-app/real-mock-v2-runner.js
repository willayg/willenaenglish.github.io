import {QuestionRenderer} from '../test-prep-v2/question-renderer.js?v=2.14a';
import {gradeQuestion} from '../test-prep-v2/question-grader.js?v=2.14a';

const STORAGE_KEY='willena-real-mock-v2-manifest';
const RESET_KEY='willena-real-mock-v2-reset-request';
const root=document.getElementById('realMockRoot'),bottom=document.getElementById('realMockBottom'),actions=document.getElementById('realMockActions');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const LABEL={vocabulary:'어휘',communication:'의사소통',grammar:'문법',reading:'독해',constructed_response:'서술형'};
let manifest=null,index=0,score=0,renderer=null,checked=false,startedAt=0,results=[];

function fail(message){root.innerHTML=`<button class="real-mock-back" id="goBack">← 시험 대비</button><div class="real-mock-card"><div class="empty">${esc(message)}</div></div>`;bottom.hidden=true;document.getElementById('goBack').onclick=()=>location.replace('./')}
function loadManifest(){try{return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null')}catch(_){return null}}
function current(){return manifest?.questions?.[index]||null}
function setActions(html=''){actions.innerHTML=html;bottom.hidden=!html}
function sourceBadge(q){const c=q?.source?.code||'';return c?`<span class="real-mock-pill">${esc(c)}</span>`:''}
function sectionFor(q){return q?.__realMockSection||q?.skill||q?.tracking?.practiceType||''}
function resetTest(){if(!manifest?.planId)return;if(!confirm('현재 시험을 버리고 반복 없는 새 실전모의고사를 만들까요?'))return;const currentIds=(manifest.questions||[]).map(q=>String(q?.id||q?.masteryKey||'')).filter(Boolean);localStorage.setItem(RESET_KEY,JSON.stringify({planId:String(manifest.planId),currentIds,requestedAt:Date.now()}));sessionStorage.removeItem(STORAGE_KEY);location.replace('./?realMockReset=1&v=52g')}
function renderQuestion(){
  if(!manifest||index>=manifest.questions.length)return renderResult();
  const q=current(),section=sectionFor(q);checked=false;startedAt=Date.now();
  root.innerHTML=`<div class="real-mock-head"><div><button class="real-mock-back" id="exitMock">← 시험 대비</button><h1>실전모의고사</h1><p>${esc(manifest.bookLabel||'')} · 현재 시험 범위 · V2 renderer experiment</p></div><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end"><button id="resetMock" type="button" style="border:2px solid #d54685;background:#fff;color:#d54685;border-radius:999px;padding:9px 13px;font:800 11px Poppins,sans-serif;cursor:pointer;white-space:nowrap">RESET TEST</button><strong>${index+1} / ${manifest.questions.length}</strong></div></div><div class="real-mock-meta"><span class="real-mock-pill">${esc(LABEL[section]||section)}</span>${sourceBadge(q)}<span class="real-mock-pill">${esc(q.__lesson||'')}</span><span class="real-mock-pill">REV 52g</span></div><div class="real-mock-progress"><i style="width:${Math.round(index/manifest.questions.length*100)}%"></i></div><div class="real-mock-card"><div id="questionHost"></div></div>`;
  renderer=new QuestionRenderer(document.getElementById('questionHost')).render(q,{onChange:(_,has)=>{const b=document.getElementById('checkAnswer');if(b&&!checked)b.disabled=!has}});
  document.getElementById('exitMock').onclick=()=>{if(confirm('실전모의고사를 종료할까요?'))location.replace('./')};
  document.getElementById('resetMock').onclick=resetTest;
  setActions('<button id="skipQuestion">Skip</button><button class="primary" id="checkAnswer" disabled>Check Answer</button>');
  document.getElementById('skipQuestion').onclick=skip;
  document.getElementById('checkAnswer').onclick=check;
}
async function check(){
  if(checked){index++;renderQuestion();return}
  const q=current(),response=renderer.getResponse(),btn=document.getElementById('checkAnswer');btn.disabled=true;btn.textContent='Checking…';renderer.setDisabled(true);
  try{
    const result=await gradeQuestion(q,response);result.responseTimeMs=Date.now()-startedAt;checked=true;if(result.correct)score++;results.push({id:q.id,section:sectionFor(q),correct:!!result.correct,skipped:false});renderer.showFeedback(result);btn.disabled=false;btn.textContent=index===manifest.questions.length-1?'Finish':'Next Question →';const skipBtn=document.getElementById('skipQuestion');if(skipBtn)skipBtn.disabled=true;
  }catch(e){console.error('[real mock v2] grading failed',e);btn.disabled=false;btn.textContent='Check Answer';alert(e?.message||'채점하지 못했습니다.')}
}
function skip(){if(checked)return;const q=current();results.push({id:q.id,section:sectionFor(q),correct:false,skipped:true});index++;renderQuestion()}
function breakdown(){const out={};for(const [k,n] of Object.entries(manifest.blueprint||{}))out[k]={correct:0,total:n};for(const r of results){if(!out[r.section])out[r.section]={correct:0,total:0};if(r.correct)out[r.section].correct++}return out}
function renderResult(){
  setActions('');sessionStorage.removeItem(STORAGE_KEY);const pct=manifest.questions.length?Math.round(score/manifest.questions.length*100):0,b=breakdown();
  root.innerHTML=`<div class="real-mock-head"><div><h1>실전모의고사 결과</h1><p>이 결과는 실험용이며 기존 모의고사 기록과 독립적입니다.</p></div><button id="resetMock" type="button" style="border:2px solid #d54685;background:#fff;color:#d54685;border-radius:999px;padding:9px 13px;font:800 11px Poppins,sans-serif;cursor:pointer">RESET TEST</button></div><div class="real-mock-card real-mock-result"><div class="real-mock-score">${score} / ${manifest.questions.length}</div><h2>${pct}%</h2><div class="real-mock-breakdown">${Object.entries(b).map(([k,v])=>`<div><b>${v.correct}/${v.total}</b><small>${esc(LABEL[k]||k)}</small></div>`).join('')}</div><div style="margin-top:28px"><button class="primary" id="finishBack">시험 대비로 돌아가기</button></div></div>`;
  document.getElementById('finishBack').onclick=()=>location.replace('./');document.getElementById('resetMock').onclick=resetTest;
}

manifest=loadManifest();
if(!manifest||!Array.isArray(manifest.questions)||manifest.questions.length!==25)fail('실전모의고사 데이터가 없거나 올바르지 않습니다. 시험 대비 화면에서 다시 시작해 주세요.');else renderQuestion();
