import es6Sentences from './ES6_contents.js';

function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

let mode = null; // "practice" or "game"
let questions = [];
let current = 0;
let score = 0;
let answerOrder = [];
let chunksOrder = [];
let practiceResults = [];
let practiceRight = [];
let practiceWrong = [];
let timer = null;
let timeLeft = 60;

const modeScreen = document.getElementById('modeScreen');
const practiceModeBtn = document.getElementById('practiceModeBtn');
const gameModeBtn = document.getElementById('gameModeBtn');

const scoreDiv = document.getElementById('score');
const answerDiv = document.getElementById('answer');
const chunksDiv = document.getElementById('chunks');
const checkBtn = document.getElementById('checkBtn');
const nextBtn = document.getElementById('nextBtn');
const resultDiv = document.getElementById('result');
const restartBtn = document.getElementById('restartBtn');
const container = document.querySelectorAll('.container')[1];

const timerDiv = document.getElementById('timer');
const endScreen = document.getElementById('endScreen');
const finalScore = document.getElementById('finalScore');
const highscoresList = document.getElementById('highscores');
const nameInput = document.getElementById('nameInput');
const submitBtn = document.getElementById('submitBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const backBtn = document.getElementById('backBtn');

function showScore() {
  if (mode === "game") {
    scoreDiv.textContent = `Score: ${score}`;
  } else if (mode === "practice") {
    scoreDiv.textContent = `Practice: ${practiceRight.length} correct, ${practiceWrong.length} wrong`;
  }
}

function showQuestion() {
  answerOrder = [];
  resultDiv.textContent = '';
  checkBtn.disabled = true;
  nextBtn.style.display = 'none';
  restartBtn.style.display = 'none';
  answerDiv.innerHTML = '';
  chunksDiv.innerHTML = '';
  showScore();

  const q = questions[current];
  const chunks = q.chunks.filter(Boolean);

  // Ensure the chunks are scrambled (not in original order)
  do {
    chunksOrder = shuffle(chunks);
  } while (chunksOrder.join('|') === chunks.join('|') && chunks.length > 1);

  chunksOrder.forEach((chunk, idx) => {
    const btn = document.createElement('button');
    btn.textContent = chunk;
    btn.onclick = () => selectChunk(idx);
    chunksDiv.appendChild(btn);
  });
}

function selectChunk(idx) {
  const chunk = chunksOrder[idx];
  answerOrder.push(chunk);
  updateAnswer();
  chunksDiv.children[idx].disabled = true;
  checkBtn.disabled = answerOrder.length !== questions[current].chunks.filter(Boolean).length;
}

function updateAnswer() {
  answerDiv.innerHTML = '';
  answerOrder.forEach((chunk, idx) => {
    const btn = document.createElement('button');
    btn.textContent = chunk;
    btn.onclick = () => removeChunk(idx);
    answerDiv.appendChild(btn);
  });
}

function removeChunk(idx) {
  const chunk = answerOrder[idx];
  const chunkIdx = chunksOrder.indexOf(chunk);
  answerOrder.splice(idx, 1);
  chunksDiv.children[chunkIdx].disabled = false;
  updateAnswer();
  checkBtn.disabled = answerOrder.length !== questions[current].chunks.filter(Boolean).length;
}

function checkAnswer() {
  const userSentence = answerOrder.join(' ').replace(/\s+/g, ' ').trim();
  const correctSentence = questions[current].chunks.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const isCorrect = userSentence === correctSentence;

  if (mode === "game") {
    if (isCorrect) {
      resultDiv.textContent = "✅ Correct!";
      score += 200;
    } else {
      resultDiv.textContent = `❌ Incorrect! Correct: "${questions[current].original}"`;
      score -= 100;
    }
    showScore();
    checkBtn.disabled = true;
    nextBtn.style.display = (current < questions.length - 1) ? 'inline-block' : 'none';
    restartBtn.style.display = (current === questions.length - 1) ? 'inline-block' : 'none';
    Array.from(chunksDiv.children).forEach(btn => btn.disabled = true);
    Array.from(answerDiv.children).forEach(btn => btn.disabled = true);
  } else if (mode === "practice") {
    practiceResults.push({
      question: questions[current].original,
      userAnswer: userSentence,
      correct: isCorrect,
      correctAnswer: correctSentence
    });
    if (isCorrect) {
      resultDiv.textContent = "✅ Correct!";
      practiceRight.push(questions[current].original);
    } else {
      resultDiv.textContent = `❌ Incorrect! Correct: "${questions[current].original}"`;
      practiceWrong.push(questions[current].original);
    }
    showScore();
    checkBtn.disabled = true;
    nextBtn.style.display = (current < questions.length - 1) ? 'inline-block' : 'none';
    restartBtn.style.display = (current === questions.length - 1) ? 'inline-block' : 'none';
    Array.from(chunksDiv.children).forEach(btn => btn.disabled = true);
    Array.from(answerDiv.children).forEach(btn => btn.disabled = true);
  }

  // Play the mp3 for this sentence
  const mp3File = `mp3s/${safeFilename(questions[current].original)}.mp3`;
  const audio = new Audio(mp3File);
  audio.play();
}

// Add this helper function near the top of your file:
function safeFilename(text) {
  return text.trim()
    .replace(/ /g, "_")
    .replace(/[\\/*?:"<>|']/g, "")
    .slice(0, 100);
}

checkBtn.onclick = () => {
  checkAnswer();
};

nextBtn.onclick = () => {
  current++;
  showQuestion();
};

restartBtn.onclick = () => {
  if (mode === "practice") {
    showPracticeSummary();
  } else {
    startGame();
  }
};

function startGame() {
  mode = "game";
  modeScreen.style.display = "none";
  container.style.display = "block";
  endScreen.style.display = "none";
  timerDiv.style.display = "block";
  questions = shuffle(es6Sentences);
  current = 0;
  score = 0;
  timeLeft = 60;
  timerDiv.textContent = `Time: ${timeLeft}s`;
  restartBtn.textContent = "Restart";
  showQuestion();
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    timerDiv.textContent = `Time: ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      endGame();
    }
  }, 1000);
}

function endGame() {
  if (timer) clearInterval(timer);
  container.style.display = "none";
  modeScreen.style.display = "none";
  timerDiv.style.display = "none";
  endScreen.style.display = "block";
  finalScore.textContent = score;
  nameInput.value = '';
  nameInput.style.display = 'block';
  submitBtn.style.display = 'inline-block';
  playAgainBtn.style.display = "none"; // Hide by default
  displayHighScores();
}

async function displayHighScores() {
  if (!highscoresList) return;
  highscoresList.innerHTML = '<li>Loading...</li>';
  try {
    const response = await fetch('/.netlify/functions/submit_score?game=ES6');
    if (!response.ok) {
      highscoresList.innerHTML = '<li>Failed to load scores</li>';
      return;
    }
    const data = await response.json();
    // Keep only the highest score per player
    const bestScores = {};
    data.forEach(entry => {
      if (!bestScores[entry.name] || entry.score > bestScores[entry.name].score) {
        bestScores[entry.name] = entry;
      }
    });
    // Convert to array and sort by score descending, then take top 10
    const sorted = Object.values(bestScores).sort((a, b) => b.score - a.score).slice(0, 10);
    highscoresList.innerHTML = '';
    sorted.forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.name}: ${entry.score}`;
      highscoresList.appendChild(li);
    });
  } catch (e) {
    highscoresList.innerHTML = '<li>Failed to load scores</li>';
  }
}

async function submitScore() {
  const name = nameInput.value || 'Anonymous';
  submitBtn.disabled = true;
  await fetch('/.netlify/functions/submit_score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score, game: "ES6" })
  });
  submitBtn.style.display = 'none';
  nameInput.style.display = 'none';
  playAgainBtn.style.display = 'inline-block'; // Show after submit
  displayHighScores();
}

playAgainBtn.onclick = () => {
  endScreen.style.display = "none";
  modeScreen.style.display = "block";
  score = 0;
  timeLeft = 45;
  submitBtn.disabled = false;
};

submitBtn.onclick = submitScore;

function startPractice() {
  mode = "practice";
  modeScreen.style.display = "none";
  container.style.display = "block";
  endScreen.style.display = "none";
  timerDiv.style.display = "none";
  questions = shuffle(es6Sentences).slice(0, 10);
  current = 0;
  practiceResults = [];
  practiceRight = [];
  practiceWrong = [];
  restartBtn.textContent = "See Results";
  showQuestion();
}

function showPracticeSummary() {
  container.innerHTML = `
    <h2>Practice Summary</h2>
    <div style="margin-bottom:16px;">
      <strong>Correct: ${practiceRight.length}</strong><br>
      <strong>Wrong: ${practiceWrong.length}</strong>
    </div>
    <div>
      <h3>Correct Answers</h3>
      <ul style="text-align:left;">
        ${practiceResults.filter(r => r.correct).map(r => `<li>${r.question}</li>`).join('')}
      </ul>
      <h3>Incorrect Answers</h3>
      <ul style="text-align:left;">
        ${practiceResults.filter(r => !r.correct).map(r => `<li>
          <strong>Your answer:</strong> ${r.userAnswer}<br>
          <strong>Correct:</strong> ${r.question}
        </li>`).join('')}
      </ul>
    </div>
    <button id="practiceAgainBtn">Practice Again</button>
    <button id="backToMenuBtn">Back to Menu</button>
  `;
  document.getElementById('practiceAgainBtn').onclick = () => {
    location.reload();
  };
  document.getElementById('backToMenuBtn').onclick = () => {
    location.reload();
  };
}

practiceModeBtn.onclick = () => {
  container.style.display = "block";
  startPractice();
};
gameModeBtn.onclick = () => {
  container.style.display = "block";
  startGame();
};

container.style.display = "none";
modeScreen.style.display = "block";

backBtn.onclick = () => {
  if (timer) clearInterval(timer);
  container.style.display = "none";
  endScreen.style.display = "none";
  modeScreen.style.display = "block";
  score = 0;
  timeLeft = 60;
};