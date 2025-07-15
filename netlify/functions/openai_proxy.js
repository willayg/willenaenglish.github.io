const fetch = require('node-fetch');
const OPENAI_API = process.env.OPENAI_API;

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

  return {
    statusCode: response.status,
    body: JSON.stringify({ data }),
  };
};