// Grammar Mode Engine - Article selection (a vs an)
// Works as a choice mode where students pick between "a" or "an" for each word

import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { buildPrepositionScene, isInOnUnderMode } from './grammar_prepositions_data.js';
import { renderGrammarSummary } from './grammar_summary.js';
import { openNowLoadingSplash } from './unscramble_splash.js';

export async function runGrammarMode(ctx) {
  const {
    playTTS, playTTSVariant, preprocessTTS,
    grammarFile, grammarName, grammarConfig,
    renderGameView, showModeModal, playSFX, inlineToast,
    getListName, getUserId, FN
  } = ctx || {};

  const sanitizeText = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Extract subject and blank from prompt (e.g., "I ___ happy." → "I ___")
  const extractSubjectAndBlank = (prompt) => {
    if (!prompt) return '___';
    const text = String(prompt).trim();
    // Look for the first blank
    const blankIndex = text.indexOf('___');
    if (blankIndex === -1) return text;
    // Extract from start to blank, then add the blank
    const beforeBlank = text.substring(0, blankIndex).trim();
    return `${beforeBlank} ___`;
  };

  if (!grammarFile) {
    console.error('[Grammar Mode] No grammar file provided');
    if (inlineToast) inlineToast('Error: No grammar file selected');
    return;
  }
  // Show loading splash while fetching grammar data
  let splashController = null;
  try { splashController = openNowLoadingSplash(document.body, { text: (grammarName ? `${grammarName} — now loading` : 'now loading') }); if (splashController && splashController.readyPromise) await splashController.readyPromise; } catch(e){ console.debug('[GrammarMode] splash failed', e?.message); }

  try {
    // Load grammar data
    const response = await fetch(grammarFile);
    if (!response.ok) throw new Error(`Failed to load ${grammarFile}`);
    const grammarData = await response.json();
    
    if (!Array.isArray(grammarData) || grammarData.length === 0) {
      throw new Error('Invalid grammar data format');
    }

    console.log('[Grammar Mode] Loaded', grammarData.length, 'grammar items');
    // Hide splash now that data is loaded and we can render UI
    try { if (splashController && typeof splashController.hide === 'function') setTimeout(()=>{ try{ splashController.hide(); }catch{} }, 420); } catch(e){}

  // Detect Short Questions JSON by file name (short_questions_1/2)
  const isShortQuestions = /short_questions_1\.json$/i.test(grammarFile || '') || /short_questions_2\.json$/i.test(grammarFile || '');

  // Detect Present Simple Sentences list for special choose-mode UI (subject + verb choice)
  const isPresentSimpleList = /present_simple_sentences\.json$/i.test(grammarFile || '');
  // Detect Present Progressive list for BE (am/is/are) choose mode
  const isPresentProgressive = /present_progressive\.json$/i.test(grammarFile || '') || /present\s*progressive(?!.*(negative|yes\s*\/\s*no|wh))/i.test(grammarName || '');
  // Detect Present Progressive Negative (am not / isn't / aren't)
  const isPresentProgressiveNegative = /present_progressive_negative\.json$/i.test(grammarFile || '') || /present\s*progressive[\s:\-]*negative/i.test(grammarName || '');
  // Detect Present Progressive Yes/No Questions (Am/Is/Are)
  const isPresentProgressiveYesNo = /present_progressive_questions_yesno\.json$/i.test(grammarFile || '') || /present\s*progressive.*yes\s*\/\s*no/i.test(grammarName || '');
  // Detect Present Progressive WH Questions (shares WH-choose UI)
  const isPresentProgressiveWhQuestions = /present_progressive_questions_wh\.json$/i.test(grammarFile || '') || /present\s*progressive[\s:\-]*wh/i.test(grammarName || '');
  // Detect Present Simple Negative list for special choose-mode UI (subject + don't/doesn't)
  const isPresentSimpleNegative = /present_simple_negative\.json$/i.test(grammarFile || '') || /present\s*simple[:\-\s]*negative/i.test(grammarName || '');
  // Detect Present Simple Yes/No Questions for DO/DOES choose mode
  const isPresentSimpleYesNo = /present_simple_questions_yesno\.json$/i.test(grammarFile || '') || /present\s*simple.*yes\s*\/\s*no/i.test(grammarName || '');
  // Detect Present Simple WH Questions list for WH-word choose mode
  const isPresentSimpleWhQuestions = /present_simple_questions_wh\.json$/i.test(grammarFile || '')
    || /present\s*simple[\s:\-]*wh/i.test(grammarName || '')
    || /wh\s*questions?/i.test(grammarName || '');

    // Extract answer choices from config (e.g., ['a', 'an'] or ['it', 'they'])
    const answerChoices = (grammarConfig && grammarConfig.answerChoices && Array.isArray(grammarConfig.answerChoices))
      ? grammarConfig.answerChoices
      : ['a', 'an']; // Default fallback

    // Check if this is a plurals game (answerChoices will indicate singular vs plural)
    const isPluralsMode = grammarConfig && grammarConfig.isPluralMode === true;
    const singularChoice = answerChoices[0]; // First choice should be the singular form
    const pluralChoice = answerChoices[1];   // Second choice should be the plural form

  // Shuffle items for variety and limit to 15 questions per session
  const shuffled = [...grammarData].sort(() => Math.random() - 0.5).slice(0, 15);
  const sessionWords = shuffled.map(it => it.word);
    let currentIdx = 0;
    let score = 0;
    let totalAnswered = 0;
    const sessionStartTime = Date.now();
    let sessionEnded = false;
    let advanceTimer = null;
    const clearAdvanceTimer = () => {
      if (advanceTimer) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
      }
    };
    // Create a proper tracking session (records.js) so backend receives session_start
    const sessionId = (function(){
      try {
        // Use grammarFile path for session tracking to match homework assignment list_key
        const listName = grammarFile || (typeof getListName === 'function' ? getListName() : null) || grammarName || null;
        return startSession({
          mode: 'grammar_mode',
          wordList: sessionWords,
          listName,
          meta: { category: 'grammar', file: grammarFile }
        });
      } catch { return `grammar_${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }
    })();

    // Helpers for rendering directly into the game area (avoid relying on word-mode view contract)
    const gameArea = document.getElementById('gameArea');
    const updateProgressBar = (show, value = 0, max = 0) => {
      const bar = document.getElementById('gameProgressBar');
      const fill = document.getElementById('gameProgressFill');
      const text = document.getElementById('gameProgressText');
      if (!bar || !fill || !text) return;
      bar.style.display = show ? '' : 'none';
      if (show && max > 0) {
        const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
        fill.style.width = pct + '%';
        text.textContent = `${value}/${max}`;
      }
    };

    const setView = ({ content, showProgressBar = false, progressValue = 0, progressMax = 0 }) => {
      if (gameArea) gameArea.innerHTML = content;
      updateProgressBar(showProgressBar, progressValue, progressMax);
    };

    const buildProximityScene = (article, emoji) => {
      const isNear = ['this', 'these'].includes(String(article || '').toLowerCase());
      const personEmoji = '🧍';
      const objectEmoji = emoji || (isNear ? '📘' : '🚌');
      if (isNear) {
        return `
          <div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:360px;margin:0 auto;">
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;font-size:3.6rem;">
              <span style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.12));">${personEmoji}</span>
              <span style="font-size:3.8rem;">${objectEmoji}</span>
            </div>
          </div>
        `;
      }
      return `
        <div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:360px;margin:0 auto;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0 6px;font-size:3.6rem;width:100%;max-width:420px;">
            <span style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.12));transform:translateX(-12px);">${personEmoji}</span>
            <div style="flex:1;height:4px;margin:0 12px;border-radius:999px;background:repeating-linear-gradient(90deg,#21b3be 0,#21b3be 10px,rgba(33,179,190,0) 10px,rgba(33,179,190,0) 26px);opacity:0.45;"></div>
            <span style="font-size:3.9rem;transform:translateX(48px);">${objectEmoji}</span>
          </div>
        </div>
      `;
    };

    // ===========================
    // Core game render function
    // ===========================
    async function renderGrammarQuestion() {
      if (sessionEnded) {
        return;
      }
      if (currentIdx >= shuffled.length) {
        endGrammarSession();
        return;
      }

      const item = shuffled[currentIdx];
      const isLastQuestion = currentIdx === shuffled.length - 1;
      const rawPrompt = item?.prompt || item?.word || '';
      const displayText = sanitizeText(extractSubjectAndBlank(rawPrompt));
      const isSomeAnyMode = Array.isArray(answerChoices) && answerChoices.includes('some') && answerChoices.includes('any');
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
      const promptSafe = rawPrompt ? sanitizeText(rawPrompt) : '';
      const highlightedPrompt = promptSafe ? promptSafe.replace(/___/g, '<span style="color:#21b3be;font-weight:800;">___</span>') : '';
      const promptHasBlank = String(rawPrompt || '').includes('___');
      // Detect There is/are choose modes via answerChoices (case-insensitive)
      const ac = Array.isArray(answerChoices) ? answerChoices : [];
      const acLower = ac.map(s => String(s || '').toLowerCase());
      const isThereStatementsMode = acLower.includes('there is') && acLower.includes('there are');
      const isThereQuestionsMode = (acLower.includes('is there') || acLower.includes('is there')) && (acLower.includes('are there') || acLower.includes('are there'));

      // For Some/Any, show only the prefix before the word "some" or "any"
      const prefixBeforeSomeAny = (text) => {
        const s = String(text || '');
        const m = s.match(/^(.*?)(?:\b(?:some|any)\b)/i);
        return (m ? m[1] : s).trim();
      };

      // Some vs Any helpers
      const enLower = String(item?.en || '').toLowerCase().trim();
      const isThereQuestion = enLower.startsWith('is there') || enLower.startsWith('are there');
      const isHaveQuestion = /^(do|does)\s+\w+\s+have\b/.test(enLower);
      const isNeedQuestion = /^(do|does)\s+\w+\s+need\b/.test(enLower);
      const isQuestion = isThereQuestion || isHaveQuestion || isNeedQuestion;
      const isThereNegative = enLower.startsWith("there isn't") || enLower.startsWith("there aren't");
      const isHaveNegative = /\b(don't|doesn't)\s+have\b/.test(enLower);
      const isNeedNegative = /\b(don't|doesn't)\s+need\b/.test(enLower);
      const isNegative = isThereNegative || isHaveNegative || isNeedNegative;
      const isAffirmative = !isQuestion && !isNegative && (
        enLower.startsWith('there is ') ||
        enLower.startsWith('there are ') ||
        /\b(i|we|you|they)\s+have\b/.test(enLower) ||
        /\b(he|she|it)\s+has\b/.test(enLower) ||
        /\b(i|we|you|they)\s+need\b/.test(enLower) ||
        /\b(he|she|it)\s+needs\b/.test(enLower)
      );
      const autoCorrectAnswer = isAffirmative ? 'some' : 'any';
      const overlaySymbol = isQuestion ? '?' : (isNegative ? '✗' : '✓');
      const overlayColor = isQuestion ? '#ff6fb0' : (isNegative ? '#f44336' : '#2e7d32');

  const questionText = isSomeAnyMode
        ? sanitizeText(prefixBeforeSomeAny(item?.en || ''))
        : ((hasProximityMode && highlightedPrompt) ? highlightedPrompt : (inOnUnderMode && highlightedPrompt ? highlightedPrompt : displayText));
  const showCyanText = !(isSomeAnyMode && promptHasBlank);

      const nounFromWord = (word) => {
        const w = String(word || '').replace(/^some_+/i, '').replace(/^any_+/i, '');
        return sanitizeText(w.replace(/_/g, ' '));
      };

      const visualCueHTML = isSomeAnyMode
        ? (item.emoji ? `<div style="position:relative;display:inline-block;margin-bottom:24px;">`+
            `<span style="font-size:4.6rem;line-height:1;">${item.emoji}</span>`+
            `<span style="position:absolute;right:-8px;bottom:-8px;font-size:2rem;color:${overlayColor};font-weight:900;">${overlaySymbol}</span>`+
          `</div>` : '')
        : (hasProximityMode
           ? buildProximityScene(item?.article, item?.emoji)
           : (inOnUnderMode ? buildPrepositionScene(item?.article, item?.emoji, item?.word) : (item.emoji ? `<div style="font-size:4.6rem;line-height:1;margin-bottom:30px;">${item.emoji}</div>` : '')));

      // Helper: extract noun phrase after There is/are (incl. negatives) or Is/Are there and detect plurality
      const extractThereNounPhrase = (s) => {
        const t = String(s || '').trim();
        // Support: there is/are, there isn't/aren't, and is/are there
        const m = t.match(/^(?:there\s+(?:is|are|isn't|aren't)|(?:is|are)\s+there)\s+(.+?)[.?!]?$/i);
        if (!m) return { phrase: '', plural: false };
        let phrase = m[1].trim();
        // Drop prepositional/location/time tails
        phrase = phrase.replace(/\b(on|in|at|to|from|of|by|with|under|over|above|below|behind|between|into|onto|around|through|near|next\s+to)\b[\s\S]*$/i, '').trim();
        phrase = phrase.replace(/\b(today|tonight|now|here|nearby)\b[\s\S]*$/i, '').trim();
        // Remove leading quantifiers we don't want to display
        phrase = phrase.replace(/^(?:some|any)\s+/i, '').trim();
        const low = phrase.toLowerCase();
  const plural = /\b(two|three|four|five|six|seven|eight|nine|ten|many|several|a\s+lot\s+of|lots\s+of|some|any)\b/.test(low) || /\b\w+s\b/.test(low) || /\b\w+es\b/.test(low);
        return { phrase, plural };
      };

  // negatives removed for statements mode — only show positive choices

      // Compute special mode flags and correct answers for There is/are choose modes
      let modeCorrectAnswer = null;
      let pinkNounHTML = '';
      let isThereNegRound = false;
      if (isThereStatementsMode || isThereQuestionsMode) {
        const base = item?.en || item?.exampleSentence || '';
        const baseLower = String(base).toLowerCase();
        const { phrase, plural } = extractThereNounPhrase(base);
        if (phrase) {
          pinkNounHTML = `<div style="font-size:clamp(1.8rem, 8vw, 3.8rem);font-weight:900;color:#ff6fb0;letter-spacing:0.02em;max-width:min(90vw, 520px);word-wrap:break-word;overflow-wrap:break-word;line-height:1.28;padding:0 8px;white-space:normal;">${sanitizeText(phrase)}</div>`;
        } else if (item?.word) {
          pinkNounHTML = `<div style=\"font-size:clamp(1.8rem, 8vw, 3.8rem);font-weight:900;color:#ff6fb0;letter-spacing:0.02em;max-width:min(90vw, 520px);line-height:1.28;padding:0 8px;\">${sanitizeText(String(item.word).replace(/_/g,' '))}</div>`;
        }
        // Prefer explicit label from item.word when present
        const w = String(item?.word || '').toLowerCase();
        if (isThereStatementsMode) {
          const hasNegChoices = acLower.includes("there isn't") && acLower.includes("there aren't");
          // Decide negative round: use data if negative, else random when negatives exist
          isThereNegRound = !!(hasNegChoices && (baseLower.startsWith("there isn't") || baseLower.startsWith("there aren't") || Math.random() < 0.5));
          if (isThereNegRound) {
            if (w.includes('there_are')) modeCorrectAnswer = "there aren't";
            else if (w.includes('there_is')) modeCorrectAnswer = "there isn't";
            else modeCorrectAnswer = plural ? "there aren't" : "there isn't";
          } else {
            if (w.includes('there_are')) modeCorrectAnswer = 'there are';
            else if (w.includes('there_is')) modeCorrectAnswer = 'there is';
            else modeCorrectAnswer = plural ? 'there are' : 'there is';
          }
        } else {
          if (w.includes('are_there')) modeCorrectAnswer = 'Are there';
          else if (w.includes('is_there')) modeCorrectAnswer = 'Is there';
          else modeCorrectAnswer = plural ? 'Are there' : 'Is there';
        }
        window.__WA__chooseVisualCue = null;
      }

  // Main content - different layout for plurals mode and present simple choose mode
  let contentHTML;
      
  if (isPluralsMode) {
        // Plurals mode: show emoji + word form, let them pick between singular/plural word forms
        // Find the base singular form - entries ending in _singular have singular, _plural have plural
        const isSingularEntry = item.id.includes('_singular');
        const isPluralEntry = item.id.includes('_plural');
        
        // Extract base word (e.g., "dog" from "dog_singular" or "dogs")
        const baseWord = item.word;
        
        // Find the paired word - search in the data for the matching pair
        const currentIndex = grammarData.findIndex(d => d.id === item.id);
        let singularWord, pluralWord;
        
        if (isSingularEntry) {
          singularWord = item.word;
          // Find the plural pair (next item usually)
          const pluralItem = grammarData[currentIndex + 1];
          pluralWord = pluralItem ? pluralItem.word : item.word + 's';
        } else {
          pluralWord = item.word;
          // Find the singular pair (previous item usually)
          const singularItem = grammarData[currentIndex - 1];
          singularWord = singularItem ? singularItem.word : item.word.replace(/s$/, '');
        }
        
        contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:32px;padding:24px;max-width:640px;margin:0 auto;">
            <!-- Progress indicator -->
            <div style="width:100%;text-align:center;font-size:1rem;color:#666;font-weight:600;margin-top:4px;margin-bottom:4px;">
              Question ${currentIdx + 1} of ${shuffled.length}
            </div>
            
            <!-- Main question - ONLY emoji, NO text answer -->
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:24px;margin-top:6px;">
              <!-- Emoji only -->
              ${item.emoji ? `<div style="font-size:5rem;line-height:1;">${item.emoji}</div>` : ''}
            </div>
            
            <!-- Answer buttons - show actual word choices -->
            <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:460px;justify-content:center;margin-top:40px;margin-bottom:8px;flex-wrap:wrap;">
              <button class="grammar-choice-btn" data-answer="singular" style="flex:1;min-width:clamp(110px, 20vw, 160px);padding:clamp(14px, 2.5vh, 18px) clamp(18px, 3vw, 28px);font-size:clamp(1.2rem, 3.5vw, 1.7rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);font-family:'Poppins', Arial, sans-serif;">
                ${singularWord}
              </button>
              <button class="grammar-choice-btn" data-answer="plural" style="flex:1;min-width:clamp(110px, 20vw, 160px);padding:clamp(14px, 2.5vh, 18px) clamp(18px, 3vw, 28px);font-size:clamp(1.2rem, 3.5vw, 1.7rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);font-family:'Poppins', Arial, sans-serif;">
                ${pluralWord}
              </button>
            </div>
            
            <!-- Spacer pushes the quit button to the bottom -->
            <div style="flex:1;width:100%;"></div>
            
            <!-- Quit button -->
            <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
              <span class="wa-sr-only">Quit Game</span>
              <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
            </button>
          </div>
        `;
  } else if (isPresentSimpleList && grammarConfig && grammarConfig.mode === 'present_simple_verb_choose') {
        // ===============================
        // Present Simple Choose Mode
        // Show only subject + emoji and two verb options (base vs 3rd person -s)
        // ===============================

  const sentence = String(item.en || item.exampleSentence || '');
        const emoji = item.emoji || '';

        // Extract subject (first 1–2 tokens, handling "The kids", "The sun")
        const parts = sentence.split(/\s+/);
        let subject = '';
        if (/^the$/i.test(parts[0]) && parts.length >= 2) {
          subject = `${parts[0]} ${parts[1]}`; // "The sun", "The kids"
        } else {
          subject = parts[0]; // I, you, he, she, it, we, they, Cats
        }
        subject = subject.replace(/[.,!?]$/g, '');

        // Decide if subject is 3rd person singular for -s form
        const subjLower = subject.toLowerCase();
        const thirdSingularSubjects = new Set([
          'he', 'she', 'it', 'the dog', 'the sun'
        ]);
        const isThirdSingular = thirdSingularSubjects.has(subjLower);

        // Roughly extract verb from sentence (2nd or 3rd token)
        let verb = '';
        if (parts.length >= 2) {
          let verbIndex = 1;
          if (/^the$/i.test(parts[0]) && parts.length >= 3) {
            verbIndex = 2; // The sun rises
          }
          verb = parts[verbIndex] || '';
        }
        verb = verb.replace(/[^a-zA-Z]/g, '').toLowerCase();

        // Build base and 3rd-person-s forms
        const buildThirdForm = (base) => {
          if (!base) return '';
          // If already an -es form like "rises", just return as-is
          if (/es$/i.test(base)) return base;
          if (/[^aeiou]y$/i.test(base)) return base.replace(/y$/i, 'ies');
          if (/(s|x|ch|sh|o)$/i.test(base)) return `${base}es`;
          return `${base}s`;
        };

        const baseForm = (() => {
          // Prefer deriving from wordField only when it actually looks like a verb form we know
          const wordField = String(item.word || '');
          const m = wordField.match(/_(\w+)$/);
          if (m && m[1]) {
            const raw = m[1].toLowerCase();
            if (/^(play|walk|like|eat|study|watch|work|chase|rise|rises|plays|walks|likes|eats|studies|watches|works|chases)$/i.test(raw)) {
              let candidate = raw;
              if (/ies$/.test(candidate)) {
                candidate = candidate.replace(/ies$/, 'y');
              } else if (/(s|x|ch|sh|o)es$/i.test(candidate)) {
                candidate = candidate.replace(/es$/, '');
              } else if (/s$/.test(candidate) && !/(ss|us)$/i.test(candidate)) {
                candidate = candidate.replace(/s$/, '');
              }
              return candidate;
            }
          }
          // Fallback to extracted verb from the sentence; special-case "rises" -> "rise" for clean pair
          if (verb === 'rises') return 'rise';
          return verb || 'play';
        })();

        const thirdForm = buildThirdForm(baseForm);

        const correctForm = isThirdSingular ? thirdForm : baseForm;
        const incorrectForm = isThirdSingular ? baseForm : thirdForm;

        // Randomize button order
        const options = [
          { label: baseForm, value: baseForm },
          { label: thirdForm, value: thirdForm }
        ].sort(() => Math.random() - 0.5);

        contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:24px;padding:24px;max-width:640px;margin:0 auto;">
            <div style="width:100%;text-align:center;font-size:0.95rem;color:#666;font-weight:600;">
              Question ${currentIdx + 1} of ${shuffled.length}
            </div>
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:12px;">
              ${emoji ? `<div style="font-size:4rem;line-height:1;">${emoji}</div>` : ''}
              <div style="font-size:1.8rem;font-weight:800;color:#21b3be;max-width:80vw;line-height:1.4;">${sanitizeText(subject)}</div>
            </div>
            <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:420px;justify-content:center;margin-top:24px;margin-bottom:8px;flex-wrap:wrap;">
              ${options.map(opt => `
                <button class="grammar-choice-btn" data-answer="${opt.value}" style="flex:1;min-width:clamp(120px, 26vw, 200px);padding:clamp(12px, 2.5vh, 16px) clamp(16px, 3vw, 24px);font-size:clamp(1.2rem, 3.3vw, 1.6rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">
                  ${opt.label}
                </button>
              `).join('')}
            </div>
            <div style="flex:1;width:100%;"></div>
            <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
              <span class="wa-sr-only">Quit Game</span>
              <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
            </button>
          </div>
        `;
      } else if (isPresentSimpleYesNo) {
        // =====================================
        // Present Simple Yes/No (DO vs DOES)
        // Show only subject and two buttons: DO / DOES
        // =====================================
        const sentence = String(item.en || item.exampleSentence || item.word || '');
        const emoji = item.emoji || '';
        // Strip leading Do/Does to isolate subject token(s)
        let working = sentence.replace(/^\s*(do|does)\s+/i, '').trim();
        const parts = working.split(/\s+/);
        let subject = '';
        if (/^the$/i.test(parts[0]) && parts.length >= 2) {
          subject = `${parts[0]} ${parts[1]}`;
        } else {
          subject = parts[0] || '';
        }
        subject = subject.replace(/[.,!?]$/g, '');

        const opts = ['DO','DOES'].sort(() => Math.random() - 0.5);
        const btns = opts.map(opt => `
          <button class="grammar-choice-btn" data-answer="${opt}" style="flex:1;min-width:clamp(120px, 26vw, 200px);padding:clamp(12px, 2.5vh, 16px) clamp(16px, 3vw, 24px);font-size:clamp(1.2rem, 3.3vw, 1.6rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">${opt}</button>
        `).join('');

        contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:24px;padding:24px;max-width:640px;margin:0 auto;">
            <div style="width:100%;text-align:center;font-size:0.95rem;color:#666;font-weight:600;">Question ${currentIdx + 1} of ${shuffled.length}</div>
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:12px;">
              ${emoji ? `<div style="font-size:4rem;line-height:1;">${emoji}</div>` : ''}
              <div style="font-size:1.9rem;font-weight:800;color:#21b3be;max-width:80vw;line-height:1.4;">${sanitizeText(subject)}</div>
            </div>
            <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:420px;justify-content:center;margin-top:24px;margin-bottom:8px;flex-wrap:wrap;">
              ${btns}
            </div>
            <div style="flex:1;width:100%;"></div>
            <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
              <span class="wa-sr-only">Quit Game</span>
              <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
            </button>
          </div>`;
      } else if (isPresentProgressive) {
        // =====================================
        // Present Progressive (am / is / are)
        // Show full sentence with BE verb blanked and three BE choices
        // =====================================

        const sentence = String(item.en || item.exampleSentence || item.word || '').trim();
        const emoji = item.emoji || '';
        const lower = sentence.toLowerCase();

        // Mask the BE chunk (am/is/are) in the sentence with ___
        const maskBeChunk = (text) => {
          let s = text;
          s = s.replace(/\b(i\s+am)\b/i, 'I ___');
          s = s.replace(/\b(you\s+are)\b/i, 'You ___');
          s = s.replace(/\b(we\s+are)\b/i, 'We ___');
          s = s.replace(/\b(they\s+are)\b/i, 'They ___');
          s = s.replace(/\b(he\s+is)\b/i, 'He ___');
          s = s.replace(/\b(she\s+is)\b/i, 'She ___');
          s = s.replace(/\b(it\s+is)\b/i, 'It ___');
          s = s.replace(/\b(the\s+cat\s+is)\b/i, 'The cat ___');
          // Fallbacks in case a sentence shape is a bit different
          s = s.replace(/\sam\s/i, ' ___ ');
          s = s.replace(/\sis\s/i, ' ___ ');
          s = s.replace(/\sare\s/i, ' ___ ');
          return s;
        };

        const maskedSentence = sanitizeText(maskBeChunk(sentence));

        // Determine correct BE form from original sentence
        let correctBe = 'am';
        if (/\b(i\s+am)\b/.test(lower) || /\sam\s/.test(lower)) {
          correctBe = 'am';
        } else if (/\bis\b/.test(lower)) {
          correctBe = 'is';
        } else if (/\bare\b/.test(lower)) {
          correctBe = 'are';
        }

        const options = ['am', 'is', 'are'].sort(() => Math.random() - 0.5);

        const contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:24px;padding:24px;max-width:640px;margin:0 auto;">
            <div style="width:100%;text-align:center;font-size:0.95rem;color:#666;font-weight:600;">
              Question ${currentIdx + 1} of ${shuffled.length}
            </div>
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:12px;">
              ${emoji ? `<div style="font-size:4rem;line-height:1;">${emoji}</div>` : ''}
              <div style="font-size:1.6rem;font-weight:800;color:#21b3be;max-width:85vw;line-height:1.5;">
                ${maskedSentence}
              </div>
            </div>
            <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:420px;justify-content:center;margin-top:24px;margin-bottom:8px;flex-wrap:wrap;">
              ${options.map(opt => `
                <button class="grammar-choice-btn" data-answer="${opt}" style="flex:1;min-width:clamp(110px, 22vw, 160px);padding:clamp(12px, 2.5vh, 16px) clamp(16px, 3vw, 24px);font-size:clamp(1.2rem, 3.3vw, 1.6rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">
                  ${opt}
                </button>
              `).join('')}
            </div>
            <div style="flex:1;width:100%;"></div>
            <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
              <span class="wa-sr-only">Quit Game</span>
              <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
            </button>
          </div>
        `;

        setView({ content: contentHTML, showProgressBar: true, progressValue: currentIdx + 1, progressMax: shuffled.length });

        const buttons = Array.from(document.querySelectorAll('.grammar-choice-btn'));
        buttons.forEach(btn => {
          btn.onclick = async () => {
            const userAnswer = btn.getAttribute('data-answer');
            const correct = userAnswer === correctBe;

            btn.style.borderColor = correct ? '#00897b' : '#f44336';
            btn.style.backgroundColor = correct ? '#b2dfdb' : '#ffebee';
            btn.style.color = correct ? '#fff' : '#f44336';

            if (correct) {
              score++;
              if (playSFX) playSFX('correct');
            } else if (playSFX) {
              playSFX('wrong');
            }

            buttons.forEach(b => { b.disabled = true; });
            totalAnswered++;

            try {
              logAttempt({
                session_id: sessionId,
                mode: 'grammar_mode',
                word: item.id || item.word || item.en,
                is_correct: correct,
                answer: userAnswer,
                correct_answer: correctBe,
                points: correct ? 1 : 0,
                attempt_index: currentIdx,
                round: currentIdx + 1,
                extra: { category: 'grammar', type: 'present_progressive_be_choose', file: grammarFile }
              });
            } catch {}

            clearAdvanceTimer();
            advanceTimer = setTimeout(() => {
              if (!sessionEnded) {
                currentIdx++;
                renderGrammarQuestion();
              }
            }, 1200);
          };
          btn.onmouseenter = () => {
            if (!btn.disabled) {
              btn.style.transform = 'scale(1.03)';
              btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }
          };
          btn.onmouseleave = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
          };
        });

        const quitBtn = document.getElementById('grammarQuitBtn');
        if (quitBtn) {
          quitBtn.onclick = () => {
            sessionEnded = true;
            clearAdvanceTimer();
            try {
              if (window.WordArcade?.startGrammarModeSelector) {
                window.WordArcade.startGrammarModeSelector();
              } else if (window.WordArcade?.quitToOpening) {
                window.WordArcade.quitToOpening(true);
              } else {
                location.hash = '#state-mode_selector';
                location.reload();
              }
            } catch {}
          };
        }
        return;
      } else if (isPresentSimpleNegative) {
        // ===============================
        // Present Simple Negative (Choose)
        // Show subject only and two options: don't / doesn't
        // ===============================

        const sentence = String(item.en || item.exampleSentence || item.word || '');
        const emoji = item.emoji || '';
        const parts = sentence.split(/\s+/);
        let subject = '';
        if (/^the$/i.test(parts[0]) && parts.length >= 2) subject = `${parts[0]} ${parts[1]}`; else subject = parts[0] || '';
        subject = subject.replace(/[.,!?]$/g, '');

        const options = ["don't", "doesn't"].sort(() => Math.random() - 0.5);
        const btns = options.map(opt => `
          <button class="grammar-choice-btn" data-answer="${opt}" style="flex:1;min-width:clamp(120px, 26vw, 200px);padding:clamp(12px, 2.5vh, 16px) clamp(16px, 3vw, 24px);font-size:clamp(1.2rem, 3.3vw, 1.6rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">${opt}</button>
        `).join('');

        contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:24px;padding:24px;max-width:640px;margin:0 auto;">
            <div style="width:100%;text-align:center;font-size:0.95rem;color:#666;font-weight:600;">Question ${currentIdx + 1} of ${shuffled.length}</div>
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:12px;">
              ${emoji ? `<div style="font-size:4rem;line-height:1;">${emoji}</div>` : ''}
              <div style="font-size:1.8rem;font-weight:800;color:#21b3be;max-width:80vw;line-height:1.4;">${sanitizeText(subject)}</div>
            </div>
            <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:420px;justify-content:center;margin-top:24px;margin-bottom:8px;flex-wrap:wrap;">
              ${btns}
            </div>
            <div style="flex:1;width:100%;"></div>
            <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
              <span class="wa-sr-only">Quit Game</span>
              <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
            </button>
          </div>`;
      } else if (isPresentSimpleWhQuestions || isPresentProgressiveWhQuestions) {
        // WH choose mode: show Korean WH prompt and four WH options
        const enQuestion = String(item.en || '').trim();
        const koPrompt = String(item.ko || item.exampleSentenceKo || '').trim();

        // Extract WH word from the English question (first token)
        const mWh = enQuestion.match(/^(Who|What|When|Where|Why|How|Which)\b/i);
        let whWord = (mWh ? mWh[1] : '').toLowerCase().trim();

        // Normalize some variants if they ever appear
        if (whWord === 'how') {
          // Keep as 'how' for now; could specialize later (how often/long/many)
          whWord = 'how';
        }

        const coreWhPool = ['who', 'what', 'when', 'where', 'why'];
        const fullWhPool = ['who', 'what', 'when', 'where', 'why', 'how', 'which'];

        // If we somehow didn't detect a WH, fall back to a frequent one
        const validWh = (fullWhPool.includes(whWord) ? whWord : 'what');

        // Build four WH options: correct + three distractors.
        // Prefer core WH set first so options feel natural; add extras only if needed.
        const basePool = coreWhPool.includes(validWh)
          ? coreWhPool
          : fullWhPool;

        const distractorsSource = basePool.filter(w => w !== validWh);
        // If the base pool is too small for 3 distractors, top up from the full pool
        let distractors = distractorsSource;
        if (distractors.length < 3) {
          const backup = fullWhPool.filter(w => w !== validWh && !distractors.includes(w));
          distractors = distractors.concat(backup);
        }

        const shuffledDistr = distractors.sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [validWh, ...shuffledDistr].sort(() => Math.random() - 0.5);

        const contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:24px;padding:24px;max-width:640px;margin:0 auto;">
            <div style="width:100%;text-align:center;font-size:0.95rem;color:#666;font-weight:600;">
              Question ${currentIdx + 1} of ${shuffled.length}
            </div>
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:12px;">
              ${item.emoji ? `<div style="font-size:4rem;line-height:1;">${item.emoji}</div>` : ''}
              <div style="font-size:1.9rem;font-weight:800;color:#21b3be;max-width:80vw;line-height:1.5;">
                ${koPrompt || '&nbsp;'}
              </div>
            </div>
            <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:420px;justify-content:center;margin-top:24px;margin-bottom:8px;flex-wrap:wrap;">
              ${options.map(opt => `
                <button class="grammar-choice-btn" data-answer="${opt}" style="flex:1;min-width:clamp(110px, 24vw, 180px);padding:clamp(12px, 2.5vh, 16px) clamp(18px, 3vw, 26px);font-size:clamp(1.2rem, 3.4vw, 1.7rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">
                  ${opt}
                </button>
              `).join('')}
            </div>
            <div style="flex:1;width:100%:"></div>
            <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
              <span class="wa-sr-only">Quit Game</span>
              <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
            </button>
          </div>
        `;

        setView({ content: contentHTML, showProgressBar: true, progressValue: currentIdx + 1, progressMax: shuffled.length });

        const buttons = Array.from(document.querySelectorAll('.grammar-choice-btn'));
        buttons.forEach(btn => {
          btn.onclick = async () => {
            const userAnswer = btn.getAttribute('data-answer');
            const correctAnswer = validWh;
            const correct = userAnswer === correctAnswer;

            btn.style.borderColor = correct ? '#00897b' : '#f44336';
            btn.style.backgroundColor = correct ? '#b2dfdb' : '#ffebee';
            btn.style.color = correct ? '#fff' : '#f44336';

            if (correct) {
              score++;
              if (playSFX) playSFX('correct');
            } else if (playSFX) {
              playSFX('wrong');
            }

            buttons.forEach(b => { b.disabled = true; });
            totalAnswered++;

            try {
              logAttempt({
                session_id: sessionId,
                mode: 'grammar_mode',
                word: item.id || item.word || item.en,
                is_correct: correct,
                answer: userAnswer,
                correct_answer: correctAnswer,
                points: correct ? 1 : 0,
                attempt_index: currentIdx,
                round: currentIdx + 1,
                extra: { category: 'grammar', type: isPresentProgressiveWhQuestions ? 'present_progressive_wh_choose' : 'present_simple_wh_choose', file: grammarFile }
              });
            } catch {}

            clearAdvanceTimer();
            advanceTimer = setTimeout(() => {
              if (!sessionEnded) {
                currentIdx++;
                renderGrammarQuestion();
              }
            }, 1200);
          };
          btn.onmouseenter = () => {
            if (!btn.disabled) {
              btn.style.transform = 'scale(1.03)';
              btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }
          };
          btn.onmouseleave = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
          };
        });

        const quitBtn = document.getElementById('grammarQuitBtn');
        if (quitBtn) {
          quitBtn.onclick = () => {
            sessionEnded = true;
            clearAdvanceTimer();
            try {
              if (window.WordArcade?.startGrammarModeSelector) {
                window.WordArcade.startGrammarModeSelector();
              } else if (window.WordArcade?.quitToOpening) {
                window.WordArcade.quitToOpening(true);
              } else {
                location.hash = '#state-mode_selector';
                location.reload();
              }
            } catch {}
          };
        }
        return;
      } else if (isPresentProgressiveNegative) {
        // ===============================
        // Present Progressive Negative (am not / isn't / aren't)
        // Show subject only and three options
        // ===============================

        const sentence = String(item.en || item.exampleSentence || item.word || '');
        const emoji = item.emoji || '';
        const parts = sentence.split(/\s+/);
        let subject = '';
        if (/^the$/i.test(parts[0]) && parts.length >= 2) subject = `${parts[0]} ${parts[1]}`; else subject = parts[0] || '';
        subject = subject.replace(/[.,!?]$/g, '');

        const options = ['am not', "isn't", "aren't"].sort(() => Math.random() - 0.5);
        const btns = options.map(opt => `
          <button class="grammar-choice-btn" data-answer="${opt}" style="flex:1;min-width:clamp(110px, 24vw, 180px);padding:clamp(12px, 2.5vh, 16px) clamp(18px, 3vw, 26px);font-size:clamp(1.2rem, 3.4vw, 1.7rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">${opt}</button>
        `).join('');

        contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:24px;padding:24px;max-width:640px;margin:0 auto;">
            <div style="width:100%;text-align:center;font-size:0.95rem;color:#666;font-weight:600;">Question ${currentIdx + 1} of ${shuffled.length}</div>
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:12px;">
              ${emoji ? `<div style="font-size:4rem;line-height:1;">${emoji}</div>` : ''}
              <div style="font-size:1.8rem;font-weight:800;color:#21b3be;max-width:80vw;line-height:1.4;">${sanitizeText(subject)}</div>
            </div>
            <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:420px;justify-content:center;margin-top:24px;margin-bottom:8px;flex-wrap:wrap;">
              ${btns}
            </div>
            <div style="flex:1;width:100%;"></div>
            <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
              <span class="wa-sr-only">Quit Game</span>
              <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
            </button>
          </div>`;
      } else if (isPresentProgressiveYesNo) {
        // =====================================
        // Present Progressive Yes/No (AM / IS / ARE)
        // Show subject only and three BE options
        // =====================================
        const sentence = String(item.en || item.exampleSentence || item.word || '');
        const emoji = item.emoji || '';
        // Strip leading Am/Is/Are to isolate subject
        let working = sentence.replace(/^\s*(am|is|are)\s+/i, '').trim();
        const parts = working.split(/\s+/);
        let subject = '';
        if (/^the$/i.test(parts[0]) && parts.length >= 2) {
          subject = `${parts[0]} ${parts[1]}`;
        } else {
          subject = parts[0] || '';
        }
        subject = subject.replace(/[.,!?]$/g, '');

        const opts = ['AM', 'IS', 'ARE'].sort(() => Math.random() - 0.5);
        const btns = opts.map(opt => `
          <button class="grammar-choice-btn" data-answer="${opt}" style="flex:1;min-width:clamp(110px, 24vw, 180px);padding:clamp(12px, 2.5vh, 16px) clamp(18px, 3vw, 26px);font-size:clamp(1.2rem, 3.4vw, 1.7rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">${opt}</button>
        `).join('');

        contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:24px;padding:24px;max-width:640px;margin:0 auto;">
            <div style="width:100%;text-align:center;font-size:0.95rem;color:#666;font-weight:600;">Question ${currentIdx + 1} of ${shuffled.length}</div>
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:12px;">
              ${emoji ? `<div style="font-size:4rem;line-height:1;">${emoji}</div>` : ''}
              <div style="font-size:1.8rem;font-weight:800;color:#21b3be;max-width:80vw;line-height:1.4;">${sanitizeText(subject)}</div>
            </div>
            <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:420px;justify-content:center;margin-top:24px;margin-bottom:8px;flex-wrap:wrap;">
              ${btns}
            </div>
            <div style="flex:1;width:100%;"></div>
            <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
              <span class="wa-sr-only">Quit Game</span>
              <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
            </button>
          </div>`;
      } else {
        // Original grammar mode layout
        // If There is/are choose modes → show noun in pink and choices for BE/DO forms
  if (isThereStatementsMode || isThereQuestionsMode) {
          // Switch to negative pair during negative rounds; questions remain unchanged
          const posPair = (answerChoices || []).filter(c => {
            const cl = String(c).toLowerCase();
            return cl === 'there is' || cl === 'there are';
          });
          const negPair = (answerChoices || []).filter(c => {
            const cl = String(c).toLowerCase();
            return cl === "there isn't" || cl === "there aren't";
          });
          const choices = (isThereStatementsMode ? (isThereNegRound ? negPair : posPair) : answerChoices);
          const btns = choices.map((choice) => `
              <button class="grammar-choice-btn" data-answer="${choice}" style="flex:1;min-width:clamp(120px, 26vw, 200px);padding:clamp(12px, 2.5vh, 16px) clamp(16px, 3vw, 24px);font-size:clamp(1.05rem, 3vw, 1.5rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">${choice}</button>
            `).join('');
          contentHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:24px;padding:24px;max-width:640px;margin:0 auto;">
              <div style="width:100%;text-align:center;font-size:1rem;color:#666;font-weight:600;margin-top:4px;margin-bottom:4px;">Question ${currentIdx + 1} of ${shuffled.length}</div>
              <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:6px;">
    ${window.__WA__chooseVisualCue || visualCueHTML}
                ${pinkNounHTML}
              </div>
              <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:520px;justify-content:center;margin-top:16px;margin-bottom:8px;flex-wrap:wrap;">
                ${btns}
              </div>
              <div style="flex:1;width:100%;"></div>
              <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
                <span class="wa-sr-only">Quit Game</span>
                <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
              </button>
            </div>`;
        } else {
        contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:32px;padding:24px;max-width:640px;margin:0 auto;">
            <!-- Progress indicator -->
            <div style="width:100%;text-align:center;font-size:1rem;color:#666;font-weight:600;margin-top:4px;margin-bottom:4px;">
              Question ${currentIdx + 1} of ${shuffled.length}
            </div>

        <!-- Main question -->
        <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:6px;">
          ${visualCueHTML}
          ${!inOnUnderMode ? `<div id="grammarArticleBox" style="display:inline-flex;align-items:center;justify-content:center;min-width:90px;padding:8px 16px;max-width:280px;height:52px;border:3px solid #d1e6f0;border-radius:14px;background:#fff;vertical-align:middle;font-size:clamp(1.2rem, 4vw, 1.92rem);font-weight:800;color:#21b3be;font-family:'Poppins', Arial, sans-serif;transition:all 0.2s;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>` : ''}
          ${!inOnUnderMode && showCyanText ? `<div style="font-size:clamp(1.8rem, 8vw, 4.56rem);font-weight:800;color:#21b3be;letter-spacing:0.02em;max-width:min(90vw, 500px);word-wrap:break-word;overflow-wrap:break-word;line-height:1.3;padding:0 8px;white-space:normal;">${isThisThatMode ? sanitizeText(item?.word || '') : questionText}</div>` : ''}
        </div>              <!-- Answer buttons (extra spacing above) -->
          <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:520px;justify-content:center;margin-top:40px;margin-bottom:8px;flex-wrap:wrap;">
            ${isSomeAnyMode
              ? (() => {
                  const noun = nounFromWord(item.word);
                  return `
                    <button class="grammar-choice-btn" data-answer="some" style="flex:1;min-width:clamp(120px, 26vw, 200px);padding:clamp(12px, 2.5vh, 16px) clamp(16px, 3vw, 24px);font-size:clamp(1.1rem, 3vw, 1.5rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">some ${noun}</button>
                    <button class="grammar-choice-btn" data-answer="any" style="flex:1;min-width:clamp(120px, 26vw, 200px);padding:clamp(12px, 2.5vh, 16px) clamp(16px, 3vw, 24px);font-size:clamp(1.1rem, 3vw, 1.5rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:none;font-family:'Poppins', Arial, sans-serif;">any ${noun}</button>`;
                })()
              : answerChoices.map((choice) => `
                  <button class="grammar-choice-btn" data-answer="${choice}" style="flex:1;min-width:clamp(90px, 18vw, 140px);padding:clamp(12px, 2.5vh, 16px) clamp(16px, 3vw, 24px);font-size:clamp(1.1rem, 3vw, 1.5rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:lowercase;font-family:'Poppins', Arial, sans-serif;">${choice}</button>
                `).join('')
            }
          </div>

          <!-- Spacer pushes the quit button to the bottom -->
          <div style="flex:1;width:100%;"></div>

          <!-- Quit button -->
          <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
            <span class="wa-sr-only">Quit Game</span>
            <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
          </button>
        </div>
  `;
  }
      }

      // Render directly in the game area with progress
      setView({
        content: contentHTML,
        showProgressBar: true,
        progressValue: currentIdx + 1,
        progressMax: shuffled.length
      });

  // Special handling for Short Questions
  if (isShortQuestions) {
        const question = item.en || item.example || '';
        const emoji = item.emoji || '';

        // Build a grammatically correct and incorrect answer based on the question
        const q = String(question).trim();
        const isNegativeSet = /short_questions_2\.json$/i.test(grammarFile || '');
        let correctAnswer = '';
        let incorrectAnswer = '';

        if (/^can\s+you\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, I can't.";
            incorrectAnswer = "No, I'm not.";
          } else {
            correctAnswer = 'Yes, I can.';
            incorrectAnswer = 'Yes, I am.';
          }
        } else if (/^can\s+he\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, he can't.";
            incorrectAnswer = "No, he isn't.";
          } else {
            correctAnswer = 'Yes, he can.';
            incorrectAnswer = 'Yes, he is.';
          }
        } else if (/^can\s+she\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, she can't.";
            incorrectAnswer = "No, she isn't.";
          } else {
            correctAnswer = 'Yes, she can.';
            incorrectAnswer = 'Yes, she is.';
          }
        } else if (/^can\s+they\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, they can't.";
            incorrectAnswer = "No, they aren't.";
          } else {
            correctAnswer = 'Yes, they can.';
            incorrectAnswer = 'Yes, they are.';
          }
        } else if (/^can\s+we\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, we can't.";
            incorrectAnswer = "No, we aren't.";
          } else {
            correctAnswer = 'Yes, we can.';
            incorrectAnswer = 'Yes, we are.';
          }
        } else if (/^can\s+i\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, I can't.";
            incorrectAnswer = "No, I'm not.";
          } else {
            correctAnswer = 'Yes, I can.';
            incorrectAnswer = "Yes, I'm.";
          }
        } else if (/^are\s+they\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, they aren't.";
            incorrectAnswer = "No, they isn't.";
          } else {
            correctAnswer = 'Yes, they are.';
            incorrectAnswer = 'Yes, they is.';
          }
        } else if (/^is\s+she\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, she isn't.";
            incorrectAnswer = "No, she doesn't.";
          } else {
            correctAnswer = 'Yes, she is.';
            incorrectAnswer = 'Yes, she can.';
          }
        } else if (/^is\s+he\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, he isn't.";
            incorrectAnswer = "No, he doesn't.";
          } else {
            correctAnswer = 'Yes, he is.';
            incorrectAnswer = 'Yes, he can.';
          }
        } else if (/^is\s+it\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, it isn't.";
            incorrectAnswer = "No, it doesn't.";
          } else {
            correctAnswer = 'Yes, it is.';
            incorrectAnswer = 'Yes, it can.';
          }
        } else if (/^is\s+the\s+dog\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, it isn't.";
            incorrectAnswer = "No, it doesn't.";
          } else {
            correctAnswer = 'Yes, it is.';
            incorrectAnswer = 'Yes, it can.';
          }
        } else if (/^is\s+the\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, it isn't.";
            incorrectAnswer = "No, it doesn't.";
          } else {
            correctAnswer = 'Yes, it is.';
            incorrectAnswer = 'Yes, it can.';
          }
        } else if (/^is\s+this\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, it isn't.";
            incorrectAnswer = "No, it doesn't.";
          } else {
            correctAnswer = 'Yes, it is.';
            incorrectAnswer = 'Yes, it can.';
          }
        } else if (/^is\s+that\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, it isn't.";
            incorrectAnswer = "No, it doesn't.";
          } else {
            correctAnswer = 'Yes, it is.';
            incorrectAnswer = 'Yes, it can.';
          }
        } else if (/^is\s+he\s+from\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, he isn't.";
            incorrectAnswer = "No, he doesn't.";
          } else {
            correctAnswer = 'Yes, he is.';
            incorrectAnswer = 'Yes, he does.';
          }
        } else if (/^is\s+she\s+from\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, she isn't.";
            incorrectAnswer = "No, she doesn't.";
          } else {
            correctAnswer = 'Yes, she is.';
            incorrectAnswer = 'Yes, she does.';
          }
        } else if (/^do\s+you\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, I don't.";
            incorrectAnswer = "No, I'm not.";
          } else {
            correctAnswer = 'Yes, I do.';
            incorrectAnswer = 'Yes, I am.';
          }
        } else if (/^do\s+they\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, they don't.";
            incorrectAnswer = "No, they aren't.";
          } else {
            correctAnswer = 'Yes, they do.';
            incorrectAnswer = 'Yes, they are.';
          }
        } else if (/^do\s+we\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, we don't.";
            incorrectAnswer = "No, we aren't.";
          } else {
            correctAnswer = 'Yes, we do.';
            incorrectAnswer = 'Yes, we are.';
          }
        } else if (/^do\s+i\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, you don't.";
            incorrectAnswer = "No, you aren't.";
          } else {
            correctAnswer = 'Yes, you do.';
            incorrectAnswer = 'Yes, you are.';
          }
        } else if (/^does\s+he\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, he doesn't.";
            incorrectAnswer = "No, he isn't.";
          } else {
            correctAnswer = 'Yes, he does.';
            incorrectAnswer = 'Yes, he is.';
          }
        } else if (/^does\s+she\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, she doesn't.";
            incorrectAnswer = "No, she isn't.";
          } else {
            correctAnswer = 'Yes, she does.';
            incorrectAnswer = 'Yes, she is.';
          }
        } else if (/^does\s+it\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, it doesn't.";
            incorrectAnswer = "No, it isn't.";
          } else {
            correctAnswer = 'Yes, it does.';
            incorrectAnswer = 'Yes, it is.';
          }
        } else if (/^does\s+the\s+bus\b/i.test(q)) {
          if (isNegativeSet) {
            correctAnswer = "No, it doesn't.";
            incorrectAnswer = "No, it isn't.";
          } else {
            correctAnswer = 'Yes, it does.';
            incorrectAnswer = 'Yes, it is.';
          }
        } else {
          // Fallback: generic BE vs DO contrast
          if (isNegativeSet) {
            correctAnswer = 'No.';
            incorrectAnswer = "No, it isn't.";
          } else {
            correctAnswer = 'Yes.';
            incorrectAnswer = 'No.';
          }
        }

        const options = [correctAnswer, incorrectAnswer].sort(() => Math.random() - 0.5);

        const contentHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:24px;padding:24px;max-width:640px;margin:0 auto;">
            <div style="width:100%;text-align:center;font-size:0.9rem;color:#666;font-weight:600;">
              Question ${currentIdx + 1} of ${shuffled.length}
            </div>
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:20px;margin-top:12px;">
              ${emoji ? `<div style="font-size:4rem;line-height:1;">${emoji}</div>` : ''}
              <div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;">
                <div style="font-size:1.5rem;font-weight:800;color:#21b3be;max-width:80vw;line-height:1.4;">${question}</div>
              </div>
            </div>
            <div style="display:flex;gap:12px;flex-direction:column;width:100%;max-width:520px;justify-content:center;margin-top:20px;">
              ${options.map(opt => `<button class="grammar-choice-btn" data-answer="${opt.replace(/"/g, '&quot;')}" style="width:100%;padding:12px 14px;font-size:1rem;font-weight:700;border-radius:14px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center;font-family:'Poppins', Arial, sans-serif;">${opt}</button>`).join('')}
            </div>
            <div style="flex:1;width:100%;"></div>
            <button id="grammarQuitBtn" class="wa-quit-btn" type="button" aria-label="Quit game">
              <span class="wa-sr-only">Quit Game</span>
              <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
            </button>
          </div>
        `;
        setView({ content: contentHTML, showProgressBar: true, progressValue: currentIdx + 1, progressMax: shuffled.length });

        // Bind buttons for Short Questions (always two options: one correct, one incorrect)
        document.querySelectorAll('.grammar-choice-btn').forEach(btn => {
          btn.onclick = async () => {
            const userAnswer = btn.getAttribute('data-answer');
            const correct = userAnswer === correctAnswer;
            btn.style.borderColor = correct ? '#00897b' : '#f44336';
            btn.style.backgroundColor = correct ? '#b2dfdb' : '#ffebee';
            btn.style.color = correct ? '#fff' : '#f44336';
            if (correct) { score++; if (playSFX) playSFX('correct'); } else { if (playSFX) playSFX('wrong'); }
            totalAnswered++;
            try {
              logAttempt({
                session_id: sessionId,
                mode: 'grammar_mode',
                word: item.en || item.example,
                is_correct: correct,
                answer: userAnswer,
                correct_answer: correctAnswer,
                points: correct ? 1 : 0,
                attempt_index: currentIdx,
                round: currentIdx + 1,
                extra: { category: 'grammar', type: 'short_questions', file: grammarFile }
              });
            } catch {}
            document.querySelectorAll('.grammar-choice-btn').forEach(b => b.disabled = true);
            clearAdvanceTimer();
            advanceTimer = setTimeout(() => { if (!sessionEnded) { currentIdx++; renderGrammarQuestion(); } }, 1500);
          };
          btn.onmouseenter = () => { if (!btn.disabled) { btn.style.transform='scale(1.02)'; btn.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)'; } };
          btn.onmouseleave = () => { btn.style.transform='scale(1)'; btn.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'; };
        });

        const quitBtn = document.getElementById('grammarQuitBtn');
        if (quitBtn) {
          quitBtn.onclick = () => {
            sessionEnded = true; clearAdvanceTimer();
            try { if (window.WordArcade?.startGrammarModeSelector) window.WordArcade.startGrammarModeSelector(); else if (window.WordArcade?.quitToOpening) window.WordArcade.quitToOpening(true); else { location.hash = '#state-mode_selector'; location.reload(); } } catch {}
          };
        }
        return;
      }

      // Bind answer buttons for general grammar choose modes (articles, some/any, there is/are, present simple verb choose)
      document.querySelectorAll('.grammar-choice-btn').forEach(btn => {
        btn.onclick = async () => {
          const userAnswer = btn.getAttribute('data-answer');
          // Determine correct answer by mode
          let correctAnswer = null;
          if (isSomeAnyMode) {
            correctAnswer = autoCorrectAnswer;
          } else if (isThereStatementsMode || isThereQuestionsMode) {
            correctAnswer = modeCorrectAnswer;
          } else if (isPresentSimpleYesNo) {
            // Determine correct DO/DOES from subject (I/you/we/they/plurals -> DO; third singular -> DOES)
            const sentence = String(item.en || item.exampleSentence || item.word || '').replace(/^\s*(do|does)\s+/i, '').trim();
            const parts = sentence.split(/\s+/);
            let subject = '';
            if (/^the$/i.test(parts[0]) && parts.length >= 2) subject = `${parts[0]} ${parts[1]}`; else subject = parts[0] || '';
            const subjLower = subject.toLowerCase();
            const thirdSingular = new Set(['he','she','it']);
            let isThirdSing = thirdSingular.has(subjLower);
            if (/^the\s+\w+$/.test(subjLower) && !/s$/.test(subjLower.split(/\s+/)[1] || '')) {
              // Treat "the dog" singular, but "the kids" plural
              isThirdSing = true;
            }
            if (/s$/.test(subjLower) && !thirdSingular.has(subjLower)) {
              // Plural heuristic for nouns ending with s
              isThirdSing = false;
            }
            correctAnswer = isThirdSing ? 'DOES' : 'DO';
          } else if (isPresentSimpleNegative) {
            // Decide don't vs doesn't from the sentence content
            const base = String(item.en || item.exampleSentence || '').toLowerCase();
            if (/(?:doesn't|doesnt)\b/.test(base)) correctAnswer = "doesn't";
            else if (/(?:don't|dont)\b/.test(base)) correctAnswer = "don't";
            else {
              // Fallback: derive from subject pronoun
              const parts = base.split(/\s+/);
              const subj = parts[0] || '';
              const third = new Set(['he','she','it']);
              correctAnswer = third.has(subj) ? "doesn't" : "don't";
            }
          } else if (isPresentSimpleList && grammarConfig && grammarConfig.mode === 'present_simple_verb_choose') {
            // For present simple choose mode, correct form depends on subject group (reuse same rules as render)
            const sentence = String(item.en || item.exampleSentence || '');
            const parts = sentence.split(/\s+/);
            let subject = '';
            if (/^the$/i.test(parts[0]) && parts.length >= 2) {
              subject = `${parts[0]} ${parts[1]}`;
            } else {
              subject = parts[0];
            }
            subject = subject.replace(/[.,!?]$/g, '');
            const subjLower = subject.toLowerCase();
            const thirdSingularSubjects = new Set([
              'he', 'she', 'it', 'the dog', 'the sun'
            ]);
            const isThirdSingular = thirdSingularSubjects.has(subjLower);

            let verb = '';
            if (parts.length >= 2) {
              let verbIndex = 1;
              if (/^the$/i.test(parts[0]) && parts.length >= 3) {
                verbIndex = 2;
              }
              verb = parts[verbIndex] || '';
            }
            verb = verb.replace(/[^a-zA-Z]/g, '').toLowerCase();

            const buildThirdForm = (base) => {
              if (!base) return '';
              if (/es$/i.test(base)) return base;
              if (/[^aeiou]y$/i.test(base)) return base.replace(/y$/i, 'ies');
              if (/(s|x|ch|sh|o)$/i.test(base)) return `${base}es`;
              return `${base}s`;
            };

            const baseForm = (() => {
              const wordField = String(item.word || '');
              const m = wordField.match(/_(\w+)$/);
              if (m && m[1]) {
                const raw = m[1].toLowerCase();
                if (/^(play|walk|like|eat|study|watch|work|chase|rise|rises|plays|walks|likes|eats|studies|watches|works|chases)$/i.test(raw)) {
                  let candidate = raw;
                  if (/ies$/.test(candidate)) {
                    candidate = candidate.replace(/ies$/, 'y');
                  } else if (/(s|x|ch|sh|o)es$/i.test(candidate)) {
                    candidate = candidate.replace(/es$/, '');
                  } else if (/s$/.test(candidate) && !/(ss|us)$/i.test(candidate)) {
                    candidate = candidate.replace(/s$/, '');
                  }
                  return candidate;
                }
              }
              return verb || 'play';
            })();

            const thirdForm = buildThirdForm(baseForm);
            correctAnswer = isThirdSingular ? thirdForm : baseForm;
          } else if (isPresentProgressiveNegative) {
            const base = String(item.en || item.exampleSentence || '').toLowerCase();
            if (/\bam\s+not\b/.test(base)) correctAnswer = 'am not';
            else if (/\b(is\s+not|isn't|isnt)\b/.test(base)) correctAnswer = "isn't";
            else if (/\b(are\s+not|aren't|arent)\b/.test(base)) correctAnswer = "aren't";
            else {
              const subj = base.split(/\s+/)[0] || '';
              if (subj === 'i') correctAnswer = 'am not';
              else if (['he','she','it'].includes(subj)) correctAnswer = "isn't";
              else correctAnswer = "aren't";
            }
          } else if (isPresentProgressiveYesNo) {
            const sentence = String(item.en || item.exampleSentence || item.word || '');
            const m = sentence.match(/^\s*(Am|Is|Are)\b/i);
            if (m) {
              correctAnswer = m[1].toUpperCase();
            } else {
              const after = sentence.replace(/^\s*(am|is|are)\s+/i, '').trim();
              const subj = (after.split(/\s+/)[0] || '').toLowerCase();
              if (subj === 'i') correctAnswer = 'AM';
              else if (['he','she','it'].includes(subj) || /^the\s+\w+$/i.test(subj)) correctAnswer = 'IS';
              else correctAnswer = 'ARE';
            }
          } else {
            correctAnswer = (item.article || item.ending);
          }
          const correct = userAnswer === correctAnswer;

          // Visual feedback
          btn.style.borderColor = correct ? '#00897b' : '#f44336';
          btn.style.backgroundColor = correct ? '#b2dfdb' : '#ffebee';
          btn.style.color = correct ? '#fff' : '#f44336';

          // Change answer box color to green or red
          const articleBox = document.getElementById('grammarArticleBox');
          if (articleBox) {
            articleBox.style.borderColor = correct ? '#00897b' : '#f44336';
            articleBox.style.backgroundColor = correct ? '#80cbc4' : '#fde8e8';
            articleBox.style.color = correct ? '#fff' : '#c62828';
            const displayAnswer = item.article || item.ending;
            articleBox.innerHTML = `<span style=\"display:inline-block;line-height:1\">${displayAnswer}</span>`;
          }

          if (correct) {
            score++;
            if (playSFX) playSFX('correct');
          } else {
            if (playSFX) playSFX('wrong');
          }
              // Update text color to match feedback (already set above)

          totalAnswered++;

          // Log the attempt to records (same as word modes do)
          try {
            logAttempt({ 
              session_id: sessionId, 
              mode: 'grammar_mode', 
              word: item.id || item.word, 
              is_correct: correct, 
              answer: userAnswer, 
              correct_answer: correctAnswer, 
              points: correct ? 1 : 0, 
              attempt_index: currentIdx, 
              round: currentIdx + 1,
              extra: { word: item.word, emoji: item.emoji || null, category: 'grammar', context: 'game', list: (grammarName || null), file: grammarFile }
            });
          } catch(e) { 
            console.debug('[GrammarMode] logAttempt failed', e?.message); 
          }
          
          // Disable all buttons
          document.querySelectorAll('.grammar-choice-btn').forEach(b => b.disabled = true);

          // Wait before next question
          clearAdvanceTimer();
          advanceTimer = setTimeout(() => {
            if (sessionEnded) return;
            currentIdx++;
            renderGrammarQuestion();
          }, 1500);
        };

        // Hover effect
        btn.onmouseenter = () => {
          if (!btn.disabled) {
            btn.style.transform = 'scale(1.03)';
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }
        };
        btn.onmouseleave = () => {
          btn.style.transform = 'scale(1)';
          btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        };
      });

      // Quit Game button -> return to grammar mode selector
      const quitBtn = document.getElementById('grammarQuitBtn');
      if (quitBtn) {
        quitBtn.onclick = () => {
          sessionEnded = true;
          clearAdvanceTimer();
          try {
            if (window.WordArcade && typeof window.WordArcade.startGrammarModeSelector === 'function') {
              window.WordArcade.startGrammarModeSelector();
            } else if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
              window.WordArcade.quitToOpening(true);
            } else {
              location.hash = '#state-mode_selector';
              location.reload();
            }
          } catch { /* noop */ }
        };
      }
    }

    // ===========================
    // End session and score screen
    // ===========================
    function endGrammarSession() {
      if (sessionEnded) return;
      sessionEnded = true;
      clearAdvanceTimer();
      const accuracy = totalAnswered > 0 ? Math.round((score / totalAnswered) * 100) : 0;
      const sessionDuration = Math.round((Date.now() - sessionStartTime) / 1000);

      // Call endSession with sessionId (matches word-mode pattern exactly)
      try {
        // Use grammarFile path for session tracking to match homework assignment list_key
        const listName = grammarFile || (typeof getListName === 'function' ? getListName() : null) || grammarName || null;
        endSession(sessionId, { 
          mode: 'grammar_mode', 
          summary: { score, total: shuffled.length, correct: score, points: score, pct: accuracy, category: 'grammar', context: 'game', duration_s: sessionDuration, grammarName, grammarFile }, 
          listName, 
          wordList: sessionWords,
          meta: { category: 'grammar', file: grammarFile, grammarName, grammarFile }
        });
      } catch {}

      renderGrammarSummary({
        gameArea,
        score,
        total: shuffled.length,
        ctx
      });
    }

    // Start the first question
    renderGrammarQuestion();

  } catch (error) {
    console.error('[Grammar Mode] Error:', error);
    if (inlineToast) inlineToast(`Error: ${error.message}`);
    if (ctx.showOpeningButtons) ctx.showOpeningButtons(true);
  }
}
