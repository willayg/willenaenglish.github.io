(function(){
'use strict';

const DURATION_MS=45*60*1000;
const TEST_HOST=/^staging\./i.test(location.hostname)||location.hostname==='localhost'||location.hostname==='127.0.0.1';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let timer=null,last='';

function session(){return window.WillenaExamSession}
function runtime(){return window.WillenaQuestionRuntime}
function active(){return session()?.active||null}
function current(){return session()?.currentItem||null}
function format(ms){const sec=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(sec/60),s=sec%60;return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
async function waitFor(fn,timeout=3500){const end=Date.now()+timeout;while(Date.now()<end){const v=fn();if(v)return v;await wait(30)}return null}
function answers(q){const raw=Array.isArray(q?.correct_answer)?q.correct_answer:[q?.correct_answer].filter(x=>x!=null),a=raw.map(x=>String(x??'').trim()).filter(Boolean);if(!a.length&&q?.correct_text!=null)a.push(String(q.correct_text).trim());return a}
function setValue(el,v){if(!el)return;el.value=String(v??'');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}

function styles(){if($('#exam46ControlsStyles'))return;const s=document.createElement('style');s.id='exam46ControlsStyles';s.textContent=`
#exam46Controls{margin-left:auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end;font-family:Poppins,'Noto Sans KR',sans-serif}
.exam46-timer{font-size:11px;font-weight:800;color:#657177;background:#f4f6f7;border-radius:999px;padding:7px 10px;white-space:nowrap}.exam46-timer.expired{background:#fff0f0;color:#a43c46}.exam46-timer.correction{background:#eef9fa;color:#19777e}
.exam46-control{border:1.5px solid #d8e1e3;background:#fff;color:#596970;border-radius:999px;padding:7px 10px;font:800 11px/1 Poppins,'Noto Sans KR',sans-serif;cursor:pointer;white-space:nowrap}.exam46-control:hover{background:#f7f9fa}.exam46-control.flag{width:34px;height:34px;padding:0;display:grid;place-items:center;color:#ee5f91;border-color:#f2bbce;font-size:15px}.exam46-control.skip{color:#19777e;border-color:#9ad8dc}.exam46-control.correct{color:#8b3fa3;border-color:#d8aee5;background:#fff9ff}.exam46-control:disabled{opacity:.38;cursor:default}
.tp-exam46-active #card .flag,.tp-exam46-active #card .seosul-flag,.tp-exam46-active #card .tqt-flag,.tp-exam46-active .tp-practice-flag,.tp-exam46-active .tp-skip-wrap{display:none!important}
@media(max-width:680px){#assignedBackRow{flex-wrap:wrap}#exam46Controls{width:100%;margin-left:0;justify-content:space-between}.exam46-control.skip{flex:1}.exam46-timer{font-size:10px}.quiz-context{max-width:calc(100% - 120px)}}
`;document.head.appendChild(s)}
function ensure(){const row=$('#assignedBackRow'),a=active();if(!row||!a)return null;let wrap=$('#exam46Controls',row);if(!wrap){wrap=document.createElement('div');wrap.id='exam46Controls';wrap.innerHTML='<span class="exam46-timer" id="exam46Timer"></span><button type="button" class="exam46-control flag" id="exam46Flag" aria-label="문제 신고" title="문제 신고">⚑</button><button type="button" class="exam46-control skip" id="exam46Skip">건너뛰기 →</button>'+(TEST_HOST?'<button type="button" class="exam46-control correct" id="exam46Correct">✓ CORRECT →</button>':'');row.appendChild(wrap);$('#exam46Flag',wrap).onclick=flagCurrent;$('#exam46Skip',wrap).onclick=skipCurrent;if(TEST_HOST)$('#exam46Correct',wrap).onclick=answerCorrect}return wrap}
function timerText(a){if(a.correction)return{txt:'오답 복습',cls:'correction'};if(a.finishedAt)return{txt:'시험 완료',cls:''};const left=DURATION_MS-(Date.now()-a.startedAt);return left>0?{txt:`남은 시간 ${format(left)}`,cls:''}:{txt:'시간 종료 00:00',cls:'expired'}}
function decorate(){styles();const a=active();if(!a){stop();return}const wrap=ensure();if(!wrap)return;const t=timerText(a),timerEl=$('#exam46Timer',wrap),run=runtime()?.current,item=current();if(timerEl&&last!==`${t.txt}|${t.cls}`){timerEl.textContent=t.txt;timerEl.className='exam46-timer'+(t.cls?' '+t.cls:'');last=`${t.txt}|${t.cls}`}const skip=$('#exam46Skip',wrap),flag=$('#exam46Flag',wrap),correct=$('#exam46Correct',wrap),onQuestion=!!run&&!!item&&!a.finishedAt;if(skip)skip.disabled=!onQuestion;if(flag)flag.disabled=!item||!!a.finishedAt;if(correct)correct.disabled=!onQuestion;if(!timer)timer=setInterval(()=>{if(active())decorate();else stop()},500)}
async function skipCurrent(){const b=$('#exam46Skip');if(!b||b.disabled)return;b.disabled=true;try{const ok=await runtime()?.skip?.();if(!ok)b.disabled=false}catch(e){console.error('[REV46f] skip failed',e);b.disabled=false}}

async function correctChoice(q){
 const ans=answers(q);if(!ans.length)throw new Error('No correct choice is available.');
 const choiceButtons=$$('#card .choice[data-i]');if(!choiceButtons.length)return false;
 for(const n of ans){const b=choiceButtons.find(x=>String(x.dataset.i)===String(n));if(b&&!b.classList.contains('selected'))b.click()}
 const check=$('#card #check');if(!check||check.disabled)throw new Error('Choice check button is not ready.');check.click();
 const next=await waitFor(()=>{const b=$('#card #check');return b&&!b.disabled&&/다음 문제|결과 보기/.test(b.textContent||'')?b:null});if(!next)throw new Error('Choice question did not reach next state.');next.click();return true
}
async function correctText(q){
 const ans=answers(q);if(!ans.length)return false;
 const wrong=$$('#card .tqt-wrong'),right=$$('#card .tqt-right'),parts=$$('#card .tqt-part'),simple=$('#card #tqtAnswer');
 if(wrong.length&&right.length){ans.forEach((v,i)=>{const p=String(v).split(/\s*(?:→|->)\s*/);if(wrong[i])setValue(wrong[i],p[0]||'');if(right[i])setValue(right[i],p.slice(1).join(' → ')||'')})}
 else if(parts.length){parts.forEach((el,i)=>setValue(el,ans[i]??ans[0]??''))}
 else if(simple)setValue(simple,ans.length===1?ans[0]:ans.join('\n'));
 else return false;
 const check=$('#card #tqtCheck');if(!check||check.disabled)throw new Error('Text check button is not ready.');check.click();
 const next=await waitFor(()=>{const b=$('#card #tqtCheck');return b&&!b.disabled&&/다음 문제|결과 보기/.test(b.textContent||'')?b:null},5000);if(!next)throw new Error('Text question did not reach next state.');next.click();return true
}
async function correctVocabFallback(q){
 const ans=answers(q),choices=$$('#card .vtu-choice');
 if(choices.length){const n=Number(ans[0]);const b=Number.isInteger(n)&&n>0?choices[n-1]:null;if(!b)return false;b.click();const check=$('#card #vtuNext');if(!check||check.disabled)return false;check.click();const next=await waitFor(()=>{const x=$('#card #vtuNext');return x&&!x.disabled&&/다음|결과/.test(x.textContent||'')?x:null});if(next)next.click();return true}
 const input=$('#card #vtuInput');if(input){setValue(input,ans[0]||q?.correct_text||'');const check=$('#card #vtuNext');if(!check||check.disabled)return false;check.click();const next=await waitFor(()=>{const x=$('#card #vtuNext');return x&&!x.disabled&&/다음|결과/.test(x.textContent||'')?x:null});if(next)next.click();return true}
 return false
}
async function answerCorrect(){if(!TEST_HOST)return;const b=$('#exam46Correct'),run=runtime()?.current,q=run?.question;if(!b||b.disabled||!q)return;b.disabled=true;$('#tpSeosulAppKeyboard .vp-kb-hide')?.click();try{let ok=false;if(run.engine==='choice')ok=await correctChoice(q);else if(run.engine==='text')ok=await correctText(q);else ok=await correctVocabFallback(q);if(!ok)throw new Error(`No staging correct-answer adapter for ${run.engine||'unknown'}`)}catch(e){console.error('[REV46f] correct-answer helper failed',e);b.disabled=false}}

function flagCurrent(){const a=active(),item=current(),q=item?.question;if(!a||!q)return;const f=window.WillenaPracticeFlagger;if(!f?.open)return;f.open({source_type:'exam_question',source_id:String(q.source_id||q.id||''),snapshot:{page:location.pathname,book:a.plan?.book_label||null,lesson:item.lesson||null,practice_type:q.section||null,question_id:q.id||null,source_question_number:q.source_question_number??null,source_page:q.source_page??null,question_type:q.question_type||null,answer_mode:q.answer_mode||null,source_label:q.student_source_label||null,exam_session_id:a.manifest?.id||null,exam_scope:a.scope||null,exam_position:a.index+1,exam_total:a.queue?.length||null,exam_correction:!!a.correction,engine:runtime()?.engineFor?.(q)||null}})}
function stop(){if(timer){clearInterval(timer);timer=null}last='';$('#exam46Controls')?.remove()}
function boot(){styles();for(const e of ['exam46:start','exam46:answer','exam46:complete','exam46:correction-start','exam46:correction-round','exam46:correction-complete'])window.addEventListener(e,()=>setTimeout(decorate,0));window.addEventListener('popstate',()=>setTimeout(()=>{if(active())decorate();else stop()},0))}
window.WillenaExamControls={decorate,stop,flagCurrent,skipCurrent,answerCorrect};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[REV46f] ExamControls staging correct-answer helper ready',TEST_HOST);
})();