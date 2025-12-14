// Games/english_arcade/scripts/api-base.js
// Determine the correct API base URL based on environment

// Cloudflare Worker URLs (primary API endpoints)
const CF_WORKER_URLS = {
  get_audio_urls: 'https://get-audio-urls.willena.workers.dev',
  supabase_auth: 'https://supabase-auth.willena.workers.dev',
  log_word_attempt: 'https://log-word-attempt.willena.workers.dev',
  homework_api: 'https://homework-api.willena.workers.dev',
  progress_summary: 'https://progress-summary.willena.workers.dev',
};

const getApiBase = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  // GitHub Pages or custom domain needs full Netlify URL (fallback only)
  if (host === 'willenaenglish.github.io' || host === 'willenaenglish.com' || host === 'www.willenaenglish.com' || host.endsWith('.willenaenglish.com')) {
    return 'https://willenaenglish.netlify.app';
  }
  // Netlify or localhost use relative paths
  return '';
};

const FUNCTIONS_BASE = getApiBase();

// Check if we're in production (should use CF Workers)
const isProduction = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return host === 'willenaenglish.github.io' || 
         host === 'willenaenglish.com' || 
         host === 'www.willenaenglish.com' ||
         host.endsWith('.willenaenglish.com');
};

/**
 * Get the URL for an API function.
 * Uses Cloudflare Workers for production, falls back to Netlify if needed.
 */
export const FN = (name) => {
  // In production, ALWAYS use Cloudflare Workers for migrated functions
  if (isProduction() && CF_WORKER_URLS[name]) {
    console.log(`[api-base] Using CF Worker for ${name}`);
    return CF_WORKER_URLS[name];
  }
  
  // Check if WillenaAPI is loaded and if this function should use Cloudflare
  if (typeof window !== 'undefined' && window.WillenaAPI) {
    const api = window.WillenaAPI;
    // If Cloudflare rollout applies to this function, return Worker URL
    if (api.CF_MIGRATED_FUNCTIONS && api.CF_MIGRATED_FUNCTIONS[name] && api.shouldUseCloudflare(name)) {
      return api.CF_MIGRATED_FUNCTIONS[name];
    }
  }
  // Default: Netlify function path
  return `${FUNCTIONS_BASE}/.netlify/functions/${name}`;
};
