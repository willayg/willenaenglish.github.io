const fs = require('fs');
const path = require('path');

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

(async function main(){
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    let envContent = '';
    try { envContent = fs.readFileSync(envPath, 'utf8'); } catch (e) { /* ignore */ }
    const envVars = parseDotEnv(envContent);

    process.env.UPSTASH_REDIS_REST_URL = envVars.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = envVars.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in .env or env');
      process.exit(2);
    }

    // Require project's redis_cache helper
    const redisCache = require('../lib/redis_cache');
    if (!redisCache.isEnabled()) {
      console.error('Redis client not enabled (check UPSTASH vars)');
      process.exit(1);
    }

    const keys = ['lb:global:all','lb:global:month'];
    for (const k of keys) {
      try {
        const ok = await redisCache.del(k);
        console.log(`Deleted key ${k}:`, ok);
      } catch (e) {
        console.error(`Error deleting ${k}:`, e && e.message);
      }
    }

    process.exit(0);
  } catch (e) {
    console.error('Unexpected error:', e && e.message);
    process.exit(1);
  }
})();
