import { participlesQuestions } from './participles_contents.js';

// Declare variables up top, assign inside DOMContentLoaded
let startScreen, quizScreen, endScreen, emojiDiv, optionsDiv, scoreSpan, timerSpan, finalScoreSpan, highscoresList, submitBtn, playAgainBtn, nameInput, bgMusic, soundToggle, musicToggle;

let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timer = null;
let timeLeft = 25; // 25 seconds for the whole game
let soundMuted = false;
let musicMuted = true; // Default music to muted
let questionStartTime = 0;
let correctStreak = 0;

const correctResponses = [
  "Nice job!", "You're Awesome!", "Wow! That was right!", "You got it right!", "That's the correct answer. Cool!"
];
const wrongResponses = [
  "That's too bad.", "You got that one wrong.", "Oops.", "Oh my!", "You made a mistake."
];

// Add your funny/anonymous names here!
const funnyNames = [
  "Nobody",
  "Ghost",
  "Invisible Human",
  "Guess who I am",
  "Mystery Potato",
  "Captain Unknown",
  "The Phantom",
  "Secret Squirrel",
  "Unseen Ninja",
  "Masked Genius"
];

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function startGame() {
  questions = participlesQuestions.slice();
  shuffle(questions);
  currentQuestionIndex = 0;
  score = 0;
  timeLeft = 25;
  scoreSpan.textContent = score;
  timerSpan.textContent = timeLeft;
  startScreen.style.display = 'none';
  quizScreen.style.display = 'block';
  endScreen.style.display = 'none';
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    timerSpan.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timer);
      endGame();
    }
  }, 1000);
  showQuestion();
  correctStreak = 0;
}

function showQuestion() {
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  const q = questions[currentQuestionIndex];
  emojiDiv.textContent = q.base;
  optionsDiv.innerHTML = '';
  const choices = shuffle(q.options.slice());
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice.charAt(0).toUpperCase() + choice.slice(1);
    btn.disabled = false;
    btn.onclick = () => checkAnswer(choice, btn);
    optionsDiv.appendChild(btn);
  });
  questionStartTime = Date.now();
}

function checkAnswer(choice, btnClicked) {
  const q = questions[currentQuestionIndex];
  const buttons = document.querySelectorAll('#options button');
  const correctText = q.answer.toLowerCase();
  buttons.forEach(btn => btn.disabled = true);
  const answerTime = (Date.now() - questionStartTime) / 1000;
  let bonus = 0, penalty = 0;

  if (choice.toLowerCase() !== correctText) {
    btnClicked.style.backgroundColor = '#e53935';
    btnClicked.style.color = '#fff';
    playFeedbackAudio('wrong');
    score -= 100;
    if (answerTime <= 0.5) {
      penalty = 200;
      score -= penalty;
    }
    correctStreak = 0; // reset streak on wrong answer
  } else {
    playFeedbackAudio('correct');
    score += 300;
    if (answerTime <= 0.8) {
      bonus = 150;
      score += bonus;
    }
    btnClicked.style.backgroundColor = '#43a047';
    btnClicked.style.color = '#fff';
    correctStreak++;
    // 1 second bonus for every 3 right answers
    if (correctStreak > 0 && correctStreak % 3 === 0) {
      timeLeft += 1;
      timerSpan.textContent = timeLeft;
    }
    // 500 point bonus for every 5 right answers
    if (correctStreak > 0 && correctStreak % 5 === 0) {
      score += 500;
    }
  }
  scoreSpan.textContent = score;
  setTimeout(nextQuestion, 500);
}

function nextQuestion() {
  currentQuestionIndex++;
  showQuestion();
}

function playEndGameVoice(finalScore) {
  let file;
  if (finalScore < 0) file = "end_bad.mp3";
  else if (finalScore > 2300) file = "end_outstanding.mp3";
  else if (finalScore > 1300) file = "end_good.mp3";
  else if (finalScore > 800) file = "end_fair.mp3";
  else file = "end_bad.mp3";
  const url = "../../Assets/Audio/voices/steve/" + file;
  const audio = new Audio(url);
  audio.play().catch(e => { console.warn("End game audio not found or not allowed to play:", url, e); });
}

function endGame() {
  quizScreen.style.display = 'none';
  endScreen.style.display = 'block';
  finalScoreSpan.textContent = score;
  playEndGameVoice(score);
  displayHighScores();
  if (timer) clearInterval(timer);

  // --- AUTO SUBMIT IF LOGGED IN (Fruti style) ---
  // Try to get user info from storage
  const user_id = localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || null;
  const user_name = localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';

  if (user_id && user_name) {
    nameInput.value = user_name;
    nameInput.style.display = 'none';
    submitBtn.style.display = 'none';
    playAgainBtn.style.display = 'none';
    if (!endGame._submitted) {
      endGame._submitted = true;
      submitScore(user_name, user_id);
    }
  } else {
    submitBtn.style.display = '';
    nameInput.style.display = '';
    playAgainBtn.style.display = '';
    endGame._submitted = false;
  }
}

function playFeedbackAudio(type) {
  if (soundMuted) return;
  const correctFiles = ["pos_1.mp3","pos_2.mp3","pos_3.mp3","pos_4.mp3","pos_5.mp3"];
  const wrongFiles = ["neg_1.mp3","neg_2.mp3","neg_3.mp3","neg_4.mp3","neg_5.mp3"];
  let fileList = type === "correct" ? correctFiles : wrongFiles;
  let file = fileList[Math.floor(Math.random() * fileList.length)];
  let url = "../../Assets/Audio/voices/steve/" + file;
  const audio = new Audio(url);
  audio.muted = soundMuted;
  audio.play().catch(e => {
    console.warn("Audio not found or not allowed to play:", url, e);
  });
}

// THIS IS THE KEY FUNCTION FOR SUPABASE HIGH SCORES
async function displayHighScores() {
  highscoresList.innerHTML = '<li>Loading...</li>';
  try {
    const response = await fetch('/.netlify/functions/submit_score?game=ParticiplesGame');
    if (!response.ok) {
      highscoresList.innerHTML = '<li>Failed to load scores</li>';
      return;
    }
    const data = await response.json();
    highscoresList.innerHTML = '';

    // Keep only the highest score per player (case-insensitive)
    const bestScores = {};
    (Array.isArray(data) ? data : []).forEach(entry => {
      const nameKey = (entry.name || 'Anonymous').trim().toLowerCase();
      if (!bestScores[nameKey] || entry.score > bestScores[nameKey].score) {
        bestScores[nameKey] = entry;
      }
    });

    // Convert to array and sort by score descending, then take top 10
    const sorted = Object.values(bestScores)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    sorted.forEach((entry, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1}. ${entry.name || 'Anonymous'} - ${entry.score}`;
      highscoresList.appendChild(li);
    });

    if (sorted.length === 0) {
      highscoresList.innerHTML = '<li>No scores yet</li>';
    }
  } catch (e) {
    highscoresList.innerHTML = '<li>Failed to load scores</li>';
  }
}

window.addEventListener('DOMContentLoaded', function() {
  // Assign variables after DOM is ready
  startScreen = document.getElementById('startScreen');
  quizScreen = document.getElementById('quizScreen');
  endScreen = document.getElementById('endScreen');
  emojiDiv = document.getElementById('emoji');
  optionsDiv = document.getElementById('options');
  scoreSpan = document.getElementById('score');
  timerSpan = document.getElementById('timer');
  finalScoreSpan = document.getElementById('finalScore');
  highscoresList = document.getElementById('highscores');
  submitBtn = document.getElementById('submitBtn');
  playAgainBtn = document.getElementById('playAgainBtn');
  nameInput = document.getElementById('nameInput');
  bgMusic = document.getElementById('bgMusic');
  soundToggle = document.getElementById('soundToggle');
  musicToggle = document.getElementById('musicToggle');

  window.game = "ParticiplesGame";

  // Make sure music is muted by default
  if (bgMusic) bgMusic.muted = true;
  musicMuted = true;
  if (musicToggle) {
    musicToggle.textContent = '🔇 Music';
    musicToggle.checked = false;
  }

  // Start button
  document.getElementById('startBtn').addEventListener('click', () => {
    startGame();
    if (bgMusic) bgMusic.play();
  });

  // Sound toggle
  if (soundToggle) {
    soundToggle.onclick = function() {
      soundMuted = !soundMuted;
      soundToggle.textContent = soundMuted ? '🔇 Sound' : '🔊 Sound';
    };
  }

  // Music toggle
  if (musicToggle) {
    musicToggle.onclick = function() {
      musicMuted = !musicMuted;
      if (bgMusic) bgMusic.muted = musicMuted;
      musicToggle.textContent = musicMuted ? '🔇 Music' : '🎵 Music';
    };
  }

  if (submitBtn) submitBtn.addEventListener('click', submitScore);

  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', function() {
      // Reset name input and button visibility for next game
      if (nameInput) {
        nameInput.value = '';
        nameInput.style.display = 'none';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.display = 'none';
      }
      playAgainBtn.style.display = 'none';
      startGame();
    });
  }

  // Reset function (if you need to expose it globally)
  window.resetGame = function() {
    if (startScreen) startScreen.style.display = 'block';
    if (quizScreen) quizScreen.style.display = 'none';
    if (endScreen) endScreen.style.display = 'none';
  };
});

// Move submitScore outside DOMContentLoaded so endGame can call it
async function submitScore(forcedName, forcedUserId) {
  let name = forcedName || nameInput.value.trim();
  if (!name) {
    name = funnyNames[Math.floor(Math.random() * funnyNames.length)];
  }
  const user_id = forcedUserId || null;
  submitBtn.disabled = true;
  await fetch('/.netlify/functions/submit_score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score, game: "ParticiplesGame", user_id })
  });
  submitBtn.style.display = 'none';
  nameInput.style.display = 'none';
  displayHighScores();
  playAgainBtn.style.display = '';
}
