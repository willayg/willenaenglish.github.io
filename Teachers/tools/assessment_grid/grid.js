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
 if(k==='englishName'){
  td.className='locked';
  const btn=document.createElement('button');btn.className='rc-student-link';
  btn.type='button';btn.textContent=r.englishName;btn.title='Preview '+r.englishName+' report card';
  btn.addEventListener('click',()=>openReport(r));td.append(btn);
 }else if(kind==='fixed'){td.className='locked';td.textContent=r[k];}
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
function reportDraftKey(row){return (row?.className||'')+':'+(row?.id||'');}
function reportColumns(row){
 const maxima=classCache.get(row.className)?.totals||current?.totals||{};
 return SKILLS.map(key=>({
   key, type:'number', max:maxima[key]??null,
   label:FIELDS.find(f=>f[0]===key)?.[1]||key
 }));
}
function reportStudent(row){
 return {name:row.englishName,korean_name:row.koreanName,class:row.className,data:{...row.data}};
}
function reportTest(row){
 return {name:'October 2026 Report Cards',class:row.className,date:'2026-10-01',term_from:'2026-10',term_to:'2026-10',columns:reportColumns(row)};
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
  pdf.save('Willena_Report_Cards_October_2026_'+safe+'.pdf');
  reportStatus('PDF downloaded: '+rows.length+' report card'+(rows.length===1?'':'s')+'.');
 }catch(e){
  reportStatus('PDF failed: '+e.message,true);
 }finally{
  mount.replaceChildren();setReportBusy(false);
 }
}
$('rcOpen').addEventListener('click',()=>{
 const visible=current?.rows.filter(matchesSearch)||[];
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