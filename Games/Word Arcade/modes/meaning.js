import { playSFX } from '../sfx.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
// Meaning (drag-and-drop) mode
export function runMeaningMode({ wordList, gameArea, playTTS, preprocessTTS, startGame, listName = null, score: initialScore = 0, round: initialRound = 0 }) {
  const ROUND_SIZE = 5;
  let score = initialScore;
  let round = initialRound;
  const total = wordList.length;
  const correctValue = 100 / total;
  const wrongValue = 50 / total;
  const sessionId = startSession({ mode: 'meaning', wordList, listName });

  // Track which pairs have been completed
  let completedPairs = [];

  // Shuffle overall order once per game so rounds follow a random sequence
  const shuffledOrder = [...wordList].sort(() => Math.random() - 0.5);

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="meaningIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Match English with Korean!</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('meaningIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { renderRound(); }, 650);
  }, 1000);

  function renderRound() {
    // Get next batch of pairs
  const remainingPairs = shuffledOrder.filter(w => !completedPairs.includes(w.eng + '|' + w.kor));
    const roundPairs = remainingPairs.slice(0, ROUND_SIZE);
    if (roundPairs.length === 0) {
  // Game over
      playSFX('end');
  endSession(sessionId, { mode: 'meaning', summary: { score: Number(score.toFixed(1)), total: 100 } });
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
            <h2 style="color:#f59e0b;font-size:2em;margin-bottom:18px;">Game Over!</h2>
            <div style="font-size:1.3em;margin-bottom:12px;">Your Score: <span style="color:#19777e;font-weight:700;">${score.toFixed(1)}%</span></div>
            <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
          </div>`;
      document.getElementById('playAgainBtn').onclick = () => startGame('meaning');
      return;
    }
    // Shuffle for each round
    const engShuffled = [...roundPairs].sort(() => Math.random() - 0.5);
    const korShuffled = [...roundPairs].sort(() => Math.random() - 0.5);
    const engCol = `<div class="eng-col">
      ${engShuffled.map((w, i) => `<div class="eng-card" data-eng="${w.eng}" data-idx="${i}">${w.eng}</div>`).join('')}
    </div>`;
    const korCol = `<div class="kor-col">
      ${korShuffled.map((w, i) => `<div class="kor-target" data-idx="${i}" data-kor="${w.kor}">${w.kor}</div>`).join('')}
    </div>`;
    gameArea.innerHTML = `
      <div id="score-counter" style="margin-bottom:18px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">Score: ${score.toFixed(1)}%<br>Round ${round + 1} / ${Math.ceil(total / ROUND_SIZE)}</div>
      <div class="dragdrop-game">
        <div class="dragdrop-container">
          ${engCol}
          ${korCol}
        </div>
        <div id="dragdrop-feedback" style="margin-top:18px;text-align:center;font-size:1.1em;"></div>
      </div>
    `;

    let activeTTSCard = null;
    let selectedEngCard = null;

    function playCardTTS(card) {
      if (activeTTSCard === card) return;
      activeTTSCard = card;
      const rawText = card.textContent.trim();
      const text = preprocessTTS(rawText);
      playTTS(text);
      setTimeout(() => { if (activeTTSCard === card) activeTTSCard = null; }, 300);
    }

    function explodeAndRemove(element) {
      const rect = element.getBoundingClientRect();
      const parent = element.parentElement;
      const particles = document.createElement('div');
      particles.className = 'particle-explosion';
      particles.style.position = 'absolute';
      particles.style.left = element.offsetLeft + 'px';
      particles.style.top = element.offsetTop + 'px';
      particles.style.width = rect.width + 'px';
      particles.style.height = rect.height + 'px';
      parent.appendChild(particles);
      for (let i = 0; i < 18; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.background = i % 2 ? '#f59e0b' : '#93cbcf';
        p.style.left = (rect.width/2) + 'px';
        p.style.top = (rect.height/2) + 'px';
        particles.appendChild(p);
        setTimeout(() => {
          p.style.transform = `translate(${(Math.random()-0.5)*80}px, ${(Math.random()-0.5)*80}px) scale(0.7)`;
          p.style.opacity = 0;
        }, 10);
      }
      setTimeout(() => { particles.remove(); }, 700);
      element.remove();
    }

    document.querySelectorAll('.eng-card').forEach(card => {
      card.style.cursor = 'pointer';
      card.title = 'Tap to select and hear pronunciation';
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (selectedEngCard) {
          selectedEngCard.classList.remove('selected');
        }
        selectedEngCard = card;
        card.classList.add('selected');
        playCardTTS(card);
        document.getElementById('dragdrop-feedback').textContent = '';
      });
      card.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (selectedEngCard) {
          selectedEngCard.classList.remove('selected');
        }
        selectedEngCard = card;
        card.classList.add('selected');
        playCardTTS(card);
        document.getElementById('dragdrop-feedback').textContent = '';
      });
    });

    document.querySelectorAll('.kor-target').forEach(target => {
      target.style.cursor = 'pointer';
      target.title = 'Tap to match';
      function handleKorTap(e) {
        e.stopPropagation();
        e.preventDefault();
        if (!selectedEngCard) return;
        target.classList.add('pending-match');
        setTimeout(() => {
          handleTapMatch(selectedEngCard, target);
          target.classList.remove('pending-match');
        }, 120);
      }
      target.addEventListener('click', handleKorTap);
      target.addEventListener('touchstart', handleKorTap);
    });

    function handleTapMatch(engCard, korCard) {
      if (korCard.classList.contains('matched') || engCard.classList.contains('matched')) return;
      const eng = engCard.dataset.eng;
      const kor = korCard.dataset.kor;
      const match = roundPairs.find(w => w.eng === eng && w.kor === kor);
      const feedback = document.getElementById('dragdrop-feedback');
      const scoreCounter = document.getElementById('score-counter');
        if (match) {
          korCard.classList.add('matched');
          engCard.classList.add('matched');
          explodeAndRemove(korCard);
          explodeAndRemove(engCard);
          score += correctValue;
          completedPairs.push(eng + '|' + kor);
          feedback.textContent = `Correct! +${correctValue.toFixed(1)}%`;
          playSFX('correct');
        } else {
          korCard.classList.add('wrong');
          engCard.classList.add('wrong');
          setTimeout(() => {
            korCard.classList.remove('wrong');
            engCard.classList.remove('wrong');
          }, 700);
          score -= wrongValue;
          feedback.textContent = `Incorrect! -${wrongValue.toFixed(1)}%`;
          playSFX('wrong');
      }
      // Log attempt for this pair selection (points as integers to satisfy DB integer type)
      logAttempt({
        session_id: sessionId,
        mode: 'meaning',
        word: eng,
        is_correct: !!match,
        answer: kor,
        correct_answer: (roundPairs.find(w => w.eng === eng) || {}).kor || null,
        points: match ? 1 : 0,
        extra: { eng, kor }
      });
  scoreCounter.innerHTML = `Score: ${score.toFixed(1)}%<br>Round ${round + 1} / ${Math.ceil(total / ROUND_SIZE)}`;
      if (selectedEngCard) {
        selectedEngCard.classList.remove('selected');
        selectedEngCard = null;
      }
      // If all pairs in this round are matched, go to next round
      setTimeout(() => {
        if (document.querySelectorAll('.eng-card').length === 0) {
          round++;
          renderRound();
        }
      }, 750);
    }
  }

  // First round is triggered after the intro fades out
}
