const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  const query = event.queryStringParameters.q || "apple";
  let images = [];

  // 1. Get 5 from Pixabay
  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (pixabayKey) {
    const pixabayRes = await fetch(`https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=5`);
    const pixabayData = await pixabayRes.json();
    if (pixabayData.hits && pixabayData.hits.length > 0) {
      images = pixabayData.hits.slice(0, 5).map(hit => hit.webformatURL);
    }
  }

  // 2. Get 5 from Openverse
  const openverseToken = process.env.OPENVERSE_API;
  const openverseHeaders = openverseToken
    ? { Authorization: `Bearer ${openverseToken}` }
    : {};
  const openverseRes = await fetch(`https://api.openverse.org/v1/images?q=${encodeURIComponent(query)}&page_size=5`, {
    headers: openverseHeaders
  });
  const openverseData = await openverseRes.json();
  if (openverseData.results && openverseData.results.length > 0) {
    images = images.concat(openverseData.results.slice(0, 5).map(img => img.url));
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ images })
  };
};