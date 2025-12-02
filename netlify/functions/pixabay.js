exports.handler = async function(event, context) {
  console.log('=== PIXABAY FUNCTION START ===');
  console.log('Environment check:', {
    PIXABAY_API_KEY: process.env.PIXABAY_API_KEY ? 'PRESENT' : 'MISSING',
    keyLength: process.env.PIXABAY_API_KEY ? process.env.PIXABAY_API_KEY.length : 0
  });
  
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    console.log('ERROR: PIXABAY_API_KEY not found in environment');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Pixabay API key not configured" })
    };
  }
  
  const query = event.queryStringParameters.q || "";
  console.log('Query:', query);

  // Allow these to be set by the frontend, or use sensible defaults
  const imageType = event.queryStringParameters.image_type || "photo"; // "all", "photo", "illustration", "vector"
  const contentType = event.queryStringParameters.content_type; // "ai" for AI-generated content
  const order = event.queryStringParameters.order || "popular"; // "popular" or "latest"
  const safesearch = event.queryStringParameters.safesearch || "true"; // "true" or "false"
  const perPage = event.queryStringParameters.per_page || "5"; // number of results to fetch
  const pageParam = event.queryStringParameters.page; // allow explicit page for deterministic pagination

  // Build URL with conditional content_type parameter
  // Use provided page param if valid positive integer; else keep lightweight randomness (1-5)
  let pageValue = 1;
  if (pageParam && /^\d+$/.test(pageParam) && Number(pageParam) > 0) {
    pageValue = Number(pageParam);
  } else {
    pageValue = Math.floor(Math.random()*5)+1;
  }
  let url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=${imageType}&per_page=${perPage}&safesearch=${safesearch}&order=${order}&page=${pageValue}`;
  if (contentType) {
    url += `&content_type=${contentType}`;
  }
  
  console.log('Pixabay URL (without key):', url.replace(apiKey, 'HIDDEN_KEY'));
  console.log('Parameters:', { query, imageType, contentType, order, safesearch, perPage });
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log('ERROR: Pixabay HTTP', res.status);
      return { statusCode: res.status, body: JSON.stringify({ error: 'Pixabay HTTP ' + res.status }) };
    }
    const data = await res.json();
    const images = Array.isArray(data?.hits) ? data.hits.map(hit => hit.webformatURL).filter(Boolean) : [];
    console.log('Pixabay response:', data.total || 0, 'total results; returning', images.length, 'urls');
    return {
      statusCode: 200,
      body: JSON.stringify({ image: images[0] || null, images })
    };
  } catch (e) {
    console.log('ERROR: Pixabay fetch failed:', e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Pixabay fetch failed" })
    };
  }
};