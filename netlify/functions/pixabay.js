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
  const order = event.queryStringParameters.order || "popular"; // "popular" or "latest"
  const safesearch = event.queryStringParameters.safesearch || "true"; // "true" or "false"
  const perPage = event.queryStringParameters.per_page || "3"; // number of results to fetch

  // You can add more filters here as needed (orientation, category, colors, etc.)

  const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=${imageType}&per_page=5&safesearch=${safesearch}&order=${order}&page=${Math.floor(Math.random()*5)+1}`;
  console.log('Pixabay URL (without key):', url.replace(apiKey, 'HIDDEN_KEY'));
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Pixabay response:', data.total || 0, 'total results');
    return {
      statusCode: 200,
      body: JSON.stringify({ images: data.hits.map(hit => hit.webformatURL) })
    };
  } catch (e) {
    console.log('ERROR: Pixabay fetch failed:', e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Pixabay fetch failed" })
    };
  }
};