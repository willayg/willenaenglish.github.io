/* Shared unread-completion state: sidebar, class buttons, and existing homework cards. */
(()=>{'use strict';
 const state={items:new Map(),reviewed:new Set(),ready:false,refreshing:false,complete:false,teacherId:null};
 const api=()=>window.WillenaHomeworkNotificationAPI;
 const highlighted=new WeakMap();
 function paint(details,ids){details.querySelectorAll('.ghc-student-row').forEach(row=>{const id=row.querySelector('[data-jelly-id]')?.dataset.jellyId;row.classList.toggle('whn-new-student',Boolean(id&&ids.has(id)))});}
 function clearHighlights(details){highlighted.delete(details);paint(details,new Set())}
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pending=()=>[...state.items.values()].filter(x=>!state.reviewed.has(x.key));
 // The header bell consumes this same per-teacher unread state. It never
 // acknowledges items merely because the bell was opened.
 const ownUnread=()=>!state.ready||!state.teacherId?null:
  pending().filter(x=>String(x.createdBy)===String(state.teacherId));
 const notifyBell=()=>window.dispatchEvent(new CustomEvent('willena:teacher-homework-unread-change',{
  detail:{teacherId:state.teacherId,items:ownUnread()}
 }));

 const badge=(node,count,nav=false,tone='red')=>{if(!node)return;let b=[...node.children].find(el=>el.classList?.contains('whn-badge')&&el.dataset.whnTone===tone);if(!count){b?.remove();return}if(!b){b=document.createElement('span');b.className='whn-badge whn-'+tone+(nav?' whn-nav-badge':'');b.dataset.whnTone=tone;b.setAttribute('aria-label','Unread homework completions');node.appendChild(b)}{const label=count>99?'99+':String(count);if(b.textContent!==label)b.textContent=label}};
 function render(){
  const unread=pending(),byClass=new Map(),byAssignment=new Map();
  const counts=(items)=>({red:items.filter(x=>x.createdBy===state.teacherId).length,amber:items.filter(x=>x.createdBy!==state.teacherId).length});
  for(const x of unread){const cls=x.className.trim().toLowerCase();byClass.set(cls,(byClass.get(cls)||[]).concat(x));byAssignment.set(x.assignmentId,(byAssignment.get(x.assignmentId)||[]).concat(x));}
  const paintBadges=(el,items,nav=false)=>{const n=counts(items);badge(el,n.red,nav,'red');badge(el,n.amber,nav,'amber')};
  document.querySelectorAll('.rail .nav[data-view="assignments"],.mobile-tabs .mobile-tab[data-view="assignments"]').forEach(el=>paintBadges(el,unread,true));
  document.querySelectorAll('.cc-assignment-class-tabs [data-cc-switch-class]').forEach(el=>paintBadges(el,byClass.get((el.dataset.ccSwitchClass||'').trim().toLowerCase())||[]));
  document.querySelectorAll('[data-genius-card^="class-mission-"]').forEach(card=>{
   const assignmentId=card.dataset.geniusCard.slice('class-mission-'.length),items=byAssignment.get(assignmentId)||[];
   const details=card.querySelector('.ghc-details'),summary=details?.querySelector('summary');
   if(!details||!summary)return;
   paintBadges(summary,items);
   if(details.open&&highlighted.has(details))paint(details,highlighted.get(details));
   // The student progress dropdown is the acknowledgement action, not card viewing.
   // Keep the listener attached to this details element through ordinary badge redraws.
   if(!details.dataset.whnBound){
    details.dataset.whnBound='1';
    details.addEventListener('toggle',()=>{
     if(!details.open){clearHighlights(details);return;}
     const unread=pending().filter(x=>x.assignmentId===assignmentId);
     const ids=new Set(unread.map(x=>String(x.studentId)));
     highlighted.set(details,ids);
     paint(details,ids);
     if(unread.length)void acknowledgeMany(unread);
    });
   }
   // Remove the previous review panel, including any old Mark reviewed controls.
   card.querySelector(':scope > .whn-review-panel')?.remove();
  });
 }
 async function acknowledgeMany(entries){
  if(!entries.length)return;
  // Persist every student's acknowledgement independently; a failed write remains unread.
  const outcomes=await Promise.allSettled(entries.map(entry=>api().acknowledge(entry)));
  let failed=0;
  outcomes.forEach((outcome,index)=>{if(outcome.status==='fulfilled')state.reviewed.add(entries[index].key);else{failed++;console.warn('[Homework Notifications] Save failed',outcome.reason)}});
  render();notifyBell();
  if(failed)console.warn('[Homework Notifications] '+failed+' completion acknowledgement(s) could not be saved');
 }
 async function sync(){try{state.teacherId=await api().identity();const rows=await api().list();state.reviewed=new Set((rows||[]).map(r=>r.completion_key));state.ready=true;render();notifyBell()}catch(error){console.warn('[Homework Notifications] Acknowledgements unavailable',error)}}
 function receive(items,{complete=false,errors=[]}={}){if(!Array.isArray(items))return;if(complete){if(errors.length){console.warn('[Homework Notifications] Incomplete progress snapshot',errors);return}state.items.clear();state.complete=true}for(const item of items){if(item.key&&item.assignmentId&&item.studentId)state.items.set(item.key,item)}render();notifyBell()}
 async function refresh(){if(state.refreshing)return;state.refreshing=true;try{await sync();await window.UniversalAssignmentTracker?.loadCompletionSnapshot?.()}catch(error){console.warn('[Homework Notifications] Refresh failed',error)}finally{state.refreshing=false}}
 const observer=new MutationObserver(()=>{if(state.items.size)requestAnimationFrame(render)});
 function start(){observer.observe(document.body,{subtree:true,childList:true});void refresh();setInterval(()=>{if(!document.hidden)void refresh()},90000);window.addEventListener('focus',()=>void refresh())}
 window.WillenaHomeworkNotifications={receive,refresh,render,getOwnUnread:ownUnread};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();