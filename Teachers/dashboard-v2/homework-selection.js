/* Shared assignment cancellation and multi-select controls for Genius manage cards.
   Reuses the same check/X control pattern as My / All. No history is deleted. */
(()=>{'use strict';
const SUPA='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const icons={
 cancel:'<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 complete:'<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>'
};
function currentTeacher(){
 const t=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
 try{return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub||''}catch{return''}
}
async function cancelAssignment(table,id){
 const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
 if(!token)throw Error('Please sign in again');
 const changes=table==='homework_assignments'
  ?{active:false,status:'ended',ended_at:new Date().toISOString()}
  :table==='grammar_foundation_homework'
  ?{active:false,closed_at:new Date().toISOString()}
  :{active:false};
 const response=await fetch(SUPA+table+'?id=eq.'+encodeURIComponent(id),{
  method:'PATCH',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(changes),cache:'no-store'
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.message||data?.error||'Cancel failed ('+response.status+')');
 if(!Array.isArray(data)||data.length!==1)throw Error('Cancellation not confirmed');
 return data[0];
}
function tableFor(list){
 const root=list.closest('#universalAssignments');
 if(!root)return null;
 const active=root.querySelector('[data-ua-tab].active')?.dataset.uaTab||'';
 if(active==='grammar')return list.closest('#gfLegacyHomework')?'grammar_foundation_homework':'homework_assignments';
 if(active==='sentence')return 'sentence_genius_homework';
 if(['word','writing','puzzles'].includes(active))return 'homework_assignments';
 return null;
}
function mount(list, explicitTable){
 // No cancel controls for history/closed assignments.
 const grammarHistory=list.closest('#gfBooksHomework')?.querySelector('[data-gb-stage="history"].active');
 const foundationHistory=list.closest('#gfLegacyHomework')?.querySelector('[data-gf-filter="history"].active');
 const creativeHistory=list.closest('.ua-genius-manage')?.querySelector('[data-period="history"].active');
 const wordHistory=list.id==='assignmentList'&&!!list.querySelector('#assignmentRestoreSelected');
 if(grammarHistory||foundationHistory||creativeHistory||wordHistory){
  // History uses its own restore checkboxes, not the active-assignment cancel controls.
  if(list.previousElementSibling?.classList.contains('hw-select-toolbar'))list.previousElementSibling.remove();
  delete list.dataset.hwManageControls;
  return;
 }
 const table=explicitTable||tableFor(list);
 if(!table)return;
 // A list may be redrawn without replacing its container; rebuild controls with its cards.
 if(list.dataset.hwManageControls===table && list.querySelector('.hw-card-select'))return;
 if(list.previousElementSibling?.classList.contains('hw-select-toolbar'))list.previousElementSibling.remove();
 delete list.dataset.hwManageControls;
 const cards=[...list.querySelectorAll('.genius-homework-card[data-genius-card]')];
 if(!cards.length)return;
 const identity=currentTeacher();
 if(!identity)return;
 const owned=cards.filter(card=>card.querySelector('[data-ghc-teacher]')?.dataset.ghcTeacher===identity);
 if(!owned.length)return;
 const toolbar=document.createElement('div');toolbar.className='hw-select-toolbar';
 toolbar.innerHTML='<label class="hw-select-all"><input type="checkbox" aria-label="Select all assignments"> Select all</label>'+
 '<button class="hw-select-cancel" type="button" disabled aria-label="Cancel selected assignments" title="Cancel selected assignments">'+icons.cancel+' <span>0</span></button>'+
 '<span class="hw-select-status" role="status" aria-live="polite"></span>';
 list.before(toolbar);
 const selected=new Set();
 const all=toolbar.querySelector('input'),bulk=toolbar.querySelector('button'),status=toolbar.querySelector('.hw-select-status');
 const refresh=()=>{
  const available=owned.filter(card=>card.isConnected);
  const chosen=available.filter(card=>selected.has(card.dataset.geniusCard));
  bulk.disabled=!chosen.length;bulk.querySelector('span').textContent=String(chosen.length);
  all.checked=available.length>0&&chosen.length===available.length;
  all.indeterminate=chosen.length>0&&chosen.length<available.length;
 };
 async function cancel(ids){
  if(!ids.length||!confirm('Cancel '+ids.length+' selected assignment'+(ids.length===1?'':'s')+'? Students will no longer see them; saved results stay intact.'))return;
  bulk.disabled=true;all.disabled=true;status.textContent='Cancelling '+ids.length+'…';
  let succeeded=0;const failed=[];
  for(const id of ids){
   try{
    await cancelAssignment(table,id);
    const card=owned.find(c=>c.dataset.geniusCard===id);
    if(card){card.remove();succeeded++}
    selected.delete(id);
   }catch(error){failed.push(error.message)}
  }
  all.disabled=false;refresh();
  status.textContent=succeeded+' cancelled'+(failed.length?'; '+failed.length+' failed: '+failed[0]:'');
  if(!list.querySelector('.genius-homework-card'))list.innerHTML='<p class="ua-empty">No active assignments.</p>';
  window.dispatchEvent(new CustomEvent('willena:assignment-cancelled',{detail:{table,count:succeeded}}));
 }
 for(const card of owned){
  const id=card.dataset.geniusCard;
  const row=document.createElement('div');row.className='hw-card-select';
  row.innerHTML='<label><input type="checkbox" aria-label="Select this assignment"> Select</label>'+
   '<button type="button" title="Cancel assignment" aria-label="Cancel assignment">'+icons.cancel+'</button>';
  card.prepend(row);
  const input=row.querySelector('input'),btn=row.querySelector('button');
  input.addEventListener('change',()=>{if(input.checked)selected.add(id);else selected.delete(id);refresh()});
  btn.addEventListener('click',()=>cancel([id]));
 }
 all.addEventListener('change',()=>{for(const card of owned)if(card.isConnected){
  const input=card.querySelector('.hw-card-select input');if(input)input.checked=all.checked;
  if(all.checked)selected.add(card.dataset.geniusCard);else selected.delete(card.dataset.geniusCard);
 }refresh()});
 bulk.addEventListener('click',()=>cancel([...selected]));
 list.dataset.hwManageControls=table;
 refresh();
}
function scan(){
 document.querySelectorAll('#universalAssignments .ua-genius-manage-list').forEach(list=>mount(list));
}

const style=document.createElement('style');style.textContent=`
.hw-select-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 12px;background:#fff;border:1px solid #dce8eb;border-radius:12px;margin:0 0 10px}
.hw-select-all,.hw-card-select label{display:inline-flex;align-items:center;gap:6px;color:#34515c;font-size:13px;font-weight:700;cursor:pointer}
.hw-select-cancel,.hw-card-select button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:38px;min-height:36px;background:#fff;border:1.5px solid #e2b4c7;border-radius:9px;color:#b25b74;cursor:pointer}
.hw-select-cancel:disabled{opacity:.4;cursor:not-allowed}
.hw-select-cancel span{font-variant-numeric:tabular-nums;font-size:12px;font-weight:800}
.hw-select-status{flex:1;color:#536976;font-size:12px}
.hw-card-select{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 8px}
.hw-card-select input,.hw-select-all input{width:17px;height:17px;accent-color:#39b6c5}
`;
document.head.append(style);
function boot(){
 const host=document.getElementById('universalAssignments');if(!host)return;
 const observer=new MutationObserver(()=>scan());
 observer.observe(host,{subtree:true,childList:true});
 scan();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.WillenaHomeworkSelection={icons,cancelAssignment,mount};
})();