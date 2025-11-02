// Grammar Mode Engine - Article selection (a vs an)
// Works as a choice mode where students pick between "a" or "an" for each word

import { startSession, logAttempt, endSession } from '../../../students/records.js';

export async function runGrammarMode(ctx) {
  const {
    playTTS, playTTSVariant, preprocessTTS,
    grammarFile, grammarName,
    renderGameView, showModeModal, playSFX, inlineToast,
    getListName, getUserId, FN
  } = ctx || {};

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

  // Shuffle items for variety and limit to 15 questions per session
  const shuffled = [...grammarData].sort(() => Math.random() - 0.5).slice(0, 15);
    let currentIdx = 0;
    let score = 0;
    let totalAnswered = 0;
    const sessionStartTime = Date.now();
    // Create a proper tracking session (records.js) so backend receives session_start
    const sessionId = (function(){
      try {
        const listName = (typeof getListName === 'function' ? getListName() : null) || grammarName || null;
        return startSession({
          mode: 'grammar_mode',
          wordList: Array.isArray(grammarData) ? grammarData.map(it => it.word) : [],
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

    // ===========================
    // Core game render function
    // ===========================
    async function renderGrammarQuestion() {
      if (currentIdx >= shuffled.length) {
        endGrammarSession();
        return;
      }

      const item = shuffled[currentIdx];
      const isLastQuestion = currentIdx === shuffled.length - 1;

      // Main content (no example or translation).
      // Use CSS classes so sizes can scale with viewport height/width (vmin) without overflow.
      const contentHTML = `
        <div class="grammar-stage">
          <!-- Progress indicator -->
          <div class="progress-label">Question ${currentIdx + 1} of ${shuffled.length}</div>

          <!-- Main question -->
          <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:6px;">
            ${item.emoji ? `<div class="emoji">${item.emoji}</div>` : ''}
            <div id="grammarArticleBox"></div>
            <div class="grammar-word">${item.word}</div>
          </div>

          <!-- Answer buttons -->
          <div class="grammar-answers">
            <button class="grammar-choice-btn" data-answer="a">a</button>
            <button class="grammar-choice-btn" data-answer="an">an</button>
          </div>
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
          const correct = userAnswer === item.article;

          // Visual feedback
          btn.style.borderColor = correct ? '#4caf50' : '#f44336';
          btn.style.backgroundColor = correct ? '#e8f5e9' : '#ffebee';

          // Change answer box color to green or red
          const articleBox = document.getElementById('grammarArticleBox');
          if (articleBox) {
            articleBox.style.borderColor = correct ? '#4caf50' : '#f44336';
            articleBox.style.backgroundColor = correct ? '#c8e6c9' : '#fde8e8';
            articleBox.style.color = correct ? '#2e7d32' : '#c62828';
            articleBox.innerHTML = `<span style=\"display:inline-block;line-height:1\">${item.article}</span>`;
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
              correct_answer: item.article, 
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
          await new Promise(r => setTimeout(r, 1500));
          currentIdx++;
          renderGrammarQuestion();
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

      // Use the global fixed quit button provided by game_view.js; no duplicate in-content button needed here.
    }

    // ===========================
    // End session and score screen
    // ===========================
    function endGrammarSession() {
      const accuracy = totalAnswered > 0 ? Math.round((score / totalAnswered) * 100) : 0;
      const sessionDuration = Math.round((Date.now() - sessionStartTime) / 1000);

      // Fire session-ended event so header/dashboard updates (like word modes do)
      try {
        const ev = new CustomEvent('wa:session-ended', { 
          detail: { 
            summary: { 
              score: score,           // points earned in this session
              total: shuffled.length,  // max possible points
              accuracy: accuracy
            } 
          } 
        });
        window.dispatchEvent(ev);
      } catch {}

      // Call endSession with sessionId (matches word-mode pattern exactly)
      try {
        const listName = (typeof getListName === 'function' ? getListName() : null) || grammarName || null;
        endSession(sessionId, { mode: 'grammar_mode', summary: { score, total: shuffled.length, correct: score, points: score, pct: accuracy, category: 'grammar', context: 'game' }, listName, wordList: grammarData });
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
