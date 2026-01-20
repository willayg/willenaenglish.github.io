// Grammar Find-the-Mistake Mode (Level 3 variant)
// Copies the core O/X experience and lives alongside the other Level 3 grammar modes.
// Supports: past_simple_irregular, be_going_to, past_simple_regular, past_vs_future, all_tenses

import { startSession, logAttempt, endSession } from '../../../../students/records.js';
import { playSFX } from '../../sfx.js';
import { renderGrammarSummary } from '../grammar_summary.js';
import { openNowLoadingSplash } from '../unscramble_splash.js';

const MODE = 'grammar_find_mistake';

// Detect grammar type from filename
function detectGrammarType(filePath) {
  const path = (filePath || '').toLowerCase();
  if (path.includes('be_going_to')) return 'be_going_to';
  if (path.includes('past_simple_regular')) return 'past_regular';
  if (path.includes('past_vs_future')) return 'past_vs_future';
  if (path.includes('past_vs_present_vs_future') || path.includes('all_tense')) return 'all_tenses';
  if (path.includes('mixed_tense_question')) return 'mixed_tense_questions';
  if (path.includes('tense_question')) return 'tense_questions';
  // Will future/questions: sentence-based with "will" patterns
  if (path.includes('will_future')) return 'will_future';
  if (path.includes('will_questions')) return 'will_questions';
  // Modal verbs: have to, want to, like to
  if (path.includes('have_to')) return 'have_to';
  if (path.includes('want_to')) return 'want_to';
  if (path.includes('like_to_vs_want_to')) return 'like_to_vs_want_to_vs_have_to';
  if (path.includes('like_to')) return 'like_to';
  // Quantifiers and adjectives
  if (path.includes('a_few_vs_a_little')) return 'a_few_vs_a_little';
  if (path.includes('adjectives_people')) return 'adjectives';
  if (path.includes('adjectives_world')) return 'adjectives';
  if (path.includes('short_comparatives')) return 'comparatives';
  if (path.includes('short_superlatives')) return 'superlatives';
  // Modals and advanced
  if (path.includes('modal_verbs')) return 'modal_verbs';
  if (path.includes('imperatives_suggestions')) return 'imperatives';
  if (path.includes('prepositions_direction')) return 'prepositions';
  return 'past_irregular';
}

// Time words for past_vs_future mode
const PAST_TIME_WORDS = ['yesterday', 'last week', 'last month', 'last year', 'last night', 'last summer'];
const FUTURE_TIME_WORDS = ['tomorrow', 'soon', 'next week', 'next month', 'next year', 'next summer', 'next Saturday', 'this week'];

// Extract time word from sentence
function findTimeWordInSentence(sentence) {
  const lowerSentence = sentence.toLowerCase();
  for (const tw of [...PAST_TIME_WORDS, ...FUTURE_TIME_WORDS]) {
    if (lowerSentence.includes(tw.toLowerCase())) {
      // Find the actual casing in the sentence
      const regex = new RegExp(tw.replace(/\s+/g, '\\s+'), 'i');
      const match = sentence.match(regex);
      return match ? match[0] : tw;
    }
  }
  return null;
}

// Get opposite tense time word
function getWrongTimeWord(timeWord, tense) {
  if (!timeWord) return tense === 'past' ? 'tomorrow' : 'yesterday';
  const isPast = PAST_TIME_WORDS.some(tw => tw.toLowerCase() === timeWord.toLowerCase());
  if (isPast) {
    return FUTURE_TIME_WORDS[Math.floor(Math.random() * FUTURE_TIME_WORDS.length)];
  } else {
    return PAST_TIME_WORDS[Math.floor(Math.random() * PAST_TIME_WORDS.length)];
  }
}

export async function runGrammarFindMistakeL3Mode({ grammarFile, grammarName, grammarConfig = {} }) {
  const container = document.getElementById('gameArea');
  if (!container) return;
  container.innerHTML = '<div style="padding:20px;text-align:center;">Loading…</div>';

  let splashController = null;
  try {
    splashController = openNowLoadingSplash(document.body, { text: (grammarName ? `${grammarName} — now loading` : 'now loading') });
    if (splashController && splashController.readyPromise) await splashController.readyPromise;
  } catch (e) {
    console.debug('[FindMistakeL3] splash failed', e?.message);
  }

  let data = [];
  try {
    const r = await fetch(grammarFile);
    if (!r.ok) throw new Error('load failed');
    data = await r.json();
  } catch (e) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#c00">Failed to load list.</div>';
    if (splashController && typeof splashController.hide === 'function') try { splashController.hide(); } catch {}
    return;
  }

  const base = (Array.isArray(data) ? data : []).filter(it => (it && (it.en || it.exampleSentence)));
  if (!base.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;">No sentences.</div>';
    return;
  }

  const grammarType = detectGrammarType(grammarFile);
  const makeSentence = (it) => (it.en || it.exampleSentence || '').trim();

  function escapeRegExp(s){
    return String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Corrupt sentence based on grammar type
  function corruptSentence(en, item) {
    // For past_vs_future: swap the time word to create the mistake
    if (grammarType === 'past_vs_future') {
      const tense = item.tense || 'past';
      const timeWord = findTimeWordInSentence(en);
      if (timeWord) {
        const wrongTimeWord = getWrongTimeWord(timeWord, tense);
        const regex = new RegExp(timeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const bad = en.replace(regex, wrongTimeWord);
        return { bad, wrongToken: wrongTimeWord, correctToken: timeWord };
      }
      // Fallback: add wrong time word
      const wrongTime = tense === 'past' ? 'tomorrow' : 'yesterday';
      const correctTime = tense === 'past' ? 'yesterday' : 'tomorrow';
      return { bad: en.replace(/\\.\\s*$/, '') + ' ' + wrongTime + '.', wrongToken: wrongTime, correctToken: correctTime };
    }

    // For past_irregular with detractors, use original logic
    // But skip for adjectives/comparatives/superlatives - they need special handling
    const hasDetractors = item && Array.isArray(item.detractors) && item.detractors.length > 0;
    
    // For ADJECTIVES: Create actual grammar mistakes (not just swapping to detractors)
    if (grammarType === 'adjectives' || grammarType === 'comparatives' || grammarType === 'superlatives') {
      const baseAdj = (item.base || item.word || '').trim();
      if (baseAdj && new RegExp(`\\b${escapeRegExp(baseAdj)}\\b`, 'i').test(en)) {
        const variants = [];
        
        // Error 1: Use adverb form instead of adjective (e.g., "The city is beautifully" instead of "beautiful")
        if (baseAdj.endsWith('y')) {
          const adverb = baseAdj.slice(0, -1) + 'ily';
          variants.push({ bad: en.replace(new RegExp(`\\b${escapeRegExp(baseAdj)}\\b`, 'i'), adverb), wrongToken: adverb, correctToken: baseAdj });
        } else if (!baseAdj.endsWith('ly')) {
          const adverb = baseAdj + 'ly';
          variants.push({ bad: en.replace(new RegExp(`\\b${escapeRegExp(baseAdj)}\\b`, 'i'), adverb), wrongToken: adverb, correctToken: baseAdj });
        }
        
        // Error 2: Double comparative (e.g., "more bigger" or "more moderner")
        if (baseAdj.length <= 6 && !baseAdj.endsWith('er')) {
          const wrongComp = 'more ' + baseAdj + 'er';
          variants.push({ bad: en.replace(new RegExp(`\\b${escapeRegExp(baseAdj)}\\b`, 'i'), wrongComp), wrongToken: wrongComp, correctToken: baseAdj });
        }
        
        // Error 3: Wrong form - add -er to long adjective (e.g., "beautifuler")
        if (baseAdj.length > 5 && !baseAdj.endsWith('er')) {
          const wrongForm = baseAdj + 'er';
          variants.push({ bad: en.replace(new RegExp(`\\b${escapeRegExp(baseAdj)}\\b`, 'i'), wrongForm), wrongToken: wrongForm, correctToken: baseAdj });
        }
        
        // Error 4: Missing adjective entirely - use noun form if in detractors
        const nounForm = item.detractors?.find(d => !d.includes(' ') && !d.endsWith('ly') && !d.endsWith('er') && !d.endsWith('est'));
        if (nounForm) {
          // Only use if it seems like a noun (not another adjective)
          const hasNounEnding = /(?:ness|ity|ty|tion|ment)$/i.test(nounForm);
          if (hasNounEnding || nounForm !== baseAdj) {
            variants.push({ bad: en.replace(new RegExp(`\\b${escapeRegExp(baseAdj)}\\b`, 'i'), nounForm), wrongToken: nounForm, correctToken: baseAdj });
          }
        }
        
        if (variants.length) {
          return variants[Math.floor(Math.random() * variants.length)];
        }
      }
    }
    
    // For a_few_vs_a_little: swap countable/uncountable usage
    if (grammarType === 'a_few_vs_a_little') {
      const target = (item.target || '').trim();
      if (target && new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i').test(en)) {
        // Find the appropriate wrong form
        const swaps = {
          'a few': 'a little',
          'a little': 'a few',
          'few': 'little',
          'little': 'few'
        };
        const wrong = swaps[target.toLowerCase()];
        if (wrong) {
          const bad = en.replace(new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i'), wrong);
          return { bad, wrongToken: wrong, correctToken: target };
        }
      }
    }
    
    // For modal_verbs: swap modals or add common errors
    if (grammarType === 'modal_verbs') {
      const modalMatch = en.match(/\b(can|could|should|must|may|might|would|will)\b/i);
      if (modalMatch) {
        const correct = modalMatch[1];
        const variants = [];
        // Add "to" after modal (common error: "must to go")
        variants.push({ bad: en.replace(new RegExp(`\\b${correct}\\s+`, 'i'), `${correct} to `), wrongToken: `${correct} to`, correctToken: correct });
        // Use base verb instead of modal (e.g., "I go" instead of "I can go")
        variants.push({ bad: en.replace(new RegExp(`\\b${correct}\\s+`, 'i'), ''), wrongToken: '(missing modal)', correctToken: correct });
        return variants[Math.floor(Math.random() * variants.length)];
      }
    }
    
    // For prepositions: swap with wrong preposition
    if (grammarType === 'prepositions') {
      // Use detractors if available (they are other prepositions)
      if (item.detractors && item.detractors.length > 0) {
        // Find the preposition in the sentence
        const prepMatch = en.match(/\b(to|from|into|onto|toward|towards|through|across|along|over|under|up|down|in|out|at|on|by|back|past)\b/i);
        if (prepMatch) {
          const correct = prepMatch[1];
          const wrong = item.detractors[Math.floor(Math.random() * item.detractors.length)];
          const bad = en.replace(new RegExp(`\\b${escapeRegExp(correct)}\\b`, 'i'), wrong);
          return { bad, wrongToken: wrong, correctToken: correct };
        }
      }
      // Fallback: swap with generic wrong preposition list
      const prepMatch = en.match(/\b(to|from|into|onto|toward|towards|through|across|along|over|under|up|down|in|out|at|on|by|back|past)\b/i);
      if (prepMatch) {
        const correct = prepMatch[1];
        const wrongPreps = ['to', 'from', 'in', 'on', 'at', 'by', 'through', 'across', 'under', 'over', 'into', 'past'].filter(p => p !== correct.toLowerCase());
        const wrong = wrongPreps[Math.floor(Math.random() * wrongPreps.length)];
        const bad = en.replace(new RegExp(`\\b${escapeRegExp(correct)}\\b`, 'i'), wrong);
        return { bad, wrongToken: wrong, correctToken: correct };
      }
    }
    
    // For mixed_tense_questions: use wrong auxiliary
    if (grammarType === 'mixed_tense_questions') {
      const auxMatch = en.match(/^(Did|Do|Does|Will)\s+/i);
      if (auxMatch) {
        const correct = auxMatch[1];
        const wrongAux = { 'Did': 'Do', 'Do': 'Did', 'Does': 'Did', 'Will': 'Do' };
        const wrong = wrongAux[correct] || 'Do';
        const bad = en.replace(new RegExp(`^${correct}\\s+`, 'i'), `${wrong} `);
        return { bad, wrongToken: wrong, correctToken: correct };
      }
    }
    
    // For like_to_vs_want_to_vs_have_to: swap the modal phrase
    if (grammarType === 'like_to_vs_want_to_vs_have_to') {
      const phraseMatch = en.match(/\b(like to|likes to|want to|wants to|have to|has to)\b/i);
      if (phraseMatch) {
        const correct = phraseMatch[1];
        // Swap to a different phrase
        const alternatives = ['like to', 'want to', 'have to'].filter(p => !correct.toLowerCase().includes(p.split(' ')[0]));
        const wrong = alternatives[Math.floor(Math.random() * alternatives.length)] || 'must to';
        const bad = en.replace(new RegExp(`\\b${escapeRegExp(correct)}\\b`, 'i'), wrong);
        return { bad, wrongToken: wrong, correctToken: correct };
      }
    }
    
    // Default detractor-based corruption for other types with detractors
    if (hasDetractors) {
      const past = (item.past || item.word || '').trim();
      const base = (item.base || '').trim();
      const wrong = (item.detractors.find(d => d && String(d).trim()) || '').trim();
      if (wrong) {
        let tokenToReplace = '';
        if (past && new RegExp(`\\b${escapeRegExp(past)}\\b`, 'i').test(en)) tokenToReplace = past;
        else if (base && new RegExp(`\\b${escapeRegExp(base)}\\b`, 'i').test(en)) tokenToReplace = base;
        if (tokenToReplace) {
          const bad = en.replace(new RegExp(`\\b${escapeRegExp(tokenToReplace)}\\b`, 'i'), wrong);
          return { bad, wrongToken: wrong, correctToken: tokenToReplace };
        }
      }
    }

    // New: For be_going_to produce one of four clearly-defined mistake types
    // This block is intentionally placed before the older logic so it takes precedence.
    if (grammarType === 'be_going_to') {
      const txt = en.trim();

      function makeVerbIng(v) {
        let vi = v;
        if (vi.endsWith('ie')) vi = vi.slice(0, -2) + 'ying';
        else if (vi.endsWith('e') && vi.length > 1) vi = vi.slice(0, -1) + 'ing';
        else vi = vi + 'ing';
        return vi;
      }

      const stmt = txt.match(/^([A-Za-z0-9'’]+)\s+(am|is|are)\s+going\s+to\s+([A-Za-z]+)/i);
      const ques = txt.match(/^(Is|Are|Am)\s+([A-Za-z0-9'’]+)\s+going\s+to\s+([A-Za-z]+)/i);

      const variants = [];
      if (stmt) {
        const subject = stmt[1];
        const be = stmt[2];
        const verb = stmt[3];

        // 1) 'go' not 'going' (e.g., "They are go to eat pizza.")
        variants.push({ bad: txt.replace(new RegExp(`\\b${escapeRegExp(be)}\\s+going\\s+to`, 'i'), `${be} go to ${verb}`), wrongToken: 'go', correctToken: 'going' });

        // 2) Wrong be verb (e.g., "They is going to eat pizza.") - flip agreement
        const wrongBe = (be.toLowerCase() === 'are') ? 'is' : (be.toLowerCase() === 'is' ? 'are' : 'is');
        variants.push({ bad: txt.replace(new RegExp(`\\b${escapeRegExp(be)}\\b`, 'i'), wrongBe), wrongToken: wrongBe, correctToken: be });

        // 3) Wrong auxiliary 'will' used (e.g., "They will going to eat pizza.")
        variants.push({ bad: txt.replace(new RegExp(`\\b${escapeRegExp(be)}\\b`, 'i'), 'will'), wrongToken: 'will', correctToken: be });

        // 4) Missing be verb (e.g., "They going to eat pizza.")
        variants.push({ bad: txt.replace(new RegExp(`\\b${escapeRegExp(be)}\\s+`, 'i'), ''), wrongToken: 'going', correctToken: be });
      } else if (ques) {
        const be = ques[1];
        const subject = ques[2];
        const verb = ques[3];

        // 1) Wrong conjugation: flip 'Is' <-> 'Are'
        const wrongConj = (be.toLowerCase() === 'are') ? 'Is' : (be.toLowerCase() === 'is' ? 'Are' : 'Is');
        variants.push({ bad: `${wrongConj} ${subject} going to ${verb}?`, wrongToken: wrongConj, correctToken: be });

        // 2) Wrong auxiliary 'will' (e.g., "Will we going to play?")
        variants.push({ bad: `Will ${subject} going to ${verb}?`, wrongToken: 'Will', correctToken: be });

        // 3) Wrong infinitive use: use -ing after 'to' (e.g., "Are we going to playing?")
        const verbIng = makeVerbIng(verb);
        variants.push({ bad: `${be} ${subject} going to ${verbIng}?`, wrongToken: verbIng, correctToken: verb });

        // 4) Missing be verb in question (e.g., "We going to play?")
        variants.push({ bad: `${subject} going to ${verb}?`, wrongToken: 'going', correctToken: be });
      }

      if (variants.length) {
        // Choose a random variant so mistakes vary across rounds
        const idx = Math.floor(Math.random() * variants.length);
        const chosen = variants[idx];
        return { bad: chosen.bad, wrongToken: chosen.wrongToken, correctToken: chosen.correctToken };
      }

      if (/going to/i.test(txt)) {
        const bad = txt.replace(/going to/i, 'go to');
        return { bad, wrongToken: 'go to', correctToken: 'going to' };
      }
    }

    // For be_going_to: corrupt the "going to" structure
    if (grammarType === 'be_going_to') {
      // Try to change "going to" to wrong form
      const goingToMatch = en.match(/\b(am|is|are)\s+(going\s+to)/i);
      if (goingToMatch) {
        const subj = goingToMatch[1].toLowerCase();
        // Use wrong subject-verb agreement
        const wrongForms = { am: 'is', is: 'are', are: 'am' };
        const wrong = wrongForms[subj] || 'is';
        const bad = en.replace(new RegExp(`\\b${subj}\\s+going\\s+to`, 'i'), `${wrong} going to`);
        return { bad, wrongToken: wrong, correctToken: goingToMatch[1] };
      }
      // Try changing "going to" to "gonna" or vice versa (common error)
      if (/going to/i.test(en)) {
        const bad = en.replace(/going to/i, 'go to');
        return { bad, wrongToken: 'go to', correctToken: 'going to' };
      }
    }

    // For past tenses: change verb tense
    if (['past_regular', 'past_vs_future', 'all_tenses'].includes(grammarType)) {
      // Try to find and corrupt a verb
      // Look for -ed verbs and change them
      const edMatch = en.match(/\b(\w+ed)\b/i);
      if (edMatch) {
        const verb = edMatch[1];
        // Change past to present (remove -ed)
        const baseForm = verb.replace(/ed$/i, '');
        const bad = en.replace(new RegExp(`\\b${escapeRegExp(verb)}\\b`, 'i'), baseForm);
        return { bad, wrongToken: baseForm, correctToken: verb };
      }
      // Look for "will" future and change it
      const willMatch = en.match(/\bwill\s+(\w+)/i);
      if (willMatch) {
        // Change "will go" to "will going" (common error)
        const verb = willMatch[1];
        const bad = en.replace(/\bwill\s+\w+/i, `will ${verb}ing`);
        return { bad, wrongToken: `will ${verb}ing`, correctToken: willMatch[0] };
      }
    }

    // For tense_questions: corrupt question structure with multiple error types
    if (grammarType === 'tense_questions') {
      // Try to corrupt question structure with various common errors
      const questionMatch = en.match(/^(Did|Does|Do|Will|Is|Are|Am|Was|Were)\s+(.+?)\s+(\w+)(.*)$/i);
      if (questionMatch) {
        const aux = questionMatch[1]; // e.g., "Did"
        const subject = questionMatch[2]; // e.g., "you"
        const verb = questionMatch[3]; // e.g., "play"
        const rest = questionMatch[4]; // remaining part
        
        // Choose a random error type
        const errorTypes = [];
        
        // Error 1: Remove auxiliary (original behavior)
        errorTypes.push({
          bad: en.replace(questionMatch[0], `${subject} ${verb}${rest}`),
          wrongToken: '(missing auxiliary)',
          correctToken: aux
        });
        
        // Error 2: For "Did" questions, use past tense form of verb (double past marker)
        if (aux.toLowerCase() === 'did') {
          const irregulars = {
            'go': 'went', 'eat': 'ate', 'see': 'saw', 'have': 'had',
            'do': 'did', 'take': 'took', 'get': 'got', 'make': 'made',
            'come': 'came', 'win': 'won', 'find': 'found', 'buy': 'bought'
          };
          let pastForm = verb + 'ed';
          if (irregulars[verb.toLowerCase()]) {
            pastForm = irregulars[verb.toLowerCase()];
          }
          if (pastForm !== verb) {
            errorTypes.push({
              bad: en.replace(new RegExp(`\\b${verb}\\b`, 'i'), pastForm),
              wrongToken: pastForm,
              correctToken: verb
            });
          }
        }
        
        // Error 3: Wrong word order (move verb before subject)
        errorTypes.push({
          bad: `${aux} ${verb} ${subject}${rest}`,
          wrongToken: `${verb} ${subject}`,
          correctToken: `${subject} ${verb}`
        });
        
        // Error 4: Wrong auxiliary (swap Did with Do/Does, etc.)
        if (aux.toLowerCase() === 'did') {
          const wrongAux = /\b(he|she|it)\b/i.test(subject) ? 'Does' : 'Do';
          errorTypes.push({
            bad: en.replace(/^Did\s+/i, `${wrongAux} `),
            wrongToken: wrongAux,
            correctToken: 'Did'
          });
        }
        
        // Return a random error type
        return errorTypes[Math.floor(Math.random() * errorTypes.length)];
      }
      
      // Fallback: just remove the auxiliary
      const simpleMatch = en.match(/^(Did|Does|Do|Will|Is|Are|Am|Was|Were)\s+/i);
      if (simpleMatch) {
        const bad = en.replace(simpleMatch[0], '');
        return { bad, wrongToken: '(missing auxiliary)', correctToken: simpleMatch[1] };
      }
    }

    // Will Future: corrupt "will" sentences with actual grammar errors
    // NEVER use "would" (technically valid), "going to" (synonymous)
    if (grammarType === 'will_future') {
      const willMatch = en.match(/\bwill\s+(\w+)/i);
      if (willMatch) {
        const verb = willMatch[1];
        const irregularPasts = { 'go': 'went', 'eat': 'ate', 'come': 'came', 'see': 'saw', 'do': 'did', 'have': 'had', 'play': 'played', 'drive': 'drove', 'start': 'started' };
        const pastForm = irregularPasts[verb.toLowerCase()] || verb + 'ed';
        const variants = [
          // "will drives" - wrong: conjugated verb after will
          { bad: en.replace(/\bwill\s+(\w+)/i, `will ${verb}s`), wrongToken: `will ${verb}s`, correctToken: willMatch[0] },
          // "wills play" - wrong: conjugated will
          { bad: en.replace(/\bwill\s+/i, 'wills '), wrongToken: 'wills', correctToken: 'will' },
          // "will ate" / "will went" - wrong: past tense after will
          { bad: en.replace(/\bwill\s+(\w+)/i, `will ${pastForm}`), wrongToken: `will ${pastForm}`, correctToken: willMatch[0] },
          // "I didnt will" - wrong: double auxiliary
          { bad: en.replace(/\bwill\s+(\w+)/i, `didn't will ${verb}`), wrongToken: `didn't will`, correctToken: 'will' }
        ];
        // Add time conflict error if future time word exists
        if (/\b(tomorrow|next|later|soon)\b/i.test(en)) {
          variants.push({ 
            bad: en.replace(/\b(tomorrow|next week|next month|later|soon)\b/i, 'yesterday'), 
            wrongToken: 'yesterday', 
            correctToken: en.match(/\b(tomorrow|next week|next month|later|soon)\b/i)?.[0] || 'tomorrow' 
          });
        }
        return variants[Math.floor(Math.random() * variants.length)];
      }
    }

    // Will Questions: corrupt with actual grammar errors (verb form, word order, time conflicts)
    if (grammarType === 'will_questions') {
      const willQMatch = en.match(/^(Will)\s+(\w+)\s+(\w+)(.*)$/i);
      if (willQMatch) {
        const aux = willQMatch[1];
        const subject = willQMatch[2];
        const verb = willQMatch[3];
        const rest = willQMatch[4];
        
        const irregularPasts = { 'go': 'went', 'eat': 'ate', 'come': 'came', 'see': 'saw', 'play': 'played', 'be': 'was' };
        const pastForm = irregularPasts[verb.toLowerCase()] || verb + 'ed';
        
        const variants = [
          // Wrong verb form: "Will she goes?"
          { bad: `Will ${subject} ${verb}s${rest}`, wrongToken: `${verb}s`, correctToken: verb },
          // Wrong verb form: "Will she went?"
          { bad: `Will ${subject} ${pastForm}${rest}`, wrongToken: pastForm, correctToken: verb },
          // Wrong word order: "Will goes she?"
          { bad: `Will ${verb} ${subject}${rest}`, wrongToken: `${verb} ${subject}`, correctToken: `${subject} ${verb}` },
          // Double marking: "Will she will go?"
          { bad: `Will ${subject} will ${verb}${rest}`, wrongToken: 'will will', correctToken: 'Will' }
        ];
        
        // Add time conflict if future time word exists
        if (/\b(tomorrow|next|later|soon)\b/i.test(rest)) {
          variants.push({ 
            bad: en.replace(/\b(tomorrow|next week|next month|later|soon)\b/i, 'yesterday'), 
            wrongToken: 'yesterday', 
            correctToken: rest.match(/\b(tomorrow|next week|next month|later|soon)\b/i)?.[0] || 'tomorrow' 
          });
        }
        
        return variants[Math.floor(Math.random() * variants.length)];
      }
      
      // Fallback for simpler patterns
      const simpleMatch = en.match(/^(Will)\s+/i);
      if (simpleMatch) {
        const variants = [
          { bad: en.replace(/^Will\s+/i, 'Do '), wrongToken: 'Do', correctToken: 'Will' },
          { bad: en.replace(/^Will\s+/i, 'Does '), wrongToken: 'Does', correctToken: 'Will' },
          { bad: en.replace(/^Will\s+/i, ''), wrongToken: '(missing Will)', correctToken: 'Will' }
        ];
        return variants[Math.floor(Math.random() * variants.length)];
      }
    }

    // Have To: corrupt "have to" / "has to"
    if (grammarType === 'have_to') {
      const haveToMatch = en.match(/\b(have to|has to)\b/i);
      if (haveToMatch) {
        const correct = haveToMatch[1];
        const variants = [];
        // Wrong agreement: swap have/has
        if (correct.toLowerCase() === 'have to') {
          variants.push({ bad: en.replace(/\bhave to\b/i, 'has to'), wrongToken: 'has to', correctToken: 'have to' });
        } else {
          variants.push({ bad: en.replace(/\bhas to\b/i, 'have to'), wrongToken: 'have to', correctToken: 'has to' });
        }
        // Common errors
        variants.push({ bad: en.replace(/\b(have|has) to\b/i, 'must to'), wrongToken: 'must to', correctToken: correct });
        variants.push({ bad: en.replace(/\b(have|has) to\b/i, 'need'), wrongToken: 'need', correctToken: correct });
        return variants[Math.floor(Math.random() * variants.length)];
      }
    }

    // Want To: corrupt "want to" / "wants to"
    // NEVER use "wanna" as wrong (too common in colloquial speech)
    if (grammarType === 'want_to') {
      const wantToMatch = en.match(/\b(want to|wants to)\b/i);
      if (wantToMatch) {
        const correct = wantToMatch[1];
        const variants = [];
        // Wrong agreement: swap want/wants
        if (correct.toLowerCase() === 'want to') {
          variants.push({ bad: en.replace(/\bwant to\b/i, 'wants to'), wrongToken: 'wants to', correctToken: 'want to' });
        } else {
          variants.push({ bad: en.replace(/\bwants to\b/i, 'want to'), wrongToken: 'want to', correctToken: 'wants to' });
        }
        // Missing "to": "She want play" instead of "She wants to play"
        variants.push({ bad: en.replace(/\b(want|wants) to (\w+)/i, '$1 $2'), wrongToken: '(missing "to")', correctToken: correct });
        // Wrong structure: "want for" instead of "want to"
        variants.push({ bad: en.replace(/\b(want|wants) to\b/i, '$1 for'), wrongToken: `${correct.split(' ')[0]} for`, correctToken: correct });
        return variants[Math.floor(Math.random() * variants.length)];
      }
    }

    // Like To: corrupt "like to" / "likes to"
    if (grammarType === 'like_to') {
      const likeToMatch = en.match(/\b(like to|likes to)\b/i);
      if (likeToMatch) {
        const correct = likeToMatch[1];
        const variants = [];
        if (correct.toLowerCase() === 'like to') {
          variants.push({ bad: en.replace(/\blike to\b/i, 'likes to'), wrongToken: 'likes to', correctToken: 'like to' });
        } else {
          variants.push({ bad: en.replace(/\blikes to\b/i, 'like to'), wrongToken: 'like to', correctToken: 'likes to' });
        }
        variants.push({ bad: en.replace(/\b(like|likes) to (\w+)/i, '$1 $2ing'), wrongToken: 'like/likes + -ing', correctToken: correct });
        return variants[Math.floor(Math.random() * variants.length)];
      }
    }

    // Fallback: subject-verb agreement corruption
    const parts = en.split(/\s+/);
    if (parts.length >= 2) {
      const subjIdx = 0;
      const origSubj = parts[subjIdx];
      const lowSubj = origSubj.toLowerCase().replace(/[.,!?;:]+$/g, '');
      const thirdSingular = ['he', 'she', 'it'];
      if (thirdSingular.includes(lowSubj)) {
        const replacements = ['they', 'we', 'you'];
        const replacement = replacements[Math.floor(Math.random() * replacements.length)];
        const bad = parts.slice();
        bad[subjIdx] = replacement.charAt(0) === replacement.charAt(0).toLowerCase()
          ? (/[A-Z]/.test(origSubj[0]) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement)
          : replacement;
        return { bad: bad.join(' '), wrongToken: bad[subjIdx], correctToken: origSubj };
      }
      if (parts.length >= 3) {
        const verbIdx = 2;
        const orig = parts[verbIdx];
        const low = orig.toLowerCase().replace(/[.,!?;:]+$/g, '');
        const banned = ['always','never','often','sometimes','usually','really','very','now','today',
          'in','on','at','to','for','with','of','a','an','the','and','but','or'];
        if (!banned.includes(low)) {
          const changed = /s$/i.test(orig) ? orig.replace(/s$/i, '') : `${orig}s`;
          const bad = parts.slice();
          bad[verbIdx] = changed;
          return { bad: bad.join(' '), wrongToken: changed, correctToken: orig };
        }
      }
    }
    
    // Final fallback: try to use detractors from the item
    if (item.detractors && item.detractors.length > 0 && item.word) {
      const detractor = item.detractors[Math.floor(Math.random() * item.detractors.length)];
      if (detractor) {
        const bad = en.replace(new RegExp(`\\b${escapeRegExp(item.word)}\\b`, 'i'), detractor);
        return { bad, wrongToken: detractor, correctToken: item.word };
      }
    }
    
    // Ultimate fallback: subject-verb agreement issue
    return { bad: en.replace(/\s+is\s+/, ' are ').replace(/\s+are\s+/, ' is '), wrongToken: 'wrong verb', correctToken: 'correct verb' };
  }

  const total = Math.min(14, base.length);
  const half = Math.floor(total / 2);
  const shuffled = base.sort(() => Math.random() - 0.5).slice(0, total);
  const good = shuffled.slice(0, half).map(it => ({ type: 'good', en: makeSentence(it), src: it }));
  const bad = shuffled.slice(half).map(it => {
    const en = makeSentence(it);
    const c = corruptSentence(en, it);
    return { type: 'bad', enBad: c.bad, enCorrect: en, wrongToken: c.wrongToken, correctToken: c.correctToken, src: it };
  });
  const rounds = [...good, ...bad].sort(() => Math.random() - 0.5);

  // Use grammarFile path for session tracking to match homework assignment list_key
  const sessionId = startSession({ mode: MODE, listName: grammarFile || grammarName, wordList: rounds.map((r, i) => r.src?.word || `s${i}`), meta: { grammarFile, grammarName, level: 3 } });
  let idx = 0, correct = 0, wrong = 0;

  function render() {
    if (idx >= rounds.length) return end();
    const r = rounds[idx];
    container.innerHTML = '';
    container.style.cssText = 'padding:20px;max-width:760px;margin:0 auto;font-family:Poppins,Arial,sans-serif;min-height:100dvh;display:flex;flex-direction:column;';
    
    // Add quit button (fixed position at bottom)
    if (!document.getElementById('grammarQuitBtn')) {
      const quitBtn = document.createElement('button');
      quitBtn.id = 'grammarQuitBtn';
      quitBtn.type = 'button';
      quitBtn.className = 'wa-quit-btn';
      quitBtn.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);border:none;background:transparent;cursor:pointer;z-index:9999;padding:8px;';
      quitBtn.innerHTML = '<img src="./assets/Images/icons/quit-game.svg" alt="Quit" style="width:28px;height:28px;"/>';
      quitBtn.onclick = () => { quitBtn.remove(); window.history.back(); };
      document.body.appendChild(quitBtn);
    }
    
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;color:#666';
    head.innerHTML = `<div><b>${grammarName || 'Grammar'}</b></div><div>Q ${idx + 1}/${rounds.length}</div>`;
    container.appendChild(head);
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border:3px solid #40D4DE;border-radius:18px;padding:28px;box-shadow:0 6px 14px rgba(64,212,222,.18);margin-bottom:18px;';
    const sentence = (r.type === 'good' ? r.en : r.enBad);
    let cardHtml = `<div style="font-size:24px;line-height:1.5;color:#333;text-align:center">${sentence}</div>`;
    card.innerHTML = cardHtml;
    container.appendChild(card);
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'O'; okBtn.setAttribute('aria-label', 'Correct sentence');
    okBtn.style.cssText = baseBtn('#21b5c0');
    const xBtn = document.createElement('button');
    xBtn.textContent = 'X'; xBtn.setAttribute('aria-label', 'Wrong sentence');
    xBtn.style.cssText = baseBtn('#ff6b6b');
    btnRow.appendChild(okBtn);
    btnRow.appendChild(xBtn);
    container.appendChild(btnRow);

    // Sticky footer for Next/Finish button so it's always visible on small screens
    const footer = document.createElement('div');
    footer.id = 'gm-footer';
    footer.style.cssText = 'position:sticky;bottom:0;left:0;right:0;padding:12px 12px calc(16px + env(safe-area-inset-bottom,0px));background:linear-gradient(to top, rgba(251,255,255,0.98), rgba(251,255,255,0.82), rgba(251,255,255,0));display:flex;justify-content:center;z-index:1;';
    container.appendChild(footer);
    const decide = (choice) => {
      const isCorrect = (r.type === 'good' && choice === 'O') || (r.type === 'bad' && choice === 'X');
      if (isCorrect) { correct++; playSFX('correct'); } else { wrong++; playSFX('wrong'); }
      reveal(r, isCorrect);
      logAttempt({ session_id: sessionId, mode: MODE, word: r.src?.word || `s${idx}`, is_correct: isCorrect, answer: choice, correct_answer: r.type === 'good' ? 'O' : 'X', points: isCorrect ? 1 : 0, extra: { type: r.type, level: 3, category: 'grammar', grammarFile } });
    };
    okBtn.onclick = () => decide('O');
    xBtn.onclick = () => decide('X');
  }

  function baseBtn(color) {
    return `background:#fff;border:3px solid ${color};color:${color};font-weight:800;padding:14px 26px;border-radius:14px;font-size:22px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.06);`;
  }

  function reveal(r, wasRight) {
    const controls = container.querySelectorAll('button'); controls.forEach(b => b.disabled = true);
    const revealBox = document.createElement('div');
    revealBox.style.cssText = 'margin-top:16px;text-align:center';
    if (r.type === 'good') {
      revealBox.innerHTML = `<div style="color:#4caf50;font-weight:800;font-size:28px;margin-bottom:10px;">Correct sentence ✔</div>`;
    } else {
      const raw = r.enBad;
      const wrongToken = r.wrongToken || '';
      const safeWrong = wrongToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const badHtml = raw.replace(new RegExp(`\\b${safeWrong}\\b`, 'i'), (m) => `<span class="mistake" style="color:#ff6b6b;font-weight:800;text-decoration:line-through;">${m}</span>`);
      revealBox.innerHTML = `
        <div style="color:#ff6b6b;font-weight:700;margin-bottom:8px;">There is a mistake ✖</div>
        <div style="font-size:22px;line-height:1.6;color:#333;margin-bottom:10px;">${badHtml}</div>
        <div id="fixLine" style="position:relative;min-height:80px;width:100%;max-width:760px;margin:0 auto;padding:0 8px;">
          <span style="position:absolute;left:50%;transform:translateX(-50%);background:#e8f5e9;color:#2e7d32;border:2px solid #2e7d32;padding:12px 20px;border-radius:12px;font-weight:800;font-size:22px;width:100%;box-sizing:border-box;text-align:center;line-height:1.4;word-wrap:break-word;">${r.enCorrect}</span>
        </div>`;
      setTimeout(() => {
        const el = revealBox.querySelector('#fixLine span');
        if (!el) return;
        el.animate([
          { transform: 'translate(-50%, 12px)', opacity: .0 },
          { transform: 'translate(-50%, 0)', opacity: 1 }
        ], { duration: 350, easing: 'ease-out' });
      }, 50);
    }
    container.appendChild(revealBox);
    // Small spacer to separate content from sticky footer
    const spacer = document.createElement('div');
    spacer.style.cssText = 'height:16px;';
    container.appendChild(spacer);
    const next = document.createElement('button');
    next.textContent = (idx < rounds.length - 1 ? 'Next' : 'Finish');
    next.style.cssText = baseBtn('#21b5c0') + 'display:block;margin:0 auto;max-width:360px;width:min(92vw,360px);';
    next.onclick = () => { idx++; render(); };
    const footer = container.querySelector('#gm-footer');
    if (footer) { footer.replaceChildren(); footer.appendChild(next); }
    else { container.appendChild(next); }
  }

  function end() {
    endSession(sessionId, {
      mode: MODE,
      summary: {
        score: correct,
        total: rounds.length,
        correct,
        wrong,
        points: correct,
        pct: Math.round((correct / (rounds.length || 1)) * 100),
        category: 'grammar',
        context: 'game',
        grammarName,
        grammarFile,
        level: 3,
      },
      // Use grammarFile path for session tracking to match homework assignment list_key
      listName: grammarFile || grammarName,
      wordList: rounds.map((r, i) => r.src?.word || `s${i}`),
      meta: { grammarFile, grammarName, level: 3 },
    });
    // Remove quit button
    try { const qb = document.getElementById('grammarQuitBtn'); if (qb) qb.remove(); } catch {}
    playSFX('end');
    const gameArea = document.getElementById('gameArea');
    renderGrammarSummary({
      gameArea,
      score: correct,
      total: rounds.length,
      ctx: { grammarFile, grammarName },
    });
  }

  render();
  try {
    if (splashController && typeof splashController.hide === 'function') setTimeout(() => { try { splashController.hide(); } catch {} }, 520);
  } catch (e) {}
}