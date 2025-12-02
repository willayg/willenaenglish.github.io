// Overlay animation for tool cards with delay
window.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.tool-card').forEach(function(card) {
    let timer = null;
    const overlay = card.querySelector('.tool-overlay');
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
