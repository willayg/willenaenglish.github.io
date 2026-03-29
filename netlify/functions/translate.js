// Netlify Function: translate
// Query params: ?text=WORD&target=ko
// Returns: { translated: '...' }

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: ''
      };
    }

    const qs = event.queryStringParameters || {};
    const text = String(qs.text || '').trim();
    const target = String(qs.target || 'ko').trim();
    if (!text) return json(400, { error: 'text required' });

    // 1) Try LibreTranslate (self-hosted or public)
    const libreUrl = process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.com';
    const libreKey = process.env.LIBRE_TRANSLATE_KEY || '';
    if (libreUrl) {
      try {
        const res = await fetch(libreUrl.replace(/\/$/, '') + '/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: text,
            source: 'en',
            target,
            format: 'text',
            api_key: libreKey || undefined
          })
        });
        if (res.ok) {
          const js = await res.json().catch(() => null);
          const translated = String(js?.translatedText || js?.translated || '').trim();
          if (translated) return json(200, { translated, source: 'libre' });
        }
      } catch (_) {}
    }

    // 2) Fallback to Google public translate endpoint
    try {
      const gUrl = 'https://translate.googleapis.com/translate_a/single'
        + '?client=gtx'
        + '&sl=en'
        + '&tl=' + encodeURIComponent(target)
        + '&dt=t'
        + '&q=' + encodeURIComponent(text);
      const gRes = await fetch(gUrl, { method: 'GET' });
      if (gRes.ok) {
        const raw = await gRes.json().catch(() => null);
        const translated = extractGoogleTranslatedText(raw);
        if (translated) return json(200, { translated, source: 'google_public' });
      }
    } catch (_) {}

    // 3) Tiny emergency dictionary fallback
    const miniDict = {
      cat: '고양이',
      dog: '개',
      apple: '사과',
      banana: '바나나',
      hello: '안녕하세요',
      thanks: '감사합니다'
    };
    const translated = miniDict[String(text).toLowerCase()] || '';
    if (translated) return json(200, { translated, source: 'mini_dict' });

    return json(502, { error: 'Translation provider unavailable', translated: '' });
  } catch (e) {
    return json(500, { error: String(e || 'error') });
  }
};

function extractGoogleTranslatedText(raw) {
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) return '';
  const chunks = raw[0]
    .map(part => (Array.isArray(part) ? String(part[0] || '') : ''))
    .filter(Boolean);
  return chunks.join('').trim();
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body)
  };
}
