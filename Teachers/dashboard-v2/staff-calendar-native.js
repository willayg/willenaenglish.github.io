// Native Willena Staff Calendar: lives inside Teachers Dashboard, no separate login.
(()=>{
'use strict';
const API='/api/native-staff-calendar';
const CATS={events:'Willena events',staff:'Staff',academic:'Academic',deadline:'Deadlines'};
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const dayKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d)};
const today=new Date();
const state={cursor:new Date(today.getFullYear(),today.getMonth(),1),mode:'month',events:[],visible:new Set(Object.keys(CATS)),loaded:false,loading:false,open:false,edit:null,saving:false,source:'native'};
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n}
function notice(s,error=false){const el=$('wcNotice');if(!el)return;el.textContent=s;el.hidden=!s;el.classList.toggle('error',error)}
async function api(method,path='',body){
 const headers={'Content-Type':'application/json'};
 const backup=window.WillenaAPI?.getLocalAccessToken?.()||'';
 if(backup.split('.').length===3)headers.Authorization='Bearer '+backup;
 const r=await fetch(API+path,{method,credentials:'include',cache:'no-store',headers,body:body?JSON.stringify(body):undefined});
 const text=await r.text();let j={};
 try{j=JSON.parse(text)}catch{}
 if(!r.ok||j.success===false)throw Error(j.error||'Calendar request failed ('+r.status+')');
 return j;
}
function weekStart(d){const r=new Date(d.getFullYear(),d.getMonth(),d.getDate());r.setDate(r.getDate()-r.getDay());return r}
function occurrence(e,d){
 const first=parse(e.event_date),now=dayKey(d);
 if(now<e.event_date)return false;
 if(e.repeat_rule==='weekly'){const delta=Math.round((d-first)/86400000);return delta%7===0}
 if(e.repeat_rule==='monthly')return d.getDate()===first.getDate();
 return now===e.event_date;
}
function onDay(d){return state.events.filter(e=>state.visible.has(e.category)&&occurrence(e,d)).sort((a,b)=>(a.event_time||'99:99').localeCompare(b.event_time||'99:99'))}
function button(label,cls,fn){const b=node('button',cls,label);b.type='button';b.onclick=fn;return b}
function render(){
 const grid=$('wcDays');if(!grid)return;
 const {cursor,mode}=state;
 const first=mode==='week'?weekStart(cursor):new Date(cursor.getFullYear(),cursor.getMonth(),1);
 if(mode==='month')first.setDate(first.getDate()-first.getDay());
 $('wcPeriod').textContent=mode==='month'?cursor.toLocaleDateString('en-US',{month:'long',year:'numeric'}):weekStart(cursor).toLocaleDateString('en-US',{month:'short',day:'numeric'})+' – '+new Date(weekStart(cursor).getFullYear(),weekStart(cursor).getMonth(),weekStart(cursor).getDate()+6).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
 $('wcMonth').classList.toggle('active',mode==='month');$('wcWeek').classList.toggle('active',mode==='week');
 grid.replaceChildren();
 const n=mode==='month'?42:7;
 for(let i=0;i<n;i++){
  const d=new Date(first.getFullYear(),first.getMonth(),first.getDate()+i);
  const cell=node('div','wc-day'+(mode==='month'&&d.getMonth()!==cursor.getMonth()?' other':'')+(dayKey(d)===dayKey(today)?' today':''));
  cell.tabIndex=0;cell.setAttribute('role','button');cell.setAttribute('aria-label','Add event on '+dayKey(d));
  cell.append(node('span','wc-day-number',d.getDate()));
  const events=onDay(d),max=mode==='month'?3:12;
  for(const ev of events.slice(0,max)){
   const b=button('','wc-event '+ev.category,()=>edit(ev));
   const time=ev.event_time?.slice(0,5)||'';
   if(time)b.append(node('span','wc-time',time+'  '));
   b.append(document.createTextNode(ev.title));b.title=ev.title+(time?' · '+time:'');cell.append(b);
  }
  if(events.length>max)cell.append(node('div','wc-more','+'+(events.length-max)+' more'));
  cell.addEventListener('click',e=>{if(!e.target.closest('button'))edit(null,dayKey(d))});
  cell.addEventListener('keydown',e=>{if(e.target===cell&&(e.key==='Enter'||e.key===' ')){e.preventDefault();edit(null,dayKey(d))}});
  grid.append(cell);
 }
 upcoming();
}
function upcoming(){
 const list=$('wcUpcoming');if(!list)return;list.replaceChildren();
 let count=0;
 for(let i=0;i<90&&count<8;i++){
  const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()+i);
  for(const ev of onDay(d)){
   const b=button('','',()=>edit(ev));
   b.append(node('small','',d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+(ev.event_time?' · '+ev.event_time.slice(0,5):'')));
   b.append(node('strong','',ev.title));
   list.append(b);if(++count===8)break;
  }
 }
 if(!count)list.append(node('p','wc-empty','No upcoming staff events.'));
}
async function load(){
 if(state.loading)return;
 state.loading=true;notice('Loading shared staff calendar…');
 try{
  const start=new Date(today.getFullYear()-1,today.getMonth(),1);
  const end=new Date(Math.max(today.getFullYear(),state.cursor.getFullYear())+2,11,31);
  const data=await api('GET','?from='+dayKey(start)+'&to='+dayKey(end));
  state.events=data.events||[];state.loaded=true;notice('');render()
 }catch(e){notice(e.message,true)}
 finally{state.loading=false}
}
function edit(ev=null,date=dayKey(today)){
 const dialog=$('wcDialog');if(!dialog||!state.loaded)return;
 state.edit=ev?.id||null;
 $('wcDialogTitle').textContent=ev?'Edit event':'New event';
 $('wcTitle').value=ev?.title||'';
 $('wcDate').value=ev?.event_date||date;
 $('wcTime').value=ev?.event_time?.slice(0,5)||'';
 $('wcCategory').value=ev?.category||'events';
 $('wcRepeat').value=ev?.repeat_rule||'none';
 $('wcRepeat').disabled=false;
 $('wcNotes').value=ev?.notes||'';
 $('wcDelete').hidden=!ev;$('wcFormError').textContent='';
 dialog.showModal();$('wcTitle').focus();
}
async function save(e){
 e.preventDefault();if(state.saving)return;state.saving=true;
 const item={id:state.edit,title:$('wcTitle').value.trim(),date:$('wcDate').value,time:$('wcTime').value,category:$('wcCategory').value,repeat:$('wcRepeat').value,notes:$('wcNotes').value.trim()};
 const submit=$('wcSave');submit.disabled=true;
 try{await api(state.edit?'PATCH':'POST','',item);$('wcDialog').close();await load()}
 catch(e){$('wcFormError').textContent=e.message}
 finally{state.saving=false;submit.disabled=false}
}
async function remove(){
 if(state.saving||!state.edit||!confirm('Delete this event and all repeats?'))return;
 state.saving=true;
 try{await api('DELETE','',{id:state.edit});$('wcDialog').close();await load()}
 catch(e){$('wcFormError').textContent=e.message}
 finally{state.saving=false}
}
function init(){
 if(state.open)return;state.open=true;
 $('wcNew').onclick=()=>edit();
 $('wcPrev').onclick=()=>{state.cursor=state.mode==='month'?new Date(state.cursor.getFullYear(),state.cursor.getMonth()-1,1):new Date(state.cursor.getFullYear(),state.cursor.getMonth(),state.cursor.getDate()-7);render()};
 $('wcNext').onclick=()=>{state.cursor=state.mode==='month'?new Date(state.cursor.getFullYear(),state.cursor.getMonth()+1,1):new Date(state.cursor.getFullYear(),state.cursor.getMonth(),state.cursor.getDate()+7);render()};
 $('wcToday').onclick=()=>{state.cursor=new Date(today);render()};
 $('wcMonth').onclick=()=>{state.mode='month';render()};
 $('wcWeek').onclick=()=>{state.mode='week';render()};
 $('wcRefresh').onclick=()=>load();
 $('wcForm').addEventListener('submit',save);
 $('wcCancel').onclick=$('wcClose').onclick=()=>$('wcDialog').close();
 $('wcDelete').onclick=remove;
 const filt=$('wcFilters');for(const [id,label]of Object.entries(CATS)){
  const b=button('','wc-filter',()=>{state.visible.has(id)?state.visible.delete(id):state.visible.add(id);b.classList.toggle('off',!state.visible.has(id));render()});
  b.append(node('span','wc-dot '+id));b.append(document.createTextNode(label));filt.append(b)
 }
 render();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('view-staff-calendar')?.classList.contains('active'))load()});
}
window.WillenaStaffCalendar={open(){init();load();window.WillenaPush?.refresh?.()}};
})();
