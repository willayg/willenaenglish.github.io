// Connect to Supabase
const supabaseUrl = 'https://fiieuiktlsivwfgyivai.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpaWV1aWt0bHNpdndmZ3lpdmFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTEyNTIsImV4cCI6MjA2NDE4NzI1Mn0.aMQN_U2aLvH7RzuT-dfzQF4RNA7YQ-Xn6upqJFr7eis';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

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

  const { data, error } = await supabase
    .from('Scores')
    .insert([{ name, score: scoreValue, game: window.game }]);

  if (error) {
    console.error('Failed to submit score:', error.message);
  } else {
    console.log('Score submitted:', data);
    if (nameInput) nameInput.style.display = 'none';
    const submitBtn = getSubmitBtn();
    if (submitBtn) submitBtn.style.display = 'none';
    displayHighScores();
  }
}

// Load top scores
async function displayHighScores() {
  const highScoresList = getHighScoresList();
  if (!highScoresList) return;
  const { data, error } = await supabase
    .from('Scores')
    .select('name, score')
    .eq('game', window.game)
    .order('score', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Failed to fetch scores:', error.message);
    return;
  }

  highScoresList.innerHTML = '';
  data.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.name}: ${entry.score}`;
    highScoresList.appendChild(li);
  });
}

// No DOMContentLoaded event for submitBtn here!
// The game code should set up the submitBtn.onclick handler when it creates the button.
