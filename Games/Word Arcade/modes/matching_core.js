// Shared Matching (formerly Meaning) core implementation without audio dependencies.
// Exports a function runMatchingCore(context, options) used by both meaning.js (legacy) and matching.js (new alias).
// The context provides: wordList, gameArea, startGame, listName, (optional) score, round.
// Audio (TTS) has been removed per requirement.

import { playSFX } from '../sfx.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';
import { ensureMatchingStyles } from '../ui/matching_styles.js';

export function runMatchingCore({ wordList, gameArea, startGame, listName = null, score: initialScore = 0, round: initialRound = 0 }, { sessionModeKey = 'matching', introTitle = 'Match English with Korean!', roundSize = 5 } = {}) {
  ensureMatchingStyles();
  const ROUND_SIZE = roundSize;
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let score = initialScore;
  let round = initialRound;
  const total = wordList.length;
  const correctValue = 100 / total;
  const wrongValue = 50 / total;
  const sessionId = startSession({ mode: sessionModeKey, wordList, listName });
  let completedPairs = [];
  const shuffledOrder = [...wordList].sort(() => Math.random() - 0.5);

  gameArea.innerHTML = `
    <div id="matchingIntro" class="meaning-mode-root" style="display:flex;align-items:center;justify-content:center;width:100%;margin:0 auto;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;max-width:90%;margin:0 auto;">${introTitle}</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('matchingIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { showGameProgress(total, 0); renderRound(); }, 650);
  }, 1000);

  function renderRound() {
    let interactionLocked = false;
    const remainingPairs = shuffledOrder.filter(w => !completedPairs.includes(w.eng + '|' + w.kor));
    const roundPairs = remainingPairs.slice(0, ROUND_SIZE);
    if (roundPairs.length === 0) {
      playSFX('end');
      endSession(sessionId, { mode: sessionModeKey, summary: { score: Number(score.toFixed(1)), total: 100 } });
      hideGameProgress();
        const isLivePlay = !!document.getElementById('gameStage');
        gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
        <h2 style="color:#f59e0b;font-size:2em;margin-bottom:18px;">Game Over!</h2>
        ${isReview ? '' : `<div style="font-size:1.3em;margin-bottom:12px;">Your Score: <span style=\"color:#19777e;font-weight:700;\">${score.toFixed(1)}%</span></div>`}
        <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
          ${isLivePlay ? '' : `<button id=\"tryMoreMatching\" style=\"font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;\">Try More</button>`}
      </div>`;
      document.getElementById('playAgainBtn').onclick = () => startGame(sessionModeKey);
      const moreBtn = document.getElementById('tryMoreMatching');
      if (moreBtn) {
        moreBtn.onclick = () => {
          if (window.WordArcade && typeof window.WordArcade.startModeSelector === 'function') {
            window.WordArcade.startModeSelector();
          } else {
            startGame(sessionModeKey);
          }
        };
      }
      return;
    }

    const engShuffled = [...roundPairs].sort(() => Math.random() - 0.5);
    const korShuffled = [...roundPairs].sort(() => Math.random() - 0.5);
    const engCol = `<div class="eng-col">${engShuffled.map((w,i)=>`<div class="eng-card" data-eng="${w.eng}" data-idx="${i}">${w.eng}</div>`).join('')}</div>`;
    const korCol = `<div class="kor-col">${korShuffled.map((w,i)=>`<div class="kor-target" data-idx="${i}" data-kor="${w.kor}">${w.kor}</div>`).join('')}</div>`;

    gameArea.innerHTML = `
      <div class="meaning-mode-root" style="padding:0;">
        <div id="score-counter" style="margin-bottom:18px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? `Round ${round + 1} / ${Math.ceil(total / ROUND_SIZE)}` : `Score: ${score.toFixed(1)}%<br>Round ${round + 1} / ${Math.ceil(total / ROUND_SIZE)}`}</div>
        <div class="dragdrop-game">
          <div class="dragdrop-container">${engCol}${korCol}</div>
          <div id="dragdrop-feedback" style="margin-top:18px;text-align:center;font-size:1.1em;"></div>
        </div>
      </div>`;

    let selectedEngCard = null;

    document.querySelectorAll('.eng-card').forEach(card => {
      card.style.cursor = 'pointer';
      card.title = 'Tap to select';
      card.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (selectedEngCard) selectedEngCard.classList.remove('selected');
        selectedEngCard = card; card.classList.add('selected');
        document.getElementById('dragdrop-feedback').textContent = '';
      });
      card.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (selectedEngCard) selectedEngCard.classList.remove('selected');
        selectedEngCard = card; card.classList.add('selected');
        document.getElementById('dragdrop-feedback').textContent = '';
      });
    });

    document.querySelectorAll('.kor-target').forEach(target => {
      target.style.cursor = 'pointer';
      target.title = 'Tap to match';
      function handleKorTap(e){
        e.stopPropagation(); e.preventDefault();
        if (!selectedEngCard) return;
        target.classList.add('pending-match');
        setTimeout(()=>{ handleTapMatch(selectedEngCard, target); target.classList.remove('pending-match'); },120);
      }
      target.addEventListener('click', handleKorTap);
      target.addEventListener('touchstart', handleKorTap);
    });

    function explodeAndRemove(element){
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
      for (let i=0;i<18;i++){
        const p=document.createElement('div');
        p.className='particle';
        p.style.background = i % 2 ? '#f59e0b' : '#93cbcf';
        p.style.left=(rect.width/2)+'px';
        p.style.top=(rect.height/2)+'px';
        particles.appendChild(p);
        setTimeout(()=>{ p.style.transform=`translate(${(Math.random()-0.5)*80}px, ${(Math.random()-0.5)*80}px) scale(0.7)`; p.style.opacity=0; },10);
      }
      setTimeout(()=>{ particles.remove(); },700);
      element.remove();
    }

    function handleTapMatch(engCard, korCard){
      if (interactionLocked) return; interactionLocked = true;
      if (korCard.classList.contains('matched') || engCard.classList.contains('matched')) return;
      const eng = engCard.dataset.eng; const kor = korCard.dataset.kor;
      const match = roundPairs.find(w => w.eng === eng && w.kor === kor);
      const feedback = document.getElementById('dragdrop-feedback');
      const scoreCounter = document.getElementById('score-counter');
      if (match){
        korCard.classList.add('matched'); engCard.classList.add('matched');
        explodeAndRemove(korCard); explodeAndRemove(engCard);
        score += correctValue; completedPairs.push(eng + '|' + kor);
        updateGameProgress(completedPairs.length, total);
        feedback.textContent = isReview ? 'Correct!' : `Correct! +${correctValue.toFixed(1)}%`;
        playSFX('correct');
      } else {
        korCard.classList.add('wrong'); engCard.classList.add('wrong');
        setTimeout(()=>{ korCard.classList.remove('wrong'); engCard.classList.remove('wrong'); },700);
        score -= wrongValue; feedback.textContent = isReview ? 'Incorrect!' : 'Incorrect!';
        playSFX('wrong');
      }
      logAttempt({
        session_id: sessionId,
        mode: sessionModeKey,
        word: eng,
        is_correct: !!match,
        answer: kor,
        correct_answer: (roundPairs.find(w => w.eng === eng) || {}).kor || null,
        extra: { eng, kor }
      });
      scoreCounter.innerHTML = isReview ? `Round ${round + 1} / ${Math.ceil(total / ROUND_SIZE)}` : `Score: ${score.toFixed(1)}%<br>Round ${round + 1} / ${Math.ceil(total / ROUND_SIZE)}`;
      if (selectedEngCard){ selectedEngCard.classList.remove('selected'); selectedEngCard = null; }
      setTimeout(()=>{
        interactionLocked = false;
        if (document.querySelectorAll('.eng-card').length === 0){ round++; renderRound(); }
      },750);
    }
  }
}
