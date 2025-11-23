// Unscramble Splash Module
// Shows a centered overlay with an animated "Unscramble the sentence" message
// in English and Korean. The animation scrambles letters and progressively
// reveals the final text. Exported function returns a Promise that resolves
// when the splash finishes so callers can await during heavy loading.

export function showUnscrambleSplash(root = document.body, opts = {}) {
  console.log('[Splash] showUnscrambleSplash called', { root: root?.id || root?.tagName, duration: opts.duration, english: opts.english });
  const { duration = 2200, english = 'Unscramble the sentence', korean = '문장을 풀어보세요' } = opts;
  // Return an object with control handles so caller can keep the modal up
  // while loading then call hide() when ready. readyPromise resolves when
  // the initial animation completes (useful to start other work).
  let overlay, card, engEl, korEl;
  const readyPromise = new Promise((resolveReady) => {
    console.log('[Splash] creating overlay and card elements');
    // Host overlay - make full-viewport
    overlay = document.createElement('div');
    overlay.className = 'ua-splash-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Loading Unscramble Mode');
    overlay.style.pointerEvents = 'auto';

    // Fullscreen card (centered content but fills viewport)
    card = document.createElement('div');
    card.className = 'ua-splash-card ua-splash-fullscreen';

    engEl = document.createElement('div');
    engEl.className = 'ua-splash-eng';
    engEl.textContent = '';

    korEl = document.createElement('div');
    korEl.className = 'ua-splash-kor';
    korEl.textContent = '';

    card.appendChild(engEl);
    card.appendChild(korEl);
    overlay.appendChild(card);

    // Strong inline styles to ensure visibility even if external CSS conflicts
    try {
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.background = 'rgba(6,23,25,0.55)';
      overlay.style.backdropFilter = 'blur(3px)';
      overlay.style.zIndex = '2147483647';
      overlay.style.opacity = '1';
      card.style.background = '#ffffff';
      card.style.borderRadius = '12px';
      card.style.padding = '40px';
      card.style.maxWidth = '1200px';
      card.style.boxSizing = 'border-box';
      card.style.boxShadow = '0 8px 32px rgba(2,60,62,0.12)';
      card.style.border = '3px solid rgba(14,165,164,0.12)';
    } catch (e) {
      console.warn('[Splash] failed to set inline styles', e?.message);
    }

    try {
      root.appendChild(overlay);
    } catch (err) {
      console.error('[Splash] append to provided root failed', err, 'root:', root);
      try { document.body.appendChild(overlay); console.warn('[Splash] appended to document.body fallback'); } catch (err2) { console.error('[Splash] fallback append failed', err2); }
    }

    // Styles (scoped via class names) - fullscreen look
    if (!document.getElementById('ua-splash-styles')) {
      const style = document.createElement('style');
      style.id = 'ua-splash-styles';
      style.textContent = `
        .ua-splash-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99999;background:rgba(6,23,25,0.55);backdrop-filter:blur(3px)}
        .ua-splash-card{padding:40px;border-radius:12px;max-width:1200px;width:100%;text-align:center;box-sizing:border-box;background:#ffffff}
        .ua-splash-fullscreen{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh}
        .ua-splash-eng{font-family:Poppins,system-ui,Segoe UI,Arial,sans-serif;font-weight:900;color:#0ea5a4;font-size:clamp(28px,6.2vw,64px);letter-spacing:0.6px;padding-bottom:8px}
        .ua-splash-kor{font-family:system-ui,Segoe UI,Apple SD Gothic Neo,Malgun Gothic,sans-serif;font-weight:800;color:#0891b2;font-size:clamp(16px,3.2vw,26px);opacity:0.98}
      `;
      document.head.appendChild(style);
    }

    // Audio: attempt to play a slow, gentle splash SFX. Prefer local assets if available.
    let splashAudio = null;
    try {
      splashAudio = new Audio('assets/audio/begin-the-game.mp3');
      splashAudio.volume = 0.0; // start silent for fade-in
      splashAudio.play().catch(() => {});
    } catch (e) { splashAudio = null; }

    // Fade helpers
    function fadeAudioIn(audio, to = 0.55, ms = duration) {
      if (!audio) return;
      const start = performance.now();
      function step(now) {
        const t = Math.min(1, (now - start) / ms);
        audio.volume = (to * t);
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    function fadeAudioOutAndStop(audio, ms = 320) {
      if (!audio) return;
      const startVol = audio.volume;
      const start = performance.now();
      function step(now) {
        const t = Math.min(1, (now - start) / ms);
        audio.volume = startVol * (1 - t);
        if (t < 1) requestAnimationFrame(step); else { try { audio.pause(); audio.currentTime = 0; } catch(e) {} }
      }
      requestAnimationFrame(step);
    }

    // Animation helpers
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    function randChar() { return letters.charAt(Math.floor(Math.random() * letters.length)); }
    function randHangul() {
      const base = 0xAC00;
      const range = 0xD7A3 - base;
      return String.fromCharCode(base + Math.floor(Math.random() * range));
    }

    function scrambleReveal(el, finalText, msDuration, isHangul) {
      const chars = Array.from(finalText);
      const total = Math.max(1, chars.length);
      const start = performance.now();
      return new Promise((res) => {
        function tick(now) {
          const t = Math.min(1, (now - start) / msDuration);
          const progress = 1 - Math.pow(1 - t, 2);
          const revealCount = Math.floor(progress * total);
          let out = '';
          for (let i = 0; i < total; i++) {
            if (i < revealCount) {
              out += chars[i];
            } else {
              const c = chars[i];
              if (/\s/.test(c)) out += c; else out += isHangul ? randHangul() : randChar();
            }
          }
          el.textContent = out;
          if (t < 1) requestAnimationFrame(tick); else { el.textContent = finalText; res(); }
        }
        requestAnimationFrame(tick);
      });
    }

    // Run animations (English first, then Korean shortly after)
    const engDuration = Math.round(duration * 0.95);
    const korDuration = Math.round(duration * 0.95);
    const korDelay = Math.round(duration * 0.08);

    // Start audio fade-in slightly before visual reveal completes
    if (splashAudio) fadeAudioIn(splashAudio, 0.55, duration + 200);

    scrambleReveal(engEl, english, engDuration, false);
    setTimeout(() => scrambleReveal(korEl, korean, korDuration, true), korDelay);

    // Additionally: generate short randomized 'computer' notes using WebAudio
    let audioCtx, oscNodes = [];
    function startComputerNotes() {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        // Play a sequence of 6 short notes across detuned octaves
        for (let i = 0; i < 6; i++) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          const freq = 220 * Math.pow(1.12, Math.floor(Math.random() * 8) + i);
          osc.type = ['sine','triangle','square'][Math.floor(Math.random()*3)];
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          gain.gain.setValueAtTime(0, now + i * 0.12);
          gain.gain.linearRampToValueAtTime(0.06, now + i * 0.12 + 0.02);
          gain.gain.linearRampToValueAtTime(0.0, now + i * 0.12 + 0.28);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.36);
          oscNodes.push({osc, gain});
        }
      } catch (e) {
        audioCtx = null;
      }
    }

    // Start notes if allowed by user gesture (best-effort)
    try { startComputerNotes(); } catch (e) {}

    // Resolve readyPromise when the visual animation has finished
    setTimeout(() => resolveReady(), duration + 20);
  });

  // hide() will remove the overlay and stop audio; callers call hide() when the
  // game mode has finished loading and is ready to show.
  function hide() {
    try {
      // fade any started audio elements
      const maybeAudio = document.querySelectorAll('audio');
      maybeAudio.forEach(a => {
        try { a.pause(); a.currentTime = 0; } catch(e) {}
      });
    } catch (e) {}
    try { if (overlay && overlay.parentNode) overlay.style.transition = 'opacity .28s ease'; overlay.style.opacity = '0'; } catch(e){}
    setTimeout(() => { try { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch(e){} }, 320);
  }

  return { readyPromise, hide };
}
