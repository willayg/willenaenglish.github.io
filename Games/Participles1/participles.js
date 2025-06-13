// --- DOM Elements ---
const quizScreen = document.getElementById('quizScreen');
const endScreen = document.getElementById('endScreen');
const scoreSpan = document.getElementById('score');
const finalScoreSpan = document.getElementById('finalScore');
const highscoresList = document.getElementById('highscores');
const submitBtn = document.getElementById('submitBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const nameInput = document.getElementById('nameInput');
const optionsDiv = document.getElementById('options');
const musicToggle = document.getElementById('musicToggle');
const soundToggle = document.getElementById('soundToggle');
const bgMusic = document.getElementById('bgMusic');
const timerSpan = document.getElementById('timer');
const emojiDiv = document.getElementById('emoji');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const restartButton = document.getElementById('restartButton');

// --- Game State ---
let score = 0;
let currentQuestionIndex = 0;
let timer = null;
let soundMuted = false;
let musicWasPlaying = false;
let questions = [];
let timeLeft = 20;
let answerStartTime = 0;

// --- Music defaults to OFF ---
window.addEventListener('DOMContentLoaded', function() {
  musicToggle.checked = false;
  bgMusic.pause();
  bgMusic.currentTime = 0;
});

// Music toggle logic
musicToggle.addEventListener('change', function() {
  if (musicToggle.checked) {
    bgMusic.currentTime = 0;
    bgMusic.play();
    musicWasPlaying = true;
  } else {
    bgMusic.pause();
    bgMusic.currentTime = 0;
    musicWasPlaying = false;
  }
});

// Sound toggle logic
soundToggle.onclick = function() {
  soundMuted = !soundMuted;
};

// --- Game Logic ---

// You must define your own list of questions in participles_contents.js
import { PARTICIPLES_QUESTIONS } from './participles_contents.js';

// Start game
startBtn.onclick = function() {
  startScreen.style.display = 'none';
  quizScreen.style.display = 'block';
  endScreen.style.display = 'none';
  resetGame();
  showQuestion();
};

// Reset game state
function resetGame() {
  score = 0;
  currentQuestionIndex = 0;
  scoreSpan.textContent = score;
  timerSpan.textContent = 20;
  emojiDiv.innerHTML = '';
  questions = shuffle(PARTICIPLES_QUESTIONS.slice());
  timeLeft = 20;
  if (timer) clearInterval(timer);
  startTimer();
  playAgainBtn.style.display = 'none';
  submitBtn.style.display = '';
  nameInput.style.display = '';
  nameInput.value = '';
}

// Timer
function startTimer() {
  timeLeft = 20;
  timerSpan.textContent = timeLeft;
  timer = setInterval(() => {
    timeLeft--;
    timerSpan.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timer);
      endGame();
    }
  }, 1000);
}

// Shuffle helper
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Show question
function showQuestion() {
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  const q = questions[currentQuestionIndex];
  optionsDiv.innerHTML = '';
  emojiDiv.innerHTML = '';
  // Render question (customize as needed)
  const questionText = document.createElement('div');
  questionText.className = 'question-text';
  questionText.textContent = `What is the past participle of "${q.base}"?`;
  optionsDiv.appendChild(questionText);

  // Render options
  q.options.forEach(option => {
    const btn = document.createElement('button');
    btn.textContent = option;
    btn.className = 'option-btn';
    btn.onclick = function() {
      handleAnswer(btn, option, q.answer);
    };
    optionsDiv.appendChild(btn);
  });

  answerStartTime = performance.now() / 1000;
}

// Handle answer
function handleAnswer(btnClicked, selectedOption, correctAnswer) {
  let penalty = 0, bonus = 0;
  const answerEndTime = performance.now() / 1000;
  const answerTime = answerEndTime - answerStartTime;

  // Reset button styles
  optionsDiv.querySelectorAll('button').forEach(btn => {
    btn.style.backgroundColor = '';
    btn.style.color = '';
  });

  if (selectedOption === correctAnswer) {
    btnClicked.style.backgroundColor = 'green'; // Turns green when correct
    btnClicked.style.color = '#fff';
    playFeedbackAudio('correct');
    score += 300;
    if (answerTime <= 0.8) {
      bonus = 150;
      score += bonus;
      // Optionally show a bonus message
      // emojiDiv.innerHTML += '<div style="color: gold; font-size: 1.2em;">+150 Bonus!</div>';
    }
  } else {
    btnClicked.style.backgroundColor = 'red'; // Turns red when wrong
    btnClicked.style.color = '#fff';
    playFeedbackAudio('wrong');
    score -= 100;
    if (answerTime <= 0.5) {
      penalty = 200;
      score -= penalty;
      // Optionally show a penalty message
      // emojiDiv.innerHTML += '<div style="color: red; font-size: 1.2em;">-200 Fast Penalty!</div>';
    }
  }

  scoreSpan.textContent = score;
  setTimeout(() => {
    currentQuestionIndex++;
    showQuestion();
  }, 500);
}

// Play feedback audio
function playFeedbackAudio(type) {
  if (soundMuted) return;
  let audioFile = '';
  if (type === 'correct') {
    audioFile = '../../Assets/audio/correct.mp3';
  } else if (type === 'wrong') {
    audioFile = '../../Assets/audio/wrong.mp3';
  }
  if (audioFile) {
    const a = new Audio(audioFile);
    a.play();
  }
}

// End game
function endGame() {
  if (timer) clearInterval(timer);
  quizScreen.style.display = 'none';
  endScreen.style.display = 'block';
  finalScoreSpan.textContent = score;
  playEndGameVoice(score);
  displayHighScores();
  submitBtn.style.display = '';
  playAgainBtn.style.display = 'none';
  nameInput.style.display = '';
}

// End game voice
function playEndGameVoice(finalScore) {
  let file;
  if (finalScore < 0) {
    file = "end_bad.mp3";
  } else if (finalScore > 2300) {
    file = "end_outstanding.mp3";
  } else if (finalScore > 1300) {
    file = "end_good.mp3";
  } else if (finalScore > 800) {
    file = "end_fair.mp3";
  } else {
    file = "end_bad.mp3";
  }
  const url = "../../Assets/Audio/voices/steve/" + file;
  const audio = new Audio(url);
  audio.play().catch(e => {
    console.warn("End game audio not found or not allowed to play:", url, e);
  });
}

// Highscore functions
function displayHighScores() {
  fetch('/.netlify/functions/submit_score?game=ParticiplesGame')
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

// Score submission with empty name warning
submitBtn.onclick = function() {
  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter your name before submitting your score.");
    nameInput.focus();
    return;
  }
  fetch('/.netlify/functions/submit_score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name,
      score: score,
      game: 'ParticiplesGame'
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

// Play again
playAgainBtn.onclick = function() {
  endScreen.style.display = 'none';
  startScreen.style.display = 'block';
};

// Restart button logic for in-game restart
restartButton.onclick = function() {
  resetGame();
  showQuestion();
};
