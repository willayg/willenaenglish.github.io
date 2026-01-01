/**
 * Cloudflare Pages Function: /api/analyze-sentence
 * 
 * Receives audio from student, transcribes via Whisper,
 * corrects grammar via GPT, returns JSON response.
 * 
 * Environment variable required: OPENAI_API (set in Cloudflare Pages)
 */

export async function onRequestPost(context) {
  const { request, env } = context;

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
    // Validate API Key
    // ─────────────────────────────────────────────
    const openaiKey = env.OPENAI_API;
    if (!openaiKey) {
      console.error('[analyze-sentence] OPENAI_API not set');
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
    const transcript = await transcribeAudio(audioFile, openaiKey);
    
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
    const correction = await correctGrammar(transcript, openaiKey);

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
    console.error('[analyze-sentence] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
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
async function transcribeAudio(audioFile, apiKey) {
  const formData = new FormData();
  formData.append('file', audioFile, audioFile.name || 'audio.webm');
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
    console.error('[Whisper] Error response:', errorText);
    throw new Error(`Whisper transcription failed: ${response.status}`);
  }

  const transcript = await response.text();
  return transcript.trim();
}

// ─────────────────────────────────────────────
// GPT Grammar Correction
// ─────────────────────────────────────────────
async function correctGrammar(transcript, apiKey) {
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
