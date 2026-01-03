/**
 * Cloudflare Pages Function: /api/analyze-sentence
 * 
 * Receives audio from student, transcribes speech,
 * corrects grammar, returns JSON response.
 *
 * Preferred: Cloudflare Workers AI binding (env.AI) for ASR + correction.
 * Fallback: OpenAI (env.OPENAI_API / OPENAI_KEY / OPENAI_API_KEY).
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const cfDebug = {
    country: request.headers.get('CF-IPCountry') || request.cf?.country || null,
    colo: request.cf?.colo || null,
    asn: request.cf?.asn || null,
  };

  // ─────────────────────────────────────────────
  // CORS Headers
  // ─────────────────────────────────────────────
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // ─────────────────────────────────────────────
    // Validate AI Configuration
    // ─────────────────────────────────────────────
    const hasWorkersAI = !!env.AI;
    const openaiKey = env.OPENAI_API || env.OPENAI_KEY || env.OPENAI_API_KEY;
    if (!hasWorkersAI && !openaiKey) {
      console.error('[analyze-sentence] No AI configured (expected env.AI binding or OPENAI_API/OPENAI_KEY/OPENAI_API_KEY)');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // ─────────────────────────────────────────────
    // Parse Form Data
    // ─────────────────────────────────────────────
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[analyze-sentence] Received audio: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);
    console.log('[analyze-sentence] cf:', cfDebug);

    // Validate file size (max 25MB for Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Audio file too large (max 25MB)' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ─────────────────────────────────────────────
    // Step 1: Transcribe with Whisper
    // ─────────────────────────────────────────────
    const transcript = hasWorkersAI
      ? await transcribeAudioWorkersAI(audioFile, env.AI)
      : await transcribeAudioOpenAI(audioFile, openaiKey);
    
    if (!transcript || transcript.trim() === '') {
      return new Response(
        JSON.stringify({ 
          transcript: '',
          corrected_sentence: '',
          teacher_note: 'No speech detected. Please try speaking louder or closer to the microphone.'
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`[analyze-sentence] Transcript: "${transcript}"`);

    // ─────────────────────────────────────────────
    // Step 2: Correct Grammar with GPT
    // ─────────────────────────────────────────────
    const correction = hasWorkersAI
      ? await correctGrammarWorkersAI(transcript, env.AI)
      : await correctGrammarOpenAI(transcript, openaiKey);

    console.log(`[analyze-sentence] Correction:`, correction);

    // ─────────────────────────────────────────────
    // Return Response
    // ─────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        transcript: transcript,
        corrected_sentence: correction.corrected_sentence || transcript,
        teacher_note: correction.teacher_note || 'Good job!'
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    const status = Number(error?.status) || 500;
    const code = error?.code || undefined;
    const message = error?.message || 'Internal server error';

    console.error('[analyze-sentence] Error:', { status, code, message });

    // Only include cfDebug for region-related failures (helps diagnose ISP/device routing differences)
    const includeCf = code === 'UNSUPPORTED_REGION';

    return new Response(
      JSON.stringify({
        error: message,
        ...(code ? { code } : {}),
        ...(includeCf ? { cf: cfDebug } : {}),
      }),
      { status, headers: corsHeaders }
    );
  }
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// ─────────────────────────────────────────────
// Whisper Transcription
// ─────────────────────────────────────────────
async function transcribeAudioWorkersAI(audioFile, aiBinding) {
  try {
    // @cf/openai/whisper-large-v3-turbo expects base64-encoded audio bytes.
    const buffer = await audioFile.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(buffer);

    const result = await aiBinding.run('@cf/openai/whisper-large-v3-turbo', {
      audio: audioBase64,
      task: 'transcribe',
      language: 'en',
      vad_filter: true,
    });

    const transcript = result?.text || '';
    return String(transcript).trim();
  } catch (e) {
    console.error('[WorkersAI][Whisper] Error:', e?.message || e);
    const err = new Error('Speech transcription failed. Please try again.');
    err.status = 502;
    err.code = 'AI_TRANSCRIBE';
    throw err;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  // Avoid spreading large arrays into String.fromCharCode (can throw on some runtimes).
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

async function transcribeAudioOpenAI(audioFile, apiKey) {
  // Determine proper filename extension based on content type
  let filename = audioFile.name || 'audio.webm';
  const contentType = audioFile.type || '';
  
  // Map content types to proper extensions that Whisper accepts
  if (contentType.includes('webm')) {
    filename = 'audio.webm';
  } else if (contentType.includes('mp4') || contentType.includes('m4a')) {
    filename = 'audio.mp4';
  } else if (contentType.includes('ogg')) {
    filename = 'audio.ogg';
  } else if (contentType.includes('wav')) {
    filename = 'audio.wav';
  } else if (contentType.includes('mpeg') || contentType.includes('mp3')) {
    filename = 'audio.mp3';
  }
  
  console.log(`[Whisper] Sending file: ${filename}, type: ${contentType}, size: ${audioFile.size}`);
  
  const formData = new FormData();
  formData.append('file', audioFile, filename);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Whisper] Error ${response.status}:`, errorText);
    
    // Provide more specific error messages
    if (response.status === 403) {
      let errorDetail = 'Access denied';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorDetail;
      } catch {
        errorDetail = errorText.substring(0, 140);
      }

      // This is the specific case you're seeing: OpenAI blocks based on request origin IP geography.
      // On Cloudflare, the origin IP is the Worker egress (can vary by device/ISP due to different colos).
      if (/Country, region, or territory not supported/i.test(errorDetail)) {
        const err = new Error(`Whisper transcription failed: ${response.status} - ${errorDetail}`);
        err.status = 503;
        err.code = 'UNSUPPORTED_REGION';
        throw err;
      }

      const err = new Error(`Whisper transcription failed: ${response.status} - ${errorDetail}`);
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (response.status === 400) {
      const err = new Error('Audio format not supported. Please try a different browser.');
      err.status = 400;
      err.code = 'BAD_AUDIO_FORMAT';
      throw err;
    }

    if (response.status === 401) {
      const err = new Error('API authentication error. Please contact support.');
      err.status = 500;
      err.code = 'OPENAI_AUTH';
      throw err;
    }

    if (response.status === 429) {
      const err = new Error('Too many requests. Please wait a moment and try again.');
      err.status = 429;
      err.code = 'RATE_LIMIT';
      throw err;
    }

    const err = new Error(`Whisper transcription failed: ${response.status}`);
    err.status = 502;
    err.code = 'WHISPER_ERROR';
    throw err;
  }

  const transcript = await response.text();
  return transcript.trim();
}

// ─────────────────────────────────────────────
// GPT Grammar Correction
// ─────────────────────────────────────────────
async function correctGrammarWorkersAI(transcript, aiBinding) {
  const systemPrompt = `You are a friendly English teacher for elementary students (ages 6-12).
Your job is to correct the student's spoken sentence.

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
    const result = await aiBinding.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Student said: "${transcript}"` }
      ],
      temperature: 0.2,
      max_tokens: 220
      // Note: Cloudflare Llama doesn't support json_object, only json_schema; omit for now.
    });

    const content = result?.response;
    if (!content) {
      return { corrected_sentence: transcript, teacher_note: 'Good job!' };
    }

    try {
      return JSON.parse(content);
    } catch (e) {
      console.error('[WorkersAI][Llama] JSON parse error:', e, 'Content:', content);
      return { corrected_sentence: transcript, teacher_note: 'Good job!' };
    }
  } catch (e) {
    console.error('[WorkersAI][Llama] Error:', e);
    const err = new Error('Grammar correction failed. Please try again.');
    err.status = 502;
    err.code = 'AI_CORRECT';
    throw err;
  }
}

async function correctGrammarOpenAI(transcript, apiKey) {
  const systemPrompt = `You are a friendly English teacher for elementary students (ages 6-12).
Your job is to correct the student's spoken sentence.

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
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Student said: "${transcript}"` }
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GPT] Error response:', errorText);
    throw new Error(`Grammar correction failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return { corrected_sentence: transcript, teacher_note: 'Good try!' };
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('[GPT] JSON parse error:', e, 'Content:', content);
    return { corrected_sentence: transcript, teacher_note: 'Good try!' };
  }
}
