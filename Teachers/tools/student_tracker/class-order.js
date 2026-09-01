(() => {
  const API_URL = '/.netlify/functions/class_order';
  const state = {
    canEdit: false,
    editing: false,
    savedOrder: [],
    dragging: null,
    pointerId: null,
    observer: null,
    applying: false
  };

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  async function apiFetch(options = {}) {
    if (window.WillenaAPI && typeof window.WillenaAPI.fetch === 'function') {
      return window.WillenaAPI.fetch(API_URL, options);
    }
    return fetch(API_URL, { credentials: 'include', ...options });
  }

  function getClassList() {
    return document.getElementById('classList');
  }

  function getItems() {
    const list = getClassList();
    return list ? Array.from(list.querySelectorAll(':scope > .class-item')) : [];
  }

  function classKey(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function applySavedOrder() {
    if (state.applying || state.editing) return;
    const list = getClassList();
    const items = getItems();
    if (!list || !items.length || !state.savedOrder.length) return;

    state.applying = true;
    const rank = new Map(state.savedOrder.map((name, index) => [classKey(name), index]));
    const originalIndex = new Map(items.map((item, index) => [item, index]));
    items
      .slice()
      .sort((a, b) => {
        const aRank = rank.has(classKey(a.dataset.class)) ? rank.get(classKey(a.dataset.class)) : Number.MAX_SAFE_INTEGER;
        const bRank = rank.has(classKey(b.dataset.class)) ? rank.get(classKey(b.dataset.class)) : Number.MAX_SAFE_INTEGER;
        return (aRank - bRank) || (originalIndex.get(a) - originalIndex.get(b));
      })
      .forEach(item => list.appendChild(item));
    state.applying = false;
  }

  function ensureStyles() {
    if (document.getElementById('class-order-styles')) return;
    const style = document.createElement('style');
    style.id = 'class-order-styles';
    style.textContent = `
      #class-order-controls { display:flex; align-items:center; gap:8px; margin-left:auto; }
      #class-order-edit, #class-order-done, #class-order-cancel {
        border:1px solid #d9e2e7; background:#fff; color:#19777e; border-radius:9px;
        padding:6px 10px; font:600 .78rem/1 Poppins, sans-serif; cursor:pointer;
      }
      #class-order-done { background:#19777e; color:#fff; border-color:#19777e; }
      #class-order-cancel { color:#64748b; }
      #class-order-status { font-size:.72rem; color:#64748b; min-height:1em; }
      #classList.class-order-editing .class-item { cursor:default; user-select:none; position:relative; padding-left:42px; }
      #classList.class-order-editing .class-item:hover { transform:none; }
      .class-order-handle {
        display:none; position:absolute; left:9px; top:50%; transform:translateY(-50%);
        width:26px; height:30px; border:0; background:transparent; color:#64748b;
        font-size:19px; line-height:1; cursor:grab; touch-action:none; padding:0; border-radius:7px;
      }
      #classList.class-order-editing .class-order-handle { display:flex; align-items:center; justify-content:center; }
      .class-order-handle:active { cursor:grabbing; background:#eef7f7; }
      #classList .class-item.class-order-dragging {
        opacity:.65; transform:scale(.985); box-shadow:0 8px 20px rgba(15,23,42,.12); z-index:5;
      }
      #classList.class-order-editing .visibility-badge { pointer-events:none; opacity:.55; }
      #classList.class-order-editing .class-item::after {
        content:'Drag to reorder'; margin-left:auto; margin-right:8px; font-size:.68rem; color:#94a3b8; font-weight:500;
      }
      @media (max-width: 700px) {
        #class-order-controls { gap:5px; }
        #class-order-edit, #class-order-done, #class-order-cancel { padding:6px 8px; }
        #classList.class-order-editing .class-item::after { content:''; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureHandle(item) {
    let handle = item.querySelector('.class-order-handle');
    if (handle) return handle;
    handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'class-order-handle';
    handle.setAttribute('aria-label', `Move ${item.dataset.display || item.dataset.class || 'class'}`);
    handle.title = 'Drag to reorder';
    handle.textContent = '⠿';
    handle.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener('pointerdown', startDrag);
    item.insertBefore(handle, item.firstChild);
    return handle;
  }

  function decorateItems() {
    getItems().forEach(ensureHandle);
  }

  function setStatus(text, isError = false) {
    const el = document.getElementById('class-order-status');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#b91c1c' : '#64748b';
  }

  function ensureControls() {
    if (!state.canEdit) return;
    const list = getClassList();
    if (!list) return;
    const card = list.closest('.card');
    const title = card && card.querySelector('.section-title');
    if (!title || document.getElementById('class-order-controls')) return;

    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.gap = '8px';

    const label = document.createElement('span');
    label.textContent = title.textContent.trim() || 'Classes';
    title.textContent = '';
    title.appendChild(label);

    const controls = document.createElement('div');
    controls.id = 'class-order-controls';
    controls.innerHTML = `
      <span id="class-order-status" aria-live="polite"></span>
      <button id="class-order-edit" type="button">Edit Order</button>
      <button id="class-order-cancel" type="button" hidden>Cancel</button>
      <button id="class-order-done" type="button" hidden>Done</button>
    `;
    title.appendChild(controls);

    document.getElementById('class-order-edit').addEventListener('click', beginEditing);
    document.getElementById('class-order-cancel').addEventListener('click', cancelEditing);
    document.getElementById('class-order-done').addEventListener('click', saveEditing);
  }

  function setEditingUI(editing) {
    state.editing = editing;
    const list = getClassList();
    if (list) list.classList.toggle('class-order-editing', editing);
    const edit = document.getElementById('class-order-edit');
    const done = document.getElementById('class-order-done');
    const cancel = document.getElementById('class-order-cancel');
    if (edit) edit.hidden = editing;
    if (done) done.hidden = !editing;
    if (cancel) cancel.hidden = !editing;
    if (editing) decorateItems();
  }

  function beginEditing(event) {
    event?.preventDefault();
    state.beforeEditOrder = getItems().map(item => item.dataset.class);
    setStatus('Drag the handles, then press Done.');
    setEditingUI(true);
  }

  function restoreOrder(order) {
    const list = getClassList();
    if (!list || !Array.isArray(order)) return;
    const byKey = new Map(getItems().map(item => [classKey(item.dataset.class), item]));
    order.forEach(name => {
      const item = byKey.get(classKey(name));
      if (item) list.appendChild(item);
    });
  }

  function cancelEditing(event) {
    event?.preventDefault();
    restoreOrder(state.beforeEditOrder || state.savedOrder);
    setEditingUI(false);
    setStatus('');
  }

  async function saveEditing(event) {
    event?.preventDefault();
    const done = document.getElementById('class-order-done');
    if (done) done.disabled = true;
    const order = getItems().map(item => item.dataset.class).filter(Boolean);
    setStatus('Saving…');
    try {
      const response = await apiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      state.savedOrder = Array.isArray(data.order) ? data.order : order;
      state.beforeEditOrder = null;
      setEditingUI(false);
      setStatus('Saved');
      setTimeout(() => setStatus(''), 1600);
    } catch (error) {
      console.warn('[class-order] save failed', error);
      setStatus('Could not save order', true);
    } finally {
      if (done) done.disabled = false;
    }
  }

  function startDrag(event) {
    if (!state.editing || event.button !== undefined && event.button !== 0) return;
    const handle = event.currentTarget;
    const item = handle.closest('.class-item');
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    state.dragging = item;
    state.pointerId = event.pointerId;
    item.classList.add('class-order-dragging');
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    handle.addEventListener('pointermove', moveDrag);
    handle.addEventListener('pointerup', endDrag, { once: true });
    handle.addEventListener('pointercancel', endDrag, { once: true });
  }

  function moveDrag(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    event.preventDefault();
    const list = getClassList();
    if (!list) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.class-item');
    if (!target || target === state.dragging || target.parentElement !== list) return;
    const rect = target.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    list.insertBefore(state.dragging, before ? target : target.nextSibling);
  }

  function endDrag(event) {
    const handle = event.currentTarget;
    if (state.dragging) state.dragging.classList.remove('class-order-dragging');
    if (handle) {
      handle.removeEventListener('pointermove', moveDrag);
      try { handle.releasePointerCapture(event.pointerId); } catch (_) {}
    }
    state.dragging = null;
    state.pointerId = null;
  }

  function blockClassClicksWhileEditing() {
    const list = getClassList();
    if (!list || list.dataset.orderClickGuard === '1') return;
    list.dataset.orderClickGuard = '1';
    list.addEventListener('click', event => {
      if (!state.editing) return;
      if (event.target.closest('.class-order-handle')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function watchList() {
    const list = getClassList();
    if (!list || state.observer) return;
    state.observer = new MutationObserver(() => {
      if (state.applying) return;
      decorateItems();
      blockClassClicksWhileEditing();
      window.requestAnimationFrame(applySavedOrder);
    });
    state.observer.observe(list, { childList: true });
  }

  async function loadOrder() {
    try {
      const response = await apiFetch();
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      state.canEdit = data.can_edit === true;
      state.savedOrder = Array.isArray(data.order) ? data.order : [];
      ensureControls();
      applySavedOrder();
    } catch (error) {
      console.warn('[class-order] load failed', error);
    }
  }

  function init() {
    if (!location.pathname.includes('/Teachers/tools/student_tracker/')) return;
    ensureStyles();
    const waitForList = () => {
      const list = getClassList();
      if (!list) {
        setTimeout(waitForList, 100);
        return;
      }
      decorateItems();
      blockClassClicksWhileEditing();
      watchList();
      loadOrder();
    };
    waitForList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
