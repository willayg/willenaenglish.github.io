// Reusable Student Header Web Component
// Usage: <student-header home-href="/index.html" home-label="Home"></student-header>

class StudentHeader extends HTMLElement {
  static get observedAttributes() {
    return ["home-href", "home-label", "title", "show-id", "show-home", "show-points", "show-logout"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  this._onStorage = this._onStorage.bind(this);
  this._fetchingPoints = false;
  // Identity fields hydrated from server session
  this._name = null;
  this._avatar = null;
  this._uid = null;
  this._onFocus = this._onFocus.bind(this);
  this._onPointsUpdate = (e) => {
    try {
      const total = e?.detail?.total;
      if (typeof total === 'number') {
        this._points = total;
        this.refresh();
      }
    } catch {}
  };
  this._points = null;
  }

  attributeChangedCallback() {
    // Re-render on attribute changes to reflect new props
    if (this.isConnected) this.render();
  }

  connectedCallback() {
    this.render();
    // Update if user data changes in this or other tabs
    window.addEventListener("storage", this._onStorage);
  window.addEventListener('points:update', this._onPointsUpdate);
  // Hydrate identity from server session and refresh on focus changes
  this._hydrateProfile();
  window.addEventListener('focus', this._onFocus);
    // If points not yet known, fetch once to seed
    if (this._points == null && !this._fetchingPoints) {
      this._fetchingPoints = true;
      fetch('/.netlify/functions/progress_summary?section=overview', { credentials: 'include', cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(ov => { if (ov && typeof ov.points === 'number') { this._points = ov.points; this.refresh(); } })
        .catch(() => {})
        .finally(() => { this._fetchingPoints = false; });
    }
  }

  disconnectedCallback() {
    window.removeEventListener("storage", this._onStorage);
  window.removeEventListener('points:update', this._onPointsUpdate);
  window.removeEventListener('focus', this._onFocus);
  }

  refresh() { this.render(); }

  _onStorage(e) {
    // Only re-render if relevant keys change
  if (["user_name", "user_id", "selectedEmojiAvatar"].includes(e.key)) {
      this.render();
    }
  }

  async _hydrateProfile() {
    try {
      const whoRes = await fetch('/.netlify/functions/supabase_auth?action=whoami', { credentials: 'include', cache: 'no-store' });
      const who = await whoRes.json();
      if (!who || !who.success || !who.user_id) return;
      this._uid = who.user_id;
      const profRes = await fetch('/.netlify/functions/supabase_auth?action=get_profile_name', { credentials: 'include', cache: 'no-store' });
      const prof = await profRes.json();
      if (prof && prof.success) {
        this._name = prof.name || prof.username || null;
        this._avatar = prof.avatar || null;
        // Sync simple identity into storage for other parts of the site (no tokens)
        try {
          if (this._name) {
            localStorage.setItem('user_name', this._name);
            localStorage.setItem('username', this._name);
          }
          if (this._uid) localStorage.setItem('user_id', this._uid);
          if (this._avatar) {
            localStorage.setItem('selectedEmojiAvatar', this._avatar);
            localStorage.setItem('avatar', this._avatar);
          }
        } catch {}
        this.refresh();
      }
    } catch {
      // ignore fetch errors; keep any existing values
    }
  }

  _onFocus() { this._hydrateProfile(); }

  get homeHref() {
    return this.getAttribute("home-href") || "/index.html";
  }

  get homeLabel() {
    return this.getAttribute("home-label") || "Home";
  }

  get pageTitle() {
    return this.getAttribute("title") || "";
  }

  get showId() {
  // Default to false unless attribute present (empty or true)
  const v = this.getAttribute("show-id");
  return v === "" || v === "true";
  }

  get showHome() {
    // Default true unless explicitly set to false
    const v = this.getAttribute("show-home");
    return v === null || v === "" || v === "true";
  }

  get showPoints() {
    // Default true unless explicitly set to false
    const v = this.getAttribute("show-points");
    return v === null || v === "" || v === "true";
  }

  get showLogout() {
    // Default true unless explicitly set to false
    const v = this.getAttribute("show-logout");
    return v === null || v === "" || v === "true";
  }

  render() {
    const name = this._name ||
      localStorage.getItem("user_name") || sessionStorage.getItem("user_name") ||
      localStorage.getItem("username") || sessionStorage.getItem("username") ||
      localStorage.getItem("name") || sessionStorage.getItem("name") ||
      "Guest";
    const uid = this._uid ||
      localStorage.getItem("user_id") || sessionStorage.getItem("user_id") ||
      localStorage.getItem("userId") || sessionStorage.getItem("userId") ||
      localStorage.getItem("student_id") || sessionStorage.getItem("student_id") ||
      localStorage.getItem("profile_id") || sessionStorage.getItem("profile_id") ||
      localStorage.getItem("id") || sessionStorage.getItem("id") ||
      null;
    const avatar = this._avatar ||
      localStorage.getItem("selectedEmojiAvatar") || sessionStorage.getItem("selectedEmojiAvatar") ||
      localStorage.getItem("avatar") || sessionStorage.getItem("avatar") ||
      "🙂";

  const points = (this.showPoints && typeof this._points === 'number') ? this._points : null;

    this.shadowRoot.innerHTML = `
      <style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
        :host { display:block; }
        header { position:sticky; top:0; background:#fff; border-bottom:1px solid #e6eaef; padding:10px 8px 8px; z-index:10; min-width:0; width:100vw; box-sizing:border-box; }
  .top { display:flex; flex-direction:row; align-items:center; gap:10px; font-family: 'Poppins', system-ui, Segoe UI, Arial, sans-serif; justify-content: center; min-width:0; }
  .title { font-weight:800; color: var(--pri, #19777e); text-align:center; }
  .info { display:flex; flex-direction:column; gap:2px; align-items:center; }
  .points-pill { display:inline-flex; align-items:center; gap:6px; padding:3px 8px; border-radius:999px; background:#f7fcfd; border:1px solid #a9d6e9; color:#19777e; font-weight:700; font-size:12px; line-height:1; width:max-content; }
  .points-pill svg { width:14px; height:14px; display:block; }
  .page-title { display:flex; align-items:center; gap:8px; font-weight:800; color: var(--pri, #19777e); margin:0 auto; justify-content:center; text-align:center; min-width:0; }
  .page-title ::slotted(img), .page-title ::slotted(svg) { height: 4em; max-height: 4em; display:block; margin-left:auto; margin-right:auto; }
  .spacer { flex:1; }
  .btn { border:1px solid var(--acc, #93cbcf); background: var(--acc, #93cbcf); color:#fff; padding:8px 12px; border-radius:10px; cursor:pointer; font-weight:700; }
  .avatar { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#fff; border:2px solid var(--pri, #19777e); font-size:22px; }
  .avatar-btn { cursor:pointer; }
        .mut { color: var(--mut, #666); font-size:12px; text-align:center; }
        button.btn:focus { outline: 2px solid var(--pri, #30b5beff); outline-offset:2px; }
  /* Avatar dropdown */
  .menu-anchor { position: relative; }
  .dropdown {
    position: absolute;
    right: 20px;
    top: calc(100% + 8px);
    background: #fff;
    border: 1px solid #e6eaef;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,.12);
    min-width: 180px;
    max-width: 90vw;
    padding: 8px;
    display: none;
    z-index: 1000;
    overflow-x: auto;
  }
  @media (max-width: 520px) {
    .dropdown {
      left: auto;
      right: 0;
      min-width: 140px;
      max-width: 96vw;
      top: calc(100% + 4px);
      font-size: 1.08em;
    }
  }
  .dropdown.open { display:block; }
  .dd-item { display:flex; align-items:center; gap:10px; width:100%; text-align:left; border:1px solid transparent; background:#fff; border-radius:10px; padding:10px 12px; cursor:pointer; font-weight:700; color: #19777e; }
  .dd-item:hover, .dd-item:focus { background:#f7fcfd; border-color:#e6eaef; outline:none; }
        .menu-row {
          margin-top:8px; padding-top:8px; border-top:1px solid #eef2f5;
          font-family: 'Poppins', system-ui, Segoe UI, Arial, sans-serif;
          overflow-x: auto; scrollbar-width: thin; -webkit-overflow-scrolling: touch;
          white-space: nowrap;
        }
        .menu-track {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 18px;
        }
    /* Hide scrollbar for all browsers */
    .menu-row::-webkit-scrollbar { display: none; }
    .menu-row { scrollbar-width: none; scroll-behavior: smooth; }
        /* Modern tab-like menu items */
        ::slotted(.menu-item) {
          display:inline-block; margin-right:16px; padding:8px 0; text-decoration:none; cursor:pointer;
          color: var(--pri, #19777e); font-weight:700; border:none; background:transparent; text-underline-offset: 3px;
          border-bottom: 3px solid transparent; line-height:1;
          font-family: 'Poppins', system-ui, Segoe UI, Arial, sans-serif !important;
          white-space: nowrap; flex: 0 0 auto; text-decoration: none !important;
          -webkit-appearance:none; appearance:none;
          transition: background .18s, color .18s;
        }
        ::slotted(.menu-item:not(:first-child)) { margin-left:8px; padding-left:16px; border-left:1px solid #e6eaef; }
        /* Subtle color change on hover, focus, and active */
        ::slotted(.menu-item:hover),
        ::slotted(.menu-item:focus),
        ::slotted(.menu-item:active) {
          background: #eaf4f7;
          color: #19777e;
          outline: none;
        }
        ::slotted(.menu-item:focus) { outline: 2px solid var(--acc, #93cbcf); outline-offset:2px; }
        ::slotted(.menu-item.active) { border-bottom-color: var(--pri, #19777e); background: #f7fcfd; }
        /* Remove native button look */
        ::slotted(button.menu-item) { -webkit-appearance:none; appearance:none; background:transparent; border:none; }
        /* Disabled look */
        ::slotted(.menu-item.disabled) { color: var(--mut, #666); opacity:.6; pointer-events:none; border-bottom-color: transparent; }
      </style>
      <header>
        <div class="top">
          <div class="info">
            <div class="title" id="name" part="name">${name || "Profile"}</div>
            ${points != null ? `<div class="points-pill" title="Total points">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v3h3a1 1 0 010 2h-3v3a1 1 0 01-2 0v-3H8a1 1 0 010-2h3V7a1 1 0 012 0z" fill="currentColor"/></svg>
              <span id="pointsVal">${points}</span>
            </div>` : ''}
            ${this.showId ? `<div class="mut" id="id" part="id">${uid ? `ID: ${uid}` : "Not signed in"}</div>` : ""}
          </div>
          <div class="spacer"></div>
          <div class="page-title" id="pageTitle" part="page-title">
            <slot name="title"></slot>
            <span class="page-title-text" part="page-title-text">${this.pageTitle || ""}</span>
          </div>
          <slot name="actions"></slot>
          ${this.showHome ? `<a class="menu-item" id="homeBtn" part="home-button" href="${this.homeHref}">${this.homeLabel}</a>` : ""}
          <div class="menu-anchor">
            <button class="avatar avatar-btn" id="avatarBtn" part="avatar" aria-haspopup="menu" aria-expanded="false" title="Account">${avatar}</button>
            <div class="dropdown" id="avatarMenu" role="menu" aria-label="Account menu">
              <a class="dd-item" role="menuitem" href="/students/dashboard.html">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z" fill="#19777e"/></svg>
                Dashboard
              </a>
              <a class="dd-item" role="menuitem" href="/Games/Word%20Arcade/index.html">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><circle cx="12" cy="12" r="10" fill="#19777e"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="#fff">W</text></svg>
                Word Arcade
              </a>
              <a class="dd-item" role="menuitem" href="/Games/GrammarArcade/index.html">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><rect x="4" y="4" width="16" height="16" rx="4" fill="#19777e"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="#fff">G</text></svg>
                Grammar Arcade
              </a>
              <a class="dd-item" role="menuitem" href="/students/profile.html">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><path d="M12 12c2.7 0 8 1.34 8 4v4H4v-4c0-2.66 5.3-4 8-4zm0-2a4 4 0 100-8 4 4 0 000 8z" fill="#19777e"/></svg>
                Profile
              </a>
            </div>
          </div>
        </div>
        <div class="menu-row" id="menuRow">
          <div class="menu-track">
            <slot name="menu"></slot>
            <slot name="menu-item"></slot>
          </div>
        </div>
      </header>
    `;

  // No JS click handler needed for <a> element; browser handles navigation

    // Title slot vs text: if title slot has content, hide text; hide entire container if neither
    const pageTitleEl = this.shadowRoot.getElementById('pageTitle');
    const titleSlot = this.shadowRoot.querySelector('slot[name="title"]');
    const titleText = this.shadowRoot.querySelector('.page-title-text');
    const updateTitle = () => {
      if (!pageTitleEl) return;
      const hasSlotContent = titleSlot && titleSlot.assignedNodes({ flatten: true })
        .some(n => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim().length));
      if (hasSlotContent) {
        if (titleText) titleText.style.display = 'none';
        pageTitleEl.style.display = '';
      } else {
        const hasText = !!(titleText && titleText.textContent && titleText.textContent.trim().length);
        if (titleText) titleText.style.display = hasText ? '' : 'none';
        pageTitleEl.style.display = hasText ? '' : 'none';
      }
    };
    if (titleSlot) {
      titleSlot.addEventListener('slotchange', updateTitle);
      updateTitle();
    } else {
      // Fallback if no slot for some reason
      if (pageTitleEl && titleText && !titleText.textContent.trim()) pageTitleEl.style.display = 'none';
    }

    // Hide menu row if no assigned nodes
    const menuSlots = this.shadowRoot.querySelectorAll('slot[name="menu"], slot[name="menu-item"]');
    const menuRow = this.shadowRoot.getElementById('menuRow');
    if (menuSlots.length && menuRow) {
      const updateActive = () => {
        const els = Array.from(menuSlots).flatMap(s => s.assignedElements());
        els.forEach(el => {
          if (el.classList.contains('menu-item') && el.tagName === 'A' && el.href) {
            try {
              const u = new URL(el.href, window.location.origin);
              if (window.location.pathname.startsWith(u.pathname)) el.classList.add('active');
              else el.classList.remove('active');
            } catch { /* ignore invalid href */ }
          }
        });
        // Scroll active into view
        const active = els.find(el => el.classList && el.classList.contains('menu-item') && el.classList.contains('active'));
        if (active) {
          active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      };
      const updateMenuVisibility = () => {
        const has = Array.from(menuSlots).some(s => s.assignedNodes({ flatten: true }).some(n => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim().length)));
        menuRow.style.display = has ? '' : 'none';
        updateActive();
      };
      menuSlots.forEach(s => s.addEventListener('slotchange', updateMenuVisibility));
      updateMenuVisibility();
    }

  // If points are enabled and missing, try to fetch from overview once
  if (this.showPoints && points == null && !this._fetchingPoints) {
      this._fetchingPoints = true;
      fetch('/.netlify/functions/progress_summary?section=overview', { credentials: 'include', cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(ov => {
          if (ov && typeof ov.points === 'number') {
      this._points = ov.points;
      if (typeof this.refresh === 'function') this.refresh(); else this.render();
          }
        })
        .catch(() => {})
        .finally(() => { this._fetchingPoints = false; });
    }

    // Avatar dropdown
    const avatarBtn = this.shadowRoot.getElementById('avatarBtn');
    const avatarMenu = this.shadowRoot.getElementById('avatarMenu');
    const toggleMenu = (open) => {
      if (!avatarBtn || !avatarMenu) return;
      const willOpen = open != null ? open : !avatarMenu.classList.contains('open');
      avatarMenu.classList.toggle('open', willOpen);
      avatarBtn.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        const first = avatarMenu.querySelector('.dd-item');
        if (first) first.focus();
      }
    };
    const onDocClick = (e) => {
      if (!avatarBtn || !avatarMenu) return;
      const path = e.composedPath ? e.composedPath() : [];
      const inside = path.includes(avatarBtn) || path.includes(avatarMenu);
      if (!inside) toggleMenu(false);
    };
    if (avatarBtn && avatarMenu) {
      avatarBtn.addEventListener('click', () => toggleMenu());
      document.addEventListener('click', onDocClick, { capture: true });
      this._cleanupDocClick = () => document.removeEventListener('click', onDocClick, { capture: true });
      avatarBtn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(true); } });
      avatarMenu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); toggleMenu(false); avatarBtn.focus(); } });
    }

    // Logout wiring
    const doLogout = async () => {
      // Clear identity crumbs so UI doesn't show stale data before server hydrate
      try {
        const keys = ['user_name','username','name','user_id','userId','student_id','profile_id','id','selectedEmojiAvatar','avatar'];
        keys.forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
      } catch {}
      try { await fetch('/.netlify/functions/supabase_auth?action=logout', { method:'POST', credentials:'include' }); } catch {}
      const next = encodeURIComponent(location.pathname);
      window.location.href = `/students/login.html?next=${next}`;
    };
    const logoutBtn = this.shadowRoot.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    const logoutAction = this.shadowRoot.getElementById('logoutAction');
    if (logoutAction) logoutAction.addEventListener('click', doLogout);
  }
}

customElements.define("student-header", StudentHeader);
