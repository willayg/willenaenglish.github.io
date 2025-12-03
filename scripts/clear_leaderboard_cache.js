const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function parseDotEnv(content) {
  const lines = (content || '').split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function main() {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    let envContent = '';
    try { envContent = fs.readFileSync(envPath, 'utf8'); } catch (e) { /* ignore */ }
    const envVars = parseDotEnv(envContent);

    const SUPABASE_URL = envVars.SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env or environment');
      process.exit(2);
    }

    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('Connected to Supabase:', SUPABASE_URL);

    const { data, error } = await client.from('leaderboard_cache').delete().eq('section', 'leaderboard_stars_global');
    if (error) {
      console.error('Supabase delete error:', error);
      process.exit(1);
    }
    console.log('Deleted leaderboard_cache rows (section=leaderboard_stars_global):', Array.isArray(data) ? data.length : (data ? 1 : 0));
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error:', e && e.message);
    process.exit(1);
  }
}

main();
