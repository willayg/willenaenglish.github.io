import { playSFX } from '../sfx.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';

// Meaning mode (definition → 4 choices) — audio-free, uses definitions from game_data.words JSON
export function runMeaningMode({ wordList, gameArea, startGame, listName = null }) {
  const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);

  // Normalize/guard input
  const words = Array.isArray(wordList) ? wordList.filter(w => w && w.eng) : [];
  const total = words.length;
  const sessionId = startSession({ mode: 'meaning', wordList: words, listName });
  let score = 0;
  let index = 0;
  const order = shuffle([...words]);

  const definitionOf = (w) => {
    const raw = (w && (w.def || w.definition || w.gloss || w.meaning)) || '';
    const t = String(raw).replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, 220) : 'Choose the word that best matches this meaning.';
  };

  const ensurePoppins = () => {
    try {
      if (!document.getElementById('wa_poppins_font')) {
        const l = document.createElement('link');
        l.id = 'wa_poppins_font';
        l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap';
        document.head.appendChild(l);
      }
    } catch {}
  };

  function renderRound() {
    if (index >= order.length) return end();
    ensurePoppins();

    const target = order[index];
    const prompt = definitionOf(target);
    const pool = words.filter(w => w.eng !== target.eng);
    const distractors = shuffle(pool).slice(0, Math.min(3, Math.max(0, pool.length)));
    const options = shuffle([target, ...distractors]);

    gameArea.innerHTML = `
      <div style="max-width:720px;margin:0 auto;padding:16px;font-family:'Poppins', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
        <div style="text-align:center;margin-bottom:10px;color:#19777e;font-weight:700;">Meaning Mode</div>
        <div id="defBox" style="background:#fff;border:2px solid #cfe8ea;border-radius:14px;padding:16px 18px;margin-bottom:16px;color:#0f172a;font-size:1.05rem;line-height:1.5;min-height:64px;">${prompt}</div>
        <div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          ${options.map(o => `<button class="opt" data-eng="${o.eng}" style="padding:14px 12px;border-radius:12px;border:2px solid #e2e8f0;background:#f8fafc;font-weight:700;color:#0f172a;cursor:pointer;">${o.eng}</button>`).join('')}
        </div>
        <div style="margin-top:14px;text-align:center;color:#334155;">${index + 1} / ${total}</div>
      </div>`;

    gameArea.querySelectorAll('button.opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.getAttribute('data-eng');
        const correct = choice === target.eng;
        btn.style.borderColor = correct ? '#22c55e' : '#ef4444';
        btn.style.background = correct ? '#dcfce7' : '#fee2e2';
        if (correct) playSFX('correct'); else playSFX('wrong');

        if (correct) score += 1;

        logAttempt({
          session_id: sessionId,
          mode: 'meaning',
          word: target.eng,
          is_correct: correct,
          answer: choice,
          correct_answer: target.eng
        });

        setTimeout(() => { index += 1; renderRound(); }, 600);
      });
    });
  }

  function end() {
    const pct = total ? Math.round((score / total) * 100) : 0;
    endSession(sessionId, { mode: 'meaning', summary: { score: pct, total: 100 } });
    gameArea.innerHTML = `
      <div style="text-align:center;padding:32px 16px;font-family:'Poppins', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
        <h2 style="color:#f59e0b;margin:0 0 8px;">All done!</h2>
        <div style="margin-bottom:14px;">Score: <b style="color:#19777e;">${pct}%</b></div>
        <button id="again" style="padding:10px 18px;border-radius:12px;background:#93cbcf;color:#fff;border:none;font-weight:700;cursor:pointer;">Play again</button>
      </div>`;
    const again = document.getElementById('again');
    if (again) again.onclick = () => startGame('meaning');
  }

  renderRound();
}
