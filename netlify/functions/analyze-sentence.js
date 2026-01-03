/**
 * Netlify Function: analyze-sentence
 * 
 * Receives audio from student, transcribes via Whisper,
 * corrects grammar via GPT, returns JSON response.
 * 
 * This runs on AWS Lambda (US egress) so OpenAI region restrictions don't apply.
 */

const fetch = require('node-fetch');
const FormData = require('form-data');
const Busboy = require('busboy');

const OPENAI_API = process.env.OPENAI_API;

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Validate API key
    if (!OPENAI_API) {
      console.error('[analyze-sentence] OPENAI_API not set');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Parse multipart form data
    const { audioBuffer, audioFilename, audioMimeType } = await parseMultipart(event);

    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No audio file provided' })
      };
    }

    console.log(`[analyze-sentence] Received audio: ${audioFilename}, size: ${audioBuffer.length} bytes, type: ${audioMimeType}`);

    // Validate file size (max 25MB for Whisper)
    if (audioBuffer.length > 25 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Audio file too large (max 25MB)' })
      };
    }

    // Step 1: Transcribe with Whisper
    const transcript = await transcribeAudio(audioBuffer, audioFilename, audioMimeType);

    if (!transcript || transcript.trim() === '') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          transcript: '',
          corrected_sentence: '',
          teacher_note: 'No speech detected. Please try speaking louder or closer to the microphone.'
        })
      };
    }

    console.log(`[analyze-sentence] Transcript: "${transcript}"`);

    // Step 2: Correct grammar with GPT
    const correction = await correctGrammar(transcript);

    console.log(`[analyze-sentence] Correction:`, correction);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        transcript: transcript,
        corrected_sentence: correction.corrected_sentence || transcript,
        teacher_note: correction.teacher_note || 'Good job!'
      })
    };

  } catch (error) {
    console.error('[analyze-sentence] Error:', error);
    return {
      statusCode: error.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
        ...(error.code ? { code: error.code } : {})
      })
    };
  }
};

/**
 * Parse multipart form data from the request
 */
function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      reject(new Error('Expected multipart/form-data'));
      return;
    }

    const busboy = Busboy({ headers: { 'content-type': contentType } });
    const chunks = [];
    let audioFilename = 'audio.webm';
    let audioMimeType = 'audio/webm';

    busboy.on('file', (fieldname, file, info) => {
      if (fieldname === 'audio') {
        audioFilename = info.filename || 'audio.webm';
        audioMimeType = info.mimeType || 'audio/webm';
        file.on('data', (data) => chunks.push(data));
      } else {
        file.resume(); // Discard other files
      }
    });

    busboy.on('finish', () => {
      resolve({
        audioBuffer: Buffer.concat(chunks),
        audioFilename,
        audioMimeType
      });
    });

    busboy.on('error', reject);

    // Decode base64 if needed (Netlify sends base64-encoded body for binary)
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    busboy.end(body);
  });
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeAudio(audioBuffer, filename, mimeType) {
  // Determine proper filename extension
  let ext = 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'mp4';
  else if (mimeType.includes('ogg')) ext = 'ogg';
  else if (mimeType.includes('wav')) ext = 'wav';
  else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = 'mp3';

  const finalFilename = `audio.${ext}`;
  console.log(`[Whisper] Sending file: ${finalFilename}, type: ${mimeType}, size: ${audioBuffer.length}`);

  const form = new FormData();
  form.append('file', audioBuffer, {
    filename: finalFilename,
    contentType: mimeType
  });
  form.append('model', 'whisper-1');
  form.append('language', 'en');
  form.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API}`,
      ...form.getHeaders()
    },
    body: form
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Whisper] Error ${response.status}:`, errorText);

    const err = new Error(`Whisper transcription failed: ${response.status}`);
    err.status = response.status === 429 ? 429 : 502;
    err.code = 'WHISPER_ERROR';
    throw err;
  }

  const transcript = await response.text();
  return transcript.trim();
}

/**
 * Correct grammar using GPT
 */
async function correctGrammar(transcript) {
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
      'Authorization': `Bearer ${OPENAI_API}`,
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
    const err = new Error(`Grammar correction failed: ${response.status}`);
    err.status = 502;
    throw err;
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
