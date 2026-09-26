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


const SHIMMER_BATCH_ID = 'shimmer-monosyllables-20260927-cf-v1';
const SHIMMER_MARKER_KEY = '_batches/' + SHIMMER_BATCH_ID + '.json';
const CONTENT_SUPABASE_URL = 'https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_G-FYhHfDL4OGdL892gY1Zg_epdbEeqO';

async function readBatchMarker(env) {
  const obj = await env.AUDIO_BUCKET.get(SHIMMER_MARKER_KEY);
  if (!obj) return null;
  return JSON.parse(await obj.text());
}

async function saveBatchMarker(env, marker) {
  marker.updated_at = new Date().toISOString();
  await env.AUDIO_BUCKET.put(SHIMMER_MARKER_KEY, JSON.stringify(marker, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' }
  });
}

async function fetchPublishedLexicalWords() {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const url = CONTENT_SUPABASE_URL + '/rest/v1/lexical_entries?status=eq.published&select=canonical_text&order=canonical_text.asc&limit=1000&offset=' + offset;
    const resp = await fetch(url, {
      headers: {
        apikey: CONTENT_SUPABASE_PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + CONTENT_SUPABASE_PUBLISHABLE_KEY
      }
    });
    if (!resp.ok) throw new Error('Supabase lexical fetch failed ' + resp.status + ': ' + (await resp.text()).slice(0,300));
    const rows = await resp.json();
    all.push(...rows.map(r => String(r.canonical_text || '').trim()));
    if (rows.length < 1000) break;
  }
  return [...new Set(all.filter(w => /^[A-Za-z]+$/.test(w) && w.length >= 2))].sort((a,b) => a.localeCompare(b));
}

async function classifyMonosyllablesCF(env, words) {
  if (!env.OPENAI_API) throw new Error('OPENAI_API secret is missing on Cloudflare worker');
  const selected = [];
  for (let i = 0; i < words.length; i += 180) {
    const chunk = words.slice(i, i + 180);
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.OPENAI_API, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a careful American English pronunciation lexicographer.' },
          { role: 'user', content: 'Return JSON exactly as {"words":["..."]}. From the supplied English tokens, include every ordinary token pronounced as exactly ONE syllable in neutral American English. Include diphthongs and one-syllable homographs such as read, lead, live, wind, tear, close, use. Exclude abbreviations, obvious proper-name-only items, nonwords, and words normally two or more syllables. Preserve spelling exactly.\n\n' + JSON.stringify(chunk) }
        ]
      })
    });
    if (!resp.ok) throw new Error('OpenAI classification failed ' + resp.status + ': ' + (await resp.text()).slice(0,300));
    const data = await resp.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    const allowed = new Set(chunk);
    for (const w of (parsed.words || [])) if (allowed.has(w)) selected.push(w);
  }
  return [...new Set(selected)].sort((a,b) => a.localeCompare(b));
}

async function generateShimmerWordCF(env, word) {
  if (!env.OPENAI_API) throw new Error('OPENAI_API secret is missing on Cloudflare worker');
  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENAI_API, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'shimmer',
      input: word,
      instructions: 'Pronounce this English vocabulary word once, clearly and naturally. Warm, friendly and encouraging tone for a child learning English. Neutral American English. Slightly slower than normal conversation, but do not exaggerate. Do not add any other words or sounds.',
      response_format: 'mp3'
    })
  });
  if (!resp.ok) throw new Error('OpenAI TTS ' + word + ' failed ' + resp.status + ': ' + (await resp.text()).slice(0,300));
  return await resp.arrayBuffer();
}

function publicBatchStatus(marker) {
  if (!marker) return { batch_id: SHIMMER_BATCH_ID, state: 'not_started' };
  return {
    batch_id: marker.batch_id,
    state: marker.state,
    target_count: marker.targets?.length || 0,
    completed_count: marker.completed?.length || 0,
    failure_count: marker.failures?.length || 0,
    failures: marker.failures || [],
    last_chunk: marker.last_chunk || [],
    started_at: marker.started_at,
    updated_at: marker.updated_at,
    finished_at: marker.finished_at
  };
}

async function handleShimmerBatch(request, env) {
  const origin = request.headers.get('Origin') || '';
  const cors = getCorsHeaders(origin);
  if (origin && origin !== 'https://teachers.willenaenglish.com' && origin !== 'https://staging.willenaenglish.com') {
    return new Response(JSON.stringify({ error: 'Forbidden origin' }), { status: 403, headers: { 'Content-Type':'application/json', ...cors } });
  }
  if (!env.AUDIO_BUCKET) return new Response(JSON.stringify({ error:'R2 binding unavailable' }), { status:500, headers:{'Content-Type':'application/json', ...cors} });

  if (request.method === 'GET') {
    return new Response(JSON.stringify(publicBatchStatus(await readBatchMarker(env))), { status:200, headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors} });
  }

  if (request.method !== 'POST') return new Response(JSON.stringify({ error:'Method not allowed' }), { status:405, headers:{'Content-Type':'application/json',...cors} });

  let marker = await readBatchMarker(env);
  if (!marker) {
    marker = { batch_id: SHIMMER_BATCH_ID, state:'preparing', started_at:new Date().toISOString(), completed:[], failures:[], targets:[] };
    await saveBatchMarker(env, marker);
    const words = await fetchPublishedLexicalWords();
    marker.targets = await classifyMonosyllablesCF(env, words);
    marker.state = 'ready';
    marker.published_single_tokens = words.length;
    await saveBatchMarker(env, marker);
  }

  if (marker.state === 'complete') {
    return new Response(JSON.stringify(publicBatchStatus(marker)), { status:200, headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors} });
  }

  const completed = new Set(marker.completed || []);
  const next = (marker.targets || []).filter(w => !completed.has(w)).slice(0, 4);
  marker.state = 'running';
  marker.last_chunk = [];

  for (const word of next) {
    try {
      const audio = await generateShimmerWordCF(env, word);
      await env.AUDIO_BUCKET.put(toKey(word), audio, {
        httpMetadata: { contentType:'audio/mpeg', cacheControl:'public, max-age=300, must-revalidate' },
        customMetadata: { tts_provider:'openai', tts_model:'gpt-4o-mini-tts', tts_voice:'shimmer', batch_id:SHIMMER_BATCH_ID }
      });
      marker.completed.push(word);
      marker.failures = (marker.failures || []).filter(f => f.word !== word);
      marker.last_chunk.push({ word, status:'ok' });
    } catch (e) {
      marker.failures = (marker.failures || []).filter(f => f.word !== word);
      marker.failures.push({ word, error:String(e?.message || e).slice(0,300) });
      marker.last_chunk.push({ word, status:'failed', error:String(e?.message || e).slice(0,160) });
    }
  }

  const doneNow = new Set(marker.completed || []);
  const remaining = (marker.targets || []).filter(w => !doneNow.has(w));
  if (!remaining.length) {
    marker.state = marker.failures?.length ? 'complete_with_failures' : 'complete';
    marker.finished_at = new Date().toISOString();
  }
  await saveBatchMarker(env, marker);
  return new Response(JSON.stringify(publicBatchStatus(marker)), { status:200, headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors} });
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

    // Route: admin Shimmer monosyllable replacement batch (Cloudflare-only)
    if (url.pathname === '/admin/shimmer-batch') {
      return handleShimmerBatch(request, env);
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
