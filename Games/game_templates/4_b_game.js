import * as wordData from './4_b_template_contents.js';

const startScreen = document.getElementById('startScreen');
const quizScreen = document.getElementById('quizScreen');
const endScreen = document.getElementById('endScreen');
const emojiDiv = document.getElementById('emoji');
const optionsDiv = document.getElementById('options');
const scoreSpan = document.getElementById('score');
const timerSpan = document.getElementById('timer');
const finalScoreSpan = document.getElementById('finalScore');
const highscoresList = document.getElementById('highscores');
const submitBtn = document.getElementById('submitBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const nameInput = document.getElementById('nameInput');
const bgMusic = document.getElementById('bgMusic');
const soundToggle = document.getElementById('soundToggle');
const musicToggle = document.getElementById('musicToggle');

let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timer = null;
let timeLeft = 25; // 25 seconds for the whole game
let soundMuted = false;
let musicMuted = false;

const correctSound = new Audio('../../Assets/Audio/right.mp3');
const wrongSound = new Audio('../../Assets/Audio/wrong.mp3');
const endGameSound = new Audio('../../Assets/Audio/endgame.mp3');
correctSound.muted = musicMuted;
wrongSound.muted = musicMuted;
endGameSound.muted = musicMuted;

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function startGame() {
  // Combine all word arrays from the imported wordData
  questions = [
    ...(wordData.foodWords || []),
    ...(wordData.toyWords || []),
    ...(wordData.animalWords || []),
    // Add more categories if you have them
  ];
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
}

function showQuestion() {
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  const q = questions[currentQuestionIndex];
  emojiDiv.textContent = q.icon;
  optionsDiv.innerHTML = '';
  const choices = shuffle([
    q.word,
    ...shuffle(wordData.animalWords.filter(w => w.word !== q.word)).slice(0, 3).map(w => w.word)
  ]);
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice.charAt(0).toUpperCase() + choice.slice(1);
    btn.onclick = () => checkAnswer(choice, btn);
    optionsDiv.appendChild(btn);
  });
}

function checkAnswer(choice, btnClicked) {
  // Speak the word the user picked
  speakWithElevenLabs(choice);

  const q = questions[currentQuestionIndex];
  const buttons = document.querySelectorAll('#options button');
  const correctText = q.word.toLowerCase();

  buttons.forEach(btn => {
    btn.disabled = true;
    // Always color the correct answer green
    if (btn.textContent.trim().toLowerCase() === correctText) {
      btn.style.backgroundColor = '#4caf50'; // green
      btn.style.color = '#fff';
    }
  });

  // If wrong, color the clicked button red (unless it's the correct one)
  if (choice.toLowerCase() !== correctText) {
    btnClicked.style.backgroundColor = '#e53935'; // red
    btnClicked.style.color = '#fff';
    wrongSound.currentTime = 0;
    wrongSound.play();
    score -= 100;
  } else {
    correctSound.currentTime = 0;
    correctSound.play();
    score += 300;
  }

  scoreSpan.textContent = score;
  setTimeout(nextQuestion, 500);
}

function nextQuestion() {
  currentQuestionIndex++;
  showQuestion();
}

function endGame() {
  quizScreen.style.display = 'none';
  endScreen.style.display = 'block';
  finalScoreSpan.textContent = score;
  displayHighScores();
  // Show submit, hide play again at first
  submitBtn.style.display = '';
  playAgainBtn.style.display = 'none';
  nameInput.style.display = '';
  if (timer) clearInterval(timer);
}

// Highscore functions
function displayHighScores() {
  fetch('/.netlify/functions/submit_score?game=EmojiGame')
    .then(res => res.json())
    .then(data => {
      highscoresList.innerHTML = '';
      (data || []).slice(0, 10).forEach(entry => {
        const li = document.createElement('li');
        li.textContent = `${entry.name}: ${entry.score}`;
        highscoresList.appendChild(li);
      });
    });
}

submitBtn.onclick = function() {
  const name = nameInput.value.trim();
  if (!name) return;
  fetch('/.netlify/functions/submit_score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name,
      score: score,
      game: 'EmojiGame'
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      submitBtn.style.display = 'none';
      playAgainBtn.style.display = '';
      nameInput.style.display = 'none';
      alert('Score submitted!');
      displayHighScores();
    } else {
      alert('Error submitting score.');
    }
  })
  .catch(err => {
    alert('Network error submitting score.');
  });
};

soundToggle.onclick = function() {
  soundMuted = !soundMuted;
  correctSound.muted = soundMuted;
  wrongSound.muted = soundMuted;
  endGameSound.muted = soundMuted;
  soundToggle.textContent = soundMuted ? '🔇 Sound' : '🔊 Sound';
};

musicToggle.onclick = function() {
  musicMuted = !musicMuted;
  bgMusic.muted = musicMuted;
  musicToggle.textContent = musicMuted ? '🔇 Music' : '🎵 Music';
};

document.getElementById('startBtn').addEventListener('click', () => {
  startGame();
  const bgMusic = document.getElementById('bgMusic');
  if (bgMusic) bgMusic.play();
});

window.resetGame = function() {
  startScreen.style.display = 'block';
  quizScreen.style.display = 'none';
  endScreen.style.display = 'none';
};

const allWords = [
  ...wordData.foodWords,
  ...wordData.toyWords,
  ...wordData.animalWords
  // add more if you have them
];

// Call your Netlify function to get TTS audio and play it
async function speakWithElevenLabs(text) {
  try {
    const response = await fetch('/.netlify/functions/eleven_labs_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await response.json();
    if (data.audio) {
      const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
      audio.play();
    }
  } catch (err) {
    console.error('TTS error:', err);
  }
}
