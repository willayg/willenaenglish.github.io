function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra
  };
}

function bad(status, error) {
  return {
    statusCode: status,
    headers: cors({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ error })
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return bad(405, 'Method not allowed');

  const rawUrl = event.queryStringParameters && event.queryStringParameters.url;
  if (!rawUrl) return bad(400, 'Missing url');

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return bad(400, 'Invalid url');
  }

  const host = target.hostname.toLowerCase();
  const allowed = host === 'cdn.pixabay.com' || host.endsWith('.pixabay.com') || host === 'pixabay.com';
  if (!allowed) return bad(400, 'Disallowed host');

  try {
    const res = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'WillenaImageProxy/1.0'
      }
    });
    if (!res.ok) return bad(res.status, 'Upstream ' + res.status);

    const ab = await res.arrayBuffer();
    return {
      statusCode: 200,
      headers: cors({
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400'
      }),
      body: Buffer.from(ab).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return bad(500, e?.message || 'Proxy fetch failed');
  }
};