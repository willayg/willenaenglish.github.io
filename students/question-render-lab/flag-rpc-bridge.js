// Bridge the legacy flag-table read to a narrow SECURITY DEFINER RPC.
// Keeps test_prep_question_flags private while letting the Render Lab see open question IDs.
(() => {
  const originalFetch = window.fetch.bind(window);
  const FLAG_TABLE_PATH = '/rest/v1/test_prep_question_flags';
  const RPC_PATH = '/rest/v1/rpc/get_open_test_prep_flag_question_ids';

  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.includes(FLAG_TABLE_PATH)) return originalFetch(input, init);

    const rpcUrl = url.replace(FLAG_TABLE_PATH + '?select=question_id&status=eq.open', RPC_PATH);
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
