// Network utilities
// Resilient fetch with retries, performance tracking, and error handling

/**
 * Performance tracking - stores recent samples
 */
if (!window.__gbPerf) window.__gbPerf = [];

export function recordPerfSample(sample) {
  try {
    window.__gbPerf.push(sample);
    if (window.__gbPerf.length > 25) window.__gbPerf.shift();
    const { label, ttfbMs, totalMs, sizeBytes, status } = sample;
    console.info(`[GB-PERF] ${label} status=${status} ttfb=${ttfbMs.toFixed(1)}ms total=${totalMs.toFixed(1)}ms size=${sizeBytes}B`);
  } catch (e) { /* non-fatal */ }
}

/**
 * Timed JSON fetch with performance tracking
 */
export async function timedJSONFetch(label, url, init) {
  const start = performance.now();
  let ttfbMs = 0; 
  let ok = false; 
  let status = 0; 
  let sizeBytes = 0; 
  let text = ''; 
  let data = null; 
  let err = null;
  
  try {
    const res = await fetch(url, init);
    status = res.status;
    ttfbMs = performance.now() - start; // approximate (headers received)
    text = await res.text();
    sizeBytes = new Blob([text]).size;
    try { 
      data = text ? JSON.parse(text) : null; 
    } catch (parseErr) { 
      err = parseErr; 
    }
    ok = res.ok;
    return { 
      ok, 
      status, 
      data, 
      raw: text, 
      meta: { label, ttfbMs, totalMs: performance.now() - start, sizeBytes, status }
    };
  } catch (fetchErr) {
    err = fetchErr;
    return { 
      ok: false, 
      status: status || 0, 
      data: null, 
      raw: '', 
      meta: { 
        label, 
        ttfbMs, 
        totalMs: performance.now() - start, 
        sizeBytes, 
        status: status || 0, 
        error: String(err && err.message || err) 
      }
    };
  } finally {
    recordPerfSample({ 
      label, 
      ttfbMs, 
      totalMs: performance.now() - start, 
      sizeBytes, 
      status,
      ...(err ? { error: String(err && err.message || err) } : {})
    });
  }
}

/**
 * Resilient JSON fetch with automatic retry on network errors
 */
export async function fetchJSONSafe(url, init, opts = {}) {
  const { retryOnNetwork = true, retryDelayMs = 700 } = opts;
  try {
    const res = await fetch(url, init);
    // Read text first so we can report useful errors on non-JSON responses
    let text = '';
    try { 
      text = await res.text(); 
    } catch {}
    
    let data = null;
    try { 
      data = text ? JSON.parse(text) : null; 
    } catch {}
    
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data ?? {};
  } catch (err) {
    const msg = String(err && err.message || err || '');
    // Retry once on network-style errors seen in Netlify dev (connection reset / failed to fetch)
    if (retryOnNetwork && /Failed to fetch|NetworkError|ERR_CONNECTION_RESET|load failed|TypeError: NetworkError/i.test(msg)) {
      await new Promise(r => setTimeout(r, retryDelayMs));
      return fetchJSONSafe(url, init, { retryOnNetwork: false, retryDelayMs });
    }
    throw err;
  }
}

/**
 * Check if running on localhost
 */
export function isLocalHost() {
  return typeof window !== 'undefined' && /localhost|127\.0\.0\.1/i.test(window.location.hostname);
}
