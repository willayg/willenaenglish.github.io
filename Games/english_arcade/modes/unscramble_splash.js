// Unscramble Splash Module
// Shows a centered overlay with an animated "Unscramble the sentence" message
// in English and Korean. The animation scrambles letters and progressively
// reveals the final text. Exported function returns a Promise that resolves
// when the splash finishes so callers can await during heavy loading.

export function showUnscrambleSplash(root = document.body, opts = {}) {
  // Simplified splash: centered card with spinner and configurable text (default: 'now loading')
  const { readyDelay = 220, text = 'now loading' } = opts;
  let overlay = null;
  let card = null;

  const readyPromise = new Promise((resolve) => {
    // create overlay
    overlay = document.createElement('div');
    overlay.className = 'ua-splash-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', text);

    // card
    card = document.createElement('div');
    card.className = 'ua-splash-card ua-splash-centered';

    // spinner
    const spinner = document.createElement('div');
    spinner.className = 'ua-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    // heading
    const heading = document.createElement('div');
    heading.className = 'ua-splash-heading';
  heading.textContent = text;

  card.appendChild(spinner);
  card.appendChild(heading);

  // Accessibility: live region and keyboard focus
  card.setAttribute('tabindex', '-1');
  const live = document.createElement('div');
  live.setAttribute('aria-live', 'polite');
  live.style.position = 'absolute';
  live.style.left = '-9999px';
  live.textContent = text;
  card.appendChild(live);
    overlay.appendChild(card);

    // Inline styles to ensure visibility
    try {
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.background = 'rgba(0,0,0,0.35)';
      overlay.style.zIndex = '2147483647';

      card.style.background = '#fff';
      card.style.color = '#06b6d4';
      card.style.padding = '24px 32px';
      card.style.borderRadius = '12px';
      card.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.gap = '12px';
      card.style.minWidth = '280px';
    } catch (e) { console.warn('[Splash] inline style failed', e); }

    // Append with fallback
    try { (root || document.body).appendChild(overlay); } catch (e) { try { document.body.appendChild(overlay); } catch(e2) { console.error('[Splash] append failed', e2); } }

    // Inject CSS for spinner if missing
  if (!document.getElementById('ua-spinner-styles')) {
      const s = document.createElement('style');
      s.id = 'ua-spinner-styles';
      s.textContent = `
    .ua-splash-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);}
    .ua-splash-card{background:#fff;color:#06b6d4;padding:24px 32px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.12);display:flex;flex-direction:column;align-items:center;gap:12px;min-width:280px;opacity:0;transform:translateY(6px);transition:opacity .22s ease, transform .22s ease}
    .ua-splash-card.ua-visible{opacity:1;transform:translateY(0)}
    .ua-spinner{width:48px;height:48px;border:4px solid rgba(0,0,0,0.08);border-top-color:#06b6d4;border-radius:50%;animation:uaSpin 1s linear infinite}
    .ua-splash-heading{font-family:Poppins,system-ui,Arial,sans-serif;font-size:18px;font-weight:700;color:#06b6d4}
    @keyframes uaSpin{to{transform:rotate(360deg)}}
      `;
      document.head.appendChild(s);
    }

    // small delay then announce + focus and show card (fade-in)
    setTimeout(() => {
      try { card.classList.add('ua-visible'); card.focus({ preventScroll: true }); } catch(e){}
      resolve();
    }, readyDelay);
  });

  function hide() {
    try { if (overlay && overlay.parentNode) overlay.style.transition = 'opacity .18s ease', overlay.style.opacity = '0'; } catch(e){}
    setTimeout(() => { try { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch(e){} }, 220);
  }

  return { readyPromise, hide };
}

// Convenience helper for other modes
export function openNowLoadingSplash(root = document.body, opts = {}) {
  const merged = Object.assign({}, opts, { text: opts.text || 'now loading' });
  return showUnscrambleSplash(root, merged);
}
