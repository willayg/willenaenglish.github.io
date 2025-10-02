// Netlify Function: upload-images
// Radical compression pipeline:
//  1. Fetch source (URL or data URI)
//  2. Attempt WebP (optionally AVIF) & JPEG with descending qualities
//  3. If still above byte cap, iteratively downscale dimensions by step until under target or min edge reached
//  4. Hash final bytes, store in R2 with immutable cache headers
// Request JSON: { gameId?, words:[{index, source}], cover:{source}? }
// Response JSON: { gameId, words:[{index,url,bytes,format}], cover:{url,bytes,format}? }
// Env Vars (aggressive defaults chosen for radical size cut):
//   IMAGE_MAX_BYTES (default 90000 ~ 88KB)
//   IMAGE_MAX_EDGE (default 200)
//   IMAGE_MIN_EDGE (default 100)
//   IMAGE_DOWNSCALE_STEP (default 0.85) // 15% shrink each loop
//   IMAGE_FORCE_WEBP=1 forces WebP first (default true-ish)
//   IMAGE_ENABLE_AVIF=1 enables AVIF attempt ahead of WebP (off by default for speed)
//   IMAGE_WEBP_QUALITIES="60,50,45,40"
//   IMAGE_JPEG_QUALITIES="70,60,55,50,45,40"
//   IMAGE_AVIF_QUALITIES="50,45,40" (only if AVIF enabled)
//   IMAGE_VERBOSE_LOG=1 for per-attempt logging
//   IMAGE_ALPHA_BACKGROUND="#FFFFFF" color to flatten transparency if forced to JPEG

const crypto = require('crypto');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
let Sharp;
try {
  Sharp = require('sharp');
} catch (e) {
  console.warn('[upload-images] Sharp not available – will pass original image bytes (no resize).', e?.message);
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
  // Prefer a dedicated images bucket if provided (R2_IMAGES_BUCKET_NAME), else fall back to generic
  const R2_BUCKET_NAME = process.env.R2_IMAGES_BUCKET_NAME || process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKETNAME;
  const rawPublicBase = process.env.R2_PUBLIC_BASE || '';
  const computedDefaultBase = `${(R2_ENDPOINT||'').replace(/\/$/,'')}/${R2_BUCKET_NAME}`;
  // If user did not supply a real public base (or left placeholder in frontend), we will later fallback to proxy links
  const R2_PUBLIC_BASE = rawPublicBase && !/your-r2-public-domain/i.test(rawPublicBase) ? rawPublicBase : '';

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
    const missing = {
      R2_ACCESS_KEY_ID: !!R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: !!R2_SECRET_ACCESS_KEY,
      R2_ENDPOINT: !!R2_ENDPOINT,
      R2_BUCKET_NAME: !!R2_BUCKET_NAME
    };
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Missing R2 environment variables', missing }) };
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
  });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  // Allow force recompress via body.force / body.forceRecompress or query param force=1
  const url = new URL(event.rawUrl || `http://localhost${event.path}`);
  const forceFlag = body.force === true || body.force === 1 || body.force === '1' || body.forceRecompress === true || body.forceRecompress === 1 || body.forceRecompress === '1' || url.searchParams.get('force') === '1';
  const gameId = sanitizeId(body.gameId) || genId();
  const out = { gameId, words: [], cover: null };

  async function processAndPush(src, keyPrefix, baseName, pushCb){
  const r = await processImage(src, keyPrefix, baseName, s3, R2_BUCKET_NAME, R2_PUBLIC_BASE || null, { force: forceFlag });
    if (r) pushCb(r);
  }

  if (body.cover && body.cover.source) {
    await processAndPush(body.cover.source, `cover/${gameId}`, 'cover', (c)=> out.cover = { url: c.publicUrl });
  }
  if (Array.isArray(body.words)) {
    for (const w of body.words) {
      if (!w || typeof w.index !== 'number' || !w.source) continue;
      await processAndPush(w.source, `words/${gameId}`, `w${w.index}`, (r)=> out.words.push({ index: w.index, url: r.publicUrl }));
    }
  }
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(out) };
};

async function processImage(src, keyPrefix, baseName, s3, bucket, publicBase, opts = {}) {
  try {
    const { buffer: originalBuffer } = await fetchToBuffer(src);
    const MAX_BYTES = parseInt(process.env.IMAGE_MAX_BYTES || '90000', 10); // radical default ~88KB
    const MAX_EDGE = parseInt(process.env.IMAGE_MAX_EDGE || '200', 10);
    const MIN_EDGE = parseInt(process.env.IMAGE_MIN_EDGE || '100', 10);
    const STEP = parseFloat(process.env.IMAGE_DOWNSCALE_STEP || '0.85');
    const FORCE_WEBP = (process.env.IMAGE_FORCE_WEBP || '1') === '1';
    const ENABLE_AVIF = (process.env.IMAGE_ENABLE_AVIF || '0') === '1';
    const VERBOSE = (process.env.IMAGE_VERBOSE_LOG || '0') === '1';
    const BG = process.env.IMAGE_ALPHA_BACKGROUND || '#FFFFFF';

    function parseList(name, def) {
      const raw = process.env[name];
      if (!raw) return def;
      return raw.split(/[,\s]+/).map(x=>x.trim()).filter(Boolean).map(x=>parseInt(x,10)).filter(n=>n>0 && n<=100);
    }
    const WEBP_QUALITIES = parseList('IMAGE_WEBP_QUALITIES', [60,50,45,40]);
    const JPEG_QUALITIES = parseList('IMAGE_JPEG_QUALITIES', [70,60,55,50,45,40]);
    const AVIF_QUALITIES = parseList('IMAGE_AVIF_QUALITIES', [50,45,40]);

    if (!Sharp) {
      // Fallback: cannot compress; store original (still hashed) but warn if huge.
      const RAW_REJECT = parseInt(process.env.IMAGE_FALLBACK_REJECT_OVER || '0', 10) || 0; // if >0 reject originals bigger than this
      if (RAW_REJECT && originalBuffer.length > RAW_REJECT) {
        console.warn(`[upload-images] Rejecting original image > RAW_REJECT (${originalBuffer.length} > ${RAW_REJECT}) with no Sharp.`);
        return null; // caller will skip
      }
      const detected = detectImageType(originalBuffer);
      if (originalBuffer.length > MAX_BYTES) {
        console.warn(`[upload-images] Sharp unavailable; storing oversize original (${originalBuffer.length} > ${MAX_BYTES}) type=${detected.ext}`);
      }
      const hash = sha1(originalBuffer).slice(0,16);
      const key = `${keyPrefix}/${baseName}-${hash}.${detected.ext}`;
      if (opts.force) {
        console.log(`[upload-images] force overwrite (no-sharp path) key=${key}`);
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: originalBuffer, ContentType: detected.mime, CacheControl: 'public, max-age=31536000, immutable'}));
      } else {
        if (!(await exists(s3, bucket, key))) {
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: originalBuffer, ContentType: detected.mime, CacheControl: 'public, max-age=31536000, immutable'}));
        }
      }
      const publicUrl = publicBase ? join(publicBase, key) : `/.netlify/functions/image_proxy?key=${encodeURIComponent(key)}`; 
      return { key, publicUrl, bytes: originalBuffer.length, usedSharp: false, format: detected.ext, oversized: originalBuffer.length > MAX_BYTES, warning: 'sharp_unavailable' };
    }

    let meta;
    try { meta = await Sharp(originalBuffer).metadata(); } catch { meta = {}; }
    const hasAlpha = !!meta.hasAlpha;

    // Build format preference order dynamically.
    const formatPref = [];
    if (ENABLE_AVIF) formatPref.push('avif');
    if (FORCE_WEBP) formatPref.push('webp');
    // Always allow jpeg fallback.
    formatPref.push('jpeg');

    let best = { buffer: originalBuffer, bytes: originalBuffer.length, format: 'original', width: meta.width, height: meta.height };
    let achieved = false;
    let currentEdge = MAX_EDGE;

    // Guard: avoid endless loops
    let safety = 0;
    while (currentEdge >= MIN_EDGE - 1 && safety < 25) {
      safety++;
      for (const fmt of formatPref) {
        const qualities = fmt === 'webp' ? WEBP_QUALITIES : (fmt === 'avif' ? AVIF_QUALITIES : JPEG_QUALITIES);
        for (const q of qualities) {
          let pipeline = Sharp(originalBuffer).rotate().resize(currentEdge, currentEdge, { fit: 'cover', withoutEnlargement: true });
          if (fmt === 'webp') pipeline = pipeline.webp({ quality: q, effort: 4 });
          else if (fmt === 'avif') pipeline = pipeline.avif({ quality: q, effort: 4 });
          else if (fmt === 'jpeg') {
            if (hasAlpha) { // flatten transparency if needed
              pipeline = pipeline.flatten({ background: BG });
            }
            pipeline = pipeline.jpeg({ quality: q, progressive: true, mozjpeg: true, chromaSubsampling: '4:2:0' });
          }
          let candidate;
            try { candidate = await pipeline.toBuffer(); } catch (e) { console.warn('[upload-images] encode failed', fmt, q, e?.message); continue; }
          if (VERBOSE) console.log(`[upload-images] attempt fmt=${fmt} q=${q} edge=${currentEdge} bytes=${candidate.length}`);
          if (candidate.length < best.bytes) {
            best = { buffer: candidate, bytes: candidate.length, format: fmt, edge: currentEdge };
          }
          if (candidate.length <= MAX_BYTES) {
            best = { buffer: candidate, bytes: candidate.length, format: fmt, edge: currentEdge };
            achieved = true;
            break;
          }
        }
        if (achieved) break;
      }
      if (achieved) break;
      // Downscale further
      currentEdge = Math.floor(currentEdge * STEP);
      if (currentEdge < MIN_EDGE) currentEdge = MIN_EDGE;
    }

    // If still not under cap, best holds smallest attempt.
    const finalBuffer = best.buffer;
    const finalFormat = best.format === 'original' ? (FORCE_WEBP ? 'webp' : 'jpeg') : best.format;
    let finalMeta = {};
    try { finalMeta = await Sharp(finalBuffer).metadata(); } catch {}

    const hash = sha1(finalBuffer).slice(0, 16);
    const ext = finalFormat === 'jpeg' ? 'jpg' : finalFormat; 
    const key = `${keyPrefix}/${baseName}-${hash}.${ext}`;
    const contentType = finalFormat === 'webp' ? 'image/webp' : finalFormat === 'avif' ? 'image/avif' : 'image/jpeg';
    if (opts.force) {
      console.log(`[upload-images] force overwrite key=${key}`);
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: finalBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable'
      }));
    } else {
      if (!(await exists(s3, bucket, key))) {
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: finalBuffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable'
        }));
      }
    }
    const publicUrl = publicBase ? join(publicBase, key) : `/.netlify/functions/image_proxy?key=${encodeURIComponent(key)}`;
    const oversized = finalBuffer.length > MAX_BYTES;
    console.log(`[upload-images] Stored key=${key} fmt=${finalFormat} bytes=${finalBuffer.length} target=${MAX_BYTES} edge=${best.edge || '?'} oversized=${oversized} achieved=${achieved}`);
    return { key, publicUrl, bytes: finalBuffer.length, format: finalFormat, width: finalMeta.width, height: finalMeta.height, oversized, achieved };
  } catch (e) {
    console.warn('[upload-images] process failed', e?.message);
    return null;
  }
}

async function fetchToBuffer(src) {
  if (src.startsWith('data:')) {
    const m = src.match(/^data:(.+?);base64,(.+)$/);
    if (!m) throw new Error('Invalid data URI');
    return { buffer: Buffer.from(m[2], 'base64') };
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error('Fetch failed ' + res.status);
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab) };
}

async function exists(s3, bucket, key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); return true; } catch { return false; }
}
function sha1(buf) { return crypto.createHash('sha1').update(buf).digest('hex'); }
function join(a, b) { return a.replace(/\/$/, '').replace(/\/$/, '') + '/' + b.replace(/^\//,''); }
function genId() { return 'g_' + Math.random().toString(36).slice(2, 12); }
function sanitizeId(id) { return (id && /^[A-Za-z0-9_\-]+$/.test(id)) ? id : null; }
function json(status, obj) { return { statusCode: status, headers: { 'Content-Type':'application/json' }, body: JSON.stringify(obj) }; }
function detectImageType(buf){
  if(!buf || buf.length < 12) return { ext:'bin', mime:'application/octet-stream' };
  const sig = buf.slice(0, 12);
  const hex = sig.toString('hex');
  // JPEG FF D8 FF
  if (hex.startsWith('ffd8ff')) return { ext:'jpg', mime:'image/jpeg' };
  // PNG 89 50 4E 47 0D 0A 1A 0A
  if (hex.startsWith('89504e470d0a1a0a')) return { ext:'png', mime:'image/png' };
  // GIF 47 49 46 38
  if (hex.startsWith('47494638')) return { ext:'gif', mime:'image/gif' };
  // WEBP: RIFF....WEBP
  if (sig.slice(0,4).toString() === 'RIFF' && sig.slice(8,12).toString() === 'WEBP') return { ext:'webp', mime:'image/webp' };
  // AVIF / HEIC (ftypavif / ftypheic / ftypmif1)
  if (sig.slice(4,8).toString() === 'ftyp') {
    const brand = sig.slice(8,12).toString();
    if (brand.startsWith('avif')) return { ext:'avif', mime:'image/avif' };
    if (brand.startsWith('mif1') || brand.startsWith('heic') || brand.startsWith('heix')) return { ext:'heic', mime:'image/heic' };
  }
  return { ext:'bin', mime:'application/octet-stream' };
}
