// students/student_profile.js - client script to load and render student progress
(function(){
  // Helper to create origin-absolute URLs that ignore <base> tag
  const api = (path) => new URL(path, window.location.origin).toString();

  // Read Supabase session access token from localStorage (supabase-js v2 default key)
  function getAccessToken() {
    const tryExtract = (raw) => {
      try {
        const obj = JSON.parse(raw);
        const s = Array.isArray(obj) ? (obj[1] || obj[0] || obj) : obj;
        return (
          s?.access_token ||
          s?.currentSession?.access_token ||
          s?.session?.access_token ||
          s?.user?.access_token ||
          null
        );
      } catch { return null; }
    };
    try {
      const stores = [localStorage, sessionStorage];
      for (const store of stores) {
        if (!store) continue;
        const direct = store.getItem('sb-auth-token') || store.getItem('supabase.auth.token');
        let tok = direct && tryExtract(direct);
        if (tok) return tok;
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (!k) continue;
          if (/^sb-.*-auth-token$/.test(k)) {
            const raw = store.getItem(k);
            tok = raw && tryExtract(raw);
            if (tok) return tok;
          }
        }
      }
      return null;
    } catch { return null; }
  }

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
    // endpoints powered by Netlify functions (JWT-based; server infers user from token)
    attempts: () => api(`/.netlify/functions/progress_summary?section=attempts`),
    sessions: () => api(`/.netlify/functions/progress_summary?section=sessions`),
    kpi:      () => api(`/.netlify/functions/progress_summary?section=kpi`),
    modes:    () => api(`/.netlify/functions/progress_summary?section=modes`),
    badges:   () => api(`/.netlify/functions/progress_summary?section=badges`),
    overview: () => api(`/.netlify/functions/progress_summary?section=overview`),
    challenging: () => api(`/.netlify/functions/progress_summary?section=challenging`)
  };

  function getUserId(){
    return (
      localStorage.getItem('user_id') ||
      sessionStorage.getItem('user_id') ||
      localStorage.getItem('userId') ||
      sessionStorage.getItem('userId') ||
      localStorage.getItem('student_id') ||
      sessionStorage.getItem('student_id') ||
      localStorage.getItem('profile_id') ||
      sessionStorage.getItem('profile_id') ||
      localStorage.getItem('id') ||
      sessionStorage.getItem('id') ||
      null
    );
  }

  async function fetchJSON(url){
    const token = getAccessToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const res = await fetch(url, { cache: 'no-store', headers });
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
      wrap.innerHTML = list.map(b => `<span class="badge" title="${b.desc || ''}">${b.emoji || '⭐'} ${b.name}</span>`).join('');
    } catch { wrap.textContent = 'No badges yet.'; }
  }

  async function loadModes(uid){
    const el = document.getElementById('modes');
    try {
      const list = await fetchJSON(API.modes());
      if (!Array.isArray(list) || !list.length) { el.textContent = 'No data yet.'; return; }
      el.innerHTML = list.map(m => `<span class="mode-chip"><strong>${m.mode}</strong> · ${m.correct}/${m.total} (${Math.round((m.correct/(m.total||1))*100)}%)</span>`).join('');
    } catch { el.textContent = 'No data yet.'; }
  }

  async function loadSessions(uid){
    const tb = document.getElementById('sessionsBody');
    try {
      const list = await fetchJSON(API.sessions());
      if (!Array.isArray(list) || !list.length) { tb.innerHTML = '<tr><td colspan="3" class="mut">No sessions.</td></tr>'; return; }
      tb.innerHTML = list.map(s => {
        const when = fmtDate(s.ended_at || s.started_at);
        // Show list_name if present inside summary
        let listName = '';
        try { let sum = s.summary; if (typeof sum === 'string') sum = JSON.parse(sum); listName = sum?.list_name || sum?.listName || ''; } catch {}
        const sumStr = renderSummary(s.summary);
        const meta = [sumStr, listName].filter(Boolean).join(' • ');
        return `<tr>
          <td data-label="When">${when}</td>
          <td data-label="Mode"><span class="pill">${s.mode||'?'}<\/span></td>
          <td data-label="Summary">${meta}</td>
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
    if (sum.stars != null) parts.push(`${'⭐'.repeat(sum.stars)}`);
    return parts.join(' · ');
  }

  async function loadAttempts(uid){
    const tb = document.getElementById('attemptsBody');
    try {
      const list = await fetchJSON(API.attempts());
      if (!Array.isArray(list) || !list.length) { tb.innerHTML = '<tr><td colspan="5" class="mut">No attempts.</td></tr>'; return; }
      tb.innerHTML = list.map(a => `<tr>
        <td data-label="When">${fmtDate(a.created_at)}</td>
        <td data-label="Mode">${a.mode||''}</td>
        <td data-label="Word">${a.word||''}</td>
        <td data-label="Result">${a.is_correct? '✅':'❌'}</td>
        <td data-label="+Pts">${a.points??''}</td>
      </tr>`).join('');
    } catch { tb.innerHTML = '<tr><td colspan="5" class="mut">No attempts.</td></tr>'; }
  }

  async function getProfileInfo(userId) {
    try {
      const token = getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(api(`/.netlify/functions/get_profile_name?user_id=${encodeURIComponent(userId)}`), { headers });
      if (!res.ok) return {};
      const data = await res.json();
      return data;
    } catch { return {}; }
  }

  async function updateProfileAvatar(userId, avatar) {
    try {
      const token = getAccessToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(api('/.netlify/functions/update_profile_avatar'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, avatar })
      });
      return res.ok;
    } catch { return false; }
  }

  window.addEventListener('DOMContentLoaded', async () => {
  const uid = getUserId();
  const accessToken = getAccessToken();
    const nameEl = document.getElementById('pfName');
    const avatarEl = document.getElementById('pfAvatar');
    const overlayEl = document.getElementById('loadingOverlay');
    const showOverlay = () => { if (overlayEl) { overlayEl.style.display = 'flex'; overlayEl.setAttribute('aria-hidden', 'false'); } };
    const hideOverlay = () => { if (overlayEl) { overlayEl.style.display = 'none'; overlayEl.setAttribute('aria-hidden', 'true'); } };
    showOverlay();

    // Debug logging to help diagnose login state
    console.log('Profile debug:', { 
      uid, 
      accessToken: accessToken ? 'PRESENT' : 'MISSING', 
      origin: window.location.origin,
      localStorage_keys: Object.keys(localStorage).filter(k => k.includes('sb') || k.includes('auth')),
      sessionStorage_keys: Object.keys(sessionStorage).filter(k => k.includes('sb') || k.includes('auth'))
    });

    // Treat missing access token as not signed in even if a stale uid remains
  if (!uid || !accessToken) {
      nameEl.textContent = 'Student Profile';
      avatarEl.textContent = '🙂';
      hideOverlay();
      // Notify user in KPI area if possible
      try {
        const grid = document.getElementById('kpiGrid');
        if (grid) grid.insertAdjacentHTML('afterend', '<div class="error" style="margin-top:8px;">Sign in to see your progress.<br><small>Debug: uid=' + (uid || 'null') + ', token=' + (accessToken ? 'found' : 'missing') + '</small></div>');
      } catch {}
      return;
    }
    // Fetch username and avatar from Supabase profiles table
    const infoPromise = getProfileInfo(uid);

    // Try cached critical sections first (1 min TTL)
    const TTL = 60 * 1000;
    const cacheOv = getCache(`ov:${uid}`);
    const cacheBadges = getCache(`badges:${uid}`);
    const cacheChal = getCache(`challenging:${uid}`);
    const cacheModes = getCache(`modes:${uid}`);

    const paintOverview = (ov) => {
      setText('ovPoints', (ov && ov.points != null) ? ov.points : '0');
      setText('ovStars', (ov && ov.stars != null) ? ov.stars : '0');
      setText('ovListsExplored', (ov && ov.lists_explored != null) ? ov.lists_explored : '0');
      setText('ovPerfectRuns', (ov && ov.perfect_runs != null) ? ov.perfect_runs : '0');
      setText('ovMasteredLists', (ov && (ov.mastered ?? ov.mastered_lists) != null) ? (ov.mastered ?? ov.mastered_lists) : '0');
      setText('ovHotStreak', (ov && ov.best_streak != null) ? ov.best_streak : '0');
      setText('ovWordsDiscovered', (ov && ov.words_discovered != null) ? ov.words_discovered : '0');
      setText('ovWordsMastered', (ov && ov.words_mastered != null) ? ov.words_mastered : '0');
      setText('ovSessionsPlayed', (ov && ov.sessions_played != null) ? ov.sessions_played : '0');
      setText('ovBadgesCount', (ov && ov.badges_count != null) ? ov.badges_count : '0');
      setText('ovFavoriteList', (ov && ov.favorite_list && ov.favorite_list.name) ? ov.favorite_list.name : '—');
      setText('ovHardestWord', (ov && ov.hardest_word && ov.hardest_word.word) ? ov.hardest_word.word : '—');
    };
    const paintBadges = (badges) => {
      const wrap = document.getElementById('badgesWrap');
      if (!wrap) return;
      if (!badges || !Array.isArray(badges) || !badges.length) wrap.textContent = 'No badges yet.';
      else wrap.innerHTML = badges.map(b => `<span class="badge" title="${b.desc || ''}">${b.emoji || '⭐'} ${b.name}</span>`).join('');
    };
    const paintChallenging = (challenging) => {
      const listEl = document.getElementById('challengingList');
      const emptyEl = document.getElementById('challengingEmpty');
      if (!listEl) return;
      if (!challenging || !Array.isArray(challenging) || !challenging.length) {
        if (emptyEl) emptyEl.textContent = 'No challenging words yet.';
      } else {
        if (emptyEl) emptyEl.remove();
        listEl.innerHTML = challenging.map(item => {
          const accPct = Math.round((item.accuracy || 0) * 100);
          const cls = accPct <= 0 ? 'zero' : (accPct < 70 ? 'bad' : 'ok');
          const skillLower = (item.skill || '').toLowerCase();
          const mainWord = item.word_en || item.word || '';
          const subKor = item.word_kr ? `<div class="cw-sub">${item.word_kr}</div>` : '';
          return `
            <div class="cw-card">
              <div>
                <div class="cw-word">${mainWord}</div>
                ${subKor}
              </div>
              <div class="cw-right">
                <div class="cw-acc ${cls}">${accPct}%</div>
                <div class="cw-skill">${skillLower}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    };
    const paintModes = (modes) => {
      const modesEl = document.getElementById('modes');
      if (!modesEl) return;
      if (!modes || !Array.isArray(modes) || !modes.length) modesEl.textContent = 'No data yet.';
      else modesEl.innerHTML = modes.map(m => `<span class="mode-chip"><strong>${m.mode}</strong> · ${m.correct}/${m.total} (${Math.round((m.correct/(m.total||1))*100)}%)</span>`).join('');
    };

    // Paint cached immediately if present
    if (cacheOv || cacheBadges || cacheChal || cacheModes) {
      paintOverview(cacheOv);
      paintBadges(cacheBadges);
      paintChallenging(cacheChal);
      paintModes(cacheModes);
      hideOverlay();
    }

    // Fetch critical fresh data in parallel
  const [info, ov, badges, challenging, modes] = await Promise.all([
      infoPromise,
  fetchJSON(API.overview()).catch(() => null),
  fetchJSON(API.badges()).catch(() => null),
  fetchJSON(API.challenging()).catch(() => null),
  fetchJSON(API.modes()).catch(() => null)
    ]);

    // Apply and cache fresh
    nameEl.textContent = (info && info.username) || 'Student Profile';
    avatarEl.textContent = (info && info.avatar) || '🙂';
    paintOverview(ov); setCache(`ov:${uid}`, ov, TTL);
    paintBadges(badges); setCache(`badges:${uid}`, badges, TTL);
    paintChallenging(challenging); setCache(`challenging:${uid}`, challenging, TTL);
    paintModes(modes); setCache(`modes:${uid}`, modes, TTL);
    hideOverlay();

    // Defer non-critical tables (sessions, attempts)
  const schedule = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 800 }) : setTimeout(fn, 120));
  schedule(async () => {
      try {
        const [sessions, attempts] = await Promise.all([
          fetchJSON(API.sessions()).catch(() => null),
          fetchJSON(API.attempts()).catch(() => null)
        ]);
        const sessionsTb = document.getElementById('sessionsBody');
        if (sessionsTb) {
          if (!sessions || !Array.isArray(sessions) || !sessions.length) {
            sessionsTb.innerHTML = '<tr><td colspan="3" class="mut">No sessions.</td></tr>';
          } else {
            sessionsTb.innerHTML = sessions.map(s => {
              const when = fmtDate(s.ended_at || s.started_at);
              let listName = '';
              try { let sum = s.summary; if (typeof sum === 'string') sum = JSON.parse(sum); listName = sum?.list_name || sum?.listName || ''; } catch {}
              const sumStr = renderSummary(s.summary);
              const meta = [sumStr, listName].filter(Boolean).join(' • ');
              return `<tr>
                <td data-label="When">${when}</td>
                <td data-label="Mode"><span class="pill">${s.mode||'?'}<\/span></td>
                <td data-label="Summary">${meta}</td>
              </tr>`;
            }).join('');
          }
        }
        const attemptsTb = document.getElementById('attemptsBody');
        if (attemptsTb) {
          if (!attempts || !Array.isArray(attempts) || !attempts.length) {
            attemptsTb.innerHTML = '<tr><td colspan="5" class="mut">No attempts.</td></tr>';
          } else {
            attemptsTb.innerHTML = attempts.map(a => `<tr>
              <td data-label="When">${fmtDate(a.created_at)}</td>
              <td data-label="Mode">${a.mode||''}</td>
              <td data-label="Word">${a.word||''}</td>
              <td data-label="Result">${a.is_correct? '✅':'❌'}</td>
              <td data-label="+Pts">${a.points??''}</td>
            </tr>`).join('');
          }
        }
      } catch {}
    });

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
      current = selected;
      if (avatarEl) avatarEl.textContent = current;
      closeModal();
      await updateProfileAvatar(uid, current);
    });
  hideOverlay();
  });
})();
