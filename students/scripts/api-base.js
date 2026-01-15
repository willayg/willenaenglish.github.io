// students/scripts/api-base.js
// API URL helper - simple and deterministic
//
// PRODUCTION (willenaenglish.com, www.willenaenglish.com, cf.willenaenglish.com, localhost, netlify.app):
//   → Relative paths: /.netlify/functions/<name>
//   → Same-origin requests, cookies work automatically
//
// GITHUB PAGES (willenaenglish.github.io):
//   → Absolute URL to Netlify: https://willenaenglish.netlify.app/.netlify/functions/<name>
//   → Cross-origin, requires credentials: 'include'

const GITHUB_PAGES_HOST = 'willenaenglish.github.io';
const NETLIFY_BASE = 'https://willenaenglish.netlify.app';
const CF_API_GATEWAY = 'https://api.willenaenglish.com';

/**
 * Get the URL for a Netlify function.
 * Returns relative path for same-origin environments (production),
 * absolute Netlify URL only for GitHub Pages.
 */
export const FN = (name) => {
  // Only GitHub Pages needs absolute URLs
  if (typeof window !== 'undefined' && window.location.hostname === GITHUB_PAGES_HOST) {
    return `${NETLIFY_BASE}/.netlify/functions/${name}`;
  }
  // Subdomains and Cloudflare Pages have no Netlify functions; use the API gateway.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const needsCfGateway = host === 'staging.willenaenglish.com' || 
                           host === 'cf.willenaenglish.com' || 
                           host === 'students.willenaenglish.com' ||
                           host === 'teachers.willenaenglish.com' ||
                           host.endsWith('.pages.dev');
    if (needsCfGateway) {
      return `${CF_API_GATEWAY}/.netlify/functions/${name}`;
    }
  }
  // Everything else: relative path (same-origin)
  return `/.netlify/functions/${name}`;
};
