(() => {
'use strict';
const $ = id => document.getElementById(id);
const API = '/.netlify/functions/test_admin';
const PREFIX = 'Assessment Grid | October 2026 | ';
const ORDER = ['Brown','Stanford','Manchester','New York','Hawaii','Boston','Sydney','Berkeley','Chicago','Cambridge','Yale','Princeton','Oxford','MIT'];
const FIELDS = [
 ['englishName','Name','fixed'], ['koreanName','Korean','fixed'], ['className','Class','fixed'],
 ['nextClass','Next Class','fixed'], ['lib_reading','Book Reading','grade'],
 ['lib_raz','RAZ Kids','grade'], ['lib_punctuality','Punctuality','grade'],
 ['phonics','Phonics','score'], ['listening','Listening','score'], ['vocab','Vocab','score'],
 ['grammar','Grammar','score'], ['gw','Grammar Writing','score'], ['write','Writing','score'],
 ['reading','Reading','score'], ['speaking','Speaking','score']
];
const editable = new Set(FIELDS.filter(x=>x[2]!=='fixed').map(x=>x[0]));
const SKILLS = FIELDS.filter(f=>f[2]==='score').map(f=>f[0]);
function validScore(v) {
 if(v===null||v===undefined||String(v).trim()==='')return null;
 const n=Number(v);return Number.isFinite(n)&&n>=0?n:null;
}
function calculatePercentages(row,totals){
 let earned=0,possible=0,percentSum=0,count=0;
 for(const skill of SKILLS){
  const score=validScore(row.data[skill]);
  const max=validScore(totals[skill]);
  if(score===null||max===null||max<=0)continue;
  earned+=score;possible+=max;percentSum+=(100*score/max);count++;
 }
 return {total:possible>0?earned/possible*100:null,average:count?percentSum/count:null,earned,possible,count};
}
const percentText=v=>v===null?'—':(Math.round(v*10)/10).toFixed(1)+'%';
function refreshPercentages(){
 if(!current)return;
 for(const tr of $('sheet').querySelectorAll('tbody tr[data-row-id]')){
  const r=current.rows.find(x=>x.id===tr.dataset.rowId);
  if(!r)continue;
  const p=calculatePercentages(r,current.totals);
  const total=tr.querySelector('[data-metric="total"]'),average=tr.querySelector('[data-metric="average"]');
  if(total)total.textContent=percentText(p.total);
  if(average)average.textContent=percentText(p.average);
 }
}

let tests = new Map(), klass = '', current = null, selected = null;
let undo = [], redo = [], pending = new Map(), alive = true;
const classCache=new Map(), inflight=new Map();
let selectionSequence=0;
function status(s, problem=false) { $('status').textContent=s; $('status').style.color=problem?'#ffcbcb':''; }
async function api(action, args={}, options={}) {
 const query=new URLSearchParams({action,...args});
 const response=await WillenaAPI.fetch(API+'?'+query.toString(),options);
 const body=await response.json().catch(()=>({}));
 if(!response.ok||body.success===false)throw new Error(body.error||'API HTTP '+response.status);
 return body;
}
const display = x => x===null||x===undefined?'':String(x);
function makeRow(record, entry, testId) {
 const data={...(record.data||{}),...(entry||{})};
 return {id:String(record.sheetRow),testId,userId:record.userId||null,
 englishName:display(record.englishName),koreanName:display(record.koreanName),
 className:display(record.className),nextClass:display(record.nextClass),
 data,rev:0,saved:0,dirty:false,saving:false,failed:false};
}
function findTest(name){return tests.get(name);}
function getClass(name) {
 if(inflight.has(name))return inflight.get(name);
 const t=findTest(name);
 if(!t)return Promise.reject(Error('Unknown class '+name));
 const p=api('get_test',{test_id:t.id}).then(j=>{
  const columns=j.test?.columns||[];
  const meta=columns.find(c=>c.key==='_source_sheet');
  if(!Array.isArray(meta?.rows))throw Error('October rows unavailable');
  const entries=new Map((j.entries||[]).map(x=>[x.user_id,x.data]));
  const rows=meta.rows.map(x=>makeRow(x,x.userId?entries.get(x.userId):null,j.test.id));
  const totals=Object.fromEntries(columns.filter(c=>c.type==='number').map(c=>[c.key,c.max]));
  const prev=classCache.get(name);let changed=0;
  if(prev){
   const old=new Map(prev.rows.map(x=>[x.id,x]));
   for(const fresh of rows) {
    const row=old.get(fresh.id);
    if(!row)continue;
    if(!row.dirty&&!row.saving&&!pending.has(row.testId+':'+row.id) && JSON.stringify(row.data)!==JSON.stringify(fresh.data)){
     row.data=fresh.data;changed++;
    }
   }
   prev.rows=rows.map(x=>old.get(x.id)||x);
   prev.totals=totals;prev.loaded=Date.now();
   return {model:prev,changed};
  }
  const model={name,rows,totals,testId:j.test.id,loaded:Date.now()};
  classCache.set(name,model);
  return {model,changed};
 }).finally(()=>inflight.delete(name));
 inflight.set(name,p);return p;
}
async function openClass(name,refresh=false) {
 if(!findTest(name))return;
 if(refresh){
  if(klass!==name||!current||document.hidden)return;
  try{
   const {changed}=await getClass(name);
   if(klass!==name||!current||current.name!==name)return;
   if(changed){updateVisibleValues();status('Updated from another teacher · '+changed+' row(s)');}
  }catch(e){status('Refresh failed: '+e.message,true);}
  return;
 }
 const sequence=++selectionSequence;
 klass=name;$('klass').value=name;
 $('tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.className===name));
 const cached=classCache.get(name);
 if(cached){
  current=cached;selected=null;render();
  const count=cached.rows.filter(x=>!x.userId).length;
  status('October 2026 · '+cached.rows.length+' students · '+count+' unmatched · saved to Supabase');
  if(Date.now()-cached.loaded>4000)openClass(name,true);
  return;
 }
 current=null;
 $('sheet').querySelector('thead').replaceChildren();$('sheet').querySelector('tbody').replaceChildren();
 $('summary').textContent='Loading '+name+'…';status('Loading '+name+' for the first time…');
 try{
  const {model}=await getClass(name);
  if(sequence!==selectionSequence||klass!==name)return;
  current=model;selected=null;render();
  const count=model.rows.filter(x=>!x.userId).length;
  status('October 2026 · '+model.rows.length+' students · '+count+' unmatched · saved to Supabase');
 }catch(e){if(sequence===selectionSequence)status('Could not load class: '+e.message,true);}
}
async function preloadClasses(){
 const names=sortedClasses().filter(x=>x!==klass);let i=0;
 const runner=async()=>{while(alive&&i<names.length){const name=names[i++];if(classCache.has(name))continue;try{await getClass(name);}catch(e){console.warn('Preload '+name+' failed',e);}}};
 await Promise.all([runner(),runner(),runner(),runner()]);
}
function sortedClasses(){return [...tests.keys()].sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b));}
async function startup(){
 status('Loading October 2026…');
 try{
 const j=window.__assessmentBootstrap || await api('list_tests',{month:'2026-10'});
 window.__assessmentBootstrap = null; // Bootstrap belongs to this page load only.
 for(const t of j.tests||[])if(t.name?.startsWith(PREFIX)) tests.set(t.name.slice(PREFIX.length),t);
 if(!tests.size) throw new Error('No October assessment records found');
 $('klass').replaceChildren();$('tabs').replaceChildren();
 for(const name of sortedClasses()){
 $('klass').add(new Option(name,name));
 const btn=document.createElement('button');btn.textContent=name;btn.dataset.className=name;
 btn.addEventListener('click',()=>openClass(name));$('tabs').append(btn);
 }
 await openClass(tests.has('Brown')?'Brown':sortedClasses()[0]);
 preloadClasses().catch(e=>console.warn('Class preload failed',e));
 }catch(e){status('October data could not load: '+e.message,true);$('summary').textContent='No student information was loaded.'}
}
function validate(row,key,v){
 if(!editable.has(key))return false;
 if(v==='')return true;
 const kind=FIELDS.find(f=>f[0]===key)?.[2];
 if(kind==='grade')return v.length<=12;
 const val=Number(v);if(!Number.isFinite(val)||val<0)return false;
 const max=classCache.get(row.className)?.totals?.[key];
 return max===null||max===undefined||!Number.isFinite(Number(max)) ||val<=Number(max);
}
function noteChange(row,key,value,track=true){
 const v=display(value).trim();
 if(!row?.userId)return false;
 if(!validate(row,key,v))return false;
 const before=display(row.data[key]);
 if(before===v)return true;
 if(track){undo.push({className:klass,id:row.id,key,before,after:v});if(undo.length>120)undo.shift();redo=[];}
 row.data[key]=v===''?null:(FIELDS.find(f=>f[0]===key)?.[2]==='score'?Number(v):v);
 row.rev++;row.dirty=true;
 queueSave(row);
 if(current?.name===row.className)refreshPercentages();
 return true;
}
function queueSave(row){
 if(row.timer)clearTimeout(row.timer);
 pending.set(row.testId+':'+row.id,row);
 row.timer=setTimeout(()=>save(row),380);
 status('Saving changes…');
}
async function save(row){
 if(row.saving)return;
 row.saving=true;
 try{
 while(row.saved<row.rev){
   const rev=row.rev, payload={...row.data};
   const j=await api('upsert_entries',{}, {method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({test_id:row.testId,entries:[{user_id:row.userId,data:payload}]})});
   if(j.failed || !j.upserted)throw new Error('Save was not confirmed');
   row.saved=rev;
 }
 row.dirty=false;row.failed=false;pending.delete(row.testId+':'+row.id);
 if(pending.size===0)status('Saved · October 2026 · refreshes every 5 seconds');
 }catch(e){row.failed=true;row.dirty=true;status('Save failed: '+e.message+' — edit retained on screen',true)}
 finally{row.saving=false}
}
function focusCell(id,k,input){
 selected={id,k};
 const row=current?.rows.find(r=>r.id===id);
 $('address').textContent=(FIELDS.findIndex(f=>f[0]===k)+2)+' · '+(row?.englishName||'');
 $('formula').value=display(row?.data[k]);
 input?.select();
}
function editInput(row,k){
 const input=document.createElement('input');
 input.value=display(row.data[k]);
 input.dataset.rowId=row.id;input.dataset.key=k;
 input.setAttribute('aria-label',row.englishName+' '+k);
 if(!row.userId){input.disabled=true;input.title='Student account not matched — read only'}
 input.addEventListener('focus',()=>focusCell(row.id,k,input));
 input.addEventListener('input',()=>{
  const v=input.value.trim();
  if(validate(row,k,v)){input.removeAttribute('aria-invalid');noteChange(row,k,v);}
  else input.setAttribute('aria-invalid','true');
 });
 input.addEventListener('blur',()=>{if(!validate(row,k,input.value.trim()))input.value=display(row.data[k])});
 input.addEventListener('keydown',e=>{
  if(['Enter','Tab','ArrowDown','ArrowUp'].includes(e.key)){
   if((e.key==='ArrowUp'||e.key==='ArrowDown')&&input.selectionStart!==input.selectionEnd)return;
   const inputs=Array.from($('sheet').querySelectorAll('tbody input:not([disabled])'));
   const idx=inputs.indexOf(input);const cols=FIELDS.length-4;
   const delta=e.key==='ArrowUp'?-cols:e.key==='ArrowDown'||e.key==='Enter'?cols:e.shiftKey?-1:1;
   const next=inputs[idx+delta];if(next){e.preventDefault();next.focus();}
  }
 });
 input.addEventListener('paste',e=>{
  const str=e.clipboardData?.getData('text/plain')||'';
  if(!/\t|\r?\n/.test(str))return;
  e.preventDefault();const matrix=str.replace(/\r/g,'').trimEnd().split('\n').map(s=>s.split('\t'));
  const displayed=current.rows.filter(r=>matchesSearch(r));
  const rr=displayed.findIndex(r=>r.id===row.id),cc=FIELDS.findIndex(f=>f[0]===k);
  let updated=0;
  for(let i=0;i<matrix.length;i++)for(let j=0;j<matrix[i].length;j++){
    const target=displayed[rr+i],field=FIELDS[cc+j];if(!target||!field||!editable.has(field[0]))continue;
    if(noteChange(target,field[0],matrix[i][j]))updated++;
  }
  render();status('Pasted '+updated+' cells · saving…');
 });
 return input;
}
function matchesSearch(row){const q=$('search').value.toLowerCase().trim();return !q || [row.englishName,row.koreanName,row.className].some(x=>x.toLowerCase().includes(q));}
function render(){
 if(!current)return;
 $('tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.className===klass));
 const head=$('sheet').querySelector('thead'),body=$('sheet').querySelector('tbody');head.replaceChildren();body.replaceChildren();
 const tr=document.createElement('tr');
 for(const text of ['#',...FIELDS.map(f=>f[1]),'Total %','Average %']){const th=document.createElement('th');th.textContent=text;tr.append(th);}
 head.append(tr);
 const visible=current.rows.filter(matchesSearch);
 visible.forEach((r,i)=>{
 const tr=document.createElement('tr');tr.dataset.rowId=r.id;
 const no=document.createElement('td');no.textContent=i+2;tr.append(no);
 for(const [k,,kind] of FIELDS){
 const td=document.createElement('td');td.dataset.field=k;
 if(kind==='fixed'){td.className='locked';td.textContent=r[k];}
 else td.append(editInput(r,k));
 tr.append(td);
 }
 const pct=calculatePercentages(r,current.totals);
 for(const [key,value,help] of [
  ['total',pct.total,'Total earned points / total possible points for scored skills'],
  ['average',pct.average,'Average of each scored skill percentage']
 ]){const cell=document.createElement('td');cell.className='metric';
  cell.dataset.metric=key;cell.textContent=percentText(value);cell.title=help;tr.append(cell);}
 if(!r.userId){tr.className='unmatched';tr.title='Not linked to a student account — values shown read-only';}
 body.append(tr);
 });
 const total=document.createElement('tr');total.className='totals';
 for(const [i,[k,,kind]] of FIELDS.entries()){
 if(i===0){const no=document.createElement('td');no.textContent='Σ';total.append(no);}
 const td=document.createElement('td');
 if(i===0)td.textContent='Class TOTAL';
 else if(kind==='score')td.textContent=display(current.totals[k]);
 total.append(td);
 }
 for(let j=0;j<2;j++){const td=document.createElement('td');td.className='metric';td.textContent='—';total.append(td);}
 body.append(total);
 $('summary').textContent=visible.length+' of '+current.rows.length+' students · '+current.rows.filter(r=>!r.userId).length+' unmatched (read-only) · '+klass;
}
function updateVisibleValues(){
 if(!current)return;
 for(const tr of $('sheet').querySelectorAll('tbody tr[data-row-id]')){
 const r=current.rows.find(x=>x.id===tr.dataset.rowId);if(!r)continue;
 for(const input of tr.querySelectorAll('input')){
 if(document.activeElement!==input)input.value=display(r.data[input.dataset.key]);
 }
 }
 refreshPercentages();
}
function history(type){
 const from=type==='undo'?undo:redo, dest=type==='undo'?redo:undo;
 const op=from.pop();if(!op||op.className!==klass)return;
 const r=current?.rows.find(x=>x.id===op.id);if(!r)return;
 const target=type==='undo'?op.before:op.after;
 if(noteChange(r,op.key,target,false)){dest.push(op);updateVisibleValues();}
}
$('undo').addEventListener('click',()=>history('undo'));
$('redo').addEventListener('click',()=>history('redo'));
$('reset').textContent='Reload class';
$('reset').onclick=()=>{if(pending.size){status('Finish saving edits before reloading',true);return;}openClass(klass)};
$('klass').addEventListener('change',e=>openClass(e.target.value));
$('search').addEventListener('input',render);
$('formula').addEventListener('change',()=>{
 if(!selected||!current)return;
 const row=current.rows.find(r=>r.id===selected.id);
 if(!noteChange(row,selected.k,$('formula').value))status('Invalid value (or unmatched student)',true);
 updateVisibleValues();
});
window.addEventListener('keydown',e=>{
 if(!(e.ctrlKey||e.metaKey)||!['z','y'].includes(e.key.toLowerCase()))return;
 if(e.target instanceof HTMLInputElement)return;
 e.preventDefault();history(e.key.toLowerCase()==='z'&&!e.shiftKey?'undo':'redo');
});
setInterval(()=>{if(alive&&current&&!document.hidden)openClass(klass,true)},5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&current)openClass(klass,true)});
window.addEventListener('beforeunload',()=>{alive=false});
startup();
})();