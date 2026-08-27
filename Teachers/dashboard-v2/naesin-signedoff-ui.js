(function(){
'use strict';
const INSIGHTS_API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher-insights';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let pendingDetail=null;
function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
function addStyles(){if($('#naSignedStyles'))return;const s=document.createElement('style');s.id='naSignedStyles';s.textContent=`
#view-naesin .na-groups{grid-template-columns:1fr!important;gap:20px!important}
#view-naesin .na-exam{border:2px solid #58c3d2!important;border-radius:26px!important;box-shadow:none!important;background:#fff!important}
#view-naesin .na-exam-head{padding:24px 28px 8px!important;align-items:flex-start!important}
#view-naesin .na-exam-title{font-size:1.18rem!important;font-weight:700!important;letter-spacing:-.02em!important}
#view-naesin .na-exam-book{font-size:.76rem!important;margin-top:5px!important;color:#7d8390!important}
#view-naesin .na-exam-head>.na-dday{display:none!important}
#view-naesin .na-exam-meta{display:none!important}
#view-naesin .na-actions{padding:14px 28px 22px!important;gap:10px!important;align-items:center!important}
#view-naesin .na-actions .na-dday{display:grid!important;min-width:72px!important;width:auto!important;height:40px!important;padding:0 14px!important;font-size:.78rem!important;background:#fff!important}
#view-naesin .na-actions .na-btn{padding:9px 14px!important;font-size:.74rem!important;border-radius:11px!important}
#view-naesin .na-actions .na-btn.dark{background:#3b3a4b!important;border-color:#3b3a4b!important;color:#fff!important}
#view-naesin [data-open]{display:none!important}
#view-naesin .na-signed-summary{display:flex;gap:26px;align-items:center;padding:12px 28px;border-top:1.5px solid #e4e8eb;border-bottom:1.5px solid #e4e8eb;background:#fbfcfd;font-size:.72rem;color:#4f5260}
#view-naesin .na-signed-summary b{color:#343343}.na-signed-summary .attention{color:#a66a2d}
#view-naesin .na-members{display:block!important;border-top:0!important}
#view-naesin .na-signed-students-label{padding:13px 28px 8px;font-size:.62rem;font-weight:700;letter-spacing:.04em;color:#7d8390;text-transform:uppercase}
#view-naesin .na-member{grid-template-columns:1fr auto 36px!important;padding:15px 28px!important;border-top:1px solid #e8ecef!important;min-height:72px!important}
#view-naesin .na-member:first-child{border-top:0!important}
#view-naesin .na-member-name{font-size:.94rem!important}
#view-naesin .na-member-sub{font-size:.68rem!important;margin-top:3px!important}
#view-naesin .na-member-status{font-size:.62rem!important;padding:6px 9px!important;border-radius:10px!important}
#view-naesin .na-arrow{width:34px!important;height:34px!important;border-radius:10px!important}
#naFreshDiagBg .na-modal.diag{width:min(1080px,97vw)!important;background:#f6f7f9!important;border:2.5px solid #58c3d2!important;border-radius:25px!important}
#naFreshDiagBg .na-modal-head{padding:20px 22px!important}
#naFreshDiagBg .na-modal-head h2{font-size:1.28rem!important}
#naFreshDiagBg .na-diag-dday{min-width:106px!important;height:52px!important;font-size:1rem!important;background:#effafb!important}
#naFreshDiagBg .na-x{width:46px!important;height:46px!important;border-radius:12px!important;font-size:1.25rem!important}
#naFreshDiagBg .na-modal-body{padding:22px!important}
#naFreshDiagBg .na-kpis.na-signed-three{grid-template-columns:1.15fr .85fr 1.15fr!important;gap:12px!important}
#naFreshDiagBg .na-kpis.na-signed-three .na-kpi{min-height:156px!important;padding:18px!important;border-radius:18px!important;background:#fff!important;box-shadow:none!important}
#naFreshDiagBg .na-kpis.na-signed-three .na-kpi.accuracy{border:2px solid #e7a5bb!important}
#naFreshDiagBg .na-kpis.na-signed-three .na-kpi.wrong{border:2px solid #ecc58f!important}
#naFreshDiagBg .na-kpis.na-signed-three .na-kpi.activity{border:2px solid #58c3d2!important}
#naFreshDiagBg .na-kpi-label{font-size:.72rem!important;color:#7d8390!important}
#naFreshDiagBg .na-kpi-open{font-size:.62rem!important;color:#278793!important}
#naFreshDiagBg .na-dual-accuracy{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:7px}
#naFreshDiagBg .na-dual-accuracy .metric strong{display:block;font-size:2rem;line-height:1.05;color:#343343}
#naFreshDiagBg .na-dual-accuracy .metric span{display:block;margin-top:4px;font-size:.62rem;color:#7d8390}
#naFreshDiagBg .na-activity-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
#naFreshDiagBg .na-activity-stat{border:1.5px solid #dfe4e8;border-radius:11px;padding:9px;background:#fbfcfd}
#naFreshDiagBg .na-activity-stat strong{display:block;font-size:1.18rem;line-height:1.05;color:#343343}
#naFreshDiagBg .na-activity-stat span{display:block;margin-top:3px;font-size:.56rem;color:#7d8390}
@media(max-width:700px){#view-naesin .na-exam-head{padding:20px 20px 8px!important}#view-naesin .na-actions{padding:12px 20px 18px!important}#view-naesin .na-signed-summary{padding:11px 20px!important;gap:16px!important;flex-wrap:wrap}#view-naesin .na-signed-students-label,#view-naesin .na-member{padding-left:20px!important;padding-right:20px!important}#naFreshDiagBg .na-kpis.na-signed-three{grid-template-columns:1fr!important}}
`;document.head.appendChild(s)}
function styleExamCards(){const box=$('#naFreshGroups');if(!box)return;$$('.na-exam',box).forEach(card=>{if(card.dataset.signed==='1')return;card.dataset.signed='1';const lessons=$('.na-pill.gray',card)?.textContent?.trim()||'';const book=$('.na-exam-book',card);if(book&&lessons&&!book.textContent.includes(lessons))book.textContent=`${book.textContent.trim()} · ${lessons}`;const actions=$('.na-actions',card),dday=$('.na-dday',card),edit=$('[data-edit]',card),task=$('[data-task]',card);if(actions&&dday){actions.insertBefore(dday,actions.firstChild);if(edit)actions.appendChild(edit);if(task)actions.appendChild(task)}const members=$$('.na-member',card);const active=members.filter(r=>!$('.na-member-status.empty',r)).length;const attention=members.filter(r=>$('.na-member-status.problem,.na-member-status.empty',r)).length;const summary=document.createElement('div');summary.className='na-signed-summary';summary.innerHTML=`<span><b>${members.length}</b> students</span><span><b>${active}</b> active</span><span class="attention"><b>${attention}</b> need attention</span>`;const memberBox=$('.na-members',card);if(memberBox){card.insertBefore(summary,memberBox);const label=document.createElement('div');label.className='na-signed-students-label';label.textContent='Students';memberBox.insertBefore(label,memberBox.firstChild)}members.forEach(row=>{const sub=$('.na-member-sub',row);if(!sub)return;const status=$('.na-member-status',row);if(status?.classList.contains('empty'))sub.textContent='No Test Prep activity yet'})})}
function showDiag(v){const body=$('#naDiagBody');if(!body)return;$$('.na-diag-view',body).forEach(x=>x.classList.toggle('active',x.dataset.view===v));body.scrollTop=0}
function rebuildThreeKpis(detail){const body=$('#naDiagBody'),overview=$('.na-diag-view[data-view="overview"]',body);if(!overview)return;const kpis=$('.na-kpis',overview);if(!kpis)return;const s=detail?.summary;if(!s)return;const allTime=s.accuracy==null?'—':`${s.accuracy}%`;const recent=s.recent_accuracy_3d==null?'—':`${s.recent_accuracy_3d}%`;const recentAttempts=Number(s.recent_attempts_3d||0);const wrongVal=Number(s.unresolved_wrong||0);const attempts=Number(s.attempts||0);const coverage=s.coverage==null?'—':`${s.coverage}%`;const days=Number(s.active_days||0);kpis.dataset.signed='1';kpis.className='na-kpis na-signed-three';kpis.innerHTML=`<button class="na-kpi accuracy" data-local="accuracy"><div class="na-kpi-label">Accuracy</div><div class="na-dual-accuracy"><div class="metric"><strong>${allTime}</strong><span>All time</span></div><div class="metric"><strong>${recent}</strong><span>Last 3 days${recentAttempts?` · ${recentAttempts} Q`:''}</span></div></div><div class="na-kpi-open">Analyse ›</div></button><button class="na-kpi wrong" data-local="wrong"><div class="na-kpi-label">오답</div><div class="na-kpi-value">${wrongVal}</div><div class="na-kpi-note">Unresolved</div><div class="na-kpi-open">View wrong answers ›</div></button><button class="na-kpi activity" data-local="activity"><div class="na-kpi-label">Activity</div><div class="na-activity-stats"><div class="na-activity-stat"><strong>${attempts}</strong><span>Questions</span></div><div class="na-activity-stat"><strong>${coverage}</strong><span>Coverage</span></div><div class="na-activity-stat"><strong>${days}</strong><span>Active days</span></div></div><div class="na-kpi-open">View activity ›</div></button>`;$$('[data-local]',kpis).forEach(b=>b.onclick=()=>showDiag(b.dataset.local))}
async function fetchDetailForRow(row){const t=token();if(!t)return null;const studentId=row.dataset.student||'',groupId=row.closest('.na-exam')?.dataset.group||'';if(!studentId||!groupId)return null;try{const q=new URLSearchParams({action:'student_detail',student_id:studentId,group_id:groupId});const r=await fetch(`${INSIGHTS_API}?${q}`,{headers:{Authorization:`Bearer ${t}`,apikey:KEY},credentials:'omit',cache:'no-store'});const j=await r.json();return r.ok&&j.success!==false?j:null}catch(e){console.warn('[naesin stats]',e);return null}}
function init(){addStyles();const groups=$('#naFreshGroups');if(groups){new MutationObserver(styleExamCards).observe(groups,{childList:true,subtree:true});styleExamCards()}const diag=$('#naDiagBody');if(diag){new MutationObserver(()=>{if(pendingDetail){const overview=$('.na-diag-view[data-view="overview"]',diag);if(overview&&!$('.na-kpis.na-signed-three',overview))rebuildThreeKpis(pendingDetail)}}).observe(diag,{childList:true,subtree:true})}document.addEventListener('click',e=>{if(e.target.closest('[data-view="naesin"]'))queueMicrotask(styleExamCards);const row=e.target.closest('.na-member');if(row){pendingDetail=null;fetchDetailForRow(row).then(d=>{if(!d)return;pendingDetail=d;rebuildThreeKpis(d)})}},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();