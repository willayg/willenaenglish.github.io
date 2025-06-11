const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.supabase_url, process.env.supabase_key);

exports.handler = async (event) => {
  if (event.httpMethod === 'POST') {
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
    const game = event.queryStringParameters.game || 'Fruti';
    const { data, error } = await supabase
      .from('Scores')
      .select('name, score')
      .ilike('game', game) // <-- Use ilike for case-insensitive match
      .order('score', { ascending: false })
      .limit(10);
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify(data) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
