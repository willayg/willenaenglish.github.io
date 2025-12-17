// Games/english_arcade/scripts/api-base.js
// Determine the correct API base URL based on environment

// Cloudflare API Proxy URL (unified gateway with proper CORS and cookie handling)
const CF_API_PROXY = 'https://api.willenaenglish.com';

// Migrated functions that should go through CF Workers
const CF_MIGRATED_FUNCTIONS = [
  'get_audio_urls',
  'supabase_auth',
  'log_word_attempt',
  'homework_api',
  'progress_summary',
];

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

// Check if we're in production (should use CF Workers via proxy)
const isProduction = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return host === 'willenaenglish.github.io' || 
         host === 'willenaenglish.com' || 
         host === 'www.willenaenglish.com' ||
         host.endsWith('.willenaenglish.com') ||
         host.endsWith('.pages.dev');
};

/**
 * Get the URL for an API function.
 * In production, uses the CF API proxy (api.willenaenglish.com) which routes
 * to the appropriate Cloudflare Worker via service bindings.
 * This ensures proper CORS headers and cookie domain handling.
 */
export const FN = (name) => {
  // In production, use CF API proxy for migrated functions
  // The proxy routes /.netlify/functions/<name> to the appropriate CF Worker
  if (isProduction() && CF_MIGRATED_FUNCTIONS.includes(name)) {
    console.log(`[api-base] Using CF API proxy for ${name}`);
    return `${CF_API_PROXY}/.netlify/functions/${name}`;
  }
  
  // Check if WillenaAPI is loaded and if this function should use Cloudflare
  if (typeof window !== 'undefined' && window.WillenaAPI) {
    const api = window.WillenaAPI;
    // If rollout is 100% and function is migrated, use CF API proxy
    if (api.CF_ROLLOUT_PERCENT >= 100 && api.CF_MIGRATED_FUNCTIONS && api.CF_MIGRATED_FUNCTIONS[name]) {
      return `${CF_API_PROXY}/.netlify/functions/${name}`;
    }
  }
  
  // Default: Netlify function path (local dev or Netlify hosting)
  return `${FUNCTIONS_BASE}/.netlify/functions/${name}`;
};
