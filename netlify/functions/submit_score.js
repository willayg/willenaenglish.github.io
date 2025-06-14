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
  const user_id = localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || null;

  const response = await fetch('/.netlify/functions/submit_score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score: scoreValue, game: window.game, user_id })
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
      li.textContent = `${entry.name}: ${entry.score} ${entry.badge || ''}`;
      highScoresList.appendChild(li);
    });
  } else {
    console.error('Failed to fetch scores:', data.error);
  }
}

// --- Netlify function handler for /functions/submit_score ---

const { createClient } = require('@supabase/supabase-js');

// Badge rules: default and per-game overrides
const badgeRules = {
  // Example override for a specific game:
  // EmojiGame: [
  //   { min: 2000, badge: '🥉' },
  //   { min: 5000, badge: '🥈' },
  //   { min: 9000, badge: '🥇' }
  // ]
};

const defaultBadgeRules = [
  { min: 5000, badge: '🥇' },
  { min: 3000, badge: '🥈' },
  { min: 1000, badge: '🥉' }
];

function getBadge(game, score) {
  const rules = badgeRules[game] || defaultBadgeRules;
  for (const rule of rules) {
    if (score >= rule.min) return rule.badge;
  }
  return '';
}

exports.handler = async (event) => {
  const supabaseUrl = process.env.supabase_url;
  const supabaseKey = process.env.supabase_key;
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (event.httpMethod === 'POST') {
    const { name, score, game, user_id } = JSON.parse(event.body);
    const { data, error } = await supabase
      .from('Scores')
      .insert([{ name, score, game, user_id }]);
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'GET') {
    const game = event.queryStringParameters.game || '';
    const { data, error } = await supabase
      .rpc('get_high_scores', { this_game: game });
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    // Assign badges using per-game or default rules
    const withBadges = (data || []).map(entry => ({
      ...entry,
      badge: getBadge(entry.game, entry.score)
    }));

    return { statusCode: 200, body: JSON.stringify(withBadges) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
