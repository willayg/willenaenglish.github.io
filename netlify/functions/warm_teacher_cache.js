// Scheduled function to keep teacher dashboards warm by hitting key Netlify function endpoints
// Runs via Netlify cron (see netlify.toml schedule). It pings read-only endpoints with an
// INTERNAL_WARM_KEY query parameter so the target functions know to bypass cookie auth safely.

const DEFAULT_CLASSES = ['Stanford', 'New York', 'Hawaii', 'Brown'];
const BASE_PATHS = {
  leaderboard: '/.netlify/functions/progress_teacher_summary?action=leaderboard',
  classes: '/.netlify/functions/progress_teacher_summary?action=classes_list',
  teacherList: '/.netlify/functions/teacher_admin?action=list_students'
};
const TIMEFRAMES = ['month', 'all'];

function getBaseUrl() {
  return (
    process.env.SITE_BASE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    'https://willenaenglish.netlify.app'
  ).replace(/\/$/, '');
}

function parseWarmClasses() {
  const raw = process.env.WARM_CLASSES;
  if (!raw) return DEFAULT_CLASSES;
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

function withWarmKey(path, key) {
  const joiner = path.includes('?') ? '&' : '?';
  return `${path}${joiner}internal_warm_key=${encodeURIComponent(key)}`;
}

async function pingEndpoint(label, url) {
  const started = Date.now();
  try {
    if (typeof fetch !== 'function') throw new Error('Fetch API unavailable in runtime');
    const res = await fetch(url, { headers: { 'cache-control': 'no-cache' }, redirect: 'follow' });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      return { label, ok: false, status: res.status, ms, error: text.slice(0, 500) };
    }
    return { label, ok: true, status: res.status, ms };
  } catch (err) {
    return { label, ok: false, status: 0, ms: Date.now() - started, error: err.message || String(err) };
  }
}

exports.handler = async () => {
  const warmKey = process.env.INTERNAL_WARM_KEY || process.env.internal_warm_key;
  if (!warmKey) {
    console.warn('[warm_teacher_cache] INTERNAL_WARM_KEY missing');
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Missing INTERNAL_WARM_KEY' })
    };
  }

  const baseUrl = getBaseUrl();
  const classes = parseWarmClasses();
  const jobs = [];

  // Always warm the classes dropdown cache first
  jobs.push({ label: 'classes_list', url: `${baseUrl}${withWarmKey(BASE_PATHS.classes, warmKey)}` });

  // Warm per-class leaderboards and manage-students list views
  classes.forEach((cls) => {
    const encodedClass = encodeURIComponent(cls);
    TIMEFRAMES.forEach((tf) => {
      jobs.push({
        label: `leaderboard:${cls}:${tf}`,
        url: `${baseUrl}${withWarmKey(`${BASE_PATHS.leaderboard}&class=${encodedClass}&timeframe=${tf}`, warmKey)}`
      });
    });
    jobs.push({
      label: `teacher_admin:list_students:${cls}`,
      url: `${baseUrl}${withWarmKey(`${BASE_PATHS.teacherList}&class=${encodedClass}&limit=200`, warmKey)}`
    });
  });

  const results = await Promise.all(jobs.map((job) => pingEndpoint(job.label, job.url)));
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  if (failCount) {
    console.warn('[warm_teacher_cache] failures detected', results.filter((r) => !r.ok));
  } else {
    console.log('[warm_teacher_cache] all warm requests succeeded', { count: results.length });
  }

  return {
    statusCode: failCount ? 500 : 200,
    body: JSON.stringify({ success: failCount === 0, results })
  };
};
