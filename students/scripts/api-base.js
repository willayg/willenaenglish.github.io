// students/scripts/api-base.js
// Determine the correct API base URL based on environment

// Cloudflare API Proxy URL (unified gateway with proper CORS and cookie handling)
const CF_API_PROXY = 'https://api.willenaenglish.com';

const getApiBase = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  // GitHub Pages, custom domain, or Cloudflare Pages needs CF API proxy for CORS
  if (host === 'willenaenglish.github.io' || 
      host === 'willenaenglish.com' || 
      host === 'www.willenaenglish.com' ||
      host.endsWith('.willenaenglish.com') ||
      host.endsWith('.pages.dev')) {
    return CF_API_PROXY;
  }
  // Netlify or localhost use relative paths
  return '';
};

const FUNCTIONS_BASE = getApiBase();
export const FN = (name) => `${FUNCTIONS_BASE}/.netlify/functions/${name}`;
