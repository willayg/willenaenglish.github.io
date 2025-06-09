const fetch = require('node-fetch');

exports.handler = async (event) => {
  const OPENAI_API = process.env.openai_api;
  const body = event.body ? JSON.parse(event.body) : {};
  const endpoint = body.endpoint || 'chat/completions'; // default to chat

  let url = `https://api.openai.com/v1/${endpoint}`;
  let fetchOptions = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API}`,
      // Content-Type may need to be changed for audio uploads
      'Content-Type': body.contentType || 'application/json',
    },
    body: body.rawBody ? body.rawBody : JSON.stringify(body.payload),
  };

  // Special handling for audio file uploads (speech recognition)
  if (endpoint.startsWith('audio/') && body.formData) {
    // If you need to send multipart/form-data, you'll need to use a library like 'form-data'
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
    // For audio/image binary responses
    const buffer = await response.arrayBuffer();
    data = Buffer.from(buffer).toString('base64');
  }

  return {
    statusCode: response.status,
    body: JSON.stringify({ data }),
  };
};