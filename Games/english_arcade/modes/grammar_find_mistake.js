// Grammar Find-the-Mistake Mode (O/X validator)
// Shows a sentence; student clicks O (correct) or X (wrong). If wrong, reveal fix by striking error
// and animating the correct token over it. Uses half-good/half-bad distribution.

import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { playSFX } from '../sfx.js';
import { renderGrammarSummary } from './grammar_summary.js';

const MODE = 'grammar_find_mistake';

export async function runGrammarFindMistakeMode({ grammarFile, grammarName, grammarConfig = {} }) {
  const container = document.getElementById('gameArea');
  if (!container) return;
  container.innerHTML = '<div style="padding:20px;text-align:center;">Loading…</div>';

  // Load list
  let data = [];
  try {
    const r = await fetch(grammarFile);
    if (!r.ok) throw new Error('load failed');
    data = await r.json();
    console.log('DEBUG find_mistake: grammarFile=', grammarFile, 'grammarName=', grammarName, 'data[0]=', data[0]);
  } catch (e) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#c00">Failed to load list.</div>';
    return;
  }

  const base = (Array.isArray(data) ? data : []).filter(it => (it && (it.en || it.exampleSentence))); // prefer en; fallback exampleSentence
  if (!base.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;">No sentences.</div>';
    return;
  }

  // Build good/bad pool & corruption helpers
  const makeSentence = (it) => (it.en || it.exampleSentence || '').trim();
  const isSomeAnyList = /some_vs_any\.json$/i.test(String(grammarFile || '')) || /some\s*vs\s*any/i.test(String(grammarName || ''));
  const isPrepositionList = /prepositions_/i.test(String(grammarFile || '')) || /prepositions_/i.test(String(grammarName || ''));
  const isPresentSimpleList = /present_simple_sentences\.json$/i.test(String(grammarFile || '')) || /present\s*simple\s*sentences/i.test(String(grammarName || ''));
  const isPresentSimpleNegativeList = /present_simple_negative\.json$/i.test(String(grammarFile || '')) || /present\s*simple[\s:\-]*negative/i.test(String(grammarName || ''));
  const isPresentSimpleYesNoList = /present_simple_questions_yesno\.json$/i.test(String(grammarFile || ''))
    || /present\s*simple[\s:\-]*(yes|question)/i.test(String(grammarName || ''))
    || /yes\s*\/\s*no/i.test(String(grammarName || ''));
  // NEW: WH list detection (present simple WH questions)
  const isPresentSimpleWhList = /present_simple_questions_wh\.json$/i.test(String(grammarFile || ''))
    || /present\s*simple[\s:\-]*wh/i.test(String(grammarName || ''))
    || /wh\s*questions?/i.test(String(grammarName || ''));
  // Present progressive list detection (BE + V-ing sentences)
  const isPresentProgressiveList = /present_progressive\.json$/i.test(String(grammarFile || ''))
    || /present\s*progressive(?!.*(negative|yes\s*\/\s*no|wh))/i.test(String(grammarName || ''));
  const isPresentProgressiveNegativeList = /present_progressive_negative\.json$/i.test(String(grammarFile || ''))
    || /present\s*progressive[\s:\-]*negative/i.test(String(grammarName || ''));
  const isPresentProgressiveWhList = /present_progressive_questions_wh\.json$/i.test(String(grammarFile || ''))
    || /present\s*progressive[\s:\-]*wh/i.test(String(grammarName || ''));
  const isPresentProgressiveYesNoList = /present_progressive_questions_yesno\.json$/i.test(String(grammarFile || ''))
    || /present\s*progressive.*yes\s*\/\s*no/i.test(String(grammarName || ''));
  console.log('DEBUG: isSomeAnyList=', isSomeAnyList, 'isPresentSimpleList=', isPresentSimpleList, 'isPresentSimpleNegativeList=', isPresentSimpleNegativeList, 'isPresentSimpleYesNoList=', isPresentSimpleYesNoList, 'isPresentSimpleWhList=', isPresentSimpleWhList);

  function corruptSomeAny(en) {
    const rxSome = /\bsome\b/i;
    const rxAny = /\bany\b/i;
    if (rxSome.test(en)) {
      const bad = en.replace(rxSome, (m) => (m[0] === m[0].toUpperCase() ? 'Any' : 'any'));
      return { bad, wrongToken: 'any', correctToken: 'some' };
    }
    if (rxAny.test(en)) {
      const bad = en.replace(rxAny, (m) => (m[0] === m[0].toUpperCase() ? 'Some' : 'some'));
      return { bad, wrongToken: 'some', correctToken: 'any' };
    }
    return null;
  }

  function corruptPreposition(en, allItems) {
    // For preposition lists, swap with a different preposition to create a mistake
    // Students validate against Korean translation
    const allPrepositions = allItems.map(item => {
      const itemEn = (item.en || item.exampleSentence || '').trim();
      const match = itemEn.match(/\b(in|on|under|above|below|between|next to|behind|in front of|near|across from|at|by|through|beside|over)\b/i);
      return match ? match[1].toLowerCase() : null;
    }).filter(p => p !== null);

    if (!allPrepositions.length) return null;

    // Extract the preposition from the current sentence
    const match = en.match(/\b(in|on|under|above|below|between|next to|behind|in front of|near|across from|at|by|through|beside|over)\b/i);
    if (!match) return null;

    const correctPrep = match[1].toLowerCase();
    const availableWrongPreps = allPrepositions.filter(p => p !== correctPrep);
    
    if (!availableWrongPreps.length) return null;

    // Pick a random wrong preposition
    const wrongPrep = availableWrongPreps[Math.floor(Math.random() * availableWrongPreps.length)];
    
    // Replace the preposition in the sentence
    const regex = new RegExp(`\\b${correctPrep}\\b`, 'i');
    const bad = en.replace(regex, wrongPrep);
    
    return { bad, wrongToken: wrongPrep, correctToken: correctPrep };
  }

  function corruptSentence(en) {
    console.log('DEBUG corruptSentence: isPresentSimpleYesNoList=', isPresentSimpleYesNoList, 'isPresentSimpleWhList=', isPresentSimpleWhList, 'isPresentProgressiveList=', isPresentProgressiveList, 'isPPNeg=', isPresentProgressiveNegativeList, 'isPPWh=', isPresentProgressiveWhList, 'isPPYesNo=', isPresentProgressiveYesNoList, 'en=', en.substring(0, 50));
    if (isSomeAnyList) {
      const res = corruptSomeAny(en);
      if (res) return res;
    }

    if (isPrepositionList) {
      const res = corruptPreposition(en, base);
      if (res) return res;
    }

    // Present Simple NEGATIVE: flip don't <-> doesn't regardless of subject for wrong sentence
    if (isPresentSimpleNegativeList) {
      const rxDoesnt = /\bdoesn['’]?t\b/i;
      const rxDont = /\bdon['’]?t\b/i;
      if (rxDoesnt.test(en)) {
        const m = en.match(rxDoesnt);
        const cap = m && /^[A-Z]/.test(m[0]);
        const replacement = cap ? "Don't" : "don't";
        const bad = en.replace(rxDoesnt, replacement);
        return { bad, wrongToken: replacement, correctToken: m ? m[0] : "doesn't" };
      }
      if (rxDont.test(en)) {
        const m = en.match(rxDont);
        const cap = m && /^[A-Z]/.test(m[0]);
        const replacement = cap ? "Doesn't" : "doesn't";
        const bad = en.replace(rxDont, replacement);
        return { bad, wrongToken: replacement, correctToken: m ? m[0] : "don't" };
      }
      // Fallback: if neither present (unexpected), fall through to generic present simple logic
    }

  // Present simple: force verb agreement error
    if (isPresentSimpleList) {
      const tokens = en.split(/\s+/);
      if (tokens.length >= 3) {
        const lower = tokens.map(t => t.toLowerCase().replace(/[.,!?;:]+$/g, ''));
        let subjIdx = 0;
        if (lower[0] === 'the' && lower.length >= 2) subjIdx = 1;
        const subj = lower[subjIdx];
        let verbIdx = subjIdx + 1;
        const skip = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'of']);
        while (verbIdx < lower.length && skip.has(lower[verbIdx])) verbIdx++;
        if (verbIdx < tokens.length) {
          const origVerb = tokens[verbIdx];
          const bare = origVerb.replace(/[.,!?;:]+$/g, '');
          const punct = origVerb.slice(bare.length);
          const makeForms = (v) => {
            if (!v) return [v, v];
            if (/ies$/i.test(v) && !/[aeiou]ies$/i.test(v)) {
              const base = v.replace(/ies$/i, 'y');
              return [base, v];
            }
            if (/(ches|shes|sses|xes|zes)$/i.test(v)) {
              const base = v.replace(/es$/i, '');
              return [base, v];
            }
            if (/s$/i.test(v) && !/ss$/i.test(v)) {
              const base = v.replace(/s$/i, '');
              return [base, v];
            }
            if (/(ch|sh|s|x|z)$/i.test(v)) return [v, v + 'es'];
            if (/y$/i.test(v) && !/[aeiou]y$/i.test(v)) return [v, v.replace(/y$/i, 'ies')];
            return [v, v + 's'];
          };
          const [baseForm, sForm] = makeForms(bare);
          const isThirdSingular = ['he', 'she', 'it'].includes(subj) || (subj === 'sun');
          const correctVerb = isThirdSingular ? sForm : baseForm;
          const wrongVerb = isThirdSingular ? baseForm : sForm;
          if (correctVerb && wrongVerb && correctVerb.toLowerCase() !== wrongVerb.toLowerCase()) {
            const badTokens = tokens.slice();
            badTokens[verbIdx] = wrongVerb + punct;
            return {
              bad: badTokens.join(' '),
              wrongToken: wrongVerb,
              correctToken: correctVerb,
            };
          }
        }
      }
      // fall through to generic if anything failed
    }

    // Present Progressive NEGATIVE: swap BE to wrong form inside negative chunk
    if (isPresentProgressiveNegativeList) {
      const low = en.toLowerCase();
      // Identify BE-negative chunk and subject to choose a wrong BE
      // Patterns: "I am not", "he is not" / "he isn't", "they are not" / "they aren't"
      // Strategy: replace only the BE/negative token(s) with an incorrect counterpart
      const replaceOnce = (rx, replacement, wrongToken, correctToken) => {
        const bad = en.replace(rx, replacement);
        return { bad, wrongToken, correctToken };
      };
      const rxINot = /(\bI\s+)am\s+not\b/i;
      const rxIsNot = /\b(is\s+not|isn['’]?t)\b/i;
      const rxAreNot = /\b(are\s+not|aren['’]?t)\b/i;

      if (rxINot.test(en)) {
        // I am not -> I is not (or aren't). Prefer "is not" as clearer highlight.
        const m = en.match(/\bI\s+am\s+not\b/i);
        return replaceOnce(/\bI\s+am\s+not\b/i, (m && m[0][0] === 'I') ? 'I is not' : 'I is not', 'is not', 'am not');
      }
      if (rxIsNot.test(en)) {
        // he isn't / is not -> he aren't
        const m = en.match(rxIsNot);
        const cap = m && /^[A-Z]/.test(m[0]);
        const wrong = cap ? "Aren't" : "aren't";
        return replaceOnce(rxIsNot, wrong, wrong.toLowerCase(), m ? m[0] : 'is not');
      }
      if (rxAreNot.test(en)) {
        // they aren't / are not -> they isn't
        const m = en.match(rxAreNot);
        const cap = m && /^[A-Z]/.test(m[0]);
        const wrong = cap ? "Isn't" : "isn't";
        return replaceOnce(rxAreNot, wrong, wrong.toLowerCase(), m ? m[0] : 'are not');
      }
      // Fallback: if no clear negative chunk, drop to generic progressive handling
    }

    // Present Progressive list: introduce typical BE + V-ing mistakes
    if (isPresentProgressiveList) {
      // Match first "am/is/are + V-ing" chunk
      const m = en.match(/\b(Am|Is|Are|am|is|are)\s+([A-Za-z]+ing)\b/);
      if (m) {
        const be = m[1];
        const vIng = m[2];
        const correctChunk = `${be} ${vIng}`;

        // Build a wrong BE and/or wrong verb form
        const beLower = be.toLowerCase();
        let wrongBe;
        if (beLower === 'am') wrongBe = 'is';
        else if (beLower === 'is') wrongBe = 'are';
        else if (beLower === 'are') wrongBe = 'is';

        // Crude base form for V-ing (same logic as fill-gap): strip -ing and undouble last consonant
        let base = vIng.replace(/ing$/i, '');
        base = base.replace(/([b-df-hj-np-tv-z])\1$/i, '$1');

        const patterns = [];

        // 1) Wrong BE with same V-ing (e.g., "He are playing")
        if (wrongBe) {
          const wrongChunk = `${wrongBe} ${vIng}`;
          const bad1 = en.replace(correctChunk, wrongChunk);
          patterns.push({ bad: bad1, wrongToken: wrongBe, correctToken: be });
        }

        // 2) Correct BE + base verb (e.g., "He is play")
        if (base && base.toLowerCase() !== vIng.toLowerCase()) {
          const wrongChunk2 = `${be} ${base}`;
          const bad2 = en.replace(correctChunk, wrongChunk2);
          patterns.push({ bad: bad2, wrongToken: base, correctToken: vIng });
        }

        // 3) Wrong BE + base verb (e.g., "He are play")
        if (wrongBe && base && base.toLowerCase() !== vIng.toLowerCase()) {
          const wrongChunk3 = `${wrongBe} ${base}`;
          const bad3 = en.replace(correctChunk, wrongChunk3);
          patterns.push({ bad: bad3, wrongToken: wrongBe, correctToken: be });
        }

        if (patterns.length) {
          const choice = patterns[Math.floor(Math.random() * patterns.length)];
          return choice;
        }
      }
      // If no BE + V-ing found, fall through to generic logic
    }

    const isThereIsAreList = /there_is_vs_there_are\.json$/i.test(String(grammarFile || '')) || /there\s+is\s+vs\s+there\s+are/i.test(String(grammarName || ''));
    if (isThereIsAreList) {
      const low = en.toLowerCase();
      if (/^there\s+is\b/.test(low)) {
        const bad = en.replace(/^(there\s+)is\b/i, '$1are');
        return { bad, wrongToken: 'are', correctToken: 'is' };
      }
      if (/^there\s+are\b/.test(low)) {
        const bad = en.replace(/^(there\s+)are\b/i, '$1is');
        return { bad, wrongToken: 'is', correctToken: 'are' };
      }
    }

    // Present Simple Yes/No + WH questions: create typical DO/DOES + verb mistakes
    if (isPresentSimpleYesNoList || isPresentSimpleWhList) {
      // Allow optional WH word before Do/Does
      const mQ = en.match(/^(?:Who|What|When|Where|Why|How|Which)\s+(Do|Does)\s+(.+?)\s+(\w+)(.*)$/i)
               || en.match(/^(Do|Does)\s+(.+?)\s+(\w+)(.*)$/i);
      if (mQ) {
        const aux = mQ[1];
        const subj = mQ[2];
        const verb = mQ[3];
        const rest = mQ[4] || '';
        const subjLower = subj.trim().toLowerCase();

        // Heuristic: third-person singular subjects
        const isThirdSingular = /\b(he|she|it)\b/.test(subjLower)
          || /\b(?:my|your|his|her|its|our|their)\s+(friend|sister|brother|mother|father|teacher|bag|car|pet)\b/.test(subjLower)
          || /\b(?:the|this|that)\s+\w+\b/.test(subjLower);

        // Build base vs -s form of the verb
        const bare = verb.replace(/[.,!?;:]+$/g, '');
        let baseForm = bare;
        let sForm = bare;
        if (/ies$/i.test(bare) && !/[aeiou]ies$/i.test(bare)) {
          baseForm = bare.replace(/ies$/i, 'y');
          sForm = bare;
        } else if (/(ches|shes|sses|xes|zes)$/i.test(bare)) {
          baseForm = bare.replace(/es$/i, '');
          sForm = bare;
        } else if (/s$/i.test(bare) && !/ss$/i.test(bare)) {
          baseForm = bare.replace(/s$/i, '');
          sForm = bare;
        } else {
          baseForm = bare;
          if (/(ch|sh|s|x|z)$/i.test(bare)) sForm = bare + 'es';
          else if (/y$/i.test(bare) && !/[aeiou]y$/i.test(bare)) sForm = bare.replace(/y$/i, 'ies');
          else sForm = bare + 's';
        }

        const correctAux = isThirdSingular ? 'Does' : 'Do';
        const wrongAux = isThirdSingular ? 'Do' : 'Does';

        const patterns = [];

        // 1) Wrong auxiliary for subject (Does they / Do she)
        if (wrongAux !== aux) {
          patterns.push({
            bad: en.replace(/\b(Do|Does)\b/i, wrongAux),
            wrongToken: wrongAux,
            correctToken: correctAux,
          });
        }

        // 2) Wrong verb -s form after correct auxiliary
        if (baseForm && sForm && baseForm.toLowerCase() !== sForm.toLowerCase()) {
          const verbRx = new RegExp('\\b' + verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
          const bad = en.replace(verbRx, sForm);
          patterns.push({
            bad,
            wrongToken: sForm,
            correctToken: baseForm,
          });
        }

        // 3) Wrong auxiliary + wrong verb form
        if (baseForm && sForm && baseForm.toLowerCase() !== sForm.toLowerCase() && wrongAux !== aux) {
          let bad = en.replace(/\b(Do|Does)\b/i, wrongAux);
          const verbRx = new RegExp('\\b' + verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
          bad = bad.replace(verbRx, sForm);
          patterns.push({
            bad,
            wrongToken: wrongAux,
            correctToken: correctAux,
          });
        }

        if (patterns.length) {
          const choice = patterns[Math.floor(Math.random() * patterns.length)];
          return choice;
        }
      }
    }

    // Present Progressive WH questions: wrong BE after WH
    if (isPresentProgressiveWhList) {
      // Pattern: WH + Am/Is/Are + (subject|V-ing) ...?  (allow omitted subject: "Who is singing?")
      const mWh = en.match(/^(Who|What|When|Where|Why|How|Which)\s+(Am|Is|Are|am|is|are)\b([\s\S]*)/);
      if (mWh) {
        const wh = mWh[1];
        const be = mWh[2];
        const tail = (mWh[3] || '').trim();
        const tokens = tail.split(/\s+/);
        const t0 = (tokens[0] || '').replace(/[^A-Za-z]/g,'').toLowerCase();
        const t1 = (tokens[1] || '').replace(/[^A-Za-z]/g,'').toLowerCase();

        // Decide subject category
        const isI = t0 === 'i';
        const isPluralPron = ['you','we','they'].includes(t0);
        const isThirdPron = ['he','she','it'].includes(t0);
        let isThirdNoun = false;
        let isPluralNoun = false;
        if (t0 === 'the' && t1) {
          // crude plural guess by -s (avoid ss/us edge minimally)
          if (/s$/.test(t1) && !/(ss|us)$/i.test(t1)) isPluralNoun = true; else isThirdNoun = true;
        }
        const whAsSubject = /ing$/i.test(t0); // e.g., "Who is singing?"

        const beLower = be.toLowerCase();
        let wrongBe = null;
        if (isI) {
          wrongBe = 'is';
          if (beLower === 'is') wrongBe = 'are';
        } else if (isPluralPron || isPluralNoun) {
          wrongBe = (beLower === 'are') ? 'is' : 'is';
        } else if (isThirdPron || isThirdNoun || whAsSubject) {
          wrongBe = (beLower === 'is') ? 'are' : 'are';
        } else {
          // default flip between is/are; for am -> is
          if (beLower === 'is') wrongBe = 'are';
          else if (beLower === 'are') wrongBe = 'is';
          else wrongBe = 'is';
        }

        if (wrongBe && wrongBe.toLowerCase() !== beLower) {
          const wrongOut = /[A-Z]/.test(be[0]) ? (wrongBe.charAt(0).toUpperCase() + wrongBe.slice(1)) : wrongBe;
          const bad = en.replace(new RegExp(`^(${wh})\\s+(Am|Is|Are|am|is|are)`), `$1 ${wrongOut}`);
          return { bad, wrongToken: wrongOut, correctToken: be };
        }
      }
    }

    const m = en.match(/^(Do|Does|Is|Are|Can)\s+(\S+)\s+(.*)$/i);
    if (m) {
      const aux = m[1];
      const subj = m[2];
      const rest = m[3];
      let wrongAux = null;
      if (/^Do$/i.test(aux)) wrongAux = 'Does';
      else if (/^Does$/i.test(aux)) wrongAux = 'Do';
      else if (/^Is$/i.test(aux)) wrongAux = 'Are';
      else if (/^Are$/i.test(aux)) wrongAux = 'Is';
      if (wrongAux && wrongAux !== aux) {
        return { bad: `${wrongAux} ${subj} ${rest}`, wrongToken: wrongAux, correctToken: aux };
      }
    }

    const parts = en.split(/\s+/);
    if (parts.length >= 2) {
      // Prefer to create a subject-pronoun agreement mistake like:
      // He likes milk. -> They likes milk.
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

      // Fallback: only tweak the third token if it looks verb-like (avoid adverbs like "always")
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

    return { bad: en + '!', wrongToken: '!', correctToken: '' };
  }

  // Create half-good, half-bad
  const total = Math.min(14, base.length); // short session
  const half = Math.floor(total/2);
  const shuffled = base.sort(() => Math.random() - 0.5).slice(0, total);
  const good = shuffled.slice(0, half).map(it => ({ type:'good', en: makeSentence(it), src: it }));
  const bad = shuffled.slice(half).map(it => { const en = makeSentence(it); const c = corruptSentence(en); return { type:'bad', enBad: c.bad, enCorrect: en, wrongToken: c.wrongToken, correctToken: c.correctToken, src: it }; });
  const rounds = [...good, ...bad].sort(() => Math.random() - 0.5);

  // Start session
  const sessionId = startSession({ mode: MODE, listName: grammarName, wordList: rounds.map((r,i)=>r.src?.word||`s${i}`), meta: { grammarFile } });
  let idx = 0, correct = 0, wrong = 0;

  function addExitButton() {
    // Use standard wa-quit-btn pattern from other modes
    if (document.getElementById('grammarQuitBtn')) return;
    const quitBtn = document.createElement('button');
    quitBtn.id = 'grammarQuitBtn';
    quitBtn.className = 'wa-quit-btn';
    quitBtn.type = 'button';
    quitBtn.setAttribute('aria-label', 'Quit game');
    quitBtn.innerHTML = `
      <span class="wa-sr-only">Quit Game</span>
      <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
    `;
    quitBtn.onclick = () => {
      // Exit immediately without confirmation per request
      try { history.back(); } catch { location.reload(); }
    };
    document.body.appendChild(quitBtn);
  }

  function render(){
    if (idx >= rounds.length) return end();
    const r = rounds[idx];
    container.innerHTML = '';
    container.style.cssText = 'padding:20px;max-width:760px;margin:0 auto;font-family:Poppins,Arial,sans-serif;';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;color:#666';
    head.innerHTML = `<div><b>${grammarName || 'Grammar'}</b></div><div>Q ${idx+1}/${rounds.length}</div>`;
    container.appendChild(head);

    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border:3px solid #40D4DE;border-radius:18px;padding:28px;box-shadow:0 6px 14px rgba(64,212,222,.18);margin-bottom:18px;';
    const sentence = (r.type==='good' ? r.en : r.enBad);
    let cardHtml = `<div style="font-size:24px;line-height:1.5;color:#333;text-align:center">${sentence}</div>`;
    // For preposition lists, add Korean translation below
    if (isPrepositionList && r.src && r.src.ko) {
      cardHtml += `<div style="font-size:16px;line-height:1.5;color:#999;text-align:center;margin-top:12px;">${r.src.ko}</div>`;
    }
    card.innerHTML = cardHtml;
    container.appendChild(card);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'O'; okBtn.setAttribute('aria-label','Correct sentence');
    okBtn.style.cssText = baseBtn('#21b5c0');
    const xBtn = document.createElement('button');
    xBtn.textContent = 'X'; xBtn.setAttribute('aria-label','Wrong sentence');
    xBtn.style.cssText = baseBtn('#ff6b6b');
    btnRow.appendChild(okBtn); btnRow.appendChild(xBtn);
    container.appendChild(btnRow);

    const decide = (choice) => {
      const isCorrect = (r.type==='good' && choice==='O') || (r.type==='bad' && choice==='X');
      if (isCorrect) { correct++; playSFX('correct'); } else { wrong++; playSFX('wrong'); }
      reveal(r, isCorrect);
      logAttempt({ session_id: sessionId, mode: MODE, word: r.src?.word || `s${idx}`, is_correct: isCorrect, answer: choice, correct_answer: r.type==='good'?'O':'X', extra:{ type:r.type } });
    };
    okBtn.onclick = () => decide('O');
    xBtn.onclick = () => decide('X');
  }

  function baseBtn(color){
    return `background:#fff;border:3px solid ${color};color:${color};font-weight:800;padding:14px 26px;border-radius:14px;font-size:22px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.06);`;
  }

  function reveal(r, wasRight){
    const controls = container.querySelectorAll('button'); controls.forEach(b=>b.disabled=true);
    const revealBox = document.createElement('div');
    revealBox.style.cssText = 'margin-top:16px;text-align:center';

    if (r.type==='good') {
      revealBox.innerHTML = `<div style="color:#4caf50;font-weight:800;font-size:28px;margin-bottom:10px;">Correct sentence ✔</div>`;
    } else {
      // Build strikeout for wrongToken and animate correctToken over it
      const raw = r.enBad;
      const wrongToken = r.wrongToken || '';
      const safeWrong = wrongToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const badHtml = raw.replace(new RegExp(`\\b${safeWrong}\\b`,'i'), (m)=>`<span class="mistake" style="color:#ff6b6b;font-weight:800;text-decoration:line-through;">${m}</span>`);
      revealBox.innerHTML = `
        <div style="color:#ff6b6b;font-weight:700;margin-bottom:8px;">There is a mistake ✖</div>
        <div style="font-size:22px;line-height:1.6;color:#333;margin-bottom:10px;">${badHtml}</div>
        <div id="fixLine" style="position:relative;min-height:80px;width:100%;max-width:760px;margin:0 auto;padding:0 8px;">
          <span style="position:absolute;left:50%;transform:translateX(-50%);background:#e8f5e9;color:#2e7d32;border:2px solid #2e7d32;padding:12px 20px;border-radius:12px;font-weight:800;font-size:22px;width:100%;box-sizing:border-box;text-align:center;line-height:1.4;word-wrap:break-word;">${r.enCorrect}</span>
        </div>`;
      // simple slide-up animation
      setTimeout(()=>{
        const el = revealBox.querySelector('#fixLine span'); if(!el) return; el.animate([
          { transform:'translate(-50%, 12px)', opacity:.0 },
          { transform:'translate(-50%, 0)', opacity:1 }
        ], { duration:350, easing:'ease-out' });
      }, 50);
    }

    container.appendChild(revealBox);

    // Even larger spacer to push next button further down and avoid overlap
    const spacer = document.createElement('div');
    spacer.style.cssText = 'height:120px;';
    container.appendChild(spacer);

    const next = document.createElement('button');
    next.textContent = (idx < rounds.length-1 ? 'Next' : 'Finish');
    next.style.cssText = baseBtn('#21b5c0') + 'display:block;margin:0 auto;';
    next.onclick = () => { idx++; render(); };
    container.appendChild(next);

    // Add exit button bottom-right (like other modes)
    addExitButton();
  }

  function end(){
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
        grammarFile
      },
      listName: grammarName,
      wordList: rounds.map((r, i) => r.src?.word || `s${i}`),
      meta: { grammarFile, grammarName }
    });

    playSFX('end');

    // Use the shared grammar summary view so this mode matches other grammar modes
    const gameArea = document.getElementById('gameArea');
    renderGrammarSummary({
      gameArea,
      score: correct,
      total: rounds.length,
      ctx: { grammarFile, grammarName }
    });
  }

  render();
}
