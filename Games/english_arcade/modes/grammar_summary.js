// Shared Grammar Session Summary Helper
// Renders the unified "Session Complete" screen used across grammar modes.

export function renderGrammarSummary({ gameArea, score = 0, total = 0, ctx } = {}) {
  const container = gameArea || document.getElementById('gameArea');
  if (!container) return;

  const totalAnswered = total || 0;
  const accuracy = totalAnswered > 0
    ? Math.round((Number(score) / Number(totalAnswered)) * 100)
    : 0;

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

  container.innerHTML = summaryHTML;

  const backBtn = document.getElementById('grammarBackToMenuBtn');
  if (backBtn) {
    backBtn.onclick = () => {
      try {
        if (window.WordArcade && typeof window.WordArcade.startGrammarModeSelector === 'function') {
          window.WordArcade.startGrammarModeSelector();
        } else if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
          window.WordArcade.quitToOpening(true);
        } else if (ctx && ctx.showOpeningButtons) {
          ctx.showOpeningButtons(true);
        }
      } catch (e) {
        console.warn('[GrammarSummary] BackToMenu failed', e);
      }
    };
  }
}
