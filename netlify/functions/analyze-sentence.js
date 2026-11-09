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
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || 'willena-ttt-2026-dev';

const ALLOWED_ORIGINS = [
  'https://staging.willenaenglish.com',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'http://localhost:3000',
  'http://localhost:8000'
];

function getCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Secret, Authorization',
    'Content-Type': 'application/json'
  };
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  
  return headers;
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const corsHeaders = getCorsHeaders(origin);

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

  // STT lab is staff-only and deliberately bypasses grammar correction.
  // Keep the original student request path unchanged.
  if (event.queryStringParameters?.mode === 'stt-lab') {
    return handleSttLab(event, corsHeaders, origin);
  }

  // Validate X-Internal-Secret header
  const secret = event.headers['x-internal-secret'] || event.headers['X-Internal-Secret'];
  if (secret !== INTERNAL_SECRET) {
    console.warn('[analyze-sentence] Unauthorized: invalid or missing X-Internal-Secret');
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' })
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
          corrected: ''
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
        corrected: correction.corrected_sentence || transcript
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

/**
 * Staff-only speech transcription comparison. Every model receives the
 * same exact recording; no audio, transcripts or metrics are persisted.
 * Do not expose API credentials or allow arbitrary model names.
 */
async function handleSttLab(event, corsHeaders, origin) {
  const reply=(statusCode,body)=>({statusCode,headers:{...corsHeaders,'Cache-Control':'no-store'},body:JSON.stringify(body)});
  if(origin!=='https://teachers.willenaenglish.com'&&origin!=='https://willenaenglish.netlify.app'&&!origin.startsWith('http://localhost:'))return reply(403,{error:'Use Teachers Utilities to run this test.'});
  const auth=event.headers.authorization||event.headers.Authorization||'';
  const jwt=/^Bearer (.+)$/.exec(auth)?.[1];
  if(!jwt)return reply(401,{error:'Teacher login required.'});
  const url=process.env.SUPABASE_URL||'https://fiieuiktlsivwfgyivai.supabase.co';
  const key=process.env.SUPABASE_ANON_KEY||'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
  try{
    const me=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+jwt}});
    if(!me.ok)return reply(401,{error:'Teacher session expired. Sign in again.'});
    const user=await me.json();
    if(!user.id)return reply(401,{error:'Teacher authentication failed.'});
    const check=await fetch(url+'/rest/v1/profiles?id=eq.'+encodeURIComponent(user.id)+'&select=role,approved&limit=1',{headers:{apikey:key,Authorization:'Bearer '+jwt}});
    if(!check.ok)return reply(403,{error:'Teacher role could not be verified.'});
    const profile=(await check.json())[0];
    if(!profile?.approved||!['teacher','admin'].includes(profile.role))return reply(403,{error:'Staff access required.'});
    if(!OPENAI_API)return reply(503,{error:'STT service is not configured.'});
    const payload=JSON.parse(event.body||'{}');
    const raw=String(payload.audio||'');
    const mime=String(payload.mime||'audio/webm');
    if(!/^audio\/(webm|mp4|ogg|wav|mpeg|x-m4a)(;.*)?$/.test(mime))return reply(400,{error:'Unsupported audio format.'});
    if(raw.length>3_700_000)return reply(413,{error:'Recording too long. Keep each test under 20 seconds.'});
    const audioBuffer=Buffer.from(raw,'base64');
    if(!audioBuffer.length||audioBuffer.length>2_700_000)return reply(400,{error:'Audio recording missing or oversized.'});
    const models=['whisper-1','gpt-4o-mini-transcribe','gpt-4o-transcribe'];
    const ext=mime.includes('mp4')?'mp4':mime.includes('ogg')?'ogg':mime.includes('wav')?'wav':mime.includes('mpeg')?'mp3':'webm';
    const results=await Promise.all(models.map(async model=>{
      const t0=Date.now();
      try{
        const form=new FormData();
        form.append('file',audioBuffer,{filename:'sample.'+ext,contentType:mime.split(';')[0]});
        form.append('model',model);
        form.append('language','en');
        form.append('response_format',model==='whisper-1'?'text':'json');
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),30000);
        let response;
        try{response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+OPENAI_API,...form.getHeaders()},body:form,signal:controller.signal});}finally{clearTimeout(timeout)}
        if(!response.ok){const error=await response.text();throw Error(response.status===429?'Rate limited':response.status===400?'Model or audio rejected':'Service error '+response.status)}
        const transcript=model==='whisper-1'?await response.text():(await response.json()).text;
        return {model,transcript:String(transcript||'').trim(),latency_ms:Date.now()-t0};
      }catch(e){return {model,error:String(e.message||e).slice(0,130),latency_ms:Date.now()-t0}}
    }));
    return reply(200,{results});
  }catch(error){return reply(500,{error:'STT lab could not complete: '+String(error.message||error).slice(0,100)})}
}
