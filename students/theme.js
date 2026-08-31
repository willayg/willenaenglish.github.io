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

  function addExamHitDashboardCard(){
    const isDashboard = /\/students\/dashboard\.html$/.test(window.location.pathname) || /\/students\/$/.test(window.location.pathname);
    if (!isDashboard || document.getElementById('examHitDashboardCard')) return;

    const mixMatch = document.querySelector('a.wa-mix-match');
    if (!mixMatch) return;

    const card = document.createElement('a');
    card.id = 'examHitDashboardCard';
    card.href = '/students/test-prep-app/';
    card.setAttribute('aria-label', '내신 명중');
    card.style.cssText = [
      'text-decoration:none',
      'color:inherit',
      'border-radius:16px',
      'padding:18px 16px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'grid-column:span 2',
      'min-height:104px',
      'cursor:pointer',
      'position:relative',
      'overflow:hidden',
      'background:linear-gradient(135deg,#35192f 0%,#242b36 52%,#15343a 100%)',
      'border:3px solid #ff70c7',
      'box-shadow:0 5px 18px rgba(255,112,199,.18),0 2px 8px rgba(0,0,0,.16)',
      'transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease'
    ].join(';');

    card.innerHTML = `
      <span aria-hidden="true" style="position:absolute;inset:-70% -20%;background:linear-gradient(115deg,transparent 42%,rgba(255,255,255,.14) 50%,transparent 58%);transform:translateX(-55%);pointer-events:none;"></span>
      <div style="display:flex;align-items:center;gap:13px;position:relative;z-index:1;">
        <span class="material-icons" aria-hidden="true" style="font-size:35px;color:#ffd65c;text-shadow:0 0 12px rgba(255,214,92,.35);">track_changes</span>
        <div style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.05;">
          <strong style="font-size:1.65rem;font-weight:800;letter-spacing:-.04em;color:#fff;text-shadow:0 0 14px rgba(255,112,199,.35);">내신 명중</strong>
          <span style="margin-top:7px;font-size:.78rem;font-weight:700;letter-spacing:.12em;color:#81e9ec;">TEST PREP</span>
        </div>
      </div>`;

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 8px 24px rgba(255,112,199,.27),0 3px 10px rgba(0,0,0,.2)';
      card.style.borderColor = '#ff98d8';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '0 5px 18px rgba(255,112,199,.18),0 2px 8px rgba(0,0,0,.16)';
      card.style.borderColor = '#ff70c7';
    });

    mixMatch.insertAdjacentElement('afterend', card);
  }

  // Initial apply ASAP
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      apply();
      addExamHitDashboardCard();
    });
  } else {
    apply();
    addExamHitDashboardCard();
  }
  // Re-apply after language changes to update On/Off label
  window.addEventListener('studentlang:changed', () => apply());
  // Storage sync across tabs
  window.addEventListener('storage', (e) => { if (e.key === KEY) { cached = undefined; apply(); } });
})();
