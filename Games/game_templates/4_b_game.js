import * as wordData from './4_b_template_contents.js';

const startBtn = document.getElementById('startBtn');
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
let streak = 0; // Track correct answers in a row

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

function speakResponse(text) {
  if (soundMuted) return;
  const utter = new window.SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  window.speechSynthesis.speak(utter);
}

function checkAnswer(choice, btnClicked) {
  const q = questions[currentQuestionIndex];
  const buttons = document.querySelectorAll('#options button');
  const correctText = q.word.toLowerCase();

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
    const response = wrongResponses[Math.floor(Math.random() * wrongResponses.length)];
    playFeedbackAudio(response, 'wrong');
    score -= 100;
    streak = 0; // Reset streak on wrong answer
  } else {
    const response = correctResponses[Math.floor(Math.random() * correctResponses.length)];
    playFeedbackAudio(response, 'correct');
    score += 300;
    streak++; // Increment streak

    // Bonus: +1 second for every 3 correct in a row
    if (streak > 0 && streak % 3 === 0) {
      timeLeft += 1;
      timerSpan.textContent = timeLeft;
      // Optional: Visual feedback
      timerSpan.style.color = "#4caf50";
      setTimeout(() => { timerSpan.style.color = ""; }, 600);
    }
    // Bonus: +500 points for every 5 correct in a row
    if (streak > 0 && streak % 5 === 0) {
      score += 500;
      scoreSpan.textContent = score;
      // Optional: Visual feedback
      scoreSpan.style.color = "#ff9800";
      setTimeout(() => { scoreSpan.style.color = ""; }, 600);
    }
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
  playEndingAudio(score); // <-- Add this line
  displayHighScores();

  // Show the Play Again button
  playAgainBtn.style.display = 'inline-block';

  // Check if user is logged in
  const user_id = localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || null;
  const user_name = localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';

  const submitBtn = document.getElementById('submitBtn');
  const nameInput = document.getElementById('nameInput');
  if (user_id && user_name) {
    // Autosubmit for logged-in user
    if (nameInput) {
      nameInput.value = user_name;
      nameInput.style.display = 'none';
    }
    if (submitBtn) submitBtn.style.display = 'none';
    submitScore(user_name, user_id);
  } else {
    // Show input and button for guests
    if (nameInput) {
      nameInput.value = '';
      nameInput.style.display = 'block';
      nameInput.focus();
    }
    if (submitBtn) submitBtn.style.display = 'inline-block';
  }
}

async function submitScore(forcedName, forcedUserId) {
  const nameInput = document.getElementById('nameInput');
  const name = forcedName || (nameInput ? nameInput.value : '') || 'Anonymous';
  const user_id = forcedUserId || null;
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.disabled = true;
  await fetch('/.netlify/functions/submit_score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score, game: "EmojiGame", user_id }) // <-- set your game name here
  });
  if (submitBtn) submitBtn.style.display = 'none';
  if (nameInput) nameInput.style.display = 'none';
  displayHighScores();
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

async function playFeedbackAudio(phrase, type) {
  if (soundMuted) return;

  // Arrays of local audio file names
  const correctFiles = [
    "good_job.mp3",
    "great_work.mp3",
    "nice_job.mp3",
    "youre_good.mp3",
    "well_done.mp3"
  ];
  const wrongFiles = [
    "close_one.mp3",
    "huge_mistake.mp3",
    "not_the_answer.mp3",
    "oh_man.mp3",
    "wrong.mp3"
  ];

  // Pick a random file based on type
  let fileList = type === "correct" ? correctFiles : wrongFiles;
  let file = fileList[Math.floor(Math.random() * fileList.length)];
  let url = "../../Assets/Audio/voices/rabbit/" + file; // Make sure this path is correct and case matches your folders

  const audio = new Audio(url);
  audio.play().catch(e => {
    // Optionally log or ignore errors if file not found
    // console.warn("Audio not found:", url);
  });
}

function playEndingAudio(score) {
  let file = "";
  if (score < 0) {
    file = "button_smash.mp3";
  } else if (score <= 1000) {
    file = "nicetry.mp3";
  } else if (score <= 2000) {
    file = "prettygood.mp3";
  } else if (score <= 3000) {
    file = "great.mp3";
  } else if (score <= 4500) {
    file = "Amazing.mp3";
  } else {
    file = "Best.mp3";
  }
  let url = "../../Assets/Audio/voices/rabbit/" + file;
  const audio = new Audio(url);
  audio.play().catch(e => {});
}

// Attach handler on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.style.display = 'none';
    submitBtn.onclick = () => submitScore();
  }
});

playAgainBtn.onclick = function() {
  // Reset everything and start a new game
  startGame();
  playAgainBtn.style.display = 'none';
};
