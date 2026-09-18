const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function ensureStyles(){
  if(document.querySelector('style[data-shared-confirm-style],link[data-shared-confirm-style]'))return;
  const style=document.createElement('style');
  style.dataset.sharedConfirmStyle='1';
  style.textContent=`
.shared-confirm-overlay{position:fixed!important;inset:0!important;z-index:2147483000!important;display:grid!important;place-items:center!important;padding:20px!important;background:rgba(28,45,52,.48)!important;backdrop-filter:blur(5px)!important}
.shared-confirm-dialog{width:min(420px,100%)!important;box-sizing:border-box!important;padding:24px!important;border:2px solid #10bfd0!important;border-radius:22px!important;background:#fff!important;box-shadow:0 20px 60px rgba(32,48,57,.22)!important;text-align:center!important;position:relative!important;margin:0!important}
.shared-confirm-dialog h2{margin:0!important;font-size:22px!important;line-height:1.35!important;color:#203039!important}
.shared-confirm-dialog p{margin:10px auto 0!important;max-width:310px!important;font-size:15px!important;line-height:1.55!important;color:#526168!important;font-weight:700!important}
.shared-confirm-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;margin-top:22px!important}
.shared-confirm-actions button{min-height:46px!important}
.shared-confirm-dialog.is-danger{border-color:#ef5c72!important}
@media(max-width:620px){.shared-confirm-overlay{padding:16px!important}.shared-confirm-dialog{padding:22px 18px!important;border-radius:20px!important}.shared-confirm-dialog h2{font-size:20px!important}.shared-confirm-actions{grid-template-columns:1fr!important}.shared-confirm-actions [data-shared-confirm-confirm]{grid-row:1!important}.shared-confirm-actions [data-shared-confirm-cancel]{grid-row:2!important}}
`;
  document.head.appendChild(style);
}

export function showConfirmDialog({host=document.body,title='Are you sure?',message='',cancelLabel='Cancel',confirmLabel='Exit',tone='default'}={}){
  ensureStyles();
  const parent=host||document.body;
  parent.querySelector?.('[data-shared-confirm-overlay]')?.remove();
  const overlay=document.createElement('div');
  overlay.className='shared-confirm-overlay';
  overlay.dataset.sharedConfirmOverlay='1';
  overlay.innerHTML=`<section class="shared-confirm-dialog ${tone==='danger'?'is-danger':''}" role="dialog" aria-modal="true" aria-labelledby="shared-confirm-title">
    <h2 id="shared-confirm-title">${esc(title)}</h2>
    ${message?`<p>${esc(message)}</p>`:''}
    <div class="shared-confirm-actions">
      <button type="button" class="review-secondary" data-shared-confirm-cancel>${esc(cancelLabel)}</button>
      <button type="button" class="review-primary" data-shared-confirm-confirm>${esc(confirmLabel)}</button>
    </div>
  </section>`;
  parent.appendChild(overlay);
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;document.removeEventListener('keydown',onKey);overlay.remove();resolve(value)};
    const onKey=e=>{if(e.key==='Escape')finish(false)};
    overlay.querySelector('[data-shared-confirm-cancel]').onclick=()=>finish(false);
    overlay.querySelector('[data-shared-confirm-confirm]').onclick=()=>finish(true);
    overlay.addEventListener('click',e=>{if(e.target===overlay)finish(false)});
    document.addEventListener('keydown',onKey);
    requestAnimationFrame(()=>overlay.querySelector('[data-shared-confirm-cancel]')?.focus());
  });
}
