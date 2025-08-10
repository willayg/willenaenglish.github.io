// textbox-events.js
// Lean event handling for worksheet textboxes (trimmed again)

(function () {
  const CONFIG = {
    RESIZE_HIT_ZONE: 18,
    MIN_WIDTH: 120,
    MIN_HEIGHT: 40,
    KEYBOARD_STEP_SMALL: 2,
    KEYBOARD_STEP_LARGE: 10,
    SNAP_TOLERANCE: 15
  };

  const Session = { active: null }; // { box, boxData, a4, edge, x0,y0,w0,h0,l0,t0, updateHandlePosition, updateSelectionFrame, justResized }

  // utils
  const px  = n => n + 'px';
  const num = v => parseFloat(v) || 0;
  const r   = el => el.getBoundingClientRect();
  const setUserSelect = (el,on)=>{ el.style.userSelect = on?'':'none'; document.body.style.userSelect = on?'':'none'; };
  const toggleEmpty   = el => el.classList.toggle('empty', el.innerText.trim()==='');

  // center/object guides
  function get(a4,id,init){
    let el = a4.querySelector('#'+id);
    if (!el){ el = document.createElement('div'); el.id=id; init(el); a4.appendChild(el); }
    return el;
  }
  function centerGuide(a4, type){
    return get(a4, 'center-'+type+'-guide', el=>{
      Object.assign(el.style,{position:'absolute',zIndex:1000,pointerEvents:'none',opacity:'.22',background:'none',display:'none'});
      if (type==='v') Object.assign(el.style,{top:'0',height:'100%',borderLeft:'2px dashed #8b8bff'});
      else            Object.assign(el.style,{left:'0',width:'100%',borderTop:'2px dashed #8b8bff'});
    });
  }
  function objectGuide(a4, type, id){
    return get(a4, 'snap-guide-'+id, el=>{
      Object.assign(el.style,{position:'absolute',zIndex:1000,pointerEvents:'none',background:'none',display:'none'});
    });
  }
  function showCenter(a4, type, pos){
    const g = centerGuide(a4,type);
    if (type==='v') g.style.left = px(pos); else g.style.top = px(pos);
    g.style.display = 'block';
  }
  function showObject(a4, type, pos, id){
    const g = objectGuide(a4,type,id);
    const color = '#ffb3b3';
    if (type==='v') Object.assign(g.style,{left:px(pos),top:'0',width:'1px',height:'100%',borderLeft:`2px dotted ${color}`,borderTop:'none'});
    else            Object.assign(g.style,{left:'0',top:px(pos),width:'100%',height:'1px',borderTop:`2px dotted ${color}`,borderLeft:'none'});
    g.style.display='block';
  }
  function hideGuidesAll(a4){
    a4.querySelectorAll('#center-v-guide,#center-h-guide,[id^="snap-guide-"]').forEach(g=>g.style.display='none');
  }

  // snapping
  function snapPosition({ a4, box, left, top, width, height }) {
    const { width: aw, height: ah } = r(a4);
    const pageCX = aw/2, pageCY = ah/2;
    const bL=left, bT=top, bR=left+width, bB=top+height, bCX=left+width/2, bCY=top+height/2;

    let bestX=null, bestY=null, minDX=CONFIG.SNAP_TOLERANCE+1, minDY=CONFIG.SNAP_TOLERANCE+1;

    const dx = Math.abs(bCX-pageCX), dy=Math.abs(bCY-pageCY);
    if (dx<=CONFIG.SNAP_TOLERANCE && dx<minDX){ bestX={type:'center',pos:pageCX,val:pageCX-width/2}; minDX=dx; }
    if (dy<=CONFIG.SNAP_TOLERANCE && dy<minDY){ bestY={type:'center',pos:pageCY,val:pageCY-height/2}; minDY=dy; }

    [...a4.querySelectorAll('.worksheet-textbox')].forEach((o,i)=>{
      if (o===box) return;
      const or = r(o), oL=o.offsetLeft, oT=o.offsetTop, oR=oL+or.width, oB=oT+or.height, oCX=oL+or.width/2, oCY=oT+or.height/2;

      // X candidates
      [
        {pos:oL, val:oL,              tag:'left-left'},
        {pos:oR, val:oR,              tag:'right-left'},
        {pos:oR, val:oR-width,        tag:'right-right'},
        {pos:oL, val:oL-width,        tag:'left-right'},
        {pos:oCX,val:oCX-width/2,     tag:'center-center'}
      ].forEach(c=>{
        const d = c.tag.includes('left-left')||c.tag.includes('right-left') ? Math.abs(bL-c.pos)
                : c.tag.includes('right-right')||c.tag.includes('left-right') ? Math.abs(bR-c.pos)
                : Math.abs(bCX-c.pos);
        if (d<=CONFIG.SNAP_TOLERANCE && d<minDX){ minDX=d; bestX={type:'object',pos:c.pos,val:c.val,id:`x-${i}-${c.tag}`}; }
      });

      // Y candidates
      [
        {pos:oT,  val:oT,             tag:'top-top'},
        {pos:oB,  val:oB,             tag:'bottom-top'},
        {pos:oB,  val:oB-height,      tag:'bottom-bottom'},
        {pos:oT,  val:oT-height,      tag:'top-bottom'},
        {pos:oCY, val:oCY-height/2,   tag:'center-center'}
      ].forEach(c=>{
        const d = c.tag.includes('top-top')||c.tag.includes('bottom-top') ? Math.abs(bT-c.pos)
                : c.tag.includes('bottom-bottom')||c.tag.includes('top-bottom') ? Math.abs(bB-c.pos)
                : Math.abs(bCY-c.pos);
        if (d<=CONFIG.SNAP_TOLERANCE && d<minDY){ minDY=d; bestY={type:'object',pos:c.pos,val:c.val,id:`y-${i}-${c.tag}`}; }
      });
    });

    let L=left, T=top, any=false;
    if (bestX){ L=bestX.val; bestX.type==='center' ? showCenter(a4,'v',bestX.pos) : showObject(a4,'v',bestX.pos,bestX.id); any=true; }
    if (bestY){ T=bestY.val; bestY.type==='center' ? showCenter(a4,'h',bestY.pos) : showObject(a4,'h',bestY.pos,bestY.id); any=true; }
    if (!any) hideGuidesAll(a4);
    return { left:L, top:T, snapped:any };
  }

  // edge detection + cursor (safer with getBoundingClientRect math)
  function edgeAt(box, e, hit=CONFIG.RESIZE_HIT_ZONE){
    // Always calculate relative to the textbox, even if event target is a child element
    const rect = box.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const right = rect.width - x;
    const bottom = rect.height - y;
    
    // Check for corner hits first (higher priority)
    if (x < hit && y < hit) return 'nw';
    if (right < hit && y < hit) return 'ne';
    if (x < hit && bottom < hit) return 'sw';
    if (right < hit && bottom < hit) return 'se';
    
    // Check for edge hits (excluding corners)
    if (right < hit && y > hit && y < rect.height - hit) return 'e';
    if (x < hit && y > hit && y < rect.height - hit) return 'w';
    if (bottom < hit && x > hit && x < rect.width - hit) return 's';
    if (y < hit && x > hit && x < rect.width - hit) return 'n';
    
    return '';
  }
  function cursorFor(edge){
    return edge==='e'?'e-resize':edge==='w'?'w-resize':edge==='s'?'s-resize':edge==='n'?'n-resize'
         :edge==='se'?'se-resize':edge==='ne'?'ne-resize':edge==='sw'?'sw-resize':edge==='nw'?'nw-resize':'default';
  }

  // one set of global pointer handlers
  document.addEventListener('pointermove', e => {
    const a = Session.active; if (!a) return;
    let dx=e.clientX-a.x0, dy=e.clientY-a.y0;
    let w=a.w0, h=a.h0, L=a.l0, T=a.t0;

    if (a.edge.includes('e')) w = Math.max(CONFIG.MIN_WIDTH,  a.w0 + dx);
    if (a.edge.includes('s')) h = Math.max(CONFIG.MIN_HEIGHT, a.h0 + dy);
    if (a.edge.includes('w')) { w = Math.max(CONFIG.MIN_WIDTH,  a.w0 - dx); L = a.l0 + (a.w0 - w); }
    if (a.edge.includes('n')) { h = Math.max(CONFIG.MIN_HEIGHT, a.h0 - dy); T = a.t0 + (a.h0 - h); }

    const s = snapPosition({ a4:a.a4, box:a.box, left:L, top:T, width:w, height:h });

    Object.assign(a.box.style,{ width:px(w), height:px(h), left:px(s.left), top:px(s.top) });
    a.boxData.width  = a.box.style.width;
    a.boxData.height = a.box.style.height;
    a.boxData.left   = a.box.style.left;
    a.boxData.top    = a.box.style.top;

    a.updateHandlePosition && a.updateHandlePosition();
    a.updateSelectionFrame && a.updateSelectionFrame();
  });
  document.addEventListener('pointerup', () => {
    const a = Session.active; if (!a) return;
    a.box.classList.remove('resizing');
    hideGuidesAll(a.a4);
    Session.active = null;
    a.justResized.flag = true; setTimeout(()=>a.justResized.flag=false,100);
    window.worksheetHistory?.saveToHistory?.('resize textbox');
    setUserSelect(a.box, true);
  });

  // main
  function setupTextboxEvents(box, boxData, a4, updateHandlePosition, updateSelectionFrame, selectionFrame, dragHandle) {
    const justResized = { flag:false };

    function autoHeight(){
      // Use initialHeight for consistent auto-resize minimum, not current height
      const min = parseInt(boxData.initialHeight || boxData.height || 400, 10);
      box.style.height = 'auto';
      let h = box.scrollHeight + 4;
      box.style.height = px(h < min ? min : h);
      boxData.height = box.style.height;
    }

    // keys: arrows move in select mode; undo/redo delegated
    box.addEventListener('keydown', e=>{
      const arrows = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
      if (box.contentEditable === 'false' && arrows.includes(e.key)){
        e.preventDefault();
        const step = e.shiftKey ? CONFIG.KEYBOARD_STEP_LARGE : CONFIG.KEYBOARD_STEP_SMALL;
        let L=num(box.style.left), T=num(box.style.top);
        if (e.key==='ArrowLeft')  L-=step;
        if (e.key==='ArrowRight') L+=step;
        if (e.key==='ArrowUp')    T-=step;
        if (e.key==='ArrowDown')  T+=step;
        const s = snapPosition({ a4, box, left:L, top:T, width:box.offsetWidth, height:box.offsetHeight });
        box.style.left = px(s.left); box.style.top = px(s.top);
        box.classList.add('selected');
        boxData.left = box.style.left; boxData.top = box.style.top;
        updateHandlePosition && updateHandlePosition();
        updateSelectionFrame && updateSelectionFrame();
        window.saveToHistory?.('move textbox');
        return;
      }
      if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); (window.undo||window.worksheetHistory?.undo)?.(); }
      if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='y'){ e.preventDefault(); (window.redo||window.worksheetHistory?.redo)?.(); }
    });
    box.addEventListener('keyup', e=>{
      if (box.contentEditable==='false' && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) hideGuidesAll(a4);
    });

    // start resize from edges
    box.addEventListener('pointerdown', e=>{
      if (box.contentEditable!=='false') return;
      const edge = edgeAt(box,e); if (!edge) return;
      e.preventDefault(); setUserSelect(box,false); box.classList.add('resizing');
      const br=r(box), pr=r(a4);
      Session.active = {
        box, boxData, a4, edge,
        x0:e.clientX, y0:e.clientY,
        w0:br.width, h0:br.height,
        l0:br.left-pr.left, t0:br.top-pr.top,
        updateHandlePosition, updateSelectionFrame,
        justResized
      };
      box.setPointerCapture?.(e.pointerId);
    });

    // cursor hints (robust with nested elements)
    box.addEventListener('pointermove', e=>{
      if (box.contentEditable!=='false'){ box.style.cursor='text'; return; }
      // Use the textbox element for edge detection regardless of event target
      box.style.cursor = cursorFor(edgeAt(box, e));
    });

    // click to edit, unless resize just happened
    box.addEventListener('click', ()=>{
      if (justResized.flag || box.contentEditable==='true') return;
      box.contentEditable = true;
      setUserSelect(box,true);
      box.classList.remove('selected');
      updateSelectionFrame && updateSelectionFrame();
      setTimeout(()=>box.focus(),0);
    });

    // default to select mode on init
    function enterSelect(){
      box.contentEditable = false;
      setUserSelect(box,false);
      box.classList.add('selected');
      box.setAttribute('tabindex','0');
      box.focus();
      updateSelectionFrame && updateSelectionFrame();
    }
    box.enterDragSelectMode = enterSelect;
    enterSelect();

    // hover hooks
    box.addEventListener('pointerenter', ()=>{ box.classList.add('hover-highlight'); updateSelectionFrame && updateSelectionFrame(); });
    box.addEventListener('pointerleave', ()=>{ box.classList.remove('hover-highlight'); updateSelectionFrame && updateSelectionFrame(); });

    // outside click -> deselect or exit edit; respect optional selectionFrame/dragHandle
    document.addEventListener('pointerdown', e=>{
      const t=e.target, inSel=selectionFrame && (t===selectionFrame || selectionFrame.contains(t)), inHandle=dragHandle && (t===dragHandle || dragHandle.contains(t));
      if (t!==box && !box.contains(t) && !inSel && !inHandle){
        if (box.classList.contains('selected')){ box.classList.remove('selected'); updateSelectionFrame && updateSelectionFrame(); }
        if (box.contentEditable==='true'){ enterSelect(); box.blur(); }
      }
    });

    // blur -> back to select
    box.addEventListener('blur', ()=>{
      if (box.contentEditable==='true') enterSelect();
      box.style.cursor='default';
      toggleEmpty(box);
    });

    // input -> sync, placeholder, autoheight, debounced history
    box.addEventListener('input', ()=>{
      boxData.text = box.innerText;
      boxData.html = box.innerHTML;
      toggleEmpty(box);
      autoHeight();
      window.worksheetState?.getDebouncedSaveTextHistory?.()();
    });

    setTimeout(autoHeight,0);

    // persist font changes
    const styleObserver = new MutationObserver(m=>{
      m.forEach(x=>{
        if (x.type==='attributes' && x.attributeName==='style'){
          const cs=getComputedStyle(box);
          if (cs.fontFamily && cs.fontFamily!==boxData.fontFamily) boxData.fontFamily = cs.fontFamily;
          if (cs.fontSize   && cs.fontSize  !==boxData.fontSize)   boxData.fontSize   = cs.fontSize;
        }
      });
    });
    styleObserver.observe(box,{attributes:true,attributeFilter:['style']});

    // toolbar + context
    const sync=()=>{ window.worksheetState?.setLastTextbox?.(box); window.updateToolbarFromBox?.(box); window.showTextToolbar?.(box); };
    box.addEventListener('focus', ()=>{ box.style.cursor='text'; toggleEmpty(box); sync(); });
    box.addEventListener('click', sync);
    box.addEventListener('contextmenu', e=>{ e.preventDefault(); window.showTextboxContextMenu?.(e,box); });

    toggleEmpty(box);

    // cleanup method for proper disposal
    function destroyTextbox(){
      styleObserver.disconnect();
      hideGuidesAll(a4);
      // Clear any active session if this box is active
      if (Session.active && Session.active.box === box) {
        Session.active = null;
      }
      // Note: Individual event listeners are automatically cleaned up when element is removed from DOM
      // but MutationObserver needs explicit cleanup to prevent memory leaks
    }

    // helpers exposed
    function hideGuides(){ hideGuidesAll(a4); }
    function snapToCenter(left, top, width, height){
      const s = snapPosition({ a4, box, left:num(left), top:num(top), width, height });
      return { left:px(s.left), top:px(s.top), snapped:s.snapped };
    }
    return { snapToCenter, hideGuides, destroyTextbox };
  }

  window.textboxEvents = { setupTextboxEvents };
})();
