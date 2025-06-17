import conditionalSentences from './conditional_contents.js';

function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

let mode = null; // "practice" or "game"
let questions = [];
let current = 0;
let score = 0;
let answerOrder = [];
let chunksOrder = [];
let practiceResults = []; // {question, userAnswer, correct, correctAnswer}
let practiceRight = [];
let practiceWrong = [];

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
const container = document.querySelectorAll('.container')[1]; // second container

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
  chunksOrder = shuffle(chunks);

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
  questions = shuffle(conditionalSentences);
  current = 0;
  score = 0;
  restartBtn.textContent = "Restart";
  showQuestion();
}

function startPractice() {
  mode = "practice";
  modeScreen.style.display = "none";
  container.style.display = "block";
  questions = shuffle(conditionalSentences).slice(0, 10);
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

// Hide main game container at first
container.style.display = "none";
modeScreen.style.display = "block";