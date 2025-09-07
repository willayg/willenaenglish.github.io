
import { FN } from './scripts/api-base.js';

// Shared helper: set both ovPoints and awardPoints (never decrease on screen)
function setPointsDisplayValue(points) {
  // Server-authoritative display: always set exactly to provided value
  try {
    const n = Math.max(0, Number(points ?? 0) || 0);
    const upd = (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = String(n);
    };
    upd('ovPoints');
    upd('awardPoints');
  } catch {}
}
(function(){
  // Helper to create origin-absolute URLs that ignore <base> tag
  const api = (path) => new URL(path, window.location.origin).toString();

  // Escape HTML special chars for safe innerHTML usage
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');

  // Points sync: do not decrease within a short window after an optimistic increase
  const NO_DECREASE_MS = 20000; // 20 seconds grace period
  const getLSNumber = (k, d = 0) => {
    try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) ? v : d; } catch { return d; }
  };

  // No localStorage token reads. We rely on secure HTTP-only cookies managed by the server.

  // Tiny cache with TTL in localStorage
  const CACHE_NS = 'profile_cache:';
  function setCache(key, value, ttlMs) {
    try {
      const payload = { t: Date.now(), ttl: ttlMs|0, v: value };
      localStorage.setItem(CACHE_NS + key, JSON.stringify(payload));
    } catch {}
  }
  function getCache(key) {
    try {
      const raw = localStorage.getItem(CACHE_NS + key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj.t !== 'number') return null;
      if (obj.ttl && Date.now() - obj.t > obj.ttl) return null;
      return obj.v;
    } catch { return null; }
  }

  const API = {
    attempts: () => api(FN('progress_summary') + `?section=attempts`),
    sessions: () => api(FN('progress_summary') + `?section=sessions`),
    kpi:      () => api(FN('progress_summary') + `?section=kpi`),
    modes:    () => api(FN('progress_summary') + `?section=modes`),
    badges:   () => api(FN('progress_summary') + `?section=badges`),
    overview: () => api(FN('progress_summary') + `?section=overview`),
    challenging: () => api(FN('progress_summary') + `?section=challenging`)
  };

  // Removed getUserId and all local/session storage lookups for sensitive user info

  async function fetchJSON(url){
    const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }

  function fmtDate(s){
    const d = new Date(s);
    return isNaN(d) ? '' : d.toLocaleString();
  }

  function setText(id, text){ const el = document.getElementById(id); if (el) el.textContent = text; }

  async function loadKpi(uid){
    // Deprecated in UI, but still used for best streak fallback if needed.
    try { await fetchJSON(API.kpi()); } catch {}
  }

  async function loadOverview(uid){
    try {
      const ov = await fetchJSON(API.overview());
  setText('ovPoints', (ov.points ?? 0).toString());
  setText('ovStars', (ov.stars ?? 0).toString());
      setText('ovListsExplored', ov.lists_explored ?? '0');
      setText('ovPerfectRuns', ov.perfect_runs ?? '0');
  setText('ovMasteredLists', (ov.mastered ?? ov.mastered_lists) ?? '0');
      setText('ovHotStreak', ov.best_streak ?? '0');
      setText('ovWordsDiscovered', ov.words_discovered ?? '0');
      setText('ovWordsMastered', ov.words_mastered ?? '0');
      setText('ovSessionsPlayed', ov.sessions_played ?? '0');
      setText('ovBadgesCount', ov.badges_count ?? '0');
      setText('ovFavoriteList', (ov.favorite_list && ov.favorite_list.name) || '—');
      setText('ovHardestWord', (ov.hardest_word && ov.hardest_word.word) || '—');
    } catch (e) {
  setText('ovPoints', '0');
  setText('ovStars', '0');
      setText('ovListsExplored', '0');
      setText('ovPerfectRuns', '0');
      setText('ovMasteredLists', '0');
      setText('ovHotStreak', '0');
      setText('ovWordsDiscovered', '0');
      setText('ovWordsMastered', '0');
      setText('ovSessionsPlayed', '0');
      setText('ovBadgesCount', '0');
      setText('ovFavoriteList', '—');
      setText('ovHardestWord', '—');
    }
  }

  async function loadBadges(uid){
    const wrap = document.getElementById('badgesWrap');
    try {
      const list = await fetchJSON(API.badges());
      if (!Array.isArray(list) || !list.length) { wrap.textContent = 'No badges yet.'; return; }
  const safe = list.slice(0, 200);
  wrap.innerHTML = safe.map(b => `<span class="badge" title="${esc(b.desc || '')}">${esc((b.emoji || '⭐') + ' ' + (b.name || ''))}</span>`).join('');
    } catch { wrap.textContent = 'No badges yet.'; }
  }

  async function loadModes(uid){
    const el = document.getElementById('modes');
    try {
      const list = await fetchJSON(API.modes());
      if (!Array.isArray(list) || !list.length) { el.textContent = 'No data yet.'; return; }
  const safe = list.slice(0, 200);
  el.innerHTML = safe.map(m => `<span class="mode-chip"><strong>${esc(m.mode)}</strong> · ${m.correct}/${m.total} (${Math.round((m.correct/(m.total||1))*100)}%)</span>`).join('');
    } catch { el.textContent = 'No data yet.'; }
  }

  async function loadSessions(uid){
    const tb = document.getElementById('sessionsBody');
    try {
  const list = await fetchJSON(API.sessions());
  if (!Array.isArray(list) || !list.length) { tb.innerHTML = '<tr><td colspan="3" class="mut">No sessions.</td></tr>'; return; }
  const safe = list.slice(0, 200);
  tb.innerHTML = safe.map(s => {
        const when = fmtDate(s.ended_at || s.started_at);
        // Show list_name if present inside summary
        let listName = '';
        try { let sum = s.summary; if (typeof sum === 'string') sum = JSON.parse(sum); listName = sum?.list_name || sum?.listName || ''; } catch {}
        const sumStr = renderSummary(s.summary);
        const meta = [sumStr, listName].filter(Boolean).join(' • ');
        return `<tr>
          <td data-label="When">${esc(when)}</td>
          <td data-label="Mode"><span class="pill">${esc(s.mode||'?')}<\/span></td>
          <td data-label="Summary">${esc(meta)}</td>
        </tr>`;
      }).join('');
    } catch { tb.innerHTML = '<tr><td colspan="3" class="mut">No sessions.</td></tr>'; }
  }

  function renderSummary(sum){
    if (!sum) return '';
    try {
      if (typeof sum === 'string') sum = JSON.parse(sum);
    } catch {}
    const parts = [];
    if (sum.score != null && sum.total != null) parts.push(`${sum.score}/${sum.total}`);
    if (sum.accuracy != null) parts.push(`${Math.round(sum.accuracy*100)}% acc`);
    if (sum.stars != null) {
      const stars = Math.max(0, Math.min(10, Number(sum.stars)||0));
      parts.push(`${'⭐'.repeat(stars)}`);
    }
    return parts.join(' · ');
  }

  async function loadAttempts(uid){
    const tb = document.getElementById('attemptsBody');
    try {
  const list = await fetchJSON(API.attempts());
  if (!Array.isArray(list) || !list.length) { tb.innerHTML = '<tr><td colspan="5" class="mut">No attempts.</td></tr>'; return; }
  const safe = list.slice(0, 200);
  tb.innerHTML = safe.map(a => `<tr>
        <td data-label="When">${esc(fmtDate(a.created_at))}</td>
        <td data-label="Mode">${esc(a.mode||'')}</td>
        <td data-label="Word">${esc(a.word||'')}</td>
        <td data-label="Result">${a.is_correct? '✅':'❌'}</td>
        <td data-label="+Pts">${a.points??''}</td>
      </tr>`).join('');
    } catch { tb.innerHTML = '<tr><td colspan="5" class="mut">No attempts.</td></tr>'; }
  }

  async function getProfileInfo() {
    try {
  const res = await fetch(api(FN('supabase_auth') + `?action=get_profile`), { credentials: 'include' });
      if (!res.ok) return {};
      const data = await res.json();
      // If korean_name or class are missing, try get_profile_name for fallback
      if ((!data.korean_name || !data.class) && data.success !== false) {
  const res2 = await fetch(api(FN('supabase_auth') + `?action=get_profile_name`), { credentials: 'include' });
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.korean_name) data.korean_name = data2.korean_name;
          if (data2.class) data.class = data2.class;
        }
      }
      return data;
    } catch { return {}; }
  }

  async function updateProfileAvatar(avatar) {
    try {
  const res = await fetch(api(FN('supabase_auth') + `?action=update_profile_avatar`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatar })
      });
      return res.ok;
    } catch { return false; }
  }

  window.addEventListener('DOMContentLoaded', async () => {
  const nameEl = document.getElementById('pfName');
  const avatarEl = document.getElementById('pfAvatar');
  const overlayEl = document.getElementById('loadingOverlay');
  const showOverlay = () => { if (overlayEl) { overlayEl.style.display = 'flex'; overlayEl.setAttribute('aria-hidden', 'false'); } };
  const hideOverlay = () => { if (overlayEl) { overlayEl.style.display = 'none'; overlayEl.setAttribute('aria-hidden', 'true'); } };
  showOverlay();
  // Fetch username and avatar from cookie session
  const infoPromise = getProfileInfo();
  // Use a stable per-session cache key; we no longer rely on a client-side UID
  const uid = 'me';

    // Try cached critical sections first (1 min TTL)
    const TTL = 60 * 1000;
    const cacheOv = getCache(`ov:${uid}`);
    const cacheBadges = getCache(`badges:${uid}`);
    const cacheChal = getCache(`challenging:${uid}`);
  // Modes cache removed

    // Track last badges for correct count
    let lastBadges = [];
    const paintOverview = (ov) => {
      setPointsDisplayValue((ov && ov.points != null) ? ov.points : 0);
      setText('ovStars', (ov && ov.stars != null) ? ov.stars : '0');
      setText('ovListsExplored', (ov && ov.lists_explored != null) ? ov.lists_explored : '0');
      setText('ovPerfectRuns', (ov && ov.perfect_runs != null) ? ov.perfect_runs : '0');
      setText('ovMasteredLists', (ov && (ov.mastered ?? ov.mastered_lists) != null) ? (ov.mastered ?? ov.mastered_lists) : '0');
      setText('ovHotStreak', (ov && ov.best_streak != null) ? ov.best_streak : '0');
      setText('ovWordsDiscovered', (ov && ov.words_discovered != null) ? ov.words_discovered : '0');
      setText('ovWordsMastered', (ov && ov.words_mastered != null) ? ov.words_mastered : '0');
      setText('ovSessionsPlayed', (ov && ov.sessions_played != null) ? ov.sessions_played : '0');
      // Use lastBadges for count if available, else fallback
      setText('ovBadgesCount', Array.isArray(lastBadges) && lastBadges.length ? lastBadges.length : (ov && ov.badges_count != null ? ov.badges_count : '0'));
      setText('ovFavoriteList', (ov && ov.favorite_list && ov.favorite_list.name) ? ov.favorite_list.name : '—');
      setText('ovHardestWord', (ov && ov.hardest_word && ov.hardest_word.word) ? ov.hardest_word.word : '—');
    };
    const paintBadges = (badges) => {
      lastBadges = Array.isArray(badges) ? badges : [];
      const wrap = document.getElementById('badgesWrap');
      if (!wrap) return;
      if (!lastBadges.length) {
        wrap.textContent = 'No badges yet.';
        return;
      }
      const safe = lastBadges.slice(0, 200);
      wrap.innerHTML = safe
        .map(b => `<span class="badge" title="${esc(b?.desc || '')}">${esc((b?.emoji || '⭐') + ' ' + (b?.name || ''))}</span>`)
        .join('');
    };
    const paintChallenging = (challenging) => {
      const listEl = document.getElementById('challengingList');
      const emptyEl = document.getElementById('challengingEmpty');
      if (!listEl) return;
      // Filter out entries where any field is the placeholder '[picture]' (case-insensitive, with optional brackets)
      const isPicturePlaceholder = (s) => {
        if (!s || typeof s !== 'string') return false;
        const t = s.trim().toLowerCase();
        // Only treat as placeholder if brackets/parentheses/braces are present
        const hasBrackets = /[\[\]\(\)\{\}]/.test(t);
        if (!hasBrackets) return false;
        const core = t.replace(/^[\s\[\(\{]+|[\s\]\)\}]+$/g, '');
        return core === 'picture';
      };
      const items = Array.isArray(challenging) ? challenging : [];
      // Build cards, skipping only when the main English word is a placeholder
      const cards = items.map(item => {
        const accPct = Math.round((item.accuracy || 0) * 100);
        const cls = accPct <= 0 ? 'zero' : (accPct < 70 ? 'bad' : 'ok');
        const skillLower = (item.skill || '').toLowerCase();
        // Prefer word_en, then word
        let mainWord = (item.word_en ?? item.word ?? '').toString();
        if (isPicturePlaceholder(mainWord)) return null; // skip this entry entirely
        // Optional sub (Korean); suppress if placeholder
        let subKorTxt = item.word_kr;
        if (isPicturePlaceholder(subKorTxt)) subKorTxt = '';
  const subKor = subKorTxt ? `<div class="cw-sub">${esc(subKorTxt)}</div>` : '';
        return `
            <div class="cw-card">
              <div>
                <div class="cw-word">${esc(mainWord)}</div>
                ${subKor}
              </div>
              <div class="cw-right">
                <div class="cw-acc ${cls}">${accPct}%</div>
                <div class="cw-skill">${esc(skillLower)}</div>
              </div>
            </div>
        `;
      }).filter(Boolean);
      if (!cards.length) {
        if (emptyEl) emptyEl.textContent = 'No challenging words yet.';
        listEl.innerHTML = '';
      } else {
        if (emptyEl) emptyEl.remove();
        listEl.innerHTML = cards.join('');
      }
    };
  // paintModes removed

    // Prime from localStorage immediately (monotonic)
    try {
      const prim = Number(localStorage.getItem('user_points') || '0') || 0;
      setPointsDisplayValue(prim);
    } catch {}

    // Paint cached immediately if present
  if (cacheOv || cacheBadges || cacheChal) {
      if (cacheOv) paintOverview(cacheOv);
      if (cacheBadges) paintBadges(cacheBadges);
      if (cacheChal) paintChallenging(cacheChal);
      hideOverlay();
    }

    // Fetch critical fresh data in parallel
  const [info, ov, badges, challenging] = await Promise.all([
      infoPromise,
  fetchJSON(API.overview()).catch(() => null),
  fetchJSON(API.badges()).catch(() => null),
  fetchJSON(API.challenging()).catch(() => null)
    ]);

    // Apply and cache fresh
  // Info from get_profile: { success, name, email, username, avatar }
  const displayName = (info && (info.name || info.username)) || 'Student Profile';
  nameEl.textContent = displayName;
  avatarEl.textContent = (info && info.avatar) || '🙂';
  // Fill hero card fields if present
  const heroAvatar = document.getElementById('pfHeroAvatar');
  if (heroAvatar) heroAvatar.textContent = (info && info.avatar) || '🐼';
  const nameEnEl = document.getElementById('pfNameEn');
  const nameKoEl = document.getElementById('pfNameKo');
  const classEl = document.getElementById('pfClass');
  const emailEl = document.getElementById('pfEmail');
  if (nameEnEl) nameEnEl.textContent = info && (info.name || info.username) || '';
  // Only set Korean name and class when present to avoid wiping placeholders
  if (nameKoEl && info && typeof info.korean_name === 'string' && info.korean_name.trim()) {
    nameKoEl.textContent = info.korean_name;
  }
  if (classEl && info && (typeof info.class === 'string' && info.class.trim())) {
    classEl.textContent = info.class;
  }
  // Minimal debug to verify returned keys if fields are missing
  if (!info?.korean_name || !info?.class) {
    try { console.debug('[profile] get_profile keys:', Object.keys(info||{})); } catch {}
  }
  if (emailEl) emailEl.textContent = info && info.email ? info.email : '';
  if (ov) { paintOverview(ov); setCache(`ov:${uid}`, ov, TTL); }
  // Sync header points pill to the latest overview points
  try {
    if (ov && typeof ov.points === 'number') {
      const now = Date.now();
      const cur = getLSNumber('user_points', 0);
      const lastIncAt = getLSNumber('user_points_last_inc_at', 0);
      const withinWindow = lastIncAt && (now - lastIncAt) < NO_DECREASE_MS;

      // Decide whether to write server value to LS
      if (!(withinWindow && ov.points < cur)) {
        // Either server >= current, or window expired => accept server as source of truth
        try { localStorage.setItem('user_points', String(ov.points)); } catch {}
      }
      // Display should never dip during the window
      setPointsDisplayValue(Math.max(cur, ov.points));

      const header = document.querySelector('student-header');
      if (header && typeof header.refresh === 'function') header.refresh();
    }
  } catch {}
  // Awards counters
  const setCount = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = String(v ?? 0); };
  // Avoid dropping below a higher local value (e.g., recent optimistic increment)
  const __curLS = getLSNumber('user_points', 0);
  const __sv = (ov && typeof ov.points === 'number') ? ov.points : 0;
  setPointsDisplayValue(Math.max(__curLS, __sv));
  setCount('awardStars', ov && ov.stars);
  // Derive medals from perfect_runs (or mastered_lists if preferred)
  setCount('awardMedals', ov && (ov.perfect_runs ?? ov.mastered_lists));
  paintBadges(badges); setCache(`badges:${uid}`, badges, TTL);
  setCount('awardBadges', Array.isArray(badges) ? badges.length : (ov && ov.badges_count));
  paintChallenging(challenging); setCache(`challenging:${uid}`, challenging, TTL);
    hideOverlay();

    // Defer non-critical tables (sessions, attempts)
  // Removed: deferred sessions/attempts fetch

    // Avatar modal behavior (deferred until after main data loads)
    const overlay = document.getElementById('avatarModal');
    const grid = document.getElementById('emojiGrid');
    const btnClose = document.getElementById('avatarClose');
    const btnCancel = document.getElementById('avatarCancel');
    const btnSave = document.getElementById('avatarSave');
    const choices = ['🙂','😃','😎','🦄','🐱','🐶','👽','🤖','🌟','🎓','🧑‍🎓','🧑‍🚀','🧑‍💻','🦊','🐼','🐵','🐸','🐯','🐨','🐷'];
    let current = avatarEl.textContent;
    let selected = current;
    function openModal() {
      if (!overlay) return;
      if (grid && !grid.dataset.ready) {
        grid.innerHTML = choices.map(e => `<button class="emoji-btn" data-e="${e}">${e}</button>`).join('');
        grid.dataset.ready = '1';
        grid.addEventListener('click', (ev) => {
          const btn = ev.target.closest('.emoji-btn');
          if (!btn) return;
          selected = btn.dataset.e;
          [...grid.querySelectorAll('.emoji-btn')].forEach(b => b.classList.toggle('selected', b.dataset.e === selected));
        });
      }
      if (grid) [...grid.querySelectorAll('.emoji-btn')].forEach(b => b.classList.toggle('selected', b.dataset.e === current));
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden', 'false');
    }
    function closeModal() {
      if (!overlay) return;
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (avatarEl) avatarEl.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (btnSave) btnSave.addEventListener('click', async () => {
      try {
        current = selected;
        if (avatarEl) avatarEl.textContent = current;
        closeModal();
        const ok = await updateProfileAvatar(current);
        if (!ok) {
          // Revert UI if save failed
          if (avatarEl) avatarEl.textContent = '🙂';
        }
      } catch {}
    });
  hideOverlay();
  });
})();

// Live updates: reflect point changes made in other tabs/pages
(function(){
  // Local, duplicated helpers for scope safety
  const NO_DECREASE_MS = 20000;
  const getLSNumber = (k, d = 0) => {
    try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) ? v : d; } catch { return d; }
  };
  const api = (path) => new URL(path, window.location.origin).toString();
  function updatePointsFromLS(){
    try {
      const raw = localStorage.getItem('user_points');
      if (raw != null && raw !== '') {
        const n = Number(raw);
        if (!Number.isNaN(n)) {
          // Display current LS value; no-decrease is enforced when server responses arrive
          setPointsDisplayValue(n);
        }
      }
    } catch {}
  }
  async function refreshOverviewQuick(){
    try {
  const res = await fetch(api(FN('progress_summary') + '?section=overview'), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const ov = await res.json().catch(() => null);
      if (ov) {
        // Server-authoritative write with no-decrease grace
        try {
          if (typeof ov.points === 'number') {
            const now = Date.now();
            const cur = getLSNumber('user_points', 0);
            const lastIncAt = getLSNumber('user_points_last_inc_at', 0);
            const withinWindow = lastIncAt && (now - lastIncAt) < NO_DECREASE_MS;
            if (!(withinWindow && ov.points < cur)) {
              localStorage.setItem('user_points', String(ov.points));
            }
            setPointsDisplayValue(Math.max(cur, ov.points));
          } else {
            setPointsDisplayValue(ov.points ?? 0);
          }
        } catch {}
        const setTxt = (id, text)=>{ const el = document.getElementById(id); if (el) el.textContent = text; };
        setTxt('ovStars', (ov.stars ?? 0).toString());
        setTxt('awardStars', (ov.stars ?? 0).toString());
      }
    } catch {}
  }
  window.addEventListener('storage', (e) => {
    if (e && e.key === 'user_points') updatePointsFromLS();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshOverviewQuick();
  });
})();
