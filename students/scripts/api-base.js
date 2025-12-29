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
  // Everything else: relative path (same-origin)
  return `/.netlify/functions/${name}`;
};
