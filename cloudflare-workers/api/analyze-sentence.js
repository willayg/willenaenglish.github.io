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
    const openaiKey = env.OPENAI_API || env.OPENAI_KEY || env.OPENAI_API_KEY;
    const hasWorkersAI = !!env.AI;
    const useOpenAI = !!openaiKey;
    
    if (!useOpenAI && !hasWorkersAI) {
      console.error('[analyze-sentence] No AI configured (expected env.AI binding or OPENAI_API/OPENAI_KEY/OPENAI_API_KEY)');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    console.log(`[analyze-sentence] Using ${useOpenAI ? 'OpenAI (gpt-4o-mini)' : 'Workers AI (Llama)'} for grammar correction`);

    // ─────────────────────────────────────────────
    // Parse Form Data
    // ─────────────────────────────────────────────
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    const language = formData.get('language') || 'en';

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
    // Always use Workers AI for transcription to avoid OpenAI regional blocks
    const transcript = await transcribeAudioWorkersAI(audioFile, env.AI);
    
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
    let correction;
    if (useOpenAI) {
      try {
        correction = await correctGrammarOpenAI(transcript, openaiKey, language);
      } catch (err) {
        // If OpenAI is blocked by region, try Netlify proxy (US-based)
        if (err.code === 'UNSUPPORTED_REGION' || err.code === 'FORBIDDEN') {
          console.warn('[analyze-sentence] OpenAI blocked, trying Netlify proxy');
          try {
            correction = await correctGrammarNetlifyProxy(transcript, openaiKey, language, env.NETLIFY_URL);
          } catch (proxyErr) {
            console.warn('[analyze-sentence] Netlify proxy also failed, falling back to Workers AI');
            correction = await correctGrammarWorkersAI(transcript, env.AI, language);
          }
        } else {
          throw err;
        }
      }
    } else {
      correction = await correctGrammarWorkersAI(transcript, env.AI, language);
    }

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

function getEnglishPrompt() {
  return `You are an ESL grammar checker for children (ages 6–12).

TASK:
Check the student sentence.
• If it has a clear grammar error, fix ONLY that error.
• If it is already grammatically correct, do NOT change it.

WHAT COUNTS AS A GRAMMAR ERROR (ONLY these):
• Missing helping verb (She eating → She is eating)
• Wrong verb form (He go → He goes)
• Subject–verb disagreement (They was → They were)
• Missing article that changes meaning (I saw dog → I saw a dog)
• Missing possessive apostrophe (my grandma house → my grandma's house)

WHAT IS NOT A GRAMMAR ERROR:
• Contractions (I'm, she's, don't, can't, etc.)
• Informal but correct English
• Different word choices with the same meaning
• Natural, complete sentences

IMPORTANT RULES:
• Do NOT change tense unless it is clearly wrong
• Do NOT add or remove meaning
• Do NOT rewrite the sentence
• If more than one correction is possible, choose the one closest to the original
• If unsure, do NOT correct

OUTPUT (STRICT JSON ONLY):
{
  "corrected_sentence": "original or corrected sentence",
  "teacher_note": "Perfect! Your sentence is correct!"
}

If you make a correction:
• Keep the corrected sentence as close as possible to the original
• Replace teacher_note with numbered points explaining ONLY what was fixed
• Explanations must be short and child-friendly`
}

function getKoreanPrompt() {
  return `You are an English ESL grammar checker for Korean-speaking children (ages 6–12).

과제:
학생의 영문을 확인하세요.
• 명확한 문법 오류가 있으면 그 오류만 수정하세요.
• 이미 문법적으로 올바르면 변경하지 마세요.

수정할 문법 오류 (이것만):
• 조동사 누락 (She eating → She is eating)
• 잘못된 동사 형태 (He go → He goes)
• 주어-동사 불일치 (They was → They were)
• 관사 누락으로 의미가 바뀌는 경우 (I saw dog → I saw a dog)
• 소유격 아포스트로피 누락 (my grandma house → my grandma's house)

수정하지 말아야 할 것:
• 축약형 (I'm, she's, don't, can't, 등)
• 비공식적이지만 올바른 영어
• 같은 의미의 다른 단어 선택
• 자연스럽고 완전한 문장

중요한 규칙:
• 명확히 틀린 경우가 아니면 시제를 바꾸지 마세요
• 의미를 추가하거나 제거하지 마세요
• 문장을 다시 쓰지 마세요
• 여러 수정이 가능한 경우 원문과 가장 가까운 것을 선택하세요
• 확실하지 않으면 수정하지 마세요

출력 (순수 JSON만):
{
  "corrected_sentence": "원본 또는 수정된 문장 (영문만)",
  "teacher_note": "완벽해요! 이 문장은 올바릅니다!"
}

수정이 필요한 경우:
• corrected_sentence는 항상 영문입니다
• teacher_note를 수정된 내용만 설명하는 번호 항목으로 바꾸세요 (한국어)
• 각 오류를 구체적으로 설명하세요 (예: "조동사 누락 - 'is eating'으로 수정")
• 설명은 간단하고 아이 친화적이어야 합니다`
}

async function correctGrammarWorkersAI(transcript, aiBinding, language = 'en') {
  const systemPrompt = language === 'ko' ? getKoreanPrompt() : getEnglishPrompt();

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

async function correctGrammarOpenAI(transcript, apiKey, language = 'en') {
  const systemPrompt = language === 'ko' ? getKoreanPrompt() : getEnglishPrompt();

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
    console.error('[GPT] Error response:', response.status, errorText);
    
    // Check if this is a regional block
    if (response.status === 403) {
      let errorDetail = 'Access denied';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorDetail;
      } catch {}
      
      if (/Country, region, or territory not supported/i.test(errorDetail)) {
        const err = new Error(`OpenAI blocked in this region`);
        err.status = 403;
        err.code = 'UNSUPPORTED_REGION';
        throw err;
      }
    }
    
    throw new Error(`Grammar correction failed: ${response.status} - ${errorText.substring(0, 100)}`);
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

async function correctGrammarNetlifyProxy(transcript, apiKey, language = 'en', netlifyUrl) {
  const proxyUrl = netlifyUrl || 'https://willenaenglish.com';
  
  const response = await fetch(`${proxyUrl}/.netlify/functions/openai-grammar-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transcript,
      language,
      apiKey
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Netlify Proxy] Error response:', response.status, errorText);
    throw new Error(`Netlify proxy failed: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
