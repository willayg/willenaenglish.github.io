/* Willena Students PWA install control. */
(() => {
  let installPrompt = null;
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const samsung = () => /SamsungBrowser/i.test(navigator.userAgent);
  const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const update = () => {
    const section = document.getElementById('installAppSettings');
    const button = document.getElementById('installWillenaApp');
    if (!section || !button) return;
    section.hidden = installed();
    button.textContent = samsung() ? 'Install with Chrome' : installPrompt ? 'Install App' : ios() ? 'How to Install' : 'Install App';
  };
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    update();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; update(); });
  document.addEventListener('DOMContentLoaded', () => {
    update();
    document.getElementById('installWillenaApp')?.addEventListener('click', async () => {
      if (samsung()) {
        alert('Samsung Internet currently has an Android installation issue.\n1. Open Willena Students in Google Chrome.\n2. Open Settings and tap Install App.\n3. Confirm installation in Chrome.\nDo not bypass a Google Play Protect warning.');
        return;
      }
      if (installPrompt) {
        const prompt = installPrompt;
        installPrompt = null;
        try { await prompt.prompt(); await prompt.userChoice; }
        catch (error) { console.warn('Willena PWA prompt unavailable', error); }
        update();
        return;
      }
      if (ios()) {
        alert('Install Willena Students:\n1. Open this page in Safari.\n2. Tap Share.\n3. Choose Add to Home Screen.\n4. Tap Add.');
      } else {
        alert('Open this page in Chrome or Edge and choose Install app or Add to Home screen from the browser menu. On a PC, look for the Install icon in the address bar.');
      }
    });
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('/students/sw.js', { scope: '/students/' })
        .catch(error => console.warn('Willena PWA registration failed', error));
    }
  });
})();