(()=>{
  const API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/admin_class_order';
  const grid=document.getElementById('classGrid');
  const page=document.getElementById('classes');
  if(!grid||!page)return;

  let editing=false,before=[],saved=[],dragged=null,observer=null,applying=false;
  const cards=()=>Array.from(grid.querySelectorAll(':scope > .class-card'));
  const getName=card=>card?.querySelector('h3')?.textContent?.trim()||'';
  const getId=card=>String(card?.dataset?.classId||'').trim();

  async function api(opts={}){
    const adminEdge=window.AdminClassEdge;
    if(!adminEdge?.resolveUserId)throw new Error('Admin class manager is not ready');
    const userId=await adminEdge.resolveUserId();
    const headers={...(opts.headers||{}),'x-user-id':userId};
    if(opts.body)headers['Content-Type']='application/json';
    const r=await fetch(API,{...opts,headers,credentials:'omit',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d?.success===false||d?.error)throw new Error(d?.error||`Request failed ${r.status}`);
    return d;
  }

  const style=document.createElement('style');
  style.textContent=`
    .class-order-bar{display:flex;justify-content:flex-end;gap:8px;align-items:center;margin:0 0 13px}
    .class-order-status{font-size:.76rem;color:var(--mut);margin-right:3px}
    .class-order-bar .btn[hidden]{display:none}
    #classGrid.class-order-editing .class-card{position:relative;cursor:default;user-select:none;padding-top:44px;transition:transform .12s ease,box-shadow .12s ease,opacity .12s ease}
    .class-order-handle{display:none!important;position:absolute;top:9px;left:12px;width:34px!important;height:28px;border:1px solid var(--line)!important;border-radius:9px!important;background:#fff!important;color:var(--mut)!important;font-size:19px;line-height:1;touch-action:none;cursor:grab;align-items:center;justify-content:center;padding:0!important}
    #classGrid.class-order-editing .class-order-handle{display:flex!important}
    #classGrid.class-order-editing .class-card::after{content:'Drag to reorder';position:absolute;top:14px;left:54px;color:#99a3af;font-size:.72rem;font-weight:600}
    #classGrid.class-order-editing .class-card.dragging{opacity:.58;transform:scale(.985);box-shadow:0 18px 40px rgba(24,35,52,.16)}
    #classGrid.class-order-editing .class-card>button:not(.class-order-handle){pointer-events:none;opacity:.7}
    @media(max-width:720px){#classGrid.class-order-editing .class-card::after{content:'Drag'}}
  `;
  document.head.appendChild(style);

  const bar=document.createElement('div');
  bar.className='class-order-bar';
  bar.innerHTML='<span class="class-order-status" aria-live="polite"></span><button class="btn" data-order-edit>Edit order</button><button class="btn" data-order-cancel hidden>Cancel</button><button class="btn primary" data-order-done hidden>Done</button>';
  grid.parentNode.insertBefore(bar,grid);

  const status=bar.querySelector('.class-order-status');
  const editBtn=bar.querySelector('[data-order-edit]');
  const cancelBtn=bar.querySelector('[data-order-cancel]');
  const doneBtn=bar.querySelector('[data-order-done]');
  const setStatus=(t,e=false)=>{status.textContent=t||'';status.style.color=e?'var(--red)':'var(--mut)'};

  const savedIds=()=>saved.map(row=>String(row?.id||'')).filter(Boolean);

  function sortSaved(){
    if(editing||applying||!saved.length)return;
    const current=cards();
    if(!current.length)return;
    const rank=new Map(savedIds().map((id,i)=>[id,i]));
    const sorted=current.slice().sort((a,b)=>(rank.get(getId(a))??9999)-(rank.get(getId(b))??9999));
    if(sorted.every((card,i)=>card===current[i]))return;
    applying=true;
    sorted.forEach(card=>grid.appendChild(card));
    applying=false;
  }

  function decorate(){
    cards().forEach(card=>{
      if(card.querySelector('.class-order-handle'))return;
      const handle=document.createElement('button');
      handle.type='button';
      handle.className='class-order-handle';
      handle.textContent='⠿';
      handle.title='Drag to reorder';
      handle.setAttribute('aria-label',`Move ${getName(card)}`);
      handle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});
      handle.addEventListener('pointerdown',startDrag);
      card.prepend(handle);
    });
  }

  function setMode(on){
    editing=on;
    grid.classList.toggle('class-order-editing',on);
    editBtn.hidden=on;
    cancelBtn.hidden=!on;
    doneBtn.hidden=!on;
    if(on)decorate();
  }

  function begin(){
    before=cards().map(getId);
    setMode(true);
    setStatus('Drag the cards, then press Done.');
  }

  function restore(ids){
    const byId=new Map(cards().map(card=>[getId(card),card]));
    ids.forEach(id=>{const card=byId.get(id);if(card)grid.appendChild(card)});
  }

  function cancel(){
    restore(before.length?before:savedIds());
    setMode(false);
    setStatus('');
  }

  async function save(){
    doneBtn.disabled=true;
    const order=cards().map(getId).filter(Boolean);
    setStatus('Saving…');
    try{
      const d=await api({method:'POST',body:JSON.stringify({order})});
      saved=Array.isArray(d.order)?d.order:[];
      before=[];
      setMode(false);
      setStatus('Saved');
      setTimeout(()=>setStatus(''),1400);
    }catch(e){
      console.error('[Admin class order] save failed',e);
      setStatus('Could not save order',true);
    }finally{
      doneBtn.disabled=false;
    }
  }

  function startDrag(e){
    if(!editing||(e.button!==undefined&&e.button!==0))return;
    const handle=e.currentTarget;
    const card=handle.closest('.class-card');
    if(!card)return;
    e.preventDefault();
    e.stopPropagation();
    dragged=card;
    card.classList.add('dragging');
    try{handle.setPointerCapture(e.pointerId)}catch{}
    handle.addEventListener('pointermove',moveDrag);
    handle.addEventListener('pointerup',endDrag,{once:true});
    handle.addEventListener('pointercancel',endDrag,{once:true});
  }

  function moveDrag(e){
    if(!dragged)return;
    e.preventDefault();
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.class-card');
    if(!target||target===dragged||target.parentElement!==grid)return;
    const rect=target.getBoundingClientRect();
    const beforeTarget=e.clientY<rect.top+rect.height/2;
    grid.insertBefore(dragged,beforeTarget?target:target.nextSibling);
  }

  function endDrag(e){
    const handle=e.currentTarget;
    if(dragged)dragged.classList.remove('dragging');
    handle.removeEventListener('pointermove',moveDrag);
    try{handle.releasePointerCapture(e.pointerId)}catch{}
    dragged=null;
  }

  editBtn.onclick=begin;
  cancelBtn.onclick=cancel;
  doneBtn.onclick=save;

  observer=new MutationObserver(()=>{
    if(applying)return;
    decorate();
    if(!editing)requestAnimationFrame(sortSaved);
  });
  observer.observe(grid,{childList:true});

  api().then(d=>{
    saved=Array.isArray(d.order)?d.order:[];
    bar.style.display='flex';
    sortSaved();
  }).catch(e=>{
    console.error('[Admin class order] load failed',e);
    bar.style.display='flex';
    setStatus('Order unavailable',true);
    editBtn.disabled=true;
  });
})();
