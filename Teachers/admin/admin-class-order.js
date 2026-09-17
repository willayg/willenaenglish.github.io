(()=>{
  const API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/admin_class_order';
  const grid=document.getElementById('classGrid');
  const page=document.getElementById('classes');
  if(!grid||!page)return;

  let editing=false,before=[],saved=[],dragged=null,observer=null,applying=false;
  let dragPointerId=null,dragOffsetY=0,placeholder=null,originStyle=null,compact=false;
  const cards=()=>Array.from(grid.querySelectorAll(':scope > .class-card'));
  const getName=card=>card?.querySelector('h3')?.textContent?.trim()||'';
  const getId=card=>String(card?.dataset?.classId||'').trim();
  const getCount=card=>card?.querySelector('.count')?.textContent?.trim()||'0';
  const useCompact=()=>window.matchMedia('(max-width:900px)').matches;

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
    #classGrid.class-order-editing .class-card{position:relative;cursor:default;user-select:none;padding-top:44px;transition:transform .16s ease,box-shadow .16s ease,opacity .16s ease}
    .class-order-handle{display:none!important;position:absolute;top:9px;left:12px;width:34px!important;height:28px;border:1px solid var(--line)!important;border-radius:9px!important;background:#fff!important;color:var(--mut)!important;font-size:19px;line-height:1;touch-action:none;cursor:grab;align-items:center;justify-content:center;padding:0!important}
    #classGrid.class-order-editing .class-order-handle{display:flex!important}
    #classGrid.class-order-editing .class-card::after{content:'Drag to reorder';position:absolute;top:14px;left:54px;color:#99a3af;font-size:.72rem;font-weight:600}
    #classGrid .class-card.dragging{position:fixed!important;z-index:1000!important;margin:0!important;pointer-events:none!important;opacity:.97!important;transform:scale(1.035) rotate(.35deg)!important;box-shadow:0 22px 54px rgba(24,35,52,.24)!important;transition:box-shadow .12s ease,transform .12s ease!important;will-change:left,top,transform}
    #classGrid .class-order-placeholder{border:2px dashed #8fc6ca;border-radius:18px;background:rgba(25,119,126,.06);min-height:64px}
    #classGrid.class-order-editing .class-card>button:not(.class-order-handle){pointer-events:none;opacity:.7}

    #classGrid.class-order-compact{display:flex!important;flex-direction:column;gap:8px}
    #classGrid.class-order-compact .class-card{display:grid!important;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px!important;min-height:58px;border-top:0!important;border-left:4px solid #2aa6ae;border-radius:14px;box-shadow:0 5px 14px rgba(24,35,52,.07)}
    #classGrid.class-order-compact .class-card h3{grid-column:2;margin:0;font-size:.96rem;line-height:1.2}
    #classGrid.class-order-compact .class-card .count{grid-column:3;grid-row:1;margin:0;font-size:.82rem;font-weight:700;color:var(--mut)}
    #classGrid.class-order-compact .class-card .count::after{content:' students';font-size:.72rem;font-weight:600}
    #classGrid.class-order-compact .class-card .mut,
    #classGrid.class-order-compact .class-card .class-meta,
    #classGrid.class-order-compact .class-card>button:not(.class-order-handle){display:none!important}
    #classGrid.class-order-compact .class-order-handle{display:flex!important;position:static!important;grid-column:1;grid-row:1;width:40px!important;height:40px!important;border:0!important;background:#f2f5f7!important;font-size:22px;cursor:grab}
    #classGrid.class-order-compact .class-card::after{display:none!important}
    #classGrid.class-order-compact .class-card.dragging{position:fixed!important;display:grid!important;grid-template-columns:44px minmax(0,1fr) auto!important;min-height:58px!important;transform:scale(1.025)!important;box-shadow:0 18px 42px rgba(24,35,52,.26)!important}
    #classGrid.class-order-compact .class-order-placeholder{min-height:58px;border-radius:14px}

    @media(max-width:720px){.class-order-bar{position:sticky;top:8px;z-index:20;background:var(--bg);padding:6px 0}.class-order-status{display:none}}
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
    const current=cards();if(!current.length)return;
    const rank=new Map(savedIds().map((id,i)=>[id,i]));
    const sorted=current.slice().sort((a,b)=>(rank.get(getId(a))??9999)-(rank.get(getId(b))??9999));
    if(sorted.every((card,i)=>card===current[i]))return;
    applying=true;sorted.forEach(card=>grid.appendChild(card));applying=false;
  }

  function decorate(){
    cards().forEach(card=>{
      if(card.querySelector('.class-order-handle'))return;
      const handle=document.createElement('button');
      handle.type='button';handle.className='class-order-handle';handle.textContent='☰';
      handle.title='Drag to reorder';handle.setAttribute('aria-label',`Move ${getName(card)}`);
      handle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});
      handle.addEventListener('pointerdown',startDrag);
      card.prepend(handle);
    });
  }

  function setMode(on){
    editing=on;compact=on&&useCompact();
    grid.classList.toggle('class-order-editing',on);
    grid.classList.toggle('class-order-compact',compact);
    editBtn.hidden=on;cancelBtn.hidden=!on;doneBtn.hidden=!on;
    if(on){decorate();setStatus(compact?'Drag the compact rows, then press Done.':'Drag the cards, then press Done.');}
  }

  function begin(){before=cards().map(getId);setMode(true)}
  function restore(ids){const byId=new Map(cards().map(card=>[getId(card),card]));ids.forEach(id=>{const card=byId.get(id);if(card)grid.appendChild(card)})}
  function cancel(){if(dragged)finishDrag();restore(before.length?before:savedIds());setMode(false);setStatus('')}

  async function save(){
    doneBtn.disabled=true;const order=cards().map(getId).filter(Boolean);setStatus('Saving…');
    try{const d=await api({method:'POST',body:JSON.stringify({order})});saved=Array.isArray(d.order)?d.order:[];before=[];setMode(false);setStatus('Saved');setTimeout(()=>setStatus(''),1400)}
    catch(e){console.error('[Admin class order] save failed',e);setStatus('Could not save order',true)}
    finally{doneBtn.disabled=false}
  }

  function makePlaceholder(rect){const ph=document.createElement('div');ph.className='class-order-placeholder';ph.style.height=`${rect.height}px`;return ph}

  function startDrag(e){
    if(!editing||(e.button!==undefined&&e.button!==0))return;
    const handle=e.currentTarget,card=handle.closest('.class-card');if(!card)return;
    e.preventDefault();e.stopPropagation();
    const rect=card.getBoundingClientRect();dragged=card;dragPointerId=e.pointerId;dragOffsetY=e.clientY-rect.top;
    placeholder=makePlaceholder(rect);card.parentNode.insertBefore(placeholder,card);originStyle=card.getAttribute('style');
    card.style.width=`${rect.width}px`;card.style.height=`${rect.height}px`;card.style.left=`${rect.left}px`;card.style.top=`${rect.top}px`;
    card.classList.add('dragging');document.body.appendChild(card);
    if(navigator.vibrate)navigator.vibrate(10);
    try{handle.setPointerCapture(e.pointerId)}catch{}
    handle.addEventListener('pointermove',moveDrag);handle.addEventListener('pointerup',endDrag,{once:true});handle.addEventListener('pointercancel',endDrag,{once:true});
  }

  function moveDrag(e){
    if(!dragged||e.pointerId!==dragPointerId)return;e.preventDefault();
    dragged.style.top=`${e.clientY-dragOffsetY}px`;
    const rows=Array.from(grid.querySelectorAll(':scope > .class-card')).filter(el=>el!==dragged);
    let inserted=false;
    for(const row of rows){const r=row.getBoundingClientRect();if(e.clientY<r.top+r.height/2){grid.insertBefore(placeholder,row);inserted=true;break}}
    if(!inserted)grid.appendChild(placeholder);
    const edge=72;
    if(e.clientY<edge)window.scrollBy({top:-14,behavior:'auto'});
    else if(e.clientY>window.innerHeight-edge)window.scrollBy({top:14,behavior:'auto'});
  }

  function finishDrag(){
    if(!dragged)return;const card=dragged;
    if(placeholder?.parentNode)placeholder.parentNode.insertBefore(card,placeholder);placeholder?.remove();
    card.classList.remove('dragging');if(originStyle===null)card.removeAttribute('style');else card.setAttribute('style',originStyle);
    dragged=null;placeholder=null;originStyle=null;dragPointerId=null;if(navigator.vibrate)navigator.vibrate(6);
  }

  function endDrag(e){const handle=e.currentTarget;handle.removeEventListener('pointermove',moveDrag);try{handle.releasePointerCapture(e.pointerId)}catch{}finishDrag()}

  editBtn.onclick=begin;cancelBtn.onclick=cancel;doneBtn.onclick=save;
  observer=new MutationObserver(()=>{if(applying||dragged)return;decorate();if(!editing)requestAnimationFrame(sortSaved)});observer.observe(grid,{childList:true});

  api().then(d=>{saved=Array.isArray(d.order)?d.order:[];bar.style.display='flex';sortSaved()}).catch(e=>{console.error('[Admin class order] load failed',e);bar.style.display='flex';setStatus('Order unavailable',true);editBtn.disabled=true});
})();
