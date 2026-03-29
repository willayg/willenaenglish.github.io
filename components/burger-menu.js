// Burger menu component loader
// Usage: import this file and call insertBurgerMenu() after DOMContentLoaded

export function insertBurgerMenu(targetSelector = 'body') {
  // Prevent duplicate insertion
  if (document.getElementById('burger-menu-template-inserted')) return;

  let template = document.getElementById('burger-menu-template');
  
  // Fallback: if template doesn't exist OR has invalid content (e.g., SPA routing returned index.html)
  const isValidTemplate = template && template.content && template.content.querySelector('.burger-menu');
  
  if (!isValidTemplate) {
    // Remove any invalid template that might exist
    if (template) template.remove();
    
    const fallback = document.createElement('template');
    fallback.id = 'burger-menu-template';
    fallback.innerHTML = `
      <style>
        .burger-menu { position: fixed; top: 10px; right: 10px; z-index: 9999; display: flex; align-items: center; gap: 8px; }
        .burger-btn { background: #00c9db; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-size: 16px; }
        .burger-btn:hover { background: #00b4c6; }
        .burger-dropdown { display: none; position: absolute; top: 50px; right: 0; background: white; box-shadow: 0 4px 8px rgba(0,0,0,0.2); border-radius: 5px; min-width: 200px; }
        .burger-dropdown a { display: block; padding: 12px 16px; text-decoration: none; color: #333; border-bottom: 1px solid #eee; }
        .burger-dropdown a:hover { background: #f1f1f1; }
        .burger-dropdown a:last-child { border-bottom: none; }
        .hw-notif-wrap { position: relative; }
        .hw-notif-btn { background: #00c9db; color: white; border: none; padding: 10px 13px; border-radius: 5px; cursor: pointer; font-size: 16px; line-height: 1; position: relative; }
        .hw-notif-btn:hover { background: #00b4c6; }
        .hw-notif-badge { display: none; position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px; align-items: center; justify-content: center; padding: 0 3px; pointer-events: none; }
        .hw-notif-panel { display: none; position: absolute; top: calc(100% + 8px); right: 0; width: 320px; max-height: 480px; overflow-y: auto; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.18); z-index: 10000; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        .hw-notif-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 13px; color: #111827; position: sticky; top: 0; background: white; }
        .hw-notif-header-link { font-size: 11px; font-weight: 500; color: #00b4c6; text-decoration: none; }
        .hw-notif-header-link:hover { text-decoration: underline; }
        .hw-notif-loading, .hw-notif-empty { padding: 24px; text-align: center; color: #9ca3af; font-size: 13px; }
        .hw-notif-group { border-bottom: 1px solid #f3f4f6; }
        .hw-notif-group-title { padding: 8px 14px 4px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; background: #f9fafb; }
        .hw-notif-row { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-bottom: 1px solid #f3f4f6; }
        .hw-notif-row:hover { background: #f0fdfe; }
        .hw-notif-info { flex: 1; min-width: 0; }
        .hw-notif-name { font-size: 13px; font-weight: 600; color: #111827; }
        .hw-notif-meta { font-size: 11px; color: #6b7280; }
        .hw-notif-stars { font-size: 12px; color: #f59e0b; }
        .hw-notif-time { font-size: 11px; color: #9ca3af; white-space: nowrap; }
      </style>
      <div class="burger-menu">
        <div class="hw-notif-wrap">
          <button type="button" class="hw-notif-btn" aria-label="Homework notifications" title="Homework notifications" aria-expanded="false">🔔
            <span class="hw-notif-badge" aria-live="polite"></span>
          </button>
          <div class="hw-notif-panel" role="dialog" aria-label="Homework notifications">
            <div class="hw-notif-header">
              <span>Homework Updates</span>
              <a class="hw-notif-header-link" href="/Teachers/tools/student_tracker/student_tracker.html?tab=homework">Open Tracker →</a>
            </div>
            <div class="hw-notif-body"><div class="hw-notif-loading">Loading…</div></div>
          </div>
        </div>
        <div style="position:relative;">
          <button type="button" class="burger-btn" aria-label="Menu">☰</button>
          <div class="burger-dropdown">
            <a href="/Teachers/index.html">Teachers Home</a>
            <a href="/Teachers/tools/manage_students.html">Manage Students</a>
            <a href="/Teachers/tools/student_tracker/student_tracker.html">Student Tracker</a>
            <a href="/Teachers/tools/planner/planner.html">Planner</a>
            <a href="/Teachers/tools/game-builder/index.html">Game Builder</a>
            <a href="/Teachers/tools/survey_builder/survey_builder.html">Survey Builder</a>
            <a href="/Teachers/tools/reading/reading.html">Reading</a>
            <a href="/Teachers/tools/flashcard/flashcard.html">Flashcards</a>
            <a href="/Teachers/tools/grid_game/grid_game.html">Grid Game</a>
            <a href="/Teachers/tools/puzzles/wordsearch.html">Word Search</a>
            <a href="/Teachers/tools/wordtest/wordtest2.html">Word Test</a>
            <a href="/Teachers/tools/worksheet-builder-vanilla/index.html">Worksheet Builder</a>
            <a href="/Teachers/tools/test_input/index.html">Test Input</a>
            <a href="#" id="feedbackMenuBtn">Feedback</a>
            <button type="button" id="logoutMenuBtn" style="display:block;width:100%;text-align:left;padding:12px 16px;background:#fff;border:none;border-top:1px solid #eee;color:#333;cursor:pointer;font:inherit;">Logout</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(fallback);
    template = fallback;
  }
  const node = template.content.cloneNode(true);
  const wrapper = document.createElement('div');
  wrapper.id = 'burger-menu-template-inserted';
  wrapper.appendChild(node);

  // Insert at the top of the target element
  const target = document.querySelector(targetSelector) || document.body;
  if (target) target.insertBefore(wrapper, target.firstChild);

  // Dropdown logic
  const burgerBtn = wrapper.querySelector('.burger-btn');
  const dropdown = wrapper.querySelector('.burger-dropdown');
  if (!burgerBtn || !dropdown) return;
  burgerBtn.onclick = () => {
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  };
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) dropdown.style.display = 'none';
  });

  // Feedback modal logic (optional: trigger your feedback modal here)
  const feedbackBtn = wrapper.querySelector('#feedbackMenuBtn');
  if (feedbackBtn) {
    feedbackBtn.onclick = (e) => {
      e.preventDefault();
      if (window.showFeedbackModal) window.showFeedbackModal();
      else alert('Feedback modal not implemented!');
      dropdown.style.display = 'none';
    };
  }

  const logoutBtn = wrapper.querySelector('#logoutMenuBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        localStorage.removeItem('userEmail');
      } catch {}
      try { await window.WillenaAPI?.fetch?.('/.netlify/functions/supabase_auth?action=logout', { method: 'POST' }); } catch {}
      const redirect = encodeURIComponent(location.pathname + location.search);
      window.location.href = '/Teachers/login.html?redirect=' + redirect;
    };
  }

  initNotificationBell(wrapper);
}

// ── Notification Bell ──────────────────────────────────────────────────
function initNotificationBell(wrapper) {
  const bellBtn   = wrapper.querySelector('.hw-notif-btn');
  const badge     = wrapper.querySelector('.hw-notif-badge');
  const panel     = wrapper.querySelector('.hw-notif-panel');
  const body      = wrapper.querySelector('.hw-notif-body');
  if (!bellBtn || !badge || !panel || !body) return;

  const API = '/.netlify/functions/homework_api';
  const CACHE_KEY   = 'hw_notif_data';
  const FETCHED_KEY = 'hw_notif_fetched_at';
  const SEEN_KEY    = 'hw_notif_last_seen';
  const CACHE_TTL   = 60_000;   // 1 min
  const POLL_MS     = 60_000;   // 1 min

  let panelOpen   = false;
  let pollTimer   = null;
  let currentCount = 0;

  function getSince() {
    const stored = sessionStorage.getItem(SEEN_KEY);
    if (stored) return stored;
    const d = new Date(); d.setHours(d.getHours() - 48);
    return d.toISOString();
  }

  function updateBadge(n) {
    currentCount = n;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.style.display = n > 0 ? 'flex' : 'none';
  }

  async function fetchCount() {
    try {
      const since = getSince();
      const r = await fetch(
        `${API}?action=teacher_notifications&mode=count&since=${encodeURIComponent(since)}`,
        { credentials: 'include' }
      );
      if (!r.ok) return;
      const d = await r.json();
      if (d.success) updateBadge(d.count ?? 0);
    } catch { /* network error, silent */ }
  }

  async function fetchFull() {
    const now = Date.now();
    const fetchedAt = parseInt(sessionStorage.getItem(FETCHED_KEY) || '0', 10);
    if (now - fetchedAt < CACHE_TTL) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
        if (cached) return cached;
      } catch { /* invalid cache, fall through */ }
    }
    const since = getSince();
    const r = await fetch(
      `${API}?action=teacher_notifications&since=${encodeURIComponent(since)}`,
      { credentials: 'include' }
    );
    if (!r.ok) throw new Error('fetch failed');
    const d = await r.json();
    if (!d.success) throw new Error(d.error || 'error');
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(d.notifications || []));
    sessionStorage.setItem(FETCHED_KEY, String(Date.now()));
    return d.notifications || [];
  }

  function formatTimeAgo(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function renderStars(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function renderPanel(notifications) {
    if (!notifications || notifications.length === 0) {
      body.innerHTML = '<div class="hw-notif-empty">No new homework completions in the last 48 hours.</div>';
      return;
    }
    const html = notifications.map(grp => {
      const rows = (grp.completions || []).map(c => `
        <div class="hw-notif-row">
          <span class="hw-notif-check">✅</span>
          <div class="hw-notif-info">
            <div class="hw-notif-name">${htmlEscape(c.name || c.user_id)}</div>
            ${c.korean_name ? `<div class="hw-notif-meta">${htmlEscape(c.korean_name)}</div>` : ''}
          </div>
          <span class="hw-notif-stars" title="${c.stars} stars">${renderStars(c.stars)}</span>
          <span class="hw-notif-time">${formatTimeAgo(c.completed_at)}</span>
        </div>`).join('');
      return `
        <div class="hw-notif-group">
          <div class="hw-notif-group-title">${htmlEscape(grp.assignment_title || 'Assignment')}${grp.class ? ' · ' + htmlEscape(grp.class) : ''}</div>
          ${rows}
        </div>`;
    }).join('');
    body.innerHTML = html;
  }

  function htmlEscape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function openPanel() {
    panelOpen = true;
    bellBtn.setAttribute('aria-expanded', 'true');
    panel.classList.add('open');
    panel.style.display = 'block';
    body.innerHTML = '<div class="hw-notif-loading">Loading…</div>';
    try {
      const notifs = await fetchFull();
      renderPanel(notifs);
    } catch {
      body.innerHTML = '<div class="hw-notif-empty">Could not load notifications.</div>';
    }
    // Mark seen
    sessionStorage.setItem(SEEN_KEY, new Date().toISOString());
    updateBadge(0);
  }

  function closePanel() {
    panelOpen = false;
    bellBtn.setAttribute('aria-expanded', 'false');
    panel.classList.remove('open');
    panel.style.display = 'none';
  }

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panelOpen) closePanel(); else openPanel();
  });

  document.addEventListener('click', (e) => {
    if (panelOpen && !wrapper.querySelector('.hw-notif-wrap').contains(e.target)) closePanel();
  });

  // Initial count fetch + polling
  fetchCount();
  function startPoll() {
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && !panelOpen) fetchCount();
    }, POLL_MS);
  }
  startPoll();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !pollTimer) startPoll();
    else if (document.visibilityState === 'hidden') { clearInterval(pollTimer); pollTimer = null; }
  });
}

// If not using modules, you can expose insertBurgerMenu globally:
if (typeof window !== 'undefined') {
  window.insertBurgerMenu = insertBurgerMenu;
}
