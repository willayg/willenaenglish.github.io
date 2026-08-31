// Shared theme manager for student pages + games
// Applies dark/light mode based on stored preference or system setting.
// Exposes window.StudentTheme with getTheme(), setTheme(mode), toggle().
// Persists user choice in localStorage under key 'student_ui_theme'. Values: 'dark' | 'light'.
// If no explicit choice stored, follows system preference and reacts to system changes.

(function(){
  const KEY = 'student_ui_theme';
  let cached;
  function systemPref(){
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
  }
  function getTheme(){
    if (cached) return cached;
    try { cached = localStorage.getItem(KEY) || systemPref(); } catch { cached = systemPref(); }
    return cached;
  }
  function apply(mode){
    const m = mode || getTheme();
    document.documentElement.classList.toggle('dark', m === 'dark');
    // Update any dashboard status element if present
    const status = document.getElementById('darkModeStatus');
    if (status) {
      if (window.StudentLang) {
        status.setAttribute('data-i18n', m === 'dark' ? 'On' : 'Off');
        status.textContent = StudentLang.translate(m === 'dark' ? 'On' : 'Off');
      } else {
        status.textContent = m === 'dark' ? 'On' : 'Off';
      }
    }
    const sw = document.getElementById('darkModeToggle');
    if (sw) sw.setAttribute('aria-checked', m === 'dark');
    try { setTimeout(() => { window.dispatchEvent(new CustomEvent('studenttheme:changed', { detail: { theme: m } })); }, 0); } catch {}
  }
  function setTheme(mode){
    if (mode !== 'dark' && mode !== 'light') return; // ignore invalid
    try { localStorage.setItem(KEY, mode); } catch {}
    cached = mode;
    apply(mode);
  }
  function toggle(){ setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

  // React to system changes only if no explicit preference stored
  try {
    const mm = window.matchMedia('(prefers-color-scheme: dark)');
    mm.addEventListener('change', e => {
      try { if (!localStorage.getItem(KEY)) { cached = undefined; apply(e.matches ? 'dark' : 'light'); } } catch {}
    });
  } catch {}

  window.StudentTheme = { getTheme, setTheme, toggle, apply };

  // Staging dashboard-only app card. The observer starts while the HTML parser is still
  // building the page, inserts once as soon as Mix Match exists, then disconnects.
  // This avoids the visible late layout jump caused by DOMContentLoaded injection.
  (function addExamHitCardDuringParse(){
    const isDashboard = /\/students\/dashboard\.html$/.test(location.pathname) || /\/students\/$/.test(location.pathname);
    if (!isDashboard) return;

    function insert(){
      if (document.getElementById('examHitDashboardCard')) return true;
      const mixMatch = document.querySelector('a.wa-mix-match');
      if (!mixMatch) return false;

      const card = document.createElement('a');
      card.id = 'examHitDashboardCard';
      card.href = '/students/test-prep-app/';
      card.className = 'wa-option-card';
      card.setAttribute('aria-label', '내신 명중');
      card.style.cssText = 'text-decoration:none;color:inherit;border-radius:16px;padding:16px 14px;display:flex;align-items:center;justify-content:center;gap:12px;cursor:pointer;grid-column:span 2;min-height:96px;overflow:hidden;background:#343d44;border:3px solid #ff70c7;box-shadow:0 4px 12px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.08);';
      card.innerHTML = '<span class="material-icons" aria-hidden="true" style="font-size:34px;color:#ffd65c;">track_changes</span><span style="font-size:1.55rem;font-weight:800;color:#fff;letter-spacing:-.03em;">내신 명중</span>';

      mixMatch.insertAdjacentElement('afterend', card);
      return true;
    }

    if (insert()) return;
    const observer = new MutationObserver(() => {
      if (insert()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  })();

  // Initial apply ASAP
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  } else {
    apply();
  }
  // Re-apply after language changes to update On/Off label
  window.addEventListener('studentlang:changed', () => apply());
  // Storage sync across tabs
  window.addEventListener('storage', (e) => { if (e.key === KEY) { cached = undefined; apply(); } });
})();
