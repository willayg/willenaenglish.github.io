// Netlify Function: define_word
// Query: ?word=...  -> { defs: ["..."] }
// Priority:
// 1) Merriam-Webster School/Elementary (if API key present in env: MW_KIDS_API_KEY)
// 2) Free Dictionary API (dictionaryapi.dev)

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const word = String(qs.word || '').trim();
    if (!word) return json(400, { error: 'word required' });

    // Try Merriam-Webster School/Elementary
    const mwKey = process.env.MW_KIDS_API_KEY || process.env.MW_SCHOOL_API_KEY || '';
    if (mwKey) {
      try {
        const url = `https://www.dictionaryapi.com/api/v3/references/sd3/json/${encodeURIComponent(word)}?key=${mwKey}`;
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (res.ok) {
          const arr = await res.json();
          const defs = extractMWDefs(arr);
          if (defs.length) return json(200, { source: 'mw_kids', defs });
        }
      } catch (e) {
        // swallow and try fallback
      }
    }

    // Fallback: Free Dictionary API
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (res.ok) {
        const arr = await res.json();
        const defs = extractFreeDictDefs(arr);
        if (defs.length) return json(200, { source: 'free', defs });
      }
    } catch (e) {
      // ignore
    }

    return json(404, { error: 'definition not found', defs: [] });
  } catch (e) {
    return json(500, { error: String(e || 'error') });
  }
};

function extractMWDefs(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const entry of arr) {
    // MW entries use shortdef: [string]
    const sdef = entry?.shortdef;
    if (Array.isArray(sdef)) {
      for (const d of sdef) if (typeof d === 'string' && d.trim()) out.push(clean(d));
    }
    // Also scan def[].sseq for dt fields when shortdef is sparse
    const defs = entry?.def;
    if (Array.isArray(defs)) {
      for (const d of defs) {
        for (const sseq of (d.sseq || [])) {
          for (const s of (Array.isArray(sseq) ? sseq : [])) {
            const dt = Array.isArray(s[1]?.dt) ? s[1].dt : [];
            for (const piece of dt) {
              if (Array.isArray(piece) && piece[0] === 'text') {
                const t = String(piece[1] || '').replace(/{.*?}/g, '').trim();
                if (t) out.push(clean(t));
              }
            }
          }
        }
      }
    }
  }
  // De-duplicate and keep the first few
  return dedupe(out).slice(0, 5);
}

function extractFreeDictDefs(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const entry of arr) {
    const meanings = entry?.meanings || [];
    for (const m of meanings) {
      const defs = m?.definitions || [];
      for (const d of defs) {
        const t = String(d?.definition || '').trim();
        if (t) out.push(clean(t));
      }
    }
  }
  return dedupe(out).slice(0, 5);
}

function clean(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}
function dedupe(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) { if (!seen.has(v)) { seen.add(v); out.push(v); } }
  return out;
}
function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  };
}