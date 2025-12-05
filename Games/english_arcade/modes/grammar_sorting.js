// Generic Grammar Sorting Mode
// Supports bucket-based sorting for lists like Short Questions 1

import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { renderGrammarSummary } from './grammar_summary.js';
import { openNowLoadingSplash } from './unscramble_splash.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('data-')) node.setAttribute(k, v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => c && node.appendChild(c));
  return node;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeShortQuestionCategory(text) {
  let t = String(text || '').trim().toLowerCase();
  t = t.replace(/^(yes|no)[,]?\s+/, '');
  if (t.startsWith('do ')) return 'do';
  if (t.startsWith('does ')) return 'does';
  if (t.startsWith('is ')) return 'is';
  if (t.startsWith('are ')) return 'are';
  if (t.startsWith('can ')) return 'can';
  if (/\b(i|you|we|they)\b/.test(t)) return 'do';
  if (/\b(he|she|it)\b/.test(t)) return 'does';
  return 'other';
}

// New: category mode strategies for modularity
// Each strategy must expose: name, detect(rawItems), classify(text), categories()
// To add a new strategy (e.g., quantifiers, tense types):
// 1. Push a new object into categoryStrategies with proper detect() logic.
// 2. Ensure classify() returns one of categories() results (lowercase keys).
// 3. UI will automatically build buckets for any categories that appear in items.
const categoryStrategies = [
  // Short Questions 1/2 – BE vs DO buckets only
  {
    name: 'short_questions_be_do',
    detect(rawItems) {
      // Only used via explicit routing; heuristic if needed
      return rawItems.some(r => /^(?:do|does|is|are|am|don't|doesn't|isn't|aren't|am\s+not)\b/i.test(String(r.en || r.example || r.word || '')));
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      // Map BE forms (including negatives) → 'be'
      if (/^(?:is|are|am)\b/.test(tl)) return 'be';
      if (/^(?:isn't|aren't)\b/.test(tl)) return 'be';
      if (/^am\s+not\b/.test(tl)) return 'be';
      if (/^(?:was|were|wasn't|weren't)\b/.test(tl)) return 'be'; // tolerate past BE if appears
      // Map DO forms (including negatives) → 'do'
      if (/^(?:do|does)\b/.test(tl)) return 'do';
      if (/^(?:don't|doesn't)\b/.test(tl)) return 'do';
      return 'other';
    },
    categories() { return ['be', 'do']; },
    displayLabel(key) {
      if (key === 'be') return 'BE Verb (is, are, am)';
      if (key === 'do') return 'DO Verb (do, does)';
      return key;
    }
  },
  // There Is/Are – statements: labels "There is", "There are" (order: is, are)
  {
    name: 'there_is_are_statements',
    detect(rawItems) {
      // Pure heuristic fallback only; primary selection is via filename/name routing
      const patt = /^there\s+(?:is|are)\b/i;
      return rawItems.some(r => patt.test(String(r.en || r.example || r.word || '')));
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      if (/^there\s+are\b/.test(tl)) return 'there_are';
      if (/^there\s+is\b/.test(tl)) return 'there_is';
      // Questions/negatives map to nearest
      if (/^(?:are\s+there|there\s+aren't)\b/.test(tl)) return 'there_are';
      if (/^(?:is\s+there|there\s+isn't)\b/.test(tl)) return 'there_is';
      // Fallback plural heuristic
      const m = tl.match(/\bthere\s+(?:is|are)\s+(.+?)[.?!]?$/) || tl.match(/^(?:is|are)\s+there\s+(.+?)[.?!]?$/);
      const phrase = m ? m[1] : '';
      if (/\b(?:two|three|four|five|six|seven|eight|nine|ten|many|several|a\s+lot\s+of|lots\s+of|some|any)\b/.test(phrase) || /\b\w+s\b/.test(phrase)) return 'there_are';
      return 'there_is';
    },
    categories() { return ['there_is', 'there_are']; },
    displayLabel(key) { return key === 'there_is' ? 'There is' : (key === 'there_are' ? 'There are' : key); }
  },
  // There Is/Are – questions: labels "Is there", "Are there" (order: is, are)
  {
    name: 'there_is_are_questions',
    detect(rawItems) {
      const patt = /^(?:is|are)\s+there\b/i;
      return rawItems.some(r => patt.test(String(r.en || r.example || r.word || '')));
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      if (/^(?:are\s+there|there\s+are|there\s+aren't)\b/.test(tl)) return 'there_are';
      if (/^(?:is\s+there|there\s+is|there\s+isn't)\b/.test(tl)) return 'there_is';
      // Fallback heuristic identical to statements variant
      const m = tl.match(/\bthere\s+(?:is|are)\s+(.+?)[.?!]?$/) || tl.match(/^(?:is|are)\s+there\s+(.+?)[.?!]?$/);
      const phrase = m ? m[1] : '';
      if (/\b(?:two|three|four|five|six|seven|eight|nine|ten|many|several|a\s+lot\s+of|lots\s+of|some|any)\b/.test(phrase) || /\b\w+s\b/.test(phrase)) return 'there_are';
      return 'there_is';
    },
    categories() { return ['there_is', 'there_are']; },
    displayLabel(key) { return key === 'there_is' ? 'Is there' : (key === 'there_are' ? 'Are there' : key); }
  },
  {
    name: 'some_any',
    detect(rawItems) {
      // Trigger when explicit 'some' or 'any' appears and There is/There are is not the dominant pattern
      const someAnyCount = rawItems.reduce((n,r)=>n + (/(^|\b)(some|any)(\b|$)/i.test(String(r.en || r.example || r.word || ''))?1:0), 0);
      const thereCount = rawItems.reduce((n,r)=>n + (/^(?:there\s+(?:is|are)|(?:is|are)\s+there|there\s+(?:isn't|aren't))\b/i.test(String(r.en || r.example || r.word || ''))?1:0), 0);
      if (someAnyCount === 0) return false;
      // If There is/are appears strongly (>= 3 or >=40%), prefer that strategy instead
      const total = rawItems.length || 0;
      const thereDominant = thereCount >= 3 || (total > 0 && (thereCount / total) >= 0.4);
      return !thereDominant;
    },
    classify(text) {
      const t = String(text || '').trim();
      const tl = t.toLowerCase();
      if (/\bany\b/.test(tl)) return 'any';
      if (/\bsome\b/.test(tl)) return 'some';
      if (/^(?:is|are)\s+there\b/i.test(tl)) return 'any';
      if (/^(?:do|does)\s+\w+\s+(?:have|need)\b/i.test(tl)) return 'any';
      if (/^there\s+(?:isn't|aren't)\b/i.test(tl)) return 'any';
      if (/\b(?:don't|doesn't)\s+(?:have|need)\b/i.test(tl)) return 'any';
      if (/^there\s+(?:is|are)\b/i.test(tl)) return 'some';
      if (/\b(?:i|we|you|they)\s+(?:have|need)\b/i.test(tl)) return 'some';
      if (/\b(?:he|she|it)\s+(?:has|needs)\b/i.test(tl)) return 'some';
      return 'other';
    },
    categories() { return ['some', 'any']; }
  },
  {
    name: 'short_questions',
    detect(rawItems) {
      // Default grammar pattern: leading auxiliaries for classic short questions.
      return rawItems.some(r => /^(do|does|is|are|can)\b/i.test(r.en || r.example || r.word || ''));
    },
    classify(text) { return normalizeShortQuestionCategory(text); },
    categories() { return ['do','does','is','are','can']; }
  },
  // Present Simple verbs: bucket by subject group (3rd singular vs others)
  {
    name: 'present_simple_subject_groups',
    detect(rawItems) {
      const patt = /\b(i|you|we|they|he|she|it|the\s+\w+|cats|kids)\b/i;
      return rawItems.some(r => patt.test(String(r.en || r.example || r.word || '')));
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      // Extract subject (first word or first two for "the ...")
      const words = tl.split(/\s+/);
      if (!words.length) return 'other';
      let subj = words[0];
      if (subj === 'the' && words[1]) subj = `the ${words[1]}`;
      const thirdSingularSet = new Set(['he','she','it','the dog','the sun','the kid','the girl','the boy','the cat','william']);
      if (thirdSingularSet.has(subj)) return 'third_singular';
      return 'others';
    },
    categories() { return ['third_singular','others']; },
    displayLabel(key) {
      if (key === 'third_singular') return 'He, She, It, the dog (3인칭 단수)';
      if (key === 'others') return 'We, They, You, I, the dogs';
      return key;
    }
  },
  // Present Simple negatives: sort SUBJECTS into don't vs doesn't buckets
  {
    name: 'present_simple_negative_subjects',
    detect(rawItems) {
      // Only used via explicit routing; keep detect very narrow
      return rawItems.every(r => /^(i|you|we|they|he|she|it)\b/i.test(String(r.en || r.word || '')));
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      // Primary: rely on the actual negative auxiliary in the sentence
      if (/(?:doesn't|doesnt)\b/.test(tl)) return 'doesnt';
      if (/(?:don't|dont)\b/.test(tl)) return 'dont';
      // Fallback heuristic by subject (handles pronouns)
      const words = tl.split(/\s+/);
      const first = words[0] || '';
      const second = words[1] || '';
      const thirdSingPron = new Set(['he','she','it']);
      if (thirdSingPron.has(first)) return 'doesnt';
      if (/^the$/.test(first)) {
        // Heuristic: treat 'the + singular' as third singular unless looks plural
        if (second && /s$/.test(second) && !/(ss|us)$/i.test(second)) return 'dont';
        return 'doesnt';
      }
      return 'dont';
    },
    categories() { return ["doesnt","dont"]; },
    displayLabel(key) {
      if (key === 'doesnt') return "doesn't";
      if (key === 'dont') return "don't";
      return key;
    }
  },
  // Present Simple Yes/No Questions: DO vs DOES buckets, subject-only chips
  {
    name: 'present_simple_yesno_do_does',
    detect(rawItems) {
      // Expect questions like "Do you ...?", "Does she ...?"
      return rawItems.every(r => /^(do|does)\b/i.test(String(r.en || r.example || r.word || '')));
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      if (/^does\b/.test(tl)) return 'does';
      if (/^do\b/.test(tl)) return 'do';
      return 'other';
    },
    categories() { return ['do','does']; },
    displayLabel(key) {
      if (key === 'do') return 'DO';
      if (key === 'does') return 'DOES';
      return key;
    }
  },
  // Present Progressive: bucket by BE form (am / is / are)
  // Used for lists like present_progressive.json where the goal is to
  // connect subject groups with the correct BE auxiliary in -ing sentences.
  {
    name: 'present_progressive_be_forms',
    detect(rawItems) {
      // Heuristic: sentences that contain "am/is/are" followed by a verb-ing
      return rawItems.some(r => {
        const t = String(r.en || r.example || r.word || '').toLowerCase();
        return /(\bi\s+am\s+\w+ing\b|\b(am|is|are)\s+\w+ing\b)/.test(t);
      });
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      if (/\bi\s+am\b/.test(tl)) return 'am';
      if (/\bam\b/.test(tl)) return 'am';
      if (/\bis\b/.test(tl)) return 'is';
      if (/\bare\b/.test(tl)) return 'are';
      return 'other';
    },
    categories() { return ['am','is','are']; },
    displayLabel(key) {
      if (key === 'am') return 'am';
      if (key === 'is') return 'is';
      if (key === 'are') return 'are';
      return key;
    }
  },
  // Present Progressive NEGATIVE: bucket by BE negative form
  // Used for lists like present_progressive_negative.json
  {
    name: 'present_progressive_negative_be_forms',
    detect(rawItems) {
      const patt = /(am\s+not|is\s+not|are\s+not|isn't|aren't)\s+\w+ing\b/i;
      return rawItems.some(r => patt.test(String(r.en || r.example || r.word || '')));
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      if (/(?:^|\b)i\s+am\s+not\b/.test(tl) || /\bam\s+not\b/.test(tl)) return 'am_not';
      if (/(?:^|\b)(he|she|it|the\s+\w+)\s+is\s+not\b/.test(tl) || /\bisn't\b/.test(tl)) return 'isnt';
      if (/(?:^|\b)(you|we|they)\s+are\s+not\b/.test(tl) || /\baren't\b/.test(tl)) return 'arent';
      return 'other';
    },
    categories() { return ['am_not','isnt','arent']; },
    displayLabel(key) {
      if (key === 'am_not') return 'am not';
      if (key === 'isnt') return "isn't";
      if (key === 'arent') return "aren't";
      return key;
    }
  },
  // Present Progressive YES/NO QUESTIONS: bucket by BE question form
  // Used for lists like present_progressive_questions_yesno.json
  {
    name: 'present_progressive_yesno_be_forms',
    detect(rawItems) {
      const patt = /^(am|is|are)\s+\w+\s+\w+ing\b/i; // Am I playing, Is he playing, Are they playing
      return rawItems.some(r => patt.test(String(r.en || r.example || r.word || '')));
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      if (/^am\b/.test(tl)) return 'am_q';
      if (/^is\b/.test(tl)) return 'is_q';
      if (/^are\b/.test(tl)) return 'are_q';
      return 'other';
    },
    categories() { return ['am_q','is_q','are_q']; },
    displayLabel(key) {
      if (key === 'am_q') return 'AM';
      if (key === 'is_q') return 'IS';
      if (key === 'are_q') return 'ARE';
      return key;
    }
  },
  // Present Progressive WH QUESTIONS: bucket by BE question form (What/Who/Where/Why/How + Am/Is/Are)
  // Used for lists like present_progressive_questions_wh.json
  {
    name: 'present_progressive_wh_be_forms',
    detect(rawItems) {
      const patt = /^(what|who|where|why|how)\s+(am|is|are)\s+\w+/i;
      return rawItems.some(r => patt.test(String(r.en || r.example || r.word || '')));
    },
    classify(text) {
      const tl = String(text || '').trim().toLowerCase();
      if (/^(what|who|where|why|how)\s+am\b/i.test(tl)) return 'am_wh';
      if (/^(what|who|where|why|how)\s+is\b/i.test(tl)) return 'is_wh';
      if (/^(what|who|where|why|how)\s+are\b/i.test(tl)) return 'are_wh';
      return 'other';
    },
    categories() { return ['am_wh','is_wh','are_wh']; },
    displayLabel(key) {
      if (key === 'am_wh') return 'AM';
      if (key === 'is_wh') return 'IS';
      if (key === 'are_wh') return 'ARE';
      return key;
    }
  }
];

function chooseCategoryStrategy(rawItems, hints = {}) {
  const file = String(hints.grammarFile || '').toLowerCase();
  const name = String(hints.grammarName || '').toLowerCase();
  // Hard routing by file/name to avoid cross-contamination between patterns
  // Present simple negative subjects → don't vs doesn't buckets
  // Match filename used in your repo and flexible grammarName variants
  if (/present_simple_negative\.json$/.test(file) || /present_simple_negative_subjects\.json$/.test(file) || /present\s*simple[:\-\s]*negative(\s*subjects)?/.test(name)) {
    const s = categoryStrategies.find(s => s.name === 'present_simple_negative_subjects');
    if (s) return s;
  }
  // Present Simple Yes/No Questions → DO vs DOES strategy with subject chips
  if (/present_simple_questions_yesno\.json$/.test(file) || /present\s*simple.*yes\s*\/\s*no/.test(name)) {
    const s = categoryStrategies.find(s => s.name === 'present_simple_yesno_do_does');
    if (s) return s;
  }
  // Short Questions 1 & 2 → BE vs DO strategy only
  if (/(short[_-]?questions[_-]?1|short[_-]?questions[_-]?2)/.test(file) || /(short\s*questions\s*1|short\s*questions\s*2)/.test(name)) {
    const s = categoryStrategies.find(s => s.name === 'short_questions_be_do');
    if (s) return s;
  }
  // Route present simple sentences list to subject-group strategy
  if (/present_simple_sentences\.json$/.test(file) || /present\s*simple\s*sentences/.test(name)) {
    const s = categoryStrategies.find(s => s.name === 'present_simple_subject_groups');
    if (s) return s;
  }
  if (/there[_-]?is.*there[_-]?are|are[_-]?there.*is[_-]?there/.test(file) || /\bthere\s+is\b.*\bthere\s+are\b/.test(name)) {
    // Distinguish question vs statement variants
    const isQ = /(are[_-]?there|is[_-]?there)/.test(file) || /(are\s+there|is\s+there)/.test(name);
    const s = categoryStrategies.find(s => s.name === (isQ ? 'there_is_are_questions' : 'there_is_are_statements'));
    if (s) return s;
  }
  if (/(some.*any|some_vs_any|some-any)/.test(file) || /\bsome\b.*\bany\b/.test(name)) {
    const s = categoryStrategies.find(s => s.name === 'some_any');
    if (s) return s;
  }
  // Present Progressive NEGATIVE: am not / isn't / aren't
  if (/present_progressive_negative\.json/i.test(file) || /present\s*progressive.*negative/i.test(name)) {
    const s = categoryStrategies.find(s => s.name === 'present_progressive_negative_be_forms');
    if (s) return s;
  }
  // Present Progressive YES/NO QUESTIONS: AM / IS / ARE
  if (/present_progressive_questions_yesno\.json/i.test(file) || /present\s*progressive.*yes\s*\/\s*no/i.test(name)) {
    const s = categoryStrategies.find(s => s.name === 'present_progressive_yesno_be_forms');
    if (s) return s;
  }
  // Present Progressive WH QUESTIONS: AM / IS / ARE (WH word first)
  if (/present_progressive_questions_wh\.json/i.test(file) || /present\s*progressive.*wh/i.test(name)) {
    const s = categoryStrategies.find(s => s.name === 'present_progressive_wh_be_forms');
    if (s) return s;
  }
  // Present Progressive: am / is / are + verb-ing (affirmatives/general)
  if (/present_progressive\.json/i.test(file) || (/present\s*progressive(\s*sentences)?/i.test(name) && !/negative|yes\s*\/\s*no|wh/i.test(name))) {
    const s = categoryStrategies.find(s => s.name === 'present_progressive_be_forms');
    if (s) return s;
  }
  for (const strat of categoryStrategies) {
    try { if (strat.detect(rawItems)) return strat; } catch {}
  }
  return categoryStrategies.find(s => s.name === 'short_questions');
}

export async function runGrammarSortingMode(ctx = {}) {
  const { grammarFile, grammarName, inlineToast, showOpeningButtons, playSFX } = ctx;
  if (!grammarFile) { inlineToast?.('Error: No grammar file selected'); return; }
  // Show loading splash while fetching data
  let splashController = null;
  try { splashController = openNowLoadingSplash(document.body, { text: (grammarName ? `${grammarName} — now loading` : 'now loading') }); if (splashController && splashController.readyPromise) await splashController.readyPromise; } catch(e){ console.debug('[Sorting] splash failed', e?.message); }

  let raw = [];
  try {
    const res = await fetch(grammarFile);
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    raw = await res.json();
  } catch (e) {
    console.error('[Sorting] load failed', e);
    inlineToast?.('Could not load grammar list');
    showOpeningButtons?.(true);
    if (splashController && typeof splashController.hide === 'function') try { splashController.hide(); } catch {}
    return;
  }

  const strategy = chooseCategoryStrategy(raw, { grammarFile, grammarName });

  // Map items to chips.
  // Default: use sentences; for present simple subject-groups, keep full sentence but also derive verb form for display.
  const items = (raw || []).map((r, i) => {
    const q = r.en || r.example || r.word || '';
  const pos = r.answer_positive || '';
  const neg = r.answer_negative || '';
  const cat = strategy.classify(q);
  let verbForm = '';
  if (strategy.name === 'present_simple_subject_groups') {
      // Extract verb: skip subject (I/you/we/they/he/she/it/the + noun, plural nouns like cats/kids)
      const parts = String(q).trim().split(/\s+/);
      if (parts.length >= 2) {
        let verbIndex = 1;
        const first = parts[0].toLowerCase();
        const second = (parts[1] || '').toLowerCase();

        // Handle "The kids play...", "Cats chase..." etc.
        if (first === 'the' && parts.length >= 3) {
          verbIndex = 2; // verb after "the + noun"
        } else if (/^(cats|kids|dogs|students|children)$/i.test(first)) {
          verbIndex = 1; // treat whole first token as subject, verb is next
        }

        const rawVerb = parts[verbIndex] || parts[1];
        verbForm = String(rawVerb || '').replace(/[^A-Za-z]/g, '');
      }
    }

    // For present simple NEGATIVE SUBJECTS strategy, store a subject-only label as subjectLabel
    let subjectLabel = '';
  if (strategy.name === 'present_simple_negative_subjects' || strategy.name === 'present_simple_yesno_do_does') {
      let text = String(q || '').trim();
      if (strategy.name === 'present_simple_yesno_do_does') {
        // Remove leading auxiliary to isolate subject
        text = text.replace(/^\s*(do|does)\s+/i, '');
      }
      const words = text.split(/\s+/);
      if (words.length) {
        let first = words[0];
        let second = words[1] || '';
        // Handle "The shop ..." style noun subjects
        if (/^the$/i.test(first) && second) {
          subjectLabel = `${first} ${second}`;
        } else {
          subjectLabel = first;
        }
        // Normalize spacing/capitalization a bit
        subjectLabel = subjectLabel.replace(/\s+/g, ' ').trim();
      }
    }

    return { id: `q${i}`, question: q, pos, neg, category: cat, verbForm, subjectLabel };
  }).filter(it => it.question);

  if (!items.length) {
    inlineToast?.('This list has no items');
    showOpeningButtons?.(true);
    return;
  }

  // Use strategy categories; for most lists, filter to those with items.
  // For Short Questions BE/DO, always show both buckets by request.
  const baseCats = strategy.categories();
  let activeCats;
  if (strategy.name === 'short_questions_be_do') {
    activeCats = baseCats.slice();
  } else {
    activeCats = baseCats.filter(c => items.some(it => it.category === c));
    if (!activeCats.length) activeCats = baseCats.slice(0,1); // at least one bucket
  }

  // Build pool items: prefer ONLY answer sentences (positive/negative). If none exist, fall back to questions.
  // Helper: extract article/quantifier + head noun from there is/are sentences (e.g., "a cat", "five books", "many stars")
  function extractThereNounPhrase(s) {
    const t = String(s || '').trim();
    const m = t.match(/^(?:there\s+(?:is|are)|(?:is|are)\s+there)\s+(.+?)[.?!]?$/i);
    if (!m) return '';
    let phrase = m[1].trim();
    // Remove trailing location/adverb segments (common boundaries)
    phrase = phrase.replace(/\b(on|in|at|to|from|of|by|with|under|over|above|below|behind|between|into|onto|around|through|near|next\s+to)\b[\s\S]*$/i, '').trim();
    phrase = phrase.replace(/\b(today|tonight|now|here|nearby)\b[\s\S]*$/i, '').trim();

  const tokensOrig = phrase.split(/\s+/).filter(Boolean);
    if (!tokensOrig.length) return '';
  const tokens = tokensOrig.map(w => w.replace(/[^A-Za-z0-9]/g,'').toLowerCase()).filter(Boolean);
    if (!tokens.length) return '';

    // Multi-word quantifiers
    if (tokens[0] === 'a' && tokens[1] === 'lot' && tokens[2] === 'of' && tokensOrig[3]) {
      return `${tokensOrig[0]} ${tokensOrig[1]} ${tokensOrig[2]} ${tokensOrig[3]}`;
    }
    if (tokens[0] === 'lots' && tokens[1] === 'of' && tokensOrig[2]) {
      return `${tokensOrig[0]} ${tokensOrig[1]} ${tokensOrig[2]}`;
    }

    const quantSet = new Set(['a','an','the','one','two','three','four','five','six','seven','eight','nine','ten','many','several','some','any','few']);
    // If starts with quantifier/number → return quant + next word
    if (quantSet.has(tokens[0]) || /^\d+$/.test(tokens[0])) {
      const next = tokensOrig[1] || '';
      return (next ? `${tokensOrig[0]} ${next}` : tokensOrig[0]);
    }
    // Fallback: just the first token as head noun
    return tokensOrig[0];
  }

  let poolItems = [];
  if (String(strategy.name || '').startsWith('there_is_are')) {
    poolItems = [];
    raw.forEach((r, i) => {
      const baseSentence = r.en || r.example || r.word || '';
      const phrase = extractThereNounPhrase(baseSentence);
      if (phrase) {
        poolItems.push({ id: `q${i}_np`, question: phrase, category: items[i]?.category || strategy.classify(baseSentence), isAnswer: true, np: true });
      }
    });
    if (!poolItems.length) {
      // Fallback to default answers
      items.forEach((it) => {
        if (it.pos) poolItems.push({ id: it.id + '_pos', question: it.pos, category: it.category, isAnswer: true, polarity: 'positive' });
        if (it.neg) poolItems.push({ id: it.id + '_neg', question: it.neg, category: it.category, isAnswer: true, polarity: 'negative' });
      });
      if (!poolItems.length) poolItems = items.slice();
    }
  } else {
    if (strategy.name === 'present_simple_subject_groups') {
      // Use each sentence once; chips will display verb only
      poolItems = items.map(it => ({ id: it.id, question: it.question, category: it.category, isAnswer: true, verbForm: it.verbForm }));
  } else if (strategy.name === 'present_simple_negative_subjects' || strategy.name === 'present_simple_yesno_do_does') {
      // Use subject-only label as the chip text, but keep original sentence for logging via question
      poolItems = items.map(it => ({
        id: it.id,
        question: it.question,
        category: it.category,
        isAnswer: true,
        subjectLabel: it.subjectLabel || it.question
      }));
    } else {
      items.forEach((it) => {
        if (it.pos) poolItems.push({ id: it.id + '_pos', question: it.pos, category: it.category, isAnswer: true, polarity: 'positive' });
        if (it.neg) poolItems.push({ id: it.id + '_neg', question: it.neg, category: it.category, isAnswer: true, polarity: 'negative' });
      });
      if (!poolItems.length) poolItems = items.slice();
    }
    // If BE/DO-only mode, exclude anything not BE or DO to keep logic clean
    if (strategy.name === 'short_questions_be_do') {
      const allowed = new Set(['be','do']);
      poolItems = poolItems.filter(pi => allowed.has(pi.category));
    }
  }

  // Use grammarFile path for session tracking to match homework assignment list_key
  const sessionId = startSession({
    mode: 'grammar_sorting',
    wordList: poolItems.map(x => x.question),
    listName: grammarFile || grammarName || 'Grammar',
    meta: { category: 'grammar', file: grammarFile, grammarName, strategy: strategy.name }
  });

  // Build UI (must exist before pool logic uses it)
  const gameArea = document.getElementById('gameArea');
  if (!gameArea) return;
  gameArea.innerHTML = '';

  if (!document.getElementById('sorting-mode-styles')) {
    const st = document.createElement('style');
    st.id = 'sorting-mode-styles';
    st.textContent = `
      .sorting-wrap { max-width: 980px; margin: 0 auto; padding: 10px 12px 20px; }
      .sorting-top { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
      .sorting-title { color:#19777e; font-family:'Poppins',Arial,sans-serif; font-weight:800; font-size:18px; }
      .buckets-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:10px; }
      .bucket { background:#fff; border:2px solid #27c5ca; border-radius:12px; min-height:160px; display:flex; flex-direction:column; }
      .bucket-head { padding:8px 10px; font-weight:800; color:#19777e; display:flex; align-items:center; justify-content:space-between; }
      .bucket-body { padding:8px; display:flex; flex-wrap:wrap; gap:8px; min-height:110px; }
      .pool { border-style:dashed; }
      .chip { background:#fbffff; border:2px solid #b9e6e9; border-radius:20px; padding:8px 12px; font-weight:700; color:#3f6470; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,.05);
        display:inline-flex; align-items:center; height:42px; max-height:42px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:24px; }
      .chip.selected { outline:2px solid #27c5ca; }
      .chip.good { background:#eafff4; border-color:#6bd69d; }
      .chip.bad { background:#fff1f1; border-color:#f7a1a1; }
      .controls { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
      .btn { padding:8px 14px; font-weight:800; border-radius:10px; cursor:pointer; border:none; }
      .btn.primary { background:#21b3be; color:#fff; }
      .btn.secondary { background:#eceff1; color:#19777e; }
    `;
    document.head.appendChild(st);
  }

  const wrap = el('div', { class: 'sorting-wrap' });
  const top = el('div', { class: 'sorting-top' }, [
    el('div', { class: 'sorting-title', text: grammarName || 'Sorting' }),
    el('div', { id: 'sortingProgress', style: 'color:#6b7280;font-weight:700;' }, [])
  ]);
  const pool = (function(){
    const body = el('div', { class: 'bucket-body' });
  const poolTitle = (strategy.name === 'present_simple_negative_subjects' || strategy.name === 'present_simple_yesno_do_does') ? 'Subject Pool' : 'Sentence Pool';
    return {
      wrap: el('div', { class: 'bucket pool' }, [
        el('div', { class: 'bucket-head' }, [el('span', { text: poolTitle })]),
        body
      ]),
      body
    };
  })();

  const buckets = activeCats.map((c) => {
    const isAux = ['do','does','is','are','can'].includes(c);
    const label = (typeof strategy.displayLabel === 'function')
      ? strategy.displayLabel(c)
      : (isAux ? c.charAt(0).toUpperCase() + c.slice(1) + ' ...?' : c.charAt(0).toUpperCase() + c.slice(1));
    const body = el('div', { class: 'bucket-body', id: `bucket-${c}` });
    return { key: c, wrap: el('div', { class: 'bucket' }, [ el('div', { class: 'bucket-head' }, [el('span', { text: label })]), body ]), body };
  });

  const grid = el('div', { class: 'buckets-grid' }, [ pool.wrap, ...buckets.map(b => b.wrap) ]);
  wrap.appendChild(top);
  wrap.appendChild(grid);

  // Controls (Check removed; immediate grading mode)
  const controls = el('div', { class: 'controls' });
  const resetBtn = el('button', { class: 'btn secondary', text: 'Reset' });
  controls.appendChild(resetBtn);
  wrap.appendChild(controls);

  // Add a floating Quit button consistent with other modes (id: smQuitBtn)
  let quitBtn = document.getElementById('smQuitBtn');
  if (!quitBtn) {
    quitBtn = document.createElement('button');
    quitBtn.id = 'smQuitBtn';
    quitBtn.className = 'wa-quit-btn';
    quitBtn.type = 'button';
    quitBtn.setAttribute('aria-label', 'Quit game');
    quitBtn.innerHTML = '<span class="wa-sr-only">Quit Game</span><img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />';
    // Append to body so it overlays consistently
    document.body.appendChild(quitBtn);
  }
  quitBtn.onclick = () => {
    try { document.getElementById('smQuitBtn')?.remove(); } catch {}
    try {
      if (window.WordArcade && typeof window.WordArcade.startGrammarModeSelector === 'function') {
        window.WordArcade.startGrammarModeSelector();
      } else if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
        window.WordArcade.quitToOpening(true);
      } else {
        // Fallback: clear and soft reload
        const area = document.getElementById('gameArea');
        if (area) area.innerHTML = '';
        location.hash = '#state-mode_selector';
        location.reload();
      }
    } catch {}
  };

  // Helper: truncate sentence for display (focus on leading structure with verb)
  function truncateSentenceDisplay(str) {
    if (!str) return '';
    const t = str.trim();
    // If text contains some/any, display the prefix before the quantifier (e.g., "He has ...")
    const q = t.match(/^(.*?)(?:\b(?:some|any)\b)/i);
    if (q && q[1]) {
      const stem = q[1].trim().replace(/\s+$/,'');
      if (stem) return stem + '...';
    }
    const patterns = [
      /^(do(es)?\s+[A-Za-z]+\s+[A-Za-z]+\b)/i,  // do/does + subject + verb
      /^(can\s+[A-Za-z]+\s+[A-Za-z]+\b)/i,      // can + subject + verb
      /^(is\s+there)/i,
      /^(are\s+there)/i,
      /^(there\s+(is|are|isn't|aren't))/i,
      /^(isn't\s+there)/i,
      /^(aren't\s+there)/i,
      /^(doesn't\s+[A-Za-z]+\s+[A-Za-z]+\b)/i,  // doesn't + subject + verb
      /^(don't\s+[A-Za-z]+\s+[A-Za-z]+\b)/i,    // don't + subject + verb
      /^(he\s+doesn't\s+have)/i,
      /^(she\s+doesn't\s+have)/i,
      /^(he\s+does\s+have)/i,
      /^(she\s+does\s+have)/i,
      /^(there\s+isn't)/i,
      /^(there\s+aren't)/i
    ];
    for (const p of patterns) {
      const m = t.match(p);
      if (m) return m[0].replace(/\s+$/, '') + '...';
    }
    // Fallback: first three words (aux + subject + verb)
    const words = t.split(/\s+/);
    const firstWords = words.slice(0, 3).join(' ');
    return firstWords + (words.length > 3 ? '...' : '');
  }

  // Pool management state
  let remainingPool = shuffle(poolItems).slice();
  const activeChips = []; // all chip objects for scoring

  function createChip(it) {
    const chip = el('div', { class: 'chip', 'data-id': it.id });
  if (strategy.name === 'present_simple_subject_groups' && it.verbForm) {
      chip.textContent = it.verbForm;
  } else if ((strategy.name === 'present_simple_negative_subjects' || strategy.name === 'present_simple_yesno_do_does') && it.subjectLabel) {
      chip.textContent = String(it.subjectLabel);
    } else if (
      strategy.name === 'present_progressive_be_forms' ||
      strategy.name === 'present_progressive_negative_be_forms'
    ) {
      // For present progressive affirmatives and negatives, hide the BE form
      // Negatives also hide contracted forms (isn't/aren't) → "___ not"
      const full = String(it.question || '').trim();
      let masked = full;
      // Affirmative BE
      masked = masked
        .replace(/\b(I\s+am)\b/i, 'I ___')
        .replace(/\b(you\s+are)\b/i, 'You ___')
        .replace(/\b(we\s+are)\b/i, 'We ___')
        .replace(/\b(they\s+are)\b/i, 'They ___')
        .replace(/\b(he\s+is)\b/i, 'He ___')
        .replace(/\b(she\s+is)\b/i, 'She ___')
        .replace(/\b(it\s+is)\b/i, 'It ___')
        .replace(/\b(the\s+\w+\s+is)\b/i, (m) => m.replace(/\sis\b/i, ' ___'));
      if (strategy.name === 'present_progressive_negative_be_forms') {
        // Expand for negatives: am not / is not / are not; isn't / aren't
        masked = masked
          .replace(/\bI\s+am\s+not\b/i, 'I ___ not')
          .replace(/\b(he|she|it|the\s+\w+)\s+is\s+not\b/gi, (m, subj) => `${subj} ___ not`)
          .replace(/\b(you|we|they)\s+are\s+not\b/gi, (m, subj) => `${subj} ___ not`)
          .replace(/\b(he|she|it|the\s+\w+)\s+isn't\b/gi, (m, subj) => `${subj} ___ not`)
          .replace(/\b(you|we|they)\s+aren't\b/gi, (m, subj) => `${subj} ___ not`);
      }
      if (masked === full) masked = truncateSentenceDisplay(full);
      chip.textContent = masked;
    } else if (strategy.name === 'present_progressive_yesno_be_forms') {
      // For yes/no questions, mask the initial BE and subject so chips look like "___ he playing ...?"
      const full = String(it.question || '').trim();
      let masked = full
        .replace(/^am\s+i\b/i, '___ I')
        .replace(/^is\s+he\b/i, '___ he')
        .replace(/^is\s+she\b/i, '___ she')
        .replace(/^is\s+it\b/i, '___ it')
        .replace(/^are\s+you\b/i, '___ you')
        .replace(/^are\s+we\b/i, '___ we')
        .replace(/^are\s+they\b/i, '___ they');
      if (masked === full) masked = truncateSentenceDisplay(full);
      chip.textContent = masked;
    } else if (strategy.name === 'present_progressive_wh_be_forms') {
      // For WH questions, mask the BE after the WH word so chips look like "What ___ she doing...?"
      const full = String(it.question || '').trim();
      let masked = full
        .replace(/^(what|who|where|why|how)\s+am\b/i, '$1 ___')
        .replace(/^(what|who|where|why|how)\s+is\b/i, '$1 ___')
        .replace(/^(what|who|where|why|how)\s+are\b/i, '$1 ___');
      if (masked === full) masked = truncateSentenceDisplay(full);
      chip.textContent = masked;
    } else {
      chip.textContent = it.np ? String(it.question) : truncateSentenceDisplay(it.question);
    }
    chip.addEventListener('click', () => {
      const was = chip.classList.contains('selected');
      wrap.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
      if (!was) chip.classList.add('selected');
    });
    const obj = { it, chip };
    activeChips.push(obj);
    return obj;
  }

  const POOL_LIMIT = 3;
  function fillPool() {
    while (pool.body.querySelectorAll('.chip').length < POOL_LIMIT && remainingPool.length) {
      const next = remainingPool.shift();
      const { chip } = createChip(next);
      pool.body.appendChild(chip);
    }
  }

  // Initial fill
  fillPool();

  // Click to move selected chip; refill if moved to bucket
  // Tracking state
  let attempts = 0;
  let correctCount = 0;
  let ended = false;

  // Inject animation styles once
  if (!document.getElementById('sorting-anim-styles')) {
    const anim = document.createElement('style');
    anim.id = 'sorting-anim-styles';
    anim.textContent = `
      .chip.anim-correct { animation: popCorrect 1.1s cubic-bezier(.3,.8,.3,1) forwards; }
      .chip.anim-wrong { animation: meltWrong 1.2s cubic-bezier(.4,.2,.2,1) forwards; }
      @keyframes popCorrect { 0% { transform:scale(1); background:#eafff4; } 35% { transform:scale(1.35); background:#b5ffd0; } 55% { transform:scale(1.05); } 80% { transform:scale(.85); opacity:.85; } 100% { transform:scale(.15); opacity:0; } }
      @keyframes meltWrong { 0% { transform:scale(1); background:#fff1f1; } 30% { transform:translateY(6px) scale(.95); filter:blur(.5px); } 55% { transform:translateY(14px) scale(.8); filter:blur(1px); } 80% { transform:translateY(22px) scale(.55); opacity:.4; filter:blur(2px); } 100% { transform:translateY(34px) scale(.3); opacity:0; filter:blur(3px); } }
    `;
    document.head.appendChild(anim);
  }

  function evaluatePlacement(bucketBody, chip) {
    if (ended) return;
    const id = chip.getAttribute('data-id');
  const baseId = id.replace(/_(pos|neg|np)$/,'');
    const data = items.find(x => x.id === baseId);
    const expectedCategory = data ? data.category : null;
    const bucketObj = buckets.find(b => b.body === bucketBody);
    if (!bucketObj) return; // ignore pool
    attempts += 1;
    const ok = expectedCategory && expectedCategory === bucketObj.key;
    if (ok) correctCount += 1;
    chip.classList.add(ok ? 'anim-correct' : 'anim-wrong');
    // Log attempt
    try {
      logAttempt({
        session_id: sessionId,
        mode: 'grammar_sorting',
        word: data?.question || chip.textContent,
        is_correct: ok,
        extra: { category: 'grammar', file: grammarFile, expected: expectedCategory, placed: bucketObj.key, grammarName, isAnswer: !!data?.isAnswer }
      });
    } catch {}
  playSFX?.(ok ? 'correct' : 'wrong');
  chip.addEventListener('animationend', () => {
      chip.remove();
      fillPool();
      computeProgress();
      maybeEndSession();
    }, { once: true });
    computeProgress();
  }

  [...buckets.map(b => b.body), pool.body].forEach((body) => {
    body.addEventListener('click', (evt) => {
      if (evt.target.closest('.chip')) return;
      const selected = wrap.querySelector('.chip.selected');
      if (!selected) return;
      body.appendChild(selected);
      playSFX?.('click');
      selected.classList.remove('selected');
      if (body !== pool.body) evaluatePlacement(body, selected);
    });
  });

  // Progress and reset
  function computeProgress() {
    const elProg = document.getElementById('sortingProgress');
    if (elProg) elProg.textContent = `${attempts}/${poolItems.length}`;
  }

  function maybeEndSession() {
    if (ended) return;
    if (attempts >= poolItems.length) {
      ended = true;
      const accuracy = attempts ? Math.round((correctCount / attempts) * 100) : 0;
      inlineToast?.(`Finished: ${correctCount}/${attempts} (${accuracy}%)`);
      playSFX?.('end');
      try {
        // Use grammarFile path for session tracking to match homework assignment list_key
        endSession(sessionId, {
          mode: 'grammar_sorting',
          summary: { score: correctCount, total: attempts, accuracy, list_name: grammarName, category: 'grammar', grammarName, grammarFile },
          listName: grammarFile || grammarName,
          wordList: poolItems.map(x => x.question),
          meta: { grammarFile, grammarName, category: 'grammar', strategy: strategy.name }
        });
      } catch {}
      // Stars overlay will be shown by the global wa:session-ended listener in main.js
      // Replace the game area with the shared grammar evaluation screen
      const gameArea = document.getElementById('gameArea');
      renderGrammarSummary({
        gameArea,
        score: correctCount,
        total: attempts,
        ctx: { showOpeningButtons }
      });
    }
  }

  function resetGame() {
    ended = false;
    wrap.querySelectorAll('.chip').forEach(ch => ch.remove());
    pool.body.innerHTML = '';
    buckets.forEach(b => b.body.innerHTML = '');
    remainingPool = shuffle(poolItems).slice();
    activeChips.length = 0;
    attempts = 0;
    correctCount = 0;
    fillPool();
    computeProgress();
  }

  resetBtn.addEventListener('click', () => {
    resetGame();
    playSFX?.('click');
  });

  wrap.addEventListener('click', () => computeProgress());
  computeProgress();

  // Removed check button logic; evaluation handled per placement.

  gameArea.appendChild(wrap);
  // Hide splash once UI is visible
  try { if (splashController && typeof splashController.hide === 'function') setTimeout(()=>{ try{ splashController.hide(); }catch{} }, 520); } catch(e){}
}
