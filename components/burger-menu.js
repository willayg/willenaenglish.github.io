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
        .burger-menu { position: fixed; top: 10px; right: 10px; z-index: 9999; display: flex; align-items: stretch; border-radius: 12px; overflow: visible; box-shadow: 0 10px 22px rgba(15, 23, 42, 0.22); }
        .burger-user-label { display: none; max-width: 140px; padding: 0 12px; background: rgba(255,255,255,0.96); color: #334155; border: 1px solid rgba(15, 23, 42, 0.08); border-right: none; border-radius: 12px 0 0 12px; font-size: 12px; font-weight: 700; align-items: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12); }
        .burger-btn, .hw-notif-btn { width: 42px; height: 38px; border: none; background: linear-gradient(180deg, #19d2df 0%, #00b4c6 100%); color: white; cursor: pointer; font-size: 16px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
        .hw-notif-btn { border-radius: 0; }
        .burger-btn { border-left: 1px solid rgba(255,255,255,0.35); border-radius: 0 12px 12px 0; }
        .burger-btn:hover, .hw-notif-btn:hover { background: linear-gradient(180deg, #12c0cf 0%, #0293a4 100%); }
        .burger-dropdown { display: none; position: absolute; top: 50px; right: 0; background: white; box-shadow: 0 4px 8px rgba(0,0,0,0.2); border-radius: 5px; min-width: 220px; max-height: 70vh; overflow: auto; }
        .burger-dropdown a { display: block; padding: 12px 16px; text-decoration: none; color: #333; border-bottom: 1px solid #eee; }
        .burger-dropdown a:hover { background: #f1f1f1; }
        .burger-dropdown a:last-child { border-bottom: none; }
        .hw-notif-wrap { position: relative; }
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
        .hw-status-modal { width: min(1120px, 100%); max-height: min(88vh, 860px); overflow: hidden; background: #ffffff; border-radius: 20px; box-shadow: 0 24px 64px rgba(15, 23, 42, 0.3); display: flex; flex-direction: column; }
        .hw-status-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e5e7eb; background: #ffffff; }
        .hw-status-modal-heading { min-width: 0; }
        .hw-status-modal-title { font-size: 16px; font-weight: 700; color: #111827; margin: 0; }
        .hw-status-modal-subtitle { margin: 4px 0 0; font-size: 12px; color: #64748b; }
        .hw-status-modal-close { border: none; background: transparent; font-size: 24px; line-height: 1; cursor: pointer; color: #64748b; padding: 0; }
        .hw-status-modal-body { padding: 16px 18px 18px; overflow: auto; display: flex; flex-direction: column; gap: 14px; background: #f3f4f6; }
        .hw-status-loading, .hw-status-empty { padding: 28px 16px; text-align: center; color: #64748b; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; }
        .hw-status-toolbar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 14px; background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(6px); }
        .hw-status-toolbar-label { font-size: 12px; color: #6b7280; font-weight: 600; margin-right: 2px; }
        .hw-status-toolbar-select { min-width: 160px; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 10px; background: #ffffff; color: #111827; font-size: 13px; }
        .hw-status-summary { margin-left: auto; font-size: 12px; color: #6b7280; white-space: nowrap; }
        .hw-status-cards { display: flex; flex-direction: column; gap: 14px; }
        .hw-status-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08); }
        .hw-status-card-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 14px 16px; border-bottom: 1px solid #eef2f7; background: #ffffff; }
        .hw-status-card-title { margin: 0; font-size: 15px; font-weight: 700; color: #111827; }
        .hw-status-card-meta { margin-top: 4px; font-size: 12px; color: #64748b; }
        .hw-status-card-counts { text-align: right; font-size: 12px; color: #4b5563; }
        .hw-status-card-counts strong { display: block; font-size: 16px; color: #111827; }
        .hw-status-card-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .hw-status-chip { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 700; background: #f3f4f6; color: #4b5563; border: 1px solid #e5e7eb; }
        .hw-status-chip.mode, .hw-status-chip.class { background: #f3f4f6; color: #4b5563; }
        .hw-status-lists { display: grid; grid-template-columns: 1fr 1fr; gap: 0; align-items: start; }
        .hw-status-list { padding: 14px 16px; min-height: 0; }
        .hw-status-list + .hw-status-list { border-left: 1px solid #eef2f7; }
        .hw-status-list h4 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
        .hw-status-list-scroll { max-height: 200px; overflow: auto; padding-right: 4px; }
        .hw-status-empty-list { padding: 12px 0; font-size: 12px; color: #64748b; }
        .hw-status-person { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
        .hw-status-person:last-child { border-bottom: none; }
        .hw-status-person-name { font-size: 13px; font-weight: 600; color: #111827; }
        .hw-status-person-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
        .hw-status-done-badge, .hw-status-pending-badge { flex-shrink: 0; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 700; }
        .hw-status-done-badge { background: #eef2f7; color: #374151; }
        .hw-status-pending-badge { background: #f3f4f6; color: #6b7280; }
        @media (max-width: 700px) { .burger-btn, .hw-notif-btn { width: 40px; height: 36px; } .burger-user-label { max-width: 100px; padding: 0 10px; font-size: 11px; } .hw-status-modal-backdrop { padding: 12px; } .hw-status-lists { grid-template-columns: 1fr; } .hw-status-list + .hw-status-list { border-left: none; border-top: 1px solid #eef2f7; } .hw-notif-footer { flex-direction: column; } .hw-status-toolbar { align-items: stretch; } .hw-status-toolbar-select { width: 100%; } .hw-status-summary { margin-left: 0; width: 100%; white-space: normal; } }
      </style>
      <div class="burger-menu">
        <div class="burger-user-label" id="burgerUserLabel"></div>
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
              <div class="hw-status-modal-heading">
                <h3 class="hw-status-modal-title">Active Homework</h3>
                <p class="hw-status-modal-subtitle">See each assignment, its class, the required mode, and who is done or still pending.</p>
              </div>
              <button type="button" class="hw-status-modal-close" id="hwStatusModalClose" aria-label="Close">×</button>
            </div>
            <div class="hw-status-modal-body" id="hwStatusModalBody"><div class="hw-status-loading">Loading active homework…</div></div>
          </div>
        </div>
        <div class="burger-dropdown-wrap" style="position:relative;">
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
            <a href="/Teachers/tools/feedback-admin.html" data-admin-only style="display:none;">Admin Tools</a>
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
  const userLabel = wrapper.querySelector('#burgerUserLabel');
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
  const adminOnlyLinks = Array.from(wrapper.querySelectorAll('[data-admin-only]'));

  function getStoredRole() {
    try {
      return String(localStorage.getItem('userRole') || localStorage.getItem('role') || '').trim().toLowerCase();
    } catch {
      return '';
    }
  }

  function applyAdminVisibility() {
    const isAdmin = getStoredRole() === 'admin';
    adminOnlyLinks.forEach((link) => {
      link.style.display = isAdmin ? 'block' : 'none';
    });
  }

  function getStoredDisplayName() {
    try {
      const direct = localStorage.getItem('username') || localStorage.getItem('name') || '';
      if (direct && String(direct).trim()) return String(direct).trim();
      const email = localStorage.getItem('userEmail') || '';
      if (email && String(email).includes('@')) return String(email).split('@')[0];
    } catch {}
    return '';
  }

  async function hydrateTeacherName() {
    if (!userLabel) return;
    const cached = getStoredDisplayName();
    if (cached) {
      userLabel.textContent = cached;
      userLabel.style.display = 'flex';
      return;
    }
    try {
      const api = window.WillenaAPI?.fetch ? window.WillenaAPI.fetch.bind(window.WillenaAPI) : (url, options) => fetch(url, { credentials: 'include', ...options });
      const res = await api('/.netlify/functions/supabase_auth?action=get_profile_name&_=' + Date.now(), { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const name = String(data?.name || data?.profile_name || '').trim();
      if (res.ok && name) {
        userLabel.textContent = name;
        userLabel.style.display = 'flex';
        try { localStorage.setItem('username', name); } catch {}
      }
    } catch {}
  }

  applyAdminVisibility();
  hydrateTeacherName();

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
  const STATUS_CACHE_KEY = 'hw_notif_status_data_v2';
  const STATUS_FETCHED_KEY = 'hw_notif_status_fetched_at';
  const SEEN_KEY    = 'hw_notif_last_seen';
  const CACHE_TTL   = 60_000;   // 1 min
  const POLL_MS     = 60_000;   // 1 min

  let panelOpen   = false;
  let pollTimer   = null;
  let currentCount = 0;
  let statusModalOpen = false;
  let statusAssignments = [];
  let statusClassFilter = 'all';
  let statusSort = 'due_asc';

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

  async function fetchHomeworkStatus(options = {}) {
    const force = !!(options && options.force);
    const now = Date.now();
    const fetchedAt = parseInt(sessionStorage.getItem(STATUS_FETCHED_KEY) || '0', 10);
    if (!force && now - fetchedAt < CACHE_TTL) {
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

    const baseAssignments = Array.isArray(d.assignments) ? d.assignments : [];
    const assignments = await Promise.all(baseAssignments.map(async (assignment) => {
      try {
        const progressParams = new URLSearchParams();
        progressParams.set('action', 'assignment_progress');
        progressParams.set('assignment_id', String(assignment.assignment_id || ''));
        if (assignment.class) progressParams.set('class', String(assignment.class));
        const modeHint = String(assignment.difficulty_mode || assignment.forced_mode || '').toLowerCase();
        if (modeHint === 'spelling') progressParams.set('spelling_only', '1');
        if (modeHint === 'sentence_unscramble' || modeHint === 'full_sentence_mode') progressParams.set('sentence_only', '1');

        const progressResp = await apiFetch(`${API}?${progressParams.toString()}`, {});
        const progressData = await progressResp.json().catch(() => null);
        if (!progressResp.ok || !progressData || !progressData.success || !Array.isArray(progressData.progress)) {
          return assignment;
        }

        const rosterMap = new Map();
        [...(assignment.done || []), ...(assignment.pending || [])].forEach((student) => {
          rosterMap.set(String(student.user_id), student);
        });

        const done = [];
        const pending = [];
        progressData.progress.forEach((row) => {
          const id = String(row.user_id || '');
          if (!id) return;
          const baseStudent = rosterMap.get(id) || {};
          const completion = Number(row.completion ?? row.completion_pct ?? 0) || 0;
          const modesList = Array.isArray(row.modes) ? row.modes : [];
          const rowModesTotal = Number(row.modes_total);
          const responseModesTotal = Number(progressData.total_modes);
          const assignmentModesTotal = Number(assignment.modes_total);
          const modesTotal = [rowModesTotal, responseModesTotal, assignmentModesTotal].find((value) => Number.isFinite(value) && value > 0) || null;
          const starsEarned = Number(row.stars || 0) || 0;
          const starsPossible = Number.isFinite(modesTotal) ? (modesTotal * 5) : null;
          const entry = {
            user_id: id,
            name: row.name || baseStudent.name || null,
            korean_name: row.korean_name || baseStudent.korean_name || null,
            stars: starsEarned,
            stars_possible: starsPossible,
            mode: modesList.length ? modesList[modesList.length - 1].mode : null,
            mode_breakdown: modesList,
            completion,
            completed_at: baseStudent.completed_at || null,
          };
          if (String(row.status || '').toLowerCase() === 'completed' || completion >= 100) done.push(entry);
          else pending.push(entry);
          if (rosterMap.has(id)) rosterMap.delete(id);
        });

        rosterMap.forEach((student, id) => {
          pending.push({
            user_id: id,
            name: student.name || null,
            korean_name: student.korean_name || null,
            completion: Number(student.completion || 0) || 0,
          });
        });

        done.sort((left, right) => String(left.name || left.korean_name || '').localeCompare(String(right.name || right.korean_name || '')));
        pending.sort((left, right) => String(left.name || left.korean_name || '').localeCompare(String(right.name || right.korean_name || '')));

        return {
          ...assignment,
          done,
          pending,
          completed_count: done.length,
          pending_count: pending.length,
          total_count: done.length + pending.length,
        };
      } catch {
        return assignment;
      }
    }));

    sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(assignments));
    sessionStorage.setItem(STATUS_FETCHED_KEY, String(Date.now()));
    return assignments;
  }

  function formatTimeAgo(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function renderStars(n) {
    const stars = Math.max(0, Math.min(5, Number(n) || 0));
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  function formatDueDate(iso) {
    if (!iso) return 'No due date';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatModeLabel(mode) {
    const key = String(mode || '').trim().toLowerCase();
    if (!key) return '';
    const labels = {
      full: 'Full assignment',
      spelling: 'Spelling only',
      sentence_unscramble: 'Sentence unscramble',
      full_sentence_mode: 'Sentence mode',
      easy: 'Easy target',
      standard: 'Standard target',
      hard: 'Hard target',
      listen_and_spell: 'Listen and spell',
      multi_choice_eng_to_kor: 'Match',
      word_match: 'Match',
      listen: 'Listen',
      read: 'Read',
      spell: 'Spell',
      test: 'Test',
      level_up: 'Level up',
      choose: 'Choose',
      fill: 'Fill',
      unscramble: 'Unscramble',
      sorting: 'Sorting',
      find_mistake: 'Find mistake',
      translation: 'Translation',
      lesson: 'Lesson',
    };
    if (labels[key]) return labels[key];
    return key.split(/[_-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getAssignmentRequirement(assignment) {
    const difficultyMode = String(assignment.difficulty_mode || '').trim().toLowerCase();
    const forcedMode = String(assignment.forced_mode || '').trim().toLowerCase();
    const modesRequired = toNumberOrNull(assignment.modes_required);
    const modesTotal = toNumberOrNull(assignment.modes_total);
    const requiredStars = toNumberOrNull(assignment.required_stars);
    const maxStars = toNumberOrNull(assignment.max_stars);

    if (difficultyMode === 'full') {
      if (modesRequired && modesTotal) return `${modesRequired}/${modesTotal} modes required`;
      if (modesTotal) return `${modesTotal} modes required`;
      return 'All modes required';
    }
    if (difficultyMode === 'spelling' || forcedMode === 'spelling') return 'Complete the spelling mode';
    if (difficultyMode === 'sentence_unscramble' || forcedMode === 'full_sentence_mode') return 'Complete the sentence mode';
    if (requiredStars) return maxStars ? `${requiredStars}+ of ${maxStars} stars required` : `${requiredStars}+ stars required`;
    if (modesRequired) return `${modesRequired} mode${modesRequired === 1 ? '' : 's'} required`;
    return '';
  }

  function getClassFilterOptions(assignments) {
    return [...new Set((assignments || []).map((assignment) => String(assignment.class || '').trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  }

  function sortAssignments(assignments) {
    const list = [...assignments];
    list.sort((left, right) => {
      const leftTime = Date.parse(left.due_at || left.created_at || '') || 0;
      const rightTime = Date.parse(right.due_at || right.created_at || '') || 0;
      if (statusSort === 'due_desc') return rightTime - leftTime;
      return leftTime - rightTime;
    });
    return list;
  }

  function filterAssignments(assignments) {
    const filtered = statusClassFilter === 'all'
      ? [...assignments]
      : assignments.filter((assignment) => String(assignment.class || '') === statusClassFilter);
    return sortAssignments(filtered);
  }

  function renderAssignmentChips(assignment) {
    const chips = [];
    if (assignment.class) chips.push({ kind: 'class', label: assignment.class });
    const modeLabel = formatModeLabel(assignment.difficulty_mode || assignment.forced_mode);
    if (modeLabel) chips.push({ kind: 'mode', label: modeLabel });
    const requirement = getAssignmentRequirement(assignment);
    if (requirement) chips.push({ kind: '', label: requirement });
    return chips.map((chip) => `<span class="hw-status-chip${chip.kind ? ` ${chip.kind}` : ''}">${htmlEscape(chip.label)}</span>`).join('');
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
      return `<div class="hw-status-empty-list">${type === 'done' ? 'Nobody has completed this yet.' : 'Everyone assigned has finished.'}</div>`;
    }
    return list.map((person) => {
      const label = htmlEscape(person.name || person.korean_name || person.user_id || 'Student');
      const metaLines = [];
      if (person.korean_name && person.korean_name !== person.name) {
        metaLines.push(String(person.korean_name));
      }

      const starsEarned = Number(person.stars || 0) || 0;
      const starsPossible = Number(person.stars_possible);
      const progressBits = [];
      if (Number.isFinite(starsPossible) && starsPossible > 0) progressBits.push(`Stars ${starsEarned}/${starsPossible}`);
      else if (starsEarned > 0) progressBits.push(`Stars ${starsEarned}`);

      const completion = Number(person.completion);
      if (Number.isFinite(completion)) progressBits.push(`${Math.max(0, Math.min(100, Math.round(completion)))}% complete`);
      if (progressBits.length) metaLines.push(progressBits.join(' · '));

      const modeBreakdown = Array.isArray(person.mode_breakdown)
        ? person.mode_breakdown
            .filter((modeEntry) => Number.isFinite(Number(modeEntry && modeEntry.bestStars)))
            .map((modeEntry) => `${formatModeLabel(modeEntry.mode)} ${Math.max(0, Math.min(5, Number(modeEntry.bestStars) || 0))}★`)
            .filter(Boolean)
            .join(' · ')
        : '';
      if (modeBreakdown) metaLines.push(modeBreakdown);

      if (type === 'done' && person.completed_at) {
        const modeText = person.mode ? formatModeLabel(person.mode) : '';
        metaLines.push([formatTimeAgo(person.completed_at), modeText].filter(Boolean).join(' · '));
      }

      const sub = metaLines.map((line) => `<div class="hw-status-person-meta">${htmlEscape(line)}</div>`).join('');
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

  function renderStatusCards(assignments) {
    if (!assignments.length) {
      return '<div class="hw-status-empty">No active homework matches that filter.</div>';
    }
    return assignments.map((assignment) => `
      <section class="hw-status-card">
        <div class="hw-status-card-head">
          <div>
            <h4 class="hw-status-card-title">${htmlEscape(assignment.assignment_title || 'Assignment')}</h4>
            <div class="hw-status-card-meta">Due ${htmlEscape(formatDueDate(assignment.due_at))}${assignment.pending_count ? ` · ${Number(assignment.pending_count || 0)} pending` : ' · Everyone finished'}</div>
            <div class="hw-status-card-chips">${renderAssignmentChips(assignment)}</div>
          </div>
          <div class="hw-status-card-counts">
            <strong>${Number(assignment.completed_count || 0)}/${Number(assignment.total_count || 0)}</strong>
            completed
          </div>
        </div>
        <div class="hw-status-lists">
          <div class="hw-status-list">
            <h4>Done</h4>
            <div class="hw-status-list-scroll">${renderPeople(assignment.done || [], 'done')}</div>
          </div>
          <div class="hw-status-list">
            <h4>Not Yet</h4>
            <div class="hw-status-list-scroll">${renderPeople(assignment.pending || [], 'pending')}</div>
          </div>
        </div>
      </section>`).join('');
  }

  function renderStatusModal(assignments) {
    if (!statusBody) return;
    statusAssignments = Array.isArray(assignments) ? assignments : [];
    if (!statusAssignments.length) {
      statusBody.innerHTML = '<div class="hw-status-empty">No active homework right now.</div>';
      return;
    }

    const classOptions = getClassFilterOptions(statusAssignments);
    if (statusClassFilter !== 'all' && !classOptions.includes(statusClassFilter)) {
      statusClassFilter = 'all';
    }
    const filteredAssignments = filterAssignments(statusAssignments);

    statusBody.innerHTML = `
      <div class="hw-status-toolbar">
        <span class="hw-status-toolbar-label">Class</span>
        <select class="hw-status-toolbar-select" id="hwStatusClassFilter">
          <option value="all">All classes</option>
          ${classOptions.map((className) => `<option value="${htmlEscape(className)}"${className === statusClassFilter ? ' selected' : ''}>${htmlEscape(className)}</option>`).join('')}
        </select>
        <span class="hw-status-toolbar-label">Sort</span>
        <select class="hw-status-toolbar-select" id="hwStatusSortOrder">
          <option value="due_asc"${statusSort === 'due_asc' ? ' selected' : ''}>Earliest due first</option>
          <option value="due_desc"${statusSort === 'due_desc' ? ' selected' : ''}>Latest due first</option>
        </select>
        <div class="hw-status-summary">${filteredAssignments.length} assignment${filteredAssignments.length === 1 ? '' : 's'} shown</div>
      </div>
      <div class="hw-status-cards">${renderStatusCards(filteredAssignments)}</div>`;

    const classFilter = statusBody.querySelector('#hwStatusClassFilter');
    const sortOrder = statusBody.querySelector('#hwStatusSortOrder');
    if (classFilter) {
      classFilter.addEventListener('change', () => {
        statusClassFilter = classFilter.value || 'all';
        renderStatusModal(statusAssignments);
      });
    }
    if (sortOrder) {
      sortOrder.addEventListener('change', () => {
        statusSort = sortOrder.value || 'due_asc';
        renderStatusModal(statusAssignments);
      });
    }
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
      const assignments = await fetchHomeworkStatus({ force: true });
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
