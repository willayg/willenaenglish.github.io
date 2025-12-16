// Games/english_arcade/scripts/api-base.js
// Determine the correct API base URL based on environment
const getApiBase = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  // Prefer Cloudflare API proxy on custom domain to keep cookies same-site
  if (host === 'willenaenglish.com' || host === 'www.willenaenglish.com' || host === 'cf.willenaenglish.com') {
    return 'https://api-cf.willenaenglish.com';
  }
  // GitHub Pages needs full Netlify URL
  if (host === 'willenaenglish.github.io') {
    return 'https://willenaenglish.netlify.app';
  }
  // Netlify or localhost use relative paths
  return '';
};

const FUNCTIONS_BASE = getApiBase();

/**
 * Get the URL for a server function. If WillenaAPI is present, delegate to it
 * so environment-specific routing (Cloudflare proxy vs Netlify) is handled
 * consistently site‑wide.
 */
export const FN = (name) => {
  // If global config is loaded, use its resolver for correct base per env
  if (typeof window !== 'undefined' && window.WillenaAPI && typeof window.WillenaAPI.getApiUrl === 'function') {
    return window.WillenaAPI.getApiUrl(`/.netlify/functions/${name}`);
  }
  // Default: build from local decision
  return `${FUNCTIONS_BASE}/.netlify/functions/${name}`;
};
