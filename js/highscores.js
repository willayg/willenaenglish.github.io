// Always get the latest input/button when called (for dynamic DOM)
function getNameInput() {
  return document.getElementById('nameInput');
}
function getSubmitBtn() {
  return document.getElementById('submitBtn');
}
function getHighScoresList() {
  return document.getElementById('highscores');
}

// Submit the score from the form
async function submitScore() {
  const nameInput = getNameInput();
  const name = nameInput ? nameInput.value : 'Anonymous';
  // Use global score variable from game
  const scoreValue = typeof score !== "undefined" ? score : 0;
  console.log("Submitting:", name, scoreValue); // for debugging

  const response = await fetch('/.netlify/functions/submit_score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score: scoreValue, game: window.game })
  });
  const result = await response.json();

  if (response.ok) {
    if (nameInput) nameInput.style.display = 'none';
    const submitBtn = getSubmitBtn();
    if (submitBtn) submitBtn.style.display = 'none';
    displayHighScores();
  } else {
    console.error('Failed to submit score:', result.error);
  }
}

// Load top scores
async function displayHighScores() {
  const highScoresList = getHighScoresList();
  if (!highScoresList) return;

  const response = await fetch('/.netlify/functions/submit_score?game=' + encodeURIComponent(window.game));
  const data = await response.json();

  if (response.ok) {
    highScoresList.innerHTML = '';
    data.forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.name}: ${entry.score}`;
      highScoresList.appendChild(li);
    });
  } else {
    console.error('Failed to fetch scores:', data.error);
  }
}

// No DOMContentLoaded event for submitBtn here!
// The game code should set up the submitBtn.onclick handler when it creates the button.
