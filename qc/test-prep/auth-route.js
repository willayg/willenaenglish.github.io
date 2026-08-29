(()=>{
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  const apiBase = (() => {
    const host = location.hostname;
    if (host === 'students.willenaenglish.com' || host === 'willenaenglish.netlify.app' || host === 'localhost' || host === '127.0.0.1') return '';
    if (host === 'staging.willenaenglish.com' || host === 'cf.willenaenglish.com' || host === 'teachers.willenaenglish.com' || host.endsWith('.pages.dev')) return 'https://api.willenaenglish.com';
    if (host === 'willenaenglish.github.io') return 'https://students.willenaenglish.com';
    return 'https://students.willenaenglish.com';
  })();
  window.fetch = (input, init = {}) => {
    let url = typeof input === 'string' ? input : input?.url;
    if (apiBase && typeof url === 'string' && url.startsWith('/.netlify/functions/supabase_auth')) {
      url = apiBase + url;
      if (typeof input === 'string') input = url;
      else input = new Request(url, input);
      init = { credentials: 'include', ...init };
    }
    return nativeFetch(input, init);
  };
})();
