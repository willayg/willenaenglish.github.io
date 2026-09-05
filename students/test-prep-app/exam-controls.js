(function(){
'use strict';

const DURATION_MS=45*60*1000;
const $=(s,r=document)=>r.querySelector(s);
let timer=null,last='';

function session(){return window.WillenaExamSession}
function runtime(){return window.WillenaQuestionRuntime}
function active(){return session()?.active||null}
function current(){return session()?.currentItem||null}
function format(ms){const sec=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(sec/60),s=sec%60;return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}

function styles(){if($('#examControlsStyles'))return;const s=document.createElement('style');s.id='examControlsStyles';s.textContent=`
#examControls{margin-left:auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end;font-family:Poppins,'Noto Sans KR',sans-serif}
.exam-timer{font-size:11px;font-weight:800;color:#657177;background:#f4f6f7;border-radius:999px;padding:7px 10px;white-space:nowrap}.exam-timer.expired{background:#fff0f0;color:#a43c46}.exam-timer.correction{background:#eef9fa;color:#19777e}
.exam-control{border:1.5px solid #d8e1e3;background:#fff;color:#596970;border-radius:999px;padding:7px 10px;font:800 11px/1 Poppins,'Noto Sans KR',sans-serif;cursor:pointer;white-space:nowrap}.exam-control:hover{background:#f7f9fa}.exam-control.flag{width:34px;height:34px;padding:0;display:grid;place-items:center;color:#ee5f91;border-color:#f2bbce;font-size:15px}.exam-control:disabled{opacity:.38;cursor:default}
.tp-exam46-active #card .flag,.tp-exam46-active #card .seosul-flag,.tp-exam46-active #card .tqt-flag,.tp-exam46-active .tp-practice-flag,.tp-exam46-active .tp-skip-wrap{display:none!important}
@media(max-width:680px){#assignedBackRow{flex-wrap:wrap}#examControls{margin-left:auto}.exam-timer{font-size:10px}.quiz-context{max-width:calc(100% - 120px)}}
`;document.head.appendChild(s)}
function ensure(){const row=$('#assignedBackRow'),a=active();if(!row||!a)return null;let wrap=$('#examControls',row);if(!wrap){wrap=document.createElement('div');wrap.id='examControls';wrap.innerHTML='<span class="exam-timer" id="examTimer"></span><button type="button" class="exam-control flag" id="examFlag" aria-label="문제 신고" title="문제 신고">⚑</button>';row.appendChild(wrap);$('#examFlag',wrap).onclick=flagCurrent}return wrap}
function timerText(a){if(a.correction)return{txt:'오답 복습',cls:'correction'};if(a.finishedAt)return{txt:'시험 완료',cls:''};const left=DURATION_MS-(Date.now()-a.startedAt);return left>0?{txt:`남은 시간 ${format(left)}`,cls:''}:{txt:'시간 종료 00:00',cls:'expired'}}
function decorate(){styles();const a=active();if(!a){stop();return}const wrap=ensure();if(!wrap)return;const t=timerText(a),timerEl=$('#examTimer',wrap),flag=$('#examFlag',wrap),item=current();if(timerEl&&last!==`${t.txt}|${t.cls}`){timerEl.textContent=t.txt;timerEl.className='exam-timer'+(t.cls?' '+t.cls:'');last=`${t.txt}|${t.cls}`}if(flag){flag.disabled=!item||!!a.finishedAt;const n=a.correction?0:Number(a.replacementsLeft||0);flag.title=a.correction?'문제 신고':`문제 신고${n?` · 교체 ${n}회 남음`:''}`;flag.setAttribute('aria-label',flag.title)}if(!timer)timer=setInterval(()=>{if(active())decorate();else stop()},500)}
function flagCurrent(){const a=active(),item=current(),q=item?.question;if(!a||!q)return;const f=window.WillenaPracticeFlagger;if(!f?.open)return;const canReplace=!a.correction&&Number(a.replacementsLeft)>0&&!!runtime()?.current;f.open({source_type:'exam_question',source_id:String(q.source_id||q.id||''),allowReplace:canReplace,replaceRemaining:Number(a.replacementsLeft)||0,onReplaceRequest:()=>session().prepareReplacement(),onSent:async info=>{if(info?.replace&&info.replacement)await session().applyReplacement(info.replacement)},snapshot:{page:location.pathname,book:a.plan?.book_label||null,plan_id:a.plan?.id||null,lesson:item.lesson||null,practice_type:q.section||null,question_id:q.id||null,source_question_number:q.source_question_number??null,source_page:q.source_page??null,question_type:q.question_type||null,answer_mode:q.answer_mode||null,source_label:q.student_source_label||null,exam_session_id:a.manifest?.id||null,exam_scope:a.scope||null,exam_position:a.index+1,exam_total:a.queue?.length||null,exam_correction:!!a.correction,exam_replacements_left:Number(a.replacementsLeft)||0,engine:runtime()?.engineFor?.(q)||null}})}
function stop(){if(timer){clearInterval(timer);timer=null}last='';$('#examControls')?.remove()}
function boot(){styles();for(const e of ['exam46:start','exam46:answer','exam46:replacement','exam46:complete','exam46:correction-start','exam46:correction-round','exam46:correction-complete'])window.addEventListener(e,()=>setTimeout(decorate,0));window.addEventListener('popstate',()=>setTimeout(()=>{if(active())decorate();else stop()},0))}
window.WillenaExamControls={decorate,stop,flagCurrent};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();