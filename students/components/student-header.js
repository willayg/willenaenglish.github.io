// Reusable Student Header Web Component
// Usage: <student-header home-href="/index.html" home-label="Home"></student-header>

class StudentHeader extends HTMLElement {
  static get observedAttributes() {
  return ["home-href", "home-label", "title", "show-id", "show-home"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  this._onStorage = this._onStorage.bind(this);
  this._fetchingPoints = false;
  }

  attributeChangedCallback() {
    // Re-render on attribute changes to reflect new props
    if (this.isConnected) this.render();
  }

  connectedCallback() {
    this.render();
    // Update if user data changes in this or other tabs
    window.addEventListener("storage", this._onStorage);
  }

  disconnectedCallback() {
    window.removeEventListener("storage", this._onStorage);
  }

  refresh() { this.render(); }

  _onStorage(e) {
    // Only re-render if relevant keys change
  if (["user_name", "user_id", "selectedEmojiAvatar", "user_points"].includes(e.key)) {
      this.render();
    }
  }

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

  render() {
    const name =
      localStorage.getItem("user_name") || sessionStorage.getItem("user_name") ||
      localStorage.getItem("username") || sessionStorage.getItem("username") ||
      localStorage.getItem("name") || sessionStorage.getItem("name") ||
      "Guest";
    const uid =
      localStorage.getItem("user_id") || sessionStorage.getItem("user_id") ||
      localStorage.getItem("userId") || sessionStorage.getItem("userId") ||
      localStorage.getItem("student_id") || sessionStorage.getItem("student_id") ||
      localStorage.getItem("profile_id") || sessionStorage.getItem("profile_id") ||
      localStorage.getItem("id") || sessionStorage.getItem("id") ||
      null;
    const avatar =
      localStorage.getItem("selectedEmojiAvatar") || sessionStorage.getItem("selectedEmojiAvatar") ||
      localStorage.getItem("avatar") || sessionStorage.getItem("avatar") ||
      "🙂";

  const rawPts = localStorage.getItem("user_points");
    const points = rawPts != null && !isNaN(Number(rawPts)) ? Number(rawPts) : null;

    this.shadowRoot.innerHTML = `
      <style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
        :host { display:block; }
        header { position:sticky; top:0; background:#fff; border-bottom:1px solid #e6eaef; padding:10px 14px 8px; z-index:10; }
  .top { display:flex; align-items:center; gap:10px; font-family: 'Poppins', system-ui, Segoe UI, Arial, sans-serif; }
  .title { font-weight:800; color: var(--pri, #19777e); }
  .info { display:flex; flex-direction:column; gap:2px; }
  .points-pill { display:inline-flex; align-items:center; gap:6px; padding:3px 8px; border-radius:999px; background:#f7fcfd; border:1px solid #a9d6e9; color:#19777e; font-weight:700; font-size:12px; line-height:1; width:max-content; }
  .points-pill svg { width:14px; height:14px; display:block; }
  .page-title { display:flex; align-items:center; gap:8px; font-weight:800; color: var(--pri, #19777e); margin-left:8px; justify-content: flex-end; }
  .page-title ::slotted(img), .page-title ::slotted(svg) { height: 4em; max-height: 4em; display:block; margin-left:auto; }
        .spacer { flex:1; }
        .btn { border:1px solid var(--acc, #93cbcf); background: var(--acc, #93cbcf); color:#fff; padding:8px 12px; border-radius:10px; cursor:pointer; font-weight:700; }
        .avatar { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#fff; border:2px solid var(--pri, #19777e); font-size:22px; }
        .mut { color: var(--mut, #666); font-size:12px; }
        button.btn:focus { outline: 2px solid var(--pri, #19777e); outline-offset:2px; }
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
          <div class="avatar" part="avatar" aria-hidden="true">${avatar}</div>
          <div class="info">
            <div class="title" id="name" part="name">${name || "Profile"}</div>
            <div class="points" id="pointsLine" part="points" ${points==null? 'style="display:none;"':''}>
              <span class="points-pill" title="Total points">
                <span style="display:inline-block;width:14px;height:14px; border-radius:50%;background:#ffd700;vertical-align:middle;"></span>
                <span class="points-value">${points!=null? points.toLocaleString(): ''}</span>
              </span>
            </div>
            ${this.showId ? `<div class="mut" id="id" part="id">${uid ? `ID: ${uid}` : "Not signed in"}</div>` : ""}
          </div>
          <div class="page-title" id="pageTitle" part="page-title">
            <slot name="title"></slot>
            <span class="page-title-text">${this.pageTitle || ""}</span>
          </div>
          <div class="spacer"></div>
          <slot name="actions"></slot>
          ${this.showHome ? `<a class="menu-item" id="homeBtn" part="home-button" href="${this.homeHref}">${this.homeLabel}</a>` : ""}
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

    // If points are missing, try to fetch from overview once
    if (points == null && !this._fetchingPoints) {
      this._fetchingPoints = true;
      fetch('/.netlify/functions/progress_summary?section=overview', { credentials: 'include', cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(ov => {
          if (ov && typeof ov.points === 'number') {
            try {
              const cur = Number(localStorage.getItem('user_points') || '0') || 0;
              if (ov.points >= cur) localStorage.setItem('user_points', String(ov.points));
            } catch {}
            // Re-render to show points pill
            if (typeof this.refresh === 'function') this.refresh(); else this.render();
          }
        })
        .catch(() => {})
        .finally(() => { this._fetchingPoints = false; });
    }
  }
}

customElements.define("student-header", StudentHeader);
