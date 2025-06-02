// Connect to Supabase
const SUPABASE_URL = 'https://fiieuiktlsivwfgyivai.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpaWV1aWt0bHNpdndmZ3lpdmFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTEyNTIsImV4cCI6MjA2NDE4NzI1Mn0.aMQN_U2aLvH7RzuT-dfzQF4RNA7YQ-Xn6upqJFr7eis';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const highScoresList = document.getElementById('highscores');
const nameInput = document.getElementById('nameInput');

// Submit the score from the form
async function submitScore() {
  const name = nameInput.value || 'Anonymous';
  console.log("Submitting:", name, score); // for debugging

  const { data, error } = await supabase
    .from('Scores')
    .insert([{ name, score, game: 'JungleAnimalGame' }]);

  if (error) {
    console.error('Failed to submit score:', error.message);
  } else {
    console.log('Score submitted:', data);
    nameInput.style.display = 'none';
    document.getElementById('submitBtn').style.display = 'none';
    displayHighScores();
  }
}

// Load top scores
async function displayHighScores() {
  const { data, error } = await supabase
    .from('Scores')
    .select('name, score')
    .eq('game', 'JungleAnimalGame')
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

// Hook up submit button
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('submitBtn')?.addEventListener('click', submitScore);
});
