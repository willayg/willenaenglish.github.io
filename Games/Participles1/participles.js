window.addEventListener('DOMContentLoaded', function() {
  // Elements
  const startBtn = document.getElementById('startBtn');
  const startScreen = document.getElementById('startScreen');
  const quizScreen = document.getElementById('quizScreen');
  const endScreen = document.getElementById('endScreen');
  const bgMusic = document.getElementById('bgMusic');
  const musicToggle = document.getElementById('musicToggle');
  const scoreSpan = document.getElementById('score');
  const timerSpan = document.getElementById('timer');
  const questionElem = document.getElementById('question');
  const optionsDiv = document.getElementById('options');
  const finalScoreSpan = document.getElementById('finalScore');

  // Game state
  const questions = window.participlesQuestions || [];
  let current = 0, score = 0, timerInterval = null, timeLeft = 20;
  let musicMuted = true;

  // Hide quiz and end by default
  quizScreen.style.display = "none";
  endScreen.style.display = "none";

  // Music setup
  if (bgMusic) {
    bgMusic.muted = true;
    bgMusic.pause();
  }
  if (musicToggle) {
    musicToggle.checked = false;
    musicToggle.nextElementSibling.textContent = '🔇 Music';
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
      musicToggle.nextElementSibling.textContent = musicMuted ? '🔇 Music' : '🎵 Music';
    };
  }

  // Start game
  startBtn.addEventListener('click', function() {
    startScreen.style.display = "none";
    quizScreen.style.display = "block";
    endScreen.style.display = "none";
    startGame();
  });

  function startGame() {
    current = 0;
    score = 0;
    timeLeft = 20;
    scoreSpan.textContent = score;
    showQuestion();
    startTimer();
  }

  function showQuestion() {
    if (current >= questions.length) {
      endGame();
      return;
    }
    const q = questions[current];
    questionElem.textContent = `What is the past participle of "${q.base}"?`;
    optionsDiv.innerHTML = "";
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
    scoreSpan.textContent = score;
    current += 1;
    if (current < questions.length) {
      showQuestion();
    } else {
      endGame();
    }
  }

  function startTimer() {
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
    if (timerInterval) clearInterval(timerInterval);
    quizScreen.style.display = "none";
    endScreen.style.display = "block";
    finalScoreSpan.textContent = score;
  }

  window.resetGame = function() {
    endScreen.style.display = "none";
    startScreen.style.display = "block";
    quizScreen.style.display = "none";
    scoreSpan.textContent = "0";
    timerSpan.textContent = "20";
  };
});
