// Bridge direct flag-table reads to the narrow RPC, while allowing the lab flagger to POST new flags.
// Also captures the Render Lab's already-authorized REST connection for test-harness helpers.
(() => {
  const originalFetch = window.fetch.bind(window);
  const FLAG_TABLE_PATH = '/rest/v1/test_prep_question_flags';
  const RPC_PATH = '/rest/v1/rpc/get_open_test_prep_flag_question_ids';

  window.fetch = (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    let parsed;
    try { parsed = new URL(rawUrl, window.location.href); } catch { return originalFetch(input, init); }

    // Capture the first authenticated Supabase REST request before any module can race us.
    if (!window.__renderLabApi && /\/rest\/v1\//.test(parsed.pathname)) {
      try {
        const sourceHeaders = init.headers || (typeof input !== 'string' ? input.headers : undefined) || {};
        const headers = {};
        new Headers(sourceHeaders).forEach((value, key) => { headers[key] = value; });
        window.__renderLabApi = { base: parsed.origin, headers };
      } catch {}
    }

    const method = String(init.method || (typeof input !== 'string' ? input.method : '') || 'GET').toUpperCase();
    if (parsed.pathname !== FLAG_TABLE_PATH || method !== 'GET') return originalFetch(input, init);

    const rpcUrl = `${parsed.origin}${RPC_PATH}`;
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
    headers.set('Content-Type', 'application/json');

    return originalFetch(rpcUrl, {
      ...init,
      method: 'POST',
      headers,
      body: '{}',
      cache: 'no-store',
    });
  };
})();
