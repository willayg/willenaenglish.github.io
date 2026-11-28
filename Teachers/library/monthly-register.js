import {todayKST,dayOfWeek,ATTENDANCE,JOURNAL} from './daily-register.js?v=5';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const A={'present':'✓','late_5':'5m','late_10':'10m','late_15':'15m','late_20':'20m','late_5_10':'L','late_10_15':'LL','late_15_plus':'LLL','absent':'ㅡ','exception':'EX'};
const J={'done':'O','in_progress':'ING','not_done':'X','book_report':'BR'};
export function monthDays(month,weekdays){const d=new Date(month+'-01T00:00:00Z'),out=[];while(d.toISOString().slice(0,7)===month){const key=d.toISOString().slice(0,10);if(weekdays.includes(dayOfWeek(key)))out.push(key);d.setUTCDate(d.getUTCDate()+1)}return out}
export function monthlyRows(students,records,cls){const by=new Map();for(const s of students)if(s.class===cls)by.set(s.id,{id:s.id,name:s.name||s.korean_name||'Unnamed',ko:s.korean_name||'',historical:false});for(const r of records)if(r.class_name===cls&&!by.has(r.student_id))by.set(r.student_id,{id:r.student_id,name:r.student_name||r.korean_name||'Unnamed',ko:r.korean_name||'',historical:true});return [...by.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))}
export function mountMonthlyRegister({root,api,getStudents,openDay}){
 const $=s=>root.querySelector(s);const monthInput=$('#registerMonth'),classInput=$('#registerMonthClass'),body=$('#registerMonthBody'),status=$('#registerMonthStatus');
 let month=todayKST().slice(0,7),cls='',mode='attendance',schedule=[],records=[],loaded=false,loading=false,error='',seq=0;
 function render(){
  monthInput.value=month;monthInput.max=todayKST().slice(0,7);monthInput.disabled=loading;classInput.disabled=loading||!loaded;
  root.querySelectorAll('[data-register-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.registerMode===mode));b.classList.toggle('selected',b.dataset.registerMode===mode)});
  status.textContent=loading?'Loading register…':error;status.classList.toggle('error',!!error);
  if(loading){body.innerHTML='<div class="empty">Loading register…</div>';return}
  if(!loaded){body.innerHTML='<div class="empty">Could not load the register.</div><button type="button" class="secondary" id="retryMonthRegister">Reload register</button>';$('#retryMonthRegister').onclick=load;return}
  const group=schedule.find(s=>s.class_name===cls);if(!group){body.innerHTML='<div class="empty">Choose a class</div>';return}
  const days=monthDays(month,group.weekdays),past=days.filter(d=>d<=todayKST()),rows=monthlyRows(getStudents(),records,cls),lookup=new Map(records.map(r=>[r.session_date+'|'+r.student_id,r])),codes=mode==='attendance'?A:J,options=mode==='attendance'?ATTENDANCE:JOURNAL;
  const stats=rows.flatMap(s=>past.map(day=>lookup.get(day+'|'+s.id))).filter(r=>r?.class_name===cls&&r?.[mode]);const count=stats.length;
  const done=stats.filter(r=>mode==='attendance'?r.attendance==='present':r.journal==='done'||r.journal==='book_report').length;
  const label=mode==='attendance'?'Present':'Journal completion';
  let h='<div class="register-month-summary"><div><strong>'+count+'</strong><span>Recorded entries</span></div><div><strong>'+done+'</strong><span>'+label+'</span></div><div><strong>'+rows.length+'</strong><span>Students</span></div></div>';
  h+='<p class="muted small">Select a date cell to open that day’s register. Blank cells are not marked, not automatically present.</p><div class="month-register-scroll"><table class="month-register-table"><thead><tr><th class="month-student">Student</th>'+days.map(d=>'<th data-no-translate '+(d===todayKST()?'class="month-today"':'')+'>'+Number(d.slice(8))+'</th>').join('')+'</tr></thead><tbody>';
  for(const s of rows){h+='<tr><th class="month-student"><strong data-no-translate>'+esc(s.name)+'</strong><small data-no-translate>'+esc(s.ko===s.name?'':s.ko)+'</small>'+(s.historical?'<small>Previous class record</small>':'')+'</th>';
   for(const date of days){const r=lookup.get(date+'|'+s.id),otherClass=r&&r.class_name!==cls;const state=!otherClass?r?.[mode]||'':'';const absentJournal=mode==='journal'&&r?.attendance==='absent'&&!otherClass;const label=absentJournal?'Absent':options.find(x=>x[0]===state)?.[1]||'Not marked';const disabled=date>todayKST()||otherClass||s.historical&&!r;
    h+='<td><button type="button" class="month-cell" data-state="'+esc(absentJournal?'absent':state)+'" data-day="'+esc(date)+'" '+(disabled?'disabled':'')+' title="'+esc(label)+'" aria-label="'+esc(date+' '+s.name+' '+label)+'"><span data-no-translate>'+esc(absentJournal?'—':codes[state]||'·')+'</span></button></td>'}h+='</tr>'}
  h+='</tbody></table></div><div class="month-legend">'+options.map(([v,l])=>'<span><i data-state="'+esc(v)+'" data-no-translate>'+esc(codes[v]||'·')+'</i>'+esc(l)+'</span>').join('')+'</div><p class="muted small">Past months include the current roster plus saved historical records. Unmarked days are not used for attendance grades.</p>';
  body.innerHTML=h;body.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>openDay(b.dataset.day,cls));
 }
 async function load(){const token=++seq;loading=true;loaded=false;error='';render();try{const result=await api('register-month',undefined,month+'-01');if(token!==seq)return;schedule=result.schedule||[];records=result.records||[];if(!schedule.some(s=>s.class_name===cls))cls=schedule[0]?.class_name||'';classInput.innerHTML=schedule.map(s=>'<option data-no-translate value="'+esc(s.class_name)+'"'+(s.class_name===cls?' selected':'')+'>'+esc(s.class_name)+'</option>').join('');loaded=true}catch(e){if(token===seq)error=e.message||String(e)}finally{if(token===seq){loading=false;render()}}}
 monthInput.onchange=()=>{if(monthInput.value&&monthInput.value<=todayKST().slice(0,7)&&monthInput.value>='2026-01'){month=monthInput.value;load()}else monthInput.value=month};
 classInput.onchange=()=>{cls=classInput.value;render()};root.querySelectorAll('[data-register-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.registerMode;render()});
 return {async show(){await load()}};
}
