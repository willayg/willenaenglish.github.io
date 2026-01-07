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
    // Prefer Workers AI to avoid OpenAI region restrictions (especially important for non-US regions)
    const preferOpenAI = env.PREFER_OPENAI === 'true' || env.USE_OPENAI === 'true';
    const hasWorkersAI = !!env.AI;
    const openaiKey = env.OPENAI_API || env.OPENAI_KEY || env.OPENAI_API_KEY;
    
    // If Workers AI is available, use it (avoids region blocking from OpenAI)
    // Only fall back to OpenAI if Workers AI is explicitly disabled
    const useWorkersAI = hasWorkersAI && !preferOpenAI;
    
    if (!useWorkersAI && !openaiKey) {
      console.error('[analyze-sentence] No AI configured (expected env.AI binding or OPENAI_API/OPENAI_KEY/OPENAI_API_KEY)');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    console.log(`[analyze-sentence] Using ${useWorkersAI ? 'Workers AI (Llama)' : 'OpenAI (GPT)'} for correction`);

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

    const language = formData.get('language') || 'en';
    console.log(`[analyze-sentence] Language requested: ${language}`);

    // ─────────────────────────────────────────────
    // Step 1: Transcribe with Whisper
    // ─────────────────────────────────────────────
    let transcript;
    try {
      transcript = useWorkersAI
        ? await transcribeAudioWorkersAI(audioFile, env.AI)
        : await transcribeAudioOpenAI(audioFile, openaiKey);
    } catch (err) {
      throw err;
    }
    
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
    const correction = useWorkersAI
      ? await correctGrammarWorkersAI(transcript, env.AI, language)
      : await correctGrammarOpenAI(transcript, openaiKey, language);

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
async function correctGrammarWorkersAI(transcript, aiBinding, language = 'en') {
  const langInstruction = language === 'ko' 
    ? 'IMPORTANT: You MUST write the teacher_note entirely in Korean (한국어). Do NOT use English in the teacher_note.'
    : 'Write the teacher_note in English.';

  const systemPrompt = `You are a friendly English teacher for elementary students (ages 6-12).
Your job is to ONLY fix ACTUAL grammar errors in the student's spoken sentence.

${langInstruction}

CRITICAL - WHAT IS NOT AN ERROR (do NOT correct these):
- Contractions (she's, I'm, don't, isn't, can't, won't, he's, they're, etc.) are CORRECT
- Different word choices that mean the same thing (wrong vs right, good vs nice, etc.)
- Informal but correct phrasing
- Complete sentences that sound natural

ONLY FIX THESE ACTUAL ERRORS:
- Missing helping verb: "She eating pizza" → "She is eating pizza"
- Wrong verb form: "He go home" → "He goes home"
- Missing article where required: "I saw dog" → "I saw a dog"
- Clear subject-verb disagreement: "They was happy" → "They were happy"
- Missing possessive apostrophe: "my grandma house" → "my grandma's house"

STRICT RULES:
1. If the sentence is grammatically correct, return it UNCHANGED - even if you could say it differently
2. NEVER change the meaning or main words
3. NEVER correct contractions - they are correct
4. NEVER change style or word choice
5. When in doubt, do NOT correct it

OUTPUT FORMAT (strict JSON only, no markdown):
{
  "corrected_sentence": "the corrected sentence here (or original if correct)",
  "teacher_note": "${language === 'ko' ? '한국어로 번호가 매겨진 포인트만. 예: 1. go 대신 과거형 went를 사용하세요.' : 'NUMBERED POINTS ONLY in English. Example: 1. Use past tense went instead of go.'}"
}

If NO changes needed, return teacher_note as: "${language === 'ko' ? '완벽해요! 문장이 맞아요!' : 'Perfect! Your sentence is correct!'}"
If changes were made, explain each fix as a numbered point ${language === 'ko' ? 'IN KOREAN' : 'in English'}.`;

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
      return sanitizeCorrection({ corrected_sentence: transcript, teacher_note: 'Good job!' }, transcript);
    }

    try {
      const parsed = JSON.parse(content);
      return sanitizeCorrection(parsed, transcript);
    } catch (e) {
      console.error('[WorkersAI][Llama] JSON parse error:', e, 'Content:', content);
      return sanitizeCorrection({ corrected_sentence: transcript, teacher_note: 'Good job!' }, transcript);
    }
  } catch (e) {
    console.error('[WorkersAI][Llama] Error:', e);
    const err = new Error('Grammar correction failed. Please try again.');
    err.status = 502;
    err.code = 'AI_CORRECT';
    throw err;
  }
}

async function correctGrammarOpenAI(transcript, apiKey, language = 'en') {
  const langInstruction = language === 'ko' 
    ? 'IMPORTANT: You MUST write the teacher_note entirely in Korean (한국어). Do NOT use English in the teacher_note.'
    : 'Write the teacher_note in English.';

  const systemPrompt = `You are a friendly English teacher for elementary students (ages 6-12).
Your job is to ONLY fix ACTUAL grammar errors in the student's spoken sentence.

${langInstruction}

CRITICAL - WHAT IS NOT AN ERROR (do NOT correct these):
- Contractions (she's, I'm, don't, isn't, can't, won't, he's, they're, etc.) are CORRECT
- Different word choices that mean the same thing (wrong vs right, good vs nice, etc.)
- Informal but correct phrasing
- Complete sentences that sound natural

ONLY FIX THESE ACTUAL ERRORS:
- Missing helping verb: "She eating pizza" → "She is eating pizza"
- Wrong verb form: "He go home" → "He goes home"
- Missing article where required: "I saw dog" → "I saw a dog"
- Clear subject-verb disagreement: "They was happy" → "They were happy"
- Missing possessive apostrophe: "my grandma house" → "my grandma's house"

STRICT RULES:
1. If the sentence is grammatically correct, return it UNCHANGED - even if you could say it differently
2. NEVER change the meaning or main words
3. NEVER correct contractions - they are correct
4. NEVER change style or word choice
5. When in doubt, do NOT correct it

OUTPUT FORMAT (strict JSON only, no markdown):
{
  "corrected_sentence": "the corrected sentence here (or original if correct)",
  "teacher_note": "${language === 'ko' ? '한국어로 번호가 매겨진 포인트만. 예: 1. go 대신 과거형 went를 사용하세요.' : 'NUMBERED POINTS ONLY in English. Example: 1. Use past tense went instead of go.'}"
}

If NO changes needed, return teacher_note as: "${language === 'ko' ? '완벽해요! 문장이 맞아요!' : 'Perfect! Your sentence is correct!'}"
If changes were made, explain each fix as a numbered point ${language === 'ko' ? 'IN KOREAN' : 'in English'}.`;

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
    return sanitizeCorrection({ corrected_sentence: transcript, teacher_note: 'Good try!' }, transcript);
  }

  try {
    const parsed = JSON.parse(content);
    return sanitizeCorrection(parsed, transcript);
  } catch (e) {
    console.error('[GPT] JSON parse error:', e, 'Content:', content);
    return sanitizeCorrection({ corrected_sentence: transcript, teacher_note: 'Good try!' }, transcript);
  }
}

// -----------------
// Post-processing helpers
// -----------------
function sanitizeCorrection(obj, originalTranscript) {
  const out = { corrected_sentence: String(obj.corrected_sentence || originalTranscript).trim() };

  let note = String(obj.teacher_note || '').trim();

  // If the model returned no note or something too short, provide a friendly fallback
  if (!note || note.length < 6) {
    note = generateFallbackNote(originalTranscript, out.corrected_sentence);
  }

  // Replace technical grammar jargon with simple phrasing
  note = note.replace(/present participle|participle|auxiliary verb|auxiliary/gi,
    "a small helper word like 'is' or 'are'");

  // Reduce phrasing like "We need to use" -> "Use"
  note = note.replace(/\bWe (need to use|usually add)\b/gi, 'Use');
  note = note.replace(/\bYou should use\b/gi, 'Use');

  // Trim to a reasonable length for kids
  if (note.length > 140) note = note.slice(0, 137) + '...';

  // Ensure capitalization and punctuation
  note = note.charAt(0).toUpperCase() + note.slice(1);
  if (!/[.!?]$/.test(note)) note += '.';

  out.teacher_note = note;
  return out;
}

function generateFallbackNote(original, corrected) {
  try {
    const o = original.toLowerCase();
    const c = corrected.toLowerCase();

    // If corrected adds ' is ' or ' are ', explain helper word
    if ((/\bis\b/.test(c) || /\bare\b/.test(c)) && !(/\bis\b/.test(o) || /\bare\b/.test(o))) {
      return `Use 'is' or 'are' to show the action is happening now. Try: "${corrected}"`;
    }

    // If corrected added an ending 's' for plural
    if (c.replace(/[^a-z ]/g, '') !== o.replace(/[^a-z ]/g, '') && c.includes('s') && !o.includes('s')) {
      return `We changed the word to make it correct. Try: "${corrected}"`;
    }

    // Default encouraging fallback
    return `Try: "${corrected}". Good job!`;
  } catch (e) {
    return 'Good job!';
  }
}
