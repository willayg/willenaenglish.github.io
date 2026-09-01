(()=>{
  const API='/.netlify/functions/class_order';
  const grid=document.getElementById('classGrid');
  const page=document.getElementById('classes');
  if(!grid||!page)return;
  let editing=false,before=[],saved=[],dragged=null,canEdit=false,observer=null,applying=false;
  const key=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  const getName=card=>card?.querySelector('h3')?.textContent?.trim()||'';
  const cards=()=>Array.from(grid.querySelectorAll(':scope > .class-card'));
  const api=async(opts={})=>{const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);const r=await fn(API,{credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},...opts});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.error||`Request failed ${r.status}`);return d};
  const style=document.createElement('style');style.textContent=`
    .class-order-bar{display:flex;justify-content:flex-end;gap:8px;align-items:center;margin:0 0 13px}
    .class-order-status{font-size:.76rem;color:var(--mut);margin-right:3px}
    .class-order-bar .btn[hidden]{display:none}
    #classGrid.class-order-editing .class-card{position:relative;cursor:default;user-select:none;padding-top:44px;transition:transform .12s ease,box-shadow .12s ease,opacity .12s ease}
    .class-order-handle{display:none;position:absolute;top:9px;left:12px;width:34px;height:28px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--mut);font-size:19px;line-height:1;touch-action:none;cursor:grab;align-items:center;justify-content:center}
    #classGrid.class-order-editing .class-order-handle{display:flex}
    #classGrid.class-order-editing .class-card::after{content:'Drag to reorder';position:absolute;top:14px;left:54px;color:#99a3af;font-size:.72rem;font-weight:600}
    #classGrid.class-order-editing .class-card.dragging{opacity:.58;transform:scale(.985);box-shadow:0 18px 40px rgba(24,35,52,.16)}
    #classGrid.class-order-editing .class-card>button:not(.class-order-handle){pointer-events:none;opacity:.7}
    @media(max-width:720px){#classGrid.class-order-editing .class-card::after{content:'Drag'}}
  `;document.head.appendChild(style);
  const bar=document.createElement('div');bar.className='class-order-bar';bar.innerHTML='<span class="class-order-status" aria-live="polite"></span><button class="btn" data-order-edit>Edit order</button><button class="btn" data-order-cancel hidden>Cancel</button><button class="btn primary" data-order-done hidden>Done</button>';grid.parentNode.insertBefore(bar,grid);
  const status=bar.querySelector('.class-order-status'),editBtn=bar.querySelector('[data-order-edit]'),cancelBtn=bar.querySelector('[data-order-cancel]'),doneBtn=bar.querySelector('[data-order-done]');
  const setStatus=(t,e=false)=>{status.textContent=t||'';status.style.color=e?'var(--red)':'var(--mut)'};
  function sortSaved(){if(editing||applying||!saved.length)return;const current=cards();if(!current.length)return;const rank=new Map(saved.map((n,i)=>[key(n),i]));const sorted=current.slice().sort((a,b)=>(rank.get(key(getName(a)))??9999)-(rank.get(key(getName(b)))??9999));if(sorted.every((c,i)=>c===current[i]))return;applying=true;sorted.forEach(c=>grid.appendChild(c));applying=false}
  function decorate(){cards().forEach(card=>{if(card.querySelector('.class-order-handle'))return;const h=document.createElement('button');h.type='button';h.className='class-order-handle';h.textContent='⠿';h.title='Drag to reorder';h.setAttribute('aria-label',`Move ${getName(card)}`);h.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});h.addEventListener('pointerdown',startDrag);card.prepend(h)})}
  function setMode(on){editing=on;grid.classList.toggle('class-order-editing',on);editBtn.hidden=on;cancelBtn.hidden=!on;doneBtn.hidden=!on;if(on)decorate()}
  function begin(){before=cards().map(getName);setMode(true);setStatus('Drag the cards, then press Done.')}
  function restore(order){const by=new Map(cards().map(c=>[key(getName(c)),c]));order.forEach(n=>{const c=by.get(key(n));if(c)grid.appendChild(c)})}
  function cancel(){restore(before.length?before:saved);setMode(false);setStatus('')}
  async function save(){doneBtn.disabled=true;const order=cards().map(getName).filter(Boolean);setStatus('Saving…');try{const d=await api({method:'POST',body:JSON.stringify({order})});saved=Array.isArray(d.order)?d.order:order;before=[];setMode(false);setStatus('Saved');setTimeout(()=>setStatus(''),1400)}catch(e){setStatus('Could not save order',true)}finally{doneBtn.disabled=false}}
  function startDrag(e){if(!editing||(e.button!==undefined&&e.button!==0))return;const h=e.currentTarget,card=h.closest('.class-card');if(!card)return;e.preventDefault();e.stopPropagation();dragged=card;card.classList.add('dragging');try{h.setPointerCapture(e.pointerId)}catch{}h.addEventListener('pointermove',moveDrag);h.addEventListener('pointerup',endDrag,{once:true});h.addEventListener('pointercancel',endDrag,{once:true})}
  function moveDrag(e){if(!dragged)return;e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.class-card');if(!target||target===dragged||target.parentElement!==grid)return;const r=target.getBoundingClientRect();const beforeTarget=e.clientY<r.top+r.height/2;grid.insertBefore(dragged,beforeTarget?target:target.nextSibling)}
  function endDrag(e){const h=e.currentTarget;if(dragged)dragged.classList.remove('dragging');h.removeEventListener('pointermove',moveDrag);try{h.releasePointerCapture(e.pointerId)}catch{}dragged=null}
  editBtn.onclick=begin;cancelBtn.onclick=cancel;doneBtn.onclick=save;
  observer=new MutationObserver(()=>{if(applying)return;decorate();if(!editing)requestAnimationFrame(sortSaved)});observer.observe(grid,{childList:true});
  api().then(d=>{canEdit=d.can_edit===true;saved=Array.isArray(d.order)?d.order:[];bar.style.display=canEdit?'flex':'none';sortSaved()}).catch(()=>{bar.style.display='none'});
})();
