// students/student_profile.js - client script to load and render student progress
(function(){
  // Helper to create origin-absolute URLs that ignore <base> tag
  const api = (path) => new URL(path, window.location.origin).toString();

  const API = {
    // endpoints powered by Netlify functions
    attempts: (user_id) => api(`/.netlify/functions/progress_summary?user_id=${encodeURIComponent(user_id)}&section=attempts`),
    sessions: (user_id) => api(`/.netlify/functions/progress_summary?user_id=${encodeURIComponent(user_id)}&section=sessions`),
    kpi:      (user_id) => api(`/.netlify/functions/progress_summary?user_id=${encodeURIComponent(user_id)}&section=kpi`),
    modes:    (user_id) => api(`/.netlify/functions/progress_summary?user_id=${encodeURIComponent(user_id)}&section=modes`),
  badges:   (user_id) => api(`/.netlify/functions/progress_summary?user_id=${encodeURIComponent(user_id)}&section=badges`),
  overview: (user_id) => api(`/.netlify/functions/progress_summary?user_id=${encodeURIComponent(user_id)}&section=overview`),
  challenging: (user_id) => api(`/.netlify/functions/progress_summary?user_id=${encodeURIComponent(user_id)}&section=challenging`)
  };

  function getUserId(){
    return localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || null;
  }

  async function fetchJSON(url){
    const res = await fetch(url, { cache: 'no-store' });
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
    try { await fetchJSON(API.kpi(uid)); } catch {}
  }

  async function loadOverview(uid){
    try {
      const ov = await fetchJSON(API.overview(uid));
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
      const list = await fetchJSON(API.badges(uid));
      if (!Array.isArray(list) || !list.length) { wrap.textContent = 'No badges yet.'; return; }
      wrap.innerHTML = list.map(b => `<span class="badge" title="${b.desc || ''}">${b.emoji || '⭐'} ${b.name}</span>`).join('');
    } catch { wrap.textContent = 'No badges yet.'; }
  }

  async function loadModes(uid){
    const el = document.getElementById('modes');
    try {
      const list = await fetchJSON(API.modes(uid));
      if (!Array.isArray(list) || !list.length) { el.textContent = 'No data yet.'; return; }
      el.innerHTML = list.map(m => `<span class="mode-chip"><strong>${m.mode}</strong> · ${m.correct}/${m.total} (${Math.round((m.correct/(m.total||1))*100)}%)</span>`).join('');
    } catch { el.textContent = 'No data yet.'; }
  }

  async function loadSessions(uid){
    const tb = document.getElementById('sessionsBody');
    try {
      const list = await fetchJSON(API.sessions(uid));
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
      const list = await fetchJSON(API.attempts(uid));
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

  async function loadChallenging(uid){
    const listEl = document.getElementById('challengingList');
    const emptyEl = document.getElementById('challengingEmpty');
    if (!listEl) return;
    try {
      const list = await fetchJSON(API.challenging(uid));
      if (!Array.isArray(list) || !list.length) {
        if (emptyEl) emptyEl.textContent = 'No challenging words yet.';
        return;
      }
      if (emptyEl) emptyEl.remove();
      listEl.innerHTML = list.map(item => {
        const accPct = Math.round((item.accuracy || 0) * 100);
        const cls = accPct <= 0 ? 'zero' : (accPct < 40 ? 'bad' : 'ok');
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
    } catch {
      if (emptyEl) emptyEl.textContent = 'No challenging words yet.';
    }
  }

  async function getProfileInfo(userId) {
    try {
      const res = await fetch(api(`/.netlify/functions/get_profile_name?user_id=${encodeURIComponent(userId)}`));
      if (!res.ok) return {};
      const data = await res.json();
      return data;
    } catch { return {}; }
  }

  async function updateProfileAvatar(userId, avatar) {
    try {
      const res = await fetch(api('/.netlify/functions/update_profile_avatar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, avatar })
      });
      return res.ok;
    } catch { return false; }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    const uid = getUserId();
    const nameEl = document.getElementById('pfName');
    const avatarEl = document.getElementById('pfAvatar');
    if (!uid) {
      nameEl.textContent = 'Student Profile';
      avatarEl.textContent = '🙂';
      return;
    }
    // Fetch username and avatar from Supabase profiles table
    const info = await getProfileInfo(uid);
    nameEl.textContent = info.username || 'Student Profile';
    avatarEl.textContent = info.avatar || '🙂';

    // Avatar modal behavior
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

    await Promise.allSettled([
  loadKpi(uid), // keep for future/internal metrics
  loadOverview(uid),
      loadBadges(uid),
  loadChallenging(uid),
      loadModes(uid),
      loadSessions(uid),
      loadAttempts(uid)
    ]);
  });
})();
