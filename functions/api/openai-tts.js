export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const key = env.OPENAI_API || env.OPENAI_KEY || env.OPENAI_API_KEY;

  if (!key) {
    return new Response(JSON.stringify({ error: 'OpenAI key unavailable in student Pages environment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const mode = body.mode === 'classify' ? 'classify' : 'tts';

  if (mode === 'classify') {
    const words = Array.isArray(body.words) ? body.words : [];
    if (!words.length) {
      return new Response(JSON.stringify({ error: 'Missing words' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a careful American English pronunciation lexicographer.' },
          { role: 'user', content: 'Return JSON exactly as {"words":["..."]}. From the supplied English tokens, include every ordinary token pronounced as exactly ONE syllable in neutral American English. Include diphthongs and one-syllable homographs such as read, lead, live, wind, tear, close, use. Exclude abbreviations, obvious proper-name-only items, nonwords, and words normally two or more syllables. Preserve spelling exactly.\n\n' + JSON.stringify(words) }
        ],
      }),
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({
        error: 'OpenAI classification failed',
        status: resp.status,
        detail: (await resp.text()).slice(0, 500),
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await resp.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    const allowed = new Set(words);
    const selected = (parsed.words || []).filter(w => allowed.has(w));

    return new Response(JSON.stringify({ words: selected }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const input = String(body.input || '').trim();
  if (!input) {
    return new Response(JSON.stringify({ error: 'Missing input' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'shimmer',
      input,
      instructions: String(body.instructions || 'Pronounce this English vocabulary word once, clearly and naturally. Neutral American English. Do not add any other words or sounds.'),
      response_format: 'mp3',
    }),
  });

  if (!resp.ok) {
    return new Response(JSON.stringify({
      error: 'OpenAI TTS failed',
      status: resp.status,
      detail: (await resp.text()).slice(0, 500),
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(resp.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
