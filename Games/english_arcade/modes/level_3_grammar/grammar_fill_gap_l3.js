// Level‑3 Fill‑The‑Gap (past‑tense focused + tense-based sentences)
// Lightweight fill-gap mode that blanks a key verb/phrase and offers multiple-choice answers.
// Supports: past_simple_irregular, be_going_to, past_simple_regular, past_vs_future, all_tenses

import { startSession, logAttempt, endSession } from '../../../../students/records.js';
import { renderGrammarSummary } from '../grammar_summary.js';

let state = null;
let pendingTimeout = null;
const MODE = 'grammar_fill_gap';
const DEFAULT_FILE = 'data/grammar/level3/past_simple_irregular.json';

// Detect grammar type from filename or data properties
function detectGrammarType(filePath, data) {
  const path = (filePath || '').toLowerCase();
  if (path.includes('be_going_to')) return 'be_going_to';
  if (path.includes('past_simple_regular')) return 'past_regular';
  if (path.includes('past_vs_future')) return 'past_vs_future';
  if (path.includes('past_vs_present_vs_future') || path.includes('all_tense')) return 'all_tenses';
  if (path.includes('tense_question')) return 'tense_questions';
  // Will future/questions: sentence-based with "will" patterns
  if (path.includes('will_future')) return 'will_future';
  if (path.includes('will_questions')) return 'will_questions';
  // Modal verbs: have to, want to, like to
  if (path.includes('have_to')) return 'have_to';
  if (path.includes('want_to')) return 'want_to';
  if (path.includes('like_to')) return 'like_to';
  // Check data properties for hints
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (first.structure && first.tense) return 'sentence_based';
    if (first.detractors) return 'past_irregular';
  }
  return 'past_irregular';
}

// Verb conjugation helpers for past_vs_future
function getVerbBase(pastOrFuture) {
  // Extract base verb from "will verb" or past tense
  const willMatch = pastOrFuture.match(/will\s+(\w+)/i);
  if (willMatch) return willMatch[1];
  // Try to get base from past tense (-ed verbs)
  if (pastOrFuture.endsWith('ed')) {
    let base = pastOrFuture.slice(0, -2);
    // Handle doubled consonants
    if (/([bcdfghjklmnpqrstvwxz])\1$/.test(base)) base = base.slice(0, -1);
    // Handle -ied -> -y
    if (base.endsWith('i')) base = base.slice(0, -1) + 'y';
    return base;
  }
  return pastOrFuture;
}

function makePastTense(base) {
  if (!base) return base;
  if (base.endsWith('e')) return base + 'd';
  if (base.endsWith('y') && !/[aeiou]y$/.test(base)) return base.slice(0, -1) + 'ied';
  return base + 'ed';
}

// Common irregular past tenses
const IRREGULAR_PAST = {
  go: 'went', eat: 'ate', see: 'saw', have: 'had', find: 'found',
  buy: 'bought', watch: 'watched', play: 'played', start: 'started',
  finish: 'finished', clean: 'cleaned', study: 'studied', work: 'worked',
  travel: 'traveled', learn: 'learned', visit: 'visited'
};

function getPastForm(base) {
  const lower = (base || '').toLowerCase();
  if (IRREGULAR_PAST[lower]) return IRREGULAR_PAST[lower];
  return makePastTense(lower);
}

function getFutureForm(base) {
  return 'will ' + (base || '').toLowerCase();
}

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

export async function startGrammarFillGapL3({
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
    currentAnswerToken: '',
  };

  try {
    const list = await loadGrammarList(state.grammarFile);
    state.list = Array.isArray(list) ? list.slice() : [];
    state.grammarType = detectGrammarType(state.grammarFile, state.list);
  } catch (err) {
    console.error('Failed to load grammar list', err);
    state.list = [];
    state.grammarType = 'past_irregular';
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
    console.debug('[fill_gap_l3] startSession failed', e?.message);
    state.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }

  if (!state.list.length) {
    container.innerHTML = '<div style="padding:20px">No Level 3 grammar content found.</div>';
    if (onComplete) onComplete(state);
    return;
  }

  state.list = shuffle(state.list);
  renderQuestion(container);

  // Get instruction text based on grammar type
  function getInstructionText() {
    const grammarType = state.grammarType;
    switch (grammarType) {
      case 'be_going_to': return 'Fill in the blank with the correct form';
      case 'past_regular': return 'Fill in the blank with the correct verb form';
      case 'past_vs_future': return 'Choose the correct verb form';
      case 'will_future': return 'Fill in the blank with "will + verb"';
      case 'will_questions': return 'Fill in the blank with "will"';
      case 'have_to': return 'Fill in the blank with "have to" or "has to"';
      case 'want_to': return 'Fill in the blank with "want to" or "wants to"';
      case 'like_to': return 'Fill in the blank with "like to" or "likes to"';
      case 'all_tenses':
      case 'tense_questions':
      case 'sentence_based':
        return 'Fill in the blank';
      default: return 'Fill in the correct past tense form';
    }
  }

  // Extract the main verb phrase from a sentence for past_vs_future
  function extractVerbPhrase(sentence, tense) {
    if (tense === 'future') {
      // Match "will verb" pattern
      const willMatch = sentence.match(/\bwill\s+(\w+)/i);
      if (willMatch) return { full: willMatch[0], base: willMatch[1] };
    } else {
      // Match past tense verbs (common patterns)
      // First try irregular verbs
      for (const [base, past] of Object.entries(IRREGULAR_PAST)) {
        const regex = new RegExp(`\\b${past}\\b`, 'i');
        if (regex.test(sentence)) {
          return { full: past, base };
        }
      }
      // Then try -ed verbs
      const edMatch = sentence.match(/\b(\w+ed)\b/i);
      if (edMatch) {
        const verb = edMatch[1];
        let base = verb.replace(/ed$/i, '');
        if (/([bcdfghjklmnpqrstvwxz])\1$/.test(base)) base = base.slice(0, -1);
        if (base.endsWith('i')) base = base.slice(0, -1) + 'y';
        return { full: verb, base };
      }
    }
    return null;
  }

  // Helper: extract verb base from -ed verb
  function extractVerbBase(verb) {
    let base = verb.replace(/ed$/i, '');
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

  // Generate distractors for regular past tense verb
  function generatePastVerbDistractors(base, correct) {
    const distractors = new Set();
    distractors.add(base); // e.g., "talk"
    distractors.add(base + 's'); // e.g., "talks"
    // Present continuous form
    if (base.endsWith('e')) {
      distractors.add('is ' + base.slice(0, -1) + 'ing'); // e.g., "is talking"
    } else {
      distractors.add('is ' + base + 'ing'); // e.g., "is talking"
    }
    return Array.from(distractors).filter(d => d !== correct).slice(0, 3);
  }
  
  // Generate distractors for past tense questions (Did you _____?)
  function generatePastQuestionDistractors(sentence) {
    const distractors = [];
    
    // Extract the verb from the question (Did you VERB?)
    const match = sentence.match(/^Did\s+(?:you|he|she|it|we|they)\s+(\w+)/i);
    if (match) {
      const baseVerb = match[1]; // e.g., "play", "eat", "go"
      
      // Distractor 1: Past tense form (wrong because "did" already indicates past)
      const pastForms = ['went', 'ate', 'saw', 'had', 'did', 'was', 'were', 'played', 'talked', 'walked'];
      let pastForm = baseVerb + 'ed';
      // Check for common irregulars
      const irregulars = {
        'go': 'went', 'eat': 'ate', 'see': 'saw', 'have': 'had', 'do': 'did',
        'be': 'was', 'take': 'took', 'get': 'got', 'make': 'made', 'come': 'came',
        'win': 'won', 'find': 'found', 'buy': 'bought', 'think': 'thought'
      };
      if (irregulars[baseVerb.toLowerCase()]) {
        pastForm = irregulars[baseVerb.toLowerCase()];
      }
      distractors.push(pastForm);
      
      // Distractor 2: Third-person present form (e.g., "plays" instead of "play")
      let thirdPerson = baseVerb + 's';
      if (baseVerb.endsWith('y') && baseVerb.length > 1 && !/[aeiou]y$/i.test(baseVerb)) {
        thirdPerson = baseVerb.slice(0, -1) + 'ies';
      } else if (baseVerb.endsWith('s') || baseVerb.endsWith('x') || baseVerb.endsWith('ch') || baseVerb.endsWith('sh')) {
        thirdPerson = baseVerb + 'es';
      }
      distractors.push(thirdPerson);
      
      // Distractor 3: Present progressive form (e.g., "playing" instead of "play")
      let progressive = baseVerb + 'ing';
      if (baseVerb.endsWith('e') && baseVerb.length > 2) {
        progressive = baseVerb.slice(0, -1) + 'ing';
      }
      distractors.push(progressive);
    }
    
    return distractors.filter(Boolean).slice(0, 3);
  }

  // Generate distractors for "be going to" phrase
  function generateGoingToDistractors(correctPhrase) {
    const distractors = new Set();
    
    // Parse the correct phrase to extract components
    const match = correctPhrase.match(/^(am|is|are)\s+going\s+to\s+(\w+)/i);
    if (match) {
      const be = match[1].toLowerCase();
      const verb = match[2];
      
      // Wrong agreement: swap is/are
      const wrongBe = be === 'is' ? 'are' : (be === 'are' ? 'is' : 'is');
      distractors.add(`${wrongBe} going to ${verb}`);
      
      // Missing "be": "going to verb"
      distractors.add(`going to ${verb}`);
      
      // Wrong: "will going to verb"
      distractors.add(`will going to ${verb}`);
      
      // Wrong: past "was going to"
      distractors.add(`was going to ${verb}`);
      
      // Wrong: just "will verb"
      distractors.add(`will ${verb}`);
    }
    
    return Array.from(distractors).filter(d => d.toLowerCase() !== correctPhrase.toLowerCase()).slice(0, 3);
  }

  // Extract blank target and generate appropriate distractors
  function extractBlankAndChoices(item) {
    const grammarType = state.grammarType;
    const sentence = (item.exampleSentence || item.en || '').trim();
    
    // Past vs Future: blank the verb, show 2 options (past vs future form)
    if (grammarType === 'past_vs_future') {
      const tense = item.tense || 'past';
      const verbInfo = extractVerbPhrase(sentence, tense);
      
      if (verbInfo) {
        const { full: correctVerb, base } = verbInfo;
        const blanked = sentence.replace(new RegExp(`\\b${correctVerb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '_____');
        
        // Generate opposite tense form
        let wrongVerb;
        if (tense === 'future') {
          // Correct is "will verb", wrong is past form
          wrongVerb = getPastForm(base);
        } else {
          // Correct is past form, wrong is "will verb"
          wrongVerb = getFutureForm(base);
        }
        
        return {
          blanked,
          answer: correctVerb,
          choices: shuffle([correctVerb, wrongVerb])
        };
      }
      
      // Fallback: just use generic options
      return {
        blanked: sentence.replace(/\b(went|will\s+\w+|\w+ed)\b/i, '_____'),
        answer: 'went',
        choices: ['went', 'will go']
      };
    }
    
    // Past Simple Regular: blank the -ed verb
    if (grammarType === 'past_regular') {
      const match = sentence.match(/\b(\w+ed)\b/i);
      if (match) {
        const pastVerb = match[1];
        const base = extractVerbBase(pastVerb);
        const blanked = sentence.replace(new RegExp(`\\b${pastVerb}\\b`, 'i'), '_____');
        const allDistractors = generatePastVerbDistractors(base, pastVerb);
        const distractors = shuffle(allDistractors).slice(0, 3);
        return {
          blanked,
          answer: pastVerb,
          choices: shuffle([pastVerb, ...distractors])
        };
      }
    }
    
    // Be Going To: blank the "am/is/are going to verb" phrase
    if (grammarType === 'be_going_to') {
      const match = sentence.match(/\b(am|is|are)\s+going\s+to\s+(\w+)/i);
      if (match) {
        const fullPhrase = match[0];
        const blanked = sentence.replace(fullPhrase, '_____');
        const allDistractors = generateGoingToDistractors(fullPhrase);
        const distractors = shuffle(allDistractors).slice(0, 3);
        return {
          blanked,
          answer: fullPhrase,
          choices: shuffle([fullPhrase, ...distractors])
        };
      }
    }
    
    // Will Future: blank the "will verb" phrase
    if (grammarType === 'will_future') {
      const match = sentence.match(/\b(will\s+\w+)/i);
      if (match) {
        const willPhrase = match[1];
        const blanked = sentence.replace(new RegExp(`\\b${willPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '_____');
        // Generate distractors - NO "going to" (practically same meaning)
        const verb = willPhrase.replace(/^will\s+/i, '');
        const irregularPasts = { 'go': 'went', 'eat': 'ate', 'come': 'came', 'see': 'saw', 'do': 'did', 'have': 'had', 'make': 'made', 'take': 'took', 'get': 'got', 'buy': 'bought' };
        const pastForm = irregularPasts[verb.toLowerCase()] || verb + 'ed';
        const allDistractors = [
          `will ${pastForm}`,      // will went, will ate (wrong: double tense)
          `would ${verb}`,          // would go (wrong tense/mood)
          `will ${verb}s`,          // will goes (wrong: conjugated after will)
          verb + 'ing',             // going (wrong: missing will)
          verb + 's'                // goes (wrong: present tense)
        ].filter(d => d.toLowerCase() !== willPhrase.toLowerCase());
        const distractors = shuffle(allDistractors).slice(0, 3);
        return {
          blanked,
          answer: willPhrase,
          choices: shuffle([willPhrase, ...distractors])
        };
      }
    }
    
    // Will Questions: vary what gets blanked - auxiliary OR verb OR time expression
    if (grammarType === 'will_questions') {
      const questionMatch = sentence.match(/^(Will)\s+(\w+)\s+(\w+)(.*)$/i);
      if (questionMatch) {
        const aux = questionMatch[1];        // "Will"
        const subject = questionMatch[2];    // "she"
        const verb = questionMatch[3];       // "play"
        const rest = questionMatch[4];       // "tomorrow?"
        
        // Randomly choose what to blank
        const blankType = Math.floor(Math.random() * 3);
        
        if (blankType === 0) {
          // Blank the verb - student chooses correct verb form
          const blanked = sentence.replace(new RegExp(`\\b${verb}\\b`, 'i'), '_____');
          const irregularPasts = { 'go': 'went', 'eat': 'ate', 'come': 'came', 'see': 'saw', 'play': 'played', 'do': 'did' };
          const pastForm = irregularPasts[verb.toLowerCase()] || verb + 'ed';
          const distractors = shuffle([
            verb + 's',      // goes (wrong after will)
            verb + 'ing',    // going (wrong after will)
            pastForm         // went (wrong after will)
          ]).slice(0, 3);
          return {
            blanked,
            answer: verb,
            choices: shuffle([verb, ...distractors])
          };
        } else if (blankType === 1 && /\b(tomorrow|next week|later|soon)\b/i.test(rest)) {
          // Blank a time expression
          const timeMatch = rest.match(/\b(tomorrow|next week|later|soon)\b/i);
          if (timeMatch) {
            const timeWord = timeMatch[1];
            const blanked = sentence.replace(new RegExp(`\\b${timeWord}\\b`, 'i'), '_____');
            const distractors = shuffle(['yesterday', 'last week', 'now', 'ago']).slice(0, 3);
            return {
              blanked,
              answer: timeWord,
              choices: shuffle([timeWord, ...distractors])
            };
          }
        }
        
        // Default: blank the auxiliary - ALWAYS include "Will" as correct answer
        const blanked = sentence.replace(/^Will\s+/i, '_____ ');
        const distractors = shuffle(['Do', 'Does', 'Did', 'Is', 'Are']).slice(0, 3);
        return {
          blanked,
          answer: aux,
          choices: shuffle([aux, ...distractors])
        };
      }
    }
    
    // Have To: blank the "have to" or "has to" phrase
    // NEVER use "need to" as distractor (synonymous)
    if (grammarType === 'have_to') {
      const match = sentence.match(/\b(have to|has to)\b/i);
      if (match) {
        const haveToPhrase = match[1];
        const blanked = sentence.replace(new RegExp(`\\b${haveToPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '_____');
        // NO "need to" - too similar in meaning
        const allDistractors = ['want to', 'like to', 'must to', 'should to', 'going to'];
        // Always include both have to and has to
        const otherVariant = haveToPhrase.toLowerCase() === 'have to' ? 'has to' : 'have to';
        const distractors = shuffle(allDistractors).slice(0, 2);
        return {
          blanked,
          answer: haveToPhrase,
          choices: shuffle([haveToPhrase, otherVariant, ...distractors])
        };
      }
    }
    
    // Want To: blank the "want to" or "wants to" phrase
    // NEVER use "need to" as distractor (synonymous)
    if (grammarType === 'want_to') {
      const match = sentence.match(/\b(want to|wants to)\b/i);
      if (match) {
        const wantToPhrase = match[1];
        const blanked = sentence.replace(new RegExp(`\\b${wantToPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '_____');
        // NO "need to" - too similar in meaning
        const allDistractors = ['have to', 'has to', 'like to', 'must to', 'going to'];
        const otherVariant = wantToPhrase.toLowerCase() === 'want to' ? 'wants to' : 'want to';
        const distractors = shuffle(allDistractors).slice(0, 2);
        return {
          blanked,
          answer: wantToPhrase,
          choices: shuffle([wantToPhrase, otherVariant, ...distractors])
        };
      }
    }
    
    // Like To: blank the "like to" or "likes to" phrase
    if (grammarType === 'like_to') {
      const match = sentence.match(/\b(like to|likes to)\b/i);
      if (match) {
        const likeToPhrase = match[1];
        const blanked = sentence.replace(new RegExp(`\\b${likeToPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '_____');
        const allDistractors = ['have to', 'want to', 'must to', 'going to'];
        const otherVariant = likeToPhrase.toLowerCase() === 'like to' ? 'likes to' : 'like to';
        const distractors = shuffle(allDistractors).slice(0, 2);
        return {
          blanked,
          answer: likeToPhrase,
          choices: shuffle([likeToPhrase, otherVariant, ...distractors])
        };
      }
    }
    
    // Fallback for irregular past or other types
    const pastToken = (item.past || '').trim();
    const baseToken = (item.base || '').trim();
    
    // Special handling for past tense questions (Did you _____?)
    if (grammarType === 'tense_questions' || /^Did\s+/i.test(sentence)) {
      const didMatch = sentence.match(/^(Did)\s+(?:you|he|she|it|we|they)\s+(\w+)/i);
      if (didMatch) {
        const didWord = didMatch[1]; // "Did"
        const baseVerb = didMatch[2]; // e.g., "play", "eat"
        
        // Blank the base verb after "Did"
        const blanked = sentence.replace(new RegExp(`\\b${baseVerb}\\b`, 'i'), '_____');
        const allDistractors = generatePastQuestionDistractors(sentence);
        const distractors = shuffle(allDistractors).slice(0, 3);
        
        return {
          blanked,
          answer: baseVerb,
          choices: shuffle([baseVerb, ...distractors])
        };
      }
    }
    
    if (pastToken && sentence.toLowerCase().includes(pastToken.toLowerCase())) {
      const re = new RegExp(pastToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const blanked = sentence.replace(re, '_____');
      // Use detractors if available
      let choices = [pastToken];
      if (Array.isArray(item.detractors)) {
        choices = [pastToken, ...item.detractors.filter(d => d && d.trim())];
      }
      // Add base form if not present
      if (baseToken && !choices.includes(baseToken)) {
        choices.push(baseToken);
      }
      // Ensure answer is always included - slice distractors first
      if (choices.length > 4) {
        choices = [pastToken, ...shuffle(choices.slice(1)).slice(0, 3)];
      }
      return {
        blanked,
        answer: pastToken,
        choices: shuffle(choices)
      };
    }
    
    // Last resort: blank some word
    const words = sentence.split(/\s+/);
    if (words.length > 2) {
      const targetIdx = Math.floor(words.length / 2);
      const answer = words[targetIdx];
      words[targetIdx] = '_____';
      return {
        blanked: words.join(' '),
        answer,
        choices: shuffle([answer, 'is', 'was', 'will'])
      };
    }
    
    return {
      blanked: sentence,
      answer: '',
      choices: ['is', 'was', 'will', 'are']
    };
  }

  function renderQuestion(containerEl) {
    const item = state.list[state.index];
    if (!item) {
      finish(containerEl);
      return;
    }

    const { blanked, answer, choices } = extractBlankAndChoices(item);
    state.currentAnswerToken = answer;

    const questionNumber = state.index + 1;
    const totalQuestions = state.list.length;
    const koText = escapeHtml(item.exampleSentenceKo || item.ko || '');

    containerEl.innerHTML = `
      <div class="grammar-fill-gap-l3" style="padding:20px 18px 90px 18px;display:flex;flex-direction:column;min-height:100vh;font-family:'Poppins',Arial,sans-serif;gap:0;overflow:visible;">
        <div style="font-size:0.85rem;color:#888;text-align:center;flex-shrink:0;margin-bottom:16px;">Question ${questionNumber} / ${totalQuestions}</div>
        <div style="font-size:1.47rem;font-weight:600;color:#21b5c0;text-align:center;flex-shrink:0;line-height:1.4;margin-bottom:60px;">${koText}</div>
        <div style="font-size:1.4rem;font-weight:700;text-align:center;padding:16px;border-radius:12px;border:2px solid #f0f0f0;background:#fff;color:#333;flex-shrink:0;margin-bottom:60px;">${escapeHtml(blanked)}</div>
        <div id="gfg-choices" style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;justify-items:stretch;flex-shrink:0;margin-bottom:20px;max-width:500px;margin-left:auto;margin-right:auto;width:100%;">
          ${choices.map((c) => `<button data-answer="${escapeHtml(c)}" class="gfg-choice-btn" style="padding:12px 16px;font-size:1.1rem;font-weight:800;border-radius:20px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,0.06);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c)}</button>`).join('')}
        </div>
        <div id="gfg-feedback" style="min-height:1.2em;font-weight:700;font-size:1rem;color:#2e7d32;text-align:center;flex-shrink:0;"></div>
      </div>`;

    // Add quit button (fixed position at bottom)
    if (!document.getElementById('gfg-quit')) {
      const quitBtn = document.createElement('button');
      quitBtn.id = 'gfg-quit';
      quitBtn.type = 'button';
      quitBtn.className = 'wa-quit-btn';
      quitBtn.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);border:none;background:transparent;cursor:pointer;z-index:9999;padding:8px;';
      quitBtn.innerHTML = '<img src="./assets/Images/icons/quit-game.svg" alt="Quit" style="width:32px;height:32px;"/>';
      quitBtn.onclick = () => { quitBtn.remove(); window.history.back(); };
      document.body.appendChild(quitBtn);
    }

    const choicesEl = containerEl.querySelector('#gfg-choices');
    choicesEl.querySelectorAll('button.gfg-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosenText = btn.textContent.trim();
        markChoices(choicesEl, chosenText, item);
        disableChoices(choicesEl);
        handleChoice(chosenText, item, containerEl);
      });
    });
  }

  function makeChoices(item, answerToken) {
    const correct = (answerToken || item.past || item.base || item.word || item.en || '').trim();
    const pool = new Set();
    if (correct) pool.add(correct);
    // Add other verbs from the grammar list (excluding the current item)
    for (const other of state.list) {
      if (!other || other === item) continue;
      const cand = (other.past || other.base || other.word || other.en || '').trim();
      if (cand) pool.add(cand);
      if (pool.size >= 6) break;
    }
    const arr = Array.from(pool).filter(Boolean);
    // Ensure correct present
    if (correct && !arr.includes(correct)) arr.unshift(correct);
    while (arr.length < 3) arr.push(correct || arr[0] || '');
    const options = shuffle(arr);
    // Guarantee inclusion inside the first 4 returned
    let firstFour = options.slice(0, 4);
    if (correct && !firstFour.includes(correct)) {
      // Replace a random index in firstFour with correct to preserve variety
      const replaceIdx = Math.floor(Math.random() * firstFour.length);
      firstFour[replaceIdx] = correct;
    }
    return shuffle(firstFour);
  }

  // For sentence-based modes: generate sentence choices from other items
  function makeSentenceChoices(item, correctSentence) {
    const pool = new Set();
    if (correctSentence) pool.add(correctSentence);
    
    // Collect other sentences from the list
    for (const other of state.list) {
      if (!other || other === item) continue;
      const otherEn = (other.en || other.exampleSentence || '').trim();
      if (otherEn && otherEn !== correctSentence) pool.add(otherEn);
      if (pool.size >= 4) break;
    }
    
    const arr = Array.from(pool).filter(Boolean);
    // Ensure at least 3 options
    while (arr.length < 3) arr.push(correctSentence || arr[0] || '');
    
    const options = shuffle(arr);
    // Guarantee correct is included
    if (correctSentence && !options.includes(correctSentence)) {
      options[options.length - 1] = correctSentence;
    }
    return shuffle(options.slice(0, 4));
  }

  function handleChoice(chosen, item, containerEl) {
    const correct = (state.currentAnswerToken || item.past || '').trim();
    const isCorrect = chosen.trim().toLowerCase() === correct.trim().toLowerCase();
    if (isCorrect) state.score += 1;
    // Log attempt
    try {
      logAttempt({
        session_id: state.sessionId,
        mode: MODE,
        word: item.word || item.id || item.base || item.past || 'unknown',
        is_correct: isCorrect,
        answer: chosen,
        correct_answer: correct,
        points: isCorrect ? 1 : 0,
        attempt_index: state.index,
        round: state.index + 1,
        extra: { category: 'grammar', grammarFile: state.grammarFile, level: 3 }
      });
    } catch {}
    state.index += 1;
    playFeedbackSFX(isCorrect);
    const feedbackEl = containerEl.querySelector('#gfg-feedback');
    if (feedbackEl) {
      feedbackEl.textContent = isCorrect ? 'Correct!' : `No — the right answer is ${correct}`;
      feedbackEl.style.color = isCorrect ? '#2e7d32' : '#f44336';
    }
    pendingTimeout = setTimeout(() => {
      // Guard: only proceed if state is still valid
      if (!state) return;
      renderQuestion(containerEl);
    }, 700);
  }

  function markChoices(choicesEl, chosenText, item) {
    if (!choicesEl) return;
    const correct = (state.currentAnswerToken || item.past || '').trim();
    choicesEl.querySelectorAll('button.gfg-choice-btn').forEach((btn) => {
      const text = (btn.textContent || '').trim();
      if (text.trim().toLowerCase() === correct.trim().toLowerCase()) {
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
    choicesEl.querySelectorAll('button.gfg-choice-btn').forEach((btn) => btn.disabled = true);
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

  // expose stop via closure (not exported) but provide external stop fn below
}

export function stopGrammarFillGapL3() {
  if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
  // Clean up any fixed position quit buttons or lingering elements
  try {
    document.querySelectorAll('#gfg-quit, .grammar-fill-gap-l3, button[id*="gfg"]').forEach(el => el.remove());
  } catch {}
  state = null;
}

export default { start: startGrammarFillGapL3, stop: stopGrammarFillGapL3 };
