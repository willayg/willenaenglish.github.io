// DOM manipulation utilities
// Shared helpers for toast messages, overlays, and HTML building

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Show toast message in status element
 */
export function toast(msg, statusEl) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  setTimeout(() => { 
    if (statusEl.textContent === msg) statusEl.textContent = ''; 
  }, 2000);
}

/**
 * Show tiny toast notification (top-right corner)
 */
export function showTinyToast(msg, { variant = 'success', ms = 500 } = {}) {
  let el = document.getElementById('tinyToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tinyToast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = [
      'position:fixed',
      'top:12px',
      'right:12px',
      'background:#10b981',
      'color:#fff',
      'padding:8px 12px',
      'border-radius:9999px',
      'font:600 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'box-shadow:0 6px 20px rgba(0,0,0,.18)',
      'z-index:100000',
      'opacity:0',
      'transform:translateY(-6px)',
      'transition:opacity .12s ease, transform .12s ease',
      'display:none'
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  if (variant === 'error') el.style.background = '#ef4444';
  else if (variant === 'warn') el.style.background = '#f59e0b';
  else el.style.background = '#10b981';
  
  // Show
  el.style.display = 'block';
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => { 
      if (el.style.opacity === '0') el.style.display = 'none'; 
    }, 160);
  }, Math.max(200, ms | 0));
}

/**
 * Ensure full-screen loading overlay exists and return control interface
 */
export function ensureLoadingOverlay() {
  let el = document.getElementById('gbLoadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gbLoadingOverlay';
    el.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.32);z-index:100000;font:600 16px system-ui,Arial;color:#fff;backdrop-filter:blur(2px);';
    el.innerHTML = '<div style="background:#0f172a; padding:18px 26px; border-radius:14px; box-shadow:0 6px 28px -4px rgba(0,0,0,.35); display:flex; flex-direction:column; gap:10px; align-items:center;" id="gbLoadingBox"><div class="spinner" style="width:34px;height:34px;border:4px solid #334155;border-top-color:#67e2e6;border-radius:50%;animation:gbOverlaySpin .8s linear infinite"></div><div id="gbLoadingText">Loading…</div></div>';
    const style = document.createElement('style');
    style.textContent = '@keyframes gbOverlaySpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
    document.body.appendChild(el);
  }
  return {
    show(msg) { 
      try { 
        el.style.display = 'flex'; 
        const t = el.querySelector('#gbLoadingText'); 
        if (t) t.textContent = msg || 'Loading…'; 
      } catch {} 
    },
    hide() { 
      try { 
        el.style.display = 'none'; 
      } catch {} 
    }
  };
}

/**
 * Build skeleton loading HTML for cards
 */
export function buildSkeletonHTML(count = 8) {
  return Array.from({ length: count }, (_, i) => `
    <div class="game-card skeleton-card" style="min-height:280px;animation-delay:${i * 0.08}s;">
      <div style="width:100%;height:200px;background:#e2e8f0;border-radius:8px;"></div>
      <div style="width:80%;height:16px;background:#e2e8f0;border-radius:4px;margin-top:12px;"></div>
      <div style="width:50%;height:12px;background:#e2e8f0;border-radius:4px;margin-top:8px;"></div>
    </div>
  `).join('');
}
