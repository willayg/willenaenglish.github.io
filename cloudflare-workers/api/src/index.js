/**
 * Cloudflare Worker: analyze-sentence
 *
 * Route this worker to: https://staging.willenaenglish.com/api/analyze-sentence
 *
 * Strategy:
 * - ASR (Whisper): Uses @cf/openai/whisper-large-v3-turbo (Workers AI) — no region block
 * - Grammar Correction: ALWAYS uses external proxy (Vercel) so it matches production behavior
 *   and never uses Llama.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// External proxy endpoint (calls OpenAI from a supported region)
const VERCEL_PROXY_URL = 'https://willena-openai-proxy.willena.workers.dev';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    if (!env.AI) {
      return new Response(
        JSON.stringify({
          error:
            'Server not configured: missing Workers AI binding. Add [ai] binding = "AI" and ensure AI is enabled.',
        }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    try {
      const formData = await request.formData();
      const audioFile = formData.get('audio');
      const language = String(formData.get('language') || 'en');

      if (!audioFile || !(audioFile instanceof File)) {
        return new Response(JSON.stringify({ error: 'No audio file provided' }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      if (audioFile.size > 25 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: 'Audio file too large (max 25MB)' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const transcript = await transcribeAudioWorkersAI(audioFile, env.AI, language);

      if (!transcript || transcript.trim() === '') {
        return new Response(
          JSON.stringify({
            transcript: '',
            corrected_sentence: '',
            teacher_note:
              'No speech detected. Please try speaking louder or closer to the microphone.',
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      const correction = await correctGrammarViaProxy(transcript, language);

      return new Response(
        JSON.stringify({
          transcript,
          corrected_sentence: correction.corrected_sentence || transcript,
          teacher_note: correction.teacher_note || 'Good job!',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (error) {
      const status = Number(error?.status) || 500;
      const code = error?.code;
      const message = error?.message || 'Internal server error';

      return new Response(
        JSON.stringify({
          error: message,
          ...(code ? { code } : {}),
        }),
        { status, headers: CORS_HEADERS }
      );
    }
  },
};

async function transcribeAudioWorkersAI(audioFile, aiBinding, language) {
  try {
    const buffer = await audioFile.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(buffer);

    const result = await aiBinding.run('@cf/openai/whisper-large-v3-turbo', {
      audio: audioBase64,
      task: 'transcribe',
      language: language === 'ko' ? 'ko' : 'en',
      vad_filter: true,
    });

    return String(result?.text || '').trim();
  } catch (e) {
    const err = new Error('Speech transcription failed. Please try again.');
    err.status = 502;
    err.code = 'AI_TRANSCRIBE';
    throw err;
  }
}

async function correctGrammarViaProxy(transcript, language) {
  // Call external Vercel proxy function (US region, OpenAI won't block)
  const response = await fetch(VERCEL_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transcript,
      language,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Proxy failed: ${response.status} ${body.substring(0, 160)}`);
  }

  const data = await response.json();
  return {
    corrected_sentence: data.corrected_sentence || transcript,
    teacher_note: data.teacher_note || 'Good job!',
  };
}



function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    let chunkStr = '';
    for (let j = 0; j < chunk.length; j++) {
      chunkStr += String.fromCharCode(chunk[j]);
    }
    binary += chunkStr;
  }

  return btoa(binary);
}
