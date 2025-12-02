// template-modal.js
// UI only, no logic yet
(function() {
  window.openTemplateModal = function() {
    if (document.getElementById('template-modal')) return;
    fetch('template-modal.html')
      .then(r => r.text())
      .then(html => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
        const modal = document.getElementById('template-modal');
        modal.querySelector('#close-template-modal').onclick = () => modal.remove();
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        document.addEventListener('keydown', function esc(e) {
          if (e.key === 'Escape' && document.getElementById('template-modal')) {
            modal.remove();
            document.removeEventListener('keydown', esc);
          }
        });
      });
  };
})();
