/**
 * Cloudflare Worker: analyze-sentence
 *
 * Route this worker to: https://staging.willenaenglish.com/api/analyze-sentence
 *
 * Strategy:
 * - ASR (Whisper): Uses @cf/openai/whisper-large-v3-turbo (Workers AI) — no region block
 * - Grammar Correction:
 *   1. Try OpenAI GPT directly (env.OPENAI_API)
 *   2. If OpenAI returns 403 "unsupported region", fall back to external Vercel proxy
 *   3. Otherwise use Llama fallback
 *
 * This allows GPT-quality feedback without geo restrictions.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Vercel proxy endpoint (handles OpenAI calls from US region)
const VERCEL_PROXY_URL = 'https://willenaenglish-github-io.vercel.app/api/analyze-sentence';

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

      const correction = await correctGrammar(transcript, env, language);

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

async function correctGrammar(transcript, env, language) {
  const openaiKey = env.OPENAI_API || env.OPENAI_KEY || env.OPENAI_API_KEY;

  // Try OpenAI first if configured (best quality feedback)
  if (openaiKey) {
    try {
      return await correctGrammarOpenAI(transcript, openaiKey, language);
    } catch (e) {
      // If OpenAI blocks due to region, fall back to Vercel proxy (US egress)
      if (e?.code === 'UNSUPPORTED_REGION') {
        console.warn('[analyze-sentence] OpenAI blocked by region, falling back to Vercel proxy');
        try {
          return await correctGrammarViaProxy(transcript, language);
        } catch (fallbackErr) {
          console.error('[analyze-sentence] Vercel proxy failed:', fallbackErr?.message);
          // If proxy also fails, use Llama as last resort
          return await correctGrammarWorkersAI(transcript, env.AI, language);
        }
      }
      // If it's a different OpenAI error, try Llama instead of failing
      console.warn('[analyze-sentence] OpenAI error, using Llama fallback:', e?.message);
      return await correctGrammarWorkersAI(transcript, env.AI, language);
    }
  }

  // No OpenAI configured, use Llama
  return await correctGrammarWorkersAI(transcript, env.AI, language);
}

async function correctGrammarOpenAI(transcript, apiKey, language) {
  const systemPrompt = `You are a friendly English teacher for elementary students (ages 6-12).
Your job is to correct the student's spoken English sentence.

RULES:
1. ONLY fix grammar, tense, plurals, articles, and missing words
2. Do NOT add new ideas or information
3. Do NOT change the meaning of the sentence
4. Keep corrections simple and age-appropriate
5. If the sentence is already correct, return it unchanged

OUTPUT FORMAT (strict JSON only, no markdown):
{
  "corrected_sentence": "the corrected sentence here",
  "teacher_note": "brief, encouraging explanation of what was fixed (1-2 sentences max)"
}

If no changes needed, set teacher_note to "Perfect! Your sentence is correct!"`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Student said: "${transcript}"` },
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403) {
      let errorDetail = 'Forbidden';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorDetail;
      } catch {}

      if (/Country, region, or territory not supported/i.test(errorDetail)) {
        const err = new Error(`OpenAI blocked by region: ${errorDetail}`);
        err.status = 403;
        err.code = 'UNSUPPORTED_REGION';
        throw err;
      }
    }

    throw new Error(`OpenAI error: ${response.status} - ${errorText.substring(0, 180)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return { corrected_sentence: transcript, teacher_note: 'Good job!' };

  try {
    return JSON.parse(content);
  } catch {
    return { corrected_sentence: transcript, teacher_note: 'Good job!' };
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
    throw new Error(`Vercel proxy failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    corrected_sentence: data.corrected_sentence || transcript,
    teacher_note: data.teacher_note || 'Good job!',
  };
}

async function correctGrammarWorkersAI(transcript, aiBinding, language) {
  const systemPrompt = `You are a friendly English teacher for elementary students (ages 6-12).
Your job is to correct the student's spoken English sentence.

RULES:
1. ONLY fix grammar, tense, plurals, articles, and missing words
2. Do NOT add new ideas or information
3. Do NOT change the meaning of the sentence
4. Keep corrections simple and age-appropriate
5. If the sentence is already correct, return it unchanged

OUTPUT FORMAT (strict JSON only, no markdown):
{
  "corrected_sentence": "the corrected sentence here",
  "teacher_note": "brief, encouraging explanation of what was fixed (1-2 sentences max)"
}

If no changes needed, set teacher_note to "Perfect! Your sentence is correct!"`;

  try {
    const userContent =
      language === 'ko'
        ? `학생이 말한 영어 문장: "${transcript}"\n(설명은 영어로만 작성)`
        : `Student said: "${transcript}"`;

    const result = await aiBinding.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 220,
    });

    const content = result?.response;
    if (!content) return { corrected_sentence: transcript, teacher_note: 'Good job!' };

    try {
      return JSON.parse(content);
    } catch {
      return { corrected_sentence: transcript, teacher_note: 'Good job!' };
    }
  } catch (e) {
    const err = new Error('Grammar correction failed. Please try again.');
    err.status = 502;
    err.code = 'AI_CORRECT';
    throw err;
  }
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
