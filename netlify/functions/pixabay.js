exports.handler = async function(event, context) {
  const apiKey = process.env.PIXABAY_API_KEY;
  const query = event.queryStringParameters.q || "";
  const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3&safesearch=true`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ image: data.hits?.[0]?.webformatURL || "" })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Pixabay fetch failed" })
    };
  }
};