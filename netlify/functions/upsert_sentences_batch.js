const { S3Client, HeadObjectCommand, CopyObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
// NOTE: @supabase/supabase-js v2 is ESM-only. We must import dynamically INSIDE the handler
// to avoid ERR_REQUIRE_ESM in Netlify's CommonJS function runtime.

/*
Upsert Sentences Batch
Request body:
{
  action: 'upsert_sentences_batch',
  sentences: [ { text: 'I run every day.', words:['run','day'] }, ... ],
  voice_id?: 'override_voice'
}
Response:
{ success:true, sentences:[ { text, id } ], audio: { generated: n, reused: m } }

Behavior:
1. For each sentence text, normalize (trim + collapse spaces).
2. Check existing row in sentences (case-insensitive exact match on normalized text).
3. Insert if missing (id returned).
4. Link words if provided via word_sentences (ignore duplicates).
5. Ensure audio file in R2 named sent_<id>.mp3:
   - If exists => reuse.
   - Else call Eleven Labs proxy (internal function) to synthesize then upload.
Env required: SUPABASE_URL, SUPABASE_SERVICE_KEY (for RLS bypass), R2_* vars, ELEVEN_LABS_DEFAULT_VOICE_ID
*/

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const body = JSON.parse(event.body||'{}');
    if (body.action !== 'upsert_sentences_batch') return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid action' }) };
    const list = Array.isArray(body.sentences) ? body.sentences : [];
    if (!list.length) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'No sentences' }) };
    console.log('[upsert_sentences_batch] start', { rawCount: list.length });
    // Dynamic import supabase client here
    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[upsert_sentences_batch] missing Supabase env', { hasUrl: !!SUPABASE_URL, hasService: !!SUPABASE_SERVICE_KEY });
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Missing Supabase service env vars' }) };
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken:false, persistSession:false } });

    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
    const R2_ENDPOINT = process.env.R2_ENDPOINT;
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKETNAME;
    const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE || '';
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME){
      return { statusCode:500, headers:cors, body: JSON.stringify({ error:'Missing R2 env vars' }) };
    }
    const s3 = new S3Client({ region:'auto', endpoint:R2_ENDPOINT, forcePathStyle:true, credentials:{ accessKeyId:R2_ACCESS_KEY_ID, secretAccessKey:R2_SECRET_ACCESS_KEY } });

    // 1. Normalize & dedupe sentences
    const norm = s => s.trim().replace(/\s+/g,' ');
    const unique = [];
    const seen = new Set();
    let skippedShort = 0;
    for (const s of list){
      if(!s || !s.text) continue;
      const n = norm(String(s.text));
      if(n.split(/\s+/).length < 3){ skippedShort++; continue; }
      if(!seen.has(n.toLowerCase())){ seen.add(n.toLowerCase()); unique.push({ text:n, words: Array.isArray(s.words)? s.words.filter(Boolean) : [] }); }
    }
    console.log('[upsert_sentences_batch] normalized', { unique: unique.length, skippedShort });
    if(!unique.length) return { statusCode:200, headers:cors, body: JSON.stringify({ success:true, sentences:[], info:{ skippedShort } }) };

  const out = [];
  const audioStatus = []; // will collect per-sentence audio attempt result
    for (const entry of unique){
      try {
        // 2. Try existing (exact = eq) first for speed, then fallback to ilike if needed
        let id = null; let audio_key = null;
        let existingSel = await supabase
          .from('sentences')
          .select('id, text, audio_key')
          .eq('text', entry.text)
          .limit(1);
        if(existingSel.error){
          console.warn('[upsert_sentences_batch] eq select failed, falling back to ilike', existingSel.error.message);
          existingSel = await supabase
            .from('sentences')
            .select('id, text, audio_key')
            .ilike('text', entry.text)
            .limit(1);
        }
        if(!existingSel.error && existingSel.data && existingSel.data[0]){
          id = existingSel.data[0].id; audio_key = existingSel.data[0].audio_key || null;
          console.log('[upsert_sentences_batch] reuse sentence', { id });
        }
        if(!id){
          const ins = await supabase
            .from('sentences')
            .insert({ text: entry.text })
            .select('id, audio_key')
            .single();
          if(ins.error){ console.error('[upsert_sentences_batch] insert failed', ins.error.message); continue; }
            id = ins.data.id; audio_key = ins.data.audio_key || null;
          console.log('[upsert_sentences_batch] inserted sentence', { id });
        }
        // 3. Link words (ignore word-level failures but log)
        if (entry.words && entry.words.length){
          for (const w of entry.words){
            const link = await supabase.from('word_sentences').upsert({ word:w, sentence_id:id }, { onConflict:'word,sentence_id' });
            if(link.error){ console.warn('[upsert_sentences_batch] link failed', { word:w, id, err: link.error.message }); }
          }
        }
        out.push({ text: entry.text, id, audio_key });
      } catch(inner){
        console.error('[upsert_sentences_batch] sentence loop error', inner.message);
      }
    }

  // 4. Ensure audio for each sentence (parallel with modest concurrency)
  // Allow caller to skip audio generation for faster non-blocking linking (e.g., live game launch)
  const WANT_AUDIO = !body.skip_audio; // skip when truthy
    let generated = 0, reused = 0, failed = 0;

    async function hasObject(key){
      try { await s3.send(new HeadObjectCommand({ Bucket:R2_BUCKET_NAME, Key:key })); return true; } catch { return false; }
    }
    async function putObject(key, buf){
      await s3.send(new PutObjectCommand({ Bucket:R2_BUCKET_NAME, Key:key, Body:buf, ContentType:'audio/mpeg', CacheControl:'public, max-age=31536000, immutable' }));
    }
    const voiceId = body.voice_id || process.env.ELEVEN_LABS_DEFAULT_VOICE_ID;

    async function synthAndStore(sentObj){
      const key = `sent_${sentObj.id}.mp3`;
      let stage = 'start';
      try {
        const exists = await hasObject(key);
        if(exists){
          reused++;
          audioStatus.push({ id: sentObj.id, key, action: 'reused' });
          return;
        }
        stage = 'fetch-proxy';
        let proxyUrl = process.env.INTERNAL_ELEVEN_LABS_URL;
        if(!proxyUrl){
          const site = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
          proxyUrl = site ? site.replace(/\/$/,'') + '/.netlify/functions/eleven_labs_proxy' : '/.netlify/functions/eleven_labs_proxy';
        }
        const proxyBody = { text: sentObj.text, voice_id: voiceId };
        // Allow caller to select Eleven Labs model explicitly via request body
        if (body.model_id && typeof body.model_id === 'string') proxyBody.model_id = body.model_id;
        // Optional voice_settings passthrough if provided
        if (body.voice_settings && typeof body.voice_settings === 'object') proxyBody.voice_settings = body.voice_settings;
        const tRes = await fetch(proxyUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(proxyBody) });
        let js = null;
        try { js = await tRes.json(); } catch(parseErr){ /* keep null for diagnostics */ }
        if(!tRes.ok){
          failed++;
          audioStatus.push({ id: sentObj.id, key, action:'failed', stage, status: tRes.status, statusText: tRes.statusText });
          return;
        }
        if(!js || !js.audio){
          failed++;
          audioStatus.push({ id: sentObj.id, key, action:'failed', stage:'no-audio', note: 'proxy ok but missing audio field' });
          return;
        }
        stage = 'put-object';
        const buf = Buffer.from(js.audio, 'base64');
        await putObject(key, buf);
        generated++;
        // Opportunistic update of audio_key if not already set
        if(!sentObj.audio_key){
          const upd = await supabase.from('sentences').update({ audio_key: key }).eq('id', sentObj.id);
          if(upd.error){ console.warn('[upsert_sentences_batch] audio_key update failed', { id: sentObj.id, err: upd.error.message }); }
          sentObj.audio_key = key;
        }
        audioStatus.push({ id: sentObj.id, key, action:'generated' });
      } catch(e){
        failed++;
        audioStatus.push({ id: sentObj.id, key, action:'failed', stage, error: e.message });
        console.error('Sentence synth fail', e.message);
      }
    }

    if (WANT_AUDIO){
      const conc = 3;
      let i=0; async function worker(){ while(i<out.length){ const idx = i++; await synthAndStore(out[idx]); } }
      await Promise.all(Array.from({length: Math.min(conc,out.length)}, ()=>worker()));
    }

    return { statusCode:200, headers:cors, body: JSON.stringify({ 
      success:true,
      sentences: out,
      audio:{ generated, reused, failed },
      audio_status: audioStatus,
      env: {
        hasR2Access: !!R2_ACCESS_KEY_ID,
        hasR2Secret: !!R2_SECRET_ACCESS_KEY,
        hasR2Endpoint: !!R2_ENDPOINT,
        hasR2Bucket: !!R2_BUCKET_NAME,
        hasVoice: !!voiceId,
        hasElevenKey: !!process.env.ELEVEN_LABS_API_KEY,
        site: process.env.URL || process.env.DEPLOY_PRIME_URL || null
      },
      meta:{ skippedShort }
    }) };
  } catch(e){
    console.error(e);
    return { statusCode:500, headers:cors, body: JSON.stringify({ error:'upsert_sentences_batch failed', details:e.message }) };
  }
};
