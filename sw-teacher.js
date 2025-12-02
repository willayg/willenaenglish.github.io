const CACHE_NAME = 'teacher-tracker-cache-v1';
const PREFETCH_MESSAGE = 'teacher-prefetch';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function fetchAndCache(request, cache) {
  try {
    const response = await fetch(request, { credentials: 'include', cache: 'no-store' });
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[sw-teacher] fetch failed', request.url, error);
    return null;
  }
}

async function handleTeacherRequest(event) {
  if (event.request.method !== 'GET') {
    return fetch(event.request);
  }
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);

  const fetchPromise = fetchAndCache(event.request, cache);
  if (cached) {
    return cached;
  }
  const fresh = await fetchPromise;
  return fresh || new Response('Service unavailable', { status: 503 });
}

self.addEventListener('fetch', (event) => {
  try {
    const url = new URL(event.request.url);
    if (url.origin === self.location.origin && url.pathname.startsWith('/.netlify/functions/')) {
      event.respondWith(handleTeacherRequest(event));
    }
  } catch (err) {
    console.warn('[sw-teacher] fetch handler error', err);
  }
});

self.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== PREFETCH_MESSAGE) return;
  if (!Array.isArray(event.data.urls) || !event.data.urls.length) return;
  const cache = await caches.open(CACHE_NAME);
  const tasks = event.data.urls.map((urlString) => {
    try {
      const request = new Request(urlString, { method: 'GET', credentials: 'include', cache: 'no-store' });
      return fetchAndCache(request, cache);
    } catch (err) {
      console.warn('[sw-teacher] prefetch error', urlString, err);
      return Promise.resolve(null);
    }
  });
  await Promise.all(tasks);
});
