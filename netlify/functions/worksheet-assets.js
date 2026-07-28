'use strict';

const { createClient } = require('@supabase/supabase-js');
const { S3Client, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const {
  inspectImageValue,
  transformWorksheet,
  validateTransformedWorksheet
} = require('../../scripts/worksheet-storage/transformers');

const ALLOWED_ORIGINS = new Set([
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://willenaenglish.github.io',
  'https://willenaenglish.netlify.app'
]);

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_ASSETS = 60;
const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function corsHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://willenaenglish.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

function response(event, statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders(event), 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  };
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(/;\s*/).forEach(pair => {
    const i = pair.indexOf('=');
    if (i <= 0) return;
    const key = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (key && !(key in out)) out[key] = decodeURIComponent(value);
  });
  return out;
}

function getAccessToken(event) {
  const cookies = parseCookies(event?.headers?.cookie || event?.headers?.Cookie || '');
  const cookieToken = cookies.sb_access || cookies['sb-access'] || cookies.sb_access_token || cookies['sb-access-token'];
  if (cookieToken) return cookieToken;
  const auth = event?.headers?.authorization || event?.headers?.Authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

async function requireUser(event) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('Missing Supabase authentication environment variables');
  const token = getAccessToken(event);
  if (!token) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function getR2Config() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : '');
  const bucket = process.env.R2_IMAGES_BUCKET_NAME || process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  const publicBaseUrl = String(process.env.R2_PUBLIC_BASE || '').replace(/\/$/, '');
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket || !publicBaseUrl) {
    throw new Error('Missing worksheet R2 environment variables');
  }
  return { accessKeyId, secretAccessKey, endpoint, bucket, publicBaseUrl };
}

function makeS3(config) {
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

async function objectExists(s3, bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === 'NotFound' || error?.Code === 'NoSuchKey') return false;
    throw error;
  }
}

function decodeUpload(upload) {
  const inspected = inspectImageValue(upload?.data_url);
  if (inspected.kind !== 'embedded') throw new Error('Upload does not contain a supported embedded image');
  if (upload.sha256 && upload.sha256 !== inspected.sha256) throw new Error('Worksheet image hash mismatch');
  if (upload.asset_key && upload.asset_key !== inspected.assetKey) throw new Error('Worksheet image key mismatch');
  return inspected;
}

async function persistAssets(uploads, config, options = {}) {
  const maxImageBytes = Number(process.env.WORKSHEET_IMAGE_MAX_BYTES) || DEFAULT_MAX_IMAGE_BYTES;
  const maxAssets = Number(process.env.WORKSHEET_MAX_ASSETS) || DEFAULT_MAX_ASSETS;
  const maxTotalBytes = Number(process.env.WORKSHEET_TOTAL_IMAGE_MAX_BYTES) || DEFAULT_MAX_TOTAL_BYTES;
  const dryRun = options.dryRun === true;

  if (!Array.isArray(uploads)) throw new TypeError('uploads must be an array');
  if (uploads.length > maxAssets) throw new Error(`Too many worksheet images; maximum is ${maxAssets}`);

  const unique = new Map();
  let totalBytes = 0;
  for (const upload of uploads) {
    const image = decodeUpload(upload);
    if (image.bytes > maxImageBytes) throw new Error(`Worksheet image exceeds ${maxImageBytes} byte limit`);
    if (!unique.has(image.sha256)) {
      unique.set(image.sha256, image);
      totalBytes += image.bytes;
    }
  }
  if (totalBytes > maxTotalBytes) throw new Error(`Worksheet images exceed ${maxTotalBytes} byte combined limit`);

  const s3 = dryRun ? null : makeS3(config);
  const assets = [];
  for (const image of unique.values()) {
    let created = false;
    if (!dryRun) {
      const exists = await objectExists(s3, config.bucket, image.assetKey);
      if (!exists) {
        await s3.send(new PutObjectCommand({
          Bucket: config.bucket,
          Key: image.assetKey,
          Body: image.binary,
          ContentType: image.mimeType,
          CacheControl: 'public, max-age=31536000, immutable',
          Metadata: { sha256: image.sha256, source: 'worksheet' }
        }));
        created = true;
      }
    }
    assets.push({
      asset_key: image.assetKey,
      url: `${config.publicBaseUrl}/${image.assetKey}`,
      sha256: image.sha256,
      mime_type: image.mimeType,
      bytes: image.bytes,
      created,
      dry_run: dryRun
    });
  }
  return assets;
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(event), body: '' };
  if (event.httpMethod !== 'POST') return response(event, 405, { success: false, error: 'Method not allowed' });

  try {
    const user = await requireUser(event);
    if (!user) return response(event, 401, { success: false, error: 'Sign in required' });

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return response(event, 400, { success: false, error: 'Invalid JSON body' }); }

    const config = getR2Config();
    const dryRun = body.dry_run === true;

    if (body.action === 'upload_assets') {
      const assets = await persistAssets(body.uploads || [], config, { dryRun });
      return response(event, 200, { success: true, dry_run: dryRun, assets });
    }

    if (body.action !== 'transform_worksheet' || !body.worksheet) {
      return response(event, 400, { success: false, error: 'Expected action transform_worksheet or upload_assets' });
    }

    const transformed = transformWorksheet(body.worksheet, { publicBaseUrl: config.publicBaseUrl });
    const assets = await persistAssets(transformed.uploads, config, { dryRun });
    const validation = validateTransformedWorksheet(transformed.worksheet);
    if (!validation.valid) throw new Error('Transformed worksheet still contains embedded images');

    return response(event, 200, {
      success: true,
      dry_run: dryRun,
      worksheet: transformed.worksheet,
      assets,
      stats: {
        ...transformed.stats,
        uploaded_assets: assets.filter(asset => asset.created).length,
        reused_assets: assets.filter(asset => !asset.created && !asset.dry_run).length,
        total_asset_bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0)
      },
      validation
    });
  } catch (error) {
    console.error('[worksheet-assets]', error);
    return response(event, 400, { success: false, error: error?.message || 'Worksheet asset processing failed' });
  }
};

exports._test = {
  parseCookies,
  getAccessToken,
  decodeUpload,
  persistAssets,
  objectExists
};
