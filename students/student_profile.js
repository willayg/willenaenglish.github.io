
import { FN } from './scripts/api-base.js';
import { initPointsClient } from './scripts/points-client.js';

// Scoreless build: no points display helper
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

  const getLSNumber = (k, d = 0) => { try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) ? v : d; } catch { return d; } };

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
  challenging: () => api(FN('progress_summary') + `?section=challenging`),
  correctCount: () => api(FN('count_true_attempts'))
  };

  // Removed getUserId and all local/session storage lookups for sensitive user info

  async function fetchJSON(url){
    const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }

  // Small timeout wrapper to avoid blocking UI on slow functions
  async function fetchWithTimeout(url, { ms = 2000, cache = 'default', label = '' } = {}){
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { credentials: 'include', cache, signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (e) {
      if (label) console.warn('[profile] timeout/fetch fail', label, e.message||e);
      throw e;
    } finally { clearTimeout(id); }
  }
  const tryJSON = async (fn) => { try { return await fn(); } catch { return null; } };

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
      const [ov, cc] = await Promise.all([
        fetchJSON(API.overview()),
        fetchJSON(API.correctCount()).catch(() => ({}))
      ]);
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
  const pts = (typeof cc.points === 'number') ? cc.points : (typeof cc.correct === 'number' ? cc.correct : (ov.points ?? 0));
      setText('awardPoints', String(pts));
      try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total: pts } })); } catch {}
      try { window.dispatchEvent(new CustomEvent('profile:overview', { detail: ov })); } catch {}
    } catch (e) {
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
      setText('awardPoints', '0');
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

  // Avatar update moved to students/avatar.js

  window.addEventListener('DOMContentLoaded', async () => {
  // Standardize storage listeners and show GitHub Pages notice if applicable
  try { initPointsClient(); } catch {}
  const nameEl = document.getElementById('pfName');
  const avatarEl = document.getElementById('pfAvatar');
  const overlayEl = document.getElementById('loadingOverlay');
  const showOverlay = () => { if (overlayEl) { overlayEl.style.display = 'flex'; overlayEl.setAttribute('aria-hidden', 'false'); } };
  const hideOverlay = () => { if (overlayEl) { overlayEl.style.display = 'none'; overlayEl.setAttribute('aria-hidden', 'true'); } };
  showOverlay();
  // Defer profile info; not critical to first paint
  let info = null;
  // Use a stable per-session cache key; we no longer rely on a client-side UID
  const uid = 'me';
  const IS_GHPAGES = /github\.io$/i.test(location.hostname);

    // Small, unobtrusive notice bar for sync status
    function showNotice(msg, tone = 'info'){
      try {
        let bar = document.getElementById('syncNotice');
        if (!bar) {
          bar = document.createElement('div');
          bar.id = 'syncNotice';
          bar.style.cssText = 'position:sticky;top:0;z-index:9999;font:14px system-ui, sans-serif;padding:6px 10px;border-bottom:1px solid #ddd;';
          document.body.prepend(bar);
        }
        const colors = tone === 'warn' ? ['#7a5200','#fff3cd','#ffe69c'] : tone === 'err' ? ['#7a1f1f','#f8d7da','#f1aeb5'] : ['#0b4f79','#d1ecf1','#a8d8e5'];
        bar.style.color = colors[0];
        bar.style.background = colors[1];
        bar.style.borderColor = colors[2];
        bar.textContent = msg;
      } catch {}
    }
    function hideNotice(){ try { const el = document.getElementById('syncNotice'); if (el) el.remove(); } catch {} }

  // If running on GitHub Pages, live sync may be limited (cookie/session constraints)
  if (IS_GHPAGES) {
      showNotice('Live score sync may be limited here. Showing cached points when available.', 'warn');
    }

    // Try cached critical sections first (1 min TTL)
    const TTL = 60 * 1000;
  const cacheOv = getCache(`ov:${uid}`);
    const cacheBadges = getCache(`badges:${uid}`);
    const cacheChal = getCache(`challenging:${uid}`);
  // Modes cache removed

    // Track last badges for correct count
    let lastBadges = [];
  const paintOverview = (ov) => {
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

  // Scoreless build: no local points priming

    // Paint cached immediately if present
  // Cap the overlay visibility to 800ms for first paint
  const overlayCap = setTimeout(hideOverlay, 800);

  if (cacheOv || cacheBadges || cacheChal) {
      if (cacheOv) paintOverview(cacheOv);
      if (cacheBadges) paintBadges(cacheBadges);
      if (cacheChal) paintChallenging(cacheChal);
        // Seed points from cached overview if available
        try {
          const cachedPts = cacheOv && typeof cacheOv.points === 'number' ? cacheOv.points : null;
          if (cachedPts != null) {
            setText('awardPoints', String(cachedPts));
            try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total: cachedPts } })); } catch {}
          }
        } catch {}
      hideOverlay();
      clearTimeout(overlayCap);
    }
  // Phase 1: fetch overview fast, then hide overlay
  if (!IS_GHPAGES) {
    const OVERVIEW_TIMEOUT = 4500; // give server a little more time than before
    let ov = await tryJSON(() => fetchWithTimeout(API.overview(), { ms: OVERVIEW_TIMEOUT, label: 'overview:attempt1' }));
    if (!ov) {
      // Quick second attempt (cold start mitigation)
      ov = await tryJSON(() => fetchWithTimeout(API.overview(), { ms: OVERVIEW_TIMEOUT, label: 'overview:attempt2' }));
    }
    if (ov) {
      paintOverview(ov);
      setCache(`ov:${uid}`, ov, TTL);
      hideNotice();
      // Stars/medals quick counters from overview
      const setCount = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = String(v ?? 0); };
  // Stars retained; medals deprecated (removed calculation/update)
  setCount('awardStars', ov.stars);
  // setCount('awardMedals', ov.perfect_runs ?? ov.mastered_lists); // removed: legacy medal metric
      // Seed points from overview if present
      if (typeof ov.points === 'number') {
        setText('awardPoints', String(ov.points));
        try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total: ov.points } })); } catch {}
      }
    } else {
      // Start a short poll if cookies/session not yet ready
      showNotice('Trying to sync scores…', 'info');
      const endAt = Date.now() + 30000;
      const poll = async () => {
        if (Date.now() > endAt) { showNotice('Live sync unavailable. Please ensure you are signed in.', 'warn'); return; }
        const ov2 = await tryJSON(() => fetchWithTimeout(API.overview(), { ms: OVERVIEW_TIMEOUT, label: 'overview:poll' }));
        if (ov2 && typeof ov2.points === 'number') {
          paintOverview(ov2); setCache(`ov:${uid}`, ov2, TTL); hideNotice();
          try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total: ov2.points } })); } catch {}
          try { window.dispatchEvent(new CustomEvent('profile:overview', { detail: ov2 })); } catch {}
          return;
        }
        setTimeout(poll, 3000);
      };
      poll();
      // Fallback: if we had a cached overview but failed fresh fetch, ensure stars/medals counters reflect cached values
      if (cacheOv) {
        try {
          const setCount = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.textContent = String(v); };
          setCount('awardStars', cacheOv.stars);
          // setCount('awardMedals', cacheOv.perfect_runs ?? cacheOv.mastered_lists); // removed legacy medal update
        } catch {}
      }
    }
  }
  hideOverlay();
  clearTimeout(overlayCap);

  // Phase 2: background fetches (badges, challenging, points, profile)
  const doPhase2 = async () => {
    if (IS_GHPAGES) return; // keep static on GH Pages
    const PHASE2_TIMEOUT = 4000; // slightly longer to reduce silent misses
    const [badges, challenging, cc, infoRes] = await Promise.all([
      tryJSON(() => fetchWithTimeout(API.badges() + `&limit=50`, { ms: PHASE2_TIMEOUT, cache: 'default', label: 'badges' })),
      tryJSON(() => fetchWithTimeout(API.challenging() + `&limit=50`, { ms: PHASE2_TIMEOUT, cache: 'default', label: 'challenging' })),
      tryJSON(() => fetchWithTimeout(API.correctCount(), { ms: PHASE2_TIMEOUT, label: 'correctCount' })),
      tryJSON(() => getProfileInfo())
    ]);

    // Points prefer dedicated endpoint, fall back to cached overview value in UI
    try {
      const setCount = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = String(v ?? 0); };
      const pts = (cc && (typeof cc.points === 'number' ? cc.points : (typeof cc.correct === 'number' ? cc.correct : null)));
      if (pts != null) {
        setCount('awardPoints', pts);
        try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total: pts } })); } catch {}
      }
    } catch {}

    if (Array.isArray(badges)) { paintBadges(badges); setCache(`badges:${uid}`, badges, TTL); }
    else if (!badges) console.warn('[profile] badges fetch failed or timed out');
    if (Array.isArray(challenging)) { paintChallenging(challenging); setCache(`challenging:${uid}`, challenging, TTL); }
    else if (!challenging) console.warn('[profile] challenging fetch failed or timed out');

    // If stars/medals still zero after Phase 2 but we have badges (indicator of activity), schedule a lazy recheck of overview
    try {
      const starsEl = document.getElementById('awardStars');
      // medal element intentionally ignored (deprecated)
      const medalsEl = null;
      if (starsEl && starsEl.textContent === '0') {
        setTimeout(async () => {
          const lateOv = await tryJSON(() => fetchWithTimeout(API.overview(), { ms: 3000, label: 'overview:late' }));
          if (lateOv) {
            const setCount = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.textContent = String(v); };
            setCount('awardStars', lateOv.stars);
            // setCount('awardMedals', lateOv.perfect_runs ?? lateOv.mastered_lists); // medals disabled
            // Fire overview event if initial one never fired
            try { window.dispatchEvent(new CustomEvent('profile:overview', { detail: lateOv })); } catch {}
          }
        }, 1500);
      }
    } catch {}

    // Info from get_profile: { success, name, email, username, avatar }
    info = infoRes || null;
    const displayName = (info && (info.name || info.username)) || 'Student Profile';
    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl && info && info.avatar) avatarEl.textContent = info.avatar;
    const heroAvatar = document.getElementById('pfHeroAvatar');
    if (heroAvatar && info && info.avatar) heroAvatar.textContent = info.avatar;
    const nameEnEl = document.getElementById('pfNameEn');
    const nameKoEl = document.getElementById('pfNameKo');
    const classEl = document.getElementById('pfClass');
    const emailEl = document.getElementById('pfEmail');
    if (nameEnEl && info && (info.name || info.username)) nameEnEl.textContent = info.name || info.username;
    if (nameKoEl && info && typeof info.korean_name === 'string' && info.korean_name.trim()) nameKoEl.textContent = info.korean_name;
    if (classEl && info && (typeof info.class === 'string' && info.class.trim())) classEl.textContent = info.class;
    if (emailEl && info && info.email) emailEl.textContent = info.email;
  };
  setTimeout(doPhase2, 0);

  // Immediate star refresh after a session ends (emitted by records.js)
  window.addEventListener('session:ended', async () => {
    try {
      const ov = await fetch(API.overview() + '&_bust=' + Date.now(), { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : null);
      if (ov && typeof ov.stars === 'number') {
        const setCount = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = String(v ?? 0); };
        setCount('awardStars', ov.stars);
        // update overlay stat block too
        try { window.dispatchEvent(new CustomEvent('profile:overview', { detail: ov })); } catch {}
      }
    } catch {}
  });

  // Cross-tab star refresh via localStorage key
  window.addEventListener('storage', (e) => {
    if (e.key === 'stars:refresh') {
      (async () => {
        try {
          const ov = await fetch(API.overview() + '&_bust=' + Date.now(), { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : null);
          if (ov && typeof ov.stars === 'number') {
            const setCount = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v ?? 0); };
            setCount('awardStars', ov.stars);
            try { window.dispatchEvent(new CustomEvent('profile:overview', { detail: ov })); } catch {}
          }
        } catch {}
      })();
    }
  });

    // Defer non-critical tables (sessions, attempts)
  // Removed: deferred sessions/attempts fetch

  // Avatar modal behavior moved to students/avatar.js
  hideOverlay();
  });
})();

// Scoreless: no live points updates
(function(){
  // No-op
})();