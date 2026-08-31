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
