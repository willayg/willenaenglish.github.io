const fetch = require('node-fetch');
const crypto = require('crypto');
const redisCache = require('../../lib/redis_cache');
const OPENAI_API = process.env.OPENAI_API;
const OPENAI_CACHE_TTL = Number(process.env.OPENAI_CACHE_TTL_SECONDS || 3600); // default 1 hour

exports.handler = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {};

  // If the frontend sends { prompt, type }, use chat/completions
  if (body.prompt) {
    const endpoint = 'chat/completions';
    const url = `https://api.openai.com/v1/${endpoint}`;
    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant for generating grammar worksheet questions.' },
        { role: 'user', content: body.prompt }
      ],
      max_tokens: 512,
      temperature: 0.7
    };
    // Cache key derived from endpoint + payload hash
    try {
      if (redisCache.isEnabled()) {
        const keyRaw = `${endpoint}:${JSON.stringify(payload)}`;
        const key = 'openai:' + crypto.createHash('sha256').update(keyRaw).digest('hex');
        const cached = await redisCache.getJson(key);
        if (cached) {
          return {
            statusCode: 200,
            body: JSON.stringify({ result: cached.result, cached: true }),
          };
        }
      }
    } catch (e) {
      console.debug('[openai_proxy] cache check failed', e && e.message);
    }
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API}`
      },
      body: JSON.stringify(payload),
    };
    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    let result = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      result = data.choices[0].message.content;
    }
    // Store in cache if available
    try {
      if (redisCache.isEnabled()) {
        const keyRaw = `${endpoint}:${JSON.stringify(payload)}`;
        const key = 'openai:' + crypto.createHash('sha256').update(keyRaw).digest('hex');
        await redisCache.setJson(key, { result }, OPENAI_CACHE_TTL);
      }
    } catch (e) {
      console.debug('[openai_proxy] cache store failed', e && e.message);
    }
    return {
      statusCode: response.status,
      body: JSON.stringify({ result }),
    };
  }

  // Legacy/other tools: support rawBody, payload, endpoint, formData
  const endpoint = body.endpoint || 'chat/completions';
  let url = `https://api.openai.com/v1/${endpoint}`;
  let fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API}`
    },
    body: body.rawBody ? body.rawBody : JSON.stringify(body.payload),
  };

  // Special handling for audio file uploads (speech recognition)
  if (endpoint.startsWith('audio/') && body.formData) {
    const FormData = require('form-data');
    const form = new FormData();
    for (const key in body.formData) {
      form.append(key, body.formData[key]);
    }
    fetchOptions.body = form;
    fetchOptions.headers = {
      ...fetchOptions.headers,
      ...form.getHeaders(),
    };
  }

  const response = await fetch(url, fetchOptions);
  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const buffer = await response.arrayBuffer();
    data = Buffer.from(buffer).toString('base64');
  }

  // Generic cache store for other payloads
  try {
    if (redisCache.isEnabled() && body.payload) {
      const keyRaw = `${endpoint}:${JSON.stringify(body.payload)}`;
      const key = 'openai:' + crypto.createHash('sha256').update(keyRaw).digest('hex');
      await redisCache.setJson(key, { data }, OPENAI_CACHE_TTL);
    }
  } catch (e) {
    console.debug('[openai_proxy] generic cache store failed', e && e.message);
  }

  return {
    statusCode: response.status,
    body: JSON.stringify({ data }),
  };
};