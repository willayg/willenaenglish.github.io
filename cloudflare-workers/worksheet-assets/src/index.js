const ALLOWED_ORIGINS = new Set([
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://cf.willenaenglish.com',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'http://localhost:8888',
  'http://localhost:9000',
]);

const DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/i;
const HTTP_URL_RE = /^https?:\/\//i;
const MIME_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://willenaenglish.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Worksheet-Migration-Secret',
    Vary: 'Origin',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) } });
}

function parseCookies(header) {
  const cookies = {};
  String(header || '').split(/;\s*/).forEach(pair => {
    const index = pair.indexOf('=');
    if (index <= 0) return;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key && !(key in cookies)) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function getAccessToken(request) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const cookieToken = cookies.sb_access || cookies['sb-access'] || cookies.sb_access_token || cookies['sb-access-token'];
  if (cookieToken) return cookieToken;
  const authorization = request.headers.get('Authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ''));
  const b = new TextEncoder().encode(String(right || ''));
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index % Math.max(a.length, 1)] || 0) ^ (b[index % Math.max(b.length, 1)] || 0);
  return difference === 0;
}

function hasMigrationAccess(request, env) {
  const supplied = request.headers.get('X-Worksheet-Migration-Secret') || '';
  return Boolean(env.WORKSHEET_MIGRATION_SECRET && supplied && constantTimeEqual(supplied, env.WORKSHEET_MIGRATION_SECRET));
}

async function getUser(env, token) {
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

function parseJsonObject(value, fieldName) {
  if (value == null || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return structuredClone(value);
  if (typeof value !== 'string') throw new TypeError(`${fieldName} must be a JSON object or JSON string`);
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError(`${fieldName} must parse to an object`);
  return parsed;
}

function decodeBase64(base64) {
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toHex(arrayBuffer) { return Array.from(new Uint8Array(arrayBuffer), byte => byte.toString(16).padStart(2, '0')).join(''); }

async function inspectImageValue(value) {
  if (typeof value !== 'string') return { kind: 'other', value };
  if (value === 'emoji') return { kind: 'emoji', value };
  if (HTTP_URL_RE.test(value)) return { kind: 'url', url: value };
  const match = value.match(DATA_URL_RE);
  if (!match) return { kind: 'other', value };
  const mimeType = match[1].toLowerCase();
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw new Error(`Unsupported worksheet image MIME type: ${mimeType}`);
  const bytes = decodeBase64(match[2]);
  if (!bytes.byteLength) throw new Error('Embedded worksheet image is empty');
  const sha256 = toHex(await crypto.subtle.digest('SHA-256', bytes));
  const assetKey = `worksheets/assets/sha256/${sha256.slice(0, 2)}/${sha256}.${extension}`;
  return { kind: 'embedded', mimeType, extension, bytes, byteLength: bytes.byteLength, sha256, assetKey };
}

function publicAssetUrl(env, assetKey) {
  const base = String(env.R2_PUBLIC_BASE || '').replace(/\/$/, '');
  if (!base) throw new Error('R2_PUBLIC_BASE is not configured');
  return `${base}/${assetKey}`;
}

function containsEmbeddedImage(value) {
  if (typeof value === 'string') {
    if (/data:image\//i.test(value)) return true;
    try { return containsEmbeddedImage(JSON.parse(value)); } catch { return false; }
  }
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsEmbeddedImage);
  return Object.values(value).some(containsEmbeddedImage);
}

async function transformWordTest(worksheet, env, uploads) {
  const images = parseJsonObject(worksheet.images, 'images');
  for (const [key, current] of Object.entries(images)) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) continue;
    const entry = { ...current };
    const inspected = await inspectImageValue(entry.src);
    if (inspected.kind !== 'embedded') continue;
    uploads.set(inspected.sha256, inspected);
    entry.src = publicAssetUrl(env, inspected.assetKey);
    entry.asset_key = inspected.assetKey;
    entry.sha256 = inspected.sha256;
    entry.mime_type = inspected.mimeType;
    entry.bytes = inspected.byteLength;
    images[key] = entry;
  }
  const settings = parseJsonObject(worksheet.settings, 'settings');
  settings.storage_schema_version = 2;
  return { ...worksheet, images: JSON.stringify(images), settings: JSON.stringify(settings) };
}

async function replaceEmbeddedDeep(value, env, uploads) {
  if (typeof value === 'string') {
    const inspected = await inspectImageValue(value);
    if (inspected.kind !== 'embedded') return value;
    uploads.set(inspected.sha256, inspected);
    return publicAssetUrl(env, inspected.assetKey);
  }
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const output = [];
    for (const item of value) output.push(await replaceEmbeddedDeep(item, env, uploads));
    return output;
  }
  const output = {};
  for (const [key, item] of Object.entries(value)) output[key] = await replaceEmbeddedDeep(item, env, uploads);
  return output;
}

async function transformFlashcard(worksheet, env, uploads) {
  const images = await replaceEmbeddedDeep(parseJsonObject(worksheet.images, 'images'), env, uploads);
  const settings = await replaceEmbeddedDeep(parseJsonObject(worksheet.settings, 'settings'), env, uploads);
  settings.storage_schema_version = 2;
  return { ...worksheet, images: JSON.stringify(images), settings: JSON.stringify(settings), image_data: null };
}

async function transformWorksheet(worksheet, env) {
  if (!worksheet || typeof worksheet !== 'object') throw new TypeError('worksheet is required');
  const uploads = new Map();
  let transformed;
  if (worksheet.worksheet_type === 'wordtest') transformed = await transformWordTest(worksheet, env, uploads);
  else if (worksheet.worksheet_type === 'flashcard') transformed = await transformFlashcard(worksheet, env, uploads);
  else transformed = structuredClone(worksheet);
  const remainingFields = ['images', 'settings', 'image_data'].filter(field => containsEmbeddedImage(transformed[field]));
  if (remainingFields.length) throw new Error(`Transformation left embedded images in: ${remainingFields.join(', ')}`);
  return { worksheet: transformed, uploads: Array.from(uploads.values()) };
}

function limits(env) {
  return {
    maxImageBytes: Number(env.WORKSHEET_IMAGE_MAX_BYTES) || 5 * 1024 * 1024,
    maxAssets: Number(env.WORKSHEET_MAX_ASSETS) || 60,
    maxTotalBytes: Number(env.WORKSHEET_TOTAL_IMAGE_MAX_BYTES) || 20 * 1024 * 1024,
  };
}

async function persistAssets(env, uploads, dryRun) {
  if (!env.WORKSHEET_ASSETS) throw new Error('WORKSHEET_ASSETS R2 binding is missing');
  const { maxImageBytes, maxAssets, maxTotalBytes } = limits(env);
  if (uploads.length > maxAssets) throw new Error(`Too many worksheet images; maximum is ${maxAssets}`);
  let totalBytes = 0;
  for (const image of uploads) {
    if (image.byteLength > maxImageBytes) throw new Error(`Worksheet image exceeds ${maxImageBytes} byte limit`);
    totalBytes += image.byteLength;
  }
  if (totalBytes > maxTotalBytes) throw new Error(`Worksheet images exceed ${maxTotalBytes} byte combined limit`);
  const assets = [];
  for (const image of uploads) {
    let created = false;
    if (!dryRun) {
      const existing = await env.WORKSHEET_ASSETS.head(image.assetKey);
      if (!existing) {
        await env.WORKSHEET_ASSETS.put(image.assetKey, image.bytes, {
          httpMetadata: { contentType: image.mimeType, cacheControl: 'public, max-age=31536000, immutable' },
          customMetadata: { sha256: image.sha256, source: 'worksheet' },
        });
        created = true;
      }
    }
    assets.push({ asset_key: image.assetKey, url: publicAssetUrl(env, image.assetKey), sha256: image.sha256, mime_type: image.mimeType, bytes: image.byteLength, created, dry_run: dryRun });
  }
  return assets;
}

async function serveAsset(request, env, pathname) {
  const prefix = '/assets/';
  const key = decodeURIComponent(pathname.slice(prefix.length));
  if (!key.startsWith('worksheets/assets/')) return new Response('Not found', { status: 404 });
  const object = await env.WORKSHEET_ASSETS.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(object.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/assets/')) return serveAsset(request, env, url.pathname);
    if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: corsHeaders(origin) });
    if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405, origin);
    try {
      const migrationAccess = hasMigrationAccess(request, env);
      const user = migrationAccess ? { migration: true } : await getUser(env, getAccessToken(request));
      if (!user) return json({ success: false, error: 'Sign in required' }, 401, origin);
      let body;
      try { body = await request.json(); } catch { return json({ success: false, error: 'Invalid JSON body' }, 400, origin); }
      if (body.action !== 'transform_worksheet' || !body.worksheet) return json({ success: false, error: 'Expected action transform_worksheet' }, 400, origin);
      const dryRun = body.dry_run === true;
      const transformed = await transformWorksheet(body.worksheet, env);
      const assets = await persistAssets(env, transformed.uploads, dryRun);
      return json({
        success: true,
        dry_run: dryRun,
        worksheet: transformed.worksheet,
        assets,
        stats: {
          unique_assets: assets.length,
          uploaded_assets: assets.filter(asset => asset.created).length,
          reused_assets: assets.filter(asset => !asset.created && !asset.dry_run).length,
          total_asset_bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
        },
        validation: { valid: true, fields_with_embedded_images: [] },
      }, 200, origin);
    } catch (error) {
      console.error('[worksheet-assets-worker]', error);
      return json({ success: false, error: error?.message || 'Worksheet asset processing failed' }, 400, origin);
    }
  },
};

export const __test = { parseCookies, getAccessToken, constantTimeEqual, hasMigrationAccess, inspectImageValue, transformWorksheet, persistAssets, containsEmbeddedImage };
