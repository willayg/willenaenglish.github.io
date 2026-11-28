// Shared Library register module. The schedule and all records are staff-only data.
export const ATTENDANCE=[['','Not marked'],['present','Present'],['late_5','Late 5m'],['late_10','Late 10m'],['late_15','Late 15m'],['late_20','Late 20m'],['late_5_10','Late 5–10m'],['late_10_15','Late 10–15m'],['late_15_plus','Late 15m+'],['absent','Absent'],['exception','Approved exception']];
export const JOURNAL=[['','Not marked'],['done','Done'],['in_progress','In progress'],['not_done','Not done'],['book_report','Book report']];
export const LATE_STEPS=['late_5','late_10','late_15','late_20'];
export function nextLate(value){const at=LATE_STEPS.indexOf(value);return LATE_STEPS[(at+1)%LATE_STEPS.length]}
export function nextRegisterStatus(field,action,current){return action==='late'&&field==='attendance'?nextLate(current):action==='clear'||action===current?null:action}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const kstNow=()=>new Date(Date.now()+9*3600000).toISOString();
export const todayKST=()=>kstNow().slice(0,10);
export const dayOfWeek=d=>new Date(d+'T00:00:00Z').getUTCDay()||7;
export const timeMinutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
export const timeLabel=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
export function slotsFor(schedule,date){
 const groups=new Map();for(const s of schedule){if(!s.weekdays.includes(dayOfWeek(date)))continue;const start=timeMinutes(s.start_time);if(!groups.has(start))groups.set(start,{start,end:start+s.duration_minutes,classes:[]});groups.get(start).classes.push(s.class_name)}
 return [...groups.values()].sort((a,b)=>a.start-b.start);
}
export function chooseSlot(slots,minute){
 return slots.find(s=>minute>=s.start&&minute<s.end)?.start??slots.find(s=>s.start>minute)?.start??slots.at(-1)?.start??null;
}
export function previousSchoolDay(date,schedule){
 let d=new Date(date+'T00:00:00Z');for(let i=0;i<7;i++){d.setUTCDate(d.getUTCDate()-1);const key=d.toISOString().slice(0,10);if(slotsFor(schedule,key).length)return key}return date;
}
export function classRows(students,records,cls){
 const by=new Map(records.map(r=>[r.student_id,r]));const out=[];
 for(const s of students){if(s.class!==cls||by.has(s.id)&&by.get(s.id).class_name!==cls)continue;const old=by.get(s.id);out.push({student_id:s.id,class_name:cls,student_name:s.name||s.korean_name||'Unnamed',korean_name:s.korean_name||'',attendance:old?.attendance??null,journal:old?.journal??null})}
 for(const r of records){if(r.class_name===cls&&!out.some(x=>x.student_id===r.student_id))out.push({...r,historical:true})}
 return out.sort((a,b)=>(a.student_name||'').localeCompare(b.student_name||'')||a.student_id.localeCompare(b.student_id));
}
export function mountDailyRegister({root,api,getStudents}){
 const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
 const d={date:todayKST(),schedule:null,slot:null,records:[],dirty:new Map(),timer:null,saving:null,loading:false,loaded:false,visible:false,manual:false,error:'',request:0,saveFailed:false};
 const dateInput=$('#registerDate'),status=$('#registerStatus'),content=$('#registerContent'),retry=$('#registerSave');
 const localMinute=()=>timeMinutes(kstNow().slice(11,16));
 const slots=()=>slotsFor(d.schedule||[],d.date);
 const activeSlot=()=>slots().find(s=>s.start===d.slot);
 const dirtyCount=()=>d.dirty.size;
 const hasPending=()=>!!d.saving||!!dirtyCount();
 function syncStatus(){
  retry.hidden=!hasPending()&&!d.saveFailed;retry.disabled=!!d.saving||d.loading;
  retry.textContent=d.saveFailed?'Retry save':'Save changes';
  status.classList.toggle('error',!!d.error);
  status.textContent=d.error||(d.loading?'Loading register…':d.saving?'Saving register…':dirtyCount()?'Unsaved changes':d.loaded?'All changes saved':'');
  dateInput.disabled=d.loading;
 }
 function setError(e){d.error=e?.message||String(e);syncStatus()}
 function rowMarkup(r){
  const att=r.attendance||'',jour=r.journal||'',late=att.startsWith('late_'),absent=att==='absent';
  const lateLabel=({late_5:'5분 지각',late_10:'10분 지각',late_15:'15분 지각',late_20:'20분 지각',late_5_10:'5~10분 지각',late_10_15:'10~15분 지각',late_15_plus:'15분 이상 지각'})[att]||'지각';
  const button=(field,action,label,active,style,title,disabled=false)=>'<button type="button" class="reg-choice '+style+(active?' is-selected':'')+'" data-field="'+field+'" data-action="'+action+'" data-id="'+esc(r.student_id)+'" data-class="'+esc(r.class_name)+'" aria-pressed="'+active+'" aria-label="'+esc(title)+'" title="'+esc(title)+'" '+(disabled?'disabled':'')+'><span data-no-translate lang="ko">'+label+'</span></button>';
  const clear=(field,disabled)=>button(field,'clear','<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 8a6 6 0 1 1 1 6M4 3v5h5"/></svg>',false,'reg-clear','Clear status',disabled);
  const attendance=button('attendance','present','출석',att==='present','reg-green','Present')+button('attendance','late',lateLabel,late,'reg-amber','Cycle late: 5 → 10 → 15 → 20 minutes')+button('attendance','absent','결석',absent,'reg-red','Absent')+button('attendance','exception','예외',att==='exception','reg-purple','Approved exception')+clear('attendance',!att);
  const journal=button('journal','done','완료',jour==='done','reg-green','Done',absent)+button('journal','in_progress','진행 중',jour==='in_progress','reg-amber','In progress',absent)+button('journal','not_done','미완료',jour==='not_done','reg-red','Not done',absent)+button('journal','book_report','북리포트',jour==='book_report','reg-blue','Book report',absent)+clear('journal',!jour||absent);
  return '<tr><td class="register-name"><strong data-no-translate>'+esc(r.student_name)+'</strong><small data-no-translate>'+esc(r.korean_name&&r.korean_name!==r.student_name?r.korean_name:'')+'</small>'+(r.historical?'<small>Previous class record</small>':'')+'</td><td><div class="reg-choices" role="group" aria-label="Attendance">'+attendance+'</div></td><td><div class="reg-choices" role="group" aria-label="Journal">'+journal+'</div></td></tr>';
 }
 function render(){
  const scrollPositions=new Map($$('[data-register-scroll]').map(el=>[el.dataset.registerScroll,el.scrollLeft]));
  const list=slots(),slot=activeSlot();dateInput.value=d.date;dateInput.max=todayKST();
  $('#registerPrev').disabled=d.loading;$('#registerToday').disabled=d.loading;$('#registerNext').disabled=d.loading||d.date>=todayKST();
  if(d.loading){content.innerHTML='<div class="empty">Loading register…</div>';syncStatus();return}
  if(!d.loaded){content.innerHTML='<div class="empty">Could not load the register.</div><button class="secondary" id="registerReload">Reload register</button>';$('#registerReload').onclick=()=>loadDate(d.date);syncStatus();return}
  if(!list.length){content.innerHTML='<section class="panel register-weekend"><h2>No scheduled Library Time</h2><p class="muted">Choose a school day to view the register.</p><button class="secondary" id="previousSchoolDay">Previous school day</button></section>';$('#previousSchoolDay').onclick=()=>changeDate(previousSchoolDay(d.date,d.schedule));syncStatus();return}
  const current=d.date===todayKST()?list.find(s=>localMinute()>=s.start&&localMinute()<s.end):null;
  let html='<div class="register-slots" role="group" aria-label="Library time slots">'+list.map(s=>'<button type="button" class="slot-button '+(s.start===d.slot?'selected':'')+(current?.start===s.start?' is-current':'')+'" data-slot="'+s.start+'" aria-pressed="'+(s.start===d.slot)+'" title="'+esc(s.classes.join(' / '))+'"><strong data-no-translate>'+timeLabel(s.start)+'</strong></button>').join('')+'</div>';
  if(!slot){content.innerHTML=html;syncStatus();return}
  const groups=slot.classes.map(cls=>({cls,rows:classRows(getStudents(),d.records,cls)})),rows=groups.flatMap(g=>g.rows);
  const count=value=>rows.filter(r=>value(r)).length;
  const metrics=[['Present',count(r=>r.attendance==='present')],['Late',count(r=>r.attendance?.startsWith('late_'))],['Absent',count(r=>r.attendance==='absent')],['Exception',count(r=>r.attendance==='exception')],['Not marked',count(r=>!r.attendance)]];
  if(d.date!==todayKST())html+='<p class="register-past muted" title="Past dates show the current class roster plus any previously saved records. Check enrolment changes before editing.">Past date · Check enrolment changes.</p>';
  html+='<div class="register-session-title"><div><h2 data-no-translate>'+timeLabel(slot.start)+'–'+timeLabel(slot.end)+'</h2></div><button class="secondary" id="registerAuto" type="button">Follow current time</button></div><div class="register-metrics">'+metrics.map(([l,n])=>'<div class="metric"><span>'+l+'</span><strong>'+n+'</strong></div>').join('')+'</div>';
  for(const g of groups){
   const eligibleRows=g.rows.filter(r=>r.attendance&&r.attendance!=='absent'),completed=eligibleRows.filter(r=>r.journal==='done'||r.journal==='book_report').length,eligible=eligibleRows.length;
   html+='<section class="panel register-class"><div class="panel-head"><div><h2 data-no-translate>'+esc(g.cls)+'</h2><p class="muted">'+g.rows.length+' students</p></div><div class="register-bulk"><button type="button" class="secondary" data-all-present="'+esc(g.cls)+'" '+(!g.rows.some(r=>!r.attendance)?'disabled':'')+'>Mark unmarked present</button><button type="button" class="secondary" data-all-done="'+esc(g.cls)+'" '+(!g.rows.some(r=>r.attendance&&r.attendance!=='absent'&&!r.journal)?'disabled':'')+'>Mark journals done</button></div></div><div class="register-progress"><span>Journal completion</span><strong>'+completed+'/'+eligible+'</strong></div><div class="register-track"><div style="width:'+Math.min(100,eligible?completed/eligible*100:0)+'%"></div></div>'+(g.rows.length?'<div class="table-wrap register-table-scroll" data-register-scroll="'+esc(g.cls)+'"><table class="register-table"><thead><tr><th>Student</th><th>Attendance</th><th>Journal</th></tr></thead><tbody>'+g.rows.map(rowMarkup).join('')+'</tbody></table></div>':'<div class="empty">No students in this class.</div>')+'</section>';
  }
  content.innerHTML=html;
  const restoreScroll=()=>$$('[data-register-scroll]').forEach(el=>{if(scrollPositions.has(el.dataset.registerScroll))el.scrollLeft=scrollPositions.get(el.dataset.registerScroll)});
  restoreScroll();
  $$('[data-slot]').forEach(el=>el.onclick=()=>{d.manual=true;d.slot=Number(el.dataset.slot);render()});
  $('#registerAuto').onclick=()=>{d.manual=false;d.slot=chooseSlot(slots(),localMinute());render()};
  $$('[data-field]').forEach(el=>el.onclick=()=>{
   const {id,field,action}=el.dataset,cls=el.dataset.class;
   const current=d.records.find(r=>r.student_id===id)?.[field]||null;
   patch(id,cls,{[field]:nextRegisterStatus(field,action,current)});
   const left=new Map($$('[data-register-scroll]').map(el=>[el.dataset.registerScroll,el.scrollLeft]));
   render();scheduleSave();
   const replacement=$$('[data-field]').find(b=>b.dataset.id===id&&b.dataset.field===field&&b.dataset.action===action);
   if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});
   // Some browsers still scroll focused controls; restore each class independently.
   $$('[data-register-scroll]').forEach(el=>{if(left.has(el.dataset.registerScroll))el.scrollLeft=left.get(el.dataset.registerScroll)});
  });
  $$('[data-all-present]').forEach(el=>el.onclick=()=>{for(const r of classRows(getStudents(),d.records,el.dataset.allPresent))if(!r.attendance)patch(r.student_id,r.class_name,{attendance:'present'});render();scheduleSave()});
  $$('[data-all-done]').forEach(el=>el.onclick=()=>{for(const r of classRows(getStudents(),d.records,el.dataset.allDone))if(r.attendance&&r.attendance!=='absent'&&!r.journal)patch(r.student_id,r.class_name,{journal:'done'});render();scheduleSave()});
  syncStatus();
 }
 function patch(id,cls,fields){
  const row=d.records.find(r=>r.student_id===id);if(row){Object.assign(row,fields)}else{const s=getStudents().find(x=>x.id===id);if(!s)return;d.records.push({student_id:id,class_name:cls,student_name:s.name||s.korean_name||'Unnamed',korean_name:s.korean_name||'',attendance:null,journal:null,...fields})}
  d.dirty.set(id,{...d.dirty.get(id),student_id:id,class_name:cls,...fields});d.error='';d.saveFailed=false;syncStatus();
 }
 function scheduleSave(){clearTimeout(d.timer);d.timer=setTimeout(()=>{flush().catch(()=>{})},650)}
 async function flush(){
  clearTimeout(d.timer);if(d.saving){await d.saving;if(d.dirty.size)return flush();return}
  if(!d.dirty.size)return;
  const batch=[...d.dirty.values()],date=d.date;d.dirty.clear();d.error='';d.saveFailed=false;
  d.saving=(async()=>{try{const res=await api('register-save',{date,rows:batch});if(res.saved!==batch.length)throw Error('Register save incomplete. Retry.')}
    catch(e){for(const r of batch)d.dirty.set(r.student_id,{...r,...d.dirty.get(r.student_id)});d.saveFailed=true;setError(e);throw e}
    finally{d.saving=null;syncStatus()}})();syncStatus();await d.saving;
  if(d.dirty.size)await flush();
 }
 async function loadDate(date){
  const token=++d.request;d.loading=true;d.loaded=false;d.error='';render();
  try{const [schedule,day]=await Promise.all([d.schedule?Promise.resolve({schedule:d.schedule}):api('register-schedule'),api('register-day',undefined,date)]);if(token!==d.request)return;d.schedule=schedule.schedule||[];d.records=day.records||[];d.date=date;d.slot=chooseSlot(slots(),date===todayKST()?localMinute():0);d.manual=date!==todayKST();d.loaded=true}
  catch(e){if(token===d.request)setError(e)}
  finally{if(token===d.request){d.loading=false;render()}}
 }
 async function changeDate(date){
  if(!date||date>todayKST()||date<'2026-01-01'||d.loading){dateInput.value=d.date;return}
  try{await flush()}catch{dateInput.value=d.date;return}
  await loadDate(date);
 }
 function shift(days){const date=new Date(d.date+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+days);changeDate(date.toISOString().slice(0,10))}
 dateInput.onchange=()=>changeDate(dateInput.value);
 $('#registerToday').onclick=()=>changeDate(todayKST());$('#registerPrev').onclick=()=>shift(-1);$('#registerNext').onclick=()=>shift(1);retry.onclick=()=>flush().catch(()=>{});
 window.addEventListener('beforeunload',e=>{if(hasPending()){e.preventDefault();e.returnValue=''}});
 setInterval(()=>{if(!d.visible||d.loading||!d.loaded||d.manual||hasPending())return;if(d.date!==todayKST()){changeDate(todayKST());return}const next=chooseSlot(slots(),localMinute());if(next!==d.slot){d.slot=next;render()}},15000);
 return {async show(target){d.visible=true;if(!hasPending()){await loadDate(target?.date||d.date);if(target?.className&&d.loaded){const wanted=slots().find(s=>s.classes.includes(target.className));if(wanted){d.slot=wanted.start;d.manual=true;render()}}}else render()},async hide(){try{await flush();d.visible=false;return true}catch{return false}},refreshRoster(){if(d.loaded&&d.visible)render()}};
}
