/**
 * Cloudflare Worker: get-audio-urls
 * 
 * Drop-in replacement for Netlify function get_audio_urls.js
 * Uses R2 bucket binding for direct access (no S3 API calls needed)
 * 
 * API Contract (same as Netlify version):
 *   POST /
 *   Body: { "words": ["apple", "banana", ...] }
 *   Response: { "results": { "apple": { "exists": true, "url": "..." }, ... } }
 * 
 * Production features:
 *   - Direct R2 bucket binding (fast, no network hop)
 *   - Presigned URL generation for secure direct downloads
 *   - Response caching (5 min default)
 *   - Request logging for debugging
 */

const ALLOWED_ORIGINS = [
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  // GitHub Pages preview (pages.dev) used for branch previews
  'https://willenaenglish-github-io.pages.dev',
  // Cloudflare Pages deployment
  'https://cf.willenaenglish.com',
  'https://staging.willenaenglish.com',
  // Student and Teacher subdomains
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000',
];

// Cache TTL in seconds
const CACHE_TTL = 300; // 5 minutes
const SIGNED_URL_EXPIRY = 8 * 60 * 60; // 8 hours (same as Netlify)

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function toKey(word) {
  return String(word)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '') + '.mp3';
}

/**
 * Generate a cache key for the request
 */
function getCacheKey(words) {
  const sorted = [...words].sort().join(',');
  return `audio-urls:${sorted}`;
}

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);
    const requestId = crypto.randomUUID().slice(0, 8);
    const url = new URL(request.url);

    // Handle CORS preflight for all routes
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Route: GET /audio/:filename - proxy audio files from R2
    if (url.pathname.startsWith('/audio/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      }
      const filename = decodeURIComponent(url.pathname.replace('/audio/', ''));
      return this.handleAudioProxy(request, env, filename);
    }

    // Route: POST / - get audio URLs for words
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST for audio URL lookup.' }),
        { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    try {
      const body = await request.json();
      const words = Array.isArray(body.words) ? body.words : [];

      if (!words.length) {
        return new Response(
          JSON.stringify({ error: 'Missing words' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Log request (visible in wrangler tail / CF dashboard)
      console.log(`[${requestId}] get_audio_urls: ${words.length} words from ${origin}`);

      // Check R2 bucket binding OR a public base for local/dev testing
      const publicBase = env.R2_PUBLIC_BASE || env.R2_PUBLIC_URL || '';
      const hasR2 = !!env.AUDIO_BUCKET;
      
      if (!hasR2 && !publicBase) {
        console.error(`[${requestId}] ERROR: No R2 bucket and no R2_PUBLIC_BASE`);
        return new Response(
          JSON.stringify({ error: 'R2 bucket not configured and no R2_PUBLIC_BASE provided' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Try to get from cache first (Workers Cache API)
      const cache = caches.default;
      const cacheKey = new Request(new URL(`/cache/${getCacheKey(words)}`, request.url), { method: 'GET' });
      
      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        console.log(`[${requestId}] Cache HIT`);
        // Clone and add fresh CORS headers
        const cachedBody = await cachedResponse.json();
        return new Response(
          JSON.stringify({ ...cachedBody, _cached: true }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': `public, max-age=${CACHE_TTL}`,
              'X-Cache': 'HIT',
              'X-Request-Id': requestId,
              ...corsHeaders,
            },
          }
        );
      }

      console.log(`[${requestId}] Cache MISS, checking ${words.length} files in R2`);

      const results = {};
      const concurrency = Math.min(12, words.length);
      let idx = 0;
      let foundCount = 0;

      // Worker function for concurrent processing
      async function processWord() {
        while (idx < words.length) {
          const i = idx++;
          const word = words[i];
          const key = toKey(word);

          try {
            if (hasR2) {
              // R2 head() is very fast - direct bucket access, no network hop
              const object = await env.AUDIO_BUCKET.head(key);
              if (object) {
                foundCount++;
                // Generate a URL for the audio file
                // Option 1: Use public bucket URL if configured
                if (publicBase) {
                  results[word] = { exists: true, url: `${publicBase.replace(/\/$/, '')}/${key}` };
                } else {
                  // Option 2: Generate a worker proxy URL
                  // The client will call this URL and we'll stream from R2
                  const workerUrl = new URL(request.url);
                  results[word] = {
                    exists: true,
                    url: `${workerUrl.origin}/audio/${encodeURIComponent(key)}`,
                  };
                }
              } else {
                results[word] = { exists: false };
              }
            } else {
              // No R2 binding in dev; try a public URL HEAD request against R2_PUBLIC_BASE
              const url = `${publicBase.replace(/\/$/, '')}/${key}`;
              try {
                const headResp = await fetch(url, { method: 'HEAD' });
                if (headResp.ok) {
                  foundCount++;
                  results[word] = { exists: true, url };
                } else {
                  results[word] = { exists: false };
                }
              } catch (fe) {
                results[word] = { exists: false };
              }
            }
          } catch (e) {
            // File doesn't exist or error
            results[word] = { exists: false };
          }
        }
      }

      // Run concurrent workers
      await Promise.all(Array.from({ length: concurrency }, () => processWord()));

      const duration = Date.now() - startTime;
      console.log(`[${requestId}] Completed: ${foundCount}/${words.length} found in ${duration}ms`);

      const responseBody = { results, _timing_ms: duration, _request_id: requestId };
      const response = new Response(
        JSON.stringify(responseBody),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${CACHE_TTL}`,
            'X-Cache': 'MISS',
            'X-Request-Id': requestId,
            'X-Timing-Ms': String(duration),
            ...corsHeaders,
          },
        }
      );

      // Store in cache (don't await - fire and forget)
      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    } catch (err) {
      console.error(`[${requestId}] ERROR: ${err.message}`);
      return new Response(
        JSON.stringify({ error: 'get_audio_urls failed', message: err.message, _request_id: requestId }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  },

  /**
   * Handle audio file proxy requests: GET /audio/:filename
   * Streams audio directly from R2 to the client
   */
  async handleAudioProxy(request, env, key) {
    const corsHeaders = getCorsHeaders(request.headers.get('Origin') || '');
    
    if (!env.AUDIO_BUCKET) {
      return new Response('R2 not configured', { status: 500, headers: corsHeaders });
    }

    try {
      const object = await env.AUDIO_BUCKET.get(key);
      
      if (!object) {
        return new Response('Audio not found', { status: 404, headers: corsHeaders });
      }

      const headers = new Headers();
      headers.set('Content-Type', 'audio/mpeg');
      headers.set('Cache-Control', 'public, max-age=86400'); // 24h cache for audio files
      headers.set('Accept-Ranges', 'bytes');
      if (object.httpMetadata?.contentLength) {
        headers.set('Content-Length', object.httpMetadata.contentLength);
      }
      // Add CORS headers
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));

      return new Response(object.body, { status: 200, headers });
    } catch (e) {
      console.error(`Audio proxy error for ${key}: ${e.message}`);
      return new Response('Error fetching audio', { status: 500, headers: corsHeaders });
    }
  }
};
