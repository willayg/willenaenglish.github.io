(function(){
'use strict';
const VISITOR_URL='https://students.willenaenglish.com/visit-level-test/';

function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function close(){document.getElementById('visitorQrModalBg')?.remove()}
async function copyLink(button){
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(VISITOR_URL);
    else{
      const t=document.createElement('textarea');t.value=VISITOR_URL;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();
    }
    const old=button.textContent;button.textContent='Copied';button.disabled=true;setTimeout(()=>{button.textContent=old;button.disabled=false},1400);
  }catch(_){button.textContent='Copy failed';setTimeout(()=>button.textContent='Copy link',1400)}
}
function open(){
  close();
  const bg=document.createElement('div');
  bg.className='admin-modal-bg visitor-qr-modal-bg';
  bg.id='visitorQrModalBg';
  const qr=`https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(VISITOR_URL)}`;
  bg.innerHTML=`<div class="admin-modal visitor-qr-modal" role="dialog" aria-modal="true" aria-labelledby="visitorQrTitle">
    <div class="admin-modal-head"><div><h2 id="visitorQrTitle">Visitor level test</h2><p>Scan to open the face-to-face visitor test.</p></div><button type="button" data-close-visitor-qr aria-label="Close">×</button></div>
    <div class="admin-modal-body visitor-qr-body">
      <div class="visitor-qr-frame"><img src="${esc(qr)}" alt="QR code for visitor level test" width="360" height="360"></div>
      <div class="visitor-qr-url">${esc(VISITOR_URL)}</div>
    </div>
    <div class="admin-modal-foot visitor-qr-foot">
      <button type="button" class="secondary" id="visitorQrCopy">Copy link</button>
      <a class="visitor-qr-open" href="${esc(VISITOR_URL)}" target="_blank" rel="noopener">Open test</a>
    </div>
  </div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-close-visitor-qr]'))close()});
  bg.querySelector('#visitorQrCopy')?.addEventListener('click',e=>copyLink(e.currentTarget));
}
function bind(){
  const toolbar=document.querySelector('#view-level-tests .level-test-toolbar');
  if(!toolbar)return;
  let button=document.getElementById('visitorQrButton');
  if(!button){
    button=document.createElement('button');
    button.type='button';
    button.id='visitorQrButton';
    button.className='btn visitor-qr-button';
    button.innerHTML='<span aria-hidden="true">▦</span> Visitor QR';
    const refresh=document.getElementById('levelTestRefresh');
    toolbar.insertBefore(button,refresh||null);
  }
  button.addEventListener('click',open);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('visitorQrModalBg'))close()});
})();
