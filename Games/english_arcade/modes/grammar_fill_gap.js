// Grammar Fill-The-Gap Mode
// Presents the example sentence with the article removed so students type the missing word.
// Logs progress via records.js just like the other grammar games, and dispatches the
// wa:session-ended event so stars/upgrades refresh automatically.

import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { buildPrepositionScene, isInOnUnderMode } from './grammar_prepositions_data.js';
import { renderGrammarSummary } from './grammar_summary.js';

const AUDIO_ENDPOINTS = [
  '/.netlify/functions/get_audio_urls',
  'http://localhost:9000/.netlify/functions/get_audio_urls',
  'http://127.0.0.1:9000/.netlify/functions/get_audio_urls',
  'http://localhost:8888/.netlify/functions/get_audio_urls',
  'http://127.0.0.1:8888/.netlify/functions/get_audio_urls'
];

const sentenceAudioCache = new Map();
let activeSentenceAudio = null;

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
  const sentence = String(item?.exampleSentence || '').trim();

  // Generate sentence hash for uniqueness
  let hash = 0;
  for (let i = 0; i < sentence.length; i++) {
    const char = sentence.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  hash = Math.abs(hash) % 10000;
  const hashStr = hash.toString().padStart(4, '0');

  // Try exact id first, then with hash, then fallbacks
  if (idBase) add(`${idBase}_grammar`);
  if (idBase) add(`${idBase}_${hashStr}_grammar`);
  if (wordBase && articleBase) add(`${wordBase}_${articleBase}_grammar`);
  if (wordBase && articleBase) add(`${wordBase}_${articleBase}_${hashStr}_grammar`);
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
  const isSecureOrigin = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
  const endpoints = AUDIO_ENDPOINTS.filter((url) => {
    if (!isSecureOrigin) return true;
    return !/^http:\/\//i.test(url);
  });

  let results = null;

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
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.results && typeof data.results === 'object') {
        results = data.results;
        break;
      }
    } catch (err) {
      console.debug('[GrammarFillGap] audio lookup error', endpoint, err?.message);
    }
  }

  if (!results) return;

  candidateMap.forEach((candidates, item) => {
    for (const key of candidates) {
      const lower = key?.toLowerCase?.();
      const variants = [key, lower, `${key}.mp3`, lower ? `${lower}.mp3` : null];
      const info = variants
        .map((variant) => (variant ? results[variant] : null))
        .find((record) => record && record.exists && record.url);
      if (info) {
        item.sentenceAudioUrl = info.url;
        item.audio_key = key;
        break;
      }
    }
  });
}

function getSentenceText(item) {
  return String(item?.exampleSentence || item?.example || item?.sentence || '').trim();
}

async function playSentenceClip(item, playTTS) {
  if (!item) return;
  const url = item.sentenceAudioUrl;
  const sentence = getSentenceText(item);

  if (activeSentenceAudio) {
    try { activeSentenceAudio.pause(); } catch {}
    try { activeSentenceAudio.currentTime = 0; } catch {}
    activeSentenceAudio = null;
  }

  if (url) {
    try {
      let audio = sentenceAudioCache.get(url);
      if (!audio) {
        audio = new Audio(url);
        audio.preload = 'auto';
        sentenceAudioCache.set(url, audio);
      }
      activeSentenceAudio = audio;
      audio.currentTime = 0;
      await audio.play();
      return;
    } catch (err) {
      console.debug('[GrammarFillGap] sentence audio play failed', err?.message);
    }
  }

  if (typeof playTTS === 'function' && sentence) {
    try { playTTS(sentence); } catch {}
  }
}

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'grammar-fill-gap-styles';
  style.textContent = `
    .fg-root { display:flex; flex-direction:column; align-items:center; justify-content:flex-start; width:100%; gap:clamp(30px, 4vh, 44px); padding:clamp(32px, 6vh, 56px) clamp(18px, 8vw, 36px) clamp(40px, 8vh, 60px); font-family:'Poppins', Arial, sans-serif; background:#ffffff; box-sizing:border-box; min-height:calc(100vh - 220px); }
    .fg-content { width:100%; max-width:640px; display:flex; flex-direction:column; gap:clamp(30px, 5vh, 42px); position:relative; }
    .fg-counter { font-size:0.82rem; font-weight:700; color:#19777e; text-transform:uppercase; letter-spacing:0.08rem; }
  .fg-emoji { font-size:4rem; text-align:center; filter:drop-shadow(0 8px 24px rgba(0,0,0,0.08)); display:flex; align-items:center; justify-content:center; }
    .fg-word { text-align:center; font-size:clamp(2rem, 8vw, 3rem); font-weight:800; color:#21b3be; letter-spacing:0.04em; }
    .fg-sentence { font-size:1.15rem; line-height:1.55; color:#0f172a; background:#f2fbfc; border-radius:18px; padding:16px 18px; border:2px solid rgba(33,181,192,0.24); }
    .fg-sentence strong { color:#19777e; font-weight:800; }
    .fg-chip-row { display:flex; justify-content:center; gap:clamp(12px, 3vw, 18px); flex-wrap:wrap; }
    .fg-chip { font-family:inherit; font-weight:700; font-size:clamp(0.9rem, 2.5vw, 1.05rem); padding:clamp(10px, 2vh, 12px) clamp(18px, 4vw, 24px); border-radius:999px; border:3px solid #21b3be; background:#ffffff; color:#21b3be; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease, border-color .18s ease; box-shadow:0 16px 32px -16px rgba(0,0,0,0.25); letter-spacing:0.05em; min-width:clamp(60px, 15vw, 80px); }
    .fg-chip:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 22px -10px rgba(0,0,0,0.28); background:#f1feff; }
    .fg-chip:active:not(:disabled) { transform:scale(0.94); }
    .fg-chip:disabled { opacity:0.45; cursor:default; box-shadow:none; }
    .fg-chip.fg-correct { background:#21b3be; color:#ffffff; border-color:#21b3be; box-shadow:0 18px 40px -16px rgba(33,179,190,0.55); opacity:1; }
    .fg-chip.fg-wrong { border-color:#f87171; color:#b91c1c; box-shadow:0 12px 30px -18px rgba(248,113,113,0.55); opacity:1; }
    .fg-hint { text-align:center; color:#8096a8; font-size:0.98rem; min-height:1.2rem; }
    .fg-feedback { text-align:center; font-size:1.05rem; font-weight:700; min-height:1.4rem; letter-spacing:0.02em; }
    .fg-reveal { font-size:1rem; color:#0f172a; background:#fff7ed; border-radius:18px; padding:16px 18px; border:2px solid #fdba74; text-align:center; }
    .fg-footer { width:100%; display:flex; justify-content:center; }
    .fg-actions { display:flex; justify-content:center; gap:16px; flex-wrap:wrap; margin-top:6px; }
    .fg-btn { font-family:inherit; font-weight:800; font-size:1.05rem; padding:14px 32px; border-radius:18px; border:2px solid transparent; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease; }
    .fg-btn.primary { background:#21b3be; color:#ffffff; border-color:#21b3be; box-shadow:0 18px 36px -14px rgba(20,126,130,0.55); }
    .fg-btn.primary:hover { transform:translateY(-2px); box-shadow:0 22px 34px -12px rgba(20,126,130,0.55); }
  #gameArea #grammarQuitBtn { z-index: 1100 !important; }
    .fg-summary-card { width:min(520px, 85vw); margin:clamp(30px,5vh,50px) auto; background:#ffffff; border-radius:20px; border:2px solid #cbeef0; padding:clamp(14px,3.5vw,24px) clamp(12px,4vw,20px); box-shadow:0 24px 54px -22px rgba(20,126,130,0.45); text-align:center; display:flex; flex-direction:column; gap:clamp(10px,2.5vw,16px); box-sizing:border-box; }
    .fg-summary-card h2 { margin:0; font-size:clamp(1.4rem,5vw,1.8rem); color:#19777e; font-weight:800; }
    .fg-summary-card .fg-score { font-size:clamp(0.9rem,3.5vw,1.1rem); font-weight:700; color:#0f172a; line-height:1.5; }
    .fg-summary-card .fg-score strong { color:#21b3be; }
  `;
  document.head.appendChild(style);
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Detect present simple verb-contrast lists (e.g. I walk / He walks)
function isPresentSimpleVerbMode(grammarFile, items) {
  const fileHint = grammarFile && /present_simple_sentences/i.test(grammarFile);
  const hasVerbUnderscore = Array.isArray(items) && items.some((it) => /_(walk|walks|like|likes|play|plays|study|studies|eat|eats|watch|watches|work|works|rise|rises|chase|chases)\b/i.test(String(it?.word || '')));
  return !!(fileHint || hasVerbUnderscore);
}

// Build a clause with a blank only for the verb and return two options: base vs -s form
function buildPresentSimpleVerbQuestion(item) {
  const sentence = getSentenceText(item);
  if (!sentence) return null;

  const tokens = sentence.split(/\s+/);
  if (!tokens.length) return null;

  // Lowercase, strip punctuation
  const lowerTokens = tokens.map((t) => t.toLowerCase().replace(/[.,!?;:]+$/g, ''));

  // Heuristic: subject is first token; verb is first non-function-word after subject.
  // This matches all sentences in present_simple_sentences.json.
  let subjIndex = 0;
  // Special-case leading "the" (e.g. "The sun rises", "The kids play")
  if (lowerTokens[0] === 'the' && lowerTokens.length >= 2) {
    subjIndex = 1; // treat noun after "the" as subject head
  }

  let verbIndex = subjIndex + 1;
  const skipWords = new Set(['the','a','an','in','on','at','to','for','with','of']);
  while (verbIndex < lowerTokens.length && skipWords.has(lowerTokens[verbIndex])) {
    verbIndex += 1;
  }

  // If we still didn't find a verb, fall back to last token before punctuation
  if (verbIndex >= lowerTokens.length) {
    verbIndex = Math.max(1, lowerTokens.length - 1);
  }

  const rawVerb = lowerTokens[verbIndex];
  const stripVerb = rawVerb.replace(/[.,!?;:]+$/g, '');

  const makeForms = (v) => {
    if (!v) return [v, v];
    if (/^(be|am|is|are)$/.test(v)) return [v, v];

    // If it already looks like a 3rd-person -s form, infer the base and keep that as base.
    // Handles eats/play(s)/watches/studies etc.
    if (/ies$/.test(v) && !/[aeiou]ies$/.test(v)) {
      const base = v.replace(/ies$/, 'y');
      return [base, v];
    }
    if (/(ches|shes|sses|xes|zes)$/.test(v)) {
      const base = v.replace(/es$/, '');
      return [base, v];
    }
    if (/s$/.test(v) && !/ss$/.test(v)) {
      const base = v.replace(/s$/, '');
      return [base, v];
    }

    // Otherwise we have a base form and need to build the 3rd-person form
    if (/(ch|sh|s|x|z)$/.test(v)) return [v, `${v}es`];
    if (/y$/.test(v) && !/[aeiou]y$/.test(v)) return [v, v.replace(/y$/, 'ies')];
    return [v, `${v}s`];
  };

  const [base, sForm] = makeForms(stripVerb);

  // Decide correct form from subject (3rd person singular vs others)
  const subject = lowerTokens[subjIndex];

  // Third person singular subjects that should take the -s form.
  // Plural nouns like 'cats' and 'kids' should NOT be here.
  const isThirdSingular = ['he','she','it','sun'].includes(subject) ||
    (subject === 'the' && lowerTokens[subjIndex] && !/s$/.test(lowerTokens[subjIndex]));
  const correct = (isThirdSingular ? sForm : base) || stripVerb;

  // Rebuild sentence with blank at verb index
  const punct = /[.,!?;:]+$/.exec(tokens[verbIndex])?.[0] || '';
  tokens[verbIndex] = '_____'+ punct;
  const statement = tokens.join(' ');

  return {
    statement,
    options: [
      { label: base, value: (base || '').toLowerCase() },
      { label: sForm, value: (sForm || '').toLowerCase() },
    ],
    correctAnswer: String(correct || '').toLowerCase(),
  };
}

// Helper: extract noun phrase for There is/are or Is/Are there sentences and detect plurality
function extractThereNounPhrase(text) {
  const t = String(text || '').trim();
  const m = t.match(/^(?:there\s+(?:is|are|isn't|aren't)|(?:is|are)\s+there)\s+(.+?)[.?!]?$/i);
  if (!m) return { phrase: '', plural: false };
  let phrase = m[1].trim();
  phrase = phrase.replace(/\b(on|in|at|to|from|of|by|with|under|over|above|below|behind|between|into|onto|around|through|near|next\s+to)\b[\s\S]*$/i, '').trim();
  phrase = phrase.replace(/\b(today|tonight|now|here|nearby)\b[\s\S]*$/i, '').trim();
  phrase = phrase.replace(/^(?:some|any)\s+/i, '').trim();
  const low = phrase.toLowerCase();
  const plural = /\b(two|three|four|five|six|seven|eight|nine|ten|many|several|a\s+lot\s+of|lots\s+of|some|any)\b/.test(low)
    || /\b\w+es\b/.test(low)
    || /\b\w+s\b/.test(low);
  return { phrase, plural };
}

function buildSentenceWithBlank(item, isPluralMode = false, isCountableMode = false) {
  const sentence = (item?.exampleSentence || item?.example || '').trim();
  const article = (item?.article || '').trim();
  const contraction = (item?.contraction || '').trim();
  const word = (item?.word || '').trim();
  if (!sentence) {
    return `___ ${word}`.trim();
  }
  
  // For countable/uncountable mode, replace the target word with blank
  // Try both singular and common plural forms
  if (isCountableMode && word) {
    // First try exact word match
    let wordPattern = new RegExp('\\b' + escapeRegex(word) + '\\b', 'i');
    if (wordPattern.test(sentence)) {
      return sentence.replace(wordPattern, '___');
    }
    
    // Try common plural forms: word + s, es, ies
    const pluralForms = [
      word + 's',
      word + 'es',
      word.endsWith('y') ? word.slice(0, -1) + 'ies' : null
    ].filter(Boolean);
    
    for (const plural of pluralForms) {
      wordPattern = new RegExp('\\b' + escapeRegex(plural) + '\\b', 'i');
      if (wordPattern.test(sentence)) {
        return sentence.replace(wordPattern, '___');
      }
    }
  }
  
  // For plurals mode, replace the target word with blank
  // Try both the word field and article field (which may contain the plural form)
  if (isPluralMode) {
    if (word) {
      const wordPattern = new RegExp('\\b' + escapeRegex(word) + '\\b', 'i');
      if (wordPattern.test(sentence)) {
        return sentence.replace(wordPattern, '___');
      }
    }
    if (article && article !== 'singular' && article !== 'plural') {
      const articlePattern = new RegExp('\\b' + escapeRegex(article) + '\\b', 'i');
      if (articlePattern.test(sentence)) {
        return sentence.replace(articlePattern, '___');
      }
    }
  }
  
  // Check for contraction first (for contractions_be mode)
  if (contraction) {
    const contractionPattern = new RegExp(escapeRegex(contraction), 'i');
    if (contractionPattern.test(sentence)) {
      return sentence.replace(contractionPattern, '___');
    }
  }
  if (!article) return sentence;
  const articleWordPattern = new RegExp('\\b' + escapeRegex(article) + '\\s+' + escapeRegex(word) + '\\b', 'i');
  if (word && articleWordPattern.test(sentence)) {
    return sentence.replace(articleWordPattern, `___ ${word}`);
  }
  const articleOnlyPattern = new RegExp('\\b' + escapeRegex(article) + '\\b', 'i');
  if (articleOnlyPattern.test(sentence)) {
    return sentence.replace(articleOnlyPattern, '___');
  }
  return `___ ${word}`.trim();
}

function buildShortQuestionsSentenceAndOptions(item) {
  // For short questions: randomly choose positive or negative to encourage both forms
  const positive = (item?.answer_positive || '').trim();
  const negative = (item?.answer_negative || '').trim();

  // Extract last word from each answer (remove trailing punctuation)
  const lastWordPositive = positive.split(/\s+/).pop()?.replace(/[.,!?;:]$/g, '') || '';
  const lastWordNegative = negative.split(/\s+/).pop()?.replace(/[.,!?;:]$/g, '') || '';

  // Decide which polarity to present this round (50/50)
  const useNegative = Math.random() < 0.5;
  const chosenAnswer = useNegative ? negative : positive;
  const correctAnswerLastWord = useNegative ? lastWordNegative : lastWordPositive;

  // Build the statement text from the chosen polarity (remove last word)
  const words = chosenAnswer.split(/\s+/);
  const statementWithoutLastWord = words.slice(0, -1).join(' ');
  const statement = statementWithoutLastWord ? `${statementWithoutLastWord} _____` : '_____';

  // Generate a distractor option that isn't one of the two answer words
  const commonDistracters = [
    'am','is','are','was','were','be','being','been',
    'do','does','did','will','would','can','could','may','might','must','shall','should',
    'have','has','had',
    "don't","doesn't","didn't","won't","wouldn't","can't","couldn't","shouldn't",
    "wasn't","weren't","isn't","aren't","haven't","hasn't","hadn't"
  ];

  let distractor = 'do';
  for (const w of commonDistracters) {
    const lw = w.toLowerCase();
    if (lw !== lastWordPositive.toLowerCase() && lw !== lastWordNegative.toLowerCase()) {
      distractor = w;
      break;
    }
  }

  const options = [
    { value: lastWordPositive.toLowerCase(), label: lastWordPositive },
    { value: lastWordNegative.toLowerCase(), label: lastWordNegative },
    { value: distractor.toLowerCase(), label: distractor }
  ].filter((opt, idx, arr) => arr.findIndex(o => o.value === opt.value) === idx); // ensure uniqueness

  // Shuffle the options so correct answer isn't always in same position
  const shuffled = options.sort(() => Math.random() - 0.5);

  return {
    statement,
    options: shuffled,
    correctAnswerLastWord: correctAnswerLastWord.toLowerCase()
  };
}

// Generic fallback: create a last-word blank with 3 options (correct + 2 random distractors from dataset)
function buildGenericLastWordQuestion(item, allItems) {
  const sentenceRaw = getSentenceText(item);
  const sentence = String(sentenceRaw || '').trim();
  if (!sentence) return null;
  const tokens = sentence.split(/\s+/);
  if (tokens.length < 2) return null;
  let last = tokens[tokens.length - 1];
  // Strip trailing punctuation for the word and keep for the statement
  const punct = /[.,!?;:]+$/.exec(last)?.[0] || '';
  const lastWord = last.replace(/[.,!?;:]+$/g, '');
  const statement = tokens.slice(0, -1).join(' ') + ' _____' + punct;

  // Build distractors from other sentence last words
  const pool = new Set();
  (Array.isArray(allItems) ? allItems : []).forEach((it) => {
    const s = getSentenceText(it);
    if (!s) return;
    const parts = String(s).trim().split(/\s+/);
    const w = (parts[parts.length - 1] || '').replace(/[.,!?;:]+$/g, '');
    if (w && w.toLowerCase() !== lastWord.toLowerCase()) pool.add(w);
  });
  const distractors = Array.from(pool).sort(() => Math.random() - 0.5).slice(0, 2);
  const options = [lastWord, ...distractors].map((w) => ({ label: w, value: w.toLowerCase() }));
  const shuffled = options.sort(() => Math.random() - 0.5);

  return {
    statement,
    options: shuffled,
    correctAnswerLastWord: lastWord.toLowerCase(),
    correctAnswerLower: lastWord.toLowerCase()
  };
}

function buildContractionOptions(item, allEndings) {
  // For contractions: combine subject (word) with each ending to create options
  // E.g., item.word = "We", endings = ["'m", "'re", "'s"] → [{label:"We'm", value:"we'm"}, ...]
  const subject = (item?.word || '').trim();
  const endings = (allEndings && allEndings.length) ? allEndings : ["'m", "'re", "'s"];

  if (!subject) {
    return shuffle(endings.map((ending) => ({ label: ending, value: ending.toLowerCase() })));
  }

  const options = endings.map((ending) => {
    const label = `${subject}${ending}`;
    return { label, value: label.toLowerCase() };
  });
  return shuffle(options);
}

function buildPluralOptions(item, allItems, isCountableMode = false) {
  // For plurals/countable mode: generate 4 options including the correct word and 3 distractors
  const correctWord = (item?.word || '').trim();
  const correctArticle = (item?.article || '').trim();
  
  // Determine the correct answer - could be in word or article field
  let correctAnswer = correctWord;
  if (!isCountableMode && correctArticle && correctArticle !== 'singular' && correctArticle !== 'plural') {
    // For plurals_es, plurals_ies, plurals_irregular: article contains the plural form
    correctAnswer = correctArticle;
  }
  
  if (!correctAnswer || !Array.isArray(allItems) || allItems.length < 2) {
    return [{ label: correctAnswer, value: correctAnswer.toLowerCase() }];
  }

  // Collect all unique word forms from the dataset
  const allWordForms = new Set();
  allItems.forEach((otherItem) => {
    const word = (otherItem?.word || '').trim();
    const article = (otherItem?.article || '').trim();
    
    if (word && word.toLowerCase() !== correctAnswer.toLowerCase()) {
      allWordForms.add(word);
    }
    
    // For plurals mode (NOT countable), also collect from article field
    if (!isCountableMode && article && 
        article !== 'singular' && article !== 'plural' && 
        article !== 'countable' && article !== 'uncountable' &&
        article.toLowerCase() !== correctAnswer.toLowerCase()) {
      allWordForms.add(article);
    }
  });

  // Convert to array and shuffle to pick random distractors
  const distractors = shuffle(Array.from(allWordForms)).slice(0, 3);
  
  // Combine correct answer with distractors
  const options = [correctAnswer, ...distractors].map((word) => ({
    label: word,
    value: word.toLowerCase()
  }));

  return shuffle(options);
}

function buildProximityScene(article, emoji) {
  const personEmoji = '🧍';
  const isNear = ['this', 'these'].includes(String(article || '').toLowerCase());
  const objectEmoji = emoji || (isNear ? '📘' : '🚌');
  if (isNear) {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:320px;margin:0 auto;">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;font-size:3.4rem;">
          <span style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.12));">${personEmoji}</span>
          <span style="font-size:3.6rem;">${objectEmoji}</span>
        </div>
      </div>
    `;
  }
  return `
    <div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:360px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 6px;font-size:3.4rem;width:100%;max-width:420px;">
        <span style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.12));transform:translateX(-16px);">${personEmoji}</span>
        <div style="flex:1;height:4px;margin:0 12px;border-radius:999px;background:repeating-linear-gradient(90deg,#21b3be 0,#21b3be 10px,rgba(33,179,190,0) 10px,rgba(33,179,190,0) 28px);opacity:0.45;"></div>
        <span style="font-size:3.7rem;transform:translateX(60px);">${objectEmoji}</span>
      </div>
    </div>
  `;
}

export async function runGrammarFillGapMode(ctx) {
  const {
    grammarFile,
    grammarName,
    grammarConfig,
    playTTS,
    playSFX,
    inlineToast,
    showOpeningButtons,
  } = ctx || {};

  const gameArea = document.getElementById('gameArea');
  if (!gameArea) {
    console.error('[GrammarFillGap] Missing game area');
    return;
  }

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
    console.error('[GrammarFillGap] Unable to load data', err);
    inlineToast?.('Could not load grammar data');
    showOpeningButtons?.(true);
    return;
  }

  const usable = Array.isArray(rawData)
    ? rawData.filter((item) => {
        if (!item) return false;
        // Support traditional grammar modes (article/contraction/ending)
        if (item.word && (item.article || item.contraction || item.ending)) return true;
        // Support short questions mode (answer_positive/answer_negative)
        if (item.word && (item.answer_positive || item.answer_negative)) return true;
        // Generic sentence mode: allow items that have a usable sentence field
        if (item.en || item.example || item.exampleSentence || item.sentence || (Array.isArray(item.sentences) && item.sentences.length)) return true;
        return false;
      })
    : [];

  if (!usable.length) {
    inlineToast?.('No grammar items available yet');
    showOpeningButtons?.(true);
    return;
  }

  ensureStyles();

  // Extract answer choices from config (e.g., ['a', 'an'] or ['am', 'is', 'are'])
  const answerChoices = (grammarConfig && grammarConfig.answerChoices && Array.isArray(grammarConfig.answerChoices))
    ? grammarConfig.answerChoices
    : ['a', 'an']; // Default fallback

  const isThisThatMode = Array.isArray(answerChoices)
    && answerChoices.length === 2
    && answerChoices.includes('this')
    && answerChoices.includes('that');

  const isTheseThooseMode = Array.isArray(answerChoices)
    && answerChoices.length === 2
    && answerChoices.includes('these')
    && answerChoices.includes('those');

  const inOnUnderMode = isInOnUnderMode(answerChoices);

  const hasProximityMode = isThisThatMode || isTheseThooseMode;

  const isContractionMode = Array.isArray(answerChoices)
    && answerChoices.length === 3
    && answerChoices.includes("'m")
    && answerChoices.includes("'re")
    && answerChoices.includes("'s");

  const isPluralMode = (grammarConfig && grammarConfig.isPluralMode === true)
    || (Array.isArray(answerChoices)
      && answerChoices.length === 2
      && answerChoices.includes('singular')
      && answerChoices.includes('plural'))
    || (grammarFile && /plurals?_/.test(grammarFile)); // Also detect by filename

  const isCountableMode = Array.isArray(answerChoices)
    && answerChoices.length === 2
    && answerChoices.includes('countable')
    && answerChoices.includes('uncountable');

  // Detect Some/Any mode
  const isSomeAnyMode = Array.isArray(answerChoices)
    && answerChoices.includes('some')
    && answerChoices.includes('any');

  // Detect There is/are statements and Are there/Is there questions via answer choices
  const acLower = (Array.isArray(answerChoices) ? answerChoices : []).map((s) => String(s || '').toLowerCase());
  const isThereStatementsMode = acLower.includes('there is') && acLower.includes('there are');
  const isThereQuestionsMode = acLower.includes('is there') && acLower.includes('are there');

  // Detect Present Simple: Negative list (don't vs doesn't focus)
  const isPresentSimpleNegative = (grammarFile && /present_simple_negative\.json$/i.test(grammarFile))
    || (grammarName && /present\s*simple[:\-\s]*negative/i.test(grammarName));

  // Detect if this is Short Questions mode (items have answer_positive and answer_negative)
  const isShortQuestionsMode = usable.length > 0 && usable[0] && usable[0].answer_positive && usable[0].answer_negative;
  const isPresentSimpleMode = isPresentSimpleVerbMode(grammarFile, usable);
  // Generic sentence fallback (Level 2): no predefined choices, not contractions/plurals/countable/short Q
  const isGenericSentenceMode = !isContractionMode && !isPluralMode && !isCountableMode && !isShortQuestionsMode && !isPresentSimpleMode && Array.isArray(answerChoices) && answerChoices.length === 0;

  const deck = shuffle(usable).slice(0, 15);

  try {
    await hydrateGrammarAudio(deck);
  } catch (err) {
    console.debug('[GrammarFillGap] audio hydrate failed', err?.message);
  }
  const sessionWords = deck.map((item) => item.word || item.en || item.example || item.id || '');

  const updateProgressBar = (show, value = 0, max = 0) => {
    const bar = document.getElementById('gameProgressBar');
    const fill = document.getElementById('gameProgressFill');
    const text = document.getElementById('gameProgressText');
    if (!bar || !fill || !text) return;
    bar.style.display = show ? '' : 'none';
    if (show && max > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
      fill.style.width = `${pct}%`;
      text.textContent = `${value}/${max}`;
    }
  };

  let sessionId = null;
  try {
    sessionId = startSession({
      mode: 'grammar_fill_gap',
      wordList: sessionWords,
      listName: grammarName || null,
      meta: { category: 'grammar', file: grammarFile },
    });
  } catch (err) {
    console.debug('[GrammarFillGap] startSession failed', err?.message);
  }

  let currentIndex = 0;
  let correctCount = 0;
  let attempts = 0;
  let sessionEnded = false;
  let autoNextTimer = null;

  function clearAutoNext() {
    if (autoNextTimer) {
      clearTimeout(autoNextTimer);
      autoNextTimer = null;
    }
  }

  function quitToMenu() {
    sessionEnded = true;
    clearAutoNext();
    updateProgressBar(false);
    if (window.WordArcade?.startGrammarModeSelector) {
      window.WordArcade.startGrammarModeSelector();
    } else if (window.WordArcade?.quitToOpening) {
      window.WordArcade.quitToOpening(true);
    } else {
      showOpeningButtons?.(true);
    }
  }

  function renderLayout() {
    gameArea.innerHTML = `
  <div class="fg-root">
        <div class="fg-content" role="group" aria-live="polite">
          <div class="fg-emoji" id="fgEmoji" aria-hidden="true"></div>
          <div class="fg-word" id="fgWord"></div>
          <div class="fg-sentence" id="fgSentence"></div>
          <div class="fg-chip-row" id="fgOptions">
            <!-- Options will be populated dynamically for contractions, plurals, and countable -->
            ${(!isContractionMode && !isPluralMode && !isCountableMode) ? answerChoices.map((choice) => `<button type="button" class="fg-chip" data-value="${choice.toLowerCase()}">${choice}</button>`).join('') : ''}
          </div>
          <div class="fg-hint" id="fgHint"></div>
        </div>
        <div class="fg-footer">
          <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
            <span class="wa-sr-only">Quit Game</span>
            <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
          </button>
        </div>
      </div>
    `;
  }

  function renderSummary() {
    sessionEnded = true;
    clearAutoNext();
    updateProgressBar(false);
    const accuracy = deck.length ? Math.round((correctCount / deck.length) * 100) : 0;
    try {
      const duration = Math.round((performance.now() - startTimeMs) / 1000);
      endSession(sessionId, {
        mode: 'grammar_fill_gap',
        summary: {
          score: correctCount,
          total: deck.length,
          correct: correctCount,
          points: correctCount,
          pct: accuracy,
          category: 'grammar',
          context: 'game',
          duration_s: duration,
          grammarName: grammarName || null,
          grammarFile: grammarFile || null,
        },
        listName: grammarName || null,
        wordList: sessionWords,
        meta: { category: 'grammar', file: grammarFile, grammarName, grammarFile }
      });
      const ev = new CustomEvent('wa:session-ended', { detail: { summary: { score: correctCount, total: deck.length } } });
      window.dispatchEvent(ev);
    } catch (err) {
      console.debug('[GrammarFillGap] endSession error', err?.message);
    }
    renderGrammarSummary({
      gameArea,
      score: correctCount,
      total: deck.length,
      ctx: { showOpeningButtons }
    });
  }

  function setReveal(text) {
    const revealEl = document.getElementById('fgReveal');
    if (!revealEl) return;
    if (!text) {
      revealEl.style.display = 'none';
      revealEl.textContent = '';
      return;
    }
    revealEl.textContent = text;
    revealEl.style.display = '';
  }

  function renderQuestion() {
    if (sessionEnded) return;
    const item = deck[currentIndex];
    if (!item) {
      renderSummary();
      return;
    }

    const counterEl = document.getElementById('fgCounter');
    const emojiEl = document.getElementById('fgEmoji');
    const wordEl = document.getElementById('fgWord');
    const sentenceEl = document.getElementById('fgSentence');
    const optionsRow = document.getElementById('fgOptions');
    let optionButtons = optionsRow ? Array.from(optionsRow.querySelectorAll('.fg-chip')) : [];
    const hintEl = document.getElementById('fgHint');

    if (!optionsRow || !sentenceEl) {
      console.error('[GrammarFillGap] Missing layout nodes');
      return;
    }

    updateProgressBar(true, currentIndex, deck.length);

  if (hasProximityMode) {
      emojiEl.innerHTML = buildProximityScene(item.article, item.emoji);
    } else if (inOnUnderMode) {
      emojiEl.innerHTML = buildPrepositionScene(item.article, item.emoji, item.word);
    } else {
      emojiEl.textContent = item.emoji || '🧠';
    }
    
    // Handle Short Questions mode: show question as title, statement with blank
  let shortQuestionsData = null;
  let presentSimpleData = null;
    let genericSentenceData = null;
    if (isShortQuestionsMode) {
      shortQuestionsData = buildShortQuestionsSentenceAndOptions(item);
      wordEl.textContent = isSomeAnyMode ? '' : (item.en || ''); // Hide in some/any
      sentenceEl.innerHTML = shortQuestionsData.statement.replace('_____', '<strong>_____</strong>');
      hintEl.textContent = item.exampleSentenceKo ? String(item.exampleSentenceKo).trim() : '';
      // Will handle options rendering next
    } else if (isPresentSimpleMode) {
      presentSimpleData = buildPresentSimpleVerbQuestion(item);
      wordEl.textContent = '';
      if (presentSimpleData && presentSimpleData.statement) {
        sentenceEl.innerHTML = presentSimpleData.statement.replace('_____', '<strong>_____</strong>');
      } else {
        sentenceEl.innerHTML = getSentenceText(item) || '';
      }
      const hint = item.exampleSentenceKo || item.sentence_kor || item.kor || item.ko || '';
      hintEl.textContent = hint ? String(hint).trim() : '';
    } else if (isPresentSimpleNegative) {
      // Replace don't/doesn't with a blank and offer two options
      wordEl.textContent = '';
      wordEl.style.display = 'none';
      const base = (getSentenceText(item) || item.en || '').trim();
      let replaced = base;
      replaced = replaced.replace(/\b(?:doesn['’]?t|don['’]?t)\b/i, '___');
      sentenceEl.innerHTML = replaced.replace('___', '<strong>___</strong>');
      const hint = item.exampleSentenceKo || item.sentence_kor || item.kor || item.ko || '';
      hintEl.textContent = hint ? String(hint).trim() : '';
    } else if (isThereStatementsMode || isThereQuestionsMode) {
      // Fill-in-the-blank for There modes: replace target phrase with ___ and hide cyan word line
      wordEl.textContent = '';
      wordEl.style.display = 'none';
      const base = getSentenceText(item) || item.en || '';
      let replaced = base;
      if (isThereStatementsMode) {
        replaced = replaced
          .replace(/^\s*there\s+isn't\b/i, '___')
          .replace(/^\s*there\s+aren't\b/i, '___')
          .replace(/^\s*there\s+is\b/i, '___')
          .replace(/^\s*there\s+are\b/i, '___');
      } else {
        replaced = replaced
          .replace(/^\s*is\s+there\b/i, '___')
          .replace(/^\s*are\s+there\b/i, '___');
      }
      sentenceEl.innerHTML = replaced.replace('___', '<strong>___</strong>');
      const hint = item.exampleSentenceKo || item.sentence_kor || item.kor || item.ko || '';
      hintEl.textContent = hint ? String(hint).trim() : '';
    } else if (isGenericSentenceMode) {
      // Generic: remove last word of the sentence and present 3 options (correct last word + two distractors)
      genericSentenceData = buildGenericLastWordQuestion(item, usable);
      wordEl.textContent = '';
      if (genericSentenceData && genericSentenceData.statement) {
        sentenceEl.innerHTML = genericSentenceData.statement.replace('_____', '<strong>_____</strong>');
      } else {
        // Fallback to raw sentence
        const s = getSentenceText(item);
        sentenceEl.innerHTML = (s ? s : '_____');
      }
      const hint = item.exampleSentenceKo || item.sentence_kor || item.kor || item.ko || '';
      hintEl.textContent = hint ? String(hint).trim() : '';
  } else if (isPluralMode || isCountableMode) {
      // In plurals or countable mode, don't show the word separately since it's the answer
      wordEl.textContent = '';
      sentenceEl.innerHTML = buildSentenceWithBlank(item, isPluralMode, isCountableMode).replace('___', '<strong>___</strong>');
      hintEl.textContent = hasProximityMode || inOnUnderMode ? '' : (item.exampleSentenceKo ? String(item.exampleSentenceKo).trim() : '');
    } else {
      wordEl.textContent = isSomeAnyMode ? '' : (item.word || '');
      sentenceEl.innerHTML = buildSentenceWithBlank(item, isPluralMode, isCountableMode).replace('___', '<strong>___</strong>');
      hintEl.textContent = hasProximityMode || inOnUnderMode ? '' : (item.exampleSentenceKo ? String(item.exampleSentenceKo).trim() : '');
    }

    // Hide the cyan word line entirely for Some/Any mode to remove extra gap
  if (isSomeAnyMode || isThereStatementsMode || isThereQuestionsMode || isPresentSimpleNegative) {
      wordEl.style.display = 'none';
    } else {
      wordEl.style.display = '';
    }
    setReveal('');

    // For contractions, plurals, countable, or short questions, dynamically populate options
    if (isContractionMode) {
      const contractionOptions = buildContractionOptions(item, answerChoices);
      optionsRow.innerHTML = contractionOptions.map((opt) => `<button type="button" class="fg-chip" data-value="${opt.value}">${opt.label}</button>`).join('');
      // Refresh optionButtons after updating HTML
      optionButtons = Array.from(optionsRow.querySelectorAll('.fg-chip'));
      if (!optionButtons.length) {
        console.error('[GrammarFillGap] No contraction options rendered');
        return;
      }
    } else if (isPluralMode || isCountableMode) {
      const wordOptions = buildPluralOptions(item, usable, isCountableMode);
      optionsRow.innerHTML = wordOptions.map((opt) => `<button type="button" class="fg-chip" data-value="${opt.value}">${opt.label}</button>`).join('');
      // Refresh optionButtons after updating HTML
      optionButtons = Array.from(optionsRow.querySelectorAll('.fg-chip'));
      if (!optionButtons.length) {
        console.error('[GrammarFillGap] No word options rendered');
        return;
      }
  } else if (isThereStatementsMode || isThereQuestionsMode) {
      // Explicit options for There modes
      const statementsAll = ['there is', 'there are', "there isn't", "there aren't"];
      const questionPair = ['Is there', 'Are there'];
      const opts = (isThereStatementsMode ? statementsAll : questionPair);
      optionsRow.innerHTML = opts.map((opt) => `<button type="button" class="fg-chip" data-value="${opt.toLowerCase()}">${opt}</button>`).join('');
      optionButtons = Array.from(optionsRow.querySelectorAll('.fg-chip'));
      if (!optionButtons.length) {
        console.error('[GrammarFillGap] No there/is there options rendered');
        return;
      }
    } else if (isShortQuestionsMode) {
      // For short questions, show only the last word from each answer option
      optionsRow.innerHTML = shortQuestionsData.options.map((opt) => `<button type="button" class="fg-chip" data-value="${opt.value}">${opt.label}</button>`).join('');
      // Refresh optionButtons after updating HTML
      optionButtons = Array.from(optionsRow.querySelectorAll('.fg-chip'));
      if (!optionButtons.length) {
        console.error('[GrammarFillGap] No short questions options rendered');
        return;
      }
    } else if (isPresentSimpleMode) {
      const opts = presentSimpleData && Array.isArray(presentSimpleData.options) ? presentSimpleData.options : [];
      optionsRow.innerHTML = opts.map((opt) => `<button type="button" class="fg-chip" data-value="${opt.value}">${opt.label}</button>`).join('');
      optionButtons = Array.from(optionsRow.querySelectorAll('.fg-chip'));
      if (!optionButtons.length) {
        console.error('[GrammarFillGap] No present simple verb options rendered');
        return;
      }
    } else if (isPresentSimpleNegative) {
      // Explicit two options: don't / doesn't
      const pair = ["don't", "doesn't"];
      optionsRow.innerHTML = pair.map((opt) => `<button type="button" class="fg-chip" data-value="${opt.toLowerCase()}">${opt}</button>`).join('');
      optionButtons = Array.from(optionsRow.querySelectorAll('.fg-chip'));
      if (!optionButtons.length) {
        console.error('[GrammarFillGap] No present simple negative options rendered');
        return;
      }
    } else if (isGenericSentenceMode) {
      // For generic sentence mode, render last-word options if available
      const opts = (genericSentenceData && Array.isArray(genericSentenceData.options)) ? genericSentenceData.options : [];
      if (opts.length) {
        optionsRow.innerHTML = opts.map((opt) => `<button type="button" class="fg-chip" data-value="${opt.value}">${opt.label}</button>`).join('');
        optionButtons = Array.from(optionsRow.querySelectorAll('.fg-chip'));
      } else {
        // If no options, keep it empty to avoid wrong defaults
        optionsRow.innerHTML = '';
        optionButtons = [];
      }
    }

    optionButtons.forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove('fg-correct', 'fg-wrong');
    });
    const quitBtn = document.getElementById('grammarQuitBtn');
    if (quitBtn) {
      quitBtn.onclick = quitToMenu;
    }

    // Pre-compute correct answer for There modes for evaluation/logging
    let thereCorrectAnswerLabel = null;
    if (isThereStatementsMode || isThereQuestionsMode) {
      const base = getSentenceText(item) || item.en || '';
      const w = String(item.word || '').toLowerCase();
      if (isThereStatementsMode) {
        if (w.includes('there_aren_t') || /^there\s+aren't\b/i.test(base)) thereCorrectAnswerLabel = "there aren't";
        else if (w.includes('there_isn_t') || /^there\s+isn't\b/i.test(base)) thereCorrectAnswerLabel = "there isn't";
        else if (w.includes('there_are') || /^there\s+are\b/i.test(base)) thereCorrectAnswerLabel = 'there are';
        else if (w.includes('there_is') || /^there\s+is\b/i.test(base)) thereCorrectAnswerLabel = 'there is';
        else {
          const { plural } = extractThereNounPhrase(base);
          thereCorrectAnswerLabel = plural ? 'there are' : 'there is';
        }
      } else {
        if (w.includes('are_there') || /^are\s+there\b/i.test(base)) thereCorrectAnswerLabel = 'Are there';
        else if (w.includes('is_there') || /^is\s+there\b/i.test(base)) thereCorrectAnswerLabel = 'Is there';
        else {
          const { plural } = extractThereNounPhrase(base);
          thereCorrectAnswerLabel = plural ? 'Are there' : 'Is there';
        }
      }
    }

    const handleSelection = (choice, btn) => {
      if (sessionEnded) return;
      if (btn.disabled) return;
      clearAutoNext();

      optionButtons.forEach((b) => { b.disabled = true; });

  // For contractions, check against the complete contraction string
  // For plurals or countable, check against the word
  // For present simple verb mode, check against the verb form (eat/eats)
  // For short questions, randomly pick positive or negative as the correct answer
  // Otherwise use article
      let correctAnswerSource;
      if (isPluralMode || isCountableMode) {
        // Check article first (for plurals_es, plurals_ies, plurals_irregular)
        // Then fall back to word (for plurals_s and countable)
        const article = (item.article || '').trim();
        const word = (item.word || '').trim();
        if (article && article !== 'singular' && article !== 'plural' && article !== 'countable' && article !== 'uncountable') {
          correctAnswerSource = article;
        } else {
          correctAnswerSource = word;
        }
      } else if (isContractionMode) {
        correctAnswerSource = item.contraction || item.article || '';
      } else if (isShortQuestionsMode) {
        // For short questions, use the pre-selected correct answer from the data
        correctAnswerSource = shortQuestionsData.correctAnswerLastWord;
      } else if (isPresentSimpleMode && presentSimpleData) {
        correctAnswerSource = presentSimpleData.correctAnswer;
      } else if (isPresentSimpleNegative) {
        // Decide don't vs doesn't from the sentence content
        const base = String(getSentenceText(item) || item.en || '').toLowerCase();
        if (/(?:doesn['’]?t)\b/.test(base)) correctAnswerSource = "doesn't";
        else if (/(?:don['’]?t)\b/.test(base)) correctAnswerSource = "don't";
        else {
          // Fallback by subject heuristic
          const parts = base.split(/\s+/);
          const first = parts[0] || '';
          const second = parts[1] || '';
          const thirdPron = new Set(['he','she','it']);
          if (thirdPron.has(first)) correctAnswerSource = "doesn't";
          else if (first === 'the') {
            correctAnswerSource = (second && /s$/.test(second) && !/(ss|us)$/i.test(second)) ? "don't" : "doesn't";
          } else {
            correctAnswerSource = "don't";
          }
        }
      } else if (isGenericSentenceMode && genericSentenceData) {
        correctAnswerSource = genericSentenceData.correctAnswerLastWord || genericSentenceData.correctAnswerLower;
      } else if (isThereStatementsMode || isThereQuestionsMode) {
        correctAnswerSource = thereCorrectAnswerLabel || '';
      } else {
        correctAnswerSource = item.article || '';
      }
      
      const correctArticle = String(correctAnswerSource || '').trim().toLowerCase();
      const guess = String(choice || '').trim().toLowerCase();
      const correct = guess === correctArticle;

      optionButtons.forEach((b) => {
        const val = String(b.dataset.value || '').trim().toLowerCase();
        if (val === correctArticle) {
          b.classList.add('fg-correct');
        } else if (val === guess) {
          b.classList.add('fg-wrong');
        }
      });

      if (correct) {
        correctCount += 1;
        if (playSFX) playSFX('correct');
        else try { new Audio('/Games/english_arcade/assets/audio/right-answer.mp3').play().catch(() => {}); } catch {}
      } else {
        if (playSFX) playSFX('wrong');
      }

      attempts += 1;
      updateProgressBar(true, currentIndex + 1, deck.length);

    try {
        logAttempt({
          session_id: sessionId,
          mode: 'grammar_fill_gap',
          word: item.id || item.word,
          is_correct: correct,
          answer: guess,
      correct_answer: correctAnswerSource,
          points: correct ? 1 : 0,
          attempt_index: currentIndex,
          round: currentIndex + 1,
          extra: {
            word: item.word,
            article: item.article,
            contraction: item.contraction,
            sentence: item.exampleSentence,
            category: 'grammar',
          },
        });
      } catch (err) {
        console.debug('[GrammarFillGap] logAttempt failed', err?.message);
      }

  playSentenceClip(item, playTTS).catch(() => {});

      clearAutoNext();
      autoNextTimer = setTimeout(() => {
        if (sessionEnded) return;
        currentIndex += 1;
        renderQuestion();
      }, correct ? 2600 : 3400);
    };

    optionButtons.forEach((btn) => {
      btn.onclick = () => handleSelection(btn.dataset.value, btn);
    });
  }

  const startTimeMs = performance.now();

  renderLayout();
  renderQuestion();
}
