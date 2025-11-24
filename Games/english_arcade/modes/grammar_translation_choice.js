// Grammar Translation Choice Mode - KO → EN multiple choice focused on auxiliaries/grammar
// Shows Korean prompt; student chooses correct English translation from 3 options
// Distractors target auxiliary/agreement errors (Do/Does/Is/Are/Can)
// IMPORTANT: Option format contract for EVERY list in this mode:
//  - Exactly 3 options per question:
//    1) Correct answer (right meaning + grammatically correct)
//    2) Wrong meaning (grammatically fine, but a different sentence/meaning)
//    3) Grammar-wrong version of the correct answer (same meaning, grammar error)
//  Example: "The cat eats" (correct) | "The dog eats" (wrong meaning) | "The cat eat." (grammar wrong)

import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { openNowLoadingSplash } from './unscramble_splash.js';
// Removed invalid import of StudentLang (file does not exist). Use global with fallback shim.
const StudentLang = (typeof window !== 'undefined' && window.StudentLang) ? window.StudentLang : { applyTranslations(){}, translate(k){ return k; } };
// Add SFX utility import
import { playSFX } from '../sfx.js';
import { renderGrammarSummary } from './grammar_summary.js';

const MODE = 'grammar_translation_choice';

export async function runGrammarTranslationChoiceMode({ grammarFile, grammarName, grammarConfig = {} }) {
  const container = document.getElementById('gameArea');
  if (!container) return;

  // Inject responsive styles (first step) – later layout refactor will apply class usage
  injectTranslationResponsiveStyles();

  container.innerHTML = '<div style="padding:20px;text-align:center;"><p style="font-size:18px;color:#555;">Loading...</p></div>';

  // Show loading splash while fetching data
  let splashController = null;
  try { splashController = openNowLoadingSplash(document.body, { text: (grammarName ? `${grammarName} — now loading` : 'now loading') }); if (splashController && splashController.readyPromise) await splashController.readyPromise; } catch(e){ console.debug('[TranslationChoice] splash failed', e?.message); }

  let grammarData = [];
  try {
    const resp = await fetch(grammarFile);
    if (!resp.ok) throw new Error(`Failed to load ${grammarFile}`);
    grammarData = await resp.json();
  } catch (err) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:#d32f2f;"><p>Error loading grammar data.</p></div>`;
    console.error(err);
    if (splashController && typeof splashController.hide === 'function') try { splashController.hide(); } catch {}
    return;
  }

  // Filter items that have both en and ko
  const validItems = grammarData.filter(item => item && item.en && item.ko);
  if (!validItems.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:#d32f2f;"><p>No translation items available.</p></div>`;
    return;
  }

  // Shuffle and limit to 15
  const shuffled = validItems.sort(() => Math.random() - 0.5);
  const items = shuffled.slice(0, Math.min(15, shuffled.length));

  let currentIndex = 0;
  let correctCount = 0;
  let wrongCount = 0;

  const sessionId = startSession({
    mode: MODE,
    listName: grammarName,
    wordList: items.map(it => it.word || it.id),
    meta: { grammarFile, direction: 'KO→EN', input_type: 'mc' }
  });

  function renderQuestion() {
    if (currentIndex >= items.length) {
      endGame();
      return;
    }

    const item = items[currentIndex];
    const correctEn = item.en.trim();
    const ko = item.ko.trim();
    const emoji = item.emoji || '📖';

    // Generate fixed trio: correct, grammar-wrong, meaning-wrong
    const isSomeAny = /some\s*vs\s*any/i.test(String(grammarName||'')) || /some_vs_any\.json$/i.test(String(grammarFile||''));
    const isThereIsAreList = /there_is_vs_there_are\.json$/i.test(String(grammarFile||'')) || /there\s+is\s+vs\s+there\s+are/i.test(String(grammarName||''));
    const isPresentSimpleNegative = /present_simple_negative\.json$/i.test(String(grammarFile||'')) || /present\s*simple[\s:\-]*negative/i.test(String(grammarName||''));
    const isPresentSimple = /present_simple_sentences\.json$/i.test(String(grammarFile||'')) || (/\bpresent\s*simple\b/i.test(String(grammarName||'')) && !isPresentSimpleNegative);
    // Present Progressive specific variants
    const isPPNegative = /present_progressive_negative\.json$/i.test(String(grammarFile||'')) || /present\s*progressive[\s:\-]*negative/i.test(String(grammarName||''));
    const isPPYesNo = /present_progressive_questions_yesno\.json$/i.test(String(grammarFile||'')) || /present\s*progressive.*yes\s*\/\s*no/i.test(String(grammarName||''));
    const isPPWh = /present_progressive_questions_wh\.json$/i.test(String(grammarFile||'')) || /present\s*progressive[\s:\-]*wh/i.test(String(grammarName||''));
    const isPresentProgressive = (!isPPNegative && !isPPYesNo && !isPPWh) && ( /present_progressive\.json$/i.test(String(grammarFile||'')) || /present\s*progressive/i.test(String(grammarName||'')) );
    // Preposition lists
    const isPrepositionList = /prepositions_/i.test(String(grammarFile||'')) || /prepositions_/i.test(String(grammarName||''));
  // WH micro list (who/what) and generic WH present simple question detection
  const isWhoWhatMicro = /wh_who_what\.json$/i.test(String(grammarFile||''));
  const isPresentSimpleWh = /present_simple_questions_wh\.json$/i.test(String(grammarFile||'')) || /present\s*simple[\s:\-]*wh/i.test(String(grammarName||''));

    const pool = validItems.filter(v => v.en && v.en !== correctEn);

    let grammarWrong;
    let meaningWrong;

    if (isThereIsAreList) {
      ({ grammarWrong, meaningWrong } = buildThereIsAreOptions(correctEn, pool));
    } else if (isPresentSimpleNegative) {
      ({ grammarWrong, meaningWrong } = buildPresentSimpleNegativeOptions(correctEn, pool));
    } else if (isPresentSimple) {
      ({ grammarWrong, meaningWrong } = buildPresentSimpleOptions(correctEn, pool));
    } else if (isPPNegative) {
      ({ grammarWrong, meaningWrong } = buildPresentProgressiveNegativeOptions(correctEn, pool));
    } else if (isPPYesNo) {
      ({ grammarWrong, meaningWrong } = buildPresentProgressiveYesNoOptions(correctEn, pool));
    } else if (isPPWh) {
      ({ grammarWrong, meaningWrong } = buildPresentProgressiveWhOptions(correctEn, pool));
    } else if (isWhoWhatMicro || isPresentSimpleWh) {
      ({ grammarWrong, meaningWrong } = buildWhQuestionOptions(correctEn, pool));
    } else if (isPresentProgressive) {
      ({ grammarWrong, meaningWrong } = buildPresentProgressiveOptions(correctEn, pool));
    } else if (isPrepositionList) {
      ({ grammarWrong, meaningWrong } = buildPrepositionOptions(correctEn, pool));
    } else if (isSomeAny) {
      // Some/Any keeps specialized distractors but we still treat them as grammar vs meaning
      const sa = generateSomeAnyDistractors(correctEn, pool);
      grammarWrong = sa[0] || correctEn;
      meaningWrong = sa[1] || (pool[0]?.en || correctEn);
    } else {
      ({ grammarWrong, meaningWrong } = buildGenericTranslationOptions(correctEn, pool));
    }

    const options = [correctEn, grammarWrong, meaningWrong]
      .filter((v, idx, arr) => typeof v === 'string' && v && arr.indexOf(v) === idx)
      .slice(0, 3);

    while (options.length < 3 && pool.length) {
      const candidate = pool.shift().en;
      if (candidate && !options.includes(candidate)) options.push(candidate);
    }

    const shuffledOptions = options.sort(() => Math.random() - 0.5);

    container.innerHTML = '';
    container.classList.add('translation-mode-root');

    // Header
    const header = document.createElement('div');
    header.className = 'translation-header';
    header.innerHTML = `
      <div class="score">
        <span style="color:#21b5c0;">${correctCount}</span> / 
        <span style="color:#ff5252;">${wrongCount}</span>
      </div>
      <div class="progress">Question ${currentIndex + 1} of ${items.length}</div>
      <button id="translationExitBtn" type="button" aria-label="Exit" title="Exit" style="margin-left:auto;margin-right:0;padding:8px 14px;border-radius:12px;border:2px solid #21b5c0;background:#fff;color:#21b5c0;font-weight:800;cursor:pointer;">
        Exit
      </button>
    `;
    container.appendChild(header);
    // Wire Exit button to go back to menu/selector
    const exitBtn = header.querySelector('#translationExitBtn');
    if (exitBtn) {
      exitBtn.addEventListener('mouseenter', () => { exitBtn.style.background = '#e6fbfd'; });
      exitBtn.addEventListener('mouseleave', () => { exitBtn.style.background = '#fff'; });
      exitBtn.addEventListener('click', () => {
        try {
          if (window.WordArcade && typeof window.WordArcade.startGrammarModeSelector === 'function') {
            window.WordArcade.startGrammarModeSelector();
          } else if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
            window.WordArcade.quitToOpening(true);
          } else {
            window.history.back();
          }
        } catch {
          location.reload();
        }
      });
    }

    // Korean prompt card
    const promptEl = document.createElement('div');
    promptEl.className = 'translation-prompt';
    promptEl.innerHTML = `
      <div class="emoji">${emoji}</div>
      <div class="ko-text">${ko}</div>
    `;
    container.appendChild(promptEl);

    // Fallback compression for extremely long Korean text (post insertion)
    const koTextEl = promptEl.querySelector('.ko-text');
    if (koTextEl) {
      const chars = ko.length;
      if (chars > 40) {
        koTextEl.style.fontSize = 'clamp(16px,4.8vw,22px)';
        koTextEl.style.lineHeight = '1.25';
      } else if (chars > 28) {
        koTextEl.style.fontSize = 'clamp(18px,5.2vw,24px)';
      }
    }

    // Instructions
    const instructions = document.createElement('div');
    instructions.className = 'translation-instructions';
    instructions.textContent = 'Choose the correct English translation:';
    instructions.setAttribute('data-translate-key', 'grammar_translation_choice_instruction');
    container.appendChild(instructions);

    // Options grid
    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'translation-options';

  shuffledOptions.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
  btn.className = 'option-btn';
      btn.textContent = opt;
      
      btn.addEventListener('mouseenter', () => {
        if (!btn.disabled) {
          btn.style.borderColor = '#40D4DE';
          btn.style.boxShadow = '0 4px 12px rgba(64,212,222,0.2)';
          btn.style.transform = 'translateY(-2px)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (!btn.disabled) {
          btn.style.borderColor = '#ddd';
          btn.style.boxShadow = 'none';
          btn.style.transform = 'translateY(0)';
        }
      });

  btn.addEventListener('click', () => handleAnswer(opt, correctEn, btn, optionsGrid));
      optionsGrid.appendChild(btn);
    });

    container.appendChild(optionsGrid);

    // Apply translations
    try { StudentLang.applyTranslations(); } catch {}
  }

  function handleAnswer(selected, correct, btn, optionsGrid) {
    const isCorrect = selected === correct;
    const item = items[currentIndex];

    // Disable all buttons
    Array.from(optionsGrid.children).forEach(b => b.disabled = true);

    // Visual feedback
    if (isCorrect) {
      btn.style.borderColor = '#4caf50';
      btn.style.background = '#e8f5e9';
      correctCount++;
      try { playSFX('correct'); } catch {}
    } else {
      btn.style.borderColor = '#f44336';
      btn.style.background = '#ffebee';
      wrongCount++;
      // Highlight correct answer
      Array.from(optionsGrid.children).forEach(b => {
        if (b.textContent === correct) {
          b.style.borderColor = '#4caf50';
          b.style.background = '#e8f5e9';
        }
      });
      try { playSFX('wrong'); } catch {}
    }

    // Log attempt
    logAttempt({
      session_id: sessionId,
      mode: MODE,
      word: item.word || item.id,
      is_correct: isCorrect,
      answer: selected,
      correct_answer: correct,
      extra: {
        direction: 'KO→EN',
        input_type: 'mc',
        korean_prompt: item.ko,
        distractor_count: 2
      }
    });

    // Next button
    setTimeout(() => {
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'translation-next-btn';
      nextBtn.textContent = currentIndex < items.length - 1 ? 'Next Question' : 'Finish';
      nextBtn.setAttribute('data-translate-key', currentIndex < items.length - 1 ? 'next_question' : 'finish');
      nextBtn.addEventListener('mouseenter', () => nextBtn.style.background = '#1a9ba5');
      nextBtn.addEventListener('mouseleave', () => nextBtn.style.background = '#21b5c0');
      nextBtn.addEventListener('click', () => {
        currentIndex++;
        renderQuestion();
      });
      container.appendChild(nextBtn);
      try { StudentLang.applyTranslations(); } catch {}
    }, 600);
  }

  function endGame() {
    const totalAttempts = correctCount + wrongCount;
    const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

    endSession(sessionId, {
      mode: MODE,
      summary: { correct: correctCount, wrong: wrongCount, total: items.length, accuracy, grammarName, grammarFile },
      listName: grammarName,
      wordList: items.map(it => it.word || it.id),
      meta: { grammarFile, grammarName, direction: 'KO→EN' }
    });

    try { playSFX('end'); } catch {}

    // Use shared grammar summary helper for unified Session Complete UI
    renderGrammarSummary({
      gameArea: container,
      score: correctCount,
      total: items.length,
      ctx: {}
    });
  }

  renderQuestion();
  try { if (splashController && typeof splashController.hide === 'function') setTimeout(()=>{ try{ splashController.hide(); }catch{} }, 520); } catch(e){}
}

// Injects a responsive CSS block for translation mode (viewport-based clamps for small phone heights)
function injectTranslationResponsiveStyles(){
  if (typeof document === 'undefined') return;
  if (document.getElementById('translation-mode-responsive-styles')) return;
  const style = document.createElement('style');
  style.id = 'translation-mode-responsive-styles';
  style.textContent = `
    /* Translation Mode Responsive Styles */
    .translation-mode-root{display:flex;flex-direction:column;min-height:100vh;padding:clamp(12px,3vh,24px) clamp(12px,4vw,28px);box-sizing:border-box;}
  .translation-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:clamp(12px,4vh,24px);font-family:Poppins,Arial,sans-serif;}
    .translation-header .score{font-size:clamp(14px,2.4vw,18px);font-weight:600;color:#555;}
    .translation-header .progress{font-size:clamp(12px,2.2vw,16px);color:#888;}
    .translation-prompt{background:#fff;border:3px solid #40D4DE;border-radius:20px;padding:clamp(18px,5vh,32px) clamp(16px,4vw,24px);text-align:center;margin-bottom:clamp(16px,4.5vh,28px);box-shadow:0 4px 12px rgba(64,212,222,0.15);}    
    .translation-prompt .emoji{font-size:clamp(36px,9vw,56px);margin-bottom:clamp(8px,1.8vh,14px);}    
    .translation-prompt .ko-text{font-size:clamp(20px,5.5vw,28px);font-weight:600;color:#333;line-height:1.3;word-wrap:break-word;overflow-wrap:anywhere;}
    .translation-instructions{text-align:center;font-size:clamp(13px,2.6vw,16px);color:#666;margin-bottom:clamp(12px,2.8vh,20px);font-weight:500;}
    .translation-options{display:flex;flex-direction:column;gap:clamp(10px,2.4vh,14px);margin-bottom:clamp(14px,3.2vh,20px);}    
    .translation-options .option-btn{background:#fff;border:3px solid #ddd;border-radius:16px;padding:clamp(10px,2.2vh,18px) clamp(14px,4vw,20px);font-size:clamp(15px,3.8vw,19px);font-weight:600;color:#333;cursor:pointer;transition:all 0.2s ease;text-align:left;font-family:inherit;line-height:1.3;min-height:clamp(44px,8vh,72px);}    
    .translation-next-btn{width:100%;padding:clamp(12px,2.8vh,16px);background:#21b5c0;color:#fff;border:none;border-radius:14px;font-size:clamp(16px,4.2vw,18px);font-weight:700;cursor:pointer;margin-top:clamp(6px,1.6vh,10px);font-family:inherit;transition:background .2s ease;}    
    .translation-result-card{background:#fff;border:3px solid #40D4DE;border-radius:24px;padding:clamp(28px,6vh,40px) clamp(20px,5vw,24px);box-shadow:0 8px 24px rgba(64,212,222,0.2);}    
    .translation-result-card .final-emoji{font-size:clamp(48px,11vw,64px);margin-bottom:clamp(12px,2.4vh,16px);}    
    .translation-result-card .final-title{font-size:clamp(22px,6vw,28px);font-weight:700;color:#21b5c0;margin-bottom:clamp(16px,3vh,24px);}    
    .translation-result-grid{display:flex;justify-content:center;gap:clamp(16px,5vw,32px);margin-bottom:clamp(12px,2.8vh,20px);flex-wrap:wrap;}    
    .translation-result-grid .result-block{min-width:80px;text-align:center;}    
    .translation-result-grid .result-value{font-size:clamp(28px,8vw,40px);font-weight:800;}    
    .translation-result-grid .result-label{font-size:clamp(12px,3.4vw,14px);color:#666;font-weight:600;}    
    .translation-back-btn{width:100%;max-width:320px;padding:clamp(12px,3vh,16px);background:#21b5c0;color:#fff;border:none;border-radius:14px;font-size:clamp(16px,4.2vw,18px);font-weight:700;cursor:pointer;margin-top:clamp(14px,3vh,20px);font-family:inherit;transition:background .2s ease;}    
    /* Height-specific compressions */
    @media (max-height:700px){
      .translation-prompt{margin-bottom:clamp(12px,3vh,20px);}    
      .translation-options{gap:clamp(8px,2vh,12px);}    
      .translation-options .option-btn{min-height:clamp(40px,7.5vh,64px);}    
    }
    @media (max-height:640px){
      .translation-mode-root{padding:10px 14px;}    
      .translation-prompt{padding:clamp(14px,4vh,24px) 18px;}    
      .translation-options .option-btn{padding:clamp(8px,1.8vh,12px) 14px;font-size:clamp(14px,3.6vw,17px);}    
      .translation-header{margin-bottom:clamp(8px,2.4vh,14px);}    
    }
  `;
  document.head.appendChild(style);
}

// Build generic grammar-wrong and meaning-wrong options for a correct sentence
function buildGenericTranslationOptions(correctEn, pool){
  const grammarDistractors = generateDistractors(correctEn, pool.slice());
  const grammarWrong = grammarDistractors[0] || correctEn;

  let meaningWrong = null;
  if (pool && pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    meaningWrong = pick?.en || null;
  }

  if (!meaningWrong) {
    // Fallback: swap subject with a different one from pool if pattern matches
    const m = correctEn.match(/^(There\s+(?:is|are)\s+)(.+)$/i);
    if (m && pool.length) {
      const other = pool.find(p => p.en && p.en !== correctEn);
      if (other) {
        const om = other.en.match(/^(There\s+(?:is|are)\s+)(.+)$/i);
        if (om) meaningWrong = m[1] + om[2];
      }
    }
  }

  if (!meaningWrong) meaningWrong = grammarDistractors[1] || grammarWrong;

  return { grammarWrong, meaningWrong };
}

// Specialized trio builder for There is/There are lists
function buildThereIsAreOptions(correctEn, pool){
  // Grammar-wrong: flip is/are while keeping noun phrase
  let grammarWrong = correctEn;
  const low = correctEn.toLowerCase();
  if (/^there\s+is\b/.test(low)) {
    grammarWrong = correctEn.replace(/^(there\s+)is\b/i, '$1are');
  } else if (/^there\s+are\b/.test(low)) {
    grammarWrong = correctEn.replace(/^(there\s+)are\b/i, '$1is');
  }

  // Meaning-wrong: swap in a different noun phrase from pool but keep correct auxiliary
  let meaningWrong = null;
  const baseMatch = correctEn.match(/^(there\s+(?:is|are)\s+)(.+)$/i);
  if (baseMatch) {
    const auxPart = baseMatch[1];
    const other = (pool || []).find(p => p.en && /^there\s+(?:is|are)\s+/i.test(p.en) && p.en !== correctEn);
    if (other) {
      const otherMatch = other.en.match(/^(there\s+(?:is|are)\s+)(.+)$/i);
      if (otherMatch) {
        meaningWrong = auxPart + otherMatch[2];
      }
    }
  }

  if (!meaningWrong && pool && pool.length) {
    meaningWrong = pool[0].en;
  }

  return { grammarWrong, meaningWrong };
}

// Generate 2 grammar-focused distractors
function generateDistractors(correctEn, pool) {
  const distractors = [];
  
  // Parse the correct sentence to identify auxiliary and structure
  const auxMatch = correctEn.match(/^(Do|Does|Is|Are|Can|Could|Will|Would|Should)\s+/i);
  const aux = auxMatch ? auxMatch[1].toLowerCase() : null;
  
  // Extract subject and rest
  let subject = '';
  let rest = '';
  if (aux) {
    const afterAux = correctEn.slice(auxMatch[0].length);
    const parts = afterAux.match(/^(\S+)\s+(.+)$/);
    if (parts) {
      subject = parts[1];
      rest = parts[2];
    }
  }

  // Distractor 1: Wrong auxiliary for same subject
  if (aux && subject && rest) {
    let wrongAux = aux;
    
    if (aux === 'can' || aux === 'could') {
      // Can → Do/Does (wrong structure)
      wrongAux = ['he', 'she', 'it'].includes(subject.toLowerCase()) ? 'Does' : 'Do';
    } else if (aux === 'do' || aux === 'does') {
      // Swap Do ↔ Does (agreement error)
      wrongAux = aux === 'do' ? 'Does' : 'Do';
    } else if (aux === 'is' || aux === 'are') {
      // Swap Is ↔ Are (agreement error)
      wrongAux = aux === 'is' ? 'Are' : 'Is';
    }
    
    if (wrongAux !== aux) {
      distractors.push(`${wrongAux.charAt(0).toUpperCase() + wrongAux.slice(1)} ${subject} ${rest}`);
    }
  }

  // Distractor 2: Different auxiliary type (meaning shift)
  if (aux && subject && rest) {
    let altAux = aux;
    
    if (aux === 'can' || aux === 'could') {
      // Can → Does (structure error)
      altAux = ['he', 'she', 'it'].includes(subject.toLowerCase()) ? 'Does' : 'Do';
    } else if (aux === 'do' || aux === 'does') {
      // Do/Does → Can (meaning shift)
      altAux = 'Can';
    } else if (aux === 'is' || aux === 'are') {
      // Is/Are → Does/Do (structure error)
      altAux = ['he', 'she', 'it'].includes(subject.toLowerCase()) ? 'Does' : 'Do';
    }
    
    if (altAux !== aux && !distractors.some(d => d.startsWith(altAux))) {
      distractors.push(`${altAux.charAt(0).toUpperCase() + altAux.slice(1)} ${subject} ${rest}`);
    }
  }

  // If we still need distractors, add a verb-agreement error variant
  if (distractors.length < 2 && aux && subject && rest) {
    // Add -s error: "Does he likes" or remove -s: "Do he like"
    if (aux === 'does' || aux === 'do') {
      const verb = rest.split(' ')[0];
      let wrongVerb = verb;
      
      if (verb.endsWith('s') && verb.length > 1) {
        // Remove -s
        wrongVerb = verb.slice(0, -1);
      } else {
        // Add -s
        wrongVerb = verb + 's';
      }
      
      const newRest = rest.replace(verb, wrongVerb);
      const wrongAuxForThis = aux === 'do' ? 'Does' : 'Do';
      distractors.push(`${wrongAuxForThis} ${subject} ${newRest}`);
    }
  }

  // Fallback: pull random sentences from pool if still short
  while (distractors.length < 2 && pool.length > 0) {
    const randomIdx = Math.floor(Math.random() * pool.length);
    const randomSentence = pool[randomIdx].en;
    pool.splice(randomIdx, 1);
    
    if (!distractors.includes(randomSentence) && randomSentence !== correctEn) {
      distractors.push(randomSentence);
    }
  }

  // Ensure exactly 2 distractors
  return distractors.slice(0, 2);
}

// Specialized distractors for Some vs Any: keep sentences very similar
function generateSomeAnyDistractors(correctEn, pool){
  const outs = [];

  // 1) Determiner flip (any <-> some) while preserving capitalization
  const hasAny = /\bany\b/i.test(correctEn);
  const hasSome = /\bsome\b/i.test(correctEn);
  if (hasAny || hasSome) {
    const repl = (m) => (m[0] === m[0].toUpperCase() ? (m.toLowerCase() === 'any' ? 'Some' : 'Any') : (m.toLowerCase() === 'any' ? 'some' : 'any'));
    const wrong = correctEn.replace(/\b(any|some)\b/i, repl);
    if (wrong !== correctEn) outs.push(wrong);
  }

  // 2) Minimal lexical variation: replace the noun after any/some (or the last content word) with one from pool
  const nounFrom = (s) => {
    // Prefer noun right after any/some
    const m = s.match(/\b(any|some)\b\s+([a-zA-Z']+)/i);
    if (m) return (m[2]||'').replace(/[.,!?;:]+$/,'');
    // Else take last word before punctuation
    const parts = String(s).trim().split(/\s+/);
    if (!parts.length) return '';
    return parts[parts.length-1].replace(/[.,!?;:]+$/,'');
  };
  const baseNoun = nounFrom(correctEn);
  let candidateNoun = '';
  const poolNouns = pool.map(p => nounFrom(p.en)).filter(w => w && w.toLowerCase() !== baseNoun.toLowerCase());
  if (poolNouns.length) candidateNoun = poolNouns[Math.floor(Math.random()*poolNouns.length)];

  if (candidateNoun) {
    let wrong2 = correctEn;
    if (hasAny || hasSome) {
      wrong2 = correctEn.replace(/\b(any|some)\b\s+([a-zA-Z']+)/i, (full, det, n) => `${det} ${candidateNoun}`);
    } else {
      // fallback: replace last content word
      wrong2 = correctEn.replace(/([A-Za-z']+)([.,!?;:]*)\s*$/, (full, w, punc) => `${candidateNoun}${punc}`);
    }
    if (wrong2 !== correctEn && !outs.includes(wrong2)) outs.push(wrong2);
  }

  // Fallbacks if still short: reuse generic
  if (outs.length < 2) {
    const gen = generateDistractors(correctEn, pool.slice());
    gen.forEach(g => { if (outs.length < 2 && !outs.includes(g) && g !== correctEn) outs.push(g); });
  }

  return outs.slice(0,2);
}

// Trio builder for Present Simple sentences (affirmatives):
// Grammar-wrong toggles 3rd person agreement (-s) on the verb while keeping subject/rest.
// Meaning-wrong picks a different sentence from the pool.
function buildPresentSimpleOptions(correctEn, pool){
  const tokens = String(correctEn || '').split(/\s+/);
  if (tokens.length < 2) return { grammarWrong: correctEn, meaningWrong: pool[0]?.en || correctEn };
  const lower = tokens.map(t => t.toLowerCase());
  let subjIdx = 0;
  if (lower[0] === 'the' && tokens.length >= 3) subjIdx = 1;
  let verbIdx = subjIdx + 1;
  if (verbIdx >= tokens.length) verbIdx = 1;
  const origVerb = tokens[verbIdx] || '';
  const bare = origVerb.replace(/[.,!?;:]+$/g, '');
  const punct = origVerb.slice(bare.length);
  const makeForms = (v) => {
    if (!v) return [v, v];
    if (/ies$/i.test(v) && !/[aeiou]ies$/i.test(v)) { const base = v.replace(/ies$/i,'y'); return [base, v]; }
    if (/(ches|shes|sses|xes|zes)$/i.test(v)) { const base = v.replace(/es$/i,''); return [base, v]; }
    if (/s$/i.test(v) && !/ss$/i.test(v)) { const base = v.replace(/s$/i,''); return [base, v]; }
    if (/(ch|sh|s|x|z)$/i.test(v)) return [v, v + 's'.replace('s','es')];
    if (/y$/i.test(v) && !/[aeiou]y$/i.test(v)) return [v, v.replace(/y$/i,'ies')];
    return [v, v + 's'];
  };
  const [baseForm, sForm] = makeForms(bare);
  const correctUsesS = new RegExp(`^${bare.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}$`,`i`).test(sForm);
  // Decide grammar-wrong by toggling form
  const wrongVerb = (bare === sForm) ? baseForm : sForm;
  const badTokens = tokens.slice();
  badTokens[verbIdx] = (wrongVerb || bare) + punct;
  const grammarWrong = badTokens.join(' ');
  const meaningWrong = (pool && pool.length) ? (pool.find(p => p.en && p.en !== correctEn)?.en || pool[0].en) : correctEn;
  return { grammarWrong, meaningWrong };
}

// Trio builder for Present Simple negative: grammar-wrong flips don't/doesn't; meaning-wrong from pool.
function buildPresentSimpleNegativeOptions(correctEn, pool){
  const rxDoesnt = /\bdoesn['’]?t\b/i;
  const rxDont = /\bdon['’]?t\b/i;
  let grammarWrong = correctEn;
  if (rxDoesnt.test(correctEn)) {
    grammarWrong = correctEn.replace(rxDoesnt, (m)=> (m[0]===m[0].toUpperCase()?"Don't":"don't"));
  } else if (rxDont.test(correctEn)) {
    grammarWrong = correctEn.replace(rxDont, (m)=> (m[0]===m[0].toUpperCase()?"Doesn't":"doesn't"));
  }
  const meaningWrong = (pool && pool.length) ? (pool.find(p => p.en && p.en !== correctEn)?.en || pool[0].en) : correctEn;
  return { grammarWrong, meaningWrong };
}

// Trio builder for Present Progressive sentences:
// Grammar-wrong: break BE+V-ing agreement (wrong BE or base verb) while
// keeping the rest of the verb phrase intact.
// Meaning-wrong: keep BE+V-ing skeleton but swap in a different main verb
// phrase from pool.
function buildPresentProgressiveOptions(correctEn, pool){
  const text = String(correctEn || '');
  // Match subject + BE + V-ing, allowing optional pronouns/articles
  const bePattern = /(\b(?:I|You|He|She|It|We|They|The\s+\w+|[A-Z][a-z]+)\b\s+)(am|is|are)\s+([^.,!?;:]*)?\b([a-zA-Z]+ing\b[^.,!?;:]*)/i;
  const m = text.match(bePattern);

  let grammarWrong = correctEn;
  if (m) {
    const prefix = m[1];
    const be = m[2];
    const mid = (m[3] || '').trim(); // any words between BE and V-ing
    const verbIng = m[4];

    const subj = prefix.trim().toLowerCase();
    let correctBe = be.toLowerCase();
    if (subj === 'i') correctBe = 'am';
    else if (['he','she','it'].includes(subj)) correctBe = 'is';
    else correctBe = 'are';

    const wrongBe = correctBe === 'am' ? 'are' : (correctBe === 'is' ? 'are' : 'is');

    const beLower = be.toLowerCase();
    const beCorrectPart = prefix + correctBe; // keep original casing from prefix only
    const beWrongPart = prefix + wrongBe;

    // Keep full verb phrase (including object/adverbial) after BE
    const afterBe = mid ? `${mid} ${verbIng}` : verbIng;
    const baseVerb = verbIng.replace(/ing\b/, '');
    const basePhrase = mid ? `${mid} ${baseVerb}` : baseVerb;

    const patterns = [
      beWrongPart + ' ' + afterBe,   // wrong BE + same V-ing phrase
      beCorrectPart + ' ' + basePhrase, // correct BE + base verb phrase
      beWrongPart + ' ' + basePhrase    // wrong BE + base verb phrase
    ];

    const pick = patterns[Math.floor(Math.random()*patterns.length)];
    const bePart = prefix + beLower;
    grammarWrong = text.replace(new RegExp(bePart + '\\s+' + escapeReg( (mid ? mid + ' ' : '') + verbIng )), pick);
  }

  // Meaning-wrong: keep BE, swap in a different V-ing phrase from another progressive sentence
  let meaningWrong = null;
  if (m) {
    const bePart = m[1] + m[2] + ' ';
    const others = (pool || []).map(p => String(p.en || '')).filter(s => s && s !== correctEn);
    const otherMatch = others.map(s => ({s, match: s.match(/\b(am|is|are)\s+([a-zA-Z]+ing\b[^.,!?;:]*)/i)}))
      .find(o => o.match);
    if (otherMatch && otherMatch.match) {
      const newVerbPhrase = otherMatch.match[2];
      meaningWrong = text.replace(bePart + m[3], bePart + newVerbPhrase);
    }
  }

  if (!meaningWrong && pool && pool.length) {
    meaningWrong = pool[0].en;
  }

  return { grammarWrong, meaningWrong };
}

// Escape for dynamic RegExp pieces
function escapeReg(str){
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Trio builder: Present Progressive NEGATIVE
// Grammar-wrong: swap BE within the negative chunk (am not/isn't/aren't) to an incorrect form
// Meaning-wrong: keep the negative chunk (subject + BE + not) but swap the V-ing phrase
function buildPresentProgressiveNegativeOptions(correctEn, pool) {
  const text = String(correctEn || '');
  const rx = /(\bI\b|\bYou\b|\bHe\b|\bShe\b|\bIt\b|\bWe\b|\bThey\b|The\s+\w+|[A-Z][a-z]+)\s+(am\s+not|is\s+not|are\s+not|isn['’]?t|aren['’]?t)\s+([^?.!]+?ing(?:[^?.!]*))(?=[?.!]|$)/i;
  const m = text.match(rx);
  let grammarWrong = correctEn;
  let meaningWrong = null;
  if (m) {
    const subj = m[1];
    const negChunk = m[2];
    const vIngPhrase = m[3];
    const subjLow = subj.toLowerCase();
    const wrongBe = (subjLow === 'i') ? 'is not' : (/^(he|she|it)$/i.test(subjLow) ? "aren't" : "isn't");
    // Preserve contraction style: if original used contraction, keep contraction in wrong too when possible
    const usedContraction = /n['’]?t/i.test(negChunk);
    let wrongNeg = wrongBe;
    if (usedContraction) {
      if (/is\s+not/i.test(wrongBe)) wrongNeg = "isn't";
      if (/are\s+not/i.test(wrongBe)) wrongNeg = "aren't";
    }
    grammarWrong = text.replace(negChunk, (m0) => {
      // maintain capitalization if negChunk was capitalized
      const cap = /^[A-Z]/.test(m0);
      const out = wrongNeg;
      return cap ? out.charAt(0).toUpperCase() + out.slice(1) : out;
    });

    // Meaning-wrong: find another progressive v-ing phrase from pool and swap only the v-ing portion
    const other = (pool || []).map(p => p.en).find(s => /\b(am|is|are)\s+[^?.!]*?ing\b/i.test(String(s||'')));
    if (other) {
      const om = String(other).match(/\b(am|is|are)\s+([^?.!]*?ing\b[^?.!]*)/i);
      if (om) {
        const newVP = om[2];
        meaningWrong = text.replace(vIngPhrase, newVP);
      }
    }
  }
  if (!meaningWrong && pool && pool.length) meaningWrong = pool[0].en;
  return { grammarWrong, meaningWrong };
}

// Trio builder: Present Progressive Yes/No Questions
// Grammar-wrong: wrong BE for subject (e.g., "Are he ...?", "Is they ...?", "Is I ...?")
// Meaning-wrong: keep BE + subject, swap V-ing phrase from pool
function buildPresentProgressiveYesNoOptions(correctEn, pool) {
  const text = String(correctEn || '');
  // Pattern: BE + subject + ...V-ing... ?
  const rx = /^(Am|Is|Are)\s+([A-Za-z]+)(?:\s+([^?.!]*?))?\s+([A-Za-z]+ing\b[^?.!]*)([?.!])?$/i;
  const m = text.match(rx);
  let grammarWrong = correctEn;
  let meaningWrong = null;
  if (m) {
    const be = m[1];
    const subj = m[2];
    const mid = (m[3] || '').trim();
    const vIng = m[4];
    const punct = m[5] || '?';
    const subjLow = subj.toLowerCase();
    let wrongBe = 'is';
    if (subjLow === 'i') wrongBe = 'is';
    else if (/(he|she|it)/i.test(subjLow)) wrongBe = 'are';
    else wrongBe = 'is'; // for you/we/they → wrong is
    const wrongOut = /[A-Z]/.test(be[0]) ? wrongBe.charAt(0).toUpperCase() + wrongBe.slice(1) : wrongBe;
    const rest = (mid ? mid + ' ' : '') + vIng + (punct || '');
    grammarWrong = `${wrongOut} ${subj} ${rest}`;

    const other = (pool || []).map(p => p.en).find(s => /^(Am|Is|Are)\s+\S+\s+[^?.!]*ing\b/i.test(String(s||'')));
    if (other) {
      const om = String(other).match(/^(Am|Is|Are)\s+\S+\s+([^?.!]*ing\b[^?.!]*)/i);
      if (om) {
        const newVP = om[2];
        meaningWrong = `${be} ${subj} ${mid ? mid + ' ' : ''}${newVP}${punct}`;
      }
    }
  }
  if (!meaningWrong && pool && pool.length) meaningWrong = pool[0].en;
  return { grammarWrong, meaningWrong };
}

// Trio builder: Present Progressive WH Questions
// Grammar-wrong: flip the BE immediately after the WH word (handles omitted subject)
// Meaning-wrong: keep WH + BE (+ subject) and swap in a different V-ing phrase
function buildPresentProgressiveWhOptions(correctEn, pool) {
  const text = String(correctEn || '');
  // WH + BE + (subject|V-ing) ...
  const rx = /^(Who|What|When|Where|Why|How|Which)\s+(Am|Is|Are|am|is|are)\b\s*([\s\S]*)/;
  const m = text.match(rx);
  let grammarWrong = correctEn;
  let meaningWrong = null;
  if (m) {
    const wh = m[1];
    const be = m[2];
    const tail = (m[3] || '').trim();
    const tokens = tail.split(/\s+/);
    const t0 = (tokens[0]||'').replace(/[^A-Za-z]/g,'').toLowerCase();
    const t1 = (tokens[1]||'').replace(/[^A-Za-z]/g,'').toLowerCase();
    const isI = t0 === 'i';
    const isPluralPron = ['you','we','they'].includes(t0);
    const isThirdPron = ['he','she','it'].includes(t0);
    let isThirdNoun = false, isPluralNoun = false;
    if (t0 === 'the' && t1) { if (/s$/.test(t1) && !/(ss|us)$/i.test(t1)) isPluralNoun = true; else isThirdNoun = true; }
    const whAsSubject = /ing$/i.test(t0); // "Who is singing?"
    const beLower = be.toLowerCase();
    let wrongBe = null;
    if (isI) wrongBe = 'is';
    else if (isPluralPron || isPluralNoun) wrongBe = (beLower === 'are') ? 'is' : 'is';
    else if (isThirdPron || isThirdNoun || whAsSubject) wrongBe = (beLower === 'is') ? 'are' : 'are';
    else wrongBe = (beLower === 'is') ? 'are' : (beLower === 'are' ? 'is' : 'is');
    const wrongOut = /[A-Z]/.test(be[0]) ? wrongBe.charAt(0).toUpperCase() + wrongBe.slice(1) : wrongBe;
    grammarWrong = text.replace(new RegExp(`^(${wh})\\s+(Am|Is|Are|am|is|are)`), `$1 ${wrongOut}`);

    // Meaning-wrong: swap the first V-ing phrase
    const vpMatch = tail.match(/([A-Za-z]+ing\b[^?.!]*)([?.!])?/);
    const other = (pool || []).map(p => p.en).find(s => /\b(am|is|are)\s+[^?.!]*ing\b/i.test(String(s||'')));
    if (vpMatch && other) {
      const om = String(other).match(/\b(am|is|are)\s+([^?.!]*ing\b[^?.!]*)/i);
      if (om) {
        const newVP = om[2];
        meaningWrong = `${wh} ${be} ${tail.replace(vpMatch[1], newVP)}`;
      }
    }
  }
  if (!meaningWrong && pool && pool.length) meaningWrong = pool[0].en;
  return { grammarWrong, meaningWrong };
}

// Trio builder for Preposition lists
// Grammar-wrong: swap the preposition with a different one (keeps same structure, changes meaning)
// Meaning-wrong: pick a different sentence from the pool
function buildPrepositionOptions(correctEn, pool) {
  let grammarWrong = correctEn;
  let meaningWrong = null;

  // Try to swap the preposition with a different one from the pool
  if (pool && pool.length > 0) {
    const allPrepositions = pool.map(p => {
      // Extract the preposition from the sentence - look for word patterns that are prepositions
      // Common prepositions: in, on, under, above, below, between, next to, behind, in front of, near, across from, etc.
      const text = String(p.en || '');
      const prepMatch = text.match(/\b(in|on|under|above|below|between|next to|behind|in front of|near|across from|at|by|through|beside|over)\b/i);
      return prepMatch ? prepMatch[1].toLowerCase() : null;
    }).filter(p => p && p !== extractPreposition(correctEn));

    if (allPrepositions.length > 0) {
      const wrongPrep = allPrepositions[Math.floor(Math.random() * allPrepositions.length)];
      const correctPrep = extractPreposition(correctEn);
      if (wrongPrep && correctPrep) {
        // Replace the preposition in the correct sentence
        const regex = new RegExp(`\\b${correctPrep}\\b`, 'i');
        grammarWrong = correctEn.replace(regex, wrongPrep);
      }
    }
  }

  // Meaning-wrong: pick a different sentence from pool
  if (pool && pool.length > 0) {
    const randomItem = pool[Math.floor(Math.random() * pool.length)];
    meaningWrong = randomItem?.en || null;
  }

  // Fallback if something failed
  if (!meaningWrong && pool && pool.length > 1) {
    const other = pool.find(p => p.en !== correctEn && p.en !== grammarWrong);
    meaningWrong = other?.en || pool[0]?.en;
  }

  return { grammarWrong, meaningWrong };
}

// Helper: extract preposition from a sentence
function extractPreposition(sentence) {
  const text = String(sentence || '');
  const match = text.match(/\b(in|on|under|above|below|between|next to|behind|in front of|near|across from|at|by|through|beside|over)\b/i);
  return match ? match[1].toLowerCase() : null;
}

// Trio builder for WH question lists (Who/What/etc.) including micro who/what list
// Grammar-wrong: swap WH word to a different one or break verb order
// Meaning-wrong: change the object/noun while keeping WH + verb grammar intact
function buildWhQuestionOptions(correctEn, pool){
  const text = String(correctEn || '').trim();
  const whMatch = text.match(/^(Who|What|When|Where|Why|How|Which)\b(.*)$/i);
  if (!whMatch) {
    // Fallback to generic if pattern not matched
    return buildGenericTranslationOptions(correctEn, pool);
  }
  const whWord = whMatch[1];
  const tail = whMatch[2].trim();
  // Attempt to identify verb and object (simple heuristic: WH + verb (+ object)?)
  const tokens = tail.split(/\s+/).filter(t=>t);
  // Find first verb candidate (ends with s or common verbs list)
  const verbIdx = tokens.findIndex(t => /s$/.test(t.toLowerCase()) || /(eat|play|like|love|need|want|watch|study|walk|go|live|make|take|have)s?$/i.test(t));
  let grammarWrong = correctEn;
  if (verbIdx >= 0) {
    // Grammar wrong variant 1: swap WH for a different WH (choose from a pool)
    const whPool = ['Who','What','When','Where','Why','How'];
    const altWh = whPool.find(w => w.toLowerCase() !== whWord.toLowerCase()) || 'How';
    grammarWrong = altWh + ' ' + tokens.join(' ');
    // If grammarWrong equals correct (unlikely), produce wrong order variant: WH + object + verb
    if (grammarWrong.toLowerCase() === correctEn.toLowerCase()) {
      const verb = tokens[verbIdx];
      const objs = tokens.filter((_,i)=>i!==verbIdx);
      if (objs.length) {
        grammarWrong = whWord + ' ' + objs.join(' ') + ' ' + verb;
      }
    }
    if (!/\?$/.test(grammarWrong)) grammarWrong += '?';
  }
  // Meaning wrong: change object noun phrase
  let meaningWrong = null;
  if (verbIdx >= 0) {
    const verb = tokens[verbIdx];
    const objs = tokens.filter((_,i)=>i!==verbIdx);
    if (objs.length) {
      // Replace last object token with another noun sourced from pool sentences
      const nounPool = (pool||[]).map(p => {
        const m = String(p.en||'').match(/\b(Who|What|When|Where|Why|How|Which)\s+(.+)/i);
        if (!m) return null;
        const restTokens = m[2].split(/\s+/);
        const vIdx = restTokens.findIndex(t => /s$/.test(t.toLowerCase()) || /(eat|play|like|love|need|want|watch|study|walk|go|live|make|take|have)s?$/i.test(t));
        if (vIdx >= 0) {
          const candidateObjs = restTokens.filter((_,i)=>i!==vIdx);
          return candidateObjs[candidateObjs.length-1] || null;
        }
        return null;
      }).filter(Boolean);
      const replacement = nounPool.find(n => !objs.includes(n));
      if (replacement) {
        const newObjs = objs.slice();
        newObjs[newObjs.length-1] = replacement;
        meaningWrong = whWord + ' ' + verb + ' ' + newObjs.join(' ');
        if (!/\?$/.test(meaningWrong)) meaningWrong += '?';
      }
    }
  }
  if (!meaningWrong) {
    // Fallback: pick a different WH question from pool as meaning wrong
    const other = (pool||[]).find(p => p.en && p.en !== correctEn);
    meaningWrong = other?.en || grammarWrong;
  }
  return { grammarWrong, meaningWrong };
}
