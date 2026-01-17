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
  if (path.includes('tense_question')) return 'tense_questions';
  // Will future/questions: sentence-based with "will" patterns
  if (path.includes('will_future')) return 'will_future';
  if (path.includes('will_questions')) return 'will_questions';
  // Modal verbs: have to, want to, like to
  if (path.includes('have_to')) return 'have_to';
  if (path.includes('want_to')) return 'want_to';
  if (path.includes('like_to')) return 'like_to';
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
    const hasDetractors = item && Array.isArray(item.detractors) && item.detractors.length > 0;
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

    // For tense_questions: corrupt question structure
    if (grammarType === 'tense_questions') {
      // Try to corrupt question word order
      const questionMatch = en.match(/^(Did|Does|Do|Will|Is|Are|Am|Was|Were)\s+/i);
      if (questionMatch) {
        // Remove the auxiliary to make it wrong
        const bad = en.replace(questionMatch[0], '');
        return { bad, wrongToken: '(missing auxiliary)', correctToken: questionMatch[1] };
      }
    }

    // Will Future: corrupt "will" sentences
    if (grammarType === 'will_future') {
      const willMatch = en.match(/\bwill\s+(\w+)/i);
      if (willMatch) {
        const verb = willMatch[1];
        const variants = [
          { bad: en.replace(/\bwill\s+\w+/i, `will ${verb}ing`), wrongToken: `will ${verb}ing`, correctToken: willMatch[0] },
          { bad: en.replace(/\bwill\s+\w+/i, `will to ${verb}`), wrongToken: `will to ${verb}`, correctToken: willMatch[0] },
          { bad: en.replace(/\bwill\s+\w+/i, `is going to ${verb}`), wrongToken: `is going to ${verb}`, correctToken: willMatch[0] },
          { bad: en.replace(/\bwill\b/i, 'would'), wrongToken: 'would', correctToken: 'will' }
        ];
        return variants[Math.floor(Math.random() * variants.length)];
      }
    }

    // Will Questions: corrupt question word
    if (grammarType === 'will_questions') {
      const willQMatch = en.match(/^(Will)\s+/i);
      if (willQMatch) {
        const variants = [
          { bad: en.replace(/^Will\s+/i, 'Do '), wrongToken: 'Do', correctToken: 'Will' },
          { bad: en.replace(/^Will\s+/i, 'Does '), wrongToken: 'Does', correctToken: 'Will' },
          { bad: en.replace(/^Will\s+/i, 'Is '), wrongToken: 'Is', correctToken: 'Will' },
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
        // Common errors
        variants.push({ bad: en.replace(/\b(want|wants) to\b/i, 'wanna'), wrongToken: 'wanna', correctToken: correct });
        variants.push({ bad: en.replace(/\b(want|wants) to (\w+)/i, '$1 $2'), wrongToken: '(missing "to")', correctToken: correct });
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
    return { bad: en + '!', wrongToken: '!', correctToken: '' };
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