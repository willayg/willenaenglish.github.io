/* Grammar Foundations homework. Existing stage progress remains the sole scoring source. */
(()=>{'use strict';
const OP='https://fiieuiktlsivwfgyivai.supabase.co',KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CATALOG='https://gxwfsqxyuufqtitspfqg.supabase.co/functions/v1/grammar-foundations-catalog';
const EDGE=OP+'/functions/v1/grammar-foundations-teacher-v1';
const $=(s,r=document)=>r.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={catalog:null,classes:null,items:[],mode:'manage',filter:'current',loading:false,details:new Map()};
const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
async function refreshToken(){const r=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh'):fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include'}));const d=await r.json();if(!r.ok||!d.access_token)throw Error('Please sign in again');window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token}
async function request(url,options={}){
 let access=token()||await refreshToken();
 async function run(t){return fetch(url,{...options,headers:{apikey:KEY,Authorization:'Bearer '+t,...options.headers},cache:'no-store'})}
 let r=await run(access);if(r.status===401){access=await refreshToken();r=await run(access)}
 const body=await r.json().catch(()=>({}));if(!r.ok)throw Error(body?.message||body?.error||'Request failed ('+r.status+')');return body;
}
const table=(q='')=>request(OP+'/rest/v1/grammar_foundation_homework'+q);
const api=(path,opts)=>request(OP+'/rest/v1/'+path,opts);
const title=m=>m.koreanTitle||m.title||m.englishTitle||m.id;
const stitle=s=>s.koreanTitle||s.title||s.englishTitle||'Level '+s.number;
function message(t,warning=false){const node=$('#gfHwMessage');if(node){node.textContent=t;node.classList.toggle('gf-hw-error',warning)}}
async function catalog(){if(state.catalog)return state.catalog;const r=await fetch(CATALOG+'?_='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Grammar catalog unavailable');const d=await r.json();state.catalog=Array.isArray(d.sets)?d.sets:[];return state.catalog}
async function classes(){
 if(state.classes)return state.classes;
 try{const d=await request(EDGE+'?action=students&_='+Date.now());const c=[...new Set((d.students||[]).filter(s=>s.class&&String(s.class).toLowerCase()!=='test').map(s=>String(s.class)))];if(c.length)return state.classes=c.sort()}catch(e){console.warn('[Grammar homework] student class lookup',e)}
 const rows=await api('classes?select=name&status=eq.active&order=sort_order.asc');
 state.classes=[...new Set(rows.map(c=>c.name).filter(Boolean))];return state.classes;
}
function root(){return $('#uaGrammarHomework')}
async function mount(sub){
 state.mode=sub;state.details.clear();const el=root();if(!el)return;
 el.innerHTML='<div class="gf-hw-loading">Loading Grammar Foundations homework…</div>';
 try{if(sub==='create')await renderCreate();else await renderManage()}catch(e){if(root())root().innerHTML='<div class="gf-hw-error">Could not load assignments: '+esc(e.message)+'</div>'}
}
async function renderCreate(){
 const [mods,names]=await Promise.all([catalog(),classes()]);const el=root();if(!el||state.mode!=='create')return;
 el.innerHTML='<form id="gfHwForm" class="gf-hw-form"><div class="gf-hw-form-grid"><label>Class<select required id="gfHwClass" class="control"><option value="">Choose class</option>'+names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('')+'</select></label><label>Completion requirement<select id="gfHwGoal" class="control"><option value="80">Pass · 80%</option><option value="100">Gold · 100%</option></select></label><label>Due date<input required type="date" id="gfHwDue" class="control"></label></div><div class="gf-hw-picker-top"><div><strong>Select grammar points and levels</strong><small>Each selected level becomes a separate student homework item.</small></div><span id="gfHwSelected">0 selected</span></div><div class="gf-hw-modules">'+mods.map(m=>'<fieldset class="gf-hw-module"><legend>'+esc(title(m))+' <small>'+esc(m.englishTitle||'')+'</small></legend><label class="gf-hw-all"><input type="checkbox" data-all="'+esc(m.id)+'"> All levels</label><div class="gf-hw-levels">'+(m.stages||[]).map(s=>'<label><input type="checkbox" data-stage="'+esc(s.id)+'" data-module="'+esc(m.id)+'"><span>Level '+esc(s.number)+' · '+esc(stitle(s))+'</span></label>').join('')+'</div></fieldset>').join('')+'</div><div class="gf-hw-footer"><button type="submit" id="gfHwSubmit" class="control ua-primary">Assign selected levels →</button><span id="gfHwMessage" role="status"></span></div></form>';
 const d=new Date(Date.now()+7*864e5);$('#gfHwDue',el).value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const count=()=>{$('#gfHwSelected',el).textContent=el.querySelectorAll('[data-stage]:checked').length+' selected'};
 el.querySelectorAll('[data-all]').forEach(x=>x.onchange=()=>{el.querySelectorAll('[data-module="'+CSS.escape(x.dataset.all)+'"]').forEach(y=>y.checked=x.checked);count()});
 el.querySelectorAll('[data-stage]').forEach(x=>x.onchange=()=>{const all=el.querySelector('[data-all="'+CSS.escape(x.dataset.module)+'"]');const children=[...el.querySelectorAll('[data-module="'+CSS.escape(x.dataset.module)+'"]')];if(all)all.checked=children.every(c=>c.checked);count()});
 $('#gfHwForm',el).onsubmit=submit;
}
async function submit(e){
 e.preventDefault();if(state.loading)return;
 const el=root(),names=await catalog(),klass=$('#gfHwClass',el).value,goal=Number($('#gfHwGoal',el).value),date=$('#gfHwDue',el).value;
 const chosen=[...el.querySelectorAll('[data-stage]:checked')].map(input=>{const m=names.find(x=>String(x.id)===input.dataset.module),s=m?.stages?.find(x=>String(x.id)===input.dataset.stage);return m&&s?{m,s}:null}).filter(Boolean);
 if(!klass||!date||!chosen.length){message('Choose a class, due date, and at least one level.',true);return}
 state.loading=true;$('#gfHwSubmit',el).disabled=true;message('Creating '+chosen.length+' level assignments…');
 try{
  const batch=crypto.randomUUID(),due_at=new Date(date+'T23:59:59').toISOString();
  const creator=jwtUserId(token());if(!creator)throw Error('Teacher session is unavailable');
  const rows=chosen.map(({m,s})=>({batch_id:batch,class_name:klass,module_id:String(m.id),stage_id:String(s.id),module_title:title(m),stage_title:stitle(s),completion_percent:goal,due_at,created_by:creator}));
  const saved=await table('',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(rows)});
  message('Created '+saved.length+' separate homework items for '+klass+'.');
  el.querySelectorAll('[data-stage],[data-all]').forEach(x=>x.checked=false);$('#gfHwSelected',el).textContent='0 selected';
 }catch(error){message('Could not assign: '+error.message,true)}finally{state.loading=false;$('#gfHwSubmit',el).disabled=false}
}
function jwtUserId(t){try{const part=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(part)).sub||''}catch{return''}}
async function renderManage(){
 const el=root();if(!el)return;
 state.items=await table('?select=*&order=created_at.desc&limit=1000');
 if(!root()||state.mode!=='manage')return;
 paintManage();
}
function paintManage(){
 const el=root();if(!el)return;
 const entries=state.items.filter(a=>state.filter==='history'?!a.active:a.active);
 const groups=new Map();entries.forEach(a=>{const id=a.batch_id||a.id;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(a)});
 el.innerHTML='<div class="gf-hw-toolbar"><div class="assignment-status-tabs"><button type="button" class="assignment-status-tab'+(state.filter==='current'?' active':'')+'" data-gf-filter="current">Current</button><button type="button" class="assignment-status-tab'+(state.filter==='history'?' active':'')+'" data-gf-filter="history">History</button></div><button class="control" id="gfHwRefresh" type="button">Refresh</button></div><div class="gf-hw-groups">'+([...groups.values()].map(rows=>{const first=rows[0];return '<section class="gf-hw-group"><header><div><strong>'+esc(first.class_name)+' · '+esc(rows.length===1?first.module_title:'Grammar Foundations')+'</strong><small>Due '+esc(new Date(first.due_at).toLocaleDateString())+' · '+esc(first.completion_percent)+'% required · '+rows.length+' level(s)</small></div></header><div class="gf-hw-group-items">'+rows.map(a=>'<div class="gf-hw-assignment"><button type="button" class="gf-hw-row" data-progress="'+esc(a.id)+'"><span><b>'+esc(a.module_title)+'</b><small>'+esc(a.stage_title)+'</small></span><span>View progress →</span></button><div id="gfHwDetail-'+esc(a.id)+'"></div></div>').join('')+'</div><div class="gf-hw-group-actions"><button type="button" class="control" data-toggle-batch="'+esc(first.batch_id)+'" data-active="'+(!first.active)+'">'+(first.active?'Close homework':'Reopen homework')+'</button></div></section>'}).join('')||'<div class="ua-empty">No '+(state.filter==='current'?'current':'past')+' Grammar Foundations assignments.</div>')+'</div>';
 el.querySelectorAll('[data-gf-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.gfFilter;paintManage()});
 $('#gfHwRefresh',el).onclick=()=>mount('manage');
 el.querySelectorAll('[data-progress]').forEach(b=>b.onclick=()=>showProgress(b.dataset.progress));
 el.querySelectorAll('[data-toggle-batch]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await table('?batch_id=eq.'+encodeURIComponent(b.dataset.toggleBatch),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:b.dataset.active==='true',closed_at:b.dataset.active==='true'?null:new Date().toISOString()})});await renderManage()}catch(e){alert('Unable to update homework: '+e.message);b.disabled=false}});
}
async function showProgress(id){
 const el=document.getElementById('gfHwDetail-'+id);if(!el)return;
 if(el.dataset.open==='yes'){el.innerHTML='';el.dataset.open='';return}
 el.innerHTML='<div class="gf-hw-loading">Loading student progress…</div>';el.dataset.open='yes';
 try{const data=await request(OP+'/rest/v1/rpc/gf_hw_progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_assignment_id:id})});
 if(!el.isConnected)return;
 el.innerHTML='<div class="gf-hw-progress-summary">'+data.completed+'/'+data.total+' students completed</div><div class="gf-hw-students">'+(data.students||[]).map(st=>'<div class="gf-hw-student"><span>'+esc(st.korean_name||st.name||'Student')+'</span><span>'+esc(st.attempts?'Best '+st.best_score+'/'+st.total:'Not started')+'</span><strong class="'+(st.complete?'gf-hw-done':'')+'">'+(st.complete?'Complete':esc(st.percent)+'%')+'</strong></div>').join('')+'</div>';
 }catch(e){el.innerHTML='<div class="gf-hw-error">'+esc(e.message)+'</div>'}
}
window.addEventListener('ua:grammar-mounted',e=>{void mount(e.detail?.sub||'manage')});
})();
