// Netlify Function: translate
// Query params: ?text=WORD&target=ko
// Returns: { translated: '...' }
// NOTE: Minimal placeholder implementation. Replace with real API (e.g., Google, LibreTranslate) if credentials available.

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const text = String(qs.text || '').trim();
    const target = String(qs.target || 'ko').trim();
    if (!text) return json(400, { error: 'text required' });

    // If an environment variable LIBRE_TRANSLATE_URL is set, attempt real translation
    const libreUrl = process.env.LIBRE_TRANSLATE_URL || '';
    const libreKey = process.env.LIBRE_TRANSLATE_KEY || '';
    if (libreUrl) {
      try {
        const res = await fetch(libreUrl.replace(/\/$/, '') + '/translate', {
          method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text, source: 'en', target, format: 'text', api_key: libreKey || undefined })
        });
        if (res.ok) {
          const js = await res.json().catch(()=>null);
          const translated = js?.translatedText || js?.translated || '';
          if (translated) return json(200, { translated });
        }
      } catch (e) {
        // fall through to simple pseudo translation
      }
    }

    // Fallback: very naive mock translation map for a few common words (extend as needed)
    const miniDict = {
      cat: '고양이', dog: '개', apple: '사과', banana: '바나나', hello: '안녕하세요', thanks: '감사합니다'
    };
    const lower = text.toLowerCase();
    const translated = miniDict[lower] || text; // echo if unknown
    return json(200, { translated });
  } catch (e) {
    return json(500, { error: String(e || 'error') });
  }
};

function json(statusCode, body){
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  };
}
