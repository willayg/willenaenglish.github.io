// Grammar Mode Engine - Article selection (a vs an)
// Works as a choice mode where students pick between "a" or "an" for each word

import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { buildPrepositionScene, isInOnUnderMode } from './grammar_prepositions_data.js';

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

  try {
    // Load grammar data
    const response = await fetch(grammarFile);
    if (!response.ok) throw new Error(`Failed to load ${grammarFile}`);
    const grammarData = await response.json();
    
    if (!Array.isArray(grammarData) || grammarData.length === 0) {
      throw new Error('Invalid grammar data format');
    }

    console.log('[Grammar Mode] Loaded', grammarData.length, 'grammar items');

    // Extract answer choices from config (e.g., ['a', 'an'] or ['it', 'they'])
    const answerChoices = (grammarConfig && grammarConfig.answerChoices && Array.isArray(grammarConfig.answerChoices))
      ? grammarConfig.answerChoices
      : ['a', 'an']; // Default fallback

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
        const listName = (typeof getListName === 'function' ? getListName() : null) || grammarName || null;
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
      const questionText = (hasProximityMode && highlightedPrompt) ? highlightedPrompt : (inOnUnderMode && highlightedPrompt ? highlightedPrompt : displayText);
      const visualCueHTML = hasProximityMode
        ? buildProximityScene(item?.article, item?.emoji)
        : (inOnUnderMode ? buildPrepositionScene(item?.article, item?.emoji, item?.word) : (item.emoji ? `<div style="font-size:4.6rem;line-height:1;margin-bottom:30px;">${item.emoji}</div>` : ''));

      // Main content (no example or translation). Show a fixed-size article box and the word in bright cyan.
          const contentHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:32px;padding:24px;max-width:640px;margin:0 auto;">
              <!-- Progress indicator -->
              <div style="width:100%;text-align:center;font-size:1rem;color:#666;font-weight:600;margin-top:4px;margin-bottom:4px;">
                Question ${currentIdx + 1} of ${shuffled.length}
              </div>
  
          <!-- Main question -->
          <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:6px;">
            ${visualCueHTML}
            ${!inOnUnderMode ? `<div id="grammarArticleBox" style="display:inline-flex;align-items:center;justify-content:center;width:90px;height:52px;border:3px solid #d1e6f0;border-radius:14px;background:#fff;vertical-align:middle;font-size:1.92rem;font-weight:800;color:#21b3be;font-family:'Poppins', Arial, sans-serif;transition:all 0.2s;"></div>` : ''}
            ${!inOnUnderMode ? `<div style="font-size:clamp(1.8rem, 8vw, 4.56rem);font-weight:800;color:#21b3be;letter-spacing:0.02em;max-width:min(90vw, 500px);word-wrap:break-word;overflow-wrap:break-word;line-height:1.3;padding:0 8px;white-space:normal;">${isThisThatMode ? sanitizeText(item?.word || '') : questionText}</div>` : ''}
          </div>              <!-- Answer buttons (extra spacing above) -->
              <div style="display:flex;gap:clamp(12px, 3vw, 20px);width:100%;max-width:460px;justify-content:center;margin-top:40px;margin-bottom:8px;flex-wrap:wrap;">
                ${answerChoices.map((choice, idx) => `
                  <button class="grammar-choice-btn" data-answer="${choice}" style="flex:1;min-width:clamp(90px, 18vw, 140px);padding:clamp(12px, 2.5vh, 16px) clamp(16px, 3vw, 24px);font-size:clamp(1.1rem, 3vw, 1.5rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-transform:lowercase;font-family:'Poppins', Arial, sans-serif;">
                    ${choice}
                  </button>
                `).join('')}
              </div>
  
              <!-- Spacer pushes the quit button to the bottom -->
              <div style="flex:1;width:100%;"></div>
  
              <!-- Quit button -->
              <button id="grammarQuitBtn" class="wa-quit-btn" style="margin-top:auto;margin-bottom:8px;align-self:center;background:#fff;color:#6273e4;border:2px solid #39d5da;font-weight:800;cursor:pointer;">
                Quit Game
              </button>
            </div>
          `;

      // Render directly in the game area with progress
      setView({
        content: contentHTML,
        showProgressBar: true,
        progressValue: currentIdx + 1,
        progressMax: shuffled.length
      });

      // Bind answer buttons
      document.querySelectorAll('.grammar-choice-btn').forEach(btn => {
        btn.onclick = async () => {
          const userAnswer = btn.getAttribute('data-answer');
          // Support both article (for a/an) and ending (for contractions)
          const correctAnswer = item.article || item.ending;
          const correct = userAnswer === correctAnswer;

          // Visual feedback
          btn.style.borderColor = correct ? '#4caf50' : '#f44336';
          btn.style.backgroundColor = correct ? '#e8f5e9' : '#ffebee';

          // Change answer box color to green or red
          const articleBox = document.getElementById('grammarArticleBox');
          if (articleBox) {
            articleBox.style.borderColor = correct ? '#4caf50' : '#f44336';
            articleBox.style.backgroundColor = correct ? '#c8e6c9' : '#fde8e8';
            articleBox.style.color = correct ? '#2e7d32' : '#c62828';
            const displayAnswer = item.article || item.ending;
            articleBox.innerHTML = `<span style=\"display:inline-block;line-height:1\">${displayAnswer}</span>`;
          }

          if (correct) {
            score++;
            if (playSFX) playSFX('correct');
          } else {
            if (playSFX) playSFX('wrong');
          }
              // Update text color to match feedback (redundant safety)
              btn.style.color = correct ? '#2e7d32' : '#c62828';

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
        const listName = (typeof getListName === 'function' ? getListName() : null) || grammarName || null;
        endSession(sessionId, { mode: 'grammar_mode', summary: { score, total: shuffled.length, correct: score, points: score, pct: accuracy, category: 'grammar', context: 'game', duration_s: sessionDuration }, listName, wordList: sessionWords });
      } catch {}

      const summaryHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:24px;padding:20px;max-width:600px;margin:0 auto;">
          <div style="font-size:2.5rem;font-weight:700;color:#19777e;">Session Complete!</div>
          
          <div style="font-size:1.1rem;color:#666;font-weight:500;">Your Results:</div>

          <div style="background:#f6feff;border-radius:12px;padding:20px;width:100%;max-width:400px;text-align:center;border:2px solid #27c5ca;">
            <div style="display:flex;justify-content:space-around;gap:16px;">
              <div>
                <div style="font-size:2rem;font-weight:700;color:#4caf50;">${score}</div>
                <div style="font-size:0.9rem;color:#666;margin-top:4px;">Correct</div>
              </div>
              <div style="width:2px;background:#e0e0e0;"></div>
              <div>
                <div style="font-size:2rem;font-weight:700;color:#19777e;">${accuracy}%</div>
                <div style="font-size:0.9rem;color:#666;margin-top:4px;">Accuracy</div>
              </div>
            </div>
          </div>

          <button id="grammarBackToMenuBtn" style="padding:12px 32px;border-radius:8px;background:#19777e;color:#fff;border:none;font-weight:700;font-size:1rem;cursor:pointer;box-shadow:0 2px 8px rgba(25,119,126,0.2);">
            Back to Menu
          </button>
        </div>
      `;

      setView({ content: summaryHTML, showProgressBar: false });

      const backBtn = document.getElementById('grammarBackToMenuBtn');
      if (backBtn) {
        backBtn.onclick = () => {
          // Return to grammar mode selector after session
          if (window.WordArcade && typeof window.WordArcade.startGrammarModeSelector === 'function') {
            window.WordArcade.startGrammarModeSelector();
          } else if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
            window.WordArcade.quitToOpening(true);
          } else if (ctx.showOpeningButtons) {
            ctx.showOpeningButtons(true);
          }
        };
      }
    }

    // Start the first question
    renderGrammarQuestion();

  } catch (error) {
    console.error('[Grammar Mode] Error:', error);
    if (inlineToast) inlineToast(`Error: ${error.message}`);
    if (ctx.showOpeningButtons) ctx.showOpeningButtons(true);
  }
}
