// Teacher-only read-only access to real student mock exam submissions.
const API='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/test_prep_teacher_mock_results_v1';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const dateText=x=>{const d=new Date(x);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})};
const names={vocabulary:'어휘',communication:'의사소통',grammar:'문법',reading:'독해',constructed_response:'서술형'};
let dialog=null,activeRequest=0,sessionRows=[],selectedStudent='',groupFilter=null;
const css=`
.na2-mr-dialog{width:min(1030px,96vw);max-width:96vw;max-height:94vh;border:none;border-radius:19px;padding:0;background:#f7fafb;color:#273949;box-shadow:0 20px 65px #11182766;font:14px/1.55 Poppins,Arial,sans-serif}
.na2-mr-dialog::backdrop{background:#1c293ab8}
.na2-mr-head{padding:18px 21px;background:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #e4ecef}
.na2-mr-head h2{font-size:20px;margin:0}.na2-mr-head p{margin:3px 0 0;color:#71818d;font-size:12px}
.na2-mr-close,.na2-mr-back,.na2-mr-refresh{background:#fff;border:1px solid #bddbe4;border-radius:10px;padding:9px 12px;color:#28576c;font-weight:700;cursor:pointer}
.na2-mr-body{padding:19px;overflow:auto;max-height:calc(94vh - 92px)}
.na2-mr-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.na2-mr-tools select{padding:9px 11px;border:1px solid #cbdce1;background:#fff;border-radius:9px;min-width:160px}
.na2-mr-list{display:grid;gap:9px}
.na2-mr-row{width:100%;border:1px solid #dfe9ed;background:white;border-radius:12px;padding:14px;text-align:left;display:flex;gap:12px;align-items:center;justify-content:space-between;cursor:pointer}
.na2-mr-row:hover{border-color:#80c8d6}.na2-mr-row strong{display:block;color:#253948}.na2-mr-row small{display:block;color:#748592;font-size:11px;margin-top:4px}
.na2-mr-score{font-size:22px;font-weight:800;white-space:nowrap;color:#236779}
.na2-mr-summary{padding:17px;border-radius:14px;background:white;border:1px solid #e3e9ec;margin:14px 0}
.na2-mr-summary strong{font-size:26px;color:#146f83}
.na2-mr-section{margin:13px 0;border:1px solid #dce6ea;background:#fff;border-radius:13px;overflow:hidden}
.na2-mr-section summary{cursor:pointer;padding:12px 15px;background:#f5f9fa;font-weight:700}
.na2-mr-question{padding:16px;border-top:1px solid #e9eef1;white-space:normal}
.na2-mr-question h4{font-size:14px;margin:0 0 7px}.na2-mr-question p{white-space:pre-wrap;margin:5px 0}
.na2-mr-question .na2-mr-context{white-space:pre-wrap;background:#f5f8fb;border-radius:9px;padding:10px;margin:8px 0}
.na2-mr-choices{padding-left:24px;margin:8px 0}.na2-mr-choices li{padding:2px 0}
.na2-mr-answers{margin-top:11px;display:grid;gap:5px;font-size:12px}
.na2-mr-correct{color:#228168}.na2-mr-wrong{color:#b8465d}.na2-mr-empty{padding:24px;text-align:center;background:#fff;border-radius:13px;color:#6a7a88}
@media(max-width:600px){.na2-mr-head{align-items:flex-start}.na2-mr-body{padding:12px}.na2-mr-dialog{max-height:96vh}}
`;
function ensureDialog(){
 if(dialog)return dialog;
 const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
 dialog=document.createElement('dialog');dialog.className='na2-mr-dialog';
 dialog.innerHTML='<header class="na2-mr-head"><div><h2>모의고사 결과</h2><p>학생이 실제 제출한 모의고사 기록 · 읽기 전용</p></div><button type="button" class="na2-mr-close">닫기</button></header><main class="na2-mr-body"></main>';
 document.body.append(dialog);dialog.querySelector('.na2-mr-close').onclick=()=>dialog.close();return dialog;
}
async function request(body){
 const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token');
 if(!token)throw Error('선생님 로그인이 필요합니다. 새로고침 후 다시 시도해 주세요.');
 const r=await fetch(API,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 const payload=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(payload.message||payload.error||'모의고사 결과 조회 실패 ('+r.status+')');
 return payload;
}
const main=()=>dialog.querySelector('.na2-mr-body');
function valueText(q,a){
 if(a==null||a===''||(Array.isArray(a)&&!a.length))return '미응답';
 const vals=Array.isArray(a)?a:[a],choices=Array.isArray(q?.choices)?q.choices:[];
 return vals.map(x=>{const v=String(x??''),n=/^\d+$/.test(v)?Number(v)-1:-1;return n>=0&&n<choices.length?v+'. '+choices[n]:v}).join(' / ');
}
function contextHtml(obj){
 if(!obj||typeof obj!=='object')return '';
 return Object.entries(obj).filter(([,v])=>v!=null&&v!=='').map(([k,v])=>{
   const t=Array.isArray(v)?v.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n'):typeof v==='object'?JSON.stringify(v,null,2):String(v);
   return '<div class="na2-mr-context"><b>'+escapeText(k)+'</b>\n'+escapeText(t.replace(/\\n/g,'\n'))+'</div>';
 }).join('');
}
function itemHtml(item,i){
 const q=item.question||{},a=item.response,r=item.result||{},choices=q.choices||[],answer=r.correctAnswer??q.answer,correct=!!r.correct;
 return '<article class="na2-mr-question"><h4>문제 '+(item.number||i+1)+' · '+escapeText(item.lesson||'')+' <span class="'+(correct?'na2-mr-correct':'na2-mr-wrong')+'">'+(item.answered?(correct?'정답':'오답'):'미응답')+'</span></h4>'+
 '<p><b>'+escapeText(q.prompt||'')+'</b></p>'+contextHtml(q.context)+
 (choices.length?'<ol class="na2-mr-choices">'+choices.map(x=>'<li>'+escapeText(typeof x==='string'?x:JSON.stringify(x))+'</li>').join('')+'</ol>':'')+
 '<div class="na2-mr-answers"><div>학생 답안: <b>'+escapeText(valueText(q,a))+'</b></div><div>정답: <b>'+escapeText(valueText(q,answer))+'</b></div>'+
 (q.metadata?.explanation_ko||q.metadata?.source_explanation_ko?'<div>해설: '+escapeText(q.metadata.explanation_ko||q.metadata.source_explanation_ko)+'</div>':'')+'</div></article>';
}
function showDetail(x){
 const snap=x.snapshot,items=Array.isArray(snap?.items)?snap.items:[];
 main().innerHTML='<button class="na2-mr-back" type="button">← 시험 기록 목록</button>'+
 '<div class="na2-mr-summary"><b>'+escapeText(x.name||'')+' · '+escapeText(dateText(x.completed_at))+'</b><div><strong>'+escapeText(x.correct)+' / '+escapeText(x.total)+' ('+Math.round(100*(x.correct||0)/Math.max(x.total||1,1))+'%)</strong></div><small>시험 범위: '+escapeText(snap?.book_label||'')+'</small></div>'+
 (items.length?['vocabulary','communication','grammar','reading','constructed_response'].map(bucket=>{
  const part=items.filter(y=>y.bucket===bucket||(bucket==='constructed_response'&&y.slot==='constructed_response_fallback'));
  if(!part.length)return '';
  const n=part.filter(y=>y.result?.correct).length;
  return '<details class="na2-mr-section"><summary>'+escapeText(names[bucket])+' · '+n+' / '+part.length+'</summary>'+part.map(itemHtml).join('')+'</details>';
 }).join(''):'<div class="na2-mr-empty">이 시험은 점수만 저장되어 있어 개별 답안을 볼 수 없습니다.</div>');
 main().querySelector('.na2-mr-back').onclick=showList;
}
async function loadDetail(id){
 const seq=++activeRequest;main().innerHTML='<div class="na2-mr-empty">답안 기록을 불러오는 중…</div>';
 try{
  const x=await request({p_session_id:id});
  if(seq!==activeRequest||!dialog.open)return;
  if(!x.session_id)throw Error('시험 기록을 찾지 못했습니다.');
  showDetail(x);
 }catch(e){if(seq!==activeRequest)return;main().innerHTML='<button class="na2-mr-back">← 시험 기록 목록</button><div class="na2-mr-empty">'+escapeText(e.message)+'</div>';main().querySelector('.na2-mr-back').onclick=showList;}
}
function showList(){
 const rows=selectedStudent?sessionRows.filter(x=>x.student_id===selectedStudent):sessionRows;
 const students=[...new Map(sessionRows.map(x=>[x.student_id,x.name])).entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
 main().innerHTML='<div class="na2-mr-tools"><label>학생 <select class="na2-mr-students"><option value="">전체 학생</option>'+students.map(([id,name])=>'<option value="'+escapeText(id)+'" '+(selectedStudent===id?'selected':'')+'>'+escapeText(name)+'</option>').join('')+'</select></label><button type="button" class="na2-mr-refresh">새로고침</button><span>'+rows.length+'회 시험</span></div>'+
 (rows.length?'<div class="na2-mr-list">'+rows.map(x=>'<button class="na2-mr-row" type="button" data-session="'+escapeText(x.session_id)+'"><span><strong>'+escapeText(x.name)+'</strong><small>'+escapeText(dateText(x.completed_at))+' · '+escapeText(x.book_label||x.exam_name||'')+(x.reviewable?' · 답안 확인 가능':' · 점수 기록만')+'</small></span><span class="na2-mr-score">'+x.correct+'/'+x.total+'<small>'+x.pct+'%</small></span></button>').join('')+'</div>':'<div class="na2-mr-empty">이 범위의 완료된 모의고사 기록이 없습니다.</div>');
 main().querySelector('.na2-mr-students').onchange=e=>{selectedStudent=e.target.value;showList()};
 main().querySelector('.na2-mr-refresh').onclick=loadList;
 main().querySelectorAll('[data-session]').forEach(b=>b.onclick=()=>loadDetail(b.dataset.session));
}
async function loadList(){
 const seq=++activeRequest;main().innerHTML='<div class="na2-mr-empty">시험 결과를 불러오는 중…</div>';
 try{
  const d=await request(groupFilter?{p_group_id:groupFilter}:{});
  if(seq!==activeRequest||!dialog.open)return;
  sessionRows=Array.isArray(d.tests)?d.tests:[];showList();
 }catch(e){if(seq!==activeRequest)return;main().innerHTML='<div class="na2-mr-empty">'+escapeText(e.message)+'</div>';}
}
window.NaesinV2MockResults={open({groupId=null,studentId=null}={}){
 ensureDialog();groupFilter=groupId;selectedStudent=studentId||'';sessionRows=[];
 if(!dialog.open)dialog.showModal();loadList();
}};
