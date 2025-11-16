// Grammar Sentence Unscramble Mode
// Reuses the core sentence mode engine but feeds it grammar example sentences
// and logs under a dedicated grammar mode name for progress tracking.

import { run as runSentenceMode } from './word_sentence_mode.js';

const AUDIO_ENDPOINTS = [
  '/.netlify/functions/get_audio_urls',
  'http://localhost:9000/.netlify/functions/get_audio_urls',
  'http://127.0.0.1:9000/.netlify/functions/get_audio_urls',
  'http://localhost:8888/.netlify/functions/get_audio_urls',
  'http://127.0.0.1:8888/.netlify/functions/get_audio_urls'
];

function normalizeForGrammarKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getGrammarField(item, key) {
  if (!item) return '';
  if (item[key]) return item[key];
  if (item.grammarMeta && item.grammarMeta[key]) return item.grammarMeta[key];
  return '';
}

function buildGrammarAudioCandidates(item) {
  const candidates = [];
  const seen = new Set();
  const add = (key) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push(key);
  };
  const wordBase = normalizeForGrammarKey(getGrammarField(item, 'word'));
  const articleBase = normalizeForGrammarKey(getGrammarField(item, 'article'));
  const idBase = normalizeForGrammarKey(getGrammarField(item, 'id'));
  
  // Fix: Try sentence-specific audio first (using id which maps to sentence)
  if (idBase) add(`${idBase}_grammar`);
  if (idBase && articleBase) add(`${idBase}_${articleBase}_grammar`);
  
  // Fallback: word + article combination
  if (wordBase && articleBase) add(`${wordBase}_${articleBase}_grammar`);
  if (wordBase) add(`${wordBase}_grammar`);
  return candidates;
}

async function hydrateGrammarAudio(items) {
  if (!Array.isArray(items) || !items.length) return;
  const candidateMap = new Map();
  const allCandidates = new Set();

  items.forEach((item) => {
    const candidates = buildGrammarAudioCandidates(item);
    if (!candidates.length) return;
    candidateMap.set(item, candidates);
    candidates.forEach((key) => allCandidates.add(key));
  });

  if (!candidateMap.size) return;

  const words = Array.from(allCandidates);
  let results = null;

  const isSecureOrigin = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
  const endpoints = AUDIO_ENDPOINTS.filter((url) => {
    if (!isSecureOrigin) return true;
    return !/^http:\/\//i.test(url);
  });

  for (const endpoint of endpoints) {
    try {
      const init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words })
      };
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        init.signal = AbortSignal.timeout(10000);
      }
      const res = await fetch(endpoint, init);
      if (!res.ok) {
        console.warn('[GrammarUnscramble] audio lookup failed', endpoint, res.status);
        continue;
      }
      const data = await res.json();
      if (data && data.results && typeof data.results === 'object') {
        results = data.results;
        break;
      }
    } catch (err) {
      console.debug('[GrammarUnscramble] audio lookup error', endpoint, err?.message);
    }
  }

  if (!results) return;

  candidateMap.forEach((candidates, item) => {
    for (const key of candidates) {
      const lower = key?.toLowerCase?.();
      const withExt = `${key}.mp3`;
      const lowerExt = lower ? `${lower}.mp3` : null;
      const info = results[key]
        || (lower && results[lower])
        || results[withExt]
        || (lowerExt && results[lowerExt])
        || null;
      if (info && info.exists && info.url) {
        item.sentenceAudioUrl = info.url;
        item.audio_key = key;
        break;
      }
    }
  });
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function runGrammarSentenceUnscramble(ctx) {
  const {
    grammarFile,
    grammarName,
    inlineToast,
    showOpeningButtons,
  } = ctx || {};

  if (!grammarFile) {
    inlineToast?.('Error: No grammar file selected');
    return;
  }

  let rawData = [];
  try {
    const res = await fetch(grammarFile);
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    rawData = await res.json();
  } catch (err) {
    console.error('[GrammarUnscramble] Unable to load grammar data', err);
    inlineToast?.('Could not load grammar sentences');
    showOpeningButtons?.(true);
    return;
  }

  // Accept broader shapes: use exampleSentence/example/sentence or sentences[]; word is optional
  const candidates = Array.isArray(rawData)
    ? rawData.filter((item) => {
        if (!item) return false;
        if (item.exampleSentence || item.example || item.sentence) return true;
        if (Array.isArray(item.sentences) && item.sentences.length) return true;
        return false;
      })
    : [];

  if (!candidates.length) {
    inlineToast?.('This grammar lesson has no sentences yet.');
    showOpeningButtons?.(true);
    return;
  }

  const mapped = candidates.map((item, index) => {
    const sentence = String(item.exampleSentence || item.example || item.sentence || (Array.isArray(item.sentences) && item.sentences[0]?.text) || '').trim();
    const translation = String(item.exampleSentenceKo || item.sentence_kor || item.kor || item.ko || (Array.isArray(item.sentences) && (item.sentences[0]?.ko || item.sentences[0]?.kor)) || '').trim();
    // Prefer stable id if present, else derive from en/word + index
    const baseId = item.id || `${(item.word || item.en || 'sentence')}_${index}`;
    const payload = {
      eng: item.word || item.en || (sentence ? sentence.split(/\s+/).slice(0,2).join(' ') : 'Sentence'),
      sentence,
      sentence_kor: translation,
      article: item.article,
      word: item.word,
      id: baseId,
      grammarMeta: {
        article: item.article,
        word: item.word || item.en,
      },
    };
    if (sentence) {
      payload.sentences = [{ id: baseId, text: sentence, weight: 1, ko: translation }];
    }
    return payload;
  });

  try {
    await hydrateGrammarAudio(mapped);
  } catch (err) {
    console.debug('[GrammarUnscramble] Audio hydrate failed', err?.message);
  }

  mapped.forEach((item) => {
    if (!item.sentenceAudioUrl) {
      console.debug('[GrammarUnscramble] sentence audio missing', item.eng, buildGrammarAudioCandidates(item));
    }
  });

  const usable = shuffle(mapped).slice(0, 15);

  const layoutOverrides = {
    hideTitle: true,
    centerContent: true,
    showQuitButton: true,
    skipIntro: true,
    quitButtonId: 'grammarQuitBtn',
    quitButtonLabel: 'Quit Game',
  };

  const forwardedCtx = {
    ...ctx,
    wordList: usable,
    listName: grammarName || ctx?.listName || 'Grammar Sentences',
    sessionMode: 'grammar_sentence_unscramble',
    grammarFile,
    grammarName,
    // Mount into the main game area so HistoryManager restores are visible
    gameArea: document.getElementById('gameArea') || ctx?.gameArea || document.getElementById('gameStage') || document.body,
    sentenceLayout: { ...(ctx?.sentenceLayout || {}), ...layoutOverrides },
    onSentenceQuit: () => {
      try {
        if (window.WordArcade?.startGrammarModeSelector) {
          window.WordArcade.startGrammarModeSelector();
          return;
        }
      } catch {}
      showOpeningButtons?.(true);
    },
  };

  runSentenceMode(forwardedCtx);
}
