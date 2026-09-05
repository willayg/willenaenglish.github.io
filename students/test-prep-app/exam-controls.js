(function(){
'use strict';

const DURATION_MS=45*60*1000;
const $=(s,r=document)=>r.querySelector(s);
let timer=null,last='';

function session(){return window.WillenaExamSession}
function runtime(){return window.WillenaQuestionRuntime}
function active(){return session()?.active||null}
function current(){return session()?.currentItem||null}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function format(ms){const sec=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(sec/60),s=sec%60;return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}

function styles(){if($('#exam45ControlsStyles'))return;const s=document.createElement('style');s.id='exam45ControlsStyles';s.textContent=`
#exam45Controls{margin-left:auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end;font-family:Poppins,'Noto Sans KR',sans-serif}
.exam45-timer{font-size:11px;font-weight:800;color:#657177;background:#f4f6f7;border-radius:999px;padding:7px 10px;white-space:nowrap}.exam45-timer.expired{background:#fff0f0;color:#a43c46}.exam45-timer.correction{background:#eef9fa;color:#19777e}
.exam45-control{border:1.5px solid #d8e1e3;background:#fff;color:#596970;border-radius:999px;padding:7px 10px;font:800 11px/1 Poppins,'Noto Sans KR',sans-serif;cursor:pointer;white-space:nowrap}.exam45-control:hover{background:#f7f9fa}.exam45-control.flag{width:34px;height:34px;padding:0;display:grid;place-items:center;color:#ee5f91;border-color:#f2bbce;font-size:15px}.exam45-control.skip{color:#19777e;border-color:#9ad8dc}.exam45-control:disabled{opacity:.38;cursor:default}
.tp-exam45-active #card .flag,.tp-exam45-active #card .seosul-flag,.tp-exam45-active .tp-practice-flag,.tp-exam45-active .tp-skip-wrap{display:none!important}
@media(max-width:680px){#assignedBackRow{flex-wrap:wrap}#exam45Controls{width:100%;margin-left:0;justify-content:space-between}.exam45-control.skip{flex:1}.exam45-timer{font-size:10px}.quiz-context{max-width:calc(100% - 120px)}}
`;document.head.appendChild(s)}

function ensure(){
 const row=$('#assignedBackRow'),a=active();if(!row||!a)return null;let wrap=$('#exam45Controls',row);if(!wrap){wrap=document.createElement('div');wrap.id='exam45Controls';wrap.innerHTML='<span class="exam45-timer" id="exam45Timer"></span><button type="button" class="exam45-control flag" id="exam45Flag" aria-label="문제 신고" title="문제 신고">⚑</button><button type="button" class="exam45-control skip" id="exam45Skip">건너뛰기 →</button>';row.appendChild(wrap);$('#exam45Flag',wrap).onclick=flagCurrent;$('#exam45Skip',wrap).onclick=skipCurrent}return wrap
}
function timerText(a){
 if(a.correction)return{txt:'오답 복습',cls:'correction'};
 if(a.finishedAt)return{txt:'시험 완료',cls:''};
 const left=DURATION_MS-(Date.now()-a.startedAt);return left>0?{txt:`남은 시간 ${format(left)}`,cls:''}:{txt:'시간 종료 00:00',cls:'expired'};
}
function decorate(){
 styles();const a=active();if(!a){stop();return}const wrap=ensure();if(!wrap)return;const t=timerText(a),timerEl=$('#exam45Timer',wrap),run=runtime()?.current,item=current();
 if(timerEl&&last!==`${t.txt}|${t.cls}`){timerEl.textContent=t.txt;timerEl.className='exam45-timer'+(t.cls?' '+t.cls:'');last=`${t.txt}|${t.cls}`}
 const skip=$('#exam45Skip',wrap),flag=$('#exam45Flag',wrap),onQuestion=!!run&&!!item&&!a.finishedAt;
 if(skip)skip.disabled=!onQuestion;if(flag)flag.disabled=!item||!!a.finishedAt;
 if(!timer)timer=setInterval(()=>{if(active())decorate();else stop()},500);
}
async function skipCurrent(){const b=$('#exam45Skip');if(!b||b.disabled)return;b.disabled=true;try{const ok=await runtime()?.skip?.();if(!ok)b.disabled=false}catch(e){console.error('[REV45e] skip failed',e);b.disabled=false}}
function flagCurrent(){
 const a=active(),item=current(),q=item?.question;if(!a||!q)return;const f=window.WillenaPracticeFlagger;if(!f?.open)return;
 f.open({source_type:'exam_question',source_id:String(q.source_id||q.id||''),snapshot:{page:location.pathname,book:a.plan?.book_label||null,lesson:item.lesson||null,practice_type:q.section||null,question_id:q.id||null,source_question_number:q.source_question_number??null,source_page:q.source_page??null,question_type:q.question_type||null,answer_mode:q.answer_mode||null,source_label:q.student_source_label||null,exam_session_id:a.manifest?.id||null,exam_scope:a.scope||null,exam_position:a.index+1,exam_total:a.queue?.length||null,exam_correction:!!a.correction,engine:runtime()?.engineFor?.(q)||null}})
}
function stop(){if(timer){clearInterval(timer);timer=null}last='';$('#exam45Controls')?.remove()}
function boot(){styles();window.addEventListener('exam45:start',()=>setTimeout(decorate,0));window.addEventListener('exam45:answer',()=>setTimeout(decorate,0));window.addEventListener('exam45:complete',()=>setTimeout(decorate,0));window.addEventListener('exam45:correction-start',()=>setTimeout(decorate,0));window.addEventListener('exam45:correction-round',()=>setTimeout(decorate,0));window.addEventListener('exam45:correction-complete',()=>setTimeout(decorate,0));window.addEventListener('popstate',()=>setTimeout(()=>{if(active())decorate();else stop()},0))}
window.WillenaExamControls={decorate,stop,flagCurrent,skipCurrent};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[REV45e] ExamControls ready');
})();
