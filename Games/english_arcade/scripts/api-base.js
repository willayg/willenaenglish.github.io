// Games/english_arcade/scripts/api-base.js
// Determine the correct API base URL based on environment
const getApiBase = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  // GitHub Pages or custom domain needs full Netlify URL
  if (host === 'willenaenglish.github.io' || host === 'willenaenglish.com' || host === 'www.willenaenglish.com') {
    return 'https://willenaenglish.netlify.app';
  }
  // Netlify or localhost use relative paths
  return '';
};

const FUNCTIONS_BASE = getApiBase();

/**
 * Get the URL for a Netlify function — OR the Cloudflare Worker if rollout is enabled.
 * Uses `WillenaAPI` from `js/api-config.js` when available.
 */
export const FN = (name) => {
  // Check if WillenaAPI is loaded and if this function should use Cloudflare
  if (typeof window !== 'undefined' && window.WillenaAPI) {
    const api = window.WillenaAPI;
    // If Cloudflare rollout applies to this function, return Worker URL with full path
    if (api.CF_MIGRATED_FUNCTIONS && api.CF_MIGRATED_FUNCTIONS[name] && api.shouldUseCloudflare(name)) {
      // CF_MIGRATED_FUNCTIONS[name] is the base URL (e.g., https://api.willenaenglish.com)
      // We still need to append the full function path for the proxy to route correctly
      const baseUrl = api.CF_MIGRATED_FUNCTIONS[name].replace(/\/$/, '');
      return `${baseUrl}/.netlify/functions/${name}`;
    }
  }
  // Default: Netlify function path
  return `${FUNCTIONS_BASE}/.netlify/functions/${name}`;
};
