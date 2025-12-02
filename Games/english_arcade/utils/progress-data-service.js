// Shared progress data service
// Fetches progress_summary once and derives level progress + star counts

import { FN } from '../scripts/api-base.js';
import { progressCache } from './progress-cache.js';

const MODE_GROUPS = {
  general: ['meaning', 'listening', 'multi_choice', 'listen_and_spell', 'sentence', 'level_up'],
  phonics: ['listening', 'spelling', 'multi_choice', 'listen_and_spell'],
  // Include all grammar modes, including new Level 2 ones
  grammar: ['grammar_mode', 'grammar_choose', 'grammar_lesson', 'grammar_lesson_it_vs_they', 'grammar_lesson_am_are_is', 'grammar_lesson_this_that', 'grammar_lesson_these_those', 'grammar_lesson_have_has', 'grammar_lesson_want_wants', 'grammar_lesson_like_likes', 'grammar_lesson_contractions_be', 'grammar_lesson_in_on_under', 'grammar_lesson_plurals_s', 'grammar_lesson_plurals_es', 'grammar_lesson_plurals_ies', 'grammar_lesson_plurals_irregular', 'grammar_lesson_countable_uncountable', 'grammar_fill_gap', 'grammar_sentence_unscramble', 'grammar_sorting', 'grammar_find_mistake', 'grammar_translation_choice', 'grammar_sentence_order'],
};

const CACHE_KEYS = {
  level1: 'level1_progress',
  level2: 'level2_progress',
  level3: 'level3_progress',
  level4: 'level4_progress',
  phonics: 'phonics_progress',
  grammarLevel1: 'grammar_level1_progress',
  grammarLevel2: 'grammar_level2_progress',
  grammarLevel3: 'grammar_level3_progress',
  stars: 'level_stars',
};

const SESSION_CACHE_WINDOW_MS = 30 * 1000; // allow reuse for rapid consecutive requests
let sessionCache = null;
let sessionCacheTimestamp = 0;
let sessionInflightPromise = null;

function parseLevelNumber(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

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
    // If accuracy > 1, assume it's already a percentage (0-100); otherwise treat as decimal (0-1)
    const acc = sum.accuracy || 0;
    return Math.round(acc > 1 ? acc : acc * 100);
  }
  if (typeof session.correct === 'number' && typeof session.total === 'number' && session.total > 0) {
    return Math.round((session.correct / session.total) * 100);
  }
  if (typeof session.accuracy === 'number') {
    // If accuracy > 1, assume it's already a percentage (0-100); otherwise treat as decimal (0-1)
    const acc = session.accuracy || 0;
    return Math.round(acc > 1 ? acc : acc * 100);
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
  if (m.includes('sentence_order') || m.includes('sentenceorder')) return 'sentence_order';
  if (m.includes('unscramble')) return 'unscramble';
  if (m.includes('sentence') && m.includes('grammar')) return 'unscramble';
  if (m.includes('choose')) return 'choose';
  if (m === 'grammar_mode') return 'choose';
  if (m === 'grammar') return 'choose';
  if (m.includes('sorting')) return 'sorting';
  if (m.includes('find_mistake')) return 'find';
  if (m.includes('translation')) return 'translate';
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

// Level 2 grammar progress: track completion across six modes (Sorting, Choose, Fill, Unscramble, Find, Translation)
function computeGrammarLevel2Progress(lists, sessions) {
  const TOTAL_MODES = 6;
  // Expose per-item bucket data for UI overrides (e.g., custom fraction display)
  if (typeof window !== 'undefined') {
    if (!window.__GRAMMAR_L2_BUCKETS || typeof window.__GRAMMAR_L2_BUCKETS !== 'object') {
      window.__GRAMMAR_L2_BUCKETS = {};
    }
  }
  return lists.map((item) => {
    const best = {
      sorting: null,
      choose: null,
      fill: null,
      unscramble: null,
      find: null,
      translate: null,
    };

    sessions.forEach((session) => {
      if (!isGrammarSession(session)) return;
      const names = collectSessionNames(session) || [];
      if (!names.some((name) => matchesGrammarList(item, name))) return;
      const bucket = identifyGrammarBucket(session.mode);
      if (!bucket || !(bucket in best)) return;
      const summary = parseSummary(session.summary);
      const pct = extractPercent(session, summary);
      if (pct == null) return;
      if (best[bucket] == null || best[bucket] < pct) best[bucket] = pct;
    });

    // Check if this is the WH Questions list (which has no Sorting mode)
    const isWhQuestionsList = item.id === 'present_simple_questions_wh' || item.id === 'present_progressive_questions_wh' || 
                               (item.file && /questions_wh\.json$/i.test(item.file));
    
  // Special case: original WH question lists have 5 modes (no Sorting)
  // Special case: WH micro lists (who/what, where/when/what time, how/why/which) currently only offer 4 modes (Sorting & Choose hidden)
  const isWhoWhatList = item.id === 'wh_who_what';
  const isWhereWhenWhatTimeList = item.id === 'wh_where_when_whattime';
  const isHowWhyWhichList = item.id === 'wh_how_why_which';
  const isWhMicroList = isWhoWhatList || isWhereWhenWhatTimeList || isHowWhyWhichList;
  const weight = isWhMicroList ? (1/4) : (isWhQuestionsList ? (1/5) : (1/6));
    
    let attempted = 0;
    Object.values(best).forEach((pct) => { if (typeof pct === 'number') attempted++; });
    
    let total;
    if (isWhMicroList) {
      // Only four active modes: fill, unscramble, find, translate
      total =
        (best.fill ?? 0) * weight +
        (best.unscramble ?? 0) * weight +
        (best.find ?? 0) * weight +
        (best.translate ?? 0) * weight;
    } else if (isWhQuestionsList) {
      // WH questions: 5 modes (no Sorting)
      total =
        (best.choose ?? 0) * weight +
        (best.fill ?? 0) * weight +
        (best.unscramble ?? 0) * weight +
        (best.find ?? 0) * weight +
        (best.translate ?? 0) * weight;
    } else {
      // Standard: 6 modes including Sorting
      total =
        (best.sorting ?? 0) * weight +
        (best.choose ?? 0) * weight +
        (best.fill ?? 0) * weight +
        (best.unscramble ?? 0) * weight +
        (best.find ?? 0) * weight +
        (best.translate ?? 0) * weight;
    }

    // Persist bucket detail for UI layer (non-reactive; refreshed each fetch)
    if (typeof window !== 'undefined') {
      try { window.__GRAMMAR_L2_BUCKETS[item.id] = { ...best }; } catch { /* ignore */ }
    }
    return Math.round(total);
  });
}

// Level 3 grammar progress: track completion across six modes (Choose, Fill, Unscramble, Sentence Order, Find, Translation)
function computeGrammarLevel3Progress(lists, sessions) {
  return lists.map((item) => {
    const best = {
      choose: null,
      fill: null,
      unscramble: null,
      sentence_order: null,
      find: null,
      translate: null,
    };

    sessions.forEach((session) => {
      if (!isGrammarSession(session)) return;
      const names = collectSessionNames(session) || [];
      if (!names.some((name) => matchesGrammarList(item, name))) return;
      const bucket = identifyGrammarBucket(session.mode);
      if (!bucket || !(bucket in best)) return;
      const summary = parseSummary(session.summary);
      const pct = extractPercent(session, summary);
      if (pct == null) return;
      if (best[bucket] == null || best[bucket] < pct) best[bucket] = pct;
    });

    const weight = 1 / 6; // Equal weighting across 6 modes
    const total =
      (best.choose ?? 0) * weight +
      (best.fill ?? 0) * weight +
      (best.unscramble ?? 0) * weight +
      (best.sentence_order ?? 0) * weight +
      (best.find ?? 0) * weight +
      (best.translate ?? 0) * weight;

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

  // Debug: log all grammar sessions to see what data we have
  sessions.forEach((session) => {
    const summary = parseSummary(session.summary);
    const mode = canonicalMode(session.mode);
    const category = normName(summary?.category || session.category);
    const isGrammar = category === 'grammar' || (mode && mode.includes('grammar'));
    if (isGrammar) {
      let meta = session.meta;
      if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = null; } }
      const lvl = meta?.level;
      if (lvl === 3 || lvl === '3' || String(lvl) === '3') {
        console.debug('[GrammarStars DEBUG] Found L3 session:', { mode, category, level: lvl, list_name: session.list_name, meta });
      }
    }
  });

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
        pushHint(summary.grammarFile);
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

      // Numeric level extraction (meta.level or summary.level)
      let numericLevel = null;
      try {
        if (numericLevel == null) {
          const rawNum = summary?.level;
          const parsed = parseLevelNumber(rawNum);
          if (parsed != null) numericLevel = parsed;
        }
      } catch {}
      try {
        if (numericLevel == null) {
          const metaRaw2 = session.meta || summary?.meta;
          let metaObj2 = metaRaw2;
          if (typeof metaObj2 === 'string') { try { metaObj2 = JSON.parse(metaObj2); } catch { metaObj2 = null; } }
          const parsedMeta = parseLevelNumber(metaObj2?.level);
          if (parsedMeta != null) numericLevel = parsedMeta;
        }
      } catch {}

      // Decide which grammar level bucket to use.
      // Priority: explicit numeric > path/name hints > explicit list-name mapping > special cases.
      let bucketKey = 'grammarLevel1';
      const isExplicitLevel = (h, n) => new RegExp(`level\s*${n}\b`).test(h) || h.includes(`level${n}`);
      const looksLikeLevelPath = (h, n) => h.includes(`/level${n}/`) || h.includes(`\\level${n}\\`);
      const altLevelToken = (h, n) => h.includes(`lvl${n}`) || h === `l${n}` || h.includes(`l${n}_`) || h.includes(`l${n}-`);

      // Static Level 2 list name mapping (fallback when file/path hints missing)
      // Mirrors labels defined in level2_grammar_modal.js
      const RAW_LEVEL2_LABELS = [
        'Some vs Any','There is vs There are','Is there vs Are there?','WH: Who & What','WH: Where, When & Time','WH: How, Why & Which',
        'Short Questions 1','Short Questions 2','Present Simple: Sentences','Present Simple: Negative','Present Simple: Yes/No Questions','Present Simple: WH Questions',
        'Present Progressive','Present Progressive: Negative','Present Progressive: Yes/No','Present Progressive: WH Questions','Simple vs Progressive',
        'Prepositions: Between, Above, Below','Prepositions: Next to, Behind, In front','Prepositions: Near, Across from','Prepositions: Review',
        'Time: In, On, At','How Many & Counting'
      ];
      // Build canonical forms once (lazy init) and allow override via window.__WA_GRAMMAR_L2_NAMES
      let LEVEL2_NAME_SET = computeStarCountsFromSessions.__LEVEL2_NAME_SET;
      if (!LEVEL2_NAME_SET) {
        LEVEL2_NAME_SET = new Set();
        const source = Array.isArray(window?.__WA_GRAMMAR_L2_NAMES) ? window.__WA_GRAMMAR_L2_NAMES : RAW_LEVEL2_LABELS;
        source.forEach(lbl => {
          const raw = norm(lbl);
          if (raw) LEVEL2_NAME_SET.add(raw);
          const ck = canonKey(lbl);
          if (ck) LEVEL2_NAME_SET.add(ck);
        });
        computeStarCountsFromSessions.__LEVEL2_NAME_SET = LEVEL2_NAME_SET;
      }

      const hintSet = new Set(allHints);
      // Add raw (non-canonical) lowercase hints too for direct match
      hintList.forEach(h => hintSet.add(norm(h)));

      if (numericLevel === 4 || allHints.some(h => isExplicitLevel(h,4) || looksLikeLevelPath(h,4) || altLevelToken(h,4))) bucketKey = 'grammarLevel4';
      else if (numericLevel === 3 || allHints.some(h => isExplicitLevel(h,3) || looksLikeLevelPath(h,3) || altLevelToken(h,3))) bucketKey = 'grammarLevel3';
      else if (numericLevel === 2 || allHints.some(h => isExplicitLevel(h,2) || looksLikeLevelPath(h,2) || altLevelToken(h,2))) bucketKey = 'grammarLevel2';
      else if (
        // Fallback: explicit Level 2 list names
        [...hintSet].some(h => LEVEL2_NAME_SET.has(h))
      ) {
        bucketKey = 'grammarLevel2';
      } else if (numericLevel === 1 || allHints.some(h => isExplicitLevel(h,1) || looksLikeLevelPath(h,1) || altLevelToken(h,1))) bucketKey = 'grammarLevel1';
      else if (allHints.some((h) => h === 'a vs an' || h.includes('articles') || h.includes('a_vs_an'))) bucketKey = 'grammarLevel1';

      // Optional debug: show reasoning for grammar sessions defaulting to Level 1
      if (typeof window !== 'undefined' && window.__WA_DEBUG_GRAMMAR_STARS) {
        try {
          if (bucketKey === 'grammarLevel1') {
            console.debug('[GrammarStars] Defaulted to L1. numericLevel=', numericLevel, 'hints=', hintList.slice(0,8));
          }
          if (bucketKey === 'grammarLevel2') {
            console.debug('[GrammarStars] Mapped session to L2 via hints:', hintList.slice(0,8));
          }
        } catch {}
      }

      // Always log Level 3 grammar bucket decisions for debugging
      if (numericLevel === 3 || bucketKey === 'grammarLevel3') {
        console.debug('[GrammarStars L3] bucketKey=', bucketKey, 'numericLevel=', numericLevel, 'mode=', mode, 'hints=', hintList.slice(0,5));
      }

      const pct = extractPercent(session, summary);
      if (pct != null) {
        const bucket = byLevel[bucketKey];
        if (bucket) {
          if (!bucket.has(targetKey)) bucket.set(targetKey, {});
          const best = bucket.get(targetKey);
          if (!(mode in best) || best[mode] < pct) {
            best[mode] = pct;
          }
        }
        // Secondary insertion by numericLevel - only if bucketKey doesn't already match
        // to avoid double-counting stars when both path hints and numeric level are present
        if (numericLevel != null) {
          const lvlBucketName = `grammarLevel${numericLevel}`;
          if (lvlBucketName !== bucketKey) {
            const lvlBucket = byLevel[lvlBucketName];
            if (lvlBucket) {
              const lvlKey = targetKey || `${lvlBucketName}_auto`;
              if (!lvlBucket.has(lvlKey)) lvlBucket.set(lvlKey, {});
              const lvlBest = lvlBucket.get(lvlKey);
              if (!(mode in lvlBest) || lvlBest[mode] < pct) {
                lvlBest[mode] = pct;
              }
            }
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

  const counts = {
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
  
  // Debug: log grammarLevel3 bucket contents
  console.debug('[GrammarStars] grammarLevel3 bucket size:', byLevel.grammarLevel3.size);
  byLevel.grammarLevel3.forEach((bestByMode, key) => {
    console.debug('[GrammarStars] grammarLevel3 entry:', key, bestByMode);
  });
  console.debug('[GrammarStars] grammarLevel3 star count:', counts.grammarLevel3);
  
  return counts;
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

export async function loadGrammarLevel2Progress(lists) {
  return progressCache.fetchWithCache(CACHE_KEYS.grammarLevel2, async () => {
    const sessions = await fetchAllSessions();
    const values = computeGrammarLevel2Progress(lists, sessions);
    return ensureProgressPayload(values);
  });
}

export async function loadGrammarLevel3Progress(lists) {
  return progressCache.fetchWithCache(CACHE_KEYS.grammarLevel3, async () => {
    const sessions = await fetchAllSessions();
    const values = computeGrammarLevel3Progress(lists, sessions);
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
