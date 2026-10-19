/* Assignment workspace. Uses existing dashboard panels and Naesin assignment API. */
(()=>{'use strict';
const root=document.getElementById('universalAssignments');if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const apps=[{id:'naesin',label:'내신',sub:'Exam practice',icon:'文'},{id:'word',label:'Word Genius',sub:'Vocabulary',icon:'Aa'},{id:'grammar',label:'Grammar Foundations',sub:'Grammar mastery',icon:'G'},{id:'puzzles',label:'Puzzles',sub:'Word games',icon:'◇'}];
let active='naesin',loading=false,groups=[];
let wordPanel=null,wordHome=null;
function restoreWordPanel(){if(wordPanel&&wordHome&&wordPanel.parentElement!==wordHome)wordHome.appendChild(wordPanel)}
function showWordPanel(body){const panel=document.querySelector('[data-vocab-subview="assignments"]');if(!panel){body.innerHTML='<div class="ua-empty">Word Genius tracking unavailable.</div>';return}if(!wordPanel){wordPanel=panel;wordHome=panel.parentElement}panel.classList.add('ua-mounted-word');panel.classList.add('active');body.appendChild(panel);window.dispatchEvent(new CustomEvent('vocab:assignments-open'))}

function groupRows(){return window.NaesinV2Data?.getCachedGroups?.()||[]}
function render(){
 restoreWordPanel();
 const selected=apps.find(a=>a.id===active);
 root.innerHTML='<div class="ua-topline"><div><div class="ua-eyebrow">ASSIGNMENT MANAGER</div><h2>Choose an activity</h2><p>Select an app to assign practice or manage its homework.</p></div><span class="ua-workspace-status">Teacher workspace</span></div>'+
 '<div class="ua-app-tabs" role="tablist" aria-label="Assignment app">'+apps.map(a=>'<button type="button" role="tab" aria-selected="'+(active===a.id)+'" class="ua-app-tab'+(active===a.id?' active':'')+'" data-ua-tab="'+a.id+'"><span class="ua-app-icon" aria-hidden="true">'+a.icon+'</span><span class="ua-app-label"><b>'+a.label+'</b><small>'+a.sub+'</small></span></button>').join('')+'</div>'+
 '<section class="ua-workspace" aria-label="'+selected.label+' assignments"><div class="ua-section-heading"><div><div class="ua-eyebrow">CREATE & MANAGE</div><h3>'+selected.label+'</h3></div><span class="ua-section-count" id="uaStatus">'+(active==='naesin'?groups.length+' exam groups':active==='word'?'Available in Vocab':'Not yet connected')+'</span></div><div class="ua-app-body" id="uaAppBody"></div></section>';
 root.querySelectorAll('[data-ua-tab]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.uaTab;render()}));
 const body=root.querySelector('#uaAppBody');
 if(active==='naesin'){
  body.innerHTML='<div class="ua-actions"><p>Choose an exam group to open its assignment settings.</p><button type="button" class="control ua-outline" id="uaRefresh">'+(loading?'Refreshing…':'↻ Refresh groups')+'</button></div>'+
  (groups.length?'<div class="ua-grid">'+groups.map(item=>{const g=item.group||item;const lessons=(g.scope?.lessons||[]).map(l=>l.lesson).filter(Boolean).join(', ');return '<article class="ua-card"><div class="ua-card-top"><span class="ua-card-kicker">EXAM GROUP</span><span class="ua-card-dot" aria-hidden="true"></span></div><strong>'+esc(g.school||'내신')+'</strong><div class="ua-card-sub">'+esc(g.book_label||g.title||'Exam practice')+'</div><small>'+esc(lessons||'Choose questions and assign practice')+'</small><button type="button" class="control ua-assign" data-ua-group="'+esc(g.id)+'">Assign practice <span aria-hidden="true">→</span></button></article>'}).join('')+'</div>':'<div class="ua-empty"><div class="ua-empty-icon">▤</div><b>No exam groups loaded</b><p>Refresh to load your existing 내신 groups.</p></div>');
  body.querySelector('#uaRefresh')?.addEventListener('click',refresh);
  body.querySelectorAll('[data-ua-group]').forEach(b=>b.addEventListener('click',()=>{if(!window.NaesinV2Assignment?.open){alert('내신 assignment module is unavailable.');return}window.NaesinV2Assignment.open(b.dataset.uaGroup)}));return;
 }
 if(active==='word'){
 body.innerHTML='<div class="ua-word-actions"><div><h4>Word Genius homework</h4><p>Create assignments in Word Builder, or inspect current and past Word Genius homework below.</p></div><a class="control ua-primary" href="/Teachers/tools/wordtest/wordtest2.html">Open Word Builder →</a></div>';
 showWordPanel(body);return;
 }
 const desc=active==='grammar'?'Assign individual grammar steps and track students’ progress.':'Assign word games and review completion by activity.';
 body.innerHTML='<div class="ua-feature ua-unavailable"><div class="ua-feature-symbol">'+(active==='grammar'?'G':'◇')+'</div><div class="ua-feature-copy"><span class="ua-coming-label">Assignment integration pending</span><h4>'+selected.label+' assignments</h4><p>'+desc+' The assignment connection is not built yet; existing student progress is unaffected.</p></div></div>';
}
async function refresh(){
 if(loading)return;loading=true;try{await window.NaesinV2Data?.loadGroups?.();groups=groupRows()}catch(e){console.warn('Assignments load unavailable',e)}finally{loading=false;render()}
}
window.UniversalAssignments={refresh,openTab:id=>{if(apps.some(a=>a.id===id)){active=id;render()}}};
document.querySelectorAll('[data-view="vocab"]').forEach(el=>el.addEventListener('click',restoreWordPanel));
groups=groupRows();render();void refresh();
})();