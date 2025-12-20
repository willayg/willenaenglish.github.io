/**
 * Cloudflare Worker: API Gateway + Set-Cookie domain rewrite
 *
 * This is the main API gateway at api.willenaenglish.com that routes ALL requests to:
 * Cloudflare Workers via Service Bindings (NO Netlify fallback)
 *
 * Features:
 * - All API traffic goes through CF Workers only
 * - Set-Cookie domain rewrite to .willenaenglish.com for cross-subdomain auth
 * - CORS handling with credentials support
 * - Centralized cookie management at api.willenaenglish.com
 *
 * Active CF Workers:
 * - supabase_auth: Authentication & session management
 * - homework_api: Homework assignments and progress
 * - log_word_attempt: Progress tracking (sessions, attempts)
 * - progress_summary: Leaderboards, stats, overview
 * - get_audio_urls: Audio file serving from R2
 * - verify_student: Student identity verification
 */

const COOKIE_DOMAIN = '.willenaenglish.com';

// Map function names to their service binding names
// The binding names are defined in wrangler.jsonc [[services]]
const FUNCTION_TO_BINDING = {
  supabase_auth: 'SUPABASE_AUTH',
  homework_api: 'HOMEWORK_API', 
  log_word_attempt: 'LOG_WORD_ATTEMPT',
  progress_summary: 'PROGRESS_SUMMARY',
  get_audio_urls: 'GET_AUDIO_URLS',
  verify_student: 'VERIFY_STUDENT',
};

// ALL listed functions use CF Workers exclusively (no Netlify fallback)
const CF_WORKER_FUNCTIONS = new Set([
  'supabase_auth',
  'homework_api',
  'log_word_attempt',
  'progress_summary',
  'get_audio_urls',
  'verify_student',
]);

const ALLOWED_ORIGINS = new Set([
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://staging.willenaenglish-github-io.pages.dev',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://cf.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://api.willenaenglish.com',
  'https://api-cf.willenaenglish.com',
  // Allow explicit staging Pages hostname used in testing
  'https://staging.willenaenglish-github-io.pages.dev'
]);

const CORS_ALLOW_HEADERS = 'Content-Type, Authorization, Cookie';
const CORS_ALLOW_METHODS = 'GET,POST,DELETE,OPTIONS';

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
  // If origin exactly matches an allowed origin, return it.
  if (ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
      'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS
    };
  }

  // Accept dynamic Pages/preview and internal willenaenglish subdomains.
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();

    // Allow any pages.dev origin for staging/previews
    if (host.endsWith('.pages.dev')) {
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
        'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS
      };
    }

    // Allow any subdomain of willenaenglish.com (production/staging variants)
    if (host === 'willenaenglish.com' || host.endsWith('.willenaenglish.com')) {
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
        'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS
      };
    }
  } catch (e) {
    // ignore invalid origin
  }

  // Default fallback to Netlify origin for unknown requests
  return {
    'Access-Control-Allow-Origin': 'https://willenaenglish.netlify.app',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS
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
 * Main request handler - CF Workers only, no Netlify fallback
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
        const workerRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
        });
        const response = await binding.fetch(workerRequest);
        return rewriteResponse(response, origin);
      } else {
        console.error('[proxy] GET_AUDIO_URLS binding not available');
        return new Response(JSON.stringify({ error: 'Audio service unavailable' }), { 
          status: 503, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } 
        });
      }
    }
    
    const functionName = extractFunctionName(url.pathname);
    
    // Validate function name
    if (!functionName) {
      return new Response(JSON.stringify({ error: 'Invalid API path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });
    }
    
    // Check if this is a supported CF Worker function
    if (!CF_WORKER_FUNCTIONS.has(functionName)) {
      return new Response(JSON.stringify({ error: `Unknown function: ${functionName}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });
    }
    
    // Get the service binding for this function
    const bindingName = FUNCTION_TO_BINDING[functionName];
    const binding = env && env[bindingName];
    
    if (!binding || typeof binding.fetch !== 'function') {
      console.error(`[proxy] Missing binding for ${functionName} (${bindingName})`);
      return new Response(JSON.stringify({ 
        error: `Service ${functionName} is not available`,
        binding: bindingName,
        hint: 'Service binding not configured in wrangler.jsonc'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });
    }
    
    // Route to CF Worker via service binding
    const response = await routeToCFWorker(request, binding, functionName, url);
    
    // Rewrite cookies and apply CORS
    return rewriteResponse(response, origin);
    
  } catch (err) {
    console.error('[proxy] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }), 
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
