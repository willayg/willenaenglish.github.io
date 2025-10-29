// Shared progress data service
// Fetches progress_summary once and derives level progress + star counts

import { FN } from '../scripts/api-base.js';
import { progressCache } from './progress-cache.js';

const MODE_GROUPS = {
  general: ['meaning', 'listening', 'multi_choice', 'listen_and_spell', 'sentence', 'level_up'],
  phonics: ['listening', 'spelling', 'multi_choice', 'listen_and_spell'],
};

const CACHE_KEYS = {
  level1: 'level1_progress',
  level2: 'level2_progress',
  level3: 'level3_progress',
  level4: 'level4_progress',
  phonics: 'phonics_progress',
  stars: 'level_stars',
};

const SESSION_CACHE_WINDOW_MS = 30 * 1000; // allow reuse for rapid consecutive requests
let sessionCache = null;
let sessionCacheTimestamp = 0;
let sessionInflightPromise = null;

function norm(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function stripExt(value) {
  return value.replace(/\.json$/i, '');
}

function parseSummary(summary) {
  if (!summary) return null;
  if (typeof summary === 'object') return summary;
  try {
    return JSON.parse(summary);
  } catch {
    return null;
  }
}

function canonicalMode(raw) {
  const m = norm(raw);
  if (m === 'sentence' || m.includes('sentence')) return 'sentence';
  if (m === 'matching' || m.startsWith('matching_') || m === 'meaning') return 'meaning';
  if (m === 'phonics_listening' || m === 'listen' || m === 'listening' || (m.startsWith('listening_') && !m.includes('spell'))) return 'listening';
  if (m.includes('listen') && m.includes('spell')) return 'listen_and_spell';
  if (m === 'multi_choice' || m.includes('multi_choice') || m.includes('picture_multi_choice') || m === 'easy_picture' || m === 'picture' || m === 'picture_mode' || m.includes('read')) return 'multi_choice';
  if (m === 'spelling' || m === 'missing_letter' || (m.includes('spell') && !m.includes('listen'))) return 'spelling';
  if (m.includes('level_up')) return 'level_up';
  return m || 'unknown';
}

function extractPercent(session, summary) {
  const sum = summary || {};
  if (typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) {
    return Math.round((sum.score / sum.total) * 100);
  }
  if (typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) {
    return Math.round((sum.score / sum.max) * 100);
  }
  if (typeof sum.accuracy === 'number') {
    return Math.round((sum.accuracy || 0) * 100);
  }
  if (typeof session.correct === 'number' && typeof session.total === 'number' && session.total > 0) {
    return Math.round((session.correct / session.total) * 100);
  }
  if (typeof session.accuracy === 'number') {
    return Math.round((session.accuracy || 0) * 100);
  }
  return null;
}

function collectSessionNames(session) {
  const names = [];
  if (session.list_name) names.push(session.list_name);
  const summary = parseSummary(session.summary);
  if (summary) {
    if (summary.list_name) names.push(summary.list_name);
    if (summary.listName) names.push(summary.listName);
    if (summary.listFile) names.push(summary.listFile);
  }
  return names;
}

function matchesSampleList(item, name) {
  const n = norm(name);
  if (!n) return false;
  const file = norm(item.file);
  const label = norm(item.label);
  if (file) {
    const fileName = file.split('/').pop();
    const fileNoExt = stripExt(fileName);
    if (n === fileName || n === fileNoExt) return true;
    if (stripExt(n) === fileNoExt) return true;
  }
  if (label && (n === label || stripExt(n) === stripExt(label))) return true;
  return false;
}

function matchesLevelList(item, name) {
  const n = norm(name);
  if (!n) return false;
  const targets = [item.progressKey, item.label, item.file]
    .map(norm)
    .filter(Boolean);
  return targets.includes(n);
}

function computePercentages(lists, sessions, modeIds, matchFn) {
  return lists.map((item) => {
    const bestByMode = {};
    sessions.forEach((session) => {
      const names = collectSessionNames(session);
      const matched = names.some((name) => matchFn(item, name));
      if (!matched) return;
      const summary = parseSummary(session.summary);
      const pct = extractPercent(session, summary);
      if (pct == null) return;
      const mode = canonicalMode(session.mode);
      if (!(mode in bestByMode) || bestByMode[mode] < pct) {
        bestByMode[mode] = pct;
      }
    });

    let total = 0;
    modeIds.forEach((mode) => {
      const pct = bestByMode[mode];
      total += typeof pct === 'number' ? pct : 0;
    });
    return Math.round(total / modeIds.length);
  });
}

function computeStarCountsFromSessions(sessions) {
  const byLevel = {
    level0: new Map(),
    level1: new Map(),
    level2: new Map(),
    level3: new Map(),
  };

  const normName = (value) => norm(value);

  sessions.forEach((session) => {
    const listName = normName(session.list_name) || normName(parseSummary(session.summary)?.list_name || parseSummary(session.summary)?.listName);
    if (!listName) return;
    let bucket = null;
    if (/^phonics\s*-/i.test(listName) || /sound/i.test(listName)) bucket = 'level0';
    else if (/^level\s*2\s*-/i.test(listName)) bucket = 'level2';
    else if (/^level\s*3\s*-/i.test(listName)) bucket = 'level3';
    else if (/\.json$/i.test(listName)) bucket = 'level1';
    if (!bucket) return;

    const key = listName.toLowerCase();
    if (!byLevel[bucket].has(key)) byLevel[bucket].set(key, {});
    const best = byLevel[bucket].get(key);
    const pct = extractPercent(session, parseSummary(session.summary));
    const mode = canonicalMode(session.mode);
    if (pct != null) {
      if (!(mode in best) || best[mode] < pct) {
        best[mode] = pct;
      }
    }
  });

  const phonicsModes = MODE_GROUPS.phonics;
  const generalModes = MODE_GROUPS.general;

  const sumStars = (map, modeIds) => {
    let total = 0;
    map.forEach((bestByMode) => {
      modeIds.forEach((mode) => {
        const pct = bestByMode[mode];
        if (pct == null) return;
        if (pct >= 100) total += 5;
        else if (pct > 90) total += 4;
        else if (pct > 80) total += 3;
        else if (pct > 70) total += 2;
        else if (pct >= 60) total += 1;
      });
    });
    return total;
  };

  return {
    level0: sumStars(byLevel.level0, phonicsModes),
    level1: sumStars(byLevel.level1, generalModes),
    level2: sumStars(byLevel.level2, generalModes),
    level3: sumStars(byLevel.level3, generalModes),
  };
}

async function fetchAllSessions() {
  const now = Date.now();
  if (sessionCache && (now - sessionCacheTimestamp) < SESSION_CACHE_WINDOW_MS) {
    return sessionCache;
  }
  if (sessionInflightPromise) {
    return sessionInflightPromise;
  }
  const url = new URL(FN('progress_summary'), window.location.origin);
  url.searchParams.set('section', 'sessions');
  sessionInflightPromise = (async () => {
    const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
    if (!res.ok) {
      throw new Error(`progress_summary fetch failed (${res.status})`);
    }
    const data = await res.json().catch(() => []);
    const sessions = Array.isArray(data) ? data : [];
    sessionCache = sessions;
    sessionCacheTimestamp = Date.now();
    return sessions;
  })();

  try {
    return await sessionInflightPromise;
  } finally {
    sessionInflightPromise = null;
  }
}

function ensureProgressPayload(values) {
  return { ready: true, values: Array.isArray(values) ? values : [] };
}

async function loadProgress(cacheKey, lists, modeGroup, matcher) {
  return progressCache.fetchWithCache(cacheKey, async () => {
    const sessions = await fetchAllSessions();
    const modeIds = MODE_GROUPS[modeGroup];
    const values = computePercentages(lists, sessions, modeIds, matcher);
    return ensureProgressPayload(values);
  });
}

export async function loadSampleWordlistProgress(lists) {
  return loadProgress(CACHE_KEYS.level1, lists, 'general', matchesSampleList);
}

export async function loadLevel2Progress(lists) {
  return loadProgress(CACHE_KEYS.level2, lists, 'general', matchesLevelList);
}

export async function loadLevel3Progress(lists) {
  return loadProgress(CACHE_KEYS.level3, lists, 'general', matchesLevelList);
}

export async function loadLevel4Progress(lists) {
  return loadProgress(CACHE_KEYS.level4, lists, 'general', matchesLevelList);
}

export async function loadPhonicsProgress(lists) {
  return loadProgress(CACHE_KEYS.phonics, lists, 'phonics', matchesLevelList);
}

export async function loadStarCounts() {
  return progressCache.fetchWithCache(CACHE_KEYS.stars, async () => {
    const sessions = await fetchAllSessions();
    const counts = computeStarCountsFromSessions(sessions);
    return { ready: true, counts };
  });
}

export async function prefetchAllProgress(levels) {
  try {
    await fetchAllSessions();
    const tasks = [];
    if (!levels || levels.level1 !== false) tasks.push(loadSampleWordlistProgress(levels?.level1Lists || []));
    if (!levels || levels.level2 !== false) tasks.push(loadLevel2Progress(levels?.level2Lists || []));
    if (!levels || levels.level3 !== false) tasks.push(loadLevel3Progress(levels?.level3Lists || []));
    if (!levels || levels.level4 !== false) tasks.push(loadLevel4Progress(levels?.level4Lists || []));
    if (!levels || levels.phonics !== false) tasks.push(loadPhonicsProgress(levels?.phonicsLists || []));
    if (!levels || levels.stars !== false) tasks.push(loadStarCounts());
    await Promise.allSettled(tasks);
  } catch (e) {
    console.warn('[ProgressService] Prefetch failed', e);
  }
}

export function clearSessionCache() {
  sessionCache = null;
  sessionCacheTimestamp = 0;
}
