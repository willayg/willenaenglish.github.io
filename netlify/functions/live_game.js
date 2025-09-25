// Live game persistence (cross-device)
// Version: auth-gated v2
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
		if (!id) return json(400, { success:false, error:'Missing id', version:'v2' });
		// Auth gate: allow valid sb_access OR presence of guest cookie
		try {
			const hdrs = event.headers || {}; const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
			const hasGuest = /(?:^|;\s*)wa_guest_id=/.test(cookieHeader);
			const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
			if (!m) {
				if (!hasGuest) return json(401, { success:false, error:'Not authenticated', requires_auth:true, version:'v2', stage:'no_cookie' });
			} else {
				const token = decodeURIComponent(m[1]);
				const admin = createClient(SUPABASE_URL, SERVICE_KEY);
				const { data: userData, error: userErr } = await admin.auth.getUser(token);
				if (userErr || !userData || !userData.user) {
					if (!hasGuest) return json(401, { success:false, error:'Not authenticated', requires_auth:true, version:'v2', stage:'invalid_token' });
				}
			}
		} catch {
			return json(401, { success:false, error:'Not authenticated', requires_auth:true, version:'v2', stage:'exception' });
		}
		const sel = await supabase.from('live_games').select('id, mode, title, words, config').eq('id', id).single();
		if (sel.error) {
			if (sel.error.code === 'PGRST116' || /row not found/i.test(sel.error.message)) return json(404, { success:false, error:'Not found', version:'v2' });
			return json(500, { success:false, error: sel.error.message, version:'v2' });
		}
		return json(200, { success:true, version:'v2', ...sel.data });
	}

	return json(405, { success:false, error:'Method not allowed' });
};
// (Removed duplicate legacy implementation block during auth hardening)