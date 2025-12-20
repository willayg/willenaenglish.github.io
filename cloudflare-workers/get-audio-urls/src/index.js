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
  'https://staging.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://cf.willenaenglish.com',
  'https://api.willenaenglish.com',
  'https://api-cf.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://staging.willenaenglish-github-io.pages.dev',
  'http://localhost:8888',
  'http://localhost:9000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:9000',
];

// Cache TTL in seconds
const CACHE_TTL = 300; // 5 minutes
const SIGNED_URL_EXPIRY = 8 * 60 * 60; // 8 hours (same as Netlify)

function getCorsHeaders(origin) {
  let allowedOrigin = ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin)) {
    allowedOrigin = origin;
  } else if (origin) {
    try {
      const u = new URL(origin);
      const host = u.hostname.toLowerCase();
      if (host.endsWith('.pages.dev') || host === 'willenaenglish.com' || host.endsWith('.willenaenglish.com')) {
        allowedOrigin = origin;
      }
    } catch {}
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
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

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeBaseName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '');
}

function toAudioKey(input) {
  let s = String(input ?? '').trim();
  if (!s) return '';

  // If caller passed a URL, use the last path segment
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = decodeURIComponent(u.pathname.split('/').pop() || '');
    } catch {
      // fall through
    }
  }
  s = String(s || '').trim();
  if (!s) return '';

  // If caller already provided a .mp3 key, keep the extension
  const mp3Match = s.match(/^(.*)\.mp3$/i);
  if (mp3Match) {
    const base = normalizeBaseName(mp3Match[1]);
    return base ? `${base}.mp3` : '';
  }

  const lower = s.toLowerCase();
  // If a bare UUID was provided (common when passing sentence_id), map to sent_<uuid>.mp3
  if (UUID_V4_RE.test(lower)) {
    return `sent_${lower}.mp3`;
  }

  // If sent_<uuid> was provided, normalize to sent_<uuid>.mp3
  const sentUuid = lower.match(/^sent_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  if (sentUuid) {
    return `sent_${sentUuid[1].toLowerCase()}.mp3`;
  }

  const base = normalizeBaseName(s);
  return base ? `${base}.mp3` : '';
}

function normalizeRequestEntry(entry) {
  // Backward compatible: strings behave exactly as before (keyed by the original string)
  if (typeof entry === 'string') {
    const token = entry;
    const key = toAudioKey(entry);
    if (!key) return null;
    return { token, key, cachePart: `${token}=>${key}` };
  }

  // Forward compatible: allow objects so callers can pass { id, eng, sentence_id, audio_key }
  if (entry && typeof entry === 'object') {
    const audioKey = entry.audio_key || entry.audioKey || entry.key || entry.audio;
    const sentenceId = entry.sentence_id || entry.sentenceId || entry.sid;
    const id = entry.id || entry.word_id || entry.wordId;
    const eng = entry.eng || entry.word || entry.text || entry.value;

    let token = null;
    if (typeof id === 'string' && id.trim()) token = id.trim();
    else if (typeof sentenceId === 'string' && sentenceId.trim()) token = sentenceId.trim();
    else if (typeof eng === 'string' && eng.trim()) token = eng.trim();
    else if (typeof audioKey === 'string' && audioKey.trim()) token = audioKey.trim();

    let lookup = null;
    if (typeof audioKey === 'string' && audioKey.trim()) lookup = audioKey.trim();
    else if (typeof sentenceId === 'string' && sentenceId.trim()) lookup = `sent_${sentenceId.trim()}`;
    else if (typeof eng === 'string' && eng.trim()) lookup = eng.trim();
    else if (typeof token === 'string' && token.trim()) lookup = token.trim();

    const key = toAudioKey(lookup);
    if (!token || !key) return null;
    return { token, key, cachePart: `${token}=>${key}` };
  }

  return null;
}

/**
 * Generate a cache key for the request
 */
function getCacheKey(parts) {
  const sorted = [...parts].sort().join(',');
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
      const rawWords = Array.isArray(body.words) ? body.words : [];
      const entries = rawWords.map(normalizeRequestEntry).filter(Boolean);

      if (!entries.length) {
        return new Response(
          JSON.stringify({ error: 'Missing words' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Log request (visible in wrangler tail / CF dashboard)
      console.log(`[${requestId}] get_audio_urls: ${entries.length} words from ${origin}`);

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
      const cacheKey = new Request(new URL(`/cache/${getCacheKey(entries.map(e => e.cachePart))}`, request.url), { method: 'GET' });
      
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

      console.log(`[${requestId}] Cache MISS, checking ${entries.length} files in R2`);

      const results = {};
      const concurrency = Math.min(12, entries.length);
      let idx = 0;
      let foundCount = 0;

      // Worker function for concurrent processing
      async function processWord() {
        while (idx < entries.length) {
          const i = idx++;
          const { token, key } = entries[i];

          try {
            if (hasR2) {
              // R2 head() is very fast - direct bucket access, no network hop
              const object = await env.AUDIO_BUCKET.head(key);
              if (object) {
                foundCount++;
                // Generate a URL for the audio file
                // Option 1: Use public bucket URL if configured
                if (publicBase) {
                  results[token] = { exists: true, url: `${publicBase.replace(/\/$/, '')}/${key}` };
                } else {
                  // Option 2: Generate a worker proxy URL
                  // The client will call this URL and we'll stream from R2
                  const workerUrl = new URL(request.url);
                  results[token] = {
                    exists: true,
                    url: `${workerUrl.origin}/audio/${encodeURIComponent(key)}`,
                  };
                }
              } else {
                results[token] = { exists: false };
              }
            } else {
              // No R2 binding in dev; try a public URL HEAD request against R2_PUBLIC_BASE
              const url = `${publicBase.replace(/\/$/, '')}/${key}`;
              try {
                const headResp = await fetch(url, { method: 'HEAD' });
                if (headResp.ok) {
                  foundCount++;
                  results[token] = { exists: true, url };
                } else {
                  results[token] = { exists: false };
                }
              } catch (fe) {
                results[token] = { exists: false };
              }
            }
          } catch (e) {
            // File doesn't exist or error
            results[token] = { exists: false };
          }
        }
      }

      // Run concurrent workers
      await Promise.all(Array.from({ length: concurrency }, () => processWord()));

      const duration = Date.now() - startTime;
      console.log(`[${requestId}] Completed: ${foundCount}/${entries.length} found in ${duration}ms`);

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
