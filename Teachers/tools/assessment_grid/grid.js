(() => {
'use strict';
const $ = id => document.getElementById(id);
const API = '/.netlify/functions/test_admin';
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

let tests = new Map(), klass = '', current = null, selected = null;
let undo = [], redo = [], pending = new Map(), alive = true;
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
   if(changed){updateVisibleValues();status('Updated from another teacher · '+changed+' row(s)');}
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
async function startup(){
 const filter=$('gridFilterColumn');
 filter.replaceChildren();filter.add(new Option('All columns',''));
 for(const [key,label] of FIELDS)filter.add(new Option(label,key));
 filter.add(new Option('Total %','totalPct'));filter.add(new Option('Average %','averagePct'));
 const select=$('period');
 select.replaceChildren();
 for(const [value,label] of Object.entries(PERIODS))select.add(new Option(label,value));
 select.value=period;
 await loadPeriod(period,true);
}

/* Spreadsheet engine: selection, clipboard, history, fill, sort and resize.
   Only assessment value cells are writable; names, maxima and calculated
   percentages are copyable but always read-only. All writes use test_admin. */
const COLS=FIELDS.map(f=>f[0]).concat(['totalPct','averagePct']);
const METRIC_KEYS=new Set(['totalPct','averagePct']);
const COLUMN_DEFAULTS={num:42,englishName:138,koreanName:104,className:112,nextClass:112,lib_reading:116,lib_raz:103,lib_punctuality:105,phonics:106,listening:112,vocab:105,grammar:112,gw:150,write:105,reading:108,speaking:113,totalPct:108,averagePct:120};
const WIDTH_KEY='willena-assessment-grid-column-widths-v2';
let widths={};
try{widths=JSON.parse(localStorage.getItem(WIDTH_KEY)||'{}')||{}}catch{widths={}}
let filterKey='',filterText='',sortKey='',sortDir=0;
let rangeSelection=null,selectionDrag=false,fillDrag=null,suppressFocusSelection=false;
const colWidth=key=>Math.max(56,Math.min(520,Number(widths[key])||COLUMN_DEFAULTS[key]||105));
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
 if(!found||!filterText||!filterKey)return found;
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
 $('selectionInfo').textContent=count>1?count+' cells selected':'';
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
  if(!validate(row,key,item.value)){invalid++;continue;}
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
 if(changes.length)updateVisibleValues();
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
function history(type){
 if(!current)return;
 const source=type==='undo'?undo:redo,dest=type==='undo'?redo:undo;
 const index=source.map(op=>op.testId).lastIndexOf(current.testId);
 if(index<0)return;
 const [operation]=source.splice(index,1);
 const result=applyBatch(operation.changes.map(c=>({id:c.id,key:c.key,value:type==='undo'?c.before:c.after})),
  {record:false,label:'History'});
 if(result.count)dest.push(operation);
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
  status('Copied '+(selectedRect()?.rows.length?'selected range':'cells'));
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
 status('Filled '+result.count+' cells'+(result.readonly?' · '+result.readonly+' locked skipped':''));
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
function resizeColumns(){
 const table=$('sheet');
 let group=table.querySelector('colgroup');
 if(!group){group=document.createElement('colgroup');table.insertBefore(group,table.firstChild);}
 group.replaceChildren();
 const keys=['num',...COLS];
 for(const key of keys){
  const col=document.createElement('col');col.style.width=colWidth(key)+'px';group.append(col);
 }
 table.style.tableLayout='fixed';
 table.style.width=Math.max(840,keys.reduce((n,k)=>n+colWidth(k),0))+'px';
}
function headCell(label,key){
 const th=document.createElement('th');th.textContent=label;
 th.dataset.columnKey=key;th.style.width=colWidth(key)+'px';
 if(key!=='num'){
  th.classList.add('grid-sortable');th.title='Click to sort · drag edge to resize';
  if(sortKey===key&&sortDir)th.textContent=label+(sortDir===1?' ↑':' ↓');
  th.addEventListener('click',e=>{
   if(e.target.closest('.grid-col-resize'))return;
   if(sortKey===key)sortDir=sortDir===1?-1:sortDir===-1?0:1;
   else{sortKey=key;sortDir=1;}
   if(!sortDir)sortKey='';
   rangeSelection=null;render();
  });
 }
 if(key!=='num'){
  const handle=document.createElement('span');handle.className='grid-col-resize';
  handle.title='Drag to resize';
  handle.addEventListener('pointerdown',event=>{
   event.stopPropagation();event.preventDefault();
   const startX=event.clientX,startWidth=colWidth(key);
   const onMove=e=>{
    widths[key]=Math.max(56,Math.min(520,startWidth+(e.clientX-startX)));
    const cols=['num',...COLS],idx=cols.indexOf(key);
    const col=$('sheet').querySelectorAll('colgroup col')[idx];
    if(col)col.style.width=widths[key]+'px';
    $('sheet').style.width=cols.reduce((sum,k)=>sum+colWidth(k),0)+'px';
   };
   const onUp=()=>{
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    try{localStorage.setItem(WIDTH_KEY,JSON.stringify(widths));}catch{}
    render();
   };
   window.addEventListener('pointermove',onMove);
   window.addEventListener('pointerup',onUp,{once:true});
  });
  th.append(handle);
 }
 return th;
}
function render(){
 if(!current)return;
 $('tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.className===klass));
 const table=$('sheet'),head=table.querySelector('thead'),body=table.querySelector('tbody');
 head.replaceChildren();body.replaceChildren();
 resizeColumns();
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
  const td=document.createElement('td');td.textContent=i===0?'Class TOTAL':type==='score'?display(current.totals[key]):'';
  totals.append(td);
 }
 for(let i=0;i<2;i++){const td=document.createElement('td');td.className='metric';td.textContent='—';totals.append(td);}
 body.append(totals);
 $('summary').textContent=rows.length+' of '+current.rows.length+' students · '+current.rows.filter(r=>!r.userId).length+' unmatched · '+klass;
 updateSelectionClasses();
 updateHistoryButtons();
}
function updateVisibleValues(){
 if(!current)return;
 const trs=$('sheet').querySelectorAll('tbody tr[data-row-id]');
 for(const tr of trs){
  const row=getRowById(tr.dataset.rowId);if(!row)continue;
  for(const input of tr.querySelectorAll('input')){
   if(document.activeElement!==input)input.value=display(row.data[input.dataset.key]);
  }
  const pct=calculatePercentages(row,current.totals);
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
$('reset').textContent='Reload class';
$('reset').onclick=()=>{if(pending.size){status('Finish saving edits before reloading',true);return;}openClass(klass,true)};
$('klass').addEventListener('change',e=>{resetGridSelection();openClass(e.target.value)});
$('period').addEventListener('change',e=>{
 if(!$('rcDialog').hidden){$('rcDialog').hidden=true;$('rcPageMount').replaceChildren();}
 resetGridSelection();loadPeriod(e.target.value);
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
 const editing=target instanceof HTMLInputElement&&target.dataset.editing==='true';
 const ctrl=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(ctrl&&!editing&&insideGrid){
  if(key==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');return;}
  if(key==='y'){e.preventDefault();history('redo');return;}
  if(key==='a'&&current&&selected){e.preventDefault();const rows=visibleRows();if(!rows.length)return;rangeSelection={testId:current.testId,
    anchor:{id:rows[0].id,key:COLS[0]},focus:{id:rows[rows.length-1].id,key:COLS[COLS.length-1]}};updateSelectionClasses();return;}
 }
 if(!current||!selected||!insideGrid)return;
 if(e.key==='F2'&&target instanceof HTMLInputElement){e.preventDefault();target.dataset.editing='true';target.setSelectionRange(target.value.length,target.value.length);return;}
 if(e.key==='Escape'&&editing){e.preventDefault();target.dataset.editing='false';target.select();return;}
 if(editing)return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();clearSelection();return;}
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Tab'].includes(e.key)){
  e.preventDefault();
  moveSelection(e.key==='Tab'&&e.shiftKey?'ShiftTab':e.key,
   e.shiftKey&&e.key.startsWith('Arrow'));
 }
},true);
document.addEventListener('copy',e=>{
 if(!current||!rangeSelection||($('rcDialog')&&!$('rcDialog').hidden))return;
 if(!e.target.closest?.('#sheet')||e.target instanceof HTMLInputElement&&e.target.dataset.editing==='true')return;
 const str=readSelection();if(!str)return;
 e.clipboardData?.setData('text/plain',str);e.preventDefault();
});
document.addEventListener('cut',e=>{
 if(!current||!rangeSelection||!$('rcDialog').hidden)return;
 if(e.target instanceof HTMLInputElement&&e.target.dataset.editing==='true')return;
 const str=readSelection();if(!str)return;
 e.clipboardData?.setData('text/plain',str);e.preventDefault();clearSelection();
});
document.addEventListener('paste',e=>{
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
 const visible=current.rows.filter(matchesSearch);
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

startup();
})();