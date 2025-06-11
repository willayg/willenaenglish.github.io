const { createClient } = require('@supabase/supabase-js');

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
      .select('*')
      .eq('game', game) // Only scores for this game
      .order('score', { ascending: false })
      .limit(10);
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify(data) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
