/**
 * Cloudflare Worker: API Gateway + Set-Cookie domain rewrite
 *
 * This is the main API gateway at api.willenaenglish.com that routes requests to:
 * 1. Cloudflare Workers (for migrated functions) via Service Bindings
 * 2. Netlify (fallback for functions without bindings or not migrated)
 *
 * Features:
 * - Smart routing based on function name and available bindings
 * - Set-Cookie domain rewrite to .willenaenglish.com for cross-subdomain auth
 * - CORS handling with credentials support
 * - Graceful fallback to Netlify if CF worker binding unavailable
 *
 * Migration status (CF Workers):
 * - supabase_auth: ✓
 * - homework_api: ✓
 * - log_word_attempt: ✓
 * - progress_summary: ✓
 * - get_audio_urls: ✓
 */

const NETLIFY_BASE = 'https://willenaenglish.netlify.app';
const COOKIE_DOMAIN = '.willenaenglish.com';

// Map function names to their service binding names
// The binding names are defined in wrangler.toml [[services]]
const FUNCTION_TO_BINDING = {
  supabase_auth: 'SUPABASE_AUTH',
  homework_api: 'HOMEWORK_API', 
  log_word_attempt: 'LOG_WORD_ATTEMPT',
  progress_summary: 'PROGRESS_SUMMARY',
  get_audio_urls: 'GET_AUDIO_URLS',
};

// Functions that should prefer CF Workers (when binding available)
const PREFER_CF_WORKER = {
  supabase_auth: true,
  homework_api: true,
  log_word_attempt: true,
  progress_summary: true,
  get_audio_urls: true,
};

const ALLOWED_ORIGINS = new Set([
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://cf.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://api.willenaenglish.com',
]);

/**
 * Extract function name from /.netlify/functions/<name> path
 */
function extractFunctionName(pathname) {
  const match = pathname.match(/^\/?\.?netlify\/functions\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * Get CORS headers for origin
 */
function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://willenaenglish.netlify.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

/**
 * Route request to Cloudflare Worker via Service Binding
 */
async function routeToCFWorker(request, binding, functionName, url) {
  // Build the URL - keep query string, but the path becomes just / or /remaining
  const workerUrl = new URL(request.url);
  // Remove /.netlify/functions/<name> prefix, keep anything after
  const remainingPath = url.pathname.replace(/^\/?\.?netlify\/functions\/[^/?]+\/?/, '/') || '/';
  workerUrl.pathname = remainingPath === '' ? '/' : remainingPath;
  
  console.log(`[proxy] Routing ${functionName} to CF Worker: ${workerUrl.pathname}${workerUrl.search}`);
  
  // Forward the request to the worker
  const workerRequest = new Request(workerUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });
  
  return binding.fetch(workerRequest);
}

/**
 * Route request to Netlify backend
 */
async function routeToNetlify(request, url) {
  const forwardPath = url.pathname + url.search;
  const backendUrl = NETLIFY_BASE + forwardPath;
  
  console.log(`[proxy] Routing to Netlify: ${backendUrl}`);
  
  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete('cf-connecting-ip');
  
  const backendReq = new Request(backendUrl, {
    method: request.method,
    headers: reqHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow'
  });
  
  return fetch(backendReq);
}

/**
 * Rewrite response: fix Set-Cookie domain and add CORS headers
 */
function rewriteResponse(response, origin) {
  const newHeaders = new Headers();
  
  // Copy all headers except Set-Cookie (we'll rewrite those)
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() !== 'set-cookie') {
      newHeaders.append(key, value);
    }
  }
  
  // Collect and rewrite Set-Cookie headers
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() === 'set-cookie') {
      let cookie = value.trim();
      
      // Ensure Domain is the shared domain for cross-subdomain cookies
      if (/;\s*Domain=/i.test(cookie)) {
        cookie = cookie.replace(/;\s*Domain=[^;]+/i, `; Domain=${COOKIE_DOMAIN}`);
      } else {
        cookie += `; Domain=${COOKIE_DOMAIN}`;
      }
      
      // Ensure SameSite=None and Secure for cross-origin requests
      if (!/;\s*SameSite=/i.test(cookie)) cookie += '; SameSite=None';
      if (!/;\s*Secure/i.test(cookie)) cookie += '; Secure';
      
      newHeaders.append('Set-Cookie', cookie);
    }
  }
  
  // Apply CORS headers
  const cors = corsHeaders(origin);
  for (const [key, value] of Object.entries(cors)) {
    newHeaders.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Main request handler
 */
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  
  try {
    // Special case: /audio/* paths go directly to get-audio-urls worker for R2 proxying
    if (url.pathname.startsWith('/audio/')) {
      const binding = env && env.GET_AUDIO_URLS;
      if (binding && typeof binding.fetch === 'function') {
        console.log(`[proxy] Routing audio file to GET_AUDIO_URLS worker: ${url.pathname}`);
        // Forward the full path to the worker
        const workerRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
        });
        const response = await binding.fetch(workerRequest);
        return rewriteResponse(response, origin);
      } else {
        console.error('[proxy] GET_AUDIO_URLS binding not available for audio proxy');
        return new Response('Audio service unavailable', { status: 503, headers: corsHeaders(origin) });
      }
    }
    
    const functionName = extractFunctionName(url.pathname);
    
    // Check if we should use CF Worker and if the binding exists
    let response;
    
    if (functionName && PREFER_CF_WORKER[functionName]) {
      const bindingName = FUNCTION_TO_BINDING[functionName];
      const binding = env && env[bindingName];
      
      if (binding && typeof binding.fetch === 'function') {
        // Use CF Worker via service binding
        response = await routeToCFWorker(request, binding, functionName, url);
      } else {
        // Fallback to Netlify (binding not available)
        console.log(`[proxy] No binding for ${functionName}, falling back to Netlify`);
        response = await routeToNetlify(request, url);
      }
    } else {
      // Not a migrated function or no preference, use Netlify
      response = await routeToNetlify(request, url);
    }
    
    // Rewrite cookies and apply CORS
    return rewriteResponse(response, origin);
    
  } catch (err) {
    console.error('[proxy] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err), stack: err?.stack }), 
      { status: 520, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
    );
  }
}

/**
 * Module export for Wrangler
 */
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};
