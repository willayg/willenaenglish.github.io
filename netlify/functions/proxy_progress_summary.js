/**
 * Proxy progress_summary through Netlify so browser cookies stay intact.
 * Forwards all headers (including Cookie/Authorization) to the worker and returns the worker response.
 */

exports.handler = async function proxyProgressSummary(event) {
  const query = event.rawQuery ? `?${event.rawQuery}` : '';
  const target = `https://progress-summary.willena.workers.dev/.netlify/functions/progress_summary${query}`;
  const method = event.httpMethod || 'GET';
  const isBodyAllowed = !(method === 'GET' || method === 'HEAD');
  const body = isBodyAllowed
    ? (event.isBase64Encoded && event.body ? Buffer.from(event.body, 'base64') : event.body)
    : undefined;

  // Copy inbound headers, but drop hop-by-hop headers and fix host for the target.
  const inbound = { ...event.headers };
  delete inbound['host'];
  delete inbound['connection'];
  delete inbound['content-length'];
  delete inbound['accept-encoding'];

  const res = await fetch(target, {
    method,
    headers: {
      ...inbound,
      host: new URL(target).host,
    },
    body,
    redirect: 'manual',
  });

  const buf = await res.arrayBuffer();
  const base64Body = Buffer.from(buf).toString('base64');

  const singleHeaders = {};
  const multiValueHeaders = {};
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      if (!multiValueHeaders['Set-Cookie']) multiValueHeaders['Set-Cookie'] = [];
      multiValueHeaders['Set-Cookie'].push(value);
    } else {
      singleHeaders[key] = value;
    }
  });

  return {
    statusCode: res.status,
    headers: singleHeaders,
    multiValueHeaders,
    body: base64Body,
    isBase64Encoded: true,
  };
};
