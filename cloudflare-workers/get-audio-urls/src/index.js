import { PUBLISHED_LEXICAL_WORDS } from './published-lexical-words.js';
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
  'https://teachers.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://students.willenaenglish.com',
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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


const SHIMMER_BATCH_ID = 'shimmer-monosyllables-20260927-cf-v4';
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
  return PUBLISHED_LEXICAL_WORDS.slice();
}

async function classifyMonosyllableChunkCF(env, chunk) {
  const openaiKey = env.OPENAI_API || env.OPENAI_KEY || env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OpenAI secret missing on get-audio-urls worker');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
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
  return (parsed.words || []).filter(w => allowed.has(w));
}

async function generateShimmerWordCF(env, word) {
  const openaiKey = env.OPENAI_API || env.OPENAI_KEY || env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OpenAI secret missing on get-audio-urls worker');
  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
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
    source_count: marker.source_words?.length || 0,
    classified_count: marker.classify_index || 0,
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
  const jsonHeaders = { 'Content-Type':'application/json', 'Cache-Control':'no-store', ...cors };

  try {
    if (origin && origin !== 'https://teachers.willenaenglish.com' && origin !== 'https://staging.willenaenglish.com') {
      return new Response(JSON.stringify({ error: 'Forbidden origin' }), { status: 403, headers: jsonHeaders });
    }
    if (!env.AUDIO_BUCKET) {
      return new Response(JSON.stringify({ error:'R2 binding unavailable' }), { status:500, headers:jsonHeaders });
    }

    if (request.method === 'GET') {
      const status = publicBatchStatus(await readBatchMarker(env));
      status.openai_configured = !!(env.OPENAI_API || env.OPENAI_KEY || env.OPENAI_API_KEY);
      return new Response(JSON.stringify(status), { status:200, headers:jsonHeaders });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error:'Method not allowed' }), { status:405, headers:jsonHeaders });
    }

    let marker = await readBatchMarker(env);

    // Fast initialization only: no OpenAI work in the first request.
    if (!marker) {
      const words = await fetchPublishedLexicalWords();
      marker = {
        batch_id: SHIMMER_BATCH_ID,
        state:'classifying',
        started_at:new Date().toISOString(),
        source_words: words,
        classify_index: 0,
        targets: [],
        completed: [],
        failures: [],
        last_chunk: []
      };
      await saveBatchMarker(env, marker);
      return new Response(JSON.stringify(publicBatchStatus(marker)), { status:200, headers:jsonHeaders });
    }

    // Classify one slice per request and persist immediately.
    if (marker.state === 'classifying') {
      const size = 140;
      const from = marker.classify_index || 0;
      const chunk = (marker.source_words || []).slice(from, from + size);

      if (chunk.length) {
        const selected = await classifyMonosyllableChunkCF(env, chunk);
        marker.targets.push(...selected);
        marker.targets = [...new Set(marker.targets)];
        marker.classify_index = from + chunk.length;
        marker.last_chunk = [{ status:'classified', from, to:marker.classify_index, selected:selected.length }];
        if (marker.classify_index >= marker.source_words.length) {
          marker.state = 'ready';
          marker.source_words = [];
        }
        await saveBatchMarker(env, marker);
        return new Response(JSON.stringify(publicBatchStatus(marker)), { status:200, headers:jsonHeaders });
      }

      marker.state = 'ready';
      marker.source_words = [];
      await saveBatchMarker(env, marker);
      return new Response(JSON.stringify(publicBatchStatus(marker)), { status:200, headers:jsonHeaders });
    }

    if (marker.state === 'complete' || marker.state === 'complete_with_failures') {
      return new Response(JSON.stringify(publicBatchStatus(marker)), { status:200, headers:jsonHeaders });
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
    return new Response(JSON.stringify(publicBatchStatus(marker)), { status:200, headers:jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({
      batch_id: SHIMMER_BATCH_ID,
      state:'error',
      error:String(e?.message || e)
    }), { status:500, headers:jsonHeaders });
  }
}



function shimmerBatchUi() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shimmer Batch</title>
<style>
body{font:16px/1.45 system-ui;margin:0;background:#f7fbfc;color:#17252d}
main{max-width:760px;margin:32px auto;padding:0 16px}
.card{background:#fff;border:3px solid #c9f3f5;border-radius:20px;padding:20px}
button{font:inherit;font-weight:800;padding:12px 16px;border:3px solid #ffd0df;border-radius:14px;background:#fff;cursor:pointer;margin:0 8px 8px 0}
button:disabled{opacity:.5} progress{width:100%;height:22px;margin:14px 0 6px}
pre{white-space:pre-wrap;background:#f4f7f8;padding:14px;border-radius:12px;min-height:120px}
.small{color:#65757d;font-size:13px}
</style></head><body><main><div class="card">
<h1>Shimmer monosyllable replacement</h1>
<p>Direct worker: published monosyllables → OpenAI <b>gpt-4o-mini-tts / Shimmer</b> → R2.</p>
<p class="small">No Netlify. No Pages function. No proxy worker.</p>
<button id="go">Run / resume batch</button>
<button id="stop">Stop after current chunk</button>
<button id="status">Refresh status</button>
<progress id="bar" value="0" max="1"></progress>
<div id="summary" class="small">Loading…</div>
<pre id="out">Ready.</pre>
</div></main>
<script>
const API='/admin/shimmer-batch';
const out=document.getElementById('out'),go=document.getElementById('go'),bar=document.getElementById('bar'),summary=document.getElementById('summary');
let running=false,stopRequested=false;
function show(j){
 const state=j.state||'unknown';
 if(state==='classifying'){
   const total=Number(j.source_count||0),done=Number(j.classified_count||0);
   bar.max=Math.max(total,1);bar.value=Math.min(done,bar.max);
   summary.textContent='Classifying '+done+' / '+total+' · '+(j.target_count||0)+' monosyllables found';
 } else {
   const total=Number(j.target_count||0),done=Number(j.completed_count||0);
   bar.max=Math.max(total,1);bar.value=Math.min(done,bar.max);
   summary.textContent=(j.openai_configured===false?'OPENAI_API NOT CONFIGURED · ':'')+(total?done+' / '+total+' complete · ':'')+state;
 }
 out.textContent=JSON.stringify(j,null,2);
}
async function req(method){
 const r=await fetch(API,{method,cache:'no-store',headers:method==='POST'?{'Content-Type':'application/json'}:undefined,body:method==='POST'?'{}':undefined});
 const t=await r.text(); let j={}; try{j=t?JSON.parse(t):{};}catch(_){throw new Error('Non-JSON '+r.status+': '+t.slice(0,200));}
 if(!r.ok) throw new Error(j.error||('HTTP '+r.status)); return j;
}
async function status(){try{const j=await req('GET');show(j);return j}catch(e){out.textContent='Status error: '+e.message}}
async function run(){if(running)return;running=true;stopRequested=false;go.disabled=true;try{while(!stopRequested){const j=await req('POST');show(j);if(['complete','complete_with_failures','error'].includes(j.state))break;await new Promise(r=>setTimeout(r,250));}}catch(e){out.textContent='Batch error: '+e.message+'\\n\\n'+out.textContent}finally{running=false;go.disabled=false}}
go.onclick=run;document.getElementById('stop').onclick=()=>stopRequested=true;document.getElementById('status').onclick=status;status();
</script></body></html>`;
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

    if (url.pathname === '/admin/shimmer-batch-ui') {
      return new Response(shimmerBatchUi(), { status: 200, headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' } });
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

// deploy-bump: 2026-09-27 shimmer batch
