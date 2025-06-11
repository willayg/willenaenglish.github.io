const { createClient } = require('@supabase/supabase-js');

<<<<<<< HEAD
=======
const supabase = createClient(process.env.supabase_url, process.env.supabase_key);

>>>>>>> 199f181acde472f1644539a8062caea32c33fa7d
exports.handler = async (event) => {
  const SUPABASE_URL = process.env.supabase_url;
  const SUPABASE_KEY = process.env.supabase_key;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('SUPABASE_URL:', SUPABASE_URL);
  console.log('SUPABASE_KEY:', SUPABASE_KEY ? 'set' : 'not set');

  if (event.httpMethod === 'POST') {
    const { name, score, game } = JSON.parse(event.body);
    const { data, error } = await supabase
      .from('Scores')
      .insert([{ name, score, game }]);
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // GET: return top scores
  if (event.httpMethod === 'GET') {
    const game = event.queryStringParameters.game || 'Fruti';
    const { data, error } = await supabase
      .from('Scores')
<<<<<<< HEAD
      .select('*')
      .eq('game', game) // Only scores for this game
=======
      .select('name, score')
      .ilike('game', game) // <-- Use ilike for case-insensitive match
>>>>>>> 199f181acde472f1644539a8062caea32c33fa7d
      .order('score', { ascending: false })
      .limit(10);
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify(data) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
