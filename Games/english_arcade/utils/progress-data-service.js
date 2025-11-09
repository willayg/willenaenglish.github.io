// Shared progress data service
// Fetches progress_summary once and derives level progress + star counts

import { FN } from '../scripts/api-base.js';
import { progressCache } from './progress-cache.js';

const MODE_GROUPS = {
  general: ['meaning', 'listening', 'multi_choice', 'listen_and_spell', 'sentence', 'level_up'],
  phonics: ['listening', 'spelling', 'multi_choice', 'listen_and_spell'],
  grammar: ['grammar_mode', 'grammar_choose', 'grammar_lesson', 'grammar_lesson_it_vs_they', 'grammar_lesson_am_are_is', 'grammar_lesson_this_that', 'grammar_lesson_these_those', 'grammar_lesson_have_has', 'grammar_fill_gap', 'grammar_sentence_unscramble'],
};

const CACHE_KEYS = {
  level1: 'level1_progress',
  level2: 'level2_progress',
  level3: 'level3_progress',
  level4: 'level4_progress',
  phonics: 'phonics_progress',
  grammarLevel1: 'grammar_level1_progress',
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

function canonKey(value) {
  if (value == null) return '';
  const stripped = stripExt(norm(value));
  if (!stripped) return '';
  return stripped.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function buildGrammarKeys(value) {
  const keys = new Set();
  const pushForms = (raw) => {
    const base = norm(raw);
    if (!base) return;
    const candidates = [base, stripExt(base)];
    candidates.forEach((candidate) => {
      if (!candidate) return;
      const noSpace = candidate.replace(/\s+/g, '');
      const underscored = candidate.replace(/\s+/g, '_');
      [candidate, noSpace, underscored, stripExt(noSpace), stripExt(underscored)].forEach((form) => {
        if (form) keys.add(form);
      });
    });
  };

  if (typeof value === 'string') {
    pushForms(value);
    if (value.includes('/')) pushForms(value.split('/').pop());
    if (value.includes('\\')) pushForms(value.split('\\').pop());
  } else {
    pushForms(value);
  }

  return Array.from(keys).filter(Boolean);
}

function canonicalMode(raw) {
  const m = norm(raw);
  if (!m) return 'unknown';
  if (m.includes('grammar')) return m.replace(/\s+/g, '_');
  if (m === 'sentence' || m.includes('sentence')) return 'sentence';
  if (m === 'matching' || m.startsWith('matching_') || m === 'meaning') return 'meaning';
  if (m === 'phonics_listening' || m === 'listen' || m === 'listening' || (m.startsWith('listening_') && !m.includes('spell'))) return 'listening';
  if (m.includes('listen') && m.includes('spell')) return 'listen_and_spell';
  if (m === 'multi_choice' || m.includes('multi_choice') || m.includes('picture_multi_choice') || m === 'easy_picture' || m === 'picture' || m === 'picture_mode' || m.includes('read')) return 'multi_choice';
  if (m === 'spelling' || m === 'missing_letter' || (m.includes('spell') && !m.includes('listen'))) return 'spelling';
  if (m.includes('level_up')) return 'level_up';
  return m;
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
    if (summary.grammarName) names.push(summary.grammarName);
    if (summary.grammar) names.push(summary.grammar);
  }

  let meta = session.meta || summary?.meta;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch { meta = null; }
  }
  if (meta && typeof meta === 'object') {
    ['grammarName', 'grammar', 'list', 'listName', 'file', 'name'].forEach((key) => {
      if (meta[key]) names.push(meta[key]);
    });
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

function matchesGrammarList(item, name) {
  if (!item) return false;
  const targetKeys = new Set(buildGrammarKeys(name));
  if (!targetKeys.size) return false;

  const pushValues = [];
  pushValues.push(item.label, item.file, item.id);
  if (item.config && typeof item.config === 'object') {
    pushValues.push(item.config.listName, item.config.lessonId, item.config.grammarName, item.config.lessonModule);
  }
  if (Array.isArray(item.aliases)) pushValues.push(...item.aliases);

  const candidateKeys = new Set();
  pushValues.forEach((value) => {
    buildGrammarKeys(value).forEach((key) => candidateKeys.add(key));
  });

  if (!candidateKeys.size) return false;
  for (const key of targetKeys) {
    if (candidateKeys.has(key)) return true;
  }
  return false;
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
      const canonical = canonicalMode(session.mode);
      const raw = norm(session.mode);
      [canonical, raw].forEach((mode) => {
        if (!mode) return;
        if (!(mode in bestByMode) || bestByMode[mode] < pct) {
          bestByMode[mode] = pct;
        }
      });
    });

    let total = 0;
    modeIds.forEach((mode) => {
      const pct = bestByMode[mode];
      total += typeof pct === 'number' ? pct : 0;
    });
    return Math.round(total / modeIds.length);
  });
}

function isGrammarSession(session) {
  const summary = parseSummary(session.summary);
  const category = norm(summary?.category || session.category);
  const mode = norm(session.mode);
  if (category === 'grammar') return true;
  if (mode && mode.includes('grammar')) return true;
  return false;
}

function identifyGrammarBucket(mode) {
  const m = norm(mode);
  if (!m) return null;
  if (m.includes('lesson')) return 'lesson';
  if (m.includes('fill') && m.includes('gap')) return 'fill';
  if (m.includes('unscramble')) return 'unscramble';
  if (m.includes('sentence') && m.includes('grammar')) return 'unscramble';
  if (m.includes('choose')) return 'choose';
  if (m === 'grammar_mode') return 'choose';
  if (m === 'grammar') return 'choose';
  return null;
}

function computeGrammarLevelProgress(lists, sessions) {
  return lists.map((item) => {
    const best = {
      lesson: null,
      choose: null,
      fill: null,
      unscramble: null,
    };

    sessions.forEach((session) => {
      if (!isGrammarSession(session)) return;
      const names = collectSessionNames(session) || [];
      if (!names.some((name) => matchesGrammarList(item, name))) return;
      const bucket = identifyGrammarBucket(session.mode);
      if (!bucket) return;
      const summary = parseSummary(session.summary);
      const pct = extractPercent(session, summary);
      if (pct == null) return;
      if (best[bucket] == null || best[bucket] < pct) {
        best[bucket] = pct;
      }
    });

    const total =
      (best.lesson ?? 0) * 0.25 +
      (best.choose ?? 0) * 0.25 +
      (best.fill ?? 0) * 0.25 +
      (best.unscramble ?? 0) * 0.25;

    return Math.round(total);
  });
}

function computeStarCountsFromSessions(sessions) {
  const byLevel = {
    level0: new Map(),
    level1: new Map(),
    level2: new Map(),
    level3: new Map(),
    level4: new Map(),
    grammarLevel1: new Map(),
    grammarLevel2: new Map(),
    grammarLevel3: new Map(),
    grammarLevel4: new Map(),
  };

  const normName = (value) => norm(value);
  const grammarModes = MODE_GROUPS.grammar;

  sessions.forEach((session) => {
    const summary = parseSummary(session.summary);
    const mode = canonicalMode(session.mode);
    const category = normName(summary?.category || session.category);
    const isGrammar = category === 'grammar' || (mode && mode.includes('grammar'));

    if (isGrammar) {
      const hints = new Set();
      const pushHint = (val) => {
        const n = normName(val);
        if (n) hints.add(n);
      };

      pushHint(session.list_name);
      if (summary) {
        pushHint(summary.list_name);
        pushHint(summary.listName);
        pushHint(summary.list);
        pushHint(summary.name);
        pushHint(summary.file);
        pushHint(summary.grammarName);
        pushHint(summary.grammar);
      }

      const metaRaw = session.meta || summary?.meta;
      if (metaRaw) {
        let metaObj = metaRaw;
        if (typeof metaObj === 'string') {
          try { metaObj = JSON.parse(metaObj); } catch { metaObj = null; }
        }
        if (metaObj && typeof metaObj === 'object') {
          ['file', 'list', 'listName', 'grammarName', 'grammar', 'level'].forEach((key) => pushHint(metaObj[key]));
        }
      }

      const hintList = Array.from(hints).filter(Boolean);
      const canonicalHints = hintList.map((hint) => canonKey(hint)).filter(Boolean);
      const targetKey = canonicalHints[0] || hintList[0] || 'grammar_level1';
      const allHints = [...canonicalHints, ...hintList];

      let bucketKey = 'grammarLevel1';
      if (allHints.some((h) => /level\s*4/.test(h) || h.includes('level4'))) bucketKey = 'grammarLevel4';
      else if (allHints.some((h) => /level\s*3/.test(h) || h.includes('level3'))) bucketKey = 'grammarLevel3';
      else if (allHints.some((h) => /level\s*2/.test(h) || h.includes('level2'))) bucketKey = 'grammarLevel2';
      else if (allHints.some((h) => /level\s*1/.test(h) || h.includes('level1'))) bucketKey = 'grammarLevel1';
      else if (allHints.some((h) => h === 'a vs an' || h.includes('articles') || h.includes('a_vs_an'))) bucketKey = 'grammarLevel1';

      const bucket = byLevel[bucketKey];
      if (bucket) {
        if (!bucket.has(targetKey)) bucket.set(targetKey, {});
        const best = bucket.get(targetKey);
        const pct = extractPercent(session, summary);
        if (pct != null) {
          if (!(mode in best) || best[mode] < pct) {
            best[mode] = pct;
          }
        }
      }
      return;
    }

    const listName = normName(session.list_name) || normName(summary?.list_name || summary?.listName);
    if (!listName) return;

    let bucket = null;
    if (/^phonics\s*-?/i.test(listName) || /sound/i.test(listName)) bucket = 'level0';
    else if (/^level\s*2\s*-?/i.test(listName)) bucket = 'level2';
    else if (/^level\s*3\s*-?/i.test(listName)) bucket = 'level3';
    else if (/^level\s*4\s*-?/i.test(listName)) bucket = 'level4';
    else if (/\.json$/i.test(listName)) bucket = 'level1';
    if (!bucket) return;

    const key = listName.toLowerCase();
    if (!byLevel[bucket].has(key)) byLevel[bucket].set(key, {});
    const best = byLevel[bucket].get(key);
    const pct = extractPercent(session, summary);
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
    level4: sumStars(byLevel.level4, generalModes),
    grammarLevel1: sumStars(byLevel.grammarLevel1, grammarModes),
    grammarLevel2: sumStars(byLevel.grammarLevel2, grammarModes),
    grammarLevel3: sumStars(byLevel.grammarLevel3, grammarModes),
    grammarLevel4: sumStars(byLevel.grammarLevel4, grammarModes),
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

export async function loadGrammarLevelProgress(lists) {
  return progressCache.fetchWithCache(CACHE_KEYS.grammarLevel1, async () => {
    const sessions = await fetchAllSessions();
    const values = computeGrammarLevelProgress(lists, sessions);
    return ensureProgressPayload(values);
  });
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
