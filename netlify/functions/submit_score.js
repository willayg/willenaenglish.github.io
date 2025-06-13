// This file is for both frontend helper functions and the Netlify backend handler (exported as handler).
// Frontend helpers below. The backend handler is at the bottom.

function getNameInput() {
  return document.getElementById('nameInput');
}
function getSubmitBtn() {
  return document.getElementById('submitBtn');
}
function getHighScoresList() {
  return document.getElementById('highscores');
}

// Submit the score from the form (frontend)
async function submitScore() {
  const nameInput = getNameInput();
  const name = nameInput ? nameInput.value : 'Anonymous';
  const scoreValue = typeof score !== "undefined" ? score : 0;

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

// Load top scores (frontend)
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

// --- Netlify function handler for /functions/submit_score ---

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const supabaseUrl = process.env.supabase_url;
  const supabaseKey = process.env.supabase_key;
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (event.httpMethod === 'POST') {
    // Insert new score submission
    const { name, score, game } = JSON.parse(event.body);
    const { data, error } = await supabase
      .from('Scores')
      .insert([{ name, score, game }]);
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'GET') {
    // Show only highest score per name for this game
    const game = event.queryStringParameters.game || '';
    // Call the Postgres function get_high_scores, which you must define in Supabase SQL editor:
    // See instructions in chat for SQL needed!
    const { data, error } = await supabase
      .rpc('get_high_scores', { this_game: game });
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify(data) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
