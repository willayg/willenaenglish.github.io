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
  document.querySelectorAll('[id^="class-mission-"]').forEach(card=>{
   const assignmentId=card.id.slice('class-mission-'.length),items=byAssignment.get(assignmentId)||[];
   badge(card.querySelector('.ghc-class')||card.querySelector('.ghc-task')||card,items.length);
   let panel=card.querySelector(':scope > .whn-review-panel');
   if(!items.length){panel?.remove();return}
   const signature=items.map(x=>x.key).sort().join('|');if(panel?.dataset.signature===signature)return;
   if(!panel){panel=document.createElement('div');panel.className='whn-review-panel';card.appendChild(panel)}panel.dataset.signature=signature;
   panel.innerHTML='<div class="whn-review-title">'+items.length+' finished homework '+(items.length===1?'submission':'submissions')+' to review</div>'+items.map(x=>'<div class="whn-review-row"><span>'+esc(x.studentName||'Student')+'</span><button type="button" data-whn-ack="'+esc(x.key)+'">Mark reviewed</button></div>').join('');
   panel.querySelectorAll('[data-whn-ack]').forEach(button=>button.addEventListener('click',()=>acknowledge(button.dataset.whnAck,button)));
  });
 }
 async function acknowledge(key,button){const entry=state.items.get(key);if(!entry||state.reviewed.has(key))return;button.disabled=true;try{await api().acknowledge(entry);state.reviewed.add(key);render()}catch(error){button.disabled=false;console.warn('[Homework Notifications] Review failed',error);alert('Could not save homework review. Please try again.')}}
 async function sync(){try{const rows=await api().list();state.reviewed=new Set((rows||[]).map(r=>r.completion_key));state.ready=true;render()}catch(error){console.warn('[Homework Notifications] Acknowledgements unavailable',error)}}
 function receive(items,{complete=false,errors=[]}={}){if(!Array.isArray(items))return;if(complete){if(errors.length){console.warn('[Homework Notifications] Incomplete progress snapshot',errors);return}state.items.clear();state.complete=true}for(const item of items){if(item.key&&item.assignmentId&&item.studentId)state.items.set(item.key,item)}render()}
 async function refresh(){if(state.refreshing)return;state.refreshing=true;try{await sync();await window.UniversalAssignmentTracker?.loadCompletionSnapshot?.()}catch(error){console.warn('[Homework Notifications] Refresh failed',error)}finally{state.refreshing=false}}
 const observer=new MutationObserver(()=>{if(state.items.size)requestAnimationFrame(render)});
 function start(){observer.observe(document.body,{subtree:true,childList:true});void refresh();setInterval(()=>{if(!document.hidden)void refresh()},90000);window.addEventListener('focus',()=>void refresh())}
 window.WillenaHomeworkNotifications={receive,refresh,render};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();