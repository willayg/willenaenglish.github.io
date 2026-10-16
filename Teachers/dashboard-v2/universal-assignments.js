/* Universal assignment hub: app tabs, existing Naesin assignments, and Word Genius entry point. */
(()=>{'use strict';
const root=document.getElementById('universalAssignments');if(!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let active='naesin';
const tabs=[['naesin','내신'],['word','Word Genius'],['grammar','Grammar Foundations'],['puzzles','Puzzles']];
function rows(){return window.NaesinV2Data?.getCachedGroups?.()||[]}
function render(){
root.innerHTML='<div class="ua-app-tabs" role="tablist" aria-label="Assignment app">'+tabs.map(([key,label])=>'<button type="button" class="ua-app-tab'+(active===key?' active':'')+'" role="tab" aria-selected="'+(active===key)+'" data-ua-tab="'+key+'">'+label+'</button>').join('')+'</div><div class="ua-app-body" role="tabpanel" id="uaAppBody"></div>';
root.querySelectorAll('[data-ua-tab]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.uaTab;render()}));
const body=root.querySelector('#uaAppBody');
if(active==='word'){
body.innerHTML='<h3>Word Genius assignments</h3><p>Use the existing Word Genius assignment manager to create assignments and view student progress.</p><button type="button" class="control" id="uaOpenWord">Open Word Genius assignments →</button>';
body.querySelector('#uaOpenWord').addEventListener('click',()=>{
const nav=document.querySelector('[data-view="vocab"]');nav?.click();
const tab=document.querySelector('[data-vocab-tab="assignments"]');tab?.click();
window.dispatchEvent(new CustomEvent('vocab:assignments-open'));
});return;
}
if(active==='grammar'||active==='puzzles'){
const title=active==='grammar'?'Grammar Foundations':'Puzzles';
body.innerHTML='<h3>'+title+'</h3><p>Assignment creation for '+title+' is not connected yet. Existing student activity and progress are unaffected.</p>';return;
}
const groups=rows();
body.innerHTML='<div class="ua-toolbar"><button type="button" class="control" id="uaRefresh">Refresh exams</button><span>'+groups.length+' exam groups</span></div>'+(groups.length?'<div class="ua-grid">'+groups.map(item=>{const g=item.group||item;return '<article class="ua-card"><strong>'+esc(g.school||'내신')+'</strong><span>'+esc(g.book_label||g.title||'')+'</span><small>'+esc((g.scope?.lessons||[]).map(l=>l.lesson).join(', '))+'</small><button type="button" class="control" data-ua-group="'+esc(g.id)+'">Assign 내신</button></article>'}).join('')+'</div>':'<div class="empty">No exam groups are loaded. Open 내신 once or refresh.</div>');
body.querySelector('#uaRefresh')?.addEventListener('click',refresh);
body.querySelectorAll('[data-ua-group]').forEach(b=>b.addEventListener('click',()=>{if(!window.NaesinV2Assignment?.open){alert('내신 assignment module is unavailable.');return}window.NaesinV2Assignment.open(b.dataset.uaGroup)}));
}
async function refresh(){try{await window.NaesinV2Data?.loadGroups?.()}catch(e){console.warn('Assignments groups unavailable',e)}render()}
window.UniversalAssignments={refresh,openTab:key=>{if(tabs.some(t=>t[0]===key)){active=key;render()}}};
render();void refresh();
})();
