// Grammar Choose Mode (Level 3)
// Lightweight, Level-3 scoped choose/selection mode for grammar items.
// Mirrors the style and API of the existing grammar choose mode but
// forces Level 3 behaviors and paths (keeps editing/maintenance simple).

import { startSession, logAttempt, endSession } from '../../../../students/records.js';
import { renderGrammarSummary } from '../grammar_summary.js';
import { FN } from '../../scripts/api-base.js';

let state = null;
let pendingTimeout = null;
let activeSentenceAudio = null;
const sentenceAudioCache = new Map();
const MODE = 'grammar_choose';
const DEFAULT_FILE = 'data/grammar/level3/past_simple_irregular.json';

// --- Audio helpers for Level 3 grammar ---
function normalizeForGrammarKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildGrammarAudioCandidates(item) {
  const candidates = [];
  const seen = new Set();
  const add = (key) => { if (!key || seen.has(key)) return; seen.add(key); candidates.push(key); };
  const idBase = normalizeForGrammarKey(item?.id);
  const wordBase = normalizeForGrammarKey(item?.word || item?.base);
  const articleBase = normalizeForGrammarKey(item?.article);
  if (idBase) add(`${idBase}_grammar`);
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
  try {
    const endpoint = FN('get_audio_urls');
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }) };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      init.signal = AbortSignal.timeout(10000);
    }
    const res = await fetch(endpoint, init);
    if (res.ok) {
      const data = await res.json();
      if (data && data.results && typeof data.results === 'object') results = data.results;
    }
  } catch (err) { console.debug('[GrammarChooseL3] audio lookup error', err?.message); }
  if (!results) return;
  candidateMap.forEach((candidates, item) => {
    for (const key of candidates) {
      const lower = key?.toLowerCase?.();
      const variants = [key, lower, `${key}.mp3`, lower ? `${lower}.mp3` : null];
      const info = variants.map((v) => (v ? results[v] : null)).find((r) => r && r.exists && r.url);
      if (info) { item.sentenceAudioUrl = info.url; item.audio_key = key; break; }
    }
  });
}

function playSentenceAudio(item) {
  if (!item) return;
  const url = item.sentenceAudioUrl;
  if (activeSentenceAudio) {
    try { activeSentenceAudio.pause(); } catch {}
    try { activeSentenceAudio.currentTime = 0; } catch {}
    activeSentenceAudio = null;
  }
  if (url) {
    try {
      let audio = sentenceAudioCache.get(url);
      if (!audio) { audio = new Audio(url); audio.preload = 'auto'; sentenceAudioCache.set(url, audio); }
      activeSentenceAudio = audio;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }
}
// --- End audio helpers ---

function shuffle(array) {
  const arr = Array.isArray(array) ? array.slice() : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadGrammarList(filePath) {
  // module is in: Games/english_arcade/modes/level_3_grammar/
  // need to resolve relative to Games/english_arcade/ -> go up two levels
  const base = new URL('../../', import.meta.url);
  const url = new URL(filePath, base);
  const response = await fetch(url.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${filePath}: ${response.status}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function initGrammarChooseL3() {
  // no-op for now; kept for parity with other modes
}

export async function startGrammarChooseL3({
  containerId = 'gameArea',
  grammarFile,
  grammarName,
  grammarConfig,
  onQuit,
  onComplete,
  playSFX,
} = {}) {
  // Clean up any previous instance to prevent double-running
  if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
  state = null;

  const container = document.getElementById(containerId);
  if (!container) return;

  const resolvedSFX = typeof playSFX === 'function'
    ? playSFX
    : (window.WordArcade && typeof window.WordArcade.playSFX === 'function'
        ? (name) => window.WordArcade.playSFX(name)
        : null);

  state = {
    grammarFile: grammarFile || DEFAULT_FILE,
    grammarName,
    grammarConfig,
    score: 0,
    index: 0,
    container,
    onQuit,
    onComplete,
    playSFX: resolvedSFX,
    sessionId: null,
    list: [],
  };

  try {
    const list = await loadGrammarList(state.grammarFile);
    state.list = Array.isArray(list) ? list.slice() : [];
  } catch (err) {
    console.error('Failed to load grammar list', err);
    state.list = [];
  }

  // Start session for stars/progress tracking
  try {
    // Use grammarFile path for session tracking to match homework assignment list_key
    state.sessionId = startSession({
      mode: MODE,
      listName: state.grammarFile || grammarName || null,
      wordList: state.list.map(it => it.word || it.id || it.base || it.past).filter(Boolean),
      meta: { category: 'grammar', grammarFile: state.grammarFile, grammarName: grammarName || null, level: 3 }
    });
  } catch (e) {
    console.debug('[choose_l3] startSession failed', e?.message);
    state.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }

  if (!state.list.length) {
    container.innerHTML = '<div style="padding:20px">No Level 3 grammar content found.</div>';
    if (onComplete) onComplete(state);
    return;
  }

  state.list = shuffle(state.list);
  
  // Hydrate audio URLs for sentence playback after answer
  try {
    await hydrateGrammarAudio(state.list);
  } catch (err) {
    console.debug('[choose_l3] Audio hydrate failed', err?.message);
  }
  
  // Detect grammar type from the data structure
  const sampleItem = state.list[0] || {};
  const grammarType = detectGrammarType(sampleItem, state.grammarFile);
  state.grammarType = grammarType;
  

  function detectGrammarType(item, filePath) {
    if (!item) return 'generic';
    const path = (filePath || '').toLowerCase();
    if (path.includes('be_going_to_future')) return 'be_going_to_future';
    if (path.includes('be_going_to_questions')) return 'be_going_to_questions';
    if (path.includes('past_simple_regular')) return 'past_simple_regular';
    if (path.includes('past_vs_future')) return 'past_vs_future';
    if (path.includes('past_vs_present_vs_future')) return 'all_tenses';
    if (item.base && item.past && item.detractors) return 'irregular_past';
    if (item.en && item.ko) return 'sentence_based';
    return 'generic';
  }

  // Time words for past_vs_future mode
  const PAST_TIME_WORDS = ['yesterday', 'last week', 'last month', 'last year', 'last night', 'last summer'];
  const FUTURE_TIME_WORDS = ['tomorrow', 'soon', 'next week', 'next month', 'next year', 'next summer', 'next Saturday', 'this week'];

  // Now that time-word constants are initialized, render the first question
  renderQuestion(container);

  // Extract time word from sentence
  function extractTimeWord(sentence) {
    const lowerSentence = sentence.toLowerCase();
    for (const tw of [...PAST_TIME_WORDS, ...FUTURE_TIME_WORDS]) {
      if (lowerSentence.includes(tw.toLowerCase())) {
        return tw;
      }
    }
    return null;
  }

  // Get opposite tense time word
  function getOppositeTimeWord(timeWord, tense) {
    if (!timeWord) return tense === 'past' ? 'tomorrow' : 'yesterday';
    const isPast = PAST_TIME_WORDS.some(tw => tw.toLowerCase() === timeWord.toLowerCase());
    if (isPast) {
      // Return a future time word
      return FUTURE_TIME_WORDS[Math.floor(Math.random() * FUTURE_TIME_WORDS.length)];
    } else {
      // Return a past time word
      return PAST_TIME_WORDS[Math.floor(Math.random() * PAST_TIME_WORDS.length)];
    }
  }

  // Truncate sentence by removing the time word portion at the end
  function truncateSentenceForTimeChoice(sentence) {
    // Remove time expressions from the end of the sentence
    let truncated = sentence;
    const timePatterns = [
      /\s+(yesterday|tomorrow|soon|last\s+\w+|next\s+\w+|on\s+\w+|this\s+\w+)\.?\s*$/i
    ];
    for (const pattern of timePatterns) {
      truncated = truncated.replace(pattern, '...');
    }
    if (truncated === sentence) {
      // Fallback: just add ellipsis
      truncated = sentence.replace(/\.\s*$/, '...');
    }
    return truncated;
  }

  // Helper: extract verb base from sentence for regular past tense
  function extractVerbBase(sentence) {
    // Find -ed verb and return its base form
    const match = sentence.match(/\b(\w+)(ed)\b/i);
    if (match) {
      let base = match[1];
      // Handle doubled consonants: "played" -> "play", "stopped" -> "stop"
      if (/([bcdfghjklmnpqrstvwxz])\1$/i.test(base)) {
        base = base.slice(0, -1);
      }
      // Handle -ied: "tried" -> "try"
      if (base.endsWith('i')) {
        base = base.slice(0, -1) + 'y';
      }
      return base;
    }
    return null;
  }

  // Helper: truncate "be going to" sentence to subject + verb phrase
  function truncateGoingToSentence(sentence) {
    // Match pattern: Subject + am/is/are + going to + verb
    const match = sentence.match(/^(.+?\s+(?:am|is|are|'m|'s|'re)\s+going\s+to\s+\w+)/i);
    if (match) {
      return match[1];
    }
    // If sentence is short enough, return as-is
    if (sentence.length <= 35) return sentence;
    // Fallback: return first 35 chars
    return sentence.substring(0, 35) + '...';
  }

  // Generate distractors for regular past tense (base verb shown)
  function generatePastRegularDistractors(base, correct) {
    const distractors = new Set();
    distractors.add(correct); // e.g., "played"
    distractors.add(base); // e.g., "play"
    distractors.add(base + 's'); // e.g., "plays"
    // Common mistake: wrong -ed form
    if (base.endsWith('y')) {
      distractors.add(base + 'ed'); // e.g., "tryed" (wrong)
    } else {
      distractors.add(base + 'd'); // e.g., "playd" (wrong)
    }
    // Add "was + past participle" as distractor
    distractors.add('was ' + correct);
    // Add present continuous
    if (base.endsWith('e')) {
      distractors.add('is ' + base.slice(0, -1) + 'ing');
    } else {
      distractors.add('is ' + base + 'ing');
    }
    return Array.from(distractors).filter(d => d !== correct).slice(0, 3);
  }

  // Generate distractors for "be going to" sentences
  function generateGoingToDistractors(item, correct) {
    const truncated = truncateGoingToSentence(correct);
    const distractors = new Set();
    
    // Extract subject and verb
    const match = correct.match(/^(\w+)\s+(am|is|are|'m|'s|'re)\s+going\s+to\s+(\w+)/i);
    if (match) {
      const subject = match[1];
      const be = match[2];
      const verb = match[3];
      
      // Wrong: missing "be" verb - "She going to eat"
      distractors.add(`${subject} going to ${verb}`);
      
      // Wrong: "will going to" - "She will going to eat"
      distractors.add(`${subject} will going to ${verb}`);
      
      // Wrong: "was going to" (past) - "She was going to eat"
      distractors.add(`${subject} was going to ${verb}`);
      
      // Wrong: just "will" - "She will eat"
      distractors.add(`${subject} will ${verb}`);
      
      // Wrong: wrong agreement - "She are going to eat"
      const wrongBe = be.toLowerCase() === 'is' ? 'are' : 'is';
      distractors.add(`${subject} ${wrongBe} going to ${verb}`);
    }
    
    return Array.from(distractors).filter(d => d !== truncated && d !== correct).slice(0, 3);
  }

  // Generate distractors for "be going to" questions
  function generateGoingToQuestionDistractors(item, correct) {
    const distractors = [];
    // We want three specific clearly-wrong forms in this order:
    // 1) Wrong conjugation (e.g. "Is we going to play?")
    // 2) Wrong auxiliary using will (e.g. "Will we going to play?")
    // 3) Wrong infinitive use (e.g. "Are we going to playing?")
    const match = correct.match(/^(Is|Are|Am)\s+([A-Za-z0-9'’]+)\s+going\s+to\s+([A-Za-z]+)/i);
    if (match) {
      const be = match[1];
      const subject = match[2];
      const verb = match[3];

      // 1) Wrong conjugation: flip 'is' <-> 'are' when possible
      let wrongConj;
      const beLower = be.toLowerCase();
      if (beLower === 'are') wrongConj = 'Is';
      else if (beLower === 'is') wrongConj = 'Are';
      else wrongConj = 'Is';
      distractors.push(`${wrongConj} ${subject} going to ${verb}?`);

      // 2) Wrong auxiliary 'will' with 'going to'
      distractors.push(`Will ${subject} going to ${verb}?`);

      // 3) Wrong infinitive use: use -ing after 'to'
      // simple -ing formation: drop trailing 'e' if present
      let verbIng = verb;
      if (verbIng.endsWith('ie')) {
        verbIng = verbIng.slice(0, -2) + 'ying';
      } else if (verbIng.endsWith('e') && verbIng.length > 1) {
        verbIng = verbIng.slice(0, -1) + 'ing';
      } else {
        verbIng = verbIng + 'ing';
      }
      distractors.push(`${be} ${subject} going to ${verbIng}?`);
    }

    // Ensure we don't accidentally include the correct form and return exactly three
    const unique = Array.from(new Set(distractors)).filter(d => d && d !== correct);
    // Pad or trim to exactly 3
    while (unique.length < 3) unique.push(unique[unique.length - 1] || '');
    return unique.slice(0, 3);
  }

  // Helper: truncate "be going to" question to subject + verb phrase (keep as a question)
  function truncateGoingToQuestion(sentence) {
    // Match pattern: Is/Are/Am + subject + going to + verb
    const match = sentence.match(/^(Is|Are|Am)\s+([A-Za-z0-9'’]+)\s+going\s+to\s+([A-Za-z]+)/i);
    if (match) {
      const be = match[1];
      const subject = match[2];
      const verb = match[3];
      return `${be} ${subject} going to ${verb}?`;
    }
    // Fallback: keep up to and including the 'going to <verb>' part
    const m2 = sentence.match(/^(.*?going\s+to\s+\w+)/i);
    if (m2) {
      let s = m2[1].trim();
      if (!s.endsWith('?')) s = s + '?';
      return s;
    }
    return sentence.length <= 35 ? sentence : sentence.substring(0, 35) + '...';
  }

  function renderQuestion(containerEl) {
    const item = state.list[state.index];
    if (!item) {
      finish(containerEl);
      return;
    }

    const answers = makeChoices(item);
    const questionNumber = state.index + 1;
    const totalQuestions = state.list.length;
    
    // Adaptive display based on grammar type
    const display = getDisplayForGrammarType(item, state.grammarType);
    const displayEmoji = escapeHtml(item.emoji || '🟩');

    containerEl.innerHTML = `
      <div class="grammar-choose-l3" style="padding:24px 20px 18px;display:flex;flex-direction:column;min-height:100%;font-family:'Poppins',Arial,sans-serif;">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;margin-bottom:18px;text-align:center;">
          <div style="font-size:3rem;line-height:1;">${displayEmoji}</div>
          <div style="font-size:clamp(1.4rem, 5vw, 2rem);font-weight:800;letter-spacing:0.02em;color:#21b5c0;">${display.main}</div>
          <div style="margin-top:6px;font-size:0.95rem;color:#21b5c0;">${display.instruction}</div>
        </div>
        <div id="gch-choices" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:14px;justify-items:center;">
          ${answers.map((answer) => {
            const safeAnswer = escapeHtml(answer);
            return `<button data-answer="${safeAnswer}" class="grammar-choice-btn" style="flex:1;min-width:clamp(120px, 24vw, 170px);padding:clamp(12px,2.5vh,16px) clamp(16px,3vw,24px);font-size:clamp(1.1rem,3vw,1.5rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 10px rgba(0,0,0,0.08);text-transform:none;font-family:'Poppins',Arial,sans-serif;">${safeAnswer}</button>`;
          }).join('')}
        </div>
        <div id="gch-feedback" style="min-height:1.2em;font-weight:700;font-size:1rem;margin-bottom:12px;color:#2e7d32"></div>
        <div style="margin-top:auto;font-size:0.85rem;color:#888;text-align:center;font-family:'Poppins',Arial,sans-serif;">Question ${questionNumber} / ${totalQuestions}</div>
        <div style="display:flex;justify-content:center;margin-top:12px;">
          <button id="gch-quit" type="button" class="wa-quit-btn" style="border:none;background:transparent;cursor:pointer;display:flex;align-items:center;gap:8px;padding:4px;">
            <img src="./assets/Images/icons/quit-game.svg" alt="Quit game" aria-hidden="true" style="width:28px;height:28px;" />
          </button>
        </div>
      </div>`;

    const choicesEl = containerEl.querySelector('#gch-choices');
    choicesEl.querySelectorAll('button.grammar-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosenText = btn.textContent.trim();
        markChoices(choicesEl, chosenText, item);
        disableChoices(choicesEl);
        handleChoice(chosenText, item, containerEl);
      });
    });

    const quitBtn = containerEl.querySelector('#gch-quit');
    if (quitBtn) {
      quitBtn.onclick = () => quitToMenu('quit');
    }
  }

  function getDisplayForGrammarType(item, grammarType) {
    const sentence = (item.en || item.exampleSentence || '').trim();
    
    switch (grammarType) {
      case 'past_simple_regular': {
        // Show the base verb (extracted from the sentence)
        const verbBase = extractVerbBase(sentence);
        return {
          main: verbBase || item.word || 'verb',
          instruction: 'Pick the correct past tense form.'
        };
      }
      case 'be_going_to_future': {
        // Show Korean, options will be truncated English sentences
        return {
          main: escapeHtml(item.ko || item.exampleSentenceKo || ''),
          instruction: 'Choose the correct "be going to" sentence.'
        };
      }
      case 'be_going_to_questions': {
        // Show Korean, options will be question forms
        return {
          main: escapeHtml(item.ko || item.exampleSentenceKo || ''),
          instruction: 'Choose the correct question.'
        };
      }
      case 'past_vs_future': {
        // Show truncated English sentence, player picks time word
        const sentence = (item.en || item.exampleSentence || '').trim();
        const truncated = truncateSentenceForTimeChoice(sentence);
        return {
          main: escapeHtml(truncated),
          instruction: 'Choose the correct time word.'
        };
      }
      case 'all_tenses':
        return {
          main: escapeHtml(item.ko || item.exampleSentenceKo || ''),
          instruction: 'Match the correct tense.'
        };
      case 'irregular_past':
        return {
          main: escapeHtml(item.base || item.word || 'Base Verb'),
          instruction: 'Pick the correct past-tense form.'
        };
      case 'sentence_based':
        return {
          main: escapeHtml(item.ko || item.exampleSentenceKo || ''),
          instruction: 'Choose the correct sentence.'
        };
      default:
        return {
          main: escapeHtml(item.base || item.word || item.en || ''),
          instruction: 'Choose the correct answer.'
        };
    }
  }

  function makeChoices(item) {
    const grammarType = state.grammarType;
    const sentence = (item.en || item.exampleSentence || '').trim();
    
    // Past Simple Regular: Show base verb, options are verb forms
    if (grammarType === 'past_simple_regular') {
      const verbBase = extractVerbBase(sentence);
      if (verbBase) {
        // Find the actual past tense verb in the sentence
        const pastMatch = sentence.match(/\b(\w+ed)\b/i);
        const correct = pastMatch ? pastMatch[1] : verbBase + 'ed';
        const distractors = generatePastRegularDistractors(verbBase, correct);
        const options = shuffle([correct, ...distractors]);
        return options.slice(0, 4);
      }
    }
    
    // Be Going To Future: Show Korean, options are truncated English sentences
    if (grammarType === 'be_going_to_future') {
      const correct = truncateGoingToSentence(sentence);
      const distractors = generateGoingToDistractors(item, sentence);
      const options = shuffle([correct, ...distractors]);
      // Ensure correct is included
      if (!options.includes(correct)) {
        options[options.length - 1] = correct;
      }
      return shuffle(options.slice(0, 4));
    }
    
    // Be Going To Questions: Show Korean, options are question forms
    if (grammarType === 'be_going_to_questions') {
      const correct = truncateGoingToQuestion(sentence);
      const distractors = generateGoingToQuestionDistractors(item, sentence).map(d => truncateGoingToQuestion(d));
      const options = shuffle([correct, ...distractors]);
      if (!options.includes(correct)) {
        options[options.length - 1] = correct;
      }
      return shuffle(options.slice(0, 4));
    }
    
    // Past vs Future: show 2 time word options
    if (grammarType === 'past_vs_future') {
      const timeWord = extractTimeWord(sentence);
      if (timeWord) {
        const tense = item.tense || (PAST_TIME_WORDS.some(tw => tw.toLowerCase() === timeWord.toLowerCase()) ? 'past' : 'future');
        const wrongTimeWord = getOppositeTimeWord(timeWord, tense);
        return shuffle([timeWord, wrongTimeWord]);
      }
      // Fallback if no time word found
      return shuffle(['yesterday', 'tomorrow']);
    }

    // For other sentence-based grammars
    if (['all_tenses', 'sentence_based'].includes(grammarType)) {
      const correct = sentence;
      const poolSet = new Set();
      if (correct) poolSet.add(correct);
      
      // Generate distractors from other items in the list
      for (const other of state.list) {
        if (other === item) continue;
        const otherEn = (other.en || other.exampleSentence || '').trim();
        if (otherEn && otherEn !== correct) poolSet.add(otherEn);
        if (poolSet.size >= 4) break;
      }
      
      const arr = Array.from(poolSet).filter(Boolean);
      while (arr.length < 3) arr.push(correct || arr[0] || '');
      const options = shuffle(arr);
      if (correct && !options.includes(correct)) {
        options[options.length - 1] = correct;
      }
      return shuffle(options.slice(0, 4));
    }
    
    // For irregular past tense (original logic)
    const correct = (item.past || item.base || item.word || item.en || '').trim();
    const poolSet = new Set();
    if (correct) poolSet.add(correct);
    if (Array.isArray(item.detractors)) {
      item.detractors.forEach((d) => { if (d && d.trim()) poolSet.add(d.trim()); });
    }
    const arr = Array.from(poolSet).filter(Boolean);
    // Ensure the correct answer is present
    if (correct && !arr.includes(correct)) arr.unshift(correct);
    // Guarantee at least 3 options
    while (arr.length < 3) arr.push(correct || arr[0] || '');
    const options = shuffle(arr);
    if (correct && !options.includes(correct)) {
      options[options.length - 1] = correct;
    }
    return options.slice(0, 4);
  }

  function getCorrectAnswer(item) {
    const grammarType = state.grammarType;
    const sentence = (item.en || item.exampleSentence || '').trim();
    
    // Past Simple Regular: correct is the -ed verb form
    if (grammarType === 'past_simple_regular') {
      const pastMatch = sentence.match(/\b(\w+ed)\b/i);
      if (pastMatch) return pastMatch[1];
    }
    
    // Be Going To Future: correct is the truncated sentence
    if (grammarType === 'be_going_to_future') {
      return truncateGoingToSentence(sentence);
    }
    
    // Be Going To Questions: correct is the full question
    if (grammarType === 'be_going_to_questions') {
      return truncateGoingToQuestion(sentence);
    }
    
    // Past vs Future: correct answer is the time word
    if (grammarType === 'past_vs_future') {
      return extractTimeWord(sentence) || 'yesterday';
    }

    // For other sentence-based grammars
    if (['all_tenses', 'sentence_based'].includes(grammarType)) {
      return sentence;
    }
    
    // For irregular past tense (original logic)
    return (item.past || item.word || item.en || '').trim();
  }

  function handleChoice(chosen, item, containerEl) {
    const correct = getCorrectAnswer(item);
    const isCorrect = chosen === correct;
    if (isCorrect) state.score += 1;
    // Log attempt
    try {
      logAttempt({
        session_id: state.sessionId,
        mode: MODE,
        word: item.word || item.id || item.base || item.past || item.en || 'unknown',
        is_correct: isCorrect,
        answer: chosen,
        correct_answer: correct,
        points: isCorrect ? 1 : 0,
        attempt_index: state.index,
        round: state.index + 1,
        extra: { category: 'grammar', grammarFile: state.grammarFile, level: 3, grammarType: state.grammarType }
      });
    } catch {}
    state.index += 1;
    playFeedbackSFX(isCorrect);
    const feedbackEl = containerEl.querySelector('#gch-feedback');
    if (feedbackEl) {
      feedbackEl.textContent = isCorrect ? 'Correct!' : `No — the right answer is ${correct}`;
      feedbackEl.style.color = isCorrect ? '#2e7d32' : '#f44336';
    }
    // Play sentence audio after feedback (short delay for SFX to finish)
    setTimeout(() => { playSentenceAudio(item); }, 300);
    pendingTimeout = setTimeout(() => {
      // Guard: only proceed if state is still valid (not cleared by quit/restart)
      if (!state) return;
      renderQuestion(containerEl);
    }, 2500); // Increased timeout to allow audio to play
  }

  function markChoices(choicesEl, chosenText, item) {
    if (!choicesEl) return;
    const correct = getCorrectAnswer(item);
    choicesEl.querySelectorAll('button.grammar-choice-btn').forEach((btn) => {
      const text = (btn.textContent || '').trim();
      if (text === correct) {
        btn.style.background = '#2e7d32';
        btn.style.color = '#fff';
        btn.style.border = '3px solid #2e7d32';
      } else if (text === chosenText) {
        btn.style.background = '#f44336';
        btn.style.color = '#fff';
        btn.style.border = '3px solid #f44336';
      } else {
        btn.style.opacity = '0.7';
      }
    });
  }

  function disableChoices(choicesEl) {
    if (!choicesEl) return;
    choicesEl.querySelectorAll('button.grammar-choice-btn').forEach((btn) => btn.disabled = true);
  }

  function playFeedbackSFX(isCorrect) {
    const fx = state?.playSFX;
    if (typeof fx === 'function') {
      try { fx(isCorrect ? 'correct' : 'wrong'); } catch (err) { console.debug('SFX failed', err); }
    } else if (window.WordArcade && typeof window.WordArcade.playSFX === 'function') {
      try { window.WordArcade.playSFX(isCorrect ? 'correct' : 'wrong'); } catch {}
    }
  }

  function finish(containerEl) {
    // End session & show shared summary UI
    try {
      // Use grammarFile path for session tracking to match homework assignment list_key
      endSession(state.sessionId, {
        mode: MODE,
        summary: { score: state.score, total: state.list.length, correct: state.score, points: state.score, category: 'grammar', grammarFile: state.grammarFile, grammarName: state.grammarName, level: 3 },
        listName: state.grammarFile || state.grammarName || null,
        wordList: state.list.map(it => it.word || it.id || it.base || it.past).filter(Boolean),
        meta: { category: 'grammar', grammarFile: state.grammarFile, grammarName: state.grammarName, level: 3 }
      });
    } catch {}
    // Remove any stray quit buttons from body
    try { document.querySelectorAll('body > .wa-quit-btn, body > [title="Quit"]').forEach(btn => btn.remove()); } catch {}
    renderGrammarSummary({ gameArea: containerEl, score: state.score, total: state.list.length, ctx: { grammarFile: state.grammarFile, grammarName } });
    if (onComplete) onComplete(state);
  }
}

export function stopGrammarChooseL3() {
  if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
  state = null;
}

function quitToMenu(reason = 'quit') {
  const current = state;
  if (!current) return;
  const { onQuit, onComplete, container } = current;
  if (container) {
    try { container.innerHTML = ''; } catch {}
  }
  // Partial endSession for quit (records progress so stars can update)
  if (current.sessionId) {
    try {
      // Use grammarFile path for session tracking to match homework assignment list_key
      endSession(current.sessionId, {
        mode: MODE,
        summary: { score: current.score, total: current.list.length, correct: current.score, points: current.score, category: 'grammar', grammarFile: current.grammarFile, grammarName: current.grammarName, level: 3 },
        listName: current.grammarFile || current.grammarName || null,
        wordList: current.list.map(it => it.word || it.id || it.base || it.past).filter(Boolean),
        meta: { category: 'grammar', grammarFile: current.grammarFile, grammarName: current.grammarName, level: 3, quit_reason: reason }
      });
    } catch {}
  }
  if (typeof onComplete === 'function') {
    try { onComplete({ reason, state: current }); } catch (err) { console.error('onComplete failed', err); }
  }
  if (typeof onQuit === 'function') {
    try { onQuit({ reason }); } catch (err) { console.error('onQuit failed', err); }
  } else {
    try {
      if (window.WordArcade?.startGrammarModeSelector) {
        window.WordArcade.startGrammarModeSelector();
      } else if (window.WordArcade?.showGrammarLevelsMenu) {
        window.WordArcade.showGrammarLevelsMenu();
      } else if (window.WordArcade?.quitToOpening) {
        window.WordArcade.quitToOpening(true);
      } else if (window.history?.length > 1) {
        window.history.back();
      } else {
        location.reload();
      }
    } catch {}
  }
  stopGrammarChooseL3();
}

export default { init: initGrammarChooseL3, start: startGrammarChooseL3, stop: stopGrammarChooseL3 };
