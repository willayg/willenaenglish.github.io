exports.handler = async function(event, context) {
  const apiKey = process.env.PIXABAY_API_KEY;
  const query = event.queryStringParameters.q || "";

  // Allow these to be set by the frontend, or use sensible defaults
  const imageType = event.queryStringParameters.image_type || "photo"; // "all", "photo", "illustration", "vector"
  const order = event.queryStringParameters.order || "popular"; // "popular" or "latest"
  const safesearch = event.queryStringParameters.safesearch || "true"; // "true" or "false"
  const perPage = event.queryStringParameters.per_page || "3"; // number of results to fetch

  // You can add more filters here as needed (orientation, category, colors, etc.)

  const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=${imageType}&per_page=5&safesearch=${safesearch}&order=${order}&page=${Math.floor(Math.random()*5)+1}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ images: data.hits.map(hit => hit.webformatURL) })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Pixabay fetch failed" })
    };
  }
};