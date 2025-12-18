/**
 * Shared CORS configuration for Netlify Functions
 * Used to support cross-origin requests from GitHub Pages
 */

const ALLOWED_ORIGINS = new Set([
  'https://www.willenaenglish.com',
  'https://willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://willenaenglish.github.io',
  'https://willenaenglish.netlify.app',
  // Cloudflare Pages staging/preview
  'https://staging.willenaenglish-github-io.pages.dev',
  'https://willenaenglish-github-io.pages.dev',
  'http://localhost:9000',
  'http://localhost:8888',
  'http://localhost:3000',
  'http://127.0.0.1:9000',
  'http://127.0.0.1:8888',
]);

/**
 * Get CORS headers for a request
 * @param {Object} event - Netlify function event object
 * @param {Object} extra - Additional headers to merge
 * @returns {Object} Headers object with CORS headers
 */
function getCorsHeaders(event, extra = {}) {
  const hdrs = event.headers || {};
  const origin = (hdrs.origin || hdrs.Origin || '').trim();
  
  // If origin is in allowlist, echo it back; otherwise use default
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) 
    ? origin 
    : 'https://willenaenglish.netlify.app';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    ...extra,
  };
}

/**
 * Handle CORS preflight (OPTIONS) request
 * @param {Object} event - Netlify function event object
 * @returns {Object|null} Response object for OPTIONS, or null if not OPTIONS
 */
function handleCorsPreflightIfNeeded(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: '',
    };
  }
  return null;
}

/**
 * Create a JSON response with CORS headers
 * @param {Object} event - Netlify function event object
 * @param {number} statusCode - HTTP status code
 * @param {Object} body - Response body (will be JSON stringified)
 * @param {Object} extraHeaders - Additional headers
 * @returns {Object} Netlify function response object
 */
function corsJsonResponse(event, statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...getCorsHeaders(event),
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Create a JSON response with CORS headers and cookies
 * @param {Object} event - Netlify function event object
 * @param {number} statusCode - HTTP status code
 * @param {Object} body - Response body (will be JSON stringified)
 * @param {string[]} cookies - Array of Set-Cookie header values
 * @param {Object} extraHeaders - Additional headers
 * @returns {Object} Netlify function response object
 */
function corsJsonResponseWithCookies(event, statusCode, body, cookies = [], extraHeaders = {}) {
  const response = {
    statusCode,
    headers: {
      ...getCorsHeaders(event),
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
  
  if (cookies && cookies.length > 0) {
    response.multiValueHeaders = { 'Set-Cookie': cookies };
  }
  
  return response;
}

// Export for CommonJS (Netlify functions)
module.exports = {
  ALLOWED_ORIGINS,
  getCorsHeaders,
  handleCorsPreflightIfNeeded,
  corsJsonResponse,
  corsJsonResponseWithCookies,
};
