// Picture mode: show image or emoji, student picks the correct English word
import { playSFX } from '../sfx.js';

// Simple emoji lookup for common words (animals + basics). Add more as needed.
const emojiMap = {
  // animals
  dog: '🐶', cat: '🐱', rabbit: '🐰', horse: '🐴', cow: '🐮', pig: '🐷', sheep: '🐑', goat: '🐐', chicken: '🐔', duck: '🦆', mouse: '🐭', bear: '🐻', tiger: '🐯', lion: '🦁', elephant: '🐘', monkey: '🐒', fox: '🦊', wolf: '🐺', deer: '🦌', squirrel: '🐿️',
  // transport
  car: '🚗', bus: '🚌', train: '🚆', plane: '✈️', airplane: '✈️', boat: '🛥️', ship: '🚢', bicycle: '🚲', bike: '🚲', motorcycle: '🏍️', truck: '🚚',
  // food
  apple: '🍎', banana: '🍌', orange: '🍊', grape: '🍇', grapes: '🍇', pineapple: '🍍', strawberry: '🍓', watermelon: '🍉', peach: '🍑',
  // places/objects
  house: '🏠', school: '🏫', tree: '🌳', flower: '🌸', book: '📖', pencil: '✏️', pen: '🖊️', chair: '🪑', table: '🛋️', computer: '💻', phone: '📱', clock: '🕒', 
  // nature
  sun: '☀️', moon: '🌙', star: '⭐', cloud: '☁️', rain: '🌧️', snow: '❄️',
  // sports
  ball: '⚽', soccer: '⚽', basketball: '🏀', football: '🏈'
};

export function runPictureMode({ wordList, gameArea, startGame }) {
  // Only use words with an image or emoji
  const available = wordList.filter(w => w.img || emojiMap[w.eng.toLowerCase()]);
  if (!available.length) {
    gameArea.innerHTML = `<div style="padding:40px;text-align:center;color:#888;font-size:1.2em;">No images or emojis available for this word list.</div>`;
    return;
  }
  let score = 0;
  let idx = 0;

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="picIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Which word matches the picture?</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('picIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { renderQuestion(); }, 650);
  }, 1000);

  function renderQuestion() {
    if (idx >= available.length) {
      playSFX('end');
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;"><h2 style="color:#41b6beff;">Picture Mode Complete!</h2><div style="font-size:1.3em;margin-bottom:12px;">Score: <span style="color:#19777e;font-weight:700;">${score} / ${available.length}</span></div><button id="playAgainPic" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button></div>`;
      document.getElementById('playAgainPic').onclick = () => startGame('picture');
      return;
    }
    const current = available[idx];
    // Pick 3 distractors
    const choices = [current.eng];
    const pool = available.filter(w => w.eng !== current.eng);
    while (choices.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      choices.push(pick.eng);
    }
    choices.sort(() => Math.random() - 0.5);
    // Render image or emoji
    let imgHtml = '';
    if (current.img) {
      imgHtml = `<img src="${current.img}" alt="${current.eng}" style="max-width:180px;max-height:180px;border-radius:16px;box-shadow:0 2px 8px #ccc;margin-bottom:18px;">`;
    } else if (emojiMap[current.eng.toLowerCase()]) {
      imgHtml = `<div style="font-size:5em;margin-bottom:18px;">${emojiMap[current.eng.toLowerCase()]}</div>`;
    }
    gameArea.innerHTML = `<div style="padding:24px;text-align:center;">
      <div style="margin-bottom:18px;">${imgHtml}</div>
      <div id="picChoices" style="display:grid;grid-template-columns:repeat(2, minmax(40vw, 1fr));gap:16px;max-width:92vw;margin:0 auto;">
        ${choices.map(w => `
          <button class=\"pic-choice\" data-eng=\"${w}\" style=\"height:20vh;border-radius:5px;background:#f7f7f7;color:#19777e;font-weight:800;border:3px solid #41b6beff;box-shadow:0 3px 10px rgba(60,60,80,0.10);cursor:pointer;font-size:clamp(1.2em,4vw,2.5em);display:flex;align-items:center;justify-content:center;transition:transform .08s ease;\">
            ${w}
          </button>
        `).join('')}
      </div>
      <div id="picFeedback" style="margin-top:16px;font-size:1.1em;height:24px;color:#555;"></div>
    </div>`;
    // Add button press animation and ensure consistent tile feel
    document.querySelectorAll('.pic-choice').forEach(btn => {
      btn.onmousedown = () => { btn.style.transform = 'scale(0.98)'; };
      btn.onmouseup = () => { btn.style.transform = 'scale(1)'; };
      btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
    });
    document.querySelectorAll('.pic-choice').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.eng === current.eng) {
          score++;
          playSFX('correct');
          document.getElementById('picFeedback').textContent = 'Correct!';
        } else {
          playSFX('wrong');
          document.getElementById('picFeedback').textContent = 'Incorrect!';
        }
        setTimeout(() => { idx++; renderQuestion(); }, 900);
      };
    });
  }

  // First question is triggered after the intro fades out
}
