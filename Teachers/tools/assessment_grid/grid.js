(() => {
'use strict';
const $ = id => document.getElementById(id);
const API = '/.netlify/functions/test_admin';
const GRID_REV='2026.10.30.02';
const PERIODS = {
 '2026-02': 'February 2026',
 '2026-06': 'June 2026',
 '2026-10': 'October 2026'
};
let period = '2026-10';
const periodLabel = () => PERIODS[period] || period;
const periodPrefix = () => 'Assessment Grid | '+periodLabel()+' | ';
const ORDER = ['Brown','Stanford','Manchester','New York','Hawaii','Boston','Sydney','Berkeley','Chicago','Cambridge','Yale','Washington','Princeton','Oxford','MIT','Dublin','Pre-Harvard'];
const FIELDS = [
 ['englishName','Name','fixed'], ['koreanName','Korean','fixed'],
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

let tests = new Map(), klass = '', current = null, selected = null;
let undo = [], redo = [], pending = new Map(), alive = true;
const pendingMaxima=new Set();
let maximumPreview=null;
let lastTyping = null;
function historyFor(stack,testId){
 for(let i=stack.length-1;i>=0;i--)if(stack[i].testId===testId)return i;
 return -1;
}
function pushTransaction(changes,{typing=false}={}){
 if(!changes.length)return;
 const testId=changes[0].testId;
 const now=Date.now();
 const cell=typing&&changes.length===1?testId+':'+changes[0].id+':'+changes[0].key:null;
 const latest=undo[undo.length-1];
 if(cell && lastTyping?.cell===cell && now-lastTyping.when<1800 && latest?.cell===cell){
  latest.changes[0].after=changes[0].after;
 }else{
  undo.push({testId,changes,cell});
  if(undo.length>240)undo.shift();
 }
 lastTyping=cell?{cell,when:now}:null;
 redo= [];
 updateHistoryButtons();
}
function updateHistoryButtons(){
 $('undo').disabled=!current || historyFor(undo,current.testId)<0;
 $('redo').disabled=!current || historyFor(redo,current.testId)<0;
}

const classCache=new Map(), inflight=new Map();
let selectionSequence=0, periodSequence=0;
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
 const t=findTest(name);
 const cacheKey=t?.id;
 if(cacheKey && inflight.has(cacheKey))return inflight.get(cacheKey);
 if(!t)return Promise.reject(Error('Unknown class '+name));
 const p=api('get_test',{test_id:t.id}).then(j=>{
  const columns=j.test?.columns||[];
  const meta=columns.find(c=>c.key==='_source_sheet');
  if(!Array.isArray(meta?.rows))throw Error('Period rows unavailable');
  const entries=new Map((j.entries||[]).map(x=>[x.user_id,x.data]));
  const rows=meta.rows.map(x=>makeRow(x,x.userId?entries.get(x.userId):null,j.test.id));
  const totals=Object.fromEntries(columns.filter(c=>c.type==='number').map(c=>[c.key,c.max]));
  const prev=classCache.get(cacheKey);let changed=0;
  if(prev){
   // A background refresh must not replace a maximum still being saved.
   for(const key of SKILLS){
    if(pendingMaxima.has(cacheKey+':'+key))totals[key]=prev.totals[key];
   }
   if(SKILLS.some(key=>String(prev.totals[key]??'')!==String(totals[key]??'')))changed++;
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
  classCache.set(cacheKey,model);
  return {model,changed};
 }).finally(()=>inflight.delete(cacheKey));
 inflight.set(cacheKey,p);return p;
}
async function openClass(name,refresh=false) {
 if(!findTest(name))return;
 if(refresh){
  if(klass!==name||!current||document.hidden||current.testId!==findTest(name).id)return;
  try{
   const {changed}=await getClass(name);
   if(klass!==name||!current||current.testId!==findTest(name).id)return;
   if(changed){updateVisibleValues();status('Updated from another teacher · scores or maxima refreshed');}
  }catch(e){status('Refresh failed: '+e.message,true);}
  return;
 }
 const sequence=++selectionSequence;
 klass=name;$('klass').value=name;
 $('tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.className===name));
 const cached=classCache.get(findTest(name).id);
 if(cached){
  current=cached;selected=null;render();
  const count=cached.rows.filter(x=>!x.userId).length;
  status(periodLabel()+' · '+cached.rows.length+' students · '+count+' unmatched · saved to Supabase');
  if(Date.now()-cached.loaded>4000)openClass(name,true);
  return;
 }
 current=null;
 $('sheet').querySelector('thead').replaceChildren();$('sheet').querySelector('tbody').replaceChildren();
 $('summary').textContent='Loading '+name+'…';status('Loading '+name+' for the first time…');
 try{
  const {model}=await getClass(name);
  if(sequence!==selectionSequence||klass!==name||model.testId!==findTest(name)?.id)return;
  current=model;selected=null;render();
  const count=model.rows.filter(x=>!x.userId).length;
  status(periodLabel()+' · '+model.rows.length+' students · '+count+' unmatched · saved to Supabase');
 }catch(e){if(sequence===selectionSequence)status('Could not load class: '+e.message,true);}
}
async function preloadClasses(){
 const names=sortedClasses().filter(x=>x!==klass);let i=0;
 const targetPeriod=period;
 const runner=async()=>{while(alive&&targetPeriod===period&&i<names.length){const name=names[i++];const test=findTest(name);if(!test||classCache.has(test.id))continue;try{await getClass(name);}catch(e){console.warn('Preload '+name+' failed',e);}}};
 await Promise.all([runner(),runner(),runner(),runner()]);
}
function sortedClasses(){const position=name=>ORDER.includes(name)?ORDER.indexOf(name):999;return [...tests.keys()].sort((a,b)=>position(a)-position(b)||a.localeCompare(b));}
async function loadPeriod(month,initial=false){
 if(!PERIODS[month])return;
 const seq=++periodSequence;
 ++selectionSequence;
 period=month;
 current=null;klass='';selected=null;tests=new Map();
 $('period').value=month;
 $('klass').replaceChildren();$('tabs').replaceChildren();
 $('sheet').querySelector('thead').replaceChildren();
 $('sheet').querySelector('tbody').replaceChildren();
 $('summary').textContent='Loading '+periodLabel()+'…';
 status('Loading '+periodLabel()+'…');
 try{
  const boot=(initial&&month==='2026-10')?window.__assessmentBootstrap:null;
  window.__assessmentBootstrap=null;
  let j;
  try {
   j=boot||await api('list_tests',{month});
  } catch (monthError) {
   // Older test_admin deployments use an invalid -31 end date for February
   // and June. Fall back to the authorized unfiltered list until the API fix
   // reaches production. These imported periods currently fall within 200 rows.
   if (month==='2026-10') throw monthError;
   j=await api('list_tests');
   if(!Array.isArray(j.tests) || !j.tests.some(t=>t.name?.startsWith(periodPrefix()))) {
    throw monthError;
   }
  }
  if(seq!==periodSequence)return;
  const prefix=periodPrefix();
  for(const t of j.tests||[])if(t.name?.startsWith(prefix))tests.set(t.name.slice(prefix.length),t);
  if(!tests.size)throw Error('No assessment records found for '+periodLabel());
  for(const name of sortedClasses()){
   $('klass').add(new Option(name,name));
   const btn=document.createElement('button');btn.textContent=name;btn.dataset.className=name;
   btn.addEventListener('click',()=>openClass(name));$('tabs').append(btn);
  }
  await openClass(tests.has('Brown')?'Brown':sortedClasses()[0]);
  if(seq===periodSequence)preloadClasses().catch(e=>console.warn('Class preload failed',e));
 }catch(e){
  if(seq===periodSequence){
   status(periodLabel()+' data could not load: '+e.message,true);
   $('summary').textContent='No student information was loaded.';
  }
 }
}

function renderPeriodOptions(){
 const select=$('period'),keep=PERIODS[select.value]?select.value:period;
 select.replaceChildren();
 for(const [value,label] of Object.entries(PERIODS).sort((a,b)=>b[0].localeCompare(a[0])))
  select.add(new Option(label,value));
 select.value=PERIODS[keep]?keep:period;
}
async function refreshAssessmentPeriods(){
 try{
  const result=await api('list_assessment_periods');
  if(!Array.isArray(result.periods))return;
  for(const item of result.periods){
   if(/^\d{4}-(0[1-9]|1[0-2])$/.test(item.value))PERIODS[item.value]=item.label;
  }
  renderPeriodOptions();
  if(typeof fillSourcePeriodOptions==='function')fillSourcePeriodOptions();
 }catch(e){console.warn('Assessment period list unavailable',e);}
}
async function startup(){
 const filter=$('gridFilterColumn');
 filter.replaceChildren();filter.add(new Option('All columns',''));
 for(const [key,label] of FIELDS)filter.add(new Option(label,key));
 filter.add(new Option('Total %','totalPct'));filter.add(new Option('Average %','averagePct'));
 renderPeriodOptions();
 await loadPeriod(period,true);
 refreshAssessmentPeriods();
}

/* Spreadsheet engine: selection, clipboard, history, fill and sort.
   Only assessment value cells are writable; names, maxima and calculated
   percentages are copyable but always read-only. All writes use test_admin. */
const COLS=FIELDS.map(f=>f[0]).concat(['totalPct','averagePct']);
const METRIC_KEYS=new Set(['totalPct','averagePct']);
const COLUMN_DEFAULTS={num:42,englishName:172,koreanName:124,nextClass:112,lib_reading:116,lib_raz:103,lib_punctuality:105,phonics:106,listening:112,vocab:105,grammar:112,gw:150,write:105,reading:108,speaking:113,totalPct:108,averagePct:120};
let filterKey='',filterText='',sortKey='',sortDir=0;
let rangeSelection=null,selectionDrag=false,fillDrag=null,suppressFocusSelection=false;
let mobileSelectMode=false,mobileSelectStep=0,mobileSelectPointer=null;
const colWidth=key=>key==='num'?42:(COLUMN_DEFAULTS[key]||105);
function setMobileSelectMode(enabled){
 mobileSelectMode=!!enabled;
 mobileSelectStep=0;mobileSelectPointer=null;selectionDrag=false;
 const button=$('mobileSelect');
 button.setAttribute('aria-pressed',String(mobileSelectMode));
 button.classList.toggle('active',mobileSelectMode);
 button.textContent=mobileSelectMode?'Selecting ✓':'Select cells';
 $('sheet').classList.toggle('mobile-select-mode',mobileSelectMode);
 updateSelectionClasses();
}
function mobileSelectionTarget(element){
 const td=element?.closest?.('td[data-cell-key]');
 if(!td||!$('sheet').contains(td)||!td.parentElement?.dataset.rowId)return null;
 if(!COLS.includes(td.dataset.cellKey))return null;
 return {id:td.parentElement.dataset.rowId,key:td.dataset.cellKey};
}
function getRowById(id){return current?.rows.find(row=>row.id===String(id))}
function valueAt(row,key){
 if(key==='totalPct'||key==='averagePct'){
  const pct=calculatePercentages(row,current?.totals||{});
  return percentText(key==='totalPct'?pct.total:pct.average);
 }
 return display(editable.has(key)?row.data[key]:row[key]);
}
function matchesSearch(row){
 const q=$('search').value.trim().toLocaleLowerCase();
 const found=!q||[row.englishName,row.koreanName,row.className].some(v=>v.toLocaleLowerCase().includes(q));
 if(!found||!filterText)return found;
 if(!filterKey)return COLS.some(key=>valueAt(row,key).toLocaleLowerCase().includes(filterText));
 return valueAt(row,filterKey).toLocaleLowerCase().includes(filterText);
}
function visibleRows(){
 if(!current)return [];
 const rows=current.rows.filter(matchesSearch);
 if(!sortKey||!sortDir)return rows;
 const key=sortKey, dir=sortDir, original=new Map(current.rows.map((r,i)=>[r.id,i]));
 return [...rows].sort((a,b)=>{
  const av=valueAt(a,key), bv=valueAt(b,key);
  if(av===''&&bv!=='')return 1;
  if(bv===''&&av!=='')return -1;
  const an=Number(av.replace('%','')),bn=Number(bv.replace('%',''));
  const compare=av!==''&&bv!==''&&Number.isFinite(an)&&Number.isFinite(bn)?an-bn:av.localeCompare(bv,undefined,{numeric:true,sensitivity:'base'});
  return (compare||0)*dir||(original.get(a.id)-original.get(b.id));
 });
}
function selectedRect(){
 if(!current||rangeSelection?.testId!==current.testId)return null;
 const rows=visibleRows();
 const ai=rows.findIndex(x=>x.id===rangeSelection.anchor.id);
 const fi=rows.findIndex(x=>x.id===rangeSelection.focus.id);
 const ac=COLS.indexOf(rangeSelection.anchor.key),fc=COLS.indexOf(rangeSelection.focus.key);
 if(ai<0||fi<0||ac<0||fc<0)return null;
 return {rows,r1:Math.min(ai,fi),r2:Math.max(ai,fi),c1:Math.min(ac,fc),c2:Math.max(ac,fc)};
}
function updateSelectionClasses(){
 const rect=selectedRect(), sheet=$('sheet');
 for(const td of sheet.querySelectorAll('tbody td[data-cell-key]')){
  const rowIndex=rect?.rows.findIndex(r=>r.id===td.parentElement.dataset.rowId)??-1;
  const col=COLS.indexOf(td.dataset.cellKey);
  const inside=!!rect&&rowIndex>=rect.r1&&rowIndex<=rect.r2&&col>=rect.c1&&col<=rect.c2;
  td.classList.toggle('grid-range-selected',inside);
  td.classList.toggle('grid-range-edge',inside&&(rowIndex===rect.r1||rowIndex===rect.r2||col===rect.c1||col===rect.c2));
  td.classList.toggle('grid-active-cell',inside&&td.parentElement.dataset.rowId===rangeSelection.focus.id&&td.dataset.cellKey===rangeSelection.focus.key);
  td.querySelector('.grid-fill-handle')?.remove();
  if(inside&&rowIndex===rect.r2&&col===rect.c2){
   const handle=document.createElement('span');handle.className='grid-fill-handle';
   handle.title='Drag to fill selected values';
   handle.addEventListener('pointerdown',e=>{
    if(!current||!rect)return;
    e.preventDefault();e.stopPropagation();
    selectionDrag=false;
    fillDrag={rect,targetRow:rect.r2,targetCol:rect.c2};
   });
   td.append(handle);
  }
 }
 const count=rect?(rect.r2-rect.r1+1)*(rect.c2-rect.c1+1):0;
 $('selectionInfo').textContent=count>1?count+' cells selected':
  mobileSelectMode?(count?'Tap last cell or drag to extend':'Tap first cell'):'';
}
function setSelection(id,key,extend=false){
 if(!current||!COLS.includes(key)||!getRowById(id))return;
 const point={id:String(id),key};
 if(!extend||rangeSelection?.testId!==current.testId)rangeSelection={testId:current.testId,anchor:point,focus:point};
 else rangeSelection.focus=point;
 selected={id:String(id),k:key};
 const row=getRowById(id);
 $('address').textContent=(COLS.indexOf(key)+2)+' · '+row.englishName;
 $('formula').value=valueAt(row,key);
 $('formula').readOnly=!editable.has(key)||!row.userId;
 updateSelectionClasses();
}
function cellElement(id,key){
 const tr=Array.from($('sheet').querySelectorAll('tbody tr[data-row-id]')).find(x=>x.dataset.rowId===String(id));
 return Array.from(tr?.querySelectorAll('td[data-cell-key]')||[]).find(x=>x.dataset.cellKey===key)||null;
}
function focusGrid(id,key,extend=false){
 const td=cellElement(id,key);
 if(!td)return false;
 suppressFocusSelection=true;
 const input=td.querySelector('input:not([disabled])');
 (input||td).focus({preventScroll:true});
 suppressFocusSelection=false;
 setSelection(id,key,extend);
 td.scrollIntoView({block:'nearest',inline:'nearest'});
 return true;
}
function validate(row,key,value){
 if(!editable.has(key)||!row?.userId)return false;
 const v=display(value).trim();
 if(v==='')return true;
 const kind=FIELDS.find(f=>f[0]===key)?.[2];
 if(kind==='grade')return v.length<=12;
 const number=Number(v);
 if(!Number.isFinite(number)||number<0)return false;
 const max=classCache.get(row.testId)?.totals?.[key];
 return max===null||max===undefined||!Number.isFinite(Number(max))||number<=Number(max);
}
function normalizedValue(key,value){
 const v=display(value).trim();
 return v===''?null:FIELDS.find(f=>f[0]===key)?.[2]==='score'?Number(v):v;
}
function applyBatch(items,options={}){
 const changes=[],touched=new Set();let invalid=0,readonly=0;
 for(const item of items){
  const row=item.row||getRowById(item.id),key=item.key;
  if(!row||row.testId!==current?.testId||!editable.has(key)||!row.userId){readonly++;continue;}
  // Undo/redo must restore exact previously stored values, including historic
  // scores above a later class maximum. Normal edits still enforce maxima.
  if(!options.restore && !validate(row,key,item.value)){invalid++;continue;}
  const before=display(row.data[key]),after=display(item.value).trim();
  if(before===after)continue;
  changes.push({id:row.id,key,before,after});
  row.data[key]=normalizedValue(key,after);
  row.rev++;row.dirty=true;touched.add(row);
 }
 if(changes.length&&options.record!==false){
  const now=Date.now(),last=undo[undo.length-1];
  const typing=options.label==='Typing'&&changes.length===1;
  const same=typing&&last?.label==='Typing'&&last.testId===current.testId&&last.changes.length===1&&
    last.changes[0].id===changes[0].id&&last.changes[0].key===changes[0].key&&now-last.at<1600;
  if(same){last.changes[0].after=changes[0].after;last.at=now;}
  else{undo.push({label:options.label||'Edit',testId:current.testId,changes,at:now});if(undo.length>250)undo.shift();}
  redo.length=0;
 }
 for(const row of touched)queueSave(row);
 if(changes.length)updateVisibleValues(options.label!=='Typing');
 updateHistoryButtons();
 return {count:changes.length,invalid,readonly};
}
function noteChange(row,key,value,track=true){
 const result=applyBatch([{row,key,value}],{record:track,label:track?'Typing':'Undo'});
 return result.count>0||display(row?.data[key])===display(value).trim();
}
function queueSave(row){
 if(row.timer)clearTimeout(row.timer);
 pending.set(row.testId+':'+row.id,row);
 row.timer=setTimeout(()=>save(row),420);
 status('Saving '+periodLabel()+'…');
}
async function save(row){
 if(row.saving)return;
 row.saving=true;
 try{
  while(row.saved<row.rev){
   const rev=row.rev,payload={...row.data};
   const result=await api('upsert_entries',{},{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({test_id:row.testId,entries:[{user_id:row.userId,data:payload}]})
   });
   if(result.failed||!result.upserted)throw Error('Save not confirmed');
   row.saved=rev;
  }
  row.dirty=false;row.failed=false;pending.delete(row.testId+':'+row.id);
  if(!pending.size)status('Saved · '+periodLabel());
 }catch(e){
  row.failed=true;row.dirty=true;
  status('Save failed: '+e.message,true);
 }finally{row.saving=false;}
}
async function history(type){
 if(!current)return;
 const source=type==='undo'?undo:redo,dest=type==='undo'?redo:undo;
 const index=source.map(op=>op.testId).lastIndexOf(current.testId);
 if(index<0)return;
 const [operation]=source.splice(index,1);
 if(operation.maximum){
  const {key,before,after}=operation.maximum;
  const input=Array.from($('sheet').querySelectorAll('.totals input[data-max-key]'))
   .find(el=>el.dataset.maxKey===key);
  const success=await setAssessmentMaximum(key,type==='undo'?before:after,input,{record:false});
  if(success)dest.push(operation);else source.splice(index,0,operation);
 }else{
  const result=applyBatch(operation.changes.map(c=>({id:c.id,key:c.key,value:type==='undo'?c.before:c.after})),
   {record:false,label:'History',restore:true});
  if(result.count)dest.push(operation);
 }
 updateHistoryButtons();
}
function updateHistoryButtons(){
 $('undo').disabled=!current||!undo.some(op=>op.testId===current.testId);
 $('redo').disabled=!current||!redo.some(op=>op.testId===current.testId);
}
function readSelection(){
 const rect=selectedRect();if(!rect)return '';
 const lines=[];
 for(let r=rect.r1;r<=rect.r2;r++){
  const values=[];
  for(let c=rect.c1;c<=rect.c2;c++)values.push(valueAt(rect.rows[r],COLS[c]));
  lines.push(values.join('\t'));
 }
 return lines.join('\n');
}
async function copyCells(){
 const text=readSelection();
 if(!text){status('Select cells to copy',true);return;}
 try{
  if(!navigator.clipboard?.writeText)throw Error('Clipboard not available');
  await navigator.clipboard.writeText(text);
  const rect=selectedRect();const cells=rect?(rect.r2-rect.r1+1)*(rect.c2-rect.c1+1):0;
  status('Copied '+cells+' cell'+(cells===1?'':'s'));
 }catch{status('Use Ctrl+C to copy the selected cells',true);}
}
function pasteMatrix(text){
 if(!current||!rangeSelection||!text)return;
 const rect=selectedRect();if(!rect)return;
 const data=String(text).replace(/\r/g,'').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
 const pastedRows=data.length,pastedCols=Math.max(...data.map(r=>r.length));
 const wholeRange=pastedRows===1&&pastedCols===1&&(rect.r1!==rect.r2||rect.c1!==rect.c2);
 const changes=[];
 const rowEnd=wholeRange?rect.r2:Math.min(rect.r1+pastedRows-1,rect.rows.length-1);
 const colEnd=wholeRange?rect.c2:Math.min(rect.c1+pastedCols-1,COLS.length-1);
 for(let r=rect.r1;r<=rowEnd;r++)for(let c=rect.c1;c<=colEnd;c++){
  const key=COLS[c],value=wholeRange?data[0][0]:data[r-rect.r1]?.[c-rect.c1];
  if(value===undefined)continue;
  changes.push({row:rect.rows[r],key,value});
 }
 const result=applyBatch(changes,{label:'Paste'});
 const focusRow=rect.rows[rowEnd];
 if(focusRow)setSelection(focusRow.id,COLS[colEnd],true);
 status('Pasted '+result.count+' cells'+(result.invalid?' · '+result.invalid+' invalid skipped':'')+
  (result.readonly?' · '+result.readonly+' locked skipped':''));
}
async function pasteFromButton(){
 try{
  if(!navigator.clipboard?.readText)throw Error('Permission unavailable');
  pasteMatrix(await navigator.clipboard.readText());
 }catch{status('Use Ctrl+V to paste from the clipboard',true);}
}
function clearSelection(){
 const rect=selectedRect();if(!rect)return;
 const changes=[];
 for(let r=rect.r1;r<=rect.r2;r++)for(let c=rect.c1;c<=rect.c2;c++)
  changes.push({row:rect.rows[r],key:COLS[c],value:''});
 const result=applyBatch(changes,{label:'Clear'});
 status('Cleared '+result.count+' editable cells');
}
function fillTo(targetId,targetKey){
 if(!fillDrag||!current)return;
 const source=fillDrag.rect,rows=visibleRows();
 const ri=rows.findIndex(r=>r.id===String(targetId)),ci=COLS.indexOf(targetKey);
 if(ri<0||ci<0)return;
 const r1=Math.min(source.r1,ri),r2=Math.max(source.r2,ri),
  c1=Math.min(source.c1,ci),c2=Math.max(source.c2,ci);
 const height=source.r2-source.r1+1,width=source.c2-source.c1+1;
 const template=[];
 for(let i=source.r1;i<=source.r2;i++){
  const line=[];for(let j=source.c1;j<=source.c2;j++)line.push(valueAt(source.rows[i],COLS[j]));
  template.push(line);
 }
 const changes=[];
 for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){
  if(r>=source.r1&&r<=source.r2&&c>=source.c1&&c<=source.c2)continue;
  const sr=((r-source.r1)%height+height)%height,sc=((c-source.c1)%width+width)%width;
  changes.push({row:rows[r],key:COLS[c],value:template[sr][sc]});
 }
 const result=applyBatch(changes,{label:'Fill'});
 rangeSelection={testId:current.testId,anchor:{id:rows[r1].id,key:COLS[c1]},focus:{id:rows[r2].id,key:COLS[c2]}};
 updateSelectionClasses();
 status('Filled '+result.count+' cells'+(result.invalid?' · '+result.invalid+' invalid skipped':'')+
  (result.readonly?' · '+result.readonly+' locked skipped':''));
}
function fillSelected(direction){
 const rect=selectedRect();if(!rect)return;
 const changes=[];
 if(direction==='down'){
  for(let r=rect.r1+1;r<=rect.r2;r++)for(let c=rect.c1;c<=rect.c2;c++)
   changes.push({row:rect.rows[r],key:COLS[c],value:valueAt(rect.rows[rect.r1],COLS[c])});
 }else if(direction==='right'){
  for(let r=rect.r1;r<=rect.r2;r++)for(let c=rect.c1+1;c<=rect.c2;c++)
   changes.push({row:rect.rows[r],key:COLS[c],value:valueAt(rect.rows[r],COLS[rect.c1])});
 }
 if(!changes.length){status('Select two or more cells to fill');return;}
 const result=applyBatch(changes,{label:'Fill'});
 status('Filled '+result.count+' cells'+(result.invalid?' · '+result.invalid+' invalid skipped':'')+
  (result.readonly?' · '+result.readonly+' locked skipped':''));
}
function moveSelection(direction,extend=false){
 const rect=selectedRect();
 if(!rect)return;
 const rows=rect.rows,at=rangeSelection.focus;
 let ri=rows.findIndex(r=>r.id===at.id),ci=COLS.indexOf(at.key);
 if(direction==='ArrowLeft')ci--;
 if(direction==='ArrowRight')ci++;
 if(direction==='ArrowUp')ri--;
 if(direction==='ArrowDown'||direction==='Enter')ri++;
 if(direction==='Tab')ci++;
 if(direction==='ShiftTab')ci--;
 if(ci<0){ri--;ci=COLS.length-1;}
 if(ci>=COLS.length){ri++;ci=0;}
 if(ri<0||ri>=rows.length)return;
 focusGrid(rows[ri].id,COLS[ci],extend);
}
function focusCell(id,key,input){
 if(!suppressFocusSelection&&!selectionDrag)setSelection(id,key,false);
 input?.select();
}
function editInput(row,key){
 const input=document.createElement('input');
 input.value=display(row.data[key]);
 input.dataset.rowId=row.id;input.dataset.key=key;input.dataset.editing='false';
 input.setAttribute('aria-label',row.englishName+' '+key);
 if(!row.userId){input.disabled=true;input.title='Student account not matched — read only';}
 input.addEventListener('focus',()=>focusCell(row.id,key,input));
 input.addEventListener('dblclick',()=>{input.dataset.editing='true';});
 input.addEventListener('input',()=>{
  const v=input.value.trim();
  if(validate(row,key,v)){input.removeAttribute('aria-invalid');noteChange(row,key,v);}
  else input.setAttribute('aria-invalid','true');
 });
 input.addEventListener('blur',()=>{
  if(!validate(row,key,input.value.trim()))input.value=display(row.data[key]);
  input.dataset.editing='false';
 });
 return input;
}
function setupFixedColumns(){
 const table=$('sheet');
 let group=table.querySelector('colgroup');
 if(!group){group=document.createElement('colgroup');table.insertBefore(group,table.firstChild);}
 group.replaceChildren();
 const keys=['num',...COLS];
 for(const key of keys){
  const col=document.createElement('col');
  col.style.width=colWidth(key)+'px';
  group.append(col);
 }
 table.style.tableLayout='fixed';
 table.style.width=keys.reduce((n,key)=>n+colWidth(key),0)+'px';
 table.style.setProperty('--grid-frozen-name-left',colWidth('num')+'px');
}
function headCell(label,key){
 const th=document.createElement('th');th.textContent=label;
 th.dataset.columnKey=key;th.style.width=colWidth(key)+'px';
 if(key!=='num'){
  th.classList.add('grid-sortable');th.title='Click to sort';
  if(sortKey===key&&sortDir)th.textContent=label+(sortDir===1?' ↑':' ↓');
  th.addEventListener('click',()=>{
   if(sortKey===key)sortDir=sortDir===1?-1:sortDir===-1?0:1;
   else{sortKey=key;sortDir=1;}
   if(!sortDir)sortKey='';
   rangeSelection=null;render();
  });
 }
 return th;
}
function render(){
 if(!current)return;
 $('tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.className===klass));
 const table=$('sheet'),head=table.querySelector('thead'),body=table.querySelector('tbody');
 head.replaceChildren();body.replaceChildren();
 setupFixedColumns();
 const titles=['#',...FIELDS.map(f=>f[1]),'Total %','Average %'];
 const header=document.createElement('tr');
 for(let i=0;i<titles.length;i++)header.append(headCell(titles[i],i===0?'num':COLS[i-1]));
 head.append(header);
 const rows=visibleRows();
 rows.forEach((row,i)=>{
  const tr=document.createElement('tr');tr.dataset.rowId=row.id;
  const no=document.createElement('td');no.className='grid-row-number';no.textContent=i+2;
  tr.append(no);
  for(const [key,label,type] of FIELDS){
   const td=document.createElement('td');
   td.dataset.cellKey=key;td.tabIndex=0;
   if(key==='englishName'){
    td.className='locked';const btn=document.createElement('button');btn.className='rc-student-link';
    btn.type='button';btn.textContent=row.englishName;btn.title='Preview '+row.englishName+' report card';
    btn.addEventListener('click',()=>openReport(row));td.append(btn);
   }else if(type==='fixed'){td.className='locked';td.textContent=row[key];}
   else td.append(editInput(row,key));
   tr.append(td);
  }
  const pct=calculatePercentages(row,current.totals);
  for(const [key,number,help] of [
   ['totalPct',pct.total,'Total points earned / possible'],
   ['averagePct',pct.average,'Average of individual skill percentages']
  ]){
   const td=document.createElement('td');td.tabIndex=0;td.className='metric';
   td.dataset.cellKey=key;td.dataset.metric=key==='totalPct'?'total':'average';
   td.title=help;td.textContent=percentText(number);tr.append(td);
  }
  if(!row.userId){tr.classList.add('unmatched');tr.title='Unmatched account: scores are read-only';}
  body.append(tr);
 });
 const totals=document.createElement('tr');totals.className='totals';
 const label=document.createElement('td');label.textContent='Σ';totals.append(label);
 for(const [i,[key,,type]] of FIELDS.entries()){
  const td=document.createElement('td');
  if(i===0)td.textContent='Class TOTAL';
  else if(type==='score')td.append(classTotalInput(key));
  totals.append(td);
 }
 for(let i=0;i<2;i++){const td=document.createElement('td');td.className='metric';td.textContent='—';totals.append(td);}
 body.append(totals);
 $('summary').textContent=rows.length+' of '+current.rows.length+' students · '+current.rows.filter(r=>!r.userId).length+' unmatched · '+klass;
 updateSelectionClasses();
 updateHistoryButtons();
}

function assessmentMaxNumber(value){
 if(value===null||value===undefined||String(value).trim()==='')return null;
 const number=Number(value);
 if(!Number.isFinite(number)||number<=0||number>10000)throw Error('Enter a positive maximum (up to 10,000), or leave blank');
 return number;
}
function classTotalInput(key){
 const input=document.createElement('input');
 input.className='class-total-input';
 input.type='number';input.inputMode='decimal';input.step='any';input.min='0.01';input.max='10000';
 input.dataset.maxKey=key;
 input.value=display(current.totals[key]);
 input.setAttribute('aria-label',klass+' maximum '+(FIELDS.find(f=>f[0]===key)?.[1]||key));
 input.title='Edit the maximum points for '+key+' in '+klass;
 // Recalculate instantly while typing, without treating uncommitted text as saved.
 input.addEventListener('input',()=>{
  if(!current)return;
  try{
   const value=assessmentMaxNumber(input.value);
   maximumPreview={testId:current.testId,key,value};
   input.removeAttribute('aria-invalid');
   input.dataset.saveState='editing';
   refreshPercentages();
  }catch{
   if(maximumPreview?.testId===current.testId&&maximumPreview.key===key)maximumPreview=null;
   input.setAttribute('aria-invalid','true');
   refreshPercentages();
  }
 });
 input.addEventListener('change',()=>setAssessmentMaximum(key,input.value,input));
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   event.preventDefault();event.stopPropagation();
   input.value=display(current?.totals[key]);
   if(maximumPreview?.key===key&&maximumPreview.testId===current?.testId)maximumPreview=null;
   refreshPercentages();input.blur();
  }else if(event.key==='Enter'){
   event.preventDefault();event.stopPropagation();
   input.blur();
  }
 });
 return input;
}
async function setAssessmentMaximum(key,rawValue,input=null,options={}){
 const model=current,recordTestId=model?.testId;
 if(!recordTestId||!SKILLS.includes(key))return false;
 const task=recordTestId+':'+key;
 if(pendingMaxima.has(task))return false;
 const previous=model.totals[key]??null;
 let next;
 try{next=assessmentMaxNumber(rawValue);}
 catch(e){
  if(maximumPreview?.testId===recordTestId&&maximumPreview.key===key)maximumPreview=null;
  if(input){input.value=display(previous);input.dataset.saveState='error';input.title=e.message;}
  if(current?.testId===recordTestId)refreshPercentages();
  status(e.message,true);return false;
 }
 if(previous===next){
  if(maximumPreview?.testId===recordTestId&&maximumPreview.key===key)maximumPreview=null;
  if(input){input.value=display(previous);input.dataset.saveState='saved';}
  if(current?.testId===recordTestId)refreshPercentages();
  return true;
 }
 pendingMaxima.add(task);
 if(input){input.disabled=true;input.dataset.saveState='saving';input.title='Saving maximum…';}
 if(maximumPreview?.testId===recordTestId&&maximumPreview.key===key)maximumPreview=null;
 model.totals[key]=next;
 if(current?.testId===recordTestId)refreshPercentages();
 status('Saving '+klass+' maximum for '+key+'…');
 try{
  await api('set_assessment_max',{},{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({test_id:recordTestId,skill:key,max:next,expected:previous})
  });
  if(options.record!==false){
   undo.push({label:'Class maximum',testId:recordTestId,
    maximum:{key,before:previous,after:next},changes:[],at:Date.now()});
   if(undo.length>250)undo.shift();
   redo.length=0;
  }
  if(input){input.dataset.saveState='saved';input.title='Saved to Supabase';}
  if(current?.testId===recordTestId){
   status('Saved · '+klass+' '+key+' maximum '+(next??'blank'));
   updateHistoryButtons();
  }
  return true;
 }catch(e){
  model.totals[key]=previous;
  if(input){input.dataset.saveState='error';input.title='Save FAILED: '+e.message;}
  if(current?.testId===recordTestId){
   refreshPercentages();
   status('Maximum not saved: '+e.message,true);
  }
  return false;
 }finally{
  pendingMaxima.delete(task);
  if(input){input.disabled=false;input.value=display(model.totals[key]);}
  if(current?.testId===recordTestId)refreshPercentages();
 }
}
function updateVisibleValues(force=false){
 if(!current)return;
 for(const input of $('sheet').querySelectorAll('.totals input[data-max-key]')){
  if(force||document.activeElement!==input)input.value=display(current.totals[input.dataset.maxKey]);
 }
 const trs=$('sheet').querySelectorAll('tbody tr[data-row-id]');
 for(const tr of trs){
  const row=getRowById(tr.dataset.rowId);if(!row)continue;
  for(const input of tr.querySelectorAll('input')){
   if(force||document.activeElement!==input)input.value=display(row.data[input.dataset.key]);
  }
  const totals=maximumPreview?.testId===current.testId
   ?{...current.totals,[maximumPreview.key]:maximumPreview.value}
   :current.totals;
  const pct=calculatePercentages(row,totals);
  const t=tr.querySelector('[data-metric="total"]'),a=tr.querySelector('[data-metric="average"]');
  if(t)t.textContent=percentText(pct.total);
  if(a)a.textContent=percentText(pct.average);
 }
}
function refreshPercentages(){updateVisibleValues()}
function resetGridSelection(){
 rangeSelection=null;selected=null;
 $('address').textContent='—';$('formula').value='';$('formula').readOnly=true;
 $('selectionInfo').textContent='';
}
function getCurrentRange(){return selectedRect()}
$('undo').addEventListener('click',()=>history('undo'));
$('redo').addEventListener('click',()=>history('redo'));
$('copy').addEventListener('click',copyCells);
$('paste').addEventListener('click',pasteFromButton);
$('clear').addEventListener('click',clearSelection);
$('fillDown').addEventListener('click',()=>fillSelected('down'));
$('fillRight').addEventListener('click',()=>fillSelected('right'));
$('mobileSelect').addEventListener('click',()=>setMobileSelectMode(!mobileSelectMode));
$('reset').textContent='Reload class';
$('reset').onclick=()=>{if(pending.size){status('Finish saving edits before reloading',true);return;}openClass(klass,true)};
$('klass').addEventListener('change',e=>{mobileSelectStep=0;resetGridSelection();openClass(e.target.value)});
$('period').addEventListener('change',e=>{
 if(!$('rcDialog').hidden){$('rcDialog').hidden=true;$('rcPageMount').replaceChildren();}
 filterKey='';filterText='';$('search').value='';
 $('gridFilterColumn').value='';$('gridFilterValue').value='';
 setMobileSelectMode(false);resetGridSelection();loadPeriod(e.target.value);
});
$('search').addEventListener('input',()=>{resetGridSelection();render()});
$('gridFilterColumn').addEventListener('change',e=>{filterKey=e.target.value;resetGridSelection();render()});
$('gridFilterValue').addEventListener('input',e=>{filterText=e.target.value.trim().toLocaleLowerCase();resetGridSelection();render()});
$('gridClearFilters').addEventListener('click',()=>{
 filterKey='';filterText='';sortDir=0;sortKey='';
 $('gridFilterColumn').value='';$('gridFilterValue').value='';$('search').value='';
 resetGridSelection();render();
});
$('formula').addEventListener('change',()=>{
 if(!selected||!current)return;
 const row=getRowById(selected.id),key=selected.k;
 const result=applyBatch([{row,key,value:$('formula').value}],{label:'Formula bar edit'});
 if(result.invalid||result.readonly)status('Read-only or invalid value',true);
 updateVisibleValues();
});
// Mobile: an explicit selection mode avoids popping up the keyboard and
// allows a two-tap range or a finger drag. Normal swiping still scrolls when off.
$('sheet').addEventListener('pointerdown',e=>{
 if(!mobileSelectMode||!current||e.button!==0)return;
 const hit=mobileSelectionTarget(e.target);
 if(!hit)return;
 e.preventDefault();e.stopPropagation();
 const extending=mobileSelectStep===1;
 if(!extending){
  setSelection(hit.id,hit.key,false);
  mobileSelectStep=1;
 }else setSelection(hit.id,hit.key,true);
 mobileSelectPointer={id:e.pointerId,dragged:false,last:hit,secondTap:extending};
},true);
$('sheet').addEventListener('click',e=>{
 if(!mobileSelectMode||!e.target.closest('td[data-cell-key]'))return;
 e.preventDefault();e.stopPropagation();
},true);
$('sheet').addEventListener('contextmenu',e=>{
 if(mobileSelectMode&&e.target.closest('td[data-cell-key]'))e.preventDefault();
});
document.addEventListener('pointermove',e=>{
 if(!mobileSelectMode||!mobileSelectPointer||e.pointerId!==mobileSelectPointer.id)return;
 if(e.cancelable)e.preventDefault();
 const hit=mobileSelectionTarget(document.elementFromPoint(e.clientX,e.clientY));
 if(!hit)return;
 if(hit.id!==mobileSelectPointer.last.id||hit.key!==mobileSelectPointer.last.key){
  setSelection(hit.id,hit.key,true);
  mobileSelectPointer.last=hit;
  mobileSelectPointer.dragged=true;
 }
},{passive:false});
function finishMobileSelection(event){
 if(!mobileSelectPointer||event.pointerId!==mobileSelectPointer.id)return;
 // After one tap, the next tap extends the range. After a drag or
 // second tap, another tap begins a fresh selection.
 if(mobileSelectPointer.dragged||mobileSelectPointer.secondTap)mobileSelectStep=0;
 mobileSelectPointer=null;
}
document.addEventListener('pointerup',finishMobileSelection);
document.addEventListener('pointercancel',finishMobileSelection);
$('sheet').addEventListener('pointerdown',e=>{
 const td=e.target.closest('td[data-cell-key]');
 if(!td||!current||e.target.closest('.grid-fill-handle'))return;
 if(e.button!==0)return;
 selectionDrag=true;setSelection(td.parentElement.dataset.rowId,td.dataset.cellKey,e.shiftKey);
});
$('sheet').addEventListener('pointerover',e=>{
 const td=e.target.closest('td[data-cell-key]');
 if(!td||!current)return;
 if(fillDrag){
  const rowIndex=visibleRows().findIndex(row=>row.id===td.parentElement.dataset.rowId);
  if(rowIndex>=0){fillDrag.targetRow=rowIndex;fillDrag.targetCol=COLS.indexOf(td.dataset.cellKey);}
 }else if(selectionDrag)setSelection(td.parentElement.dataset.rowId,td.dataset.cellKey,true);
});
document.addEventListener('pointerup',()=>{
 if(fillDrag){
  const r=visibleRows()[fillDrag.targetRow],key=COLS[fillDrag.targetCol];
  if(r&&key)fillTo(r.id,key);
  fillDrag=null;
 }
 selectionDrag=false;
});
$('sheet').addEventListener('focusin',e=>{
 const td=e.target.closest('td[data-cell-key]');
 if(!td||suppressFocusSelection)return;
 if(e.target.tagName==='INPUT')return;
 setSelection(td.parentElement.dataset.rowId,td.dataset.cellKey);
});
document.addEventListener('keydown',e=>{
 if($('rcDialog')&&!$('rcDialog').hidden)return;
 const target=e.target,insideGrid=!!target.closest?.('#sheet');
 // The bottom TOTAL inputs are real numeric editors, not selectable student cells.
 if(target instanceof HTMLInputElement&&target.classList.contains('class-total-input'))return;
 const editing=target instanceof HTMLInputElement&&target.dataset.editing==='true';
 const ctrl=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(ctrl&&!editing&&insideGrid){
  if(key==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');return;}
  if(key==='y'){e.preventDefault();history('redo');return;}
  if(key==='d'&&current&&selected){e.preventDefault();fillSelected('down');return;}
  if(key==='r'&&current&&selected){e.preventDefault();fillSelected('right');return;}
  if(key==='a'&&current&&selected){e.preventDefault();const rows=visibleRows();if(!rows.length)return;rangeSelection={testId:current.testId,
    anchor:{id:rows[0].id,key:COLS[0]},focus:{id:rows[rows.length-1].id,key:COLS[COLS.length-1]}};updateSelectionClasses();return;}
 }
 if(!current||!selected||!insideGrid)return;
 if(e.key==='F2'&&target instanceof HTMLInputElement){e.preventDefault();target.dataset.editing='true';target.setSelectionRange(target.value.length,target.value.length);return;}
 if(editing){
  if(e.key==='Escape'){
   e.preventDefault();target.dataset.editing='false';target.select();return;
  }
  if(e.key==='Enter'||e.key==='Tab'){
   e.preventDefault();target.dataset.editing='false';
   moveSelection(e.key==='Tab'&&e.shiftKey?'ShiftTab':e.key);
   return;
  }
  // Editing mode: arrows and clipboard shortcuts belong to the text input.
  return;
 }
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();clearSelection();return;}
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Tab'].includes(e.key)){
  e.preventDefault();
  moveSelection(e.key==='Tab'&&e.shiftKey?'ShiftTab':e.key,
   e.shiftKey&&e.key.startsWith('Arrow'));
 }
},true);
document.addEventListener('copy',e=>{
 if(e.target?.matches?.('.class-total-input'))return;
 if(!current||!rangeSelection||($('rcDialog')&&!$('rcDialog').hidden))return;
 if(!e.target.closest?.('#sheet')||e.target instanceof HTMLInputElement&&e.target.dataset.editing==='true')return;
 const str=readSelection();if(!str)return;
 e.clipboardData?.setData('text/plain',str);e.preventDefault();
});
document.addEventListener('cut',e=>{
 if(e.target?.matches?.('.class-total-input'))return;
 if(!current||!rangeSelection||!$('rcDialog').hidden)return;
 if(!e.target.closest?.('#sheet'))return;
 if(e.target instanceof HTMLInputElement&&e.target.dataset.editing==='true')return;
 const str=readSelection();if(!str)return;
 e.clipboardData?.setData('text/plain',str);e.preventDefault();clearSelection();
});
document.addEventListener('paste',e=>{
 if(e.target?.matches?.('.class-total-input'))return;
 if(!current||!rangeSelection||!$('rcDialog').hidden)return;
 if(!e.target.closest?.('#sheet')||e.target instanceof HTMLInputElement&&e.target.dataset.editing==='true')return;
 const str=e.clipboardData?.getData('text/plain');
 if(str===undefined||str===null)return;
 e.preventDefault();pasteMatrix(str);
});
setInterval(()=>{if(alive&&current&&!document.hidden)openClass(klass,true)},5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&current)openClass(klass,true)});
window.addEventListener('beforeunload',()=>{alive=false});

/* Report-card studio: the HTML/SVG renderer below is reused from Test Input.
   Score values come from the already authenticated Assessment Grid cache. */
// Willena report-card renderer reused from the current Teachers Test Input app.
// The report-card markup, skill bars and gauge styling are kept verbatim.
const esc=(s='')=>String(s).replace(/[&<>"'`]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[ch]||ch));
function parseNumber(v){if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null}
function formatNumber(v,{decimals=0}={}){if(v===null||v===undefined||!Number.isFinite(v))return '—';return v.toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:Math.max(decimals,1)})}
const formatPercent=(v)=>v===null||v===undefined||!Number.isFinite(v)?'—':formatNumber(v,{decimals:1})+'%';
function fmtMonthYear(input){if(!input)return '';const m=String(input).match(/^(\d{4})-(\d{2})/);if(!m)return String(input);return new Date(Number(m[1]),Number(m[2])-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}
function barsPercent(score,max){const s=parseNumber(score),m=parseNumber(max);return s===null||m===null||m<=0?0:Math.max(0,Math.min(100,100*s/m))}
function computeAveragePercent(data,cols){const percentages=cols.filter(c=>c.type==='number').map(c=>{const s=parseNumber(data[c.key]),m=parseNumber(c.max);return s!==null&&m!==null&&m>0?100*s/m:null}).filter(x=>x!==null);return percentages.length?percentages.reduce((a,b)=>a+b,0)/percentages.length:null}
const KOREAN_LABELS={phonics:'파닉스',listening:'듣기',vocab:'어휘',grammar:'문법',gw:'문법/쓰기',write:'쓰기',reading:'읽기',speaking:'말하기'};
const getKoreanLabel=(col)=>KOREAN_LABELS[col.key]||col.label||col.key;
function renderCard({ student, test, notes='', totalMode='weighted' }) {
    const cols = Array.isArray(test.columns) ? test.columns : [];
    const numberCols = cols.filter(c=>c.type==='number');

  const scores = [];
    let t=0, m=0;
    for (const c of numberCols) {
      const val = parseNumber(student.data[c.key]);
      const max = parseNumber(c.max);
      if (val===null) continue;
      t += Number.isFinite(val) ? val : 0;
      m += Number.isFinite(max) ? max : 0;
      scores.push({ label: getKoreanLabel(c), score:val, max, pct: barsPercent(val, max) });
    }
  const percent = (m>0) ? Math.round((t/m)*1000)/10 : null;
  const avgPercent = computeAveragePercent(student.data || {}, cols);
  const totalSum = `${formatNumber(t)}/${formatNumber(m)}`;
  const useAverageMode = totalMode === 'average';
  const shownPercent = useAverageMode ? avgPercent : percent;
  const totalLabel = useAverageMode ? 'Average' : 'Total';
  const totalSumHtml = useAverageMode ? '' : `<div class="rc-total-sum">${totalSum}</div>`;

    // Library grades (text) if available
    const libReading = student.data['lib_reading'] || student.data['LIB_READING'] || '';
    const libRaz = student.data['lib_raz'] || student.data['LIB_RAZ'] || '';
    const libPunctuality = student.data['lib_punctuality'] || student.data['LIB_PUNCTUALITY'] || '';

    // Grade to radial percent mapping per spec
    function gradeToPercent(g) {
      if (!g) return 0;
      const t = String(g).trim().toUpperCase();
      const map = { 'A+':100, 'A':90, 'A-':80, 'B+':65, 'B':50, 'B-':35, 'C+':10, 'C':1 };
      return map[t] ?? 0;
    }
    // Semicircle gauge SVG (pathLength=100 for easy stroke-dasharray)
    function renderGauge(grade) {
      const pct = Math.max(0, Math.min(100, gradeToPercent(grade)));
      // Path is a half-circle arc from left to right using a 50x50 viewBox centered at (50,50), radius 40
      // We draw only the top half (y from 50 to 10) and use pathLength=100 so dasharray=pct shows progress.
      return `
        <div class="rc-gauge" aria-label="${esc(grade||'')} gauge">
          <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
            <path class="arc-track" d="M10,50 A40,40 0 0 1 90,50" pathLength="100"
              fill="none" stroke="var(--rc-accent-2)" stroke-width="6" stroke-linecap="round"></path>
            <path class="arc-fill"  d="M10,50 A40,40 0 0 1 90,50" pathLength="100"
              fill="none" stroke="var(--rc-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${pct} 100"></path>
          </svg>
          <div class="grade-text">${esc(grade||'—')}</div>
        </div>`;
    }

    const skillRows = scores.map(s=>
      `<div class="rc-skill">
        <div class="rc-skill-label">${esc(s.label)}</div>
        <div class="rc-bar"><span style="width:${s.pct}%"><span class="rc-pct">${Math.round(s.pct)}</span></span></div>
        <div class="rc-score">${formatNumber(s.score)}${Number.isFinite(s.max)?`/${formatNumber(s.max)}`:''}</div>
      </div>`
    ).join('');

  const logo = '/Logo.png';
  // Prefer explicit student class; fall back to loaded test class
  const displayClass = student?.class || test?.class || '';
    // Compute term period display: prefer month range; fallback to test date
    function normMonth(s){ if(!s) return ''; const str=String(s); return /^\d{4}-\d{2}$/.test(str) ? (str+'-01') : str; }
    let termText = '';
    const tf = test.term_from || '';
    const tt = test.term_to || '';
    if (tf && tt) {
      const a = fmtMonthYear(normMonth(tf));
      const b = fmtMonthYear(normMonth(tt));
      termText = a && b ? (a===b ? a : `${a} – ${b}`) : (a||b);
    } else if (tf || tt) {
      termText = fmtMonthYear(normMonth(tf||tt));
    } else {
      termText = fmtMonthYear(test.date);
    }
    return `
      <section class="rc-page">
        <header class="rc-header">
          <img class="rc-logo" src="${logo}" alt="Willena" />
        </header>

        <div class="rc-info">
          <div class="rc-field"><span class="rc-label">Student Name:</span><div class="rc-line"><div class="rc-value">${esc(student.name||'')}</div></div></div>
          <div class="rc-field"><span class="rc-label">Korean Name:</span><div class="rc-line"><div class="rc-value">${esc(student.korean_name||'')}</div></div></div>
          <div class="rc-field"><span class="rc-label">Class:</span><div class="rc-line"><div class="rc-value">${esc(displayClass)}</div></div></div>
          <div class="rc-field"><span class="rc-label">Term Period:</span><div class="rc-line"><div class="rc-value">${esc(termText||'')}</div></div></div>
        </div>

        <div class="rc-columns">
          <div class="rc-titlebar rc-skills rc-col-title">Skills</div>
          <div class="rc-titlebar rc-library rc-col-title">Library</div>

          <div>
            ${skillRows}
            <div class="rc-total-wrap">
              <div class="rc-total-label">${totalLabel}</div>
              <div class="rc-total">${formatPercent(shownPercent)}</div>
              ${totalSumHtml}
            </div>
          </div>

          <aside class="rc-library">
            <div class="rc-lib-item">
              ${renderGauge(libRaz)}
              <div class="rc-lib-text">
                <div class="rc-g-label">RAZ KIDS</div>
              </div>
            </div>
            <div class="rc-lib-item">
              ${renderGauge(libReading)}
              <div class="rc-lib-text">
                <div class="rc-g-label">BOOK READING</div>
              </div>
            </div>
            <div class="rc-lib-item">
              ${renderGauge(libPunctuality)}
              <div class="rc-lib-text">
                <div class="rc-g-label">PUNCTUALITY</div>
              </div>
            </div>
          </aside>

          <div class="rc-comments-head rc-span">Comments</div>
          <div class="rc-comments rc-span">${notes ? esc(notes) : 'Use this space to add personalised feedback before printing.'}</div>
        </div>
      </section>`;
  }



const reportDrafts = new Map();
let reportRows=[],reportPosition=0,reportBusy=false;
const reportStatus=(text,bad=false)=>{const e=$('rcMessage');e.textContent=text;e.style.color=bad?'#bd2936':'#526c7c'};
function selectedReportRow(){return reportRows[reportPosition]||null;}
function reportDraftKey(row){return row?.testId+':'+(row?.id||'');}
function reportColumns(row){
 const maxima=classCache.get(row.testId)?.totals||current?.totals||{};
 return SKILLS.map(key=>({
   key, type:'number', max:maxima[key]??null,
   label:FIELDS.find(f=>f[0]===key)?.[1]||key
 }));
}
function reportStudent(row){
 return {name:row.englishName,korean_name:row.koreanName,class:row.className,data:{...row.data}};
}
function reportTest(row){
 return {name:periodLabel()+' Report Cards',class:row.className,date:period+'-01',term_from:period,term_to:period,columns:reportColumns(row)};
}
function makeCard(row){
 return renderCard({student:reportStudent(row),test:reportTest(row),
   notes:reportDrafts.get(reportDraftKey(row))||'',totalMode:$('rcMode').value});
}
function fitReport(){
 const page=$('rcPageMount').querySelector('.rc-page');
 if(!page)return;
 const shell=$('rcViewport'),sizer=$('rcPageSizer'),mount=$('rcPageMount');
 // Scale only the preview, never the output used for PDF rasterization.
 mount.style.transform='none';
 const width=page.getBoundingClientRect().width;
 const height=page.getBoundingClientRect().height;
 const scale=Math.min(1,Math.max(.2,(shell.clientWidth-16)/width));
 mount.style.transform='scale('+scale+')';
 sizer.style.width=Math.ceil(width*scale)+'px';
 sizer.style.height=Math.ceil(height*scale)+'px';
}
function displayReport(){
 const row=selectedReportRow();
 if(!row)return;
 $('rcDialogTitle').textContent=row.englishName+' · '+row.className;
 $('rcCounter').textContent=(reportPosition+1)+' / '+reportRows.length;
 $('rcPrev').disabled=reportBusy||reportPosition===0;
 $('rcNext').disabled=reportBusy||reportPosition>=reportRows.length-1;
 $('rcComment').value=reportDrafts.get(reportDraftKey(row))||'';
 $('rcPageMount').innerHTML=makeCard(row);
 fitReport();
 reportStatus('Preview uses the current grid scores. Comments are session drafts, not saved to Supabase.');
}
function openReport(row){
 if(!current||!current.rows.length)return;
 const visible=visibleRows();
 reportRows=visible.length?visible:current.rows;
 const found=reportRows.findIndex(s=>s.id===row?.id);
 reportPosition=found>=0?found:0;
 $('rcDialog').hidden=false;
 displayReport();
 $('rcClose').focus({preventScroll:true});
}
function closeReport(){
 if(reportBusy)return;
 $('rcDialog').hidden=true;
 $('rcPageMount').replaceChildren();
}
function setReportBusy(value){
 reportBusy=value;
 for(const id of ['rcStudentPdf','rcClassPdf','rcClose','rcPrint','rcMode','rcComment'])$(''+id).disabled=value;
 $('rcPrev').disabled=value||reportPosition===0;
 $('rcNext').disabled=value||reportPosition>=reportRows.length-1;
}
async function ensurePdfLibraries(){
 async function load(url,test){
  if(test())return;
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=url;script.onload=resolve;script.onerror=()=>reject(new Error('PDF library failed to load'));
   document.head.appendChild(script);
  });
  if(!test())throw Error('PDF library unavailable');
 }
 await load('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',()=>typeof window.html2canvas==='function');
 await load('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF);
}
async function exportReports(rows){
 if(reportBusy||!rows.length)return;
 setReportBusy(true);
 const mount=$('rcExportMount');
 try{
  await ensurePdfLibraries();
  if(document.fonts?.ready)await document.fonts.ready;
  const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  for(let i=0;i<rows.length;i++){
   reportStatus('Creating PDF '+(i+1)+' / '+rows.length+'…');
   mount.innerHTML=makeCard(rows[i]);
   const page=mount.querySelector('.rc-page');
   const logo=page.querySelector('img');
   if(logo && !logo.complete)await new Promise(done=>{logo.onload=done;logo.onerror=done;setTimeout(done,3000);});
   const canvas=await window.html2canvas(page,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false});
   const width=210,height=width*canvas.height/canvas.width;
   if(i)pdf.addPage('a4','portrait');
   pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',0,Math.max(0,(297-height)/2),width,Math.min(height,297));
  }
  const name=rows.length===1?rows[0].englishName:rows[0].className;
  const safe=String(name).replace(/[^A-Za-z0-9_-]+/g,'_');
  pdf.save('Willena_Report_Cards_'+periodLabel().replace(/\s+/g,'_')+'_'+safe+'.pdf');
  reportStatus('PDF downloaded: '+rows.length+' report card'+(rows.length===1?'':'s')+'.');
 }catch(e){
  reportStatus('PDF failed: '+e.message,true);
 }finally{
  mount.replaceChildren();setReportBusy(false);
 }
}
$('rcOpen').addEventListener('click',()=>{
 const visible=current?visibleRows():[];
 openReport(visible[0]||current?.rows[0]);
});
$('rcPrev').addEventListener('click',()=>{if(reportPosition>0){reportPosition--;displayReport()}});
$('rcNext').addEventListener('click',()=>{if(reportPosition<reportRows.length-1){reportPosition++;displayReport()}});
$('rcClose').addEventListener('click',closeReport);
$('rcDialog').addEventListener('click',event=>{if(event.target===$('rcDialog'))closeReport()});
$('rcComment').addEventListener('input',()=>{
 const row=selectedReportRow();if(!row)return;
 reportDrafts.set(reportDraftKey(row),$('rcComment').value);
 $('rcPageMount').innerHTML=makeCard(row);fitReport();
});
$('rcMode').addEventListener('change',displayReport);
$('rcStudentPdf').addEventListener('click',()=>exportReports([selectedReportRow()].filter(Boolean)));
$('rcClassPdf').addEventListener('click',()=>exportReports(current?.rows||[]));
$('rcPrint').addEventListener('click',()=>window.print());
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('rcDialog').hidden){e.stopPropagation();closeReport();}
});
window.addEventListener('resize',()=>{if(!$('rcDialog').hidden)fitReport()});


/* New Assessment Period wizard. Excel is parsed locally, with no public sharing
   required. The authenticated server recomputes student matches and owns saves. */
let apWorkbook=null,apParsed=null,apConfirmedPreview=null,apBusy=false;
const AP_SKILLS=['phonics','listening','vocab','grammar','gw','write','reading','speaking'];
const AP_GRADES=['lib_reading','lib_raz','lib_punctuality'];
const AP_LABELS={phonics:'Phonics',listening:'Listening',vocab:'Vocab',
 grammar:'Grammar',gw:'Grammar Writing',write:'Writing',reading:'Reading',speaking:'Speaking'};
const apEsc=v=>String(v===null||v===undefined?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function apMessage(value,bad=false){
 const el=$('apMessage');el.textContent=value;el.style.color=bad?'#b32131':'#46677b';
}
function apBusyState(value){
 apBusy=value;
 for(const id of ['apClose','apPreview','apFile','apTab','apPasteRead','apDate','apMode','apSource'])
  $(id).disabled=value;
 $('apConfirm').disabled=value||!apConfirmedPreview;
}
function fillSourcePeriodOptions(){
 const select=$('apSource'),old=select.value;
 select.replaceChildren();
 for(const [value,label] of Object.entries(PERIODS).sort((a,b)=>b[0].localeCompare(a[0]))){
  if(value===$('apDate').value)continue;
  select.add(new Option(label,value));
 }
 if(old&&PERIODS[old]&&old!==$('apDate').value)select.value=old;
}
function apInvalidate(){
 apConfirmedPreview=null;$('apConfirm').disabled=true;
 $('apMatches').replaceChildren();
}
function apOpen(){
 if(apBusy)return;
 $('apDialog').hidden=false;
 $('apDate').value='';
 $('apMode').value='copy';
 $('apFile').value='';
 $('apTab').replaceChildren();
 $('apPaste').value='';
 $('apSourcePane').hidden=false;$('apImportPane').hidden=true;
 apWorkbook=null;apParsed=null;apInvalidate();
 $('apInputSummary').textContent='Choose a source period and a new month.';
 $('apMaxEditor').replaceChildren();
 fillSourcePeriodOptions();
 apMessage('No changes will be saved until you confirm.');
 $('apDate').focus();
}
function apClose(){
 if(apBusy)return;
 $('apDialog').hidden=true;
}
function apReadMode(){
 const imported=$('apMode').value==='import';
 $('apSourcePane').hidden=imported;
 $('apImportPane').hidden=!imported;
 apInvalidate();
}
async function apLoadSheetJS(){
 if(window.XLSX?.read&&window.XLSX?.utils?.sheet_to_json)return;
 await new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  script.onload=resolve;
  script.onerror=()=>reject(Error('Excel reader unavailable. Try pasting cells from Google Sheets instead.'));
  document.head.append(script);
 });
 if(!window.XLSX?.read)throw Error('Excel reader unavailable');
}
function apPlainTable(text){
 // CSV and TSV parser respecting quoted line breaks and escaped quotes.
 const sep=(text.split(/\r?\n/,1)[0].includes('\t'))?'\t':',';
 const rows=[],line=[];let field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}
   else quoted=!quoted;
  }else if(ch===sep&&!quoted){line.push(field);field='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){
   if(ch==='\r'&&text[i+1]==='\n')i++;
   line.push(field);rows.push(line.splice(0));field='';
  }else field+=ch;
 }
 if(field!==''||line.length){line.push(field);rows.push(line);}
 return rows;
}
function apHeaderKey(header){
 const raw=String(header||'').trim().toLowerCase().replace(/\s+/g,' ');
 const flat=raw.replace(/[\s_\-()./]/g,'');
 if(['name','englishname','studentname','english','영어이름'].includes(flat))return 'englishName';
 if(['이름','이릉','한글이름','koreanname','korean','학생이름'].includes(flat))return 'koreanName';
 if(['반','class','classname','수업반'].includes(flat))return 'className';
 if(['다음반','nextclass','nextlevel'].includes(flat))return 'nextClass';
 if(['독서','bookreading','libraryreading'].includes(flat))return 'lib_reading';
 if(['razkids','raz','razkid'].includes(flat))return 'lib_raz';
 if(['시간엄수','punctuality','ontime'].includes(flat))return 'lib_punctuality';
 if(flat.startsWith('phonics'))return 'phonics';
 if(flat.startsWith('listening'))return 'listening';
 if(flat.startsWith('vocab')||flat.startsWith('vocabulary'))return 'vocab';
 if(flat.startsWith('grammarwrite')||flat.startsWith('grammarwriting')||flat==='gw')return 'gw';
 if(flat.startsWith('grammar'))return 'grammar';
 if(flat==='write'||flat.startsWith('writing'))return 'write';
 if(flat.startsWith('reading'))return 'reading';
 if(flat.startsWith('speaking'))return 'speaking';
 return '';
}
function apParseTable(table){
 if(!Array.isArray(table)||!table.length)throw Error('The spreadsheet is empty');
 let headerRow=-1,map={};
 for(let r=0;r<Math.min(table.length,35);r++){
  const columns=table[r]||[],look={};
  columns.forEach((name,i)=>{const key=apHeaderKey(name);if(key&&!Object.hasOwn(look,key))look[key]=i});
  if('englishName' in look&&'koreanName' in look&&'className' in look){
   headerRow=r;map=look;break;
  }
 }
 if(headerRow<0)throw Error('Could not find Name / Korean Name / Class headers. Choose the list tab.');
 if(!AP_SKILLS.some(key=>map[key]!==undefined))throw Error('No assessment skill columns found');
 const classes=new Map(),issues=[];
 let lastClass='';
 function text(row,key){const i=map[key];return i===undefined?'':String(row[i]??'').trim();}
 for(let n=headerRow+1;n<table.length;n++){
  const cells=table[n]||[];
  const en=text(cells,'englishName'),ko=text(cells,'koreanName'),cl=text(cells,'className');
  if(en&&ko&&(cl||lastClass)){
   const className=cl||lastClass;lastClass=className;
   if(!classes.has(className))classes.set(className,{className,rows:[],maxima:Object.fromEntries(AP_SKILLS.map(key=>[key,null]))});
   const group=classes.get(className),data={};
   for(const key of AP_SKILLS){
    const v=text(cells,key);data[key]=v===''?null:v;
    if(v!==''&&(!Number.isFinite(Number(v))||Number(v)<0))
     issues.push('Invalid score '+v+' for '+en+' · '+key);
   }
   for(const key of AP_GRADES)data[key]=text(cells,key)||null;
   group.rows.push({englishName:en,koreanName:ko,className,
    nextClass:text(cells,'nextClass'),data});
  }else if(lastClass&&!ko&&!cl&&(!en||/^(max|maximum|total|totals|합계|총점)$/i.test(en))){
   const values=AP_SKILLS.map(key=>text(cells,key));
   const positives=values.filter(v=>v!==''&&Number.isFinite(Number(v))&&Number(v)>0);
   if(positives.length>=2){
    const group=classes.get(lastClass);
    for(const key of AP_SKILLS){
     const v=text(cells,key);
     if(v!==''&&Number.isFinite(Number(v))&&Number(v)>0)group.maxima[key]=Number(v);
    }
    lastClass='';
   }
  }else if((en||ko||cl)&&!(en&&ko&&(cl||lastClass))){
   issues.push('Incomplete row '+(n+1));
  }
  if([...classes.values()].reduce((sum,g)=>sum+g.rows.length,0)>1500)throw Error('Too many students (maximum 1500)');
 }
 const groups=[...classes.values()];
 if(!groups.length)throw Error('No student rows found');
 if(issues.length)throw Error(issues.slice(0,6).join(' · '));
 return groups;
}
function apRenderParsed(){
 const pane=$('apMaxEditor');pane.replaceChildren();
 if(!apParsed?.classes?.length)return;
 const count=apParsed.classes.reduce((n,c)=>n+c.rows.length,0);
 $('apInputSummary').textContent=apParsed.classes.length+' classes · '+count+
  ' students. Review the class maximum marks, especially if the source has no TOTAL rows.';
 const scroller=document.createElement('div');scroller.className='ap-max-wrap';
 const table=document.createElement('table');table.className='ap-max-table';
 const head=document.createElement('tr');
 for(const label of ['Class','Students',...AP_SKILLS.map(k=>AP_LABELS[k])]){
  const th=document.createElement('th');th.textContent=label;head.append(th);
 }
 const thead=document.createElement('thead');thead.append(head);table.append(thead);
 const tbody=document.createElement('tbody');
 for(const cl of apParsed.classes){
  const tr=document.createElement('tr');
  const name=document.createElement('td');name.textContent=cl.className;tr.append(name);
  const number=document.createElement('td');number.textContent=cl.rows.length;tr.append(number);
  for(const key of AP_SKILLS){
   const td=document.createElement('td'),input=document.createElement('input');
   input.type='number';input.min='0';input.max='10000';input.step='any';
   input.title=cl.className+' '+AP_LABELS[key]+' maximum';
   input.value=cl.maxima[key]??'';
   input.addEventListener('input',()=>{cl.maxima[key]=input.value===''?null:input.value;apInvalidate()});
   td.append(input);tr.append(td);
  }
  tbody.append(tr);
 }
 table.append(tbody);scroller.append(table);pane.append(scroller);
}
async function apOnFile(event){
 apInvalidate();apParsed=null;apWorkbook=null;$('apMaxEditor').replaceChildren();
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>10*1024*1024){apMessage('Maximum file size is 10 MB',true);return;}
 apBusyState(true);
 try{
  await apLoadSheetJS();
  const workbook=window.XLSX.read(await file.arrayBuffer(),{type:'array'});
  apWorkbook=workbook;
  const select=$('apTab');select.replaceChildren();
  for(const name of workbook.SheetNames)select.add(new Option(name,name));
  select.value=workbook.SheetNames.find(n=>n.toLowerCase()==='list')||workbook.SheetNames[0];
  apSelectWorkbookTab();
 }catch(e){apMessage(e.message,true);}
 finally{apBusyState(false);}
}
function apSelectWorkbookTab(){
 if(!apWorkbook)return;
 try{
  const name=$('apTab').value;
  const table=window.XLSX.utils.sheet_to_json(apWorkbook.Sheets[name],
   {header:1,raw:false,defval:''});
  apParsed={classes:apParseTable(table)};
  apInvalidate();apRenderParsed();
  apMessage('Ready to preview student matches.');
 }catch(e){apParsed=null;$('apMaxEditor').replaceChildren();apMessage(e.message,true);}
}
function apParsePaste(){
 try{
  const t=$('apPaste').value.trim();
  if(!t)throw Error('Copy a rectangular range from Google Sheets and paste it here');
  apParsed={classes:apParseTable(apPlainTable(t))};
  apInvalidate();apRenderParsed();apMessage('Pasted cells parsed. Preview student matches next.');
 }catch(e){apParsed=null;apMessage(e.message,true);}
}
function apPayload(){
 const month=$('apDate').value,mode=$('apMode').value;
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Choose the new period month');
 if(PERIODS[month])throw Error('That period already exists. Choose a new month.');
 if(mode==='copy'){
  const fromPeriod=$('apSource').value;
  if(!fromPeriod||!PERIODS[fromPeriod])throw Error('Choose an existing period');
  return {period:month,mode,fromPeriod};
 }
 if(!apParsed?.classes?.length)throw Error('Upload a spreadsheet or paste cells first');
 return {period:month,mode,classes:apParsed.classes};
}
function apShowPreview(preview){
 const pane=$('apMatches');pane.replaceChildren();
 const p=document.createElement('p');p.className='ap-summary';
 p.textContent=preview.label+': '+preview.totalRows+' students in '+preview.classes.length+
  ' classes · '+preview.matched+' matched · '+preview.unmatched+' unmatched (read-only).';
 pane.append(p);
 const details=document.createElement('details');
 const summary=document.createElement('summary');
 summary.textContent='Review classes and unmatched students';details.append(summary);
 const table=document.createElement('table');table.className='ap-review-table';
 const head=document.createElement('tr');
 for(const name of ['Class','Students','Matched','Unmatched']){
  const cell=document.createElement('th');cell.textContent=name;head.append(cell);
 }
 const thead=document.createElement('thead');thead.append(head);table.append(thead);
 const tbody=document.createElement('tbody');
 for(const cl of preview.classes){
  const tr=document.createElement('tr');
  const unresolved=cl.rows.filter(r=>!r.userId);
  for(const v of [cl.className,String(cl.rows.length),String(cl.rows.length-unresolved.length),
   unresolved.map(r=>r.englishName+' ('+r.koreanName+')').join(', ')||'—']){
   const td=document.createElement('td');td.textContent=v;tr.append(td);
  }
  tbody.append(tr);
 }
 table.append(tbody);details.append(table);pane.append(details);
}
async function apPreviewPeriod(){
 let payload;
 try{payload=apPayload();}catch(e){apMessage(e.message,true);return;}
 apBusyState(true);apInvalidate();
 try{
  const response=await api('preview_assessment_period',{},{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  });
  apConfirmedPreview=payload;
  apShowPreview(response.preview);
  $('apConfirm').disabled=false;
  apMessage('Review the matches, then click Create period. Nothing has been saved yet.');
 }catch(e){apMessage('Preview failed: '+e.message,true);}
 finally{apBusyState(false);$('apConfirm').disabled=!apConfirmedPreview;}
}
async function apCreatePeriod(){
 if(!apConfirmedPreview||apBusy)return;
 const payload=apConfirmedPreview;
 apBusyState(true);$('apConfirm').disabled=true;
 try{
  const result=await api('create_assessment_period',{},{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  });
  PERIODS[result.period]=new Date(result.period+'-01T00:00:00Z')
   .toLocaleString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
  renderPeriodOptions();
  $('apDialog').hidden=true;
  apConfirmedPreview=null;
  await loadPeriod(result.period);
  refreshAssessmentPeriods();
  status('Created '+PERIODS[result.period]+' · '+result.students+' students · '+result.matched+' linked');
 }catch(e){
  apMessage('Could not create period: '+e.message,true);
  $('apConfirm').disabled=false;
 }finally{apBusyState(false);}
}
$('apOpen').addEventListener('click',apOpen);
$('apClose').addEventListener('click',apClose);
$('apMode').addEventListener('change',apReadMode);
$('apDate').addEventListener('change',()=>{fillSourcePeriodOptions();apInvalidate()});
$('apSource').addEventListener('change',apInvalidate);
$('apFile').addEventListener('change',apOnFile);
$('apTab').addEventListener('change',apSelectWorkbookTab);
$('apPasteRead').addEventListener('click',apParsePaste);
$('apPaste').addEventListener('input',()=>{apInvalidate();apMessage('Paste updated — click Read pasted cells again.')});
$('apPreview').addEventListener('click',apPreviewPeriod);
$('apConfirm').addEventListener('click',apCreatePeriod);
$('apDialog').addEventListener('click',e=>{if(e.target===$('apDialog'))apClose()});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('apDialog').hidden&&!apBusy){e.preventDefault();apClose();}
});

startup();
})();