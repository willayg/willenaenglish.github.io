// students/scripts/api-base.js
// API URL helper - simple and deterministic
//
// Default:
//   → /api/<name> routes via the API gateway
//   → Auth via HTTP-only cookies

const GITHUB_PAGES_HOST = 'willenaenglish.github.io';
const API_GATEWAY_ORIGIN = 'https://api.willenaenglish.com';

/**
 * Get the URL for an API function.
 * Returns relative path for localhost, otherwise uses the API gateway.
 */
export const FN = (name) => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (isLocal) return `/api/${name}`;
  }
  return `${API_GATEWAY_ORIGIN}/api/${name}`;
};
