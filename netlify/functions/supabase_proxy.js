const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const SUPABASE_URL = process.env.supabase_url;
  const SUPABASE_KEY = process.env.supabase_key;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if (event.httpMethod === 'POST') {
    console.log('BODY:', event.body); // Add this line
    const { name, score, game } = JSON.parse(event.body);
    const { data, error } = await supabase
      .from('Scores')
      .insert([{ name, score, game }]);
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // Parse request
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};
  const table = body.table || 'users'; // Default table

  let result;

  try {
    if (method === 'GET') {
      // Read: fetch rows (optionally with filters)
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(body.limit || 10);
      if (error) throw error;
      result = { data };
    } else if (method === 'POST') {
      // Create: insert new row(s)
      const { data, error } = await supabase
        .from(table)
        .insert(body.values)
        .select();
      if (error) throw error;
      result = { data };
    } else if (method === 'PUT') {
      // Update: update row(s) by filter
      const { data, error } = await supabase
        .from(table)
        .update(body.values)
        .match(body.match); // e.g., { id: 1 }
      if (error) throw error;
      result = { data };
    } else if (method === 'DELETE') {
      // Delete: delete row(s) by filter
      const { data, error } = await supabase
        .from(table)
        .delete()
        .match(body.match); // e.g., { id: 1 }
      if (error) throw error;
      result = { data };
    } else {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function submitScore(forcedName) {
  let name = forcedName || nameInput.value || 'Anonymous';
  // If name is an object (e.g., event), use 'Anonymous'
  if (typeof name !== 'string') name = 'Anonymous';
  console.log("Submit button clicked", name);

  const response = await fetch('/.netlify/functions/submit_score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score, game: "JungleAnimalGame" })
  });
  const result = await response.json();
  if (response.ok) {
    nameInput.style.display = 'none';
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.style.display = 'none';
    displayHighScores();
  } else {
    console.error('Failed to submit score:', result.error);
  }
}