const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function ensureStyles(){
  if(document.querySelector('link[data-mock-submit-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./mock-test-submit.css?v=1.0.0';
  link.dataset.mockSubmitStyle='1';
  document.head.appendChild(link);
}

export function confirmMockTestSubmit({host,answered=0,total=25}={}){
  ensureStyles();
  if(!host)return Promise.resolve(false);
  host.querySelector('[data-mock-submit-overlay]')?.remove();
  const done=Number(answered)>=Number(total),remaining=Math.max(0,Number(total)-Number(answered));
  const overlay=document.createElement('div');
  overlay.className='mock-submit-overlay';
  overlay.dataset.mockSubmitOverlay='1';
  overlay.innerHTML=`<section class="mock-submit-dialog" role="dialog" aria-modal="true" aria-labelledby="mock-submit-title">
    <div class="mock-submit-count">${esc(answered)} / ${esc(total)}</div>
    <h2 id="mock-submit-title">${done?'모든 문제를 풀었습니다.':`아직 ${remaining}문항이 남아 있습니다.`}</h2>
    <p>${done?'답을 꼼꼼히 확인했나요?':'답하지 않은 문제가 있습니다. 제출하기 전에 다시 확인해 보세요.'}</p>
    <small>제출하면 답안을 수정할 수 없습니다.</small>
    <div class="mock-submit-actions">
      <button type="button" class="review-secondary" data-mock-submit-cancel>${done?'답안 다시 확인':'계속 풀기'}</button>
      <button type="button" class="review-primary" data-mock-submit-confirm>${done?'제출하기':'그래도 제출'}</button>
    </div>
  </section>`;
  host.appendChild(overlay);
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;document.removeEventListener('keydown',onKey);overlay.remove();resolve(value)};
    const onKey=e=>{if(e.key==='Escape')finish(false)};
    overlay.querySelector('[data-mock-submit-cancel]').onclick=()=>finish(false);
    overlay.querySelector('[data-mock-submit-confirm]').onclick=()=>finish(true);
    overlay.addEventListener('click',e=>{if(e.target===overlay)finish(false)});
    document.addEventListener('keydown',onKey);
    requestAnimationFrame(()=>overlay.querySelector('[data-mock-submit-cancel]')?.focus());
  });
}
