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
        .hw-notif-footer { display: flex; gap: 8px; padding: 10px 14px 14px; border-top: 1px solid #eef2f7; background: #fafafa; }
        .hw-notif-footer-btn, .hw-notif-footer-link { flex: 1; text-align: center; border-radius: 8px; font-size: 12px; font-weight: 600; padding: 9px 10px; text-decoration: none; border: 1px solid #cfe7ea; background: #ffffff; color: #19777e; cursor: pointer; }
        .hw-status-modal-backdrop { display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 10020; padding: 24px; align-items: center; justify-content: center; }
        .hw-status-modal { width: min(860px, 100%); max-height: min(82vh, 760px); overflow: hidden; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 48px rgba(0,0,0,0.22); display: flex; flex-direction: column; }
        .hw-status-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e5e7eb; background: #f8fafc; }
        .hw-status-modal-title { font-size: 16px; font-weight: 700; color: #111827; margin: 0; }
        .hw-status-modal-close { border: none; background: transparent; font-size: 24px; line-height: 1; cursor: pointer; color: #64748b; padding: 0; }
        .hw-status-modal-body { padding: 16px 18px 20px; overflow: auto; display: flex; flex-direction: column; gap: 14px; background: #f8fafc; }
        .hw-status-loading, .hw-status-empty { padding: 28px 16px; text-align: center; color: #64748b; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; }
        .hw-status-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
        .hw-status-card-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 14px 16px; border-bottom: 1px solid #eef2f7; }
        .hw-status-card-title { margin: 0; font-size: 15px; font-weight: 700; color: #111827; }
        .hw-status-card-meta { margin-top: 4px; font-size: 12px; color: #64748b; }
        .hw-status-card-counts { text-align: right; font-size: 12px; color: #334155; }
        .hw-status-card-counts strong { display: block; font-size: 15px; color: #0f766e; }
        .hw-status-lists { display: grid; grid-template-columns: 1fr 1fr; }
        .hw-status-list { padding: 14px 16px; }
        .hw-status-list + .hw-status-list { border-left: 1px solid #eef2f7; }
        .hw-status-list h4 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
        .hw-status-person { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
        .hw-status-person:last-child { border-bottom: none; }
        .hw-status-person-name { font-size: 13px; font-weight: 600; color: #111827; }
        .hw-status-person-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
        .hw-status-done-badge, .hw-status-pending-badge { flex-shrink: 0; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 700; }
        .hw-status-done-badge { background: #dcfce7; color: #166534; }
        .hw-status-pending-badge { background: #fee2e2; color: #991b1b; }
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
            <div class="hw-notif-footer">
              <button type="button" class="hw-notif-footer-btn" id="hwNotifStatusBtn">Active Homework</button>
              <a class="hw-notif-footer-link" href="/Teachers/tools/student_tracker/student_tracker.html?tab=homework">Open Tracker</a>
            </div>
          </div>
        </div>
        <div class="hw-status-modal-backdrop" id="hwStatusModalBackdrop" aria-hidden="true">
          <div class="hw-status-modal" role="dialog" aria-modal="true" aria-label="Active homework status">
            <div class="hw-status-modal-header">
              <h3 class="hw-status-modal-title">Active Homework</h3>
              <button type="button" class="hw-status-modal-close" id="hwStatusModalClose" aria-label="Close">×</button>
            </div>
            <div class="hw-status-modal-body" id="hwStatusModalBody"><div class="hw-status-loading">Loading active homework…</div></div>
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
  const statusBtn = wrapper.querySelector('#hwNotifStatusBtn');
  const statusBackdrop = wrapper.querySelector('#hwStatusModalBackdrop');
  const statusBody = wrapper.querySelector('#hwStatusModalBody');
  const statusCloseBtn = wrapper.querySelector('#hwStatusModalClose');
  if (!bellBtn || !badge || !panel || !body) return;

  const API = '/.netlify/functions/homework_api';
  const CACHE_KEY   = 'hw_notif_data';
  const FETCHED_KEY = 'hw_notif_fetched_at';
  const STATUS_CACHE_KEY = 'hw_notif_status_data';
  const STATUS_FETCHED_KEY = 'hw_notif_status_fetched_at';
  const SEEN_KEY    = 'hw_notif_last_seen';
  const CACHE_TTL   = 60_000;   // 1 min
  const POLL_MS     = 60_000;   // 1 min

  let panelOpen   = false;
  let pollTimer   = null;
  let currentCount = 0;
  let statusModalOpen = false;

  function apiFetch(url, options = {}) {
    if (window.WillenaAPI && typeof window.WillenaAPI.fetch === 'function') {
      return window.WillenaAPI.fetch(url, options);
    }
    return fetch(url, { credentials: 'include', ...options });
  }

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
      const r = await apiFetch(
        `${API}?action=teacher_notifications&mode=count&since=${encodeURIComponent(since)}`,
        {}
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
    const r = await apiFetch(
      `${API}?action=teacher_notifications&since=${encodeURIComponent(since)}`,
      {}
    );
    let d = null;
    try {
      d = await r.json();
    } catch (_) {
      d = null;
    }
    if (!r.ok) throw new Error((d && d.error) ? d.error : 'Fetch failed');
    if (!d.success) throw new Error(d.error || 'error');
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(d.notifications || []));
    sessionStorage.setItem(FETCHED_KEY, String(Date.now()));
    return d.notifications || [];
  }

  async function fetchHomeworkStatus() {
    const now = Date.now();
    const fetchedAt = parseInt(sessionStorage.getItem(STATUS_FETCHED_KEY) || '0', 10);
    if (now - fetchedAt < CACHE_TTL) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(STATUS_CACHE_KEY) || 'null');
        if (cached) return cached;
      } catch {}
    }

    const r = await apiFetch(`${API}?action=teacher_homework_status`, {});
    let d = null;
    try {
      d = await r.json();
    } catch (_) {
      d = null;
    }
    if (!r.ok) throw new Error((d && d.error) ? d.error : 'Fetch failed');
    if (!d || !d.success) throw new Error((d && d.error) ? d.error : 'Could not load homework status');
    sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(d.assignments || []));
    sessionStorage.setItem(STATUS_FETCHED_KEY, String(Date.now()));
    return d.assignments || [];
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

  function formatDueDate(iso) {
    if (!iso) return 'No due date';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  function renderPeople(list, type) {
    if (!list || !list.length) {
      return `<div class="hw-status-person"><div><div class="hw-status-person-name">None</div></div><span class="${type === 'done' ? 'hw-status-done-badge' : 'hw-status-pending-badge'}">0</span></div>`;
    }
    return list.map((person) => {
      const label = htmlEscape(person.name || person.korean_name || person.user_id || 'Student');
      const sub = person.korean_name && person.korean_name !== person.name
        ? `<div class="hw-status-person-meta">${htmlEscape(person.korean_name)}</div>`
        : (type === 'done' && person.completed_at ? `<div class="hw-status-person-meta">${formatTimeAgo(person.completed_at)} · ${renderStars(Math.max(0, Math.min(5, Number(person.stars) || 0)))}</div>` : '');
      const badge = type === 'done'
        ? '<span class="hw-status-done-badge">Done</span>'
        : '<span class="hw-status-pending-badge">Pending</span>';
      return `
        <div class="hw-status-person">
          <div>
            <div class="hw-status-person-name">${label}</div>
            ${sub}
          </div>
          ${badge}
        </div>`;
    }).join('');
  }

  function renderStatusModal(assignments) {
    if (!statusBody) return;
    if (!assignments || !assignments.length) {
      statusBody.innerHTML = '<div class="hw-status-empty">No active homework right now.</div>';
      return;
    }

    statusBody.innerHTML = assignments.map((assignment) => `
      <section class="hw-status-card">
        <div class="hw-status-card-head">
          <div>
            <h4 class="hw-status-card-title">${htmlEscape(assignment.assignment_title || 'Assignment')}</h4>
            <div class="hw-status-card-meta">${htmlEscape(assignment.class || 'No class')} · Due ${htmlEscape(formatDueDate(assignment.due_at))}</div>
          </div>
          <div class="hw-status-card-counts">
            <strong>${Number(assignment.completed_count || 0)}/${Number(assignment.total_count || 0)}</strong>
            completed
          </div>
        </div>
        <div class="hw-status-lists">
          <div class="hw-status-list">
            <h4>Done</h4>
            ${renderPeople(assignment.done || [], 'done')}
          </div>
          <div class="hw-status-list">
            <h4>Not Yet</h4>
            ${renderPeople(assignment.pending || [], 'pending')}
          </div>
        </div>
      </section>`).join('');
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
    } catch (err) {
      const msg = err && err.message ? htmlEscape(err.message) : 'Could not load notifications.';
      body.innerHTML = `<div class="hw-notif-empty">${msg}</div>`;
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

  async function openStatusModal() {
    if (!statusBackdrop || !statusBody) return;
    closePanel();
    statusModalOpen = true;
    statusBackdrop.style.display = 'flex';
    statusBackdrop.setAttribute('aria-hidden', 'false');
    statusBody.innerHTML = '<div class="hw-status-loading">Loading active homework…</div>';
    try {
      const assignments = await fetchHomeworkStatus();
      renderStatusModal(assignments);
    } catch (err) {
      const msg = err && err.message ? htmlEscape(err.message) : 'Could not load homework status.';
      statusBody.innerHTML = `<div class="hw-status-empty">${msg}</div>`;
    }
  }

  function closeStatusModal() {
    if (!statusBackdrop) return;
    statusModalOpen = false;
    statusBackdrop.style.display = 'none';
    statusBackdrop.setAttribute('aria-hidden', 'true');
  }

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panelOpen) closePanel(); else openPanel();
  });

  document.addEventListener('click', (e) => {
    if (panelOpen && !wrapper.querySelector('.hw-notif-wrap').contains(e.target)) closePanel();
  });

  if (statusBtn) {
    statusBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openStatusModal();
    });
  }

  if (statusCloseBtn) {
    statusCloseBtn.addEventListener('click', () => closeStatusModal());
  }

  if (statusBackdrop) {
    statusBackdrop.addEventListener('click', (e) => {
      if (e.target === statusBackdrop) closeStatusModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (statusModalOpen) closeStatusModal();
      else if (panelOpen) closePanel();
    }
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
