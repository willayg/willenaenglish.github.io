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
  this._onAuthChanged = this._onAuthChanged?.bind(this);
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
  this._onOptimisticBump = (e) => {
    try {
      const delta = e?.detail?.delta || 1;
      if (typeof this._points === 'number') {
        this._points += delta;
        this.refresh();
      }
    } catch {}
  };
  this._onStarsBump = (e) => {
    try {
      const delta = e?.detail?.delta || 1;
      if (typeof this._stars === 'number') {
        this._stars += delta;
      } else {
        this._stars = delta;
      }
      this.refresh();
      // Trigger bounce animation after render
      requestAnimationFrame(() => this._animateStarsBounce());
    } catch {}
  };
  this._points = null;
  this._stars = null;
  this._fetchingOverview = false;
  // Mission modal guard so we attempt only once per component lifecycle
  this._missionChecked = false;
  this._refreshAttempted = false;
  this._whoamiRetried = false;
  }

  attributeChangedCallback() {
    // Re-render on attribute changes to reflect new props
    if (this.isConnected) this.render();
  }

  connectedCallback() {
    this.render();
    // Update if user data changes in this or other tabs
    window.addEventListener("storage", this._onStorage);
  // Listen for explicit auth changes dispatched by login/logout flows in the same tab
  window.addEventListener('auth:changed', this._onAuthChanged);
  window.addEventListener('points:update', this._onPointsUpdate);
  window.addEventListener('points:optimistic-bump', this._onOptimisticBump);
  window.addEventListener('stars:optimistic-bump', this._onStarsBump);
  // Hydrate identity from server session and refresh on focus changes
  this._refreshSession();
  this._hydrateProfile();
  window.addEventListener('focus', this._onFocus);
    // If points not yet known, fetch once to seed
    if ((this._points == null || this._stars == null) && !this._fetchingOverview) {
      this._fetchOverview();
    }
  // Defer mission modal check a tick to avoid blocking initial paint
  try { setTimeout(() => this._maybeShowMissionModal(), 0); } catch {}
  }

  disconnectedCallback() {
    window.removeEventListener("storage", this._onStorage);
  window.removeEventListener('auth:changed', this._onAuthChanged);
  window.removeEventListener('points:update', this._onPointsUpdate);
  window.removeEventListener('points:optimistic-bump', this._onOptimisticBump);
  window.removeEventListener('stars:optimistic-bump', this._onStarsBump);
  window.removeEventListener('focus', this._onFocus);
  }

  refresh() { this.render(); }

  // Trigger bounce animation on stars pill when stars are gained
  _animateStarsBounce() {
    try {
      const pill = this.shadowRoot?.querySelector('.stars-pill');
      if (!pill) return;
      pill.classList.remove('bounce');
      // Force reflow to restart animation
      void pill.offsetWidth;
      pill.classList.add('bounce');
      // Remove class after animation completes
      setTimeout(() => pill.classList.remove('bounce'), 550);
    } catch {}
  }

  _onStorage(e) {
    // Only re-render if relevant keys change
  if (["user_name", "user_id", "selectedEmojiAvatar"].includes(e.key)) {
      this.render();
    }
  }

  _onAuthChanged() {
    // Clear any cached identity so hydrate fetch is authoritative
    try { this._name = null; this._uid = null; this._avatar = null; } catch {}
    this._refreshSession();
    this._hydrateProfile();
    this._fetchOverview();
  }

  async _refreshSession() {
    if (this._refreshAttempted) return;
    this._refreshAttempted = true;
    try {
      await WillenaAPI.fetch(`/.netlify/functions/supabase_auth?action=refresh`, { credentials: 'include', cache: 'no-store' });
    } catch {
      // Ignore refresh failures; whoami will handle signed-out state.
    }
  }

  async _hydrateProfile() {
    try {
      const whoRes = await WillenaAPI.fetch(`/.netlify/functions/supabase_auth?action=whoami&_=${Date.now()}`);
      const who = await whoRes.json();
      if (!who || !who.success || !who.user_id) {
        if (!this._whoamiRetried) {
          this._whoamiRetried = true;
          await this._refreshSession();
          return this._hydrateProfile();
        }
        return;
      }
      this._uid = who.user_id;
  // Stash simple role for later gating (teacher/admin)
  try { if (who.role) { localStorage.setItem('user_role', who.role); } } catch {}
      const profRes = await WillenaAPI.fetch(`/.netlify/functions/supabase_auth?action=get_profile_name&_=${Date.now()}`);
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

  _onFocus() { this._hydrateProfile(); this._fetchOverview(); }

  // --- Mission Modal (homework alert) ---
  _shouldSuppressGameInterrupt() {
    try {
      // Never interrupt active gameplay. Heuristics for the English Arcade page.
      const isArcade = /\/Games\/english_arcade\//i.test(location.pathname);
      if (!isArcade) return false;
      const qs = new URLSearchParams(location.search);
      // Don't suppress if just landing via openHomework (that's intended entry point)
      if (qs.get('openHomework') === '1') return false;
      // If autostart is active, allow modal first (it won't re-show once dismissed)
      if (qs.get('autostart') === '1') return false;
      // Known game runtime flags if exposed
      if (window.WordArcade) {
        try {
          if (typeof window.WordArcade.isInGame === 'function' && window.WordArcade.isInGame()) return true;
          if (window.WordArcade.isPlaying === true) return true;
        } catch {}
      }
      // DOM heuristic: if opening menu is hidden and gameArea populated, assume a game is active
      const opening = document.getElementById('openingButtons');
      const gameArea = document.getElementById('gameArea');
      const openingHidden = opening ? (getComputedStyle(opening).display === 'none') : false;
      const gameBusy = gameArea ? gameArea.childElementCount > 0 : false;
      return openingHidden && gameBusy;
    } catch { return false; }
  }

  async _maybeShowMissionModal() {
    try {
      if (this._missionChecked) return; this._missionChecked = true;
      // Once per session
      if (sessionStorage.getItem('missionModalShown') === '1') return;
      // Skip login page entirely
      if (/\/students\/login\.html$/i.test(location.pathname)) return;
      // If another aria-modal is present, delay briefly and try once more
      const existingModal = document.querySelector('[aria-modal="true"], .modal[role="dialog"]');
      if (existingModal) {
        // Wait briefly for other modals to dismiss, then give up for this session if still present
        setTimeout(() => {
          if (!document.querySelector('[aria-modal="true"], .modal[role="dialog"]') && !document.getElementById('missionModalGlobal')) {
            this._missionChecked = false; // allow retry
            this._maybeShowMissionModal();
          }
        }, 1000);
        return;
      }
      // Never interrupt games (but allow on opening screen even if on Arcade page)
      if (this._shouldSuppressGameInterrupt()) return;

      // Small shared cache to avoid duplicate fetches across pages
      const cacheKey = '__HAS_HW_CACHE';
      let hasHw = null;
      const now = Date.now();
      // Skip cache entirely - always check fresh to ensure accurate incomplete status
      if (hasHw == null) {
        // Defer to idle if available to minimize main thread contention
        await new Promise((res) => {
          try { (window.requestIdleCallback || window.requestAnimationFrame)(() => res()); }
          catch { setTimeout(res, 0); }
        });
          const resp = await WillenaAPI.fetch(`/.netlify/functions/homework_api?action=list_assignments&mode=student&_=${Date.now()}`);
          if (!resp.ok) return;
          const data = await resp.json().catch(() => ({}));
          // If assignments exist, check per-assignment progress for this user to determine incompletes.
          if (data && data.success && Array.isArray(data.assignments) && data.assignments.length) {
            const assignments = data.assignments || [];
            // Ensure we have a user id to match progress rows. Try hydrated uid then whoami fallback.
            let uid = this._uid || null;
            if (!uid) {
              try {
                const who = await WillenaAPI.fetch(`/.netlify/functions/supabase_auth?action=whoami&_=${Date.now()}`);
                if (who.ok) {
                  const wj = await who.json().catch(() => ({}));
                  if (wj && wj.success && wj.user_id) uid = wj.user_id;
                }
              } catch {}
            }
            // Check progress for each assignment. Conservative approach: if any assignment appears incomplete, treat as hasHw.
            let incomplete = 0;
            try {
              await Promise.all(assignments.map(async (a) => {
                try {
                  const pr = await WillenaAPI.fetch(`/.netlify/functions/homework_api?action=assignment_progress&assignment_id=${encodeURIComponent(a.id)}&_=${Date.now()}`);
                  if (!pr.ok) { incomplete++; return; }
                  const pj = await pr.json().catch(() => ({}));
                  if (pr.ok && pj && pj.success && Array.isArray(pj.progress)) {
                    let studentProgress = null;
                    if (uid) studentProgress = pj.progress.find(p => String(p.user_id) === String(uid)) || null;
                    if (!studentProgress && pj.progress.length === 1) studentProgress = pj.progress[0];
                    if (studentProgress) {
                      let completionPct = 0;
                      if (typeof studentProgress.completion === 'number') completionPct = studentProgress.completion;
                      else if (typeof studentProgress.completion_pct === 'number') completionPct = studentProgress.completion_pct;
                      else if (typeof studentProgress.modes_attempted === 'number' && typeof studentProgress.modes_total === 'number' && studentProgress.modes_total > 0) {
                        completionPct = Math.round((studentProgress.modes_attempted / studentProgress.modes_total) * 100);
                      }
                      completionPct = Math.max(0, Math.min(100, completionPct));
                      // If stars_required is set, override completion % to be star-based
                      if (pj.stars_required && typeof studentProgress.stars === 'number') {
                        completionPct = Math.round((studentProgress.stars / pj.stars_required) * 100);
                      }
                      if (completionPct < 100) incomplete++;
                    } else {
                      // No student row => treat as incomplete
                      incomplete++;
                    }
                  } else {
                    incomplete++;
                  }
                } catch (e) { incomplete++; }
              }));
            } catch (e) { incomplete = assignments.length; }
            hasHw = incomplete > 0;
          } else {
            hasHw = false;
          }
          try { window[cacheKey] = { t: now, v: hasHw }; } catch {}
      }
      if (!hasHw) return;

      // Build fullscreen modal
      if (document.getElementById('missionModalGlobal')) return; // already present
      const overlay = document.createElement('div');
      overlay.id = 'missionModalGlobal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(3px);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:26px;';
      const panel = document.createElement('div');
      panel.style.cssText = 'background:#fff;border-radius:24px;max-width:520px;width:100%;padding:36px 32px 28px;border:2px solid #93cbcf;box-shadow:0 16px 60px rgba(0,0,0,.18);text-align:center;font-family:"Poppins",system-ui,Arial,sans-serif;';
      panel.innerHTML = `
        <h2 style="margin:0 0 12px;font-size:2.2rem;font-weight:800;color:#ff6fa9;letter-spacing:.4px;font-family:'Poppins',system-ui,Arial,sans-serif;">You Have A Mission</h2>
        <img src="/Games/english_arcade/assets/Images/icons/rocket.svg" alt="rocket" style="width:72px;height:72px;margin:0 auto 14px;display:block;" />
        <div style="display:flex;gap:18px;align-items:center;justify-content:center;margin-top:12px;flex-wrap:wrap;">
          <a id="missionDoNowBtn" href="#" style="display:inline-block;font-size:1.05rem;font-weight:800;color:#555;background:#fff;border:2px solid #ff6fa9;padding:14px 26px;border-radius:16px;text-decoration:none;min-width:260px;font-family:'Poppins',system-ui,Arial,sans-serif;box-shadow:0 6px 16px rgba(255,111,169,0.12);transition:transform .16s ease, box-shadow .16s ease;">숙제 시작하기</a>
          <button id="missionDismissBtn" type="button" style="background:#fff;border:2px solid #e2e8f0;color:#334155;font-weight:700;padding:10px 16px;border-radius:12px;cursor:pointer;font-family:'Poppins',system-ui,Arial,sans-serif;margin-top:18px;">Not Now</button>
        </div>`;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      const finish = () => { try { overlay.remove(); } catch {} sessionStorage.setItem('missionModalShown','1'); };
      // Do NOT close modal when clicking the backdrop; require explicit button action
      // overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(); });
      panel.querySelector('#missionDismissBtn')?.addEventListener('click', finish);
      panel.querySelector('#missionDoNowBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.setItem('missionModalShown','1');
        window.location.href = '/Games/english_arcade/index.html?openHomework=1';
      });
    } catch {}
  }

  _fetchOverview() {
    if (this._fetchingOverview) return;
    this._fetchingOverview = true;
    WillenaAPI.fetch(`/.netlify/functions/progress_summary?section=overview&_=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(ov => {
        let changed = false;
        if (ov && typeof ov.points === 'number' && ov.points !== this._points) { this._points = ov.points; changed = true; }
        if (ov && typeof ov.stars === 'number' && ov.stars !== this._stars) { this._stars = ov.stars; changed = true; }
        if (changed) this.refresh();
      })
      .catch(() => {})
      .finally(() => { this._fetchingOverview = false; });
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
    // Try established identity sources; if none, fall back to guest cookie
    let cookieGuestName = null;
    try {
      const m = (document.cookie || '').match(/(?:^|;\s*)wa_guest_name=([^;]+)/);
      cookieGuestName = m ? decodeURIComponent(m[1]) : null;
    } catch {}
    // Prefer recently-updated storage values (they represent immediate user intent)
    const name = (
      localStorage.getItem("user_name") || sessionStorage.getItem("user_name") ||
      localStorage.getItem("username") || sessionStorage.getItem("username") ||
      localStorage.getItem("name") || sessionStorage.getItem("name") ||
      this._name ||
      cookieGuestName ||
      "Guest"
    );
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
  const stars = (this.showPoints && typeof this._stars === 'number') ? this._stars : null;

    this.shadowRoot.innerHTML = `
      <style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
        :host { display:block; }
  header { position:sticky; top:0; left:0; right:0; background:#fff; border-bottom:1px solid #e6eaef; padding:10px 12px 8px; z-index:10; min-width:0; width:100%; box-sizing:border-box; margin:0; }
  .top { display:flex; flex-direction:row; align-items:center; gap:10px; font-family: 'Poppins', system-ui, Segoe UI, Arial, sans-serif; justify-content: center; min-width:0; }
  .title { font-weight:800; color: var(--pri, #19777e); text-align:center; }
  .info { display:flex; flex-direction:column; gap:2px; align-items:center; }
  .points-pill { display:inline-flex; align-items:center; gap:6px; padding:3px 8px; border-radius:999px; background:#f7fcfd; border:1px solid #a9d6e9; color:#19777e; font-weight:700; font-size:12px; line-height:1; width:max-content; }
  .points-pill svg { width:14px; height:14px; display:block; }
  .stars-pill { display:inline-flex; align-items:center; gap:6px; padding:3px 8px; border-radius:999px; background:#fffaf0; border:1px solid #e8d28a; color:#b8860b; font-weight:700; font-size:12px; line-height:1; width:max-content; }
  .stars-pill svg { width:14px; height:14px; display:block; }
  .stars-pill.bounce { animation: starBounce .5s cubic-bezier(.36,1.2,.5,1); }
  @keyframes starBounce {
    0% { transform: scale(1); }
    30% { transform: scale(1.25); }
    50% { transform: scale(0.95); }
    70% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
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
    min-width: 230px; /* widened to avoid cramped text */
    max-width: 320px; /* cap width for readability */
    padding: 8px;
    display: block; /* allow animation control via visibility/opacity */
    z-index: 1000;
    overflow-x: hidden; /* prevent horizontal scrollbar */
    overflow-y: auto; /* allow vertical scroll if many items */
    /* Animation base state */
    opacity: 0;
    transform: translateX(16px) scale(.98);
    pointer-events: none;
    transition: opacity .28s ease, transform .32s cubic-bezier(.34,.9,.42,1.0);
  }
  .dropdown.opening, .dropdown.open { opacity:1; transform: translateX(0) scale(1); pointer-events:auto; }
  .dropdown.closing { opacity:0; transform: translateX(12px) scale(.97); pointer-events:none; }
  @media (prefers-reduced-motion: reduce) {
    .dropdown { transition:none; transform:none !important; }
  }
  @media (max-width: 520px) {
    .dropdown {
      left: auto;
      right: 0;
      min-width: 170px; /* still a bit wider on mobile */
      max-width: 96vw; /* allow near full width on very small screens */
      top: calc(100% + 4px);
      font-size: clamp(.85rem, 3.4vw, 1rem); /* responsive text */
    }
  }
  .dropdown.open { /* keep class for legacy logic; now handled with states */ }
  .dd-item { display:flex; align-items:flex-start; gap:10px; width:100%; text-align:left; border:1px solid transparent; background:#fff; border-radius:10px; padding:9px 12px; cursor:pointer; font-weight:600; color: #19777e; font-size: clamp(.8rem, 2.6vw, .95rem); line-height:1.2; white-space: normal; overflow-wrap: anywhere; }
  .dd-item svg { flex: 0 0 auto; margin-top:2px; }
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

      /* =====================
        Dark Mode Overrides (shadow-aware)
        Uses :host-context(html.dark) so global html.dark toggling applies.
        ===================== */
      :host-context(html.dark) header { background:#1b242c; border-color:#28323c; color:#e3e8ed; }
      :host-context(html.dark) .title,
      :host-context(html.dark) .page-title,
      :host-context(html.dark) .page-title-text { color:#e3e8ed; }
      :host-context(html.dark) .mut { color:#b0bcc7; }
      :host-context(html.dark) .points-pill { background:#1f2a33; border-color:#2f3a45; color:#67e2e6; }
  :host-context(html.dark) .stars-pill { background:#2a1f13; border-color:#4a3a1a; color:#ffd36b; }
      :host-context(html.dark) .avatar { background:#182028; border-color:#67e2e6; }
      :host-context(html.dark) ::slotted(.menu-item) { color:#9fd8df; }
      :host-context(html.dark) ::slotted(.menu-item:hover),
      :host-context(html.dark) ::slotted(.menu-item:focus),
      :host-context(html.dark) ::slotted(.menu-item:active) { background:#253039; color:#67e2e6; }
      :host-context(html.dark) ::slotted(.menu-item.active) { background:#1f2a33; border-bottom-color:#67e2e6; }
      /* Dropdown */
      :host-context(html.dark) .dropdown { background:#1f2830; border-color:#2c3a44; }
      :host-context(html.dark) .dd-item { background:#1f2830; border-color:#1f2830; color:#9fd8df; }
      :host-context(html.dark) .dd-item:hover,
      :host-context(html.dark) .dd-item:focus { background:#28323c; }
      /* SVG icon recolor: rely on currentColor where possible; adjust hard-coded fills */
      :host-context(html.dark) .dd-item svg path[fill="#19777e"] { fill:#67e2e6; }
      :host-context(html.dark) .dd-item svg path[fill="#c62828"] { fill:#ff6b6b; }
      /* Scroll row divider */
      :host-context(html.dark) .menu-row { border-top-color:#28323c; }
      
      </style>
      <header>
        <div class="top">
          <div class="info">
            <div class="title" id="name" part="name">${name || "Profile"}</div>
            ${points != null ? `<div class="points-pill" title="Total points" style="margin-bottom:4px;">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v3h3a1 1 0 010 2h-3v3a1 1 0 01-2 0v-3H8a1 1 0 010-2h3V7a1 1 0 012 0z" fill="currentColor"/></svg>
              <span id="pointsVal">${points}</span>
            </div>` : ''}
            ${stars != null ? `<div class="stars-pill" title="Total stars">
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2l2.9 6.1 6.7.9-4.8 4.6 1.2 6.7L12 17.8 6 21.3l1.2-6.7L2.4 9l6.7-.9L12 2z"/></svg>
              <span id="starsVal">${stars}</span>
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
              <a class="dd-item" role="menuitem" href="/students/dashboard.html" data-i18n="Dashboard">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z" fill="#19777e"/></svg>
                Dashboard
              </a>
              <a class="dd-item" role="menuitem" href="/Games/english_arcade/index.html" data-i18n="English Arcade">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><circle cx="12" cy="12" r="10" fill="#19777e"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="#fff">E</text></svg>
                English Arcade
              </a>
              <a class="dd-item" role="menuitem" href="/playzone.html" data-i18n="More Games">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><path d="M20 6h-2.18c.09-.3.18-.58.18-.9a2.5 2.5 0 00-5-1.45A2.5 2.5 0 005 5.1a2.5 2.5 0 00-5 1.45c0 .32.09.6.18.9H2a2 2 0 00-2 2v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5-2c.83 0 1.5.67 1.5 1.5S15.83 7 15 7s-1.5-.67-1.5-1.5S14.17 4 15 4zm-4 0c.83 0 1.5.67 1.5 1.5S11.83 7 11 7s-1.5-.67-1.5-1.5S10.17 4 11 4zm3.5 9.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z" fill="#19777e"/></svg>
                More Games
              </a>
              <a class="dd-item" role="menuitem" href="/students/profile.html" data-i18n="Profile">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><path d="M12 12c2.7 0 8 1.34 8 4v4H4v-4c0-2.66 5.3-4 8-4zm0-2a4 4 0 100-8 4 4 0 000 8z" fill="#19777e"/></svg>
                Profile
              </a>
              <button class="dd-item" id="feedbackItem" role="menuitem" type="button" data-i18n="Bugs">
                <svg width="20" height="20" viewBox="0 0 24 24" style="margin-right:4px" xmlns="http://www.w3.org/2000/svg" fill="none"><path fill="#19777e" d="M14 6.3V5a2 2 0 10-4 0v1.3A5 5 0 007 11v1H5a1 1 0 000 2h2v1c0 .34.03.67.1 1H5a1 1 0 000 2h2.68A5.98 5.98 0 0012 21a5.98 5.98 0 004.32-1H19a1 1 0 000-2h-2.1c.07-.33.1-.66.1-1v-1h2a1 1 0 000-2h-2v-1a5 5 0 00-3-4.7zM12 19a4 4 0 01-4-4v-4a4 4 0 118 0v4a4 4 0 01-4 4z"/></svg>
                Bugs
              </button>
              <button class="dd-item" id="logoutAction" role="menuitem" type="button" style="color:#c62828;" data-i18n="Logout">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><path d="M16 13v-2H7V8l-5 4 5 4v-3h9zm3-11H9c-1.1 0-2 .9-2 2v4h2V4h10v16H9v-4H7v4c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="#c62828"/></svg>
                Logout
              </button>
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
  if (this.showPoints && (points == null || stars == null)) {
      this._fetchOverview();
    }

    // Avatar dropdown
    const avatarBtn = this.shadowRoot.getElementById('avatarBtn');
    const avatarMenu = this.shadowRoot.getElementById('avatarMenu');
    const toggleMenu = (open) => {
      if (!avatarBtn || !avatarMenu) return;
      const isOpen = avatarMenu.classList.contains('open') || avatarMenu.classList.contains('opening');
      const willOpen = open != null ? open : !isOpen;
      if (willOpen && !isOpen) {
        avatarMenu.classList.remove('closing');
        avatarMenu.classList.add('opening');
        // force reflow then swap to steady open state
        requestAnimationFrame(() => {
          avatarMenu.classList.add('open');
          avatarMenu.classList.remove('opening');
        });
      } else if (!willOpen && isOpen) {
        avatarMenu.classList.remove('open');
        avatarMenu.classList.add('closing');
        const after = (e) => {
          if (e.propertyName === 'opacity') {
            avatarMenu.classList.remove('closing');
            avatarMenu.removeEventListener('transitionend', after);
          }
        };
        avatarMenu.addEventListener('transitionend', after);
      }
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
      // Clear localStorage tokens
      try { WillenaAPI.clearLocalTokens?.(); } catch {}
      // Clear guest cookies if present so routes don't consider guest authenticated
      try {
        const opts = 'Path=/; Max-Age=0';
        // Clear for current domain
        document.cookie = 'wa_guest_id=; ' + opts;
        document.cookie = 'wa_guest_name=; ' + opts;
        // Also attempt clearing on top-level domain used in production
        const host = location.hostname;
        if (/willenaenglish\.com$/i.test(host)) {
          document.cookie = 'wa_guest_id=; Domain=.willenaenglish.com; ' + opts;
          document.cookie = 'wa_guest_name=; Domain=.willenaenglish.com; ' + opts;
        }
      } catch {}
  // Ensure mission modal will show again after logout
  try { sessionStorage.removeItem('missionModalShown'); sessionStorage.removeItem('wa_hw_tap_hint_shown'); } catch {}
      try { await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=logout', { method:'POST' }); } catch {}
      // Let other parts of the app know auth changed before redirecting
      try { window.dispatchEvent(new Event('auth:changed')); } catch {}
      const next = encodeURIComponent(location.pathname);
      window.location.href = `/students/login.html?next=${next}`;
    };
    const logoutBtn = this.shadowRoot.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    const logoutAction = this.shadowRoot.getElementById('logoutAction');
    if (logoutAction) logoutAction.addEventListener('click', doLogout);

    // Always-on Bugs (feedback) item
    const feedbackBtn = this.shadowRoot.getElementById('feedbackItem');
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', () => {
        try {
          if (window.showFeedbackModal) { window.showFeedbackModal(); return; }
        } catch {}
        // Lightweight inline fallback modal
        if (document.getElementById('inlineBugModal')) return;
        const wrap = document.createElement('div');
        wrap.id = 'inlineBugModal';
        wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
        wrap.innerHTML = `<div style="background:#fff;border:2px solid #19777e;border-radius:18px;max-width:480px;width:100%;padding:18px 20px;font-family:system-ui;display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <h3 style="margin:0;font-size:1.05rem;font-weight:800;color:#19777e;">Report a Bug</h3>
            <button id="bugClose" style="background:none;border:none;font-size:1.4rem;line-height:1;cursor:pointer;color:#475569;">×</button>
          </div>
          <textarea id="bugText" placeholder="Describe the issue (what you expected vs what happened)" style="width:100%;min-height:140px;resize:vertical;padding:10px 12px;border:2px solid #e2e8f0;border-radius:12px;font-family:inherit;font-size:.9rem;line-height:1.4;"></textarea>
          <div style="display:flex;align-items:center;gap:10px;justify-content:flex-end;">
            <button id="bugCancel" style="background:#fff;border:2px solid #93cbcf;padding:8px 14px;border-radius:10px;font-weight:600;color:#19777e;cursor:pointer;">Cancel</button>
            <button id="bugSend" style="background:#19777e;border:2px solid #19777e;padding:8px 16px;border-radius:10px;font-weight:700;color:#fff;cursor:pointer;">Send</button>
          </div>
          <div id="bugStatus" style="font-size:.7rem;font-weight:600;color:#64748b;min-height:16px;"></div>
        </div>`;
        document.body.appendChild(wrap);
        const close = ()=> wrap.remove();
        wrap.querySelector('#bugClose').onclick = close;
        wrap.querySelector('#bugCancel').onclick = close;
        const sendBtn = wrap.querySelector('#bugSend');
        const ta = wrap.querySelector('#bugText');
        const statusEl = wrap.querySelector('#bugStatus');
        sendBtn.onclick = async () => {
          const txt = (ta.value||'').trim();
          if (!txt) { ta.focus(); return; }
          sendBtn.disabled = true; sendBtn.textContent='Sending...'; statusEl.textContent='';
          const payload = { feedback: txt, module: 'general', page_url: location.pathname };
          try {
            const resp = await WillenaAPI.fetch('/.netlify/functions/supabase_proxy?feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'insert_feedback', data: payload }) });
            const js = await resp.json().catch(()=>({}));
            if (resp.ok && js.success) { sendBtn.textContent='Sent!'; statusEl.textContent='Thank you.'; setTimeout(close, 900); }
            else { sendBtn.disabled=false; sendBtn.textContent='Send'; statusEl.textContent='Error: ' + (js.error||'unknown'); }
          } catch(e){ sendBtn.disabled=false; sendBtn.textContent='Send'; statusEl.textContent='Network error'; }
        };
        ta.focus();
      });
    }
  }
}

customElements.define("student-header", StudentHeader);
// Auto translation inside shadow root when language changes
window.addEventListener('studentlang:changed', () => {
  try {
    document.querySelectorAll('student-header').forEach(h => {
      const sr = h.shadowRoot; if(!sr) return;
      const t = window.StudentLang && StudentLang.translate;
      sr.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        if(!k||!t) return;
        // Avoid stripping icons (keep child elements, update first text node)
        if(el.childNodes.length===1 && el.firstChild.nodeType===3) { el.firstChild.textContent = t(k); }
        else {
          const tn = Array.from(el.childNodes).find(n=>n.nodeType===3 && n.textContent.trim().length>0);
          if(tn) tn.textContent = t(k);
        }
      });
    });
  } catch {}
});
