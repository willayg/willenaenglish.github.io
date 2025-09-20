// Shared image style injector for Word Arcade game modes
// Provides consistent cropping / aspect ratio utilities so we avoid repeating inline styles.
// Usage: import { ensureImageStyles } from '../ui/image_styles.js'; then call ensureImageStyles() once per mode before rendering.

let _waImageStylesAdded = false;
export function ensureImageStyles() {
  if (_waImageStylesAdded) return;
  const style = document.createElement('style');
  style.id = 'wa-image-styles';
  style.textContent = `
    .wa-img-box { position:relative; overflow:hidden; background:#fff; display:flex; }
    .wa-img-box img { width:100%; height:100%; object-fit:cover; display:block; }
    .wa-4x3 { aspect-ratio:4/3; width:100%; }
    .wa-square { aspect-ratio:1/1; width:100%; }
    .rounded { border-radius:16px; }
    .rounded-14 { border-radius:14px; }
    .shadow { box-shadow:0 2px 8px rgba(0,0,0,0.12); }
    .shadow-lg { box-shadow:0 4px 16px rgba(0,0,0,0.08); }
  `;
  document.head.appendChild(style);
  _waImageStylesAdded = true;
}
