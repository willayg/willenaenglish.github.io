const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function ensureStyles(){
  if(document.querySelector('link[data-shared-confirm-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./shared-confirm-dialog.css?v=1.0.0';
  link.dataset.sharedConfirmStyle='1';
  document.head.appendChild(link);
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
