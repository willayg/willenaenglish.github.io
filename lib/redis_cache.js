const { Redis } = require('@upstash/redis');

let client = null;
let clientInitError = null;

function ensureClient() {
  if (client || clientInitError) {
    return client;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    clientInitError = new Error('UPSTASH_REDIS credentials missing');
    return null;
  }
  try {
    client = new Redis({ url, token });
  } catch (err) {
    clientInitError = err;
    client = null;
  }
  return client;
}

function isEnabled() {
  return !!ensureClient();
}

async function getJson(key) {
  const redis = ensureClient();
  if (!redis || !key) return null;
  try {
    const raw = await redis.get(key);
    if (raw == null) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  } catch (err) {
    console.debug('[redis_cache] getJson failed:', err && err.message);
    return null;
  }
}

async function setJson(key, value, ttlSeconds) {
  const redis = ensureClient();
  if (!redis || !key) return false;
  try {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds && Number.isFinite(ttlSeconds)) {
      await redis.set(key, payload, { ex: Math.max(1, Math.floor(ttlSeconds)) });
    } else {
      await redis.set(key, payload);
    }
    return true;
  } catch (err) {
    console.debug('[redis_cache] setJson failed:', err && err.message);
    return false;
  }
}

async function del(key) {
  const redis = ensureClient();
  if (!redis || !key) return false;
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.debug('[redis_cache] del failed:', err && err.message);
    return false;
  }
}

module.exports = {
  ensureClient,
  isEnabled,
  getJson,
  setJson,
  del
};
