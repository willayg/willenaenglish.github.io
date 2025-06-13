import { participlesQuestions } from './participles_contents.js';

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

let questions = participlesQuestions.slice();
let currentQuestionIndex = 0;
let score = 0;
let timer = null;
let timeLeft = 25; // 25 seconds for the whole game
let soundMuted = false; // Make sure this is set globally
let musicMuted = false;

const correctSound = new Audio('../../Assets/Audio/right.mp3');
const wrongSound = new Audio('../../Assets/Audio/wrong.mp3');
const endGameSound = new Audio('../../Assets/Audio/endgame.mp3');
correctSound.muted = musicMuted;
wrongSound.muted = musicMuted;
endGameSound.muted = musicMuted;

const correctResponses = [
  "Nice job!",
  "You're Awesome!",
  "Wow! That was right!",
  "You got it right!",
  "That's the correct answer. Cool!"
];

const wrongResponses = [
  "That's too bad.",
  "You got that one wrong.",
  "Oops.",
  "Oh my!",
  "You made a mistake."
];

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function startGame() {
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
  // Show only the base verb, not a long sentence
  emojiDiv.textContent = q.base;
  optionsDiv.innerHTML = '';
  const choices = shuffle(q.options.slice());
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice.charAt(0).toUpperCase() + choice.slice(1);
    btn.onclick = () => checkAnswer(choice, btn);
    optionsDiv.appendChild(btn);
  });
}

function speakResponse(text) {
  if (soundMuted) return;
  const utter = new window.SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  window.speechSynthesis.speak(utter);
}

function checkAnswer(choice, btnClicked) {
  const q = questions[currentQuestionIndex];
  const buttons = document.querySelectorAll('#options button');
  const correctText = q.answer.toLowerCase();

  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent.trim().toLowerCase() === correctText) {
      btn.style.backgroundColor = '#4caf50';
      btn.style.color = '#fff';
    }
  });

  if (choice.toLowerCase() !== correctText) {
    btnClicked.style.backgroundColor = '#e53935';
    btnClicked.style.color = '#fff';
    // const response = wrongResponses[Math.floor(Math.random() * wrongResponses.length)];
    playFeedbackAudio('wrong');   // only play the voice
    score -= 100;
  } else {
    // const response = correctResponses[Math.floor(Math.random() * correctResponses.length)];
    playFeedbackAudio('correct'); // only play the voice
    score += 300;
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

function endGame() {
  quizScreen.style.display = 'none';
  endScreen.style.display = 'block';
  finalScoreSpan.textContent = score;
  playEndGameVoice(score);
  displayHighScores();
  // Show submit, hide play again at first
  submitBtn.style.display = '';
  playAgainBtn.style.display = 'none';
  nameInput.style.display = '';
  if (timer) clearInterval(timer);
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

submitBtn.onclick = function() {
  const name = nameInput.value.trim();
  if (!name) return;
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

function getAudioFilename(word) {
  // Lowercase, trim, replace spaces and non-alphanumerics with underscores
  return word.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.mp3';
}

async function speakWord(word) {
  const filename = getAudioFilename(word);
  const SUPABASE_PROJECT_ID = "fiieuiktlsivwfgyivai"; // This is NOT a secret
  const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/tts-audio/${filename}`;
  const audio = new Audio(url);
  audio.play();
}

// Update your sound toggle logic:
soundToggle.addEventListener('change', function() {
  soundMuted = !soundToggle.checked;
});

// Feedback audio function
export async function playFeedbackAudio(type) {
  if (soundMuted) return;

  const correctFiles = [
    "pos_1.mp3",
    "pos_2.mp3",
    "pos_3.mp3",
    "pos_4.mp3",
    "pos_5.mp3"
  ];
  const wrongFiles = [
    "neg_1.mp3",
    "neg_2.mp3",
    "neg_3.mp3",
    "neg_4.mp3",
    "neg_5.mp3"
  ];
  let fileList = type === "correct" ? correctFiles : wrongFiles;
  let file = fileList[Math.floor(Math.random() * fileList.length)];
  let url = "../../Assets/Audio/voices/steve/" + file;
  const audio = new Audio(url);
  audio.muted = soundMuted; // This ensures muting works even if toggled during playback
  audio.play().catch(e => {
    console.warn("Audio not found or not allowed to play:", url, e);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const bgMusic = document.getElementById('bgMusic');
  const musicToggle = document.getElementById('musicToggle');
  musicToggle.checked = !bgMusic.muted;
  musicToggle.addEventListener('change', function() {
    bgMusic.muted = !musicToggle.checked;
  });

  const soundToggle = document.getElementById('soundToggle');
  window.soundMuted = false;
  soundToggle.checked = !window.soundMuted;
  soundToggle.addEventListener('change', function() {
    window.soundMuted = !soundToggle.checked;
  });
});
