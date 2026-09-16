// Overlay animation for tool cards with delay
window.addEventListener('DOMContentLoaded', function() {
  // Lightweight utility link for the Naesin snapshot-engine lab.
  // Keep this injected here so we do not have to touch the large legacy teacher dashboard file.
  const toolArea = document.querySelector('.content-area');
  if (toolArea && !toolArea.querySelector('a[href="/Teachers/tools/naesin-stats-lab/"]')) {
    const lab = document.createElement('a');
    lab.className = 'tool-card';
    lab.dataset.tags = 'all activities utilities';
    lab.href = '/Teachers/tools/naesin-stats-lab/';
    lab.innerHTML = [
      '<div class="tool-title">Naesin Stats Lab</div>',
      '<div aria-hidden="true" style="font-size:4.8em;line-height:1;margin:.22em 0 .18em">📊</div>',
      '<div class="tool-overlay">Open the fast snapshot-backed 내신 statistics lab.</div>'
    ].join('');
    toolArea.appendChild(lab);
  }

  document.querySelectorAll('.tool-card').forEach(function(card) {
    let timer = null;
    const overlay = card.querySelector('.tool-overlay');
    card.addEventListener('mouseenter', function() {
      timer = setTimeout(function() {
        if (!overlay) return;
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
      }, 200);
    });
    card.addEventListener('mouseleave', function() {
      if (timer) clearTimeout(timer);
      if (!overlay) return;
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
    });
  });

  // Admin-only shortcut into the staging control room.
  // The shared burger menu is mounted asynchronously, so wait for both the
  // authenticated role and the menu DOM rather than relying on page timing.
  let attempts = 0;
  function addControlRoomToBurger() {
    attempts += 1;
    let role = '';
    try {
      role = String(localStorage.getItem('userRole') || localStorage.getItem('role') || '').trim().toLowerCase();
    } catch (e) {}

    const dropdown = document.querySelector('.burger-dropdown');
    if (role === 'admin' && dropdown) {
      if (!dropdown.querySelector('a[href="/Teachers/tools/control-room/"]')) {
        const link = document.createElement('a');
        link.href = '/Teachers/tools/control-room/';
        link.textContent = 'Staging Control Room';
        link.setAttribute('data-admin-only', '');
        link.style.display = 'block';

        const firstAdmin = dropdown.querySelector('[data-admin-only]');
        if (firstAdmin) dropdown.insertBefore(link, firstAdmin);
        else {
          const feedback = dropdown.querySelector('#feedbackMenuBtn');
          if (feedback) dropdown.insertBefore(link, feedback);
          else dropdown.appendChild(link);
        }
      }
      return;
    }

    if (attempts < 40) setTimeout(addControlRoomToBurger, 150);
  }
  addControlRoomToBurger();
});
