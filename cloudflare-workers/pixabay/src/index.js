/**
 * Pixabay Image Search Worker
 * Proxies requests to Pixabay API to keep API key secure
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: CORS_HEADERS
      });
    }

    // Check for API key
    const apiKey = env.PIXABAY_API_KEY;
    if (!apiKey) {
      console.log('ERROR: PIXABAY_API_KEY not found in environment');
      return new Response(JSON.stringify({ error: 'Pixabay API key not configured' }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }

    const url = new URL(request.url);
    const params = url.searchParams;

    // Extract query parameters
    const query = params.get('q') || '';
    const imageType = params.get('image_type') || 'photo'; // "all", "photo", "illustration", "vector"
    const contentType = params.get('content_type'); // "ai" for AI-generated content
    const order = params.get('order') || 'popular'; // "popular" or "latest"
    const safesearch = params.get('safesearch') || 'true'; // "true" or "false"
    const perPage = params.get('per_page') || '5'; // number of results to fetch
    const pageParam = params.get('page'); // allow explicit page for deterministic pagination

    // Use provided page param if valid positive integer; else keep lightweight randomness (1-5)
    let pageValue = 1;
    if (pageParam && /^\d+$/.test(pageParam) && Number(pageParam) > 0) {
      pageValue = Number(pageParam);
    } else {
      pageValue = Math.floor(Math.random() * 5) + 1;
    }

    // Build Pixabay API URL
    let pixabayUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=${imageType}&per_page=${perPage}&safesearch=${safesearch}&order=${order}&page=${pageValue}`;
    if (contentType) {
      pixabayUrl += `&content_type=${contentType}`;
    }

    console.log('Pixabay request:', { query, imageType, contentType, order, safesearch, perPage, page: pageValue });

    try {
      const res = await fetch(pixabayUrl);
      if (!res.ok) {
        console.log('ERROR: Pixabay HTTP', res.status);
        return new Response(JSON.stringify({ error: 'Pixabay HTTP ' + res.status }), {
          status: res.status,
          headers: CORS_HEADERS
        });
      }

      const data = await res.json();
      const images = Array.isArray(data?.hits) 
        ? data.hits.map(hit => hit.webformatURL).filter(Boolean) 
        : [];
      
      console.log('Pixabay response:', data.total || 0, 'total results; returning', images.length, 'urls');

      return new Response(JSON.stringify({ image: images[0] || null, images }), {
        status: 200,
        headers: CORS_HEADERS
      });
    } catch (e) {
      console.log('ERROR: Pixabay fetch failed:', e.message);
      return new Response(JSON.stringify({ error: 'Pixabay fetch failed' }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }
  }
};
