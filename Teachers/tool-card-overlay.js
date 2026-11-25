// Overlay animation for tool cards with delay
window.addEventListener('DOMContentLoaded', function() {
  const managerHref = '/Teachers/tools/manage_teachers.html';
  const contentArea = document.querySelector('.content-area');
  let managerLink = null;

  // Replace any older/broken teacher-account button already present.
  document.querySelectorAll('a, button').forEach(function(element) {
    const label = (element.textContent || '').trim().toLowerCase();
    if (label.includes('create teacher account') || label === 'create teacher' || label === 'manage teachers') {
      if (element.tagName === 'A') {
        element.setAttribute('href', managerHref);
        managerLink = element;
      } else {
        element.onclick = function() { window.location.href = managerHref; };
      }

      const title = element.querySelector('.tool-title');
      if (title) title.textContent = 'Manage Teachers';
      else element.textContent = 'Manage Teachers';

      const overlay = element.querySelector('.tool-overlay');
      if (overlay) overlay.textContent = 'Create, approve, disable, reset, or remove teacher accounts.';
    }
  });

  // The current dashboard has no teacher-management card, so add one for admins.
  const role = String(localStorage.getItem('userRole') || '').toLowerCase();
  if (!managerLink && role === 'admin' && contentArea) {
    managerLink = document.createElement('a');
    managerLink.className = 'tool-card';
    managerLink.dataset.tags = 'all planning admin';
    managerLink.href = managerHref;
    managerLink.innerHTML = [
      '<div class="tool-title">Manage Teachers</div>',
      '<img src="tools/assets/icons/lesson.png" alt="Manage Teachers" style="height:8em;margin:0.7em 0 0.5em 0;">',
      '<div class="tool-overlay">Create, approve, disable, reset, or remove teacher accounts.</div>'
    ].join('');
    contentArea.appendChild(managerLink);
  }

  document.querySelectorAll('.tool-card').forEach(function(card) {
    let timer = null;
    const overlay = card.querySelector('.tool-overlay');
    if (!overlay) return;
    card.addEventListener('mouseenter', function() {
      timer = setTimeout(function() {
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
      }, 200);
    });
    card.addEventListener('mouseleave', function() {
      if (timer) clearTimeout(timer);
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
    });
  });
});
