/* Shared unread-completion state: sidebar, class buttons, and existing homework cards. */
(()=>{'use strict';
 const state={items:new Map(),reviewed:new Set(),ready:false,refreshing:false,complete:false};
 const api=()=>window.WillenaHomeworkNotificationAPI;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pending=()=>[...state.items.values()].filter(x=>!state.reviewed.has(x.key));
 const badge=(node,count,nav=false)=>{if(!node)return;let b=node.querySelector(':scope > .whn-badge');if(!count){b?.remove();return}if(!b){b=document.createElement('span');b.className='whn-badge'+(nav?' whn-nav-badge':'');b.setAttribute('aria-label','Unread homework completions');node.appendChild(b)}{const label=count>99?'99+':String(count);if(b.textContent!==label)b.textContent=label}};
 function render(){
  const unread=pending(),byClass=new Map(),byAssignment=new Map();
  for(const x of unread){const cls=x.className.trim().toLowerCase();byClass.set(cls,(byClass.get(cls)||0)+1);byAssignment.set(x.assignmentId,(byAssignment.get(x.assignmentId)||[]).concat(x));}
  document.querySelectorAll('.rail .nav[data-view="assignments"],.mobile-tabs .mobile-tab[data-view="assignments"]').forEach(el=>badge(el,unread.length,true));
  document.querySelectorAll('.cc-assignment-class-tabs [data-cc-switch-class]').forEach(el=>badge(el,byClass.get((el.dataset.ccSwitchClass||'').trim().toLowerCase())||0));
  document.querySelectorAll('[data-genius-card^="class-mission-"]').forEach(card=>{
   const assignmentId=card.dataset.geniusCard.slice('class-mission-'.length),items=byAssignment.get(assignmentId)||[];
   const details=card.querySelector('.ghc-details'),summary=details?.querySelector('summary');
   if(!details||!summary)return;
   badge(summary,items.length);
   // The student progress dropdown is the acknowledgement action, not card viewing.
   // Keep the listener attached to this details element through ordinary badge redraws.
   if(!details.dataset.whnBound){
    details.dataset.whnBound='1';
    details.addEventListener('toggle',()=>{
     if(!details.open)return;
     const unread=pending().filter(x=>x.assignmentId===assignmentId);
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
  render();
  if(failed)console.warn('[Homework Notifications] '+failed+' completion acknowledgement(s) could not be saved');
 }
 async function sync(){try{const rows=await api().list();state.reviewed=new Set((rows||[]).map(r=>r.completion_key));state.ready=true;render()}catch(error){console.warn('[Homework Notifications] Acknowledgements unavailable',error)}}
 function receive(items,{complete=false,errors=[]}={}){if(!Array.isArray(items))return;if(complete){if(errors.length){console.warn('[Homework Notifications] Incomplete progress snapshot',errors);return}state.items.clear();state.complete=true}for(const item of items){if(item.key&&item.assignmentId&&item.studentId)state.items.set(item.key,item)}render()}
 async function refresh(){if(state.refreshing)return;state.refreshing=true;try{await sync();await window.UniversalAssignmentTracker?.loadCompletionSnapshot?.()}catch(error){console.warn('[Homework Notifications] Refresh failed',error)}finally{state.refreshing=false}}
 const observer=new MutationObserver(()=>{if(state.items.size)requestAnimationFrame(render)});
 function start(){observer.observe(document.body,{subtree:true,childList:true});void refresh();setInterval(()=>{if(!document.hidden)void refresh()},90000);window.addEventListener('focus',()=>void refresh())}
 window.WillenaHomeworkNotifications={receive,refresh,render};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();