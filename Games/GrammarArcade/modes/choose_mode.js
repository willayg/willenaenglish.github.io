/**
 * Grammar Arcade: Choose the Right Answer Mode
 * Presents students with a sentence or phrase and multiple choice options
 * Similar to Word Arcade's sample-based quiz structure
 */

class ChooseMode {
  constructor(config = {}) {
    this.config = config;
    this.quizData = [];
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.totalAttempts = 0;
    this.responses = [];
    this.container = null;
  }

  /**
   * Initialize the mode with quiz data (from JSON)
   * @param {Array} quizData - Array of question objects
   * @param {HTMLElement} container - DOM container for the UI
   */
  async start(quizData, container) {
    if (!Array.isArray(quizData) || quizData.length === 0) {
      console.error('ChooseMode: Invalid or empty quiz data');
      return false;
    }

    this.quizData = quizData;
    this.container = container;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.totalAttempts = 0;
    this.responses = [];

    this.renderQuestion();
    return true;
  }

  /**
   * Render the current question
   */
  renderQuestion() {
    if (this.currentQuestionIndex >= this.quizData.length) {
      this.renderComplete();
      return;
    }

    const question = this.quizData[this.currentQuestionIndex];
    const questionNum = this.currentQuestionIndex + 1;
    const totalQuestions = this.quizData.length;
    const progressPercent = Math.round((questionNum / totalQuestions) * 100);

    this.container.innerHTML = `
      <div class="gm-quiz-container">
        <!-- Progress Bar -->
        <div class="gm-progress-section">
          <div class="gm-progress-text">${questionNum} / ${totalQuestions}</div>
          <div class="gm-progress-bar">
            <div class="gm-progress-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>

        <!-- Question Prompt -->
        <div class="gm-question-card">
          <div class="gm-question-title">${question.prompt || 'Choose the correct answer:'}</div>
          <div class="gm-question-text">${question.question}</div>
        </div>

        <!-- Answer Options -->
        <div class="gm-options-grid">
          ${question.options
            .map(
              (option, index) => `
            <button class="gm-option-btn" data-index="${index}" data-correct="${option.correct || false}">
              <span class="gm-option-text">${option.text}</span>
            </button>
          `
            )
            .join('')}
        </div>

        <!-- Question Info -->
        <div class="gm-question-info">
          <p>${question.context || ''}</p>
        </div>
      </div>
    `;

    // Wire up answer buttons
    this.wireOptionButtons();
  }

  /**
   * Handle answer selection
   */
  wireOptionButtons() {
    const buttons = this.container.querySelectorAll('.gm-option-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => this.selectAnswer(btn));
    });
  }

  /**
   * Process answer selection
   * @param {HTMLElement} button - The clicked button
   */
  selectAnswer(button) {
    const isCorrect = button.dataset.correct === 'true';
    const selectedIndex = parseInt(button.dataset.index, 10);
    const question = this.quizData[this.currentQuestionIndex];

    // Disable all buttons after selection
    const allButtons = this.container.querySelectorAll('.gm-option-btn');
    allButtons.forEach((btn) => btn.disabled = true);

    // Highlight correct/incorrect
    if (isCorrect) {
      button.classList.add('correct');
      this.score++;
    } else {
      button.classList.add('incorrect');
      // Show the correct answer
      const correctBtn = Array.from(allButtons).find(
        (btn) => btn.dataset.correct === 'true'
      );
      if (correctBtn) {
        correctBtn.classList.add('correct-answer-highlight');
      }
    }

    this.totalAttempts++;

    // Record response
    this.responses.push({
      questionIndex: this.currentQuestionIndex,
      selectedIndex,
      isCorrect,
      question: question.question,
      selectedText: question.options[selectedIndex].text,
      correctText: question.options.find((opt) => opt.correct)?.text,
    });

    // Move to next question after delay
    setTimeout(() => {
      this.currentQuestionIndex++;
      this.renderQuestion();
    }, 1500);
  }

  /**
   * Render completion screen with results
   */
  renderComplete() {
    const percentCorrect = Math.round((this.score / this.totalAttempts) * 100);

    this.container.innerHTML = `
      <div class="gm-complete-container">
        <div class="gm-complete-card">
          <h2 class="gm-complete-title">Quiz Complete!</h2>
          
          <div class="gm-score-display">
            <div class="gm-score-large">${this.score} / ${this.totalAttempts}</div>
            <div class="gm-score-percent">${percentCorrect}%</div>
          </div>

          <div class="gm-summary">
            <p class="gm-summary-text">
              ${percentCorrect >= 80
                ? '🎉 Great job! You\'re mastering this!'
                : percentCorrect >= 60
                  ? '👍 Good effort! Keep practicing!'
                  : '💪 Keep trying! You\'ll get better!'}
            </p>
          </div>

          <div class="gm-complete-actions">
            <button id="gm-retry-btn" class="gm-action-btn gm-retry-btn">Try Again</button>
            <button id="gm-review-btn" class="gm-action-btn gm-review-btn">Review Answers</button>
            <button id="gm-back-btn" class="gm-action-btn gm-back-btn">Back to Levels</button>
          </div>
        </div>
      </div>
    `;

    // Wire up action buttons
    document.getElementById('gm-retry-btn')?.addEventListener('click', () => {
      this.currentQuestionIndex = 0;
      this.score = 0;
      this.totalAttempts = 0;
      this.responses = [];
      this.renderQuestion();
    });

    document.getElementById('gm-review-btn')?.addEventListener('click', () => {
      this.renderReview();
    });

    document.getElementById('gm-back-btn')?.addEventListener('click', () => {
      if (this.config.onBack) {
        this.config.onBack();
      }
    });
  }

  /**
   * Render review of all answers
   */
  renderReview() {
    const reviewHTML = this.responses
      .map(
        (response, idx) => `
      <div class="gm-review-item ${response.isCorrect ? 'correct' : 'incorrect'}">
        <div class="gm-review-number">Q${idx + 1}</div>
        <div class="gm-review-question">${response.question}</div>
        <div class="gm-review-answer">
          <span class="gm-answer-label">Your answer:</span>
          <span class="gm-answer-text">${response.selectedText}</span>
          ${!response.isCorrect ? `<div class="gm-correct-answer"><span class="gm-answer-label">Correct:</span> ${response.correctText}</div>` : ''}
        </div>
      </div>
    `
      )
      .join('');

    this.container.innerHTML = `
      <div class="gm-review-container">
        <div class="gm-review-header">
          <h2>Review Your Answers</h2>
          <button id="gm-close-review" class="gm-close-btn">✕</button>
        </div>
        <div class="gm-review-list">
          ${reviewHTML}
        </div>
        <div class="gm-review-footer">
          <button id="gm-back-from-review" class="gm-action-btn gm-back-btn">Back to Results</button>
        </div>
      </div>
    `;

    document.getElementById('gm-close-review')?.addEventListener('click', () => {
      this.renderComplete();
    });

    document.getElementById('gm-back-from-review')?.addEventListener('click', () => {
      this.renderComplete();
    });
  }

  /**
   * Get current score
   */
  getScore() {
    return {
      correct: this.score,
      total: this.totalAttempts,
      percentage: this.totalAttempts > 0 ? (this.score / this.totalAttempts) * 100 : 0,
      responses: this.responses,
    };
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChooseMode;
}
