// Read-only teacher view of Naesin homework grouped by student.
(function(){
'use strict';
const URL='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/test_prep_teacher_homework_by_student_v1';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const label={vocabulary:'단어 학습',vocab_test:'어휘 문제',grammar:'문법',reading:'독해',communication:'의사소통',sentences:'본문외우기',constructed_response:'서술형'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const date=v=>{if(!v)return'';const x=new Date(v);return Number.isNaN(x.getTime())?'':x.toLocaleDateString('ko-KR',{year:'numeric',month:'numeric',day:'numeric'})};
let dialog=null,rows=[],filters={name:'',group:'',status:'all',history:false},seq=0,groupNames=new Map();
const CSS=`
.nh-dialog{border:0;border-radius:18px;background:#f8fafc;color:#243645;padding:0;width:min(1100px,97vw);max-width:97vw;max-height:95vh;font:14px/1.5 Poppins,Arial,sans-serif;box-shadow:0 20px 70px #14273766}
.nh-dialog::backdrop{background:#162734ad}
.nh-header{padding:18px 22px;background:#fff;border-bottom:1px solid #e5ecef;display:flex;justify-content:space-between;gap:12px;align-items:center}
.nh-header h2{font-size:21px;margin:0}.nh-header p{font-size:12px;color:#677c87;margin:4px 0 0}
.nh-close,.nh-refresh{border:1px solid #b8dbe4;background:#fff;color:#205a6a;border-radius:10px;padding:9px 13px;font:700 13px Poppins,Arial;cursor:pointer}
.nh-body{padding:19px 22px 25px;max-height:calc(95vh - 90px);overflow:auto}
.nh-controls{display:flex;flex-wrap:wrap;align-items:end;gap:10px;margin-bottom:16px}
.nh-controls label{display:grid;gap:5px;font-size:11px;color:#657c87;font-weight:700}
.nh-controls input,.nh-controls select{padding:9px 11px;background:#fff;border:1px solid #d0dfe5;border-radius:9px;font:13px Poppins,Arial;color:#294052;min-width:140px}
.nh-controls input{min-width:190px}.nh-controls .nh-history{display:flex;gap:6px;align-items:center;padding:9px 0}.nh-history input{min-width:0}
.nh-summary{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px}
.nh-summary span{background:#fff;border:1px solid #e2eaee;border-radius:9px;padding:9px 13px;font-size:12px}
.nh-summary b{font-size:17px;color:#275d6a;margin-right:5px}
.nh-student{border:1px solid #dfe9ed;background:#fff;border-radius:13px;margin-bottom:12px;overflow:hidden}
.nh-student>summary{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:14px 16px;cursor:pointer;font-weight:750;list-style:none}
.nh-student>summary::-webkit-details-marker{display:none}
.nh-name{font-size:16px;margin-right:auto}.nh-class{font-size:11px;color:#8998a3}
.nh-stat{border-radius:50px;padding:3px 9px;font-size:11px;background:#eef4f7;color:#5a7382}.nh-stat.done{background:#e8f8f0;color:#26735d}.nh-stat.undone{background:#fff0f5;color:#a34869}
.nh-student-body{padding:0 16px 14px}.nh-column-head{font-size:12px;font-weight:800;color:#476475;margin:13px 0 6px}
.nh-task{padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#f7fafb;border:1px solid #e9eef0;border-radius:9px;margin:6px 0}
.nh-task-title{font-weight:700;font-size:13px}.nh-task-sub{font-size:11px;color:#788d97;margin-top:3px}
.nh-task-right{font-size:12px;font-weight:750;text-align:right;white-space:nowrap}
.nh-task.done .nh-task-right{color:#27846b}.nh-task.undone .nh-task-right{color:#bb5375}
.nh-empty{padding:24px;text-align:center;background:#fff;border-radius:12px;color:#71818b}
@media(max-width:640px){.nh-header{align-items:flex-start}.nh-controls input{min-width:150px}.nh-body{padding:13px}.nh-task{align-items:flex-start}.nh-task-sub{overflow-wrap:anywhere}}
`;
function init(){
 if(dialog)return;
 const style=document.createElement('style');style.textContent=CSS;document.head.append(style);
 dialog=document.createElement('dialog');dialog.className='nh-dialog';dialog.innerHTML='<header class="nh-header"><div><h2>내신 숙제 · 학생별 현황</h2><p>이름별 완료 / 미완료 · 실제 풀이 기록 기준</p></div><button type="button" class="nh-close">닫기</button></header><div class="nh-body"></div>';
 document.body.append(dialog);dialog.querySelector('.nh-close').onclick=()=>dialog.close();
}
const body=()=>dialog.querySelector('.nh-body');
async function request(){
 let token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
 if(!token)throw Error('선생님 로그인이 필요합니다.');
 const run=t=>fetch(URL,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({p_include_inactive:filters.history}),cache:'no-store',credentials:'omit'});
 let r=await run(token);
 if(r.status===401){try{const f=window.WillenaAPI?.fetch||fetch;const re=await f('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{credentials:'include',cache:'no-store'}),d=await re.json();if(d.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');r=await run(d.access_token)}}catch(_){}}
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.message||d.error||'숙제 데이터를 불러오지 못했습니다 ('+r.status+')');
 return Array.isArray(d.tasks)?d.tasks:[];
}
function taskHtml(t){
 const done=t.status==='done',total=Number(t.target)||0,completed=Math.min(total,Number(t.done)||0);
 return '<div class="nh-task '+(done?'done':'undone')+'"><div><div class="nh-task-title">'+esc(t.title||((t.lesson||'')+' '+(label[t.practice_type]||t.practice_type)))+'</div><div class="nh-task-sub">'+esc(t.book_label||'')+' · '+esc(label[t.practice_type]||t.practice_type)+(t.due_at?' · 마감 '+esc(date(t.due_at)):' · 기한 없음')+(t.active===false?' · 이전 과제':'')+'</div></div><div class="nh-task-right">'+(done?'완료':'미완료')+'<div>'+completed+' / '+total+'</div></div></div>';
}
function studentHtml(name,items){
 const done=items.filter(t=>t.status==='done'),undone=items.filter(t=>t.status!=='done'),cl=items[0]?.class_name||'';
 const section=(caption,list)=>'<div class="nh-column-head">'+caption+' ('+list.length+')</div>'+(list.length?list.map(taskHtml).join(''):'<div class="nh-task-sub">없음</div>');
 return '<details class="nh-student" open><summary><span class="nh-name">'+esc(name)+'</span><span class="nh-class">'+esc(cl)+'</span><span class="nh-stat done">Done '+done.length+'</span><span class="nh-stat undone">Not done '+undone.length+'</span></summary><div class="nh-student-body">'+(filters.status==='undone'?'':section('완료',done))+(filters.status==='done'?'':section('미완료',undone))+'</div></details>';
}
function render(){
 const visible=rows.filter(t=>(!filters.group||t.group_id===filters.group)&&(!filters.name||(t.student_name||'').toLowerCase().includes(filters.name.toLowerCase()))&&(filters.status==='all'||t.status===filters.status));
 const grouped=new Map();
 for(const t of visible){const id=t.student_id;let bucket=grouped.get(id);if(!bucket){bucket={name:t.student_name,items:[]};grouped.set(id,bucket)}bucket.items.push(t)}
 const groups=[...new Set(rows.map(t=>t.group_id).filter(Boolean))].map(id=>[id,groupNames.get(id)||rows.find(t=>t.group_id===id)?.book_label||id]).sort((a,b)=>a[1].localeCompare(b[1]));
 const existing=body().querySelector('.nh-controls input[name=nh-name]');const active=existing===document.activeElement;
 const cursor=active?{start:existing.selectionStart,end:existing.selectionEnd}:null;
 body().innerHTML='<div class="nh-controls"><label>학생 이름<input name="nh-name" placeholder="학생 검색" value="'+esc(filters.name)+'"></label><label>시험 그룹<select name="nh-group"><option value="">전체 그룹</option>'+groups.map(([id,name])=>'<option value="'+esc(id)+'" '+(id===filters.group?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label><label>상태<select name="nh-status"><option value="all" '+(filters.status==='all'?'selected':'')+'>전체</option><option value="done" '+(filters.status==='done'?'selected':'')+'>Done</option><option value="undone" '+(filters.status==='undone'?'selected':'')+'>Not Done</option></select></label><label class="nh-history"><input type="checkbox" name="nh-history" '+(filters.history?'checked':'')+'>이전 / 비활성 과제 포함</label><button class="nh-refresh" type="button">새로고침</button></div>'+
 '<div class="nh-summary"><span><b>'+grouped.size+'</b>학생</span><span><b>'+visible.length+'</b>과제</span><span><b>'+visible.filter(t=>t.status==='done').length+'</b>완료</span><span><b>'+visible.filter(t=>t.status!=='done').length+'</b>미완료</span></div>'+
 (grouped.size?[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(x=>studentHtml(x.name,x.items)).join(''):'<div class="nh-empty">해당하는 학생 / 과제가 없습니다.</div>');
 const search=body().querySelector('[name=nh-name]');search.oninput=e=>{filters.name=e.target.value;render()};
 body().querySelector('[name=nh-group]').onchange=e=>{filters.group=e.target.value;render()};
 body().querySelector('[name=nh-status]').onchange=e=>{filters.status=e.target.value;render()};
 body().querySelector('[name=nh-history]').onchange=e=>{filters.history=e.target.checked;load()};
 body().querySelector('.nh-refresh').onclick=load;
 if(active){search.focus();if(cursor)try{search.setSelectionRange(cursor.start,cursor.end)}catch(_){}}
}
async function load(){
 const id=++seq;body().innerHTML='<div class="nh-empty">숙제 기록을 불러오는 중…</div>';
 try{const data=await request();if(id!==seq||!dialog.open)return;rows=data;render()}
 catch(e){if(id!==seq)return;body().innerHTML='<div class="nh-empty">'+esc(e.message)+'</div>'}
}
window.NaesinV2HomeworkByStudent={open({groupId='',studentId=''}={}){
 init();filters={name:'',group:groupId,status:'all',history:false};rows=[];
 groupNames=new Map((window.NaesinV2Data?.getCachedGroups?.()||[]).map(x=>{const g=x.group||x;return [g.id,(g.school||'학교')+' · '+(g.book_label||'')]}));
 if(!dialog.open)dialog.showModal();load();
}};
})();
