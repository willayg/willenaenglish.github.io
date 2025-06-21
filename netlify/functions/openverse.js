const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  const query = event.queryStringParameters.q || "apple";
  const res = await fetch(`https://api.openverse.org/v1/images?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
};