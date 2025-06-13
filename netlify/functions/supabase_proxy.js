const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Dedicated POST handler for Scores table
  if (
    event.httpMethod === 'POST' &&
    event.path &&
    event.path.includes('submit_score')
  ) {
    try {
      const { name, score, game } = JSON.parse(event.body);
      const { error } = await supabase
        .from('Scores')
        .insert([{ name, score, game }]);
      if (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
      }
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (err) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
  }

  // General CRUD handler
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};
  const table = body.table || 'users'; // Default table

  let result;

  try {
    if (method === 'GET') {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(body.limit || 10);
      if (error) throw error;
      result = { data };
    } else if (method === 'POST') {
      const { data, error } = await supabase
        .from(table)
        .insert(body.values)
        .select();
      if (error) throw error;
      result = { data };
    } else if (method === 'PUT') {
      const { data, error } = await supabase
        .from(table)
        .update(body.values)
        .match(body.match);
      if (error) throw error;
      result = { data };
    } else if (method === 'DELETE') {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .match(body.match);
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