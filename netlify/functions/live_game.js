// Live game persistence (cross-device)
// Table suggestion (SQL in Supabase):
// CREATE TABLE live_games (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   short_id text UNIQUE, -- optional human short code (we return id only for now)
//   creator_id uuid, -- nullable (allow anonymous creation if not logged in)
//   mode text NOT NULL,
//   title text,
//   words jsonb, -- array of words / items
//   config jsonb, -- mode-specific config payload
//   created_at timestamptz DEFAULT now(),
//   expires_at timestamptz, -- optional auto-expire cleanup window (e.g., now()+interval '6 hours')
//   access text DEFAULT 'public' -- future: public / private
// );
// CREATE INDEX ON live_games (created_at);
// Optionally schedule a cron to purge rows older than 2 days or with expires_at < now().

// Contract:
// POST /.netlify/functions/live_game
//   body: { mode: string, title?: string, words: any[], config?: object, ttlMinutes?: number }
//   -> { success:true, id: uuid }
// GET /.netlify/functions/live_game?id=<uuid>
//   -> { success:true, id, mode, title, words, config } or 404
// Errors: { success:false, error }
const { createClient } = require('@supabase/supabase-js');

function json(statusCode, body) {
	return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control':'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
	if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }, body:'' };
	const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
	const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;
	if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { success:false, error:'Supabase env missing', hasUrl:!!SUPABASE_URL, hasKey:!!SERVICE_KEY });
	const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

	// Health/debug: ?health=1
	if (event.httpMethod === 'GET') {
		const qs = event.queryStringParameters || {};
		if (qs.health || qs.debug) {
			let tableOk = false, tableError = null;
			try {
				const probe = await supabase.from('live_games').select('id', { head:true, count:'exact' }).limit(1);
				if (!probe.error) tableOk = true; else tableError = { message: probe.error.message, code: probe.error.code };
			} catch(e){ tableError = { message: e.message }; }
			return json(200, { success:true, health:true, tableOk, tableError });
		}
	}

	if (event.httpMethod === 'POST') {
	let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { success:false, error:'Invalid JSON' }); }
	const { mode, title, words, config, ttlMinutes } = body || {};
	if (!mode) return json(400, { success:false, error:'Missing mode' });
	if (!Array.isArray(words) || !words.length) return json(400, { success:false, error:'Missing words array' });
	const ttl = Number(ttlMinutes); const safeTtl = Number.isFinite(ttl) ? Math.min(Math.max(ttl,1), 24*6*10) : 120; // default 120
	const expires_at = new Date(Date.now() + safeTtl*60000).toISOString();
	const row = { mode, title: title || null, words, config: config || null, expires_at };
	const ins = await supabase.from('live_games').insert(row).select('id').single();
	if (ins.error) return json(500, { success:false, error: ins.error.message, code: ins.error.code, details: ins.error.details, hint: ins.error.hint });
		return json(200, { success:true, id: ins.data.id });
	}

	if (event.httpMethod === 'GET') {
	const qs = event.queryStringParameters || {}; const id = qs.id;
	if (!id) return json(400, { success:false, error:'Missing id' });
	const sel = await supabase.from('live_games').select('id, mode, title, words, config').eq('id', id).single();
		if (sel.error) {
			if (sel.error.code === 'PGRST116' || /row not found/i.test(sel.error.message)) return json(404, { success:false, error:'Not found' });
			return json(500, { success:false, error: sel.error.message, code: sel.error.code, details: sel.error.details, hint: sel.error.hint });
		}
		return json(200, { success:true, ...sel.data });
	}

	return json(405, { success:false, error:'Method not allowed' });
};
// Live game persistence (cross-device) \n// Table suggestion (SQL in Supabase):\n// CREATE TABLE live_games (\n//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n//   short_id text UNIQUE, -- optional human short code (we return id only for now)\n//   creator_id uuid, -- nullable (allow anonymous creation if not logged in)\n//   mode text NOT NULL,\n//   title text,\n//   words jsonb, -- array of words / items\n//   config jsonb, -- mode-specific config payload\n//   created_at timestamptz DEFAULT now(),\n//   expires_at timestamptz, -- optional auto-expire cleanup window (e.g., now()+interval '6 hours')\n//   access text DEFAULT 'public' -- future: public / private\n// );\n// CREATE INDEX ON live_games (created_at);
// Optionally schedule a cron to purge rows older than 2 days or with expires_at < now().\n\n// Contract:\n// POST /.netlify/functions/live_game\n//   body: { mode: string, title?: string, words: any[], config?: object, ttlMinutes?: number }\n//   -> { success:true, id: uuid }\n// GET /.netlify/functions/live_game?id=<uuid>\n//   -> { success:true, id, mode, title, words, config } or 404\n// Errors: { success:false, error }\n\nconst { createClient } = require('@supabase/supabase-js');\n\nfunction json(statusCode, body) {\n  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control':'no-store' }, body: JSON.stringify(body) };\n}\n\nexports.handler = async (event) => {\n  if (event.httpMethod === 'OPTIONS') {\n    return { statusCode: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }, body:'' };\n  }\n  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;\n  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;\n  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { success:false, error:'Supabase env missing' });\n  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);\n\n  if (event.httpMethod === 'POST') {\n    let body;\n    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { success:false, error:'Invalid JSON' }); }\n    const { mode, title, words, config, ttlMinutes } = body || {};\n    if (!mode) return json(400, { success:false, error:'Missing mode' });\n    if (!Array.isArray(words) || !words.length) return json(400, { success:false, error:'Missing words array' });\n    const now = new Date();\n    let expires_at = null;\n    const ttl = Number(ttlMinutes);\n    const safeTtl = Number.isFinite(ttl) ? Math.min(Math.max(ttl, 1), 24*6*10) : 120; // cap maybe 60 hours arbitrary, default 120 min\n    expires_at = new Date(now.getTime() + safeTtl * 60000).toISOString();\n\n    // Minimal normalization to keep payload small-ish\n    const row = { mode, title: title || null, words, config: config || null, expires_at };\n    const ins = await supabase.from('live_games').insert(row).select('id').single();\n    if (ins.error) {\n      return json(500, { success:false, error: ins.error.message });\n    }\n    return json(200, { success:true, id: ins.data.id });\n  }\n\n  if (event.httpMethod === 'GET') {\n    const qs = event.queryStringParameters || {};\n    const id = qs.id;\n    if (!id) return json(400, { success:false, error:'Missing id' });\n    const sel = await supabase.from('live_games').select('id, mode, title, words, config').eq('id', id).single();\n    if (sel.error) {\n      if (sel.error.code === 'PGRST116' || /row not found/i.test(sel.error.message)) {\n        return json(404, { success:false, error:'Not found' });\n      }\n      return json(500, { success:false, error: sel.error.message });\n    }\n    return json(200, { success:true, ...sel.data });\n  }\n\n  return json(405, { success:false, error:'Method not allowed' });\n};\n