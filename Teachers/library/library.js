import {mountDailyRegister} from './daily-register.js?v=4';
import {mountMonthlyRegister} from './monthly-register.js?v=3';
import {initLibraryLanguage,mountLibraryLanguage,localText} from './library-i18n.js?v=7';
import {mountTeacherHeader} from '/components/teacher-header/teacher-header.js?v=20261127-raz2';
import {ensureTeacherSession,ensureAuthRefresh} from '/Teachers/auth-refresh.js?v=20261021-sessionfix1';
import {norm,points,parseRaz,ranked,calculateAwards,matchFile,inferSource} from './raz-core.js?v=3';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const label=m=>new Date(m+'-01T00:00:00Z').toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
const S={month:today.slice(0,7),students:[],accounts:[],hints:[],results:[],awards:null,files:[],draft:[],rules:{gold:50,silver:30,promote:true},run:0,busy:false};
const opt=(v,l,sel=false)=>'<option value="'+esc(v)+'"'+(sel?' selected':'')+'>'+esc(l)+'</option>';
const name=s=>s?(s.name||s.korean_name||'Unnamed')+(s.korean_name&&s.name!==s.korean_name?' · '+s.korean_name:''):'Inactive student';
const person=id=>S.students.find(s=>s.id===id);
const ranks=()=>ranked(S.students,S.results);
let dailyRegister=null;
const empty=t=>'<div class="empty">'+esc(t)+'</div>';
const metric=(l,v)=>'<div class="metric"><span class="muted">'+esc(l)+'</span><strong>'+esc(v)+'</strong></div>';
function table(headers,rows){return '<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'}
function msg(id,text='',bad=false){$(id).textContent=text;$(id).classList.toggle('error',bad)}
async function api(action,body,month){
 const headers={};const setToken=()=>{try{const t=localStorage.getItem('sb_access_token');if(t&&t.includes('.'))headers.Authorization='Bearer '+t}catch{}};setToken();
 if(body!==undefined)headers['Content-Type']='application/json';
 const req=async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch('/api/library?'+new URLSearchParams({action,...(month?{month}:{})}),{method:body===undefined?'GET':'POST',credentials:'include',cache:'no-store',headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});const data=await r.json().catch(e=>{if(controller.signal.aborted)throw e;return {error:'Library API unavailable'}});return {r,data}}catch(e){if(controller.signal.aborted)throw Error('Library request timed out. Please retry.');throw e}finally{clearTimeout(timer)}};
 let {r,data}=await req();if(r.status===401){await ensureTeacherSession();setToken();({r,data}=await req())}if(!r.ok)throw Error(data.error||'Request failed');return data
}
let setupPending=null,setupReady=false;
async function ensureSetup(force=false){
 if(setupPending)return setupPending;
 if(setupReady&&!force)return;
 setupPending=(async()=>{const setup=await api('setup');S.students=setup.students||[];S.accounts=setup.accounts||[];S.hints=setup.hints||[];setupReady=true;dailyRegister?.refreshRoster()})();
 try{await setupPending}finally{setupPending=null}
}
function renderResults(){const all=ranks(),q=norm($('#search').value),cls=$('#class').value,rows=all.filter(x=>(!cls||x.cls===cls)&&(!q||[x.s.name,x.s.korean_name,x.s.username,x.cls].some(v=>norm(v).includes(q))));const imported=all.filter(x=>x.r);$('#stats').innerHTML=metric('Imported students',imported.length)+metric('Active readers',imported.filter(x=>x.score>0).length)+metric('Reading points',imported.reduce((n,x)=>n+x.score,0).toLocaleString());const multi=all.filter(x=>x.multiple).length;$('#results').innerHTML=(multi?'<div class="notice warning">'+multi+' students have multiple account reports; excluded from automatic ranking until reviewed.</div>':'')+(rows.length?table(['Rank','Student','Class','Listen','Read','Rec.','Points','Through'],rows.map(x=>'<tr><td class="rank">'+esc(x.rank??'—')+'</td><td class="namecell"><strong data-no-translate>'+esc(x.s.name||x.s.korean_name)+'</strong><small data-no-translate>'+esc(x.s.korean_name)+'</small></td><td data-no-translate>'+esc(x.cls)+'</td>'+['listens','reads','recordings'].map(k=>'<td class="num">'+esc(x.r?x.r[k]:'—')+'</td>').join('')+'<td class="num points">'+esc(x.multiple?'Review':x.score??'—')+'</td><td>'+esc(x.r?x.r.through_date.slice(5):x.multiple?'Multiple accounts':'Not imported')+'</td></tr>')):empty('No matching students'))}
function renderReports(){const files=new Map();for(const r of S.results){const source=r.library_raz_accounts_v2?.source_account||'Unknown',key=JSON.stringify([source,r.through_date,r.filename]);const f=files.get(key)||{source,date:r.through_date,filename:r.filename,count:0};f.count++;files.set(key,f)}$('#reports').innerHTML=files.size?[...files.values()].sort((a,b)=>a.source.localeCompare(b.source)).map(f=>'<div class="report-row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2h11l5 5v15H4zM14 2v6h6M7 12h10m-10 4h10m-5-4v8"/></svg><div><strong>'+esc(f.source)+' · '+esc(f.date)+'</strong><span class="report-meta">'+esc(f.filename)+' · '+f.count+' student records</span></div><span class="pill">Imported</span></div>').join(''):empty('No reports imported for '+label(S.month)+'.')}

const DEFAULT_AWARD_RULES={gold:50,silver:30,promote:true};
function awardCoverage(){
 const all=ranks(),known=new Set(S.hints.map(h=>h.student_id)),expected=all.filter(x=>known.has(x.s.id)||x.r||x.multiple),imported=expected.filter(x=>x.r),missing=expected.filter(x=>x.score===null),dates=new Set(S.results.map(r=>r.through_date));
 return {all,expected,imported,missing,mixed:dates.size>1,unknown:!S.hints.length,through:[...dates].sort()[0]||'',partial:!S.hints.length||missing.length>0||dates.size>1};
}
function awardCoverageHTML(c){return '<div class="award-coverage '+(c.partial?'warning':'')+'"><strong>'+c.imported.length+' / '+c.expected.length+'</strong><div><span>Imported reading records</span><small>'+(c.unknown?'Library roster coverage is unknown.':c.missing.length?esc(c.missing.length+' roster students still need a valid report.'):'All known roster students have a valid report.')+'</small>'+(c.mixed?'<small>Report end dates differ.</small>':'')+(c.through?'<small>'+esc('Earliest report through '+c.through)+'</small>':'')+'</div></div>'}
function awardChanged(){const saved=Date.parse(S.awards?.updated_at||'');return !!S.awards&&S.results.some(r=>Date.parse(r.updated_at)>saved)}
function awardPeople(rec){return rec.map(r=>{const s=person(r.student_id);return {...r,name:r.name||s?.name||s?.korean_name||'Student',korean_name:r.korean_name??s?.korean_name??''}})}
function awardCards(rec,c){
 const rows=awardPeople(rec),classes=[...new Set([...c.imported.map(x=>x.cls),...rows.map(x=>x.class_name)])].filter(x=>x&&x!=='Unassigned').sort();
 if(!classes.length)return empty('Import reading reports to calculate prize candidates.');
 const medals=(arr,type)=>arr.length?arr.map(x=>'<div class="prize-person"><strong data-no-translate>'+esc(x.name)+'</strong><small data-no-translate>'+esc(x.korean_name)+'</small><span class="prize-score">'+esc(x.points??'—')+'</span></div>').join(''):'<span class="muted">No qualifier</span>';
 return '<div class="prize-class-grid">'+classes.map(cls=>{const gr=rows.filter(x=>x.class_name===cls);return '<section class="prize-class"><header><strong data-no-translate>'+esc(cls)+'</strong><small>'+esc(c.imported.filter(x=>x.cls===cls).length+' imported')+'</small></header><div class="prize-lanes"><div class="prize-lane gold-lane"><span>Gold</span>'+medals(gr.filter(x=>x.award==='Gold'),'Gold')+'</div><div class="prize-lane silver-lane"><span>Silver</span>'+medals(gr.filter(x=>x.award==='Silver'),'Silver')+'</div></div></section>'}).join('')+'</div>';
}
function renderAwards(){
 const a=S.awards,c=awardCoverage(),rec=a?.recipients||calculateAwards(c.all,DEFAULT_AWARD_RULES),gold=rec.filter(x=>x.award==='Gold').length,silver=rec.length-gold,changed=awardChanged();
 $('#awardStatus').textContent=a?'Confirmed · '+gold+' Gold · '+silver+' Silver':'Provisional candidates · '+gold+' Gold · '+silver+' Silver';
 $('#prepare').textContent=a?'Edit confirmed prizes':'Review & confirm prizes';
 $('#prepare').disabled=!a&&!c.imported.length;
 $('#printButtons').hidden=false;
 $('#goldPDF').disabled=!gold||changed;$('#silverPDF').disabled=!silver||changed;
 $('#goldPDF').textContent=a?'Gold prize PDF':'Preview Gold PDF';$('#silverPDF').textContent=a?'Silver prize PDF':'Preview Silver PDF';
 $('#awards').innerHTML=awardCoverageHTML(c)+(changed?'<div class="notice warning">New reading reports arrived after confirmation. Review and reconfirm before printing.</div>':'')+(!a&&c.imported.length?'<div class="muted small">Provisional results. Confirm only after all reports have been checked.</div>':'')+awardCards(rec,c);
}
function render(){const old=$('#class').value,classes=[...new Set(ranks().map(x=>x.cls))].sort();$('#class').innerHTML=opt('','All classes')+classes.map(c=>opt(c,c,c===old)).join('');renderReports();renderResults();renderAwards()}
async function load(full=false){const run=++S.run;$('#upload').disabled=true;$('#manageAccounts').disabled=true;$('#quickDrop').disabled=true;$('#prepare').disabled=true;$('#awardHistory').disabled=true;$('#goldPDF').disabled=true;$('#silverPDF').disabled=true;msg('#status','Loading…');try{const [m]=await Promise.all([api('month',undefined,S.month+'-01'),ensureSetup(full)]);if(run!==S.run)return;S.results=m.results||[];S.awards=m.awards;render();$('#upload').disabled=false;$('#manageAccounts').disabled=false;$('#quickDrop').disabled=false;$('#awardHistory').disabled=false;msg('#status')}catch(e){if(run===S.run){S.results=[];S.awards=null;render();$('#prepare').disabled=true;$('#goldPDF').disabled=true;$('#silverPDF').disabled=true;msg('#status',e.message,true)}throw e}}
async function addFiles(list){if(S.parsing||S.busy)return;S.parsing=true;$('#confirmImport').disabled=true;try{if(S.files.length+list.length>30)throw Error('Maximum 30 CSVs');const next=[];for(const file of list){if(file.size>2e6)throw Error('File too large');const rows=parseRaz(await file.text()),dates=file.name.match(/(\d{4}-\d{2}-\d{2})[_ ](\d{4}-\d{2}-\d{2})/),source=inferSource(rows,S.students,S.accounts,S.hints);const f={filename:file.name,source,month:dates?.[1]||S.month+'-01',through:dates?.[2]||(S.month===today.slice(0,7)?today:S.month+'-01'),rows};matchFile(f,S.students,S.accounts,S.hints);next.push(f)}S.files.push(...next);renderImport();msg('#importMessage','Files parsed. Review only the accounts that need attention.')}catch(e){msg('#importMessage',e.message,true)}finally{S.parsing=false;$('#confirmImport').disabled=S.busy||!S.files.length}}

function renderImport(){
 const sources=[...new Set([...S.accounts,...S.hints].map(a=>a.source_account))].filter(Boolean).sort(),st=S.students.slice().sort((a,b)=>name(a).localeCompare(name(b)));
 let html='<div class="drop" id="drop"><strong>Upload Student Usage CSV files</strong><span class="muted">Select all downloaded teacher-account reports.</span><input id="csv" type="file" accept=".csv,text/csv" multiple></div><datalist id="sources">'+sources.map(s=>opt(s,s)).join('')+'</datalist>';
 const unresolved=r=>!r.skip&&(!r.student_id||!person(r.student_id));
 const total=S.files.reduce((n,f)=>n+f.rows.filter(r=>!r.skip&&r.student_id&&person(r.student_id)).length,0);
 const attention=S.files.reduce((n,f)=>n+f.rows.filter(unresolved).length,0);
 const excluded=S.files.reduce((n,f)=>n+f.rows.filter(r=>r.skip).length,0);
 const labelsMissing=S.files.filter(f=>!f.source.trim()).length;
 if(S.files.length)html+='<div class="match-overview"><div><strong>'+total+'</strong><span>Ready to import</span></div><div class="'+(attention?'needs-review':'')+'"><strong>'+attention+'</strong><span>Need attention</span></div><div><strong>'+excluded+'</strong><span>Excluded</span></div></div>';
 if(labelsMissing)html+='<div class="notice warning">A teacher account label could not be identified. Choose its source before importing.</div>';
 S.files.forEach((f,i)=>{
  const all=f.rows.map((r,j)=>({r,j})),matched=all.filter(({r})=>!r.skip&&r.student_id&&person(r.student_id)),pending=all.filter(({r})=>unresolved(r)),skipped=all.filter(({r})=>r.skip);
  const row=({r,j})=>{
   const student=person(r.student_id);
   const selector=r.inactive?'<span class="muted">Inactive student</span>':r.linked?'<strong data-no-translate>'+esc(name(student))+'</strong><small>Saved link</small>':'<select class="match-select" data-match="'+i+':'+j+'">'+opt('','Choose student',!r.student_id)+st.map(s=>opt(s.id,name(s)+' ('+(s.class||'Unassigned')+')',r.student_id===s.id)).join('')+'</select>';
   const status=r.inactive?'Excluded':r.linked?'Saved link':r.auto?'Automatic match':r.manual&&student?'Selected':'Review';
   return '<tr><td><strong data-no-translate>'+esc(r.screen_name)+'</strong><small data-no-translate>'+esc(r.account_name)+'</small></td><td class="points">'+points(r)+'</td><td>'+selector+(student&&!r.linked?'<small>'+status+'</small>':'')+'</td><td>'+(r.inactive?'<span class="muted">Excluded</span>':'<input type="checkbox" aria-label="Skip '+esc(r.screen_name)+'" data-skip="'+i+':'+j+'" '+(r.skip?'checked':'')+'>')+'</td></tr>';
  };
  const headers=['Raz-Kids account','Points','Willena student','Skip'];
  html+='<section class="file-block"><header><div><strong data-no-translate>'+esc(f.filename)+'</strong><p class="muted">'+f.rows.length+' records · '+matched.length+' ready</p></div><button class="secondary" data-remove-file="'+i+'">Remove</button></header>';
  html+='<div class="form-grid match-file-meta"><label>Raz-Kids teacher account label<input data-source="'+i+'" list="sources" maxlength="160" placeholder="Same account label each month" value="'+esc(f.source)+'"></label><div class="form-grid match-dates"><label>Report from<input data-from="'+i+'" type="date" value="'+esc(f.month)+'"></label><label>Report through<input data-through="'+i+'" type="date" value="'+esc(f.through)+'"></label></div></div>';
  if(!pending.length&&f.source&&matched.length)html+='<div class="match-success">All active records are matched. Ready to import.</div>';
  if(pending.length)html+='<div class="notice warning">Only these accounts need your attention.</div>'+table(headers,pending.map(row));
  if(matched.length)html+='<details class="match-details" data-review="'+i+'" '+(f.reviewOpen?'open':'')+'><summary><span>Review automatic matches</span><strong>'+matched.length+'</strong></summary>'+table(headers,matched.map(row))+'</details>';
  if(skipped.length)html+='<details class="match-details excluded-details" data-excluded="'+i+'" '+(f.excludedOpen?'open':'')+'><summary><span>Excluded accounts</span><strong>'+skipped.length+'</strong></summary>'+table(headers,skipped.map(row))+'</details>';
  html+='</section>';
 });
 if(S.files.length)html+='<div class="notice">Reports must begin on the first day of the month. Re-importing replaces the same account’s monthly snapshot, never adds points. Confirming saves new links permanently.</div>';
 $('#importBody').innerHTML=html;$('#confirmImport').hidden=!S.files.length;$('#confirmImport').disabled=S.busy||!!S.parsing||!S.files.length;
 $('#csv').onchange=e=>addFiles([...e.target.files]);const drop=$('#drop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');addFiles([...e.dataTransfer.files])};
 $$('[data-review]').forEach(el=>el.ontoggle=()=>{if(S.files[+el.dataset.review])S.files[+el.dataset.review].reviewOpen=el.open});
 $$('[data-excluded]').forEach(el=>el.ontoggle=()=>{if(S.files[+el.dataset.excluded])S.files[+el.dataset.excluded].excludedOpen=el.open});
 $$('[data-remove-file]').forEach(b=>b.onclick=()=>{S.files.splice(+b.dataset.removeFile,1);renderImport()});
 $$('[data-source]').forEach(b=>b.onchange=()=>{const f=S.files[+b.dataset.source],v=b.value.trim();if(v!==f.source){f.source=v;matchFile(f,S.students,S.accounts,S.hints);renderImport()}});
 $$('[data-from]').forEach(b=>b.onchange=()=>S.files[+b.dataset.from].month=b.value);$$('[data-through]').forEach(b=>b.onchange=()=>S.files[+b.dataset.through].through=b.value);
 $$('[data-match]').forEach(b=>b.onchange=()=>{const [i,j]=b.dataset.match.split(':').map(Number),f=S.files[i],r=f.rows[j];r.student_id=b.value;r.auto=false;r.manual=!!b.value;f.reviewOpen=true;renderImport()});
 $$('[data-skip]').forEach(b=>b.onchange=()=>{const [i,j]=b.dataset.skip.split(':').map(Number),f=S.files[i];f.rows[j].skip=b.checked;if(b.checked)f.excludedOpen=true;renderImport()});
}
function renderAccountList(){const q=norm($('#accountSearch').value),source=$('#accountSource').value;
 const rows=S.accounts.filter(a=>(!source||a.source_account===source)&&(!q||[a.account_name,a.screen_name,a.source_account,person(a.student_id)?.name,person(a.student_id)?.korean_name].some(x=>norm(x).includes(q)))).sort((a,b)=>a.source_account.localeCompare(b.source_account)||a.screen_name.localeCompare(b.screen_name));
 $('#accountList').innerHTML=rows.length?table(['Raz-Kids account','Willena student','Teacher account','Status'],rows.map(a=>{const s=person(a.student_id);return '<tr><td><strong data-no-translate>'+esc(a.screen_name)+'</strong><small data-no-translate>'+esc(a.account_name)+'</small></td><td data-no-translate>'+esc(s?name(s):'—')+'</td><td data-no-translate>'+esc(a.source_account)+'</td><td><span class="'+(s?'match-status':'muted')+'">'+(s?'Saved link':'Inactive student')+'</span></td></tr>'})):empty('No matching accounts');
}
function openAccountList(){const sources=[...new Set(S.accounts.map(a=>a.source_account))].sort();$('#accountSource').innerHTML=opt('','All teacher accounts')+sources.map(s=>opt(s,s)).join('');$('#accountSearch').value='';renderAccountList();$('#accountDialog').showModal()}
async function saveImport(){if(S.busy||S.parsing)return;try{const files=S.files.map(f=>({...f,rows:f.rows.filter(r=>!r.skip)})).filter(f=>f.rows.length);if(!files.length)throw Error('No records selected');for(const f of files){if(!f.source.trim())throw Error('Enter the Raz-Kids teacher account label for every file');if(!/^\d{4}-\d{2}-01$/.test(f.month)||f.through.slice(0,7)!==f.month.slice(0,7)||f.through<f.month)throw Error('Report must start on day 1 and finish in the same month');if(f.rows.some(r=>!r.student_id||!person(r.student_id)))throw Error('Match or skip every unresolved student')}if(new Set(files.map(f=>f.month)).size!==1)throw Error('Import one month at a time');S.busy=true;$('#confirmImport').disabled=true;msg('#importMessage','Saving…');const result=await api('import',{files});S.files=[];$('#importDialog').close();S.month=files[0].month.slice(0,7);$('#month').value=S.month;await load(true);msg('#status','Imported '+result.imported+' records. '+(result.older_skipped?result.older_skipped+' older reports ignored.':''))}catch(e){msg($('#importDialog').open?'#importMessage':'#status',e.message,true)}finally{S.busy=false;if($('#confirmImport'))$('#confirmImport').disabled=false}}

function readRules(){const gold=Number($('#goldMin').value),silver=Number($('#silverMin').value);if(!Number.isInteger(gold)||!Number.isInteger(silver)||silver<1||gold<silver||gold>1000000)throw Error('Enter valid thresholds: Gold ≥ Silver ≥ 1');return {gold,silver,promote:$('#promote').checked}}
function rulesEqual(a,b){return a.gold===b.gold&&a.silver===b.silver&&a.promote===b.promote}
function preserveRules(){try{if(!rulesEqual(readRules(),S.rules))throw Error('Recalculate winners after changing the qualifying rules.');return true}catch(e){msg('#awardMessage',e.message,true);return false}}
function renderAwardDialog(){
 const r=S.rules,d=S.draft,rows=ranks(),c=awardCoverage(),classes=[...new Set(rows.filter(x=>x.score!==null).map(x=>x.cls))].sort(),gold=d.filter(x=>x.award==='Gold').length;
 let html='<p class="muted">'+esc(label(S.month))+' · Class winners, including ties</p>'+awardCoverageHTML(c);
 html+='<details class="match-details award-rules"><summary>Qualifying rules</summary><div class="award-rule-body"><div class="form-grid"><label>Minimum Gold points<input id="goldMin" type="number" min="1" step="1" value="'+r.gold+'"></label><label>Minimum Silver points<input id="silverMin" type="number" min="1" step="1" value="'+r.silver+'"></label></div><label class="inline-check"><input id="promote" type="checkbox" '+(r.promote?'checked':'')+'> Promote the sole Silver qualifier when no Gold qualifier</label><p class="muted small">If no student reaches Gold, all Silver qualifiers receive Silver unless the sole qualifier is promoted. Otherwise, Gold goes to the highest score and Silver to the next highest qualifying score, including ties.</p><p class="muted small">Default thresholds and promotion are inferred from past awards. Adjust and recalculate before confirming.</p><button id="recalc" class="secondary">Recalculate winners</button></div></details>';
 html+='<div class="stats award-counts">'+metric('Gold recipients',gold)+metric('Silver recipients',d.length-gold)+'</div>';
 html+=d.length?table(['Class','Student','Points','Prize',''],d.slice().sort((a,b)=>a.class_name.localeCompare(b.class_name)||a.award.localeCompare(b.award)).map(x=>'<tr><td data-no-translate>'+esc(x.class_name)+'</td><td><strong data-no-translate>'+esc(person(x.student_id)?name(person(x.student_id)):x.name||'Inactive student')+'</strong></td><td>'+esc(x.points??'—')+'</td><td><select data-award="'+esc(x.student_id)+'">'+opt('Gold','Gold',x.award==='Gold')+opt('Silver','Silver',x.award==='Silver')+'</select></td><td><button class="secondary" data-remove="'+esc(x.student_id)+'">Remove</button></td></tr>')):empty('No qualifying winners. Adjust thresholds or add recipients.');
 html+='<details class="match-details"><summary>Add a student</summary><div class="award-rule-body"><div class="form-grid"><label>Class<select id="extraClass">'+opt('','Choose class')+classes.map(c=>opt(c,c)).join('')+'</select></label><label>Additional student<select id="extraStudent"><option value="">Choose class first</option></select></label></div><div class="actions"><button class="secondary" id="addGold" disabled>Add Gold</button><button class="secondary" id="addSilver" disabled>Add Silver</button></div></div></details>';
 html+='<div class="actions"><button id="previewDraftGold" class="secondary" '+(!gold?'disabled':'')+'>Preview Gold PDF</button><button id="previewDraftSilver" class="secondary" '+(d.length===gold?'disabled':'')+'>Preview Silver PDF</button></div>';
 $('#awardBody').innerHTML=html;$('#confirmAwards').disabled=S.busy||(!c.imported.length&&!S.awards);
 $('#recalc').onclick=()=>{try{const next=readRules();if(S.draftEdited&&!confirm(localText("Replace this draft with calculated winners?")))return;S.rules=next;S.draft=calculateAwards(rows,S.rules);S.draftEdited=false;renderAwardDialog();msg('#awardMessage','Winners recalculated.')}catch(e){msg('#awardMessage',e.message,true)}};
 for(const id of ['goldMin','silverMin','promote'])$('#'+id).onchange=()=>{try{const dirty=!rulesEqual(readRules(),S.rules);$('#confirmAwards').disabled=dirty||S.busy||(!c.imported.length&&!S.awards);msg('#awardMessage',dirty?'Recalculate winners after changing the qualifying rules.':'')}catch(e){$('#confirmAwards').disabled=true;msg('#awardMessage',e.message,true)}};
 $$('[data-award]').forEach(b=>b.onchange=()=>{if(!preserveRules())return;S.draft.find(x=>x.student_id===b.dataset.award).award=b.value;S.draftEdited=true;renderAwardDialog()});
 $$('[data-remove]').forEach(b=>b.onclick=()=>{if(!preserveRules())return;S.draft=S.draft.filter(x=>x.student_id!==b.dataset.remove);S.draftEdited=true;renderAwardDialog()});
 $('#extraClass').onchange=()=>{$('#extraStudent').innerHTML=opt('','Choose student')+rows.filter(x=>x.cls===$('#extraClass').value&&x.score!==null&&!d.some(y=>y.student_id===x.s.id)).map(x=>opt(x.s.id,name(x.s)+' · '+x.score+' pts')).join('');$('#addGold').disabled=true;$('#addSilver').disabled=true};
 $('#extraStudent').onchange=()=>{$('#addGold').disabled=!$('#extraStudent').value;$('#addSilver').disabled=!$('#extraStudent').value};
 const add=award=>{if(!preserveRules())return;const x=rows.find(x=>x.s.id===$('#extraStudent').value);if(x&&x.score!==null&&!S.draft.some(a=>a.student_id===x.s.id)){S.draft.push({student_id:x.s.id,award,class_name:x.cls,points:x.score});S.draftEdited=true;renderAwardDialog()}};
 $('#addGold').onclick=()=>add('Gold');$('#addSilver').onclick=()=>add('Silver');
 $('#previewDraftGold').onclick=()=>{if(preserveRules())certificatePrint('Gold',S.draft,true)};
 $('#previewDraftSilver').onclick=()=>{if(preserveRules())certificatePrint('Silver',S.draft,true)};
}
async function saveAwards(){
 if(S.busy||!preserveRules())return;
 if(!S.draft.length&&!confirm(localText("Confirm an empty awards list?")))return;
 if(awardCoverage().partial&&!confirm(localText("Some reading reports are missing or have different end dates. Confirm these provisional winners anyway?")))return;
 if(S.awards&&!confirm(localText("Replace previously confirmed awards for this month?")))return;
 S.busy=true;$('#confirmAwards').disabled=true;msg('#awardMessage','Saving…');
 try{const d=await api('awards',{month:S.month+'-01',rules:S.rules,recipients:S.draft.map(x=>({student_id:x.student_id,award:x.award}))});S.awards=d.awards;$('#awardDialog').close();renderAwards();msg('#status','Awards confirmed. Prepare Gold and Silver PDFs.')}
 catch(e){msg('#awardMessage',e.message,true)}finally{S.busy=false;$('#confirmAwards').disabled=false}
}
function openAwards(){S.rules=S.awards?.rules?{...S.awards.rules}:{...DEFAULT_AWARD_RULES};S.draft=S.awards&&!awardChanged()?S.awards.recipients.map(x=>({...x})):calculateAwards(ranks(),S.rules);S.draftEdited=false;renderAwardDialog();msg('#awardMessage');$('#awardDialog').showModal()}
async function openAwardHistory(){
 $('#historyBody').innerHTML=empty('Loading…');$('#historyDialog').showModal();
 try{const d=await api('award-history');const entries=d.history||[];$('#historyBody').innerHTML=entries.length?table(['Month','Gold','Silver',''],entries.map(a=>'<tr><td>'+esc(label(a.month.slice(0,7)))+'</td><td>'+a.gold+'</td><td>'+a.silver+'</td><td><button class="secondary" data-history-month="'+esc(a.month.slice(0,7))+'">Open</button></td></tr>')):empty('No confirmed monthly prizes yet.');
 $$('[data-history-month]').forEach(b=>b.onclick=()=>{S.month=b.dataset.historyMonth;$('#month').value=S.month;$('#historyDialog').close();load().catch(()=>{})});
 }catch(e){$('#historyBody').innerHTML=empty(e.message)}
}
function certificatePrint(award,source=null,preview=false){
 const provisional=preview||!S.awards;const rec=awardPeople(source||S.awards?.recipients||calculateAwards(ranks(),DEFAULT_AWARD_RULES)).filter(x=>x.award===award);if(!rec.length)return;
 if(!provisional&&awardChanged())return;
 const month=label(S.month),logo=new URL('/Assets/Images/color-logo.png',location.origin).href;
 const pages=rec.slice().sort((x,y)=>x.class_name.localeCompare(y.class_name)||x.name.localeCompare(y.name)).map(r=>'<section class="certificate"><div class="frame">'+(provisional?'<div class="draft-mark">PREVIEW — NOT CONFIRMED</div>':'')+'<img class="award-logo" src="'+esc(logo)+'" alt="Willena English Academy"><h1>Willena Reading Award</h1><h2>'+award+' Prize</h2><div class="award-text">This prize is awarded for<br><strong>outstanding achievement in Raz-Kids reading</strong><br>for the month of '+esc(month)+'</div><div class="reason">In recognition of dedication and effort in English reading.</div><div class="name-line"><span>Name:</span><span class="name">'+esc(r.name)+(r.korean_name&&r.korean_name!==r.name?'<span class="korean">'+esc(r.korean_name)+'</span>':'')+'</span></div><div class="classline">'+esc(r.class_name)+' Class</div><div class="signature"><span>Teacher’s signature:</span><span class="signature-line"></span></div><div class="teacher-names">Alena Kim &amp; William Gaule</div></div></section>').join('');
 $('#classAwardsPrintOverlay')?.remove();const overlay=document.createElement('div');overlay.id='classAwardsPrintOverlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label',award+' prize certificates');overlay.innerHTML='<div class="award-toolbar"><button id="awardPrintNow">Print / Save '+award+' PDF</button><button id="awardBack">Back to Library</button><div class="award-hint" id="awardPrintHint">'+(provisional?'Preview only — awards not confirmed.':'A4 portrait · one recipient per page · choose Save as PDF')+'</div></div>'+pages;
 const reopen=$('#awardDialog').open;if(reopen)$('#awardDialog').close();document.body.append(overlay);const old=document.title;document.title='Willena Reading '+award+' Prizes '+S.month+(provisional?' - PREVIEW':'');
 const close=()=>{overlay.remove();document.title=old;if(reopen)$('#awardDialog').showModal()};$('#awardBack').onclick=close;$('#awardPrintNow').onclick=()=>window.print();overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 for(const img of overlay.querySelectorAll('.award-logo')){const warn=()=>{$('#awardPrintHint').textContent='Logo failed to load. Return and retry before printing.'};img.addEventListener('error',warn,{once:true});if(img.complete&&!img.naturalWidth)warn()}
 $('#awardPrintNow').focus();
}
function setupQuickUpload(){
 const panel=$('#reportUploadPanel'),drop=$('#quickDrop'),picker=$('#quickCsv'),button=$('#upload');
 const choose=()=>{if(!button.disabled&&!S.busy){picker.value='';picker.click()}};
 button.onclick=choose;drop.onclick=choose;
 async function reviewFiles(files){if(!files.length||button.disabled||S.busy)return;S.files=[];renderImport();msg('#importMessage');$('#importDialog').showModal();await addFiles(files)}
 picker.onchange=()=>{const files=[...picker.files];picker.value='';reviewFiles(files)};
 let depth=0;
 const isFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
 const clear=()=>{depth=0;panel.classList.remove('file-dragging')};
 panel.addEventListener('dragenter',e=>{if(!isFiles(e))return;e.preventDefault();if(!button.disabled&&!S.busy){depth++;panel.classList.add('file-dragging')}});
 panel.addEventListener('dragover',e=>{if(!isFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect=button.disabled||S.busy?'none':'copy'});
 panel.addEventListener('dragleave',e=>{if(!isFiles(e))return;depth=Math.max(0,depth-1);if(!depth)clear()});
 panel.addEventListener('drop',e=>{if(!isFiles(e)&&!e.dataTransfer?.files?.length)return;e.preventDefault();clear();reviewFiles([...e.dataTransfer.files])});
 window.addEventListener('dragend',clear);
}

async function boot(){$('#retry').hidden=true;$('#bootText').textContent='Checking staff login…';try{const u=await ensureTeacherSession();if(!u?.success){if(u?.temporary)throw Error('Unable to verify login. Retry.');sessionStorage.setItem('teacher:returnTo','/Teachers/library/');location.replace('/Teachers/login.html');return}ensureAuthRefresh();const header=await mountTeacherHeader({target:'#teacher-header',mode:'dashboard',activeApp:'library'});mountLibraryLanguage(header.root);$('#month').value=S.month;await ensureSetup();initRegisterTabs();$('#boot').hidden=true;$('#app').hidden=false;load().catch(()=>{})}catch(e){$('#bootText').textContent=e.message;$('#retry').hidden=false}}

let activeLibraryTab='today',lastRegisterTab='today',navigationRequest=0;
function initRegisterTabs(){
 if(dailyRegister)return;
 const shell=$('#app'),toggle=$('#libraryRailToggle');
 let expanded=false;try{expanded=localStorage.getItem('willena.library.sidebarExpanded')==='1'}catch{}
 const setExpanded=value=>{expanded=value;shell.classList.toggle('sidebar-expanded',value);toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-label',value?'Collapse sidebar':'Expand sidebar');try{localStorage.setItem('willena.library.sidebarExpanded',value?'1':'0')}catch{}};
 setExpanded(expanded);toggle.onclick=()=>setExpanded(!expanded);
 dailyRegister=mountDailyRegister({root:$('#todayView'),api,getStudents:()=>S.students});
 const monthlyRegister=mountMonthlyRegister({root:$('#monthlyView'),api,getStudents:()=>S.students,openDay:(date,className)=>switchTab('today',{date,className})});
 async function switchTab(tab,target){
  if(!['today','monthly','raz'].includes(tab))return;
  const token=++navigationRequest;
  // Flush unsaved daily changes, but never lock navigation on a view's data fetch.
  if(activeLibraryTab==='today'&&tab!=='today'){
   const safe=await dailyRegister.hide();if(!safe||token!==navigationRequest)return;
  }
  activeLibraryTab=tab;if(tab!=='raz')lastRegisterTab=tab;$('#libraryTimeView').hidden=tab==='raz';$('#todayView').hidden=tab!=='today';$('#monthlyView').hidden=tab!=='monthly';$('#razView').hidden=tab!=='raz';
  $$('[data-library-section]').forEach(b=>{const active=b.dataset.librarySection===(tab==='raz'?'raz':'register');b.setAttribute('aria-selected',String(active));b.classList.toggle('active',active)});
  $$('[data-library-tab]').forEach(b=>{const active=b.dataset.libraryTab===lastRegisterTab;b.setAttribute('aria-selected',String(active));b.classList.toggle('active',active)});
  try{localStorage.setItem('willena.library.tab',tab);localStorage.setItem('willena.library.registerTab',lastRegisterTab)}catch{}
  try{if(tab==='today')await dailyRegister.show(target);if(tab==='monthly')await monthlyRegister.show()}catch(e){console.error('Library view could not load',e);if(token===navigationRequest){const id=tab==='today'?'#registerStatus':tab==='monthly'?'#registerMonthStatus':'#status';msg(id,e.message||'Could not load the register.',true)}}
 }
 $$('[data-library-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.libraryTab));
 $$('[data-library-section]').forEach(b=>b.onclick=()=>switchTab(b.dataset.librarySection==='raz'?'raz':lastRegisterTab));
 let initial='today';try{const saved=localStorage.getItem('willena.library.tab'),sub=localStorage.getItem('willena.library.registerTab');if(['today','monthly'].includes(sub))lastRegisterTab=sub;if(['today','monthly','raz'].includes(saved))initial=saved}catch{}
 switchTab(initial);
}

initLibraryLanguage();$('#confirmImport').onclick=saveImport;$('#manageAccounts').onclick=openAccountList;$('#accountSearch').oninput=renderAccountList;$('#accountSource').onchange=renderAccountList;$('#retry').onclick=boot;$('#month').onchange=()=>{if(!$('#month').value)return;S.month=$('#month').value;load().catch(()=>{})};$('#class').onchange=renderResults;$('#search').oninput=renderResults;setupQuickUpload();$('#prepare').onclick=openAwards;$('#confirmAwards').onclick=saveAwards;$('#awardHistory').onclick=openAwardHistory;$('#goldPDF').onclick=()=>certificatePrint('Gold');$('#silverPDF').onclick=()=>certificatePrint('Silver');$$('[data-close]').forEach(b=>b.onclick=()=>{if(!S.busy&&!S.parsing)$('#'+b.dataset.close).close()});['importDialog','awardDialog','accountDialog','historyDialog'].forEach(id=>$('#'+id).addEventListener('cancel',e=>{if(S.busy||S.parsing)e.preventDefault()}));boot();
