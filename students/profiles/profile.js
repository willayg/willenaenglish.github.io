// profiles/profile.js - client script to load and render user progress
(function(){
  const API = {
    // endpoints powered by the API gateway
      attempts: () => `/api/progress_summary?section=attempts`,
      sessions: () => `/api/progress_summary?section=sessions`,
    kpi:      () => `/api/progress_summary?section=kpi`,
      modes:    () => `/api/progress_summary?section=modes`,
    badges:   () => `/api/progress_summary?section=badges`,
    overview: () => `/api/progress_summary?section=overview`
  };

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
    try {
      const k = await fetchJSON(API.kpi());
      setText('kpiAttempts', k.attempts ?? '0');
      setText('kpiAccuracy', k.accuracy != null ? `${Math.round(k.accuracy*100)}%` : '–');
  // scoreless build: no points
      setText('kpiBestStreak', k.best_streak ?? '0');
    } catch (e) {
      setText('kpiAttempts', '0');
      setText('kpiAccuracy', '–');
      
      setText('kpiBestStreak', '0');
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
      tb.innerHTML = list.map(s => `<tr><td>${fmtDate(s.ended_at || s.started_at)}</td><td><span class="pill">${s.mode||'?'}</span></td><td>${renderSummary(s.summary)}</td></tr>`).join('');
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
      tb.innerHTML = list.map(a => `<tr><td>${fmtDate(a.created_at)}</td><td>${a.mode||''}</td><td>${a.word||''}</td><td>${a.is_correct? '✅':'❌'}</td><td>${a.points??''}</td></tr>`).join('');
    } catch { tb.innerHTML = '<tr><td colspan="5" class="mut">No attempts.</td></tr>'; }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    // Proceed regardless of any client-side ID; server uses cookie auth.
    const setText = (id, text)=>{ const el = document.getElementById(id); if (el) el.textContent = String(text); };
    const p = [
      loadKpi('me'),
      loadBadges('me'),
      loadModes('me'),
      loadSessions('me'),
      loadAttempts('me'),
      (async () => {
        try {
          const res = await fetch(API.overview(), { credentials: 'include', cache: 'no-store' });
          if (!res.ok) return;
          const ov = await res.json().catch(() => null);
          // scoreless build: ignore points in overview
        } catch {}
      })()
    ];
    await Promise.allSettled(p);
  });
})();
