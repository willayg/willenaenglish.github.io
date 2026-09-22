const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function extensionFor(contentType) {
  switch (contentType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    case 'image/avif': return 'avif';
    default: return null;
  }
}

function hex(bytes) {
  return [...new Uint8Array(bytes)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(buffer) {
  return hex(await crypto.subtle.digest('SHA-256', buffer));
}

function validateSource(raw) {
  let url;
  try { url = new URL(String(raw || '').trim()); }
  catch { throw new Error('Invalid image source URL'); }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only http/https image sources are supported');
  }
  return url;
}

async function fetchImage(source) {
  const url = validateSource(source);
  const res = await fetch(url.toString(), {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Willena-Worksheet-Assets/1.0'
    }
  });

  if (!res.ok) {
    throw new Error(`Image fetch failed (${res.status})`);
  }

  const contentType = String(res.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error(`Unsupported image type: ${contentType || 'unknown'}`);
  }

  const declaredLength = Number(res.headers.get('content-length') || 0);
  if (declaredLength > MAX_SOURCE_BYTES) {
    throw new Error('Image is too large');
  }

  const buffer = await res.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > MAX_SOURCE_BYTES) {
    throw new Error('Image is empty or too large');
  }

  return { buffer, contentType };
}

async function persistAsset(env, source) {
  if (!env.WORKSHEET_ASSETS) {
    throw new Error('R2 binding WORKSHEET_ASSETS is not configured');
  }

  const { buffer, contentType } = await fetchImage(source);
  const digest = await sha256(buffer);
  const ext = extensionFor(contentType);
  const assetKey = `worksheets/assets/sha256/${digest.slice(0, 2)}/${digest}.${ext}`;

  const existing = await env.WORKSHEET_ASSETS.head(assetKey);
  if (!existing) {
    await env.WORKSHEET_ASSETS.put(assetKey, buffer, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable'
      },
      customMetadata: {
        sha256: digest,
        source: 'worksheet-assets-worker'
      }
    });
  }

  const publicBase = String(env.R2_PUBLIC_BASE || '').replace(/\/+$/, '');
  const url = publicBase ? `${publicBase}/${assetKey}` : null;

  return {
    url,
    asset_key: assetKey,
    sha256: digest,
    mime_type: contentType,
    bytes: buffer.byteLength,
    reused: !!existing
  };
}

async function handlePost(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ success: false, error: 'Invalid JSON body' }, 400); }

  // Single-image API for the eventual generic asset service.
  if (body && body.source) {
    try {
      const asset = await persistAsset(env, body.source);
      return json({ success: true, asset });
    } catch (err) {
      return json({ success: false, error: String(err?.message || err) }, 400);
    }
  }

  // Batch form for Word Builder save flows.
  if (body && Array.isArray(body.assets)) {
    if (body.assets.length > 50) {
      return json({ success: false, error: 'Too many assets in one request' }, 400);
    }

    const assets = [];
    for (const item of body.assets) {
      if (!item || !item.source) continue;
      try {
        const asset = await persistAsset(env, item.source);
        assets.push({ input_key: item.key ?? null, ...asset });
      } catch (err) {
        return json({
          success: false,
          error: String(err?.message || err),
          input_key: item.key ?? null
        }, 400);
      }
    }
    return json({ success: true, assets });
  }

  return json({ success: false, error: 'Expected source or assets[]' }, 400);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        success: true,
        service: 'worksheet-assets',
        r2_bound: !!env.WORKSHEET_ASSETS,
        public_base_configured: !!env.R2_PUBLIC_BASE
      });
    }

    if (request.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405);
    }

    return handlePost(request, env);
  }
};
