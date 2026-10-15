/* Universal assignment hub shell: delegates existing Naesin assignments to its maintained module. */
(()=>{'use strict';
const root=document.getElementById('universalAssignments');if(!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rows(){return window.NaesinV2Data?.getCachedGroups?.()||[]}
function render(){const groups=rows();root.innerHTML='<div class="ua-toolbar"><button type="button" class="control" id="uaRefresh">Refresh exams</button><span>'+groups.length+' exam groups</span></div>'+(groups.length?'<div class="ua-grid">'+groups.map(item=>{const g=item.group||item;return '<article class="ua-card"><strong>'+esc(g.school||'내신')+'</strong><span>'+esc(g.book_label||g.title||'')+'</span><small>'+esc((g.scope?.lessons||[]).map(l=>l.lesson).join(', '))+'</small><button type="button" class="control" data-ua-group="'+esc(g.id)+'">Assign 내신</button></article>'}).join('')+'</div>':'<div class="empty">No exam groups are loaded. Open 내신 once or refresh.</div>');
root.querySelector('#uaRefresh')?.addEventListener('click',()=>{refresh()});
root.querySelectorAll('[data-ua-group]').forEach(b=>b.addEventListener('click',()=>{if(!window.NaesinV2Assignment?.open){alert('내신 assignment module is unavailable.');return}window.NaesinV2Assignment.open(b.dataset.uaGroup)}))}
async function refresh(){try{await window.NaesinV2Data?.loadGroups?.()}catch(e){console.warn('Assignments groups unavailable',e)}render()}
window.UniversalAssignments={refresh};refresh();
})();