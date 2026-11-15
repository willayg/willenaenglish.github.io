/* Willena Students PWA install and independent classroom preference. */
(() => {
  'use strict';
  const MODE_KEY = 'willena_students_install_mode';
  const CLASSROOM_PIN = '335577'; // Convenience gate only; not Android kiosk security.
  let installPrompt = null;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const samsung = () => /SamsungBrowser/i.test(navigator.userAgent);
  const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const mode = () => localStorage.getItem(MODE_KEY) || 'personal';
  const setMode = value => {
    localStorage.setItem(MODE_KEY, value);
    document.documentElement.dataset.willenaInstallMode = value;
    update();
  };
  const update = () => {
    const section = document.getElementById('installAppSettings');
    const button = document.getElementById('installWillenaApp');
    if (!section || !button) return;
    const classroom = mode() === 'classroom';
    // Keep classroom exit accessible from the same Settings area after installation.
    section.hidden = standalone() && !classroom;
    button.textContent = classroom ? 'Classroom Settings' : samsung() ? 'Install with Chrome' : 'Install App';
    const description = section.querySelector('.setting-copy span');
    if (description) description.textContent = classroom
      ? 'Classroom mode is active on this device. PIN required to deactivate.'
      : 'Choose Personal or PIN-protected Classroom installation';
  };
  const makeDialog = (title, content) => {
    const overlay = document.createElement('div');
    overlay.className = 'willena-install-overlay';
    overlay.innerHTML = '<div class="willena-install-dialog" role="dialog" aria-modal="true" aria-labelledby="willenaInstallTitle"><h2 id="willenaInstallTitle"></h2><div class="willena-install-content"></div><button type="button" class="willena-install-cancel">Cancel</button></div>';
    overlay.querySelector('h2').textContent = title;
    overlay.querySelector('.willena-install-content').append(content);
    const close = () => overlay.remove();
    overlay.querySelector('.willena-install-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.append(overlay);
    return { overlay, close };
  };
  const actionButton = (label, className, action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'willena-install-choice ' + (className || '');
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  };
  const confirmPin = (label, onSuccess) => {
    const wrap = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'password';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.maxLength = 6;
    input.pattern = '[0-9]*';
    input.placeholder = '6-digit teacher PIN';
    input.setAttribute('aria-label', 'Teacher PIN');
    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'status');
    feedback.className = 'willena-install-error';
    wrap.append(input, feedback);
    const dialog = makeDialog(label, wrap);
    const submit = actionButton('Confirm PIN', 'primary', () => {
      if (input.value !== CLASSROOM_PIN) {
        feedback.textContent = 'Incorrect PIN. Try again.';
        input.value = '';
        input.focus();
        return;
      }
      dialog.close();
      onSuccess();
    });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') submit.click(); });
    wrap.append(submit);
    input.focus();
  };
  const installInstructions = () => {
    if (samsung()) {
      alert('Open Willena Students in Google Chrome, then open Settings and choose Install App. Confirm the Android home-screen installation. Do not bypass Google Play Protect warnings.');
    } else if (ios()) {
      alert('In Safari, tap Share, choose Add to Home Screen, then Add.');
    } else {
      alert('In Chrome or Edge, use the browser menu and select Install app or Add to Home screen. Confirm to place the Willena icon on your home screen.');
    }
  };
  const install = async selected => {
    const previous = mode();
    if (selected === 'classroom') setMode('classroom');
    else setMode('personal');
    if (standalone()) {
      alert(selected === 'classroom' ? 'Classroom mode enabled on this installed Willena app.' : 'Personal mode enabled.');
      return;
    }
    if (samsung() || !installPrompt) {
      installInstructions();
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome !== 'accepted') setMode(previous);
    } catch (error) {
      console.warn('Willena PWA prompt unavailable', error);
      setMode(previous);
      installInstructions();
    }
    update();
  };
  const chooseInstall = () => {
    if (mode() === 'classroom') {
      const wrap = document.createElement('div');
      wrap.append(actionButton('Deactivate Classroom Mode', 'primary', () => {
        dialog.close();
        confirmPin('Deactivate Classroom Mode', () => {
          setMode('personal');
          alert('Classroom mode deactivated. You can now leave Willena using the normal Android controls.');
        });
      }));
      wrap.append(actionButton('Install / Open Instructions', '', installInstructions));
      const dialog = makeDialog('Classroom Settings', wrap);
      return;
    }
    const wrap = document.createElement('div');
    wrap.append(actionButton('Personal · 개인용', '', () => { dialog.close(); install('personal'); }));
    wrap.append(actionButton('Classroom · 교실용 (PIN)', 'primary', () => {
      dialog.close();
      confirmPin('Teacher PIN · Classroom installation', () => install('classroom'));
    }));
    const dialog = makeDialog('Install Willena Students', wrap);
  };
  const style = document.createElement('style');
  style.textContent = '.willena-install-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(20,29,41,.7);display:flex;align-items:center;justify-content:center;padding:18px}.willena-install-dialog{box-sizing:border-box;width:min(100%,390px);background:#fff;color:#263a42;border-radius:20px;padding:24px;box-shadow:0 18px 60px #0005;font-family:inherit}.willena-install-dialog h2{font-size:20px;margin:0 0 18px}.willena-install-content{display:grid;gap:12px}.willena-install-choice,.willena-install-cancel{width:100%;min-height:48px;border:2px solid #b6e5e9;border-radius:12px;background:#f1fbfc;color:#263a42;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;padding:12px}.willena-install-choice.primary{background:#c8f3f3;border-color:#5fcbd2}.willena-install-cancel{margin-top:12px;background:#fff}.willena-install-content input{box-sizing:border-box;width:100%;font-size:20px;letter-spacing:3px;padding:12px;border:2px solid #9bbdc3;border-radius:12px}.willena-install-error{min-height:18px;color:#bb2944;font-size:13px;margin:0}';
  document.head.append(style);
  document.documentElement.dataset.willenaInstallMode = mode();
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    update();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; update(); });
  const setup = () => {
    update();
    document.getElementById('installWillenaApp')?.addEventListener('click', chooseInstall);
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('/students/sw.js', { scope: '/students/' })
        .catch(error => console.warn('Willena PWA registration failed', error));
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();