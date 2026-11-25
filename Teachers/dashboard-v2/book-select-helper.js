/* Shared, class-aware book dropdown for Genius assignment forms. */
(()=>{'use strict';
const API='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
async function assigned(className){
 if(!className)return new Set();
 const token=window.WillenaAPI?.getLocalAccessToken?.();
 if(!token)throw Error('Teacher login unavailable');
 const response=await fetch(API+'rpc/teacher_assigned_books_for_class_v1',{
  method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({p_class:className}),cache:'no-store'
 });
 if(!response.ok)throw Error('Assigned book lookup failed ('+response.status+')');
 const rows=await response.json();
 return new Set((Array.isArray(rows)?rows:[]).map(row=>String(row.id)));
}
function bind({classSelect,bookSelect,books,onChange}){
 if(!classSelect||!bookSelect)return;
 const list=()=>typeof books==='function'?books():books||[];
 let epoch=0,allMode=false,assignedIds=new Set();
 const draw=()=>{
  const previous=bookSelect.value;
  bookSelect.replaceChildren(new Option('Choose a textbook',''));
  const available=list().filter(x=>x?.id);
  if(!available.length)return;
  const preferred=available.filter(x=>assignedIds.has(String(x.id)));
  const shown=allMode?available:preferred;
  for(const b of shown)bookSelect.add(new Option(b.title||b.name||'Textbook',b.id));
  if(!allMode)bookSelect.add(new Option('Other book — browse all textbooks','__other__'));
  if(shown.some(x=>String(x.id)===previous))bookSelect.value=previous;
  else bookSelect.value='';
  if(previous&&!bookSelect.value)onChange?.();
 };
 const refresh=async()=>{
  const n=++epoch;allMode=false;assignedIds=new Set();
  try{const found=await assigned(classSelect.value);if(n!==epoch)return;assignedIds=found}
  catch(e){console.warn('[Genius book selector]',e)}
  if(n===epoch)draw();
 };
 bookSelect.addEventListener('change',()=>{
  if(bookSelect.value!=='__other__')return;
  allMode=true;draw();
 });
 classSelect.addEventListener('change',refresh);
 void refresh();
 return {refresh,redraw:draw};
}
window.WillenaGeniusBooks={bind};
})();