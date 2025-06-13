window.addEventListener('DOMContentLoaded', function() {
  // Get elements
  const startBtn = document.getElementById('startBtn');
  const startScreen = document.getElementById('startScreen');
  const quizScreen = document.getElementById('quizScreen');
  const endScreen = document.getElementById('endScreen');
  const bgMusic = document.getElementById('bgMusic');
  const musicToggle = document.getElementById('musicToggle');
  let musicMuted = true; // default muted

  // Hide quiz and end screens initially
  if (quizScreen) quizScreen.style.display = "none";
  if (endScreen) endScreen.style.display = "none";

  // Music defaults
  if (bgMusic) {
    bgMusic.muted = true;
    bgMusic.pause();
  }
  if (musicToggle) {
    musicToggle.textContent = '🔇 Music';
    musicToggle.checked = false;
    musicToggle.onclick = function() {
      musicMuted = !musicMuted;
      if (bgMusic) {
        bgMusic.muted = musicMuted;
        if (!musicMuted) {
          bgMusic.play().catch(() => {});
        } else {
          bgMusic.pause();
        }
      }
      musicToggle.textContent = musicMuted ? '🔇 Music' : '🎵 Music';
    };
  }

  // Use questions from participles_contents.js
  const questions = window.participlesQuestions || [];
  let current = 0, score = 0, timerInterval = null, timeLeft = 20;

  // Hook up Start Game button
  if (startBtn) {
    startBtn.addEventListener('click', function() {
      if (startScreen) startScreen.style.display = "none";
      if (quizScreen) quizScreen.style.display = "block";
      if (endScreen) endScreen.style.display = "none";
      startGame();
    });
  }

  function startGame() {
    current = 0;
    score = 0;
    timeLeft = 20;
    showQuestion();
    startTimer();
    updateScore();
  }

  function showQuestion() {
    const q = questions[current];
    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = "";
    // Show the base verb as question
    const questionText = document.createElement('div');
    questionText.textContent = `Past participle of "${q.base}"?`;
    optionsDiv.appendChild(questionText);

    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.onclick = () => checkAnswer(opt);
      optionsDiv.appendChild(btn);
    });
  }

  function checkAnswer(selected) {
    const q = questions[current];
    if (selected === q.answer) score += 1;
    current += 1;
    updateScore();
    if (current < questions.length) {
      showQuestion();
    } else {
      endGame();
    }
  }

  function updateScore() {
    const scoreSpan = document.getElementById('score');
    if (scoreSpan) scoreSpan.textContent = score;
  }

  function startTimer() {
    const timerSpan = document.getElementById('timer');
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 20;
    timerSpan.textContent = timeLeft;
    timerInterval = setInterval(() => {
      timeLeft -= 1;
      timerSpan.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        endGame();
      }
    }, 1000);
  }

  function endGame() {
    if (quizScreen) quizScreen.style.display = "none";
    if (endScreen) endScreen.style.display = "block";
    document.getElementById('finalScore').textContent = score;
    // Optionally: load highscores, etc
  }

  // Optional: hook up restart button
  window.resetGame = function() {
    if (endScreen) endScreen.style.display = "none";
    if (startScreen) startScreen.style.display = "block";
    if (quizScreen) quizScreen.style.display = "none";
  };
});
