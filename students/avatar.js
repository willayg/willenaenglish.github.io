import { FN } from './scripts/api-base.js?v=20260115';

// Avatar modal: setup open/close, selection, and save to server
(function(){
  const api = (path) => new URL(path, window.location.origin).toString();

  async function updateProfileAvatar(avatar) {
    try {
      const res = await fetch(api(FN('supabase_auth') + `?action=update_profile_avatar`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatar })
      });
      return res.ok;
    } catch { return false; }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('avatarModal');
    const grid = document.getElementById('emojiGrid');
    const btnClose = document.getElementById('avatarClose');
    const btnCancel = document.getElementById('avatarCancel');
    const btnSave = document.getElementById('avatarSave');
    const smallAvatar = document.getElementById('pfAvatar');
    const heroAvatar = document.getElementById('pfHeroAvatar');

    if (!overlay || !grid) return; // modal not present on this page

  // Large, unique set of animal avatars (avoid multiple non-animal emoji)
  const choices = [
        '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🦄','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇',
        '🐺','🦄','🦝','🦨','🦡','🐗','🦙','🐴','🦓','🦌','🦬','🐮','🐑','🐐','🐪','🐫','🦒','🐘','🦏','🦛','🐭','🦔','🐇',
        '🐿️','🦎','🐍','🐢','🐊','🦖','🦕','🐬','🐳','🐋','🦈','🐟','🐠','🐡','🦐','🦑','🦀','🐙','🦞','🦪',
        '🦋','🐌','🐛','🐜','🐝','🪲','🐞','🕷️','🦂','🦟','🦗'
      ];
    let current = (smallAvatar && smallAvatar.textContent) || (heroAvatar && heroAvatar.textContent) || '🙂';
    let selected = current;

    function renderGrid(){
      if (grid.dataset.ready) return;
  grid.innerHTML = choices.map(e => `<button class="emoji-btn" data-e="${e}" aria-label="Choose avatar ${e}">${e}</button>`).join('');
      grid.dataset.ready = '1';
      grid.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.emoji-btn');
        if (!btn) return;
        selected = btn.dataset.e;
        [...grid.querySelectorAll('.emoji-btn')].forEach(b => b.classList.toggle('selected', b.dataset.e === selected));
      });
    }

    function openModal(){
      renderGrid();
      [...grid.querySelectorAll('.emoji-btn')].forEach(b => b.classList.toggle('selected', b.dataset.e === current));
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden', 'false');
    }
    function closeModal(){
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }

    if (smallAvatar) {
      smallAvatar.style.cursor = 'pointer';
      smallAvatar.setAttribute('tabindex', '0');
      smallAvatar.addEventListener('click', openModal);
      smallAvatar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); } });
    }
    if (heroAvatar) {
      heroAvatar.style.cursor = 'pointer';
      heroAvatar.setAttribute('tabindex', '0');
      heroAvatar.addEventListener('click', openModal);
      heroAvatar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); } });
    }
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (btnSave) btnSave.addEventListener('click', async () => {
      try {
        current = selected;
        if (smallAvatar) smallAvatar.textContent = current;
        if (heroAvatar) heroAvatar.textContent = current;
        closeModal();
        const ok = await updateProfileAvatar(current);
        if (!ok) {
          // Revert UI if save failed
          if (smallAvatar) smallAvatar.textContent = '🙂';
          if (heroAvatar) heroAvatar.textContent = '🙂';
        }
      } catch {}
    });
  });
})();
